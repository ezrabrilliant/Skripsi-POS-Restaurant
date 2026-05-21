// Controller modul meja.

import type { Request, Response } from 'express';
import { transferSchema } from './tables.schema';
import * as tableService from './tables.service';
import { sendSuccess } from '../../utils/response';
import { parseId } from '../../utils/parseId';

/** GET /api/tables — daftar meja beserta status. */
export async function list(_req: Request, res: Response): Promise<void> {
  const data = await tableService.listTables();
  sendSuccess(res, data, 'Daftar meja');
}

/** GET /api/tables/:tableNumber/transaction — transaksi terbuka pada meja. */
export async function openTransaction(req: Request, res: Response): Promise<void> {
  const tableNumber = parseId(req.params.tableNumber, 'Nomor meja');
  const data = await tableService.getOpenTransaction(tableNumber);
  sendSuccess(res, data, data ? 'Transaksi meja' : 'Meja kosong');
}

/** POST /api/tables/:fromTable/transfer — pindahkan pesanan ke meja lain. */
export async function transfer(req: Request, res: Response): Promise<void> {
  const fromTable = parseId(req.params.fromTable, 'Nomor meja asal');
  const input = transferSchema.parse(req.body);
  const data = await tableService.transferTransaction(fromTable, input.toTable);
  sendSuccess(res, data, `Pesanan dipindahkan ke meja ${input.toTable}`);
}
