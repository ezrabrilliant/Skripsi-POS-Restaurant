// Controller modul settlement.

import type { Request, Response } from 'express';
import { createSettlementSchema, listSettlementQuerySchema } from './settlements.schema';
import * as settlementService from './settlements.service';
import { sendSuccess } from '../../utils/response';
import { parseId } from '../../utils/parseId';

/** GET /api/settlements/preview — cek kesiapan tutup kasir (blind, tanpa total sistem). */
export async function preview(req: Request, res: Response): Promise<void> {
  const data = await settlementService.previewSettlement(req.user!.id);
  sendSuccess(res, data, 'Pratinjau tutup kasir');
}

/** POST /api/settlements — submit blind count & tutup shift. */
export async function create(req: Request, res: Response): Promise<void> {
  const input = createSettlementSchema.parse(req.body);
  const data = await settlementService.createSettlement(req.user!.id, input);
  sendSuccess(res, data, 'Rekonsiliasi tersimpan, kasir ditutup', 201);
}

/** GET /api/settlements — daftar settlement. */
export async function list(req: Request, res: Response): Promise<void> {
  const filter = listSettlementQuerySchema.parse(req.query);
  const data = await settlementService.listSettlements(filter);
  sendSuccess(res, data, 'Daftar settlement');
}

/** GET /api/settlements/:id — detail settlement. */
export async function show(req: Request, res: Response): Promise<void> {
  const data = await settlementService.getSettlement(parseId(req.params.id, 'ID settlement'));
  sendSuccess(res, data, 'Detail settlement');
}

/** POST /api/settlements/:id/review — owner menandai settlement sudah diperiksa. */
export async function review(req: Request, res: Response): Promise<void> {
  const data = await settlementService.reviewSettlement(
    parseId(req.params.id, 'ID settlement'),
    req.user!.id,
  );
  sendSuccess(res, data, 'Settlement berhasil direview');
}
