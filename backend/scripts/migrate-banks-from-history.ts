// REV 2.6: Backfill master banks + junction dari TransactionPayment.bank lama.
// Scan distinct (method, bank) yang belum ada di master → auto-create.
// Idempotent.
//
// Run: npx tsx --env-file=.env scripts/migrate-banks-from-history.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Scanning distinct (method, bank) di TransactionPayment ===');
  const distinct = await prisma.transactionPayment.findMany({
    where: { bank: { not: null } },
    distinct: ['method', 'bank'],
    select: { method: true, bank: true },
  });
  console.log(`Found ${distinct.length} distinct pairs`);

  let banksCreated = 0;
  let junctionsCreated = 0;

  for (const { method, bank } of distinct) {
    if (!bank) continue;
    const trimmed = bank.trim();
    if (!trimmed) continue;

    const methodRecord = await prisma.paymentMethod.findUnique({ where: { code: method } });
    if (!methodRecord) {
      console.warn(`  ⚠ method '${method}' tidak ada di payment_methods — skip`);
      continue;
    }

    const bankBefore = await prisma.bank.findUnique({ where: { name: trimmed } });
    const bankRecord = await prisma.bank.upsert({
      where: { name: trimmed },
      update: {},
      create: { name: trimmed },
    });
    if (!bankBefore) {
      banksCreated++;
      console.log(`  ✓ CREATED bank '${bankRecord.name}'`);
    }

    const existing = await prisma.paymentMethodBank.findUnique({
      where: { paymentMethodId_bankId: { paymentMethodId: methodRecord.id, bankId: bankRecord.id } },
    });
    if (!existing) {
      await prisma.paymentMethodBank.create({
        data: { paymentMethodId: methodRecord.id, bankId: bankRecord.id },
      });
      junctionsCreated++;
      console.log(`  ✓ CREATED junction ${method} ← ${bankRecord.name}`);
    }
  }

  console.log(`\n=== Done: ${banksCreated} banks created, ${junctionsCreated} junctions created ===`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
