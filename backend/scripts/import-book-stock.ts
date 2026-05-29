// Import stok porsi harian (halaman kiri buku) sebagai OPNAME per tanggal (#D).
// Jalankan: npx tsx scripts/import-book-stock.ts [--reset]
//
// Tiap hari (kronologis 1-27 Mei): SET PortionStock.currentQty = angka hitungan buku,
// catat PortionMovement(reason=manualAdjust, delta = counted - prevQty) = jejak opname.
// currentQty berakhir di hitungan 27 Mei. Histori per tanggal ada di portion_movements.
//
// Hanya item yang map ke menu stockType=portion (punya PortionStock). Item non-portion
// (Sarang B, Petai = nonStock) + tak dikenal (Krupuk/Susuk/Semur A/PAHA C) di-skip.
// userId = kasir hari itu. Note movement = "Opname buku <tanggal>".

import { PrismaClient, PortionMovementReason } from '@prisma/client'
import { BOOK_DATA, STOCK_ALIAS } from './book-data'

const prisma = new PrismaClient()
const CASHIER_ID: Record<string, number> = { Bryant: 3, 'Chen Hong': 4 }
const NOTE_PREFIX = 'Opname buku'

function wib(date: string, hh: number, mm: number): Date {
  return new Date(`${date}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+07:00`)
}

async function main() {
  const reset = process.argv.includes('--reset')
  if (reset) {
    const del = await prisma.portionMovement.deleteMany({ where: { note: { startsWith: NOTE_PREFIX } } })
    console.log(`(reset) hapus ${del.count} movement opname buku lama`)
    // Reset currentQty + opening ke 0 untuk portion stocks (state seed awal)
    await prisma.portionStock.updateMany({ data: { currentQty: 0, openingQtyToday: 0 } })
  }

  // Menu portion saja (punya PortionStock)
  const portionMenus = await prisma.menu.findMany({ where: { stockType: 'portion' }, select: { id: true, name: true } })
  const portionByName = new Map(portionMenus.map((m) => [m.name, m.id]))

  // Track currentQty in-memory per menuId (replay kronologis)
  const curQty = new Map<number, number>()
  for (const m of portionMenus) curQty.set(m.id, 0)

  const skipped = new Set<string>()
  let movementCount = 0

  for (const day of BOOK_DATA) {
    const userId = CASHIER_ID[day.cashier]
    const ts = wib(day.date, 9, 0) // opname pagi
    for (const s of day.stock) {
      const canonical = STOCK_ALIAS[s.name]
      if (!canonical) { skipped.add(s.name); continue }
      const menuId = portionByName.get(canonical)
      if (!menuId) { skipped.add(`${s.name}→${canonical}(non-portion)`); continue }
      const prev = curQty.get(menuId) ?? 0
      const delta = s.qty - prev
      // SET stock ke angka buku + opening today
      await prisma.portionStock.update({
        where: { menuId },
        data: { currentQty: s.qty, openingQtyToday: s.qty, openingQtyDate: new Date(`${day.date}T00:00:00Z`) },
      })
      if (delta !== 0) {
        await prisma.portionMovement.create({
          data: {
            menuId, delta, reason: PortionMovementReason.manualAdjust,
            note: `${NOTE_PREFIX} ${day.date}`, userId, createdAt: ts,
          },
        })
        movementCount++
      }
      curQty.set(menuId, s.qty)
    }
  }

  console.log(`✅ Opname stok selesai: ${movementCount} movement (1-27 Mei)`)
  console.log(`   currentQty sekarang = hitungan 27 Mei`)
  if (skipped.size > 0) console.log(`   Skip (non-portion / tak dikenal): ${[...skipped].join(', ')}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
