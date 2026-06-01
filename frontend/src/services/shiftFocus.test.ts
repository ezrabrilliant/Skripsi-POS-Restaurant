import { describe, it, expect } from 'vitest'
import { pickShiftToSettle } from './shiftFocus'
import type { Shift } from '@/types'

// Factory shift minimal yang valid (strict mode) — override field yang relevan saja.
function makeShift(over: Partial<Shift> = {}): Shift {
  return {
    id: 1,
    date: '2026-05-28',
    cashierId: 2,
    openingCash: 25000,
    closedAt: null,
    createdAt: '2026-05-28T01:00:00.000Z',
    ...over,
  }
}

describe('pickShiftToSettle', () => {
  it('mengembalikan shift open system-wide (untuk ditutup) jika ada', () => {
    const active = [makeShift({ id: 10, isOverdue: true })]
    const recent = [makeShift({ id: 99, closedAt: '2026-05-27T15:00:00.000Z' })]
    expect(pickShiftToSettle(active, recent)?.id).toBe(10)
  })

  it('mengembalikan shift open walau tidak overdue (happy path tutup shift)', () => {
    const active = [makeShift({ id: 11, isOverdue: false })]
    expect(pickShiftToSettle(active, [])?.id).toBe(11)
  })

  it('jatuh ke shift terakhir (recent) saat tidak ada shift open — kasus settle hari yang sudah closed', () => {
    const recent = [makeShift({ id: 20, closedAt: '2026-05-27T15:00:00.000Z' })]
    expect(pickShiftToSettle([], recent)?.id).toBe(20)
  })

  it('memprioritaskan shift open di atas recent meski recent ada', () => {
    const active = [makeShift({ id: 30 })]
    const recent = [makeShift({ id: 31, closedAt: '2026-05-27T15:00:00.000Z' })]
    expect(pickShiftToSettle(active, recent)?.id).toBe(30)
  })

  it('mengembalikan null saat tidak ada shift sama sekali', () => {
    expect(pickShiftToSettle([], [])).toBeNull()
  })
})
