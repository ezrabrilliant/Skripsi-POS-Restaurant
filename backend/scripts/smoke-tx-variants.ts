// REV 2.10 P3 smoke: FK-based stock resolution + variant/selection recording.
// WAJIB DB *_test. Jalankan: npx tsx --env-file=.env.test scripts/smoke-tx-variants.ts
import 'dotenv/config';
import { UserRole, ShiftType, MenuKind, StockType, PaketComponentKind } from '@prisma/client';
import { prisma } from '../src/config/prisma';
import { openShift } from '../src/modules/shifts/shifts.service';
import {
  createTransaction,
  voidTransaction,
  getTransactionById,
  listTransactions,
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

  // 5. Menu PORTION target KEDUA (distinct dari #portion) untuk slot choice
  //    stock-bearing - supaya decrement fixed vs choice bisa dibedakan tegas.
  const STOCK2_START = 80;
  const portion2 = await prisma.menu.create({
    data: {
      name: `${TAG} Sayur Asem`,
      category: 'SMOKE',
      price: 8000,
      stockType: StockType.portion,
      kind: MenuKind.simple,
      posVisible: false,
      minStock: 5,
      portionStock: { create: { currentQty: STOCK2_START, minStock: 5, openingQtyToday: STOCK2_START } },
    },
  });

  // 6. Menu VARIANT kedua yang varian-nya menunjuk stok porsi #portion2.
  const VARIANT2_PRICE = 12000;
  const variant2Menu = await prisma.menu.create({
    data: {
      name: `${TAG} Sayur (varian)`,
      category: 'SMOKE',
      price: 0,
      stockType: StockType.nonStock,
      kind: MenuKind.variant,
      posVisible: true,
    },
  });
  const variant2 = await prisma.menuVariant.create({
    data: {
      menuId: variant2Menu.id,
      label: 'Sayur Asem / Porsi',
      price: VARIANT2_PRICE,
      stockTargetMenuId: portion2.id,
    },
  });

  // 7. Menu PAKET kedua: fixed×2 → #portion + choice "Sayur" yang opsinya adalah
  //    VARIAN STOCK-BEARING (variant2 → #portion2). Memilih opsi ini harus
  //    men-decrement #portion2 sesuai deduction varian × qty order.
  const PAKET2_PRICE = 50000;
  const paket2 = await prisma.menu.create({
    data: {
      name: `${TAG} Paket Lengkap`,
      category: 'SMOKE',
      price: PAKET2_PRICE,
      stockType: StockType.nonStock,
      kind: MenuKind.paket,
      posVisible: true,
    },
  });
  await prisma.paketComponent.create({
    data: {
      paketMenuId: paket2.id,
      kind: PaketComponentKind.fixed,
      label: 'Ayam',
      qty: 2,
      targetMenuId: portion.id,
    },
  });
  await prisma.paketComponent.create({
    data: {
      paketMenuId: paket2.id,
      kind: PaketComponentKind.choice,
      label: 'Sayur',
      qty: 1,
      choiceOptions: {
        create: [
          { label: 'Sayur Asem (varian)', targetMenuId: variant2Menu.id, targetVariantId: variant2.id },
        ],
      },
    },
  });

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

  // ---- [4] Order PAKET2 (qty 3) pilih choice STOCK-BEARING variant2 ----
  //   fixed×2 → #portion (decrement 2×3=6); choice variant2 (deduct 1) → #portion2 (decrement 1×3=3).
  console.log('\n[4] Order paket2 (qty 3) pilih choice stock-bearing variant → DUA target decrement:');
  const before4Fixed = await stockOf(portion.id);
  const before4Choice = await stockOf(portion2.id);
  const ORDER_QTY = 3;
  const tx4 = await createTransaction(cashier.id, {
    orderType: 'dineIn',
    tableNumber: 3,
    items: [
      {
        menuId: paket2.id,
        qty: ORDER_QTY,
        paketChoices: {
          Sayur: { targetMenuId: variant2Menu.id, variantId: variant2.id, chosenLabel: 'Sayur Asem (varian)' },
        },
      },
    ],
  } as Parameters<typeof createTransaction>[1]);
  const after4Fixed = await stockOf(portion.id);
  const after4Choice = await stockOf(portion2.id);
  ok(
    after4Fixed === before4Fixed - 2 * ORDER_QTY,
    `fixed target turun ${2 * ORDER_QTY} (2 fixed × ${ORDER_QTY} qty) (${before4Fixed} → ${after4Fixed})`,
  );
  ok(
    after4Choice === before4Choice - 1 * ORDER_QTY,
    `choice stock-bearing variant target turun ${1 * ORDER_QTY} (1 deduct × ${ORDER_QTY} qty) (${before4Choice} → ${after4Choice})`,
  );
  const ti4 = await prisma.transactionItem.findFirst({ where: { transactionId: tx4.id } });
  const sels4 = await prisma.transactionItemSelection.findMany({ where: { transactionItemId: ti4!.id } });
  ok(
    sels4.length === 1 && sels4[0]?.groupOrSlotLabel === 'Sayur' && sels4[0]?.targetVariantId === variant2.id,
    `selection choice = {slot=Sayur, targetVariant=${variant2.id}} (got slot=${sels4[0]?.groupOrSlotLabel}, variant=${sels4[0]?.targetVariantId})`,
  );

  // ---- [5] Void paket2 tx → KEDUA target stok dikembalikan penuh ----
  console.log('\n[5] Void paket2 → kedua target stok (fixed + choice) dikembalikan penuh:');
  const voided4 = await voidTransaction(tx4.id, cashier.id);
  const restoreFixed = await stockOf(portion.id);
  const restoreChoice = await stockOf(portion2.id);
  ok(voided4.status === 'void', 'Tx4 status=void');
  ok(restoreFixed === before4Fixed, `fixed target kembali penuh (${after4Fixed} → ${restoreFixed}, awal ${before4Fixed})`);
  ok(restoreChoice === before4Choice, `choice target kembali penuh (${after4Choice} → ${restoreChoice}, awal ${before4Choice})`);

  // ---- [6] NEGATIF: paketChoices opsi BUKAN anggota slot → ditolak (validasi slot-choice) ----
  console.log('\n[6] Negatif: paketChoices opsi tidak dikenal untuk slot → createTransaction ditolak:');
  const before6Fixed = await stockOf(portion.id);
  const before6Choice = await stockOf(portion2.id);
  let rejected = false;
  let rejectMsg = '';
  try {
    await createTransaction(cashier.id, {
      orderType: 'dineIn',
      tableNumber: 4,
      items: [
        {
          menuId: paket2.id,
          qty: 1,
          // 'drink' BUKAN opsi sah untuk slot "Sayur" (slot hanya punya variant2).
          paketChoices: {
            Sayur: { targetMenuId: drink.id, chosenLabel: 'Es Teh' },
          },
        },
      ],
    } as Parameters<typeof createTransaction>[1]);
  } catch (e) {
    rejected = true;
    rejectMsg = e instanceof Error ? e.message : String(e);
  }
  ok(rejected, `createTransaction throw untuk opsi tak valid (msg: "${rejectMsg}")`);
  const after6Fixed = await stockOf(portion.id);
  const after6Choice = await stockOf(portion2.id);
  ok(
    after6Fixed === before6Fixed && after6Choice === before6Choice,
    `stok tidak berubah saat order ditolak (fixed ${before6Fixed}→${after6Fixed}, choice ${before6Choice}→${after6Choice})`,
  );

  // ---- [7] REV 2.10 P8: transaction VIEW mapper emit variantId + variantLabel ----
  // Fetch via getTransactionById (path detail dipakai controller) untuk tx1 (varian).
  console.log('\n[7] View getTransactionById emit variantId + variantLabel (order varian):');
  const view1 = await getTransactionById(tx1.id);
  const vItem = view1.items[0]!;
  ok(vItem.variantId === variant.id, `view item variantId = ${variant.id} (got ${vItem.variantId})`);
  ok(vItem.variantLabel === variant.label, `view item variantLabel = "${variant.label}" (got "${vItem.variantLabel}")`);
  ok(Array.isArray(vItem.selections), 'view item selections adalah array');

  // ---- [8] REV 2.10 P8: VIEW mapper emit selections untuk order paket ----
  // Order paket baru (qty 1) pilih slot choice → fetch via listTransactions (path
  // yang dipakai HistoryPage) → assert selections terisi + slot label benar.
  console.log('\n[8] View listTransactions emit selections (order paket):');
  const txPaketView = await createTransaction(cashier.id, {
    orderType: 'dineIn',
    tableNumber: 5,
    items: [
      {
        menuId: paket.id,
        qty: 1,
        paketChoices: { Minuman: { targetMenuId: drink.id, chosenLabel: 'Es Teh' } },
      },
    ],
  } as Parameters<typeof createTransaction>[1]);
  const list = await listTransactions({ status: 'open' } as Parameters<typeof listTransactions>[0]);
  const listed = list.find((t) => t.id === txPaketView.id);
  ok(listed !== undefined, `paket tx #${txPaketView.id} ditemukan via listTransactions`);
  const pItem = listed?.items[0];
  ok(Array.isArray(pItem?.selections), 'paket view item selections adalah array');
  ok((pItem?.selections.length ?? 0) >= 1, `paket view item punya >=1 selection (got ${pItem?.selections.length ?? 0})`);
  const slot = pItem?.selections.find((s) => s.groupOrSlotLabel === 'Minuman');
  ok(
    slot !== undefined && slot.chosenLabel === 'Es Teh' && slot.isPreference === false,
    `selection slot = {Minuman: Es Teh, isPreference=false} (got slot=${slot?.groupOrSlotLabel}, label=${slot?.chosenLabel}, pref=${slot?.isPreference})`,
  );

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
