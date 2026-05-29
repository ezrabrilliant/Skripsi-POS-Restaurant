// Zod schema untuk modul settlements.
// REV 2.6: ganti 6 field actualXxx fixed dengan `counts: Record<string, number>`
// dinamis per payment method code. Persistence pakai settlement_method_counts
// child table (lihat Phase 6 plan).

import { z } from 'zod';
import { SettlementStatus } from '@prisma/client';

// Phase 3 (shift-redesign): settlement = whole business day, keyed by `date`
// (YYYY-MM-DD), bukan satu shiftId. Preview & create sama-sama pakai date.
export const previewQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date harus YYYY-MM-DD'),
});

// counts dinamis per method code. Keys harus match format payment_methods.code
// (snake_case lowercase). Empty record diijinkan (settle hari tanpa transaksi
// atau semua method 0).
export const createSettlementSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date harus YYYY-MM-DD'),
  counts: z.record(z.string(), z.number().nonnegative()),
});

export const listSettlementsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  cashierId: z.coerce.number().int().positive().optional(),
  status: z.nativeEnum(SettlementStatus).optional(),
});

export type CreateSettlementInput = z.infer<typeof createSettlementSchema>;
export type ListSettlementsQuery = z.infer<typeof listSettlementsQuerySchema>;
