// Service modul shifts. REV 2.2/2.3:
//   - openShift: kasir buka kasir dengan modal awal. Per matrix REV 2.3, mutasi
//     buka/tutup kasir = kasir-only (validasi role di route layer).
//   - closeShift: kasir tutup sendiri ATAU owner tutup paksa.
//   - getActiveShifts: REV 2.3 shift-decoupling - return SEMUA shift dengan
//     closedAt=null (system-wide, bukan per-user). Frontend yang filter sendiri
//     untuk display "shift sendiri" vs "shift kasir lain (overlap)".
//   - Permission view (list/detail): semua authenticated (waiter butuh tahu shift
//     mana yang aktif untuk fallback input order).
//
// Auto-snapshot opening_qty_today pada portion_stocks DEFERRED ke Phase 5 (stocks
// portion module). Untuk Phase 4 cukup berfungsi tanpa snapshot.

import { Prisma, ShiftType, TransactionStatus, UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError, notFound, forbidden } from '../../utils/errors';
import { canOpenShift } from './shift-rules';
import { restoNow, businessDateFor, isShiftStale } from './shift-time';
import type { ShiftWindowSettings } from './shift-time';
import { getShiftWindow } from '../settings/settings.service';
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
  /// REV 2.12: true kalau shift masih open tapi sudah lewat business day-nya
  /// (lihat isShiftStale). Frontend memakai ini untuk gate "tutup shift kemarin".
  isOverdue: boolean;
}

type ShiftWithCashier = Prisma.ShiftGetPayload<{ include: { cashier: true } }>;

function toShiftView(shift: ShiftWithCashier, window?: ShiftWindowSettings): ShiftView {
  return {
    id: shift.id,
    date: shift.date.toISOString().substring(0, 10),
    type: shift.type,
    cashierId: shift.cashierId,
    cashierName: shift.cashier.name,
    openingCash: shift.openingCash.toNumber(),
    closedAt: shift.closedAt ? shift.closedAt.toISOString() : null,
    createdAt: shift.createdAt.toISOString(),
    // isOverdue hanya relevan untuk shift open + butuh window. Tanpa window → false.
    isOverdue: !shift.closedAt && window ? isShiftStale(shift.date, window) : false,
  };
}

// ============================================================
// Operations
// ============================================================

// REV 2.7 shift redesign: buka shift divalidasi terhadap window operasional
// (getShiftWindow) + single-OPEN marker via kolom activeMarker (UNIQUE).
// canOpenShift menggabungkan dua aturan: tidak boleh ada shift open lain
// (single_active) dan harus dalam jam operasional (out_of_window).
export async function openShift(cashierId: number, input: OpenShiftInput): Promise<ShiftView> {
  const window = await getShiftWindow();
  const now = new Date();
  const { minutesOfDay } = restoNow(window.timezone, now);
  const businessDate = businessDateFor(window, now);

  const [openCount, pagiToday] = await Promise.all([
    prisma.shift.count({ where: { activeMarker: 1 } }),
    prisma.shift.count({ where: { date: businessDate, type: ShiftType.pagi } }),
  ]);

  const check = canOpenShift({
    type: input.type as 'pagi' | 'malam',
    nowMinutes: minutesOfDay,
    settings: window,
    hasOpenShift: openCount > 0,
    pagiOpenedToday: pagiToday > 0,
  });
  if (!check.ok) {
    if (check.reason === 'single_active') {
      const open = await prisma.shift.findFirst({
        where: { activeMarker: 1 },
        include: { cashier: { select: { name: true } } },
      });
      throw new AppError(
        `Masih ada shift ${open?.type ?? ''} milik ${open?.cashier.name ?? 'kasir lain'} yang open - tutup dulu`,
        409,
      );
    }
    throw new AppError('Di luar jam operasional untuk membuka shift ini', 400);
  }

  try {
    const created = await prisma.shift.create({
      data: {
        date: businessDate,
        cashierId,
        type: input.type,
        openingCash: new Prisma.Decimal(input.openingCash),
        activeMarker: 1,
      },
      include: { cashier: true },
    });
    return toShiftView(created);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const open = await prisma.shift.findFirst({
        where: { activeMarker: 1 },
        include: { cashier: { select: { name: true } } },
      });
      throw new AppError(
        `Masih ada shift ${open?.type ?? ''} milik ${open?.cashier.name ?? 'kasir lain'} yang open - tutup dulu`,
        409,
      );
    }
    throw e;
  }
}

// REV 2.7: dua mode tutup shift.
//   - final    : tutup definitif. Wajib owner ATAU kasir pemilik shift. Diblokir
//                kalau masih ada transaksi open (belum dibayar).
//   - handover : pergantian kasir tanpa settlement final. Boleh dilakukan kasir
//                masuk berikutnya (tidak perlu pemilik shift), tidak cek open tx.
export type CloseMode = 'final' | 'handover';

export async function closeShift(
  shiftId: number,
  byUserId: number,
  byRole: UserRole,
  mode: CloseMode = 'final',
): Promise<ShiftView> {
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift) throw notFound('Shift');
  if (shift.closedAt) throw new AppError('Shift sudah ditutup sebelumnya', 400);
  // final close requires owner or the shift's own cashier — KECUALI shift sudah basi
  // (lewat business day). Untuk shift basi, kasir mana pun yang masuk pagi boleh
  // menutup supaya hari baru bisa dimulai tanpa menunggu pemilik shift (REV 2.12).
  if (mode === 'final' && byRole !== UserRole.owner && shift.cashierId !== byUserId) {
    const window = await getShiftWindow();
    if (!isShiftStale(shift.date, window)) {
      throw forbidden('Hanya kasir pemilik shift yang boleh menutup');
    }
  }
  if (mode === 'final') {
    const openCount = await prisma.transaction.count({
      where: { status: TransactionStatus.open, mergedIntoId: null },
    });
    if (openCount > 0) {
      const err = new AppError('Ada pesanan belum dibayar - selesaikan dulu sebelum tutup', 409);
      (err as AppError & { openOrders?: unknown }).openOrders = await getOpenOrdersForClose();
      throw err;
    }
  }
  const updated = await prisma.shift.update({
    where: { id: shiftId },
    data: { closedAt: new Date(), activeMarker: null },
    include: { cashier: true },
  });
  return toShiftView(updated);
}

export interface OpenOrdersGroup {
  groupKey: string;
  label: string;
  tableNumber: number | null;
  txIds: number[];
}

export async function getOpenOrdersForClose(): Promise<OpenOrdersGroup[]> {
  const rows = await prisma.transaction.findMany({
    where: { status: TransactionStatus.open, mergedIntoId: null },
    select: { id: true, tableNumber: true, orderType: true },
    orderBy: [{ tableNumber: 'asc' }, { id: 'asc' }],
  });
  const map = new Map<string, OpenOrdersGroup>();
  for (const r of rows) {
    const key = r.tableNumber != null ? `meja-${r.tableNumber}` : 'takeaway';
    const label = r.tableNumber != null ? `Meja ${r.tableNumber}` : 'Takeaway';
    if (!map.has(key)) map.set(key, { groupKey: key, label, tableNumber: r.tableNumber, txIds: [] });
    map.get(key)!.txIds.push(r.id);
  }
  return [...map.values()];
}

/// REV 2.7: active shift = baris dengan activeMarker=1. UNIQUE([activeMarker])
/// menjamin maksimum satu shift open pada satu waktu, jadi praktis return 0/1 row.
export async function getActiveShifts(): Promise<ShiftView[]> {
  const shifts = await prisma.shift.findMany({
    where: { activeMarker: 1 },
    orderBy: { createdAt: 'desc' },
    include: { cashier: true },
  });
  if (shifts.length === 0) return [];
  const win = await getShiftWindow();
  return shifts.map((s) => toShiftView(s, win));
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
  return shifts.map((s) => toShiftView(s));
}
