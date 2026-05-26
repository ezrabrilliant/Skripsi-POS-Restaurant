// Zod schema untuk modul stocks/raw-materials. REV 2.5:
//   - is_tracked=true  -> stok di-update saat purchase, ada reminder restock + freshness
//   - is_tracked=false -> hanya log pengeluaran, tidak monitoring stok
//   - unitId FK ke master `units` (opname_mode ditentukan oleh unit, bukan disimpan di sini)
//   - category enum 5 nilai untuk grouping di laporan owner
// NOTE: schema ini partial-updated di Task 5 (tambah unitId + newStockQty).
//       Task 6 akan polish lebih lanjut (mis. min_stock validation per opname_mode via refine).

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
  isTracked: z.boolean(),
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
    isTracked: z.boolean().optional(),
    minStock: minStockField,
    unitPrice: unitPriceField,
    freshnessDays: freshnessDaysField,
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Minimal satu field harus diisi untuk update',
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
  isTracked: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  needsRestock: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export type CreateRawMaterialInput = z.infer<typeof createRawMaterialSchema>;
export type UpdateRawMaterialInput = z.infer<typeof updateRawMaterialSchema>;
export type OpnameInput = z.infer<typeof opnameSchema>;
export type MarkHabisInput = z.infer<typeof markHabisBodySchema>;
export type ListRawMaterialsQuery = z.infer<typeof listRawMaterialsQuerySchema>;
