// Service modul banks. REV 2.6: CRUD master bank, dedup case-insensitive via DB collation.
// Soft delete only (toggle isActive). No hard delete (per Decision #9 spec).

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError, notFound } from '../../utils/errors';
import type { CreateBankInput, UpdateBankInput, ListBanksQuery } from './banks.schema';

export interface BankView {
  id: number;
  name: string;
  isActive: boolean;
  methodCount: number;
  createdAt: string;
}

type BankWithCount = Prisma.BankGetPayload<{ include: { _count: { select: { methods: true } } } }>;

function toBankView(b: BankWithCount): BankView {
  return {
    id: b.id,
    name: b.name,
    isActive: b.isActive,
    methodCount: b._count.methods,
    createdAt: b.createdAt.toISOString(),
  };
}

export async function listBanks(query: ListBanksQuery): Promise<BankView[]> {
  const where: Prisma.BankWhereInput = {};
  if (!query.includeInactive) where.isActive = true;

  const banks = await prisma.bank.findMany({
    where,
    include: { _count: { select: { methods: true } } },
    orderBy: { name: 'asc' },
  });
  return banks.map(toBankView);
}

export async function getBankById(id: number): Promise<BankView> {
  const b = await prisma.bank.findUnique({
    where: { id },
    include: { _count: { select: { methods: true } } },
  });
  if (!b) throw notFound('Bank');
  return toBankView(b);
}

export async function createBank(input: CreateBankInput): Promise<BankView> {
  try {
    const created = await prisma.bank.create({
      data: { name: input.name },
      include: { _count: { select: { methods: true } } },
    });
    return toBankView(created);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new AppError(`Bank dengan nama "${input.name}" sudah ada`, 409);
    }
    throw e;
  }
}

export async function updateBank(id: number, input: UpdateBankInput): Promise<BankView> {
  const existing = await prisma.bank.findUnique({ where: { id } });
  if (!existing) throw notFound('Bank');

  try {
    const updated = await prisma.bank.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: { _count: { select: { methods: true } } },
    });
    return toBankView(updated);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new AppError(`Bank dengan nama "${input.name}" sudah ada`, 409);
    }
    throw e;
  }
}
