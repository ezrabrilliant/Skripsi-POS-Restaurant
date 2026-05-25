// Cleanup test data setelah Phase 4 smoke test:
//   - hapus semua PortionMovement (audit log dari test orders)
//   - hapus semua TransactionItem + Transaction
//   - hapus semua Shift (yang dibuat saat smoke test)
//   - reset PortionStock currentQty ke 0 (clean state)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

(async () => {
  const pmCount = await prisma.portionMovement.deleteMany();
  console.log(`Deleted PortionMovement rows: ${pmCount.count}`);

  const tiCount = await prisma.transactionItem.deleteMany();
  console.log(`Deleted TransactionItem rows: ${tiCount.count}`);

  const tCount = await prisma.transaction.deleteMany();
  console.log(`Deleted Transaction rows: ${tCount.count}`);

  const sCount = await prisma.shift.deleteMany();
  console.log(`Deleted Shift rows: ${sCount.count}`);

  const psReset = await prisma.portionStock.updateMany({ data: { currentQty: 0 } });
  console.log(`Reset PortionStock.currentQty=0 for ${psReset.count} rows`);

  await prisma.$disconnect();
})();
