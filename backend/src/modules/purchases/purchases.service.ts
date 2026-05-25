// Service modul purchases. REV 2.1/2.2:
//
// Saat purchase di-submit, untuk TIAP item:
//   1. Create PurchaseItem (qty + unitPrice + subtotal = qty*unitPrice)
//   2. Update raw_materials.last_buy_date = purchase.date (selalu)
//   3. Update raw_materials.unit_price = item.unitPrice (selalu — snapshot harga terbaru)
//   4. Update raw_materials.stock_qty += qty (HANYA kalau isTracked=true)
//   5. Insert raw_material_movements reason=`purchase` delta=+qty (SELALU, audit untuk
//      semua item — non-tracked tetap log untuk akuntabilitas pengeluaran)
//
// totalAmount header = sum(subtotal items) — dihitung di server, bukan dari client.
//
// Tidak ada operasi update/delete purchase di Phase 7 — kalau salah input, kasir
// catat purchase baru sebagai koreksi (audit trail tetap utuh). Bisa ditambah
// kalau dibutuhkan, tapi out-of-scope untuk REV 2.3 ini.

import { Prisma, RawMaterialMovementReason } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError, notFound } from '../../utils/errors';
import type {
  CreatePurchaseInput,
  ListPurchasesQuery,
} from './purchases.schema';

// ============================================================
// View shape
// ============================================================

export interface PurchaseItemView {
  id: number;
  rawMaterialId: number;
  rawMaterialName: string;
  rawMaterialUnit: string;
  isTracked: boolean;
  qty: number;
  unitPrice: number;
  subtotal: number;
  expiredDate: string | null; // YYYY-MM-DD
  createdAt: string;
}

export interface PurchaseView {
  id: number;
  date: string; // YYYY-MM-DD
  userId: number;
  userName: string;
  vendorId: number | null;
  vendorName: string | null;
  totalAmount: number;
  note: string | null;
  items: PurchaseItemView[];
  createdAt: string;
}

type PurchaseWithRelations = Prisma.PurchaseGetPayload<{
  include: {
    user: { select: { name: true } };
    vendor: { select: { name: true } };
    items: { include: { rawMaterial: { select: { name: true; unit: true; isTracked: true } } } };
  };
}>;

function toPurchaseView(p: PurchaseWithRelations): PurchaseView {
  return {
    id: p.id,
    date: p.date.toISOString().substring(0, 10),
    userId: p.userId,
    userName: p.user.name,
    vendorId: p.vendorId,
    vendorName: p.vendor?.name ?? null,
    totalAmount: p.totalAmount.toNumber(),
    note: p.note,
    createdAt: p.createdAt.toISOString(),
    items: p.items.map((it) => ({
      id: it.id,
      rawMaterialId: it.rawMaterialId,
      rawMaterialName: it.rawMaterial.name,
      rawMaterialUnit: it.rawMaterial.unit,
      isTracked: it.rawMaterial.isTracked,
      qty: it.qty.toNumber(),
      unitPrice: it.unitPrice.toNumber(),
      subtotal: it.subtotal.toNumber(),
      expiredDate: it.expiredDate ? it.expiredDate.toISOString().substring(0, 10) : null,
      createdAt: it.createdAt.toISOString(),
    })),
  };
}

const purchaseInclude = {
  user: { select: { name: true } },
  vendor: { select: { name: true } },
  items: { include: { rawMaterial: { select: { name: true, unit: true, isTracked: true } } } },
} satisfies Prisma.PurchaseInclude;

// ============================================================
// Date helper (sama strategi dengan shifts: UTC midnight dari komponen local
// untuk hindari DATE column off-by-one karena timezone)
// ============================================================

function parseDateUtcMidnight(yyyymmdd: string): Date {
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

// ============================================================
// Operations
// ============================================================

export async function createPurchase(
  userId: number,
  input: CreatePurchaseInput,
): Promise<PurchaseView> {
  // Validasi vendor (kalau ada)
  if (input.vendorId) {
    const vendor = await prisma.vendor.findUnique({ where: { id: input.vendorId } });
    if (!vendor) throw new AppError(`Vendor id=${input.vendorId} tidak ditemukan`, 400);
  }

  // Validasi semua raw_material exist + fetch info untuk perhitungan
  const rawMaterialIds = input.items.map((i) => i.rawMaterialId);
  const rawMaterials = await prisma.rawMaterial.findMany({
    where: { id: { in: rawMaterialIds } },
  });
  const rmMap = new Map(rawMaterials.map((r) => [r.id, r]));
  for (const item of input.items) {
    if (!rmMap.has(item.rawMaterialId)) {
      throw new AppError(`RawMaterial id=${item.rawMaterialId} tidak ditemukan`, 400);
    }
  }

  const purchaseDate = parseDateUtcMidnight(input.date);

  // Hitung subtotal per item + totalAmount
  const itemsWithSubtotal = input.items.map((item) => {
    const qty = new Prisma.Decimal(item.qty);
    const unitPrice = new Prisma.Decimal(item.unitPrice);
    const subtotal = qty.mul(unitPrice);
    return { item, qty, unitPrice, subtotal };
  });
  const totalAmount = itemsWithSubtotal.reduce(
    (sum, x) => sum.add(x.subtotal),
    new Prisma.Decimal(0),
  );

  const purchaseId = await prisma.$transaction(async (tx) => {
    const header = await tx.purchase.create({
      data: {
        date: purchaseDate,
        userId,
        vendorId: input.vendorId ?? null,
        totalAmount,
        note: input.note ?? null,
      },
    });

    for (const { item, qty, unitPrice, subtotal } of itemsWithSubtotal) {
      const rm = rmMap.get(item.rawMaterialId)!;

      // 1. Create PurchaseItem
      await tx.purchaseItem.create({
        data: {
          purchaseId: header.id,
          rawMaterialId: item.rawMaterialId,
          qty,
          unitPrice,
          subtotal,
          expiredDate: item.expiredDate ? parseDateUtcMidnight(item.expiredDate) : null,
        },
      });

      // 2. Update RawMaterial: last_buy_date + unit_price selalu update;
      //    stock_qty hanya kalau isTracked=true
      const rmUpdateData: Prisma.RawMaterialUpdateInput = {
        lastBuyDate: purchaseDate,
        unitPrice,
      };
      if (rm.isTracked) {
        rmUpdateData.stockQty = { increment: qty };
      }
      await tx.rawMaterial.update({
        where: { id: item.rawMaterialId },
        data: rmUpdateData,
      });

      // 3. Insert audit log raw_material_movements (selalu, untuk tracked maupun
      //    non-tracked supaya audit lengkap)
      await tx.rawMaterialMovement.create({
        data: {
          rawMaterialId: item.rawMaterialId,
          delta: qty,
          reason: RawMaterialMovementReason.purchase,
          note: `Purchase id=${header.id}: +${qty.toString()} ${rm.unit} @ Rp${unitPrice.toString()}${
            rm.isTracked ? '' : ' (tidak tracked, hanya log pengeluaran)'
          }`,
          userId,
        },
      });
    }

    return header.id;
  });

  return getPurchaseById(purchaseId);
}

export async function getPurchaseById(id: number): Promise<PurchaseView> {
  const p = await prisma.purchase.findUnique({
    where: { id },
    include: purchaseInclude,
  });
  if (!p) throw notFound('Purchase');
  return toPurchaseView(p);
}

export async function listPurchases(query: ListPurchasesQuery): Promise<PurchaseView[]> {
  const where: Prisma.PurchaseWhereInput = {};
  if (query.date) {
    where.date = parseDateUtcMidnight(query.date);
  } else if (query.month) {
    const [y, m] = query.month.split('-').map(Number);
    const start = new Date(Date.UTC(y!, m! - 1, 1));
    const end = new Date(Date.UTC(y!, m!, 1)); // first day of next month
    where.date = { gte: start, lt: end };
  }
  if (query.vendorId) where.vendorId = query.vendorId;

  const purchases = await prisma.purchase.findMany({
    where,
    include: purchaseInclude,
    orderBy: { date: 'desc' },
  });
  return purchases.map(toPurchaseView);
}
