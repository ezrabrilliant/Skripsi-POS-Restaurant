// Seeder data awal REV 2.11. Dijalankan dengan: npm run db:seed
//
// Yang di-seed:
//   1. Users riil (Owner + 3 kasir + 2 waiter) dengan PIN default (boleh duplikat).
//   2. Menu catalog (60 item: stok porsi + linked + non-stok + 5 paket).
//   3. PortionStock untuk setiap menu stockType=portion (currentQty=0 awal, opening=0).
//   4. Katalog varian REV 2.10 (struktur variant/paket/hidden-SKU identik dengan prod).
//   5. Payment methods + banks + default junctions (REV 2.6).
//   6. AppSetting singleton (PB1 default OFF).
//
// REV 2.11: seed Units + RawMaterial + Vendor dihapus (belanja/raw-materials out of
// scope; biaya bahan baku ditangani via COGS per menu).
//
// Seed idempotent: user upserted by (name), menu hanya di-seed kalau tabel kosong.

import { PrismaClient, UserRole, StockType } from '@prisma/client';
import { MENU_CATALOG } from './menu-catalog';
import { seedPaymentMethods } from '../scripts/seed-payment-methods';
import { applyVariantCatalog } from '../scripts/backfill-menu-variants';

const prisma = new PrismaClient();

// 6 user riil. PIN boleh duplikat antar pegawai (identifikasi via nama).
// REV 2.3 catatan: setiap login pegawai ketik nama manual (no list picker).
const users = [
  { name: 'Owner', pin: '123456', role: UserRole.owner },
  { name: 'Jason', pin: '111111', role: UserRole.cashier },
  { name: 'Bryant', pin: '111111', role: UserRole.cashier },
  { name: 'Chen Hong', pin: '111111', role: UserRole.cashier },
  { name: 'Amel', pin: '222222', role: UserRole.waiter },
  { name: 'Yanti', pin: '222222', role: UserRole.waiter },
];

// Mapping string ke enum Prisma untuk MENU_CATALOG.stockType.
const STOCK_TYPE_MAP: Record<string, StockType> = {
  portion: StockType.portion,
  linked: StockType.linked,
  nonStock: StockType.nonStock,
};

async function seedUsers() {
  console.log('Menanam user awal...');
  for (const u of users) {
    // PIN boleh duplikat, upsert by name (asumsi nama unik per resto).
    const existing = await prisma.user.findFirst({ where: { name: u.name } });
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { pin: u.pin, role: u.role, isActive: true },
      });
    } else {
      await prisma.user.create({ data: u });
    }
    console.log(`  ✓ ${u.name} (PIN ${u.pin}, role ${u.role})`);
  }
}

async function seedMenus() {
  const menuCount = await prisma.menu.count();
  if (menuCount > 0) {
    console.log(`Katalog menu sudah berisi ${menuCount} item - seed menu dilewati.`);
    return;
  }

  console.log('Menanam katalog menu...');
  for (const item of MENU_CATALOG) {
    const menu = await prisma.menu.create({
      data: {
        name: item.name,
        category: item.category,
        price: item.price,
        stockType: STOCK_TYPE_MAP[item.stockType],
        minStock: item.minStock ?? null,
        imageUrl: item.imageUrl ?? null,
        subOptions: item.subOptions ?? undefined,
      },
    });
    if (item.stockType === 'portion') {
      // REV 2.2: tambah minStock duplicate + opening_qty_today/date default 0/today.
      await prisma.portionStock.create({
        data: {
          menuId: menu.id,
          currentQty: 0,
          minStock: item.minStock ?? 0,
        },
      });
    }
  }
  console.log(`  ✓ ${MENU_CATALOG.length} menu ditambahkan`);
  const portionCount = MENU_CATALOG.filter((m) => m.stockType === 'portion').length;
  console.log(`  ✓ ${portionCount} PortionStock dibuat (qty awal 0)`);
}

// REV 2.6: singleton app settings (id=1). Default PB1 OFF - resto tidak charge
// PB1 ke customer (harga menu = final). Owner bisa nyalakan via tab Pajak.
async function seedAppSetting() {
  console.log('Menanam AppSetting (PB1 default OFF, rate 10%)...');
  await prisma.appSetting.upsert({
    where: { id: 1 },
    update: {}, // jangan timpa kalau owner sudah ubah
    create: { id: 1, taxEnabled: false, taxRate: 10 },
  });
  console.log('  ✓ AppSetting singleton siap');
}

async function main() {
  await seedUsers();
  await seedMenus();
  // REV 2.10: terapkan katalog varian (sama persis dengan backfill DB lama) supaya
  // fresh DB punya struktur variant/paket/hidden-SKU identik. Idempotent.
  console.log('Menerapkan katalog varian REV 2.10...');
  await applyVariantCatalog(prisma);
  // REV 2.6: master payment_methods + banks + default junctions.
  await seedPaymentMethods(prisma);
  await seedAppSetting();
  console.log('\nSeed selesai (REV 2.11). Login default:');
  console.log('  Owner    → nama "Owner", PIN 123456');
  console.log('  Kasir    → nama Jason/Bryant/Chen Hong, PIN 111111');
  console.log('  Waiter   → nama Amel/Yanti, PIN 222222');
  console.log('\nREV 2.3 catatan: form login = input nama + PIN murni (no list picker).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
