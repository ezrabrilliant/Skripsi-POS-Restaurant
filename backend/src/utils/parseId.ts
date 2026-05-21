// Mengubah parameter id dari URL (selalu string) menjadi integer positif.
// Melempar AppError 400 bila bukan angka valid.

import { AppError } from './errors';

export function parseId(raw: string | undefined, label = 'ID'): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new AppError(`${label} tidak valid`, 400);
  }
  return n;
}
