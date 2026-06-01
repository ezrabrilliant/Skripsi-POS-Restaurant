import { describe, it, expect } from 'vitest'
import { computeMargin } from './utils'

describe('computeMargin', () => {
  it('menghitung laba & persen margin untuk menu simple', () => {
    expect(computeMargin(25000, 12000)).toEqual({ laba: 13000, pct: 52 })
  })

  it('membulatkan persen ke bilangan bulat terdekat', () => {
    // 3000 - 2500 = 500; 500/3000 = 16.67% → 17%
    expect(computeMargin(3000, 2500)).toEqual({ laba: 500, pct: 17 })
  })

  it('mengembalikan null saat modal 0 (dianggap belum diisi, bukan laba penuh)', () => {
    expect(computeMargin(25000, 0)).toBeNull()
  })

  it('mengembalikan null saat modal null (parent variant/paket)', () => {
    expect(computeMargin(25000, null)).toBeNull()
  })

  it('mengembalikan null saat modal undefined', () => {
    expect(computeMargin(25000, undefined)).toBeNull()
  })

  it('menghitung laba negatif saat modal > harga (rugi)', () => {
    expect(computeMargin(10000, 12000)).toEqual({ laba: -2000, pct: -20 })
  })

  it('mengembalikan null saat harga 0 (hindari bagi nol)', () => {
    expect(computeMargin(0, 5000)).toBeNull()
  })
})
