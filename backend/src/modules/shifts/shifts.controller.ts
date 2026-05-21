// Controller modul shift.

import type { Request, Response } from 'express';
import { openShiftSchema } from './shifts.schema';
import * as shiftService from './shifts.service';
import { sendSuccess } from '../../utils/response';

/** POST /api/shifts/open — buka kasir. */
export async function open(req: Request, res: Response): Promise<void> {
  const input = openShiftSchema.parse(req.body);
  const shift = await shiftService.openShift(req.user!.id, input.openingCash);
  sendSuccess(res, shift, 'Kasir berhasil dibuka', 201);
}

/** GET /api/shifts/current — shift aktif kasir yang sedang login. */
export async function current(req: Request, res: Response): Promise<void> {
  const shift = await shiftService.getCurrentShift(req.user!.id);
  sendSuccess(res, shift, shift ? 'Shift aktif' : 'Belum ada shift terbuka');
}
