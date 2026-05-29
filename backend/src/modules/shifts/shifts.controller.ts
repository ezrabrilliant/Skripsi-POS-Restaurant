// Controller modul shifts. Tipis - delegate ke service.

import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { parseId } from '../../utils/parseId';
import { unauthorized } from '../../utils/errors';
import { openShiftSchema, closeShiftSchema, listShiftsQuerySchema } from './shifts.schema';
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
  const { mode } = closeShiftSchema.parse(req.body ?? {});
  const shift = await shiftsService.closeShift(id, req.user.id, req.user.role, mode);
  sendSuccess(res, { shift }, 'Shift berhasil ditutup');
});

// REV 2.3 shift-decoupling: return SEMUA shift aktif system-wide.
// REV 2.5 multi-cashier sharing: 2 shift beda tipe (pagi+malam transition) = valid.
// Message adaptive: warning anomaly hanya kalau tipe duplikat (post-REV 2.5
// constraint, shouldn't happen tapi defensive).
export const handleActive = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  const shifts = await shiftsService.getActiveShifts();
  const types = new Set(shifts.map((s) => s.type));
  const hasDuplicateType = types.size < shifts.length;
  const message =
    shifts.length === 0
      ? 'Tidak ada shift aktif'
      : shifts.length === 1
        ? 'Satu shift aktif'
        : hasDuplicateType
          ? `Anomaly: ${shifts.length} shift aktif dengan tipe duplikat`
          : `${shifts.length} shift aktif (transisi normal)`;
  sendSuccess(res, { shifts }, message);
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
