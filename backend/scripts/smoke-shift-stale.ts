// Integration smoke Fix B clean-slate. WAJIB DB *_test.
// Jalankan: npx tsx --env-file=.env.test scripts/smoke-shift-stale.ts
import 'dotenv/config';
import { UserRole, ShiftType } from '@prisma/client';
import { prisma } from '../src/config/prisma';
import { openShift, closeShift } from '../src/modules/shifts/shifts.service';
import { createTransaction, addPayment } from '../src/modules/transactions/transactions.service';

if (!/_test/.test(process.env.DATABASE_URL ?? '')) throw new Error('REFUSE: smoke harus pakai DB *_test.');

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ FAIL: ${m}`)); };
async function expectErr(fn: () => Promise<unknown>, status: number, label: string) {
  try { await fn(); ok(false, `${label} (harusnya ${status})`); }
  catch (e) { ok((e as { statusCode?: number }).statusCode === status, `${label} → ${status} (${(e as Error).message})`); }
}

async function main() {
  console.log(`[smoke-shift-stale] DB=${process.env.DATABASE_URL?.split('/').pop()}`);
  await prisma.transactionPayment.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.shift.deleteMany({});
  // Window: pagiStart 00:00 supaya "minutesOfDay >= pagiStart" selalu true → staleness diuji murni via tanggal.
  await prisma.appSetting.update({ where: { id: 1 }, data: { taxEnabled: false, timezone: 'Asia/Jakarta', shiftPagiStart: '00:00', shiftChangeover: '23:58', shiftMalamEnd: '23:59' } });

  const cashier = await prisma.user.findFirst({ where: { role: UserRole.cashier } });
  const cashier2 = await prisma.user.findFirst({ where: { role: UserRole.cashier, id: { not: cashier!.id } } });
  const menu = await prisma.menu.findFirst({ where: { isActive: true, stockType: 'portion' } });
  if (!cashier || !menu) throw new Error('seed kurang');

  console.log('\n[1] Order ke shift basi ditolak 409, pembayaran tetap boleh:');
  const shift = await openShift(cashier.id, { type: ShiftType.pagi, openingCash: 500000 });
  // Buat order SEBELUM shift dibuat basi (saat masih hari ini).
  const tx = await createTransaction(cashier.id, { orderType: 'dineIn', tableNumber: 1, items: [{ menuId: menu.id, qty: 1 }] } as Parameters<typeof createTransaction>[1]);
  // Paksa shift jadi "kemarin" → basi.
  const yesterday = new Date(); yesterday.setUTCDate(yesterday.getUTCDate() - 2);
  yesterday.setUTCHours(0, 0, 0, 0);
  await prisma.shift.update({ where: { id: shift.id }, data: { date: yesterday } });

  await expectErr(() => createTransaction(cashier.id, { orderType: 'dineIn', tableNumber: 2, items: [{ menuId: menu.id, qty: 1 }] } as Parameters<typeof createTransaction>[1]), 409, 'createTransaction ke shift basi ditolak');
  const paid = await addPayment(tx.id, cashier.id, { method: 'cash', amount: tx.subtotal } as Parameters<typeof addPayment>[2]);
  ok(paid.status === 'paid', 'addPayment order sisa tetap sukses walau shift basi');

  console.log('\n[2] Tutup-final shift basi oleh kasir LAIN diizinkan (meja sudah kosong):');
  if (cashier2) {
    const closed = await closeShift(shift.id, cashier2.id, UserRole.cashier, 'final');
    ok(closed.closedAt !== null, `kasir lain (#${cashier2.id}) boleh tutup shift basi #${shift.id}`);
  } else {
    console.log('  (skip — hanya 1 cashier di seed)');
  }

  console.log(`\n[smoke-shift-stale] HASIL: ${pass} pass, ${fail} fail`);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}
main().catch(async (e) => { console.error('[smoke-shift-stale] ERROR', e); await prisma.$disconnect(); process.exit(1); });
