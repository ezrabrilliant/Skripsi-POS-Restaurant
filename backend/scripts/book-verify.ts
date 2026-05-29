// Verifikasi transkripsi book-data.ts SEBELUM import.
// Cek: Σ(tx.amount per metode) tiap hari == summary buku yang ditranskrip.
// Mismatch = error transkripsi (salah amount/metode) → harus dibetulkan dulu.
// Jalankan: npx tsx scripts/book-verify.ts

import { BOOK_DATA } from './book-data'

let totalErrors = 0
let grandTotal = 0
const methodTotals: Record<string, number> = {}

for (const day of BOOK_DATA) {
  const computed: Record<string, number> = {}
  for (const tx of day.transactions) {
    computed[tx.method] = (computed[tx.method] ?? 0) + tx.amount
    grandTotal += tx.amount
    methodTotals[tx.method] = (methodTotals[tx.method] ?? 0) + tx.amount
  }
  // Bandingkan computed vs day.summary
  const methods = new Set([...Object.keys(computed), ...Object.keys(day.summary)])
  const dayErrors: string[] = []
  for (const m of methods) {
    const c = computed[m] ?? 0
    const s = (day.summary as Record<string, number>)[m] ?? 0
    if (c !== s) {
      dayErrors.push(`    ${m}: computed ${c.toLocaleString()} vs book ${s.toLocaleString()} (selisih ${(c - s).toLocaleString()})`)
    }
  }
  const dayTotal = Object.values(computed).reduce((a, b) => a + b, 0)
  if (dayErrors.length > 0) {
    totalErrors += dayErrors.length
    console.log(`❌ ${day.date} (${day.cashier}) — total ${dayTotal.toLocaleString()}`)
    dayErrors.forEach((e) => console.log(e))
  } else {
    console.log(`✓ ${day.date} (${day.cashier}) — ${day.transactions.length} tx, total ${dayTotal.toLocaleString()}`)
  }
}

console.log('\n=== RINGKASAN BULAN ===')
console.log(`Grand total: Rp ${grandTotal.toLocaleString()}`)
Object.entries(methodTotals).sort().forEach(([m, t]) => console.log(`  ${m}: Rp ${t.toLocaleString()}`))
console.log(`\nTotal transaksi: ${BOOK_DATA.reduce((a, d) => a + d.transactions.length, 0)}`)
console.log(totalErrors === 0 ? '\n✅ SEMUA HARI RECONCILE (transkripsi cocok summary buku)' : `\n❌ ${totalErrors} mismatch — betulkan transkripsi dulu`)
