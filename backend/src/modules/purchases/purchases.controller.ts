// Controller modul purchases. Tipis - delegate ke service.

import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { parseId } from '../../utils/parseId';
import { unauthorized } from '../../utils/errors';
import {
  createPurchaseSchema,
  listPurchasesQuerySchema,
} from './purchases.schema';
import * as purchasesService from './purchases.service';

export const handleList = asyncHandler(async (req: Request, res: Response) => {
  const query = listPurchasesQuerySchema.parse(req.query);
  const purchases = await purchasesService.listPurchases(query);
  sendSuccess(res, { purchases }, 'Daftar pembelian');
});

export const handleDetail = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const purchase = await purchasesService.getPurchaseById(id);
  sendSuccess(res, { purchase }, 'Detail pembelian');
});

export const handleCreate = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  const input = createPurchaseSchema.parse(req.body);
  const purchase = await purchasesService.createPurchase(req.user.id, input);
  sendSuccess(res, { purchase }, 'Pembelian berhasil dicatat', 201);
});
