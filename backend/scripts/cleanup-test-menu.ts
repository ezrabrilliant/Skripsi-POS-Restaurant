// Cleanup test menu created during Phase 3 smoke test (id=61 "Test Ayam Bumbu Khas")
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

(async () => {
  try {
    const deleted = await prisma.menu.delete({ where: { id: 61 } });
    console.log(`Cleaned up test menu id=61 name="${deleted.name}" (PortionStock cascade)`);
  } catch (e) {
    console.log('No test menu id=61 to clean (already gone or error):', String(e).slice(0, 200));
  }
  const count = await prisma.menu.count();
  console.log(`Total menus after cleanup: ${count}`);
  await prisma.$disconnect();
})();
