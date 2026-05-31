// Zod schema modul settings. REV 2.6: singleton app settings (PB1 toggle + rate).
// REV 2.7: tambah shift window fields (timezone + 3 HH:MM) + validasi format + urutan.
// Hanya owner yang boleh update (gate di routes). taxRate persen 0-100.

import { z } from 'zod';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format jam harus HH:MM');

export const updateSettingsSchema = z
  .object({
    taxEnabled: z.boolean().optional(),
    taxRate: z
      .number()
      .min(0, 'Tarif pajak minimal 0%')
      .max(100, 'Tarif pajak maksimal 100%')
      .optional(),
    // REV 2.12: PB1 2-sumbu + identitas resto + aturan operasional stok.
    taxChargedToCustomer: z.boolean().optional(),
    restaurantName: z.string().trim().min(1).max(120).optional(),
    restaurantAddress: z.string().trim().max(255).nullable().optional(),
    openingHours: z.string().trim().max(64).nullable().optional(),
    restaurantPhone: z.string().trim().max(32).nullable().optional(),
    restaurantLogoUrl: z.string().trim().max(255).nullable().optional(),
    restockMultiple: z.number().int().min(1).max(100).optional(),
    lowStockThreshold: z.number().int().min(0).max(1000).optional(),
    timezone: z.string().min(1).optional(),
    shiftPagiStart: hhmm.optional(),
    shiftChangeover: hhmm.optional(),
    shiftMalamEnd: hhmm.optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'Minimal satu field harus diisi untuk update',
  })
  .refine(
    (d) => {
      if (d.shiftPagiStart && d.shiftChangeover) {
        const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
        return toMin(d.shiftPagiStart) < toMin(d.shiftChangeover);
      }
      return true;
    },
    { message: 'Jam mulai pagi harus sebelum jam pergantian' },
  );

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
