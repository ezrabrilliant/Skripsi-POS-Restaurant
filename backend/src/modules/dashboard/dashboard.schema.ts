// Zod schema untuk modul dashboard. 3 endpoint untuk 3 role:
//   - /owner   : laporan finansial periode (today/month/year/custom)
//   - /cashier : ringkasan hari ini (sesuai matrix "kasir laporan hari ini saja")
//   - /waiter  : ringkasan stok porsi + raw material reminders

import { z } from 'zod';

export const ownerReportQuerySchema = z
  .object({
    period: z.enum(['today', 'month', 'year', 'custom']).default('today'),
    /// Format YYYY-MM-DD (untuk period='today' atau anchor period='custom')
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    /// Format YYYY-MM (untuk period='month')
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    /// Format YYYY (untuk period='year')
    year: z.string().regex(/^\d{4}$/).optional(),
    /// untuk period='custom'
    fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.period === 'custom' && (!data.fromDate || !data.toDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'period=custom wajib menyertakan fromDate dan toDate',
      });
    }
  });

export type OwnerReportQuery = z.infer<typeof ownerReportQuerySchema>;
