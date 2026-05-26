// Verifikasi cepat menu DB vs canonical doc.
// Output: list per kategori (active only) + ringkasan jumlah.
//
// Jalankan: npx tsx --env-file=.env scripts/verify-menu.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const active = await prisma.menu.findMany({
    where: { isActive: true },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, category: true, price: true, stockType: true },
  });

  const inactive = await prisma.menu.findMany({
    where: { isActive: false },
    orderBy: [{ name: 'asc' }],
    select: { name: true, category: true },
  });

  const byCat = new Map<string, typeof active>();
  for (const m of active) {
    if (!byCat.has(m.category)) byCat.set(m.category, []);
    byCat.get(m.category)!.push(m);
  }

  const catOrder = Array.from(byCat.keys()).sort();
  for (const cat of catOrder) {
    const items = byCat.get(cat)!;
    console.log(`\n=== ${cat} (${items.length} item) ===`);
    for (const m of items) {
      const stockTag = m.stockType === 'portion' ? '[P]' : m.stockType === 'linked' ? '[L]' : '[N]';
      console.log(`  ${stockTag} ${m.name.padEnd(38)} ${m.price.toString().padStart(10)}`);
    }
  }

  console.log(`\n--- Total: ${active.length} aktif ---`);
  if (inactive.length > 0) {
    console.log(`\n=== Nonaktif (${inactive.length}) ===`);
    for (const m of inactive) {
      console.log(`  · ${m.name} (was ${m.category})`);
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
