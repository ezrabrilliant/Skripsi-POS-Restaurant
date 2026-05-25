// Zod schema untuk modul stocks/portion. REV 2.2:
//   - Restock pagi WAJIB kelipatan 5 (formula resto: roundup((min-current)/5)*5).
//   - Barang masuk (restock darurat) tidak wajib kelipatan 5 (emergency).
//   - Opname: input qtyFisik per item, server hitung selisih sendiri.
//   - Mark habis: shortcut UI untuk set qty=0.

import { z } from 'zod';

const menuIdField = z.number().int().positive();

export const restockMorningItemSchema = z.object({
  menuId: menuIdField,
  qty: z
    .number()
    .int()
    .positive('Qty restock harus > 0')
    .refine((v) => v % 5 === 0, { message: 'Qty restock pagi harus kelipatan 5' }),
});

export const restockMorningSchema = z.object({
  items: z.array(restockMorningItemSchema).min(1, 'Minimal 1 item restock'),
});

export const emergencyInSchema = z.object({
  menuId: menuIdField,
  qty: z.number().int().positive('Qty barang masuk harus > 0'),
  note: z.string().trim().max(255).optional(),
});

export const opnameItemSchema = z.object({
  menuId: menuIdField,
  qtyFisik: z.number().int().min(0, 'qtyFisik tidak boleh negatif'),
});

export const opnameSchema = z.object({
  items: z.array(opnameItemSchema).min(1, 'Minimal 1 item opname'),
  /// Catatan opnional untuk konteks ("Opname pagi", "Opname malam", dll). Disimpan
  /// per item di PortionMovement.note.
  note: z.string().trim().max(100).optional(),
});

export const markHabisBodySchema = z.object({
  note: z.string().trim().max(255).optional(),
});

export const listPortionQuerySchema = z.object({
  category: z.string().trim().min(1).optional(),
  lowStock: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export type RestockMorningInput = z.infer<typeof restockMorningSchema>;
export type EmergencyInInput = z.infer<typeof emergencyInSchema>;
export type OpnameInput = z.infer<typeof opnameSchema>;
export type MarkHabisInput = z.infer<typeof markHabisBodySchema>;
export type ListPortionQuery = z.infer<typeof listPortionQuerySchema>;
