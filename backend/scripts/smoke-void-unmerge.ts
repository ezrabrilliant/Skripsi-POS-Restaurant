// Integration smoke Fix C: void parent melepas anak. WAJIB DB *_test.
// Jalankan: npx tsx --env-file=.env.test scripts/smoke-void-unmerge.ts
import 'dotenv/config';
import { UserRole, ShiftType } from '@prisma/client';
import { prisma } from '../src/config/prisma';
import { openShift } from '../src/modules/shifts/shifts.service';
import { createTransaction, voidTransaction, mergeBills, listTransactionsByTable } from '../src/modules/transactions/transactions.service';

if (!/_test/.test(process.env.DATABASE_URL ?? '')) throw new Error('REFUSE: smoke harus pakai DB *_test.');

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ FAIL: ${m}`)); };

async function main() {
  console.log(`[smoke-void-unmerge] DB=${process.env.DATABASE_URL?.split('/').pop()}`);
  await prisma.transactionPayment.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.shift.deleteMany({});
  await prisma.appSetting.update({ where: { id: 1 }, data: { taxEnabled: false, timezone: 'Asia/Jakarta', shiftPagiStart: '00:00', shiftChangeover: '23:58', shiftMalamEnd: '23:59' } });

  const cashier = await prisma.user.findFirst({ where: { role: UserRole.cashier } });
  const menu = await prisma.menu.findFirst({ where: { isActive: true, stockType: 'portion' } });
  if (!cashier || !menu) throw new Error('seed kurang');
  await openShift(cashier.id, { type: ShiftType.pagi, openingCash: 500000 });

  const mk = () => createTransaction(cashier.id, { orderType: 'dineIn', tableNumber: 4, items: [{ menuId: menu.id, qty: 1 }] } as Parameters<typeof createTransaction>[1]);

  console.log('\n[1] Void parent → anak dilepas jadi order terpisah:');
  const A = await mk(); const B = await mk(); const C = await mk();
  await mergeBills({ sourceIds: [B.id, C.id], targetId: A.id });
  const beforeList = await listTransactionsByTable(4, 'open');
  ok(beforeList.length === 1 && beforeList[0]!.id === A.id, `sebelum void: hanya parent A tampil (got ${beforeList.length})`);

  await voidTransaction(A.id, cashier.id);
  const Ba = await prisma.transaction.findUnique({ where: { id: B.id } });
  const Ca = await prisma.transaction.findUnique({ where: { id: C.id } });
  ok(Ba?.mergedIntoId === null && Ba?.status === 'open', 'B dilepas (mergedIntoId null, open)');
  ok(Ca?.mergedIntoId === null && Ca?.status === 'open', 'C dilepas (mergedIntoId null, open)');
  const afterList = await listTransactionsByTable(4, 'open');
  ok(afterList.length === 2, `setelah void: B & C muncul terpisah di meja 4 (got ${afterList.length})`);

  console.log(`\n[smoke-void-unmerge] HASIL: ${pass} pass, ${fail} fail`);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}
main().catch(async (e) => { console.error('[smoke-void-unmerge] ERROR', e); await prisma.$disconnect(); process.exit(1); });
