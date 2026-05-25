// Controller modul users. Tipis - validasi via Zod, delegasi ke service,
// kirim response via sendSuccess.

import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { parseId } from '../../utils/parseId';
import { createUserSchema, updateUserSchema } from './users.schema';
import * as usersService from './users.service';

export const handleList = asyncHandler(async (_req: Request, res: Response) => {
  const users = await usersService.listUsers();
  sendSuccess(res, { users }, 'Daftar pegawai');
});

export const handleDetail = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const user = await usersService.getUserById(id);
  sendSuccess(res, { user }, 'Detail pegawai');
});

export const handleCreate = asyncHandler(async (req: Request, res: Response) => {
  const input = createUserSchema.parse(req.body);
  const user = await usersService.createUser(input);
  sendSuccess(res, { user }, 'Pegawai berhasil dibuat', 201);
});

export const handleUpdate = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const input = updateUserSchema.parse(req.body);
  const user = await usersService.updateUser(id, input);
  sendSuccess(res, { user }, 'Pegawai berhasil diperbarui');
});

export const handleDeactivate = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const user = await usersService.deactivateUser(id);
  sendSuccess(res, { user }, 'Pegawai berhasil dinonaktifkan');
});
