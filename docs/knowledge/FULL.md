# Full Knowledge - Sistem POS Ayam Bakar Banjar Monosuko (REV 2.13)

Kompilasi lengkap pengetahuan tentang **3 design sistem** yang dipakai di skripsi: Use Case Diagram, Activity Diagram, dan Entity Relationship Diagram. Dokumen ini **self-contained** - reviewer, dosen pembimbing, atau future agent bisa baca satu file ini dan memahami seluruh design.

> ⚠️ **Versi REV 2.13 (2026-06-02).** Diselaraskan ke kode/skema nyata (`backend/prisma/schema.prisma`). Banyak referensi doc lama sudah BASI dan dikoreksi: split-bill/`party_id` → **split-tender** (`transaction_payments`); enum `PaymentMethod` → **master table extensible** (`payment_methods` + `banks` + junction); subsistem belanja/raw-materials/vendor **sudah dihapus** (REV 2.11); settlement = **whole business day** (`@@unique(date)` + child `settlement_method_counts`, BUKAN "kasir malam only" / 12 kolom fixed); shift = business-day **window owner-configurable** + `active_marker` single-OPEN guard + atribusi re-stamp `shift_id` saat bayar; PB1 owner-configurable 2-sumbu (default OFF). Baseline: **23 entitas, ~39 relasi, 11 enum, 23 UC bubble, 11 activity diagram**.
>
> Riwayat versi:
> - **REV 2.13 (2026-06-02)** - selaras kode nyata: catalog layer (variant/paket) + split-tender + payment-methods/banks master + settlement whole-day + shift window/atribusi-by-payment + COGS + app_settings/branding/PB1 2-sumbu masuk hitungan resmi. 23 entitas / 23 UC bubble / 11 activity. StarUML Skripsi.mdj sudah di-rebuild REV 2.13.
> - **REV 2.11 (2026-05-30)** - drop belanja/vendor/raw-materials; tambah `menu_cost_movements` + `menus.cost` + `transaction_items.unit_cost` + `menu_variants.cost_source_menu_id`; laba kotor = pendapatan − COGS (selaras proposal)
> - **REV 2.10 (2026-05-30)** - catalog layer: `menu_option_groups`, `menu_options`, `menu_variants`, `menu_variant_options`, `paket_components`, `paket_choice_options`, `transaction_item_selections` (varian per-kombinasi + komposisi paket)
> - **REV 2.7 (2026-05-29)** - shift redesign: business-day window owner-configurable + `active_marker` single-OPEN guard + atribusi revenue re-stamp `shift_id` saat bayar + settlement whole-business-day
> - **REV 2.6 (2026-05-27)** - payment method + bank jadi master table extensible (`payment_methods`/`banks`/`payment_method_banks`); settlement dinamis via `settlement_method_counts`; `app_settings` PB1 owner-configurable
> - **REV 2.5 (2026-05-26)** - split-tender (`transaction_payments`); drop `Transaction.paymentMethod`/`paymentBank` + drop `TransactionItem.partyId` (split-bill multi-party dibatalkan)
> - **REV 2.4 (2026-05-26)** - waiter & kasir input order via HP (membatalkan framing "waiter fallback" REV 2.3)
> - **REV 2.3 (2026-05-24)** - permission matrix + login fix (no schema change)
>
> 3 design utama:
> - Use Case Diagram → [USE-CASE.md](USE-CASE.md) (REV 2.13, **23 UC bubble** = 21 dasar + 2 «extend», 3 actor)
> - Activity Diagram → [ACTIVITY.md](ACTIVITY.md) (REV 2.13, **11 diagram**, masing-masing 1 initial + 1 final node)
> - Entity Relationship Diagram → [ERD.md](ERD.md) (REV 2.13, **23 entitas, ~39 relasi**)
>
> Diagram lain (Block Diagram Deployment, Sequence Diagram, Class Diagram, Flowchart Force Order) **tidak dipakai di Bab 3 skripsi** - lihat §10 untuk detail dan alasan.
>
> **Sumber kebenaran tertinggi:** [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma) + kode backend/frontend nyata, lalu [`docs/operasional-resto.md`](../operasional-resto.md). Naskah Bab 3 paste-ready: [BAB-3-DRAFT.md](BAB-3-DRAFT.md).

---

## 1. Konteks Skripsi

**Judul:** Pembuatan Sistem Point of Sales (POS) pada Restoran X (Ayam Bakar Banjar Monosuko)
**Penyusun:** Ezra Brilliant Konterliem (C14220315), Sistem Informasi Bisnis UK Petra.

### 1.1. Masalah yang Dipecahkan (Bab 1.1)

1. Semua order, stok, dan pengeluaran dicatat manual di **satu buku tulis dua sisi**. Kekacauan administrasi: pegawai sering bingung membaca tulisan tangan, terutama saat closing malam.
2. Pegawai sering lupa cek stok porsi di tengah hari. Ketika tiba-tiba habis, pemilik harus mengirim restock darurat dari rumah via Gojek/Grab - biaya operasional membengkak.
3. Pencatatan beberapa metode pembayaran manual → mismatch tidak terdeteksi, rekap rawan salah hitung.
4. Pemilik tidak tahu persis pendapatan + pengeluaran bulanan karena pencatatan tidak terstruktur.

### 1.2. Batasan Penelitian (Bab 1.2)

- **HPP berbasis bahan / Bill of Materials tidak dihitung** karena masak batch tanpa penimbangan baku, komposisi bumbu tidak terdokumentasi. Sebagai gantinya, modal/COGS dinyatakan langsung per menu oleh owner (`menus.cost`). Lihat sub-bab 3.1.4 di [BAB-3-DRAFT.md](BAB-3-DRAFT.md) untuk justifikasi paste-ready.
- **Bahan baku mentah tidak ditrack di sistem** - inventori dibatasi pada barang siap jual satuan porsi; konversi bahan mentah → stok porsi terjadi manual di rumah owner, di luar lingkup. **Tidak ada entitas raw materials / vendor / pembelian** (dihapus REV 2.11).
- **Laporan Laba Rugi Harian**: Laba Kotor = Pendapatan − COGS (Σ `unit_cost` × qty dari transaksi paid) − PB1 yang ditanggung resto (`tax_borne_amount`). Tagihan operasional (`bills`) ditampilkan **terpisah**, tidak dikurangkan ke laba kotor.
- **Cetak struk pesanan untuk dapur tidak ada** - dapur produksi di rumah owner, bukan di resto, sehingga komunikasi tetap verbal/kertas. Struk pembayaran (kuitansi pelanggan) opsional dicetak/PDF dari sisi kasir.
- **PWA Level A** (installable, butuh internet) - resto tidak punya WiFi internal sehingga pegawai pakai paket data masing-masing HP.

### 1.3. Stack Teknis (implementasi)

- Backend: Node.js 20 + Express 4 + TypeScript + Prisma 6 + MySQL 8
- Frontend: React 18 + Vite + Tailwind + PWA (vite-plugin-pwa)
- Auth: JWT bearer + PIN 6-digit
- Role: `owner`, `cashier`, `waiter` (role lama `kitchen` di REV 1 sudah dihapus - masak out of scope)

---

## 2. Tiga Aktor Sistem (REV 2.13)

| Aktor | Role DB | Tanggung Jawab |
|---|---|---|
| **Pemilik (Owner)** | `owner` | Master data (menu, pengguna), set & ubah modal/COGS menu (+ riwayat modal), konfigurasi metode pembayaran & bank, pengaturan aplikasi (PB1, identitas/branding resto, window shift, aturan stok), input tagihan bulanan, review settlement, monitoring dashboard & laporan laba rugi dari mana saja. Boleh melakukan semua aksi operasional/pembayaran (bypass) |
| **Kasir** | `cashier` | Operasional POS shift (Jason, Bryant, Chen Hong). Input order ke POS (dengan waiter). Buka kasir, kelola pesanan, proses bayar **split-tender** dengan bank picker untuk EDC/transfer, gabung pesanan/meja (merge), batalkan pesanan (void), tutup kasir (2-mode), setoran akhir hari (whole business day), restock pagi, barang masuk darurat, opname stok porsi |
| **Waiter** | `waiter` | Pelayan + helper (Amel, Yanti). Input order ke POS via HP (**dengan kasir**), antar makanan, buat & antar minuman, cuci piring, restock pagi, opname stok porsi, mark item habis, pantau status meja. **TIDAK boleh** bayar/void/merge/tutup-shift/settlement. Workflow kertas opsional (tulis lalu kasih kasir) bukan keharusan |

Permission matrix lengkap per role per aksi ada di [`docs/operasional-resto.md`](../operasional-resto.md) seksi "Permission Matrix". Catatan: Lisa (masak only) tidak punya akun sistem karena masak dilakukan di luar lingkup sistem.

**Permission nyata (dari kode):**
- Input order + stok (restock/barang-masuk/opname/mark-habis) + pantau meja + dashboard = **semua 3 role** (waiter input order).
- Pembayaran / void / merge / unmerge / tutup-shift / settlement = **owner + kasir** (waiter TIDAK boleh bayar).
- Buka kasir = **kasir-only**.
- Review settlement + kelola menu / kelola modal-COGS / kelola pengguna / tagihan bulanan / metode pembayaran-bank / pengaturan aplikasi = **owner-only**.

---

## 3. Use Case (ringkasan - detail di [USE-CASE.md](USE-CASE.md))

- **System Boundary:** `Sistem POS Restoran Ayam Bakar Banjar Monosuko`
- **3 Actor** (Pemilik, Kasir, Waiter)
- **23 Use Case bubble** = **21 use case dasar + 2 «extend»**, terbagi 5 domain:
  1. **Autentikasi**: `Login` (shared 3 actor - form 2 field input nama + PIN)
  2. **Operasional transaksi**: `Mengelola Pesanan` (kasir + waiter ) + «extend» `Memilih Varian/Paket`; `Memproses Pembayaran` (owner+kasir, split-tender) + «extend» `Mencetak Struk`; `Menggabungkan Pesanan/Meja`; `Membatalkan Pesanan`; `Memantau Status Meja`
  3. **Shift & setoran**: `Buka Kasir` (kasir-only), `Tutup Kasir` (owner+kasir, 2-mode), `Setoran Akhir Hari` (owner+kasir, whole business day), `Mereview Settlement` (owner)
  4. **Manajemen stok** (semua role): `Restock Stok Porsi`, `Mencatat Barang Masuk`, `Opname Stok Porsi`, `Menandai Item Habis`
  5. **Administrasi & konfigurasi owner**: `Mengelola Menu`, `Kelola Modal/COGS Menu`, `Mengelola Pengguna`, `Mencatat Tagihan Bulanan`, `Melihat Dashboard dan Laporan`, `Kelola Metode Pembayaran dan Bank`, `Mengatur Pengaturan Aplikasi`
- **Dependencies:** **20× `<<include>>`** (semua UC operasional kecuali Login menyertakan `Login`), **2× `<<extend>>`** (`Memilih Varian/Paket` → `Mengelola Pesanan`; `Mencetak Struk` → `Memproses Pembayaran`).

> REV 2.13 koreksi dari doc lama: `Mencatat Pembelian` + `Opname Raw Materials` sudah dihapus (REV 2.11); `Memecah Tagihan` (split bill per `party_id`) **dihapus** dan diganti `Memproses Pembayaran [Split Tender]` (banyak metode bayar dalam 1 transaksi). UC config owner baru: `Kelola Metode Pembayaran dan Bank` + `Mengatur Pengaturan Aplikasi`. UC `Memantau Status Meja` + `Menandai Item Habis` dieksplisitkan.

![Use Case](../diagrams/use-case-diagram-sistem-pos-restoran.png)

---

## 4. Activity Diagrams (ringkasan 11 diagram - detail di [ACTIVITY.md](ACTIVITY.md))

Setiap diagram memiliki **tepat 1 initial node + 1 activity-final node** (single-final).

| # | Nama | Swimlane | Tujuan |
|---|---|---|---|
| A.1 | Login | User \| Sistem | Autentikasi form 2 field: input nama + PIN 6 digit |
| A.2 | Mengelola Pesanan | Waiter \| Kasir \| Sistem | Input order kasir & waiter via HP. Pilih tipe order (dineIn/takeaway), pilih meja jika dineIn, tambah item (loop multi-item), pilih varian/paket bila ada, kurangi stok porsi saat submit (boleh minus) |
| A.3 | Memproses Pembayaran | Kasir \| Sistem | PB1 (jika aktif) + diskon + **split-tender** (loop tambah metode hingga lunas) + bank picker EDC/transfer + finalize/cascade merge + opsi cetak struk |
| A.4 | Buka Kasir | Kasir \| Sistem | Window-aware (belum lewat jam-akhir window) + single-OPEN guard (`active_marker`) + serah-terima (handover) |
| A.5 | Tutup Kasir | Kasir \| Sistem | 2-mode: final (blok tx open, 409 daftar per-meja) / handover (carry) |
| A.6 | Setoran Akhir Hari | Kasir/Owner \| Sistem | Whole business day (`@@unique(date)`) + blind count per metode + variance + review owner |
| A.7 | Restock Stok Porsi Pagi | Waiter/Kasir \| Sistem | Restock kelipatan (default 5), log audit reason `restock_morning` |
| A.8 | Mencatat Barang Masuk | Kasir/Waiter \| Sistem | Restock darurat tengah hari, stok minus kembali positif, log reason `restock_emergency` |
| A.9 | Opname Stok Porsi | Kasir/Waiter \| Sistem | Cek fisik & koreksi nilai sistem, log reason `manual_adjust` |
| A.10 | Mencatat Tagihan Bulanan | Owner \| Sistem | Owner-only input tagihan operasional bulanan |
| A.11 | Kelola Menu dan Modal/COGS | Owner \| Sistem | CRUD menu + set/ubah modal (`menus.cost`), log `menu_cost_movements` |

> REV 2.13 koreksi dari doc lama: DROP `Opname Raw Materials` + `Mencatat Pembelian` (fitur dihapus REV 2.11), dan **DROP "Split Bill"** (diganti split-tender di A.3 Memproses Pembayaran). **Tutup Kasir (A.5) & Setoran Akhir Hari (A.6) kini DIPISAH** (dulu tergabung). Merge bill jadi bagian alur pembayaran (cascade ke `merged_from`), bukan diagram terpisah.

### Konvensi Activity

- **Action names**: Title Case Indonesia, business language - bukan SQL, field name, atau pseudocode
- **Decision diamond**: wajib punya nama pertanyaan (mis. "Tipe order dine-in?", "Pembayaran sudah lunas?", "Metode butuh bank?")
- **Guards**: plain text tanpa bracket, Title Case (`Ya`, `Tidak`, `Cash`, `EDC`, ...)
- **Single in/out rule**: percabangan/konvergensi via Decision/Merge, bukan dari action langsung
- **Single-final**: tepat 1 initial node + 1 activity-final node per diagram
- **Swimlane**: vertikal, satu lane per aktor + lane untuk Sistem

---

## 5. Entity Relationship Diagram (ringkasan - detail di [ERD.md](ERD.md))

**23 Entitas** (urut kelompok):

| Kelompok | Entitas |
|---|---|
| Core operasional (7) | `users`, `shifts`, `transactions`, `transaction_items`, `transaction_payments`, `settlements`, `settlement_method_counts` |
| Katalog & varian (8) | `menus`, `menu_option_groups`, `menu_options`, `menu_variants`, `menu_variant_options`, `paket_components`, `paket_choice_options`, `transaction_item_selections` |
| Stok porsi (2) | `portion_stocks`, `portion_movements` |
| Konfigurasi pembayaran (3) | `payment_methods`, `banks`, `payment_method_banks` |
| Admin / config / audit (3) | `bills`, `app_settings`, `menu_cost_movements` |

- **~39 Relasi (FK)**: dominasi 1:N, ditambah:
  - **Self-reference** `transactions.merged_into_id → transactions` (merge bill; transaksi sumber menunjuk parent gabungan).
  - **Junction M:N** `payment_method_banks` (`payment_methods` × `banks`) dan `menu_variant_options` (`menu_variants` × `menu_options`).
  - **1:N split-tender** `transactions → transaction_payments` (1 transaksi banyak slice pembayaran).
  - **1:N settlement** `settlements → settlement_method_counts`, dengan `settlement_method_counts.payment_method_code → payment_methods.code` (FK ke kolom unik `code`, bukan id).
  - `portion_movements` FK **opsional** ke `transactions` + `transaction_items` (`onDelete: SetNull`) untuk audit ledger.
- **Notasi**: crow's-foot (bukan Chen)

> **Catatan FK penting (jangan salah gambar):**
> - `menu_variants.cost_source_menu_id` adalah kolom `Int?` **TANPA relasi FK terdeklarasi** (soft reference) — JANGAN gambar/anggap sebagai relasi FK.
> - `portion_movements` & `portion_stocks` TIDAK punya FK langsung satu sama lain; keduanya FK ke `menus` (pola snapshot + ledger).

![ERD](../diagrams/erd-sistem-pos-restoran.png)

### 11 Enum

| Enum | Values |
|---|---|
| `UserRole` | `owner`, `cashier`, `waiter` |
| `TransactionStatus` | `open`, `paid`, `void` |
| `OrderType` | `dineIn`, `takeaway` |
| `SettlementStatus` | `submitted`, `reviewed` |
| `ShiftType` | `pagi`, `malam` |
| `StockType` | `portion`, `linked`, `nonStock` |
| `MenuKind` | `simple`, `variant`, `paket` |
| `PaketComponentKind` | `fixed`, `choice` |
| `PortionMovementReason` | `order`, `restockMorning`, `restockEmergency`, `manualAdjust`, `refundVoid` |
| `MenuCostChangeReason` | `initialSet`, `manualEdit` |
| `BillCategory` | `kebersihan`, `listrik`, `air`, `parkir`, `sewa` |

> ⚠️ **Enum `PaymentMethod` SUDAH DIHAPUS** (REV 2.6). Metode pembayaran kini master table `payment_methods` (extensible owner-configurable), bank master `banks`, relasi M:N via `payment_method_banks`. Transaksi **tidak** punya kolom `payment_method`/`payment_bank` — pembayaran ada di `transaction_payments` (method denormalize string + bank via junction).

### Kolom Penting (delta vs doc lama)

- **`menus.cost`** → modal/COGS per unit, owner-only, **TIDAK dibocorkan** ke GET publik POS. null = belum di-set (dihitung 0 saat laba).
- **`menus.kind`** (`MenuKind`) + **`menus.pos_visible`** → katalog: jenis menu (simple/variant/paket) + apakah tampil di grid POS (SKU stok granular bisa disembunyikan).
- **`transaction_items.unit_cost`** → snapshot modal per unit saat order (mirror `unit_price`), sehingga laba periode lampau tidak berubah saat owner memperbarui modal.
- **`transaction_items.variant_id`** → varian yang terjual (null untuk simple/paket).
- **`transactions.tax_borne_amount`** → PB1 yang DITANGGUNG resto (TIDAK masuk total pelanggan; dikurangkan ke laba di dashboard). 0 saat PB1 dibebankan ke pelanggan / PB1 nonaktif.
- **`transactions.merged_into_id`** → self-ref nullable untuk merge bill; transaksi sumber menunjuk parent gabungan. **TIDAK ADA** kolom `payment_method`/`payment_bank` di transaksi.
- **`shifts.active_marker`** → unique key untuk **single-OPEN guard** sistem-wide. **TIDAK ada** `@@unique([date, cashier, type])` (di-drop, terlalu strict).
- **`settlements`** → keyed `@@unique([date])` (**whole business day**) + child `settlement_method_counts` (system/counted per metode dinamis). **TIDAK ada** 12 kolom `system_*`/`actual_*` legacy.
- **`app_settings`** (singleton id=1) → `tax_enabled` / `tax_rate` / `tax_charged_to_customer` (PB1 default OFF) + `restaurant_name` / `restaurant_address` / `restaurant_logo_url` / `restaurant_phone` / `opening_hours` (identitas & branding) + `restock_multiple` / `low_stock_threshold` (aturan stok parametrik) + `timezone` / `shift_pagi_start` / `shift_changeover` / `shift_malam_end` (window shift owner-configurable).

### Keputusan Struktural Penting

- **`portion_stocks.opening_qty_today`** → auto-snapshot saat user pertama login pagi, untuk metric "terjual hari ini".
- **Inventori = finished-goods porsi saja** (`portion_stocks`). **TIDAK ada** raw materials / Bill of Materials / resep / vendor / pembelian; modal dinyatakan langsung per menu (HPP berbasis bahan out of scope). Konversi bahan mentah → stok porsi manual di rumah owner.
- **`menu_variants.cost_source_menu_id`** → SKU leaf wakil modal untuk varian nonStock. Resolusi modal varian = `cost_source_menu_id ?? stock_target_menu_id`. (Soft reference, bukan FK terdeklarasi.)
- **Audit log dipisah per domain**:
  - `portion_movements` → audit stok porsi, FK ke `menus` + `users` + (opsional, `onDelete: SetNull`) `transactions` / `transaction_items` (REV 2.8 ledger integrity: `qty_before`/`qty_after` + tautan dokumen sumber).
  - `menu_cost_movements` → audit perubahan modal/COGS menu (`cost_before`/`cost_after`), FK ke `menus` + `users`; auto-insert saat owner mengubah `cost` (reason `initialSet`/`manualEdit`).

Data dictionary lengkap (23 tabel × Field/Tipe/Keterangan) ada di [`docs/DATA-DICTIONARY.md`](../DATA-DICTIONARY.md) REV 2.13.

---

## 5b. Delapan Koreksi Kode Wajib (rangkuman terhadap doc lama)

1. **Split-TENDER, bukan split-bill.** Banyak metode bayar untuk 1 transaksi via `transaction_payments` (1:N). `party_id` sudah **DIHAPUS** (split-bill multi-party dibatalkan). Merge bill tetap ada via pointer `transactions.merged_into_id`.
2. **`payment_methods` = master table extensible** (BUKAN enum). Transaksi TANPA kolom `payment_method`/`payment_bank`; pembayaran di `transaction_payments`; bank via junction `payment_method_banks`.
3. **Tidak ada raw_materials / purchases / vendors** (dihapus REV 2.11). Inventori = `portion_stocks` (finished-goods) saja.
4. **PB1 owner-configurable 2-sumbu** (`tax_enabled` / `tax_rate` / `tax_charged_to_customer`; DEFAULT OFF di resto ini). Jika `charged=false` → PB1 ditanggung resto = `tax_borne_amount`, tidak masuk total pelanggan.
5. **Settlement = WHOLE BUSINESS DAY** (`@@unique(date)`), per-metode dinamis (`settlement_method_counts`). Penyetor = kasir penutup shift terakhir hari itu / owner (BUKAN "kasir malam only").
6. **Shift REV 2.7**: business-day window owner-configurable (`timezone` + `shift_pagi_start`/`shift_changeover`/`shift_malam_end`); `shifts.active_marker` single-OPEN guard sistem-wide; order auto-resolve shift aktif; atribusi RE-STAMP `shift_id` saat bayar; `closeShift` 2-mode (final/handover).
7. **Merge** = set `source.merged_into_id` (pointer); TIDAK migrasi `shift_id`; semua query revenue/settlement **exclude** `merged_into_id IS NOT NULL` (hindari double-count).
8. **COGS**: `menus.cost` owner-only (tak bocor GET publik), snapshot ke `transaction_items.unit_cost` saat order, log `menu_cost_movements` (initialSet/manualEdit), endpoint `GET /menus/:id/cost-history` owner-only. **Laba Kotor owner = Pendapatan − COGS − PB1-borne**; Bills (tagihan) ditampilkan **TERPISAH**, tidak dikurangkan ke laba kotor.

---

## 6. Mapping ke Rumusan Masalah Skripsi

| Rumusan Masalah (Bab 1.2) | Use Case yang menjawab | Activity Diagram | Entitas ERD |
|---|---|---|---|
| A. Percepat durasi transaksi | `Mengelola Pesanan` (2 tipe sederhana) + «extend» `Memilih Varian/Paket` + `Memproses Pembayaran` (split-tender + bank picker) | A.2 + A.3 | `transactions`, `transaction_items`, `transaction_payments`, `menus`, `menu_variants` |
| B. Percepat rekonsiliasi + kurangi mismatch + per-bank | `Setoran Akhir Hari` (rekap dinamis per metode + breakdown bank, variance per metode) + `Mereview Settlement` | A.6 Setoran Akhir Hari | `settlements`, `settlement_method_counts`, `shifts`, `transaction_payments` |
| C. Manajemen stok harian + restock darurat (cegah stockout → ongkir) | `Restock Stok Porsi` + `Mencatat Barang Masuk` + `Opname Stok Porsi` + `Menandai Item Habis` | A.7, A.8, A.9 | `portion_stocks`, `portion_movements` |
| #4 Owner tahu laba & pengeluaran | `Kelola Modal/COGS Menu` + `Mencatat Tagihan Bulanan` + `Melihat Dashboard dan Laporan` (laba = pendapatan − COGS − PB1-borne; tagihan terpisah) | A.11 + A.10 | `menus.cost`, `transaction_items.unit_cost`, `menu_cost_movements`, `bills` |

---

## 7. Status Build (REV 2.13, per 2026-06-02)

| Komponen | Status |
|---|---|
| `backend/prisma/schema.prisma` | ✅ Sumber kebenaran (23 entitas, 11 enum, ~39 relasi) - catalog layer + split-tender + payment-methods/banks + settlement whole-day + shift window + COGS + app_settings |
| Backend code (modules + services + controllers + middleware) | ✅ Implemented & smoke-tested (lihat CLAUDE.md tabel status) |
| Frontend code (3 dashboard per role, POS split-tender, payment-methods/banks config, settings owner) | ✅ Implemented (`vite build` SUCCESS) |
| `docs/operasional-resto.md` (ground truth) | ✅ diselaraskan |
| `docs/knowledge/ERD.md` | ✅ REV 2.13 (23 entitas, ~39 relasi) |
| `docs/knowledge/USE-CASE.md` | ✅ REV 2.13 (23 UC bubble, 3 actor) |
| `docs/knowledge/ACTIVITY.md` | ✅ REV 2.13 (11 activity diagram, single-final) |
| `docs/knowledge/BAB-3-DRAFT.md` | ⏳ perlu review thesis-level (renumber Gambar/Tabel + prosa) |
| `docs/DATA-DICTIONARY.md` | ✅ REV 2.13 (23 entitas) |
| `docs/knowledge/FULL.md` | ✅ REV 2.13 (this file) |
| `Skripsi.mdj` (StarUML) | ✅ Rebuild REV 2.13: ERD 23 entitas (Mermaid `erDiagram`), Use Case 23 bubble, 11 activity (single-final). Diagram lama dihapus (1 sisa "Login lama" di-flag HAPUS MANUAL) |

---

## 8. Modal/COGS per Menu + Bill of Materials (Out of Scope)

> Modal/COGS dinyatakan langsung per menu oleh owner (`menus.cost`), bukan dihitung dari konsumsi bahan baku terukur per siklus produksi. Perhitungan HPP berbasis bahan memerlukan penimbangan baku dan komposisi bumbu terdokumentasi - tidak tersedia pada restoran kecil keluarga yang memasak batch dengan racikan tidak tetap. Karena itu Bill of Materials / resep dan pencatatan bahan baku mentah tidak masuk lingkup sistem.

**Implikasi struktural pada ERD:**
- Inventori yang ditrack hanya `portion_stocks` (finished goods). **Tidak ada** entitas raw materials / vendor / pembelian.
- Tidak ada Bill of Materials / resep yang men-decrement bahan mentah saat order masuk.
- Modal/COGS melekat per menu (`menus.cost`), di-snapshot per item transaksi (`transaction_items.unit_cost`), dengan jejak perubahan di `menu_cost_movements`. Untuk varian nonStock, modal diwakili `menu_variants.cost_source_menu_id`.
- Laporan owner: **Pendapatan total per periode (dari transactions paid, exclude merged) − COGS total per periode (Σ unit_cost × qty) − PB1-borne (`tax_borne_amount`) = Laba Kotor**. Tagihan operasional (`bills`) ditampilkan terpisah, tidak dikurangkan ke laba kotor.

Paragraf paste-ready untuk skripsi (Bab 1.2 Batasan + Bab 3.1.4) ada di [`docs/operasional-resto.md`](../operasional-resto.md) seksi "Bill of Materials / HPP per Bahan (Out of Scope)" + "COGS per Menu + Laporan Laba Rugi Harian", dan [BAB-3-DRAFT.md](BAB-3-DRAFT.md) sub-bab 3.1.4.

---

## 9. Konvensi Global

### Bahasa
- **Indonesian Title Case** untuk nama elemen yang orang awam baca (actor, use case, activity action)
- **snake_case English-Indonesian mix** untuk nama tabel, kolom, enum value
- **Bahasa bisnis** untuk activity actions - hindari SQL/code/pseudocode

### Naming Pola
- Entity ERD: lowercase snake_case (`users`, `portion_stocks`, `transaction_items`, `transaction_payments`, `payment_methods`, `menu_cost_movements`)
- Primary key: `id` (INT auto-increment), kecuali `portion_stocks` (PK = `menu_id` karena 1:1 dengan Menu) dan junction (`payment_method_banks`, `menu_variant_options`, `settlement_method_counts` = composite PK)
- Foreign key: `<entity>_id` (contoh: `menu_id`, `cashier_id`, `created_by_id`, `shift_id`, `transaction_id`, `user_id`)
- Enum values: lowercase underscore di DB (`cash`, `edc`, `restock_morning`, `dine_in`)

### Konsistensi Arrow Direction (Use Case)
- `<<include>>`: panah **ke UC yang jalan dulu** (biasanya ke Login)
- `<<extend>>`: panah **ke base UC** (extending jalan opsional - `Memilih Varian/Paket` → `Mengelola Pesanan`; `Mencetak Struk` → `Memproses Pembayaran`)
- Generalization (hollow triangle): tidak dipakai di sistem POS ini

### Konsistensi Decision di Activity
- Pertanyaan jelas: "Tipe order dine-in?", "Pembayaran sudah lunas?", "Metode butuh bank?"
- Guard `Ya`/`Tidak` Title Case tanpa bracket
- Single merge untuk multiple exclusive path konvergen

---

## 10. Diagram yang TIDAK Dipakai di Skripsi

Per arahan pembimbing dan keputusan scope skripsi, hanya 3 design (Use Case, Activity, ERD) yang dipakai di Bab 3. Berikut diagram lain yang **tidak dipakai** beserta alasannya:

| Diagram | Status | Alasan |
|---|---|---|
| **Block Diagram (Deployment)** | ❌ Tidak dipakai | Pedoman SIB UK Petra menyebut sub-bab Blok Diagram Desain Sistem, tetapi pembimbing membatasi cakupan diagram pada *use case*, *activity*, dan ERD saja. Topology fisik (HP kasir/waiter, server cloud, komunikasi via paket data) cukup dijelaskan di Bab 4 implementasi/deployment. |
| **Sequence Diagram** | ❌ Tidak dipakai | ADSI Bab 10 menyebut sequence diagram untuk skenario kritis, tetapi pembimbing menilai *activity diagram* dengan swimlane sudah cukup menjelaskan alur interaksi untuk skripsi POS yang dominan transaksional. |
| **Class Diagram** | ❌ Tidak dipakai | Skripsi POS pakai pendekatan basis data relasional dengan ERD sebagai blueprint struktur data. Class diagram OOP tidak menambah informasi baru di atas ERD untuk konteks ini. |
| **Flowchart Force Order** | ❌ Tidak dipakai (obsolete) | REV 1/REV 2 sempat punya konsep "force order". REV 2.1 menghapusnya, diganti kebijakan "stok porsi boleh minus" + fitur "Barang Masuk" untuk restock darurat. Konsep yang di-flowchart-kan sudah tidak ada, sehingga flowchart-nya obsolete. |

**Keputusan**: file source/PNG diagram di atas tetap dipertahankan di repository sebagai jejak iterasi desain (audit trail), tetapi **tidak di-rujuk** di Bab 3 maupun di dokumen knowledge ini. Pembersihan file bersifat opsional.

---

## 11. Output Files (3 Design + Dokumentasi REV 2.13)

### Diagrams (PNG export) di `docs/diagrams/` - yang DIPAKAI

PNG visual ekspor dari `Skripsi.mdj` (REV 2.13):

```
use-case-diagram-sistem-pos-restoran.png           (UC, 23 bubble REV 2.13)
activity-diagram-login.png                         (A.1)
activity-diagram-mengelola-pesanan.png             (A.2, 2 tipe order, input , varian/paket)
activity-diagram-memproses-pembayaran.png          (A.3, split-tender + bank picker + PB1)
activity-diagram-buka-kasir.png                    (A.4, window-aware + single-open guard)
activity-diagram-tutup-kasir.png                   (A.5, mode final/handover)
activity-diagram-setoran-akhir-hari.png            (A.6, whole business day + blind count + review)
activity-diagram-restock-stok-porsi-pagi.png       (A.7)
activity-diagram-mencatat-barang-masuk.png         (A.8)
activity-diagram-opname-stok-porsi.png             (A.9)
activity-diagram-mencatat-tagihan.png              (A.10)
activity-diagram-kelola-menu-cogs.png              (A.11)
erd-sistem-pos-restoran.png                        (ERD, 23 entitas REV 2.13)
```
> REV 2.13: PNG `activity-diagram-opname-raw-materials.png` + `activity-diagram-mencatat-pembelian.png` + `activity-diagram-split-merge-bill.png` tidak lagi dipakai (fitur dihapus / digabung ke split-tender).

### StarUML Source
```
Skripsi.mdj   (REV 2.13: ERD 23 entitas + Use Case 23 bubble + 11 Activity single-final)
```

### Dokumentasi (3 design + spec turunan)
```
docs/knowledge/
├── USE-CASE.md       (§3 - REV 2.13)
├── ACTIVITY.md       (§4 - REV 2.13)
├── ERD.md            (§5 - REV 2.13)
├── BAB-3-DRAFT.md    (naskah paste-ready Bab 3 - perlu review thesis-level)
└── FULL.md           (this file - kompilasi 3 design REV 2.13)

docs/
├── operasional-resto.md   (ground truth, sumber kebenaran alur bisnis)
└── DATA-DICTIONARY.md     (23 entitas REV 2.13)
```

---

## 12. Referensi Konvensi

- **ADSI Modul Pembelajaran** - Bab 5 (Use Case), Bab 7 (Activity)
- **Pedoman Program SIB UK Petra** (`docs/Pedoman Program SIB.pdf`)
- **3 skripsi POS UK Petra** yang distudi:
  - Cross-channel strategy pada Resto X (Gobiz integration)
  - Supermarket XYZ dengan metode Market Basket Analysis
  - Toko X dengan analisis ABC-VED (inventory control)
- **Skills internal** di `.claude/skills/` - use-case-diagram, activity-diagram, erd-diagram (3 skill yang dipakai), block-diagram, sequence-diagram, class-diagram, flowchart (4 skill tidak dipakai tetapi tetap ada untuk reference internal)

## 13. Memory Snapshot (untuk future agents)

Memory feedback yang accumulated selama build (per file [MEMORY.md](C:\Users\ezrak\.claude\projects\c--Users-ezrak-Documents-Skripsi-Skripsi-POS-Restaurant\memory\MEMORY.md)):

- **Tanya resto dulu sebelum desain operasional baru** (`feedback_ask_resto_specifics`) - jangan asumsi dari template POS generik
- **Catat tiap selesai untuk continuity sesi** (`feedback_log_everything_for_session_continuity`)
- **Build incremental** (`feedback_incremental_build`) - satu file per step, explain + wait for review
- **Stick to chosen path** (`feedback_stick_to_chosen_path`) - jangan re-suggest alternative yang sudah ditolak
- **ERD pakai Mermaid generate_diagram** (`feedback_erd_use_mermaid`) - `create_element ERDColumn` taruh ke `ownedElements`, compartment view kosong
- **Activity bahasa bisnis** (`feedback_activity_business_language`) - no SQL/field names
- **Atomicity UC**: konsolidasi over-split UC (5 "Melihat Laporan" → 1 "Melihat Dashboard dan Laporan")
- **Decision names + guards**: diamond diberi nama pertanyaan, guards plain text tanpa bracket
- **HPP berbasis bahan / BoM out of scope** - modal/COGS dinyatakan langsung per menu (`menus.cost`), tidak ada raw materials, tidak ada resep auto-decrement

Memory files lengkap di `C:\Users\ezrak\.claude\projects\c--Users-ezrak-Documents-Skripsi-Skripsi-POS-Restaurant\memory\`.

---

*Dokumen ini auto-compiled dari USE-CASE.md, ACTIVITY.md, ERD.md + integrations (REV 2.13, selaras `schema.prisma`). Update bersamaan kalau diagram/design berubah.*
