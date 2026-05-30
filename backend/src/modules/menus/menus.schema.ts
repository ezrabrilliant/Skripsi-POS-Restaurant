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
  // REV 2.10: owner/admin mode. includeHidden=true → kembalikan SEMUA menu (termasuk
  // posVisible=false, mis. SKU stok granular "Paha Ayam Bakar"). Default (POS/public)
  // hanya tampilkan posVisible=true. Catatan: posVisible filter terpisah dari activeOnly.
  includeHidden: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
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

// ============================================================
// REV 2.10 - Builder payloads (variant / paket catalog layer)
// ============================================================
//
// Menu kind=variant: punya MenuOptionGroup[] (axis varian + free-preference) +
//   MenuVariant[] (kombinasi sellable per harga eksak + stock target opsional).
// Menu kind=paket : punya PaketComponent[] (fixed item / choice slot).
//
// optionLabels di variantSchema = map { groupName -> optionLabel } yang merujuk
// HANYA grup affectsVariant=true. Grup free-preference (mis. Suhu) tidak membentuk
// varian, jadi tidak ikut di optionLabels.

export const optionSchema = z.object({
  label: z.string().trim().min(1),
  displayOrder: z.number().int().default(0),
});

export const optionGroupSchema = z.object({
  name: z.string().trim().min(1),
  affectsVariant: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
  options: z.array(optionSchema).min(1),
});

export const variantSchema = z.object({
  // optionLabels: map of group NAME -> chosen option LABEL for the variant-defining groups
  optionLabels: z.record(z.string(), z.string()).default({}),
  label: z.string().trim().min(1),
  price: z.number().nonnegative(),
  stockTargetMenuId: z.number().int().positive().nullable().default(null),
  costSourceMenuId: z.number().int().positive().nullable().default(null),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
});

export const paketComponentSchema = z.object({
  kind: z.enum(['fixed', 'choice']),
  label: z.string().trim().min(1),
  qty: z.number().int().min(1).default(1),
  displayOrder: z.number().int().default(0),
  targetMenuId: z.number().int().positive().nullable().default(null),
  targetVariantId: z.number().int().positive().nullable().default(null),
  choiceOptions: z
    .array(
      z.object({
        label: z.string().trim().min(1),
        targetMenuId: z.number().int().positive().nullable().default(null),
        targetVariantId: z.number().int().positive().nullable().default(null),
        upcharge: z.number().nonnegative().default(0),
      }),
    )
    .default([]),
});

export const menuUpsertSchema = z
  .object({
    name: z.string().trim().min(1),
    category: z.string().trim().min(1),
    price: z.number().nonnegative(),
    imageUrl: z.string().nullable().optional(),
    kind: z.enum(['simple', 'variant', 'paket']).default('simple'),
    posVisible: z.boolean().default(true),
    stockType: z.enum(['portion', 'linked', 'nonStock']).default('nonStock'),
    minStock: z.number().int().nullable().optional(),
    cost: z.number().nonnegative().nullable().optional(),
    optionGroups: z.array(optionGroupSchema).default([]),
    variants: z.array(variantSchema).default([]),
    paketComponents: z.array(paketComponentSchema).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.kind === 'variant' && data.variants.length === 0)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['variants'],
        message: 'Menu varian wajib punya minimal 1 varian',
      });
    if (data.kind === 'paket' && data.paketComponents.length === 0)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['paketComponents'],
        message: 'Paket wajib punya minimal 1 komponen',
      });
    if (data.kind !== 'variant' && data.variants.length > 0)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['variants'],
        message: 'Hanya menu kind=variant boleh punya varian',
      });
  });

export type MenuUpsertInput = z.infer<typeof menuUpsertSchema>;
