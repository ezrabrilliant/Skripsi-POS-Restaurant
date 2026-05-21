// Logika bisnis modul pengeluaran harian (owner-only).

import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { notFound } from '../../utils/errors';
import { toDateOnly } from '../../utils/date';
import { monthRange } from '../../utils/month';
import type { CreateExpenseInput, UpdateExpenseInput, ListExpenseQuery } from './expenses.schema';

export interface ExpenseDto {
  id: number;
  date: string;
  category: string;
  amount: number;
  description: string;
  paidBy: number;
  payerName: string;
  notes: string | null;
  createdAt: string;
}

const expenseInclude = { payer: { select: { name: true } } } satisfies Prisma.ExpenseInclude;
type ExpenseRow = Prisma.ExpenseGetPayload<{ include: typeof expenseInclude }>;

function toDto(e: ExpenseRow): ExpenseDto {
  return {
    id: e.id,
    date: e.date.toISOString().slice(0, 10),
    category: e.category,
    amount: Number(e.amount),
    description: e.description,
    paidBy: e.paidBy,
    payerName: e.payer.name,
    notes: e.notes,
    createdAt: e.createdAt.toISOString(),
  };
}

/** Daftar pengeluaran dengan filter tanggal / bulan / kategori. */
export async function listExpenses(query: ListExpenseQuery): Promise<ExpenseDto[]> {
  const where: Prisma.ExpenseWhereInput = {};
  if (query.category) where.category = query.category;
  if (query.date) {
    where.date = toDateOnly(query.date);
  } else if (query.month) {
    const { start, end } = monthRange(query.month);
    where.date = { gte: start, lt: end };
  }

  const rows = await prisma.expense.findMany({
    where,
    include: expenseInclude,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });
  return rows.map(toDto);
}

/** Detail satu pengeluaran. */
export async function getExpenseById(id: number): Promise<ExpenseDto> {
  const e = await prisma.expense.findUnique({ where: { id }, include: expenseInclude });
  if (!e) throw notFound('Pengeluaran');
  return toDto(e);
}

/** Catat pengeluaran baru. paidBy diambil dari user yang login (owner). */
export async function createExpense(paidBy: number, input: CreateExpenseInput): Promise<ExpenseDto> {
  const e = await prisma.expense.create({
    data: {
      date: toDateOnly(input.date),
      category: input.category,
      amount: input.amount,
      description: input.description,
      notes: input.notes ?? null,
      paidBy,
    },
    include: expenseInclude,
  });
  return toDto(e);
}

/** Ubah pengeluaran. */
export async function updateExpense(id: number, input: UpdateExpenseInput): Promise<ExpenseDto> {
  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) throw notFound('Pengeluaran');

  const e = await prisma.expense.update({
    where: { id },
    data: {
      ...(input.date !== undefined && { date: toDateOnly(input.date) }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.amount !== undefined && { amount: input.amount }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.notes !== undefined && { notes: input.notes }),
    },
    include: expenseInclude,
  });
  return toDto(e);
}

/** Hapus pengeluaran. */
export async function deleteExpense(id: number): Promise<void> {
  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) throw notFound('Pengeluaran');
  await prisma.expense.delete({ where: { id } });
}
