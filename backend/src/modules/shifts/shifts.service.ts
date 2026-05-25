// Service modul shifts. REV 2.2/2.3:
//   - openShift: kasir buka kasir dengan modal awal. Per matrix REV 2.3, mutasi
//     buka/tutup kasir = kasir-only (validasi role di route layer).
//   - closeShift: kasir tutup sendiri ATAU owner tutup paksa.
//   - getActiveShift: ambil shift aktif (closedAt=null) milik cashier tertentu.
//   - Permission view (list/detail): semua authenticated (waiter butuh tahu shift
//     mana yang aktif untuk fallback input order).
//
// Auto-snapshot opening_qty_today pada portion_stocks DEFERRED ke Phase 5 (stocks
// portion module). Untuk Phase 4 cukup berfungsi tanpa snapshot.

import { Prisma, ShiftType, UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError, notFound, forbidden } from '../../utils/errors';
import type { OpenShiftInput, ListShiftsQuery } from './shifts.schema';

// ============================================================
// View shape (mapper)
// ============================================================

export interface ShiftView {
  id: number;
  date: string; // YYYY-MM-DD
  type: ShiftType;
  cashierId: number;
  cashierName: string;
  openingCash: number;
  closedAt: string | null;
  createdAt: string;
}

type ShiftWithCashier = Prisma.ShiftGetPayload<{ include: { cashier: true } }>;

function toShiftView(shift: ShiftWithCashier): ShiftView {
  return {
    id: shift.id,
    date: shift.date.toISOString().substring(0, 10),
    type: shift.type,
    cashierId: shift.cashierId,
    cashierName: shift.cashier.name,
    openingCash: shift.openingCash.toNumber(),
    closedAt: shift.closedAt ? shift.closedAt.toISOString() : null,
    createdAt: shift.createdAt.toISOString(),
  };
}

// ============================================================
// Helpers
// ============================================================

// Untuk kolom @db.Date, kita ingin tanggal yang konsisten dengan local-day user.
// Pakai komponen LOCAL (getFullYear/Month/Date) lalu bungkus sebagai UTC midnight
// supaya Prisma & MySQL serialize ke string 'YYYY-MM-DD' yang sama untuk
// create dan findUnique - tidak terpengaruh offset timezone.
function todayDateOnly(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

// ============================================================
// Operations
// ============================================================

export async function openShift(cashierId: number, input: OpenShiftInput): Promise<ShiftView> {
  const today = todayDateOnly();

  // Idempotency: tolak kalau sudah ada shift type sama hari ini untuk kasir ini.
  const existing = await prisma.shift.findUnique({
    where: {
      date_cashierId_type: {
        date: today,
        cashierId,
        type: input.type,
      },
    },
  });
  if (existing) {
    throw new AppError(`Shift ${input.type} hari ini sudah pernah dibuka untuk kasir ini`, 409);
  }

  const created = await prisma.shift.create({
    data: {
      date: today,
      cashierId,
      type: input.type,
      openingCash: new Prisma.Decimal(input.openingCash),
    },
    include: { cashier: true },
  });
  return toShiftView(created);
}

export async function closeShift(
  shiftId: number,
  byUserId: number,
  byRole: UserRole,
): Promise<ShiftView> {
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift) throw notFound('Shift');
  if (shift.closedAt) {
    throw new AppError('Shift sudah ditutup sebelumnya', 400);
  }
  // Authz: owner boleh tutup shift siapapun; kasir hanya bisa tutup shiftnya sendiri.
  if (byRole !== UserRole.owner && shift.cashierId !== byUserId) {
    throw forbidden('Hanya kasir pemilik shift yang boleh menutup');
  }

  const updated = await prisma.shift.update({
    where: { id: shiftId },
    data: { closedAt: new Date() },
    include: { cashier: true },
  });
  return toShiftView(updated);
}

export async function getActiveShift(cashierId: number): Promise<ShiftView | null> {
  const shift = await prisma.shift.findFirst({
    where: { cashierId, closedAt: null },
    orderBy: { createdAt: 'desc' },
    include: { cashier: true },
  });
  return shift ? toShiftView(shift) : null;
}

export async function getShiftById(id: number): Promise<ShiftView> {
  const shift = await prisma.shift.findUnique({
    where: { id },
    include: { cashier: true },
  });
  if (!shift) throw notFound('Shift');
  return toShiftView(shift);
}

export async function listShifts(query: ListShiftsQuery): Promise<ShiftView[]> {
  const where: Prisma.ShiftWhereInput = {};
  if (query.date) where.date = new Date(query.date);
  if (query.cashierId) where.cashierId = query.cashierId;
  if (query.status === 'open') where.closedAt = null;
  if (query.status === 'closed') where.closedAt = { not: null };

  const shifts = await prisma.shift.findMany({
    where,
    include: { cashier: true },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });
  return shifts.map(toShiftView);
}
