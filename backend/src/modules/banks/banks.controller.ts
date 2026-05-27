// Controller modul banks. Tipis - delegate ke service.
// Konvensi proyek: asyncHandler + parseId + sendSuccess(res, data, message, statusCode).

import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { parseId } from '../../utils/parseId';
import {
  createBankSchema,
  updateBankSchema,
  listBanksQuerySchema,
} from './banks.schema';
import * as banksService from './banks.service';

export const handleList = asyncHandler(async (req: Request, res: Response) => {
  const query = listBanksQuerySchema.parse(req.query);
  const banks = await banksService.listBanks(query);
  sendSuccess(res, { banks }, 'Daftar bank');
});

export const handleDetail = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const bank = await banksService.getBankById(id);
  sendSuccess(res, { bank }, 'Detail bank');
});

export const handleCreate = asyncHandler(async (req: Request, res: Response) => {
  const input = createBankSchema.parse(req.body);
  const bank = await banksService.createBank(input);
  sendSuccess(res, { bank }, 'Bank berhasil dibuat', 201);
});

export const handleUpdate = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const input = updateBankSchema.parse(req.body);
  const bank = await banksService.updateBank(id, input);
  sendSuccess(res, { bank }, 'Bank berhasil diperbarui');
});
