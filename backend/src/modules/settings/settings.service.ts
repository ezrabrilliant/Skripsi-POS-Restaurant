// Service modul settings. REV 2.6: singleton AppSetting (id=1) untuk kontrol PB1.
// getSettings auto-create kalau row belum ada (defensive, walau seed sudah insert).
// taxRate disimpan Decimal di DB, di-expose number ke API.
// REV 2.7: tambah shift window fields (timezone + 3 HH:MM) + getShiftWindow().

import { prisma } from '../../config/prisma';
import type { UpdateSettingsInput } from './settings.schema';
import { parseHHMM, type ShiftWindowSettings } from '../shifts/shift-time';

export interface SettingView {
  taxEnabled: boolean;
  taxRate: number; // persen
  // REV 2.12
  taxChargedToCustomer: boolean;
  restaurantName: string;
  restaurantAddress: string | null;
  openingHours: string | null;
  restaurantPhone: string | null;
  restaurantLogoUrl: string | null;
  restockMultiple: number;
  lowStockThreshold: number;
  updatedAt: string;
  updatedById: number | null;
  timezone: string;
  shiftPagiStart: string;
  shiftChangeover: string;
  shiftMalamEnd: string;
}

type AppSettingRow = {
  taxEnabled: boolean;
  taxRate: { toNumber: () => number };
  taxChargedToCustomer: boolean;
  restaurantName: string;
  restaurantAddress: string | null;
  openingHours: string | null;
  restaurantPhone: string | null;
  restaurantLogoUrl: string | null;
  restockMultiple: number;
  lowStockThreshold: number;
  updatedAt: Date;
  updatedById: number | null;
  timezone: string;
  shiftPagiStart: string;
  shiftChangeover: string;
  shiftMalamEnd: string;
};

function toView(s: AppSettingRow): SettingView {
  return {
    taxEnabled: s.taxEnabled,
    taxRate: s.taxRate.toNumber(),
    taxChargedToCustomer: s.taxChargedToCustomer,
    restaurantName: s.restaurantName,
    restaurantAddress: s.restaurantAddress,
    openingHours: s.openingHours,
    restaurantPhone: s.restaurantPhone,
    restaurantLogoUrl: s.restaurantLogoUrl,
    restockMultiple: s.restockMultiple,
    lowStockThreshold: s.lowStockThreshold,
    updatedAt: s.updatedAt.toISOString(),
    updatedById: s.updatedById,
    timezone: s.timezone,
    shiftPagiStart: s.shiftPagiStart,
    shiftChangeover: s.shiftChangeover,
    shiftMalamEnd: s.shiftMalamEnd,
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

export async function getShiftWindow(): Promise<ShiftWindowSettings> {
  const s = await getSettings();
  return {
    timezone: s.timezone,
    pagiStart: parseHHMM(s.shiftPagiStart),
    changeover: parseHHMM(s.shiftChangeover),
    malamEnd: parseHHMM(s.shiftMalamEnd),
  };
}
