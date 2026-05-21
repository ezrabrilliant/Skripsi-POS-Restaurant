// Seeder data awal. Dijalankan dengan: npm run db:seed
// Idempotent — user pakai upsert berdasarkan PIN; menu di-seed hanya bila tabel kosong.

import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const users = [
  { name: 'Pak Budi (Pemilik)', pin: '100000', role: UserRole.owner },
  { name: 'Siti (Kasir)', pin: '200000', role: UserRole.cashier },
  { name: 'Dewi (Kasir)', pin: '200001', role: UserRole.cashier },
  { name: 'Joko (Dapur)', pin: '300000', role: UserRole.kitchen },
];

// Katalog menu Ayam Bakar Banjar Monosuko (docs/menu-ayam-bakar-banjar-monosuko.md)
const menus: { name: string; category: string; price: number }[] = [
  // Ayam Bakar
  { name: '1 Ekor Ayam Bakar', category: 'Ayam Bakar', price: 120000 },
  { name: 'Paha Ayam Bakar', category: 'Ayam Bakar', price: 30000 },
  { name: 'Dada Ayam Bakar', category: 'Ayam Bakar', price: 30000 },
  { name: 'Ati / Ampela Bakar', category: 'Ayam Bakar', price: 5000 },
  { name: 'Kepala Ayam Bakar', category: 'Ayam Bakar', price: 2500 },
  // Ayam Goreng
  { name: '1 Ekor Ayam Goreng', category: 'Ayam Goreng', price: 120000 },
  { name: 'Paha Ayam Goreng', category: 'Ayam Goreng', price: 30000 },
  { name: 'Dada Ayam Goreng', category: 'Ayam Goreng', price: 30000 },
  { name: 'Ati / Ampela Goreng', category: 'Ayam Goreng', price: 5000 },
  { name: 'Kepala Ayam Goreng', category: 'Ayam Goreng', price: 2500 },
  // Daging Sapi
  { name: 'Daging Sapi Yakiniku', category: 'Daging Sapi', price: 125000 },
  { name: 'Empal Goreng', category: 'Daging Sapi', price: 25000 },
  // Aneka Seafood
  { name: 'Udang Bakar', category: 'Aneka Seafood', price: 150000 },
  { name: 'Gurame Bakar', category: 'Aneka Seafood', price: 125000 },
  // Aneka Kuah
  { name: 'Ayam Kuah Tauco', category: 'Aneka Kuah', price: 35000 },
  { name: 'Semur Daging', category: 'Aneka Kuah', price: 30000 },
  { name: 'Gulai Daging', category: 'Aneka Kuah', price: 30000 },
  { name: 'Rawon', category: 'Aneka Kuah', price: 30000 },
  { name: 'Garang Asem', category: 'Aneka Kuah', price: 30000 },
  // Aneka Sayur
  { name: 'Urap - Urap', category: 'Aneka Sayur', price: 12000 },
  { name: 'Cah Kangkung', category: 'Aneka Sayur', price: 10000 },
  { name: 'Sayur Asem', category: 'Aneka Sayur', price: 10000 },
  // Penyetan
  { name: 'Bakwan Penyet', category: 'Penyetan', price: 25000 },
  { name: 'Empal Penyet', category: 'Penyetan', price: 25000 },
  { name: '3T (Tahu Tempe Telur)', category: 'Penyetan', price: 20000 },
  { name: 'Tahu Tempe Penyet', category: 'Penyetan', price: 15000 },
  // Paketan
  {
    name: 'Paket A (Makan Ditempat) - Paha/Dada, Tahu Tempe, Sayur Asem, Nasi, Air Mineral/Teh Tawar',
    category: 'Paketan',
    price: 50000,
  },
  {
    name: 'Paket B (TakeAway) - Paha/Dada, Tahu Tempe, Nasi Putih',
    category: 'Paketan',
    price: 40000,
  },
  // Lainnya
  { name: 'Petai Goreng', category: 'Lainnya', price: 20000 },
  { name: 'Tahu & Tempe Goreng', category: 'Lainnya', price: 12000 },
  { name: 'Tahu Goreng', category: 'Lainnya', price: 10000 },
  { name: 'Tempe Goreng', category: 'Lainnya', price: 10000 },
  { name: 'Telur Mata Sapi', category: 'Lainnya', price: 10000 },
  { name: 'Nasi', category: 'Lainnya', price: 10000 },
  // Minuman
  { name: 'Air Mineral', category: 'Minuman', price: 5000 },
  { name: 'Teh Tawar Biasa', category: 'Minuman', price: 8000 },
  { name: 'Teh Tawar Jumbo', category: 'Minuman', price: 12000 },
  { name: 'Teh Manis Biasa', category: 'Minuman', price: 10000 },
  { name: 'Teh Manis Jumbo', category: 'Minuman', price: 15000 },
  { name: 'Es Sirup', category: 'Minuman', price: 10000 },
  { name: 'Jeruk Nipis', category: 'Minuman', price: 10000 },
  { name: 'Susu Kedelai', category: 'Minuman', price: 12000 },
  { name: 'Teh Kendur/Tebu/Cincau', category: 'Minuman', price: 12000 },
  { name: 'Es Degan', category: 'Minuman', price: 15000 },
  { name: 'Jeruk Peras', category: 'Minuman', price: 15000 },
  { name: 'Jeruk Murni', category: 'Minuman', price: 25000 },
  { name: 'Minuman Sarang Burung', category: 'Minuman', price: 80000 },
];

async function main() {
  console.log('Menanam data user awal...');
  for (const u of users) {
    await prisma.user.upsert({
      where: { pin: u.pin },
      update: { name: u.name, role: u.role },
      create: u,
    });
    console.log(`  ✓ ${u.name} (PIN ${u.pin}, role ${u.role})`);
  }

  const menuCount = await prisma.menu.count();
  if (menuCount === 0) {
    console.log('Menanam katalog menu...');
    await prisma.menu.createMany({ data: menus });
    console.log(`  ✓ ${menus.length} menu ditambahkan`);
  } else {
    console.log(`Katalog menu sudah berisi ${menuCount} item — seed menu dilewati.`);
  }

  console.log('Seed selesai.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
