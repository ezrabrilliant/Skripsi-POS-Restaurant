// Pre-check SEBELUM menambah @@unique([date]) (settlements) + @@unique([activeMarker]) (shifts)
// via prisma db push. Pakai RAW SQL (schema-agnostic) supaya aman dijalankan terhadap DB
// yang BELUM punya kolom active_marker. Tidak memutasi apa pun - read-only.
//
// Jalankan terhadap DB local (default .env) ATAU test (--env-file=.env.test).
import 'dotenv/config';
import { prisma } from '../src/config/prisma';

async function main() {
  const url = process.env.DATABASE_URL ?? '(unset)';
  const dbName = url.split('/').pop()?.split('?')[0] ?? '(unknown)';
  console.log(`[precheck] DATABASE = ${dbName}`);

  const dupDates = await prisma.$queryRaw<{ date: Date; c: bigint }[]>`
    SELECT date, COUNT(*) c FROM settlements GROUP BY date HAVING COUNT(*) > 1
  `;
  const openShifts = await prisma.$queryRaw<{ id: number; type: string; cashier_id: number }[]>`
    SELECT id, type, cashier_id FROM shifts WHERE closed_at IS NULL
  `;

  const json = (v: unknown) =>
    JSON.stringify(v, (_k, val) => (typeof val === 'bigint' ? Number(val) : val));

  console.log(`[precheck] DUP_SETTLEMENT_DATES (${dupDates.length}): ${json(dupDates)}`);
  console.log(`[precheck] OPEN_SHIFTS (${openShifts.length}): ${json(openShifts)}`);

  if (dupDates.length > 0) {
    console.log('[precheck] ❌ Ada tanggal settlement duplikat - resolve manual SEBELUM db push (unique date akan gagal).');
  } else {
    console.log('[precheck] ✓ Tidak ada settlement duplikat → @@unique([date]) aman.');
  }
  if (openShifts.length > 1) {
    console.log('[precheck] ❌ >1 shift open - tutup yang basi SEBELUM backfill active_marker (unique active_marker akan gagal).');
  } else if (openShifts.length === 1) {
    console.log('[precheck] ✓ 1 shift open → akan di-backfill active_marker=1 setelah push.');
  } else {
    console.log('[precheck] ✓ Tidak ada shift open.');
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('[precheck] ERROR', e);
  await prisma.$disconnect();
  process.exit(1);
});
