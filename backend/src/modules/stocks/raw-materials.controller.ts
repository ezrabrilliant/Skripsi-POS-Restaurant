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
  const id = parseId(req.params.id);
  const input = updateRawMaterialSchema.parse(req.body);
  const rawMaterial = await rmService.updateRawMaterial(id, input);
  sendSuccess(res, { rawMaterial }, 'Raw material berhasil diperbarui');
});

export const handleDelete = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const deleted = await rmService.deleteRawMaterial(id);
  sendSuccess(res, { deleted }, 'Raw material berhasil dihapus');
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
