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

/// Varian "paket": menu nonStock yang terdiri dari kombinasi item tetap +
/// slot pilihan customer.
///
/// - `fixedItems`: nama menu yang SELALU termasuk dalam paket (mis. Nasi Putih,
///   Sayur Asem). Saat order paket, masing-masing fixedItem di-decrement kalau
///   stockType-nya portion/linked; untuk nonStock cuma jadi catatan ke dapur.
/// - `choices`: slot pilihan yang HARUS dipilih customer satu opsi per slot.
///   Tiap opsi punya `label` (yang customer lihat) + `stockTarget` (nama menu
///   yang di-decrement bila opsi itu dipilih; null = informational saja).
///
/// Contoh Paket A:
///   fixedItems: ['Nasi Putih', 'Tahu Tempe Goreng', 'Sayur Asem']
///   choices: [
///     { key: 'ayam', label: 'Pilih Ayam', options: [
///       { label: 'Paha Bakar', stockTarget: 'Paha Ayam Bakar' },
///       { label: 'Paha Goreng', stockTarget: 'Paha Ayam Goreng' },
///       { label: 'Dada Bakar', stockTarget: 'Dada Ayam Bakar' },
///       { label: 'Dada Goreng', stockTarget: 'Dada Ayam Goreng' },
///     ]},
///     { key: 'minuman', label: 'Pilih Minuman', options: [
///       { label: 'Teh Tawar', stockTarget: null },
///       { label: 'Teh Manis', stockTarget: null },
///     ]},
///   ]
export const paketChoiceOptionSchema = z.object({
  label: z.string().trim().min(1),
  stockTarget: z.string().trim().min(1).nullable(),
});

export const paketChoiceSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  options: z.array(paketChoiceOptionSchema).min(1, 'Minimal 1 opsi per slot pilihan'),
});

export const paketSubOptionsSchema = z.object({
  description: z.string().optional(),
  fixedItems: z.array(z.string().trim().min(1)).default([]),
  choices: z.array(paketChoiceSchema).default([]),
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
  // includePopularity=true mengaktifkan kolom salesCount per menu (sum qty dari
  // TransactionItem yang transaksinya status=paid + bukan source merge bill).
  // Dipakai POS untuk sort by penjualan terbanyak.
  includePopularity: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export type CreateMenuInput = z.infer<typeof createMenuSchema>;
export type UpdateMenuInput = z.infer<typeof updateMenuSchema>;
export type ListMenuQuery = z.infer<typeof listQuerySchema>;
