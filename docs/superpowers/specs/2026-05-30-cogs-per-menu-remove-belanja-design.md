# REV 2.11 — COGS per Menu + Hapus Belanja/Vendor/Raw Materials

- **Tanggal**: 2026-05-30
- **Status**: Design (disetujui untuk lanjut ke plan)
- **Branch**: `feat/cogs-per-menu-rev211` (dari `main` `db8062c`, sesudah REV 2.10 ter-merge)
- **Dasar di atas**: REV 2.10 (Menu Variants + Stock Linkage) — resolusi modal memakai layer varian
- **Spec terkait**: [permission-matrix](2026-05-24-permission-matrix-design.md), [menu-variants](2026-05-30-menu-variants-stock-linkage-design.md), [stock-ledger](../../operasional-resto.md)

---

## 1. Konteks & Motivasi

Setelah konsultasi dengan dosen pembimbing, sistem harus punya **COGS (Harga Modal/Cost of Goods Sold) per menu**. Pembacaan ulang **proposal skripsi** (`docs/SKRIPSI_C14220315.pdf`, Bab 1 §1.4 Ruang Lingkup bagian D) menemukan bahwa ini **sudah dijanjikan proposal**, bukan fitur baru di luar lingkup:

> *"Laporan Laba Rugi Harian: Perhitungan laba kotor = **Total Penjualan − (Harga Modal Satuan × Jumlah Terjual)**."*
> *Manfaat: "Pemilik memperoleh laporan selisih antara total penjualan dan total modal harian."*

Sebaliknya, lingkup inventori proposal hanya **finished goods porsi**:

> *"Stok yang dicatat adalah barang siap jual (satuan porsi), **bukan bahan baku mentah (gramasi)**."*

Maka **belanja, vendor, dan raw materials tidak pernah ada di ruang lingkup proposal** — mereka ditambahkan saat build (REV 2.x) dan membuat implementasi divergen. Dokumen internal `operasional-resto.md` yang menulis *"HPP out of scope, laba = penjualan − (belanja+tagihan)"* itulah yang menyimpang dan akan diselaraskan balik.

**Filosofi COGS**: owner menyebut modal per menu ("modal Paha Ayam Bakar = sekian"), Ezra input langsung. Tidak ada resep / penimbangan bahan / Bill of Materials — angka modal adalah angka yang dinyatakan owner (coarse, manual, owner-authoritative).

REV 2.11 = dua pekerjaan yang saling melengkapi: **(A) hapus** belanja+vendor+raw materials; **(B) tambah** COGS per menu + snapshot per transaksi + log riwayat modal + laba = pendapatan − COGS.

---

## 2. Keputusan Terkunci (hasil brainstorming)

| # | Keputusan | Pilihan |
|---|---|---|
| D1 | **Model laba** | Laba = **Pendapatan − COGS** (satu tingkat). Tagihan (bills) ditampilkan **terpisah**, TIDAK dikurangkan ke laba. |
| D2 | **Isi log riwayat** | **Modal/COGS saja**. Harga jual TIDAK di-log (bisa diturunkan dari `transaction_items.unitPrice` yang sudah ter-snapshot). |
| D3 | **Granularitas COGS** | **Per baris menu** (termasuk SKU leaf tersembunyi), BUKAN per-varian-storage → lolos masalah varian yang di-rebuild tiap simpan. |
| D4 | **Sumber COGS saat hitung laba** | **Snapshot** `unitCost` di tiap item transaksi saat order dibuat (mirror `unitPrice`). Ubah modal hari ini TIDAK mengubah laba periode lampau. |
| D5 | **Nasib raw materials** | **Hapus** belanja + vendor + raw materials sekalian → inventori = finished-goods porsi saja (sesuai lingkup proposal). |
| D6 | **Resolusi modal** | **Approach B (akurat via komponen)**: modal di SKU leaf stabil; varian → modal leaf-nya; paket → jumlah modal komponen. |

---

## 3. Cakupan

**Di dalam scope:**
- Field modal `cost` per menu (di SKU leaf + menu simple), owner-editable.
- Resolusi modal order-time (varian + paket) + snapshot `unitCost` per `TransactionItem`.
- Log riwayat perubahan modal per menu (à la stok-opname ledger).
- Laba di dashboard owner = Pendapatan − COGS; tagihan tampil terpisah.
- Penghapusan total modul belanja, vendor, raw materials (backend + frontend + schema + seed).
- Backfill `unitCost` untuk transaksi historis (data buku Mei).
- Penyelarasan dokumen ground-truth + knowledge docs.

**Di luar scope (YAGNI):**
- Storage modal per-varian (`MenuVariant.cost`) — cukup via leaf SKU.
- Riwayat **harga jual** — cukup dari `transaction_items`.
- P&L dua tingkat (tagihan di-net ke laba bersih).
- HPP otomatis dari timbang bahan / Bill of Materials / resep.
- Reminder/restock berbasis bahan baku (ikut terhapus bersama raw materials).

---

## 4. Perubahan Data Model (Prisma)

### 4.1 Tambah
- **`Menu.cost Decimal? @db.Decimal(10,2)`** — modal per menu. Nullable (aditif, zero-loss; baris lama `null` = belum di-set, diperlakukan `0` saat hitung). Diisi di SKU leaf (Paha Ayam Bakar, dll) + menu simple. **TIDAK** dibocorkan ke `GET /menus` publik (POS) — hanya di list/detail admin (owner).
- **`MenuVariant.costSourceMenuId Int?`** (FK→`Menu`, `onDelete: SetNull`) — SKU leaf wakil modal sebuah varian. Resolusi pakai fallback `costSourceMenuId ?? stockTargetMenuId`. Untuk varian nonStock yang modalnya beda nyata (Es Teh per-ukuran, Es Jeruk, Tahu Tempe) → menunjuk leaf tersembunyi; untuk varian berstok = sama dengan `stockTargetMenuId`.
- **`TransactionItem.unitCost Decimal? @db.Decimal(10,2)`** — **snapshot modal** per 1 unit baris saat order. Untuk paket = jumlah modal komponen. Mirror `unitPrice` yang sudah ada.
- **Model baru `MenuCostMovement`** (meniru `PortionMovement`):
  ```
  id          Int      @id @default(autoincrement())
  menuId      Int
  costBefore  Decimal? @db.Decimal(10,2)
  costAfter   Decimal? @db.Decimal(10,2)
  reason      MenuCostChangeReason
  note        String?  @db.VarChar(255)
  userId      Int
  createdAt   DateTime @default(now())
  menu        Menu     @relation(fields: [menuId], references: [id])
  user        User     @relation(fields: [userId], references: [id])
  @@index([menuId, createdAt])
  ```
- **Enum baru `MenuCostChangeReason { initialSet, manualEdit }`**.
- **Back-relations**: `Menu.costMovements MenuCostMovement[]`, `User.menuCostChanges MenuCostMovement[]`.

### 4.2 Hapus
- Model **`Vendor`**, **`Purchase`**, **`PurchaseItem`**, **`RawMaterial`**, **`RawMaterialMovement`**.
- Enum **`RawMaterialMovementReason`**.
- Back-relations yang menyebut model di atas: `User.purchases`, `User.rawMaterialMovements`, `RawMaterial.purchaseItems`, `Vendor.purchases`, `Purchase.rawMaterialMovements`, dll.

### 4.3 Tetap utuh
- `PortionStock`, `PortionMovement` (finished-goods inventory + ledger) — **tidak berubah**.
- `MenuVariant.stockTargetMenuId`, `PaketComponent`, resolver stok — tetap.

---

## 5. Engine Resolusi Modal + Snapshot (Approach B)

### 5.1 Resolver pure baru `resolveCostComponents(graph, item)`
Kembar dari [`resolveStockTargets`](../../../backend/src/modules/menus/variant-resolver.ts) tetapi:
- Pakai `costSourceOf(graph, menuId, variantId)` yang **TIDAK** menull-kan komponen nonStock:
  - node varian → `variants[variantId].costSourceMenuId ?? stockTargetMenuId` (lalu menu itu sendiri sebagai fallback terakhir).
  - node simple/leaf → dirinya sendiri (`menu.cost`).
- Untuk **paket** → kumpulkan **semua** komponen (fixed + choice terpilih), termasuk yang nonStock (nasi, tahu, minuman).
- Output: `{ menuId, qty }[]` lengkap (komponen modal).
- Unit-test (pola `variant-resolver.test.ts`): varian leaf, paket multi-komponen (termasuk nonStock), drink nonStock dengan `costSourceMenuId`, fallback `null`.

### 5.2 Snapshot di order-time
Di [`createTransaction`](../../../backend/src/modules/transactions/transactions.service.ts) dan `addItems`:
1. `graph` sudah dibangun untuk resolusi stok → pakai ulang.
2. `components = resolveCostComponents(graph, item)`.
3. `unitCost = Σ(costOf(component.menuId) × component.qty)` per 1 unit baris (modal `null` → `0`).
4. Persist `TransactionItem.unitCost`.
- Reverse/void/edit: `unitCost` ikut baris (tidak perlu re-resolve saat void; cukup baca snapshot).

---

## 6. Log Riwayat Modal (à la stok-opname)

- **Tulis** `MenuCostMovement` **di dalam `prisma.$transaction` `upsertMenu`** saat `cost` berubah:
  - Butuh thread `userId` ke `upsertMenu` (saat ini belum ada param user → ubah signature controller→service, ambil dari `req.user.id`; pola sama `raw-materials.updateRawMaterial(id, userId, input)` lama).
  - `reason='initialSet'` saat dari `null`/0 ke nilai pertama; `'manualEdit'` saat ubah nilai.
  - `note` = prose manusiawi opsional (mis. "Penyesuaian modal").
- **Read**: owner-only `GET /menus/:id/cost-history` (orderBy `createdAt` desc, include `user{name}`). Permission owner-only (modal sensitif; ikut gate menu CRUD).
- **UI**: tombol History per baris di [MenuPage](../../../frontend/src/pages/MenuPage.tsx) → reuse drawer [StockHistorySheet](../../../frontend/src/components/stock/StockHistorySheet.tsx) (map `costBefore→costAfter` ke slot before/after, render Rupiah; `delta = after − before` untuk warna +/−; tidak ada source-doc FK). Tambah `MenuCostMovementView` + `COST_REASON_LABEL` di `types/index.ts`.

---

## 7. Laba Rugi / Dashboard Owner

- [`dashboard.service.ts`](../../../backend/src/modules/dashboard/dashboard.service.ts) `getOwnerReport`:
  - **Buang** `purchaseTotal` (sumber belanja hilang).
  - **Tambah** `cogsTotal = Σ (unitCost × qty)` atas `TransactionItem` dari transaksi `status=paid`, `mergedIntoId IS NULL`, `shift.date` dalam range — **filter identik dengan revenue** agar konsisten (tidak double-count merged bill, atribusi by business-day).
  - `profit = revenueTotal − cogsTotal`.
  - `billTotal` tetap dihitung & dikembalikan **terpisah** (info), TIDAK masuk `profit`.
- Frontend [OwnerDashboard](../../../frontend/src/pages/OwnerDashboard.tsx): kartu **Pendapatan**, **COGS (Beban Pokok Penjualan)**, **Laba Kotor = Pendapatan − COGS**; **Tagihan** sebagai kartu/baris info terpisah. Hapus tampilan & QuickLink "Belanja".
- `dashboardService.ts` type `expense`: `{ purchaseTotal }` → `{ cogsTotal }` (atau bentuk `{ cogsTotal, billTotal }` + `profit`).

---

## 8. Cakupan Penghapusan (Belanja + Vendor + Raw Materials)

### Backend
- Hapus `modules/purchases/*`, `modules/vendors/*`, `modules/stocks/raw-materials/*`.
- [app.ts](../../../backend/src/app.ts): cabut import + `app.use` untuk `/api/vendors`, `/api/purchases`, `/api/stocks/raw-materials`.

### Frontend
- Hapus `pages/PurchasesPage.tsx`, `services/purchaseService.ts`, `services/vendorService.ts`, `services/rawMaterialsService.ts`.
- [StockPage](../../../frontend/src/pages/StockPage.tsx): buang tab "Raw Materials" → Stok jadi single view "Porsi".
- Hapus nav "Belanja" ([Layout.tsx](../../../frontend/src/components/Layout.tsx) owner+kasir), quick-action "Catat Pembelian" (CashierDashboard), reminder raw-material di 3 dashboard, route `/purchases` (App.tsx), export barrel terkait, type `Vendor/Purchase/PurchaseItemView/RawMaterial*`.

### Seed
- [seed.ts](../../../backend/prisma/seed.ts): buang `seedVendors` + sample purchases + seed raw materials.
- Tambah `cost` (+ `costSourceName` per varian nonStock) di `menu-catalog.ts` / `variant-catalog.ts` agar fresh DB & backfill identik.

---

## 9. Migrasi & Backfill (urutan aman)

1. **Aditif dulu** (zero-loss, pola REV 2.8 terbukti): `Menu.cost`, `MenuVariant.costSourceMenuId`, `TransactionItem.unitCost`, tabel `MenuCostMovement`, enum baru. `prisma db push` (dev), runbook hard-gated (prod).
2. **Populate `costSourceMenuId`** untuk varian nonStock yang modalnya beda (Es Teh per-ukuran→leaf, Es Jeruk→leaf, Tahu Tempe→leaf) via script idempotent + di `variant-catalog.ts`.
3. **Owner input modal** semua SKU leaf + menu simple via MenuPage (angka dari owner).
4. **Backfill `unitCost`**: script stamp semua `TransactionItem` (transaksi `paid`) historis pakai `resolveCostComponents` + cost terkini → laba Mei jadi bermakna. (Idempotent; pola `backfill-menu-variants.ts`.)
5. **Setelah COGS terverifikasi**: drop tabel belanja + raw materials (DESTRUKTIF — kehilangan data belanja/raw historis disengaja). **PROD HARD-GATED** (mysqldump dulu).

> ⚠️ Sequencing prod: REV 2.10 belum di-migrate ke prod. REV 2.11 migrasi prod dilakukan **setelah** (atau bersama) migrasi 2.10, dalam satu runbook.

---

## 10. Permission

- Edit `cost` + baca cost-history = **owner-only** (ikut menu CRUD yang sudah owner-only, sesuai matrix REV 2.3).
- Laba report = owner-only (dashboard sudah owner-only).
- `cost` **tidak** ada di `GET /menus` publik (POS) — cegah bocor COGS ke klien tak-terautentikasi. Hanya di list/detail admin.

---

## 11. Dokumen yang Diselaraskan (balik ke proposal)

- [operasional-resto.md](../../operasional-resto.md): hapus seksi Belanja/Vendor/Raw-Materials + "HPP out of scope"; tulis konsep COGS per menu + Laporan Laba Rugi Harian (Pendapatan − COGS); klarifikasi raw materials & belanja keluar scope.
- Memory: `project_resto_operational_truths.md`, `project_session_handoff.md`.
- Knowledge docs: ERD (kurangi entitas Vendor/Purchase/PurchaseItem/RawMaterial/RawMaterialMovement, +`MenuCostMovement` + kolom `cost`/`unitCost`), USE-CASE (hapus UC Pembelian + raw material), ACTIVITY, DATA-DICTIONARY, BAB-3-DRAFT (kebutuhan fungsional), permission-matrix spec.
- StarUML `Skripsi.mdj` (ERD) — opsional/ditunda.

---

## 12. Verifikasi (sebelum claim selesai)

- Vitest: `resolveCostComponents` unit (varian/paket/nonStock/null) + service test snapshot `unitCost`.
- Smoke: order varian + paket → cek `unitCost` ter-snapshot benar; dashboard `cogsTotal`/`profit` benar; void tidak merusak.
- `tsc --noEmit` BE + FE; `vite build`; ESLint.
- Manual e2e browser: owner set modal leaf → order varian (Ayam Potong-Paha) + paket (Paket A) → cek laba = pendapatan − COGS + tagihan terpisah → cost-history drawer tampil; pastikan belanja/raw-materials hilang dari nav & API 404.
- Konfirmasi `GET /menus` publik tidak membocorkan `cost`.

---

## 13. Risiko & Catatan

- **Sequencing prod**: 2.10 + 2.11 dua-duanya belum di prod; migrasi prod harus berurutan (2.10 dulu lalu 2.11) dalam satu runbook, semua HARD-GATED.
- **Varian rebuild**: `upsertMenu` replace-children menghapus+membuat ulang varian tiap simpan → karena modal di SKU leaf (bukan di varian), `costSourceMenuId` harus di-set ulang via signature-match saat edit, ATAU di-reseed dari katalog. Plan harus menangani ini (mirip preserve harga/stockTarget yang sudah ada di VariantBuilder).
- **Modal `null`**: transaksi sebelum backfill / menu tanpa modal → `unitCost` `null`→`0` (laba = pendapatan penuh untuk item itu). Backfill menutup gap untuk data Mei.
- **Data Mei**: COGS historis = taksiran (modal terkini di-backfill), wajar untuk data buku impor.

---

## 14. Runbook Migrasi PROD (HARD-GATED — jangan jalankan tanpa go-ahead eksplisit)

PROD `monosuko.my.id` saat ini di skema **REV 2.8**; REV 2.10 (varian) **dan** 2.11 (COGS) belum di prod. Migrasi harus berurutan dalam satu jendela maintenance. Semua langkah butuh persetujuan eksplisit owner; **backup dulu**.

1. **Backup**: `mysqldump` DB prod (snapshot penuh) sebelum apa pun.
2. **REV 2.10 dulu** (prasyarat — additif): deploy kode REV 2.10 → `cd backend && npx prisma db push` (additif varian, zero-loss) → `npx tsx --env-file=.env scripts/backfill-menu-variants.ts` → verifikasi history utuh (count tx/items) + 0 unresolved. (Owner opname stok "1 Ekor Ayam Bakar Kecap" yang qty awal 0.)
3. **REV 2.11 additif**: deploy kode REV 2.11 → `npx prisma db push` (tambah `menus.cost`, `menu_variants.cost_source_menu_id`, `transaction_items.unit_cost`, tabel `menu_cost_movements` — semua nullable/aditif, zero-loss) → `npx prisma generate`.
4. **Owner input modal**: owner isi `cost` tiap SKU leaf + menu simple via halaman Menu (angka modal dari owner).
5. **Backfill COGS**: `npx tsx --env-file=.env scripts/backfill-cogs.ts` (stamp `unitCost` semua transaksi paid historis pakai modal terkini → laba periode lampau bermakna). Idempoten.
6. **Verifikasi**: cek OwnerDashboard (Laba = Pendapatan − COGS, tagihan terpisah) + cost-history drawer + `GET /menus` publik tak ada `cost`.
7. **DROP destruktif** (paling akhir, sesudah COGS terverifikasi): `npx prisma db push --accept-data-loss` untuk drop `vendors`/`purchases`/`purchase_items`/`raw_materials`/`raw_material_movements`/`units`. Backup (langkah 1) adalah jaring pengaman.
8. **Deploy frontend** dist + smoke manual.

Prinsip: **additif dulu (zero-loss) → isi data → verifikasi → baru drop**. Kalau ragu di langkah mana pun, berhenti & konfirmasi.
