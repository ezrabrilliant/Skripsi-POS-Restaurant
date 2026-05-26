// Service modul stocks/raw-materials. REV 2.2:
//   - CRUD master (owner-only di route layer): tambah/edit/hapus raw material.
//   - View + opname + mark-habis: semua role (owner+kasir+waiter) per matrix REV 2.3.
//   - Audit log via raw_material_movements reason=opname/manualAdjust.
//   - Reminder flags di view: isLowStock + isNearExpiry untuk dashboard alerting.
//
// Catatan: raw_material_movements reason=purchase di-insert oleh modul `purchases`
// (Phase 7), bukan di sini. Modul ini hanya mencatat opname dan manual adjust.
//
// Delete: hard delete via prisma.rawMaterial.delete. Akan gagal otomatis kalau
// ada purchase_items atau raw_material_movements yang merefer (FK protection),
// dan kita translasi ke pesan ramah.

import { Prisma, RawMaterialMovementReason, RawMaterialCategory } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError, notFound } from '../../utils/errors';
import type {
  CreateRawMaterialInput,
  UpdateRawMaterialInput,
  OpnameInput,
  MarkHabisInput,
  ListRawMaterialsQuery,
} from './raw-materials.schema';

// ============================================================
// View shape (mapper)
// ============================================================

export interface RawMaterialView {
  id: number;
  name: string;
  unit: string;
  category: RawMaterialCategory;
  isTracked: boolean;
  stockQty: number;
  minStock: number | null;
  unitPrice: number | null;
  freshnessDays: number | null;
  lastBuyDate: string | null; // YYYY-MM-DD
  isLowStock: boolean; // isTracked AND stockQty <= minStock
  isNearExpiry: boolean; // isTracked AND freshnessDays set AND (today - lastBuy) >= (freshnessDays - 3)
  daysUntilExpiry: number | null; // freshnessDays - daysSinceLastBuy (null kalau tidak tracked freshness)
  suggestedAction: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RawMaterialMovementView {
  id: number;
  delta: number;
  reason: RawMaterialMovementReason;
  note: string | null;
  userId: number;
  createdAt: string;
}

type RawMaterialRow = Prisma.RawMaterialGetPayload<{}>;

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function toRawMaterialView(rm: RawMaterialRow): RawMaterialView {
  const stockQty = rm.stockQty.toNumber();
  const minStock = rm.minStock;
  const lastBuyDate = rm.lastBuyDate;
  const freshnessDays = rm.freshnessDays;

  const isLowStock =
    rm.isTracked && minStock !== null && stockQty <= minStock;

  let isNearExpiry = false;
  let daysUntilExpiry: number | null = null;
  if (rm.isTracked && freshnessDays !== null && lastBuyDate !== null) {
    const daysSinceBuy = daysBetween(lastBuyDate, new Date());
    daysUntilExpiry = freshnessDays - daysSinceBuy;
    isNearExpiry = daysUntilExpiry <= 3;
  }

  let suggestedAction: string | null = null;
  if (isLowStock) suggestedAction = 'Perlu restock';
  else if (isNearExpiry && daysUntilExpiry !== null && daysUntilExpiry <= 0) {
    suggestedAction = 'Sudah lewat freshness, beli baru';
  } else if (isNearExpiry) {
    suggestedAction = `Mendekati basi (${daysUntilExpiry} hari lagi), beli baru`;
  }

  return {
    id: rm.id,
    name: rm.name,
    unit: rm.unit,
    category: rm.category,
    isTracked: rm.isTracked,
    stockQty,
    minStock,
    unitPrice: rm.unitPrice ? rm.unitPrice.toNumber() : null,
    freshnessDays,
    lastBuyDate: lastBuyDate ? lastBuyDate.toISOString().substring(0, 10) : null,
    isLowStock,
    isNearExpiry,
    daysUntilExpiry,
    suggestedAction,
    createdAt: rm.createdAt.toISOString(),
    updatedAt: rm.updatedAt.toISOString(),
  };
}

// ============================================================
// Read operations
// ============================================================

export async function listRawMaterials(query: ListRawMaterialsQuery): Promise<RawMaterialView[]> {
  const where: Prisma.RawMaterialWhereInput = {};
  if (query.category) where.category = query.category;
  if (query.isTracked !== undefined) where.isTracked = query.isTracked;

  const rms = await prisma.rawMaterial.findMany({
    where,
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });

  let views = rms.map(toRawMaterialView);
  if (query.needsRestock) {
    views = views.filter((v) => v.isLowStock || v.isNearExpiry);
  }
  return views;
}

export interface RawMaterialDetail extends RawMaterialView {
  recentMovements: RawMaterialMovementView[];
}

export async function getRawMaterialDetail(
  id: number,
  movementsLimit = 20,
): Promise<RawMaterialDetail> {
  const rm = await prisma.rawMaterial.findUnique({ where: { id } });
  if (!rm) throw notFound('RawMaterial');

  const movements = await prisma.rawMaterialMovement.findMany({
    where: { rawMaterialId: id },
    orderBy: { createdAt: 'desc' },
    take: movementsLimit,
  });

  return {
    ...toRawMaterialView(rm),
    recentMovements: movements.map((m) => ({
      id: m.id,
      delta: m.delta.toNumber(),
      reason: m.reason,
      note: m.note,
      userId: m.userId,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

// ============================================================
// Write operations
// ============================================================

export async function createRawMaterial(input: CreateRawMaterialInput): Promise<RawMaterialView> {
  // Tolak nama duplikat exact-match. MySQL default collation utf8mb4_unicode_ci
  // sebenarnya sudah case-insensitive di level DB query, jadi exact match cukup
  // untuk menangkap "Cabai Rawit" vs "cabai rawit".
  const existing = await prisma.rawMaterial.findFirst({ where: { name: input.name } });
  if (existing) {
    throw new AppError(`Raw material "${input.name}" sudah ada`, 409);
  }

  const created = await prisma.rawMaterial.create({
    data: {
      name: input.name,
      unit: input.unit,
      category: input.category,
      isTracked: input.isTracked,
      stockQty: new Prisma.Decimal(input.stockQty),
      minStock: input.minStock ?? null,
      unitPrice: input.unitPrice !== null && input.unitPrice !== undefined ? new Prisma.Decimal(input.unitPrice) : null,
      freshnessDays: input.freshnessDays ?? null,
    },
  });
  return toRawMaterialView(created);
}

export async function updateRawMaterial(
  id: number,
  input: UpdateRawMaterialInput,
): Promise<RawMaterialView> {
  const existing = await prisma.rawMaterial.findUnique({ where: { id } });
  if (!existing) throw notFound('RawMaterial');

  const data: Prisma.RawMaterialUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.unit !== undefined) data.unit = input.unit;
  if (input.category !== undefined) data.category = input.category;
  if (input.isTracked !== undefined) data.isTracked = input.isTracked;
  if (input.minStock !== undefined) data.minStock = input.minStock;
  if (input.unitPrice !== undefined) {
    data.unitPrice = input.unitPrice === null ? null : new Prisma.Decimal(input.unitPrice);
  }
  if (input.freshnessDays !== undefined) data.freshnessDays = input.freshnessDays;

  const updated = await prisma.rawMaterial.update({ where: { id }, data });
  return toRawMaterialView(updated);
}

export async function deleteRawMaterial(id: number): Promise<{ id: number; name: string }> {
  const existing = await prisma.rawMaterial.findUnique({ where: { id } });
  if (!existing) throw notFound('RawMaterial');

  // Cek FK references sebelum delete supaya pesan error ramah
  const [pItemCount, movementCount] = await Promise.all([
    prisma.purchaseItem.count({ where: { rawMaterialId: id } }),
    prisma.rawMaterialMovement.count({ where: { rawMaterialId: id } }),
  ]);
  if (pItemCount > 0 || movementCount > 0) {
    throw new AppError(
      `Raw material "${existing.name}" tidak bisa dihapus - sudah punya ${pItemCount} purchase item dan ${movementCount} audit log. Edit/nonaktifkan saja.`,
      409,
    );
  }

  await prisma.rawMaterial.delete({ where: { id } });
  return { id: existing.id, name: existing.name };
}

export async function opname(userId: number, input: OpnameInput): Promise<RawMaterialView[]> {
  return prisma.$transaction(async (tx) => {
    const results: RawMaterialView[] = [];
    for (const item of input.items) {
      const rm = await tx.rawMaterial.findUnique({ where: { id: item.rawMaterialId } });
      if (!rm) {
        throw new AppError(`RawMaterial id=${item.rawMaterialId} tidak ditemukan`, 400);
      }
      const newQty = new Prisma.Decimal(item.qtyFisik);
      const selisih = newQty.sub(rm.stockQty);
      if (!selisih.isZero()) {
        await tx.rawMaterial.update({
          where: { id: item.rawMaterialId },
          data: { stockQty: newQty },
        });
        const sign = selisih.greaterThan(0) ? '+' : '';
        const prefix = input.note ?? 'Opname';
        await tx.rawMaterialMovement.create({
          data: {
            rawMaterialId: item.rawMaterialId,
            delta: selisih,
            reason: RawMaterialMovementReason.opname,
            note: `${prefix}: selisih ${sign}${selisih.toString()} (sistem ${rm.stockQty.toString()} → fisik ${newQty.toString()})`,
            userId,
          },
        });
      }
      const updated = await tx.rawMaterial.findUniqueOrThrow({ where: { id: item.rawMaterialId } });
      results.push(toRawMaterialView(updated));
    }
    return results;
  });
}

export async function markHabis(
  id: number,
  userId: number,
  input: MarkHabisInput,
): Promise<RawMaterialView> {
  const rm = await prisma.rawMaterial.findUnique({ where: { id } });
  if (!rm) throw notFound('RawMaterial');

  if (rm.stockQty.isZero()) {
    return toRawMaterialView(rm); // idempotent
  }

  const delta = rm.stockQty.neg();
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.rawMaterial.update({
      where: { id },
      data: { stockQty: new Prisma.Decimal(0) },
    });
    await tx.rawMaterialMovement.create({
      data: {
        rawMaterialId: id,
        delta,
        reason: RawMaterialMovementReason.manualAdjust,
        note: input.note ?? `Mark habis: dari ${rm.stockQty.toString()} ${rm.unit} ke 0 (${rm.name})`,
        userId,
      },
    });
    return u;
  });
  return toRawMaterialView(updated);
}
