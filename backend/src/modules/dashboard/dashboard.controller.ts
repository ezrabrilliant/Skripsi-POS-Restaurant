// Controller modul dashboard.

import type { Request, Response } from 'express';
import { z } from 'zod';
import * as dashboardService from './dashboard.service';
import { sendSuccess } from '../../utils/response';

const dailyQuery = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
    .optional(),
});

const monthlyQuery = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Format bulan harus YYYY-MM'),
});

/** GET /api/dashboard/daily?date=YYYY-MM-DD — ringkasan harian. */
export async function daily(req: Request, res: Response): Promise<void> {
  const { date } = dailyQuery.parse(req.query);
  const data = await dashboardService.getDailySummary(date);
  sendSuccess(res, data, 'Ringkasan harian');
}

/** GET /api/dashboard/summary?month=YYYY-MM — ringkasan bulanan. */
export async function summary(req: Request, res: Response): Promise<void> {
  const { month } = monthlyQuery.parse(req.query);
  const data = await dashboardService.getMonthlySummary(month);
  sendSuccess(res, data, 'Ringkasan bulanan');
}
