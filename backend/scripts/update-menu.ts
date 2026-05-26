// Sinkronisasi katalog menu ke DB existing tanpa merusak riwayat transaksi.
//
// Strategi:
// 1. Untuk tiap item di MENU_CATALOG -> cari by name; bila ada update FULL
//    (name/category/price/stockType/minStock/imageUrl/subOptions/isActive=true),
//    bila tidak ada insert baru.
// 2. Item lama yang TIDAK ada di katalog baru di-set isActive=false (bukan
//    dihapus) supaya FK TransactionItem.menuId tetap valid dan riwayat
//    historis bisa dilihat lengkap.
// 3. PortionStock auto-sync untuk stockType=portion: create kalau belum ada,
//    update minStock kalau sudah ada. currentQty TIDAK diutak-atik.
//
// Riwayat harga lama tetap aman karena TransactionItem.unit_price adalah
// snapshot pada saat order (bukan join ke Menu.price saat ini).
//
// Jalankan: npm run menu:update

import { PrismaClient, Prisma, StockType } from '@prisma/client';
import { MENU_CATALOG } from '../prisma/menu-catalog';

const prisma = new PrismaClient();

const STOCK_TYPE_MAP: Record<string, StockType> = {
  portion: StockType.portion,
  linked: StockType.linked,
  nonStock: StockType.nonStock,
};

async function main() {
  console.log(`Sinkron ${MENU_CATALOG.length} item katalog ke DB...`);

  let created = 0;
  let updated = 0;

  for (const item of MENU_CATALOG) {
    const stockType = STOCK_TYPE_MAP[item.stockType];
    const subOptionsValue =
      item.subOptions === undefined ? Prisma.JsonNull : (item.subOptions as Prisma.InputJsonValue);

    const existing = await prisma.menu.findFirst({ where: { name: item.name } });

    if (existing) {
      await prisma.$transaction(async (tx) => {
        await tx.menu.update({
          where: { id: existing.id },
          data: {
            category: item.category,
            price: item.price,
            stockType,
            minStock: item.minStock ?? null,
            imageUrl: item.imageUrl ?? null,
            subOptions: subOptionsValue,
            isActive: true,
          },
        });
        // PortionStock sync untuk stockType=portion. Create kalau belum ada
        // (kasus menu beralih dari linked/nonStock -> portion); update minStock
        // kalau sudah ada. currentQty TIDAK dimodifikasi - history utuh.
        if (item.stockType === 'portion') {
          const existingStock = await tx.portionStock.findUnique({
            where: { menuId: existing.id },
          });
          if (existingStock) {
            await tx.portionStock.update({
              where: { menuId: existing.id },
              data: { minStock: item.minStock ?? 0 },
            });
          } else {
            await tx.portionStock.create({
              data: {
                menuId: existing.id,
                currentQty: 0,
                minStock: item.minStock ?? 0,
              },
            });
          }
        }
      });
      updated += 1;
    } else {
      await prisma.$transaction(async (tx) => {
        const newMenu = await tx.menu.create({
          data: {
            name: item.name,
            category: item.category,
            price: item.price,
            stockType,
            minStock: item.minStock ?? null,
            imageUrl: item.imageUrl ?? null,
            subOptions: item.subOptions === undefined ? undefined : (item.subOptions as Prisma.InputJsonValue),
          },
        });
        if (item.stockType === 'portion') {
          await tx.portionStock.create({
            data: {
              menuId: newMenu.id,
              currentQty: 0,
              minStock: item.minStock ?? 0,
            },
          });
        }
      });
      created += 1;
    }
  }

  // Nonaktifkan item lama yang tidak ada di katalog baru. Tidak dihapus
  // supaya FK ke transaksi historis tetap valid.
  const catalogNames = MENU_CATALOG.map((m) => m.name);
  const deactivated = await prisma.menu.updateMany({
    where: { name: { notIn: catalogNames }, isActive: true },
    data: { isActive: false },
  });

  console.log(`  + ${created} item baru ditambahkan`);
  console.log(`  ~ ${updated} item di-update (full sync)`);
  console.log(`  - ${deactivated.count} item lama di-nonaktifkan (tidak ada di katalog baru)`);

  const active = await prisma.menu.count({ where: { isActive: true } });
  const inactive = await prisma.menu.count({ where: { isActive: false } });
  console.log(`Total: ${active} aktif, ${inactive} nonaktif.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
