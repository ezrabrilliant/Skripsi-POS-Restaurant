// Zod schema untuk modul stocks/raw-materials. REV 2.5.1:
//   - is_tracked column DROPPED — semua master = always tracked by definition.
//     Bumbu dasar + ayam mentah dll di-catat sebagai free-form line item di
//     PurchaseItem (label + subtotal), bukan master raw material.
//   - unitId FK ke master `units` (opname_mode ditentukan oleh unit, bukan disimpan di sini)
//   - category enum 5 nilai untuk grouping di laporan owner
//
// Validasi min_stock per opname_mode (scale_0_5 range 0..5) di-enforce di service
// layer (assertScale05 helper), bukan di schema — karena perlu lookup unit dari DB.
// Schema hanya memvalidasi bentuk + cross-field dependency (newStockQty butuh unitId).

import { z } from 'zod';
import { RawMaterialCategory } from '@prisma/client';

const idField = z.number().int().positive();
const nameField = z.string().trim().min(1, 'Nama wajib diisi').max(100);
const unitIdField = z.number().int().positive();
const categoryField = z.nativeEnum(RawMaterialCategory, {
  errorMap: () => ({ message: 'Category harus salah satu: bumbuDasar/bahanSegar/bahanPokok/bahanKering/lainnya' }),
});
const qtyDecimalField = z.number().nonnegative('Qty tidak boleh negatif');
const minStockField = z.number().int().nonnegative().optional().nullable();
const unitPriceField = z.number().nonnegative().optional().nullable();
const freshnessDaysField = z.number().int().positive().optional().nullable();

export const createRawMaterialSchema = z.object({
  name: nameField,
  unitId: unitIdField,
  category: categoryField,
  stockQty: qtyDecimalField.default(0),
  minStock: minStockField,
  unitPrice: unitPriceField,
  freshnessDays: freshnessDaysField,
});

export const updateRawMaterialSchema = z
  .object({
    name: nameField.optional(),
    unitId: unitIdField.optional(),
    /// REV 2.5: kalau unitId berubah dan stok > 0, owner WAJIB kirim newStockQty
    /// (atau null untuk reset ke 0). Kalau stok = 0, field ini boleh diabaikan.
    newStockQty: z.number().min(0).nullable().optional(),
    category: categoryField.optional(),
    minStock: minStockField,
    unitPrice: unitPriceField,
    freshnessDays: freshnessDaysField,
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Minimal satu field harus diisi untuk update',
  })
  .refine((data) => data.newStockQty === undefined || data.unitId !== undefined, {
    message: 'newStockQty hanya boleh dikirim bersama unitId (saat ganti satuan)',
    path: ['newStockQty'],
  });

export const opnameItemSchema = z.object({
  rawMaterialId: idField,
  qtyFisik: qtyDecimalField,
});

export const opnameSchema = z.object({
  items: z.array(opnameItemSchema).min(1, 'Minimal 1 item opname'),
  note: z.string().trim().max(100).optional(),
});

export const markHabisBodySchema = z.object({
  note: z.string().trim().max(255).optional(),
});

export const listRawMaterialsQuerySchema = z.object({
  category: categoryField.optional(),
  needsRestock: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  /// REV 2.5.2: include items soft-deleted (isActive=false). Default false.
  /// Owner pakai dari toggle "Tampilkan nonaktif" di RawMaterialsTab.
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export type CreateRawMaterialInput = z.infer<typeof createRawMaterialSchema>;
export type UpdateRawMaterialInput = z.infer<typeof updateRawMaterialSchema>;
export type OpnameInput = z.infer<typeof opnameSchema>;
export type MarkHabisInput = z.infer<typeof markHabisBodySchema>;
export type ListRawMaterialsQuery = z.infer<typeof listRawMaterialsQuerySchema>;
