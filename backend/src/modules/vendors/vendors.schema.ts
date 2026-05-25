// Zod schema untuk modul vendors. REV 2.1: vendor opsional di Purchase, phone+note
// nullable karena di pasar kadang kasir lupa nama penjual atau penjualnya
// perorangan tanpa nomor telepon.

import { z } from 'zod';

const nameField = z.string().trim().min(1, 'Nama vendor wajib diisi').max(100);
const typeField = z.string().trim().min(1, 'Type vendor wajib diisi').max(50);
const phoneField = z.string().trim().max(20).nullable().optional();
const noteField = z.string().trim().max(255).nullable().optional();

export const createVendorSchema = z.object({
  name: nameField,
  type: typeField,
  phone: phoneField,
  note: noteField,
});

export const updateVendorSchema = z
  .object({
    name: nameField.optional(),
    type: typeField.optional(),
    phone: phoneField,
    note: noteField,
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Minimal satu field harus diisi untuk update',
  });

export const listVendorsQuerySchema = z.object({
  type: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
});

export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;
export type ListVendorsQuery = z.infer<typeof listVendorsQuerySchema>;
