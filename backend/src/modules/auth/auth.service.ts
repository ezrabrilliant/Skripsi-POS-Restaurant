// Logika bisnis autentikasi: login via PIN, penerbitan JWT, dan verifikasi PIN.

import jwt from 'jsonwebtoken';
import type { User } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { AppError, unauthorized, notFound } from '../../utils/errors';

/** Bentuk user yang aman dikirim ke klien (tanpa PIN). */
export type PublicUser = Omit<User, 'pin'>;

function toPublicUser(user: User): PublicUser {
  const { pin: _pin, ...rest } = user;
  return rest;
}

/** Menandatangani JWT berisi id user dan perannya. */
function signToken(user: User): string {
  return jwt.sign({ userId: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/** Login dengan PIN. Mengembalikan token + data user. */
export async function login(pin: string): Promise<{ token: string; user: PublicUser }> {
  const user = await prisma.user.findUnique({ where: { pin } });
  if (!user) throw unauthorized('PIN tidak terdaftar');
  if (!user.isActive) throw new AppError('Akun pengguna sedang non-aktif', 403);

  return { token: signToken(user), user: toPublicUser(user) };
}

/** Mengambil data user berdasarkan id (untuk endpoint /auth/me). */
export async function getUserById(id: number): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound('Pengguna');
  return toPublicUser(user);
}

/**
 * Verifikasi PIN untuk elevasi otorisasi (mis. konfirmasi owner saat void).
 * Mengembalikan data user pemilik PIN bila valid.
 */
export async function verifyPin(pin: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { pin } });
  if (!user || !user.isActive) throw unauthorized('PIN tidak valid');
  return toPublicUser(user);
}
