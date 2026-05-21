// Logika bisnis modul stok harian (daily_menu_stocks).
// Stok pagi diinput Kitchen; current_stock berkurang otomatis saat pembayaran.

import { prisma } from '../../config/prisma';
import { AppError, notFound } from '../../utils/errors';
import { todayString, toDateOnly, addDays } from '../../utils/date';
import type { CreateStockInput, BulkStockInput, UpdateStockInput } from './stocks.schema';

/** Bentuk entri stok untuk respons API. */
export interface StockDto {
  id: number;
  date: string;
  menuId: number;
  menuName: string;
  category: string;
  openingStock: number;
  currentStock: number;
}

type StockWithMenu = {
  id: number;
  date: Date;
  menuId: number;
  openingStock: number;
  currentStock: number;
  menu: { name: string; category: string };
};

function toDto(row: StockWithMenu): StockDto {
  return {
    id: row.id,
    date: row.date.toISOString().slice(0, 10),
    menuId: row.menuId,
    menuName: row.menu.name,
    category: row.menu.category,
    openingStock: row.openingStock,
    currentStock: row.currentStock,
  };
}

/** Daftar stok untuk satu tanggal (default hari ini). */
export async function listStocks(dateStr?: string): Promise<StockDto[]> {
  const date = toDateOnly(dateStr ?? todayString());
  const rows = await prisma.dailyMenuStock.findMany({
    where: { date },
    include: { menu: { select: { name: true, category: true } } },
    orderBy: [{ menu: { category: 'asc' } }, { menu: { name: 'asc' } }],
  });
  return rows.map(toDto);
}

/** Tambah/perbarui satu entri stok. Saat input pagi, current = opening. */
export async function createStock(input: CreateStockInput): Promise<StockDto> {
  const date = toDateOnly(input.date ?? todayString());

  const menu = await prisma.menu.findUnique({ where: { id: input.menuId } });
  if (!menu) throw notFound('Menu');

  const row = await prisma.dailyMenuStock.upsert({
    where: { date_menuId: { date, menuId: input.menuId } },
    create: {
      date,
      menuId: input.menuId,
      openingStock: input.openingStock,
      currentStock: input.openingStock,
    },
    update: { openingStock: input.openingStock, currentStock: input.openingStock },
    include: { menu: { select: { name: true, category: true } } },
  });
  return toDto(row);
}

/** Input stok pagi sekaligus banyak menu (alur Kitchen). */
export async function bulkUpsertStocks(input: BulkStockInput): Promise<StockDto[]> {
  const date = toDateOnly(input.date ?? todayString());

  // Pastikan semua menu valid sebelum menulis.
  const menuIds = input.items.map((i) => i.menuId);
  const found = await prisma.menu.count({ where: { id: { in: menuIds } } });
  if (found !== new Set(menuIds).size) {
    throw new AppError('Ada menuId yang tidak valid pada daftar item', 400);
  }

  await prisma.$transaction(
    input.items.map((item) =>
      prisma.dailyMenuStock.upsert({
        where: { date_menuId: { date, menuId: item.menuId } },
        create: {
          date,
          menuId: item.menuId,
          openingStock: item.openingStock,
          currentStock: item.openingStock,
        },
        update: { openingStock: item.openingStock, currentStock: item.openingStock },
      }),
    ),
  );

  return listStocks(input.date);
}

/** Koreksi entri stok yang sudah ada. */
export async function updateStock(id: number, input: UpdateStockInput): Promise<StockDto> {
  const existing = await prisma.dailyMenuStock.findUnique({ where: { id } });
  if (!existing) throw notFound('Entri stok');

  const row = await prisma.dailyMenuStock.update({
    where: { id },
    data: input,
    include: { menu: { select: { name: true, category: true } } },
  });
  return toDto(row);
}

/** Hapus semua entri stok hari ini — agar Kitchen bisa input ulang dari awal. */
export async function resetToday(): Promise<{ deleted: number }> {
  const date = toDateOnly(todayString());
  const result = await prisma.dailyMenuStock.deleteMany({ where: { date } });
  return { deleted: result.count };
}

/** Salin stok kemarin ke hari ini (hanya menu yang belum punya entri hari ini). */
export async function copyFromYesterday(): Promise<StockDto[]> {
  const todayStr = todayString();
  const today = toDateOnly(todayStr);
  const yesterday = toDateOnly(addDays(todayStr, -1));

  const yesterdayRows = await prisma.dailyMenuStock.findMany({ where: { date: yesterday } });
  if (yesterdayRows.length === 0) {
    throw new AppError('Tidak ada data stok kemarin untuk disalin', 404);
  }

  const todayRows = await prisma.dailyMenuStock.findMany({
    where: { date: today },
    select: { menuId: true },
  });
  const alreadyHas = new Set(todayRows.map((r) => r.menuId));

  const toCreate = yesterdayRows
    .filter((r) => !alreadyHas.has(r.menuId))
    .map((r) => ({
      date: today,
      menuId: r.menuId,
      openingStock: r.openingStock,
      currentStock: r.openingStock,
    }));

  if (toCreate.length > 0) {
    await prisma.dailyMenuStock.createMany({ data: toCreate });
  }
  return listStocks(todayStr);
}

/** Hasil pengecekan apakah opname stok pagi sudah dilakukan. */
export interface StockStatus {
  date: string;
  opnameDone: boolean;
  totalActiveMenus: number;
  filledMenus: number;
  missingMenus: { id: number; name: string }[];
}

/** Cek status opname stok untuk satu tanggal (default hari ini). */
export async function getStockStatus(dateStr?: string): Promise<StockStatus> {
  const str = dateStr ?? todayString();
  const date = toDateOnly(str);

  const activeMenus = await prisma.menu.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });
  const stocks = await prisma.dailyMenuStock.findMany({
    where: { date },
    select: { menuId: true },
  });
  const filledIds = new Set(stocks.map((s) => s.menuId));
  const missingMenus = activeMenus.filter((m) => !filledIds.has(m.id));

  return {
    date: str,
    opnameDone: filledIds.size > 0 && missingMenus.length === 0,
    totalActiveMenus: activeMenus.length,
    filledMenus: activeMenus.length - missingMenus.length,
    missingMenus,
  };
}
