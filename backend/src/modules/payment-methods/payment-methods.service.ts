// Service modul payment-methods. REV 2.6: CRUD + toggle + bank assignment + reorder.
// Soft delete only via toggle isActive (Decision #9). Code immutable.

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError, notFound } from '../../utils/errors';
import type {
  CreatePaymentMethodInput,
  UpdatePaymentMethodInput,
  TogglePaymentMethodInput,
  ReorderPaymentMethodsInput,
  ListPaymentMethodsQuery,
} from './payment-methods.schema';

export interface PaymentMethodView {
  id: number;
  code: string;
  label: string;
  colorHex: string;
  iconName: string;
  requiresBank: boolean;
  allowDineIn: boolean;
  allowTakeaway: boolean;
  isActive: boolean;
  displayOrder: number;
  banks: { id: number; name: string; isActive: boolean }[];
  createdAt: string;
  updatedAt: string;
}

type MethodWithBanks = Prisma.PaymentMethodGetPayload<{
  include: { banks: { include: { bank: true } } };
}>;

function toView(m: MethodWithBanks): PaymentMethodView {
  return {
    id: m.id,
    code: m.code,
    label: m.label,
    colorHex: m.colorHex,
    iconName: m.iconName,
    requiresBank: m.requiresBank,
    allowDineIn: m.allowDineIn,
    allowTakeaway: m.allowTakeaway,
    isActive: m.isActive,
    displayOrder: m.displayOrder,
    banks: m.banks.map((j) => ({ id: j.bank.id, name: j.bank.name, isActive: j.bank.isActive })),
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

export async function listPaymentMethods(query: ListPaymentMethodsQuery): Promise<PaymentMethodView[]> {
  const where: Prisma.PaymentMethodWhereInput = {};
  if (!query.includeInactive) where.isActive = true;

  const methods = await prisma.paymentMethod.findMany({
    where,
    include: { banks: { include: { bank: true } } },
    orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
  });
  return methods.map(toView);
}

export async function getPaymentMethodById(id: number): Promise<PaymentMethodView> {
  const m = await prisma.paymentMethod.findUnique({
    where: { id },
    include: { banks: { include: { bank: true } } },
  });
  if (!m) throw notFound('Payment method');
  return toView(m);
}

export async function createPaymentMethod(input: CreatePaymentMethodInput): Promise<PaymentMethodView> {
  // Validate: if requiresBank=true, bankIds wajib non-empty
  if (input.requiresBank && input.bankIds.length === 0) {
    throw new AppError('Aktifkan minimal 1 bank dulu untuk method yang wajib bank', 400);
  }

  // Validate bank existence
  if (input.bankIds.length > 0) {
    const banks = await prisma.bank.findMany({ where: { id: { in: input.bankIds } } });
    if (banks.length !== input.bankIds.length) {
      throw new AppError('Salah satu bank ID tidak valid', 400);
    }
  }

  try {
    const created = await prisma.paymentMethod.create({
      data: {
        code: input.code,
        label: input.label,
        colorHex: input.colorHex,
        iconName: input.iconName,
        requiresBank: input.requiresBank,
        allowDineIn: input.allowDineIn,
        allowTakeaway: input.allowTakeaway,
        displayOrder: input.displayOrder,
        banks: {
          create: input.bankIds.map((bankId) => ({ bankId })),
        },
      },
      include: { banks: { include: { bank: true } } },
    });
    return toView(created);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new AppError(`Code "${input.code}" sudah dipakai method lain`, 409);
    }
    throw e;
  }
}

export async function updatePaymentMethod(
  id: number,
  input: UpdatePaymentMethodInput,
): Promise<PaymentMethodView> {
  const existing = await prisma.paymentMethod.findUnique({
    where: { id },
    include: { _count: { select: { banks: true } } },
  });
  if (!existing) throw notFound('Payment method');

  // Validate: kalau requiresBank dinaikkan ke true, cek bank count
  if (input.requiresBank === true && existing._count.banks === 0) {
    throw new AppError('Tidak bisa set requiresBank=true: aktifkan minimal 1 bank dulu', 400);
  }

  const updated = await prisma.paymentMethod.update({
    where: { id },
    data: input,
    include: { banks: { include: { bank: true } } },
  });
  return toView(updated);
}

export async function togglePaymentMethodActive(
  id: number,
  input: TogglePaymentMethodInput,
): Promise<PaymentMethodView> {
  const existing = await prisma.paymentMethod.findUnique({ where: { id } });
  if (!existing) throw notFound('Payment method');

  const updated = await prisma.paymentMethod.update({
    where: { id },
    data: { isActive: input.isActive },
    include: { banks: { include: { bank: true } } },
  });
  return toView(updated);
}

export async function assignBank(methodId: number, bankId: number): Promise<PaymentMethodView> {
  const [method, bank] = await Promise.all([
    prisma.paymentMethod.findUnique({ where: { id: methodId } }),
    prisma.bank.findUnique({ where: { id: bankId } }),
  ]);
  if (!method) throw notFound('Payment method');
  if (!bank) throw notFound('Bank');

  // Idempotent
  await prisma.paymentMethodBank.upsert({
    where: { paymentMethodId_bankId: { paymentMethodId: methodId, bankId } },
    update: {},
    create: { paymentMethodId: methodId, bankId },
  });

  return getPaymentMethodById(methodId);
}

export async function unassignBank(methodId: number, bankId: number): Promise<PaymentMethodView> {
  const method = await prisma.paymentMethod.findUnique({
    where: { id: methodId },
    include: { _count: { select: { banks: true } } },
  });
  if (!method) throw notFound('Payment method');

  // Block: kalau requiresBank=true dan ini bank terakhir
  if (method.requiresBank && method._count.banks <= 1) {
    throw new AppError('Method ini wajib punya minimal 1 bank - tidak bisa unassign yang terakhir', 400);
  }

  await prisma.paymentMethodBank
    .delete({
      where: { paymentMethodId_bankId: { paymentMethodId: methodId, bankId } },
    })
    .catch((e) => {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        // Not found, idempotent
        return;
      }
      throw e;
    });

  return getPaymentMethodById(methodId);
}

export async function reorderPaymentMethods(
  input: ReorderPaymentMethodsInput,
): Promise<PaymentMethodView[]> {
  await prisma.$transaction(
    input.ordered.map((item) =>
      prisma.paymentMethod.update({
        where: { id: item.id },
        data: { displayOrder: item.displayOrder },
      }),
    ),
  );
  return listPaymentMethods({ includeInactive: true });
}
