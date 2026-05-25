// Zod schema untuk modul auth. REV 2.3: login form 2 field input nama + PIN murni.
// Tidak ada lagi pre-fetch list pegawai atau "pilih dari daftar".

import { z } from 'zod';

export const loginSchema = z.object({
  name: z
    .string({ required_error: 'Nama pengguna wajib diisi' })
    .trim()
    .min(1, 'Nama pengguna wajib diisi')
    .max(100, 'Nama pengguna maksimal 100 karakter'),
  pin: z
    .string({ required_error: 'PIN wajib diisi' })
    .regex(/^\d{6}$/, 'PIN harus 6 digit angka'),
});

export type LoginInput = z.infer<typeof loginSchema>;
