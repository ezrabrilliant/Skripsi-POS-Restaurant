// Zod schema untuk modul settlements.
// REV 2.6: ganti 6 field actualXxx fixed dengan `counts: Record<string, number>`
// dinamis per payment method code. Persistence pakai settlement_method_counts
// child table (lihat Phase 6 plan).

import { z } from 'zod';
import { SettlementStatus } from '@prisma/client';

const idField = z.number().int().positive();

export const previewQuerySchema = z.object({
  shiftId: z.coerce.number().int().positive(),
});

// REV 2.6: counts dinamis per method code, bukan 6 field hardcoded.
// Keys harus match format payment_methods.code (snake_case lowercase).
// Empty record diijinkan (settle shift tanpa transaksi atau semua method 0).
export const createSettlementSchema = z.object({
  shiftId: idField,
  counts: z.record(
    z.string().regex(/^[a-z][a-z0-9_]*$/, 'Method code harus format snake_case lowercase'),
    z.number().int().min(0, 'Counted amount tidak boleh negatif'),
  ),
  note: z.string().trim().max(500).nullable().optional(),
});

export const listSettlementsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  cashierId: z.coerce.number().int().positive().optional(),
  status: z.nativeEnum(SettlementStatus).optional(),
});

export type CreateSettlementInput = z.infer<typeof createSettlementSchema>;
export type ListSettlementsQuery = z.infer<typeof listSettlementsQuerySchema>;
