import { describe, it, expect } from 'vitest'
import { buildReceiptRows, type Row } from './receipt'
import type { Transaction } from '@/types'

// Factory transaksi minimal untuk struk. Hanya field yang dibaca buildReceiptRows.
function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: 1, shiftId: 1, orderType: 'dineIn', tableNumber: 3,
    createdById: 1, createdByName: 'Jason', shiftCashierName: 'Jason',
    status: 'paid', mergedIntoId: null,
    subtotal: 0, discountAmount: 0, taxAmount: 0, taxBorneAmount: 0, total: 0,
    items: [], payments: [],
    createdAt: '2026-06-07T10:00:00.000Z', paidAt: '2026-06-07T10:05:00.000Z', voidedAt: null,
    ...partial,
  } as Transaction
}

function item(over: { menuName: string; qty: number; subtotal: number }) {
  return {
    id: Math.floor(over.subtotal), menuId: 1, menuName: over.menuName, qty: over.qty,
    unitPrice: over.subtotal / over.qty, subtotal: over.subtotal,
    subOptionsSelected: null, notes: null, createdAt: '2026-06-07T10:00:00.000Z',
  }
}

const lr = (rows: Row[], label: string) =>
  rows.find((r): r is Extract<Row, { t: 'lr' }> => r.t === 'lr' && r.l === label)

describe('buildReceiptRows', () => {
  it('struk non-merge: subtotal == jumlah item, hanya item parent', () => {
    const t = tx({
      subtotal: 40000, total: 40000,
      items: [item({ menuName: 'Ayam Bakar', qty: 2, subtotal: 40000 })],
      payments: [{ id: 1, method: 'cash', bank: null, amount: 40000, recordedAt: '', recordedById: 1, recordedByName: 'Jason' }],
    })
    const rows = buildReceiptRows(t, { identity: null })
    expect(rows.some((r) => r.t === 'lr' && r.l.includes('Ayam Bakar'))).toBe(true)
    expect(lr(rows, 'Subtotal')?.r).toBe('40.000')
    expect(lr(rows, 'TOTAL')?.r).toBe('40.000')
  })

  it('struk gabungan: semua item (parent + anak) muncul & subtotal agregat rekonsiliasi', () => {
    const t = tx({
      subtotal: 40000, total: 50000, // total agregat sudah di-set backend
      items: [item({ menuName: 'Ayam Bakar', qty: 2, subtotal: 40000 })],
      payments: [{ id: 1, method: 'cash', bank: null, amount: 50000, recordedAt: '', recordedById: 1, recordedByName: 'Jason' }],
      mergedSources: [
        { id: 2, tableNumber: 3, subtotal: 10000, items: [
          item({ menuName: 'Es Teh', qty: 1, subtotal: 5000 }),
          item({ menuName: 'Nasi Putih', qty: 1, subtotal: 5000 }),
        ] },
      ],
    })
    const rows = buildReceiptRows(t, { identity: null })
    expect(rows.some((r) => r.t === 'lr' && r.l.includes('Ayam Bakar'))).toBe(true)
    expect(rows.some((r) => r.t === 'lr' && r.l.includes('Es Teh'))).toBe(true)
    expect(rows.some((r) => r.t === 'lr' && r.l.includes('Nasi Putih'))).toBe(true)
    // Subtotal = 40000 + 10000 = 50000, rekonsiliasi dengan TOTAL.
    expect(lr(rows, 'Subtotal')?.r).toBe('50.000')
    expect(lr(rows, 'TOTAL')?.r).toBe('50.000')
    // Catatan gabungan muncul.
    expect(rows.some((r) => r.t === 'left' && r.s.includes('Gabungan'))).toBe(true)
  })

  it('cashReceived: baris Tunai = uang diterima & Kembali = diterima - total', () => {
    const t = tx({
      subtotal: 41800, total: 41800,
      items: [item({ menuName: 'Ayam Bakar', qty: 1, subtotal: 41800 })],
      payments: [{ id: 1, method: 'cash', bank: null, amount: 41800, recordedAt: '', recordedById: 1, recordedByName: 'Jason' }],
    })
    const rows = buildReceiptRows(t, { identity: null, cashReceived: 50000, paymentLabel: () => 'Tunai' })
    expect(lr(rows, 'Tunai')?.r).toBe('50.000')
    expect(lr(rows, 'Kembali')?.r).toBe('8.200')
  })

  it('cashReceived dengan slice non-cash sebelumnya: Kembali atas sisa tunai', () => {
    const t = tx({
      subtotal: 41800, total: 41800,
      items: [item({ menuName: 'Paket', qty: 1, subtotal: 41800 })],
      payments: [
        { id: 1, method: 'qris', bank: null, amount: 21800, recordedAt: '', recordedById: 1, recordedByName: 'Jason' },
        { id: 2, method: 'cash', bank: null, amount: 20000, recordedAt: '', recordedById: 1, recordedByName: 'Jason' },
      ],
    })
    const rows = buildReceiptRows(t, { identity: null, cashReceived: 50000, paymentLabel: (m) => (m === 'cash' ? 'Tunai' : 'QRIS') })
    // sisa tunai = total - nonCash = 41800 - 21800 = 20000; kembali = 50000 - 20000 = 30000
    expect(lr(rows, 'Tunai')?.r).toBe('50.000')
    expect(lr(rows, 'QRIS')?.r).toBe('21.800')
    expect(lr(rows, 'Kembali')?.r).toBe('30.000')
  })
})
