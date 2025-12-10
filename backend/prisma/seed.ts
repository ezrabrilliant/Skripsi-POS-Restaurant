import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create Users
  const hashedPin1 = await bcrypt.hash('123456', 10);
  const hashedPin2 = await bcrypt.hash('111111', 10);
  const hashedPin3 = await bcrypt.hash('222222', 10);

  const owner = await prisma.user.upsert({
    where: { id: 'owner-1' },
    update: {},
    create: {
      id: 'owner-1',
      name: 'Pak Budi',
      role: 'owner',
      pinCode: hashedPin1,
    },
  });

  const cashier1 = await prisma.user.upsert({
    where: { id: 'cashier-1' },
    update: {},
    create: {
      id: 'cashier-1',
      name: 'Siti',
      role: 'cashier',
      pinCode: hashedPin2,
    },
  });

  const cashier2 = await prisma.user.upsert({
    where: { id: 'cashier-2' },
    update: {},
    create: {
      id: 'cashier-2',
      name: 'Dewi',
      role: 'cashier',
      pinCode: hashedPin3,
    },
  });

  console.log('✅ Users created:', { owner, cashier1, cashier2 });

  // Create Menu Items
  const menuItems = [
    // Makanan Utama
    { name: 'Nasi Goreng Spesial', price: 25000, category: 'Makanan Utama', description: 'Nasi goreng dengan telur, ayam, dan kerupuk' },
    { name: 'Mie Goreng', price: 22000, category: 'Makanan Utama', description: 'Mie goreng dengan sayuran dan telur' },
    { name: 'Nasi Ayam Bakar', price: 30000, category: 'Makanan Utama', description: 'Nasi dengan ayam bakar bumbu kecap' },
    { name: 'Nasi Ayam Goreng', price: 28000, category: 'Makanan Utama', description: 'Nasi dengan ayam goreng crispy' },
    { name: 'Nasi Campur', price: 32000, category: 'Makanan Utama', description: 'Nasi dengan berbagai lauk' },
    { name: 'Soto Ayam', price: 20000, category: 'Makanan Utama', description: 'Soto ayam dengan kuah bening' },
    { name: 'Bakso', price: 18000, category: 'Makanan Utama', description: 'Bakso sapi dengan mie dan tahu' },
    
    // Minuman
    { name: 'Es Teh Manis', price: 5000, category: 'Minuman', description: 'Teh manis dingin' },
    { name: 'Es Jeruk', price: 7000, category: 'Minuman', description: 'Jeruk peras dingin' },
    { name: 'Kopi Hitam', price: 6000, category: 'Minuman', description: 'Kopi tubruk' },
    { name: 'Es Campur', price: 12000, category: 'Minuman', description: 'Es campur dengan berbagai topping' },
    { name: 'Jus Alpukat', price: 15000, category: 'Minuman', description: 'Jus alpukat segar' },
    { name: 'Air Mineral', price: 4000, category: 'Minuman', description: 'Air mineral botol' },
    { name: 'Teh Hangat', price: 4000, category: 'Minuman', description: 'Teh manis hangat' },
    
    // Snack
    { name: 'Kerupuk', price: 3000, category: 'Snack', description: 'Kerupuk udang' },
    { name: 'Tahu Goreng', price: 8000, category: 'Snack', description: 'Tahu goreng crispy 5 pcs' },
    { name: 'Tempe Goreng', price: 8000, category: 'Snack', description: 'Tempe goreng 5 pcs' },
    { name: 'Pisang Goreng', price: 10000, category: 'Snack', description: 'Pisang goreng 4 pcs' },
    { name: 'Gorengan Campur', price: 12000, category: 'Snack', description: 'Berbagai gorengan' },
  ];

  for (const item of menuItems) {
    await prisma.menu.upsert({
      where: { id: item.name.toLowerCase().replace(/\s+/g, '-') },
      update: {},
      create: {
        id: item.name.toLowerCase().replace(/\s+/g, '-'),
        ...item,
      },
    });
  }

  console.log('✅ Menu items created:', menuItems.length);

  // Create Daily Stock for today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const menus = await prisma.menu.findMany({ where: { isActive: true } });

  for (const menu of menus) {
    const stockStart = menu.category === 'Makanan Utama' ? 30 :
                       menu.category === 'Minuman' ? 50 : 20;

    await prisma.dailyMenuStock.upsert({
      where: {
        date_menuId: {
          date: today,
          menuId: menu.id,
        },
      },
      update: {},
      create: {
        date: today,
        menuId: menu.id,
        stockStart,
        stockSold: 0,
      },
    });
  }

  console.log('✅ Daily stock initialized for', menus.length, 'items');

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
