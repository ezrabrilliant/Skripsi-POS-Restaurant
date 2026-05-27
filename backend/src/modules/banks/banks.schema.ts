// Zod schema untuk modul banks. REV 2.6: master bank reusable lintas payment method.
// Owner-only CRUD. Name unique case-insensitive (DB collation utf8mb4_unicode_ci).

import { z } from 'zod';

const nameField = z
  .string()
  .trim()
  .min(1, 'Nama bank wajib diisi')
  .max(50, 'Nama bank maksimal 50 karakter');

export const createBankSchema = z.object({
  name: nameField,
});

export const updateBankSchema = z
  .object({
    name: nameField.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Minimal satu field harus diisi untuk update',
  });

export const listBanksQuerySchema = z.object({
  includeInactive: z.coerce.boolean().optional().default(false),
});

export type CreateBankInput = z.infer<typeof createBankSchema>;
export type UpdateBankInput = z.infer<typeof updateBankSchema>;
export type ListBanksQuery = z.infer<typeof listBanksQuerySchema>;
