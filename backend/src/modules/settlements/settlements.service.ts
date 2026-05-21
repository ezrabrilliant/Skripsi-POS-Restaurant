// Logika bisnis modul settlement: rekonsiliasi kas akhir shift dengan
// metode blind count, lalu direview oleh owner.

import type { Settlement, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError, notFound } from '../../utils/errors';
import { toDateOnly } from '../../utils/date';
import { requireOpenShift } from '../shifts/shifts.service';
import type { CreateSettlementInput } from './settlements.schema';

// Total penjualan sistem dikelompokkan ke lima metode (debit + credit digabung).
interface MethodTotals {
  cash: number;
  qris: number;
  transfer: number;
  debitCredit: number;
  ojol: number;
}

export interface SettlementDto {
  id: number;
  shiftId: number;
  date: string;
  cashierId: number;
  reviewerId: number | null;
  system: MethodTotals;
  actual: MethodTotals;
  variance: MethodTotals;
  totalSystem: number;
  totalActual: number;
  totalVariance: number;
  status: string;
  submittedAt: string;
  reviewedAt: string | null;
}

function sumTotals(t: MethodTotals): number {
  return t.cash + t.qris + t.transfer + t.debitCredit + t.ojol;
}

function toDto(s: Settlement): SettlementDto {
  const system: MethodTotals = {
    cash: Number(s.systemCash),
    qris: Number(s.systemQris),
    transfer: Number(s.systemTransfer),
    debitCredit: Number(s.systemDebitCredit),
    ojol: Number(s.systemOjol),
  };
  const actual: MethodTotals = {
    cash: Number(s.actualCash),
    qris: Number(s.actualQris),
    transfer: Number(s.actualTransfer),
    debitCredit: Number(s.actualDebitCredit),
    ojol: Number(s.actualOjol),
  };
  const variance: MethodTotals = {
    cash: Number(s.varianceCash),
    qris: Number(s.varianceQris),
    transfer: Number(s.varianceTransfer),
    debitCredit: Number(s.varianceDebitCredit),
    ojol: Number(s.varianceOjol),
  };
  return {
    id: s.id,
    shiftId: s.shiftId,
    date: s.date.toISOString().slice(0, 10),
    cashierId: s.cashierId,
    reviewerId: s.reviewerId,
    system,
    actual,
    variance,
    totalSystem: sumTotals(system),
    totalActual: sumTotals(actual),
    totalVariance: sumTotals(variance),
    status: s.status,
    submittedAt: s.submittedAt.toISOString(),
    reviewedAt: s.reviewedAt ? s.reviewedAt.toISOString() : null,
  };
}

/** Hitung total penjualan sistem per metode bayar dari transaksi lunas sebuah shift. */
async function computeSystemTotals(shiftId: number): Promise<MethodTotals> {
  const paid = await prisma.transaction.findMany({
    where: { shiftId, status: 'paid' },
    select: { paymentMethod: true, total: true },
  });

  const totals: MethodTotals = { cash: 0, qris: 0, transfer: 0, debitCredit: 0, ojol: 0 };
  for (const tx of paid) {
    const amount = Number(tx.total);
    switch (tx.paymentMethod) {
      case 'cash':
        totals.cash += amount;
        break;
      case 'qris':
        totals.qris += amount;
        break;
      case 'transfer':
        totals.transfer += amount;
        break;
      case 'debit':
      case 'credit':
        totals.debitCredit += amount;
        break;
      case 'ojol':
        totals.ojol += amount;
        break;
      default:
        break;
    }
  }
  return totals;
}

/**
 * Pratinjau sebelum tutup kasir. Sesuai prinsip blind count, TIDAK
 * mengembalikan total sistem — hanya memastikan tidak ada pesanan terbuka.
 */
export async function previewSettlement(cashierId: number): Promise<{
  shiftId: number;
  date: string;
  openTransactionCount: number;
  hasUnpaidTransactions: boolean;
}> {
  const shift = await requireOpenShift(cashierId);
  const openCount = await prisma.transaction.count({
    where: { shiftId: shift.id, status: 'open' },
  });
  return {
    shiftId: shift.id,
    date: shift.date.toISOString().slice(0, 10),
    openTransactionCount: openCount,
    hasUnpaidTransactions: openCount > 0,
  };
}

/** Submit blind count: simpan settlement, hitung selisih, tutup shift. */
export async function createSettlement(
  cashierId: number,
  input: CreateSettlementInput,
): Promise<SettlementDto> {
  const shift = await requireOpenShift(cashierId);

  const openCount = await prisma.transaction.count({
    where: { shiftId: shift.id, status: 'open' },
  });
  if (openCount > 0) {
    throw new AppError(
      `Masih ada ${openCount} pesanan belum dibayar. Selesaikan dulu sebelum tutup kasir.`,
      409,
    );
  }

  const existing = await prisma.settlement.findUnique({ where: { shiftId: shift.id } });
  if (existing) throw new AppError('Shift ini sudah memiliki settlement', 409);

  const system = await computeSystemTotals(shift.id);

  const settlement = await prisma.$transaction(async (db) => {
    const created = await db.settlement.create({
      data: {
        shiftId: shift.id,
        date: shift.date,
        cashierId,
        systemCash: system.cash,
        systemQris: system.qris,
        systemTransfer: system.transfer,
        systemDebitCredit: system.debitCredit,
        systemOjol: system.ojol,
        actualCash: input.actualCash,
        actualQris: input.actualQris,
        actualTransfer: input.actualTransfer,
        actualDebitCredit: input.actualDebitCredit,
        actualOjol: input.actualOjol,
        varianceCash: input.actualCash - system.cash,
        varianceQris: input.actualQris - system.qris,
        varianceTransfer: input.actualTransfer - system.transfer,
        varianceDebitCredit: input.actualDebitCredit - system.debitCredit,
        varianceOjol: input.actualOjol - system.ojol,
        status: 'submitted',
      },
    });
    // Tutup shift bersamaan dengan submit settlement.
    await db.shift.update({ where: { id: shift.id }, data: { closedAt: new Date() } });
    return created;
  });

  return toDto(settlement);
}

/** Review settlement oleh owner — menandai rekonsiliasi sudah diperiksa. */
export async function reviewSettlement(id: number, reviewerId: number): Promise<SettlementDto> {
  const settlement = await prisma.settlement.findUnique({ where: { id } });
  if (!settlement) throw notFound('Settlement');
  if (settlement.status === 'reviewed') {
    throw new AppError('Settlement ini sudah direview', 409);
  }

  const updated = await prisma.settlement.update({
    where: { id },
    data: { reviewerId, reviewedAt: new Date(), status: 'reviewed' },
  });
  return toDto(updated);
}

/** Daftar settlement dengan filter tanggal & status. */
export async function listSettlements(filter: {
  date?: string;
  status?: 'submitted' | 'reviewed';
}): Promise<SettlementDto[]> {
  const where: Prisma.SettlementWhereInput = {};
  if (filter.date) where.date = toDateOnly(filter.date);
  if (filter.status) where.status = filter.status;

  const rows = await prisma.settlement.findMany({ where, orderBy: { submittedAt: 'desc' } });
  return rows.map(toDto);
}

/** Detail satu settlement. */
export async function getSettlement(id: number): Promise<SettlementDto> {
  const settlement = await prisma.settlement.findUnique({ where: { id } });
  if (!settlement) throw notFound('Settlement');
  return toDto(settlement);
}
