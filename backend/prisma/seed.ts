// Seeder data awal REV 2.2. Dijalankan dengan: npm run db:seed
//
// Yang di-seed:
//   1. Users riil (Owner + 3 kasir + 2 waiter) dengan PIN default (boleh duplikat).
//   2. Menu catalog (60 item: stok porsi + linked + non-stok + 5 paket).
//   3. PortionStock untuk setiap menu stockType=portion (currentQty=0 awal, opening=0).
//   4. RawMaterial awal (13 item: bahan_pokok/bahan_segar yang di-track + bumbu_dasar yang log only).
//   5. Vendor awal (3 vendor contoh: Pasar Pagi, Bu Sari, Toko Pak Budi).
//
// REV 2.2 catatan: BulkStock + BulkStockKind dihapus. Diganti RawMaterial fleksibel
// dengan is_tracked + category enum + unit varchar. Lihat docs/operasional-resto.md
// seksi "Raw Materials" untuk daftar seed lengkap.
//
// Seed idempotent: user upserted by (name), menu hanya di-seed kalau tabel kosong,
// raw_material upserted by (name), vendor upserted by (name+type).

import { PrismaClient, UserRole, StockType, RawMaterialCategory } from '@prisma/client';
import { MENU_CATALOG } from './menu-catalog';

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

// Raw materials awal sesuai tabel di docs/operasional-resto.md REV 2.3 seksi
// "Raw Materials (Stok Bahan Baku) dan Reminder" + "Contoh raw materials (seed awal)".
//
// is_tracked=true  : muncul di reminder (Beras, Kangkung, Petai, Tahu, Tempe, Telur)
// is_tracked=false : hanya log pengeluaran (Cabai, Bawang, Kemiri, Minyak, Daun Jeruk, Sereh)
interface RawMaterialSeed {
  name: string;
  unit: string;
  category: RawMaterialCategory;
  isTracked: boolean;
  minStock?: number;
  freshnessDays?: number;
}

const rawMaterials: RawMaterialSeed[] = [
  // is_tracked=true (muncul di reminder)
  { name: 'Beras', unit: 'skala', category: RawMaterialCategory.bahanPokok, isTracked: true, minStock: 1 },
  { name: 'Kangkung', unit: 'ikat', category: RawMaterialCategory.bahanSegar, isTracked: true, minStock: 1, freshnessDays: 10 },
  { name: 'Petai', unit: 'ikat', category: RawMaterialCategory.bahanSegar, isTracked: true, minStock: 1, freshnessDays: 10 },
  { name: 'Tahu', unit: 'balok', category: RawMaterialCategory.bahanPokok, isTracked: true, minStock: 2 },
  { name: 'Tempe', unit: 'balok', category: RawMaterialCategory.bahanPokok, isTracked: true, minStock: 2 },
  { name: 'Telur', unit: 'butir', category: RawMaterialCategory.bahanPokok, isTracked: true, minStock: 3 },

  // is_tracked=false (hanya log pengeluaran, tidak monitoring stok)
  { name: 'Cabai Rawit', unit: 'gram', category: RawMaterialCategory.bumbuDasar, isTracked: false },
  { name: 'Bawang Merah', unit: 'gram', category: RawMaterialCategory.bumbuDasar, isTracked: false },
  { name: 'Bawang Putih', unit: 'gram', category: RawMaterialCategory.bumbuDasar, isTracked: false },
  { name: 'Kemiri', unit: 'gram', category: RawMaterialCategory.bumbuDasar, isTracked: false },
  { name: 'Daun Jeruk', unit: 'ikat', category: RawMaterialCategory.bumbuDasar, isTracked: false },
  { name: 'Sereh', unit: 'batang', category: RawMaterialCategory.bumbuDasar, isTracked: false },
  { name: 'Minyak Goreng', unit: 'liter', category: RawMaterialCategory.bahanKering, isTracked: false },
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
    console.log(`Katalog menu sudah berisi ${menuCount} item — seed menu dilewati.`);
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

async function seedRawMaterials() {
  console.log('Menanam RawMaterial awal (REV 2.2)...');
  for (const rm of rawMaterials) {
    const existing = await prisma.rawMaterial.findFirst({ where: { name: rm.name } });
    if (existing) {
      console.log(`  · ${rm.name} sudah ada, dilewati`);
      continue;
    }
    await prisma.rawMaterial.create({
      data: {
        name: rm.name,
        unit: rm.unit,
        category: rm.category,
        isTracked: rm.isTracked,
        stockQty: 0,
        minStock: rm.minStock ?? null,
        freshnessDays: rm.freshnessDays ?? null,
      },
    });
    const trackMark = rm.isTracked ? 'tracked' : 'log-only';
    console.log(`  ✓ ${rm.name} (${rm.unit}, ${rm.category}, ${trackMark})`);
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
  await seedRawMaterials();
  await seedVendors();
  console.log('\nSeed selesai (REV 2.2). Login default:');
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
