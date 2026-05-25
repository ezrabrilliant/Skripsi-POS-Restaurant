// Zod schema untuk modul users. REV 2.3:
//   - PIN boleh duplikat antar pegawai (drop unique validation di service).
//   - 3 role: owner / cashier / waiter (kitchen sudah dihapus).

import { z } from 'zod';
import { UserRole } from '@prisma/client';

const nameField = z
  .string()
  .trim()
  .min(1, 'Nama wajib diisi')
  .max(100, 'Nama maksimal 100 karakter');

const pinField = z
  .string()
  .regex(/^\d{6}$/, 'PIN harus 6 digit angka');

const roleField = z.nativeEnum(UserRole, {
  errorMap: () => ({ message: 'Role harus owner, cashier, atau waiter' }),
});

export const createUserSchema = z.object({
  name: nameField,
  pin: pinField,
  role: roleField,
});

export const updateUserSchema = z
  .object({
    name: nameField.optional(),
    pin: pinField.optional(),
    role: roleField.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Minimal satu field harus diisi untuk update',
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
