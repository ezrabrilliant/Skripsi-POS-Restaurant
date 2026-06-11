import { describe, it, expect } from 'vitest';
import { methodExpected, methodVariance } from './variance';

describe('settlement variance (REV cash reconciliation)', () => {
  it('cash: expected = system penjualan + modal awal', () => {
    expect(methodExpected('cash', 50000, 120000)).toBe(170000);
  });

  it('cash: variance = fisik − (system + modal)', () => {
    // fisik laci 170000, sales 50000, modal 120000 → cocok
    expect(methodVariance('cash', 170000, 50000, 120000)).toBe(0);
    // fisik kurang 10000
    expect(methodVariance('cash', 160000, 50000, 120000)).toBe(-10000);
  });

  it('non-cash: modal awal diabaikan (expected = system)', () => {
    expect(methodExpected('qris', 80000, 120000)).toBe(80000);
    expect(methodVariance('qris', 80000, 80000, 120000)).toBe(0);
    expect(methodVariance('edc', 75000, 80000, 120000)).toBe(-5000);
  });

  it('cash tanpa modal (openingCashTotal=0) = perilaku lama', () => {
    expect(methodVariance('cash', 50000, 50000, 0)).toBe(0);
  });
});
