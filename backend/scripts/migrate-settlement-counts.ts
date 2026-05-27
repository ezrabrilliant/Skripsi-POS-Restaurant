// REV 2.6: Backfill settlement_method_counts dari Settlement 12 kolom lama.
// Tiap Settlement existing → 6 child rows (cash/edc/qris/gojek/grab/transfer).
// Idempotent via skipDuplicates (PK composite settlementId+paymentMethodCode).
//
// CATATAN field name: schema legacy Settlement pakai `actual{Method}` + `system{Method}`
// (lihat schema.prisma model Settlement) — BUKAN `counted{Method}`. Mapping:
//   actualCash    → counted
//   systemCash    → system
// (sama untuk edc/qris/gojek/grab/transfer)
//
// Settlement legacy field-nya Decimal (12,2); SettlementMethodCount.counted/system
// adalah Int per schema baru. Kita konversi via Math.round(Number(...)) — di domain
// rupiah, rounding ke int aman karena 1 rupiah = unit terkecil bermakna.
//
// Run: npx tsx --env-file=.env scripts/migrate-settlement-counts.ts

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const LEGACY_METHODS = ['cash', 'edc', 'qris', 'gojek', 'grab', 'transfer'] as const;

function toInt(d: Prisma.Decimal | number | null | undefined): number {
  if (d == null) return 0;
  return Math.round(Number(d));
}

async function main() {
  console.log('=== Scanning Settlement existing ===');
  const settlements = await prisma.settlement.findMany({
    select: {
      id: true,
      actualCash: true,     systemCash: true,
      actualEdc: true,      systemEdc: true,
      actualQris: true,     systemQris: true,
      actualGojek: true,    systemGojek: true,
      actualGrab: true,     systemGrab: true,
      actualTransfer: true, systemTransfer: true,
    },
  });
  console.log(`Found ${settlements.length} settlements`);

  let totalChildRowsCreated = 0;

  for (const s of settlements) {
    // Map legacy `actual{Method}` + `system{Method}` → child rows.
    const rows = LEGACY_METHODS.map((code) => {
      const Cap = code.charAt(0).toUpperCase() + code.slice(1);
      const actualKey = `actual${Cap}` as keyof typeof s;
      const systemKey = `system${Cap}` as keyof typeof s;
      return {
        settlementId: s.id,
        paymentMethodCode: code,
        counted: toInt(s[actualKey] as Prisma.Decimal),
        system: toInt(s[systemKey] as Prisma.Decimal),
      };
    });

    const result = await prisma.settlementMethodCount.createMany({
      data: rows,
      skipDuplicates: true,
    });
    totalChildRowsCreated += result.count;
    console.log(`  ✓ Settlement #${s.id}: created ${result.count} child rows`);
  }

  const expectedTotal = settlements.length * LEGACY_METHODS.length;
  const actualTotal = await prisma.settlementMethodCount.count();
  console.log(`\n=== Done ===`);
  console.log(`Settlements: ${settlements.length}`);
  console.log(`Expected child rows: ${expectedTotal}`);
  console.log(`Actual child rows: ${actualTotal}`);
  console.log(`Created in this run: ${totalChildRowsCreated}`);

  if (actualTotal < expectedTotal) {
    console.error('⚠ WARNING: actual < expected. Investigate sebelum lanjut Phase 9.');
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
