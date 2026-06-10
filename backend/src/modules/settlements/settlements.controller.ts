// Controller modul settlements. Tipis - delegate ke service.

import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { parseId } from '../../utils/parseId';
import { unauthorized } from '../../utils/errors';
import {
  createSettlementSchema,
  listSettlementsQuerySchema,
  previewQuerySchema,
} from './settlements.schema';
import * as settlementsService from './settlements.service';

export const handlePreview = asyncHandler(async (req: Request, res: Response) => {
  const { date } = previewQuerySchema.parse(req.query);
  // UTC-midnight match shift.date storage (whole business day).
  const preview = await settlementsService.previewSettlement(
    new Date(date + 'T00:00:00.000Z'),
  );
  sendSuccess(res, { preview }, 'Preview settlement');
});

export const handleCreate = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  const input = createSettlementSchema.parse(req.body);
  const settlement = await settlementsService.createSettlement(
    req.user.id,
    req.user.role,
    input,
  );
  sendSuccess(res, { settlement }, 'Settlement berhasil dibuat', 201);
});

export const handleList = asyncHandler(async (req: Request, res: Response) => {
  const query = listSettlementsQuerySchema.parse(req.query);
  const settlements = await settlementsService.listSettlements(query);
  sendSuccess(res, { settlements }, 'Daftar settlement');
});

export const handleDetail = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const settlement = await settlementsService.getSettlementById(id);
  sendSuccess(res, { settlement }, 'Detail settlement');
});

export const handleReview = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  const id = parseId(req.params.id);
  const settlement = await settlementsService.reviewSettlement(id, req.user.id);
  sendSuccess(res, { settlement }, 'Settlement di-review');
});

export const handleDelete = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const result = await settlementsService.deleteSettlement(id);
  sendSuccess(res, result, 'Setoran dihapus');
});
