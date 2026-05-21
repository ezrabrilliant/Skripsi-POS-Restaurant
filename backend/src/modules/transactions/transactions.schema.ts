// Skema validasi input modul transaksi.

import { z } from 'zod';

export const createTransactionSchema = z.object({
  tableNumber: z.number().int().positive('Nomor meja tidak valid'),
});

// Satu baris item pesanan.
const itemInput = z.object({
  menuId: z.number().int().positive('menuId tidak valid'),
  qty: z.number().int().positive('Jumlah minimal 1'),
  forceOrder: z.boolean().optional().default(false),
});

export const addItemSchema = itemInput;

export const updateItemSchema = z.object({
  qty: z.number().int().positive('Jumlah minimal 1'),
  forceOrder: z.boolean().optional().default(false),
});

// Sinkronisasi seluruh isi keranjang sekaligus.
export const syncItemsSchema = z.object({
  items: z.array(itemInput),
});

export const paySchema = z.object({
  paymentMethod: z.enum(['cash', 'qris', 'transfer', 'debit', 'credit', 'ojol']),
  discountAmount: z.number().nonnegative('Diskon tidak boleh negatif').optional().default(0),
});

export const voidSchema = z.object({
  ownerPin: z
    .string()
    .length(6, 'PIN harus 6 digit')
    .regex(/^\d{6}$/, 'PIN hanya boleh berisi angka'),
});

// Filter untuk riwayat transaksi.
export const historyQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
    .optional(),
  status: z.enum(['paid', 'void']).optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type AddItemInput = z.infer<typeof addItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type SyncItemsInput = z.infer<typeof syncItemsSchema>;
export type PayInput = z.infer<typeof paySchema>;
