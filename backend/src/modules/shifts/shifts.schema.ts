// Skema validasi input modul shift (buka kasir).

import { z } from 'zod';

export const openShiftSchema = z.object({
  openingCash: z.number().nonnegative('Modal awal tidak boleh negatif'),
});

export type OpenShiftInput = z.infer<typeof openShiftSchema>;
