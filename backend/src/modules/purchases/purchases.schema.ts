// Zod schema untuk modul purchases. REV 2.1/2.2: normalized header + items.
// REV 2.5: bifurcate per unit.opname_mode:
//   - exact mode    : qty + unitPrice wajib (subtotal auto = qty * unitPrice di server)
//   - scale_0_5 mode: subtotal wajib (total harga), qty + unitPrice opsional, note recommended
//
//   - vendorId opsional (kasir kadang lupa nama penjual di pasar)
//   - qty + unitPrice + subtotal di item: number (akan dikonversi Decimal di service)
//   - expiredDate opsional (untuk perishable)
//   - note opsional (mis. "1 karung beras 50kg" untuk scale items)
//   - totalAmount header dihitung server dari sum(subtotal items), tidak dari client

import { z } from 'zod';

const idField = z.number().int().positive();
const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date harus YYYY-MM-DD');

export const purchaseItemSchema = z
  .object({
    rawMaterialId: idField,
    qty: z.number().positive('Qty harus > 0').nullable().optional(),
    unitPrice: z.number().nonnegative('unitPrice tidak boleh negatif').nullable().optional(),
    subtotal: z.number().positive('subtotal harus > 0').nullable().optional(),
    note: z.string().trim().max(255).nullable().optional(),
    expiredDate: dateField.optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const hasSubtotal = data.subtotal !== null && data.subtotal !== undefined;
    const hasQtyAndPrice =
      data.qty !== null &&
      data.qty !== undefined &&
      data.unitPrice !== null &&
      data.unitPrice !== undefined;

    if (!hasSubtotal && !hasQtyAndPrice) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Wajib salah satu: subtotal (untuk skala mode) atau qty + unitPrice (untuk exact mode)',
        path: ['subtotal'],
      });
    }
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
