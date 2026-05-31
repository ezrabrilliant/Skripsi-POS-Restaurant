// Service modul dashboard. REV 2.3 - 3 endpoint untuk 3 role.
//
// Konsep:
//   - Owner: laporan finansial penuh periode (today/month/year/custom). Pendapatan
//     total dari transactions paid, COGS = Σ(TransactionItem.unitCost × qty) atas
//     item paid (REV 2.11), laba kotor = pendapatan − COGS. Tagihan (bills) dilaporkan
//     TERPISAH (tidak dikurangkan ke laba). Plus bank breakdown EDC/transfer
//     (dan method requiresBank lain) + reminder counts stok porsi.
//   - Cashier: ringkasan today (per matrix "kasir laporan hari ini saja, untuk
//     verifikasi shift"). Tampilkan active shift (kalau ada), today's revenue,
//     open transactions, reminders.
//   - Waiter: dashboard primary stok porsi + raw materials reminders, plus active
//     shifts hari ini (supaya tahu shift mana yang attach kalau fallback input order).
//
// REV 2.6: byMethod dinamis (MethodTotalEntry[]) - bukan object 6 fixed key.
// Mendukung method custom (mis. ShopeePay) muncul otomatis di chart owner.
// BankBreakdownEntry.method jadi generic string (drop hardcoded 'edc' | 'transfer').

import { OrderType, Prisma, ShiftType, TransactionStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import type { OwnerReportQuery } from './dashboard.schema';
import { getShiftWindow } from '../settings/settings.service';
import { businessDateFor, restoNow } from '../shifts/shift-time';
import {
  bucketGranularityFor,
  bucketRevenueRows,
  groupMenuPerformance,
  hourOfDayDistribution,
  settlementVariance,
  type CategoryPerfRow,
  type Granularity,
  type MenuPerfInputRow,
  type MenuPerfRow,
  type TrendBucket,
  type TrendRow,
} from './dashboard.helpers';

// ============================================================
// View shape (REV 2.6: dinamis array)
// ============================================================

export interface MethodTotalEntry {
  paymentMethodCode: string;
  methodLabel: string;
  colorHex: string;
  total: number;
}

export interface BankBreakdownEntry {
  method: string; // REV 2.6: any method code yang requiresBank (mis. edc, transfer, future custom)
  bank: string;
  total: number;
}

export interface ReminderCounts {
  portionLowCount: number;
}

export interface OwnerReportView {
  period: {
    type: 'today' | 'month' | 'year' | 'custom';
    label: string; // human-readable (e.g. "Hari ini (2026-05-24)" / "Mei 2026")
    fromDate: string; // YYYY-MM-DD
    toDate: string; // YYYY-MM-DD
  };
  revenue: {
    total: number;
    transactionCount: number;
    byMethod: MethodTotalEntry[];
    bankBreakdown: BankBreakdownEntry[];
  };
  expense: {
    cogsTotal: number;
    // REV 2.12: PB1 ditanggung resto (Σ taxBorneAmount). Dikurangkan ke laba.
    pb1BorneTotal: number;
    billTotal: number;
    total: number; // cogsTotal + pb1BorneTotal (bills TERPISAH, tidak termasuk)
  };
  profit: number; // revenue.total − cogsTotal − pb1BorneTotal
  reminders: ReminderCounts;
}

export interface CashierDashboardView {
  activeShift: {
    id: number;
    type: ShiftType;
    openingCash: number;
    createdAt: string;
  } | null;
  today: {
    revenue: number;
    transactionCount: number;
    byMethod: MethodTotalEntry[];
    openTransactionCount: number;
    // REV 2.13: kartu ringan kasir. topMenus TANPA cost/laba (data modal owner-only).
    topMenus: { menuId: number; name: string; qty: number; revenue: number }[];
    itemCount: number; // Σ qty item terjual hari ini
    atv: number; // average transaction value = revenue / transactionCount
    orderTypeSplit: {
      dineIn: { count: number; revenue: number };
      takeaway: { count: number; revenue: number };
    };
  };
  reminders: ReminderCounts;
}

export interface WaiterDashboardView {
  portionStocks: {
    totalCount: number;
    lowCount: number;
    lowSamples: { menuId: number; menuName: string; currentQty: number; minStock: number; suggestedRestock: number }[];
  };
  activeShiftsToday: {
    id: number;
    type: ShiftType;
    cashierId: number;
    cashierName: string;
  }[];
}

// ============================================================
// Date helpers
// ============================================================

function parseDateUtcMidnight(yyyymmdd: string): Date {
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

function isoDate(d: Date): string {
  return d.toISOString().substring(0, 10);
}

interface PeriodRange {
  fromDate: Date;
  toDateExclusive: Date; // half-open [from, to)
  monthFilter?: string; // YYYY-MM untuk filter bills
  label: string;
  type: 'today' | 'month' | 'year' | 'custom';
}

function resolvePeriod(query: OwnerReportQuery, restoToday: Date, restoMonth: string): PeriodRange {
  if (query.period === 'today') {
    const anchor = query.date ? parseDateUtcMidnight(query.date) : restoToday;
    const next = new Date(anchor);
    next.setUTCDate(next.getUTCDate() + 1);
    return {
      fromDate: anchor,
      toDateExclusive: next,
      label: `Hari ini (${isoDate(anchor)})`,
      type: 'today',
    };
  }
  if (query.period === 'month') {
    const monthStr = query.month ?? restoMonth;
    const [y, m] = monthStr.split('-').map(Number);
    const from = new Date(Date.UTC(y!, m! - 1, 1));
    const to = new Date(Date.UTC(y!, m!, 1));
    return {
      fromDate: from,
      toDateExclusive: to,
      monthFilter: monthStr,
      label: `Bulan ${monthStr}`,
      type: 'month',
    };
  }
  if (query.period === 'year') {
    const yearStr = query.year ?? String(restoToday.getUTCFullYear());
    const y = Number(yearStr);
    return {
      fromDate: new Date(Date.UTC(y, 0, 1)),
      toDateExclusive: new Date(Date.UTC(y + 1, 0, 1)),
      label: `Tahun ${yearStr}`,
      type: 'year',
    };
  }
  // custom
  const from = parseDateUtcMidnight(query.fromDate!);
  const to = parseDateUtcMidnight(query.toDate!);
  const toEx = new Date(to);
  toEx.setUTCDate(toEx.getUTCDate() + 1); // inclusive to → exclusive
  return {
    fromDate: from,
    toDateExclusive: toEx,
    label: `${query.fromDate} → ${query.toDate}`,
    type: 'custom',
  };
}

// ============================================================
// Aggregation helpers (REV 2.6: dinamis)
// ============================================================

// REV 2.6: byMethod dinamis sesuai active methods (atau methods yang punya data di period).
// groupBy method dari TransactionPayment, lalu enrich dengan label + colorHex dari master.
async function computeByMethod(
  where: Prisma.TransactionPaymentWhereInput,
): Promise<MethodTotalEntry[]> {
  const rows = await prisma.transactionPayment.groupBy({
    by: ['method'],
    where,
    _sum: { amount: true },
  });
  const methodCodes = rows.map((r) => r.method);
  const methods = methodCodes.length
    ? await prisma.paymentMethod.findMany({ where: { code: { in: methodCodes } } })
    : [];
  const methodMap = new Map(methods.map((m) => [m.code, m]));

  return rows
    .map((r) => {
      const meta = methodMap.get(r.method);
      return {
        paymentMethodCode: r.method,
        methodLabel: meta?.label ?? r.method,
        colorHex: meta?.colorHex ?? '#888888',
        total: r._sum.amount?.toNumber() ?? 0,
      };
    })
    .sort((a, b) => b.total - a.total); // descending by total
}

async function revenueByMethod(
  where: Prisma.TransactionWhereInput,
): Promise<{ total: number; count: number; byMethod: MethodTotalEntry[] }> {
  // REV 2.5: total + count dari Tx aggregate; byMethod via TransactionPayment groupBy.
  // Filter mergedIntoId IS NULL untuk hindari double-count merged sources.
  const txWhere = { ...where, mergedIntoId: null };

  const [txAgg, byMethod] = await Promise.all([
    prisma.transaction.aggregate({
      where: txWhere,
      _sum: { total: true },
      _count: { _all: true },
    }),
    computeByMethod({ transaction: txWhere }),
  ]);

  const total = txAgg._sum.total?.toNumber() ?? 0;
  const count = txAgg._count._all;
  return { total, count, byMethod };
}

async function cogsTotalFor(txWhere: Prisma.TransactionWhereInput): Promise<number> {
  const rows = await prisma.transactionItem.findMany({
    where: { transaction: { ...txWhere, mergedIntoId: null } },
    select: { unitCost: true, qty: true },
  });
  return rows.reduce((s, r) => s + (r.unitCost ? r.unitCost.toNumber() : 0) * r.qty, 0);
}

/** REV 2.12: Σ PB1 yang DITANGGUNG resto (taxBorneAmount) atas transaksi paid pada
 *  periode (mergedIntoId=null supaya tidak double-count source merge bill). */
async function pb1BorneTotalFor(txWhere: Prisma.TransactionWhereInput): Promise<number> {
  const agg = await prisma.transaction.aggregate({
    where: { ...txWhere, mergedIntoId: null },
    _sum: { taxBorneAmount: true },
  });
  return agg._sum.taxBorneAmount?.toNumber() ?? 0;
}

async function bankBreakdown(
  where: Prisma.TransactionWhereInput,
): Promise<BankBreakdownEntry[]> {
  // REV 2.6: bank breakdown via TransactionPayment.bank groupBy. Drop hardcoded
  // method filter ('edc' | 'transfer'); pakai filter bank IS NOT NULL - sama
  // dengan pattern settlements module Phase 6 (method requiresBank=true di master
  // akan punya bank value pada payment row).
  const rows = await prisma.transactionPayment.groupBy({
    by: ['method', 'bank'],
    where: {
      transaction: { ...where, mergedIntoId: null },
      bank: { not: null },
    },
    _sum: { amount: true },
  });
  return rows
    .filter((r) => r.bank)
    .map((r) => ({
      method: r.method,
      bank: r.bank!,
      total: r._sum.amount?.toNumber() ?? 0,
    }))
    .sort((a, b) => a.method.localeCompare(b.method) || a.bank.localeCompare(b.bank));
}

async function reminderCounts(): Promise<ReminderCounts> {
  // Portion low: currentQty <= minStock (PortionStock)
  // REV 2.11: reminder raw-materials dihapus (raw_materials out of scope).
  const portionRaw = await prisma.$queryRaw<{ cnt: bigint }[]>`
    SELECT COUNT(*) as cnt FROM portion_stocks WHERE current_qty <= min_stock
  `;
  const portionLowCount = Number(portionRaw[0]?.cnt ?? 0);

  return { portionLowCount };
}

// ============================================================
// Owner report
// ============================================================

export async function getOwnerReport(query: OwnerReportQuery): Promise<OwnerReportView> {
  const window = await getShiftWindow();
  const restoToday = businessDateFor(window, new Date());
  const restoMonth = `${restoToday.getUTCFullYear()}-${String(restoToday.getUTCMonth() + 1).padStart(2, '0')}`;
  const period = resolvePeriod(query, restoToday, restoMonth);

  // Revenue attributed by shift.date (business day), not paidAt wall-clock.
  const txWhere: Prisma.TransactionWhereInput = {
    status: TransactionStatus.paid,
    shift: { date: { gte: period.fromDate, lt: period.toDateExclusive } },
  };

  const [{ total: revenue, count: txCount, byMethod }, banks, cogsTotal, pb1BorneTotal, billsAgg, reminders] =
    await Promise.all([
      revenueByMethod(txWhere),
      bankBreakdown(txWhere),
      cogsTotalFor(txWhere),
      pb1BorneTotalFor(txWhere),
      period.type === 'month'
        ? prisma.bill.aggregate({
            where: { month: period.monthFilter },
            _sum: { amount: true },
          })
        : period.type === 'year'
          ? prisma.bill.aggregate({
              where: { month: { startsWith: String(period.fromDate.getUTCFullYear()) + '-' } },
              _sum: { amount: true },
            })
          : prisma.bill.aggregate({
              // 'today' & 'custom' - pakai bills bulan saat ini sebagai approx
              // (bills bersifat bulanan, jadi untuk laporan harian tampilkan bills bulan saat ini)
              where: { month: restoMonth },
              _sum: { amount: true },
            }),
      reminderCounts(),
    ]);

  const billTotal = billsAgg._sum.amount?.toNumber() ?? 0;
  // REV 2.12: laba kotor = pendapatan − COGS − PB1 ditanggung resto. Tagihan (bills)
  // tetap TERPISAH (tidak dikurangkan), konsisten REV 2.11.
  const profit = revenue - cogsTotal - pb1BorneTotal;

  return {
    period: {
      type: period.type,
      label: period.label,
      fromDate: isoDate(period.fromDate),
      toDate: isoDate(new Date(period.toDateExclusive.getTime() - 24 * 60 * 60 * 1000)),
    },
    revenue: {
      total: revenue,
      transactionCount: txCount,
      byMethod,
      bankBreakdown: banks,
    },
    expense: {
      cogsTotal,
      pb1BorneTotal,
      billTotal,
      total: cogsTotal + pb1BorneTotal,
    },
    profit,
    reminders,
  };
}

// ============================================================
// Owner analytics REV 2.13 (tab Menu / Tren / Kasir)
// ============================================================
//
// Semua endpoint owner-only, reuse resolvePeriod() + txWhere yang sama dengan
// getOwnerReport (status=paid + shift.date in [from,to) + exclude mergedIntoId).

export interface MenuPerformanceView {
  topMenus: MenuPerfRow[];
  byCategory: CategoryPerfRow[];
}

export interface TrendView {
  granularity: Granularity; // FE: sembunyikan Jam Ramai saat 'hour' (redundan dgn tren jam)
  revenueTrend: TrendBucket[];
  peakHours: { hour: number; revenue: number; txCount: number }[];
}

export interface CashierPerfRow {
  cashierId: number;
  cashierName: string;
  shiftCount: number;
  txCount: number;
  revenue: number;
  atv: number; // average transaction value
}

export interface SettlementHistoryRow {
  date: string; // YYYY-MM-DD
  cashierName: string;
  totalCounted: number;
  totalSystem: number;
  variance: number; // counted − system (+ lebih / − kurang)
  status: string; // SettlementStatus
}

export interface StaffView {
  cashierPerformance: CashierPerfRow[];
  settlementHistory: SettlementHistoryRow[];
}

/** Resolusi periode + txWhere bersama untuk endpoint analitik owner. */
async function resolveOwnerPeriod(query: OwnerReportQuery): Promise<{
  window: Awaited<ReturnType<typeof getShiftWindow>>;
  period: PeriodRange;
  txWhere: Prisma.TransactionWhereInput;
}> {
  const window = await getShiftWindow();
  const restoToday = businessDateFor(window, new Date());
  const restoMonth = `${restoToday.getUTCFullYear()}-${String(restoToday.getUTCMonth() + 1).padStart(2, '0')}`;
  const period = resolvePeriod(query, restoToday, restoMonth);
  const txWhere: Prisma.TransactionWhereInput = {
    status: TransactionStatus.paid,
    mergedIntoId: null,
    shift: { date: { gte: period.fromDate, lt: period.toDateExclusive } },
  };
  return { window, period, txWhere };
}

/** Performa menu: menu terlaris + roll-up per kategori (omzet/laba/margin). Owner-only. */
export async function getOwnerMenuPerformance(query: OwnerReportQuery): Promise<MenuPerformanceView> {
  const { txWhere } = await resolveOwnerPeriod(query);
  const items = await prisma.transactionItem.findMany({
    where: { transaction: txWhere },
    select: {
      menuId: true,
      qty: true,
      subtotal: true,
      unitCost: true,
      menu: { select: { name: true, category: true } },
    },
  });
  const rows: MenuPerfInputRow[] = items.map((it) => ({
    menuId: it.menuId,
    name: it.menu.name,
    category: it.menu.category,
    qty: it.qty,
    subtotal: it.subtotal.toNumber(),
    unitCost: it.unitCost ? it.unitCost.toNumber() : null,
  }));
  const { topMenus, byCategory } = groupMenuPerformance(rows);
  return { topMenus: topMenus.slice(0, 15), byCategory };
}

/** Tren omzet + jam ramai. Owner-only. */
export async function getOwnerTrend(query: OwnerReportQuery): Promise<TrendView> {
  const { window, period, txWhere } = await resolveOwnerPeriod(query);
  const granularity = bucketGranularityFor(period.fromDate, period.toDateExclusive);
  const toLocalHour = (d: Date) => Math.floor(restoNow(window.timezone, d).minutesOfDay / 60);

  const txs = await prisma.transaction.findMany({
    where: txWhere,
    select: { total: true, createdAt: true, shift: { select: { date: true } } },
  });
  const rows: TrendRow[] = txs.map((t) => ({
    total: t.total.toNumber(),
    shiftDate: t.shift.date,
    createdAt: t.createdAt,
  }));

  return {
    granularity,
    revenueTrend: bucketRevenueRows(rows, granularity, toLocalHour),
    peakHours: hourOfDayDistribution(
      rows.map((r) => ({ total: r.total, createdAt: r.createdAt })),
      toLocalHour,
    ),
  };
}

/** Performa kasir (atribusi = pemilik shift) + riwayat setoran & selisih. Owner-only. */
export async function getOwnerStaff(query: OwnerReportQuery): Promise<StaffView> {
  const { period, txWhere } = await resolveOwnerPeriod(query);
  const [txs, settlements] = await Promise.all([
    prisma.transaction.findMany({
      where: txWhere,
      select: {
        total: true,
        shiftId: true,
        shift: { select: { cashierId: true, cashier: { select: { name: true } } } },
      },
    }),
    prisma.settlement.findMany({
      where: { date: { gte: period.fromDate, lt: period.toDateExclusive } },
      include: { cashier: { select: { name: true } }, methodCounts: true },
      orderBy: { date: 'desc' },
    }),
  ]);

  // Group omzet per kasir pemilik shift (bukan createdById).
  const acc = new Map<number, { cashierId: number; cashierName: string; shiftIds: Set<number>; txCount: number; revenue: number }>();
  for (const t of txs) {
    const cid = t.shift.cashierId;
    let e = acc.get(cid);
    if (!e) {
      e = { cashierId: cid, cashierName: t.shift.cashier.name, shiftIds: new Set(), txCount: 0, revenue: 0 };
      acc.set(cid, e);
    }
    e.shiftIds.add(t.shiftId);
    e.txCount += 1;
    e.revenue += t.total.toNumber();
  }
  const cashierPerformance: CashierPerfRow[] = [...acc.values()]
    .map((e) => ({
      cashierId: e.cashierId,
      cashierName: e.cashierName,
      shiftCount: e.shiftIds.size,
      txCount: e.txCount,
      revenue: e.revenue,
      atv: e.txCount > 0 ? e.revenue / e.txCount : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const settlementHistory: SettlementHistoryRow[] = settlements.map((s) => {
    const counts = s.methodCounts.map((m) => ({ counted: m.counted, system: m.system }));
    return {
      date: isoDate(s.date),
      cashierName: s.cashier.name,
      totalCounted: counts.reduce((x, c) => x + c.counted, 0),
      totalSystem: counts.reduce((x, c) => x + c.system, 0),
      variance: settlementVariance(counts),
      status: s.status,
    };
  });

  return { cashierPerformance, settlementHistory };
}

// ============================================================
// Cashier dashboard
// ============================================================

export async function getCashierDashboard(cashierId: number): Promise<CashierDashboardView> {
  const window = await getShiftWindow();
  const today = businessDateFor(window, new Date());
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  // REV 2.13: filter paid hari ini reusable untuk item + orderType breakdown.
  const txWhereToday: Prisma.TransactionWhereInput = {
    status: TransactionStatus.paid,
    mergedIntoId: null,
    shift: { date: { gte: today, lt: tomorrow } },
  };

  const [activeShiftRow, todayPaid, openTxCount, reminders, itemRows, orderTypeAgg] = await Promise.all([
    prisma.shift.findFirst({
      where: { cashierId, closedAt: null },
      orderBy: { createdAt: 'desc' },
    }),
    // REV 2.13: pakai txWhereToday (sudah include mergedIntoId:null) supaya call site
    // konsisten dengan itemRows/orderTypeAgg, tidak bergantung guard internal revenueByMethod.
    revenueByMethod(txWhereToday),
    prisma.transaction.count({
      where: {
        status: TransactionStatus.open,
        mergedIntoId: null,
        shift: { date: { gte: today, lt: tomorrow } },
      },
    }),
    reminderCounts(),
    prisma.transactionItem.findMany({
      where: { transaction: txWhereToday },
      select: { menuId: true, qty: true, subtotal: true, menu: { select: { name: true } } },
    }),
    prisma.transaction.groupBy({
      by: ['orderType'],
      where: txWhereToday,
      _sum: { total: true },
      _count: { _all: true },
    }),
  ]);

  // Top 5 menu terlaris hari ini (by qty) + total item terjual. TANPA cost.
  const menuAcc = new Map<number, { menuId: number; name: string; qty: number; revenue: number }>();
  let itemCount = 0;
  for (const it of itemRows) {
    itemCount += it.qty;
    const e = menuAcc.get(it.menuId) ?? { menuId: it.menuId, name: it.menu.name, qty: 0, revenue: 0 };
    e.qty += it.qty;
    e.revenue += it.subtotal.toNumber();
    menuAcc.set(it.menuId, e);
  }
  const topMenus = [...menuAcc.values()]
    .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue)
    .slice(0, 5);

  const findOrderType = (t: OrderType) => {
    const row = orderTypeAgg.find((r) => r.orderType === t);
    return { count: row?._count._all ?? 0, revenue: row?._sum.total?.toNumber() ?? 0 };
  };

  return {
    activeShift: activeShiftRow
      ? {
          id: activeShiftRow.id,
          type: activeShiftRow.type,
          openingCash: activeShiftRow.openingCash.toNumber(),
          createdAt: activeShiftRow.createdAt.toISOString(),
        }
      : null,
    today: {
      revenue: todayPaid.total,
      transactionCount: todayPaid.count,
      byMethod: todayPaid.byMethod,
      openTransactionCount: openTxCount,
      topMenus,
      itemCount,
      atv: todayPaid.count > 0 ? todayPaid.total / todayPaid.count : 0,
      orderTypeSplit: {
        dineIn: findOrderType(OrderType.dineIn),
        takeaway: findOrderType(OrderType.takeaway),
      },
    },
    reminders,
  };
}

// ============================================================
// Waiter dashboard
// ============================================================

export async function getWaiterDashboard(): Promise<WaiterDashboardView> {
  const window = await getShiftWindow();
  const today = businessDateFor(window, new Date());
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  // REV 2.11: query + loop reminder raw-materials dihapus (raw_materials out of scope).
  const [portionTotal, portionLowRows, activeShifts] = await Promise.all([
    prisma.portionStock.count({ where: { menu: { isActive: true } } }),
    prisma.portionStock.findMany({
      where: { menu: { isActive: true } },
      include: { menu: { select: { name: true } } },
      orderBy: { currentQty: 'asc' },
    }),
    prisma.shift.findMany({
      where: {
        closedAt: null,
        date: { gte: today, lt: tomorrow },
      },
      include: { cashier: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const portionLow = portionLowRows.filter((p) => p.currentQty <= p.minStock);
  const portionLowSamples = portionLow.slice(0, 5).map((p) => ({
    menuId: p.menuId,
    menuName: p.menu.name,
    currentQty: p.currentQty,
    minStock: p.minStock,
    suggestedRestock:
      p.currentQty >= p.minStock ? 0 : Math.ceil((p.minStock - p.currentQty) / 5) * 5,
  }));

  return {
    portionStocks: {
      totalCount: portionTotal,
      lowCount: portionLow.length,
      lowSamples: portionLowSamples,
    },
    activeShiftsToday: activeShifts.map((s) => ({
      id: s.id,
      type: s.type,
      cashierId: s.cashierId,
      cashierName: s.cashier.name,
    })),
  };
}
