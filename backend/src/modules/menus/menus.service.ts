// Service modul menus. REV 2.2: 3 stockType (portion / linked / nonStock) +
// subOptions JSON untuk paket. Sinkronisasi PortionStock saat:
//   - create menu stockType=portion -> auto-create PortionStock {qty: 0, minStock}
//   - update minStock pada menu portion -> sync ke PortionStock.minStock
//   - update stockType beralih dari non-portion ke portion -> create PortionStock
//   - update stockType beralih dari portion ke non-portion -> biarkan PortionStock
//     (history tetap utuh; tidak akan auto-decrement lagi karena menu tidak portion)
//   - soft delete (isActive=false) -> tidak menyentuh PortionStock

import { Prisma, StockType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError, notFound } from '../../utils/errors';
import type { CreateMenuInput, UpdateMenuInput, ListMenuQuery } from './menus.schema';

// ============================================================
// Public response shape (mapper)
// ============================================================

interface MenuPortionStockView {
  currentQty: number;
  minStock: number;
  openingQtyToday: number;
  openingQtyDate: string; // YYYY-MM-DD
  updatedAt: string;
}

export interface MenuView {
  id: number;
  name: string;
  category: string;
  price: number; // konversi dari Decimal supaya frontend bisa pakai langsung
  stockType: StockType;
  minStock: number | null;
  imageUrl: string | null;
  subOptions: Prisma.JsonValue;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  portionStock: MenuPortionStockView | null;
  // Hanya ada saat list dipanggil dengan includePopularity=true. Sum qty
  // TransactionItem dari Tx status=paid + bukan source merge bill (all-time).
  salesCount?: number;
}

type MenuWithStock = Prisma.MenuGetPayload<{ include: { portionStock: true } }>;

function toMenuView(menu: MenuWithStock): MenuView {
  return {
    id: menu.id,
    name: menu.name,
    category: menu.category,
    price: menu.price.toNumber(),
    stockType: menu.stockType,
    minStock: menu.minStock,
    imageUrl: menu.imageUrl,
    subOptions: menu.subOptions,
    isActive: menu.isActive,
    createdAt: menu.createdAt.toISOString(),
    updatedAt: menu.updatedAt.toISOString(),
    portionStock: menu.portionStock
      ? {
          currentQty: menu.portionStock.currentQty,
          minStock: menu.portionStock.minStock,
          openingQtyToday: menu.portionStock.openingQtyToday,
          openingQtyDate: menu.portionStock.openingQtyDate.toISOString().substring(0, 10),
          updatedAt: menu.portionStock.updatedAt.toISOString(),
        }
      : null,
  };
}

// ============================================================
// CRUD
// ============================================================

export async function listMenus(query: ListMenuQuery): Promise<MenuView[]> {
  const menus = await prisma.menu.findMany({
    where: {
      isActive: query.activeOnly ? true : undefined,
      category: query.category,
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    include: { portionStock: true },
  });

  // includePopularity: hitung sum qty per menuId dari TransactionItem yang
  // transaksinya status=paid + mergedIntoId=null (exclude source merge supaya
  // qty tidak double-count). Frontend pakai field ini untuk sort di POS.
  let salesMap: Map<number, number> | null = null;
  if (query.includePopularity) {
    const grouped = await prisma.transactionItem.groupBy({
      by: ['menuId'],
      where: {
        transaction: {
          status: 'paid',
          mergedIntoId: null,
        },
      },
      _sum: { qty: true },
    });
    salesMap = new Map(grouped.map((g) => [g.menuId, g._sum.qty ?? 0]));
  }

  return menus.map((m) => {
    const view = toMenuView(m);
    if (salesMap) view.salesCount = salesMap.get(m.id) ?? 0;
    return view;
  });
}

export async function getMenuById(id: number): Promise<MenuView> {
  const menu = await prisma.menu.findUnique({
    where: { id },
    include: { portionStock: true },
  });
  if (!menu) throw notFound('Menu');
  return toMenuView(menu);
}

export async function createMenu(input: CreateMenuInput): Promise<MenuView> {
  const created = await prisma.$transaction(async (tx) => {
    const menu = await tx.menu.create({
      data: {
        name: input.name,
        category: input.category,
        price: new Prisma.Decimal(input.price),
        stockType: input.stockType,
        minStock: input.minStock ?? null,
        imageUrl: input.imageUrl ?? null,
        subOptions: input.subOptions === undefined ? Prisma.JsonNull : (input.subOptions as Prisma.InputJsonValue),
        isActive: input.isActive ?? true,
      },
    });
    if (input.stockType === StockType.portion) {
      await tx.portionStock.create({
        data: {
          menuId: menu.id,
          currentQty: 0,
          minStock: input.minStock ?? 0,
        },
      });
    }
    return menu.id;
  });
  return getMenuById(created);
}

export async function updateMenu(id: number, input: UpdateMenuInput): Promise<MenuView> {
  const existing = await prisma.menu.findUnique({
    where: { id },
    include: { portionStock: true },
  });
  if (!existing) throw notFound('Menu');

  const nextStockType = input.stockType ?? existing.stockType;
  const nextMinStock = input.minStock ?? existing.minStock ?? 0;

  await prisma.$transaction(async (tx) => {
    const data: Prisma.MenuUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.category !== undefined) data.category = input.category;
    if (input.price !== undefined) data.price = new Prisma.Decimal(input.price);
    if (input.stockType !== undefined) data.stockType = input.stockType;
    if (input.minStock !== undefined) data.minStock = input.minStock;
    if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;
    if (input.subOptions !== undefined) {
      data.subOptions =
        input.subOptions === null ? Prisma.JsonNull : (input.subOptions as Prisma.InputJsonValue);
    }
    if (input.isActive !== undefined) data.isActive = input.isActive;

    await tx.menu.update({ where: { id }, data });

    // Sync PortionStock kalau stockType=portion (atau baru beralih jadi portion)
    if (nextStockType === StockType.portion) {
      if (existing.portionStock) {
        await tx.portionStock.update({
          where: { menuId: id },
          data: { minStock: nextMinStock },
        });
      } else {
        await tx.portionStock.create({
          data: {
            menuId: id,
            currentQty: 0,
            minStock: nextMinStock,
          },
        });
      }
    }
    // Bila beralih dari portion -> non-portion: TIDAK menghapus PortionStock
    // (data historis tetap diakses untuk laporan). Stok tidak akan ter-decrement
    // lagi karena flow order akan skip menu non-portion.
  });

  return getMenuById(id);
}

export async function deactivateMenu(id: number): Promise<MenuView> {
  const existing = await prisma.menu.findUnique({ where: { id } });
  if (!existing) throw notFound('Menu');
  await prisma.menu.update({ where: { id }, data: { isActive: false } });
  return getMenuById(id);
}

// Reactivate disediakan terpisah untuk membedakan dengan update field lain
export async function reactivateMenu(id: number): Promise<MenuView> {
  const existing = await prisma.menu.findUnique({ where: { id } });
  if (!existing) throw notFound('Menu');
  if (existing.isActive) {
    throw new AppError('Menu sudah aktif', 400);
  }
  await prisma.menu.update({ where: { id }, data: { isActive: true } });
  return getMenuById(id);
}
