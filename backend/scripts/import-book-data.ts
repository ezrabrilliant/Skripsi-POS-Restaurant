// Import data buku historis (1-27 Mei 2026) ke DB.
// Jalankan: npx tsx scripts/import-book-data.ts [--reset]
//   --reset : hapus dulu data import lama (shift malam 1-27 Mei + turunannya) sebelum insert.
//
// STRATEGI (disetujui Ezra): nominal buku = OTORITAS.
//   - Transaction.subtotal = total = amount buku PERSIS (discount=0, tax=0).
//   - TransactionPayment.amount = amount → rekonsiliasi harian per metode match summary buku.
//   - TransactionItem = best-effort (unitPrice catalog × qty); Σ bisa ≠ subtotal (diterima).
//   - RAW insert (BUKAN service) → tidak auto-decrement stok, tidak auto-resolve shift.
//   - Stok harian = opname terpisah (import-book-stock.ts).
//
// Keputusan: gojek1+grab2 (ikut buku), 17 Mei #6 keep paid, 21 Mei Inhaler skip (cash gap 35k OK).

import { PrismaClient, Prisma } from '@prisma/client'
import { BOOK_DATA, type BookDay } from './book-data'

const prisma = new PrismaClient()
const CASHIER_ID: Record<string, number> = { Bryant: 3, 'Chen Hong': 4 }
const OWNER_ID = 1

// Konstruksi instant WIB → Date (UTC). hh:mm WIB.
function wib(date: string, hh: number, mm: number): Date {
  return new Date(`${date}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+07:00`)
}

async function resetImport(dates: string[]) {
  // Hapus HANYA data import buku: shift malam pada TANGGAL yang sedang di-import
  // (scoped - TIDAK menyentuh tanggal di luar scope, mis. data live prod 27-28 Mei).
  const shifts = await prisma.shift.findMany({
    where: {
      type: 'malam',
      date: { in: dates.map((d) => new Date(`${d}T00:00:00Z`)) },
    },
    select: { id: true },
  })
  const shiftIds = shifts.map((s) => s.id)
  if (shiftIds.length === 0) {
    console.log('  (reset) tidak ada shift import lama')
    return
  }
  const txs = await prisma.transaction.findMany({ where: { shiftId: { in: shiftIds } }, select: { id: true } })
  const txIds = txs.map((t) => t.id)
  await prisma.$transaction([
    prisma.settlementMethodCount.deleteMany({ where: { settlement: { shiftId: { in: shiftIds } } } }),
    prisma.settlement.deleteMany({ where: { shiftId: { in: shiftIds } } }),
    prisma.transactionPayment.deleteMany({ where: { transactionId: { in: txIds } } }),
    prisma.transactionItem.deleteMany({ where: { transactionId: { in: txIds } } }),
    prisma.transaction.deleteMany({ where: { id: { in: txIds } } }),
    prisma.shift.deleteMany({ where: { id: { in: shiftIds } } }),
  ])
  console.log(`  (reset) hapus ${shiftIds.length} shift + ${txIds.length} transaksi import lama`)
}

async function importDay(day: BookDay, menuByName: Map<string, { id: number; price: Prisma.Decimal }>) {
  const cashierId = CASHIER_ID[day.cashier]
  // 1. Shift malam (closedAt = 22:00 WIB hari itu)
  const shift = await prisma.shift.create({
    data: {
      date: new Date(`${day.date}T00:00:00Z`),
      type: 'malam',
      cashierId,
      openingCash: new Prisma.Decimal(day.openingCash),
      closedAt: wib(day.date, 22, 0),
      createdAt: wib(day.date, 17, 30),
    },
  })

  // 2. Transaksi + item + payment
  let txIndex = 0
  for (const tx of day.transactions) {
    const ts = wib(day.date, 18 + Math.floor(txIndex / 4), (txIndex % 4) * 15) // sebar 18:00+
    txIndex++
    const amount = new Prisma.Decimal(tx.amount)
    const created = await prisma.transaction.create({
      data: {
        shiftId: shift.id,
        orderType: tx.orderType,
        tableNumber: tx.orderType === 'dineIn' ? (tx.table ?? null) : null,
        createdById: cashierId,
        status: 'paid',
        subtotal: amount, // book total authoritative
        discountAmount: new Prisma.Decimal(0),
        taxAmount: new Prisma.Decimal(0),
        total: amount,
        createdAt: ts,
        paidAt: ts,
      },
    })
    // Items (skip qty<=0 placeholder)
    for (const it of tx.items) {
      if (it.qty <= 0) continue
      const menu = menuByName.get(it.name)
      if (!menu) throw new Error(`Menu tidak ditemukan: "${it.name}" (${day.date} - ${tx.raw})`)
      const itemSubtotal = menu.price.mul(it.qty)
      await prisma.transactionItem.create({
        data: {
          transactionId: created.id,
          menuId: menu.id,
          qty: it.qty,
          unitPrice: menu.price,
          subtotal: itemSubtotal,
          notes: it.notes ?? null,
          createdAt: ts,
        },
      })
    }
    // Payment slice (single, full)
    await prisma.transactionPayment.create({
      data: {
        transactionId: created.id,
        method: tx.method,
        bank: tx.bank ?? null,
        amount,
        recordedById: cashierId,
        recordedAt: ts,
      },
    })
  }

  // 3. Settlement + method counts (counted = summary buku; system = Σ tx amount per method)
  const systemByMethod: Record<string, number> = {}
  for (const tx of day.transactions) systemByMethod[tx.method] = (systemByMethod[tx.method] ?? 0) + tx.amount
  const settlement = await prisma.settlement.create({
    data: {
      shiftId: shift.id,
      date: new Date(`${day.date}T00:00:00Z`),
      cashierId,
      reviewerId: OWNER_ID,
      status: 'reviewed',
      submittedAt: wib(day.date, 22, 5),
      reviewedAt: wib(day.date, 22, 30),
    },
  })
  const allMethods = new Set([...Object.keys(systemByMethod), ...Object.keys(day.summary)])
  for (const m of allMethods) {
    await prisma.settlementMethodCount.create({
      data: {
        settlementId: settlement.id,
        paymentMethodCode: m,
        counted: (day.summary as Record<string, number>)[m] ?? 0, // kasir count = buku
        system: systemByMethod[m] ?? 0, // dari transaksi
      },
    })
  }
  const dayTotal = Object.values(systemByMethod).reduce((a, b) => a + b, 0)
  console.log(`  ✓ ${day.date} (${day.cashier}): ${day.transactions.length} tx, Rp ${dayTotal.toLocaleString()}`)
}

async function main() {
  const untilArg = process.argv.find((a) => a.startsWith('--until='))
  const until = untilArg ? untilArg.split('=')[1] : '2026-05-27'
  const days = BOOK_DATA.filter((d) => d.date <= until)
  console.log(`=== Import Data Buku 1 Mei s/d ${until} (${days.length} hari) ===`)

  if (process.argv.includes('--reset')) {
    console.log('Reset data import lama (scoped ke tanggal import)...')
    await resetImport(days.map((d) => d.date))
  }
  const menus = await prisma.menu.findMany({ select: { id: true, name: true, price: true } })
  const menuByName = new Map(menus.map((m) => [m.name, { id: m.id, price: m.price }]))

  // Pre-validate semua nama item ada (gagal cepat sebelum insert apa pun)
  const missing = new Set<string>()
  for (const day of days)
    for (const tx of day.transactions)
      for (const it of tx.items)
        if (it.qty > 0 && !menuByName.has(it.name)) missing.add(it.name)
  if (missing.size > 0) {
    console.error('❌ Menu tidak ditemukan:', [...missing].join(', '))
    process.exit(1)
  }

  for (const day of days) await importDay(day, menuByName)

  const txCount = await prisma.transaction.count({
    where: { shift: { type: 'malam', date: { in: days.map((d) => new Date(`${d.date}T00:00:00Z`)) } } },
  })
  console.log(`\n✅ Import selesai. Total transaksi import di DB: ${txCount}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
