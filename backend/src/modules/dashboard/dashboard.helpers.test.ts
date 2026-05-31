import { describe, it, expect } from 'vitest';
import {
  bucketGranularityFor,
  settlementVariance,
  groupMenuPerformance,
  bucketRevenueRows,
  hourOfDayDistribution,
  type MenuPerfInputRow,
  type TrendRow,
} from './dashboard.helpers';

// Fake "to local hour" untuk uji bucketing tanpa Intl/timezone nyata.
// WIB = UTC+7 (offset tetap, Indonesia tanpa DST). Service nyata pakai restoNow().
const toWibHour = (d: Date): number => (d.getUTCHours() + 7) % 24;

const utc = (h: number, m = 0): Date => new Date(Date.UTC(2026, 4, 10, h, m));
const dateOnly = (y: number, mo: number, d: number): Date => new Date(Date.UTC(y, mo - 1, d));

describe('bucketGranularityFor', () => {
  it('rentang 1 hari (today) → hour', () => {
    expect(bucketGranularityFor(dateOnly(2026, 5, 10), dateOnly(2026, 5, 11))).toBe('hour');
  });
  it('rentang 2 hari → day', () => {
    expect(bucketGranularityFor(dateOnly(2026, 5, 10), dateOnly(2026, 5, 12))).toBe('day');
  });
  it('rentang 1 bulan (31 hari) → day', () => {
    expect(bucketGranularityFor(dateOnly(2026, 5, 1), dateOnly(2026, 6, 1))).toBe('day');
  });
  it('rentang 62 hari → day (batas)', () => {
    expect(bucketGranularityFor(dateOnly(2026, 1, 1), dateOnly(2026, 3, 4))).toBe('day'); // 62 hari
  });
  it('rentang 63 hari → month', () => {
    expect(bucketGranularityFor(dateOnly(2026, 1, 1), dateOnly(2026, 3, 5))).toBe('month'); // 63 hari
  });
  it('rentang 1 tahun → month', () => {
    expect(bucketGranularityFor(dateOnly(2026, 1, 1), dateOnly(2027, 1, 1))).toBe('month');
  });
});

describe('settlementVariance', () => {
  it('Σ(counted − system)', () => {
    expect(
      settlementVariance([
        { counted: 100, system: 90 },
        { counted: 50, system: 55 },
      ]),
    ).toBe(5);
  });
  it('kosong → 0', () => {
    expect(settlementVariance([])).toBe(0);
  });
  it('semua cocok → 0', () => {
    expect(settlementVariance([{ counted: 200, system: 200 }])).toBe(0);
  });
});

describe('groupMenuPerformance', () => {
  const rows: MenuPerfInputRow[] = [
    { menuId: 1, name: 'Ayam Bakar', category: 'Ayam', qty: 2, subtotal: 40000, unitCost: 12000 },
    { menuId: 1, name: 'Ayam Bakar', category: 'Ayam', qty: 1, subtotal: 20000, unitCost: 12000 },
    { menuId: 2, name: 'Es Teh', category: 'Minuman', qty: 5, subtotal: 25000, unitCost: null },
    { menuId: 3, name: 'Sambal Gratis', category: 'Side', qty: 1, subtotal: 0, unitCost: 0 },
  ];

  it('agregasi per menu: qty/revenue/cogs/profit/marginPct', () => {
    const { topMenus } = groupMenuPerformance(rows);
    const ayam = topMenus.find((m) => m.menuId === 1)!;
    expect(ayam.qtySold).toBe(3);
    expect(ayam.revenue).toBe(60000);
    expect(ayam.cogs).toBe(36000); // 12000 × 3
    expect(ayam.profit).toBe(24000);
    expect(ayam.marginPct).toBe(40); // 24000/60000
  });

  it('unitCost null diperlakukan 0', () => {
    const { topMenus } = groupMenuPerformance(rows);
    const teh = topMenus.find((m) => m.menuId === 2)!;
    expect(teh.cogs).toBe(0);
    expect(teh.profit).toBe(25000);
    expect(teh.marginPct).toBe(100);
  });

  it('revenue 0 → marginPct 0 (guard divide-by-zero)', () => {
    const { topMenus } = groupMenuPerformance(rows);
    const sambal = topMenus.find((m) => m.menuId === 3)!;
    expect(sambal.revenue).toBe(0);
    expect(sambal.marginPct).toBe(0);
  });

  it('topMenus terurut desc by revenue', () => {
    const { topMenus } = groupMenuPerformance(rows);
    expect(topMenus.map((m) => m.menuId)).toEqual([1, 2, 3]);
  });

  it('byCategory roll-up terurut desc by revenue', () => {
    const { byCategory } = groupMenuPerformance(rows);
    expect(byCategory.map((c) => c.category)).toEqual(['Ayam', 'Minuman', 'Side']);
    const ayam = byCategory.find((c) => c.category === 'Ayam')!;
    expect(ayam.qtySold).toBe(3);
    expect(ayam.revenue).toBe(60000);
    expect(ayam.cogs).toBe(36000);
    expect(ayam.profit).toBe(24000);
  });
});

describe('bucketRevenueRows', () => {
  it('granularity hour: bucket per jam lokal (createdAt)', () => {
    const rows: TrendRow[] = [
      { total: 10000, shiftDate: dateOnly(2026, 5, 10), createdAt: utc(2, 0) }, // 09 WIB
      { total: 5000, shiftDate: dateOnly(2026, 5, 10), createdAt: utc(2, 30) }, // 09 WIB
      { total: 20000, shiftDate: dateOnly(2026, 5, 10), createdAt: utc(5, 0) }, // 12 WIB
    ];
    expect(bucketRevenueRows(rows, 'hour', toWibHour)).toEqual([
      { bucket: '09', revenue: 15000, txCount: 2 },
      { bucket: '12', revenue: 20000, txCount: 1 },
    ]);
  });

  it('granularity day: bucket per shift.date', () => {
    const rows: TrendRow[] = [
      { total: 10000, shiftDate: dateOnly(2026, 5, 10), createdAt: utc(2) },
      { total: 5000, shiftDate: dateOnly(2026, 5, 10), createdAt: utc(3) },
      { total: 7000, shiftDate: dateOnly(2026, 5, 11), createdAt: utc(4) },
    ];
    expect(bucketRevenueRows(rows, 'day', toWibHour)).toEqual([
      { bucket: '2026-05-10', revenue: 15000, txCount: 2 },
      { bucket: '2026-05-11', revenue: 7000, txCount: 1 },
    ]);
  });

  it('granularity month: bucket per bulan shift.date', () => {
    const rows: TrendRow[] = [
      { total: 10000, shiftDate: dateOnly(2026, 4, 30), createdAt: utc(2) },
      { total: 5000, shiftDate: dateOnly(2026, 5, 1), createdAt: utc(3) },
    ];
    expect(bucketRevenueRows(rows, 'month', toWibHour)).toEqual([
      { bucket: '2026-04', revenue: 10000, txCount: 1 },
      { bucket: '2026-05', revenue: 5000, txCount: 1 },
    ]);
  });

  it('kosong → []', () => {
    expect(bucketRevenueRows([], 'day', toWibHour)).toEqual([]);
  });
});

describe('hourOfDayDistribution', () => {
  it('grup per jam lokal, terurut asc', () => {
    const rows = [
      { total: 10000, createdAt: utc(3, 0) }, // 10 WIB
      { total: 5000, createdAt: utc(3, 30) }, // 10 WIB
      { total: 20000, createdAt: utc(15, 0) }, // 22 WIB
    ];
    expect(hourOfDayDistribution(rows, toWibHour)).toEqual([
      { hour: 10, revenue: 15000, txCount: 2 },
      { hour: 22, revenue: 20000, txCount: 1 },
    ]);
  });

  it('offset wrap melewati tengah malam', () => {
    const rows = [{ total: 1000, createdAt: utc(20, 0) }]; // 20 + 7 = 27 → 03 WIB
    expect(hourOfDayDistribution(rows, toWibHour)).toEqual([{ hour: 3, revenue: 1000, txCount: 1 }]);
  });
});
