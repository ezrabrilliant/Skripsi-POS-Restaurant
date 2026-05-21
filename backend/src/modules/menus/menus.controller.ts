// Controller modul menu.

import type { Request, Response } from 'express';
import { createMenuSchema, updateMenuSchema, listMenuQuerySchema } from './menus.schema';
import * as menuService from './menus.service';
import { sendSuccess } from '../../utils/response';
import { parseId } from '../../utils/parseId';

/** GET /api/menus — daftar menu (publik). */
export async function list(req: Request, res: Response): Promise<void> {
  const query = listMenuQuerySchema.parse(req.query);
  const menus = await menuService.listMenus(query);
  sendSuccess(res, menus, 'Daftar menu');
}

/** GET /api/menus/categories — daftar kategori unik (publik). */
export async function categories(_req: Request, res: Response): Promise<void> {
  const list = await menuService.getCategories();
  sendSuccess(res, list, 'Daftar kategori menu');
}

/** GET /api/menus/:id — detail menu (publik). */
export async function show(req: Request, res: Response): Promise<void> {
  const menu = await menuService.getMenuById(parseId(req.params.id, 'ID menu'));
  sendSuccess(res, menu, 'Detail menu');
}

/** POST /api/menus — tambah menu (owner). */
export async function create(req: Request, res: Response): Promise<void> {
  const input = createMenuSchema.parse(req.body);
  const menu = await menuService.createMenu(input);
  sendSuccess(res, menu, 'Menu berhasil ditambahkan', 201);
}

/** PUT /api/menus/:id — ubah menu (owner). */
export async function update(req: Request, res: Response): Promise<void> {
  const input = updateMenuSchema.parse(req.body);
  const menu = await menuService.updateMenu(parseId(req.params.id, 'ID menu'), input);
  sendSuccess(res, menu, 'Menu berhasil diperbarui');
}

/** DELETE /api/menus/:id — hapus menu (owner). */
export async function remove(req: Request, res: Response): Promise<void> {
  await menuService.deleteMenu(parseId(req.params.id, 'ID menu'));
  sendSuccess(res, null, 'Menu berhasil dihapus');
}
