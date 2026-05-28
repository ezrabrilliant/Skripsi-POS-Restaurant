// Zod schema untuk modul payment-methods. REV 2.6: owner-configurable master.
// Drop enum PaymentMethod (Phase 9). Code immutable setelah create.

import { z } from 'zod';

// 8 icon preset dari lucide-react yang dipakai di project
const ALLOWED_ICONS = [
  'Banknote',
  'CreditCard',
  'QrCode',
  'Bike',
  'Truck',
  'ArrowLeftRight',
  'Wallet',
  'Smartphone',
] as const;

const codeField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Code wajib diisi')
  .max(20, 'Code maksimal 20 karakter')
  .regex(/^[a-z][a-z0-9_]*$/, 'Code harus lowercase alphanum_underscore, mulai huruf');

const labelField = z.string().trim().min(1, 'Label wajib diisi').max(50);

const colorHexField = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Color hex harus format #RRGGBB')
  .transform((v) => v.toLowerCase());

const iconNameField = z.enum(ALLOWED_ICONS);

export const createPaymentMethodSchema = z.object({
  code: codeField,
  label: labelField,
  colorHex: colorHexField,
  iconName: iconNameField,
  requiresBank: z.boolean().default(false),
  allowDineIn: z.boolean().default(true),
  allowTakeaway: z.boolean().default(true),
  displayOrder: z.number().int().min(0).default(0),
  bankIds: z.array(z.number().int().positive()).default([]),
});

export const updatePaymentMethodSchema = z
  .object({
    label: labelField.optional(),
    colorHex: colorHexField.optional(),
    iconName: iconNameField.optional(),
    requiresBank: z.boolean().optional(),
    allowDineIn: z.boolean().optional(),
    allowTakeaway: z.boolean().optional(),
    displayOrder: z.number().int().min(0).optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Minimal satu field harus diisi untuk update',
  });

export const togglePaymentMethodSchema = z.object({
  isActive: z.boolean(),
});

export const reorderPaymentMethodsSchema = z.object({
  ordered: z
    .array(z.object({ id: z.number().int().positive(), displayOrder: z.number().int().min(0) }))
    .min(1),
});

export const listPaymentMethodsQuerySchema = z.object({
  includeInactive: z.coerce.boolean().optional().default(false),
});

export type CreatePaymentMethodInput = z.infer<typeof createPaymentMethodSchema>;
export type UpdatePaymentMethodInput = z.infer<typeof updatePaymentMethodSchema>;
export type TogglePaymentMethodInput = z.infer<typeof togglePaymentMethodSchema>;
export type ReorderPaymentMethodsInput = z.infer<typeof reorderPaymentMethodsSchema>;
export type ListPaymentMethodsQuery = z.infer<typeof listPaymentMethodsQuerySchema>;

export { ALLOWED_ICONS };
