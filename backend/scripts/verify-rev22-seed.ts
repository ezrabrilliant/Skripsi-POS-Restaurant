// ⚠️ DEAD / OBSOLETE pasca REV 2.11 — JANGAN DI-RUN. Memverifikasi seed REV 2.2
// (raw_materials/vendors/purchases) yang tabelnya sudah di-DROP di REV 2.11.
// Dipertahankan sebagai catatan historis; akan crash kalau dijalankan.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

(async () => {
  const counts = {
    users: await prisma.user.count(),
    menus: await prisma.menu.count(),
    portionStocks: await prisma.portionStock.count(),
    portionMovements: await prisma.portionMovement.count(),
    rawMaterials: await prisma.rawMaterial.count(),
    rawMaterialMovements: await prisma.rawMaterialMovement.count(),
    vendors: await prisma.vendor.count(),
    shifts: await prisma.shift.count(),
    transactions: await prisma.transaction.count(),
    transactionItems: await prisma.transactionItem.count(),
    settlements: await prisma.settlement.count(),
    purchases: await prisma.purchase.count(),
    purchaseItems: await prisma.purchaseItem.count(),
    bills: await prisma.bill.count(),
  };

  console.log('--- COUNT PER ENTITAS (14 tabel REV 2.2) ---');
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k.padEnd(24)} ${v}`);
  }

  console.log('\n--- USER (6 pegawai riil) ---');
  const users = await prisma.user.findMany({ select: { name: true, role: true, isActive: true } });
  for (const u of users) console.log(`  ${u.name.padEnd(12)} role=${u.role.padEnd(8)} active=${u.isActive}`);

  console.log('\n--- PORTION STOCK SAMPLE (5 first, by menuId) ---');
  const ps = await prisma.portionStock.findMany({
    take: 5,
    orderBy: { menuId: 'asc' },
    include: { menu: { select: { name: true, category: true } } },
  });
  for (const p of ps) {
    console.log(
      `  ${p.menu.name.padEnd(28)} qty=${p.currentQty} min=${p.minStock} openingDate=${p.openingQtyDate.toISOString().split('T')[0]}`
    );
  }

  console.log('\n--- RAW MATERIAL SAMPLE (5 first) ---');
  const rm = await prisma.rawMaterial.findMany({ take: 5, orderBy: { name: 'asc' } });
  for (const r of rm) {
    console.log(`  ${r.name.padEnd(16)} unit=${r.unit.padEnd(8)} cat=${r.category.padEnd(12)} tracked=${r.isTracked}`);
  }

  await prisma.$disconnect();
})();
