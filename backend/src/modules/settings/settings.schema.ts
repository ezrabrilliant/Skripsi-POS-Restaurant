// Zod schema modul settings. REV 2.6: singleton app settings (PB1 toggle + rate).
// Hanya owner yang boleh update (gate di routes). taxRate persen 0-100.

import { z } from 'zod';

export const updateSettingsSchema = z
  .object({
    taxEnabled: z.boolean().optional(),
    taxRate: z
      .number()
      .min(0, 'Tarif pajak minimal 0%')
      .max(100, 'Tarif pajak maksimal 100%')
      .optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Minimal satu field harus diisi untuk update',
  });

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
