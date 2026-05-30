// REV 2.8 - sinkron klasifikasi menu untuk import data buku (dev + prod).
// Idempotent: aman dijalankan berulang & di kedua environment.
//
// ENSURE_PORTION: item yang DICATAT di stok harian buku → harus stockType=portion
//   + punya baris portion_stocks (currentQty 0, nanti di-set oleh opname import).
//   Kerupuk/Kerupuk Udang dibuat kalau belum ada (prod belum punya). Semur Ayam
//   menu baru (stok-only, tak pernah dijual - qty harga sama Semur Daging).
// ENSURE_NONSTOCK: item yang TIDAK ditrack di buku tapi dev lama keburu portion
//   (Air Mineral/Es Degan/Es Cincau) → balikin ke nonStock biar cocok catalog+prod.
//   portion_stocks lama dibiarkan (histori; tak akan auto-decrement saat nonStock).
//
// Jalankan: npx tsx --env-file=.env scripts/sync-menus-stock-rev28.ts
//   (set DATABASE_URL ke dev atau prod sesuai target)

import { PrismaClient, StockType } from '@prisma/client'

const prisma = new PrismaClient()

const ENSURE_PORTION: { name: string; category: string; price: number; minStock: number }[] = [
  { name: 'Petai Goreng', category: 'Side Dish', price: 20000, minStock: 5 },
  { name: 'Sarang Burung', category: 'Minuman', price: 80000, minStock: 5 },
  { name: 'Susu Kedelai', category: 'Minuman', price: 15000, minStock: 5 },
  { name: 'Kerupuk', category: 'Side Dish', price: 7000, minStock: 5 },
  { name: 'Kerupuk Udang', category: 'Side Dish', price: 15000, minStock: 5 },
  { name: 'Semur Ayam', category: 'Sayur & Sup', price: 30000, minStock: 5 },
]

const ENSURE_NONSTOCK = ['Air Mineral', 'Es Degan', 'Es Cincau']

async function main() {
  console.log('=== ENSURE PORTION (book-tracked items) ===')
  for (const t of ENSURE_PORTION) {
    let menu = await prisma.menu.findFirst({ where: { name: t.name } })
    if (!menu) {
      menu = await prisma.menu.create({
        data: { name: t.name, category: t.category, price: t.price, stockType: StockType.portion, minStock: t.minStock, isActive: true },
      })
      console.log(`+ created menu "${t.name}" (#${menu.id}) portion min${t.minStock}`)
    } else if (menu.stockType !== StockType.portion || menu.minStock == null) {
      menu = await prisma.menu.update({ where: { id: menu.id }, data: { stockType: StockType.portion, minStock: t.minStock } })
      console.log(`~ reclassified "${t.name}" (#${menu.id}) → portion min${t.minStock}`)
    } else {
      console.log(`= "${t.name}" (#${menu.id}) already portion`)
    }
    const ps = await prisma.portionStock.findUnique({ where: { menuId: menu.id } })
    if (!ps) {
      await prisma.portionStock.create({ data: { menuId: menu.id, currentQty: 0, minStock: t.minStock } })
      console.log(`  + portion_stock row for "${t.name}"`)
    }
  }

  console.log('\n=== ENSURE NONSTOCK (untracked drinks; fix dev drift) ===')
  for (const name of ENSURE_NONSTOCK) {
    const menu = await prisma.menu.findFirst({ where: { name } })
    if (!menu) {
      console.log(`? "${name}" not found (skip)`) // ada di catalog, harusnya ada
      continue
    }
    if (menu.stockType !== StockType.nonStock) {
      await prisma.menu.update({ where: { id: menu.id }, data: { stockType: StockType.nonStock, minStock: null } })
      console.log(`~ "${name}" (#${menu.id}) → nonStock (was ${menu.stockType})`)
    } else {
      console.log(`= "${name}" (#${menu.id}) already nonStock`)
    }
  }
  console.log('\ndone.')
}

main()
  .catch((e) => {
    console.error('ERR', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
