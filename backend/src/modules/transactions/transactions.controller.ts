// Controller modul transactions. Tipis - parse input dengan Zod, delegate ke service.

import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { parseId } from '../../utils/parseId';
import { unauthorized } from '../../utils/errors';
import { env } from '../../config/env';
import {
  createTransactionSchema,
  addItemsSchema,
  addPaymentSchema,
  listTransactionsQuerySchema,
  listByTableQuerySchema,
  mergeSchema,
  updateItemSchema,
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

/// REV 2.4: DELETE /transactions/:id/items/:itemId - hapus single item dari Tx open.
/// Reverse stock decrement + audit log + recompute subtotal di service.
export const handleDeleteItem = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  const id = parseId(req.params.id);
  const itemId = parseId(req.params.itemId);
  const transaction = await transactionsService.deleteTransactionItem(id, itemId, req.user.id);
  sendSuccess(res, { transaction }, 'Item berhasil dihapus');
});

/// REV 2.4: PATCH /transactions/:id/items/:itemId - update qty atau notes per item.
/// Qty change adjust stock decrement secara delta; notes-only update skip stok.
export const handleUpdateItem = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  const id = parseId(req.params.id);
  const itemId = parseId(req.params.itemId);
  const input = updateItemSchema.parse(req.body);
  const transaction = await transactionsService.updateTransactionItem(id, itemId, req.user.id, input);
  sendSuccess(res, { transaction }, 'Item berhasil diupdate');
});

/// REV 2.5: POST /transactions/:id/payments - tambah 1 payment slice (Split Tender support).
/// Single tender: 1x call. Split tender: Nx call sampai sum >= total → Tx auto-paid.
export const handleAddPayment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  const id = parseId(req.params.id);
  const input = addPaymentSchema.parse(req.body);
  const transaction = await transactionsService.addPayment(id, req.user.id, input);
  const isPaid = transaction.status === 'paid';
  sendSuccess(
    res,
    { transaction },
    isPaid ? 'Pembayaran selesai' : 'Pembayaran sebagian berhasil dicatat',
    201,
  );
});

/// REV 2.5: DELETE /transactions/:id/payments/:paymentId - hapus 1 slice.
/// Hanya valid kalau Tx belum status=paid.
export const handleRemovePayment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  const id = parseId(req.params.id);
  const paymentId = parseId(req.params.paymentId);
  const transaction = await transactionsService.removePayment(id, paymentId);
  sendSuccess(res, { transaction }, 'Slice pembayaran dihapus');
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

/// REV 2.4: GET /transactions/table/:tableNumber?status=open
/// Untuk POS view-mode multi-Pesanan per meja. Path param wajib int 1-TABLE_COUNT,
/// query status optional (filter by status). Permission: semua authenticated.
export const handleListByTable = asyncHandler(async (req: Request, res: Response) => {
  const tableNumber = z
    .coerce
    .number()
    .int()
    .min(1, `tableNumber harus 1-${env.TABLE_COUNT}`)
    .max(env.TABLE_COUNT, `tableNumber harus 1-${env.TABLE_COUNT}`)
    .parse(req.params.tableNumber);
  const query = listByTableQuerySchema.parse(req.query);
  const transactions = await transactionsService.listTransactionsByTable(tableNumber, query.status);
  sendSuccess(res, { transactions }, `Pesanan aktif meja ${tableNumber}`);
});

// ============================================================
// Merge Bill (REV 2.5: reused untuk Combine Tables)
// ============================================================

export const handleMerge = asyncHandler(async (req: Request, res: Response) => {
  const input = mergeSchema.parse(req.body);
  const transaction = await transactionsService.mergeBills(input);
  sendSuccess(res, { transaction }, 'Merge bill berhasil');
});

/// REV 2.5: POST /transactions/:id/unmerge - reverse merge untuk source Tx.
/// Validate: source mergedIntoId != null AND source.status=open AND target.status=open
/// AND target.payments.length=0. Lihat unmergeBill() service untuk reasoning.
export const handleUnmerge = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  const sourceId = parseId(req.params.id);
  const transaction = await transactionsService.unmergeBill(sourceId);
  sendSuccess(res, { transaction }, 'Unmerge bill berhasil');
});
