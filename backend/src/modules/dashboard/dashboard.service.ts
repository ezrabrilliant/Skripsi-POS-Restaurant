// Service modul dashboard. REV 2.3 - 3 endpoint untuk 3 role.
//
// Konsep:
//   - Owner: laporan finansial penuh periode (today/month/year/custom). Pendapatan
//     total dari transactions paid, pengeluaran = sum(purchases) + sum(bills),
//     laba kotor = pendapatan − pengeluaran. Plus bank breakdown EDC/transfer
//     dan reminder counts dari semua sumber.
//   - Cashier: ringkasan today (per matrix "kasir laporan hari ini saja, untuk
//     verifikasi shift"). Tampilkan active shift (kalau ada), today's revenue,
//     open transactions, reminders.
//   - Waiter: dashboard primary stok porsi + raw materials reminders, plus active
//     shifts hari ini (supaya tahu shift mana yang attach kalau fallback input order).

// REV 2.6: PaymentMethod enum di-rename jadi PaymentMethodLegacy di Prisma schema.
// Re-alias di sini untuk minimize code change di module ini sampai Phase 7 refactor.
import {
  PaymentMethodLegacy as PaymentMethod,
  Prisma,
  ShiftType,
  TransactionStatus,
} from '@prisma/client';
import { prisma } from '../../config/prisma';
import type { OwnerReportQuery } from './dashboard.schema';

// ============================================================
// View shape
// ============================================================

// REV 2.6: tambah index signature [key: string] supaya compatible dengan
// TransactionPayment.method yang sekarang String (bukan enum). Sampai Phase 7
// refactor jadi MethodTotalEntry[] dinamis.
export interface MethodTotals {
  cash: number;
  edc: number;
  qris: number;
  gojek: number;
  grab: number;
  transfer: number;
  [key: string]: number;
}

export interface BankBreakdownEntry {
  method: 'edc' | 'transfer';
  bank: string;
  total: number;
}

export interface ReminderCounts {
  portionLowCount: number;
  rawMaterialLowCount: number;
  rawMaterialNearExpiryCount: number;
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
    byMethod: MethodTotals;
    bankBreakdown: BankBreakdownEntry[];
  };
  expense: {
    purchaseTotal: number;
    billTotal: number;
    total: number;
  };
  profit: number; // revenue.total - expense.total
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
    byMethod: MethodTotals;
    openTransactionCount: number;
  };
  reminders: ReminderCounts;
}

export interface WaiterDashboardView {
  portionStocks: {
    totalCount: number;
    lowCount: number;
    lowSamples: { menuId: number; menuName: string; currentQty: number; minStock: number; suggestedRestock: number }[];
  };
  rawMaterials: {
    lowCount: number;
    nearExpiryCount: number;
    lowSamples: { id: number; name: string; stockQty: number; minStock: number | null; unit: string }[];
  };
  activeShiftsToday: {
    id: number;
    type: ShiftType;
    cashierId: number;
    cashierName: string;
  }[];
}

// ============================================================
// Date helpers (sama strategi dengan shifts/transactions: UTC midnight dari local)
// ============================================================

function todayDateOnly(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function tomorrowDateOnly(): Date {
  const d = todayDateOnly();
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function parseDateUtcMidnight(yyyymmdd: string): Date {
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

function isoDate(d: Date): string {
  return d.toISOString().substring(0, 10);
}

function todayMonthString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

interface PeriodRange {
  fromDate: Date;
  toDateExclusive: Date; // half-open [from, to)
  monthFilter?: string; // YYYY-MM untuk filter bills
  label: string;
  type: 'today' | 'month' | 'year' | 'custom';
}

function resolvePeriod(query: OwnerReportQuery): PeriodRange {
  if (query.period === 'today') {
    const anchor = query.date ? parseDateUtcMidnight(query.date) : todayDateOnly();
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
    const monthStr = query.month ?? todayMonthString();
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
    const yearStr = query.year ?? String(new Date().getFullYear());
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
// Aggregation helpers
// ============================================================

function emptyMethodTotals(): MethodTotals {
  return { cash: 0, edc: 0, qris: 0, gojek: 0, grab: 0, transfer: 0 };
}

async function revenueByMethod(
  where: Prisma.TransactionWhereInput,
): Promise<{ total: number; count: number; byMethod: MethodTotals }> {
  // REV 2.5: total + count dari Tx aggregate; byMethod via TransactionPayment groupBy.
  // Filter mergedIntoId IS NULL untuk hindari double-count merged sources.
  const txWhere = { ...where, mergedIntoId: null };

  const [txAgg, grouped] = await Promise.all([
    prisma.transaction.aggregate({
      where: txWhere,
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.transactionPayment.groupBy({
      by: ['method'],
      where: { transaction: txWhere },
      _sum: { amount: true },
    }),
  ]);

  const byMethod = emptyMethodTotals();
  for (const g of grouped) {
    const amount = g._sum.amount?.toNumber() ?? 0;
    byMethod[g.method] = amount;
  }
  const total = txAgg._sum.total?.toNumber() ?? 0;
  const count = txAgg._count._all;
  return { total, count, byMethod };
}

async function bankBreakdown(
  where: Prisma.TransactionWhereInput,
): Promise<BankBreakdownEntry[]> {
  // REV 2.5: bank breakdown via TransactionPayment.bank groupBy.
  const rows = await prisma.transactionPayment.groupBy({
    by: ['method', 'bank'],
    where: {
      transaction: { ...where, mergedIntoId: null },
      method: { in: [PaymentMethod.edc, PaymentMethod.transfer] },
      bank: { not: null },
    },
    _sum: { amount: true },
  });
  return rows
    .filter((r) => r.bank)
    .map((r) => ({
      method: r.method as 'edc' | 'transfer',
      bank: r.bank!,
      total: r._sum.amount?.toNumber() ?? 0,
    }))
    .sort((a, b) => a.method.localeCompare(b.method) || a.bank.localeCompare(b.bank));
}

async function reminderCounts(): Promise<ReminderCounts> {
  // Portion low: currentQty <= minStock (PortionStock)
  const portionRaw = await prisma.$queryRaw<{ cnt: bigint }[]>`
    SELECT COUNT(*) as cnt FROM portion_stocks WHERE current_qty <= min_stock
  `;
  const portionLowCount = Number(portionRaw[0]?.cnt ?? 0);

  // Raw material low: stockQty <= minStock (REV 2.5.1: semua master always tracked)
  const rmLowRaw = await prisma.$queryRaw<{ cnt: bigint }[]>`
    SELECT COUNT(*) as cnt FROM raw_materials
    WHERE min_stock IS NOT NULL AND stock_qty <= min_stock
  `;
  const rawMaterialLowCount = Number(rmLowRaw[0]?.cnt ?? 0);

  // Raw material near expiry: freshness_days set AND last_buy_date set
  //   AND DATEDIFF(NOW, last_buy_date) >= freshness_days - 3
  const rmNearRaw = await prisma.$queryRaw<{ cnt: bigint }[]>`
    SELECT COUNT(*) as cnt FROM raw_materials
    WHERE freshness_days IS NOT NULL
      AND last_buy_date IS NOT NULL
      AND DATEDIFF(CURDATE(), last_buy_date) >= freshness_days - 3
  `;
  const rawMaterialNearExpiryCount = Number(rmNearRaw[0]?.cnt ?? 0);

  return { portionLowCount, rawMaterialLowCount, rawMaterialNearExpiryCount };
}

// ============================================================
// Owner report
// ============================================================

export async function getOwnerReport(query: OwnerReportQuery): Promise<OwnerReportView> {
  const period = resolvePeriod(query);

  const txWhere: Prisma.TransactionWhereInput = {
    status: TransactionStatus.paid,
    paidAt: { gte: period.fromDate, lt: period.toDateExclusive },
  };

  const [{ total: revenue, count: txCount, byMethod }, banks, purchasesAgg, billsAgg, reminders] =
    await Promise.all([
      revenueByMethod(txWhere),
      bankBreakdown(txWhere),
      prisma.purchase.aggregate({
        where: { date: { gte: period.fromDate, lt: period.toDateExclusive } },
        _sum: { totalAmount: true },
      }),
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
              where: { month: todayMonthString() },
              _sum: { amount: true },
            }),
      reminderCounts(),
    ]);

  const purchaseTotal = purchasesAgg._sum.totalAmount?.toNumber() ?? 0;
  const billTotal = billsAgg._sum.amount?.toNumber() ?? 0;
  const expenseTotal = purchaseTotal + billTotal;
  const profit = revenue - expenseTotal;

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
      purchaseTotal,
      billTotal,
      total: expenseTotal,
    },
    profit,
    reminders,
  };
}

// ============================================================
// Cashier dashboard
// ============================================================

export async function getCashierDashboard(cashierId: number): Promise<CashierDashboardView> {
  const today = todayDateOnly();
  const tomorrow = tomorrowDateOnly();

  const [activeShiftRow, todayPaid, openTxCount, reminders] = await Promise.all([
    prisma.shift.findFirst({
      where: { cashierId, closedAt: null },
      orderBy: { createdAt: 'desc' },
    }),
    revenueByMethod({
      status: TransactionStatus.paid,
      paidAt: { gte: today, lt: tomorrow },
    }),
    prisma.transaction.count({
      where: {
        status: TransactionStatus.open,
        createdAt: { gte: today, lt: tomorrow },
      },
    }),
    reminderCounts(),
  ]);

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
    },
    reminders,
  };
}

// ============================================================
// Waiter dashboard
// ============================================================

export async function getWaiterDashboard(): Promise<WaiterDashboardView> {
  const today = todayDateOnly();
  const tomorrow = tomorrowDateOnly();

  const [portionTotal, portionLowRows, rmReminders, activeShifts] = await Promise.all([
    prisma.portionStock.count({ where: { menu: { isActive: true } } }),
    prisma.portionStock.findMany({
      where: { menu: { isActive: true } },
      include: { menu: { select: { name: true } } },
      orderBy: { currentQty: 'asc' },
    }),
    prisma.rawMaterial.findMany({
      include: { unit: { select: { label: true } } },
    }),
    prisma.shift.findMany({
      where: {
        closedAt: null,
        createdAt: { gte: today, lt: tomorrow },
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

  let rmLowCount = 0;
  let rmNearExpiryCount = 0;
  const rmLowSamples: WaiterDashboardView['rawMaterials']['lowSamples'] = [];
  const now = new Date();
  for (const rm of rmReminders) {
    const stockQty = rm.stockQty.toNumber();
    const isLow = rm.minStock !== null && stockQty <= rm.minStock;
    let isNear = false;
    if (rm.freshnessDays !== null && rm.lastBuyDate !== null) {
      const daysSince = Math.floor((now.getTime() - rm.lastBuyDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysUntil = rm.freshnessDays - daysSince;
      if (daysUntil <= 3) isNear = true;
    }
    if (isLow) rmLowCount++;
    if (isNear) rmNearExpiryCount++;
    if ((isLow || isNear) && rmLowSamples.length < 5) {
      rmLowSamples.push({
        id: rm.id,
        name: rm.name,
        stockQty,
        minStock: rm.minStock,
        unit: rm.unit.label,
      });
    }
  }

  return {
    portionStocks: {
      totalCount: portionTotal,
      lowCount: portionLow.length,
      lowSamples: portionLowSamples,
    },
    rawMaterials: {
      lowCount: rmLowCount,
      nearExpiryCount: rmNearExpiryCount,
      lowSamples: rmLowSamples,
    },
    activeShiftsToday: activeShifts.map((s) => ({
      id: s.id,
      type: s.type,
      cashierId: s.cashierId,
      cashierName: s.cashier.name,
    })),
  };
}
