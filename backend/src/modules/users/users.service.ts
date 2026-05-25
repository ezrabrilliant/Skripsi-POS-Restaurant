// Service modul users. Owner-only CRUD pegawai. REV 2.3:
//   - PIN boleh duplikat antar pegawai (tidak ada validasi unique).
//   - 3 role aktif: owner / cashier / waiter.
//   - Hapus = soft delete (isActive=false) supaya audit log historis tetap utuh.

import { prisma } from '../../config/prisma';
import { notFound } from '../../utils/errors';
import { toPublicUser, type PublicUser } from '../../utils/mapPublicUser';
import type { CreateUserInput, UpdateUserInput } from './users.schema';

export async function listUsers(): Promise<PublicUser[]> {
  const users = await prisma.user.findMany({ orderBy: [{ role: 'asc' }, { name: 'asc' }] });
  return users.map(toPublicUser);
}

export async function getUserById(id: number): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound('User');
  return toPublicUser(user);
}

export async function createUser(input: CreateUserInput): Promise<PublicUser> {
  const created = await prisma.user.create({ data: input });
  return toPublicUser(created);
}

export async function updateUser(id: number, input: UpdateUserInput): Promise<PublicUser> {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw notFound('User');
  const updated = await prisma.user.update({ where: { id }, data: input });
  return toPublicUser(updated);
}

export async function deactivateUser(id: number): Promise<PublicUser> {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw notFound('User');
  const updated = await prisma.user.update({
    where: { id },
    data: { isActive: false },
  });
  return toPublicUser(updated);
}
