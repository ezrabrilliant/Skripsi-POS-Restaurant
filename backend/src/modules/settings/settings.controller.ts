// Controller modul settings. Tipis - delegate ke service.
// GET dibuka untuk semua role authenticated (PaymentModal butuh baca tax setting).
// PATCH gated owner-only di routes.

import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { unauthorized } from '../../utils/errors';
import { updateSettingsSchema } from './settings.schema';
import * as settingsService from './settings.service';

export const handleGet = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await settingsService.getSettings();
  sendSuccess(res, { settings }, 'Pengaturan aplikasi');
});

export const handleUpdate = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  const input = updateSettingsSchema.parse(req.body);
  const settings = await settingsService.updateSettings(req.user.id, input);
  sendSuccess(res, { settings }, 'Pengaturan berhasil diperbarui');
});
