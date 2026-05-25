// Controller modul vendors. Tipis - delegate ke service.

import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { parseId } from '../../utils/parseId';
import {
  createVendorSchema,
  updateVendorSchema,
  listVendorsQuerySchema,
} from './vendors.schema';
import * as vendorsService from './vendors.service';

export const handleList = asyncHandler(async (req: Request, res: Response) => {
  const query = listVendorsQuerySchema.parse(req.query);
  const vendors = await vendorsService.listVendors(query);
  sendSuccess(res, { vendors }, 'Daftar vendor');
});

export const handleDetail = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const vendor = await vendorsService.getVendorById(id);
  sendSuccess(res, { vendor }, 'Detail vendor');
});

export const handleCreate = asyncHandler(async (req: Request, res: Response) => {
  const input = createVendorSchema.parse(req.body);
  const vendor = await vendorsService.createVendor(input);
  sendSuccess(res, { vendor }, 'Vendor berhasil dibuat', 201);
});

export const handleUpdate = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const input = updateVendorSchema.parse(req.body);
  const vendor = await vendorsService.updateVendor(id, input);
  sendSuccess(res, { vendor }, 'Vendor berhasil diperbarui');
});

export const handleDelete = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const deleted = await vendorsService.deleteVendor(id);
  sendSuccess(res, { deleted }, 'Vendor berhasil dihapus');
});
