// Integration smoke untuk shift open/close/reopen/window. WAJIB DB *_test.
// Jalankan: npx tsx --env-file=.env.test scripts/smoke-shift.ts
import 'dotenv/config';
import { UserRole, ShiftType } from '@prisma/client';
import { prisma } from '../src/config/prisma';
import { openShift, closeShift, getActiveShifts } from '../src/modules/shifts/shifts.service';

if (!/_test/.test(process.env.DATABASE_URL ?? '')) {
  throw new Error('REFUSE: smoke harus pakai DB *_test. Set DATABASE_URL ke pos_restaurant_test.');
}

let pass = 0;
let fail = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { pass++; console.log(`  ✓ ${msg}`); }
  else { fail++; console.log(`  ✗ FAIL: ${msg}`); }
}
async function expectErr(fn: () => Promise<unknown>, status: number, label: string) {
  try { await fn(); ok(false, `${label} (harusnya throw ${status}, tapi sukses)`); }
  catch (e) {
    const s = (e as { statusCode?: number }).statusCode;
    ok(s === status, `${label} → ${status} (dapat ${s}: ${(e as Error).message})`);
  }
}
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

async function setWindow(pagiStart: string, changeover: string, malamEnd: string) {
  await prisma.appSetting.update({
    where: { id: 1 },
    data: { timezone: 'Asia/Jakarta', shiftPagiStart: pagiStart, shiftChangeover: changeover, shiftMalamEnd: malamEnd },
  });
}

async function main() {
  console.log(`[smoke-shift] DB=${process.env.DATABASE_URL?.split('/').pop()}`);
  // Clean slate (test DB only): drop tx + shifts so reruns are deterministic.
  await prisma.transaction.deleteMany({});
  await prisma.shift.deleteMany({});

  const jason = await prisma.user.findFirst({ where: { role: UserRole.cashier } });
  if (!jason) throw new Error('Tidak ada user cashier di DB test (seed dulu).');

  console.log('\n[1] Window pagi terbuka (changeover 23:59):');
  await setWindow('00:00', '23:59', '23:59');
  const s1 = await openShift(jason.id, { type: ShiftType.pagi, openingCash: 500000 });
  ok(s1.type === 'pagi', `buka pagi → sukses (#${s1.id})`);
  const active1 = await getActiveShifts();
  ok(active1.length === 1 && active1[0]!.id === s1.id, 'getActiveShifts = 1 (shift pagi)');

  console.log('\n[2] Single-active: buka shift kedua ditolak 409:');
  await expectErr(() => openShift(jason.id, { type: ShiftType.malam, openingCash: 300000 }), 409, 'buka kedua saat 1 open');

  console.log('\n[3] Tutup final (tak ada tx open) → activeMarker null:');
  const closed = await closeShift(s1.id, jason.id, UserRole.cashier, 'final');
  ok(closed.closedAt !== null, 'shift closed (closedAt set)');
  const active2 = await getActiveShifts();
  ok(active2.length === 0, 'getActiveShifts = 0 setelah close');

  console.log('\n[4] Reopen pagi dalam window (D12) → boleh walau pagi sudah pernah dibuka:');
  const s2 = await openShift(jason.id, { type: ShiftType.pagi, openingCash: 500000 });
  ok(s2.type === 'pagi' && s2.id !== s1.id, `reopen pagi → sukses (#${s2.id}, baris baru)`);

  console.log('\n[5] Handover: closeShift mode=handover oleh kasir → sukses (tx open boleh carry):');
  const handed = await closeShift(s2.id, jason.id, UserRole.cashier, 'handover');
  ok(handed.closedAt !== null, 'handover close sukses + marker null');

  console.log('\n[6] Window lewat (changeover 00:01): buka pagi ditolak 400 out_of_window:');
  await setWindow('00:00', '00:01', '23:59');
  await expectErr(() => openShift(jason.id, { type: ShiftType.pagi, openingCash: 500000 }), 400, 'buka pagi setelah window lewat');

  console.log(`\n[smoke-shift] HASIL: ${pass} pass, ${fail} fail`);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error('[smoke-shift] ERROR', e);
  await prisma.$disconnect();
  process.exit(1);
});
