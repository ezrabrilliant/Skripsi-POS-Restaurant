// Zod schema untuk modul bills. REV 2.3: tagihan operasional bulanan owner-only.
// 5 BillCategory: kebersihan / listrik / air / parkir / sewa.

import { z } from 'zod';
import { BillCategory } from '@prisma/client';

const monthField = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'Format month harus YYYY-MM');
const categoryField = z.nativeEnum(BillCategory, {
  errorMap: () => ({ message: 'Category harus salah satu: kebersihan/listrik/air/parkir/sewa' }),
});
const amountField = z.number().positive('Amount harus > 0');
const noteField = z.string().trim().max(255).nullable().optional();

export const createBillSchema = z.object({
  month: monthField,
  category: categoryField,
  amount: amountField,
  note: noteField,
});

export const updateBillSchema = z
  .object({
    month: monthField.optional(),
    category: categoryField.optional(),
    amount: amountField.optional(),
    note: noteField,
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Minimal satu field harus diisi untuk update',
  });

export const listBillsQuerySchema = z.object({
  month: monthField.optional(),
  /// Format YYYY untuk filter setahun penuh
  year: z.string().regex(/^\d{4}$/).optional(),
  category: categoryField.optional(),
});

export type CreateBillInput = z.infer<typeof createBillSchema>;
export type UpdateBillInput = z.infer<typeof updateBillSchema>;
export type ListBillsQuery = z.infer<typeof listBillsQuerySchema>;
