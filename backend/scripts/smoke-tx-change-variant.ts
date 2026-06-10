// REV 2.14 smoke: changeTransactionItemVariant - ubah varian/paket in-place.
// WAJIB DB *_test. Jalankan: npx tsx --env-file=.env.test scripts/smoke-tx-change-variant.ts
import 'dotenv/config';
import { UserRole, ShiftType, MenuKind, StockType, PaketComponentKind } from '@prisma/client';
import { prisma } from '../src/config/prisma';
import { openShift } from '../src/modules/shifts/shifts.service';
import {
  createTransaction,
  changeTransactionItemVariant,
  voidTransaction,
  getTransactionById,
} from '../src/modules/transactions/transactions.service';

if (!/_test/.test(process.env.DATABASE_URL ?? '')) {
  throw new Error('REFUSE: smoke harus pakai DB *_test.');
}

let pass = 0,
  fail = 0;
const ok = (c: boolean, m: string) =>
  c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ FAIL: ${m}`));

const TAG = '[SMOKE-CV214]';

async function cleanupFixtures() {
  await prisma.transactionPayment.deleteMany({});
  await prisma.portionMovement.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.shift.deleteMany({});
  const old = await prisma.menu.findMany({ where: { name: { startsWith: TAG } }, select: { id: true } });
  const ids = old.map((m) => m.id);
  if (ids.length > 0) {
    await prisma.paketComponent.deleteMany({ where: { paketMenuId: { in: ids } } });
    await prisma.menuVariant.deleteMany({ where: { menuId: { in: ids } } });
    await prisma.menu.deleteMany({ where: { id: { in: ids } } });
  }
}

async function main() {
  console.log(`[smoke-tx-change-variant] DB=${process.env.DATABASE_URL?.split('/').pop()}`);
  await cleanupFixtures();
  await prisma.appSetting.update({
    where: { id: 1 },
    data: { taxEnabled: false, timezone: 'Asia/Jakarta', shiftPagiStart: '00:00', shiftChangeover: '23:58', shiftMalamEnd: '23:59' },
  });

  const cashier = await prisma.user.findFirst({ where: { role: UserRole.cashier } });
  if (!cashier) throw new Error('no cashier');

  // Fixtures: 2 menu porsi (A & B), 1 menu varian dgn 2 varian → A / B.
  const STOCK = 100;
  const portionA = await prisma.menu.create({
    data: { name: `${TAG} Porsi A`, category: 'SMOKE', price: 0, stockType: StockType.portion, kind: MenuKind.simple, posVisible: false, minStock: 5, portionStock: { create: { currentQty: STOCK, minStock: 5, openingQtyToday: STOCK } } },
  });
  const portionB = await prisma.menu.create({
    data: { name: `${TAG} Porsi B`, category: 'SMOKE', price: 0, stockType: StockType.portion, kind: MenuKind.simple, posVisible: false, minStock: 5, portionStock: { create: { currentQty: STOCK, minStock: 5, openingQtyToday: STOCK } } },
  });
  const PRICE_A = 20000, PRICE_B = 25000;
  const variantMenu = await prisma.menu.create({
    data: { name: `${TAG} Ayam (varian)`, category: 'SMOKE', price: 0, stockType: StockType.nonStock, kind: MenuKind.variant, posVisible: true },
  });
  const varA = await prisma.menuVariant.create({ data: { menuId: variantMenu.id, label: 'Dada', price: PRICE_A, stockTargetMenuId: portionA.id } });
  const varB = await prisma.menuVariant.create({ data: { menuId: variantMenu.id, label: 'Paha', price: PRICE_B, stockTargetMenuId: portionB.id } });

  // Paket dgn 1 slot choice "Lauk" → opsi A (porsiA) / B (porsiB).
  const PAKET_PRICE = 40000;
  const paket = await prisma.menu.create({
    data: { name: `${TAG} Paket Uji`, category: 'SMOKE', price: PAKET_PRICE, stockType: StockType.nonStock, kind: MenuKind.paket, posVisible: true },
  });
  await prisma.paketComponent.create({
    data: {
      paketMenuId: paket.id, kind: PaketComponentKind.choice, label: 'Lauk', qty: 1,
      choiceOptions: { create: [ { label: 'Lauk A', targetMenuId: portionA.id }, { label: 'Lauk B', targetMenuId: portionB.id } ] },
    },
  });

  const shift = await openShift(cashier.id, { type: ShiftType.pagi, openingCash: 500000 });
  void shift;
  const stockOf = async (menuId: number) => (await prisma.portionStock.findUnique({ where: { menuId } }))!.currentQty;
  const create = createTransaction as unknown as (uid: number, input: unknown) => ReturnType<typeof createTransaction>;
  const change = changeTransactionItemVariant as unknown as (tid: number, iid: number, uid: number, input: unknown) => ReturnType<typeof changeTransactionItemVariant>;

  // [1] Order varian Dada qty 2 → portionA -2. Ubah ke Paha → portionA +2 (balik), portionB -2.
  console.log('\n[1] Ubah varian Dada → Paha:');
  const tx1 = await create(cashier.id, { orderType: 'dineIn', tableNumber: 1, items: [{ menuId: variantMenu.id, qty: 2, variantId: varA.id }] });
  ok((await stockOf(portionA.id)) === STOCK - 2, `portionA -2 setelah order Dada (${await stockOf(portionA.id)})`);
  const item1 = (await prisma.transactionItem.findFirst({ where: { transactionId: tx1.id } }))!;
  const after1 = await change(tx1.id, item1.id, cashier.id, { variantId: varB.id });
  ok((await stockOf(portionA.id)) === STOCK, `portionA balik ke ${STOCK} (got ${await stockOf(portionA.id)})`);
  ok((await stockOf(portionB.id)) === STOCK - 2, `portionB -2 (got ${await stockOf(portionB.id)})`);
  const item1b = (await prisma.transactionItem.findUnique({ where: { id: item1.id } }))!;
  ok(item1b.variantId === varB.id, `item.variantId = Paha (${item1b.variantId})`);
  ok(item1b.unitPrice.toNumber() === PRICE_B, `unitPrice = ${PRICE_B} (got ${item1b.unitPrice.toNumber()})`);
  ok(item1b.subtotal.toNumber() === PRICE_B * 2, `item.subtotal = ${PRICE_B * 2} (got ${item1b.subtotal.toNumber()})`);
  ok(after1.subtotal === PRICE_B * 2, `Tx.subtotal = ${PRICE_B * 2} (got ${after1.subtotal})`);

  // [2] Order paket choice Lauk A qty 1 → portionA -1. Ubah ke Lauk B → portionA +1, portionB -1.
  console.log('\n[2] Ubah pilihan paket Lauk A → Lauk B:');
  const baseA = await stockOf(portionA.id);
  const baseB = await stockOf(portionB.id);
  const tx2 = await create(cashier.id, { orderType: 'dineIn', tableNumber: 2, items: [{ menuId: paket.id, qty: 1, paketChoices: { Lauk: { targetMenuId: portionA.id, chosenLabel: 'Lauk A' } } }] });
  ok((await stockOf(portionA.id)) === baseA - 1, `portionA -1 setelah paket Lauk A (got ${await stockOf(portionA.id)})`);
  const item2 = (await prisma.transactionItem.findFirst({ where: { transactionId: tx2.id } }))!;
  await change(tx2.id, item2.id, cashier.id, { paketChoices: { Lauk: { targetMenuId: portionB.id, chosenLabel: 'Lauk B' } } });
  ok((await stockOf(portionA.id)) === baseA, `portionA balik (got ${await stockOf(portionA.id)})`);
  ok((await stockOf(portionB.id)) === baseB - 1, `portionB -1 (got ${await stockOf(portionB.id)})`);
  const sel2 = await prisma.transactionItemSelection.findMany({ where: { transactionItemId: item2.id } });
  ok(sel2.length === 1 && sel2[0]?.chosenLabel === 'Lauk B' && sel2[0]?.targetMenuId === portionB.id, `selection terganti ke Lauk B (got ${sel2[0]?.chosenLabel})`);

  // [3] No-op guard: ubah ke varian yang SAMA → tidak ada movement baru.
  console.log('\n[3] No-op guard (varian sama):');
  const movBefore = await prisma.portionMovement.count({ where: { transactionId: tx1.id } });
  await change(tx1.id, item1.id, cashier.id, { variantId: varB.id });
  const movAfter = await prisma.portionMovement.count({ where: { transactionId: tx1.id } });
  ok(movBefore === movAfter, `tidak ada movement baru saat varian tidak berubah (${movBefore} == ${movAfter})`);

  // [4] Negatif: Tx void → ubah varian ditolak.
  console.log('\n[4] Negatif: Tx non-open ditolak:');
  const tx3 = await create(cashier.id, { orderType: 'dineIn', tableNumber: 3, items: [{ menuId: variantMenu.id, qty: 1, variantId: varA.id }] });
  const item3 = (await prisma.transactionItem.findFirst({ where: { transactionId: tx3.id } }))!;
  await voidTransaction(tx3.id, cashier.id);
  let threw = false;
  try { await change(tx3.id, item3.id, cashier.id, { variantId: varB.id }); } catch { threw = true; }
  ok(threw, 'ubah varian pada Tx void → throw');

  // [5] Negatif: itemId asing → 404/throw.
  console.log('\n[5] Negatif: item bukan milik Tx:');
  let threw2 = false;
  try { await change(tx1.id, item2.id, cashier.id, { variantId: varA.id }); } catch { threw2 = true; }
  ok(threw2, 'itemId milik Tx lain → throw');

  void getTransactionById;
  console.log(`\n[smoke-tx-change-variant] PASS=${pass} FAIL=${fail}`);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
