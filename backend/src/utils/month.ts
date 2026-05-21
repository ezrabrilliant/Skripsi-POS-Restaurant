// Helper rentang bulan untuk laporan. Bulan dalam format YYYY-MM.

import { toDateOnly } from './date';

/** Rentang [start, end) sebuah bulan — start tanggal 1, end tanggal 1 bulan berikutnya. */
export function monthRange(month: string): { start: Date; end: Date } {
  const start = toDateOnly(`${month}-01`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end };
}

/** Rentang [start, end) satu hari penuh. */
export function dayRange(date: string): { start: Date; end: Date } {
  const start = toDateOnly(date);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}
