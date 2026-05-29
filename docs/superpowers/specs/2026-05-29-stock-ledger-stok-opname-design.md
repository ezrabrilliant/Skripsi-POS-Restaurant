# Design Spec — Stock Ledger Integrity + Stok Opname UX (REV 2.8)

**Tanggal:** 2026-05-29
**Status:** Approved (brainstorming → plan disetujui user)
**Branch:** `feat/stock-ledger-rev28` (off `feat/backend-express` / REV 2.7)
**Plan eksekusi:** `~/.claude/plans/brain-storm-tentang-stok-federated-moth.md`

---

## 1. Problem Statement

Dua masalah yang saling terkait, digabung dalam satu pekerjaan karena yang kedua memanfaatkan perbaikan yang pertama.

### 1.1 Cacat desain log stok (referential integrity)

Tabel audit `portion_movements` dan `raw_material_movements` menautkan dokumen sumber **hanya sebagai teks bebas di kolom `note`**:

| Tabel | reason | Isi `note` (satu-satunya tautan) |
|---|---|---|
| `portion_movements` | `order` | `transactionId=1 via "Paha Ayam Bakar"` |
| `portion_movements` | `refundVoid` | `void transactionId=1 reverse "..."` / `Edit Tx 1 item 5 ...` |
| `raw_material_movements` | `purchase` | `Purchase id=5: +2 kg @ Rp...` |

Konsekuensi:

1. **Tidak bisa di-JOIN dengan andal.** Untuk menelusuri movement → transaksi/pembelian harus regex `note`, yang sudah punya ≥3 varian kalimat berbeda (order, void, edit, delete) — rapuh terhadap perubahan wording.
2. **Tidak ada integritas referensial.** `note` bisa menunjuk dokumen yang tak ada; DB tidak menjaga konsistensi.
3. **ERD & Data Dictionary skripsi kurang benar.** Relasi yang secara logis ada (movement "disebabkan oleh" sebuah transaksi/pembelian/item) tidak terwakili sebagai relasi.
4. **Hanya `delta` yang disimpan.** Level stok pada satu titik waktu harus direkonstruksi dengan menjumlahkan seluruh histori — log tidak *self-contained*.

### 1.2 Tampilan stok opname kurang

Halaman Stok (`StockPage.tsx`, tab `PortionStockTab` + `RawMaterialsTab`):

- Tidak ada timestamp "kapan terakhir di-stok" per item.
- Tidak ada filter (selain checkbox "yang rendah" di porsi, combobox kategori di raw).
- Tidak ada sort sama sekali (urutan selalu kategori→nama dari backend).
- Endpoint detail (`recentMovements`) sudah ada tetapi **tidak pernah dipakai UI**.

---

## 2. Design Decisions (hasil brainstorming)

| # | Keputusan | Alasan |
|---|---|---|
| D1 | **Ledger penuh** — tambah FK sumber + FK item-level + `qty_before`/`qty_after` di kedua tabel movement. | User memilih opsi paling benar; memperbaiki cacat normalisasi sekaligus memperkaya audit & drawer riwayat. |
| D2 | Migrasi **aditif** (kolom nullable + FK + index), zero data-loss. | Aman untuk DB dev & prod; FK baru tak memutus apa pun. |
| D3 | FK baru `onDelete: SetNull`. | `deleteTransactionItem` (REV 2.4) menghapus fisik baris item; Cascade akan ikut menghapus audit (salah). SetNull menjaga histori utuh (delta/before/after tetap), ref jadi null. |
| D4 | `qty_before`/`qty_after` **nullable**; baris baru selalu diisi kode, baris lama di-backfill best-effort. | Jujur soal data historis yang mungkin tak bisa direkonstruksi sempurna; tetap *self-contained* untuk seluruh data go-forward. |
| D5 | "Terakhir di-stok" = movement **manual** terbaru. Porsi: `reason IN (restockMorning, restockEmergency, manualAdjust)` (exclude `order`/`refundVoid`). Raw: semua reason (tak ada auto-decrement penjualan). | "Manual" = aktivitas restock/opname/penyesuaian, bukan penjualan otomatis. Untuk porsi `updatedAt` berubah tiap order → tak bermakna; movement-filtered lebih tepat. |
| D6 | Hitung `lastStockedAt` via **satu `groupBy(_max createdAt)`** per list call, bukan kolom denormalisasi. | Ditanggung index `@@index([menuId, createdAt])`; bebas drift; tanpa migrasi tambahan & tanpa mengubah write paths untuk ini. |
| D7 | Filter & sort **client-side**. | Dataset kecil (~25 porsi / ~13 raw) → instan tanpa refetch; merapikan kopling `lowStock`-refetch lama. |
| D8 | Filter "status opname hari ini" = ada aktivitas manual hari ini (bandingkan tanggal `lastStockedAt` ke hari ini WIB). | Opname porsi & mark-habis sama-sama `manualAdjust` → tak bisa dibedakan bersih tanpa enum baru; definisi "ada sentuhan manual hari ini" cukup & tanpa migrasi enum. |
| D9 | Drawer riwayat per item (tap baris) memanfaatkan endpoint detail + FK baru → tampilkan `qty_before → qty_after`, delta berwarna, alasan ID, **link "Transaksi #N"/"Pembelian #N"**, "oleh {nama}". | Endpoint sudah ada; FK membuat link sumber andal (bukan parse teks). |

---

## 3. Schema Design

### 3.1 `PortionMovement` (tambahan)
```prisma
transactionId     Int?  @map("transaction_id")
transactionItemId Int?  @map("transaction_item_id")
qtyBefore         Int?  @map("qty_before")
qtyAfter          Int?  @map("qty_after")

transaction     Transaction?     @relation(fields: [transactionId], references: [id], onDelete: SetNull)
transactionItem TransactionItem? @relation(fields: [transactionItemId], references: [id], onDelete: SetNull)
@@index([transactionId])
```
Back-relation `portionMovements PortionMovement[]` di `Transaction` & `TransactionItem`.

### 3.2 `RawMaterialMovement` (tambahan)
```prisma
purchaseId     Int?     @map("purchase_id")
purchaseItemId Int?     @map("purchase_item_id")
qtyBefore      Decimal? @map("qty_before") @db.Decimal(10, 2)
qtyAfter       Decimal? @map("qty_after")  @db.Decimal(10, 2)

purchase     Purchase?     @relation(fields: [purchaseId], references: [id], onDelete: SetNull)
purchaseItem PurchaseItem? @relation(fields: [purchaseItemId], references: [id], onDelete: SetNull)
@@index([purchaseId])
```
Back-relation `rawMaterialMovements RawMaterialMovement[]` di `Purchase` & `PurchaseItem`.

**Catatan relasi N:1:** satu `TransactionItem` paket dapat men-decrement beberapa `PortionStock` (loop `stockTargetMenuIds`) → menghasilkan beberapa `PortionMovement` yang berbagi `transactionItemId` sama. Sah dan bermakna.

---

## 4. Write Paths (Phase B)

`qty_before`/`qty_after` diturunkan **tanpa query ekstra**: hasil `portionStock.update({data:{...}})` mengembalikan nilai *after*; `before = after − delta`.

| File | Titik | Set |
|---|---|---|
| `transactions.service.ts` | create order (`persistItemsAndDecrement`) | `transactionId`, `transactionItemId` (tangkap `item.id`), before/after |
| | void reverse | `transactionId`, `transactionItemId`, before/after |
| | edit qty naik/turun | `transactionId`, `transactionItemId`, before/after |
| | hapus item | `transactionId` saja (item dihapus → itemId null), before/after |
| `purchases.service.ts` | submit purchase | `purchaseId`, `purchaseItemId` (tangkap `pItem.id`), before/after |
| `stocks/portion.service.ts` | restockMorning, emergencyIn, opname, markHabis | before/after (FK null) |
| `stocks/raw-materials.service.ts` | unit-change, opname, markHabis | before/after (FK null) |

`note` disederhanakan menjadi konteks manusiawi murni; linkage pindah ke FK.

---

## 5. Backfill (Phase A.3)

Script idempotent `backend/scripts/backfill-movement-ledger.ts`:

- **FK dari note** (regex bertingkat): porsi `transactionId=(\d+)`, `void transactionId=(\d+)`, `Edit Tx (\d+) item (\d+)`, `Edit Tx (\d+): hapus`; raw `Purchase id=(\d+)`.
- **qty_before/after**: per item, urut `(createdAt, id)`, jalan-MUNDUR dari stok sekarang (`after_terakhir = current; before = after − delta; after_sebelumnya = before; …`).
- Validasi Σdelta == current_qty; mismatch → warning, baris terdampak dibiarkan null (kemungkinan stok awal di-set tanpa movement). Baris seed "Opname buku" & tak-terparse → FK null (benar).

---

## 6. API / View Changes (Phase C–D)

- `PortionStockView` + `RawMaterialView`: + `lastStockedAt: string | null`.
- `PortionMovementView` + `RawMaterialMovementView`: + FK sumber + `qtyBefore` + `qtyAfter` + `userName`.
- List: `groupBy(_max createdAt)` → merge `lastStockedAt`; filter pindah client (Zod param lama dibiarkan; `includeInactive` raw tetap server-side).
- Detail: `include: { user: true }` + map field baru.
- Frontend types ikut; tambah label map reason Indonesian.

---

## 7. UI Design (Phase E)

- Helper `relativeTime` + `isSameLocalDate` (WIB lokal).
- Shared: `useStockListControls` (filter+sort generic), `StockFilterToolbar` (mobile-first, pola HistoryPage), `SortableHeader` (sort sebelum DataTable; DataTable tak punya sort bawaan), `StockHistorySheet` (`Sheet side="bottom"`).
- Kolom "Terakhir di-stok" (relative + absolut; "belum pernah" bila null).
- Tab wiring: tetap `refetchOnMount:'always'` (stale-cache penjualan/pembelian di luar query key).
- Modal restock/opname per tab **tidak** di-share (porsi kelipatan-5 vs raw scale_0_5/exact).

---

## 8. Edge Cases

- `lastStockedAt = null` → "belum pernah"; opname-status "belum"; sort lama→baru naik ke atas (intentional — item terabaikan paling perlu perhatian).
- Backfill mismatch → warning, tidak menggagalkan migrasi.
- delete item → order-movement lama `transactionItemId` null (SetNull), histori utuh.
- Timezone "hari ini" → device kasir WIB = `AppSetting.timezone`; dokumentasikan asumsi single-TZ; jangan banding substring UTC.

---

## 9. Rollout

1. Migrasi aditif LOCAL → backfill → verifikasi count + sample.
2. Implementasi B–E dengan verifikasi per-fase (Vitest, tsc, vite build, lint).
3. Manual e2e browser.
4. **Prod `monosuko.my.id`** (gabung runbook dengan REV 2.7 yang juga belum migrasi): backup → migrate aditif → jalankan backfill → verify.

## 10. Dampak Artefak Skripsi (Phase F)

- `schema.prisma` header comment (relasi count +4..6).
- `docs/knowledge/ERD.md`: relasi PortionMovement→Transaction/TransactionItem, RawMaterialMovement→Purchase/PurchaseItem.
- `docs/DATA-DICTIONARY.md`: kolom baru.
- `Skripsi.mdj` (StarUML ERD): edge relasi baru.
