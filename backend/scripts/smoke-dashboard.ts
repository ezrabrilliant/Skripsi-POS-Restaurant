// Integration smoke REV 2.13 - analitik dashboard owner + kartu kasir.
// WAJIB DB *_test. Jalankan: npx tsx --env-file=.env.test scripts/smoke-dashboard.ts
//
// Seed langsung via prisma (kontrol presisi shift.date, merge-exclusion, orderType,
// settlement counts) lalu assert output 4 service function:
//   getOwnerMenuPerformance / getOwnerTrend / getOwnerStaff / getCashierDashboard
import 'dotenv/config';
import { OrderType, ShiftType, TransactionStatus, UserRole } from '@prisma/client';
import { prisma } from '../src/config/prisma';
import { getShiftWindow } from '../src/modules/settings/settings.service';
import { businessDateFor } from '../src/modules/shifts/shift-time';
import {
  getOwnerMenuPerformance,
  getOwnerTrend,
  getOwnerStaff,
  getCashierDashboard,
} from '../src/modules/dashboard/dashboard.service';

if (!/_test/.test(process.env.DATABASE_URL ?? '')) throw new Error('REFUSE: smoke harus pakai DB *_test.');

let pass = 0,
  fail = 0;
const ok = (c: boolean, m: string) => {
  c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ FAIL: ${m}`));
};

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const atUtc = (base: Date, utcHour: number) => new Date(base.getTime() + utcHour * 3600_000);

async function main() {
  console.log(`[smoke-dashboard] DB=${process.env.DATABASE_URL?.split('/').pop()}`);

  // --- bersih-bersih (FK order) ---
  await prisma.transactionPayment.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.settlement.deleteMany({});
  await prisma.shift.deleteMany({});
  await prisma.menu.deleteMany({ where: { name: { startsWith: 'TEST ' } } });

  // window non-cross-midnight supaya businessDateFor(now) = tanggal Jakarta hari ini.
  await prisma.appSetting.update({
    where: { id: 1 },
    data: { taxEnabled: false, timezone: 'Asia/Jakarta', shiftPagiStart: '06:00', shiftChangeover: '17:00', shiftMalamEnd: '23:59' },
  });
  const window = await getShiftWindow();
  const todayBiz = businessDateFor(window, new Date());
  const yestBiz = new Date(todayBiz);
  yestBiz.setUTCDate(yestBiz.getUTCDate() - 1);

  // --- aktor ---
  const cashier1 = await prisma.user.findFirst({ where: { role: UserRole.cashier } });
  const cashier2 = await prisma.user.findFirst({ where: { role: UserRole.cashier, id: { not: cashier1!.id } } });
  if (!cashier1 || !cashier2) throw new Error('seed kurang: butuh 2 cashier');

  // payment methods utk settlement counts (FK code). Upsert kalau belum ada.
  for (const [code, label] of [['cash', 'Tunai'], ['edc', 'EDC'], ['qris', 'QRIS']] as const) {
    await prisma.paymentMethod.upsert({
      where: { code },
      update: {},
      create: { code, label, colorHex: '#888888', iconName: 'Wallet', requiresBank: code === 'edc' },
    });
  }

  // --- menu test (kontrol harga + cost) ---
  const mkMenu = (name: string, category: string, price: number, cost: number | null) =>
    prisma.menu.create({ data: { name, category, price, cost, stockType: 'nonStock' } });
  const menuA = await mkMenu('TEST Ayam', 'Ayam', 20000, 12000);
  const menuB = await mkMenu('TEST Seafood', 'Seafood', 50000, 30000);
  const menuC = await mkMenu('TEST Teh', 'Minuman', 5000, null); // cost null → cogs 0

  // --- shift: today (cashier1, OPEN) + yesterday (cashier2, CLOSED) ---
  const shiftToday = await prisma.shift.create({
    data: { date: todayBiz, type: ShiftType.pagi, cashierId: cashier1.id, openingCash: 500000, activeMarker: 1 },
  });
  const shiftYest = await prisma.shift.create({
    data: { date: yestBiz, type: ShiftType.malam, cashierId: cashier2.id, openingCash: 300000, closedAt: new Date() },
  });

  // helper buat transaksi paid + items + payment
  type ItemSpec = { menuId: number; qty: number; unitPrice: number; unitCost: number | null };
  async function mkTx(opts: {
    shiftId: number;
    cashierId: number;
    orderType: OrderType;
    tableNumber?: number;
    items: ItemSpec[];
    method: string;
    bank?: string;
    createdAt: Date;
    status?: TransactionStatus;
    mergedIntoId?: number;
  }) {
    const subtotal = opts.items.reduce((s, it) => s + it.unitPrice * it.qty, 0);
    const status = opts.status ?? TransactionStatus.paid;
    const tx = await prisma.transaction.create({
      data: {
        shiftId: opts.shiftId,
        createdById: opts.cashierId,
        orderType: opts.orderType,
        tableNumber: opts.tableNumber ?? null,
        status,
        mergedIntoId: opts.mergedIntoId ?? null,
        subtotal,
        total: subtotal,
        createdAt: opts.createdAt,
        paidAt: status === TransactionStatus.paid ? opts.createdAt : null,
        items: {
          create: opts.items.map((it) => ({
            menuId: it.menuId,
            qty: it.qty,
            unitPrice: it.unitPrice,
            subtotal: it.unitPrice * it.qty,
            unitCost: it.unitCost,
          })),
        },
      },
    });
    if (status === TransactionStatus.paid) {
      await prisma.transactionPayment.create({
        data: { transactionId: tx.id, method: opts.method, bank: opts.bank ?? null, amount: subtotal, recordedById: opts.cashierId },
      });
    }
    return tx;
  }

  // TODAY (cashier1)
  const tx1 = await mkTx({
    shiftId: shiftToday.id, cashierId: cashier1.id, orderType: OrderType.dineIn, tableNumber: 1,
    items: [{ menuId: menuA.id, qty: 2, unitPrice: 20000, unitCost: 12000 }, { menuId: menuC.id, qty: 1, unitPrice: 5000, unitCost: null }],
    method: 'cash', createdAt: atUtc(todayBiz, 3), // 10:00 WIB
  }); // subtotal 45000
  await mkTx({
    shiftId: shiftToday.id, cashierId: cashier1.id, orderType: OrderType.takeaway,
    items: [{ menuId: menuA.id, qty: 1, unitPrice: 20000, unitCost: 12000 }],
    method: 'qris', createdAt: atUtc(todayBiz, 5), // 12:00 WIB
  }); // subtotal 20000
  // TX open (belum bayar) → openTransactionCount
  await mkTx({
    shiftId: shiftToday.id, cashierId: cashier1.id, orderType: OrderType.dineIn, tableNumber: 2,
    items: [{ menuId: menuA.id, qty: 1, unitPrice: 20000, unitCost: 12000 }],
    method: 'cash', createdAt: atUtc(todayBiz, 6), status: TransactionStatus.open,
  });
  // TX MERGED ke tx1 (paid tapi mergedIntoId≠null) → HARUS DIKECUALIKAN semua agregasi
  await mkTx({
    shiftId: shiftToday.id, cashierId: cashier1.id, orderType: OrderType.dineIn, tableNumber: 3,
    items: [{ menuId: menuA.id, qty: 10, unitPrice: 20000, unitCost: 12000 }],
    method: 'cash', createdAt: atUtc(todayBiz, 4), mergedIntoId: tx1.id,
  });

  // YESTERDAY (cashier2)
  await mkTx({
    shiftId: shiftYest.id, cashierId: cashier2.id, orderType: OrderType.dineIn, tableNumber: 4,
    items: [{ menuId: menuB.id, qty: 1, unitPrice: 50000, unitCost: 30000 }],
    method: 'edc', bank: 'BCA', createdAt: atUtc(yestBiz, 6), // 13:00 WIB
  }); // subtotal 50000

  // --- settlement yesterday (variance) ---
  const settlement = await prisma.settlement.create({
    data: { shiftId: shiftYest.id, date: yestBiz, cashierId: cashier2.id, status: 'submitted' },
  });
  await prisma.settlementMethodCount.createMany({
    data: [
      { settlementId: settlement.id, paymentMethodCode: 'cash', counted: 100000, system: 90000 }, // +10000
      { settlementId: settlement.id, paymentMethodCode: 'edc', counted: 50000, system: 55000 }, // -5000
    ],
  });

  const range = { period: 'custom' as const, fromDate: isoDate(yestBiz), toDate: isoDate(todayBiz) };

  // ============ [1] Menu Performance ============
  console.log('\n[1] getOwnerMenuPerformance (custom range yest→today):');
  const mp = await getOwnerMenuPerformance(range);
  const a = mp.topMenus.find((m) => m.menuId === menuA.id)!;
  ok(a?.qtySold === 3, `Menu A qty=3 (merged tx10 dikecualikan) → ${a?.qtySold}`);
  ok(a?.revenue === 60000, `Menu A revenue=60000 → ${a?.revenue}`);
  ok(a?.cogs === 36000, `Menu A cogs=36000 → ${a?.cogs}`);
  ok(a?.profit === 24000 && a?.marginPct === 40, `Menu A profit=24000 margin=40% → ${a?.profit}/${a?.marginPct}`);
  const c = mp.topMenus.find((m) => m.menuId === menuC.id)!;
  ok(c?.cogs === 0 && c?.marginPct === 100, `Menu C (cost null) cogs=0 margin=100% → ${c?.cogs}/${c?.marginPct}`);
  ok(mp.topMenus.map((m) => m.menuId).slice(0, 3).join(',') === [menuA.id, menuB.id, menuC.id].join(','), 'topMenus terurut desc revenue (A,B,C)');
  ok(mp.byCategory[0]?.category === 'Ayam' && mp.byCategory[0]?.revenue === 60000, 'byCategory[0]=Ayam 60000');
  ok(mp.byCategory.length === 3, `byCategory 3 kategori → ${mp.byCategory.length}`);

  // ============ [2] Trend ============
  console.log('\n[2] getOwnerTrend:');
  const tr = await getOwnerTrend(range);
  ok(tr.granularity === 'day', `granularity=day (rentang 2 hari) → ${tr.granularity}`);
  const today = tr.revenueTrend.find((b) => b.bucket === isoDate(todayBiz));
  const yest = tr.revenueTrend.find((b) => b.bucket === isoDate(yestBiz));
  ok(today?.revenue === 65000, `bucket today=65000 (45000+20000) → ${today?.revenue}`);
  ok(yest?.revenue === 50000, `bucket yesterday=50000 → ${yest?.revenue}`);
  ok(tr.revenueTrend.length === 2, `2 bucket hari → ${tr.revenueTrend.length}`);
  const h10 = tr.peakHours.find((h) => h.hour === 10);
  ok(h10?.revenue === 45000, `peakHours jam 10 WIB = 45000 (tx1) → ${h10?.revenue}`);
  ok(tr.peakHours.length === 3, `peakHours 3 jam (10,12,13) → ${tr.peakHours.length}`);

  // ============ [3] Staff ============
  console.log('\n[3] getOwnerStaff:');
  const st = await getOwnerStaff(range);
  const c1 = st.cashierPerformance.find((x) => x.cashierId === cashier1.id)!;
  const c2 = st.cashierPerformance.find((x) => x.cashierId === cashier2.id)!;
  ok(c1?.txCount === 2 && c1?.revenue === 65000, `kasir1 tx=2 omzet=65000 → ${c1?.txCount}/${c1?.revenue}`);
  ok(c1?.atv === 32500, `kasir1 ATV=32500 → ${c1?.atv}`);
  ok(c2?.revenue === 50000, `kasir2 omzet=50000 → ${c2?.revenue}`);
  ok(st.cashierPerformance[0]?.cashierId === cashier1.id, 'cashierPerformance terurut desc revenue (kasir1)');
  const sh = st.settlementHistory[0];
  ok(st.settlementHistory.length === 1, `1 settlement → ${st.settlementHistory.length}`);
  ok(sh?.variance === 5000, `variance=5000 (+10000 cash, -5000 edc) → ${sh?.variance}`);
  ok(sh?.totalCounted === 150000 && sh?.totalSystem === 145000, `totalCounted=150000 totalSystem=145000 → ${sh?.totalCounted}/${sh?.totalSystem}`);

  // ============ [4] Cashier dashboard (today) ============
  console.log('\n[4] getCashierDashboard(cashier1) today:');
  const cd = await getCashierDashboard(cashier1.id);
  ok(cd.activeShift?.id === shiftToday.id, `activeShift = shiftToday → ${cd.activeShift?.id}`);
  ok(cd.today.revenue === 65000 && cd.today.transactionCount === 2, `today revenue=65000 tx=2 → ${cd.today.revenue}/${cd.today.transactionCount}`);
  ok(cd.today.openTransactionCount === 1, `openTx=1 → ${cd.today.openTransactionCount}`);
  const tmA = cd.today.topMenus.find((m) => m.menuId === menuA.id);
  ok(tmA?.qty === 3, `today topMenus A qty=3 (merged dikecualikan) → ${tmA?.qty}`);
  ok(cd.today.topMenus[0]?.menuId === menuA.id, 'topMenus[0] = Menu A (terlaris by qty)');
  ok(!('cogs' in (cd.today.topMenus[0] ?? {})) && !('unitCost' in (cd.today.topMenus[0] ?? {})), 'topMenus kasir TANPA cost/laba (owner-only)');
  ok(cd.today.itemCount === 4, `itemCount=4 (2+1+1) → ${cd.today.itemCount}`);
  ok(cd.today.atv === 32500, `ATV=32500 → ${cd.today.atv}`);
  ok(cd.today.orderTypeSplit.dineIn.count === 1 && cd.today.orderTypeSplit.dineIn.revenue === 45000, `dineIn 1×45000 → ${cd.today.orderTypeSplit.dineIn.count}/${cd.today.orderTypeSplit.dineIn.revenue}`);
  ok(cd.today.orderTypeSplit.takeaway.count === 1 && cd.today.orderTypeSplit.takeaway.revenue === 20000, `takeaway 1×20000 → ${cd.today.orderTypeSplit.takeaway.count}/${cd.today.orderTypeSplit.takeaway.revenue}`);

  // --- bersih-bersih test menu ---
  await prisma.transactionPayment.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.settlement.deleteMany({});
  await prisma.shift.deleteMany({});
  await prisma.menu.deleteMany({ where: { name: { startsWith: 'TEST ' } } });

  console.log(`\n[smoke-dashboard] HASIL: ${pass} pass, ${fail} fail`);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}
main().catch(async (e) => {
  console.error('[smoke-dashboard] ERROR', e);
  await prisma.$disconnect();
  process.exit(1);
});
