// Controller modul units. Tipis - delegate ke service.
// Master satuan untuk raw materials (REV 2.5).

import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { parseId } from '../../utils/parseId';
import { createUnitSchema, updateUnitSchema } from './units.schema';
import * as unitsService from './units.service';

export const handleList = asyncHandler(async (_req: Request, res: Response) => {
  const units = await unitsService.listUnits();
  sendSuccess(res, { units }, 'Daftar unit');
});

export const handleDetail = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const unit = await unitsService.getUnitById(id);
  sendSuccess(res, { unit }, 'Detail unit');
});

export const handleCreate = asyncHandler(async (req: Request, res: Response) => {
  const input = createUnitSchema.parse(req.body);
  const unit = await unitsService.createUnit(input);
  sendSuccess(res, { unit }, 'Unit berhasil dibuat', 201);
});

export const handleUpdate = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const input = updateUnitSchema.parse(req.body);
  const unit = await unitsService.updateUnit(id, input);
  sendSuccess(res, { unit }, 'Unit berhasil diperbarui');
});

export const handleDelete = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const deleted = await unitsService.deleteUnit(id);
  sendSuccess(res, { deleted }, 'Unit berhasil dihapus');
});
