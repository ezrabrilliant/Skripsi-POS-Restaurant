// Controller auth: menjembatani HTTP request dengan auth.service.

import type { Request, Response } from 'express';
import { loginSchema, verifyPinSchema } from './auth.schema';
import * as authService from './auth.service';
import { sendSuccess } from '../../utils/response';
import { unauthorized } from '../../utils/errors';

/** POST /api/auth/login — login dengan PIN, mengembalikan token JWT. */
export async function login(req: Request, res: Response): Promise<void> {
  const { pin } = loginSchema.parse(req.body);
  const result = await authService.login(pin);
  sendSuccess(res, result, 'Login berhasil');
}

/** POST /api/auth/logout — JWT bersifat stateless, token cukup dihapus di sisi klien. */
export async function logout(_req: Request, res: Response): Promise<void> {
  sendSuccess(res, null, 'Logout berhasil');
}

/** GET /api/auth/me — data user yang sedang login. */
export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) throw unauthorized();
  const user = await authService.getUserById(req.user.id);
  sendSuccess(res, user, 'Data pengguna');
}

/** POST /api/auth/verify-pin — verifikasi PIN untuk elevasi otorisasi. */
export async function verifyPin(req: Request, res: Response): Promise<void> {
  const { pin } = verifyPinSchema.parse(req.body);
  const user = await authService.verifyPin(pin);
  sendSuccess(res, user, 'PIN valid');
}
