// READ-ONLY diagnostic: daftar open order yang memblokir tutup shift + status settle.
// Jalankan: npx tsx --env-file=.env scripts/diag-open-orders.ts
import { prisma } from '../src/config/prisma';

async function main() {
  const open = await prisma.transaction.findMany({
    where: { status: 'open', mergedIntoId: null },
    select: {
      id: true, tableNumber: true, orderType: true, createdAt: true, subtotal: true, shiftId: true,
      shift: { select: { id: true, type: true, date: true, closedAt: true, cashier: { select: { name: true } } } },
      _count: { select: { items: true } },
    },
    orderBy: { id: 'asc' },
  });
  const active = await prisma.shift.findMany({
    where: { activeMarker: 1 },
    select: { id: true, type: true, date: true, cashier: { select: { name: true } } },
  });

  console.log('=== ACTIVE SHIFT(S) ===');
  for (const s of active) {
    console.log(`shift#${s.id} ${s.type} date=${s.date.toISOString().slice(0, 10)} by ${s.cashier.name}`);
  }

  console.log(`\n=== BLOCKING OPEN ORDERS (${open.length}) ===`);
  for (const t of open) {
    const settled = await prisma.settlement.findFirst({ where: { date: t.shift.date }, select: { id: true } });
    console.log(
      `Tx#${t.id} ${t.orderType} ${t.tableNumber != null ? 'meja' + t.tableNumber : 'takeaway'} ` +
      `items=${t._count.items} Rp${t.subtotal} ` +
      `| shift#${t.shift.id}(${t.shift.type},date=${t.shift.date.toISOString().slice(0, 10)},` +
      `closed=${t.shift.closedAt ? 'Y' : 'N'},by ${t.shift.cashier.name}) ` +
      `| dateSETTLED=${settled ? 'YES#' + settled.id : 'no'} ` +
      `| createdAt=${t.createdAt.toISOString().slice(0, 16)}`,
    );
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e.message); process.exit(2); });
