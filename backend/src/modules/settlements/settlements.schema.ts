// Zod schema untuk modul settlements. REV 2.2 schema dengan 6 buckets:
//   cash / edc / qris / gojek / grab / transfer (system + actual masing-masing)
// Variance dihitung runtime di view shape, bukan disimpan.

import { z } from 'zod';
import { SettlementStatus } from '@prisma/client';

const idField = z.number().int().positive();
const amountField = z.number().nonnegative('Amount tidak boleh negatif');

export const previewQuerySchema = z.object({
  shiftId: z.coerce.number().int().positive(),
});

export const createSettlementSchema = z.object({
  shiftId: idField,
  actualCash: amountField,
  actualEdc: amountField,
  actualQris: amountField,
  actualGojek: amountField,
  actualGrab: amountField,
  actualTransfer: amountField,
});

export const listSettlementsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  cashierId: z.coerce.number().int().positive().optional(),
  status: z.nativeEnum(SettlementStatus).optional(),
});

export type CreateSettlementInput = z.infer<typeof createSettlementSchema>;
export type ListSettlementsQuery = z.infer<typeof listSettlementsQuerySchema>;
