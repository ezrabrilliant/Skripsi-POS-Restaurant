// REV 2.8 - import stok opname harian buku (halaman kiri) sebagai PortionMovement
// dengan ledger (qty_before/qty_after) + waktu opname pagi 09:30–09:59.
//
// Sumber: book-stock-raw.json (ekstraksi verbatim 27 doc /docs/data buku/).
// Tiap pagi (kronologis): owner HITUNG stok → catat opname. Movement:
//   reason=manualAdjust, delta = countedHariIni − countedKemarin, qtyBefore=kemarin,
//   qtyAfter=hari ini, note "Opname buku <tgl>", userId=kasir hari itu.
// currentQty tiap item porsi di-set ke hitungan hari TERAKHIR dalam scope (--until).
//
// Jalankan: npx tsx --env-file=.env scripts/import-book-stock.ts [--reset] [--until=YYYY-MM-DD]
//   --reset  : hapus movement "Opname buku" lama dulu (aman; tidak sentuh data lain,
//              tidak nge-nol-kan stok item di luar buku).
//   --until  : batas tanggal import (default 2026-05-27). Prod pakai 2026-05-26.
//
// PENTING (beda dari versi lama): TIDAK ada updateMany nol-kan semua stok. Hanya item
// di buku yang disentuh. qty_before/after diisi. Mapping lengkap (Semur A→Semur Ayam,
// Krupuk B→Kerupuk, Krupuk C→Kerupuk Udang, Susuk/Susu K→Susu Kedelai, Ikan→Gurame
// Bakar, PAHA C→Paha Goreng, Lidang W→Udang W, varian KAPITAL).

import { PrismaClient, PortionMovementReason } from '@prisma/client'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BOOK_DATA } from './book-data'

const prisma = new PrismaClient()
const NOTE_PREFIX = 'Opname buku'

// Kasir per tanggal dari book-data (Bryant=3, Chen Hong=4); fallback owner=1.
const CASHIER_ID: Record<string, number> = { Bryant: 3, 'Chen Hong': 4 }
const cashierByDate = new Map<string, number>()
for (const d of BOOK_DATA) cashierByDate.set(d.date, CASHIER_ID[d.cashier] ?? 1)

// Nama mentah stok → nama kanonik menu (HANYA yang stockType=portion punya opname).
const STOCK_ALIAS: Record<string, string> = {
  'PAHA B': 'Paha Ayam Bakar',
  'PAHA G': 'Paha Ayam Goreng',
  'PAHA C': 'Paha Ayam Goreng', // koreksi user: salah baca, asli PAHA G
  'DADA B': 'Dada Ayam Bakar',
  'DADA G': 'Dada Ayam Goreng',
  Ati: 'Ati Ayam',
  ATI: 'Ati Ayam',
  Rempelo: 'Rempelo Ayam',
  REMPELO: 'Rempelo Ayam',
  Kepala: 'Kepala Ayam',
  KEPALA: 'Kepala Ayam',
  'Gasem A': 'Garang Asem Ayam',
  'Gasem D': 'Garang Asem Daging',
  'Semur D': 'Semur Daging',
  'Semur A': 'Semur Ayam',
  Rawon: 'Rawon Daging',
  'Gulai D': 'Gulai Daging',
  'Gule D': 'Gulai Daging',
  'Gulai B': 'Gulai Babat',
  'Gule B': 'Gulai Babat',
  Empal: 'Empal Penyet',
  Bakwan: 'Bakwan Penyet',
  Petai: 'Petai Goreng',
  'Udang W': 'Udang Windu Bakar (isi 7)',
  'Lidang W': 'Udang Windu Bakar (isi 7)', // OCR error utk Udang W
  Ikan: 'Gurame Bakar',
  IKAN: 'Gurame Bakar',
  'Sarang B': 'Sarang Burung',
  Susuk: 'Susu Kedelai',
  'Susu K': 'Susu Kedelai',
  'Krupuk B': 'Kerupuk',
  'Krupuk C': 'Kerupuk Udang',
}

type RawDay = { date: string; stock: { name: string; qty: number }[] }

// Waktu opname pseudo-acak deterministik 09:30:00–09:59:59 (stabil saat re-run).
function opnameTime(date: string, menuId: number): Date {
  let h = 0
  const s = `${date}#${menuId}`
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  const minute = 30 + (h % 30)
  const second = Math.floor(h / 30) % 60
  return new Date(`${date}T09:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}+07:00`)
}

async function main() {
  const reset = process.argv.includes('--reset')
  const untilArg = process.argv.find((a) => a.startsWith('--until='))
  const until = untilArg ? untilArg.split('=')[1] : '2026-05-27'

  const raw: RawDay[] = JSON.parse(readFileSync(join(__dirname, 'book-stock-raw.json'), 'utf8'))
  const days = raw.filter((d) => d.date <= until).sort((a, b) => a.date.localeCompare(b.date))

  if (reset) {
    const del = await prisma.portionMovement.deleteMany({ where: { note: { startsWith: NOTE_PREFIX } } })
    console.log(`(reset) hapus ${del.count} movement "Opname buku" lama`)
  }

  const portionMenus = await prisma.menu.findMany({ where: { stockType: 'portion' }, select: { id: true, name: true } })
  const idByName = new Map(portionMenus.map((m) => [m.name, m.id]))

  const prev = new Map<number, number>() // running count per menuId (replay kronologis)
  const lastQty = new Map<number, number>() // hitungan hari terakhir per menuId
  const skipped = new Map<string, number>()
  let movementCount = 0

  for (const day of days) {
    const userId = cashierByDate.get(day.date) ?? 1
    for (const s of day.stock) {
      // baris gabungan "Gule B / Ikan" (21 Mei): pisah jadi 2 (qty buku 2/4)
      const entries =
        s.name === 'Gule B / Ikan' ? [{ name: 'Gule B', qty: 2 }, { name: 'Ikan', qty: 4 }] : [s]
      for (const e of entries) {
        const canonical = STOCK_ALIAS[e.name]
        if (!canonical) {
          skipped.set(e.name, (skipped.get(e.name) ?? 0) + 1)
          continue
        }
        const menuId = idByName.get(canonical)
        if (!menuId) {
          const key = `${e.name}→${canonical}(non-portion)`
          skipped.set(key, (skipped.get(key) ?? 0) + 1)
          continue
        }
        const before = prev.get(menuId) ?? 0
        const after = e.qty
        lastQty.set(menuId, after)
        if (after !== before) {
          await prisma.portionMovement.create({
            data: {
              menuId,
              delta: after - before,
              qtyBefore: before,
              qtyAfter: after,
              reason: PortionMovementReason.manualAdjust,
              note: `${NOTE_PREFIX} ${day.date}`,
              userId,
              createdAt: opnameTime(day.date, menuId),
            },
          })
          movementCount++
        }
        prev.set(menuId, after)
      }
    }
  }

  // Set currentQty + opening hari terakhir scope ke hitungan buku terakhir per item.
  const lastDate = days[days.length - 1].date
  for (const [menuId, qty] of lastQty) {
    await prisma.portionStock.update({
      where: { menuId },
      data: { currentQty: qty, openingQtyToday: qty, openingQtyDate: new Date(`${lastDate}T00:00:00Z`) },
    })
  }

  console.log(`✅ Opname stok: ${movementCount} movement (s/d ${until}), set currentQty ${lastQty.size} item ke hitungan ${lastDate}`)
  if (skipped.size > 0) console.log(`   Skip (tak dipetakan): ${[...skipped.entries()].map(([k, v]) => `${k}×${v}`).join(', ')}`)
}

main()
  .catch((e) => {
    console.error('ERR', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
