// Controller modul menus. Tipis - parse query/body dengan Zod, delegasi ke service.

import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { parseId } from '../../utils/parseId';
import {
  createMenuSchema,
  updateMenuSchema,
  listQuerySchema,
} from './menus.schema';
import * as menusService from './menus.service';

export const handleList = asyncHandler(async (req: Request, res: Response) => {
  const query = listQuerySchema.parse(req.query);
  const menus = await menusService.listMenus(query);
  sendSuccess(res, { menus }, 'Daftar menu');
});

export const handleDetail = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const menu = await menusService.getMenuById(id);
  sendSuccess(res, { menu }, 'Detail menu');
});

export const handleCreate = asyncHandler(async (req: Request, res: Response) => {
  const input = createMenuSchema.parse(req.body);
  const menu = await menusService.createMenu(input);
  sendSuccess(res, { menu }, 'Menu berhasil dibuat', 201);
});

export const handleUpdate = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const input = updateMenuSchema.parse(req.body);
  const menu = await menusService.updateMenu(id, input);
  sendSuccess(res, { menu }, 'Menu berhasil diperbarui');
});

export const handleDeactivate = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const menu = await menusService.deactivateMenu(id);
  sendSuccess(res, { menu }, 'Menu berhasil dinonaktifkan');
});

export const handleReactivate = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const menu = await menusService.reactivateMenu(id);
  sendSuccess(res, { menu }, 'Menu berhasil diaktifkan kembali');
});
