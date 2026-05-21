// Logika bisnis modul menu: katalog menu siap jual.

import type { Menu, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError, notFound } from '../../utils/errors';
import type { CreateMenuInput, UpdateMenuInput, ListMenuQuery } from './menus.schema';

/** Bentuk menu untuk respons API — Decimal price diubah jadi number. */
export type MenuDto = Omit<Menu, 'price'> & { price: number };

function toDto(menu: Menu): MenuDto {
  return { ...menu, price: Number(menu.price) };
}

/** Daftar menu dengan filter opsional kategori / status / pencarian nama. */
export async function listMenus(query: ListMenuQuery): Promise<MenuDto[]> {
  const where: Prisma.MenuWhereInput = {};
  if (query.category) where.category = query.category;
  if (query.isActive !== undefined) where.isActive = query.isActive;
  if (query.search) where.name = { contains: query.search };

  const menus = await prisma.menu.findMany({
    where,
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
  return menus.map(toDto);
}

/** Ambil satu menu berdasarkan id. */
export async function getMenuById(id: number): Promise<MenuDto> {
  const menu = await prisma.menu.findUnique({ where: { id } });
  if (!menu) throw notFound('Menu');
  return toDto(menu);
}

/** Daftar kategori unik yang ada di katalog. */
export async function getCategories(): Promise<string[]> {
  const rows = await prisma.menu.findMany({
    distinct: ['category'],
    select: { category: true },
    orderBy: { category: 'asc' },
  });
  return rows.map((r) => r.category);
}

/** Tambah menu baru. */
export async function createMenu(input: CreateMenuInput): Promise<MenuDto> {
  const menu = await prisma.menu.create({ data: input });
  return toDto(menu);
}

/** Ubah menu. */
export async function updateMenu(id: number, input: UpdateMenuInput): Promise<MenuDto> {
  await getMenuById(id); // pastikan ada
  const menu = await prisma.menu.update({ where: { id }, data: input });
  return toDto(menu);
}

/**
 * Hapus menu. Ditolak bila menu sudah dipakai pada transaksi atau stok harian
 * — untuk menjaga integritas riwayat. Sarankan non-aktifkan (isActive=false).
 */
export async function deleteMenu(id: number): Promise<void> {
  await getMenuById(id); // pastikan ada

  const usedInItems = await prisma.transactionItem.count({ where: { menuId: id } });
  const usedInStock = await prisma.dailyMenuStock.count({ where: { menuId: id } });
  if (usedInItems > 0 || usedInStock > 0) {
    throw new AppError(
      'Menu sudah dipakai dalam transaksi atau stok harian. Non-aktifkan menu (isActive=false), jangan dihapus.',
      409,
    );
  }

  await prisma.menu.delete({ where: { id } });
}
