// Controller modul auth. Tipis - validasi input via Zod, delegasi ke service,
// kirim response via helper sendSuccess.

import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { unauthorized } from '../../utils/errors';
import { loginSchema } from './auth.schema';
import * as authService from './auth.service';

export const handleLogin = asyncHandler(async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body);
  const result = await authService.login(input);
  sendSuccess(res, result, 'Login berhasil');
});

export const handleMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  const user = await authService.getCurrentUser(req.user.id);
  sendSuccess(res, { user }, 'Profil terautentikasi');
});
