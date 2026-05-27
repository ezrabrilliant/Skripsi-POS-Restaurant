// Seeder data awal REV 2.5.1. Dijalankan dengan: npm run db:seed
//
// Yang di-seed:
//   1. Users riil (Owner + 3 kasir + 2 waiter) dengan PIN default (boleh duplikat).
//   2. Menu catalog (60 item: stok porsi + linked + non-stok + 5 paket).
//   3. PortionStock untuk setiap menu stockType=portion (currentQty=0 awal, opening=0).
//   4. Units (10 pre-defined: kg/gram/liter/butir/balok/karung/ikat/batang/pcs/skala 0-5).
//   5. RawMaterial awal (6 item, semua always tracked: Beras, Kangkung, Petai, Tahu, Tempe, Telur).
//   6. Vendor awal (3 vendor contoh: Pasar Pagi, Bu Sari, Toko Pak Budi).
//
// REV 2.5.1 catatan: is_tracked column dropped. Semua master = always tracked.
// Bumbu dasar + ayam mentah + ikan mentah TIDAK ada master — di-catat sebagai
// free-form line item di PurchaseItem (label + subtotal, no FK).
//
// Seed idempotent: user upserted by (name), menu hanya di-seed kalau tabel kosong,
// raw_material upserted by (name), vendor upserted by (name+type).

import { PrismaClient, UserRole, StockType, RawMaterialCategory, OpnameMode } from '@prisma/client';
import { MENU_CATALOG } from './menu-catalog';
import { seedPaymentMethods } from '../scripts/seed-payment-methods';

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

// REV 2.5: Pre-defined units. Owner bisa add custom unit via UnitDropdown.
// opnameMode 'exact' = input angka bulat/desimal (kg, gram, dll).
// opnameMode 'scale_0_5' = pilih skala 0-5 (beras karung yang ngga bisa ditimbang exact).
// Label 'skala 0-5' explicit untuk owner clarity di dropdown — bisa di-distinguish
// dari scale unit lain (mis. 'skala 1-10') kalau owner tambah custom unit nanti.
const unitSeeds: { label: string; opnameMode: OpnameMode }[] = [
  { label: 'kg', opnameMode: OpnameMode.exact },
  { label: 'gram', opnameMode: OpnameMode.exact },
  { label: 'liter', opnameMode: OpnameMode.exact },
  { label: 'butir', opnameMode: OpnameMode.exact },
  { label: 'balok', opnameMode: OpnameMode.exact },
  { label: 'karung', opnameMode: OpnameMode.exact },
  { label: 'ikat', opnameMode: OpnameMode.exact },
  { label: 'batang', opnameMode: OpnameMode.exact },
  { label: 'pcs', opnameMode: OpnameMode.exact },
  { label: 'skala 0-5', opnameMode: OpnameMode.scale_0_5 },
];

// Raw materials awal sesuai tabel di docs/operasional-resto.md REV 2.5.1 seksi
// "Raw Materials (Stok Bahan Baku) dan Reminder".
//
// REV 2.5.1: semua master = always tracked. Bumbu dasar + ayam mentah + ikan mentah
// TIDAK ada master — di-catat sebagai free-form line item di PurchaseItem (label +
// subtotal, no FK). is_tracked column dropped dari schema.
//
// REV 2.5: field `unit` (string) diganti `unitLabel` yang di-resolve ke unitId saat seed.
interface RawMaterialSeed {
  name: string;
  unitLabel: string;
  category: RawMaterialCategory;
  minStock?: number;
  freshnessDays?: number;
}

const rawMaterials: RawMaterialSeed[] = [
  { name: 'Beras', unitLabel: 'skala 0-5', category: RawMaterialCategory.bahanPokok, minStock: 1 },
  { name: 'Kangkung', unitLabel: 'ikat', category: RawMaterialCategory.bahanSegar, minStock: 1, freshnessDays: 10 },
  { name: 'Petai', unitLabel: 'ikat', category: RawMaterialCategory.bahanSegar, minStock: 1, freshnessDays: 10 },
  { name: 'Tahu', unitLabel: 'balok', category: RawMaterialCategory.bahanPokok, minStock: 2 },
  { name: 'Tempe', unitLabel: 'balok', category: RawMaterialCategory.bahanPokok, minStock: 2 },
  { name: 'Telur', unitLabel: 'butir', category: RawMaterialCategory.bahanPokok, minStock: 3 },
];

// Vendor awal sebagai contoh (opsional, bisa ditambah inline saat input purchase).
const vendors = [
  { name: 'Pasar Pagi Blok A', type: 'pasar' },
  { name: 'Bu Sari', type: 'individu' },
  { name: 'Toko Pak Budi', type: 'toko' },
];

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

async function seedUnits(): Promise<Map<string, number>> {
  console.log('Menanam Unit awal (REV 2.5)...');
  const unitByLabel = new Map<string, number>();
  for (const u of unitSeeds) {
    const created = await prisma.unit.upsert({
      where: { label: u.label },
      update: {},
      create: u,
    });
    unitByLabel.set(created.label, created.id);
  }
  console.log(`  ✓ Seeded ${unitSeeds.length} units`);
  return unitByLabel;
}

async function seedRawMaterials(unitByLabel: Map<string, number>) {
  console.log('Menanam RawMaterial awal (REV 2.5)...');
  for (const rm of rawMaterials) {
    const existing = await prisma.rawMaterial.findFirst({ where: { name: rm.name } });
    if (existing) {
      console.log(`  · ${rm.name} sudah ada, dilewati`);
      continue;
    }
    const unitId = unitByLabel.get(rm.unitLabel);
    if (!unitId) {
      throw new Error(
        `Unit "${rm.unitLabel}" untuk raw material "${rm.name}" tidak ditemukan di unitSeeds. ` +
          `Pastikan label ada di array unitSeeds atau tambahkan dulu.`,
      );
    }
    await prisma.rawMaterial.create({
      data: {
        name: rm.name,
        unitId,
        category: rm.category,
        stockQty: 0,
        minStock: rm.minStock ?? null,
        freshnessDays: rm.freshnessDays ?? null,
      },
    });
    console.log(`  ✓ ${rm.name} (${rm.unitLabel}, ${rm.category})`);
  }
}

async function seedVendors() {
  console.log('Menanam Vendor awal (REV 2.1)...');
  for (const v of vendors) {
    const existing = await prisma.vendor.findFirst({
      where: { name: v.name, type: v.type },
    });
    if (existing) {
      console.log(`  · ${v.name} sudah ada, dilewati`);
      continue;
    }
    await prisma.vendor.create({ data: v });
    console.log(`  ✓ ${v.name} (${v.type})`);
  }
}

async function main() {
  await seedUsers();
  await seedMenus();
  const unitByLabel = await seedUnits();
  await seedRawMaterials(unitByLabel);
  await seedVendors();
  // REV 2.6: master payment_methods + banks + default junctions.
  await seedPaymentMethods(prisma);
  console.log('\nSeed selesai (REV 2.6). Login default:');
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
