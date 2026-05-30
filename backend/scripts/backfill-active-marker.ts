// Backfill active_marker=1 untuk shift yang masih open (closed_at IS NULL), DIJALANKAN
// SETELAH prisma db push menambah kolom active_marker. Idempotent + aman:
//   - 0 shift open  -> no-op.
//   - 1 shift open  -> set active_marker=1.
//   - >1 shift open -> THROW (langgar single-active; resolve manual dulu).
// Non-destruktif: hanya men-set kolom baru, tidak mengubah data lain.
import 'dotenv/config';
import { prisma } from '../src/config/prisma';

async function main() {
  const url = process.env.DATABASE_URL ?? '(unset)';
  const dbName = url.split('/').pop()?.split('?')[0] ?? '(unknown)';
  console.log(`[backfill] DATABASE = ${dbName}`);

  const open = await prisma.shift.findMany({ where: { closedAt: null } });
  if (open.length > 1) {
    throw new Error(
      `Ada ${open.length} shift open (ids: ${open.map((s) => s.id).join(', ')}) - resolve manual dulu sebelum backfill.`,
    );
  }
  if (open.length === 1) {
    const s = open[0]!;
    await prisma.shift.update({ where: { id: s.id }, data: { activeMarker: 1 } });
    console.log(`[backfill] ✓ active_marker=1 di shift #${s.id} (${s.type}).`);
  } else {
    console.log('[backfill] ✓ Tidak ada shift open - tidak ada yang di-backfill.');
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('[backfill] ERROR', e);
  await prisma.$disconnect();
  process.exit(1);
});
