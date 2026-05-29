// Zod schema untuk modul shifts. REV 2.2: 2 ShiftType (pagi/malam) per hari per kasir.
// UNIQUE constraint (date, cashier_id, type) di DB melindungi double-open.

import { z } from 'zod';
import { ShiftType } from '@prisma/client';

export const openShiftSchema = z.object({
  type: z.nativeEnum(ShiftType, {
    errorMap: () => ({ message: 'Type shift harus pagi atau malam' }),
  }),
  openingCash: z.number().nonnegative('Modal awal tidak boleh negatif'),
});

// REV 2.7: tutup shift dua mode. Default 'final' (settlement, diblokir kalau ada
// transaksi open). 'handover' = pergantian kasir, boleh oleh kasir masuk berikutnya.
export const closeShiftSchema = z.object({
  mode: z.enum(['final', 'handover']).default('final'),
});

export const listShiftsQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date harus YYYY-MM-DD')
    .optional(),
  cashierId: z.coerce.number().int().positive().optional(),
  status: z.enum(['open', 'closed']).optional(),
});

export type OpenShiftInput = z.infer<typeof openShiftSchema>;
export type CloseShiftInput = z.infer<typeof closeShiftSchema>;
export type ListShiftsQuery = z.infer<typeof listShiftsQuerySchema>;
