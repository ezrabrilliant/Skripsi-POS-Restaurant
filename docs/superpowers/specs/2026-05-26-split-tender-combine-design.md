# Split Tender + Combine Tables Design (REV 2.5)

**Tanggal**: 2026-05-26
**Status**: Approved, implementation in progress
**Plan file**: `~/.claude/plans/saya-mau-brainstorm-tentang-glowing-orbit.md`
**Pattern reference**: [docs/knowledge/SPLIT-MERGE-PATTERNS.md](../../knowledge/SPLIT-MERGE-PATTERNS.md)

---

## Context

REV 2.3 Phase 4b + REV 2.4 multi-pesanan implement split bill (visual grouping via `TransactionItem.partyId`) di HistoryPage row action, dan merge bill intra-table (auto saat bayar Tx multi-ronde). Per feedback user 2026-05-26: kedua fitur **generic, tidak pernah dipakai operasional resto**.

**Penyebab:**
1. Lokasi salah — split di HistoryPage = setelah customer pulang. Padahal momen yang relevan adalah saat pembayaran.
2. Split bill tidak komplit — backend cuma assign `partyId` ke item, payment tetap single per Tx. Footer modal sendiri admit "visual grouping saja".
3. Combine antar meja tidak ada — yang ada cuma merge multi-Tx dalam meja yang sama.
4. Schema tidak support split tender — `Tx.paymentMethod` & `paymentBank` singular field.

**Goal REV 2.5:**
- Replace split bill multi-party dengan **Split Tender** (1 customer multi-metode).
- Tambah **Combine Tables** dengan UI affordance natural di TablesPage & PaymentModal.
- Pindahkan flow dari HistoryPage ke PaymentModal.
- Cleanup: drop `partyId`, `splitTransaction`, `SplitBillModal`, `MergeBillModal` row action.

---

## Scope Decisions

### Adopsi

| Feature | Status |
|---|---|
| Split Tender (1 customer multi-method) | ✅ Adopt baru |
| Combine Tables dari TablesPage | ✅ Adopt baru |
| Combine Tables dari PaymentModal | ✅ Adopt baru |
| Audit badge di HistoryPage | ✅ Adopt baru |
| Add Round intra-table (REV 2.4) | ✅ Sudah ada — unchanged |
| Permission matrix REV 2.3 | ✅ Tetap |

### Drop

| Feature | Alasan |
|---|---|
| Split bill multi-party (Even / By Item) | Rare di Indo (1 orang treat / pakai Splitwise) |
| `TransactionItem.partyId` field | Tidak digunakan setelah drop split multi-party |
| `splitTransaction` endpoint | Idem |
| `SplitBillModal.tsx` component | Idem |
| `MergeBillModal.tsx` di HistoryPage | Lokasi salah — pindah ke PaymentModal |
| Move items antar meja | Workaround: void + re-input |

---

## Schema Design

### New: TransactionPayment

```prisma
model TransactionPayment {
  id            Int           @id @default(autoincrement())
  transactionId Int
  method        PaymentMethod
  bank          String?       @db.VarChar(50)
  amount        Decimal       @db.Decimal(12, 2)
  recordedAt    DateTime      @default(now())
  recordedById  Int

  transaction Transaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  recordedBy  User        @relation(fields: [recordedById], references: [id])

  @@index([transactionId])
  @@map("transaction_payments")
}
```

### Modified entities

```prisma
model Transaction {
  // ... existing fields ...
  payments TransactionPayment[]
  // REMOVED: paymentMethod, paymentBank
}

model TransactionItem {
  // ... existing fields ...
  // REMOVED: partyId
}

model User {
  // ... existing fields ...
  recordedPayments TransactionPayment[]
}
```

### Migration strategy

`prisma db push --force-reset` + `npm run db:seed`. Aman karena belum ada data produksi (masih test data).

### Query refactor — settlement & dashboard byMethod

```ts
// SEBELUM (paymentMethod di Tx):
const totals = await prisma.transaction.groupBy({
  by: ['paymentMethod'],
  where: { shiftId, status: 'paid', mergedIntoId: null },
  _sum: { total: true },
});

// SESUDAH (via TransactionPayment):
const totals = await prisma.transactionPayment.groupBy({
  by: ['method'],
  where: {
    transaction: {
      shiftId,
      status: 'paid',
      mergedIntoId: null,
    },
  },
  _sum: { amount: true },
});
```

---

## API Design

### New: POST `/transactions/:id/payments`

**Permission**: owner + cashier

**Body schema (Zod)**:
```ts
addPaymentSchema = z.object({
  method: z.enum(['cash', 'edc', 'qris', 'gojek', 'grab', 'transfer']),
  bank: z.string().max(50).optional(),
  amount: z.number().positive(),
  discountAmount: z.number().nonnegative().optional(),
}).superRefine((data, ctx) => {
  if ((data.method === 'edc' || data.method === 'transfer') && !data.bank) {
    ctx.addIssue({ code: 'custom', message: 'Bank wajib untuk EDC/transfer' });
  }
  if ((data.method !== 'edc' && data.method !== 'transfer') && data.bank) {
    ctx.addIssue({ code: 'custom', message: 'Bank tidak boleh diisi untuk method ini' });
  }
});
```

**Service logic** (`addPayment(txId, body, userId)`):
1. Fetch Tx + existing payments. Validate:
   - Tx.status === 'open' (else 400 "Sudah lunas atau void")
   - Tx.mergedIntoId === null (else 400 "Tx sudah di-merge, bayar via destination")
   - `body.discountAmount` valid HANYA kalau `payments.length === 0` (first slice)
2. Compute `aggregateSubtotal` = Tx.subtotal + sum(mergedFrom Tx subtotals)
3. Compute `effectiveTotal` = (aggregateSubtotal - effectiveDiscount) × 1.10
4. Compute `remaining` = effectiveTotal - sum(existing payments.amount)
5. Validate: `body.amount <= remaining` (else 400 "Melebihi sisa tagihan")
6. Transactional:
   - Kalau first slice + discountAmount: update Tx.discountAmount, recompute taxAmount + total
   - Insert TransactionPayment record
   - Cek sum payments termasuk yang baru insert
   - Kalau sum >= total: set Tx.status='paid', paidAt=now, cascade ke mergedFrom (status=paid, total=0)
7. Return updated TransactionView

### New: DELETE `/transactions/:id/payments/:paymentId`

**Permission**: owner + cashier

**Service logic** (`removePayment(txId, paymentId)`):
1. Fetch Tx + target payment record
2. Validate:
   - Tx.status === 'open' (else 400 "Tidak bisa hapus, sudah lunas atau void")
   - Payment belongs to txId (else 404)
3. Delete payment record
4. Return updated TransactionView

### Removed

- `PUT /transactions/:id/split` (splitTransaction endpoint)
- `POST /transactions/:id/payment` (paid old endpoint — replaced by `/payments`)

### Unchanged

- `POST /transactions/merge` (mergeBills) — backend logic sama, cuma UI trigger baru dari TablesPage + PaymentModal

---

## UX Flow

### Flow A: Split Tender di PaymentModal

**Default (single payment mode):**
- PaymentModal sama seperti sekarang. Klik method → bank picker kalau perlu → discount input → "Bayar".
- Tombol baru di body: "⌕ Gabung Meja Lain" + toggle "Bayar Sebagian: OFF".

**Toggle "Bayar Sebagian" ON (split tender mode):**
- Tampilan berubah: Total / Sudah bayar / Sisa indicator di atas.
- List "Riwayat pembayaran" (initially empty), per slice: amount + method + bank chip + tombol [hapus].
- Form "Tambah pembayaran": numpad amount (default = sisa) + method buttons + bank picker (kalau EDC/transfer) + tombol [+ Tambah Pembayaran].
- Setelah submit slice: insert TxPayment, refresh sisa indicator.
- Saat sisa = 0: tombol [✓ Selesai Bayar] muncul.
- Discount input: visible & active hanya saat `payments.length === 0` (first slice). Setelah slice pertama added, discount field disabled (lock visual).

### Flow B: Combine Tables dari TablesPage

```
Grid 9 meja. Tap "⋮" di meja occupied (gate: owner+kasir).
Dropdown:
  [📝 Buka POS] (default click)
  [⌕ Gabung ke meja lain] (action baru)

Click "Gabung ke meja lain" → CombineTableModal.
Body: list meja occupied lain (filter same shift, exclude self).
Click target meja → preview "Total combined Rp X. Meja sumber jadi kosong."
Confirm → mergeBills(sourceIds=[all open Tx source meja], targetId=oldest Tx target meja).
Toast → grid refresh.
```

### Flow C: Combine Tables dari PaymentModal

```
Kasir di POSPage meja 3, klik Bayar → PaymentModal opens.
Klik "⌕ Gabung Meja Lain" → CombineTableModal overlay.
Pilih source meja → confirm → merge ke meja 3 (current Tx).
PaymentModal subtotal refresh dengan combined total.
Lanjut bayar normal.
```

**Asymmetri:** Flow B kasir trigger dari source meja, Flow C kasir trigger dari destination meja. Logika backend identik.

### Flow D: HistoryPage cleanup

```
SEBELUM:
┌─ Tx #123 ─ paid ─ Rp 220k ⋮ Split Merge Void ─┐
│ ... items ...                                  │
└────────────────────────────────────────────────┘

SESUDAH:
┌─ Tx #123 ─ paid ─ Rp 220k ⋮ Void ─────┐
│ 🔗 Gabungan dari: #121, #122 (klik)   │ ← badge audit
│ ... items ...                          │
└────────────────────────────────────────┘

┌─ Tx #121 ─ merged ─ Rp 0 ─ (no menu) ──┐
│ 🔗 Tergabung ke → Tx #123 (klik)       │
│ ... items ...                           │
└─────────────────────────────────────────┘
```

Badge clickable: `useRef` + `scrollIntoView` ke Tx target.

---

## File Changes

### Backend

| File | Aksi |
|---|---|
| `backend/prisma/schema.prisma` | Add TransactionPayment + relations. Drop paymentMethod/paymentBank/partyId. |
| `backend/prisma/seed.ts` | Re-seed setelah force-reset. |
| `backend/src/modules/transactions/transactions.service.ts` | Remove splitTransaction. Refactor payTransaction → addPayment + add removePayment. mergeBills unchanged. |
| `backend/src/modules/transactions/transactions.schema.ts` | Drop splitSchema, paySchema. Add addPaymentSchema (superRefine bank + discount lock rules). |
| `backend/src/modules/transactions/transactions.controller.ts` | Drop split. Refactor pay → addPayment. Add removePayment. |
| `backend/src/modules/transactions/transactions.routes.ts` | Drop PUT /:id/split. Replace POST /:id/payment → POST /:id/payments. Add DELETE /:id/payments/:paymentId. |
| `backend/src/modules/settlements/settlements.service.ts` | Refactor preview() + create() compute via TxPayment groupBy. |
| `backend/src/modules/dashboard/dashboard.service.ts` | Refactor getOwnerDashboard + getCashierDashboard revenue queries via TxPayment. |

### Frontend

| File | Aksi |
|---|---|
| `frontend/src/types/index.ts` | Add TransactionPayment. Update Transaction (drop pm/pb, add payments[]). Drop partyId. |
| `frontend/src/services/transactionService.ts` | Remove split. Replace pay → addPayment + removePayment. |
| `frontend/src/components/PaymentModal.tsx` | Big refactor: split tender mode + combine button. |
| `frontend/src/components/CombineTableModal.tsx` | NEW component. |
| `frontend/src/pages/TablesPage.tsx` | Add "⋮" dropdown menu per occupied meja (owner+kasir gate). |
| `frontend/src/pages/POSPage.tsx` | Refactor handlePaymentConfirm orchestration. |
| `frontend/src/pages/HistoryPage.tsx` | Drop Split/Merge row actions. Add audit badges. |
| `frontend/src/pages/SettlementPage.tsx` | Minor adjust kalau response shape berubah. |
| `frontend/src/pages/OwnerDashboard.tsx` | Minor adjust idem. |
| `frontend/src/components/SplitBillModal.tsx` | DELETE. |
| `frontend/src/components/MergeBillModal.tsx` | DELETE. |

### Tests

| File | Aksi |
|---|---|
| `backend/scripts/smoke-phase-4b.sh` | DELETE (obsolete). |
| `backend/scripts/smoke-split-tender-combine.sh` | NEW: 11 skenario sesuai verification plan. |

### Documentation

| File | Aksi |
|---|---|
| `docs/knowledge/SPLIT-MERGE-PATTERNS.md` | NEW (already written). |
| `docs/operasional-resto.md` | Bump REV 2.5: payment section + meja combine. |
| `docs/knowledge/ERD.md` | Add TransactionPayment (14 → 15 entitas). Drop partyId + pm/pb. |
| `docs/DATA-DICTIONARY.md` | Update entity count + add TransactionPayment definition. |
| `CLAUDE.md` | Add REV 2.5 status row. |

---

## Verification Plan

### Backend smoke test

11 skenario di `backend/scripts/smoke-split-tender-combine.sh` — open shift, order 2 meja, combine, addPayment partial, addPayment final (trigger paid + cascade), reject overpay, reject remove after paid, verify settlement preview, verify dashboard.

### Frontend manual e2e (browser)

13 langkah via `npm run dev` http://localhost:3000 — login Jason, buka shift, order 2 meja, combine via TablesPage menu, payment split tender via PaymentModal, verify badge di HistoryPage, verify settlement preview.

### Permission verification

- Login Amel (waiter): combine menu HIDDEN, Bayar HIDDEN.
- Login Owner: semua available.

### Type check + build

- Backend: `npx tsc --noEmit` → 0 errors
- Frontend: `npx tsc -b && npm run build` → success
- Frontend: `npm run lint` → clean

### Edge cases combine

- Source meja multi-Tx → all source point mergedIntoId ke target.
- 3-way sequential (5→3, 7→3) → both cascade.
- Reject: combine already-merged Tx → 400.
- Reject: combine antar shift → 400.

---

## Tradeoffs & Notes

- **Destructive migration**: `db push --force-reset` hilangkan test data. Aman (belum produksi).
- **Cascade payment**: pattern existing dari REV 2.4 reused untuk multi-payment trigger.
- **Discount handling**: cuma valid di first slice. UX lock setelah slice pertama.
- **Receipt PDF**: out of scope REV 2.5. Multi-payment detail di receipt = iterasi berikutnya.
- **Badge clickable**: `useRef` + `scrollIntoView`. Filter HistoryPage harus support fetch Tx by id supaya target visible saat di-click.
- **Global audit referensi `paymentMethod`/`paymentBank`**: refactor semua tempat baca field tersebut sebelum drop kolom schema.
