// Service modul auth. Bertanggung jawab atas otentikasi (verifikasi nama + PIN)
// dan penerbitan JWT. REV 2.3 spec:
//   - Login satu langkah: form input nama + PIN, server cari user yang cocok.
//   - PIN boleh duplikat antar pegawai - identifikasi via nama.
//   - User non-aktif tidak boleh login (isActive=false).

import jwt from 'jsonwebtoken';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { unauthorized } from '../../utils/errors';
import { toPublicUser, type PublicUser } from '../../utils/mapPublicUser';
import type { LoginInput } from './auth.schema';

interface LoginResult {
  user: PublicUser;
  token: string;
}

interface JwtPayload {
  userId: number;
  role: PublicUser['role'];
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const user = await prisma.user.findFirst({
    where: { name: input.name, pin: input.pin, isActive: true },
  });

  if (!user) {
    throw unauthorized('Nama atau PIN salah');
  }

  const payload: JwtPayload = { userId: user.id, role: user.role };
  const token = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });

  return { user: toPublicUser(user), token };
}

export async function getCurrentUser(userId: number): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw unauthorized('Akun tidak ditemukan atau tidak aktif');
  }
  return toPublicUser(user);
}
