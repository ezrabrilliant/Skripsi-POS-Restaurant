// Controller modul dashboard. Tipis - delegate ke service.

import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { unauthorized } from '../../utils/errors';
import { ownerReportQuerySchema } from './dashboard.schema';
import * as dashboardService from './dashboard.service';

export const handleOwnerReport = asyncHandler(async (req: Request, res: Response) => {
  const query = ownerReportQuerySchema.parse(req.query);
  const report = await dashboardService.getOwnerReport(query);
  sendSuccess(res, { report }, 'Laporan owner');
});

export const handleCashierDashboard = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  const dashboard = await dashboardService.getCashierDashboard(req.user.id);
  sendSuccess(res, { dashboard }, 'Dashboard kasir');
});

export const handleWaiterDashboard = asyncHandler(async (_req: Request, res: Response) => {
  const dashboard = await dashboardService.getWaiterDashboard();
  sendSuccess(res, { dashboard }, 'Dashboard waiter');
});
