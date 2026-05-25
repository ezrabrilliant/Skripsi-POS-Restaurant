// Controller modul stocks/portion. Tipis - parse input, delegate ke service.

import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { parseId } from '../../utils/parseId';
import { unauthorized } from '../../utils/errors';
import {
  restockMorningSchema,
  emergencyInSchema,
  opnameSchema,
  markHabisBodySchema,
  listPortionQuerySchema,
} from './portion.schema';
import * as portionService from './portion.service';

export const handleList = asyncHandler(async (req: Request, res: Response) => {
  const query = listPortionQuerySchema.parse(req.query);
  const stocks = await portionService.listPortionStocks(query);
  sendSuccess(res, { stocks }, 'Daftar stok porsi');
});

export const handleDetail = asyncHandler(async (req: Request, res: Response) => {
  const menuId = parseId(req.params.menuId, 'menuId');
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const stock = await portionService.getPortionStockDetail(menuId, limit);
  sendSuccess(res, { stock }, 'Detail stok porsi');
});

export const handleRestockMorning = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  const input = restockMorningSchema.parse(req.body);
  const stocks = await portionService.restockMorning(req.user.id, input);
  sendSuccess(res, { stocks }, 'Restock pagi berhasil');
});

export const handleEmergencyIn = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  const input = emergencyInSchema.parse(req.body);
  const stock = await portionService.emergencyIn(req.user.id, input);
  sendSuccess(res, { stock }, 'Barang masuk berhasil dicatat');
});

export const handleOpname = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  const input = opnameSchema.parse(req.body);
  const stocks = await portionService.opname(req.user.id, input);
  sendSuccess(res, { stocks }, 'Opname berhasil');
});

export const handleMarkHabis = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  const menuId = parseId(req.params.menuId, 'menuId');
  const input = markHabisBodySchema.parse(req.body ?? {});
  const stock = await portionService.markHabis(menuId, req.user.id, input);
  sendSuccess(res, { stock }, 'Item ditandai habis');
});
