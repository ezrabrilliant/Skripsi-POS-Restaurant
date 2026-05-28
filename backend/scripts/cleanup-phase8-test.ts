// Phase 8 test cleanup: hapus settlements + transactions + shifts test (NOT db:fresh).
// Hanya untuk dev: kalau ada state stuck dari smoke run sebelumnya yang block dedup tests.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Deleting settlement_method_counts...');
  const smc = await prisma.settlementMethodCount.deleteMany({});
  console.log(`  deleted ${smc.count} settlement_method_counts`);

  console.log('Deleting settlements...');
  const s = await prisma.settlement.deleteMany({});
  console.log(`  deleted ${s.count} settlements`);

  console.log('Deleting transaction_payments...');
  const tp = await prisma.transactionPayment.deleteMany({});
  console.log(`  deleted ${tp.count} transaction_payments`);

  console.log('Deleting transaction_items...');
  const ti = await prisma.transactionItem.deleteMany({});
  console.log(`  deleted ${ti.count} transaction_items`);

  console.log('Deleting transactions...');
  const t = await prisma.transaction.deleteMany({});
  console.log(`  deleted ${t.count} transactions`);

  console.log('Deleting portion_movements...');
  const pm = await prisma.portionMovement.deleteMany({});
  console.log(`  deleted ${pm.count} portion_movements`);

  console.log('Deleting shifts...');
  const sh = await prisma.shift.deleteMany({});
  console.log(`  deleted ${sh.count} shifts`);

  console.log('Deleting bills...');
  const b = await prisma.bill.deleteMany({});
  console.log(`  deleted ${b.count} bills`);

  // Reset portion stocks
  console.log('Resetting portion stocks to 0...');
  await prisma.portionStock.updateMany({ data: { currentQty: 0 } });

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
