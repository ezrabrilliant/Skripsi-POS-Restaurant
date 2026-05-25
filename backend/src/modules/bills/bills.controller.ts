// Controller modul bills. Tipis - delegate ke service.

import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { parseId } from '../../utils/parseId';
import { unauthorized } from '../../utils/errors';
import {
  createBillSchema,
  updateBillSchema,
  listBillsQuerySchema,
} from './bills.schema';
import * as billsService from './bills.service';

export const handleList = asyncHandler(async (req: Request, res: Response) => {
  const query = listBillsQuerySchema.parse(req.query);
  const bills = await billsService.listBills(query);
  sendSuccess(res, { bills }, 'Daftar tagihan');
});

export const handleDetail = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const bill = await billsService.getBillById(id);
  sendSuccess(res, { bill }, 'Detail tagihan');
});

export const handleCreate = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  const input = createBillSchema.parse(req.body);
  const bill = await billsService.createBill(req.user.id, input);
  sendSuccess(res, { bill }, 'Tagihan berhasil dicatat', 201);
});

export const handleUpdate = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const input = updateBillSchema.parse(req.body);
  const bill = await billsService.updateBill(id, input);
  sendSuccess(res, { bill }, 'Tagihan berhasil diperbarui');
});

export const handleDelete = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const deleted = await billsService.deleteBill(id);
  sendSuccess(res, { deleted }, 'Tagihan berhasil dihapus');
});
