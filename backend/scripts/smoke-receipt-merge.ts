// Integration smoke: getTransactionById menyertakan item anak yang ter-merge
// (mergedSources) + subtotal rekonsiliasi. WAJIB DB *_test.
// Jalankan: npx tsx --env-file=.env.test scripts/smoke-receipt-merge.ts
import 'dotenv/config';
import { UserRole, ShiftType } from '@prisma/client';
import { prisma } from '../src/config/prisma';
import { openShift } from '../src/modules/shifts/shifts.service';
import {
  createTransaction,
  addPayment,
  getTransactionById,
} from '../src/modules/transactions/transactions.service';

if (!/_test/.test(process.env.DATABASE_URL ?? '')) throw new Error('REFUSE: smoke harus pakai DB *_test.');

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ FAIL: ${m}`)); };

async function main() {
  console.log(`[smoke-receipt-merge] DB=${process.env.DATABASE_URL?.split('/').pop()}`);
  await prisma.transactionPayment.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.shift.deleteMany({});
  await prisma.appSetting.update({
    where: { id: 1 },
    data: { taxEnabled: false, timezone: 'Asia/Jakarta', shiftPagiStart: '00:00', shiftChangeover: '23:58', shiftMalamEnd: '23:59' },
  });

  const cashier = await prisma.user.findFirst({ where: { role: UserRole.cashier } });
  const menu = await prisma.menu.findFirst({ where: { isActive: true, stockType: 'portion' } });
  if (!cashier || !menu) throw new Error('seed kurang');
  await openShift(cashier.id, { type: ShiftType.pagi, openingCash: 500000 });

  const mk = () => createTransaction(cashier.id, {
    orderType: 'dineIn', tableNumber: 3, items: [{ menuId: menu.id, qty: 1 }],
  } as Parameters<typeof createTransaction>[1]);

  console.log('\n[1] Merge B ke A lalu bayar A → getById(A) memuat item B:');
  const A = await mk();
  const B = await mk();
  const total = A.subtotal + B.subtotal;
  const paid = await addPayment(A.id, cashier.id, {
    method: 'cash', amount: total, mergeSourceIds: [B.id],
  } as Parameters<typeof addPayment>[2]);
  ok(paid.status === 'paid', `A lunas (total ${paid.total})`);

  const detail = await getTransactionById(A.id);
  ok(Array.isArray(detail.mergedSources) && detail.mergedSources.length === 1, `mergedSources ada 1 (got ${detail.mergedSources?.length})`);
  const src = detail.mergedSources?.[0];
  ok(src?.id === B.id, `mergedSources[0].id == B (#${B.id}), got ${src?.id}`);
  ok((src?.items.length ?? 0) === B.items.length, `item anak terbawa (${src?.items.length} == ${B.items.length})`);
  const aggSubtotal = detail.subtotal + (detail.mergedSources ?? []).reduce((s, m) => s + m.subtotal, 0);
  ok(aggSubtotal === detail.total, `subtotal agregat (${aggSubtotal}) rekonsiliasi dengan total (${detail.total})`);

  console.log('\n[2] Tx non-merge → mergedSources undefined/kosong:');
  const C = await mk();
  const cDetail = await getTransactionById(C.id);
  ok(!cDetail.mergedSources || cDetail.mergedSources.length === 0, 'Tx polos tanpa mergedSources');

  console.log(`\n[smoke-receipt-merge] HASIL: ${pass} pass, ${fail} fail`);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}
main().catch(async (e) => { console.error('[smoke-receipt-merge] ERROR', e); await prisma.$disconnect(); process.exit(1); });
