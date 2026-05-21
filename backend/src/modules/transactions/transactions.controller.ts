// Controller modul transaksi.

import type { Request, Response } from 'express';
import {
  createTransactionSchema,
  addItemSchema,
  updateItemSchema,
  syncItemsSchema,
  paySchema,
  voidSchema,
  historyQuerySchema,
} from './transactions.schema';
import * as txService from './transactions.service';
import { sendSuccess } from '../../utils/response';
import { parseId } from '../../utils/parseId';

/** GET /api/transactions — daftar transaksi terbuka. */
export async function listOpen(_req: Request, res: Response): Promise<void> {
  const data = await txService.listOpenTransactions();
  sendSuccess(res, data, 'Daftar transaksi terbuka');
}

/** GET /api/transactions/history — riwayat transaksi lunas/batal. */
export async function history(req: Request, res: Response): Promise<void> {
  const filter = historyQuerySchema.parse(req.query);
  const data = await txService.getHistory(filter);
  sendSuccess(res, data, 'Riwayat transaksi');
}

/** GET /api/transactions/daily-summary — ringkasan penjualan harian. */
export async function dailySummary(req: Request, res: Response): Promise<void> {
  const date = typeof req.query.date === 'string' ? req.query.date : undefined;
  const data = await txService.getDailySummary(date);
  sendSuccess(res, data, 'Ringkasan penjualan harian');
}

/** POST /api/transactions — buka transaksi baru untuk sebuah meja. */
export async function create(req: Request, res: Response): Promise<void> {
  const input = createTransactionSchema.parse(req.body);
  const data = await txService.createTransaction(req.user!.id, input.tableNumber);
  sendSuccess(res, data, 'Transaksi dibuka', 201);
}

/** GET /api/transactions/:id — detail transaksi. */
export async function show(req: Request, res: Response): Promise<void> {
  const data = await txService.getTransaction(parseId(req.params.id, 'ID transaksi'));
  sendSuccess(res, data, 'Detail transaksi');
}

/** POST /api/transactions/:id/items — tambah item. */
export async function addItem(req: Request, res: Response): Promise<void> {
  const input = addItemSchema.parse(req.body);
  const data = await txService.addItem(parseId(req.params.id, 'ID transaksi'), input);
  sendSuccess(res, data, 'Item ditambahkan');
}

/** PUT /api/transactions/:id/items — sinkronkan seluruh keranjang. */
export async function syncItems(req: Request, res: Response): Promise<void> {
  const input = syncItemsSchema.parse(req.body);
  const data = await txService.syncItems(parseId(req.params.id, 'ID transaksi'), input);
  sendSuccess(res, data, 'Keranjang disinkronkan');
}

/** PUT /api/transactions/:id/items/:itemId — ubah jumlah item. */
export async function updateItem(req: Request, res: Response): Promise<void> {
  const input = updateItemSchema.parse(req.body);
  const data = await txService.updateItem(
    parseId(req.params.id, 'ID transaksi'),
    parseId(req.params.itemId, 'ID item'),
    input,
  );
  sendSuccess(res, data, 'Item diperbarui');
}

/** DELETE /api/transactions/:id/items/:itemId — hapus item. */
export async function removeItem(req: Request, res: Response): Promise<void> {
  const data = await txService.removeItem(
    parseId(req.params.id, 'ID transaksi'),
    parseId(req.params.itemId, 'ID item'),
  );
  sendSuccess(res, data, 'Item dihapus');
}

/** POST /api/transactions/:id/pay — proses pembayaran. */
export async function pay(req: Request, res: Response): Promise<void> {
  const input = paySchema.parse(req.body);
  const data = await txService.payTransaction(parseId(req.params.id, 'ID transaksi'), input);
  sendSuccess(res, data, 'Pembayaran berhasil');
}

/** POST /api/transactions/:id/void — batalkan transaksi (butuh PIN owner). */
export async function voidTx(req: Request, res: Response): Promise<void> {
  const input = voidSchema.parse(req.body);
  const data = await txService.voidTransaction(
    parseId(req.params.id, 'ID transaksi'),
    input.ownerPin,
  );
  sendSuccess(res, data, 'Transaksi dibatalkan');
}
