# Edit Varian/Paket Item Pesanan Terbuka — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memungkinkan kasir/waiter mengubah varian atau pilihan slot paket sebuah item yang sudah ada di Pesanan terbuka (mis. Ayam Bakar Dada → Paha) tanpa hapus + input ulang, dengan penyesuaian stok/harga/COGS yang benar.

**Architecture:** Endpoint backend baru `PATCH /transactions/:id/items/:itemId/variant` menjalankan operasi in-place "reverse stok lama → re-resolve pilihan baru → apply stok baru" memakai helper transaksi yang sudah teruji (`buildMenuGraph`/`deductionsForStoredItem`/`resolveItems`/`recomputeSubtotal`). Frontend memunculkan tombol "Ubah varian" di edit mode `ActiveOrdersView` yang membuka `VariantPickerModal` yang sudah di-pre-fill dari item tersimpan.

**Tech Stack:** Express 4 + TypeScript + Prisma + MySQL (backend); React 18 + TypeScript + Vite + React Query + Zustand (frontend). Test backend via smoke script (`tsx --env-file=.env.test`), pola sama dengan `scripts/smoke-tx-variants.ts`.

**Spec:** [docs/superpowers/specs/2026-06-10-edit-item-variant-open-order-design.md](../specs/2026-06-10-edit-item-variant-open-order-design.md)

---

## File Structure

**Backend**
- Modify `backend/src/modules/transactions/transactions.schema.ts` — tambah `changeItemVariantSchema` + `ChangeItemVariantInput`.
- Modify `backend/src/modules/transactions/transactions.service.ts` — tambah `changeTransactionItemVariant`.
- Modify `backend/src/modules/transactions/transactions.controller.ts` — tambah `handleChangeItemVariant`.
- Modify `backend/src/modules/transactions/transactions.routes.ts` — tambah route PATCH `.../variant`.
- Create `backend/scripts/smoke-tx-change-variant.ts` — smoke test (TDD: tulis dulu, gagal dulu).

**Frontend**
- Modify `frontend/src/services/transactionService.ts` — tambah `changeItemVariant`.
- Modify `frontend/src/components/VariantPickerModal.tsx` — props `initialItem` + `confirmLabel` + seed state pre-fill.
- Modify `frontend/src/components/ActiveOrdersView.tsx` — prop `onEditVariant` + tombol "Ubah varian".
- Modify `frontend/src/components/CartPanel.tsx` — pass-through `onEditVariant`.
- Modify `frontend/src/pages/POSPage.tsx` — state + handler + mutation + render modal edit + pass prop.

---

## Task 1: Backend — Zod schema `changeItemVariantSchema`

**Files:**
- Modify: `backend/src/modules/transactions/transactions.schema.ts`

- [ ] **Step 1: Tambah schema + type setelah `updateItemSchema` (sekitar baris 70)**

Sisipkan tepat setelah blok `updateItemSchema` (sebelum `addPaymentSchema`):

```ts
/// REV 2.14: PATCH /transactions/:id/items/:itemId/variant.
/// Ubah varian / pilihan paket sebuah item yang sudah ada (in-place), tanpa hapus+input ulang.
/// menuId TIDAK diterima dari client - service memakai menuId dari item DB (hanya
/// varian/paket dari menu yang sama yang boleh berubah). Bentuk field mirror orderItemSchema.
export const changeItemVariantSchema = z.object({
  variantId: z.number().int().positive().nullable().optional(),
  paketChoices: z
    .record(
      z.string(),
      z.object({
        targetMenuId: z.number().int().positive(),
        variantId: z.number().int().positive().nullable().optional(),
        chosenLabel: z.string().trim().min(1),
      }),
    )
    .optional(),
  preferences: z
    .array(z.object({ groupLabel: z.string().trim().min(1), chosenLabel: z.string().trim().min(1) }))
    .optional(),
});
```

- [ ] **Step 2: Tambah type export di blok bawah (dekat baris 141)**

Setelah `export type UpdateItemInput = z.infer<typeof updateItemSchema>;` tambah:

```ts
export type ChangeItemVariantInput = z.infer<typeof changeItemVariantSchema>;
```

- [ ] **Step 3: Verifikasi kompilasi**

Run: `cd backend && npx tsc --noEmit`
Expected: 0 error.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/transactions/transactions.schema.ts
git commit -m "feat(tx): schema changeItemVariant (REV 2.14)"
```

---

## Task 2: Backend — service `changeTransactionItemVariant` (TDD via smoke)

**Files:**
- Create: `backend/scripts/smoke-tx-change-variant.ts`
- Modify: `backend/src/modules/transactions/transactions.service.ts`

- [ ] **Step 1: Tulis smoke test dulu (akan gagal karena fungsi belum ada)**

Create `backend/scripts/smoke-tx-change-variant.ts`:

```ts
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

  // Paket dgn 1 slot choice "Lauk" → opsi C (porsiA) / D (porsiB).
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
```

- [ ] **Step 2: Jalankan smoke - pastikan GAGAL karena fungsi belum ada**

Run: `cd backend && npx tsx --env-file=.env.test scripts/smoke-tx-change-variant.ts`
Expected: error kompilasi/import `changeTransactionItemVariant` is not exported (FAIL). Ini bukti test memang menguji fungsi yang belum ada.

- [ ] **Step 3: Implementasi `changeTransactionItemVariant`**

Di `backend/src/modules/transactions/transactions.service.ts`: tambah `ChangeItemVariantInput` ke daftar import type dari `./transactions.schema` (blok import sekitar baris 53-61):

```ts
  MergeInput,
  UpdateItemInput,
  ChangeItemVariantInput,
} from './transactions.schema';
```

Lalu tambahkan fungsi baru tepat setelah `updateTransactionItem` (sebelum `deleteTransactionItem`, sekitar baris 1199):

```ts
/// REV 2.14: ubah varian / pilihan paket sebuah item yang sudah ada, in-place.
/// Model: reverse deduction LAMA penuh → re-resolve pilihan BARU dari nol → apply
/// deduction BARU. Identitas item dipertahankan (id, qty, notes). menuId SELALU
/// dari item DB (hanya varian/paket menu yang sama yang boleh berubah). Open Tx only.
export async function changeTransactionItemVariant(
  transactionId: number,
  itemId: number,
  userId: number,
  input: ChangeItemVariantInput,
): Promise<TransactionView> {
  const existing = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      items: { where: { id: itemId }, include: { menu: { select: { name: true } }, selections: true } },
    },
  });
  if (!existing) throw notFound('Transaction');
  if (existing.status !== TransactionStatus.open) {
    throw new AppError(`Hanya transaksi status open yang bisa diedit (saat ini: ${existing.status})`, 400);
  }
  const item = existing.items[0];
  if (!item) {
    throw new AppError(`Item id=${itemId} tidak ditemukan di transaksi ${transactionId}`, 404);
  }

  // Signature selections untuk guard no-op (urutan-independen).
  const sigOf = (
    sels: { groupOrSlotLabel: string; chosenLabel: string; targetMenuId: number | null; targetVariantId: number | null; isPreference: boolean }[],
  ) =>
    JSON.stringify(
      sels.map((s) => [s.groupOrSlotLabel, s.chosenLabel, s.targetMenuId, s.targetVariantId, s.isPreference]).sort(),
    );

  await prisma.$transaction(async (tx) => {
    const graph = await buildMenuGraph(tx);

    // Re-resolve item BARU lebih dulu (validasi paketChoices + varian milik menu).
    const [resolvedNew] = await resolveItems(tx, graph, [
      {
        menuId: item.menuId,
        qty: item.qty,
        variantId: input.variantId ?? null,
        paketChoices: input.paketChoices,
        preferences: input.preferences,
      },
    ]);
    if (!resolvedNew) throw new AppError('Gagal me-resolve item baru', 500);

    // Guard no-op: varian + signature selections identik → tidak ada perubahan.
    const sameVariant = (item.variantId ?? null) === (resolvedNew.variantId ?? null);
    if (sameVariant && sigOf(item.selections) === sigOf(resolvedNew.selections)) {
      return;
    }

    // 1. Reverse deduction LAMA × qty (audit refundVoid).
    const oldDeductions = deductionsForStoredItem(graph, item);
    for (const ded of oldDeductions) {
      const incBy = ded.qty * item.qty;
      const updated = await tx.portionStock.update({ where: { menuId: ded.menuId }, data: { currentQty: { increment: incBy } } });
      await tx.portionMovement.create({
        data: {
          menuId: ded.menuId, delta: incBy, reason: PortionMovementReason.refundVoid,
          transactionId, transactionItemId: itemId,
          qtyBefore: updated.currentQty - incBy, qtyAfter: updated.currentQty,
          note: `ganti varian: lepas "${item.menu.name}"`, userId,
        },
      });
    }

    // 2. Apply deduction BARU × qty (audit order).
    for (const ded of resolvedNew.deductions) {
      const decBy = ded.qty * item.qty;
      const delta = -decBy;
      const updated = await tx.portionStock.update({ where: { menuId: ded.menuId }, data: { currentQty: { decrement: decBy } } });
      await tx.portionMovement.create({
        data: {
          menuId: ded.menuId, delta, reason: PortionMovementReason.order,
          transactionId, transactionItemId: itemId,
          qtyBefore: updated.currentQty - delta, qtyAfter: updated.currentQty,
          note: `ganti varian: pasang "${item.menu.name}"`, userId,
        },
      });
    }

    // 3. Update baris item (varian/harga/cost/subtotal). qty + notes tetap.
    await tx.transactionItem.update({
      where: { id: itemId },
      data: {
        variantId: resolvedNew.variantId,
        unitPrice: resolvedNew.unitPrice,
        unitCost: resolvedNew.unitCost,
        subtotal: resolvedNew.unitPrice.mul(item.qty),
      },
    });

    // 4. Ganti selections.
    await tx.transactionItemSelection.deleteMany({ where: { transactionItemId: itemId } });
    if (resolvedNew.selections.length > 0) {
      await tx.transactionItemSelection.createMany({
        data: resolvedNew.selections.map((s) => ({ ...s, transactionItemId: itemId })),
      });
    }

    // 5. Recompute subtotal Tx.
    await recomputeSubtotal(tx, transactionId);
  });

  return getTransactionById(transactionId);
}
```

- [ ] **Step 4: Jalankan smoke - pastikan LULUS**

Run: `cd backend && npx tsx --env-file=.env.test scripts/smoke-tx-change-variant.ts`
Expected: semua `✓`, `PASS=... FAIL=0`, exit 0.

- [ ] **Step 5: Pastikan smoke lama tidak regresi + tsc**

Run: `cd backend && npx tsc --noEmit && npx tsx --env-file=.env.test scripts/smoke-tx-variants.ts`
Expected: tsc 0 error; smoke-tx-variants tetap `FAIL=0`.

- [ ] **Step 6: Commit**

```bash
git add backend/scripts/smoke-tx-change-variant.ts backend/src/modules/transactions/transactions.service.ts
git commit -m "feat(tx): changeTransactionItemVariant in-place + smoke (REV 2.14)"
```

---

## Task 3: Backend — controller + route

**Files:**
- Modify: `backend/src/modules/transactions/transactions.controller.ts`
- Modify: `backend/src/modules/transactions/transactions.routes.ts`

- [ ] **Step 1: Tambah import schema di controller**

Di `transactions.controller.ts`, tambahkan ke daftar import dari `./transactions.schema` (sekitar baris 10-18):

```ts
  updateItemSchema,
  changeItemVariantSchema,
} from './transactions.schema';
```

- [ ] **Step 2: Tambah handler setelah `handleUpdateItem` (sekitar baris 55)**

```ts
/// REV 2.14: PATCH /transactions/:id/items/:itemId/variant - ubah varian/paket item in-place.
/// Reverse stok lama → re-resolve pilihan baru → apply stok baru. Semua role authenticated.
export const handleChangeItemVariant = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  const id = parseId(req.params.id);
  const itemId = parseId(req.params.itemId);
  const input = changeItemVariantSchema.parse(req.body);
  const transaction = await transactionsService.changeTransactionItemVariant(id, itemId, req.user.id, input);
  sendSuccess(res, { transaction }, 'Varian item berhasil diubah');
});
```

- [ ] **Step 3: Tambah route + import handler di `transactions.routes.ts`**

Tambah `handleChangeItemVariant` ke daftar import handler (sekitar baris 19-32):

```ts
  handleUpdateItem,
  handleChangeItemVariant,
  handleAddPayment,
```

Tambah route tepat setelah baris `router.patch('/:id/items/:itemId', handleUpdateItem);` (baris 48):

```ts
// REV 2.14: ubah varian/paket item terbuka in-place (reverse stok lama → apply stok baru)
router.patch('/:id/items/:itemId/variant', handleChangeItemVariant);
```

- [ ] **Step 4: Verifikasi kompilasi**

Run: `cd backend && npx tsc --noEmit`
Expected: 0 error.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/transactions/transactions.controller.ts backend/src/modules/transactions/transactions.routes.ts
git commit -m "feat(tx): route PATCH /:id/items/:itemId/variant (REV 2.14)"
```

---

## Task 4: Frontend — service `changeItemVariant`

**Files:**
- Modify: `frontend/src/services/transactionService.ts`

- [ ] **Step 1: Tambah method setelah `updateItem` (sekitar baris 156)**

```ts
  /** REV 2.14: ubah varian / pilihan paket item yang sudah ada (in-place).
   * Backend reverse stok lama → re-resolve pilihan baru → apply stok baru +
   * update harga/cost/subtotal + ganti selections. Open Tx only. */
  changeItemVariant: async (
    transactionId: number,
    itemId: number,
    payload: {
      variantId?: number | null
      paketChoices?: Record<
        string,
        { targetMenuId: number; variantId?: number | null; chosenLabel: string }
      >
      preferences?: { groupLabel: string; chosenLabel: string }[]
    },
  ): Promise<Transaction> => {
    const res = await api.patch<ApiResponse<{ transaction: Transaction }>>(
      `/transactions/${transactionId}/items/${itemId}/variant`,
      payload,
    )
    return res.data.data.transaction
  },
```

- [ ] **Step 2: Verifikasi kompilasi**

Run: `cd frontend && npx tsc -b`
Expected: 0 error.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/transactionService.ts
git commit -m "feat(tx): frontend service changeItemVariant (REV 2.14)"
```

---

## Task 5: Frontend — `VariantPickerModal` pre-fill (`initialItem` + `confirmLabel`)

**Files:**
- Modify: `frontend/src/components/VariantPickerModal.tsx`

- [ ] **Step 1: Tambah import `TransactionItem` ke type import (baris 26)**

Ubah:

```ts
import type { Menu, MenuVariant } from '@/types'
```

menjadi:

```ts
import type { Menu, MenuVariant, TransactionItem } from '@/types'
```

- [ ] **Step 2: Tambah props di `Props` interface (baris 50-54)**

Ubah interface `Props` menjadi:

```ts
interface Props {
  menu: Menu
  onConfirm: (result: VariantPickResult) => void
  onClose: () => void
  /** REV 2.14: item tersimpan yang sedang diedit → seed pilihan awal (pre-fill). */
  initialItem?: TransactionItem
  /** REV 2.14: label tombol confirm. Default "Tambah ke Pesanan"; edit pakai "Simpan Perubahan". */
  confirmLabel?: string
}
```

- [ ] **Step 3: Teruskan props melalui komponen `VariantPickerModal` → `PickerBody`**

Ubah signature `VariantPickerModal` (baris 65) menjadi:

```ts
export default function VariantPickerModal({ menu, onConfirm, onClose, initialItem, confirmLabel }: Props) {
```

Lalu di body, ubah pemanggilan `PickerBody` (baris 99) menjadi:

```tsx
        <PickerBody menu={resolved} onConfirm={onConfirm} onClose={onClose} initialItem={initialItem} confirmLabel={confirmLabel} />
```

- [ ] **Step 4: Teruskan props di `PickerBody`**

Ubah signature + isi `PickerBody` (baris 112-150) menjadi:

```tsx
function PickerBody({
  menu,
  onConfirm,
  onClose,
  initialItem,
  confirmLabel,
}: {
  menu: Menu
  onConfirm: (result: VariantPickResult) => void
  onClose: () => void
  initialItem?: TransactionItem
  confirmLabel?: string
}) {
  if (menu.kind === 'variant') {
    return <VariantPicker menu={menu} onConfirm={onConfirm} initialItem={initialItem} confirmLabel={confirmLabel} />
  }
  if (menu.kind === 'paket') {
    return <PaketPicker menu={menu} onConfirm={onConfirm} initialItem={initialItem} confirmLabel={confirmLabel} />
  }
  // simple - jarang dibuka. Confirm langsung.
  return (
    <div className="space-y-4">
      <p className="text-body-sm text-neutral-600">
        Menu ini tidak punya pilihan tambahan.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="md" fullWidth onClick={onClose}>
          Batal
        </Button>
        <Button
          variant="primary"
          size="md"
          fullWidth
          onClick={() =>
            onConfirm({ menuId: menu.id, unitPrice: menu.price, displayLabel: menu.name })
          }
        >
          {confirmLabel ?? 'Tambah ke Pesanan'}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: `VariantPicker` — seed selection dari `initialItem` + pakai `confirmLabel`**

Ubah signature `VariantPicker` (baris 200-206) menjadi:

```tsx
function VariantPicker({
  menu,
  onConfirm,
  initialItem,
  confirmLabel,
}: {
  menu: Menu
  onConfirm: (result: VariantPickResult) => void
  initialItem?: TransactionItem
  confirmLabel?: string
}) {
```

Ganti baris `const [selection, setSelection] = useState<Record<number, number>>({})` (baris 218) dengan blok seed + state:

```tsx
  // REV 2.14: pre-fill dari item tersimpan. Grup affectsVariant diisi dari
  // variant.optionIds; grup free-preference dari selections isPreference=true
  // (cocokkan nama grup + label opsi). Dihitung sekali (mount).
  const initialSelection = useMemo<Record<number, number>>(() => {
    const sel: Record<number, number> = {}
    if (!initialItem) return sel
    const optionToGroup = new Map<number, number>()
    for (const g of groups) for (const o of g.options) optionToGroup.set(o.id, g.id)
    const v = variants.find((vr) => vr.id === initialItem.variantId)
    if (v) {
      for (const oid of v.optionIds) {
        const gid = optionToGroup.get(oid)
        if (gid !== undefined) sel[gid] = oid
      }
    }
    for (const s of initialItem.selections ?? []) {
      if (!s.isPreference) continue
      const g = groups.find((gr) => gr.name === s.groupOrSlotLabel)
      if (!g) continue
      const o = g.options.find((op) => op.label === s.chosenLabel)
      if (o) sel[g.id] = o.id
    }
    return sel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // selection: { groupId -> optionId }
  const [selection, setSelection] = useState<Record<number, number>>(initialSelection)
```

Ganti label tombol confirm `VariantPicker` (baris 309 `Tambah ke Pesanan`) menjadi:

```tsx
        {confirmLabel ?? 'Tambah ke Pesanan'}
```

- [ ] **Step 6: `PaketPicker` — seed selection + subPicks dari `initialItem` + `confirmLabel`**

Ubah signature `PaketPicker` (baris 319-325) menjadi:

```tsx
function PaketPicker({
  menu,
  onConfirm,
  initialItem,
  confirmLabel,
}: {
  menu: Menu
  onConfirm: (result: VariantPickResult) => void
  initialItem?: TransactionItem
  confirmLabel?: string
}) {
```

Ganti dua deklarasi state (baris 334-338, `selection` + `subPicks`) dengan blok seed + state. Letakkan SETELAH `const choiceComponents = components.filter((c) => c.kind === 'choice')` agar `choiceComponents` tersedia:

```tsx
  // REV 2.14: pre-fill dari item tersimpan. Untuk tiap slot choice, cocokkan
  // selection tersimpan (label slot + label opsi) → set opsi terpilih; seed
  // subPicks dari targetVariantId bila ada (caption varian best-effort = chosenLabel).
  const initialPaketState = useMemo(() => {
    const sel: Record<number, number> = {}
    const subs: Record<number, { variantId: number; variantLabel: string }> = {}
    for (const s of initialItem?.selections ?? []) {
      if (s.isPreference) continue
      const comp = choiceComponents.find((c) => c.label === s.groupOrSlotLabel)
      if (!comp) continue
      const opt =
        comp.choiceOptions.find((o) => o.label === s.chosenLabel) ??
        comp.choiceOptions.find((o) =>
          s.targetVariantId != null
            ? o.targetVariantId === s.targetVariantId
            : o.targetMenuId === s.targetMenuId,
        )
      if (!opt) continue
      sel[comp.id] = opt.id
      if (s.targetVariantId != null) {
        subs[comp.id] = { variantId: s.targetVariantId, variantLabel: s.chosenLabel }
      }
    }
    return { sel, subs }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // selection per choice slot: { componentId -> optionId }
  const [selection, setSelection] = useState<Record<number, number>>(initialPaketState.sel)
  // sub-variant pick per slot (kalau opsi target adalah menu varian): { componentId -> {variantId, variantLabel} }
  const [subPicks, setSubPicks] = useState<
    Record<number, { variantId: number; variantLabel: string }>
  >(initialPaketState.subs)
```

Ganti label tombol confirm `PaketPicker` (baris 480 `Tambah ke Pesanan`) menjadi:

```tsx
        {confirmLabel ?? 'Tambah ke Pesanan'}
```

- [ ] **Step 7: Verifikasi kompilasi + lint**

Run: `cd frontend && npx tsc -b && npm run lint`
Expected: 0 error.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/VariantPickerModal.tsx
git commit -m "feat(pos): VariantPickerModal pre-fill initialItem + confirmLabel (REV 2.14)"
```

---

## Task 6: Frontend — `ActiveOrdersView` tombol "Ubah varian"

**Files:**
- Modify: `frontend/src/components/ActiveOrdersView.tsx`

- [ ] **Step 1: Tambah ikon `Replace` ke import lucide (baris 10)**

Ubah:

```ts
import { ClipboardList, Trash2, Minus, Plus, Pencil, Check, Receipt } from 'lucide-react'
```

menjadi:

```ts
import { ClipboardList, Trash2, Minus, Plus, Pencil, Check, Receipt, Replace } from 'lucide-react'
```

- [ ] **Step 2: Tambah prop `onEditVariant` di `Props` (setelah `onUpdateNotes`, baris 22)**

```ts
  /// REV 2.14: callback ubah varian/paket item. POSPage buka VariantPickerModal pre-filled.
  onEditVariant?: (txId: number, itemId: number) => void
```

- [ ] **Step 3: Teruskan `onEditVariant` di komponen `ActiveOrdersView` (baris 42-71)**

Tambah `onEditVariant` ke destructuring props + ke `<PesananGroup>`:

```tsx
export default function ActiveOrdersView({
  orders,
  onDeleteItem,
  onUpdateQty,
  onUpdateNotes,
  onEditVariant,
  onPayOrder,
  canPay,
  isDeleting,
  isUpdating,
  isSubmitting,
}: Props) {
  return (
    <div className="space-y-3">
      {orders.map((order, idx) => (
        <PesananGroup
          key={order.id}
          order={order}
          index={idx + 1}
          onDeleteItem={onDeleteItem}
          onUpdateQty={onUpdateQty}
          onUpdateNotes={onUpdateNotes}
          onEditVariant={onEditVariant}
          onPayOrder={onPayOrder}
          canPay={canPay}
          isDeleting={isDeleting}
          isUpdating={isUpdating}
          isSubmitting={isSubmitting}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Teruskan `onEditVariant` di `PesananGroup` (baris 74-101)**

Tambah `onEditVariant` ke param destructuring + tipe `PesananGroup`, dan ke `canEdit`:

```tsx
function PesananGroup({
  order,
  index,
  onDeleteItem,
  onUpdateQty,
  onUpdateNotes,
  onEditVariant,
  onPayOrder,
  canPay,
  isDeleting,
  isUpdating,
  isSubmitting,
}: {
  order: Transaction
  index: number
  onDeleteItem?: (txId: number, itemId: number, itemLabel: string) => void
  onUpdateQty?: (txId: number, itemId: number, newQty: number) => void
  onUpdateNotes?: (txId: number, itemId: number, newNotes: string) => void
  onEditVariant?: (txId: number, itemId: number) => void
  onPayOrder?: (tx: Transaction) => void
  canPay?: boolean
  isDeleting?: boolean
  isUpdating?: boolean
  isSubmitting?: boolean
}) {
  const time = TIME_FMT.format(new Date(order.createdAt))
  const orderSubtotal = order.items.reduce((s, it) => s + it.subtotal, 0)
  const [editing, setEditing] = useState(false)
  // Edit hanya bisa dilakukan kalau handler tersedia (parent pass-in)
  const canEdit = !!(onDeleteItem || onUpdateQty || onUpdateNotes || onEditVariant)
```

- [ ] **Step 5: Teruskan `onEditVariant` ke `PesananItem` (baris 145-164)**

Ubah pemanggilan `<PesananItem>` agar menambahkan prop `onEditVariant` (binding txId/itemId):

```tsx
            <PesananItem
              item={item}
              editing={editing}
              onDelete={
                onDeleteItem
                  ? () => onDeleteItem(order.id, item.id, item.menuName)
                  : undefined
              }
              onUpdateQty={
                onUpdateQty ? (newQty) => onUpdateQty(order.id, item.id, newQty) : undefined
              }
              onUpdateNotes={
                onUpdateNotes ? (newNotes) => onUpdateNotes(order.id, item.id, newNotes) : undefined
              }
              onEditVariant={
                onEditVariant ? () => onEditVariant(order.id, item.id) : undefined
              }
              isDeleting={isDeleting}
              isUpdating={isUpdating}
            />
```

- [ ] **Step 6: `PesananItem` — terima prop + render tombol di bawah chips (baris 196-214)**

Ubah signature `PesananItem` untuk menambah `onEditVariant`:

```tsx
function PesananItem({
  item,
  editing,
  onDelete,
  onUpdateQty,
  onUpdateNotes,
  onEditVariant,
  isDeleting,
  isUpdating,
}: {
  item: TransactionItem
  /// REV 2.4: edit mode toggle dari parent PesananGroup. Kalau false, render
  /// read-only ringkas (UI lama). Kalau true, render qty controls + delete + notes edit.
  editing: boolean
  onDelete?: () => void
  onUpdateQty?: (newQty: number) => void
  onUpdateNotes?: (newNotes: string) => void
  onEditVariant?: () => void
  isDeleting?: boolean
  isUpdating?: boolean
}) {
  const [editingNotes, setEditingNotes] = useState(false)
  const busy = isDeleting || isUpdating
  // REV 2.14: item punya sesuatu untuk diubah variannya = menu varian (variantId)
  // ATAU paket dengan slot choice (selections non-preference). Menu simpel → tak ada.
  const canEditVariant =
    item.variantId != null || (item.selections?.some((s) => !s.isPreference) ?? false)
```

- [ ] **Step 7: Sisipkan tombol "Ubah varian" tepat setelah blok chips selections**

Di `PesananItem`, blok chips berakhir di baris 258 (penutup `)}` dari ekspresi `item.selections ... : ( ... )`). Sisipkan TEPAT SETELAH baris 258 (sebelum komentar `{/* Notes: ... */}`):

```tsx
          {/* REV 2.14: ubah varian/paket - hanya saat edit mode + item punya varian/paket */}
          {editing && onEditVariant && canEditVariant && (
            <button
              type="button"
              onClick={onEditVariant}
              disabled={busy}
              className="text-caption text-primary-700 hover:text-primary-900 mt-1.5 inline-flex items-center gap-1 disabled:opacity-50"
            >
              <Replace className="w-3 h-3" />
              Ubah varian
            </button>
          )}
```

- [ ] **Step 8: Verifikasi kompilasi + lint**

Run: `cd frontend && npx tsc -b && npm run lint`
Expected: 0 error.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/ActiveOrdersView.tsx
git commit -m "feat(pos): tombol Ubah varian di edit mode ActiveOrdersView (REV 2.14)"
```

---

## Task 7: Frontend — `CartPanel` pass-through `onEditVariant`

**Files:**
- Modify: `frontend/src/components/CartPanel.tsx`

- [ ] **Step 1: Tambah prop di interface Props (dekat `onUpdateItemNotes`, baris ~69)**

Tambah baris berikut di interface props `CartPanel` setelah `onUpdateItemNotes`:

```ts
  /// REV 2.14: ubah varian/paket item Pesanan terbuka (diteruskan ke ActiveOrdersView).
  onEditVariant?: (txId: number, itemId: number) => void
```

- [ ] **Step 2: Tambah ke destructuring props (dekat `onUpdateItemNotes`, baris ~93)**

Tambah `onEditVariant,` ke daftar destructuring parameter komponen `CartPanel`.

- [ ] **Step 3: Teruskan ke `<ActiveOrdersView>` (baris ~222-227)**

Tambah prop `onEditVariant={onEditVariant}` pada elemen `<ActiveOrdersView ... />`:

```tsx
            <ActiveOrdersView
              orders={activeOrders}
              onDeleteItem={onDeleteItem}
              onUpdateQty={onUpdateItemQty}
              onUpdateNotes={onUpdateItemNotes}
              onEditVariant={onEditVariant}
              onPayOrder={onPayOrder}
```

> Catatan: pertahankan prop lain yang sudah ada pada elemen ini apa adanya; hanya menambah satu baris `onEditVariant`.

- [ ] **Step 4: Verifikasi kompilasi + lint**

Run: `cd frontend && npx tsc -b && npm run lint`
Expected: 0 error.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CartPanel.tsx
git commit -m "feat(pos): CartPanel pass-through onEditVariant (REV 2.14)"
```

---

## Task 8: Frontend — `POSPage` wiring (state + mutation + modal edit)

**Files:**
- Modify: `frontend/src/pages/POSPage.tsx`

- [ ] **Step 1: Tambah state `variantEdit` setelah `paymentCandidates` (baris 65)**

```tsx
  // REV 2.14: konteks edit varian item Pesanan terbuka. Set oleh handleEditVariant,
  // mengontrol VariantPickerModal kedua (mode edit, pre-filled dari item tersimpan).
  const [variantEdit, setVariantEdit] = useState<{
    txId: number
    itemId: number
    menu: Menu
    item: TransactionItem
  } | null>(null)
```

> `Menu` dan `TransactionItem` sudah ter-import di POSPage (lihat baris 37 `import type { Menu, Shift, Transaction, UserRole } from '@/types'`). Tambahkan `TransactionItem` ke import itu:

```ts
import type { Menu, Shift, Transaction, TransactionItem, UserRole } from '@/types'
```

- [ ] **Step 2: Tambah `changeVariantMutation` setelah `updateItemMutation` (sekitar baris 205)**

```tsx
  // REV 2.14: ubah varian/paket item Pesanan terbuka. Backend reverse stok lama →
  // apply stok baru + update harga/cost/subtotal. Invalidate set sama updateItemMutation.
  const changeVariantMutation = useMutation({
    mutationFn: (input: {
      txId: number
      itemId: number
      variantId?: number | null
      paketChoices?: Record<
        string,
        { targetMenuId: number; variantId?: number | null; chosenLabel: string }
      >
      preferences?: { groupLabel: string; chosenLabel: string }[]
    }) =>
      transactionService.changeItemVariant(input.txId, input.itemId, {
        variantId: input.variantId,
        paketChoices: input.paketChoices,
        preferences: input.preferences,
      }),
    onSuccess: () => {
      toast.success('Varian item diperbarui')
      qc.invalidateQueries({ queryKey: ['transactions', 'byTable', cart.tableNumber] })
      qc.invalidateQueries({ queryKey: ['transactions', 'openTakeaway'] })
      qc.invalidateQueries({ queryKey: ['menus', 'pos'] })
      qc.invalidateQueries({ queryKey: ['transactions', 'open-today'] })
      setVariantEdit(null)
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal mengubah varian'),
  })
```

- [ ] **Step 3: Tambah handler `handleEditVariant` setelah `handleUpdateItemNotes` (sekitar baris 358)**

```tsx
  // REV 2.14: buka VariantPickerModal pre-filled untuk item Pesanan terbuka.
  // Cari Tx + item dari activeOrders (dine-in), dan Menu dari list POS.
  const handleEditVariant = (txId: number, itemId: number) => {
    const order = activeOrders.find((o) => o.id === txId)
    const item = order?.items.find((i) => i.id === itemId)
    if (!item) {
      toast.error('Item tidak ditemukan')
      return
    }
    const menu = menus.find((m) => m.id === item.menuId)
    if (!menu) {
      toast.error('Menu untuk item ini tidak tersedia (mungkin nonaktif)')
      return
    }
    setVariantEdit({ txId, itemId, menu, item })
  }
```

- [ ] **Step 4: Teruskan `onEditVariant` ke kedua `<CartPanel>` (desktop baris ~431-450 dan mobile baris ~477-496)**

Pada KEDUA elemen `<CartPanel ... />`, tambahkan satu baris prop (mis. tepat setelah `onUpdateItemNotes={handleUpdateItemNotes}`):

```tsx
            onEditVariant={handleEditVariant}
```

- [ ] **Step 5: Render `VariantPickerModal` mode edit setelah modal `pickerMenu` (sekitar baris 507)**

Sisipkan tepat setelah blok `{pickerMenu && ( ... )}`:

```tsx
      {/* REV 2.14: modal edit varian/paket item Pesanan terbuka (pre-filled). */}
      {variantEdit && (
        <VariantPickerModal
          menu={variantEdit.menu}
          initialItem={variantEdit.item}
          confirmLabel="Simpan Perubahan"
          onConfirm={(result) =>
            changeVariantMutation.mutate({
              txId: variantEdit.txId,
              itemId: variantEdit.itemId,
              variantId: result.variantId ?? null,
              paketChoices: result.paketChoices ?? undefined,
              preferences: result.preferences ?? undefined,
            })
          }
          onClose={() => setVariantEdit(null)}
        />
      )}
```

- [ ] **Step 6: Verifikasi kompilasi + lint + build**

Run: `cd frontend && npx tsc -b && npm run lint && npm run build`
Expected: 0 error; `vite build` SUCCESS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/POSPage.tsx
git commit -m "feat(pos): POSPage wiring ubah varian item Pesanan terbuka (REV 2.14)"
```

---

## Task 9: Verifikasi penuh + manual e2e (verification-before-completion)

**Files:** (tidak ada perubahan; hanya verifikasi)

- [ ] **Step 1: Backend — tsc + semua smoke transaksi**

Run:
```bash
cd backend && npx tsc --noEmit \
 && npx tsx --env-file=.env.test scripts/smoke-tx-change-variant.ts \
 && npx tsx --env-file=.env.test scripts/smoke-tx-variants.ts \
 && npx tsx --env-file=.env.test scripts/smoke-tx.ts
```
Expected: tsc 0 error; ketiga smoke `FAIL=0`, exit 0.

- [ ] **Step 2: Frontend — tsc + lint + build**

Run: `cd frontend && npx tsc -b && npm run lint && npm run build`
Expected: 0 error; build SUCCESS.

- [ ] **Step 3: Manual e2e (Playwright/browser) — `npm run dev`, login kasir**

Skenario:
1. Buka kasir (buka shift bila perlu), buka meja kosong, buat Pesanan #1 berisi 1 menu varian (mis. Ayam Bakar pilih Dada) + 1 paket dengan slot choice.
2. Di view-mode meja, tap **"Ubah"** pada Pesanan #1 → tap **"Ubah varian"** pada item Ayam Bakar.
3. Verifikasi modal terbuka **dengan pilihan lama ter-highlight** (Dada). Ganti ke **Paha** → "Simpan Perubahan".
4. Verifikasi chip + harga item + Subtotal Pesanan berubah sesuai harga Paha; toast "Varian item diperbarui".
5. Ulangi untuk item **paket** (ganti slot Lauk) → verifikasi chip slot berubah.
6. Buka tab Stok / cek `portion_movements`: stok varian lama bertambah kembali, varian baru berkurang (audit `ganti varian: lepas/pasang`).

Expected: semua langkah sesuai; tidak ada error konsol.

- [ ] **Step 4: Code review (requesting-code-review)**

Jalankan review pada diff branch sebelum merge (gunakan skill `superpowers:requesting-code-review` / `code-review`).

- [ ] **Step 5: Update dokumentasi status**

Tambah baris status REV 2.14 (fitur "Ubah varian item Pesanan terbuka") di `CLAUDE.md` tabel status + tulis memory continuity (`project_*` + MEMORY.md pointer).

- [ ] **Step 6: Finishing branch (finishing-a-development-branch)**

Pakai skill `superpowers:finishing-a-development-branch` untuk memutuskan merge `--no-ff` ke `main` + (opsional) push + deploy prod.

---

## Catatan eksekusi

- Worktree/branch sudah dibuat (`feat/edit-item-variant-open-order`).
- DB test: smoke memakai `--env-file=.env.test` (DB `*_test`). Pastikan `.env.test` ada + seed minimal (ada 1 user kasir) sebelum Task 2.
- Pertahankan permission matrix REV 2.3: endpoint baru terbuka semua role authenticated (sejajar PATCH/DELETE item lain) — **tidak** mengubah gate pembayaran/shift.
