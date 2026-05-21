// Logika bisnis modul dashboard: ringkasan harian & bulanan untuk owner.
// Laba kotor = total pendapatan - total pengeluaran (bukan HPP, sesuai batasan skripsi).

import { prisma } from '../../config/prisma';
import { todayString, toDateOnly } from '../../utils/date';
import { dayRange, monthRange } from '../../utils/month';

const LOW_STOCK_THRESHOLD = 5;

/** Jumlahkan nilai number per kunci dari sederet baris. */
function groupSum<T extends string>(rows: { key: T; value: number }[]): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const r of rows) acc[r.key] = (acc[r.key] ?? 0) + r.value;
  return acc;
}

/** Ringkasan operasional satu hari. */
export async function getDailySummary(dateStr?: string) {
  const date = dateStr ?? todayString();
  const { start, end } = dayRange(date);
  const dateOnly = toDateOnly(date);

  const paid = await prisma.transaction.findMany({
    where: { status: 'paid', paidAt: { gte: start, lt: end } },
    select: { total: true, paymentMethod: true },
  });
  const revenue = paid.reduce((s, t) => s + Number(t.total), 0);
  const revenueByMethod = groupSum(
    paid.map((t) => ({ key: t.paymentMethod ?? 'unknown', value: Number(t.total) })),
  );

  const expenses = await prisma.expense.findMany({
    where: { date: dateOnly },
    select: { amount: true, category: true },
  });
  const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const expenseByCategory = groupSum(
    expenses.map((e) => ({ key: e.category, value: Number(e.amount) })),
  );

  const lowStockRows = await prisma.dailyMenuStock.findMany({
    where: { date: dateOnly, currentStock: { lte: LOW_STOCK_THRESHOLD } },
    include: { menu: { select: { name: true } } },
    orderBy: { currentStock: 'asc' },
  });
  const lowStock = lowStockRows.map((s) => ({
    menuId: s.menuId,
    menuName: s.menu.name,
    currentStock: s.currentStock,
  }));

  const settlements = await prisma.settlement.findMany({ where: { date: dateOnly } });
  const totalVariance = settlements.reduce(
    (s, st) =>
      s +
      (Number(st.varianceCash) +
        Number(st.varianceQris) +
        Number(st.varianceTransfer) +
        Number(st.varianceDebitCredit) +
        Number(st.varianceOjol)),
    0,
  );

  return {
    date,
    revenue,
    revenueByMethod,
    transactionCount: paid.length,
    expenseTotal,
    expenseByCategory,
    grossProfit: revenue - expenseTotal,
    lowStock,
    settlementCount: settlements.length,
    settlementVariance: totalVariance,
  };
}

/** Ringkasan keuangan satu bulan (YYYY-MM). */
export async function getMonthlySummary(month: string) {
  const { start, end } = monthRange(month);

  const paid = await prisma.transaction.findMany({
    where: { status: 'paid', paidAt: { gte: start, lt: end } },
    select: { total: true, paymentMethod: true },
  });
  const revenue = paid.reduce((s, t) => s + Number(t.total), 0);
  const revenueByMethod = groupSum(
    paid.map((t) => ({ key: t.paymentMethod ?? 'unknown', value: Number(t.total) })),
  );

  const expenses = await prisma.expense.findMany({
    where: { date: { gte: start, lt: end } },
    select: { amount: true, category: true },
  });
  const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const expenseByCategory = groupSum(
    expenses.map((e) => ({ key: e.category, value: Number(e.amount) })),
  );

  return {
    month,
    revenue,
    revenueByMethod,
    transactionCount: paid.length,
    expenseTotal,
    expenseByCategory,
    grossProfit: revenue - expenseTotal,
  };
}
