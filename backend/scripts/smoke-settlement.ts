// Integration smoke: settlement whole-business-day + permission + dedupe + void-after-settle
// + dashboard attribution by shift.date. WAJIB DB *_test.
// Jalankan: npx tsx --env-file=.env.test scripts/smoke-settlement.ts
import 'dotenv/config';
import { UserRole, ShiftType } from '@prisma/client';
import { prisma } from '../src/config/prisma';
import { openShift, closeShift } from '../src/modules/shifts/shifts.service';
import { createTransaction, addPayment, voidTransaction } from '../src/modules/transactions/transactions.service';
import { previewSettlement, createSettlement } from '../src/modules/settlements/settlements.service';
import { getOwnerReport } from '../src/modules/dashboard/dashboard.service';

if (!/_test/.test(process.env.DATABASE_URL ?? '')) throw new Error('REFUSE: harus DB *_test.');

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ FAIL: ${m}`)); };
async function expectErr(fn: () => Promise<unknown>, status: number, label: string) {
  try { await fn(); ok(false, `${label} (harusnya ${status})`); }
  catch (e) { ok((e as { statusCode?: number }).statusCode === status, `${label} → ${status} (${(e as Error).message})`); }
}
type TxInput = Parameters<typeof createTransaction>[1];
type PayInput = Parameters<typeof addPayment>[2];

async function main() {
  console.log(`[smoke-settlement] DB=${process.env.DATABASE_URL?.split('/').pop()}`);
  await prisma.settlementMethodCount.deleteMany({});
  await prisma.settlement.deleteMany({});
  await prisma.transactionPayment.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.shift.deleteMany({});
  await prisma.appSetting.update({ where: { id: 1 }, data: { taxEnabled: false, timezone: 'Asia/Jakarta', shiftPagiStart: '00:00', shiftChangeover: '23:58', shiftMalamEnd: '23:59' } });

  const cashiers = await prisma.user.findMany({ where: { role: UserRole.cashier }, take: 2 });
  const jason = cashiers[0]!, bryant = cashiers[1]!;
  const menu = await prisma.menu.findFirst({ where: { isActive: true, stockType: 'portion' } });
  if (!menu) throw new Error('no portion menu');
  const edc = await prisma.paymentMethod.findUnique({ where: { code: 'edc' } });
  const edcDineIn = !!edc?.allowDineIn;

  console.log('\n[1] Business day 2 shift (pagi A + malam B), transaksi paid di kedua shift:');
  const A = await openShift(jason.id, { type: ShiftType.pagi, openingCash: 500000 });
  const businessDate = A.date; // YYYY-MM-DD
  const tx1 = await createTransaction(jason.id, { orderType: 'dineIn', tableNumber: 1, items: [{ menuId: menu.id, qty: 1 }] } as TxInput);
  await addPayment(tx1.id, jason.id, { method: 'cash', amount: tx1.subtotal } as PayInput);

  await closeShift(A.id, jason.id, UserRole.cashier, 'handover');
  const B = await openShift(bryant.id, { type: ShiftType.malam, openingCash: 300000 });
  ok(B.openingCash === 0, `shift B (malam, bukan pertama) carry-over openingCash = ${B.openingCash} (expect 0)`);
  ok(B.date === businessDate, `shift B business day sama dengan A (${businessDate})`);
  const tx2 = await createTransaction(bryant.id, { orderType: 'dineIn', tableNumber: 2, items: [{ menuId: menu.id, qty: 1 }] } as TxInput);
  await addPayment(tx2.id, bryant.id, { method: 'cash', amount: tx2.subtotal } as PayInput);

  let edcTotal = 0;
  if (edcDineIn) {
    const tx3 = await createTransaction(bryant.id, { orderType: 'dineIn', tableNumber: 3, items: [{ menuId: menu.id, qty: 1 }] } as TxInput);
    await addPayment(tx3.id, bryant.id, { method: 'edc', bank: 'BCA', amount: tx3.subtotal } as PayInput);
    edcTotal = tx3.subtotal;
    ok(true, `tx3 paid edc/BCA ${edcTotal} (untuk bank breakdown)`);
  } else {
    console.log('  (skip edc: allowDineIn=false)');
  }
  await closeShift(B.id, bryant.id, UserRole.cashier, 'final'); // semua tx paid → tidak diblokir

  const expectedWholeDay = tx1.subtotal + tx2.subtotal + edcTotal;

  console.log('\n[2] Preview whole-day = gabungan kedua shift:');
  const prev = await previewSettlement(new Date(businessDate + 'T00:00:00.000Z'));
  ok(prev.totalSystem === expectedWholeDay, `preview.totalSystem = ${prev.totalSystem} (expect ${expectedWholeDay})`);
  ok(prev.openingCashTotal === 500000, `openingCashTotal = modal shift pertama (carry-over) = ${prev.openingCashTotal} (expect 500000)`);
  if (edcDineIn) ok(prev.bankBreakdown.some((b) => b.method === 'edc' && b.bank === 'BCA' && b.total === edcTotal), 'bankBreakdown ada edc/BCA whole-day');

  console.log('\n[3] Permission: kasir BUKAN penutup (Jason, penutup=Bryant) ditolak 403:');
  await expectErr(() => createSettlement(jason.id, UserRole.cashier, { date: businessDate, counts: {} }), 403, 'Jason (bukan penutup) settle');

  console.log('\n[4] Penutup (Bryant) settle → sukses, totalSystem whole-day:');
  const st = await createSettlement(bryant.id, UserRole.cashier, { date: businessDate, counts: {} });
  ok(st.totalSystem === expectedWholeDay, `settlement.totalSystem = ${st.totalSystem} (expect ${expectedWholeDay})`);

  console.log('\n[5] Double-settle tanggal sama → 409:');
  await expectErr(() => createSettlement(bryant.id, UserRole.cashier, { date: businessDate, counts: {} }), 409, 'settle kedua tanggal sama');

  console.log('\n[6] Void-after-settle: void tx1 (hari sudah di-settle) → 409:');
  await expectErr(() => voidTransaction(tx1.id, bryant.id), 409, 'void tx di hari yang sudah settle');

  console.log('\n[7] Dashboard owner today = whole-day revenue (atribusi shift.date):');
  const report = await getOwnerReport({ period: 'today' } as Parameters<typeof getOwnerReport>[0]);
  ok(report.revenue.total === expectedWholeDay, `owner revenue.total = ${report.revenue.total} (expect ${expectedWholeDay})`);

  console.log('\n[8] Rekonsiliasi kas: variance cash = fisik − (penjualan cash + modal awal):');
  // Bersihkan supaya hari ini bersih dari section sebelumnya.
  await prisma.settlementMethodCount.deleteMany({});
  await prisma.settlement.deleteMany({});
  await prisma.transactionPayment.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.shift.deleteMany({});

  const C = await openShift(jason.id, { type: ShiftType.pagi, openingCash: 120000 });
  const bizC = C.date;
  const txc = await createTransaction(jason.id, { orderType: 'dineIn', tableNumber: 1, items: [{ menuId: menu.id, qty: 1 }] } as TxInput);
  await addPayment(txc.id, jason.id, { method: 'cash', amount: txc.subtotal } as PayInput);
  await closeShift(C.id, jason.id, UserRole.cashier, 'final');

  const cashSales = txc.subtotal;
  const prevC = await previewSettlement(new Date(bizC + 'T00:00:00.000Z'));
  ok(prevC.openingCashTotal === 120000, `[8] openingCashTotal = ${prevC.openingCashTotal} (expect 120000)`);

  // Submit dengan fisik laci = modal + penjualan cash → variance kas 0.
  const fisikCocok = 120000 + cashSales;
  const stC = await createSettlement(jason.id, UserRole.cashier, { date: bizC, counts: { cash: fisikCocok } });
  const cashRow = stC.methodCounts.find((m) => m.paymentMethodCode === 'cash')!;
  ok(cashRow.expected === 120000 + cashSales, `[8] cash expected = ${cashRow.expected} (expect ${120000 + cashSales})`);
  ok(cashRow.variance === 0, `[8] fisik = modal+sales → variance cash = ${cashRow.variance} (expect 0)`);
  ok(stC.openingCashTotal === 120000, `[8] settlement.openingCashTotal = ${stC.openingCashTotal} (expect 120000)`);
  ok(stC.totalVariance === 0, `[8] totalVariance = ${stC.totalVariance} (expect 0)`);

  console.log(`\n[smoke-settlement] HASIL: ${pass} pass, ${fail} fail`);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => { console.error('[smoke-settlement] ERROR', e); await prisma.$disconnect(); process.exit(1); });
