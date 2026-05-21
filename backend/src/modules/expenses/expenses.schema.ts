// Skema validasi input modul pengeluaran.

import { z } from 'zod';

const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD');
const monthField = z.string().regex(/^\d{4}-\d{2}$/, 'Format bulan harus YYYY-MM');
const categoryField = z.enum(['ingredients', 'utilities', 'salary', 'transport', 'other']);

export const createExpenseSchema = z.object({
  date: dateField,
  category: categoryField,
  amount: z.number().positive('Jumlah pengeluaran harus lebih dari 0'),
  description: z.string().min(1, 'Deskripsi wajib diisi').max(255),
  notes: z.string().max(1000).optional(),
});

export const updateExpenseSchema = z
  .object({
    date: dateField.optional(),
    category: categoryField.optional(),
    amount: z.number().positive().optional(),
    description: z.string().min(1).max(255).optional(),
    notes: z.string().max(1000).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Minimal satu field harus diisi' });

export const listExpenseQuerySchema = z.object({
  date: dateField.optional(),
  month: monthField.optional(),
  category: categoryField.optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ListExpenseQuery = z.infer<typeof listExpenseQuerySchema>;
