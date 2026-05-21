// Logika bisnis modul shift: buka kasir & ambil shift aktif.
// Satu kasir hanya boleh punya satu shift terbuka pada satu waktu.

import type { Shift } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError, notFound } from '../../utils/errors';
import { todayString, toDateOnly } from '../../utils/date';

export interface ShiftDto {
  id: number;
  date: string;
  cashierId: number;
  openingCash: number;
  closedAt: string | null;
  createdAt: string;
}

function toDto(shift: Shift): ShiftDto {
  return {
    id: shift.id,
    date: shift.date.toISOString().slice(0, 10),
    cashierId: shift.cashierId,
    openingCash: Number(shift.openingCash),
    closedAt: shift.closedAt ? shift.closedAt.toISOString() : null,
    createdAt: shift.createdAt.toISOString(),
  };
}

/** Cari shift terbuka milik seorang kasir (closedAt = null). */
export async function findOpenShift(cashierId: number): Promise<Shift | null> {
  return prisma.shift.findFirst({
    where: { cashierId, closedAt: null },
    orderBy: { createdAt: 'desc' },
  });
}

/** Buka kasir: membuat shift baru. Gagal bila masih ada shift terbuka. */
export async function openShift(cashierId: number, openingCash: number): Promise<ShiftDto> {
  const existing = await findOpenShift(cashierId);
  if (existing) {
    throw new AppError('Masih ada shift yang terbuka. Tutup kasir dulu sebelum buka shift baru.', 409);
  }

  const shift = await prisma.shift.create({
    data: {
      date: toDateOnly(todayString()),
      cashierId,
      openingCash,
    },
  });
  return toDto(shift);
}

/** Shift aktif kasir saat ini, atau null bila belum buka kasir. */
export async function getCurrentShift(cashierId: number): Promise<ShiftDto | null> {
  const shift = await findOpenShift(cashierId);
  return shift ? toDto(shift) : null;
}

/** Ambil shift terbuka milik kasir; lempar error bila belum buka kasir. */
export async function requireOpenShift(cashierId: number): Promise<Shift> {
  const shift = await findOpenShift(cashierId);
  if (!shift) {
    throw new AppError('Belum buka kasir. Lakukan "Buka Kasir" terlebih dahulu.', 409);
  }
  return shift;
}

/** Ambil shift berdasarkan id. */
export async function getShiftById(id: number): Promise<Shift> {
  const shift = await prisma.shift.findUnique({ where: { id } });
  if (!shift) throw notFound('Shift');
  return shift;
}
