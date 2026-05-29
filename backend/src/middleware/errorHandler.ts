// Penangan error terpusat. Dipasang paling akhir di app.ts.
// Menerjemahkan AppError, ZodError, dan error tak terduga jadi respons { success, message, data }.

import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { sendError } from '../utils/response';
import { logger } from '../config/logger';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Error validasi Zod -> 422 dengan ringkasan field
  if (err instanceof ZodError) {
    const detail = err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    sendError(res, `Input tidak valid (${detail})`, 422);
    return;
  }

  // Error bisnis yang sengaja dilempar
  if (err instanceof AppError) {
    // Beberapa AppError membawa payload tambahan (mis. closeShift menyertakan
    // openOrders) supaya client bisa menampilkan daftar transaksi yang menghalangi.
    const openOrders = (err as AppError & { openOrders?: unknown }).openOrders;
    const data = openOrders !== undefined ? { openOrders } : null;
    sendError(res, err.message, err.statusCode, data);
    return;
  }

  // Error tak terduga -> 500, dicatat penuh ke log
  logger.error({ err }, 'Unhandled error');
  sendError(res, 'Terjadi kesalahan pada server', 500);
};
