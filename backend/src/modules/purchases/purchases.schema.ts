// Zod schema untuk modul purchases. REV 2.1/2.2: normalized header + items.
//   - vendorId opsional (kasir kadang lupa nama penjual di pasar)
//   - qty + unitPrice di item: number (akan dikonversi Decimal di service)
//   - expiredDate opsional (untuk perishable)
//   - totalAmount dihitung server dari sum(qty * unitPrice), tidak dari client

import { z } from 'zod';

const idField = z.number().int().positive();
const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date harus YYYY-MM-DD');

export const purchaseItemSchema = z.object({
  rawMaterialId: idField,
  qty: z.number().positive('Qty harus > 0'),
  unitPrice: z.number().nonnegative('unitPrice tidak boleh negatif'),
  expiredDate: dateField.optional().nullable(),
});

export const createPurchaseSchema = z.object({
  date: dateField,
  vendorId: idField.optional().nullable(),
  note: z.string().trim().max(255).optional().nullable(),
  items: z.array(purchaseItemSchema).min(1, 'Minimal 1 item pembelian'),
});

export const listPurchasesQuerySchema = z.object({
  date: dateField.optional(),
  vendorId: z.coerce.number().int().positive().optional(),
  /// Format YYYY-MM untuk filter bulan
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Format month harus YYYY-MM').optional(),
});

export type PurchaseItemInput = z.infer<typeof purchaseItemSchema>;
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type ListPurchasesQuery = z.infer<typeof listPurchasesQuerySchema>;
