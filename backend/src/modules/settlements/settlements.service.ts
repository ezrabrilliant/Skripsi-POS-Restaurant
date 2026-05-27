// Service modul settlements. REV 2.5:
//   - Settlement = rekap akhir hari per shift (1:1 dengan Shift via UNIQUE shiftId).
//   - 6 buckets: cash, edc, qris, gojek, grab, transfer (system + actual disimpan).
//   - Per matrix REV 2.3:
//       * Submit settlement -> owner + kasir (kasir hanya shift MALAM sendiri,
//         dicek inline di service karena route layer tidak tahu shift type)
//       * Review settlement -> owner only
//   - Variance dihitung runtime di view (bukan disimpan ke DB).
//   - REV 2.5: System totals + bank breakdown dihitung dari TransactionPayment
//     (multi-slice per Tx), bukan dari Tx.paymentMethod yang sudah di-drop.
//     Filter mergedIntoId IS NULL via relation untuk hindari double-count.

// REV 2.6: PaymentMethod enum di-rename jadi PaymentMethodLegacy di Prisma schema.
// Re-alias di sini untuk minimize code change di module ini sampai Phase 6 refactor.
import {
  PaymentMethodLegacy as PaymentMethod,
  Prisma,
  SettlementStatus,
  ShiftType,
  TransactionStatus,
  UserRole,
} from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError, forbidden, notFound } from '../../utils/errors';
import type {
  CreateSettlementInput,
  ListSettlementsQuery,
} from './settlements.schema';

// ============================================================
// View shape
// ============================================================

export interface SettlementMethodTotals {
  cash: number;
  edc: number;
  qris: number;
  gojek: number;
  grab: number;
  transfer: number;
}

export interface BankBreakdownEntry {
  method: 'edc' | 'transfer';
  bank: string;
  total: number;
}

export interface SettlementView {
  id: number;
  shiftId: number;
  date: string; // YYYY-MM-DD
  cashierId: number;
  cashierName: string;
  reviewerId: number | null;
  reviewerName: string | null;
  system: SettlementMethodTotals;
  actual: SettlementMethodTotals;
  variance: SettlementMethodTotals;
  totalSystem: number;
  totalActual: number;
  totalVariance: number;
  status: SettlementStatus;
  submittedAt: string;
  reviewedAt: string | null;
  bankBreakdown: BankBreakdownEntry[];
}

export interface SettlementPreview {
  shiftId: number;
  shiftType: ShiftType;
  date: string;
  cashierId: number;
  cashierName: string;
  closedAt: string | null;
  system: SettlementMethodTotals;
  totalSystem: number;
  bankBreakdown: BankBreakdownEntry[];
  existingSettlementId: number | null;
}

type SettlementWithRelations = Prisma.SettlementGetPayload<{
  include: {
    cashier: { select: { name: true } };
    reviewer: { select: { name: true } };
  };
}>;

function toMethodTotalsZero(): SettlementMethodTotals {
  return { cash: 0, edc: 0, qris: 0, gojek: 0, grab: 0, transfer: 0 };
}

function sumMethodTotals(totals: SettlementMethodTotals): number {
  return totals.cash + totals.edc + totals.qris + totals.gojek + totals.grab + totals.transfer;
}

function diffMethodTotals(
  a: SettlementMethodTotals,
  b: SettlementMethodTotals,
): SettlementMethodTotals {
  return {
    cash: a.cash - b.cash,
    edc: a.edc - b.edc,
    qris: a.qris - b.qris,
    gojek: a.gojek - b.gojek,
    grab: a.grab - b.grab,
    transfer: a.transfer - b.transfer,
  };
}

function toSettlementView(s: SettlementWithRelations, bankBreakdown: BankBreakdownEntry[]): SettlementView {
  const system: SettlementMethodTotals = {
    cash: s.systemCash.toNumber(),
    edc: s.systemEdc.toNumber(),
    qris: s.systemQris.toNumber(),
    gojek: s.systemGojek.toNumber(),
    grab: s.systemGrab.toNumber(),
    transfer: s.systemTransfer.toNumber(),
  };
  const actual: SettlementMethodTotals = {
    cash: s.actualCash.toNumber(),
    edc: s.actualEdc.toNumber(),
    qris: s.actualQris.toNumber(),
    gojek: s.actualGojek.toNumber(),
    grab: s.actualGrab.toNumber(),
    transfer: s.actualTransfer.toNumber(),
  };
  const variance = diffMethodTotals(actual, system);
  return {
    id: s.id,
    shiftId: s.shiftId,
    date: s.date.toISOString().substring(0, 10),
    cashierId: s.cashierId,
    cashierName: s.cashier.name,
    reviewerId: s.reviewerId,
    reviewerName: s.reviewer?.name ?? null,
    system,
    actual,
    variance,
    totalSystem: sumMethodTotals(system),
    totalActual: sumMethodTotals(actual),
    totalVariance: sumMethodTotals(variance),
    status: s.status,
    submittedAt: s.submittedAt.toISOString(),
    reviewedAt: s.reviewedAt ? s.reviewedAt.toISOString() : null,
    bankBreakdown,
  };
}

// ============================================================
// System totals + bank breakdown (computed from transactions)
// ============================================================

async function computeSystemTotals(shiftId: number): Promise<SettlementMethodTotals> {
  // REV 2.5: aggregate dari TransactionPayment.amount (multi-slice per Tx),
  // filter via relation Tx.shiftId + Tx.status=paid + Tx.mergedIntoId IS NULL
  // (exclude source yang di-merge supaya tidak double-count).
  const grouped = await prisma.transactionPayment.groupBy({
    by: ['method'],
    where: {
      transaction: {
        shiftId,
        status: TransactionStatus.paid,
        mergedIntoId: null,
      },
    },
    _sum: { amount: true },
  });

  const totals = toMethodTotalsZero();
  for (const g of grouped) {
    const amount = g._sum.amount?.toNumber() ?? 0;
    totals[g.method] = amount;
  }
  return totals;
}

async function computeBankBreakdown(shiftId: number): Promise<BankBreakdownEntry[]> {
  // REV 2.5: bank breakdown via TransactionPayment.bank groupBy.
  const rows = await prisma.transactionPayment.groupBy({
    by: ['method', 'bank'],
    where: {
      transaction: {
        shiftId,
        status: TransactionStatus.paid,
        mergedIntoId: null,
      },
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

// ============================================================
// Operations
// ============================================================

export async function previewSettlement(shiftId: number): Promise<SettlementPreview> {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { cashier: { select: { name: true } } },
  });
  if (!shift) throw notFound('Shift');

  const [system, bankBreakdown, existing] = await Promise.all([
    computeSystemTotals(shiftId),
    computeBankBreakdown(shiftId),
    prisma.settlement.findUnique({ where: { shiftId }, select: { id: true } }),
  ]);

  return {
    shiftId: shift.id,
    shiftType: shift.type,
    date: shift.date.toISOString().substring(0, 10),
    cashierId: shift.cashierId,
    cashierName: shift.cashier.name,
    closedAt: shift.closedAt ? shift.closedAt.toISOString() : null,
    system,
    totalSystem: sumMethodTotals(system),
    bankBreakdown,
    existingSettlementId: existing?.id ?? null,
  };
}

export async function createSettlement(
  userId: number,
  userRole: UserRole,
  input: CreateSettlementInput,
): Promise<SettlementView> {
  // Validasi shift
  const shift = await prisma.shift.findUnique({ where: { id: input.shiftId } });
  if (!shift) throw notFound('Shift');
  if (!shift.closedAt) {
    throw new AppError('Shift belum ditutup, settlement tidak bisa dibuat', 400);
  }

  // Permission inline (matrix REV 2.3):
  //   - Owner boleh settle shift siapapun.
  //   - Kasir hanya boleh settle shift MALAM miliknya sendiri.
  if (userRole === UserRole.cashier) {
    if (shift.cashierId !== userId) {
      throw forbidden('Kasir hanya bisa settle shift miliknya sendiri');
    }
    if (shift.type !== ShiftType.malam) {
      throw forbidden('Kasir hanya bisa settle shift malam (per matrix REV 2.3)');
    }
  }

  // Cek tidak ada settlement sebelumnya untuk shift ini (UNIQUE constraint juga
  // proteksi di DB level, tapi kita berikan pesan ramah di app layer).
  const existing = await prisma.settlement.findUnique({ where: { shiftId: input.shiftId } });
  if (existing) {
    throw new AppError(`Settlement untuk shift id=${input.shiftId} sudah ada (id=${existing.id})`, 409);
  }

  // Compute system totals dari transactions
  const system = await computeSystemTotals(input.shiftId);

  const created = await prisma.settlement.create({
    data: {
      shiftId: input.shiftId,
      date: shift.date,
      cashierId: shift.cashierId,
      systemCash: new Prisma.Decimal(system.cash),
      systemEdc: new Prisma.Decimal(system.edc),
      systemQris: new Prisma.Decimal(system.qris),
      systemGojek: new Prisma.Decimal(system.gojek),
      systemGrab: new Prisma.Decimal(system.grab),
      systemTransfer: new Prisma.Decimal(system.transfer),
      actualCash: new Prisma.Decimal(input.actualCash),
      actualEdc: new Prisma.Decimal(input.actualEdc),
      actualQris: new Prisma.Decimal(input.actualQris),
      actualGojek: new Prisma.Decimal(input.actualGojek),
      actualGrab: new Prisma.Decimal(input.actualGrab),
      actualTransfer: new Prisma.Decimal(input.actualTransfer),
      status: SettlementStatus.submitted,
    },
    include: {
      cashier: { select: { name: true } },
      reviewer: { select: { name: true } },
    },
  });

  const bankBreakdown = await computeBankBreakdown(input.shiftId);
  return toSettlementView(created, bankBreakdown);
}

export async function getSettlementById(id: number): Promise<SettlementView> {
  const s = await prisma.settlement.findUnique({
    where: { id },
    include: {
      cashier: { select: { name: true } },
      reviewer: { select: { name: true } },
    },
  });
  if (!s) throw notFound('Settlement');
  const bankBreakdown = await computeBankBreakdown(s.shiftId);
  return toSettlementView(s, bankBreakdown);
}

export async function listSettlements(query: ListSettlementsQuery): Promise<SettlementView[]> {
  const where: Prisma.SettlementWhereInput = {};
  if (query.date) where.date = new Date(query.date);
  else if (query.month) {
    const [y, m] = query.month.split('-').map(Number);
    where.date = {
      gte: new Date(Date.UTC(y!, m! - 1, 1)),
      lt: new Date(Date.UTC(y!, m!, 1)),
    };
  }
  if (query.cashierId) where.cashierId = query.cashierId;
  if (query.status) where.status = query.status;

  const settlements = await prisma.settlement.findMany({
    where,
    include: {
      cashier: { select: { name: true } },
      reviewer: { select: { name: true } },
    },
    orderBy: [{ date: 'desc' }, { submittedAt: 'desc' }],
  });

  // Bank breakdown per-settlement (paralel)
  const withBreakdowns = await Promise.all(
    settlements.map(async (s) => {
      const bb = await computeBankBreakdown(s.shiftId);
      return toSettlementView(s, bb);
    }),
  );
  return withBreakdowns;
}

export async function reviewSettlement(id: number, reviewerId: number): Promise<SettlementView> {
  const existing = await prisma.settlement.findUnique({ where: { id } });
  if (!existing) throw notFound('Settlement');
  if (existing.status === SettlementStatus.reviewed) {
    throw new AppError('Settlement sudah pernah di-review', 400);
  }

  const updated = await prisma.settlement.update({
    where: { id },
    data: {
      reviewerId,
      reviewedAt: new Date(),
      status: SettlementStatus.reviewed,
    },
    include: {
      cashier: { select: { name: true } },
      reviewer: { select: { name: true } },
    },
  });
  const bankBreakdown = await computeBankBreakdown(updated.shiftId);
  return toSettlementView(updated, bankBreakdown);
}
