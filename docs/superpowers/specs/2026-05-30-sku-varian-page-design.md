# Halaman "SKU Varian" — pisahkan SKU tersembunyi dari "Kelola Menu"

- **Tanggal:** 2026-05-30
- **Status:** Disetujui (brainstorming) — siap planning
- **Scope:** **Frontend-only** — nol perubahan backend / schema / migrasi.
- **Spec terkait:** [2026-05-30-menu-variants-stock-linkage-design.md](2026-05-30-menu-variants-stock-linkage-design.md) (REV 2.10), [2026-05-30-cogs-per-menu-remove-belanja-design.md](2026-05-30-cogs-per-menu-remove-belanja-design.md) (REV 2.11)

---

## 1. Konteks & Masalah

Sejak **REV 2.10** (menu variants), setiap menu varian (Es Teh, Ayam Potong, …) dan paket adalah **"menu display"** yang tampil di POS. Di belakangnya ada **SKU granular** (`posVisible = false`, ~34 item: Paha Ayam Bakar, Teh Tawar Biasa, Jeruk Nipis, Kerupuk Udang, …) yang:

- **Pegang stok asli** (yang `stockType = portion`) → dipakai auto-decrement saat order + restock/opname.
- **Pegang modal/COGS asli** (yang `stockType = nonStock`: Teh/Jeruk/Tahu Tempe) → jadi `costSource` varian (REV 2.11).
- Disimpan permanen supaya transaksi lama tetap valid (di-referensikan by id).

`MenuPage` ("Kelola Menu") memanggil `list({ includeHidden: true })` supaya owner bisa edit modal + lihat riwayat. Akibatnya **~34 SKU tersembunyi nyampur** dengan menu jual → daftar hampir 2× lebih panjang dan rancu antara "yang dijual" vs "item di balik layar". Badge lama **"Tersembunyi dari POS"** mendeskripsikan apa yang **bukan** (tidak tampil di POS), bukan **perannya**.

## 2. Tujuan

1. Pindahkan pengelolaan SKU tersembunyi ke **halaman owner terpisah "SKU Varian"**.
2. "Kelola Menu" jadi **bersih**: hanya menu yang dijual (`posVisible = true`).
3. Istilah **konsisten** "SKU Varian" menggantikan "Tersembunyi dari POS".

## 3. Non-Tujuan

- Aksi stok (restock / opname / barang-masuk) — **tetap di halaman Stok**, tidak diduplikasi.
- Membuat SKU tersembunyi **baru** dari halaman ini.
- Perubahan **backend / schema / migrasi** apa pun.

## 4. Keputusan terkunci (hasil brainstorming)

| # | Keputusan |
|---|---|
| D1 | **Penempatan:** halaman owner terpisah (bukan toggle di Menu, bukan expand baris induk). |
| D2 | **Nama:** "SKU Varian" (nav + judul). Subjudul: *"Item di balik menu varian & paket — pegang stok dan/atau modal. Tidak tampil di kasir."* |
| D3 | **Kapabilitas:** daftar + **edit modal/COGS** + **riwayat modal** (inti) **+ stok qty read-only + badge induk + edit struktural** (rename/nonaktif). |
| D4 | **Route:** `/menu/sku-varian`, item nav "SKU Varian" tepat setelah "Menu". |
| D5 | **Reuse** `MenuFormModal` (cost + struktural, satu pintu) + `CostHistoryDrawer` (riwayat, sudah ada di MenuPage). |
| D6 | **Polish label** checkbox `MenuFormModal`: saat `posVisible = false`, ganti "Menu aktif (tampil di POS)" → "SKU aktif (bisa dipakai stok/modal varian)". |

## 5. Desain

### 5.1 Data (frontend-only — kenapa nol backend)

`listMenus(query, includeCost)` di [backend/src/modules/menus/menus.service.ts](../../../backend/src/modules/menus/menus.service.ts) memakai `include: menuDetailInclude`, sehingga `list({ includeHidden: true })` **sudah** mengembalikan `MenuDetail` lengkap untuk SEMUA menu: `variants[]` (dengan `stockTargetMenuId` + `costSourceMenuId`), `paketComponents[]` (dengan `targetMenuId` + `choiceOptions[].targetMenuId`), `cost` (owner-only), dan `portionStock` (saat `includeStock: true`).

Konsekuensi:
- **Filter hidden-only** → client-side `menus.filter((m) => !m.posVisible)`.
- **Badge induk** → dihitung client-side dari data yang sama (lihat §5.3). Tidak perlu endpoint baru.
- **Stok read-only** → `m.portionStock?.currentQty` (nonStock → `null` → render `—`).
- **Modal** → `m.cost` (sudah dikirim untuk request owner-authenticated).

### 5.2 `SkuVarianPage.tsx` (owner-only)

Pola visual mengikuti [MenuPage.tsx](../../../frontend/src/pages/MenuPage.tsx) (DataTable + toolbar + mobileCard).

- **Fetch:** `menuService.list({ activeOnly: !showInactive, includeHidden: true, includeStock: true })`.
- **Toolbar:** search nama + filter kategori (`Combobox`) + checkbox "Tampilkan nonaktif".
- **Kolom tabel:**

| Kolom | Isi |
|---|---|
| **Nama** | nama SKU; (mobile) + kategori |
| **Induk** | `Badge` `← Ayam Potong`; multi-induk → `Es Teh +2` (tooltip/title daftar penuh). Tanpa induk (yatim) → `Badge` netral "—" |
| **Stok** | `portion` → angka qty (warna low/habis seperti `PortionStockTab`); `nonStock`/`linked` → `—` |
| **Modal** | `formatCurrency(m.cost)` / `—` |
| **Aksi** | ✎ Edit → `MenuFormModal`; ⏱ Riwayat modal → `CostHistoryDrawer` |

- **Edit modal & struktural** dua-duanya lewat `MenuFormModal` yang di-reuse (tidak bikin form baru).
- **Empty state:** "Belum ada SKU varian" / "Tidak ada yang cocok dengan filter".

### 5.3 Helper `buildParentMap(menus)` (pure, unit-tested — TDD)

Bangun `Map<number, string[]>` (skuId → daftar nama menu induk):
- parent `kind === 'variant'`: untuk tiap `variants[]` → tambah `stockTargetMenuId` & `costSourceMenuId`.
- parent `kind === 'paket'`: untuk tiap `paketComponents[]` → tambah `targetMenuId`; untuk tiap `choiceOptions[]` → tambah `targetMenuId`.

Fungsi murni (input `Menu[]`, output `Map`), ditempatkan terpisah supaya gampang di-unit-test. Test dulu (TDD) sebelum dipakai di page.

### 5.4 Bersihin `MenuPage.tsx`

- Tambah `.filter((m) => m.posVisible)` di memo `filtered` → SKU tersembunyi hilang dari "Kelola Menu".
- Hitungan header "X dari Y menu" + `typeCounts` ikut basis **visible-only**.
- **Hapus badge "Tersembunyi dari POS"** di 2 tempat (desktop row + mobile card) — dead code setelah filter.
- **Anti-bug cache (penting):** fetch query MenuPage **tetap** `includeHidden: true` dengan key `['menus','admin',showInactive]` **tidak diubah**, supaya konsisten dengan `MenuFormModal` (`['menus','admin',true]`) & `SkuVarianPage` yang berbagi cache React Query. Yang berubah **cuma render filter**, bukan fetch param. (Lihat memory `project_stale_cache_payment_bug` — param berbeda di key sama = stale data.)

### 5.5 Polish label `MenuFormModal.tsx`

Checkbox status aktif (blok `{existing && …}`): label kondisional —
`existing.posVisible ? 'Menu aktif (tampil di POS)' : 'SKU aktif (bisa dipakai stok/modal varian)'`.
`MenuFormModal` sudah mempertahankan `posVisible` existing (line ~108) → edit hidden SKU tidak akan memunculkannya di POS.

### 5.6 Nav + Route

- [App.tsx](../../../frontend/src/App.tsx): tambah route `<Route path="/menu/sku-varian">` di dalam `OwnerRoute`.
- [Layout.tsx](../../../frontend/src/components/Layout.tsx): sisipkan `{ to: '/menu/sku-varian', icon: Boxes, label: 'SKU Varian' }` di `NAV_BY_ROLE.owner` tepat setelah item `/menu`. (Mobile: otomatis masuk sheet "Lainnya" karena owner > 4 item.)

## 6. Edge cases

- **Multi-induk:** SKU dipakai >1 parent (mis. "Teh Tawar Biasa" = costSource Es Teh + opsi minuman Paket A/C/D) → badge tampil induk pertama + `+N`, daftar penuh via `title`.
- **SKU yatim:** SKU `posVisible=false` yang tidak direferensikan parent mana pun → badge "—" (tetap tampil agar bisa diaktifkan/diarahkan).
- **SKU nonStock:** kolom Stok `—` (konsisten dengan subjudul "stok dan/atau modal").
- **Nonaktif:** SKU `isActive=false` tampil saat "Tampilkan nonaktif" dicentang (mirror MenuPage), opacity 60%.

## 7. Verifikasi (sebelum klaim selesai)

1. **Unit test** `buildParentMap` (variant target+costSource, paket fixed+choice, multi-induk, yatim).
2. `tsc --noEmit` (frontend) 0 error + `vite build` sukses + `eslint` 0 error.
3. **Manual e2e browser:** buka `/menu/sku-varian` → daftar muncul + badge induk benar; edit modal 1 SKU → tersimpan + masuk drawer Riwayat; buka "Kelola Menu" → tidak ada lagi SKU tersembunyi & tidak ada badge "Tersembunyi dari POS"; POS grid tidak berubah.

## 8. File yang disentuh

| Aksi | File |
|---|---|
| NEW | `frontend/src/pages/SkuVarianPage.tsx` |
| NEW | helper `buildParentMap` (+ test) — mis. `frontend/src/pages/skuVarian.helpers.ts` + `*.test.ts` |
| MOD | `frontend/src/App.tsx` (route) |
| MOD | `frontend/src/components/Layout.tsx` (nav owner) |
| MOD | `frontend/src/pages/MenuPage.tsx` (filter posVisible + hapus badge + counts) |
| MOD | `frontend/src/components/MenuFormModal.tsx` (label checkbox kondisional) |
