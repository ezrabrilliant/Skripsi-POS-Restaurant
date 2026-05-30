# Elevasi UI/UX: Katalog Menu + Varian SKU + Stok (seamless & konsisten)

- **Tanggal:** 2026-05-30
- **Status:** Design (disetujui untuk planning)
- **Branch:** `feat/katalog-menu-ux` (dari `main` setelah SKU Varian di-merge)
- **Penulis:** Ezra Brilliant (brainstorming dengan Claude)
- **Lingkup:** Frontend-only. Tidak ada perubahan backend/skema/endpoint.

## 1. Latar Belakang & Masalah

Owner melaporkan area Menu/Stok/SKU Varian "berantakan, tidak konsisten, terasa seperti halaman terpisah-pisah, dan tombol induk tidak berfungsi". Audit kode (6 pembacaan paralel, terverifikasi ke sumber) menemukan akar masalah yang berbeda dari kesan awal:

1. **"Tombol induk tidak ngapa-ngapain"** — itu **bukan tombol**, melainkan `Badge` (sebuah `<span>` non-interaktif tanpa `onClick`). Ada di `SkuVarianPage.tsx` (baris 134–146, 277–285), bukan di MenuPage. Tooltip `title=` hanya jalan saat hover desktop → mati di HP (perangkat yang dipakai staf).
2. **Tidak ada navigasi Menu → SKU Varian** (dan sebaliknya). `grep sku-varian` hanya menemukan 2 hit: route (`App.tsx`) + item nav (`Layout.tsx`). Tidak ada tautan dalam-halaman. Menu/SKU/Stok juga tidak saling tertaut.
3. **Bukan "CSS berantakan".** Ketiga halaman memakai design-system dengan benar. Kesan "rada berubah" berasal dari **inkonsistensi struktural**: 3 gaya header berbeda (`text-headline` vs `text-title`, ada/tak ada subtitle jumlah), 3 bentuk filter-toolbar berbeda, serta kolom & set aksi yang berbeda antara MenuPage dan SkuVarianPage padahal keduanya melihat dataset yang sama.
4. **Fakta kunci:** "SKU Varian" **bukan entitas terpisah** — itu baris `Menu` dengan `posVisible=false`. MenuPage (`posVisible=true`) dan SkuVarianPage (`posVisible=false`) memakai **query key & params identik** (`['menus','admin',showInactive]`, `includeHidden:true`, `includeStock:true`) sehingga **berbagi cache**. Relasi induk↔anak sudah tersedia lewat FK di payload: `MenuVariant.stockTargetMenuId`, `MenuVariant.costSourceMenuId`, `PaketComponent.targetMenuId/targetVariantId`, `PaketChoiceOptionDetail.targetMenuId/targetVariantId`; stok tertanam via `Menu.portionStock`. `buildParentMap` sudah membalik FK ini sepenuhnya di sisi klien.
5. **Link mati tambahan (Stok):** `WaiterDashboard.tsx:59,64` menaut ke `/stock?action=opname-portion` & `/stock?action=mark-habis`, tetapi `useSearchParams` **tidak dipakai di mana pun** → param diabaikan, aksi cepat tidak berfungsi.

Konsekuensi desain: karena ketiga "halaman" adalah view dari satu dataset, perbaikan termurah & berdampak besar adalah **menyatukan Menu + Varian SKU sebagai satu katalog** dan **menautkan relasi (induk, stok) lewat elemen interaktif yang benar** — semuanya memakai FK & query yang sudah ada.

## 2. Tujuan & Non-Tujuan

### Tujuan
- Menyatukan Menu + Varian SKU menjadi **satu halaman "Katalog Menu"** dengan 2 tab, terasa seamless di desktop **dan** mobile.
- Membuat relasi **induk klikable** (navigasi nyata, bukan badge mati).
- Menautkan **Menu/SKU ↔ Stok dua arah** (Stok tetap halaman terpisah).
- Menyeragamkan **header & filter-toolbar** ke primitive bersama (anti one-off), termasuk halaman Stok.
- Memperbaiki **link mati** `?action=` dari dashboard waiter.

### Non-Tujuan
- **Tidak** menggabungkan halaman Stok ke dalam Menu (peran & role-access berbeda: Stok dibuka semua role; Menu/SKU owner-only).
- **Tidak** mengubah backend, skema, atau endpoint.
- **Tidak** mengubah alur POS/order, logika varian, decrement stok, maupun perhitungan COGS.
- **Tidak** menambah pencarian global lintas-modul (di luar lingkup).

## 3. Batasan

- **Frontend-only.** Semua data sudah tersedia dari query existing.
- **Mobile-first.** Target tap ≥44px (`IconButton sm` / `Button` setara). Pola hierarkis = accordion di HP.
- **Frontend Consistency Mandate.** Audit 2–3 referensi (BillsPage, PaymentMethodsPage) + pakai primitive `@/design-system/primitives`. Primitive baru hanya bila reusable, bukan styling sekali pakai.
- **Tidak ada test runner frontend** (tak ada vitest). Verifikasi: `npm run build` + `npm run lint` + e2e Playwright.
- **Aturan UI:** Badge/chip = status (pasif); Button/Link = aksi. Dilarang membuat chip yang berperilaku seperti tombol.

## 4. Keputusan Desain (terkunci saat brainstorming)

- **D1 — Arsitektur hybrid A+B.** Satu halaman "Katalog Menu", tab **"Menu Jual"** (pohon expandable) + tab **"Varian SKU"** (daftar datar lengkap). Tab datar memastikan SKU yatim & multi-induk tetap ketemu/ dicari; pohon memberi drill-down seamless.
- **D2 — Nav menjadi 1 item "Menu".** Item nav "SKU Varian" dihapus (jadi tab). Mengurangi sesak nav, khususnya overflow "Lainnya" di mobile (owner punya 11 item).
- **D3 — Routing berbasis query param.** `/menu` → tab default "Menu Jual". `/menu?tab=varian` → tab Varian SKU. `/menu/sku-varian` lama **di-redirect** ke `/menu?tab=varian` (bookmark tak rusak).
- **D4 — Induk = link teks** (warna primary, prefiks "↑"). Klik → pindah ke tab "Menu Jual", `focusMenuId` ke induk (scroll + sorot, expand bila perlu). SKU yatim = badge **tone warning** "tanpa induk" (terlihat sebagai hal yang perlu dibereskan).
- **D5 — Aksi baris:** "Stok →" = `Button variant="outline" size="sm"` (hanya item ber-stok porsi); **Edit** = `IconButton`; **Nonaktifkan/Aktifkan** = di menu overflow **⋯** (`DropdownMenu`); **Riwayat modal** = `IconButton` atau di ⋯. Tak ada chip-jadi-tombol.
- **D6 — Tautan Stok dua arah** (Stok tetap halaman sendiri): Menu/SKU → `/stock?focusMenuId=`; Stok → `/menu?focusMenuId=` **khusus owner** (kasir/waiter tak lihat, karena Menu owner-only).
- **D7 — Selaraskan Stok penuh.** Header + filter-toolbar Stok mengadopsi primitive bersama (isi/operasi stok tidak berubah).
- **D8 — Bersih-bersih disertakan.** Guard opname "kosong vs 0", hapus komentar/ref mati REV 2.11 (belanja/raw-materials) di komponen stok, sinkronkan spec/plan SKU Varian lama ke kode.

## 5. Arsitektur Informasi & Routing

```
/menu                      → KatalogMenuPage, tab "Menu Jual" (default)
/menu?tab=varian           → KatalogMenuPage, tab "Varian SKU"
/menu?tab=jual&focusMenuId=<id>   → buka tab Menu Jual, scroll+sorot menu <id> (expand bila parent)
/menu?focusMenuId=<id>     → resolve tab dari posVisible(<id>), lalu scroll+sorot
/menu/sku-varian           → REDIRECT ke /menu?tab=varian
/stock?focusMenuId=<id>    → scroll+sorot baris stok <id>
/stock?action=opname       → buka modal Opname
```

- Tab dikendalikan `useSearchParams` (`?tab`). State pencarian/filter tetap lokal per tab (tidak perlu di URL).
- Pola **focus+highlight**: baca `focusMenuId` → `scrollIntoView` + ring sementara (mis. `ring-2 ring-primary-400` ~1.5s) lalu hapus. Bila menu adalah anak SKU di tab Menu Jual, expand induknya dulu.
- Guard role: `/menu` tetap `RoleRoute allow={['owner']}`. Tautan balik Stok→Menu hanya dirender bila `role==='owner'`.

## 6. Tab "Menu Jual" — Pohon Expandable

- Daftar **menu jual** (`posVisible=true`). Baris dengan `kind` variant/paket dapat di-**expand** → menampilkan anak SKU-nya (nama, stok, modal) di tempat. Mobile = accordion (kartu induk → kartu anak menjorok).
- Menu biasa (`kind` simple) = baris datar tanpa panah.
- Anak SKU dihitung klien dari FK (kebalikan `buildParentMap`): variant → `stockTargetMenuId`/`costSourceMenuId`; paket → `targetMenuId` + `choiceOptions[].targetMenuId`. Helper baru `buildChildrenMap` di `components/menu/menuTree.ts` (satu modul dengan `buildParentMap`).
- Baris anak menampilkan tombol **"Stok →"** (bila porsi) + **Edit**. SKU yang sama bisa muncul di bawah >1 induk (multi-induk) — wajar; edit memodifikasi SKU yang sama.

## 7. Tab "Varian SKU" — Daftar Datar

- Semua SKU `posVisible=false` (logika SkuVarianPage saat ini), termasuk yatim & multi-induk → dapat dicari/diurut langsung.
- Kolom: **Nama SKU | Induk (link) | Kategori | Stok | Modal | Aksi**.
- **Induk** = link teks (D4). Multi-induk: "↑ Es Teh, Paket A +1" (sisanya di tooltip desktop **dan** baris bawah kecil di mobile — jangan andalkan hover saja).
- Yatim: badge tone warning "tanpa induk".

## 8. Afordans Baris (berlaku di kedua tab + konsisten dgn Stok)

| Aksi | Komponen | Kondisi tampil |
|---|---|---|
| Stok → | `Button outline sm` (rightIcon arrow) | hanya `stockType==='portion'` |
| Edit | `IconButton` (pencil) | selalu |
| Riwayat modal | `IconButton` (clock) atau di ⋯ | bila punya cost/relevan |
| Nonaktifkan / Aktifkan | item di `DropdownMenu` (⋯) | selalu |
| Induk (navigasi) | link teks | hanya tab Varian SKU |

- **Mobile:** aksi sekunder diciutkan ke **⋯**; "Stok →" & "Edit" tetap sebagai tombol berlabel (tanpa hover-tooltip).

## 9. Koneksi Stok (dua arah)

- **Masuk:** "Stok →" pada baris menu/SKU → `navigate('/stock?focusMenuId='+menuId)`. PortionStockTab membaca `focusMenuId` (via `useSearchParams`), scroll + sorot baris.
- **Keluar (owner):** baris stok mendapat aksi **"Menu →"** (owner-only) → `/menu?focusMenuId=<menuId>` (resolve tab).
- **Link mati diperbaiki:** `?action=opname` → buka modal Opname. Quick-action **mark-habis** di WaiterDashboard diarahkan ulang ke `/stock` dengan **filter stok rendah/habis** (karena mark-habis adalah konfirmasi per-baris, bukan modal global) — staf lalu tap baris untuk menandai habis. (Final mekanik di plan.)

## 10. Primitive Bersama yang Diekstrak

> Tujuan: hentikan header/toolbar one-off; dipakai Katalog Menu **dan** Stok.

- **`PageHeader`** (`design-system/primitives/PageHeader.tsx`): props `title`, `subtitle?` (mis. "42 menu jual · 34 varian SKU"), `actions?` (slot kanan, mis. tombol "+ Menu"), `tabs?` (slot segmented control). Mengadopsi arketipe CRUD dominan (`text-headline` + subtitle + tombol primary kanan, kontainer `max-w-6xl mx-auto`).
- **`FilterToolbar`** (`design-system/primitives/FilterToolbar.tsx`): generalisasi `StockFilterToolbar` saat ini — props `search`, `filters[]` (Combobox), `chipFilters?` (gaya MenuTypeFilter), `sort?`, `actions?`, `rightBadge?`; desktop inline / mobile di balik `Sheet` dengan badge jumlah filter aktif + reset.
- **`DataTable` + expandable-row** (perluasan `design-system/primitives/DataTable.tsx`): tambah opsional `expandable?: { canExpand(row): boolean; renderExpanded(row): ReactNode }`, state expand internal keyed `rowKey`, afordans chevron di kolom pertama; `mobileCard` mendapat bagian "expanded" tergabung. Dipakai tab "Menu Jual".

(API di atas adalah kontrak yang diusulkan; signature final diselesaikan saat implementasi/TDD-ringan.)

## 11. Penyelarasan Halaman Stok

- `StockPage` (shell 19 baris) + `PortionStockTab` mengadopsi `PageHeader` (judul "Stok" + subtitle jumlah + slot aksi) & `FilterToolbar` bersama, agar header/altitude & bentuk filter sama dengan Katalog Menu.
- Tambah dukungan `?focusMenuId` & `?action=opname`. Aksi baris "Menu →" (owner-only).
- **Isi/operasi stok tidak berubah** (restock pagi, barang masuk, opname, mark-habis, riwayat tetap).

## 12. Bersih-bersih

- **Guard opname "kosong vs 0":** input kosong (`Number('')===0`) jangan diperlakukan sebagai opname nyata 0 — bedakan "tidak dihitung" vs "dihitung 0" (`PortionStockTab` ~baris 570).
- **Hapus ref mati REV 2.11:** komentar/label `RawMaterialsTab`, sumber "Pembelian #" di `StockFilterToolbar.tsx`, `useStockListControls.ts`, `StockHistorySheet.tsx`.
- **Sinkron docs:** update `docs/superpowers/specs/2026-05-30-sku-varian-page-design.md` (§5.2 label orphan "tanpa induk", `buildParentMap` non-export) — atau tandai superseded oleh dokumen ini.

## 13. Berkas yang Terpengaruh (perkiraan)

- **Halaman/komponen:**
  - `frontend/src/pages/MenuPage.tsx` → jadi `KatalogMenuPage` (host PageHeader + tabs + render tab aktif).
  - tab baru: `components/menu/MenuJualTab.tsx` (pohon) + `components/menu/VarianSkuTab.tsx` (serap `SkuVarianPage.tsx`).
  - `frontend/src/pages/SkuVarianPage.tsx` → dihapus (logika pindah ke tab) atau jadi tipis pembungkus redirect.
  - `components/menu/menuTree.ts` (buildParentMap + buildChildrenMap, shared).
  - `frontend/src/pages/StockPage.tsx` + `components/stock/PortionStockTab.tsx` → adopsi primitive + focus + link.
  - `frontend/src/components/Layout.tsx` → hapus item nav "SKU Varian".
  - `frontend/src/App.tsx` → route `/menu` (tabs) + redirect `/menu/sku-varian`.
  - `frontend/src/pages/WaiterDashboard.tsx` → perbaiki link aksi cepat.
- **Primitive baru/diperluas:** `design-system/primitives/PageHeader.tsx`, `FilterToolbar.tsx`, `DataTable.tsx` (expandable).
- **Cleanup:** `components/stock/StockFilterToolbar.tsx`, `useStockListControls.ts`, `StockHistorySheet.tsx`.
- **Docs:** spec/plan SKU Varian (sinkron).

## 14. Verifikasi

- `cd frontend && npm run build` (tsc -b + vite) → 0 error; `npm run lint` → 0 error.
- E2e Playwright per role (owner utama):
  1. `/menu` → tab "Menu Jual" default; expand "Ayam Potong" → 3 anak tampil (stok/modal); collapse.
  2. Tab "Varian SKU" → klik induk → pindah tab Menu Jual + induk ter-sorot.
  3. SKU yatim tampil badge warning; multi-induk tampil "+N".
  4. "Stok →" pada SKU porsi → `/stock` baris ter-sorot. Owner: "Menu →" balik → `/menu` ter-sorot.
  5. WaiterDashboard aksi cepat → opname modal terbuka / filter stok rendah aktif (tak lagi mati).
  6. `/menu/sku-varian` → redirect ke `/menu?tab=varian`.
  7. Mobile (viewport HP): accordion, tombol berlabel, ⋯ overflow, target ≥44px.
  8. Nav: owner hanya 1 item "Menu" (SKU Varian hilang dari nav & overflow).
- Konsistensi visual: header & filter-toolbar Katalog Menu == Stok == arketipe BillsPage/PaymentMethodsPage.

## 15. Risiko & Mitigasi

- **Expandable DataTable menyentuh primitive bersama** → bisa pengaruhi tabel lain. Mitigasi: prop opsional, default perilaku lama tak berubah; uji halaman pemakai DataTable lain tetap normal.
- **Multi-induk tampil kembar di pohon** → bisa membingungkan. Mitigasi: label jelas + edit tetap satu SKU; tab "Varian SKU" sebagai sumber datar definitif.
- **Redirect `/menu/sku-varian`** → pastikan tak ada loop & nav highlight benar.
- **`focusMenuId` ke SKU di pohon** → harus expand induk dulu; bila multi-induk, pilih induk pertama/yang relevan.
- **Resolusi anak by-FK** → andalkan cache penuh (includeHidden:true) yang sudah ada; tetap frontend-only.

## 16. Catatan Implementasi (untuk plan)

- Pertahankan **berbagi cache** query key `['menus','admin',showInactive]` — kedua tab + modal sudah kompatibel.
- Pakai ulang `MenuFormModal` & `CostHistoryDrawer` (sudah dipakai bersama).
- Ikuti incremental per-file + checkpoint review (preferensi Ezra). TDD-ringan untuk helper murni (`menuTree.ts`) bila memungkinkan; sisanya verifikasi via build/lint/e2e.
