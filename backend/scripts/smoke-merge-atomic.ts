// Integration smoke Fix A: merge+bayar atomik. WAJIB DB *_test.
// Jalankan: npx tsx --env-file=.env.test scripts/smoke-merge-atomic.ts
import 'dotenv/config';
import { UserRole, ShiftType } from '@prisma/client';
import { prisma } from '../src/config/prisma';
import { openShift } from '../src/modules/shifts/shifts.service';
import { createTransaction, addPayment } from '../src/modules/transactions/transactions.service';

if (!/_test/.test(process.env.DATABASE_URL ?? '')) throw new Error('REFUSE: smoke harus pakai DB *_test.');

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ FAIL: ${m}`)); };

async function main() {
  console.log(`[smoke-merge-atomic] DB=${process.env.DATABASE_URL?.split('/').pop()}`);
  await prisma.transactionPayment.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.shift.deleteMany({});
  await prisma.appSetting.update({ where: { id: 1 }, data: { taxEnabled: false, timezone: 'Asia/Jakarta', shiftPagiStart: '00:00', shiftChangeover: '23:58', shiftMalamEnd: '23:59' } });

  const cashier = await prisma.user.findFirst({ where: { role: UserRole.cashier } });
  const menu = await prisma.menu.findFirst({ where: { isActive: true, stockType: 'portion' } });
  if (!cashier || !menu) throw new Error('seed kurang');
  await openShift(cashier.id, { type: ShiftType.pagi, openingCash: 500000 });

  const mk = () => createTransaction(cashier.id, { orderType: 'dineIn', tableNumber: 3, items: [{ menuId: menu.id, qty: 1 }] } as Parameters<typeof createTransaction>[1]);

  console.log('\n[1] Bayar GAGAL setelah merge → merge ikut ROLLBACK:');
  const A = await mk(); const B = await mk();
  try {
    // nominal > total agregat → pasti gagal di dalam $transaction (SETELAH langkah merge).
    await addPayment(A.id, cashier.id, { method: 'cash', amount: A.subtotal + B.subtotal + 99999, mergeSourceIds: [B.id] } as Parameters<typeof addPayment>[2]);
    ok(false, 'harusnya gagal karena overpay');
  } catch { ok(true, 'addPayment overpay dilempar error'); }
  const Bafter = await prisma.transaction.findUnique({ where: { id: B.id } });
  ok(Bafter?.mergedIntoId === null, `B.mergedIntoId tetap null (merge ter-rollback), got=${Bafter?.mergedIntoId}`);
  ok(Bafter?.status === 'open', 'B masih open');

  console.log('\n[2] Bayar SUKSES dengan merge → A & B lunas, B menunjuk A:');
  const A2 = await mk(); const B2 = await mk();
  const total = A2.subtotal + B2.subtotal;
  const done = await addPayment(A2.id, cashier.id, { method: 'cash', amount: total, mergeSourceIds: [B2.id] } as Parameters<typeof addPayment>[2]);
  ok(done.status === 'paid', `A2 lunas (total ${done.total})`);
  const B2after = await prisma.transaction.findUnique({ where: { id: B2.id } });
  ok(B2after?.mergedIntoId === A2.id, `B2 ter-merge ke A2 (#${A2.id})`);
  ok(B2after?.status === 'paid', 'B2 ikut lunas via cascade');

  console.log('\n[3] Source bukan-open ditolak (rollback):');
  const A3 = await mk();
  try {
    await addPayment(A3.id, cashier.id, { method: 'cash', amount: A3.subtotal, mergeSourceIds: [B2.id] } as Parameters<typeof addPayment>[2]); // B2 sudah paid
    ok(false, 'harusnya gagal (source sudah paid/merged)');
  } catch { ok(true, 'merge source non-open ditolak'); }
  const A3after = await prisma.transaction.findUnique({ where: { id: A3.id } });
  ok(A3after?.status === 'open', 'A3 tetap open (tidak ada slice tertinggal)');

  console.log(`\n[smoke-merge-atomic] HASIL: ${pass} pass, ${fail} fail`);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}
main().catch(async (e) => { console.error('[smoke-merge-atomic] ERROR', e); await prisma.$disconnect(); process.exit(1); });
