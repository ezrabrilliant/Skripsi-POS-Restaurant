// Sinkronisasi katalog menu ke DB existing tanpa merusak riwayat transaksi.
//
// Strategi:
// 1. Untuk tiap item di MENU_CATALOG -> cari by name; bila ada update
//    category/price/imageUrl/isActive=true, bila tidak ada insert baru.
// 2. Item lama yang TIDAK ada di katalog baru di-set isActive=false (bukan
//    dihapus) supaya FK TransactionItem.menuId tetap valid dan riwayat
//    historis bisa dilihat lengkap.
//
// Riwayat harga lama tetap aman karena TransactionItem.unit_price adalah
// snapshot pada saat order (bukan join ke Menu.price saat ini).
//
// Jalankan: npm run menu:update

import { PrismaClient } from '@prisma/client';
import { MENU_CATALOG } from '../prisma/menu-catalog';

const prisma = new PrismaClient();

async function main() {
  console.log(`Sinkron ${MENU_CATALOG.length} item katalog ke DB...`);

  let created = 0;
  let updated = 0;

  for (const item of MENU_CATALOG) {
    const existing = await prisma.menu.findFirst({ where: { name: item.name } });
    if (existing) {
      await prisma.menu.update({
        where: { id: existing.id },
        data: {
          category: item.category,
          price: item.price,
          imageUrl: item.imageUrl ?? null,
          isActive: true,
        },
      });
      updated += 1;
    } else {
      await prisma.menu.create({
        data: {
          name: item.name,
          category: item.category,
          price: item.price,
          imageUrl: item.imageUrl ?? null,
        },
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
  console.log(`  ~ ${updated} item di-update (harga/kategori/foto)`);
  console.log(`  - ${deactivated.count} item lama di-nonaktifkan (tidak ada di katalog baru)`);

  // Ringkas isi DB setelah sinkron.
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
