// Skema validasi input modul menu.

import { z } from 'zod';

export const createMenuSchema = z.object({
  name: z.string().min(1, 'Nama menu wajib diisi').max(100),
  category: z.string().min(1, 'Kategori wajib diisi').max(50),
  price: z.number().nonnegative('Harga tidak boleh negatif'),
  isActive: z.boolean().optional().default(true),
});

// Semua field opsional saat update.
export const updateMenuSchema = createMenuSchema.partial();

// Filter opsional untuk GET /menus.
export const listMenuQuerySchema = z.object({
  category: z.string().optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  search: z.string().optional(),
});

export type CreateMenuInput = z.infer<typeof createMenuSchema>;
export type UpdateMenuInput = z.infer<typeof updateMenuSchema>;
export type ListMenuQuery = z.infer<typeof listMenuQuerySchema>;
