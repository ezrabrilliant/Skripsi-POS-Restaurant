// Integration smoke untuk atribusi re-stamp + atomicity addPayment. WAJIB DB *_test.
// Jalankan: npx tsx --env-file=.env.test scripts/smoke-tx.ts
import 'dotenv/config';
import { UserRole, ShiftType } from '@prisma/client';
import { prisma } from '../src/config/prisma';
import { openShift, closeShift } from '../src/modules/shifts/shifts.service';
import { createTransaction, addPayment } from '../src/modules/transactions/transactions.service';

if (!/_test/.test(process.env.DATABASE_URL ?? '')) {
  throw new Error('REFUSE: smoke harus pakai DB *_test.');
}

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ FAIL: ${m}`)); };
async function expectErr(fn: () => Promise<unknown>, status: number, label: string) {
  try { await fn(); ok(false, `${label} (harusnya ${status})`); }
  catch (e) { ok((e as { statusCode?: number }).statusCode === status, `${label} → ${status} (${(e as Error).message})`); }
}

async function main() {
  console.log(`[smoke-tx] DB=${process.env.DATABASE_URL?.split('/').pop()}`);
  await prisma.transactionPayment.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.shift.deleteMany({});
  await prisma.appSetting.update({
    where: { id: 1 },
    data: { taxEnabled: false, timezone: 'Asia/Jakarta', shiftPagiStart: '00:00', shiftChangeover: '23:58', shiftMalamEnd: '23:59' },
  });

  const cashier = await prisma.user.findFirst({ where: { role: UserRole.cashier } });
  if (!cashier) throw new Error('no cashier');
  // Menu portion = item simpel (decrement stok sendiri, tanpa choices/paket).
  const menu = await prisma.menu.findFirst({ where: { isActive: true, stockType: 'portion' } });
  if (!menu) throw new Error('no portion menu');

  console.log('\n[1] Re-stamp: order dibuat di shift A (pagi), dibayar di shift B (malam):');
  const shiftA = await openShift(cashier.id, { type: ShiftType.pagi, openingCash: 500000 });
  const tx = await createTransaction(cashier.id, {
    orderType: 'dineIn', tableNumber: 1, items: [{ menuId: menu.id, qty: 1 }],
  } as Parameters<typeof createTransaction>[1]);
  ok(tx.shiftId === shiftA.id, `Tx dibuat di shift A (#${shiftA.id}), subtotal ${tx.subtotal}`);

  await closeShift(shiftA.id, cashier.id, UserRole.cashier, 'handover'); // tx open carry
  const shiftB = await openShift(cashier.id, { type: ShiftType.malam, openingCash: 300000 });
  ok(shiftB.id !== shiftA.id, `shift B (malam) dibuka (#${shiftB.id})`);

  const paid = await addPayment(tx.id, cashier.id, { method: 'cash', amount: tx.subtotal } as Parameters<typeof addPayment>[2]);
  ok(paid.status === 'paid', 'Tx lunas');
  ok(paid.shiftId === shiftB.id, `RE-STAMP: Tx.shiftId pindah ke shift B (#${shiftB.id}), bukan A (#${shiftA.id})`);

  console.log('\n[2] Overpay ditolak 400:');
  const tx2 = await createTransaction(cashier.id, { orderType: 'dineIn', tableNumber: 2, items: [{ menuId: menu.id, qty: 1 }] } as Parameters<typeof createTransaction>[1]);
  await expectErr(() => addPayment(tx2.id, cashier.id, { method: 'cash', amount: tx2.subtotal + 50000 } as Parameters<typeof addPayment>[2]), 400, 'bayar melebihi total');

  console.log('\n[3] Split tender: 2 slice sampai lunas:');
  const half = Math.floor(tx2.subtotal / 2);
  await addPayment(tx2.id, cashier.id, { method: 'cash', amount: half } as Parameters<typeof addPayment>[2]);
  const done = await addPayment(tx2.id, cashier.id, { method: 'cash', amount: tx2.subtotal - half } as Parameters<typeof addPayment>[2]);
  ok(done.status === 'paid', 'Tx2 lunas via 2 slice');
  ok(done.payments.length === 2, `2 payment slice tercatat (got ${done.payments.length})`);

  console.log(`\n[smoke-tx] HASIL: ${pass} pass, ${fail} fail`);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => { console.error('[smoke-tx] ERROR', e); await prisma.$disconnect(); process.exit(1); });
