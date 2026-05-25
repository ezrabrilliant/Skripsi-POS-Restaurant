// Controller modul shifts. Tipis - delegate ke service.

import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { parseId } from '../../utils/parseId';
import { unauthorized } from '../../utils/errors';
import { openShiftSchema, listShiftsQuerySchema } from './shifts.schema';
import * as shiftsService from './shifts.service';

export const handleOpen = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  const input = openShiftSchema.parse(req.body);
  const shift = await shiftsService.openShift(req.user.id, input);
  sendSuccess(res, { shift }, 'Shift berhasil dibuka', 201);
});

export const handleClose = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  const id = parseId(req.params.id);
  const shift = await shiftsService.closeShift(id, req.user.id, req.user.role);
  sendSuccess(res, { shift }, 'Shift berhasil ditutup');
});

export const handleActive = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  const shift = await shiftsService.getActiveShift(req.user.id);
  sendSuccess(res, { shift }, shift ? 'Shift aktif ditemukan' : 'Tidak ada shift aktif');
});

export const handleDetail = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const shift = await shiftsService.getShiftById(id);
  sendSuccess(res, { shift }, 'Detail shift');
});

export const handleList = asyncHandler(async (req: Request, res: Response) => {
  const query = listShiftsQuerySchema.parse(req.query);
  const shifts = await shiftsService.listShifts(query);
  sendSuccess(res, { shifts }, 'Daftar shift');
});
