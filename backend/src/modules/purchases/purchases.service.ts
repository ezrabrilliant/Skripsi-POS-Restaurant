// Service modul purchases. REV 2.5 (bifurcate by unit.opname_mode):
//
// Saat purchase di-submit, untuk TIAP item — perilaku tergantung
// unit.opname_mode raw material:
//
// A. exact mode (qty meaningful, mis. butir/kg/liter):
//   1. Wajib qty + unitPrice. subtotal = qty * unitPrice (auto-compute di server).
//   2. Update raw_materials.last_buy_date = purchase.date (selalu)
//   3. Update raw_materials.unit_price = item.unitPrice (selalu - snapshot harga terbaru)
//   4. Update raw_materials.stock_qty += qty (HANYA kalau isTracked=true)
//   5. Insert raw_material_movements reason=`purchase` delta=+qty (audit lengkap;
//      non-tracked tetap log untuk akuntabilitas pengeluaran).
//
// B. scale_0_5 mode (qty tidak meaningful, mis. beras dalam karung):
//   1. Wajib subtotal (total harga). qty + unitPrice opsional (boleh diisi sebagai
//      info, mis. "1 karung 50kg @ Rp 500k"); note recommended.
//   2. Update raw_materials.last_buy_date = purchase.date (selalu)
//   3. Update raw_materials.unit_price kalau unitPrice diisi (snapshot info opsional)
//   4. Stock_qty TIDAK auto-update (stok dikelola via opname manual segmented 0..5)
//   5. Insert raw_material_movements reason=`purchase` delta=0 dengan note
//      kontekstual (skala mode, stok manual via opname).
//
// totalAmount header = sum(subtotal items) - dihitung di server, bukan dari client.
//
// Tidak ada operasi update/delete purchase - kalau salah input, kasir catat
// purchase baru sebagai koreksi (audit trail tetap utuh).

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
  rawMaterialOpnameMode: 'exact' | 'scale_0_5';
  isTracked: boolean;
  qty: number | null;
  unitPrice: number | null;
  subtotal: number;
  note: string | null;
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
    items: {
      include: {
        rawMaterial: {
          select: {
            name: true;
            isTracked: true;
            unit: { select: { label: true; opnameMode: true } };
          };
        };
      };
    };
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
      rawMaterialUnit: it.rawMaterial.unit.label,
      rawMaterialOpnameMode: it.rawMaterial.unit.opnameMode,
      isTracked: it.rawMaterial.isTracked,
      qty: it.qty !== null ? it.qty.toNumber() : null,
      unitPrice: it.unitPrice !== null ? it.unitPrice.toNumber() : null,
      subtotal: it.subtotal.toNumber(),
      note: it.note,
      expiredDate: it.expiredDate ? it.expiredDate.toISOString().substring(0, 10) : null,
      createdAt: it.createdAt.toISOString(),
    })),
  };
}

const purchaseInclude = {
  user: { select: { name: true } },
  vendor: { select: { name: true } },
  items: {
    include: {
      rawMaterial: {
        select: {
          name: true,
          isTracked: true,
          unit: { select: { label: true, opnameMode: true } },
        },
      },
    },
  },
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

  // Validasi semua raw_material exist + fetch info termasuk unit (untuk opname_mode)
  const rawMaterialIds = input.items.map((i) => i.rawMaterialId);
  const rawMaterials = await prisma.rawMaterial.findMany({
    where: { id: { in: rawMaterialIds } },
    include: { unit: true },
  });
  const rmMap = new Map(rawMaterials.map((r) => [r.id, r]));
  for (const item of input.items) {
    if (!rmMap.has(item.rawMaterialId)) {
      throw new AppError(`RawMaterial id=${item.rawMaterialId} tidak ditemukan`, 400);
    }
  }

  const purchaseDate = parseDateUtcMidnight(input.date);

  // REV 2.5: bifurcate per item berdasarkan unit.opname_mode.
  //   - scale_0_5: subtotal wajib (total harga); qty + unitPrice opsional.
  //   - exact    : qty + unitPrice wajib, subtotal = qty * unitPrice (auto).
  const itemsProcessed = input.items.map((item) => {
    const rm = rmMap.get(item.rawMaterialId)!;
    const isScale = rm.unit.opnameMode === 'scale_0_5';

    if (isScale) {
      if (item.subtotal === undefined || item.subtotal === null) {
        throw new AppError(
          `Item ${rm.name} (skala mode) wajib subtotal (total harga). qty + unitPrice opsional.`,
          422,
        );
      }
      return {
        item,
        rm,
        isScale,
        qty:
          item.qty !== undefined && item.qty !== null
            ? new Prisma.Decimal(item.qty)
            : null,
        unitPrice:
          item.unitPrice !== undefined && item.unitPrice !== null
            ? new Prisma.Decimal(item.unitPrice)
            : null,
        subtotal: new Prisma.Decimal(item.subtotal),
      };
    }

    // exact mode
    if (
      item.qty === undefined ||
      item.qty === null ||
      item.unitPrice === undefined ||
      item.unitPrice === null
    ) {
      throw new AppError(
        `Item ${rm.name} (exact mode) wajib qty + unitPrice.`,
        422,
      );
    }
    const qty = new Prisma.Decimal(item.qty);
    const unitPrice = new Prisma.Decimal(item.unitPrice);
    const subtotal = qty.mul(unitPrice);
    return { item, rm, isScale, qty, unitPrice, subtotal };
  });

  const totalAmount = itemsProcessed.reduce(
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

    for (const { item, rm, isScale, qty, unitPrice, subtotal } of itemsProcessed) {
      // 1. Create PurchaseItem (qty + unitPrice nullable kalau scale_0_5)
      await tx.purchaseItem.create({
        data: {
          purchaseId: header.id,
          rawMaterialId: item.rawMaterialId,
          qty,
          unitPrice,
          subtotal,
          note: item.note ?? null,
          expiredDate: item.expiredDate ? parseDateUtcMidnight(item.expiredDate) : null,
        },
      });

      // 2. Update RawMaterial:
      //   - last_buy_date selalu update.
      //   - unit_price update kalau unitPrice ada (exact selalu ada; scale opsional).
      //   - stock_qty increment HANYA kalau exact mode + isTracked.
      const rmUpdateData: Prisma.RawMaterialUpdateInput = {
        lastBuyDate: purchaseDate,
      };
      if (unitPrice) rmUpdateData.unitPrice = unitPrice;
      if (!isScale && rm.isTracked && qty) {
        rmUpdateData.stockQty = { increment: qty };
      }
      await tx.rawMaterial.update({
        where: { id: item.rawMaterialId },
        data: rmUpdateData,
      });

      // 3. Insert audit log raw_material_movements.
      // delta semantic: untuk audit, bukan stock impact.
      //   - Scale            : 0 (qty tidak meaningful, stock manual via opname)
      //   - Exact (tracked)  : qty (real stock impact)
      //   - Exact (log-only) : qty (audit history pembelian non-tracked)
      const movementDelta = isScale ? new Prisma.Decimal(0) : qty!;
      let movementNote: string;
      if (isScale) {
        movementNote = `Purchase id=${header.id}: total Rp${subtotal.toString()}${item.note ? ` (${item.note})` : ''} (skala mode, stok manual via opname)`;
      } else if (rm.isTracked) {
        movementNote = `Purchase id=${header.id}: +${qty!.toString()} ${rm.unit.label} @ Rp${unitPrice!.toString()}`;
      } else {
        movementNote = `Purchase id=${header.id}: +${qty!.toString()} ${rm.unit.label} @ Rp${unitPrice!.toString()} (tidak tracked, hanya log pengeluaran)`;
      }
      await tx.rawMaterialMovement.create({
        data: {
          rawMaterialId: item.rawMaterialId,
          delta: movementDelta,
          reason: RawMaterialMovementReason.purchase,
          note: movementNote,
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
