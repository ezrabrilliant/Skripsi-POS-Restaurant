// Service modul purchases. REV 2.5.1 (3-kind line item bifurcation):
//
// A. Free-form (rawMaterialId null, label set):
//   1. Wajib subtotal. qty + unitPrice nullable (tidak relevan).
//   2. Tidak update raw_materials (tidak ada FK).
//   3. Tidak insert raw_material_movements (audit hanya untuk typed master).
//   4. Untuk bumbu dasar / ayam mentah / ikan mentah / item tanpa master.
//
// B. Typed-scale (rawMaterialId set, unit.opname_mode = scale_0_5):
//   1. Wajib subtotal (total harga). qty + unitPrice opsional sebagai info.
//   2. Update raw_materials.last_buy_date selalu.
//   3. Update raw_materials.unit_price kalau unitPrice diisi.
//   4. Stock_qty TIDAK auto-update (manual via opname segmented 0..5).
//   5. Insert raw_material_movements reason=`purchase` delta=0 dengan note.
//
// C. Typed-exact (rawMaterialId set, unit.opname_mode = exact):
//   1. Wajib qty + unitPrice. subtotal = qty * unitPrice (auto-compute server).
//   2. Update raw_materials.last_buy_date + unit_price + stock_qty += qty.
//   3. Insert raw_material_movements reason=`purchase` delta=+qty.
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
  rawMaterialId: number | null;
  rawMaterialName: string | null;
  rawMaterialUnit: string | null;
  rawMaterialOpnameMode: 'exact' | 'scale_0_5' | null;
  label: string | null;
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
      rawMaterialName: it.rawMaterial?.name ?? null,
      rawMaterialUnit: it.rawMaterial?.unit.label ?? null,
      rawMaterialOpnameMode: it.rawMaterial?.unit.opnameMode ?? null,
      label: it.label,
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

type ProcessedItem =
  | {
      kind: 'freeform';
      label: string;
      subtotal: Prisma.Decimal;
      note: string | null;
      expiredDate: string | null;
    }
  | {
      kind: 'typed-scale';
      rm: Prisma.RawMaterialGetPayload<{ include: { unit: true } }>;
      qty: Prisma.Decimal | null;
      unitPrice: Prisma.Decimal | null;
      subtotal: Prisma.Decimal;
      note: string | null;
      expiredDate: string | null;
    }
  | {
      kind: 'typed-exact';
      rm: Prisma.RawMaterialGetPayload<{ include: { unit: true } }>;
      qty: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      subtotal: Prisma.Decimal;
      note: string | null;
      expiredDate: string | null;
    };

export async function createPurchase(
  userId: number,
  input: CreatePurchaseInput,
): Promise<PurchaseView> {
  // Validasi vendor (kalau ada)
  if (input.vendorId) {
    const vendor = await prisma.vendor.findUnique({ where: { id: input.vendorId } });
    if (!vendor) throw new AppError(`Vendor id=${input.vendorId} tidak ditemukan`, 400);
  }

  // Fetch raw_materials untuk semua typed items (rawMaterialId set)
  const rawMaterialIds = input.items
    .map((i) => i.rawMaterialId)
    .filter((id): id is number => typeof id === 'number');

  const rawMaterials =
    rawMaterialIds.length > 0
      ? await prisma.rawMaterial.findMany({
          where: { id: { in: rawMaterialIds } },
          include: { unit: true },
        })
      : [];
  const rmMap = new Map(rawMaterials.map((r) => [r.id, r]));

  const purchaseDate = parseDateUtcMidnight(input.date);

  // REV 2.5.1: bifurcate per item ke 3 kind (freeform / typed-scale / typed-exact).
  const itemsProcessed: ProcessedItem[] = input.items.map((item) => {
    const hasRmId = item.rawMaterialId !== null && item.rawMaterialId !== undefined;
    const hasLabel = item.label !== null && item.label !== undefined;

    if (!hasRmId && hasLabel) {
      // Free-form
      if (item.subtotal === undefined || item.subtotal === null) {
        throw new AppError(`Free-form line item "${item.label}" wajib subtotal`, 422);
      }
      return {
        kind: 'freeform',
        label: item.label!,
        subtotal: new Prisma.Decimal(item.subtotal),
        note: item.note ?? null,
        expiredDate: item.expiredDate ?? null,
      };
    }

    if (hasRmId && !hasLabel) {
      const rm = rmMap.get(item.rawMaterialId!);
      if (!rm) {
        throw new AppError(`RawMaterial id=${item.rawMaterialId} tidak ditemukan`, 400);
      }
      const isScale = rm.unit.opnameMode === 'scale_0_5';

      if (isScale) {
        if (item.subtotal === undefined || item.subtotal === null) {
          throw new AppError(`Item ${rm.name} (skala mode) wajib subtotal`, 422);
        }
        return {
          kind: 'typed-scale',
          rm,
          qty:
            item.qty !== undefined && item.qty !== null
              ? new Prisma.Decimal(item.qty)
              : null,
          unitPrice:
            item.unitPrice !== undefined && item.unitPrice !== null
              ? new Prisma.Decimal(item.unitPrice)
              : null,
          subtotal: new Prisma.Decimal(item.subtotal),
          note: item.note ?? null,
          expiredDate: item.expiredDate ?? null,
        };
      }

      // typed-exact
      if (
        item.qty === undefined ||
        item.qty === null ||
        item.unitPrice === undefined ||
        item.unitPrice === null
      ) {
        throw new AppError(`Item ${rm.name} (exact mode) wajib qty + unitPrice`, 422);
      }
      const qty = new Prisma.Decimal(item.qty);
      const unitPrice = new Prisma.Decimal(item.unitPrice);
      return {
        kind: 'typed-exact',
        rm,
        qty,
        unitPrice,
        subtotal: qty.mul(unitPrice),
        note: item.note ?? null,
        expiredDate: item.expiredDate ?? null,
      };
    }

    // Both or neither — schema should have caught, but defensive
    throw new AppError(
      'Item wajib salah satu: rawMaterialId (typed) atau label (free-form), tidak boleh dua-duanya',
      422,
    );
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

    for (const processed of itemsProcessed) {
      if (processed.kind === 'freeform') {
        await tx.purchaseItem.create({
          data: {
            purchaseId: header.id,
            rawMaterialId: null,
            label: processed.label,
            qty: null,
            unitPrice: null,
            subtotal: processed.subtotal,
            note: processed.note,
            expiredDate: processed.expiredDate
              ? parseDateUtcMidnight(processed.expiredDate)
              : null,
          },
        });
        // No raw_material update, no movement audit untuk free-form
        continue;
      }

      const { rm, qty, unitPrice, subtotal, note, expiredDate } = processed;
      // REV 2.8: tangkap id item agar movement bisa menautkan purchase_item_id.
      const pItem = await tx.purchaseItem.create({
        data: {
          purchaseId: header.id,
          rawMaterialId: rm.id,
          label: null,
          qty,
          unitPrice,
          subtotal,
          note,
          expiredDate: expiredDate ? parseDateUtcMidnight(expiredDate) : null,
        },
      });

      const rmUpdateData: Prisma.RawMaterialUpdateInput = { lastBuyDate: purchaseDate };
      if (unitPrice) rmUpdateData.unitPrice = unitPrice;
      if (processed.kind === 'typed-exact' && qty) {
        rmUpdateData.stockQty = { increment: qty };
      }
      const updatedRm = await tx.rawMaterial.update({
        where: { id: rm.id },
        data: rmUpdateData,
      });

      const movementDelta =
        processed.kind === 'typed-scale' ? new Prisma.Decimal(0) : qty!;
      let movementNote: string;
      if (processed.kind === 'typed-scale') {
        movementNote = `Skala mode: total Rp${subtotal.toString()}${
          note ? ` (${note})` : ''
        } (stok manual via opname)`;
      } else {
        movementNote = `+${qty!.toString()} ${rm.unit.label} @ Rp${unitPrice!.toString()}`;
      }
      // REV 2.8: tautan via FK; qtyAfter dari hasil update, before = after − delta.
      await tx.rawMaterialMovement.create({
        data: {
          rawMaterialId: rm.id,
          delta: movementDelta,
          reason: RawMaterialMovementReason.purchase,
          purchaseId: header.id,
          purchaseItemId: pItem.id,
          qtyBefore: updatedRm.stockQty.sub(movementDelta),
          qtyAfter: updatedRm.stockQty,
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
