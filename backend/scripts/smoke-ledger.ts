// REV 2.8 integration smoke — stock movement LEDGER (FK sumber + qty_before/after).
// WAJIB DB *_test. Jalankan: npx tsx --env-file=.env.test scripts/smoke-ledger.ts
//
// REV 2.11 (2026-05-30): test purchase (raw material movement) DIHAPUS setelah model
// Vendor/Purchase/PurchaseItem/RawMaterial/RawMaterialMovement di-drop. Import
// createPurchase + RawMaterialMovementReason dibuang. Coverage tersisa = ledger stok
// porsi (PortionMovement) yang masih berlaku.
//
// Memverifikasi tiap titik tulis movement kini mengisi FK dokumen sumber + snapshot qty:
//   order/void/edit (portion) → transaction_id + transaction_item_id + before/after
//   restock/opname (portion)  → before/after, FK transaksi null
import 'dotenv/config';
import { UserRole, ShiftType, PortionMovementReason } from '@prisma/client';
import { prisma } from '../src/config/prisma';
import { openShift } from '../src/modules/shifts/shifts.service';
import {
  createTransaction,
  voidTransaction,
} from '../src/modules/transactions/transactions.service';
import {
  restockMorning,
  opname,
  listPortionStocks,
  getPortionStockDetail,
} from '../src/modules/stocks/portion.service';

if (!/_test/.test(process.env.DATABASE_URL ?? '')) {
  throw new Error('REFUSE: smoke harus pakai DB *_test.');
}

let pass = 0;
let fail = 0;
const ok = (c: boolean, m: string) => {
  c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ FAIL: ${m}`));
};

async function latestPortionMovement(menuId: number, reason: PortionMovementReason) {
  return prisma.portionMovement.findFirst({
    where: { menuId, reason },
    orderBy: { id: 'desc' },
  });
}

async function main() {
  console.log(`[smoke-ledger] DB=${process.env.DATABASE_URL?.split('/').pop()}`);
  await prisma.settlementMethodCount.deleteMany({});
  await prisma.settlement.deleteMany({});
  await prisma.transactionPayment.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.shift.deleteMany({});
  await prisma.appSetting.update({
    where: { id: 1 },
    data: { taxEnabled: false, timezone: 'Asia/Jakarta', shiftPagiStart: '00:00', shiftChangeover: '23:58', shiftMalamEnd: '23:59' },
  });

  const cashier = await prisma.user.findFirst({ where: { role: UserRole.cashier } });
  if (!cashier) throw new Error('no cashier');
  const menu = await prisma.menu.findFirst({ where: { isActive: true, stockType: 'portion' } });
  if (!menu) throw new Error('no portion menu');

  await openShift(cashier.id, { type: ShiftType.pagi, openingCash: 500000 });

  // ── 1. ORDER: movement reason=order ber-FK + before/after ───────────────
  console.log('\n[1] createTransaction → movement order ber-FK + qty snapshot:');
  const stockBefore = (await prisma.portionStock.findUnique({ where: { menuId: menu.id } }))!.currentQty;
  const tx = await createTransaction(cashier.id, {
    orderType: 'dineIn',
    tableNumber: 1,
    items: [{ menuId: menu.id, qty: 2 }],
  } as Parameters<typeof createTransaction>[1]);
  const ordMov = await latestPortionMovement(menu.id, PortionMovementReason.order);
  ok(!!ordMov, 'movement order tercatat');
  ok(ordMov?.transactionId === tx.id, `transaction_id = tx.id (${ordMov?.transactionId} == ${tx.id})`);
  ok(ordMov?.transactionItemId != null, `transaction_item_id terisi (${ordMov?.transactionItemId})`);
  ok(ordMov?.qtyBefore === stockBefore, `qty_before = ${stockBefore} (got ${ordMov?.qtyBefore})`);
  ok(ordMov?.qtyAfter === stockBefore - 2, `qty_after = before-2 = ${stockBefore - 2} (got ${ordMov?.qtyAfter})`);
  ok(
    ordMov != null && ordMov.qtyAfter! === ordMov.qtyBefore! + ordMov.delta,
    'invariant after = before + delta',
  );

  // ── 2. VOID: movement refundVoid ber-FK + reverse before/after ──────────
  console.log('\n[2] voidTransaction → movement refundVoid ber-FK + reverse:');
  const beforeVoid = (await prisma.portionStock.findUnique({ where: { menuId: menu.id } }))!.currentQty;
  await voidTransaction(tx.id, cashier.id);
  const voidMov = await latestPortionMovement(menu.id, PortionMovementReason.refundVoid);
  ok(voidMov?.transactionId === tx.id, `void transaction_id = tx.id (${voidMov?.transactionId})`);
  ok(voidMov?.transactionItemId != null, `void transaction_item_id terisi (${voidMov?.transactionItemId})`);
  ok(voidMov?.qtyBefore === beforeVoid, `void qty_before = ${beforeVoid} (got ${voidMov?.qtyBefore})`);
  ok(voidMov?.qtyAfter === beforeVoid + 2, `void qty_after = before+2 (got ${voidMov?.qtyAfter})`);

  // ── 3. RESTOCK PAGI: before/after, FK transaksi null ────────────────────
  console.log('\n[3] restockMorning → before/after, FK null:');
  const beforeRestock = (await prisma.portionStock.findUnique({ where: { menuId: menu.id } }))!.currentQty;
  await restockMorning(cashier.id, { items: [{ menuId: menu.id, qty: 5 }] });
  const reMov = await latestPortionMovement(menu.id, PortionMovementReason.restockMorning);
  ok(reMov?.transactionId == null, 'restock transaction_id null');
  ok(reMov?.qtyBefore === beforeRestock, `restock qty_before = ${beforeRestock} (got ${reMov?.qtyBefore})`);
  ok(reMov?.qtyAfter === beforeRestock + 5, `restock qty_after = before+5 (got ${reMov?.qtyAfter})`);

  // ── 4. OPNAME: before/after dari selisih ────────────────────────────────
  console.log('\n[4] opname → before/after, FK null:');
  const beforeOpname = (await prisma.portionStock.findUnique({ where: { menuId: menu.id } }))!.currentQty;
  const target = beforeOpname + 3;
  await opname(cashier.id, { items: [{ menuId: menu.id, qtyFisik: target }], note: 'Opname smoke' });
  const opMov = await latestPortionMovement(menu.id, PortionMovementReason.manualAdjust);
  ok(opMov?.transactionId == null, 'opname transaction_id null');
  ok(opMov?.qtyBefore === beforeOpname, `opname qty_before = ${beforeOpname} (got ${opMov?.qtyBefore})`);
  ok(opMov?.qtyAfter === target, `opname qty_after = ${target} (got ${opMov?.qtyAfter})`);

  // ── 5. ENDPOINT SHAPE: list lastStockedAt + detail userName/qty/FK ──────
  console.log('\n[5] view shapes: list lastStockedAt + detail userName/qty/FK:');
  const list = await listPortionStocks({} as Parameters<typeof listPortionStocks>[0]);
  const listed = list.find((s) => s.menuId === menu.id);
  ok(listed != null, 'menu ada di list');
  ok('lastStockedAt' in (listed ?? {}), 'field lastStockedAt ada di view');
  ok(listed?.lastStockedAt != null, `lastStockedAt terisi (baru saja opname/restock) → ${listed?.lastStockedAt}`);

  const detail = await getPortionStockDetail(menu.id, 30);
  const ordInHistory = detail.recentMovements.find((m) => m.reason === PortionMovementReason.order);
  ok(detail.recentMovements.length > 0, `detail recentMovements ada (${detail.recentMovements.length})`);
  ok(
    detail.recentMovements.every((m) => typeof m.userName === 'string' && m.userName.length > 0),
    'semua movement punya userName',
  );
  ok(
    detail.recentMovements.some((m) => m.qtyBefore != null && m.qtyAfter != null),
    'movement punya qtyBefore/qtyAfter',
  );
  ok(ordInHistory?.transactionId != null, `movement order di history ber-transactionId (${ordInHistory?.transactionId})`);

  console.log(`\n[smoke-ledger] HASIL: ${pass} pass, ${fail} fail`);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error('[smoke-ledger] ERROR', e);
  await prisma.$disconnect();
  process.exit(1);
});
