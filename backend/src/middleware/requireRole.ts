// Middleware penjaga peran. Dipasang setelah `authenticate`.
// Contoh: router.post('/users', authenticate, requireRole('owner'), handler)

import type { RequestHandler } from 'express';
import type { UserRole } from '@prisma/client';
import { forbidden, unauthorized } from '../utils/errors';

export const requireRole =
  (...allowed: UserRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) throw unauthorized();
    if (!allowed.includes(req.user.role)) {
      throw forbidden('Peran Anda tidak memiliki akses ke fitur ini');
    }
    next();
  };
