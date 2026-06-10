# POS UI Fixes + Merged-Receipt Bug — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three POS UI/UX defects (uneven table cards, missing occupied-marker in POS table picker, un-scrollable mobile category tabs) and one data bug (merged-order receipts omit combined items + show a non-reconciling subtotal).

**Architecture:** The receipt bug is fixed by surfacing merged children (`mergedFrom`) from the backend in `getTransactionById` only (additive `mergedSources` field), then aggregating in a newly-extracted pure `buildReceiptRows()` that the PDF generator renders. The three UI fixes are localized CSS/markup + one new occupancy query reusing TablesPage's React-Query cache key. No schema, permission, or merge-model changes.

**Tech Stack:** Backend Express 4 + Prisma + Vitest + standalone tsx smoke scripts (against `*_test` DB). Frontend React 18 + Vite + Tailwind + Radix Tabs + jsPDF + Vitest. Spec: [docs/superpowers/specs/2026-06-06-pos-ui-fixes-and-receipt-merge-design.md](../specs/2026-06-06-pos-ui-fixes-and-receipt-merge-design.md).

---

## File Structure

- `backend/src/modules/transactions/transactions.service.ts` — add `TransactionMergedSource` + `mergedSources?` to `TransactionView`; populate in `getTransactionById`.
- `backend/scripts/smoke-receipt-merge.ts` — **new** integration smoke proving `getTransactionById` returns merged children's items + reconciling subtotal.
- `frontend/src/types/index.ts` — add `mergedSources?` to `Transaction`.
- `frontend/src/lib/receipt.ts` — extract pure `buildReceiptRows()`; aggregate all items + subtotal.
- `frontend/src/lib/receipt.test.ts` — **new** vitest for `buildReceiptRows()`.
- `frontend/src/design-system/primitives/Tabs.tsx` — add `max-w-full` to scrollable list.
- `frontend/src/pages/TablesPage.tsx` — card button `h-full min-h-[8.5rem]`.
- `frontend/src/pages/POSPage.tsx` — occupancy query + derive `occupiedTables`, pass to CartPanel.
- `frontend/src/components/CartPanel.tsx` — accept `occupiedTables`, render amber tint + dot.

**Branch:** `fix/pos-ui-and-receipt-merge` (worktree, created at execution time via using-git-worktrees).

---

## Phase 1 — Backend: surface merged children for receipts

### Task 1: Add `mergedSources` to the transaction detail view

**Files:**
- Modify: `backend/src/modules/transactions/transactions.service.ts` (view type near line 112-139; `getTransactionById` near line 1063-1070)
- Test: `backend/scripts/smoke-receipt-merge.ts` (new)

- [ ] **Step 1: Write the failing smoke test**

Create `backend/scripts/smoke-receipt-merge.ts`:

```ts
// Integration smoke: getTransactionById menyertakan item anak yang ter-merge
// (mergedSources) + subtotal rekonsiliasi. WAJIB DB *_test.
// Jalankan: npx tsx --env-file=.env.test scripts/smoke-receipt-merge.ts
import 'dotenv/config';
import { UserRole, ShiftType } from '@prisma/client';
import { prisma } from '../src/config/prisma';
import { openShift } from '../src/modules/shifts/shifts.service';
import {
  createTransaction,
  addPayment,
  getTransactionById,
} from '../src/modules/transactions/transactions.service';

if (!/_test/.test(process.env.DATABASE_URL ?? '')) throw new Error('REFUSE: smoke harus pakai DB *_test.');

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ FAIL: ${m}`)); };

async function main() {
  console.log(`[smoke-receipt-merge] DB=${process.env.DATABASE_URL?.split('/').pop()}`);
  await prisma.transactionPayment.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.shift.deleteMany({});
  await prisma.appSetting.update({
    where: { id: 1 },
    data: { taxEnabled: false, timezone: 'Asia/Jakarta', shiftPagiStart: '00:00', shiftChangeover: '23:58', shiftMalamEnd: '23:59' },
  });

  const cashier = await prisma.user.findFirst({ where: { role: UserRole.cashier } });
  const menu = await prisma.menu.findFirst({ where: { isActive: true, stockType: 'portion' } });
  if (!cashier || !menu) throw new Error('seed kurang');
  await openShift(cashier.id, { type: ShiftType.pagi, openingCash: 500000 });

  const mk = () => createTransaction(cashier.id, {
    orderType: 'dineIn', tableNumber: 3, items: [{ menuId: menu.id, qty: 1 }],
  } as Parameters<typeof createTransaction>[1]);

  console.log('\n[1] Merge B ke A lalu bayar A → getById(A) memuat item B:');
  const A = await mk();
  const B = await mk();
  const total = A.subtotal + B.subtotal;
  const paid = await addPayment(A.id, cashier.id, {
    method: 'cash', amount: total, mergeSourceIds: [B.id],
  } as Parameters<typeof addPayment>[2]);
  ok(paid.status === 'paid', `A lunas (total ${paid.total})`);

  const detail = await getTransactionById(A.id);
  ok(Array.isArray(detail.mergedSources) && detail.mergedSources.length === 1, `mergedSources ada 1 (got ${detail.mergedSources?.length})`);
  const src = detail.mergedSources?.[0];
  ok(src?.id === B.id, `mergedSources[0].id == B (#${B.id}), got ${src?.id}`);
  ok((src?.items.length ?? 0) === B.items.length, `item anak terbawa (${src?.items.length} == ${B.items.length})`);
  const aggSubtotal = detail.subtotal + (detail.mergedSources ?? []).reduce((s, m) => s + m.subtotal, 0);
  ok(aggSubtotal === detail.total, `subtotal agregat (${aggSubtotal}) rekonsiliasi dengan total (${detail.total})`);

  console.log('\n[2] Tx non-merge → mergedSources undefined/kosong:');
  const C = await mk();
  const cDetail = await getTransactionById(C.id);
  ok(!cDetail.mergedSources || cDetail.mergedSources.length === 0, 'Tx polos tanpa mergedSources');

  console.log(`\n[smoke-receipt-merge] HASIL: ${pass} pass, ${fail} fail`);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}
main().catch(async (e) => { console.error('[smoke-receipt-merge] ERROR', e); await prisma.$disconnect(); process.exit(1); });
```

- [ ] **Step 2: Run the smoke to verify it fails**

Run: `cd backend && npx tsx --env-file=.env.test scripts/smoke-receipt-merge.ts`
Expected: FAIL on `mergedSources ada 1` (field undefined — not yet implemented). (Prereq: `.env.test` points at `pos_restaurant_test` and it is seeded. If DB is empty, run `DATABASE_URL=<test> npm run db:seed` style per existing smoke workflow first.)

- [ ] **Step 3: Add the `TransactionMergedSource` type + field**

In `backend/src/modules/transactions/transactions.service.ts`, immediately BEFORE `export interface TransactionView {` (currently line ~112), add:

```ts
/// REV 2.13: ringkasan satu transaksi anak yang ter-merge ke parent (mergedFrom).
/// Dipakai untuk struk + detail agar item gabungan tidak hilang. Anak menyimpan
/// items + subtotal-nya sendiri (cascade payment hanya nol-kan total/tax/discount).
export interface TransactionMergedSource {
  id: number;
  tableNumber: number | null;
  subtotal: number;
  items: TransactionItemView[];
}
```

Then, inside `export interface TransactionView { ... }`, add this field right after the `payments: TransactionPaymentView[];` line (~line 135):

```ts
  /// REV 2.13: hanya diisi oleh getTransactionById (bukan list). Anak-anak yang
  /// ter-merge ke transaksi ini, lengkap dengan item-nya. undefined kalau tidak ada.
  mergedSources?: TransactionMergedSource[];
```

- [ ] **Step 4: Populate `mergedSources` in `getTransactionById`**

Replace the body of `getTransactionById` (currently lines ~1063-1070):

```ts
export async function getTransactionById(id: number): Promise<TransactionView> {
  const t = await prisma.transaction.findUnique({
    where: { id },
    include: transactionInclude,
  });
  if (!t) throw notFound('Transaction');
  return toTransactionView(t);
}
```

with:

```ts
export async function getTransactionById(id: number): Promise<TransactionView> {
  const t = await prisma.transaction.findUnique({
    where: { id },
    include: transactionInclude,
  });
  if (!t) throw notFound('Transaction');
  const view = toTransactionView(t);

  // REV 2.13: sertakan item dari anak yang ter-merge (mergedFrom) supaya struk +
  // detail menampilkan SEMUA item gabungan. HANYA di getById (bukan list) agar
  // endpoint daftar tetap ringan. Reuse toTransactionView untuk mapping item anak
  // (variantLabel/selections/notes identik). Anak menyimpan items + subtotal sendiri.
  const children = await prisma.transaction.findMany({
    where: { mergedIntoId: id },
    include: transactionInclude,
    orderBy: { createdAt: 'asc' },
  });
  if (children.length > 0) {
    view.mergedSources = children.map((c) => ({
      id: c.id,
      tableNumber: c.tableNumber,
      subtotal: c.subtotal.toNumber(),
      items: toTransactionView(c).items,
    }));
  }
  return view;
}
```

- [ ] **Step 5: Typecheck + run the smoke to verify it passes**

Run: `cd backend && npx tsc --noEmit`
Expected: exit 0, no errors.

Run: `cd backend && npx tsx --env-file=.env.test scripts/smoke-receipt-merge.ts`
Expected: `HASIL: 6 pass, 0 fail`.

- [ ] **Step 6: Regression — existing merge smoke still green**

Run: `cd backend && npx tsx --env-file=.env.test scripts/smoke-merge-atomic.ts`
Expected: prior pass count, 0 fail.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/transactions/transactions.service.ts backend/scripts/smoke-receipt-merge.ts
git commit -m "feat(tx): sertakan mergedSources di getTransactionById untuk struk gabungan"
```

---

## Phase 2 — Frontend: receipt renders all merged items + correct subtotal

### Task 2: Add `mergedSources` to the frontend Transaction type

**Files:**
- Modify: `frontend/src/types/index.ts` (interface `Transaction`, near line 323-352)

- [ ] **Step 1: Add the type**

In `frontend/src/types/index.ts`, immediately BEFORE `export interface Transaction {` (line ~323), add:

```ts
/** REV 2.13: ringkasan transaksi anak yang ter-merge (mergedFrom), untuk struk
 * gabungan. Hanya diisi oleh endpoint detail (GET /transactions/:id). */
export interface TransactionMergedSource {
  id: number
  tableNumber: number | null
  subtotal: number
  items: TransactionItem[]
}
```

Then inside `interface Transaction { ... }`, add right after the `payments: TransactionPayment[]` line (~line 348):

```ts
  /** REV 2.13: anak-anak yang ter-merge ke transaksi ini (lengkap dengan item).
   * Hanya hadir dari GET /transactions/:id (byId), bukan dari list. */
  mergedSources?: TransactionMergedSource[]
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat(types): tambah mergedSources ke Transaction (struk gabungan)"
```

### Task 3: Extract `buildReceiptRows()` + aggregate merged items (TDD)

**Files:**
- Modify: `frontend/src/lib/receipt.ts`
- Test: `frontend/src/lib/receipt.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/receipt.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildReceiptRows, type Row } from './receipt'
import type { Transaction } from '@/types'

// Factory transaksi minimal untuk struk. Hanya field yang dibaca buildReceiptRows.
function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: 1, shiftId: 1, orderType: 'dineIn', tableNumber: 3,
    createdById: 1, createdByName: 'Jason', shiftCashierName: 'Jason',
    status: 'paid', mergedIntoId: null,
    subtotal: 0, discountAmount: 0, taxAmount: 0, taxBorneAmount: 0, total: 0,
    items: [], payments: [],
    createdAt: '2026-06-07T10:00:00.000Z', paidAt: '2026-06-07T10:05:00.000Z', voidedAt: null,
    ...partial,
  } as Transaction
}

function item(over: { menuName: string; qty: number; subtotal: number }) {
  return {
    id: Math.floor(over.subtotal), menuId: 1, menuName: over.menuName, qty: over.qty,
    unitPrice: over.subtotal / over.qty, subtotal: over.subtotal,
    subOptionsSelected: null, notes: null, createdAt: '2026-06-07T10:00:00.000Z',
  }
}

const lr = (rows: Row[], label: string) =>
  rows.find((r): r is Extract<Row, { t: 'lr' }> => r.t === 'lr' && r.l === label)

describe('buildReceiptRows', () => {
  it('struk non-merge: subtotal == jumlah item, hanya item parent', () => {
    const t = tx({
      subtotal: 40000, total: 40000,
      items: [item({ menuName: 'Ayam Bakar', qty: 2, subtotal: 40000 })],
      payments: [{ id: 1, method: 'cash', bank: null, amount: 40000, recordedAt: '', recordedById: 1, recordedByName: 'Jason' }],
    })
    const rows = buildReceiptRows(t, { identity: null })
    expect(rows.some((r) => r.t === 'lr' && r.l.includes('Ayam Bakar'))).toBe(true)
    expect(lr(rows, 'Subtotal')?.r).toBe('40.000')
    expect(lr(rows, 'TOTAL')?.r).toBe('40.000')
  })

  it('struk gabungan: semua item (parent + anak) muncul & subtotal agregat rekonsiliasi', () => {
    const t = tx({
      subtotal: 40000, total: 50000, // total agregat sudah di-set backend
      items: [item({ menuName: 'Ayam Bakar', qty: 2, subtotal: 40000 })],
      payments: [{ id: 1, method: 'cash', bank: null, amount: 50000, recordedAt: '', recordedById: 1, recordedByName: 'Jason' }],
      mergedSources: [
        { id: 2, tableNumber: 3, subtotal: 10000, items: [
          item({ menuName: 'Es Teh', qty: 1, subtotal: 5000 }),
          item({ menuName: 'Nasi Putih', qty: 1, subtotal: 5000 }),
        ] },
      ],
    })
    const rows = buildReceiptRows(t, { identity: null })
    expect(rows.some((r) => r.t === 'lr' && r.l.includes('Ayam Bakar'))).toBe(true)
    expect(rows.some((r) => r.t === 'lr' && r.l.includes('Es Teh'))).toBe(true)
    expect(rows.some((r) => r.t === 'lr' && r.l.includes('Nasi Putih'))).toBe(true)
    // Subtotal = 40000 + 10000 = 50000, rekonsiliasi dengan TOTAL.
    expect(lr(rows, 'Subtotal')?.r).toBe('50.000')
    expect(lr(rows, 'TOTAL')?.r).toBe('50.000')
    // Catatan gabungan muncul.
    expect(rows.some((r) => r.t === 'left' && r.s.includes('Gabungan'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/receipt.test.ts`
Expected: FAIL — `buildReceiptRows` is not exported.

- [ ] **Step 3: Refactor `receipt.ts` to export a pure `buildReceiptRows()`**

In `frontend/src/lib/receipt.ts`:

(a) Export the `Row` type — change `type Row =` (line 20) to `export type Row =`.

(b) Replace the single function `generateReceiptPdf` (lines 62-151) with a split: a pure `buildReceiptRows()` containing all row-building logic (aggregating merged items), plus a thin `generateReceiptPdf()` that renders + saves. Use this exact body:

```ts
/** Bangun daftar baris struk (pure - tanpa side effect). Diuji di receipt.test.ts.
 * REV 2.13: agregasi item + subtotal dari transaksi gabungan (mergedSources). */
export function buildReceiptRows(tx: Transaction, opts: ReceiptOptions): Row[] {
  const id = opts.identity
  const labelOf = opts.paymentLabel ?? ((m) => m)
  const rows: Row[] = []

  // REV 2.13: gabungkan item parent + semua anak yang ter-merge. aggregateSubtotal
  // = subtotal parent + Σ subtotal anak (== Σ semua item) supaya baris Subtotal
  // rekonsiliasi dengan TOTAL (yang sudah agregat dari backend).
  const sources = tx.mergedSources ?? []
  const allItems = [...tx.items, ...sources.flatMap((s) => s.items)]
  const aggregateSubtotal = tx.subtotal + sources.reduce((s, m) => s + m.subtotal, 0)

  // --- Header (identitas resto) ---
  if (id?.restaurantName) rows.push({ t: 'center', s: id.restaurantName, bold: true })
  if (id?.restaurantAddress) wrap(id.restaurantAddress, CHARS).forEach((s) => rows.push({ t: 'center', s }))
  if (id?.restaurantPhone) rows.push({ t: 'center', s: id.restaurantPhone })
  if (id?.openingHours) rows.push({ t: 'center', s: `Buka ${id.openingHours}` })
  rows.push({ t: 'sep', c: '=' })

  // --- Meta transaksi ---
  rows.push({ t: 'lr', l: `No #${tx.id}`, r: fmtDateTime(tx.paidAt ?? tx.createdAt) })
  rows.push({ t: 'left', s: `Kasir: ${tx.shiftCashierName || tx.createdByName}` })
  rows.push({
    t: 'left',
    s: tx.orderType === 'dineIn' ? `Meja ${tx.tableNumber} · Dine-in` : 'Takeaway',
  })
  // REV 2.13: tandai struk gabungan (parent + N anak).
  if (sources.length > 0) rows.push({ t: 'left', s: `Gabungan ${sources.length + 1} pesanan` })
  rows.push({ t: 'sep', c: '-' })

  // --- Item (parent + anak) ---
  for (const it of allItems) {
    const amt = money(it.subtotal)
    const headLines = wrap(`${it.qty}x ${it.menuName}`, CHARS - amt.length - 1)
    headLines.forEach((s, i) =>
      i === 0 ? rows.push({ t: 'lr', l: s, r: amt }) : rows.push({ t: 'left', s }),
    )
    const detail: string[] = []
    if (it.variantLabel) detail.push(it.variantLabel)
    if (it.subOptionsSelected) detail.push(...Object.values(it.subOptionsSelected))
    if (detail.length) wrap('  ' + detail.join(' · '), CHARS).forEach((s) => rows.push({ t: 'left', s }))
    if (it.notes) wrap(`  (${it.notes})`, CHARS).forEach((s) => rows.push({ t: 'left', s }))
  }
  rows.push({ t: 'sep', c: '-' })

  // --- Totals ---
  rows.push({ t: 'lr', l: 'Subtotal', r: money(aggregateSubtotal) })
  if (tx.discountAmount > 0) rows.push({ t: 'lr', l: 'Diskon', r: `-${money(tx.discountAmount)}` })
  if (tx.taxAmount > 0) rows.push({ t: 'lr', l: `PB1 ${opts.taxRate ?? 10}%`, r: money(tx.taxAmount) })
  rows.push({ t: 'sep', c: '-' })
  rows.push({ t: 'lr', l: 'TOTAL', r: money(tx.total), bold: true })

  // --- Pembayaran + kembalian ---
  const paid = tx.payments.reduce((s, p) => s + p.amount, 0)
  for (const p of tx.payments) {
    rows.push({ t: 'lr', l: labelOf(p.method) + (p.bank ? ` (${p.bank})` : ''), r: money(p.amount) })
  }
  const change = paid - tx.total
  if (change > 0) rows.push({ t: 'lr', l: 'Kembali', r: money(change) })
  rows.push({ t: 'sep', c: '=' })

  // --- Footer ---
  if (tx.taxBorneAmount > 0) rows.push({ t: 'center', s: 'Harga sudah termasuk PB1' })
  rows.push({ t: 'center', s: '~ Terima kasih ~' })
  rows.push({ t: 'center', s: 'Simpan sebagai bukti bayar' })

  return rows
}

/** Bangun + unduh struk PDF untuk transaksi yang sudah dibayar. */
export function generateReceiptPdf(tx: Transaction, opts: ReceiptOptions): void {
  const rows = buildReceiptRows(tx, opts)

  // --- Render ---
  const height = MARGIN_MM * 2 + rows.length * LINE_H
  const doc = new jsPDF({ unit: 'mm', format: [WIDTH_MM, height] })
  doc.setFont('courier', 'normal')
  doc.setFontSize(FONT_PT)

  const left = MARGIN_MM
  const right = WIDTH_MM - MARGIN_MM
  const center = WIDTH_MM / 2
  let y = MARGIN_MM + LINE_H

  for (const row of rows) {
    if (row.t === 'sep') {
      doc.setFont('courier', 'normal')
      doc.text(row.c.repeat(CHARS), left, y)
    } else if (row.t === 'center') {
      doc.setFont('courier', row.bold ? 'bold' : 'normal')
      doc.text(row.s, center, y, { align: 'center' })
    } else if (row.t === 'left') {
      doc.setFont('courier', 'normal')
      doc.text(row.s, left, y)
    } else {
      doc.setFont('courier', row.bold ? 'bold' : 'normal')
      doc.text(row.l, left, y)
      doc.text(row.r, right, y, { align: 'right' })
    }
    y += LINE_H
  }

  const dt = new Date(tx.paidAt ?? tx.createdAt)
  const stamp = `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}`
  doc.save(`struk-${tx.id}-${stamp}.pdf`)
}
```

(Leave the imports, constants `WIDTH_MM/MARGIN_MM/LINE_H/FONT_PT/CHARS`, helpers `money/fmtDateTime/wrap`, and `ReceiptOptions` interface exactly as they are.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/receipt.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/receipt.ts frontend/src/lib/receipt.test.ts
git commit -m "fix(receipt): tampilkan semua item gabungan + subtotal agregat di struk PDF"
```

---

## Phase 3 — Mobile category tabs scroll

### Task 4: Make scrollable Tabs swipeable on touch

**Files:**
- Modify: `frontend/src/design-system/primitives/Tabs.tsx:43`

- [ ] **Step 1: Add `max-w-full` to the scrollable list class**

In `frontend/src/design-system/primitives/Tabs.tsx`, change line 43 from:

```ts
          scrollable && 'flex-nowrap overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-fade-right'
```

to:

```ts
          scrollable && 'flex-nowrap overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-fade-right max-w-full'
```

- [ ] **Step 2: Typecheck + build**

Run: `cd frontend && npx tsc -b --noEmit && npx vite build`
Expected: exit 0, build SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/design-system/primitives/Tabs.tsx
git commit -m "fix(tabs): cap lebar list scrollable agar bisa di-geser di mobile"
```

---

## Phase 4 — Uniform table card height

### Task 5: Equalize occupied vs empty table cards

**Files:**
- Modify: `frontend/src/pages/TablesPage.tsx` (card `<button>` className, lines ~131-139)

- [ ] **Step 1: Add `h-full min-h-[8.5rem]` to the card button**

In `frontend/src/pages/TablesPage.tsx`, change the button's className first line from:

```ts
                      'w-full p-4 rounded-xl text-left border-2 transition-all duration-fast active:scale-[0.98]',
```

to:

```ts
                      'w-full h-full min-h-[8.5rem] p-4 rounded-xl text-left border-2 transition-all duration-fast active:scale-[0.98]',
```

- [ ] **Step 2: Build to verify no breakage**

Run: `cd frontend && npx vite build`
Expected: build SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/TablesPage.tsx
git commit -m "fix(meja): samakan tinggi kartu meja kosong & terisi"
```

---

## Phase 5 — Occupied marker in POS table picker

### Task 6: Fetch occupancy in POSPage + render marker in CartPanel

**Files:**
- Modify: `frontend/src/pages/POSPage.tsx` (imports line 22; queries area ~107-121; both `<CartPanel>` usages ~413-431 and ~458-476)
- Modify: `frontend/src/components/CartPanel.tsx` (Props ~34-73; destructure ~75-93; table picker ~179-199)

- [ ] **Step 1: Add the occupancy query in POSPage**

In `frontend/src/pages/POSPage.tsx`, change the React import (line 22) from:

```ts
import { useEffect, useState } from 'react'
```

to:

```ts
import { useEffect, useMemo, useState } from 'react'
```

Then, immediately AFTER the `openTakeaways` query block (ends ~line 121, the `})` closing `useQuery`), add:

```ts
  // REV 2.13: okupansi meja sistem-wide untuk marker di picker CartPanel.
  // Reuse cache key + filter TablesPage (['transactions','open-today']) agar
  // tidak ada fetch ganda. Hanya butuh dine-in open hari ini.
  const today = new Date().toISOString().substring(0, 10)
  const { data: openDineInToday = [] } = useQuery({
    queryKey: ['transactions', 'open-today'],
    queryFn: () =>
      transactionService.list({ status: 'open', orderType: 'dineIn', date: today }),
    refetchInterval: 30_000,
  })
  const occupiedTables = useMemo(() => {
    const s = new Set<number>()
    for (const t of openDineInToday) {
      if (t.tableNumber !== null && t.mergedIntoId === null) s.add(t.tableNumber)
    }
    return s
  }, [openDineInToday])
```

- [ ] **Step 2: Pass `occupiedTables` to both CartPanel instances**

In `frontend/src/pages/POSPage.tsx`, in the **desktop** `<CartPanel ... />` (starts ~line 413) add the prop after `isUpdatingItem={updateItemMutation.isPending}`:

```tsx
          occupiedTables={occupiedTables}
```

Do the same in the **mobile sheet** `<CartPanel ... />` (starts ~line 458), adding after its `isUpdatingItem={updateItemMutation.isPending}`:

```tsx
            occupiedTables={occupiedTables}
```

- [ ] **Step 3: Accept the prop in CartPanel**

In `frontend/src/components/CartPanel.tsx`, add to the `Props` interface (after `isUpdatingItem?: boolean`, line ~72):

```ts
  /// REV 2.13: nomor meja yang sedang terisi (open dine-in). Untuk marker amber +
  /// titik di picker meja. undefined = tidak ada info (semua tampak kosong).
  occupiedTables?: Set<number>
```

Then add `occupiedTables` to the destructured params (after `isUpdatingItem,`, line ~92):

```ts
  occupiedTables,
```

- [ ] **Step 4: Render the amber tint + dot in the table picker**

In `frontend/src/components/CartPanel.tsx`, replace the table-picker `.map(...)` button block (lines ~180-198) with:

```tsx
              {Array.from({ length: TABLE_COUNT }, (_, i) => i + 1).map((n) => {
                const selected = tableNumber === n
                const occupied = occupiedTables?.has(n) ?? false
                return (
                  <button
                    key={n}
                    onClick={() => setTableNumber(n)}
                    aria-pressed={selected}
                    aria-label={occupied ? `Meja ${n} (terisi)` : `Meja ${n}`}
                    className={cn(
                      'relative h-12 md:h-14 rounded-lg font-semibold text-body tabular-nums transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
                      selected
                        ? 'bg-primary-600 text-white shadow-sm'
                        : occupied
                          ? 'bg-warning-50 text-warning-800 ring-1 ring-warning-200 hover:bg-warning-100'
                          : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 active:bg-neutral-300',
                    )}
                  >
                    {n}
                    {occupied && !selected && (
                      <span
                        className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-warning-500"
                        aria-hidden
                      />
                    )}
                  </button>
                )
              })}
```

- [ ] **Step 5: Typecheck + build**

Run: `cd frontend && npx tsc -b --noEmit && npx vite build`
Expected: exit 0, build SUCCESS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/POSPage.tsx frontend/src/components/CartPanel.tsx
git commit -m "feat(pos): tandai meja terisi (amber + titik) di picker meja POS"
```

---

## Phase 6 — Full verification

### Task 7: Gate checks + manual/visual e2e

- [ ] **Step 1: Backend full check**

Run: `cd backend && npx tsc --noEmit && npm run test`
Expected: tsc 0 errors; Vitest all pass.

Run: `cd backend && npx tsx --env-file=.env.test scripts/smoke-receipt-merge.ts && npx tsx --env-file=.env.test scripts/smoke-merge-atomic.ts`
Expected: both `0 fail`.

- [ ] **Step 2: Frontend full check**

Run: `cd frontend && npx tsc -b --noEmit && npm run lint && npx vitest run && npx vite build`
Expected: tsc 0; ESLint 0 errors; Vitest pass; build SUCCESS.

- [ ] **Step 3: Manual / Playwright visual checks (mobile viewport ~390px)**

Start dev (`npm run dev` at root), then verify:
1. **Meja page** — empty and occupied cards are the same height in a mixed row.
2. **POS picker (dine-in)** — occupied tables show amber tint + dot; selected stays solid blue; tapping an occupied table opens its orders.
3. **POS category tabs** — on a narrow viewport the category row scrolls horizontally by swipe; every category is reachable.
4. **Receipt** — create two orders on one table, merge + pay, press **Simpan Struk**; open the PDF and confirm ALL items (both orders) are listed and **Subtotal == TOTAL** (with PB1 off) or reconciles (Subtotal − discount + PB1 == TOTAL when on).

- [ ] **Step 4: Update CLAUDE.md status table + memory**

Add a REV 2.13 row noting the 4 fixes; update `project_session_handoff` memory with branch + status.

- [ ] **Step 5: Final review + finish branch**

Invoke `superpowers:requesting-code-review`, then `superpowers:finishing-a-development-branch` for merge strategy.

---

## Self-Review

**Spec coverage:** ① Task 5; ② Task 6; ③ Tasks 1-3; ④ Task 4; verification plan → Task 7. All spec sections mapped. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step shows full code. ✓

**Type consistency:** `TransactionMergedSource` shape identical in backend (`transactions.service.ts`) and frontend (`types/index.ts`): `{ id, tableNumber, subtotal, items }`. `buildReceiptRows`/`Row` exported in Task 3 and consumed by Task 3's test. `occupiedTables: Set<number>` defined in POSPage (Task 6 Step 1) and consumed in CartPanel (Task 6 Step 3-4). ✓
