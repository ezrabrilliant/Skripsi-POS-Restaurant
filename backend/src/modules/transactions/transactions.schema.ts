// Zod schema untuk modul transactions. REV 2.6:
//   - 2 OrderType: dineIn (wajib tableNumber 1-N) / takeaway (tableNumber null)
//   - PaymentMethod = master table (payment_methods); schema cuma format check.
//     Validasi bank (requiresBank + junction membership) pindah ke runtime di
//     service (lookup payment_methods by code).
//   - subOptionsSelected: object key→value untuk paket dinamis (lookup di stockMap)
//   - Split tender (multi-method per Tx) via addPaymentSchema
//   - Merge bill (mergedIntoId) tetap - dipakai untuk Combine Tables (REV 2.5)
//   - Split bill multi-party (partyId, splitTransaction) DROPPED - lihat spec REV 2.5

import { z } from 'zod';
import { OrderType, TransactionStatus } from '@prisma/client';

export const orderItemSchema = z.object({
  menuId: z.number().int().positive(),
  qty: z.number().int().positive('Qty minimal 1'),
  /// LEGACY (pre-REV 2.10): paket berbasis NAMA. Key = options[].key, value = pilihan
  /// customer. Dipertahankan optional untuk backward-compat data/historis.
  subOptionsSelected: z.record(z.string(), z.string()).optional(),
  /// REV 2.4: catatan per item (komunikasi customer → dapur).
  /// Mis. "kurang manis", "pedas level 2", "Panas" / "Dingin" untuk teh/jeruk.
  notes: z.string().trim().max(255).optional(),
  /// REV 2.10: varian terpilih (untuk menu kind=variant). null/undefined untuk
  /// simple + paket. Stok di-decrement ke variant.stockTargetMenuId.
  variantId: z.number().int().positive().nullable().optional(),
  /// REV 2.10: pilihan per slot paket kind=choice. Key = slot label (PaketComponent.label).
  /// targetMenuId = menu yang dipilih untuk slot itu; variantId = varian-nya kalau target
  /// adalah menu varian (POS bercabang). chosenLabel = label opsi yang dipilih (audit display).
  paketChoices: z
    .record(
      z.string(),
      z.object({
        targetMenuId: z.number().int().positive(),
        variantId: z.number().int().positive().nullable().optional(),
        chosenLabel: z.string().trim().min(1),
      }),
    )
    .optional(),
  /// REV 2.10: free-preference (grup affectsVariant=false, mis. Suhu dingin/panas).
  /// Dicatat sebagai TransactionItemSelection isPreference=true - tidak pengaruh stok/harga.
  preferences: z
    .array(z.object({ groupLabel: z.string().trim().min(1), chosenLabel: z.string().trim().min(1) }))
    .optional(),
});

/// REV 2.3 shift-decoupling: shiftId TIDAK lagi di-input frontend.
/// Backend auto-resolve dari single active shift (lihat transactions.service).
/// Kalau 0 atau 2+ active shifts, throw 409.
export const createTransactionSchema = z.object({
  orderType: z.nativeEnum(OrderType, {
    errorMap: () => ({ message: 'orderType harus dineIn atau takeaway' }),
  }),
  tableNumber: z.number().int().positive().optional(),
  items: z.array(orderItemSchema).min(1, 'Minimal 1 item per transaksi'),
});

export const addItemsSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'Minimal 1 item'),
});

/// REV 2.4: PATCH /transactions/:id/items/:itemId. Update qty atau notes (atau keduanya).
/// Setidaknya 1 field wajib disertakan. Qty harus > 0 (untuk hapus pakai DELETE endpoint).
export const updateItemSchema = z
  .object({
    qty: z.number().int().positive('Qty harus > 0 (untuk hapus pakai DELETE)').optional(),
    notes: z.string().trim().max(255).nullable().optional(),
  })
  .refine((data) => data.qty !== undefined || data.notes !== undefined, {
    message: 'Setidaknya salah satu field qty atau notes harus disertakan',
  });

/// REV 2.6: addPayment - tambah 1 payment slice.
/// Validasi format saja di sini:
///   - method: string non-empty (lowercase, max 20) - lookup di payment_methods table di service.
///   - bank: string opsional/nullable (max 50) - validasi requiresBank + junction membership di service.
///   - amount: positive number.
/// discountAmount opsional - hanya valid saat first slice (validasi di service).
export const addPaymentSchema = z.object({
  method: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Method wajib diisi')
    .max(20, 'Method maksimal 20 karakter'),
  bank: z.string().trim().max(50).nullable().optional(),
  amount: z.number().positive('Nominal harus > 0'),
  discountAmount: z.number().nonnegative().optional(),
});

export const listTransactionsQuerySchema = z.object({
  status: z.nativeEnum(TransactionStatus).optional(),
  shiftId: z.coerce.number().int().positive().optional(),
  orderType: z.nativeEnum(OrderType).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date harus YYYY-MM-DD')
    .optional(),
});

/// REV 2.4: query schema untuk GET /transactions/table/:tableNumber.
/// tableNumber di-parse dari path param (validasi terpisah di controller).
/// Body query cuma optional status filter.
export const listByTableQuerySchema = z.object({
  status: z.nativeEnum(TransactionStatus).optional(),
});

// ============================================================
// Merge Bill (REV 2.1, REV 2.5 reused untuk Combine Tables)
// ============================================================

/// POST /transactions/merge - gabungkan source transactions ke target.
/// Sources akan punya mergedIntoId=targetId. Target jadi parent yang menerima
/// payment untuk total agregat (parent.items + sum(mergedFrom.items)).
///
/// REV 2.5: dipakai untuk Add Round (intra-table) DAN Combine Tables (inter-table).
export const mergeSchema = z.object({
  sourceIds: z.array(z.number().int().positive()).min(1, 'Minimal 1 source'),
  targetId: z.number().int().positive(),
}).refine((data) => !data.sourceIds.includes(data.targetId), {
  message: 'targetId tidak boleh ada di sourceIds (target adalah parent, bukan source)',
});

export type OrderItemInput = z.infer<typeof orderItemSchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type AddItemsInput = z.infer<typeof addItemsSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type AddPaymentInput = z.infer<typeof addPaymentSchema>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
export type ListByTableQuery = z.infer<typeof listByTableQuerySchema>;
export type MergeInput = z.infer<typeof mergeSchema>;
