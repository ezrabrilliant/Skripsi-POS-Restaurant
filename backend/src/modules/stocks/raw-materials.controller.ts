// Controller modul stocks/raw-materials. Tipis - delegate ke service.

import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { parseId } from '../../utils/parseId';
import { unauthorized } from '../../utils/errors';
import {
  createRawMaterialSchema,
  updateRawMaterialSchema,
  opnameSchema,
  markHabisBodySchema,
  listRawMaterialsQuerySchema,
} from './raw-materials.schema';
import * as rmService from './raw-materials.service';

export const handleList = asyncHandler(async (req: Request, res: Response) => {
  const query = listRawMaterialsQuerySchema.parse(req.query);
  const rawMaterials = await rmService.listRawMaterials(query);
  sendSuccess(res, { rawMaterials }, 'Daftar raw materials');
});

export const handleDetail = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const rawMaterial = await rmService.getRawMaterialDetail(id, limit);
  sendSuccess(res, { rawMaterial }, 'Detail raw material');
});

export const handleCreate = asyncHandler(async (req: Request, res: Response) => {
  const input = createRawMaterialSchema.parse(req.body);
  const rawMaterial = await rmService.createRawMaterial(input);
  sendSuccess(res, { rawMaterial }, 'Raw material berhasil dibuat', 201);
});

export const handleUpdate = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  const id = parseId(req.params.id);
  const input = updateRawMaterialSchema.parse(req.body);
  const rawMaterial = await rmService.updateRawMaterial(id, req.user.id, input);
  sendSuccess(res, { rawMaterial }, 'Raw material berhasil diperbarui');
});

export const handleDelete = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const deleted = await rmService.deleteRawMaterial(id);
  // REV 2.5.2: mode menentukan toast UI (hard = "dihapus permanen", soft = "dinonaktifkan").
  const message =
    deleted.mode === 'hard'
      ? `Raw material "${deleted.name}" dihapus permanen`
      : `Raw material "${deleted.name}" dinonaktifkan (history dipertahankan)`;
  sendSuccess(res, { deleted }, message);
});

export const handleReactivate = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  const id = parseId(req.params.id);
  const rawMaterial = await rmService.reactivateRawMaterial(id);
  sendSuccess(res, { rawMaterial }, 'Raw material diaktifkan kembali');
});

export const handleOpname = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  const input = opnameSchema.parse(req.body);
  const rawMaterials = await rmService.opname(req.user.id, input);
  sendSuccess(res, { rawMaterials }, 'Opname berhasil');
});

export const handleMarkHabis = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  const id = parseId(req.params.id);
  const input = markHabisBodySchema.parse(req.body ?? {});
  const rawMaterial = await rmService.markHabis(id, req.user.id, input);
  sendSuccess(res, { rawMaterial }, 'Raw material ditandai habis');
});
