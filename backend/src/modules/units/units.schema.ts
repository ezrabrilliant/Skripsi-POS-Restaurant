// Zod validators untuk units endpoints (REV 2.5).
// Master satuan untuk raw materials. Pre-seeded di seed.ts, owner dapat
// add/edit/delete unit baru via UI. opnameMode menentukan apakah stok dihitung
// numerik exact (kg, liter, pcs) atau pakai skala subjektif 0..5 (sachet, sdt, dll).

import { z } from 'zod';

export const opnameModeEnum = z.enum(['exact', 'scale_0_5']);

export const createUnitSchema = z.object({
  label: z.string().trim().min(1).max(50),
  opnameMode: opnameModeEnum,
});

export const updateUnitSchema = z.object({
  label: z.string().trim().min(1).max(50).optional(),
  opnameMode: opnameModeEnum.optional(),
});

export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
