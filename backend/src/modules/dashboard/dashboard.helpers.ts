// Helper murni (tanpa DB / tanpa Intl) untuk agregasi laporan dashboard REV 2.13.
// Dipisah dari service supaya bisa di-unit-test cepat (lihat dashboard.helpers.test.ts).
// TZ-awareness disuntik lewat fungsi `toLocalHour` (service nyata pakai restoNow()).

export type Granularity = 'hour' | 'day' | 'month';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Pilih granularity bucket tren dari panjang rentang [from, toExclusive).
 *  ≤ 1 hari → per jam · ≤ 62 hari → per hari · selebihnya → per bulan. */
export function bucketGranularityFor(fromDate: Date, toDateExclusive: Date): Granularity {
  const spanDays = Math.round((toDateExclusive.getTime() - fromDate.getTime()) / DAY_MS);
  if (spanDays <= 1) return 'hour';
  if (spanDays <= 62) return 'day';
  return 'month';
}

/** Σ(counted − system) dari semua method count satu settlement. + = lebih (over), − = kurang. */
export function settlementVariance(counts: { counted: number; system: number }[]): number {
  return counts.reduce((sum, c) => sum + (c.counted - c.system), 0);
}

// ---- Menu performance --------------------------------------------------------

export interface MenuPerfInputRow {
  menuId: number;
  name: string;
  category: string;
  qty: number;
  subtotal: number;
  unitCost: number | null;
}

export interface MenuPerfRow {
  menuId: number;
  name: string;
  category: string;
  qtySold: number;
  revenue: number;
  cogs: number;
  profit: number;
  marginPct: number;
}

export interface CategoryPerfRow {
  category: string;
  qtySold: number;
  revenue: number;
  cogs: number;
  profit: number;
}

function marginPct(revenue: number, profit: number): number {
  return revenue > 0 ? (profit / revenue) * 100 : 0;
}

/** Agregasi item transaksi paid → per menu (topMenus) + roll-up per kategori.
 *  revenue = Σ subtotal; cogs = Σ (unitCost ?? 0) × qty; profit = revenue − cogs.
 *  Keduanya terurut DESC by revenue (tie-break nama/kategori asc). */
export function groupMenuPerformance(rows: MenuPerfInputRow[]): {
  topMenus: MenuPerfRow[];
  byCategory: CategoryPerfRow[];
} {
  const byMenu = new Map<number, MenuPerfRow>();
  const byCat = new Map<string, CategoryPerfRow>();

  for (const r of rows) {
    const cogsLine = (r.unitCost ?? 0) * r.qty;

    let m = byMenu.get(r.menuId);
    if (!m) {
      m = { menuId: r.menuId, name: r.name, category: r.category, qtySold: 0, revenue: 0, cogs: 0, profit: 0, marginPct: 0 };
      byMenu.set(r.menuId, m);
    }
    m.qtySold += r.qty;
    m.revenue += r.subtotal;
    m.cogs += cogsLine;

    let c = byCat.get(r.category);
    if (!c) {
      c = { category: r.category, qtySold: 0, revenue: 0, cogs: 0, profit: 0 };
      byCat.set(r.category, c);
    }
    c.qtySold += r.qty;
    c.revenue += r.subtotal;
    c.cogs += cogsLine;
  }

  const topMenus = [...byMenu.values()]
    .map((m) => ({ ...m, profit: m.revenue - m.cogs, marginPct: marginPct(m.revenue, m.revenue - m.cogs) }))
    .sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name));

  const byCategory = [...byCat.values()]
    .map((c) => ({ ...c, profit: c.revenue - c.cogs }))
    .sort((a, b) => b.revenue - a.revenue || a.category.localeCompare(b.category));

  return { topMenus, byCategory };
}

// ---- Trend & peak hours ------------------------------------------------------

export interface TrendRow {
  total: number;
  shiftDate: Date; // business day (UTC-midnight) - dipakai utk bucket day/month
  createdAt: Date; // timestamp asli - dipakai utk bucket hour
}

export interface TrendBucket {
  bucket: string;
  revenue: number;
  txCount: number;
}

/** Bucket revenue per granularity. hour pakai jam lokal createdAt (via toLocalHour),
 *  day/month pakai shift.date (sudah business-day, tak perlu TZ). Terurut bucket asc. */
export function bucketRevenueRows(
  rows: TrendRow[],
  granularity: Granularity,
  toLocalHour: (d: Date) => number,
): TrendBucket[] {
  const map = new Map<string, TrendBucket>();
  for (const r of rows) {
    let key: string;
    if (granularity === 'hour') {
      key = String(toLocalHour(r.createdAt)).padStart(2, '0');
    } else if (granularity === 'month') {
      key = r.shiftDate.toISOString().slice(0, 7);
    } else {
      key = r.shiftDate.toISOString().slice(0, 10);
    }
    const b = map.get(key) ?? { bucket: key, revenue: 0, txCount: 0 };
    b.revenue += r.total;
    b.txCount += 1;
    map.set(key, b);
  }
  return [...map.values()].sort((a, b) => a.bucket.localeCompare(b.bucket));
}

/** Distribusi omzet & jumlah tx per jam-of-day lokal (0..23). Hanya jam yang ada data,
 *  terurut asc. */
export function hourOfDayDistribution(
  rows: { total: number; createdAt: Date }[],
  toLocalHour: (d: Date) => number,
): { hour: number; revenue: number; txCount: number }[] {
  const map = new Map<number, { hour: number; revenue: number; txCount: number }>();
  for (const r of rows) {
    const hour = toLocalHour(r.createdAt);
    const e = map.get(hour) ?? { hour, revenue: 0, txCount: 0 };
    e.revenue += r.total;
    e.txCount += 1;
    map.set(hour, e);
  }
  return [...map.values()].sort((a, b) => a.hour - b.hour);
}
