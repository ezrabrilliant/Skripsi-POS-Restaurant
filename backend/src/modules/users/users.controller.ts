// Controller modul manajemen pengguna.

import type { Request, Response } from 'express';
import { createUserSchema, updateUserSchema } from './users.schema';
import * as userService from './users.service';
import { sendSuccess } from '../../utils/response';
import { parseId } from '../../utils/parseId';

/** GET /api/users — daftar pengguna. */
export async function list(_req: Request, res: Response): Promise<void> {
  const data = await userService.listUsers();
  sendSuccess(res, data, 'Daftar pengguna');
}

/** GET /api/users/:id — detail pengguna. */
export async function show(req: Request, res: Response): Promise<void> {
  const data = await userService.getUserById(parseId(req.params.id, 'ID pengguna'));
  sendSuccess(res, data, 'Detail pengguna');
}

/** POST /api/users — tambah pengguna. */
export async function create(req: Request, res: Response): Promise<void> {
  const input = createUserSchema.parse(req.body);
  const data = await userService.createUser(input);
  sendSuccess(res, data, 'Pengguna berhasil ditambahkan', 201);
}

/** PUT /api/users/:id — ubah pengguna. */
export async function update(req: Request, res: Response): Promise<void> {
  const input = updateUserSchema.parse(req.body);
  const data = await userService.updateUser(parseId(req.params.id, 'ID pengguna'), input);
  sendSuccess(res, data, 'Pengguna berhasil diperbarui');
}

/** DELETE /api/users/:id — hapus pengguna. */
export async function remove(req: Request, res: Response): Promise<void> {
  await userService.deleteUser(parseId(req.params.id, 'ID pengguna'), req.user!.id);
  sendSuccess(res, null, 'Pengguna berhasil dihapus');
}
