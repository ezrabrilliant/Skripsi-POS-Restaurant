// Middleware autentikasi: memverifikasi JWT pada header Authorization
// dan menempelkan { id, role } ke req.user.

import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';
import { env } from '../config/env';
import { unauthorized } from '../utils/errors';

interface JwtPayload {
  userId: number;
  role: UserRole;
}

export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw unauthorized('Token tidak disertakan');
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = { id: payload.userId, role: payload.role };
    next();
  } catch {
    throw unauthorized('Token tidak valid atau sudah kedaluwarsa');
  }
};

// Soft auth (REV 2.11): set req.user kalau token valid, tapi TIDAK PERNAH menolak
// saat absen/invalid. Dipakai pada GET /menus + GET /menus/:id supaya POS/publik
// tetap bisa baca (tanpa cost), sedangkan request owner ber-token mendapat cost.
export const authenticateOptional: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as JwtPayload;
      req.user = { id: payload.userId, role: payload.role };
    } catch {
      /* abaikan token tidak valid — perlakukan sebagai anonim */
    }
  }
  next();
};
