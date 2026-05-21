// Skema validasi input modul manajemen pengguna.

import { z } from 'zod';

const pinField = z
  .string()
  .length(6, 'PIN harus 6 digit')
  .regex(/^\d{6}$/, 'PIN hanya boleh berisi angka');

const roleField = z.enum(['owner', 'cashier', 'kitchen']);

export const createUserSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi').max(100),
  pin: pinField,
  role: roleField,
  isActive: z.boolean().optional().default(true),
});

export const updateUserSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    pin: pinField.optional(),
    role: roleField.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Minimal satu field harus diisi' });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
