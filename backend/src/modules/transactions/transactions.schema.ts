// Zod schema untuk modul transactions. REV 2.2:
//   - 2 OrderType: dineIn (wajib tableNumber 1-N) / takeaway (tableNumber null)
//   - 6 PaymentMethod; paymentBank wajib untuk edc/transfer, dilarang untuk lainnya
//   - subOptionsSelected: object key→value untuk paket dinamis (lookup di stockMap)
//   - Split bill (partyId) dan merge bill (mergedIntoId) DEFERRED ke Phase 4b

import { z } from 'zod';
import { OrderType, PaymentMethod, TransactionStatus } from '@prisma/client';

export const orderItemSchema = z.object({
  menuId: z.number().int().positive(),
  qty: z.number().int().positive('Qty minimal 1'),
  /// Untuk paket dengan subOptions. Key = options[].key, value = pilihan customer (harus ada di options[].options).
  subOptionsSelected: z.record(z.string(), z.string()).optional(),
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

export const paymentSchema = z
  .object({
    paymentMethod: z.nativeEnum(PaymentMethod, {
      errorMap: () => ({ message: 'paymentMethod tidak valid' }),
    }),
    paymentBank: z.string().trim().min(1).max(50).optional(),
    discountAmount: z.number().nonnegative().default(0),
  })
  .superRefine((data, ctx) => {
    const needsBank =
      data.paymentMethod === PaymentMethod.edc || data.paymentMethod === PaymentMethod.transfer;
    if (needsBank && !data.paymentBank) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['paymentBank'],
        message: `paymentBank wajib untuk metode ${data.paymentMethod}`,
      });
    }
    if (!needsBank && data.paymentBank) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['paymentBank'],
        message: `paymentBank hanya berlaku untuk metode edc atau transfer`,
      });
    }
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

// ============================================================
// REV 2.3 Phase 4b — Split + Merge
// ============================================================

/// PUT /transactions/:id/split — assign partyId per item.
/// partyId null = bagian "main" (default). Integer >= 1 = party terpisah.
/// Items tidak disebut di assignments → biarkan partyId existing (no change).
export const splitAssignmentSchema = z.object({
  itemId: z.number().int().positive(),
  partyId: z.number().int().positive().nullable(),
});

export const splitSchema = z.object({
  assignments: z.array(splitAssignmentSchema).min(1, 'Minimal 1 assignment'),
});

/// POST /transactions/merge — gabungkan source transactions ke target.
/// Sources akan punya mergedIntoId=targetId. Target jadi parent yang menerima
/// payment untuk total agregat (parent.items + sum(mergedFrom.items)).
export const mergeSchema = z.object({
  sourceIds: z.array(z.number().int().positive()).min(1, 'Minimal 1 source'),
  targetId: z.number().int().positive(),
}).refine((data) => !data.sourceIds.includes(data.targetId), {
  message: 'targetId tidak boleh ada di sourceIds (target adalah parent, bukan source)',
});

export type OrderItemInput = z.infer<typeof orderItemSchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type AddItemsInput = z.infer<typeof addItemsSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
export type SplitInput = z.infer<typeof splitSchema>;
export type MergeInput = z.infer<typeof mergeSchema>;
