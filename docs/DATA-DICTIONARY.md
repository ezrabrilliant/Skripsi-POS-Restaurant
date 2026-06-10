# Data Dictionary - Sistem POS Ayam Bakar Banjar Monosuko (REV 2.13)

> **Status:** REV 2.13 (2026-06-02) - diselaraskan akurat ke `backend/prisma/schema.prisma`. Baseline naik dari 10 entitas (REV 2.11 dictionary lama) menjadi **23 entitas** dengan melipat seluruh entitas REV 2.5-2.12 yang sebelumnya hanya terdokumentasi di spec masing-masing: split tender (`transaction_payments`), metode-bayar/bank owner-configurable (`payment_methods`, `banks`, `payment_method_banks`), settlement dinamis whole-business-day (`settlement_method_counts`), pengaturan aplikasi (`app_settings`), katalog/varian/paket (`menu_option_groups`, `menu_options`, `menu_variants`, `menu_variant_options`, `paket_components`, `paket_choice_options`, `transaction_item_selections`), dan COGS per menu (`menu_cost_movements`). Subsistem belanja/raw-materials (`raw_materials`, `raw_material_movements`, `vendors`, `purchases`, `purchase_items`, `units`) sudah **DIHAPUS** di REV 2.11 - inventori = finished-goods porsi saja.
> **Sumber kebenaran:** [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma) (struktur akurat) + [`docs/knowledge/ERD.md`](knowledge/ERD.md).
> **Mengikuti:** Format standar skripsi UK Petra - `Field | Tipe Data | Keterangan`.

Dokumen ini melengkapi ERD di `Skripsi.mdj`. Setiap entity di ERD punya tabel definisi lengkap di bawah ini. Saat menyalin ke naskah Bab 3, gunakan caption `Tabel 3.X *Definisi Atribut Tabel <nama>*` sesuai mapping di [`docs/knowledge/BAB-3-DRAFT.md`](knowledge/BAB-3-DRAFT.md) seksi "Mapping Gambar dan Tabel".

## Daftar 23 Entitas

Dikelompokkan menurut domain fungsionalnya.

**Core operasional (7):**

| # | Nama Tabel | Tujuan |
|---|---|---|
| 1 | `users` | Pengguna sistem (Pemilik, Kasir, Waiter) |
| 2 | `shifts` | Siklus shift kasir berbasis business day + window owner-configurable |
| 3 | `transactions` | Header pesanan dengan tipe order, status, dan merged_into_id untuk merge bill |
| 4 | `transaction_items` | Detail item per transaksi (junction menu × transaksi) dengan snapshot `unit_cost` + variant |
| 5 | `transaction_payments` | Slice pembayaran per transaksi (split tender, REV 2.5) |
| 6 | `settlements` | Setoran akhir hari whole-business-day (keyed `@@unique(date)`) |
| 7 | `settlement_method_counts` | Hitungan settlement dinamis per metode bayar (child `settlements`) |

**Katalog & varian (8):**

| # | Nama Tabel | Tujuan |
|---|---|---|
| 8 | `menus` | Master katalog menu dengan klasifikasi stok, jenis (`kind`), dan modal/COGS owner-only (`cost`) |
| 9 | `menu_option_groups` | Grup pilihan per menu (axis varian atau free-preference) |
| 10 | `menu_options` | Nilai opsi dalam grup pilihan |
| 11 | `menu_variants` | Kombinasi sellable varian (harga + stock target + cost source) |
| 12 | `menu_variant_options` | Junction varian ↔ opsi pembentuk (M:N) |
| 13 | `paket_components` | Komponen paket (fixed atau choice) |
| 14 | `paket_choice_options` | Opsi pilihan dalam komponen paket kind=choice |
| 15 | `transaction_item_selections` | Pilihan slot paket + free-preference tersimpan per item transaksi |

**Stok porsi (2):**

| # | Nama Tabel | Tujuan |
|---|---|---|
| 16 | `portion_stocks` | Kondisi stok porsi terkini per menu (1:1 dengan menu yang stockType=portion) |
| 17 | `portion_movements` | Audit log perubahan stok porsi (rename dari `stock_movements` di REV 2.2) |

**Konfigurasi pembayaran (3):**

| # | Nama Tabel | Tujuan |
|---|---|---|
| 18 | `payment_methods` | Master metode pembayaran owner-configurable (REV 2.6) |
| 19 | `banks` | Master bank reusable lintas metode |
| 20 | `payment_method_banks` | Junction many-to-many metode ↔ bank |

**Admin/config/audit (3):**

| #   | Nama Tabel            | Tujuan                                                                          |
| --- | --------------------- | ------------------------------------------------------------------------------- |
| 21  | `bills`               | Tagihan operasional bulanan (owner-only)                                        |
| 22  | `app_settings`        | Pengaturan aplikasi global singleton (PB1, identitas resto, window shift, stok) |
| 23  | `menu_cost_movements` | Audit log perubahan modal/COGS menu                                             |

---

## Tabel 3.2 Tabel `users`

Tabel `users` menyimpan data seluruh pengguna sistem POS yang terbagi dalam tiga peran (Pemilik, Kasir, Waiter) beserta PIN autentikasinya. PIN diperbolehkan duplikat antar pegawai karena identifikasi dilakukan melalui kombinasi nama dan PIN saat login.

| Field      | Tipe Data                    | Keterangan                                                  |
| ---------- | ---------------------------- | ----------------------------------------------------------- |
| id         | INT - PK auto-increment      | ID unik pengguna                                            |
| name       | VARCHAR(100)                 | Nama pegawai (Owner, Jason, Bryant, Chen Hong, Amel, Yanti) |
| pin        | VARCHAR(6)                   | PIN 6-digit untuk login. (identifikasi via nama + PIN)      |
| role       | ENUM(owner, cashier, waiter) | Peran pengguna dalam sistem                                 |
| is_active  | BOOLEAN                      | Status aktif/non-aktif                                      |
| created_at | DATETIME                     | Waktu record dibuat                                         |
| updated_at | DATETIME                     | Waktu update terakhir                                       |

---

## Tabel 3.3 Tabel `shifts`

Tabel `shifts` mencatat siklus shift kasir berbasis *business day* dengan jendela (*window*) yang dapat dikonfigurasi owner di `app_settings` (pagi/malam). Hanya boleh ada satu shift dengan status terbuka di seluruh sistem pada satu waktu - dijaga melalui kolom `active_marker` yang bersifat unik (kolom diisi penanda saat shift terbuka, di-null-kan saat tutup). Kombinasi `(date, cashier_id, type)` **TIDAK lagi unik** karena kasir boleh tutup lalu buka lagi shift jenis sama di hari yang sama.

| Field         | Tipe Data               | Keterangan                                                                         |
| ------------- | ----------------------- | ---------------------------------------------------------------------------------- |
| id            | INT - PK auto-increment | ID unik shift                                                                      |
| date          | DATE                    | Tanggal *business day* shift                                                       |
| type          | ENUM(pagi, malam)       | Jenis shift                                                                        |
| cashier_id    | INT - FK → users        | Kasir yang membuka shift                                                           |
| opening_cash  | DECIMAL(12,2)           | Modal awal laci kas saat buka kasir                                                |
| closed_at     | DATETIME (nullable)     | Waktu tutup kasir (null = shift masih terbuka)                                     |
| active_marker | INT (nullable, UNIQUE)  | Penanda single-OPEN guard sistem-wide. Diisi saat shift terbuka, null saat tutup.  |
| created_at    | DATETIME                | Waktu shift dibuat (saat buka kasir)                                               |

> REV 2.7: window shift owner-configurable (`app_settings.shift_pagi_start` / `shift_changeover` / `shift_malam_end` + `timezone`). Aturan buka shift sadar window; closeShift mendukung 2 mode (final yang memblok transaksi open, atau handover carry). Index `@@index([date, type, closed_at])`.

---

## Tabel 3.4 Tabel `transactions`

Tabel `transactions` menyimpan *header* pesanan dengan dua tipe order (dine-in atau takeaway), nomor meja yang opsional, status pesanan, rincian nominal termasuk PB1 (yang dapat ditanggung resto via `tax_borne_amount`), dan *self-reference* `merged_into_id` untuk mengakomodasi fitur merge bill. Metode pembayaran **tidak lagi disimpan di kolom transaksi** - pindah ke tabel `transaction_payments` agar mendukung *split tender* (satu transaksi dibayar dengan beberapa metode).

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT - PK auto-increment | ID unik transaksi |
| shift_id | INT - FK → shifts | Shift fiskal aktif tempat transaksi diatribusikan. REV 2.7: di-RE-STAMP saat bayar |
| order_type | ENUM(dineIn, takeaway) | Dua tipe order saja (sumber takeaway dibedakan via metode pembayaran) |
| table_number | INT (nullable) | Nomor meja (wajib untuk dineIn, null untuk takeaway) |
| created_by_id | INT - FK → users | User yang menginput order (kasir/owner/waiter - ). REV 2.3 rename dari `cashier_id` |
| status | ENUM(open, paid, void) | open=belum bayar, paid=lunas, void=batal |
| merged_into_id | INT - FK → transactions (self, nullable) | ID transaksi parent gabungan jika transaksi ini sudah di-merge. Query revenue/settlement meng-exclude baris dengan nilai non-null (hindari double-count) |
| subtotal | DECIMAL(12,2) | Total sebelum diskon dan pajak (Σ subtotal items, default 0) |
| discount_amount | DECIMAL(12,2) | Nominal diskon manual (default 0) |
| tax_amount | DECIMAL(12,2) | PB1 yang ditagih ke pelanggan; auto-hitung dari (subtotal − discount) jika PB1 aktif & dibebankan ke pelanggan (default 0) |
| tax_borne_amount | DECIMAL(12,2) | **REV 2.12**: PB1 yang DITANGGUNG resto (TIDAK masuk `total` pelanggan; dikurangkan ke laba di dashboard). 0 jika PB1 dibebankan ke pelanggan / nonaktif (default 0) |
| total | DECIMAL(12,2) | subtotal − discount + tax_amount (default 0) |
| created_at | DATETIME | Waktu transaksi dibuka |
| paid_at | DATETIME (nullable) | Waktu pembayaran |
| voided_at | DATETIME (nullable) | Waktu transaksi dibatalkan |

> **TIDAK ADA** kolom `payment_method` / `payment_bank` di tabel ini (REV 2.5 drop). Pembayaran direkam di `transaction_payments`; nama bank via slice payment.

---

## Tabel 3.5 Tabel `transaction_items`

Tabel `transaction_items` menyimpan rincian item per transaksi sebagai entitas asosiatif (*junction*) antara `menus` dan `transactions`. Selain jumlah dan harga *snapshot* saat order, tabel ini menyimpan modal/COGS *snapshot* (`unit_cost`) untuk perhitungan laba kotor, referensi varian terjual, dan catatan per item. Pilihan paket/free-preference disimpan terpisah di `transaction_item_selections` (relasi REV 2.10).

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT - PK auto-increment | ID unik item transaksi |
| transaction_id | INT - FK → transactions (CASCADE) | Transaksi parent (ON DELETE CASCADE) |
| menu_id | INT - FK → menus | Menu yang dipesan |
| qty | INT | Jumlah porsi |
| unit_price | DECIMAL(10,2) | Harga jual per satuan saat order (*snapshot*, immutable) |
| subtotal | DECIMAL(12,2) | qty × unit_price |
| unit_cost | DECIMAL(10,2) (nullable) | **REV 2.11**: modal/COGS per satuan saat order (*snapshot*, mirror unit_price). Untuk paket = Σ modal komponen. null = baris historis pra-backfill (dihitung 0). Laba kotor: Σ unit_cost × qty |
| sub_options_selected | JSON (nullable) | LEGACY (pre-REV 2.10): hasil pilihan paket berbasis label di JSON. Diganti relasi `selections` + `variant_id`; dipertahankan untuk data historis |
| notes | VARCHAR(255) (nullable) | REV 2.4: catatan per item dari waiter/kasir (mis. "kurang manis", "Panas"/"Dingin") |
| variant_id | INT - FK → menu_variants (nullable, SET NULL) | REV 2.10: varian yang terjual (null untuk simple/paket); unit_price = harga varian |
| created_at | DATETIME | Waktu item ditambahkan |

> **TIDAK ADA** kolom `party_id` (REV 2.5 drop). Split bill multi-party tidak diadopsi; skenario serupa dipenuhi *split tender* (`transaction_payments` multi-method).

---

## Tabel 3.6 Tabel `transaction_payments`

Tabel `transaction_payments` (baru REV 2.5) menyimpan setiap *slice* pembayaran sebuah transaksi sehingga mendukung *split tender* - satu transaksi dapat dibayar dengan beberapa metode (mis. tunai sebagian + QRIS sebagian). Untuk pembayaran tunggal, hanya ada satu *record*. Jumlah `amount` seluruh *slice* harus sama dengan `transactions.total` saat status menjadi paid (divalidasi di *service layer*).

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT - PK auto-increment | ID unik slice pembayaran |
| transaction_id | INT - FK → transactions (CASCADE) | Transaksi yang dibayar (ON DELETE CASCADE) |
| method | VARCHAR(20) | Kode metode bayar (denormalize dari `payment_methods.code`, audit-safe; divalidasi runtime harus exist) |
| bank | VARCHAR(50) (nullable) | Nama bank - wajib untuk metode yang `requires_bank=true` (mis. EDC/transfer), null jika tidak |
| amount | DECIMAL(12,2) | Nominal slice ini |
| recorded_at | DATETIME | Waktu slice direkam |
| recorded_by_id | INT - FK → users | User yang merekam slice (audit per slice, bukan kasir pemilik shift) |

> Index `@@index([transaction_id])`. Breakdown per bank untuk EDC/transfer dihitung runtime via `GROUP BY method, bank`.

---

## Tabel 3.7 Tabel `settlements`

Tabel `settlements` menyimpan setoran akhir hari yang dilakukan secara *whole business day* - satu setoran per tanggal (`@@unique(date)`), bukan per shift malam. Penyetor adalah kasir yang menutup shift terakhir di hari itu atau pemilik (bukan lagi "kasir shift malam saja"). Hitungan per metode pembayaran disimpan dinamis di tabel anak `settlement_method_counts` (mengganti 12 kolom `system_*`/`actual_*` tetap di skema lama). Varians per metode dihitung di *runtime* sebagai selisih `counted − system`.

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT - PK auto-increment | ID unik settlement |
| shift_id | INT - FK → shifts (UNIQUE) | Shift acuan (1:1 dengan shift) |
| date | DATE | Tanggal *business day* (UNIQUE - satu setoran per hari) |
| cashier_id | INT - FK → users | Kasir penutup shift terakhir / owner yang submit |
| reviewer_id | INT - FK → users (nullable) | Pemilik yang review (null sampai direview) |
| status | ENUM(submitted, reviewed) | Status settlement |
| submitted_at | DATETIME | Waktu submit |
| reviewed_at | DATETIME (nullable) | Waktu pemilik review (null sampai direview) |

> **TIDAK ADA** 12 kolom `system_cash`/`system_edc`/.../`actual_transfer` lagi (REV 2.6 drop) - rincian per metode pindah ke `settlement_method_counts`. `@@unique([date])` whole-business-day. Float baseline = Σ `opening_cash` shift hari itu (ditampilkan di summary, tidak ikut variance).

---

## Tabel 3.8 Tabel `settlement_method_counts`

Tabel `settlement_method_counts` (baru REV 2.6) menyimpan, untuk setiap metode pembayaran yang relevan pada sebuah settlement, total versi sistem dan total hasil hitungan fisik (*blind count*) kasir. Tabel ini menggantikan 12 kolom tetap di tabel `settlements` lama sehingga jumlah metode dapat bertambah/berkurang mengikuti master `payment_methods`. Primary key komposit `(settlement_id, payment_method_code)`.

| Field | Tipe Data | Keterangan |
|---|---|---|
| settlement_id | INT - PK + FK → settlements (CASCADE) | Bagian PK komposit; settlement induk (ON DELETE CASCADE) |
| payment_method_code | VARCHAR(20) - PK + FK → payment_methods.code | Bagian PK komposit; kode metode (denormalize, audit-safe; relasi NoAction/RESTRICT - metode tidak bisa hard-delete jika masih dirujuk) |
| counted | INT | Total hasil hitung fisik kasir (default 0) |
| system | INT | Total versi sistem (default 0) |

> Variance = `counted − system` dihitung runtime. Index `@@index([payment_method_code])`. Relasi ke `payment_methods` memakai `onDelete: NoAction`/`onUpdate: NoAction` (semantik RESTRICT MySQL); owner memakai soft-delete `is_active=false` untuk menonaktifkan metode.

---

## Tabel 3.9 Tabel `menus`

Tabel `menus` menyimpan master katalog menu siap jual beserta harga, kategori, klasifikasi jenis stok (porsi yang ditrack, varian yang berbagi stok, atau tanpa stok), jenis menu dari sisi katalog (`kind`: simple/variant/paket), batas minimum stok, dan modal/COGS owner-only (`cost`). Definisi varian/paket terstruktur berada di tabel-tabel katalog turunan (REV 2.10); kolom `sub_options` JSON bersifat legacy.

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT - PK auto-increment | ID unik menu |
| name | VARCHAR(100) | Nama menu (contoh: "1 Ekor Ayam Bakar Merah", "Paket A") |
| category | VARCHAR(50) | Kategori (mis. "Signature Ayam Bakar", "Seafood", "Minuman", "Paket Hemat") |
| price | DECIMAL(10,2) | Harga jual satuan dalam Rupiah |
| cost | DECIMAL(10,2) (nullable) | **REV 2.11**: modal/COGS per unit (owner-only, **TIDAK dibocorkan ke GET publik/POS**). null = belum di-set (dihitung 0 saat hitung laba) |
| stock_type | ENUM(portion, linked, nonStock) | Klasifikasi: portion=ditrack per porsi, linked=share stok menu lain, nonStock=tanpa stok |
| min_stock | INT (nullable) | Ambang minimum stok (hanya bermakna untuk stockType=portion) |
| image_url | VARCHAR(255) (nullable) | Path foto menu (/menu/*.webp) atau URL CDN |
| sub_options | JSON (nullable) | LEGACY (pre-REV 2.10): definisi sub-pilihan paket berbasis JSON. Dipertahankan untuk backfill, tidak ditulis lagi |
| is_active | BOOLEAN | Menu aktif/non-aktif (default true) |
| kind | ENUM(simple, variant, paket) | **REV 2.10**: jenis menu dari sisi katalog (default simple) |
| pos_visible | BOOLEAN | **REV 2.10**: tampil di grid POS? false = SKU stok granular tersembunyi yang hanya jadi target stok varian (default true) |
| created_at | DATETIME | Waktu menu ditambahkan |
| updated_at | DATETIME | Waktu update terakhir |

---

## Tabel 3.10 Tabel `menu_option_groups`

Tabel `menu_option_groups` (REV 2.10) menyimpan grup pilihan per menu. Jika `affects_variant=true`, opsi-opsi dalam grup membentuk kombinasi `menu_variants` (mempengaruhi harga/stok). Jika `false`, grup merupakan *free preference* (mis. suhu dingin/panas) yang hanya dicatat sebagai selection/note tanpa membentuk varian.

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT - PK auto-increment | ID unik grup |
| menu_id | INT - FK → menus (CASCADE) | Menu pemilik grup (ON DELETE CASCADE) |
| name | VARCHAR(50) | Nama grup (mis. "Suhu", "Ukuran") |
| affects_variant | BOOLEAN | true = membentuk varian; false = free preference (default true) |
| display_order | INT | Urutan tampil (default 0) |

> Index `@@index([menu_id])`.

---

## Tabel 3.11 Tabel `menu_options`

Tabel `menu_options` (REV 2.10) menyimpan nilai opsi individual dalam sebuah grup pilihan (mis. "Tawar", "Manis", "Bakar").

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT - PK auto-increment | ID unik opsi |
| option_group_id | INT - FK → menu_option_groups (CASCADE) | Grup pemilik opsi (ON DELETE CASCADE) |
| label | VARCHAR(50) | Label opsi (mis. "Tawar", "Manis") |
| display_order | INT | Urutan tampil (default 0) |

> Index `@@index([option_group_id])`.

---

## Tabel 3.12 Tabel `menu_variants`

Tabel `menu_variants` (REV 2.10) menyimpan setiap kombinasi *sellable* dari menu varian dengan harga eksak per-kombinasi (mereproduksi grid harga non-aditif). Kolom `stock_target_menu_id` menunjuk menu porsi yang di-decrement saat varian terjual; `cost_source_menu_id` menunjuk SKU leaf wakil modal varian.

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT - PK auto-increment | ID unik varian |
| menu_id | INT - FK → menus (CASCADE) | Menu varian pemilik (ON DELETE CASCADE) |
| label | VARCHAR(120) | Label kombinasi varian |
| price | DECIMAL(10,2) | Harga eksak per-kombinasi |
| stock_target_menu_id | INT - FK → menus (nullable, RESTRICT) | Menu porsi yang di-decrement saat varian terjual (null = nonStock, mis. minuman) |
| cost_source_menu_id | INT (nullable) | **REV 2.11**: kolom Int *soft reference* (TANPA FK terdeklarasi) ke SKU leaf wakil modal varian. Resolusi modal = cost_source_menu_id ?? stock_target_menu_id |
| is_active | BOOLEAN | Status aktif (default true) |
| display_order | INT | Urutan tampil (default 0) |

> Index `@@index([menu_id])`, `@@index([stock_target_menu_id])`. Catatan: `cost_source_menu_id` BUKAN relasi FK terdeklarasi (jangan digambar sebagai relasi di ERD).

---

## Tabel 3.13 Tabel `menu_variant_options`

Tabel `menu_variant_options` (REV 2.10) adalah tabel *junction* many-to-many antara `menu_variants` dan `menu_options` (hanya untuk grup `affects_variant=true`) yang merekam opsi-opsi pembentuk tiap varian. Primary key komposit `(menu_variant_id, option_id)`.

| Field | Tipe Data | Keterangan |
|---|---|---|
| menu_variant_id | INT - PK + FK → menu_variants (CASCADE) | Bagian PK komposit; varian (ON DELETE CASCADE) |
| option_id | INT - PK + FK → menu_options (CASCADE) | Bagian PK komposit; opsi pembentuk (ON DELETE CASCADE) |

> Index `@@index([option_id])`.

---

## Tabel 3.14 Tabel `paket_components`

Tabel `paket_components` (REV 2.10) menyimpan komponen-komponen sebuah menu paket. Komponen `fixed` selalu termasuk (dengan qty tertentu); komponen `choice` mengharuskan pelanggan memilih satu dari beberapa `paket_choice_options`. Target komponen dapat berupa menu maupun varian.

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT - PK auto-increment | ID unik komponen |
| paket_menu_id | INT - FK → menus (CASCADE) | Menu paket pemilik (ON DELETE CASCADE) |
| kind | ENUM(fixed, choice) | fixed=selalu termasuk; choice=pelanggan pilih satu |
| label | VARCHAR(60) | Label komponen (mis. "Lauk Utama") |
| qty | INT | Jumlah unit komponen (default 1) |
| display_order | INT | Urutan tampil (default 0) |
| target_menu_id | INT - FK → menus (nullable, RESTRICT) | Target menu komponen (untuk fixed) |
| target_variant_id | INT - FK → menu_variants (nullable, RESTRICT) | Target varian komponen (untuk fixed) |

> Index `@@index([paket_menu_id])`.

---

## Tabel 3.15 Tabel `paket_choice_options`

Tabel `paket_choice_options` (REV 2.10) menyimpan opsi-opsi pilihan dalam komponen paket berjenis `choice`. Target opsi boleh menu maupun varian (POS bercabang ke pemilihnya saat order). Kolom `upcharge` mendukung tambahan harga per pilihan.

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT - PK auto-increment | ID unik opsi pilihan |
| paket_component_id | INT - FK → paket_components (CASCADE) | Komponen pemilik (ON DELETE CASCADE) |
| label | VARCHAR(60) | Label pilihan |
| target_menu_id | INT - FK → menus (nullable, RESTRICT) | Target menu pilihan |
| target_variant_id | INT - FK → menu_variants (nullable, RESTRICT) | Target varian pilihan |
| upcharge | DECIMAL(10,2) | Tambahan harga per pilihan (default 0) |

> Index `@@index([paket_component_id])`.

---

## Tabel 3.16 Tabel `transaction_item_selections`

Tabel `transaction_item_selections` (REV 2.10) menyimpan pilihan yang dibuat pelanggan untuk tiap item transaksi - baik slot paket maupun *free-preference*. Jika `is_preference=true`, pilihan adalah free-preference (mis. suhu) yang tidak mempengaruhi stok/harga.

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT - PK auto-increment | ID unik pilihan |
| transaction_item_id | INT - FK → transaction_items (CASCADE) | Item transaksi pemilik (ON DELETE CASCADE) |
| group_or_slot_label | VARCHAR(60) | Label grup/slot pilihan |
| chosen_label | VARCHAR(120) | Label nilai yang dipilih |
| target_menu_id | INT (nullable) | Target menu pilihan (jika ada) |
| target_variant_id | INT (nullable) | Target varian pilihan (jika ada) |
| is_preference | BOOLEAN | true = free-preference (tak pengaruh stok/harga) (default false) |

> Index `@@index([transaction_item_id])`.

---

## Tabel 3.17 Tabel `portion_stocks`

Tabel `portion_stocks` menyimpan kondisi stok porsi terkini per menu sebagai *live count* yang terus berubah seiring transaksi (dengan dukungan nilai negatif untuk mengakomodasi situasi habis di tengah hari) beserta kondisi awal hari (*opening qty*) yang otomatis di-*snapshot* saat pengguna pertama login pagi. Tabel ini memiliki relasi satu-ke-satu dengan tabel `menus` untuk menu yang memiliki `stock_type=portion`.

| Field | Tipe Data | Keterangan |
|---|---|---|
| menu_id | INT - PK + FK → menus (CASCADE) | Primary key sekaligus foreign key (1:1 dengan menu, ON DELETE CASCADE) |
| current_qty | INT | *Live count* stok porsi. **Boleh negatif** (dukungan stok minus saat habis di tengah hari) |
| min_stock | INT | Ambang reminder restock (duplikat dari `menus.min_stock` untuk kemudahan query, default 0) |
| opening_qty_today | INT | *Snapshot* otomatis kondisi stok saat pengguna pertama login pagi (default 0). Dipakai untuk metric "terjual hari ini" |
| opening_qty_date | DATE | Tanggal *snapshot* (default CURRENT_DATE; dipakai trigger re-snapshot di hari baru) |
| updated_at | DATETIME | Waktu update terakhir |

> Metric "Terjual Hari Ini" dihitung di *runtime* sebagai `opening_qty_today + sum(restock_today) − current_qty` di mana `restock_today` diambil dari `portion_movements.delta WHERE reason IN ('restock_morning','restock_emergency') AND DATE(created_at)=today`. Catatan: `portion_stocks` dan `portion_movements` tidak punya FK langsung satu sama lain - keduanya FK ke `menus` (pola snapshot + ledger).

---

## Tabel 3.18 Tabel `portion_movements`

Tabel `portion_movements` (revisi penyesuaian nama dari `stock_movements` pada REV 2.2) menyimpan log audit setiap perubahan stok porsi beserta alasan dan pengguna yang melakukannya. Setiap perubahan `portion_stocks.current_qty` - baik akibat order, restock pagi, restock darurat, opname, maupun pengembalian/void - akan menyisipkan satu *record* di tabel ini.

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT - PK auto-increment | ID unik log |
| menu_id | INT - FK → menus | Item stok porsi yang berubah |
| delta | INT | Perubahan: positif saat restock, negatif saat order/void |
| reason | ENUM(order, restockMorning, restockEmergency, manualAdjust, refundVoid) | Alasan perubahan |
| transaction_id | INT - FK → transactions (nullable, SET NULL) | REV 2.8: transaksi sumber (diisi saat reason order/refundVoid; null untuk restock/opname) |
| transaction_item_id | INT - FK → transaction_items (nullable, SET NULL) | REV 2.8: baris item penyebab decrement (1 item paket bisa men-decrement banyak stok) |
| qty_before | INT (nullable) | REV 2.8: stok sebelum perubahan ini |
| qty_after | INT (nullable) | REV 2.8: stok sesudah (`qty_after = qty_before + delta`) |
| note | VARCHAR(255) (nullable) | Catatan manusiawi opsional (REV 2.8: bukan lagi sumber tautan - pakai FK; mis. "Antar via Gojek 18:30") |
| user_id | INT - FK → users | Pengguna yang men-trigger perubahan |
| created_at | DATETIME | Waktu perubahan |

> REV 2.8 (ledger integrity): tautan ke dokumen sumber dipindah dari teks `note` ke *foreign key* proper (`transaction_id`, `transaction_item_id`) dengan `ON DELETE SET NULL` agar jejak audit tetap utuh meski item/transaksi terhapus. Kolom `qty_before`/`qty_after` membuat tiap *record* mandiri. Index `@@index([menu_id, created_at])`, `@@index([transaction_id])`.

---

## Tabel 3.19 Tabel `payment_methods`

Tabel `payment_methods` (baru REV 2.6) adalah master metode pembayaran yang dapat dikonfigurasi owner (mengganti enum `PaymentMethod` lama). Owner dapat menambah metode baru (mis. ShopeePay), mengatur warna/ikon untuk UI, menandai apakah metode butuh bank, serta membatasi metode hanya untuk dine-in atau takeaway.

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT - PK auto-increment | ID unik metode |
| code | VARCHAR(20) - UNIQUE | Kode unik metode (mis. "cash", "edc", "qris", "gojek", "grab", "transfer") |
| label | VARCHAR(50) | Label tampil metode |
| color_hex | VARCHAR(7) | Warna heksadesimal untuk UI |
| icon_name | VARCHAR(30) | Nama ikon untuk UI |
| requires_bank | BOOLEAN | true = wajib pilih bank (mis. EDC/transfer) (default false) |
| allow_dine_in | BOOLEAN | Boleh dipakai untuk dine-in (default true) |
| allow_takeaway | BOOLEAN | Boleh dipakai untuk takeaway (default true) |
| is_active | BOOLEAN | Status aktif (soft delete via false) (default true) |
| display_order | INT | Urutan tampil (default 0) |
| created_at | DATETIME | Waktu record dibuat |
| updated_at | DATETIME | Waktu update terakhir |

---

## Tabel 3.20 Tabel `banks`

Tabel `banks` (baru REV 2.6) adalah master bank yang dapat dipakai ulang lintas metode pembayaran (mis. EDC dan transfer berbagi daftar bank yang sama).

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT - PK auto-increment | ID unik bank |
| name | VARCHAR(50) - UNIQUE | Nama bank (mis. "BCA", "Mandiri") |
| is_active | BOOLEAN | Status aktif (soft delete via false) (default true) |
| created_at | DATETIME | Waktu record dibuat |
| updated_at | DATETIME | Waktu update terakhir |

---

## Tabel 3.21 Tabel `payment_method_banks`

Tabel `payment_method_banks` (baru REV 2.6) adalah tabel *junction* many-to-many antara `payment_methods` dan `banks` yang menentukan bank mana saja yang tersedia untuk tiap metode pembayaran. Primary key komposit `(payment_method_id, bank_id)`.

| Field | Tipe Data | Keterangan |
|---|---|---|
| payment_method_id | INT - PK + FK → payment_methods (CASCADE) | Bagian PK komposit; metode (ON DELETE CASCADE) |
| bank_id | INT - PK + FK → banks (CASCADE) | Bagian PK komposit; bank (ON DELETE CASCADE) |
| created_at | DATETIME | Waktu assignment dibuat |

---

## Tabel 3.22 Tabel `bills`

Tabel `bills` menyimpan tagihan operasional bulanan yang hanya dapat diakses oleh Pemilik. Kategori tagihan terbatas pada lima jenis tetap (kebersihan, listrik, air, parkir, sewa). Validasi peran pengguna diterapkan di layer *service*. Tagihan ditampilkan terpisah di dashboard dan **TIDAK dikurangkan** ke laba kotor.

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT - PK auto-increment | ID unik tagihan |
| month | VARCHAR(7) | Bulan tagihan dalam format YYYY-MM (mis. "2026-05") |
| category | ENUM(kebersihan, listrik, air, parkir, sewa) | Kategori tagihan operasional |
| amount | DECIMAL(12,2) | Nominal tagihan |
| note | VARCHAR(255) (nullable) | Catatan opsional |
| user_id | INT - FK → users | Pemilik yang menginput (validasi role=owner di service layer) |
| created_at | DATETIME | Waktu tagihan diinput |

> Index `@@index([month])`.

---

## Tabel 3.23 Tabel `app_settings`

Tabel `app_settings` (baru REV 2.6, diperluas REV 2.7 & 2.12) adalah *singleton* (selalu `id=1`) yang menyimpan pengaturan aplikasi global yang dapat dikonfigurasi owner: kontrol PB1 dua-sumbu, identitas/branding resto, parameter operasional stok, serta window shift business-day.

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT - PK (default 1) | Singleton id, selalu 1 |
| tax_enabled | BOOLEAN | Aktifkan PB1? (default false - resto ini default OFF) |
| tax_rate | DECIMAL(5,2) | Tarif PB1 dalam persen (default 10.00) |
| tax_charged_to_customer | BOOLEAN | **REV 2.12**: true = PB1 ditambahkan ke tagihan pelanggan; false = ditanggung resto (`tax_borne_amount`) (default false) |
| restaurant_name | VARCHAR(120) | **REV 2.12**: nama resto (header struk + branding) (default "Ayam Bakar Banjar Monosuko") |
| restaurant_address | VARCHAR(255) (nullable) | **REV 2.12**: alamat resto |
| opening_hours | VARCHAR(64) (nullable) | **REV 2.12**: jam buka |
| restaurant_phone | VARCHAR(32) (nullable) | **REV 2.12**: nomor telepon resto |
| restaurant_logo_url | VARCHAR(255) (nullable) | **REV 2.12**: URL logo resto |
| restock_multiple | INT | **REV 2.12**: kelipatan restock pagi (parametrik, ganti hardcode 5) (default 5) |
| low_stock_threshold | INT | **REV 2.12**: ambang stok rendah global (default 5) |
| timezone | VARCHAR(64) | **REV 2.7**: zona waktu business day (default "Asia/Jakarta") |
| shift_pagi_start | VARCHAR(5) | **REV 2.7**: jam mulai shift pagi "HH:MM" (default "07:00") |
| shift_changeover | VARCHAR(5) | **REV 2.7**: jam pergantian pagi→malam (default "18:00") |
| shift_malam_end | VARCHAR(5) | **REV 2.7**: jam akhir shift malam (default "23:00") |
| updated_at | DATETIME | Waktu update terakhir |
| updated_by_id | INT - FK → users (nullable, SET NULL) | User yang terakhir mengubah pengaturan |

---

## Tabel 3.24 Tabel `menu_cost_movements`

Tabel `menu_cost_movements` (penambahan baru pada REV 2.11) menyimpan log audit setiap perubahan modal/COGS menu beserta nilai sebelum dan sesudah, alasan (set awal atau penyesuaian), pengguna pelaku (owner), dan waktu kejadian. Tabel ini analog dengan `portion_movements` untuk stok porsi, sehingga pemilik dapat menelusuri riwayat perubahan modal tiap menu.

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT - PK auto-increment | ID unik log |
| menu_id | INT - FK → menus | Menu (SKU leaf / simple) yang modalnya berubah |
| cost_before | DECIMAL(10,2) (nullable) | Modal sebelum perubahan (null = sebelumnya belum di-set) |
| cost_after | DECIMAL(10,2) (nullable) | Modal sesudah perubahan |
| reason | ENUM(initialSet, manualEdit) | initialSet = set pertama dari null; manualEdit = ubah nilai |
| note | VARCHAR(255) (nullable) | Catatan manusiawi opsional (mis. "Penyesuaian modal") |
| user_id | INT - FK → users | Owner yang mengubah modal |
| created_at | DATETIME | Waktu perubahan (`@@index([menu_id, created_at])`) |

> *Auto-generated rows*: ditulis di dalam transaksi basis data `upsertMenu` saat `menus.cost` berubah - reason=`initialSet` saat null→nilai pertama, reason=`manualEdit` saat ubah nilai. Dibaca owner-only via `GET /menus/:id/cost-history`.

---

## Definisi Enum

```prisma
enum UserRole               { owner, cashier, waiter }
enum TransactionStatus      { open, paid, void }
enum OrderType              { dineIn @map("dine_in"), takeaway }
enum SettlementStatus       { submitted, reviewed }
enum ShiftType              { pagi, malam }
enum StockType              { portion, linked, nonStock @map("non_stock") }
enum MenuKind               { simple, variant, paket }
enum PaketComponentKind     { fixed, choice }
enum PortionMovementReason  { order, restockMorning @map("restock_morning"),
                              restockEmergency @map("restock_emergency"),
                              manualAdjust @map("manual_adjust"),
                              refundVoid @map("refund_void") }
enum MenuCostChangeReason   { initialSet @map("initial_set"), manualEdit @map("manual_edit") }
enum BillCategory           { kebersihan, listrik, air, parkir, sewa }
```

> Total **11 enum**. **TIDAK ADA** lagi enum `PaymentMethod` (REV 2.6 diganti master table `payment_methods`), `RawMaterialMovementReason`, atau `RawMaterialCategory` (REV 2.11 drop bersama subsistem belanja).

---

## Ringkasan Relasi (±39 Foreign Key)

| # | Parent (1) | Child (N) | FK | Cardinality | Catatan |
|---|---|---|---|---|---|
| 1 | users | transactions | created_by_id | 1 : N | User input order (kasir/waiter/owner ) |
| 2 | users | shifts | cashier_id | 1 : N | Kasir buka shift |
| 3 | users | settlements | cashier_id | 1 : N | Kasir penutup / owner yang submit |
| 4 | users | settlements | reviewer_id (nullable) | 0..1 : N | Pemilik yang review |
| 5 | users | bills | user_id | 1 : N | Pemilik input tagihan |
| 6 | users | portion_movements | user_id | 1 : N | Audit trail stok porsi |
| 7 | users | menu_cost_movements | user_id | 1 : N | Owner pengubah modal/COGS |
| 8 | users | transaction_payments | recorded_by_id | 1 : N | User perekam slice pembayaran |
| 9 | users | app_settings | updated_by_id (nullable, SET NULL) | 0..1 : N | User pengubah pengaturan |
| 10 | shifts | transactions | shift_id | 1 : N | Atribusi transaksi ke shift (re-stamp saat bayar) |
| 11 | shifts | settlements | shift_id (UNIQUE) | 1 : 1 | Settlement acuan shift |
| 12 | menus | portion_stocks | menu_id (CASCADE) | 1 : 0..1 | Hanya menu stockType=portion punya stok |
| 13 | menus | transaction_items | menu_id | 1 : N | Riwayat order per menu |
| 14 | menus | portion_movements | menu_id | 1 : N | Audit perubahan stok porsi |
| 15 | menus | menu_cost_movements | menu_id | 1 : N | Audit perubahan modal/COGS |
| 16 | menus | menu_option_groups | menu_id (CASCADE) | 1 : N | Grup pilihan per menu |
| 17 | menus | menu_variants | menu_id (CASCADE) | 1 : N | Varian milik menu |
| 18 | menus | menu_variants | stock_target_menu_id (nullable, RESTRICT) | 0..1 : N | Menu porsi target stok varian |
| 19 | menus | paket_components | paket_menu_id (CASCADE) | 1 : N | Komponen milik paket |
| 20 | menus | paket_components | target_menu_id (nullable, RESTRICT) | 0..1 : N | Target menu komponen fixed |
| 21 | menus | paket_choice_options | target_menu_id (nullable, RESTRICT) | 0..1 : N | Target menu opsi pilihan |
| 22 | menu_option_groups | menu_options | option_group_id (CASCADE) | 1 : N | Opsi dalam grup |
| 23 | menu_variants | menu_variant_options | menu_variant_id (CASCADE) | 1 : N | Junction varian↔opsi (sisi varian) |
| 24 | menu_options | menu_variant_options | option_id (CASCADE) | 1 : N | Junction varian↔opsi (sisi opsi) |
| 25 | menu_variants | transaction_items | variant_id (nullable, SET NULL) | 0..1 : N | Varian terjual per item |
| 26 | menu_variants | paket_components | target_variant_id (nullable, RESTRICT) | 0..1 : N | Target varian komponen fixed |
| 27 | menu_variants | paket_choice_options | target_variant_id (nullable, RESTRICT) | 0..1 : N | Target varian opsi pilihan |
| 28 | paket_components | paket_choice_options | paket_component_id (CASCADE) | 1 : N | Opsi pilihan dalam komponen choice |
| 29 | transactions | transaction_items | transaction_id (CASCADE) | 1 : 1..N | Komposisi (item hidup bersama transaksi) |
| 30 | transactions | transaction_payments | transaction_id (CASCADE) | 1 : 1..N | Slice pembayaran (split tender) |
| 31 | transactions | transactions | merged_into_id (self, nullable) | 0..1 : N | Merge bill (sumber → parent gabungan) |
| 32 | transactions | portion_movements | transaction_id (nullable, SET NULL) | 1 : N | Movement order/void ke transaksi sumber |
| 33 | transaction_items | portion_movements | transaction_item_id (nullable, SET NULL) | 1 : N | Movement ke baris item penyebab decrement |
| 34 | transaction_items | transaction_item_selections | transaction_item_id (CASCADE) | 1 : N | Pilihan slot paket/free-preference per item |
| 35 | settlements | settlement_method_counts | settlement_id (CASCADE) | 1 : N | Hitungan dinamis per metode |
| 36 | payment_methods | settlement_method_counts | payment_method_code → code (NoAction) | 1 : N | Kode metode (denormalize, audit-safe) |
| 37 | payment_methods | payment_method_banks | payment_method_id (CASCADE) | 1 : N | Junction metode↔bank (sisi metode) |
| 38 | banks | payment_method_banks | bank_id (CASCADE) | 1 : N | Junction metode↔bank (sisi bank) |

Total (REV 2.13): **23 entitas, ±39 relasi FK**. Catatan: `menu_variants.cost_source_menu_id` adalah kolom Int *soft reference* TANPA FK terdeklarasi (TIDAK dihitung sebagai relasi, jangan digambar sebagai FK di ERD).

---

## Konvensi Naming

- **Entity**: snake_case plural lowercase (`users`, `portion_stocks`, `transaction_payments`, `menu_cost_movements`)
- **Kolom**: snake_case (`created_at`, `menu_id`, `current_qty`, `unit_cost`, `tax_borne_amount`)
- **Primary key**: kolom `id` INT auto-increment, kecuali (a) `portion_stocks` (PK = `menu_id`, 1:1 dengan menu), (b) `app_settings` (PK = `id` singleton, default 1), (c) tabel junction PK komposit (`menu_variant_options`, `payment_method_banks`, `settlement_method_counts`)
- **Foreign key**: `<entity>_id` merujuk ke `<entity>.id` (kecuali `settlement_method_counts.payment_method_code` → `payment_methods.code`)
- **Enum values**: lowercase atau camelCase dengan `@map` ke snake_case di DB (`restockMorning`→`restock_morning`, `initialSet`→`initial_set`)
- **Tipe data**:
  - `INT` untuk PK dan FK
  - `VARCHAR(n)` untuk string pendek
  - `DECIMAL(p, s)` untuk uang dan kuantitas: `Decimal(10,2)` untuk price/cost/qty, `Decimal(12,2)` untuk total/subtotal/amount, `Decimal(5,2)` untuk tax_rate
  - `DATE` untuk tanggal tanpa jam
  - `DATETIME` untuk audit (created_at, updated_at)
  - `ENUM(...)` untuk status/kategori terbatas
  - `JSON` untuk konfigurasi struktur dinamis legacy (`menus.sub_options`, `transaction_items.sub_options_selected`)

---

## Catatan untuk Naskah Bab 3

- Setiap tabel dilengkapi paragraf pengantar 1 kalimat (lihat mapping di [`docs/knowledge/BAB-3-DRAFT.md`](knowledge/BAB-3-DRAFT.md) seksi "3.2.5 Data Dictionary").
- Caption tabel pakai format `**Tabel 3.X** *Definisi Atribut Tabel <nama>*` (Tabel 3.2 untuk `users` hingga Tabel 3.24 untuk `menu_cost_movements` - Tabel 3.1 sudah dipakai untuk "Kebutuhan Informasi per Peran Pengguna"). Penomoran caption perlu disesuaikan dengan jumlah tabel akhir di naskah.
- ERD visual otoritatif ada di `Skripsi.mdj` (StarUML), sudah di-rebuild REV 2.13 (23 entitas via Mermaid erDiagram). Data dictionary ini = dokumentasi tekstual yang menyertai ERD.
- Apabila tabel diubah (add/drop kolom), update **ERD.md, BAB-3-DRAFT.md, dan dictionary ini secara bersamaan** agar konsisten.
- **Permission per peran**: tidak diatur di tingkat database tetapi di *app layer* (backend *middleware* + frontend conditional UI). Tabel `users.role` enum tetap menjadi *single source of truth*. Ringkas: input order + stok + meja + dashboard = semua 3 role (waiter input order); pembayaran/void/merge/tutup-shift/settlement = owner+kasir (waiter TIDAK boleh bayar); buka kasir = kasir-only; review settlement + kelola menu/COGS/pengguna/tagihan/metode-bayar/bank/pengaturan = owner-only. Lihat `docs/operasional-resto.md` seksi "Permission Matrix".

---

## Riwayat Versi

| Versi | Tanggal | Perubahan |
|---|---|---|
| **REV 2.13** | 2026-06-02 | Diselaraskan akurat ke `schema.prisma`: lipat seluruh entitas REV 2.5-2.12 ke dictionary sehingga **10 → 23 entitas**. Tambah tabel `transaction_payments`, `settlement_method_counts`, `payment_methods`, `banks`, `payment_method_banks`, `app_settings`, `menu_option_groups`, `menu_options`, `menu_variants`, `menu_variant_options`, `paket_components`, `paket_choice_options`, `transaction_item_selections`. Perbaiki delta: `transactions` (drop payment_method/payment_bank → split tender; rename cashier_id→created_by_id; +tax_borne_amount), `transaction_items` (drop party_id; +variant_id), `settlements` (drop 12 kolom system_*/actual_* → child + @@unique(date); penyetor bukan "kasir malam only"), `shifts` (drop unique(date,cashier,type) → +active_marker single-OPEN guard), `menus` (+kind, +pos_visible). Enum `PaymentMethod` dihapus (master table). Relasi 17 → ±39 FK. |
| **REV 2.11** | 2026-05-30 | Drop tabel `raw_materials`, `raw_material_movements`, `vendors`, `purchases`, `purchase_items` + enum `RawMaterialMovementReason`/`RawMaterialCategory`. Tambah tabel `menu_cost_movements` + enum `MenuCostChangeReason` + kolom `menus.cost`, `transaction_items.unit_cost`, `menu_variants.cost_source_menu_id`. Inventori = finished-goods porsi saja; laba kotor = pendapatan − COGS − PB1-borne (tagihan terpisah). |
| **REV 2.8** | 2026-05-29 | Stock ledger integrity: tambah FK sumber + qty snapshot di `portion_movements` (`transaction_id`, `transaction_item_id`, `qty_before`, `qty_after`), `ON DELETE SET NULL`. `note` jadi konteks manusiawi (tautan via FK). |
| **REV 2.3** | 2026-05-24 | Schema identik REV 2.2 (no entity/column change). Tambah catatan permission di app layer. |
| **REV 2.2** | 2026-05-24 | Tambah `raw_material_movements` (audit log raw materials). Rename `stock_movements` → `portion_movements`. *(Tabel raw materials kemudian dihapus di REV 2.11.)* |
| **REV 2.1** | 2026-05-23 | Tambah `raw_materials`, `vendors`, `purchases`, `purchase_items`. Drop `bulk_stocks` dan `expenses`. OrderType 2 enum. `opening_qty_today`. `merged_into_id` self-ref. |
| **REV 1** | (historical) | 8 entitas dengan role `kitchen`, PIN unique, `daily_menu_stocks`, `expenses`, payment_method debit/credit/ojol. |
