// Controller modul transactions. Tipis - parse input dengan Zod, delegate ke service.

import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { parseId } from '../../utils/parseId';
import { unauthorized } from '../../utils/errors';
import {
  createTransactionSchema,
  addItemsSchema,
  paymentSchema,
  listTransactionsQuerySchema,
  splitSchema,
  mergeSchema,
} from './transactions.schema';
import * as transactionsService from './transactions.service';

export const handleCreate = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  const input = createTransactionSchema.parse(req.body);
  const transaction = await transactionsService.createTransaction(req.user.id, input);
  sendSuccess(res, { transaction }, 'Transaksi berhasil dibuat', 201);
});

export const handleAddItems = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  const id = parseId(req.params.id);
  const input = addItemsSchema.parse(req.body);
  const transaction = await transactionsService.addItems(id, req.user.id, input);
  sendSuccess(res, { transaction }, 'Item berhasil ditambahkan');
});

export const handlePayment = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const input = paymentSchema.parse(req.body);
  const transaction = await transactionsService.payTransaction(id, input);
  sendSuccess(res, { transaction }, 'Pembayaran berhasil');
});

export const handleVoid = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  const id = parseId(req.params.id);
  const transaction = await transactionsService.voidTransaction(id, req.user.id);
  sendSuccess(res, { transaction }, 'Transaksi berhasil dibatalkan');
});

export const handleDetail = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const transaction = await transactionsService.getTransactionById(id);
  sendSuccess(res, { transaction }, 'Detail transaksi');
});

export const handleList = asyncHandler(async (req: Request, res: Response) => {
  const query = listTransactionsQuerySchema.parse(req.query);
  const transactions = await transactionsService.listTransactions(query);
  sendSuccess(res, { transactions }, 'Daftar transaksi');
});

// ============================================================
// REV 2.3 Phase 4b — Split + Merge
// ============================================================

export const handleSplit = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const input = splitSchema.parse(req.body);
  const transaction = await transactionsService.splitTransaction(id, input);
  sendSuccess(res, { transaction }, 'Split bill berhasil');
});

export const handleMerge = asyncHandler(async (req: Request, res: Response) => {
  const input = mergeSchema.parse(req.body);
  const transaction = await transactionsService.mergeBills(input);
  sendSuccess(res, { transaction }, 'Merge bill berhasil');
});
