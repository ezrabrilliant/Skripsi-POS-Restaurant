// Zod schema untuk modul purchases. REV 2.5.1: 3-kind line item:
//   A. Free-form (rawMaterialId null, label set, subtotal required) — bumbu dasar,
//      ayam mentah, item tanpa master. Tidak update stock, tidak insert movement.
//   B. Typed-scale (rawMaterialId set, label null, subtotal required, qty/unitPrice
//      opsional) — RawMaterial dengan unit.opname_mode = scale_0_5 (mis. Beras karung).
//   C. Typed-exact (rawMaterialId set, label null, qty + unitPrice required) —
//      RawMaterial dengan unit.opname_mode = exact. subtotal auto = qty * unitPrice.
//
// Constraints (validated di superRefine):
//   - Exactly one of {rawMaterialId, label} set
//   - Free-form (label set) → subtotal wajib
//   - Typed (rawMaterialId set) → wajib subtotal (scale) ATAU qty+unitPrice (exact);
//     bifurcation final ditentukan di service layer setelah lookup unit.
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
    rawMaterialId: idField.nullable().optional(),
    label: z.string().trim().min(1).max(100).nullable().optional(),
    qty: z.number().positive('Qty harus > 0').nullable().optional(),
    unitPrice: z.number().nonnegative('unitPrice tidak boleh negatif').nullable().optional(),
    subtotal: z.number().positive('subtotal harus > 0').nullable().optional(),
    note: z.string().trim().max(255).nullable().optional(),
    expiredDate: dateField.optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const hasRmId = data.rawMaterialId !== null && data.rawMaterialId !== undefined;
    const hasLabel = data.label !== null && data.label !== undefined;

    if (hasRmId && hasLabel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'rawMaterialId dan label mutually exclusive — pilih salah satu',
        path: ['label'],
      });
    }
    if (!hasRmId && !hasLabel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Wajib salah satu: rawMaterialId (typed) atau label (free-form)',
        path: ['rawMaterialId'],
      });
    }

    if (hasLabel && (data.subtotal === undefined || data.subtotal === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Free-form line item wajib subtotal',
        path: ['subtotal'],
      });
    }

    if (hasRmId) {
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
            'Typed item wajib salah satu: subtotal (skala mode) atau qty + unitPrice (exact mode)',
          path: ['subtotal'],
        });
      }
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
