// Integration smoke REV 2.11 - COGS pipeline end-to-end.
// Membuktikan: (1) MenuCostMovement initialSet, (2) manualEdit + getCostHistory
// newest-first, (3) unitCost snapshot varian (resolve via stockTarget), (4) unitCost
// snapshot paket (Σ cost komponen), (5) dashboard cogsTotal + profit = revenue − cogs,
// (6) cost TIDAK bocor di listMenus(includeCost=false) tapi ADA saat includeCost=true.
//
// WAJIB DB *_test. Jalankan:
//   npx tsx --env-file=.env.test scripts/smoke-cogs.ts
import 'dotenv/config';
import { ShiftType } from '@prisma/client';
import { prisma } from '../src/config/prisma';
import {
  upsertMenu,
  getCostHistory,
  listMenus,
} from '../src/modules/menus/menus.service';
import type { MenuUpsertInput } from '../src/modules/menus/menus.schema';
import { openShift } from '../src/modules/shifts/shifts.service';
import {
  createTransaction,
  addPayment,
} from '../src/modules/transactions/transactions.service';
import { getOwnerReport } from '../src/modules/dashboard/dashboard.service';

if (!/_test/.test(process.env.DATABASE_URL ?? '')) {
  throw new Error('REFUSE: smoke harus pakai DB *_test.');
}

let pass = 0;
let fail = 0;
const ok = (c: boolean, m: string) =>
  c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ FAIL: ${m}`));

// Tag unik supaya fixtures bisa di-clean idempoten tanpa ganggu seed.
const TAG = '[SMOKE-COGS]';

let smokeUserId = 0;
const createdMenuIds: number[] = [];

async function makeMenu(input: MenuUpsertInput) {
  const m = await upsertMenu(null, input, smokeUserId);
  createdMenuIds.push(m.id);
  return m;
}

// Base input scaffold (semua field wajib MenuUpsertInput) - override per fixture.
function baseInput(over: Partial<MenuUpsertInput>): MenuUpsertInput {
  return {
    name: `${TAG} unnamed`,
    category: 'SMOKE',
    price: 0,
    imageUrl: null,
    kind: 'simple',
    posVisible: true,
    stockType: 'nonStock',
    minStock: null,
    cost: null,
    optionGroups: [],
    variants: [],
    paketComponents: [],
    ...over,
  } as MenuUpsertInput;
}

async function cleanup() {
  // Bersihkan tx + dependents milik smoke (cascade items/selections/payments/movements).
  // Lalu menu fixtures (reverse create order karena FK Restrict pada stock/cost target).
  await prisma.transactionPayment.deleteMany({});
  await prisma.portionMovement.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.shift.deleteMany({});

  // Hapus MenuCostMovement milik fixtures dulu (FK ke Menu + User, no cascade dari Menu).
  if (createdMenuIds.length > 0) {
    await prisma.menuCostMovement.deleteMany({ where: { menuId: { in: createdMenuIds } } }).catch(() => {});
  }
  // Hapus juga fixtures TAG dari run sebelumnya yang mungkin tertinggal.
  const tagged = await prisma.menu.findMany({ where: { name: { startsWith: TAG } }, select: { id: true } });
  const allIds = [...new Set([...createdMenuIds, ...tagged.map((m) => m.id)])];
  if (allIds.length > 0) {
    await prisma.menuCostMovement.deleteMany({ where: { menuId: { in: allIds } } }).catch(() => {});
    // Hapus child yang memegang FK Restrict ke menu lain (paket components + variants) dulu.
    await prisma.paketComponent.deleteMany({ where: { paketMenuId: { in: allIds } } }).catch(() => {});
    await prisma.menuVariant.deleteMany({ where: { menuId: { in: allIds } } }).catch(() => {});
  }
  // Hapus menu reverse-order (paket/variant menunjuk leaf → hapus dulu yang nunjuk).
  for (const id of [...createdMenuIds].reverse()) {
    await prisma.menu.deleteMany({ where: { id } }).catch(() => {});
  }
  // Sapu sisa tagged yang belum kebagian (mis. dari run lama).
  await prisma.menu.deleteMany({ where: { name: { startsWith: TAG } } }).catch(() => {});
  createdMenuIds.length = 0;
}

async function main() {
  console.log(`[smoke-cogs] DB=${process.env.DATABASE_URL?.split('/').pop()}`);

  // Find-or-create owner untuk atribusi MenuCostMovement.userId.
  const existingOwner = await prisma.user.findFirst({ where: { role: 'owner' } });
  smokeUserId = existingOwner
    ? existingOwner.id
    : (await prisma.user.create({ data: { name: 'SMOKE Owner', pin: '000000', role: 'owner' } })).id;

  await cleanup();

  // Shift window dibuat permisif supaya shift pagi bisa dibuka kapan saja (mirror
  // smoke-tx-variants). taxEnabled=false supaya total = subtotal (PB1 tidak dihitung).
  await prisma.appSetting.update({
    where: { id: 1 },
    data: {
      taxEnabled: false,
      timezone: 'Asia/Jakarta',
      shiftPagiStart: '00:00',
      shiftChangeover: '23:58',
      shiftMalamEnd: '23:59',
    },
  });

  const cashier = await prisma.user.findFirst({ where: { role: 'cashier' } });
  if (!cashier) throw new Error('no cashier user di DB test');

  // ================================================================
  // [1] initialSet log
  // ================================================================
  console.log('\n[1] upsert menu simple portion dengan cost=9000 → MenuCostMovement initialSet:');
  const leaf = await makeMenu(
    baseInput({
      name: `${TAG} Paha Bakar`,
      category: 'Ayam',
      price: 15000,
      kind: 'simple',
      stockType: 'portion',
      minStock: 5,
      cost: 9000,
    }),
  );
  ok(leaf.cost === 9000, `menu detail emit cost=9000 (got ${leaf.cost})`);
  const initialMv = await prisma.menuCostMovement.findFirst({
    where: { menuId: leaf.id, reason: 'initialSet' },
  });
  ok(initialMv !== null, 'MenuCostMovement reason=initialSet tercatat');
  ok(initialMv?.costBefore === null, `initialSet costBefore=null (got ${initialMv?.costBefore})`);
  ok(
    initialMv != null && initialMv.costAfter != null && initialMv.costAfter.toNumber() === 9000,
    `initialSet costAfter=9000 (got ${initialMv?.costAfter?.toNumber()})`,
  );

  // ================================================================
  // [2] manualEdit log + getCostHistory newest-first
  // ================================================================
  console.log('\n[2] upsert ulang dengan cost=11000 → MenuCostMovement manualEdit + history newest-first:');
  await upsertMenu(
    leaf.id,
    baseInput({
      name: `${TAG} Paha Bakar`,
      category: 'Ayam',
      price: 15000,
      kind: 'simple',
      stockType: 'portion',
      minStock: 5,
      cost: 11000,
    }),
    smokeUserId,
  );
  const editMv = await prisma.menuCostMovement.findFirst({
    where: { menuId: leaf.id, reason: 'manualEdit' },
  });
  ok(editMv !== null, 'MenuCostMovement reason=manualEdit tercatat');
  ok(
    editMv != null && editMv.costBefore != null && editMv.costBefore.toNumber() === 9000,
    `manualEdit costBefore=9000 (got ${editMv?.costBefore?.toNumber()})`,
  );
  ok(
    editMv != null && editMv.costAfter != null && editMv.costAfter.toNumber() === 11000,
    `manualEdit costAfter=11000 (got ${editMv?.costAfter?.toNumber()})`,
  );
  const history = await getCostHistory(leaf.id);
  ok(history.length === 2, `getCostHistory return 2 movement (got ${history.length})`);
  ok(
    history[0]?.reason === 'manualEdit' && history[1]?.reason === 'initialSet',
    `history newest-first: [0]=manualEdit, [1]=initialSet (got [${history.map((h) => h.reason).join(', ')}])`,
  );
  ok(
    history[0]?.costAfter === 11000 && history[1]?.costAfter === 9000,
    `history costAfter values [11000, 9000] (got [${history.map((h) => h.costAfter).join(', ')}])`,
  );

  // ================================================================
  // Fixtures untuk snapshot unitCost (varian + paket)
  // ================================================================
  // Leaf porsi #2 "Sayur Asem" dengan cost diketahui, jadi stock+cost target varian.
  const SAYUR_COST = 4000;
  const sayur = await makeMenu(
    baseInput({
      name: `${TAG} Sayur Asem`,
      category: 'Sayur',
      price: 8000,
      kind: 'simple',
      posVisible: false,
      stockType: 'portion',
      minStock: 5,
      cost: SAYUR_COST,
    }),
  );

  // Menu VARIANT yang varian-nya menunjuk #sayur via stockTargetMenuId (resolve cost
  // via stockTarget karena costSource null). variant menu sendiri cost=null.
  const VARIANT_PRICE = 12000;
  const sayurVarian = await makeMenu(
    baseInput({
      name: `${TAG} Sayur (varian)`,
      category: 'Sayur',
      price: 0,
      kind: 'variant',
      stockType: 'nonStock',
      cost: null,
      optionGroups: [
        { name: 'Porsi', affectsVariant: true, displayOrder: 0, options: [{ label: 'Standar', displayOrder: 0 }] },
      ],
      variants: [
        {
          optionLabels: { Porsi: 'Standar' },
          label: 'Sayur Asem Standar',
          price: VARIANT_PRICE,
          stockTargetMenuId: sayur.id,
          costSourceMenuId: null,
          isActive: true,
          displayOrder: 0,
        },
      ],
    }),
  );
  const sayurVariant = sayurVarian.variants[0]!;

  // Leaf nasi nonStock dengan cost (komponen fixed paket, tidak punya stok).
  const NASI_COST = 2000;
  const nasi = await makeMenu(
    baseInput({
      name: `${TAG} Nasi Putih`,
      category: 'Nasi',
      price: 4000,
      kind: 'simple',
      posVisible: false,
      stockType: 'nonStock',
      cost: NASI_COST,
    }),
  );

  // Leaf drink nonStock dengan cost (opsi choice paket).
  const DRINK_COST = 1500;
  const drink = await makeMenu(
    baseInput({
      name: `${TAG} Es Teh`,
      category: 'Minuman',
      price: 5000,
      kind: 'simple',
      stockType: 'nonStock',
      cost: DRINK_COST,
    }),
  );

  // PAKET: fixed Nasi×1 + fixed Paha(leaf cost 11000)×1 + choice Minuman (opsi: drink).
  // Expected unitCost = NASI_COST + leaf.cost(11000) + DRINK_COST (saat pilih drink).
  const PAKET_PRICE = 25000;
  const paket = await makeMenu(
    baseInput({
      name: `${TAG} Paket Komplit`,
      category: 'Paket',
      price: PAKET_PRICE,
      kind: 'paket',
      stockType: 'nonStock',
      cost: null,
      paketComponents: [
        { kind: 'fixed', label: 'Nasi', qty: 1, displayOrder: 0, targetMenuId: nasi.id, targetVariantId: null, choiceOptions: [] },
        { kind: 'fixed', label: 'Ayam', qty: 1, displayOrder: 1, targetMenuId: leaf.id, targetVariantId: null, choiceOptions: [] },
        {
          kind: 'choice',
          label: 'Minuman',
          qty: 1,
          displayOrder: 2,
          targetMenuId: null,
          targetVariantId: null,
          choiceOptions: [
            { label: 'Es Teh', targetMenuId: drink.id, targetVariantId: null, upcharge: 0 },
          ],
        },
      ],
    }),
  );

  // Buka shift supaya createTransaction bisa attach.
  const shift = await openShift(cashier.id, { type: ShiftType.pagi, openingCash: 500000 });
  console.log(`  (shift #${shift.id} dibuka)`);

  // ================================================================
  // [3] unitCost snapshot - varian (resolve via stockTarget → #sayur cost)
  // ================================================================
  console.log('\n[3] Order menu varian → TransactionItem.unitCost = cost leaf stockTarget:');
  const VARIANT_QTY = 2;
  const txVariant = await createTransaction(cashier.id, {
    orderType: 'dineIn',
    tableNumber: 1,
    items: [{ menuId: sayurVarian.id, qty: VARIANT_QTY, variantId: sayurVariant.id }],
  } as Parameters<typeof createTransaction>[1]);
  const tiVariant = await prisma.transactionItem.findFirst({ where: { transactionId: txVariant.id } });
  ok(
    tiVariant?.unitCost != null && tiVariant.unitCost.toNumber() === SAYUR_COST,
    `varian unitCost = cost leaf stockTarget ${SAYUR_COST} (got ${tiVariant?.unitCost?.toNumber()})`,
  );

  // ================================================================
  // [4] unitCost snapshot - paket (Σ cost komponen resolved)
  // ================================================================
  console.log('\n[4] Order paket → TransactionItem.unitCost = Σ cost komponen resolved:');
  const PAKET_QTY = 1;
  const expectedPaketCost = NASI_COST + 11000 + DRINK_COST; // 2000 + 11000 + 1500 = 14500
  const txPaket = await createTransaction(cashier.id, {
    orderType: 'dineIn',
    tableNumber: 2,
    items: [
      {
        menuId: paket.id,
        qty: PAKET_QTY,
        paketChoices: { Minuman: { targetMenuId: drink.id, chosenLabel: 'Es Teh' } },
      },
    ],
  } as Parameters<typeof createTransaction>[1]);
  const tiPaket = await prisma.transactionItem.findFirst({ where: { transactionId: txPaket.id } });
  ok(
    tiPaket?.unitCost != null && tiPaket.unitCost.toNumber() === expectedPaketCost,
    `paket unitCost = Σ komponen ${expectedPaketCost} (Nasi ${NASI_COST}+Ayam 11000+Es Teh ${DRINK_COST}) (got ${tiPaket?.unitCost?.toNumber()})`,
  );

  // ================================================================
  // [5] dashboard COGS: bayar kedua tx → cogsTotal + profit
  // ================================================================
  console.log('\n[5] Bayar kedua tx → dashboard cogsTotal = Σ(unitCost×qty), profit = revenue − cogs:');
  // Bayar penuh (single tender cash). total = subtotal karena taxEnabled=false.
  const variantTotal = VARIANT_PRICE * VARIANT_QTY; // 24000
  await addPayment(txVariant.id, cashier.id, { method: 'cash', amount: variantTotal } as Parameters<typeof addPayment>[2]);
  await addPayment(txPaket.id, cashier.id, { method: 'cash', amount: PAKET_PRICE * PAKET_QTY } as Parameters<typeof addPayment>[2]);

  // Konfirmasi keduanya paid.
  const paidVariant = await prisma.transaction.findUnique({ where: { id: txVariant.id } });
  const paidPaket = await prisma.transaction.findUnique({ where: { id: txPaket.id } });
  ok(paidVariant?.status === 'paid' && paidPaket?.status === 'paid', 'kedua transaksi status=paid');

  // Expected COGS = Σ(unitCost × qty) untuk kedua tx.
  const expectedCogs = SAYUR_COST * VARIANT_QTY + expectedPaketCost * PAKET_QTY; // 4000*2 + 14500*1 = 22500
  const expectedRevenue = variantTotal + PAKET_PRICE * PAKET_QTY; // 24000 + 25000 = 49000

  // Periode owner report = business day shift (sama dengan shift.date). Pakai tanggal shift.
  const shiftDate = (await prisma.shift.findUnique({ where: { id: shift.id } }))!.date
    .toISOString()
    .substring(0, 10);
  const report = await getOwnerReport({ period: 'today', date: shiftDate } as Parameters<typeof getOwnerReport>[0]);
  ok(
    report.expense.cogsTotal === expectedCogs,
    `dashboard cogsTotal = ${expectedCogs} (got ${report.expense.cogsTotal})`,
  );
  ok(
    report.revenue.total === expectedRevenue,
    `dashboard revenue = ${expectedRevenue} (got ${report.revenue.total})`,
  );
  ok(
    report.profit === report.revenue.total - report.expense.cogsTotal,
    `profit === revenue − cogsTotal (${report.revenue.total} − ${report.expense.cogsTotal} = ${report.revenue.total - report.expense.cogsTotal}; got ${report.profit})`,
  );

  // ================================================================
  // [6] no public leak: listMenus(includeCost=false) omit cost; includeCost=true include
  // ================================================================
  console.log('\n[6] listMenus(includeCost=false) TIDAK bocorkan cost; includeCost=true MEMUAT cost:');
  const listQuery = { activeOnly: true, includeHidden: true, includePopularity: false } as Parameters<typeof listMenus>[0];
  const publicList = await listMenus(listQuery, false);
  const publicLeaf = publicList.find((m) => m.id === leaf.id);
  ok(publicLeaf !== undefined, `menu leaf #${leaf.id} ada di list (sanity)`);
  // Tak ada satupun menu yang punya cost truthy saat includeCost=false.
  const anyCostLeak = publicList.some((m) => !!m.cost);
  ok(!anyCostLeak, 'TIDAK ada menu dengan cost truthy saat includeCost=false (no leak)');
  ok(
    publicLeaf?.cost === null,
    `cost di list public = null untuk leaf bercost (got ${publicLeaf?.cost})`,
  );

  const ownerList = await listMenus(listQuery, true);
  const ownerLeaf = ownerList.find((m) => m.id === leaf.id);
  ok(
    ownerLeaf?.cost === 11000,
    `owner path includeCost=true MEMUAT cost=11000 untuk leaf (got ${ownerLeaf?.cost})`,
  );

  console.log(`\n[smoke-cogs] HASIL: ${pass} pass, ${fail} fail`);
}

main()
  .then(async () => {
    await cleanup();
    await prisma.$disconnect();
    if (fail > 0) process.exit(1);
  })
  .catch(async (e) => {
    console.error('[smoke-cogs] ERROR', e);
    await cleanup().catch(() => {});
    await prisma.$disconnect();
    process.exit(1);
  });
