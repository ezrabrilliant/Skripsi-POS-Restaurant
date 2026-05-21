// Skema validasi input modul meja.

import { z } from 'zod';

export const transferSchema = z.object({
  toTable: z.number().int().positive('Nomor meja tujuan tidak valid'),
});

export type TransferInput = z.infer<typeof transferSchema>;
