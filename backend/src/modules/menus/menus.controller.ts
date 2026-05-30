// Controller modul menus. Tipis - parse query/body dengan Zod, delegasi ke service.

import type { Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { parseId } from '../../utils/parseId';
import { unauthorized } from '../../utils/errors';
import { menuUpsertSchema, listQuerySchema } from './menus.schema';
import * as menusService from './menus.service';

export const handleList = asyncHandler(async (req: Request, res: Response) => {
  const query = listQuerySchema.parse(req.query);
  // REV 2.11: cost (modal) hanya disertakan untuk owner-authenticated request.
  const includeCost = req.user?.role === UserRole.owner;
  const menus = await menusService.listMenus(query, includeCost);
  sendSuccess(res, { menus }, 'Daftar menu');
});

export const handleDetail = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const includeCost = req.user?.role === UserRole.owner;
  const menu = await menusService.getMenuDetail(id, includeCost);
  sendSuccess(res, { menu }, 'Detail menu');
});

export const handleCreate = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  const input = menuUpsertSchema.parse(req.body);
  const menu = await menusService.upsertMenu(null, input, req.user.id);
  sendSuccess(res, { menu }, 'Menu berhasil dibuat', 201);
});

export const handleUpdate = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  const id = parseId(req.params.id);
  const input = menuUpsertSchema.parse(req.body);
  const menu = await menusService.upsertMenu(id, input, req.user.id);
  sendSuccess(res, { menu }, 'Menu berhasil diperbarui');
});

export const handleCostHistory = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const movements = await menusService.getCostHistory(id);
  sendSuccess(res, { movements }, 'Riwayat modal menu');
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
