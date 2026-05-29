// Service modul stocks/portion. REV 2.2/2.3 - operasional stok porsi siap jual.
//
// Konsep utama:
//   - Auto-snapshot opening_qty_today: dipicu lazy saat list/detail dipanggil di
//     hari baru (open_qty_date < today). Single bulk UPDATE menyalin current_qty
//     ke opening_qty_today untuk semua PortionStock yang belum di-snapshot.
//   - Restock pagi: WAJIB kelipatan 5 (validasi di schema). Batch update + audit.
//   - Barang masuk (restock darurat tengah hari): kelipatan bebas, satu item per call.
//   - Opname: bandingkan qtyFisik vs currentQty per item, hanya buat audit log
//     untuk item yang punya selisih (efisiensi).
//   - Mark habis: shortcut set currentQty=0, audit reason=manualAdjust.
//
// Permission per REV 2.3 matrix: view + opname pagi + mark habis + barang masuk +
// restock pagi semua TERBUKA untuk owner+kasir+waiter (gate hanya `authenticate`).

import { Prisma, PortionMovementReason } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError, notFound } from '../../utils/errors';
import type {
  RestockMorningInput,
  EmergencyInInput,
  OpnameInput,
  MarkHabisInput,
  ListPortionQuery,
} from './portion.schema';

// ============================================================
// View shape
// ============================================================

export interface PortionStockView {
  menuId: number;
  menuName: string;
  category: string;
  currentQty: number;
  minStock: number;
  openingQtyToday: number;
  openingQtyDate: string; // YYYY-MM-DD
  suggestedRestockMorning: number; // 0 kalau >= min; else ceil((min-current)/5)*5
  isLow: boolean; // currentQty <= minStock
  updatedAt: string;
}

export interface PortionMovementView {
  id: number;
  delta: number;
  reason: PortionMovementReason;
  note: string | null;
  userId: number;
  createdAt: string;
}

type PortionStockWithMenu = Prisma.PortionStockGetPayload<{ include: { menu: true } }>;

function suggestedRestock(currentQty: number, minStock: number): number {
  if (currentQty >= minStock) return 0;
  return Math.ceil((minStock - currentQty) / 5) * 5;
}

function toPortionStockView(stock: PortionStockWithMenu): PortionStockView {
  return {
    menuId: stock.menuId,
    menuName: stock.menu.name,
    category: stock.menu.category,
    currentQty: stock.currentQty,
    minStock: stock.minStock,
    openingQtyToday: stock.openingQtyToday,
    openingQtyDate: stock.openingQtyDate.toISOString().substring(0, 10),
    suggestedRestockMorning: suggestedRestock(stock.currentQty, stock.minStock),
    isLow: stock.currentQty <= stock.minStock,
    updatedAt: stock.updatedAt.toISOString(),
  };
}

// ============================================================
// Helpers
// ============================================================

function todayDateOnly(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/// Lazy trigger snapshot opening_qty_today di hari baru. Idempotent - hanya
/// menyentuh row yang opening_qty_date-nya masih kemarin (atau lebih lama).
/// Dipakai single bulk SQL karena Prisma updateMany tidak bisa copy nilai antar kolom.
async function ensureOpeningSnapshot(): Promise<void> {
  const today = todayDateOnly();
  await prisma.$executeRaw`
    UPDATE portion_stocks
    SET opening_qty_today = current_qty,
        opening_qty_date = ${today}
    WHERE opening_qty_date < ${today}
  `;
}

// ============================================================
// Read operations
// ============================================================

export async function listPortionStocks(query: ListPortionQuery): Promise<PortionStockView[]> {
  await ensureOpeningSnapshot();

  const stocks = await prisma.portionStock.findMany({
    where: {
      menu: { isActive: true, category: query.category },
    },
    include: { menu: true },
    orderBy: [{ menu: { category: 'asc' } }, { menu: { name: 'asc' } }],
  });

  let views = stocks.map(toPortionStockView);
  if (query.lowStock) {
    views = views.filter((v) => v.isLow);
  }
  return views;
}

export interface PortionStockDetail extends PortionStockView {
  recentMovements: PortionMovementView[];
}

export async function getPortionStockDetail(
  menuId: number,
  movementsLimit = 20,
): Promise<PortionStockDetail> {
  await ensureOpeningSnapshot();

  const stock = await prisma.portionStock.findUnique({
    where: { menuId },
    include: { menu: true },
  });
  if (!stock) throw notFound('PortionStock');

  const movements = await prisma.portionMovement.findMany({
    where: { menuId },
    orderBy: { createdAt: 'desc' },
    take: movementsLimit,
  });

  return {
    ...toPortionStockView(stock),
    recentMovements: movements.map((m) => ({
      id: m.id,
      delta: m.delta,
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

/// Restock pagi batch. Validasi kelipatan 5 sudah ada di schema. Semua dalam
/// satu transaction supaya kalau ada menuId tidak valid, semua di-rollback.
export async function restockMorning(
  userId: number,
  input: RestockMorningInput,
): Promise<PortionStockView[]> {
  return prisma.$transaction(async (tx) => {
    const results: PortionStockView[] = [];
    for (const item of input.items) {
      const stock = await tx.portionStock.findUnique({
        where: { menuId: item.menuId },
        include: { menu: true },
      });
      if (!stock) {
        throw new AppError(`PortionStock untuk menuId=${item.menuId} tidak ditemukan`, 400);
      }
      const updated = await tx.portionStock.update({
        where: { menuId: item.menuId },
        data: { currentQty: { increment: item.qty } },
        include: { menu: true },
      });
      await tx.portionMovement.create({
        data: {
          menuId: item.menuId,
          delta: item.qty,
          reason: PortionMovementReason.restockMorning,
          qtyBefore: updated.currentQty - item.qty,
          qtyAfter: updated.currentQty,
          note: `Restock pagi: +${item.qty} (${stock.menu.name})`,
          userId,
        },
      });
      results.push(toPortionStockView(updated));
    }
    return results;
  });
}

/// Barang masuk (restock darurat tengah hari). Satu item per call karena spec
/// menyebut "fitur Barang Masuk" untuk update reaktif saat barang sampai.
export async function emergencyIn(
  userId: number,
  input: EmergencyInInput,
): Promise<PortionStockView> {
  return prisma.$transaction(async (tx) => {
    const stock = await tx.portionStock.findUnique({
      where: { menuId: input.menuId },
      include: { menu: true },
    });
    if (!stock) {
      throw new AppError(`PortionStock untuk menuId=${input.menuId} tidak ditemukan`, 400);
    }
    const updated = await tx.portionStock.update({
      where: { menuId: input.menuId },
      data: { currentQty: { increment: input.qty } },
      include: { menu: true },
    });
    await tx.portionMovement.create({
      data: {
        menuId: input.menuId,
        delta: input.qty,
        reason: PortionMovementReason.restockEmergency,
        qtyBefore: updated.currentQty - input.qty,
        qtyAfter: updated.currentQty,
        note: input.note ?? `Barang masuk darurat: +${input.qty} (${stock.menu.name})`,
        userId,
      },
    });
    return toPortionStockView(updated);
  });
}

/// Opname: hanya buat audit log untuk item yang punya selisih (qtyFisik !== currentQty).
/// Item dengan selisih 0 tetap dianggap sukses ter-opname tapi tidak mencatat movement.
export async function opname(
  userId: number,
  input: OpnameInput,
): Promise<PortionStockView[]> {
  return prisma.$transaction(async (tx) => {
    const results: PortionStockView[] = [];
    for (const item of input.items) {
      const stock = await tx.portionStock.findUnique({
        where: { menuId: item.menuId },
        include: { menu: true },
      });
      if (!stock) {
        throw new AppError(`PortionStock untuk menuId=${item.menuId} tidak ditemukan`, 400);
      }
      const selisih = item.qtyFisik - stock.currentQty;
      if (selisih !== 0) {
        await tx.portionStock.update({
          where: { menuId: item.menuId },
          data: { currentQty: item.qtyFisik },
        });
        const sign = selisih > 0 ? '+' : '';
        const prefix = input.note ?? 'Opname';
        await tx.portionMovement.create({
          data: {
            menuId: item.menuId,
            delta: selisih,
            reason: PortionMovementReason.manualAdjust,
            qtyBefore: stock.currentQty,
            qtyAfter: item.qtyFisik,
            note: `${prefix}: selisih ${sign}${selisih} (sistem ${stock.currentQty} → fisik ${item.qtyFisik})`,
            userId,
          },
        });
      }
      const updated = await tx.portionStock.findUniqueOrThrow({
        where: { menuId: item.menuId },
        include: { menu: true },
      });
      results.push(toPortionStockView(updated));
    }
    return results;
  });
}

/// Mark habis: shortcut set currentQty=0 dengan audit log manualAdjust.
/// Idempotent - kalau sudah 0, tidak buat audit baru.
export async function markHabis(
  menuId: number,
  userId: number,
  input: MarkHabisInput,
): Promise<PortionStockView> {
  const stock = await prisma.portionStock.findUnique({
    where: { menuId },
    include: { menu: true },
  });
  if (!stock) throw notFound('PortionStock');

  if (stock.currentQty === 0) {
    // Sudah habis, no-op
    return toPortionStockView(stock);
  }

  const delta = -stock.currentQty;
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.portionStock.update({
      where: { menuId },
      data: { currentQty: 0 },
      include: { menu: true },
    });
    await tx.portionMovement.create({
      data: {
        menuId,
        delta,
        reason: PortionMovementReason.manualAdjust,
        qtyBefore: stock.currentQty,
        qtyAfter: 0,
        note:
          input.note ??
          `Mark habis: dari ${stock.currentQty} ke 0 (${stock.menu.name})`,
        userId,
      },
    });
    return u;
  });
  return toPortionStockView(updated);
}
