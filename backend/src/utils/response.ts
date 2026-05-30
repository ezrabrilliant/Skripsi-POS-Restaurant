// Pembungkus bentuk respons API yang konsisten: { success, message, data }.
// Semua endpoint memakai helper ini agar frontend menerima struktur seragam.

import type { Response } from 'express';

interface ApiBody<T> {
  success: boolean;
  message: string;
  data: T;
}

/** Kirim respons sukses. Default HTTP 200. */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'OK',
  statusCode = 200,
): void {
  const body: ApiBody<T> = { success: true, message, data };
  res.status(statusCode).json(body);
}

/**
 * Kirim respons gagal. `data` default null, tapi beberapa error bisnis
 * (mis. tutup shift dengan transaksi open) ingin menyertakan payload tambahan
 * supaya client bisa menampilkannya - lewatkan via parameter `data`.
 */
export function sendError(
  res: Response,
  message: string,
  statusCode = 400,
  data: unknown = null,
): void {
  const body: ApiBody<unknown> = { success: false, message, data };
  res.status(statusCode).json(body);
}
