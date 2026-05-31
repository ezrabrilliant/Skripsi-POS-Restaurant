# Merge Aman (Atomik) + Clean-Slate Shift Lintas-Hari — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hilangkan bug "stuck merge" (meja 7: 40rb→90rb) secara struktural + paksa setiap business day mulai dari nol (shift kemarin wajib ditutup & disetor).

**Architecture:** Tiga fix backend-first (TDD) lalu frontend. **Fix A** menjadikan merge+bayar satu `$transaction` (gagal bayar → merge rollback). **Fix B** mendeteksi shift lintas-hari (`isShiftStale`) lalu memblokir order baru sampai shift kemarin ditutup, tanpa mengganggu pembayaran pembersihan. **Fix C** membuat void parent melepas anak yang ter-merge.

**Tech Stack:** Express 4 + TypeScript + Prisma (MySQL), Zod, Vitest (unit) + smoke scripts (`scripts/smoke-*.ts`, DB `pos_restaurant_test`); React 18 + Vite + React Query + Zustand.

**Spec:** [docs/superpowers/specs/2026-05-31-safe-merge-clean-slate-shift-design.md](../specs/2026-05-31-safe-merge-clean-slate-shift-design.md)

**Branch:** `feat/owner-self-service-rev212` (lanjutkan; tidak perlu worktree baru kecuali eksekutor memilih isolasi).

---

## File Structure

**Backend (modify):**
- `src/modules/shifts/shift-time.ts` — tambah helper murni `isShiftStale` (depends: `restoNow`, `businessDateFor` yang sudah ada).
- `src/modules/shifts/shift-time.test.ts` — unit test `isShiftStale`.
- `src/modules/shifts/shifts.service.ts` — `ShiftView.isOverdue`, enrich `getActiveShifts`/`getShiftById`/`listShifts`, longgarkan otoritas `closeShift` untuk shift basi.
- `src/modules/transactions/transactions.schema.ts` — `mergeSourceIds` di `addPaymentSchema`.
- `src/modules/transactions/transactions.service.ts` — `addPayment` (merge atomik di dalam `$transaction`), `createTransaction`+`addItems` (blok shift basi), `voidTransaction` (lepas anak).

**Backend (create — smoke tests):**
- `scripts/smoke-merge-atomic.ts` — Fix A rollback + sukses.
- `scripts/smoke-shift-stale.ts` — Fix B blok create + izinkan pay + otoritas tutup.
- `scripts/smoke-void-unmerge.ts` — Fix C lepas anak.

**Frontend (modify):**
- `src/types/index.ts` — `Shift.isOverdue?`.
- `src/services/shiftService.ts` — map `isOverdue`.
- `src/services/transactionService.ts` — `AddPaymentPayload.mergeSourceIds?`.
- `src/components/PaymentModal.tsx` — kirim `mergeSourceIds`, hapus `mergeMutation` terpisah.
- `src/pages/POSPage.tsx` — mount gate baru.
- `src/pages/CashierDashboard.tsx` — mount gate baru.

**Frontend (create):**
- `src/components/OverdueShiftGate.tsx` — layar blokir "shift kemarin belum ditutup".

---

## PHASE 1 — Fix B core: helper `isShiftStale` (pure, TDD)

### Task 1: Helper `isShiftStale`

**Files:**
- Modify: `backend/src/modules/shifts/shift-time.ts`
- Test: `backend/src/modules/shifts/shift-time.test.ts`

- [ ] **Step 1: Tulis test gagal** — tambahkan di akhir `shift-time.test.ts`:

```ts
import { isShiftStale } from './shift-time';

describe('isShiftStale', () => {
  // window resto realistis: 10:00 buka, 15:00 changeover, 22:00 tutup (tidak cross-midnight)
  const s = { timezone: 'Asia/Jakarta', pagiStart: 600, changeover: 900, malamEnd: 1320 };
  const d = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`); // UTC-midnight, sama bentuk dengan Shift.date

  it('shift kemarin, sekarang besok PAGI (>= jam buka) → basi (true)', () => {
    // shift.date = 2026-05-29; now = 2026-05-31 03:00Z = 10:00 WIB (>= pagiStart 600)
    expect(isShiftStale(d('2026-05-29'), s, new Date('2026-05-31T03:00:00Z'))).toBe(true);
  });

  it('shift kemarin, sekarang masih OVERTIME tengah malam (< jam buka) → belum basi (false)', () => {
    // now = 2026-05-30T18:30:00Z = 2026-05-31 01:30 WIB (minutesOfDay 90 < pagiStart 600)
    expect(isShiftStale(d('2026-05-30'), s, new Date('2026-05-30T18:30:00Z'))).toBe(false);
  });

  it('shift hari ini, sekarang siang hari yang sama → tidak basi (false)', () => {
    // now = 2026-05-31T05:00:00Z = 12:00 WIB, business day sama dengan shift.date
    expect(isShiftStale(d('2026-05-31'), s, new Date('2026-05-31T05:00:00Z'))).toBe(false);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

Run: `cd backend && npx vitest run src/modules/shifts/shift-time.test.ts`
Expected: FAIL — `isShiftStale is not a function` / import error.

- [ ] **Step 3: Implementasi** — tambahkan di akhir `shift-time.ts` (di bawah `businessDateFor`):

```ts
/// REV 2.12: shift "basi/overdue" = sudah masuk business day baru DAN sesi hari baru
/// sudah dimulai (>= jam buka pagi). Overtime tengah malam (sebelum pagiStart) TIDAK
/// dianggap basi supaya kasir bisa menuntaskan tagihan tadi malam tanpa diganggu.
/// shiftDate & hasil businessDateFor sama-sama UTC-midnight Date → banding via getTime().
export function isShiftStale(
  shiftDate: Date,
  s: ShiftWindowSettings,
  now: Date = new Date(),
): boolean {
  const bizToday = businessDateFor(s, now);
  const { minutesOfDay } = restoNow(s.timezone, now);
  return bizToday.getTime() > shiftDate.getTime() && minutesOfDay >= s.pagiStart;
}
```

- [ ] **Step 4: Jalankan, pastikan LULUS**

Run: `cd backend && npx vitest run src/modules/shifts/shift-time.test.ts`
Expected: PASS (semua test termasuk yang lama).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/shifts/shift-time.ts backend/src/modules/shifts/shift-time.test.ts
git commit -m "feat(shift): helper isShiftStale (deteksi shift lintas-hari) + unit test"
```

---

## PHASE 2 — Fix B backend: view flag, enforcement, otoritas

### Task 2: `ShiftView.isOverdue` + enrich getters

**Files:**
- Modify: `backend/src/modules/shifts/shifts.service.ts`

- [ ] **Step 1: Tambah field ke interface `ShiftView`** (setelah `closedAt: string | null;`):

```ts
  closedAt: string | null;
  createdAt: string;
  /// REV 2.12: true kalau shift masih open tapi sudah lewat business day-nya
  /// (lihat isShiftStale). Frontend memakai ini untuk gate "tutup shift kemarin".
  isOverdue: boolean;
```

- [ ] **Step 2: Import helper + ubah `toShiftView` jadi window-aware** — tambah import (gabung dengan import shift-time yang ada di baris 18):

```ts
import { restoNow, businessDateFor, isShiftStale } from './shift-time';
import type { ShiftWindowSettings } from './shift-time';
```

Ubah signature + body `toShiftView`:

```ts
function toShiftView(shift: ShiftWithCashier, window?: ShiftWindowSettings): ShiftView {
  return {
    id: shift.id,
    date: shift.date.toISOString().substring(0, 10),
    type: shift.type,
    cashierId: shift.cashierId,
    cashierName: shift.cashier.name,
    openingCash: shift.openingCash.toNumber(),
    closedAt: shift.closedAt ? shift.closedAt.toISOString() : null,
    createdAt: shift.createdAt.toISOString(),
    // isOverdue hanya relevan untuk shift open + butuh window. Tanpa window → false.
    isOverdue: !shift.closedAt && window ? isShiftStale(shift.date, window) : false,
  };
}
```

> Catatan: `restoNow`/`businessDateFor` sudah diimpor sebelumnya — pastikan tidak ada duplikasi import. Kalau import lama hanya `{ restoNow, businessDateFor }`, ganti jadi baris di Step 2.

- [ ] **Step 3: Enrich `getActiveShifts`** (sekitar baris 182) supaya hitung window sekali:

```ts
export async function getActiveShifts(): Promise<ShiftView[]> {
  const shifts = await prisma.shift.findMany({
    where: { activeMarker: 1 },
    orderBy: { createdAt: 'desc' },
    include: { cashier: true },
  });
  if (shifts.length === 0) return [];
  const window = await getShiftWindow();
  return shifts.map((s) => toShiftView(s, window));
}
```

- [ ] **Step 4: Verifikasi tsc**

Run: `cd backend && npx tsc --noEmit`
Expected: 0 error. (getShiftById/listShifts tetap pakai `toShiftView(shift)` tanpa window → isOverdue=false; itu OK, hanya getActiveShifts yang butuh flag ini.)

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/shifts/shifts.service.ts
git commit -m "feat(shift): ShiftView.isOverdue + getActiveShifts window-aware"
```

---

### Task 3: Blok order baru saat shift basi (createTransaction + addItems)

**Files:**
- Modify: `backend/src/modules/transactions/transactions.service.ts`
- Test: `backend/scripts/smoke-shift-stale.ts` (create di Task ini, dipakai lagi di Task 4)

- [ ] **Step 1: Tulis smoke test gagal** — buat `backend/scripts/smoke-shift-stale.ts`:

```ts
// Integration smoke Fix B clean-slate. WAJIB DB *_test.
// Jalankan: npx tsx --env-file=.env.test scripts/smoke-shift-stale.ts
import 'dotenv/config';
import { UserRole, ShiftType } from '@prisma/client';
import { prisma } from '../src/config/prisma';
import { openShift, closeShift } from '../src/modules/shifts/shifts.service';
import { createTransaction, addPayment } from '../src/modules/transactions/transactions.service';

if (!/_test/.test(process.env.DATABASE_URL ?? '')) throw new Error('REFUSE: smoke harus pakai DB *_test.');

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ FAIL: ${m}`)); };
async function expectErr(fn: () => Promise<unknown>, status: number, label: string) {
  try { await fn(); ok(false, `${label} (harusnya ${status})`); }
  catch (e) { ok((e as { statusCode?: number }).statusCode === status, `${label} → ${status} (${(e as Error).message})`); }
}

async function main() {
  console.log(`[smoke-shift-stale] DB=${process.env.DATABASE_URL?.split('/').pop()}`);
  await prisma.transactionPayment.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.shift.deleteMany({});
  // Window: pagiStart 00:00 supaya "minutesOfDay >= pagiStart" selalu true → staleness diuji murni via tanggal.
  await prisma.appSetting.update({ where: { id: 1 }, data: { taxEnabled: false, timezone: 'Asia/Jakarta', shiftPagiStart: '00:00', shiftChangeover: '23:58', shiftMalamEnd: '23:59' } });

  const cashier = await prisma.user.findFirst({ where: { role: UserRole.cashier } });
  const cashier2 = await prisma.user.findFirst({ where: { role: UserRole.cashier, id: { not: cashier!.id } } });
  const menu = await prisma.menu.findFirst({ where: { isActive: true, stockType: 'portion' } });
  if (!cashier || !menu) throw new Error('seed kurang');

  console.log('\n[1] Order ke shift basi ditolak 409, pembayaran tetap boleh:');
  const shift = await openShift(cashier.id, { type: ShiftType.pagi, openingCash: 500000 });
  // Buat order SEBELUM shift dibuat basi (saat masih hari ini).
  const tx = await createTransaction(cashier.id, { orderType: 'dineIn', tableNumber: 1, items: [{ menuId: menu.id, qty: 1 }] } as Parameters<typeof createTransaction>[1]);
  // Paksa shift jadi "kemarin" → basi.
  const yesterday = new Date(); yesterday.setUTCDate(yesterday.getUTCDate() - 2);
  yesterday.setUTCHours(0, 0, 0, 0);
  await prisma.shift.update({ where: { id: shift.id }, data: { date: yesterday } });

  await expectErr(() => createTransaction(cashier.id, { orderType: 'dineIn', tableNumber: 2, items: [{ menuId: menu.id, qty: 1 }] } as Parameters<typeof createTransaction>[1]), 409, 'createTransaction ke shift basi ditolak');
  const paid = await addPayment(tx.id, cashier.id, { method: 'cash', amount: tx.subtotal } as Parameters<typeof addPayment>[2]);
  ok(paid.status === 'paid', 'addPayment order sisa tetap sukses walau shift basi');

  console.log('\n[2] Tutup-final shift basi oleh kasir LAIN diizinkan (meja sudah kosong):');
  if (cashier2) {
    const closed = await closeShift(shift.id, cashier2.id, UserRole.cashier, 'final');
    ok(closed.closedAt !== null, `kasir lain (#${cashier2.id}) boleh tutup shift basi #${shift.id}`);
  } else {
    console.log('  (skip — hanya 1 cashier di seed)');
  }

  console.log(`\n[smoke-shift-stale] HASIL: ${pass} pass, ${fail} fail`);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}
main().catch(async (e) => { console.error('[smoke-shift-stale] ERROR', e); await prisma.$disconnect(); process.exit(1); });
```

- [ ] **Step 2: Jalankan, pastikan GAGAL** (block belum ada + otoritas belum dilonggarkan)

Run: `cd backend && npx tsx --env-file=.env.test scripts/smoke-shift-stale.ts`
Expected: FAIL pada `[1]` (createTransaction ke shift basi TIDAK ditolak) — `pass < total`, exit 1.

- [ ] **Step 3: Tambah import di `transactions.service.ts`** (dekat import lain, sekitar baris 40-43):

```ts
import { getShiftWindow } from '../settings/settings.service';
import { isShiftStale } from '../shifts/shift-time';
```

- [ ] **Step 4: Blok di `createTransaction`** — setelah `const shift = await resolveActiveShift('order baru');` (baris 641), sisipkan:

```ts
  // REV 2.12 clean-slate: tolak order baru kalau shift aktif sudah lewat business day-nya.
  // Pembayaran/void TIDAK kena cek ini (perlu untuk membersihkan order sisa kemarin).
  const window = await getShiftWindow();
  if (isShiftStale(shift.date, window)) {
    throw new AppError(
      `Shift ${shift.date.toISOString().substring(0, 10)} belum ditutup — tuntaskan & tutup shift kemarin dulu sebelum input order baru.`,
      409,
    );
  }
```

- [ ] **Step 5: Blok di `addItems`** — setelah cek status open (baris 691-693), sisipkan:

```ts
  const shiftOfTx = await prisma.shift.findUnique({ where: { id: existing.shiftId } });
  const window = await getShiftWindow();
  if (shiftOfTx && isShiftStale(shiftOfTx.date, window)) {
    throw new AppError(
      `Shift ${shiftOfTx.date.toISOString().substring(0, 10)} belum ditutup — tidak bisa menambah item ke order hari kemarin.`,
      409,
    );
  }
```

- [ ] **Step 6: Jalankan smoke `[1]`, pastikan bagian create LULUS** (bagian `[2]` masih bisa gagal sampai Task 4)

Run: `cd backend && npx tsx --env-file=.env.test scripts/smoke-shift-stale.ts`
Expected: baris `[1]` semua ✓ (create ditolak 409 + pay sukses). Baris `[2]` mungkin masih ✗ (otoritas) — itu Task 4.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/transactions/transactions.service.ts backend/scripts/smoke-shift-stale.ts
git commit -m "feat(tx): blok order baru/addItems ke shift basi (clean-slate gate, Fix B)"
```

---

### Task 4: Longgarkan otoritas tutup shift basi (`closeShift`)

**Files:**
- Modify: `backend/src/modules/shifts/shifts.service.ts`

- [ ] **Step 1: Pastikan smoke `[2]` masih GAGAL** (kalau seed punya 2 cashier)

Run: `cd backend && npx tsx --env-file=.env.test scripts/smoke-shift-stale.ts`
Expected: `[2]` ✗ — kasir lain ditolak (`forbidden`).

- [ ] **Step 2: Ubah `closeShift`** — ganti blok otoritas (baris 136-138) supaya melewati batasan kalau shift basi:

```ts
  // final close requires owner or the shift's own cashier — KECUALI shift sudah basi
  // (lewat business day). Untuk shift basi, kasir mana pun yang masuk pagi boleh
  // menutup supaya hari baru bisa dimulai tanpa menunggu pemilik shift (REV 2.12).
  if (mode === 'final' && byRole !== UserRole.owner && shift.cashierId !== byUserId) {
    const window = await getShiftWindow();
    if (!isShiftStale(shift.date, window)) {
      throw forbidden('Hanya kasir pemilik shift yang boleh menutup');
    }
  }
```

> `getShiftWindow` sudah diimpor di shifts.service (baris 19). `isShiftStale` ditambahkan ke import shift-time di Task 2 Step 2.

- [ ] **Step 3: Jalankan smoke, pastikan SEMUA LULUS**

Run: `cd backend && npx tsx --env-file=.env.test scripts/smoke-shift-stale.ts`
Expected: `HASIL: N pass, 0 fail`, exit 0.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/shifts/shifts.service.ts
git commit -m "feat(shift): kasir mana pun boleh tutup-final shift basi (Fix B, D4)"
```

---

## PHASE 3 — Fix A: merge + bayar atomik

### Task 5: Schema `mergeSourceIds`

**Files:**
- Modify: `backend/src/modules/transactions/transactions.schema.ts`

- [ ] **Step 1: Tambah field ke `addPaymentSchema`** (setelah `discountAmount` di baris 87):

```ts
  discountAmount: z.number().nonnegative().optional(),
  /// REV 2.12: id transaksi intra-meja yang digabung ke parent ini SAAT bayar (atomik).
  /// Hanya valid di pembayaran pertama. Merge dilakukan di dalam $transaction addPayment
  /// supaya gagal bayar = merge ikut rollback (tidak ada stuck merge).
  mergeSourceIds: z.array(z.number().int().positive()).optional(),
```

- [ ] **Step 2: Verifikasi tsc** (tipe `AddPaymentInput` ikut terupdate otomatis via `z.infer`)

Run: `cd backend && npx tsc --noEmit`
Expected: 0 error.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/transactions/transactions.schema.ts
git commit -m "feat(tx): addPaymentSchema terima mergeSourceIds (Fix A)"
```

---

### Task 6: `addPayment` — merge di dalam `$transaction`

**Files:**
- Modify: `backend/src/modules/transactions/transactions.service.ts`
- Test: `backend/scripts/smoke-merge-atomic.ts`

- [ ] **Step 1: Tulis smoke test gagal** — buat `backend/scripts/smoke-merge-atomic.ts`:

```ts
// Integration smoke Fix A: merge+bayar atomik. WAJIB DB *_test.
// Jalankan: npx tsx --env-file=.env.test scripts/smoke-merge-atomic.ts
import 'dotenv/config';
import { UserRole, ShiftType } from '@prisma/client';
import { prisma } from '../src/config/prisma';
import { openShift } from '../src/modules/shifts/shifts.service';
import { createTransaction, addPayment } from '../src/modules/transactions/transactions.service';

if (!/_test/.test(process.env.DATABASE_URL ?? '')) throw new Error('REFUSE: smoke harus pakai DB *_test.');

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ FAIL: ${m}`)); };

async function main() {
  console.log(`[smoke-merge-atomic] DB=${process.env.DATABASE_URL?.split('/').pop()}`);
  await prisma.transactionPayment.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.shift.deleteMany({});
  await prisma.appSetting.update({ where: { id: 1 }, data: { taxEnabled: false, timezone: 'Asia/Jakarta', shiftPagiStart: '00:00', shiftChangeover: '23:58', shiftMalamEnd: '23:59' } });

  const cashier = await prisma.user.findFirst({ where: { role: UserRole.cashier } });
  const menu = await prisma.menu.findFirst({ where: { isActive: true, stockType: 'portion' } });
  if (!cashier || !menu) throw new Error('seed kurang');
  await openShift(cashier.id, { type: ShiftType.pagi, openingCash: 500000 });

  const mk = () => createTransaction(cashier.id, { orderType: 'dineIn', tableNumber: 3, items: [{ menuId: menu.id, qty: 1 }] } as Parameters<typeof createTransaction>[1]);

  console.log('\n[1] Bayar GAGAL setelah merge → merge ikut ROLLBACK:');
  const A = await mk(); const B = await mk();
  try {
    // nominal > total agregat → pasti gagal di dalam $transaction (SETELAH langkah merge).
    await addPayment(A.id, cashier.id, { method: 'cash', amount: A.subtotal + B.subtotal + 99999, mergeSourceIds: [B.id] } as Parameters<typeof addPayment>[2]);
    ok(false, 'harusnya gagal karena overpay');
  } catch { ok(true, 'addPayment overpay dilempar error'); }
  const Bafter = await prisma.transaction.findUnique({ where: { id: B.id } });
  ok(Bafter?.mergedIntoId === null, `B.mergedIntoId tetap null (merge ter-rollback), got=${Bafter?.mergedIntoId}`);
  ok(Bafter?.status === 'open', 'B masih open');

  console.log('\n[2] Bayar SUKSES dengan merge → A & B lunas, B menunjuk A:');
  const A2 = await mk(); const B2 = await mk();
  const total = A2.subtotal + B2.subtotal;
  const done = await addPayment(A2.id, cashier.id, { method: 'cash', amount: total, mergeSourceIds: [B2.id] } as Parameters<typeof addPayment>[2]);
  ok(done.status === 'paid', `A2 lunas (total ${done.total})`);
  const B2after = await prisma.transaction.findUnique({ where: { id: B2.id } });
  ok(B2after?.mergedIntoId === A2.id, `B2 ter-merge ke A2 (#${A2.id})`);
  ok(B2after?.status === 'paid', 'B2 ikut lunas via cascade');

  console.log('\n[3] Source bukan-open ditolak (rollback):');
  const A3 = await mk();
  try {
    await addPayment(A3.id, cashier.id, { method: 'cash', amount: A3.subtotal, mergeSourceIds: [B2.id] } as Parameters<typeof addPayment>[2]); // B2 sudah paid
    ok(false, 'harusnya gagal (source sudah paid/merged)');
  } catch { ok(true, 'merge source non-open ditolak'); }
  const A3after = await prisma.transaction.findUnique({ where: { id: A3.id } });
  ok(A3after?.status === 'open', 'A3 tetap open (tidak ada slice tertinggal)');

  console.log(`\n[smoke-merge-atomic] HASIL: ${pass} pass, ${fail} fail`);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}
main().catch(async (e) => { console.error('[smoke-merge-atomic] ERROR', e); await prisma.$disconnect(); process.exit(1); });
```

- [ ] **Step 2: Jalankan, pastikan GAGAL** (mergeSourceIds belum diproses → B tidak ter-merge di `[2]`)

Run: `cd backend && npx tsx --env-file=.env.test scripts/smoke-merge-atomic.ts`
Expected: FAIL — `[2]` B2 tidak ter-merge ke A2, exit 1.

- [ ] **Step 3: Restrukturisasi `addPayment`** — ganti blok dari **setelah** validasi `discountInput` (baris 809-816) sampai **akhir** `$transaction` (baris 924) dengan versi berikut. Logika merge + agregat + effective pindah KE DALAM `$transaction`:

```ts
  const isFirstSlice = existing.payments.length === 0;
  const discountInput = input.discountAmount ?? 0;
  if (!isFirstSlice && discountInput > 0) {
    throw new AppError('Diskon hanya bisa di-set saat pembayaran pertama (sebelum ada slice)', 400);
  }
  // REV 2.12 Fix A: gabung pesanan hanya boleh di pembayaran pertama (sebelum agregat terkunci).
  const mergeSourceIds = input.mergeSourceIds ?? [];
  if (mergeSourceIds.length > 0 && !isFirstSlice) {
    throw new AppError('Gabung pesanan hanya bisa saat pembayaran pertama', 400);
  }

  // PB1 setting dibaca sekali (stabil selama pembayaran).
  const setting = await prisma.appSetting.findUnique({ where: { id: 1 } });

  // Atomic finalize: SEMUA di dalam satu $transaction supaya merge + payment all-or-nothing.
  await prisma.$transaction(async (tx) => {
    // Lock parent row to serialize concurrent payments on this Tx.
    await tx.$queryRaw`SELECT id FROM transactions WHERE id = ${transactionId} FOR UPDATE`;

    // (Fix A) Merge candidate sources ke parent ini, atomik dengan payment.
    // Gagal di langkah mana pun setelah ini → seluruh merge ikut rollback.
    if (mergeSourceIds.length > 0) {
      const sources = await tx.transaction.findMany({ where: { id: { in: mergeSourceIds } } });
      if (sources.length !== mergeSourceIds.length) {
        throw new AppError('Sebagian pesanan yang digabung tidak ditemukan', 400);
      }
      for (const s of sources) {
        if (s.id === transactionId) throw new AppError('Tidak bisa menggabung transaksi ke dirinya sendiri', 400);
        if (s.status !== TransactionStatus.open) throw new AppError(`Pesanan #${s.id} tidak open, tidak bisa digabung`, 400);
        if (s.mergedIntoId !== null) throw new AppError(`Pesanan #${s.id} sudah digabung ke #${s.mergedIntoId}`, 400);
      }
      await tx.transaction.updateMany({ where: { id: { in: mergeSourceIds } }, data: { mergedIntoId: transactionId } });
    }

    // Aggregate subtotal (parent + SEMUA merged sources, termasuk yang baru di-merge).
    const mergedFrom = await tx.transaction.findMany({ where: { mergedIntoId: transactionId }, select: { subtotal: true } });
    const aggregateSubtotal = mergedFrom.reduce((sum, m) => sum.add(m.subtotal), existing.subtotal);
    if (aggregateSubtotal.isZero()) throw new AppError('Transaksi tidak punya item, tidak bisa dibayar', 400);

    // Effective discount/tax/total.
    let effectiveDiscount: Prisma.Decimal;
    let effectiveTax: Prisma.Decimal;
    let effectiveTaxBorne: Prisma.Decimal;
    let effectiveTotal: Prisma.Decimal;
    if (isFirstSlice) {
      effectiveDiscount = new Prisma.Decimal(discountInput);
      if (effectiveDiscount.greaterThan(aggregateSubtotal)) {
        throw new AppError('Diskon tidak boleh lebih besar dari subtotal agregat', 400);
      }
      const baseAfterDiscount = aggregateSubtotal.sub(effectiveDiscount);
      const pb1 = computePb1(baseAfterDiscount, {
        taxEnabled: setting?.taxEnabled ?? false,
        taxRate: setting?.taxRate ?? 0,
        taxChargedToCustomer: setting?.taxChargedToCustomer ?? false,
      });
      effectiveTax = pb1.taxAmount;
      effectiveTaxBorne = pb1.taxBorneAmount;
      effectiveTotal = pb1.total;
    } else {
      effectiveDiscount = existing.discountAmount;
      effectiveTax = existing.taxAmount;
      effectiveTaxBorne = existing.taxBorneAmount;
      effectiveTotal = existing.total;
    }

    // Re-read committed payments INSIDE the lock (authoritative).
    const slices = await tx.transactionPayment.findMany({ where: { transactionId } });
    const sumExisting = slices.reduce((acc, p) => acc.add(p.amount), new Prisma.Decimal(0));

    if (isFirstSlice) {
      await tx.transaction.update({
        where: { id: transactionId },
        data: { discountAmount: effectiveDiscount, taxAmount: effectiveTax, taxBorneAmount: effectiveTaxBorne, total: effectiveTotal },
      });
    }

    const remaining = effectiveTotal.sub(sumExisting);
    const amt = new Prisma.Decimal(input.amount);
    if (amt.lessThanOrEqualTo(0)) throw new AppError('Nominal pembayaran harus lebih dari 0', 400);
    if (amt.greaterThan(remaining)) {
      throw new AppError(`Nominal melebihi sisa tagihan. Sisa: Rp ${remaining.toFixed(0)}, dimasukkan: Rp ${amt.toFixed(0)}`, 400);
    }

    const newSum = sumExisting.add(amt);
    const willFinalize = newSum.greaterThanOrEqualTo(effectiveTotal);
    // Re-stamp attribution ke shift aktif saat PEMBAYARAN. resolveActiveShift TIDAK
    // mengecek staleness → order sisa kemarin tetap bisa dilunasi & atribusi ke shift kemarin.
    const finalizeShift = willFinalize ? await resolveActiveShift('pembayaran') : null;

    await tx.transactionPayment.create({
      data: { transactionId, method: input.method, bank: input.bank ?? null, amount: amt, recordedById: userId },
    });

    if (finalizeShift) {
      const paidAt = new Date();
      const flipped = await tx.transaction.updateMany({
        where: { id: transactionId, status: TransactionStatus.open },
        data: { status: TransactionStatus.paid, paidAt, shiftId: finalizeShift.id },
      });
      if (flipped.count === 1) {
        await tx.transaction.updateMany({
          where: { mergedIntoId: transactionId, status: TransactionStatus.open },
          data: { status: TransactionStatus.paid, discountAmount: new Prisma.Decimal(0), taxAmount: new Prisma.Decimal(0), total: new Prisma.Decimal(0), paidAt },
        });
      }
    }
  });

  return getTransactionById(transactionId);
```

> **Penting:** hapus blok lama "Aggregate subtotal" (baris 818-826), "Resolve effective discount/tax/total" (baris 831-862), dan `$transaction` lama (baris 869-924) — semuanya digantikan oleh versi di atas. Sisakan validasi sebelum baris 809 (lookup payment_methods, bank rules) apa adanya.

- [ ] **Step 4: Jalankan smoke, pastikan LULUS**

Run: `cd backend && npx tsx --env-file=.env.test scripts/smoke-merge-atomic.ts`
Expected: `HASIL: 7 pass, 0 fail`, exit 0.

- [ ] **Step 5: Regресi — smoke-tx lama tetap hijau**

Run: `cd backend && npx tsx --env-file=.env.test scripts/smoke-tx.ts`
Expected: tetap PASS (re-stamp, overpay, split tender tidak berubah).

- [ ] **Step 6: Verifikasi tsc**

Run: `cd backend && npx tsc --noEmit`
Expected: 0 error.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/transactions/transactions.service.ts backend/scripts/smoke-merge-atomic.ts
git commit -m "feat(tx): merge intra-meja atomik di dalam addPayment $transaction (Fix A, tutup G1)"
```

---

## PHASE 4 — Fix C: void parent melepas anak

### Task 7: `voidTransaction` lepas anak yang ter-merge

**Files:**
- Modify: `backend/src/modules/transactions/transactions.service.ts`
- Test: `backend/scripts/smoke-void-unmerge.ts`

- [ ] **Step 1: Tulis smoke test gagal** — buat `backend/scripts/smoke-void-unmerge.ts`:

```ts
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
```

> `mergeBills` & `listTransactionsByTable` sudah di-export dari transactions.service.

- [ ] **Step 2: Jalankan, pastikan GAGAL** (anak belum dilepas saat void)

Run: `cd backend && npx tsx --env-file=.env.test scripts/smoke-void-unmerge.ts`
Expected: FAIL — B/C `mergedIntoId` masih = A.id, exit 1.

- [ ] **Step 3: Implementasi** — di `voidTransaction`, di dalam `$transaction` (sekitar baris 989-1023), sebelum `await tx.transaction.update({...status:void})`, sisipkan pelepasan anak:

```ts
    // REV 2.12 Fix C: lepas anak yang ter-merge ke transaksi ini supaya tidak jadi
    // order tersembunyi yang menunjuk parent void. Anak kembali jadi order standalone.
    await tx.transaction.updateMany({
      where: { mergedIntoId: transactionId, status: TransactionStatus.open },
      data: { mergedIntoId: null },
    });
    await tx.transaction.update({
      where: { id: transactionId },
      data: { status: TransactionStatus.void, voidedAt: new Date() },
    });
```

- [ ] **Step 4: Jalankan smoke, pastikan LULUS**

Run: `cd backend && npx tsx --env-file=.env.test scripts/smoke-void-unmerge.ts`
Expected: `HASIL: 4 pass, 0 fail`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/transactions/transactions.service.ts backend/scripts/smoke-void-unmerge.ts
git commit -m "feat(tx): void parent melepas anak ter-merge jadi order terpisah (Fix C, tutup G4)"
```

---

## PHASE 5 — Frontend

### Task 8: Tipe + service `isOverdue` + `mergeSourceIds`

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/services/shiftService.ts`
- Modify: `frontend/src/services/transactionService.ts`

- [ ] **Step 1: `Shift` type** — di `frontend/src/types/index.ts`, cari interface/type `Shift` dan tambah field:

```ts
  /** REV 2.12: true kalau shift masih open tapi sudah lewat business day-nya. */
  isOverdue?: boolean;
```

- [ ] **Step 2: shiftService map** — di `frontend/src/services/shiftService.ts`, pastikan response shift membawa `isOverdue` (kalau mapping manual, tambahkan `isOverdue: raw.isOverdue`; kalau passthrough JSON langsung, tidak perlu ubah selain tipe). Verifikasi field tidak di-strip.

- [ ] **Step 3: `AddPaymentPayload`** — di `frontend/src/services/transactionService.ts`, cari `AddPaymentPayload` dan tambah:

```ts
  /** REV 2.12: id pesanan intra-meja yang digabung saat bayar (atomik di backend). */
  mergeSourceIds?: number[]
```

- [ ] **Step 4: Verifikasi tsc**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 error.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/services/shiftService.ts frontend/src/services/transactionService.ts
git commit -m "feat(fe): tipe Shift.isOverdue + AddPaymentPayload.mergeSourceIds"
```

---

### Task 9: PaymentModal kirim `mergeSourceIds` (hapus merge terpisah)

**Files:**
- Modify: `frontend/src/components/PaymentModal.tsx`

- [ ] **Step 1: `handleSingleSubmit`** — ganti blok merge+pay (baris 388-408) jadi satu addPayment ber-mergeSourceIds:

```ts
    if (!ok) return
    // REV 2.12 Fix A: merge candidate dikirim bersama payment (atomik di backend).
    // Tidak ada lagi mergeMutation terpisah → tidak ada stuck merge kalau bayar gagal.
    addPayMutation.mutate({
      method: selectedMethod.code,
      bank: finalBank,
      amount: total,
      discountAmount,
      mergeSourceIds: selectedCandidateTxs.map((t) => t.id),
    })
  }
```

- [ ] **Step 2: `handleAddSlice`** — ganti blok merge (baris 455-474) jadi:

```ts
    if (!ok) return
    // REV 2.12 Fix A: first slice kirim mergeSourceIds (atomik). Slice ke-2+ tidak.
    addPayMutation.mutate({
      method: selectedMethod.code,
      bank: finalBank,
      amount,
      discountAmount: isFirstSlice ? discountAmount : undefined,
      mergeSourceIds: isFirstSlice ? selectedCandidateTxs.map((t) => t.id) : undefined,
    })
  }
```

- [ ] **Step 3: Hapus `mergeMutation`** — hapus definisi `mergeMutation` (baris 320-329) yang tidak lagi dipakai. Update `submitting` (baris 509):

```ts
  const submitting = addPayMutation.isPending
```

> `unmergeMutation` TETAP (dipakai MergedSourcesPanel untuk lepas source yang sudah ter-merge dari flow lama / Combine). Jangan dihapus.

- [ ] **Step 4: Invalidate open-today setelah bayar** — di `addPayMutation.onSuccess` (sekitar baris 290-297), pastikan ada invalidate `['transactions','open-today']` (sudah ada di baris 293) supaya source yang baru di-merge hilang dari picker meja lain. Tidak perlu ubah kalau sudah ada.

- [ ] **Step 5: Verifikasi tsc + lint**

Run: `cd frontend && npx tsc --noEmit && npm run lint`
Expected: 0 error (pastikan tidak ada unused var `mergeMutation`/`MergePayload` — hapus import `MergePayload` kalau jadi unused).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/PaymentModal.tsx
git commit -m "feat(fe): PaymentModal kirim mergeSourceIds ke addPayment, hapus merge terpisah (Fix A)"
```

---

### Task 10: `OverdueShiftGate` + mount di POSPage & CashierDashboard

**Files:**
- Create: `frontend/src/components/OverdueShiftGate.tsx`
- Modify: `frontend/src/pages/POSPage.tsx`
- Modify: `frontend/src/pages/CashierDashboard.tsx`

- [ ] **Step 1: Buat komponen** — `frontend/src/components/OverdueShiftGate.tsx`:

```tsx
// REV 2.12: layar blokir saat shift aktif sudah lewat business day-nya (isOverdue).
// Memaksa kasir menuntaskan + menutup + menyetor shift kemarin sebelum mulai hari ini.
import { AlertTriangle } from 'lucide-react'
import type { Shift } from '@/types'
import { Button } from '@/design-system/primitives'

export default function OverdueShiftGate({
  shift,
  onGoToSettlement,
}: {
  shift: Shift
  onGoToSettlement: () => void
}) {
  return (
    <div className="h-full flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-sm border border-warning-200">
        <div className="w-14 h-14 bg-warning-100 text-warning-700 rounded-full mx-auto mb-3 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-title font-semibold text-neutral-900 mb-1 text-center">
          Shift kemarin belum ditutup
        </h2>
        <p className="text-body-sm text-neutral-600 mb-3 text-center">
          Shift {shift.type ? `${shift.type} ` : ''}tanggal {shift.date} (kasir {shift.cashierName})
          masih terbuka. Tuntaskan semua pesanan yang belum dibayar, lalu tutup &amp; setor shift
          itu dulu sebelum mulai hari ini.
        </p>
        <Button variant="primary" size="md" fullWidth onClick={onGoToSettlement}>
          Tutup &amp; Setor Shift Kemarin
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Mount di POSPage** — di `frontend/src/pages/POSPage.tsx`, import + sisipkan cek SETELAH blok `activeShifts.length !== 1` (sekitar baris 355-375). Tambah import:

```ts
import OverdueShiftGate from '@/components/OverdueShiftGate'
```

Sisipkan setelah blok ShiftGate (sebelum `return (` utama, baris 377):

```ts
  // REV 2.12: shift tunggal yang aktif tapi sudah basi → blok input, arahkan tutup.
  const overdueShift = activeShifts.find((s) => s.isOverdue) ?? null
  if (!shiftLoading && overdueShift) {
    return <OverdueShiftGate shift={overdueShift} onGoToSettlement={() => navigate('/settlement')} />
  }
```

- [ ] **Step 3: Mount di CashierDashboard** — di `frontend/src/pages/CashierDashboard.tsx`, render `OverdueShiftGate` di atas konten saat ada active shift `isOverdue`. Import komponen + `useNavigate` (kalau belum), lalu di awal `return` (sebelum konten dashboard utama):

```tsx
  const overdueShift = activeShifts.find((s) => s.isOverdue) ?? null
  if (overdueShift) {
    return <OverdueShiftGate shift={overdueShift} onGoToSettlement={() => navigate('/settlement')} />
  }
```

> Sesuaikan nama variabel `activeShifts`/`navigate` dengan yang sudah ada di CashierDashboard. Kalau dashboard belum query `getActiveShifts`, gunakan query yang sudah ada untuk active shift (cari `shiftService.getActiveShifts` / `['shifts','active']`).

- [ ] **Step 4: Verifikasi tsc + lint + build**

Run: `cd frontend && npx tsc --noEmit && npm run lint && npm run build`
Expected: 0 error, build SUCCESS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/OverdueShiftGate.tsx frontend/src/pages/POSPage.tsx frontend/src/pages/CashierDashboard.tsx
git commit -m "feat(fe): OverdueShiftGate blokir input saat shift kemarin belum ditutup (Fix B UI)"
```

---

## PHASE 6 — Verifikasi menyeluruh + remediasi data

### Task 11: Verifikasi penuh (verification-before-completion)

**Files:** none (verifikasi)

- [ ] **Step 1: Unit + tsc backend**

Run: `cd backend && npx vitest run && npx tsc --noEmit`
Expected: semua unit PASS, 0 tsc error.

- [ ] **Step 2: Semua smoke (DB test)**

Run satu per satu:
```
cd backend && npx tsx --env-file=.env.test scripts/smoke-merge-atomic.ts
cd backend && npx tsx --env-file=.env.test scripts/smoke-shift-stale.ts
cd backend && npx tsx --env-file=.env.test scripts/smoke-void-unmerge.ts
cd backend && npx tsx --env-file=.env.test scripts/smoke-tx.ts
cd backend && npx tsx --env-file=.env.test scripts/smoke-shift.ts
```
Expected: semua `0 fail`, exit 0.

- [ ] **Step 3: Frontend**

Run: `cd frontend && npx tsc --noEmit && npm run lint && npm run build`
Expected: 0 error, build SUCCESS.

- [ ] **Step 4: Commit (kalau ada perbaikan kecil)** — kalau verifikasi memunculkan fix, commit terpisah dengan pesan deskriptif.

---

### Task 12: Remediasi data nyata (shift 57 / meja 7) via flow baru

**Files:** none (operasi via UI app, DB `pos_restaurant` asli)

> **PRASYARAT:** Task 1-11 selesai + hijau. Jalankan `npm run dev` (root) → backend :8000 + frontend :3000.

- [ ] **Step 1: Konfirmasi state awal** — buka app sebagai kasir. Karena shift 57 (29 Mei) kini terdeteksi basi, POSPage/Dashboard harus menampilkan **OverdueShiftGate**. Catat bahwa gate muncul (bukti Fix B jalan).

- [ ] **Step 2: Ke Settlement / tuntaskan meja 7** — klik "Tutup & Setor Shift Kemarin" → `/settlement`. Untuk meja 7:
  - Jika #221/#223/#442 data uji → **void** (#221 dulu; Fix C otomatis melepas #223/#442 → tampil terpisah → void masing-masing), ATAU
  - Jika ingin tetap tercatat → **bayar** lewat PaymentModal (sekarang merge atomik; pastikan angka benar 40rb / sesuai item).
- [ ] **Step 3: Pastikan meja kosong** — `listByTable` meja 7 harus 0 order open.
- [ ] **Step 4: Tutup-final + setor shift 57** — isi settlement, submit. Shift 57 `closedAt` terisi, `activeMarker` lepas.
- [ ] **Step 5: Buka shift hari ini** — OverdueShiftGate hilang; buka shift baru → POS normal, clean slate.
- [ ] **Step 6: Verifikasi anti-regресi bug awal** — buat 2 pesanan di satu meja, "Bayar" → pastikan angka = jumlah benar, dan kalau dibatalkan di tengah, tidak ada merge nyangkut (cek via DB: tidak ada `mergedIntoId` open menggantung).

- [ ] **Step 7: Catat hasil** — update memory `project_owner_self_service_rev212.md` + CLAUDE.md status REV 2.12: bug stuck-merge FIXED (Fix A/B/C), remediasi shift 57/meja 7 DONE, PROD pending.

---

## Self-Review (penulis plan)

**1. Spec coverage:**
- Spec §4.1 Fix A → Task 5, 6, 9 ✓
- Spec §4.2 Fix B (helper) → Task 1; (view) → Task 2; (enforce create/addItems) → Task 3; (otoritas) → Task 4; (UI gate) → Task 10 ✓
- Spec §4.3 Fix C → Task 7 ✓
- Spec §4.4 Remediasi → Task 12 ✓
- Spec §6 Testing: unit isShiftStale (Task 1) ✓; merge validasi/rollback (Task 6) ✓; clean-slate create block + payment allowed (Task 3) ✓; void releases children (Task 7) ✓; otoritas tutup stale (Task 4) ✓

**2. Placeholder scan:** Tidak ada TBD/"handle edge cases" tanpa kode. Semua step implementasi membawa kode konkret. Langkah "sesuaikan nama variabel" di Task 8 Step 2 & Task 10 Step 3 adalah instruksi integrasi ke kode existing yang namanya bisa berbeda — bukan placeholder logika.

**3. Type consistency:**
- `isShiftStale(shiftDate: Date, s: ShiftWindowSettings, now?: Date)` konsisten dipakai di Task 1/2/3/4.
- `mergeSourceIds: number[]` konsisten: schema (Task 5) → service (Task 6) → AddPaymentPayload (Task 8) → PaymentModal (Task 9).
- `ShiftView.isOverdue: boolean` (Task 2) ↔ frontend `Shift.isOverdue?` (Task 8) ↔ pemakaian gate (Task 10).

**4. Scope:** Fokus 1 plan, 3 fix saling-terkait + remediasi. Tidak ada subsistem independen yang perlu dipecah.

---

## Catatan rollout
- **Tanpa migrasi DB** (mergeSourceIds = field request; isOverdue = computed). Aman untuk prod tanpa `prisma migrate`.
- Setelah merge ke main + verifikasi: redeploy backend+frontend prod, cek shift overdue di prod (kemungkinan ada), bereskan lewat flow baru yang sama (Task 12).
