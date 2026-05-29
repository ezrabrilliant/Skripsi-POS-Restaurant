// Reset DB test ke state e2e bersih (hapus data transaksional, set window agar pagi
// bisa dibuka sekarang). WAJIB DB *_test. Jalankan: npx tsx --env-file=.env.test scripts/reset-test-e2e.ts
import 'dotenv/config';
import { prisma } from '../src/config/prisma';

if (!/_test/.test(process.env.DATABASE_URL ?? '')) throw new Error('REFUSE: harus DB *_test.');

async function main() {
  await prisma.settlementMethodCount.deleteMany({});
  await prisma.settlement.deleteMany({});
  await prisma.transactionPayment.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.shift.deleteMany({});
  await prisma.appSetting.update({
    where: { id: 1 },
    data: { taxEnabled: false, timezone: 'Asia/Jakarta', shiftPagiStart: '00:00', shiftChangeover: '23:59', shiftMalamEnd: '23:30' },
  });
  console.log('[reset-test-e2e] ✓ DB test bersih + window: pagi 00:00–23:59, malam 23:59–23:30 (pagi openable sekarang).');
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
