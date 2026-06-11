import { describe, it, expect } from 'vitest'
import { settlementExpected } from './settlementMath'

describe('settlementExpected', () => {
  it('cash = system + modal awal', () => {
    expect(settlementExpected('cash', 50000, 120000)).toBe(170000)
  })
  it('non-cash = system (modal diabaikan)', () => {
    expect(settlementExpected('qris', 80000, 120000)).toBe(80000)
  })
  it('cash tanpa modal = system', () => {
    expect(settlementExpected('cash', 50000, 0)).toBe(50000)
  })
})
