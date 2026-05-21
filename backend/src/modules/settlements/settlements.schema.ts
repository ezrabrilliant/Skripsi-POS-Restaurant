// Skema validasi input modul settlement (tutup kasir blind count).

import { z } from 'zod';

const money = z.number().nonnegative('Nominal tidak boleh negatif');

// Input blind count: jumlah kas fisik per metode pembayaran yang dihitung kasir
// TANPA melihat total dari sistem terlebih dahulu.
export const createSettlementSchema = z.object({
  actualCash: money,
  actualQris: money,
  actualTransfer: money,
  actualDebitCredit: money,
  actualOjol: money,
});

export const listSettlementQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
    .optional(),
  status: z.enum(['submitted', 'reviewed']).optional(),
});

export type CreateSettlementInput = z.infer<typeof createSettlementSchema>;
