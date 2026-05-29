// Service modul stocks/raw-materials. REV 2.5:
//   - CRUD master (owner-only di route layer): tambah/edit/hapus raw material.
//   - View + opname + mark-habis: semua role (owner+kasir+waiter) per matrix REV 2.3.
//   - Audit log via raw_material_movements reason=opname/manualAdjust.
//   - Reminder flags di view: isLowStock + isNearExpiry untuk dashboard alerting.
//   - REV 2.5: unitId FK ke `units` (sebelumnya unit string bebas).
//       * View expose `unit: { id, label, opnameMode }` populated, bukan string.
//       * updateRawMaterial transactional: kalau unit berubah dan stok > 0, owner
//         wajib pass `newStockQty` untuk konversi manual. Selisih dilog ke
//         raw_material_movements reason=manualAdjust.
//       * min_stock untuk unit dengan opname_mode=scale_0_5 harus range 0..5.
//
// Catatan: raw_material_movements reason=purchase di-insert oleh modul `purchases`
// (Phase 7), bukan di sini. Modul ini hanya mencatat opname dan manual adjust.
//
// Delete (REV 2.5.2): bifurcated.
//   - No FK refs (no purchase_items + no raw_material_movements) → hard delete.
//   - FK refs exist → soft delete (set isActive=false). Preserve audit trail.
//   Owner dapat reactivate via reactivateRawMaterial.
// listRawMaterials default filter isActive=true; ?includeInactive=true tampilkan semua.

import { Prisma, RawMaterialMovementReason, RawMaterialCategory, OpnameMode } from '@prisma/client';
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
// Helpers
// ============================================================

function assertScale05(value: number, fieldName: string): void {
  if (value < 0 || value > 5) {
    throw new AppError(`${fieldName} untuk satuan skala harus 0..5`, 422);
  }
}

// ============================================================
// View shape (mapper)
// ============================================================

export interface RawMaterialView {
  id: number;
  name: string;
  /** REV 2.5.2: soft-delete flag. False = nonaktif (FK refs preserved). */
  isActive: boolean;
  unitId: number;
  unit: {
    id: number;
    label: string;
    opnameMode: OpnameMode;
  };
  category: RawMaterialCategory;
  stockQty: number;
  minStock: number | null;
  unitPrice: number | null;
  freshnessDays: number | null;
  lastBuyDate: string | null; // YYYY-MM-DD
  isLowStock: boolean; // stockQty <= minStock
  isNearExpiry: boolean; // freshnessDays set AND (today - lastBuy) >= (freshnessDays - 3)
  daysUntilExpiry: number | null; // freshnessDays - daysSinceLastBuy (null kalau tidak tracked freshness)
  suggestedAction: string | null;
  createdAt: string;
  updatedAt: string;
  // REV 2.8: timestamp movement terbaru (semua reason — raw tak punya auto-decrement penjualan).
  lastStockedAt: string | null;
}

export interface RawMaterialMovementView {
  id: number;
  delta: number;
  reason: RawMaterialMovementReason;
  qtyBefore: number | null;
  qtyAfter: number | null;
  note: string | null;
  userId: number;
  userName: string;
  // REV 2.8: tautan FK ke pembelian sumber (null untuk opname/manualAdjust).
  purchaseId: number | null;
  purchaseItemId: number | null;
  createdAt: string;
}

type RawMaterialRow = Prisma.RawMaterialGetPayload<{ include: { unit: true } }>;

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function toRawMaterialView(rm: RawMaterialRow, lastStockedAt: Date | null = null): RawMaterialView {
  const stockQty = rm.stockQty.toNumber();
  const minStock = rm.minStock;
  const lastBuyDate = rm.lastBuyDate;
  const freshnessDays = rm.freshnessDays;

  const isLowStock = minStock !== null && stockQty <= minStock;

  let isNearExpiry = false;
  let daysUntilExpiry: number | null = null;
  if (freshnessDays !== null && lastBuyDate !== null) {
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
    isActive: rm.isActive,
    unitId: rm.unitId,
    unit: {
      id: rm.unit.id,
      label: rm.unit.label,
      opnameMode: rm.unit.opnameMode,
    },
    category: rm.category,
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
    lastStockedAt: lastStockedAt ? lastStockedAt.toISOString() : null,
  };
}

// ============================================================
// Read operations
// ============================================================

export async function listRawMaterials(query: ListRawMaterialsQuery): Promise<RawMaterialView[]> {
  const where: Prisma.RawMaterialWhereInput = {};
  if (query.category) where.category = query.category;
  // REV 2.5.2: default filter isActive=true. Owner bisa toggle includeInactive=true
  // dari UI untuk lihat semua + reactivate item yang sebelumnya di-soft-delete.
  if (!query.includeInactive) where.isActive = true;

  const rms = await prisma.rawMaterial.findMany({
    where,
    include: { unit: true },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });

  // REV 2.8: "terakhir di-stok" = movement terbaru per material (semua reason).
  const lastMovs = await prisma.rawMaterialMovement.groupBy({
    by: ['rawMaterialId'],
    _max: { createdAt: true },
  });
  const lastMap = new Map<number, Date>();
  for (const g of lastMovs) {
    if (g._max.createdAt) lastMap.set(g.rawMaterialId, g._max.createdAt);
  }

  let views = rms.map((rm) => toRawMaterialView(rm, lastMap.get(rm.id) ?? null));
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
  const rm = await prisma.rawMaterial.findUnique({
    where: { id },
    include: { unit: true },
  });
  if (!rm) throw notFound('RawMaterial');

  const movements = await prisma.rawMaterialMovement.findMany({
    where: { rawMaterialId: id },
    orderBy: { createdAt: 'desc' },
    take: movementsLimit,
    include: { user: { select: { name: true } } },
  });

  const agg = await prisma.rawMaterialMovement.aggregate({
    where: { rawMaterialId: id },
    _max: { createdAt: true },
  });

  return {
    ...toRawMaterialView(rm, agg._max.createdAt ?? null),
    recentMovements: movements.map((m) => ({
      id: m.id,
      delta: m.delta.toNumber(),
      reason: m.reason,
      qtyBefore: m.qtyBefore ? m.qtyBefore.toNumber() : null,
      qtyAfter: m.qtyAfter ? m.qtyAfter.toNumber() : null,
      note: m.note,
      userId: m.userId,
      userName: m.user.name,
      purchaseId: m.purchaseId,
      purchaseItemId: m.purchaseItemId,
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

  // Validasi unit exists + ambil opname_mode untuk validate min_stock range
  const unit = await prisma.unit.findUnique({ where: { id: input.unitId } });
  if (!unit) throw new AppError(`Unit id=${input.unitId} tidak ditemukan`, 400);

  if (input.minStock !== null && input.minStock !== undefined) {
    if (unit.opnameMode === OpnameMode.scale_0_5) {
      assertScale05(input.minStock, 'min_stock');
    }
  }

  const created = await prisma.rawMaterial.create({
    data: {
      name: input.name,
      unitId: input.unitId,
      category: input.category,
      stockQty: new Prisma.Decimal(input.stockQty),
      minStock: input.minStock ?? null,
      unitPrice:
        input.unitPrice !== null && input.unitPrice !== undefined
          ? new Prisma.Decimal(input.unitPrice)
          : null,
      freshnessDays: input.freshnessDays ?? null,
    },
    include: { unit: true },
  });
  return toRawMaterialView(created);
}

export async function updateRawMaterial(
  id: number,
  userId: number,
  input: UpdateRawMaterialInput,
): Promise<RawMaterialView> {
  const existing = await prisma.rawMaterial.findUnique({
    where: { id },
    include: { unit: true },
  });
  if (!existing) throw notFound('RawMaterial');

  // Tx untuk atomicity: unit change + stock conversion + audit log harus all-or-nothing.
  return prisma.$transaction(async (tx) => {
    const data: Prisma.RawMaterialUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.category !== undefined) data.category = input.category;
    if (input.minStock !== undefined) data.minStock = input.minStock;
    if (input.unitPrice !== undefined) {
      data.unitPrice = input.unitPrice === null ? null : new Prisma.Decimal(input.unitPrice);
    }
    if (input.freshnessDays !== undefined) data.freshnessDays = input.freshnessDays;

    // Unit change handling: kalau unitId berubah dan stock_qty > 0,
    // owner WAJIB pass newStockQty (atau null untuk reset 0).
    let effectiveUnit = existing.unit;
    if (input.unitId !== undefined && input.unitId !== existing.unitId) {
      const newUnit = await tx.unit.findUnique({ where: { id: input.unitId } });
      if (!newUnit) throw new AppError(`Unit id=${input.unitId} tidak ditemukan`, 400);

      const currentStock = existing.stockQty.toNumber();
      if (currentStock > 0 && input.newStockQty === undefined) {
        throw new AppError(
          `Stok saat ini ${currentStock} ${existing.unit.label}. Wajib pass newStockQty untuk konversi ke ${newUnit.label} (atau null untuk reset 0).`,
          422,
        );
      }

      // null dan undefined keduanya treated as "reset to 0"; the undefined-guard above
      // memastikan client harus eksplisit set null kalau intent reset (vs lupa pass field).
      const targetStock = input.newStockQty ?? 0;
      if (newUnit.opnameMode === OpnameMode.scale_0_5) {
        assertScale05(targetStock, 'newStockQty');
      }

      data.unit = { connect: { id: input.unitId } };
      data.stockQty = new Prisma.Decimal(targetStock);
      effectiveUnit = newUnit;

      const delta = new Prisma.Decimal(targetStock).sub(existing.stockQty);
      if (!delta.isZero()) {
        await tx.rawMaterialMovement.create({
          data: {
            rawMaterialId: id,
            delta,
            reason: RawMaterialMovementReason.manualAdjust,
            qtyBefore: existing.stockQty,
            qtyAfter: new Prisma.Decimal(targetStock),
            note: `Unit changed: ${existing.unit.label} → ${newUnit.label}, stok ${currentStock} → ${targetStock}`,
            userId,
          },
        });
      }
    }

    // Re-validate min_stock kalau opname_mode unit efektif (lama atau baru) = scale.
    // Pakai input.minStock langsung (number | null | undefined) untuk narrowing aman,
    // bukan data.minStock yang punya Prisma union types.
    const effectiveMinStock = input.minStock !== undefined ? input.minStock : existing.minStock;
    if (effectiveMinStock !== null && effectiveUnit.opnameMode === OpnameMode.scale_0_5) {
      assertScale05(effectiveMinStock, 'min_stock');
    }

    const updated = await tx.rawMaterial.update({
      where: { id },
      data,
      include: { unit: true },
    });
    return toRawMaterialView(updated);
  });
}

/**
 * REV 2.5.2: bifurcated delete.
 * - No FK refs (purchase_items + raw_material_movements both 0) → hard delete.
 * - FK refs exist → soft delete (set isActive=false). Audit trail preserved.
 * Returns mode so UI bisa kasih toast pesan yang sesuai.
 */
export async function deleteRawMaterial(
  id: number,
): Promise<{ id: number; name: string; mode: 'hard' | 'soft' }> {
  const existing = await prisma.rawMaterial.findUnique({ where: { id } });
  if (!existing) throw notFound('RawMaterial');

  const [pItemCount, movementCount] = await Promise.all([
    prisma.purchaseItem.count({ where: { rawMaterialId: id } }),
    prisma.rawMaterialMovement.count({ where: { rawMaterialId: id } }),
  ]);

  // No FK refs → hard delete aman (tidak ada audit yang hilang).
  if (pItemCount === 0 && movementCount === 0) {
    await prisma.rawMaterial.delete({ where: { id } });
    return { id: existing.id, name: existing.name, mode: 'hard' };
  }

  // FK refs ada → soft delete (preserve audit trail).
  if (!existing.isActive) {
    throw new AppError(`Raw material "${existing.name}" sudah nonaktif.`, 409);
  }
  await prisma.rawMaterial.update({
    where: { id },
    data: { isActive: false },
  });
  return { id: existing.id, name: existing.name, mode: 'soft' };
}

/**
 * REV 2.5.2: reactivate raw material yang sebelumnya di-soft-delete.
 * Owner-only di route layer.
 */
export async function reactivateRawMaterial(id: number): Promise<RawMaterialView> {
  const existing = await prisma.rawMaterial.findUnique({
    where: { id },
    include: { unit: true },
  });
  if (!existing) throw notFound('RawMaterial');
  if (existing.isActive) {
    throw new AppError(`Raw material "${existing.name}" sudah aktif.`, 409);
  }
  const updated = await prisma.rawMaterial.update({
    where: { id },
    data: { isActive: true },
    include: { unit: true },
  });
  return toRawMaterialView(updated);
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
            qtyBefore: rm.stockQty,
            qtyAfter: newQty,
            note: `${prefix}: selisih ${sign}${selisih.toString()} (sistem ${rm.stockQty.toString()} → fisik ${newQty.toString()})`,
            userId,
          },
        });
      }
      const updated = await tx.rawMaterial.findUniqueOrThrow({
        where: { id: item.rawMaterialId },
        include: { unit: true },
      });
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
  const rm = await prisma.rawMaterial.findUnique({
    where: { id },
    include: { unit: true },
  });
  if (!rm) throw notFound('RawMaterial');

  if (rm.stockQty.isZero()) {
    return toRawMaterialView(rm); // idempotent
  }

  const delta = rm.stockQty.neg();
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.rawMaterial.update({
      where: { id },
      data: { stockQty: new Prisma.Decimal(0) },
      include: { unit: true },
    });
    await tx.rawMaterialMovement.create({
      data: {
        rawMaterialId: id,
        delta,
        reason: RawMaterialMovementReason.manualAdjust,
        qtyBefore: rm.stockQty,
        qtyAfter: new Prisma.Decimal(0),
        note: input.note ?? `Mark habis: dari ${rm.stockQty.toString()} ${rm.unit.label} ke 0 (${rm.name})`,
        userId,
      },
    });
    return u;
  });
  return toRawMaterialView(updated);
}
