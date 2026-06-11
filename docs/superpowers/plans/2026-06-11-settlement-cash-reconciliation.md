# Settlement Cash Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Buat modal awal (`Shift.openingCash`) benar-benar dipakai dalam rekonsiliasi kas di settlement — variance kas = `fisik − (penjualan cash + modal awal)` — sambil mencegah double-count modal lewat carry-over di buka kasir.

**Architecture:** Tambah helper murni untuk menghitung *expected* & *variance* per metode (cash menambahkan `openingCashTotal`, non-cash tidak berubah). `toSettlementView` mengambil `Σ shift.openingCash` untuk tanggal settlement (recompute, tanpa kolom DB baru). `openShift` menormalkan `openingCash` jadi 0 untuk shift kedua dst. di satu business day. Frontend mirror tipe + render baris cash dengan ekspektasi laci eksplisit, dan sembunyikan field modal saat carry-over.

**Tech Stack:** Express 4 + TypeScript + Prisma + MySQL (backend), React 18 + TypeScript + Vite (frontend), Vitest (unit), tsx smoke scripts (integration, DB `pos_restaurant_test`).

Spec: [docs/superpowers/specs/2026-06-11-settlement-cash-reconciliation-design.md](../specs/2026-06-11-settlement-cash-reconciliation-design.md)

---

## File Structure

**Backend (create):**
- `backend/src/modules/settlements/variance.ts` — helper murni `methodExpected` / `methodVariance` (1 tanggung jawab: matematika variance per metode).
- `backend/src/modules/settlements/variance.test.ts` — unit test Vitest untuk helper.

**Backend (modify):**
- `backend/src/modules/settlements/settlements.service.ts` — `SettlementMethodCountView` (+`expected`), `SettlementView` (+`openingCashTotal`, +`totalExpected`), `toSettlementView` (fetch Σ openingCash + pakai helper).
- `backend/src/modules/shifts/shifts.service.ts` — `openShift` carry-over normalization.
- `backend/scripts/smoke-settlement.ts` — update assertion `openingCashTotal` + tambah skenario rekonsiliasi kas.

**Frontend (create):**
- `frontend/src/lib/settlementMath.ts` — helper murni mirror backend (`settlementExpected`).
- `frontend/src/lib/settlementMath.test.ts` — unit test Vitest.

**Frontend (modify):**
- `frontend/src/types/index.ts` — `SettlementMethodCountView` (+`expected`), `Settlement` (+`openingCashTotal`, +`totalExpected`).
- `frontend/src/components/OpenShiftDialog.tsx` — carry-over UX (sembunyikan field modal, kirim 0).
- `frontend/src/pages/SettlementPage.tsx` — baris cash render ekspektasi laci (preview live + detail).

---

## Task 1: Backend pure variance helper (TDD)

**Files:**
- Create: `backend/src/modules/settlements/variance.ts`
- Test: `backend/src/modules/settlements/variance.test.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/settlements/variance.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { methodExpected, methodVariance } from './variance';

describe('settlement variance (REV cash reconciliation)', () => {
  it('cash: expected = system penjualan + modal awal', () => {
    expect(methodExpected('cash', 50000, 120000)).toBe(170000);
  });

  it('cash: variance = fisik − (system + modal)', () => {
    // fisik laci 170000, sales 50000, modal 120000 → cocok
    expect(methodVariance('cash', 170000, 50000, 120000)).toBe(0);
    // fisik kurang 10000
    expect(methodVariance('cash', 160000, 50000, 120000)).toBe(-10000);
  });

  it('non-cash: modal awal diabaikan (expected = system)', () => {
    expect(methodExpected('qris', 80000, 120000)).toBe(80000);
    expect(methodVariance('qris', 80000, 80000, 120000)).toBe(0);
    expect(methodVariance('edc', 75000, 80000, 120000)).toBe(-5000);
  });

  it('cash tanpa modal (openingCashTotal=0) = perilaku lama', () => {
    expect(methodVariance('cash', 50000, 50000, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/modules/settlements/variance.test.ts`
Expected: FAIL — "Cannot find module './variance'".

- [ ] **Step 3: Write minimal implementation**

Create `backend/src/modules/settlements/variance.ts`:

```typescript
// Helper murni perhitungan rekonsiliasi settlement.
// REV (cash reconciliation): metode tunai (code === 'cash') membandingkan fisik laci
// dengan (penjualan cash + modal awal hari ini). Non-tunai tetap fisik vs system murni.
// Diskriminator 'cash' = konvensi project (sama dengan fitur kembalian).

/** Nilai pembanding (expected) untuk satu metode pembayaran. */
export function methodExpected(
  code: string,
  system: number,
  openingCashTotal: number,
): number {
  return code === 'cash' ? system + openingCashTotal : system;
}

/** Selisih = fisik (counted) − expected. */
export function methodVariance(
  code: string,
  counted: number,
  system: number,
  openingCashTotal: number,
): number {
  return counted - methodExpected(code, system, openingCashTotal);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/modules/settlements/variance.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/settlements/variance.ts backend/src/modules/settlements/variance.test.ts
git commit -m "feat(settlements): pure variance helper - cash includes modal awal

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Wire helper into settlement view shape

**Files:**
- Modify: `backend/src/modules/settlements/settlements.service.ts`

- [ ] **Step 1: Add `expected` to `SettlementMethodCountView`**

In `backend/src/modules/settlements/settlements.service.ts`, replace the interface at lines 34-41:

```typescript
export interface SettlementMethodCountView {
  paymentMethodCode: string;
  methodLabel: string;
  colorHex: string;
  counted: number;
  system: number;
  /// Pembanding aktual: cash = system + openingCashTotal, non-cash = system.
  expected: number;
  variance: number; // counted - expected
}
```

- [ ] **Step 2: Add `openingCashTotal` + `totalExpected` to `SettlementView`**

In the same file, find `interface SettlementView` (line 56) and add two fields after `totalSystem: number;` (line 66):

```typescript
  totalSystem: number;
  /// Σ shift.openingCash untuk tanggal ini (float baseline). Recompute dari shifts.
  openingCashTotal: number;
  /// Σ expected per metode (= totalSystem + openingCashTotal). totalVariance = totalCounted - totalExpected.
  totalExpected: number;
  totalVariance: number;
```

- [ ] **Step 3: Import helper at top of file**

After the existing import block (the `import type { CreateSettlementInput, ... }` ends at line 28), add:

```typescript
import { methodExpected } from './variance';
```

- [ ] **Step 4: Rewrite variance computation in `toSettlementView`**

Replace the body of `toSettlementView` from line 185 (`const codes = ...`) through line 204 (`const totalVariance = totalCounted - totalSystem;`) with:

```typescript
  const codes = s.methodCounts.map((mc) => mc.paymentMethodCode);
  const metaMap = await lookupMethodsMeta(codes);

  // openingCashTotal = Σ shift.openingCash untuk business date settlement.
  // Shift closed = immutable, jadi recompute deterministik (tanpa kolom snapshot).
  const shiftsThatDay = await prisma.shift.findMany({
    where: { date: s.date },
    select: { openingCash: true },
  });
  const openingCashTotal = Math.round(
    shiftsThatDay.reduce((sum, sh) => sum + sh.openingCash.toNumber(), 0),
  );

  const methodCounts: SettlementMethodCountView[] = s.methodCounts
    .map((mc) => {
      const meta = metaMap.get(mc.paymentMethodCode) ?? fallbackMeta(mc.paymentMethodCode);
      const expected = methodExpected(mc.paymentMethodCode, mc.system, openingCashTotal);
      return {
        paymentMethodCode: mc.paymentMethodCode,
        methodLabel: meta.label,
        colorHex: meta.colorHex,
        counted: mc.counted,
        system: mc.system,
        expected,
        variance: mc.counted - expected,
      };
    })
    .sort((a, b) => a.paymentMethodCode.localeCompare(b.paymentMethodCode));

  const totalCounted = methodCounts.reduce((sum, mc) => sum + mc.counted, 0);
  const totalSystem = methodCounts.reduce((sum, mc) => sum + mc.system, 0);
  const totalExpected = methodCounts.reduce((sum, mc) => sum + mc.expected, 0);
  const totalVariance = totalCounted - totalExpected;
```

- [ ] **Step 5: Add new fields to the returned object**

In the same `toSettlementView`, find the `return { ... }` (starts line 206). Add `openingCashTotal` and `totalExpected` next to `totalSystem`:

```typescript
    methodCounts,
    totalCounted,
    totalSystem,
    openingCashTotal,
    totalExpected,
    totalVariance,
```

- [ ] **Step 6: Verify backend compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/settlements/settlements.service.ts
git commit -m "feat(settlements): variance kas pakai openingCashTotal di view

SettlementView +openingCashTotal +totalExpected; methodCounts +expected.
toSettlementView recompute Σ shift.openingCash per tanggal, variance cash =
counted - (system + openingCashTotal).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Backend openShift carry-over normalization

**Files:**
- Modify: `backend/src/modules/shifts/shifts.service.ts:66-123`

- [ ] **Step 1: Add carry-over count to the parallel query in `openShift`**

In `backend/src/modules/shifts/shifts.service.ts`, replace the `Promise.all` block at lines 72-75:

```typescript
  const [openCount, pagiToday, shiftsToday] = await Promise.all([
    prisma.shift.count({ where: { activeMarker: 1 } }),
    prisma.shift.count({ where: { date: businessDate, type: ShiftType.pagi } }),
    prisma.shift.count({ where: { date: businessDate } }),
  ]);
```

- [ ] **Step 2: Normalize openingCash to 0 for carry-over shifts**

In the same function, after the `canOpenShift` check throws (after line 96, just before the `try {` at line 98), insert:

```typescript
  // Carry-over: hanya shift PERTAMA di satu business day yang menaruh modal.
  // Shift berikutnya melanjutkan laci yang sama (uang tidak diambil/ditambah),
  // jadi openingCash dipaksa 0 supaya Σ openingCash hari itu = modal shift pertama
  // (cegah double-count di settlement). Server = authority, abaikan nilai client.
  const effectiveOpeningCash = shiftsToday > 0 ? 0 : input.openingCash;
```

- [ ] **Step 3: Use `effectiveOpeningCash` in the create**

In the same function, change the `prisma.shift.create` data (line 104) from:

```typescript
        openingCash: new Prisma.Decimal(input.openingCash),
```

to:

```typescript
        openingCash: new Prisma.Decimal(effectiveOpeningCash),
```

- [ ] **Step 4: Verify backend compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/shifts/shifts.service.ts
git commit -m "feat(shifts): carry-over openingCash - shift kedua dst di satu hari = 0

Cegah double-count modal awal di settlement. Hanya shift pertama business day
yang menaruh modal; sisanya melanjutkan laci (uang carry-over). Server authority.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Update + extend backend smoke test

**Files:**
- Modify: `backend/scripts/smoke-settlement.ts`

> **Note:** smoke butuh DB test. Pastikan `backend/.env.test` ada dan menunjuk ke `pos_restaurant_test`. Window jam shift di-set lebar (`shiftPagiStart 00:00`, `shiftChangeover 23:58`) supaya buka pagi+malam di hari yang sama lolos validasi window (sudah di-set di baris 30).

- [ ] **Step 1: Fix the existing `openingCashTotal` assertion (carry-over)**

Carry-over mengubah modal shift malam (B) jadi 0. Di `backend/scripts/smoke-settlement.ts`, ubah baris 67:

```typescript
  ok(prev.openingCashTotal === 500000, `openingCashTotal = modal shift pertama (carry-over) = ${prev.openingCashTotal} (expect 500000)`);
```

- [ ] **Step 2: Add carry-over assertion right after shift B opens**

After line 46 (`const B = await openShift(bryant.id, { type: ShiftType.malam, openingCash: 300000 });`), insert:

```typescript
  ok(B.openingCash === 0, `shift B (malam, bukan pertama) carry-over openingCash = ${B.openingCash} (expect 0)`);
```

- [ ] **Step 3: Add a dedicated cash-reconciliation scenario block**

Find the final summary block (the `console.log(\`\n[smoke-settlement] HASIL...\`)` at line 87). Immediately BEFORE it, insert a new section that runs on a fresh business day:

```typescript
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
```

- [ ] **Step 4: Run the full smoke test**

Run: `cd backend && npx tsx --env-file=.env.test scripts/smoke-settlement.ts`
Expected: `HASIL: N pass, 0 fail` (semua termasuk section [8]).

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/smoke-settlement.ts
git commit -m "test(settlements): smoke carry-over + rekonsiliasi kas variance

Update assertion openingCashTotal (carry-over malam=0). Tambah section [8]:
modal 120k + cash sales + fisik laci = modal+sales → variance kas 0.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Frontend types mirror

**Files:**
- Modify: `frontend/src/types/index.ts:494-559`

- [ ] **Step 1: Add `expected` to `SettlementMethodCountView`**

In `frontend/src/types/index.ts`, replace the interface at lines 494-501:

```typescript
export interface SettlementMethodCountView {
  paymentMethodCode: string
  methodLabel: string
  colorHex: string
  counted: number
  system: number
  /** Pembanding aktual: cash = system + openingCashTotal, non-cash = system. */
  expected: number
  variance: number
}
```

- [ ] **Step 2: Add `openingCashTotal` + `totalExpected` to `Settlement`**

In the same file, find `interface Settlement` (line 523) and add two fields after `totalSystem: number` (line 535):

```typescript
  totalSystem: number
  /** Σ shift.openingCash tanggal ini (float baseline). */
  openingCashTotal: number
  /** Σ expected per metode (= totalSystem + openingCashTotal). */
  totalExpected: number
  totalVariance: number
```

- [ ] **Step 3: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors (SettlementPreview already has `openingCashTotal`).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat(types): Settlement +openingCashTotal +totalExpected, methodCount +expected

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Frontend shared settlement math helper (TDD)

**Files:**
- Create: `frontend/src/lib/settlementMath.ts`
- Test: `frontend/src/lib/settlementMath.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/settlementMath.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { settlementExpected } from './settlementMath'

describe('settlementExpected', () => {
  it('cash = system + modal awal', () => {
    expect(settlementExpected('cash', 50000, 120000)).toBe(170000)
  })
  it('non-cash = system (modal diabaikan)', () => {
    expect(settlementExpected('qris', 80000, 120000)).toBe(80000)
  })
  it('cash tanpa modal = system', () => {
    expect(settlementExpected('cash', 50000, 0)).toBe(50000)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/settlementMath.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/lib/settlementMath.ts`:

```typescript
// Mirror backend `settlements/variance.ts`. Cash membandingkan fisik laci dengan
// (penjualan cash + modal awal); non-cash tetap fisik vs system.

/** Pembanding (expected) untuk satu metode pembayaran. */
export function settlementExpected(
  code: string,
  system: number,
  openingCashTotal: number,
): number {
  return code === 'cash' ? system + openingCashTotal : system
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/settlementMath.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/settlementMath.ts frontend/src/lib/settlementMath.test.ts
git commit -m "feat(frontend): settlementExpected helper (mirror backend variance)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Frontend SettlementPage cash row (preview + detail)

**Files:**
- Modify: `frontend/src/pages/SettlementPage.tsx`

- [ ] **Step 1: Import the helper**

Near the top of `frontend/src/pages/SettlementPage.tsx`, with the other `@/lib` imports, add:

```typescript
import { settlementExpected } from '@/lib/settlementMath'
```

- [ ] **Step 2: Use expected for live totals (preview)**

In the preview form component, replace lines 231-235:

```typescript
  const totalActual = preview.system.reduce(
    (s, m) => s + (counts[m.paymentMethodCode] ?? 0),
    0,
  )
  const totalVariance = totalActual - preview.totalSystem
```

with:

```typescript
  const totalActual = preview.system.reduce(
    (s, m) => s + (counts[m.paymentMethodCode] ?? 0),
    0,
  )
  const totalExpected = preview.system.reduce(
    (s, m) => s + settlementExpected(m.paymentMethodCode, m.total, preview.openingCashTotal),
    0,
  )
  const totalVariance = totalActual - totalExpected
```

- [ ] **Step 3: Render expected (with cash breakdown) in the preview row**

In the preview form, the per-method row maps `preview.system.map((s) => { ... })`. Find the `const sysVal = s.total` / `const actVal` / `const diff` block (around lines 292-295) and replace the computed values:

```typescript
                const expectedVal = settlementExpected(
                  s.paymentMethodCode,
                  s.total,
                  preview.openingCashTotal,
                )
                const isCash = s.paymentMethodCode === 'cash'
                const actVal = counts[s.paymentMethodCode] ?? 0
                const diff = actVal - expectedVal
```

Then replace the "Sistem" cell (lines 309-311) to show `expectedVal` plus a cash breakdown sub-label:

```typescript
                    <span className="col-span-4 text-right text-body-sm text-neutral-600 tabular-nums">
                      {formatCurrency(expectedVal)}
                      {isCash && preview.openingCashTotal > 0 && (
                        <span className="block text-caption text-neutral-400">
                          {formatCurrency(s.total)} jual + {formatCurrency(preview.openingCashTotal)} modal
                        </span>
                      )}
                    </span>
```

> Note: the input cell uses `counts[s.paymentMethodCode]` and the `diff` for border color — these now reference the new `diff` (vs expected). No further change needed there.

- [ ] **Step 4: Relabel the "Sistem" column header in preview**

Change the preview column header (line 289) from `Sistem` to `Ekspektasi` so the comparison base is clear:

```typescript
                <span className="col-span-4 text-right">Ekspektasi</span>
```

- [ ] **Step 5: Detail view — show expected + cash breakdown**

In `SettlementDetailView`, the row map (lines 446-449) computes `const sys = mc.system`. Replace with:

```typescript
            {settlement.methodCounts.map((mc) => {
              const sys = mc.expected
              const act = mc.counted
              const diff = mc.variance
              const isCash = mc.paymentMethodCode === 'cash'
              const cashModal = settlement.openingCashTotal
```

Then update the "Sistem" cell (line 462) to add the cash breakdown:

```typescript
                  <td className="py-2 text-right text-neutral-600">
                    {formatCurrency(sys)}
                    {isCash && cashModal > 0 && (
                      <span className="block text-caption text-neutral-400">
                        {formatCurrency(mc.system)} jual + {formatCurrency(cashModal)} modal
                      </span>
                    )}
                  </td>
```

- [ ] **Step 6: Detail view — footer uses totalExpected**

In `SettlementDetailView` footer, change the TOTAL "Sistem" cell (lines 482-484) from `settlement.totalSystem` to `settlement.totalExpected`:

```typescript
              <td className="py-2.5 text-right text-neutral-700">
                {formatCurrency(settlement.totalExpected)}
              </td>
```

Also relabel the detail table header (line 433) from `Sistem` to `Ekspektasi`:

```typescript
              <th className="text-right py-2">Ekspektasi</th>
```

- [ ] **Step 7: Verify frontend compiles + builds**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: tsc 0 errors, `vite build` SUCCESS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/SettlementPage.tsx
git commit -m "feat(settlement-ui): baris cash tampilkan ekspektasi laci (sales + modal)

Preview + detail: kolom 'Ekspektasi' = settlementExpected (cash + modal awal),
variance vs ekspektasi, sub-label breakdown sales+modal untuk baris cash.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Frontend OpenShiftDialog carry-over UX

**Files:**
- Modify: `frontend/src/components/OpenShiftDialog.tsx`

- [ ] **Step 1: Compute carry-over flag + running modal**

In `frontend/src/components/OpenShiftDialog.tsx`, after `const pagiOpenedToday = ...` (line 44), add:

```typescript
  // Carry-over: sudah ada ≥1 shift hari ini → laci dilanjutkan, kasir tidak isi modal
  // baru (cegah double-count). Modal hari ini = Σ openingCash shift hari ini.
  const todayShifts = todayShiftsQ.data ?? []
  const isCarryOver = todayShifts.length > 0
  const runningModal = todayShifts.reduce((sum, s) => sum + s.openingCash, 0)
```

- [ ] **Step 2: Treat openingCash as valid (0) when carry-over**

Replace `openingCashValid` (line 72):

```typescript
  const openingCashValid = isCarryOver || (openingCash !== '' && Number.isFinite(amount) && amount >= 0)
```

- [ ] **Step 3: Send 0 on submit when carry-over**

In `handleSubmit`, both mutate calls pass `openingCash: amount`. Add a resolved value at the start of `handleSubmit` (after `e.preventDefault()`, line 103) and use it:

```typescript
    e.preventDefault()
    const effectiveCash = isCarryOver ? 0 : amount
    if (!isCarryOver && !openingCashValid) {
      toast.error('Modal awal tidak valid')
      return
    }
```

Then change `handoverMutation.mutate({ type, openingCash: amount })` (line 113) to `handoverMutation.mutate({ type, openingCash: effectiveCash })` and `openMutation.mutate({ type, openingCash: amount })` (line 120) to `openMutation.mutate({ type, openingCash: effectiveCash })`.

- [ ] **Step 4: Conditionally render modal field vs carry-over info**

Replace the `<Input label="Modal Awal (Rp)" .../>` block (lines 235-247) with:

```typescript
            {isCarryOver ? (
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5">
                <p className="text-label text-neutral-700">Modal awal (carry-over)</p>
                <p className="text-body font-semibold text-neutral-900 tabular-nums mt-0.5">
                  {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(runningModal)}
                </p>
                <p className="text-caption text-neutral-500 mt-1">
                  Lanjut dari laci shift sebelumnya — tidak perlu isi modal baru.
                </p>
              </div>
            ) : (
              <Input
                label="Modal Awal (Rp)"
                type="number"
                inputMode="numeric"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                min={0}
                step={1000}
                placeholder="500000"
                autoFocus
                required
                helper="Total uang cash di laci sebelum mulai shift."
              />
            )}
```

- [ ] **Step 5: Verify frontend compiles + builds**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: tsc 0 errors, build SUCCESS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/OpenShiftDialog.tsx
git commit -m "feat(shift-ui): carry-over buka kasir - sembunyikan field modal, kirim 0

Shift kedua dst di satu hari tampilkan info 'Modal awal (carry-over)' = Σ modal
hari ini, bukan input baru. Konsisten dengan normalisasi server (openingCash=0).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Backend unit + tsc + lint**

Run: `cd backend && npx vitest run && npx tsc --noEmit && npm run lint`
Expected: all vitest pass, tsc 0 errors, lint 0 errors.

- [ ] **Step 2: Backend settlement smoke (DB test)**

Run: `cd backend && npx tsx --env-file=.env.test scripts/smoke-settlement.ts`
Expected: `HASIL: N pass, 0 fail`.

- [ ] **Step 3: Frontend unit + tsc + build + lint**

Run: `cd frontend && npx vitest run && npx tsc --noEmit && npm run build && npm run lint`
Expected: all vitest pass, tsc 0 errors, build SUCCESS, lint 0 errors.

- [ ] **Step 4: Manual e2e checklist (browser, `npm run dev`)**

Catat hasil tiap langkah (PASS/FAIL):
1. Buka kasir **pagi** Jason → field "Modal Awal" muncul, isi 120000 → shift terbuka.
2. Input order dine-in, bayar **cash** → transaksi paid.
3. Serah-terima / buka **malam** Bryant → **tidak ada field Modal Awal**, muncul info "Modal awal (carry-over) Rp 120.000".
4. Tutup kasir (final) → buka halaman Settlement.
5. Form setoran: baris **Cash** kolom "Ekspektasi" = sales + 120.000, ada sub-label "X jual + 120.000 modal".
6. Isi Fisik cash = ekspektasi → "Selisih total" = Rp 0 (hijau). Isi kurang → merah negatif.
7. Submit → detail settlement: baris cash "Ekspektasi" konsisten, Selisih benar, footer pakai totalExpected.

- [ ] **Step 5: Final verification report**

Report bukti tiap command (exit code + ringkasan output) sesuai superpowers:verification-before-completion sebelum klaim selesai. Jangan klaim PASS tanpa output.

---

## Self-Review Notes

- **Spec coverage:** §4.1 variance rule → Task 1+2; §4.2 backend view → Task 2; §4.3 carry-over → Task 3 (BE) + Task 8 (FE); §4.4 form UI → Task 7; testing §6 → Task 4 (smoke) + Task 9.
- **Carry-over double-count regression:** smoke assertion `openingCashTotal` 800000→500000 explicitly fixed (Task 4 Step 1) — this WILL fail otherwise.
- **Type consistency:** `methodExpected` (BE) / `settlementExpected` (FE) both `(code, system, openingCashTotal)`. View fields `expected`, `openingCashTotal`, `totalExpected` consistent across BE service + FE types + FE render.
- **Known limitation (accepted, spec §5):** hari dengan modal awal > 0 tapi 0 penjualan cash & kasir tidak ketik fisik cash → tidak ada baris cash, float tidak direkonsiliasi hari itu. Resto selalu ada penjualan cash → 99% kasus tertangani; jika kasir ketik fisik cash, baris cash muncul (union countCodes) dengan expected = modal.
- **No DB migration** — `openingCashTotal` recompute dari `shifts`; `Settlement` schema tidak berubah.
