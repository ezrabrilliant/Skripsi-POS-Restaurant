// Logika bisnis modul manajemen pengguna (owner-only).

import type { User } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError, notFound } from '../../utils/errors';
import type { CreateUserInput, UpdateUserInput } from './users.schema';

/** Bentuk user untuk respons — PIN tidak pernah dikirim ke klien. */
export type PublicUser = Omit<User, 'pin'>;

function toPublicUser(user: User): PublicUser {
  const { pin: _pin, ...rest } = user;
  return rest;
}

/** Daftar seluruh pengguna. */
export async function listUsers(): Promise<PublicUser[]> {
  const users = await prisma.user.findMany({ orderBy: [{ role: 'asc' }, { name: 'asc' }] });
  return users.map(toPublicUser);
}

/** Detail satu pengguna. */
export async function getUserById(id: number): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound('Pengguna');
  return toPublicUser(user);
}

/** Tambah pengguna baru. PIN harus unik antar user. */
export async function createUser(input: CreateUserInput): Promise<PublicUser> {
  const pinTaken = await prisma.user.findUnique({ where: { pin: input.pin } });
  if (pinTaken) throw new AppError('PIN sudah dipakai pengguna lain', 409);

  const user = await prisma.user.create({ data: input });
  return toPublicUser(user);
}

/** Ubah data pengguna. */
export async function updateUser(id: number, input: UpdateUserInput): Promise<PublicUser> {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw notFound('Pengguna');

  if (input.pin && input.pin !== existing.pin) {
    const pinTaken = await prisma.user.findUnique({ where: { pin: input.pin } });
    if (pinTaken) throw new AppError('PIN sudah dipakai pengguna lain', 409);
  }

  const user = await prisma.user.update({ where: { id }, data: input });
  return toPublicUser(user);
}

/**
 * Hapus pengguna. Ditolak bila user sudah punya riwayat (transaksi/shift/
 * settlement/pengeluaran) — sarankan non-aktifkan. Tidak boleh hapus diri sendiri.
 */
export async function deleteUser(id: number, requesterId: number): Promise<void> {
  if (id === requesterId) {
    throw new AppError('Tidak bisa menghapus akun sendiri', 400);
  }
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw notFound('Pengguna');

  const [tx, shifts, settlements, expenses] = await Promise.all([
    prisma.transaction.count({ where: { cashierId: id } }),
    prisma.shift.count({ where: { cashierId: id } }),
    prisma.settlement.count({ where: { OR: [{ cashierId: id }, { reviewerId: id }] } }),
    prisma.expense.count({ where: { paidBy: id } }),
  ]);
  if (tx + shifts + settlements + expenses > 0) {
    throw new AppError(
      'Pengguna sudah punya riwayat transaksi/shift. Non-aktifkan saja (isActive=false), jangan dihapus.',
      409,
    );
  }

  await prisma.user.delete({ where: { id } });
}
