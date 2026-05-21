// Controller modul pengeluaran.

import type { Request, Response } from 'express';
import {
  createExpenseSchema,
  updateExpenseSchema,
  listExpenseQuerySchema,
} from './expenses.schema';
import * as expenseService from './expenses.service';
import { sendSuccess } from '../../utils/response';
import { parseId } from '../../utils/parseId';

/** GET /api/expenses — daftar pengeluaran (filter date/month/category). */
export async function list(req: Request, res: Response): Promise<void> {
  const query = listExpenseQuerySchema.parse(req.query);
  const data = await expenseService.listExpenses(query);
  sendSuccess(res, data, 'Daftar pengeluaran');
}

/** GET /api/expenses/:id — detail pengeluaran. */
export async function show(req: Request, res: Response): Promise<void> {
  const data = await expenseService.getExpenseById(parseId(req.params.id, 'ID pengeluaran'));
  sendSuccess(res, data, 'Detail pengeluaran');
}

/** POST /api/expenses — catat pengeluaran baru. */
export async function create(req: Request, res: Response): Promise<void> {
  const input = createExpenseSchema.parse(req.body);
  const data = await expenseService.createExpense(req.user!.id, input);
  sendSuccess(res, data, 'Pengeluaran berhasil dicatat', 201);
}

/** PUT /api/expenses/:id — ubah pengeluaran. */
export async function update(req: Request, res: Response): Promise<void> {
  const input = updateExpenseSchema.parse(req.body);
  const data = await expenseService.updateExpense(parseId(req.params.id, 'ID pengeluaran'), input);
  sendSuccess(res, data, 'Pengeluaran berhasil diperbarui');
}

/** DELETE /api/expenses/:id — hapus pengeluaran. */
export async function remove(req: Request, res: Response): Promise<void> {
  await expenseService.deleteExpense(parseId(req.params.id, 'ID pengeluaran'));
  sendSuccess(res, null, 'Pengeluaran berhasil dihapus');
}
