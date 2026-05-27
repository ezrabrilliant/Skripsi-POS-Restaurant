// Controller modul payment-methods. Tipis - delegate ke service.
// Konvensi proyek: asyncHandler + parseId + sendSuccess(res, data, message, statusCode).

import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { parseId } from '../../utils/parseId';
import {
  createPaymentMethodSchema,
  updatePaymentMethodSchema,
  togglePaymentMethodSchema,
  reorderPaymentMethodsSchema,
  listPaymentMethodsQuerySchema,
} from './payment-methods.schema';
import * as paymentMethodsService from './payment-methods.service';

export const handleList = asyncHandler(async (req: Request, res: Response) => {
  const query = listPaymentMethodsQuerySchema.parse(req.query);
  const paymentMethods = await paymentMethodsService.listPaymentMethods(query);
  sendSuccess(res, { paymentMethods }, 'Daftar payment method');
});

export const handleDetail = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const paymentMethod = await paymentMethodsService.getPaymentMethodById(id);
  sendSuccess(res, { paymentMethod }, 'Detail payment method');
});

export const handleCreate = asyncHandler(async (req: Request, res: Response) => {
  const input = createPaymentMethodSchema.parse(req.body);
  const paymentMethod = await paymentMethodsService.createPaymentMethod(input);
  sendSuccess(res, { paymentMethod }, 'Payment method berhasil dibuat', 201);
});

export const handleUpdate = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const input = updatePaymentMethodSchema.parse(req.body);
  const paymentMethod = await paymentMethodsService.updatePaymentMethod(id, input);
  sendSuccess(res, { paymentMethod }, 'Payment method berhasil diperbarui');
});

export const handleToggleActive = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const input = togglePaymentMethodSchema.parse(req.body);
  const paymentMethod = await paymentMethodsService.togglePaymentMethodActive(id, input);
  sendSuccess(res, { paymentMethod }, 'Status payment method diperbarui');
});

export const handleAssignBank = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const bankId = parseId(req.params.bankId, 'Bank ID');
  const paymentMethod = await paymentMethodsService.assignBank(id, bankId);
  sendSuccess(res, { paymentMethod }, 'Bank di-assign ke payment method');
});

export const handleUnassignBank = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const bankId = parseId(req.params.bankId, 'Bank ID');
  const paymentMethod = await paymentMethodsService.unassignBank(id, bankId);
  sendSuccess(res, { paymentMethod }, 'Bank di-unassign dari payment method');
});

export const handleReorder = asyncHandler(async (req: Request, res: Response) => {
  const input = reorderPaymentMethodsSchema.parse(req.body);
  const paymentMethods = await paymentMethodsService.reorderPaymentMethods(input);
  sendSuccess(res, { paymentMethods }, 'Urutan payment method diperbarui');
});
