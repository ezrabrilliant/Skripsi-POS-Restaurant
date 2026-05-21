// Skema validasi input modul stok harian.

import { z } from 'zod';

const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
  .optional();

// Input satu entri stok.
export const createStockSchema = z.object({
  date: dateField,
  menuId: z.number().int().positive('menuId tidak valid'),
  openingStock: z.number().int().nonnegative('Stok tidak boleh negatif'),
});

// Input stok pagi sekaligus banyak menu (alur Kitchen).
export const bulkStockSchema = z.object({
  date: dateField,
  items: z
    .array(
      z.object({
        menuId: z.number().int().positive('menuId tidak valid'),
        openingStock: z.number().int().nonnegative('Stok tidak boleh negatif'),
      }),
    )
    .min(1, 'Minimal satu item stok'),
});

// Koreksi entri stok yang sudah ada.
export const updateStockSchema = z
  .object({
    openingStock: z.number().int().nonnegative().optional(),
    currentStock: z.number().int().nonnegative().optional(),
  })
  .refine((d) => d.openingStock !== undefined || d.currentStock !== undefined, {
    message: 'Minimal satu field (openingStock / currentStock) harus diisi',
  });

// Query tanggal untuk GET /stocks dan /stocks/status.
export const dateQuerySchema = z.object({ date: dateField });

export type CreateStockInput = z.infer<typeof createStockSchema>;
export type BulkStockInput = z.infer<typeof bulkStockSchema>;
export type UpdateStockInput = z.infer<typeof updateStockSchema>;
