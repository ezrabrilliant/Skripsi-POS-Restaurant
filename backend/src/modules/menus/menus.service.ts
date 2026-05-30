// Service modul menus. REV 2.2: 3 stockType (portion / linked / nonStock) +
// subOptions JSON untuk paket. Sinkronisasi PortionStock saat:
//   - create menu stockType=portion -> auto-create PortionStock {qty: 0, minStock}
//   - update minStock pada menu portion -> sync ke PortionStock.minStock
//   - update stockType beralih dari non-portion ke portion -> create PortionStock
//   - update stockType beralih dari portion ke non-portion -> biarkan PortionStock
//     (history tetap utuh; tidak akan auto-decrement lagi karena menu tidak portion)
//   - soft delete (isActive=false) -> tidak menyentuh PortionStock

import { Prisma, StockType, MenuKind } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError, notFound } from '../../utils/errors';
import type {
  CreateMenuInput,
  UpdateMenuInput,
  ListMenuQuery,
  MenuUpsertInput,
} from './menus.schema';

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
  kind: MenuKind; // REV 2.10: simple | variant | paket
  posVisible: boolean; // REV 2.10: tampil di grid POS?
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
    kind: menu.kind,
    posVisible: menu.posVisible,
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

export async function listMenus(query: ListMenuQuery): Promise<MenuDetail[]> {
  // REV 2.10: POS/public mode (includeHidden=false) → hanya posVisible=true.
  // Owner mode (includeHidden=true) → semua menu termasuk SKU stok tersembunyi.
  // activeOnly tetap berlaku independen (default true).
  const menus = await prisma.menu.findMany({
    where: {
      isActive: query.activeOnly ? true : undefined,
      posVisible: query.includeHidden ? undefined : true,
      category: query.category,
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    include: menuDetailInclude,
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
    const detail = toMenuDetail(m);
    if (salesMap) detail.salesCount = salesMap.get(m.id) ?? 0;
    return detail;
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

// ============================================================
// REV 2.10 — Catalog detail (option groups + variants + paket)
// ============================================================

export interface MenuOptionDetail {
  id: number;
  label: string;
  displayOrder: number;
}
export interface MenuOptionGroupDetail {
  id: number;
  name: string;
  affectsVariant: boolean;
  displayOrder: number;
  options: MenuOptionDetail[];
}
export interface MenuVariantDetail {
  id: number;
  label: string;
  price: number;
  stockTargetMenuId: number | null;
  isActive: boolean;
  displayOrder: number;
  // optionIds penyusun varian (untuk grup affectsVariant=true)
  optionIds: number[];
}
export interface PaketChoiceOptionDetail {
  id: number;
  label: string;
  targetMenuId: number | null;
  targetVariantId: number | null;
  upcharge: number;
}
export interface PaketComponentDetail {
  id: number;
  kind: 'fixed' | 'choice';
  label: string;
  qty: number;
  displayOrder: number;
  targetMenuId: number | null;
  targetVariantId: number | null;
  choiceOptions: PaketChoiceOptionDetail[];
}

export interface MenuDetail extends MenuView {
  optionGroups: MenuOptionGroupDetail[];
  variants: MenuVariantDetail[];
  paketComponents: PaketComponentDetail[];
}

const menuDetailInclude = {
  portionStock: true,
  optionGroups: {
    orderBy: { displayOrder: 'asc' },
    include: { options: { orderBy: { displayOrder: 'asc' } } },
  },
  variants: {
    orderBy: { displayOrder: 'asc' },
    include: { options: true },
  },
  paketComponents: {
    orderBy: { displayOrder: 'asc' },
    include: { choiceOptions: true },
  },
} satisfies Prisma.MenuInclude;

type MenuWithDetail = Prisma.MenuGetPayload<{ include: typeof menuDetailInclude }>;

function toMenuDetail(menu: MenuWithDetail): MenuDetail {
  return {
    ...toMenuView(menu),
    optionGroups: menu.optionGroups.map((g) => ({
      id: g.id,
      name: g.name,
      affectsVariant: g.affectsVariant,
      displayOrder: g.displayOrder,
      options: g.options.map((o) => ({
        id: o.id,
        label: o.label,
        displayOrder: o.displayOrder,
      })),
    })),
    variants: menu.variants.map((v) => ({
      id: v.id,
      label: v.label,
      price: v.price.toNumber(),
      stockTargetMenuId: v.stockTargetMenuId,
      isActive: v.isActive,
      displayOrder: v.displayOrder,
      optionIds: v.options.map((vo) => vo.optionId),
    })),
    paketComponents: menu.paketComponents.map((c) => ({
      id: c.id,
      kind: c.kind,
      label: c.label,
      qty: c.qty,
      displayOrder: c.displayOrder,
      targetMenuId: c.targetMenuId,
      targetVariantId: c.targetVariantId,
      choiceOptions: c.choiceOptions.map((co) => ({
        id: co.id,
        label: co.label,
        targetMenuId: co.targetMenuId,
        targetVariantId: co.targetVariantId,
        upcharge: co.upcharge.toNumber(),
      })),
    })),
  };
}

export async function getMenuDetail(id: number): Promise<MenuDetail> {
  const menu = await prisma.menu.findUnique({
    where: { id },
    include: menuDetailInclude,
  });
  if (!menu) throw new AppError('Menu tidak ditemukan', 404);
  return toMenuDetail(menu);
}

// ============================================================
// REV 2.10 — Upsert builder (create + update, replace-children strategy)
// ============================================================

const STOCK_TYPE_MAP: Record<MenuUpsertInput['stockType'], StockType> = {
  portion: StockType.portion,
  linked: StockType.linked,
  nonStock: StockType.nonStock,
};
const MENU_KIND_MAP: Record<MenuUpsertInput['kind'], MenuKind> = {
  simple: MenuKind.simple,
  variant: MenuKind.variant,
  paket: MenuKind.paket,
};

/**
 * REV 2.10: create (id=null) atau update menu lengkap dengan catalog layer.
 * Strategi replace-children: pada UPDATE, hapus dulu optionGroups (cascade →
 * options + variant-options), variants, paketComponents (cascade → choiceOptions)
 * milik menu ini, lalu recreate dari input. Paling sederhana yang benar.
 */
export async function upsertMenu(
  id: number | null,
  input: MenuUpsertInput,
): Promise<MenuDetail> {
  const stockType = STOCK_TYPE_MAP[input.stockType];
  const kind = MENU_KIND_MAP[input.kind];

  const menuId = await prisma.$transaction(async (tx) => {
    // Validasi referensi stock target (varian) + paket target DI DALAM transaksi
    // supaya garansi AppError(400) atomic (tidak ada race antara validate & write).
    await validateMenuReferences(tx, input);

    // 1. Base menu (create atau update)
    let baseId: number;
    if (id === null) {
      const created = await tx.menu.create({
        data: {
          name: input.name,
          category: input.category,
          price: new Prisma.Decimal(input.price),
          stockType,
          kind,
          posVisible: input.posVisible,
          minStock: input.minStock ?? null,
          imageUrl: input.imageUrl ?? null,
        },
      });
      baseId = created.id;
    } else {
      const existing = await tx.menu.findUnique({ where: { id }, include: { portionStock: true } });
      if (!existing) throw new AppError('Menu tidak ditemukan', 404);
      await tx.menu.update({
        where: { id },
        data: {
          name: input.name,
          category: input.category,
          price: new Prisma.Decimal(input.price),
          stockType,
          kind,
          posVisible: input.posVisible,
          minStock: input.minStock ?? null,
          imageUrl: input.imageUrl ?? null,
        },
      });
      baseId = id;
      // Replace-children: hapus catalog lama (cascade hilangkan turunannya).
      await tx.menuOptionGroup.deleteMany({ where: { menuId: baseId } });
      await tx.menuVariant.deleteMany({ where: { menuId: baseId } });
      await tx.paketComponent.deleteMany({ where: { paketMenuId: baseId } });
    }

    // 2. Sync PortionStock (sejajar dengan createMenu/updateMenu legacy).
    if (stockType === StockType.portion) {
      const ps = await tx.portionStock.findUnique({ where: { menuId: baseId } });
      const nextMin = input.minStock ?? 0;
      if (ps) {
        await tx.portionStock.update({ where: { menuId: baseId }, data: { minStock: nextMin } });
      } else {
        await tx.portionStock.create({ data: { menuId: baseId, currentQty: 0, minStock: nextMin } });
      }
    }

    // 3. Option groups + options. Bangun lookup affectsVariant groups:
    //    groupName -> { groupOrder, labelToOptionId: Map<label, optionId> }
    const variantGroupLookup = new Map<
      string,
      { groupOrder: number; labelToOptionId: Map<string, number> }
    >();
    for (const group of input.optionGroups) {
      const createdGroup = await tx.menuOptionGroup.create({
        data: {
          menuId: baseId,
          name: group.name,
          affectsVariant: group.affectsVariant,
          displayOrder: group.displayOrder,
        },
      });
      const labelToOptionId = new Map<string, number>();
      for (const opt of group.options) {
        const createdOpt = await tx.menuOption.create({
          data: {
            optionGroupId: createdGroup.id,
            label: opt.label,
            displayOrder: opt.displayOrder,
          },
        });
        labelToOptionId.set(opt.label, createdOpt.id);
      }
      // Hanya grup affectsVariant=true yang membentuk varian.
      if (group.affectsVariant) {
        variantGroupLookup.set(group.name, {
          groupOrder: group.displayOrder,
          labelToOptionId,
        });
      }
    }

    // 4. Variants + variant-options (link ke option dari grup affectsVariant).
    for (const variant of input.variants) {
      const createdVariant = await tx.menuVariant.create({
        data: {
          menuId: baseId,
          label: variant.label,
          price: new Prisma.Decimal(variant.price),
          stockTargetMenuId: variant.stockTargetMenuId,
          isActive: variant.isActive,
          displayOrder: variant.displayOrder,
        },
      });
      for (const [groupName, optionLabel] of Object.entries(variant.optionLabels)) {
        const groupEntry = variantGroupLookup.get(groupName);
        // optionLabels yang merujuk grup non-affectsVariant (atau tidak ada) → abaikan
        // bila grup tidak ada di affectsVariant set, dianggap error referensi.
        if (!groupEntry) {
          throw new AppError(
            `Varian "${variant.label}" mereferensikan opsi yang tidak ada`,
            400,
          );
        }
        const optionId = groupEntry.labelToOptionId.get(optionLabel);
        if (optionId === undefined) {
          throw new AppError(
            `Varian "${variant.label}" mereferensikan opsi yang tidak ada`,
            400,
          );
        }
        await tx.menuVariantOption.create({
          data: { menuVariantId: createdVariant.id, optionId },
        });
      }
    }

    // 5. Paket components + choice options.
    for (const comp of input.paketComponents) {
      const createdComp = await tx.paketComponent.create({
        data: {
          paketMenuId: baseId,
          kind: comp.kind,
          label: comp.label,
          qty: comp.qty,
          displayOrder: comp.displayOrder,
          targetMenuId: comp.targetMenuId,
          targetVariantId: comp.targetVariantId,
        },
      });
      for (const co of comp.choiceOptions) {
        await tx.paketChoiceOption.create({
          data: {
            paketComponentId: createdComp.id,
            label: co.label,
            targetMenuId: co.targetMenuId,
            targetVariantId: co.targetVariantId,
            upcharge: new Prisma.Decimal(co.upcharge),
          },
        });
      }
    }

    return baseId;
  });

  return getMenuDetail(menuId);
}

/**
 * Validasi keberadaan semua referensi target (menu + variant) sebelum write.
 * Throw AppError 400 dengan pesan jelas kalau ada yang tidak ditemukan.
 * Dipanggil DI DALAM transaksi (pakai tx client) supaya garansi 400 atomic.
 */
async function validateMenuReferences(
  tx: Prisma.TransactionClient,
  input: MenuUpsertInput,
): Promise<void> {
  const menuIds = new Set<number>();
  const variantIds = new Set<number>();

  for (const v of input.variants) {
    if (v.stockTargetMenuId !== null) menuIds.add(v.stockTargetMenuId);
  }
  for (const c of input.paketComponents) {
    if (c.targetMenuId !== null) menuIds.add(c.targetMenuId);
    if (c.targetVariantId !== null) variantIds.add(c.targetVariantId);
    for (const co of c.choiceOptions) {
      if (co.targetMenuId !== null) menuIds.add(co.targetMenuId);
      if (co.targetVariantId !== null) variantIds.add(co.targetVariantId);
    }
  }

  if (menuIds.size > 0) {
    const found = await tx.menu.findMany({
      where: { id: { in: [...menuIds] } },
      select: { id: true },
    });
    const foundSet = new Set(found.map((m) => m.id));
    const missing = [...menuIds].filter((mid) => !foundSet.has(mid));
    if (missing.length > 0) {
      throw new AppError(`Menu target tidak ditemukan: id ${missing.join(', ')}`, 400);
    }
  }

  if (variantIds.size > 0) {
    const found = await tx.menuVariant.findMany({
      where: { id: { in: [...variantIds] } },
      select: { id: true },
    });
    const foundSet = new Set(found.map((v) => v.id));
    const missing = [...variantIds].filter((vid) => !foundSet.has(vid));
    if (missing.length > 0) {
      throw new AppError(`Variant target tidak ditemukan: id ${missing.join(', ')}`, 400);
    }
  }
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
