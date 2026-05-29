// REV 2.10 P3 smoke: FK-based stock resolution + variant/selection recording.
// WAJIB DB *_test. Jalankan: npx tsx --env-file=.env.test scripts/smoke-tx-variants.ts
import 'dotenv/config';
import { UserRole, ShiftType, MenuKind, StockType, PaketComponentKind } from '@prisma/client';
import { prisma } from '../src/config/prisma';
import { openShift } from '../src/modules/shifts/shifts.service';
import {
  createTransaction,
  voidTransaction,
} from '../src/modules/transactions/transactions.service';

if (!/_test/.test(process.env.DATABASE_URL ?? '')) {
  throw new Error('REFUSE: smoke harus pakai DB *_test.');
}

let pass = 0,
  fail = 0;
const ok = (c: boolean, m: string) =>
  c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ FAIL: ${m}`));

// Tag unik untuk fixtures supaya bisa di-clean idempoten tanpa ganggu seed.
const TAG = '[SMOKE-V210]';

async function cleanupFixtures() {
  // Hapus tx + dependents milik smoke (cascade items/selections/movements via FK / manual).
  await prisma.transactionPayment.deleteMany({});
  await prisma.portionMovement.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.shift.deleteMany({});

  // Hapus fixtures menu lama. Urutan penting: MenuVariant.stockTargetMenuId +
  // PaketComponent/ChoiceOption target FK = onDelete:Restrict. Hapus dulu semua
  // varian + komponen paket milik smoke (yang memegang FK ke menu porsi), baru menu.
  const old = await prisma.menu.findMany({ where: { name: { startsWith: TAG } }, select: { id: true } });
  const ids = old.map((m) => m.id);
  if (ids.length > 0) {
    await prisma.paketComponent.deleteMany({ where: { paketMenuId: { in: ids } } }); // cascade choiceOptions
    await prisma.menuVariant.deleteMany({ where: { menuId: { in: ids } } });
    await prisma.menu.deleteMany({ where: { id: { in: ids } } });
  }
}

async function main() {
  console.log(`[smoke-tx-variants] DB=${process.env.DATABASE_URL?.split('/').pop()}`);
  await cleanupFixtures();
  await prisma.appSetting.update({
    where: { id: 1 },
    data: { taxEnabled: false, timezone: 'Asia/Jakarta', shiftPagiStart: '00:00', shiftChangeover: '23:58', shiftMalamEnd: '23:59' },
  });

  const cashier = await prisma.user.findFirst({ where: { role: UserRole.cashier } });
  if (!cashier) throw new Error('no cashier');

  // ---- Fixtures ----------------------------------------------------------
  // 1. Menu PORTION target (punya PortionStock dengan stok awal diketahui).
  const STOCK_START = 100;
  const portion = await prisma.menu.create({
    data: {
      name: `${TAG} Paha Ayam Bakar`,
      category: 'SMOKE',
      price: 15000,
      stockType: StockType.portion,
      kind: MenuKind.simple,
      posVisible: false,
      minStock: 5,
      portionStock: { create: { currentQty: STOCK_START, minStock: 5, openingQtyToday: STOCK_START } },
    },
  });

  // 2. Menu VARIANT yang varian-nya menunjuk stok porsi #portion.
  const VARIANT_PRICE = 22000;
  const variantMenu = await prisma.menu.create({
    data: {
      name: `${TAG} Ayam Bakar (varian)`,
      category: 'SMOKE',
      price: 0,
      stockType: StockType.nonStock,
      kind: MenuKind.variant,
      posVisible: true,
    },
  });
  const variant = await prisma.menuVariant.create({
    data: {
      menuId: variantMenu.id,
      label: 'Paha / Bakar',
      price: VARIANT_PRICE,
      stockTargetMenuId: portion.id,
    },
  });

  // 3. Menu MINUMAN nonStock (varian opsi paket yang TIDAK kurangi stok).
  const drink = await prisma.menu.create({
    data: {
      name: `${TAG} Es Teh`,
      category: 'SMOKE',
      price: 5000,
      stockType: StockType.nonStock,
      kind: MenuKind.simple,
      posVisible: true,
    },
  });

  // 4. Menu PAKET: fixed×2 → #portion + choice "Minuman" (opsi: variantMenu / drink).
  const PAKET_PRICE = 40000;
  const paket = await prisma.menu.create({
    data: {
      name: `${TAG} Paket Hemat`,
      category: 'SMOKE',
      price: PAKET_PRICE,
      stockType: StockType.nonStock,
      kind: MenuKind.paket,
      posVisible: true,
    },
  });
  await prisma.paketComponent.create({
    data: {
      paketMenuId: paket.id,
      kind: PaketComponentKind.fixed,
      label: 'Ayam',
      qty: 2,
      targetMenuId: portion.id,
    },
  });
  const choiceComp = await prisma.paketComponent.create({
    data: {
      paketMenuId: paket.id,
      kind: PaketComponentKind.choice,
      label: 'Minuman',
      qty: 1,
      choiceOptions: {
        create: [
          { label: 'Ayam Bakar (varian)', targetMenuId: variantMenu.id, targetVariantId: variant.id },
          { label: 'Es Teh', targetMenuId: drink.id },
        ],
      },
    },
  });
  void choiceComp;

  const shift = await openShift(cashier.id, { type: ShiftType.pagi, openingCash: 500000 });
  console.log(`  (shift #${shift.id} dibuka, stok awal porsi=${STOCK_START})`);

  const stockOf = async (menuId: number) =>
    (await prisma.portionStock.findUnique({ where: { menuId } }))!.currentQty;

  // ---- [1] Order VARIANT (qty 3) → decrement target portion 3, variantId + price ----
  console.log('\n[1] Order menu varian (qty 3) → decrement stok target:');
  const before1 = await stockOf(portion.id);
  const tx1 = await createTransaction(cashier.id, {
    orderType: 'dineIn',
    tableNumber: 1,
    items: [{ menuId: variantMenu.id, qty: 3, variantId: variant.id }],
  } as Parameters<typeof createTransaction>[1]);
  const after1 = await stockOf(portion.id);
  ok(after1 === before1 - 3, `stok porsi turun 3 (${before1} → ${after1})`);
  const ti1 = await prisma.transactionItem.findFirst({ where: { transactionId: tx1.id } });
  ok(ti1?.variantId === variant.id, `TransactionItem.variantId = ${variant.id} (got ${ti1?.variantId})`);
  ok(ti1?.unitPrice.toNumber() === VARIANT_PRICE, `unitPrice = harga varian ${VARIANT_PRICE} (got ${ti1?.unitPrice.toNumber()})`);
  ok(tx1.subtotal === VARIANT_PRICE * 3, `subtotal = ${VARIANT_PRICE * 3} (got ${tx1.subtotal})`);

  // ---- [2] Order PAKET (qty 2) pilih drink nonStock → hanya fixed yang decrement ----
  console.log('\n[2] Order paket (qty 2) pilih minuman nonStock → hanya fixed yang decrement:');
  const before2 = await stockOf(portion.id);
  const tx2 = await createTransaction(cashier.id, {
    orderType: 'dineIn',
    tableNumber: 2,
    items: [
      {
        menuId: paket.id,
        qty: 2,
        paketChoices: { Minuman: { targetMenuId: drink.id, chosenLabel: 'Es Teh' } },
      },
    ],
  } as Parameters<typeof createTransaction>[1]);
  const after2 = await stockOf(portion.id);
  // fixed qty 2 × item qty 2 = 4; drink nonStock = 0 decrement.
  ok(after2 === before2 - 4, `stok porsi turun 4 (2 fixed × 2 qty); minuman nonStock 0 (${before2} → ${after2})`);
  const ti2 = await prisma.transactionItem.findFirst({ where: { transactionId: tx2.id } });
  ok(ti2?.unitPrice.toNumber() === PAKET_PRICE, `unitPrice paket = harga base ${PAKET_PRICE} (got ${ti2?.unitPrice.toNumber()})`);
  ok(ti2?.variantId === null, `paket TransactionItem.variantId null (got ${ti2?.variantId})`);
  const sels = await prisma.transactionItemSelection.findMany({ where: { transactionItemId: ti2!.id } });
  ok(sels.length === 1, `1 selection row tercatat untuk slot choice (got ${sels.length})`);
  ok(
    sels[0]?.groupOrSlotLabel === 'Minuman' && sels[0]?.chosenLabel === 'Es Teh' && sels[0]?.targetMenuId === drink.id && sels[0]?.isPreference === false,
    `selection = {slot=Minuman, label=Es Teh, target=${drink.id}, isPreference=false}`,
  );

  // ---- [3] Void paket tx → stok restored ----
  console.log('\n[3] Void transaksi paket → stok dikembalikan:');
  const beforeVoid = await stockOf(portion.id);
  const voided = await voidTransaction(tx2.id, cashier.id);
  const afterVoid = await stockOf(portion.id);
  ok(voided.status === 'void', 'Tx2 status=void');
  ok(afterVoid === beforeVoid + 4, `stok porsi naik 4 (restore fixed 2×2) (${beforeVoid} → ${afterVoid})`);

  console.log(`\n[smoke-tx-variants] HASIL: ${pass} pass, ${fail} fail`);

  // Cleanup fixtures supaya idempoten + tidak nyampah test DB.
  await cleanupFixtures();
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error('[smoke-tx-variants] ERROR', e);
  await prisma.$disconnect();
  process.exit(1);
});
