// Service modul bills. REV 2.3: tagihan operasional bulanan owner-only.
// Tidak ada FK downstream, jadi hard-delete aman.

import { BillCategory, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { notFound } from '../../utils/errors';
import type { CreateBillInput, UpdateBillInput, ListBillsQuery } from './bills.schema';

// ============================================================
// View shape
// ============================================================

export interface BillView {
  id: number;
  month: string; // YYYY-MM
  category: BillCategory;
  amount: number;
  note: string | null;
  userId: number;
  userName: string;
  createdAt: string;
}

type BillWithUser = Prisma.BillGetPayload<{ include: { user: { select: { name: true } } } }>;

function toBillView(b: BillWithUser): BillView {
  return {
    id: b.id,
    month: b.month,
    category: b.category,
    amount: b.amount.toNumber(),
    note: b.note,
    userId: b.userId,
    userName: b.user.name,
    createdAt: b.createdAt.toISOString(),
  };
}

// ============================================================
// Operations
// ============================================================

export async function listBills(query: ListBillsQuery): Promise<BillView[]> {
  const where: Prisma.BillWhereInput = {};
  if (query.month) where.month = query.month;
  else if (query.year) where.month = { startsWith: `${query.year}-` };
  if (query.category) where.category = query.category;

  const bills = await prisma.bill.findMany({
    where,
    include: { user: { select: { name: true } } },
    orderBy: [{ month: 'desc' }, { category: 'asc' }],
  });
  return bills.map(toBillView);
}

export async function getBillById(id: number): Promise<BillView> {
  const b = await prisma.bill.findUnique({
    where: { id },
    include: { user: { select: { name: true } } },
  });
  if (!b) throw notFound('Bill');
  return toBillView(b);
}

export async function createBill(userId: number, input: CreateBillInput): Promise<BillView> {
  const created = await prisma.bill.create({
    data: {
      month: input.month,
      category: input.category,
      amount: new Prisma.Decimal(input.amount),
      note: input.note ?? null,
      userId,
    },
    include: { user: { select: { name: true } } },
  });
  return toBillView(created);
}

export async function updateBill(id: number, input: UpdateBillInput): Promise<BillView> {
  const existing = await prisma.bill.findUnique({ where: { id } });
  if (!existing) throw notFound('Bill');

  const data: Prisma.BillUpdateInput = {};
  if (input.month !== undefined) data.month = input.month;
  if (input.category !== undefined) data.category = input.category;
  if (input.amount !== undefined) data.amount = new Prisma.Decimal(input.amount);
  if (input.note !== undefined) data.note = input.note;

  const updated = await prisma.bill.update({
    where: { id },
    data,
    include: { user: { select: { name: true } } },
  });
  return toBillView(updated);
}

export async function deleteBill(id: number): Promise<{ id: number; month: string; category: BillCategory }> {
  const existing = await prisma.bill.findUnique({ where: { id } });
  if (!existing) throw notFound('Bill');
  await prisma.bill.delete({ where: { id } });
  return { id: existing.id, month: existing.month, category: existing.category };
}
