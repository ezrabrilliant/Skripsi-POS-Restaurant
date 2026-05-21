// Controller modul stok harian.

import type { Request, Response } from 'express';
import {
  createStockSchema,
  bulkStockSchema,
  updateStockSchema,
  dateQuerySchema,
} from './stocks.schema';
import * as stockService from './stocks.service';
import { sendSuccess } from '../../utils/response';
import { parseId } from '../../utils/parseId';

/** GET /api/stocks?date=YYYY-MM-DD — daftar stok satu tanggal (default hari ini). */
export async function list(req: Request, res: Response): Promise<void> {
  const { date } = dateQuerySchema.parse(req.query);
  const stocks = await stockService.listStocks(date);
  sendSuccess(res, stocks, 'Daftar stok harian');
}

/** GET /api/stocks/status?date=YYYY-MM-DD — cek apakah opname stok pagi sudah dilakukan. */
export async function status(req: Request, res: Response): Promise<void> {
  const { date } = dateQuerySchema.parse(req.query);
  const result = await stockService.getStockStatus(date);
  sendSuccess(res, result, 'Status opname stok');
}

/** POST /api/stocks — input satu entri stok. */
export async function create(req: Request, res: Response): Promise<void> {
  const input = createStockSchema.parse(req.body);
  const stock = await stockService.createStock(input);
  sendSuccess(res, stock, 'Stok berhasil disimpan', 201);
}

/** POST /api/stocks/bulk — input stok pagi sekaligus banyak menu. */
export async function bulkCreate(req: Request, res: Response): Promise<void> {
  const input = bulkStockSchema.parse(req.body);
  const stocks = await stockService.bulkUpsertStocks(input);
  sendSuccess(res, stocks, 'Stok pagi berhasil disimpan', 201);
}

/** PUT /api/stocks/:id — koreksi entri stok. */
export async function update(req: Request, res: Response): Promise<void> {
  const input = updateStockSchema.parse(req.body);
  const stock = await stockService.updateStock(parseId(req.params.id, 'ID stok'), input);
  sendSuccess(res, stock, 'Stok berhasil diperbarui');
}

/** POST /api/stocks/reset-today — hapus seluruh entri stok hari ini. */
export async function resetToday(_req: Request, res: Response): Promise<void> {
  const result = await stockService.resetToday();
  sendSuccess(res, result, 'Stok hari ini telah direset');
}

/** POST /api/stocks/copy-yesterday — salin stok kemarin ke hari ini. */
export async function copyYesterday(_req: Request, res: Response): Promise<void> {
  const stocks = await stockService.copyFromYesterday();
  sendSuccess(res, stocks, 'Stok kemarin berhasil disalin ke hari ini');
}
