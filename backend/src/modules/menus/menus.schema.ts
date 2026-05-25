// Zod schema untuk modul menus. REV 2.2: dukung 3 stockType + subOptions JSON
// dengan dua varian (linked sederhana vs paket dengan pilihan dinamis).
//
// Catatan: subOptions.stockMap / subOptions.stockTarget memakai NAMA menu sebagai
// referensi (bukan id), mengikuti konvensi seed catalog. Validasi keberadaan menu
// target dilakukan di Phase 4 saat order di-submit (decrement engine).

import { z } from 'zod';
import { StockType } from '@prisma/client';

// ============================================================
// SubOptions
// ============================================================

/// Varian "linked": menu turunan yang ber-stok mengikuti menu lain.
/// Contoh: "1 Ekor Ayam Bakar Kecap" berbagi stok dengan "1 Ekor Ayam Bakar Merah".
export const linkedSubOptionsSchema = z.object({
  stockTarget: z.string().min(1, 'stockTarget tidak boleh kosong'),
});

/// Varian "paket": menu nonStock dengan pilihan dinamis customer.
/// options[].options adalah array string pilihan; stockMap memetakan kombinasi
/// pilihan (dijoin "|" sesuai urutan options[]) ke nama menu stok porsi target.
export const paketSubOptionsSchema = z.object({
  description: z.string().optional(),
  options: z
    .array(
      z.object({
        key: z.string().min(1),
        label: z.string().min(1),
        options: z.array(z.string().min(1)).min(1, 'Minimal 1 pilihan per group'),
      }),
    )
    .min(1, 'Minimal 1 group sub-option untuk paket'),
  stockMap: z.record(z.string().min(1), z.string().min(1)),
});

export const subOptionsSchema = z
  .union([linkedSubOptionsSchema, paketSubOptionsSchema])
  .nullable();

export type LinkedSubOptions = z.infer<typeof linkedSubOptionsSchema>;
export type PaketSubOptions = z.infer<typeof paketSubOptionsSchema>;
export type SubOptions = z.infer<typeof subOptionsSchema>;

// ============================================================
// CRUD Menu
// ============================================================

const nameField = z.string().trim().min(1, 'Nama menu wajib diisi').max(100);
const categoryField = z.string().trim().min(1, 'Kategori wajib diisi').max(50);
const priceField = z.number().nonnegative('Harga tidak boleh negatif');
const stockTypeField = z.nativeEnum(StockType, {
  errorMap: () => ({ message: 'stockType harus portion, linked, atau nonStock' }),
});
const minStockField = z.number().int().nonnegative().optional();
const imageUrlField = z.string().trim().max(255).nullable().optional();

export const createMenuSchema = z
  .object({
    name: nameField,
    category: categoryField,
    price: priceField,
    stockType: stockTypeField,
    minStock: minStockField,
    imageUrl: imageUrlField,
    subOptions: subOptionsSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.stockType === StockType.linked) {
      const so = data.subOptions;
      const isLinkedShape =
        so !== null && so !== undefined && 'stockTarget' in so && !('options' in so);
      if (!isLinkedShape) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['subOptions'],
          message: 'Menu linked wajib punya subOptions.stockTarget',
        });
      }
    }
    if (data.stockType === StockType.portion && (data.minStock === undefined || data.minStock < 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minStock'],
        message: 'Menu stockType=portion wajib punya minStock (>= 0)',
      });
    }
  });

export const updateMenuSchema = z
  .object({
    name: nameField.optional(),
    category: categoryField.optional(),
    price: priceField.optional(),
    stockType: stockTypeField.optional(),
    minStock: minStockField,
    imageUrl: imageUrlField,
    subOptions: subOptionsSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Minimal satu field harus diisi untuk update',
  });

export const listQuerySchema = z.object({
  activeOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v !== 'false'),
  category: z.string().trim().min(1).optional(),
  includeStock: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export type CreateMenuInput = z.infer<typeof createMenuSchema>;
export type UpdateMenuInput = z.infer<typeof updateMenuSchema>;
export type ListMenuQuery = z.infer<typeof listQuerySchema>;
