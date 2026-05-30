# Data Dictionary - Sistem POS Ayam Bakar Banjar Monosuko (REV 2.11)

> **Status:** REV 2.11 (2026-05-30) - selaras proposal: **drop** tabel `raw_materials`, `raw_material_movements`, `vendors`, `purchases`, `purchase_items` + **tambah** tabel `menu_cost_movements` + kolom `menus.cost`, `transaction_items.unit_cost`, `menu_variants.cost_source_menu_id`. Baseline 14 → **10 entitas**, relasi 23 → **17**. Lihat [`docs/superpowers/specs/2026-05-30-cogs-per-menu-remove-belanja-design.md`](superpowers/specs/2026-05-30-cogs-per-menu-remove-belanja-design.md).
> **Sumber kebenaran:** [`docs/knowledge/ERD.md`](knowledge/ERD.md) REV 2.11 §6 (detail kolom per entitas).
> **Mengikuti:** Format standar skripsi UK Petra - `Field | Tipe Data | Keterangan`.

Dokumen ini melengkapi ERD di `Skripsi.mdj`. Setiap entity di ERD punya tabel definisi lengkap di bawah ini. Saat menyalin ke naskah Bab 3, gunakan caption `Tabel 3.X *Definisi Atribut Tabel <nama>*` sesuai mapping di [`docs/knowledge/BAB-3-DRAFT.md`](knowledge/BAB-3-DRAFT.md) seksi "Mapping Gambar dan Tabel".

## Daftar 10 Entitas

| # | Nama Tabel | Tujuan |
|---|---|---|
| 1 | `users` | Pengguna sistem (Pemilik, Kasir, Waiter) |
| 2 | `menus` | Master katalog menu dengan klasifikasi jenis stok, definisi sub-pilihan paket, dan modal/COGS owner-only (`cost`) |
| 3 | `portion_stocks` | Kondisi stok porsi terkini per menu (1:1 dengan menu yang stockType=portion) |
| 4 | `portion_movements` | Audit log perubahan stok porsi (rename dari `stock_movements` di REV 2.2) |
| 5 | `menu_cost_movements` | Audit log perubahan modal/COGS menu (BARU di REV 2.11) |
| 6 | `shifts` | Siklus shift kasir per hari per jenis (pagi/malam) |
| 7 | `transactions` | Header pesanan dengan tipe order, payment, dan merged_into_id untuk merge bill |
| 8 | `transaction_items` | Detail item per transaksi (junction menu × transaksi) dengan sub_options, party_id, dan snapshot `unit_cost` |
| 9 | `settlements` | Rekap akhir hari oleh kasir shift malam (6 totals + breakdown bank di runtime) |
| 10 | `bills` | Tagihan operasional bulanan (owner-only) |

> REV 2.11 drop `raw_materials`, `raw_material_movements`, `vendors`, `purchases`, `purchase_items` (subsistem belanja/raw-materials dihapus; inventori = finished-goods porsi saja).

---

## Tabel 3.2 Tabel `users`

Tabel `users` menyimpan data seluruh pengguna sistem POS yang terbagi dalam tiga peran (Pemilik, Kasir, Waiter) beserta PIN autentikasinya. PIN diperbolehkan duplikat antar pegawai karena identifikasi dilakukan melalui kombinasi nama dan PIN saat login.

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT - PK auto-increment | ID unik pengguna |
| name | VARCHAR(100) | Nama pegawai (Owner, Jason, Bryant, Chen Hong, Amel, Yanti) |
| pin | VARCHAR(6) | PIN 6-digit untuk login. **Boleh duplikat antar pegawai** (identifikasi via nama + PIN, nama jadi identifier unik) |
| role | ENUM(owner, cashier, waiter) | Peran pengguna dalam sistem |
| is_active | BOOLEAN | Status aktif/non-aktif (default true) |
| created_at | DATETIME | Waktu record dibuat |
| updated_at | DATETIME | Waktu update terakhir |

---

## Tabel 3.3 Tabel `menus`

Tabel `menus` menyimpan master katalog 60 menu siap jual beserta harga, kategori, klasifikasi jenis stok (porsi yang ditrack, varian yang berbagi stok, atau tanpa stok), batas minimum stok, dan definisi sub-pilihan dalam format JSON untuk menu paket hemat.

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT - PK auto-increment | ID unik menu |
| name | VARCHAR(100) | Nama menu (contoh: "1 Ekor Ayam Bakar Merah", "Paket A (1 org)") |
| category | VARCHAR(50) | Kategori: "Signature Ayam Bakar", "Seafood", "Sayur & Sup", "Side Dish", "Minuman", "Paket Hemat" |
| price | DECIMAL(10,2) | Harga jual satuan dalam Rupiah |
| cost | DECIMAL(10,2) (nullable) | **REV 2.11**: modal/COGS per unit (owner-only, tidak dibocorkan ke katalog publik/POS). null = belum di-set (dihitung 0 saat hitung laba). Diisi di SKU leaf + menu simple |
| stock_type | ENUM(portion, linked, nonStock) | Klasifikasi: portion=ditrack per porsi, linked=share stok dengan menu lain, nonStock=tanpa stok |
| min_stock | INT (nullable) | Ambang minimum stok (hanya untuk stockType=portion) |
| image_url | VARCHAR(255) (nullable) | Path foto menu (/menu/*.webp) atau URL CDN |
| sub_options | JSON (nullable) | Untuk paket: `{options: [...], stockMap: {...}}` definisi sub-pilihan dan pemetaan stok target |
| is_active | BOOLEAN | Menu aktif (bisa dipesan) atau tidak (default true) |
| created_at | DATETIME | Waktu menu ditambahkan |
| updated_at | DATETIME | Waktu update terakhir |

---

## Tabel 3.4 Tabel `portion_stocks`

Tabel `portion_stocks` menyimpan kondisi stok porsi terkini per menu sebagai *live count* yang terus berubah seiring transaksi (dengan dukungan nilai negatif untuk mengakomodasi situasi habis di tengah hari) beserta kondisi awal hari (*opening qty*) yang otomatis di-*snapshot* saat pengguna pertama login pagi. Tabel ini memiliki relasi satu-ke-satu dengan tabel `menus` untuk menu yang memiliki `stock_type=portion`.

| Field | Tipe Data | Keterangan |
|---|---|---|
| menu_id | INT - PK + FK → menus | Primary key sekaligus foreign key (1:1 dengan menu) |
| current_qty | INT | *Live count* stok porsi. **Boleh negatif** (dukungan stok minus saat habis di tengah hari) |
| min_stock | INT | Ambang reminder restock (duplikat dari `menus.min_stock` untuk kemudahan query) |
| opening_qty_today | INT | *Snapshot* otomatis kondisi stok saat pengguna pertama login pagi. Dipakai untuk metric "terjual hari ini" |
| opening_qty_date | DATE | Tanggal *snapshot* (dipakai untuk trigger re-snapshot di hari baru) |
| updated_at | DATETIME | Waktu update terakhir |

> Metric "Terjual Hari Ini" dihitung di *runtime* sebagai `opening_qty_today + sum(restock_today) − current_qty` di mana `restock_today` diambil dari `portion_movements.delta WHERE reason IN ('restock_morning','restock_emergency') AND DATE(created_at)=today`.

---

## Tabel 3.5 Tabel `portion_movements`

Tabel `portion_movements` (revisi penyesuaian nama dari `stock_movements` pada REV 2.2 untuk memperjelas cakupan) menyimpan log audit setiap perubahan stok porsi beserta alasan dan pengguna yang melakukannya. Setiap perubahan `portion_stocks.current_qty` - baik akibat order, restock pagi, restock darurat, opname pagi, maupun pengembalian/void - akan menyisipkan satu *record* di tabel ini sehingga jejak perubahan stok dapat ditelusuri.

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT - PK auto-increment | ID unik log |
| menu_id | INT - FK → menus | Item stok porsi yang berubah |
| delta | INT | Perubahan: positif saat restock, negatif saat order/void |
| reason | ENUM(order, restock_morning, restock_emergency, manual_adjust, refund_void) | Alasan perubahan |
| transaction_id | INT - FK → transactions (nullable, SET NULL) | REV 2.8: transaksi sumber (diisi saat reason order/refund_void; null untuk restock/opname) |
| transaction_item_id | INT - FK → transaction_items (nullable, SET NULL) | REV 2.8: baris item penyebab decrement (1 item paket bisa men-decrement banyak stok) |
| qty_before | INT (nullable) | REV 2.8: stok sebelum perubahan ini |
| qty_after | INT (nullable) | REV 2.8: stok sesudah (`qty_after = qty_before + delta`) |
| note | VARCHAR(255) (nullable) | Catatan manusiawi opsional (REV 2.8: bukan lagi sumber tautan — pakai FK; mis. "Antar via Gojek 18:30") |
| user_id | INT - FK → users | Pengguna yang men-trigger perubahan |
| created_at | DATETIME | Waktu perubahan |

> REV 2.8 (ledger integrity): tautan ke dokumen sumber dipindah dari teks `note` ke *foreign key* proper (`transaction_id`, `transaction_item_id`) dengan `ON DELETE SET NULL` agar jejak audit tetap utuh meski item/transaksi terhapus. Kolom `qty_before`/`qty_after` membuat tiap *record* mandiri (level stok saat itu tanpa menjumlah seluruh histori).

---

## Tabel 3.6 Tabel `menu_cost_movements`

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

## Tabel 3.7 Tabel `shifts`

Tabel `shifts` mencatat siklus shift per kasir per hari per jenis (pagi atau malam) beserta modal awal laci kas yang diinput saat buka kasir. Kombinasi `(date, cashier_id, type)` bersifat unik - satu kasir tidak dapat membuka dua shift dengan jenis yang sama dalam satu hari.

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT - PK auto-increment | ID unik shift |
| date | DATE | Tanggal shift (bagian dari UNIQUE(date, cashier_id, type)) |
| type | ENUM(pagi, malam) | Jenis shift |
| cashier_id | INT - FK → users | Kasir yang membuka shift |
| opening_cash | DECIMAL(12,2) | Modal awal laci kas saat buka kasir |
| closed_at | DATETIME (nullable) | Waktu tutup kasir (null = shift masih terbuka) |
| created_at | DATETIME | Waktu shift dibuat (saat buka kasir) |

---

## Tabel 3.8 Tabel `transactions`

Tabel `transactions` menyimpan *header* pesanan dengan dua tipe order (dine-in atau takeaway), nomor meja yang opsional, status pesanan, metode pembayaran beserta nama bank pendamping yang terisi khusus untuk metode EDC dan transfer (agar laporan rekonsiliasi dapat dilakukan per bank), rincian nominal termasuk pajak PB1 10%, dan *self-reference* `merged_into_id` untuk mengakomodasi fitur merge bill.

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT - PK auto-increment | ID unik transaksi |
| shift_id | INT - FK → shifts | Shift di mana transaksi dilakukan |
| order_type | ENUM(dineIn, takeaway) | Dua tipe order saja (sumber takeaway dibedakan via payment_method) |
| table_number | INT (nullable) | Nomor meja (wajib untuk dineIn, null untuk takeaway) |
| cashier_id | INT - FK → users | Kasir atau waiter (fallback) yang menginput |
| status | ENUM(open, paid, void) | open=belum bayar, paid=lunas, void=batal |
| payment_method | ENUM(cash, edc, qris, gojek, grab, transfer) (nullable) | Diisi saat status berubah ke paid |
| payment_bank | VARCHAR(50) (nullable) | Nama bank - terisi hanya kalau payment_method=edc atau transfer (mis. "BCA", "Mandiri") |
| merged_into_id | INT - FK → transactions (self, nullable) | ID transaksi parent gabungan jika transaksi ini sudah di-merge ke transaksi lain |
| subtotal | DECIMAL(12,2) | Total sebelum diskon dan pajak (Σ subtotal items) |
| discount_amount | DECIMAL(12,2) | Nominal diskon manual (default 0) |
| tax_amount | DECIMAL(12,2) | PB1 10% auto-hitung dari (subtotal − discount) |
| total | DECIMAL(12,2) | subtotal − discount + tax |
| created_at | DATETIME | Waktu transaksi dibuka |
| paid_at | DATETIME (nullable) | Waktu pembayaran |
| voided_at | DATETIME (nullable) | Waktu transaksi dibatalkan |

---

## Tabel 3.9 Tabel `transaction_items`

Tabel `transaction_items` menyimpan rincian item per transaksi sebagai entitas asosiatif (*junction*) antara `menus` dan `transactions`. Selain jumlah dan harga *snapshot* saat order, tabel ini menyimpan modal/COGS *snapshot* (`unit_cost`), hasil pilihan *sub-options* untuk menu paket, dan identifier pelanggan (*party id*) untuk dukungan *split bill*.

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT - PK auto-increment | ID unik item transaksi |
| transaction_id | INT - FK → transactions (CASCADE) | Transaksi parent (ON DELETE CASCADE) |
| menu_id | INT - FK → menus | Menu yang dipesan |
| qty | INT | Jumlah porsi |
| unit_price | DECIMAL(10,2) | Harga jual per satuan saat order (*snapshot*, immutable) |
| unit_cost | DECIMAL(10,2) (nullable) | **REV 2.11**: modal/COGS per satuan saat order (*snapshot*, mirror unit_price). Untuk paket = Σ modal komponen. null = baris historis pra-backfill (dihitung 0). Laba kotor: Σ unit_cost × qty |
| subtotal | DECIMAL(12,2) | qty × unit_price |
| sub_options_selected | JSON (nullable) | Hasil pilihan SubOptionsModal untuk paket (mis. `{ayamPart:"Paha", cook:"Bakar"}`) |
| party_id | INT (nullable) | Split bill grouping: item dengan party_id sama = 1 struk terpisah. null = tidak di-split |
| created_at | DATETIME | Waktu item ditambahkan |

---

## Tabel 3.10 Tabel `settlements`

Tabel `settlements` menyimpan rekap akhir hari oleh kasir shift malam dengan enam total metode pembayaran (sistem dan fisik). Rincian per bank untuk EDC dan transfer dihitung di *runtime* dari tabel transaksi (group by payment_bank), sehingga tidak disimpan duplikat di tabel ini. Varians per metode juga dihitung di *runtime* sebagai selisih `actual − system`.

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT - PK auto-increment | ID unik settlement |
| shift_id | INT - FK → shifts (UNIQUE) | Shift terkait (1:1, hanya shift malam yang punya settlement) |
| date | DATE | Tanggal settlement |
| cashier_id | INT - FK → users | Kasir shift malam yang submit |
| reviewer_id | INT - FK → users (nullable) | Pemilik yang review (null sampai direview) |
| system_cash | DECIMAL(12,2) | Total cash di sistem |
| system_edc | DECIMAL(12,2) | Total EDC di sistem (semua bank gabung; breakdown bank di runtime) |
| system_qris | DECIMAL(12,2) | Total QRIS di sistem |
| system_gojek | DECIMAL(12,2) | Total Gojek (settlement) di sistem |
| system_grab | DECIMAL(12,2) | Total Grab (settlement) di sistem |
| system_transfer | DECIMAL(12,2) | Total transfer di sistem (semua bank gabung) |
| actual_cash | DECIMAL(12,2) | Total fisik cash dari laci kas |
| actual_edc | DECIMAL(12,2) | Total fisik EDC dari struk |
| actual_qris | DECIMAL(12,2) | Total fisik QRIS dari aplikasi |
| actual_gojek | DECIMAL(12,2) | Total fisik settlement Gojek |
| actual_grab | DECIMAL(12,2) | Total fisik settlement Grab |
| actual_transfer | DECIMAL(12,2) | Total fisik transfer dari mutasi rekening |
| status | ENUM(submitted, reviewed) | Status settlement |
| submitted_at | DATETIME | Waktu kasir submit |
| reviewed_at | DATETIME (nullable) | Waktu pemilik review (null sampai direview) |

---

## Tabel 3.11 Tabel `bills`

Tabel `bills` menyimpan tagihan operasional bulanan yang hanya dapat diakses oleh Pemilik. Kategori tagihan terbatas pada lima jenis tetap (kebersihan, listrik, air, parkir, sewa). Kasir tidak memiliki akses ke tabel ini meskipun kasir merupakan anggota keluarga pemilik - validasi peran pengguna diterapkan di layer *service*.

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT - PK auto-increment | ID unik tagihan |
| month | VARCHAR(7) | Bulan tagihan dalam format YYYY-MM (mis. "2026-05") |
| category | ENUM(kebersihan, listrik, air, parkir, sewa) | Kategori tagihan operasional |
| amount | DECIMAL(12,2) | Nominal tagihan |
| note | VARCHAR(255) (nullable) | Catatan opsional |
| user_id | INT - FK → users | Pemilik yang menginput (validasi role=owner di service layer) |
| created_at | DATETIME | Waktu tagihan diinput |

---

## Definisi Enum

```prisma
enum UserRole                  { owner, cashier, waiter }
enum TransactionStatus         { open, paid, void }
enum OrderType                 { dineIn, takeaway }
enum PaymentMethod             { cash, edc, qris, gojek, grab, transfer }
enum SettlementStatus          { submitted, reviewed }
enum ShiftType                 { pagi, malam }
enum StockType                 { portion, linked, nonStock }
enum PortionMovementReason     { order, restock_morning, restock_emergency, manual_adjust, refund_void }
enum MenuCostChangeReason      { initialSet, manualEdit }
enum BillCategory              { kebersihan, listrik, air, parkir, sewa }
```

---

## Ringkasan 17 Relasi

| # | Parent (1) | Child (N) | FK | Cardinality | Catatan |
|---|---|---|---|---|---|
| 1 | users | transactions | cashier_id | 1 : N | Kasir/waiter input transaksi |
| 2 | users | shifts | cashier_id | 1 : N | Modal awal per shift |
| 3 | users | settlements | cashier_id | 1 : N | Kasir malam yang submit |
| 4 | users | settlements | reviewer_id (nullable) | 0..1 : N | Pemilik yang review |
| 5 | users | bills | user_id | 1 : N | Pemilik input tagihan |
| 6 | users | portion_movements | user_id | 1 : N | Audit trail stok porsi |
| 7 | users | menu_cost_movements | user_id | 1 : N | **REV 2.11 BARU**: owner pengubah modal/COGS |
| 8 | shifts | transactions | shift_id | 1 : N | Transaksi ter-attach ke shift |
| 9 | shifts | settlements | shift_id (UNIQUE) | 1 : 1 | Settlement tutup shift |
| 10 | menus | portion_stocks | menu_id | 1 : 0..1 | Hanya menu stockType=portion yang punya stok |
| 11 | menus | transaction_items | menu_id | 1 : N | Riwayat order per menu |
| 12 | menus | portion_movements | menu_id | 1 : N | Audit perubahan stok porsi |
| 13 | menus | menu_cost_movements | menu_id | 1 : N | **REV 2.11 BARU**: audit perubahan modal/COGS menu |
| 14 | transactions | transaction_items | transaction_id (CASCADE) | 1 : 1..N | Komposisi (item hidup bersama transaksi) |
| 15 | transactions | transactions | merged_into_id (self, nullable) | 0..1 : N | Merge bill (transaksi sumber → parent gabungan) |
| 16 | transactions | portion_movements | transaction_id (nullable, SET NULL) | 1 : N | REV 2.8: movement order/void ke transaksi sumber |
| 17 | transaction_items | portion_movements | transaction_item_id (nullable, SET NULL) | 1 : N | REV 2.8: movement ke baris item penyebab decrement |

Total (baseline REV 2.11): **10 entitas, 17 relasi**. (Diff dari REV 2.8: drop 8 relasi belanja/raw-materials, tambah 2 relasi `menu_cost_movements`.) Catatan: entitas REV 2.5–2.7 — `payment_methods`, `banks`, `payment_method_banks`, `settlement_method_counts`, `app_settings`, `transaction_payments` — serta tabel menu variants REV 2.10 (`menu_variants` + kolom `cost_source_menu_id` REV 2.11, `paket_components`) terdokumentasi di spec masing-masing dan `schema.prisma`, belum dilipat ke dictionary ini.

---

## Konvensi Naming

- **Entity**: snake_case plural lowercase (`users`, `portion_stocks`, `portion_movements`, `menu_cost_movements`, `transaction_items`)
- **Kolom**: snake_case (`created_at`, `menu_id`, `current_qty`, `unit_cost`, `cost_before`)
- **Primary key**: kolom `id` INT auto-increment, kecuali `portion_stocks` yang PK-nya `menu_id` (1:1 dengan menu)
- **Foreign key**: `<entity>_id` merujuk ke `<entity>.id`
- **Enum values**: lowercase underscore (`restock_morning`, `manual_adjust`) atau camelCase untuk enum baru (`initialSet`, `manualEdit`)
- **Tipe data**:
  - `INT` untuk PK dan FK
  - `VARCHAR(n)` untuk string pendek
  - `DECIMAL(p, s)` untuk uang dan kuantitas: `Decimal(10,2)` untuk price/qty, `Decimal(12,2)` untuk total/subtotal
  - `DATE` untuk tanggal tanpa jam
  - `DATETIME` untuk audit (created_at, updated_at)
  - `ENUM(...)` untuk status/kategori terbatas
  - `JSON` untuk konfigurasi struktur dinamis (`menus.sub_options`, `transaction_items.sub_options_selected`)

---

## Catatan untuk Naskah Bab 3

- Setiap tabel dilengkapi paragraf pengantar 1 kalimat (lihat mapping di [`docs/knowledge/BAB-3-DRAFT.md`](knowledge/BAB-3-DRAFT.md) seksi "3.2.5 Data Dictionary").
- Caption tabel pakai format `**Tabel 3.X** *Definisi Atribut Tabel <nama>*` (Tabel 3.2 untuk `users` hingga Tabel 3.11 untuk `bills` - Tabel 3.1 sudah dipakai untuk "Kebutuhan Informasi per Peran Pengguna").
- ERD visual otoritatif ada di `Skripsi.mdj` (StarUML); **REV 2.11 visual pending rebuild** (drop entitas belanja/raw-materials + tambah `menu_cost_movements`). Data dictionary ini = dokumentasi tekstual yang menyertai ERD.
- Apabila tabel diubah (add/drop kolom), update **ERD.md, BAB-3-DRAFT.md, dan dictionary ini secara bersamaan** agar konsisten.
- **Permission per peran (REV 2.3)**: tidak diatur di tingkat database tetapi di *app layer* (backend *middleware* + frontend conditional UI). Tabel `users.role` enum tetap menjadi *single source of truth*. Lihat `docs/operasional-resto.md` seksi "Permission Matrix" dan `docs/superpowers/specs/2026-05-24-permission-matrix-design.md` untuk detail.

---

## Riwayat Versi

| Versi | Tanggal | Perubahan |
|---|---|---|
| **REV 2.11** | 2026-05-30 | Drop tabel `raw_materials`, `raw_material_movements`, `vendors`, `purchases`, `purchase_items` + enum `RawMaterialMovementReason`/`RawMaterialCategory`. Tambah tabel `menu_cost_movements` + enum `MenuCostChangeReason` + kolom `menus.cost`, `transaction_items.unit_cost`, `menu_variants.cost_source_menu_id`. Total 14 → **10 entitas**, 23 → **17 relasi**. Inventori = finished-goods porsi saja; laba kotor = pendapatan − COGS (selaras proposal). |
| **REV 2.8** | 2026-05-29 | Stock ledger integrity: tambah FK sumber + qty snapshot di `portion_movements` (`transaction_id`, `transaction_item_id`, `qty_before`, `qty_after`) & `raw_material_movements` (`purchase_id`, `purchase_item_id`, `qty_before`, `qty_after`). Semua FK `ON DELETE SET NULL`. +4 relasi (19 → 23). `note` jadi konteks manusiawi (tautan via FK). *(Tabel raw_material_movements kemudian dihapus di REV 2.11.)* |
| **REV 2.3** | 2026-05-24 | Schema identik REV 2.2 (no entity/column change). Tambah catatan permission di app layer. |
| **REV 2.2** | 2026-05-24 | Tambah `raw_material_movements` (audit log raw materials). Rename `stock_movements` → `portion_movements`. Total 13 → 14 entitas, 17 → 19 relasi. |
| **REV 2.1** | 2026-05-23 | Tambah `raw_materials`, `vendors`, `purchases`, `purchase_items`. Drop `bulk_stocks` dan `expenses`. OrderType 2 enum. `payment_bank` field. `opening_qty_today`. `merged_into_id` self-ref. Total 8 → 13 entitas. |
| **REV 1** | (historical) | 8 entitas dengan role `kitchen`, PIN unique, `daily_menu_stocks`, `expenses`, payment_method debit/credit/ojol. |
