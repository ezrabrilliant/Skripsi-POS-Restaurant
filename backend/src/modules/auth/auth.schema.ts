// Skema validasi input untuk modul auth.

import { z } from 'zod';

// PIN: tepat 6 digit angka.
const pinField = z
  .string()
  .length(6, 'PIN harus 6 digit')
  .regex(/^\d{6}$/, 'PIN hanya boleh berisi angka');

export const loginSchema = z.object({
  pin: pinField,
});

export const verifyPinSchema = z.object({
  pin: pinField,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyPinInput = z.infer<typeof verifyPinSchema>;
