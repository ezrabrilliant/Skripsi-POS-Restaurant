// Service modul settings. REV 2.6: singleton AppSetting (id=1) untuk kontrol PB1.
// getSettings auto-create kalau row belum ada (defensive, walau seed sudah insert).
// taxRate disimpan Decimal di DB, di-expose number ke API.

import { prisma } from '../../config/prisma';
import type { UpdateSettingsInput } from './settings.schema';

export interface SettingView {
  taxEnabled: boolean;
  taxRate: number; // persen
  updatedAt: string;
  updatedById: number | null;
}

type AppSettingRow = {
  taxEnabled: boolean;
  taxRate: { toNumber: () => number };
  updatedAt: Date;
  updatedById: number | null;
};

function toView(s: AppSettingRow): SettingView {
  return {
    taxEnabled: s.taxEnabled,
    taxRate: s.taxRate.toNumber(),
    updatedAt: s.updatedAt.toISOString(),
    updatedById: s.updatedById,
  };
}

export async function getSettings(): Promise<SettingView> {
  const existing = await prisma.appSetting.findUnique({ where: { id: 1 } });
  if (existing) return toView(existing);
  // Defensive: kalau seed belum jalan, buat default (PB1 OFF).
  const created = await prisma.appSetting.create({
    data: { id: 1, taxEnabled: false, taxRate: 10 },
  });
  return toView(created);
}

export async function updateSettings(
  userId: number,
  input: UpdateSettingsInput
): Promise<SettingView> {
  const updated = await prisma.appSetting.upsert({
    where: { id: 1 },
    update: { ...input, updatedById: userId },
    create: {
      id: 1,
      taxEnabled: input.taxEnabled ?? false,
      taxRate: input.taxRate ?? 10,
      updatedById: userId,
    },
  });
  return toView(updated);
}
