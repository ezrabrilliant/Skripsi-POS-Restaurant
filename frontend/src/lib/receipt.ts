// REV 2.12: generator struk PDF (nota kecil 58mm, hitam-putih) via jsPDF.
// Client-side: kasir simpan langsung ke device (cocok PWA). Header dari identitas
// resto (settings). Body: item, subtotal, diskon, PB1, total, metode bayar, kembalian.
//
// PB1 2-sumbu:
//   - taxAmount > 0      → dibebankan ke pelanggan: tampil baris "PB1 X%".
//   - taxBorneAmount > 0 → ditanggung resto: tanpa baris PB1, catatan "Harga sudah
//     termasuk PB1" di footer.

import { jsPDF } from 'jspdf'
import type { Transaction } from '@/types'
import type { PublicIdentity } from '@/services/settingsService'

const WIDTH_MM = 58
const MARGIN_MM = 3
const LINE_H = 3.6 // mm per baris
const FONT_PT = 8
const CHARS = 30 // perkiraan karakter per baris (courier 8pt di ~52mm)

export type Row =
  | { t: 'center'; s: string; bold?: boolean }
  | { t: 'left'; s: string }
  | { t: 'lr'; l: string; r: string; bold?: boolean }
  | { t: 'sep'; c: '-' | '=' }

function money(n: number): string {
  return Math.round(n).toLocaleString('id-ID')
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Word-wrap sederhana ke lebar max karakter (potong kata yang lebih panjang dari max). */
function wrap(s: string, max: number): string[] {
  if (s.length <= max) return [s]
  const out: string[] = []
  let line = ''
  for (const word of s.split(' ')) {
    if ((line ? line + ' ' + word : word).length > max) {
      if (line) out.push(line)
      line = word.length > max ? word.slice(0, max) : word
    } else {
      line = line ? line + ' ' + word : word
    }
  }
  if (line) out.push(line)
  return out
}

export interface ReceiptOptions {
  identity: PublicIdentity | null
  /** persen tarif PB1, untuk label "PB1 10%". Default 10. */
  taxRate?: number
  /** resolusi label metode bayar dari code (mis. cash -> Tunai). Default: code apa adanya. */
  paymentLabel?: (method: string) => string
  /** REV 2.15: uang tunai diterima (ephemeral, frontend-only). Jika ada → baris
   *  Tunai memakai nilai ini & Kembali = cashReceived − sisa tunai (total − Σ non-cash).
   *  Tidak disertakan saat cetak ulang dari Riwayat → kembalian tak tampil (perilaku lama).
   *  Kontrak pemanggil: hanya kirim saat pembayaran memuat komponen tunai, dan pastikan
   *  cashReceived ≥ sisa tunai (PaymentModal sudah memblokir submit jika kurang). Kembalian
   *  pas (0) sengaja tidak memunculkan baris "Kembali". */
  cashReceived?: number
}

/** Bangun daftar baris struk (pure - tanpa side effect). Diuji di receipt.test.ts.
 * REV 2.13: agregasi item + subtotal dari transaksi gabungan (mergedSources). */
export function buildReceiptRows(tx: Transaction, opts: ReceiptOptions): Row[] {
  const id = opts.identity
  const labelOf = opts.paymentLabel ?? ((m) => m)
  const rows: Row[] = []

  // REV 2.13: gabungkan item parent + semua anak yang ter-merge. aggregateSubtotal
  // = subtotal parent + Σ subtotal anak (== Σ semua item) supaya baris Subtotal
  // rekonsiliasi dengan TOTAL (yang sudah agregat dari backend).
  const sources = tx.mergedSources ?? []
  const allItems = [...tx.items, ...sources.flatMap((s) => s.items)]
  const aggregateSubtotal = tx.subtotal + sources.reduce((s, m) => s + m.subtotal, 0)

  // --- Header (identitas resto) ---
  if (id?.restaurantName) rows.push({ t: 'center', s: id.restaurantName, bold: true })
  if (id?.restaurantAddress) wrap(id.restaurantAddress, CHARS).forEach((s) => rows.push({ t: 'center', s }))
  if (id?.restaurantPhone) rows.push({ t: 'center', s: id.restaurantPhone })
  if (id?.openingHours) rows.push({ t: 'center', s: `Buka ${id.openingHours}` })
  rows.push({ t: 'sep', c: '=' })

  // --- Meta transaksi ---
  rows.push({ t: 'lr', l: `No #${tx.id}`, r: fmtDateTime(tx.paidAt ?? tx.createdAt) })
  rows.push({ t: 'left', s: `Kasir: ${tx.shiftCashierName || tx.createdByName}` })
  rows.push({
    t: 'left',
    s: tx.orderType === 'dineIn' ? `Meja ${tx.tableNumber} · Dine-in` : 'Takeaway',
  })
  // REV 2.13: tandai struk gabungan (parent + N anak).
  if (sources.length > 0) rows.push({ t: 'left', s: `Gabungan ${sources.length + 1} pesanan` })
  rows.push({ t: 'sep', c: '-' })

  // --- Item (parent + anak) ---
  for (const it of allItems) {
    const amt = money(it.subtotal)
    const headLines = wrap(`${it.qty}x ${it.menuName}`, CHARS - amt.length - 1)
    headLines.forEach((s, i) =>
      i === 0 ? rows.push({ t: 'lr', l: s, r: amt }) : rows.push({ t: 'left', s }),
    )
    const detail: string[] = []
    if (it.variantLabel) detail.push(it.variantLabel)
    if (it.subOptionsSelected) detail.push(...Object.values(it.subOptionsSelected))
    if (detail.length) wrap('  ' + detail.join(' · '), CHARS).forEach((s) => rows.push({ t: 'left', s }))
    if (it.notes) wrap(`  (${it.notes})`, CHARS).forEach((s) => rows.push({ t: 'left', s }))
  }
  rows.push({ t: 'sep', c: '-' })

  // --- Totals ---
  rows.push({ t: 'lr', l: 'Subtotal', r: money(aggregateSubtotal) })
  if (tx.discountAmount > 0) rows.push({ t: 'lr', l: 'Diskon', r: `-${money(tx.discountAmount)}` })
  if (tx.taxAmount > 0) rows.push({ t: 'lr', l: `PB1 ${opts.taxRate ?? 10}%`, r: money(tx.taxAmount) })
  rows.push({ t: 'sep', c: '-' })
  rows.push({ t: 'lr', l: 'TOTAL', r: money(tx.total), bold: true })

  // --- Pembayaran + kembalian ---
  if (opts.cashReceived != null) {
    // REV 2.15: mode at-payment. Tampilkan slice non-cash apa adanya, lalu satu baris
    // Tunai = uang diterima, dan Kembali = diterima − sisa tunai (total − Σ non-cash).
    const nonCash = tx.payments.filter((p) => p.method !== 'cash')
    let sumNonCash = 0
    for (const p of nonCash) {
      sumNonCash += p.amount
      rows.push({ t: 'lr', l: labelOf(p.method) + (p.bank ? ` (${p.bank})` : ''), r: money(p.amount) })
    }
    rows.push({ t: 'lr', l: labelOf('cash'), r: money(opts.cashReceived) })
    const change = opts.cashReceived - (tx.total - sumNonCash)
    // bold: Kembali ditonjolkan setara TOTAL (renderer key ke row.bold, bukan label).
    if (change > 0) rows.push({ t: 'lr', l: 'Kembali', r: money(change), bold: true })
  } else {
    // Perilaku lama (cetak ulang dari Riwayat): kembalian dari payments (praktis 0).
    const paid = tx.payments.reduce((s, p) => s + p.amount, 0)
    for (const p of tx.payments) {
      rows.push({ t: 'lr', l: labelOf(p.method) + (p.bank ? ` (${p.bank})` : ''), r: money(p.amount) })
    }
    const change = paid - tx.total
    if (change > 0) rows.push({ t: 'lr', l: 'Kembali', r: money(change), bold: true })
  }
  rows.push({ t: 'sep', c: '=' })

  // --- Footer ---
  if (tx.taxBorneAmount > 0) rows.push({ t: 'center', s: 'Harga sudah termasuk PB1' })
  rows.push({ t: 'center', s: '~ Terima kasih ~' })
  rows.push({ t: 'center', s: 'Simpan sebagai bukti bayar' })

  return rows
}

/** Bangun + unduh struk PDF untuk transaksi yang sudah dibayar. */
export function generateReceiptPdf(tx: Transaction, opts: ReceiptOptions): void {
  const rows = buildReceiptRows(tx, opts)

  // --- Render ---
  const height = MARGIN_MM * 2 + rows.length * LINE_H
  const doc = new jsPDF({ unit: 'mm', format: [WIDTH_MM, height] })
  doc.setFont('courier', 'normal')
  doc.setFontSize(FONT_PT)

  const left = MARGIN_MM
  const right = WIDTH_MM - MARGIN_MM
  const center = WIDTH_MM / 2
  let y = MARGIN_MM + LINE_H

  for (const row of rows) {
    if (row.t === 'sep') {
      doc.setFont('courier', 'normal')
      doc.text(row.c.repeat(CHARS), left, y)
    } else if (row.t === 'center') {
      doc.setFont('courier', row.bold ? 'bold' : 'normal')
      doc.text(row.s, center, y, { align: 'center' })
    } else if (row.t === 'left') {
      doc.setFont('courier', 'normal')
      doc.text(row.s, left, y)
    } else {
      doc.setFont('courier', row.bold ? 'bold' : 'normal')
      doc.text(row.l, left, y)
      doc.text(row.r, right, y, { align: 'right' })
    }
    y += LINE_H
  }

  const dt = new Date(tx.paidAt ?? tx.createdAt)
  const stamp = `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}`
  doc.save(`struk-${tx.id}-${stamp}.pdf`)
}
