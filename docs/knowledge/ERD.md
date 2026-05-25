# ERD — Sistem POS Ayam Bakar Banjar Monosuko (REV 2.3)

> **Status:** REV 2.3 (2026-05-24) — version bump kosmetik untuk align dengan permission matrix REV 2.3. **Tidak ada perubahan schema** dari REV 2.2 — tetap 14 entitas, 19 relasi. Permission ditangani di app layer (middleware + frontend conditional UI), bukan di database. Lihat [`docs/superpowers/specs/2026-05-24-permission-matrix-design.md`](../superpowers/specs/2026-05-24-permission-matrix-design.md) §3 untuk konfirmasi.
> **Sumber alur bisnis:** [`docs/operasional-resto.md`](../operasional-resto.md) REV 2.3 (sumber kebenaran tertinggi)
> **Schema implementasi:** [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma) (saat ini masih REV 2 — perlu rewrite mengikut dokumen ini)
> **Visual:** ERD REV 2.2 sudah di-build di StarUML (file `Skripsi.mdj`). REV 2.3 tidak butuh rebuild — schema identik.

> ⚠️ **Riwayat versi:**
> - **REV 2.3 (2026-05-24)** — version bump kosmetik. No schema change. Hanya alignment dengan permission matrix.
> - **REV 2.2 (2026-05-24)** — tambah `raw_material_movements` (audit log raw materials) + rename `stock_movements` → `portion_movements`. Total entitas naik 13 → 14, relasi naik 17 → 19.
> - **REV 2.1 (2026-05-23)** — order type 2 enum, raw_materials fleksibel, vendor opsional, purchase_items normalized.

---

## 1. Apa itu ERD?

Entity Relationship Diagram (ERD) menggambarkan **struktur data tersimpan** dalam sistem — tabel, kolom, tipe data, dan relasi antar-tabel. ERD dibuat pada tahap perancangan database, setelah use case diagram dan sebelum implementasi skema DBMS.

ERD beda dari Class Diagram:
- **ERD** = desain database: tabel, kolom, PK/FK, cardinality
- **Class Diagram** (UML) = desain object-oriented: class dengan atribut + method + inheritance

Skripsi POS ABM hanya pakai ERD (tidak butuh class diagram terpisah).

## 2. Kegunaan untuk Skripsi

1. **Blueprint database** — acuan `CREATE TABLE` dan migration Prisma.
2. **Validasi integritas data** — semua FK ada; setiap entitas punya PK.
3. **Bab 3 skripsi** — ERD visual + data dictionary tabular = komplit.
4. **Komunikasi ke dosen pembimbing & penguji** — convention crow's-foot yang umum di UK Petra.

## 3. Konvensi (REV 2.2)

- **Naming entity**: snake_case plural lowercase (`users`, `menus`, `portion_stocks`, `portion_movements`, `raw_materials`, `raw_material_movements`, `vendors`, `purchases`, `purchase_items`, `bills`).
- **Naming column**: snake_case (`created_at`, `menu_id`, `current_qty`, `min_stock`, `is_tracked`).
- **Primary key**: kolom `id` int auto-increment (kecuali `portion_stocks` yang PK-nya `menu_id` karena 1:1 dengan Menu).
- **Foreign key**: `<entity>_id` referring to `<entity>.id`. Marker `FK → <entity>`.
- **Tipe data**:
  - `INT` untuk PK & FK
  - `VARCHAR(n)` untuk string pendek
  - `DECIMAL(p, s)` untuk uang dan kuantitas raw material: `Decimal(10,2)` untuk price/qty, `Decimal(12,2)` untuk total/subtotal
  - `DATE` untuk tanggal tanpa jam
  - `DATETIME` untuk audit (`created_at`, `updated_at`)
  - `ENUM(...)` untuk status/kategori terbatas
  - `JSON` untuk konfigurasi struktur dinamis (mis. `menus.sub_options` saja)
- **M:N harus via junction**: relasi `menus × transactions` di-resolve via `transaction_items`; `raw_materials × purchases` di-resolve via `purchase_items`.

## 4. Enum Definitions (REV 2.2)

```prisma
enum UserRole                  { owner, cashier, waiter }                          // kitchen DIHAPUS
enum TransactionStatus         { open, paid, void }                                // tetap
enum OrderType                 { dineIn, takeaway }                                // disederhanakan dari 5 jadi 2
enum PaymentMethod             { cash, edc, qris, gojek, grab, transfer }          // edc & transfer dipisah per bank via field payment_bank
enum SettlementStatus          { submitted, reviewed }                             // drop "pending"
enum ShiftType                 { pagi, malam }                                     // 2 shift fixed
enum StockType                 { portion, linked, nonStock }                       // klasifikasi menu untuk stok
enum PortionMovementReason     { order, restock_morning, restock_emergency,        // REV 2.2: RENAME dari StockMovementReason
                                 manual_adjust, refund_void }
enum RawMaterialMovementReason { purchase, opname, manual_adjust }                 // REV 2.2: BARU — audit log raw materials
enum RawMaterialCategory       { bumbu_dasar, bahan_segar, bahan_pokok,            // ganti BulkStockKind
                                 bahan_kering, lainnya }
enum BillCategory              { kebersihan, listrik, air, parkir, sewa }          // tagihan operasional
```

## 5. Empat Belas Entitas REV 2.2

| #   | Entity                   | Purpose                                                            | Notes                                                                |
| --- | ------------------------ | ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 1   | `users`                  | Pengguna: owner, kasir, waiter                                     | PIN BOLEH DUPLIKAT (drop unique constraint)                          |
| 2   | `menus`                  | Katalog menu dengan stockType, minStock, subOptions                | 60 item (25 porsi + linked + non-stok + 5 paket)                     |
| 3   | `portion_stocks`         | Live count stok porsi per menu + opening snapshot pagi             | 1:1 dengan Menu (stockType=portion), boleh minus                     |
| 4   | `portion_movements`      | Audit log perubahan stok porsi (REV 2.2: RENAME dari stock_movements) | delta +/- per order/restock/adjust dengan reason                  |
| 5   | `raw_materials`          | Bahan baku fleksibel                                               | is_tracked + category + unit varchar bebas + freshness_days?         |
| 6   | `raw_material_movements` | **Audit log perubahan raw materials (REV 2.2: BARU)**              | delta +/- per purchase/opname/adjust dengan reason + user pelaku     |
| 7   | `vendors`                | Toko/pasar tempat belanja (opsional)                               | Phone & note opsional karena di pasar kadang lupa nama penjual       |
| 8   | `shifts`                 | Siklus shift per kasir per tipe per tanggal                        | `type` (pagi/malam), unique (date, cashier, type), modal awal        |
| 9   | `transactions`           | Header pesanan                                                     | `orderType` 2 enum, `payment_bank` (edc/transfer), `merged_into_id?` |
| 10  | `transaction_items`      | Junction menu × transactions                                       | `sub_options_selected` (JSON), `party_id` (split bill)               |
| 11  | `settlements`            | Rekap akhir hari (simpel, 6 totals, breakdown bank di runtime)     | 1:1 dengan shift malam saja                                          |
| 12  | `purchases`              | Header log belanja kasir (normalized)                              | Header saja: date, vendor?, total, note. Detail di `purchase_items`. |
| 13  | `purchase_items`         | Detail per item dalam 1 purchase                                   | FK ke raw_materials. Auto-update stock_qty + log raw_material_movements saat submit. |
| 14  | `bills`                  | Tagihan operasional bulanan owner                                  | Owner-only, kategori kebersihan/listrik/air/parkir/sewa              |

Total: **14 entitas**.

## 6. Detail Kolom Per Entitas

### 6.1. `users`
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | Auto-increment |
| name | VARCHAR(100) | — | Nama pegawai (Owner, Jason, Bryant, Chen Hong, Amel, Yanti) |
| pin | VARCHAR(6) | — | 6 digit, **boleh duplikat antar pegawai** |
| role | UserRole | — | owner / cashier / waiter |
| is_active | BOOLEAN | — | Default true |
| created_at, updated_at | DATETIME | — | Audit |

### 6.2. `menus`
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | |
| name | VARCHAR(100) | — | mis. "1 Ekor Ayam Bakar Merah", "Paket A (1 org)" |
| category | VARCHAR(50) | — | "Signature Ayam Bakar", "Seafood", "Sayur & Sup", "Side Dish", "Minuman", "Paket Hemat" |
| price | DECIMAL(10,2) | — | Rupiah |
| stock_type | StockType | — | portion / linked / nonStock |
| min_stock | INT? | — | Hanya untuk stockType=portion |
| image_url | VARCHAR(255)? | — | Path foto (/menu/*.webp) atau URL CDN |
| sub_options | JSON? | — | Untuk paket: `{options: [...], stockMap: {...}}`. Untuk linked: `{stockTarget: "Menu Name"}` |
| is_active | BOOLEAN | — | Default true |
| created_at, updated_at | DATETIME | — | |

### 6.3. `portion_stocks`
| Kolom              | Tipe     | PK/FK/UK      | Keterangan                                                              |
| ------------------ | -------- | ------------- | ----------------------------------------------------------------------- |
| menu_id            | INT      | PK + FK→menus | 1:1 dengan Menu stockType=portion                                       |
| current_qty        | INT      | —             | Live count, BOLEH NEGATIF (stok minus didukung)                         |
| min_stock          | INT      | —             | Ambang reminder (duplicate dari menus.min_stock untuk query convenience) |
| opening_qty_today  | INT      | —             | Snapshot otomatis qty saat user pertama login pagi                       |
| opening_qty_date   | DATE     | —             | Tanggal snapshot, dipakai untuk trigger re-snapshot hari baru            |
| updated_at         | DATETIME | —             |                                                                         |

> Metric "Terjual Hari Ini" = `opening_qty_today + restock_today − current_qty`. Restock hari ini dihitung dari `SUM(portion_movements.delta WHERE reason IN ('restock_morning','restock_emergency') AND created_at::date = today)`.

### 6.4. `portion_movements` (REV 2.2 — RENAME dari `stock_movements`)
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | |
| menu_id | INT | FK→menus | Item stok porsi yang berubah |
| delta | INT | — | + saat restock, − saat order |
| reason | PortionMovementReason | — | order / restock_morning / restock_emergency / manual_adjust / refund_void |
| note | VARCHAR(255)? | — | Mis. "transactionId=123" atau "Antar via Gojek 18:30" |
| user_id | INT | FK→users | Siapa yang trigger |
| created_at | DATETIME | — | |

### 6.5. `raw_materials`
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | |
| name | VARCHAR(100) | — | mis. "Kangkung", "Beras", "Tahu", "Cabai Rawit", "Bawang Putih" |
| unit | VARCHAR(20) | — | Satuan bebas: ikat / karung / balok / butir / gram / liter / skala / pcs |
| category | RawMaterialCategory | — | bumbu_dasar / bahan_segar / bahan_pokok / bahan_kering / lainnya |
| is_tracked | BOOLEAN | — | true = stok di-update saat beli + muncul di reminder. false = cuma log pengeluaran |
| stock_qty | DECIMAL(10,2) | — | Kondisi stok saat ini (relevan hanya bila is_tracked=true) |
| min_stock | INT? | — | Ambang reminder restock (kalau is_tracked=true) |
| unit_price | DECIMAL(10,2)? | — | Harga per unit terakhir (auto-update saat purchase baru) |
| freshness_days | INT? | — | Untuk perishable (mis. 10 untuk kangkung). Reminder mendekati basi 3 hari sebelum batas |
| last_buy_date | DATE? | — | Tanggal pembelian terakhir (auto-update dari purchase_items submit) |
| created_at, updated_at | DATETIME | — | |

### 6.6. `raw_material_movements` (REV 2.2 — BARU, audit log raw materials)
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | |
| raw_material_id | INT | FK→raw_materials | Bahan baku yang berubah |
| delta | DECIMAL(10,2) | — | + saat purchase atau koreksi naik, − saat opname turun atau koreksi turun |
| reason | RawMaterialMovementReason | — | purchase / opname / manual_adjust |
| note | VARCHAR(255)? | — | Mis. "Opname malam: kangkung 0 ikat, sebelum 2 ikat" atau "Purchase from Pasar Pagi Blok A" |
| user_id | INT | FK→users | Siapa yang trigger (kasir untuk purchase, waiter/kasir untuk opname) |
| created_at | DATETIME | — | |

> Auto-generated rows:
> - Setiap `purchase_item` yang submit dengan raw_material `is_tracked=true` → 1 row dengan reason=`purchase`, delta=+qty, note="Purchase id=X"
> - Setiap submit opname raw materials yang mengubah `stock_qty` → 1 row per item dengan reason=`opname`, delta=selisih, note="Opname malam: dari X jadi Y"
> - Owner/kasir koreksi manual via halaman Raw Materials → reason=`manual_adjust`

### 6.7. `vendors`
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | |
| name | VARCHAR(100) | — | mis. "Bu Sari", "Pasar Pagi Blok A", "Toko Pak Budi" |
| type | VARCHAR(50) | — | "toko" / "pasar" / "individu" |
| phone | VARCHAR(20)? | — | Opsional — di pasar kadang penjual tidak punya nomor yang sempat dicatat |
| note | VARCHAR(255)? | — | Opsional |
| created_at, updated_at | DATETIME | — | |

### 6.8. `shifts`
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | |
| date | DATE | — | + cashier_id + type = UNIQUE |
| type | ShiftType | — | pagi / malam |
| cashier_id | INT | FK→users | |
| opening_cash | DECIMAL(12,2) | — | Modal awal laci kas |
| closed_at | DATETIME? | — | null = shift terbuka |
| created_at | DATETIME | — | |

### 6.9. `transactions`
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | |
| shift_id | INT | FK→shifts | |
| order_type | OrderType | — | **dineIn / takeaway** (cuma 2 enum) |
| table_number | INT? | — | NULLABLE — hanya wajib untuk dineIn |
| cashier_id | INT | FK→users | Kasir/waiter yang input |
| status | TransactionStatus | — | open / paid / void |
| payment_method | PaymentMethod? | — | Set saat paid |
| payment_bank | VARCHAR(50)? | — | Terisi hanya kalau payment=edc/transfer (mis. "BCA", "Mandiri") |
| merged_into_id | INT? | FK→transactions (self) | Kalau transaksi ini sudah di-merge ke transaksi lain, isi ID parent gabungan |
| subtotal | DECIMAL(12,2) | — | Σ subtotal items |
| discount_amount | DECIMAL(12,2) | — | Diskon manual |
| tax_amount | DECIMAL(12,2) | — | PB1 10% otomatis dari (subtotal − discount) |
| total | DECIMAL(12,2) | — | subtotal − discount + tax |
| created_at, paid_at, voided_at | DATETIME | — | |

### 6.10. `transaction_items`
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | |
| transaction_id | INT | FK→transactions (CASCADE) | |
| menu_id | INT | FK→menus | |
| qty | INT | — | |
| unit_price | DECIMAL(10,2) | — | Snapshot harga saat order |
| subtotal | DECIMAL(12,2) | — | qty × unit_price |
| sub_options_selected | JSON? | — | Hasil pilihan SubOptionsModal untuk paket, mis. `{ayamPart:"Paha", cook:"Bakar"}` |
| party_id | INT? | — | Split bill grouping: item dengan party_id sama = 1 struk terpisah. null = tidak split |
| created_at | DATETIME | — | |

### 6.11. `settlements`
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | |
| shift_id | INT | FK→shifts UK | 1:1 dengan shift malam (kasir malam saja yg settle) |
| date | DATE | — | |
| cashier_id | INT | FK→users | |
| reviewer_id | INT? | FK→users | Owner yg review |
| system_cash | DECIMAL(12,2) | — | Total dari sistem per metode |
| system_edc | DECIMAL(12,2) | — | |
| system_qris | DECIMAL(12,2) | — | |
| system_gojek | DECIMAL(12,2) | — | |
| system_grab | DECIMAL(12,2) | — | |
| system_transfer | DECIMAL(12,2) | — | |
| actual_cash, actual_edc, actual_qris, actual_gojek, actual_grab, actual_transfer | DECIMAL(12,2) | — | Total fisik input kasir |
| status | SettlementStatus | — | submitted / reviewed |
| submitted_at, reviewed_at | DATETIME | — | |

> Variance per metode dihitung di runtime (`actual − system`), tidak disimpan.
> Breakdown per bank untuk EDC & transfer dihitung di runtime dari `transactions GROUP BY payment_bank` di tanggal yang sama, tidak disimpan di tabel ini.

### 6.12. `purchases`
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | |
| date | DATE | — | Tanggal belanja |
| user_id | INT | FK→users | Kasir/owner yg input |
| vendor_id | INT? | FK→vendors | OPSIONAL (di pasar kadang lupa nama penjual) |
| total_amount | DECIMAL(12,2) | — | Sum subtotal `purchase_items` (auto-hitung saat submit) |
| note | VARCHAR(255)? | — | Opsional |
| created_at | DATETIME | — | |

### 6.13. `purchase_items`
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | |
| purchase_id | INT | FK→purchases (CASCADE) | Detail terhapus saat header di-delete |
| raw_material_id | INT | FK→raw_materials | Raw material yang dibeli |
| qty | DECIMAL(10,2) | — | Jumlah yang dibeli |
| unit_price | DECIMAL(10,2) | — | Harga per unit (akan jadi `raw_materials.unit_price` baru) |
| subtotal | DECIMAL(12,2) | — | qty × unit_price |
| expired_date | DATE? | — | Opsional, untuk perishable |
| created_at | DATETIME | — | |

> Saat `purchase_item` di-submit, sistem auto-update `raw_materials`:
> - `stock_qty += qty` (kalau is_tracked=true)
> - `last_buy_date = purchase.date`
> - `unit_price = item.unit_price` (overwrite ke harga terakhir)
>
> **Plus REV 2.2:** sistem auto-insert ke `raw_material_movements` (reason=`purchase`, delta=+qty, user_id=purchase.user_id, note="Purchase id=X dari Vendor Y") untuk audit trail.

### 6.14. `bills`
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | |
| month | VARCHAR(7) | — | YYYY-MM |
| category | BillCategory | — | kebersihan / listrik / air / parkir / sewa |
| amount | DECIMAL(12,2) | — | |
| note | VARCHAR(255)? | — | |
| user_id | INT | FK→users | OWNER ONLY (validation di layer service) |
| created_at | DATETIME | — | |

## 7. Sembilan Belas Relasi REV 2.2

| # | Parent | Child | Via | Cardinality | Catatan |
|---|---|---|---|---|---|
| 1 | users | transactions | cashier_id | 1 : N | Kasir/waiter input transaksi |
| 2 | users | shifts | cashier_id | 1 : N | Modal awal per shift |
| 3 | users | settlements | cashier_id | 1 : N | Kasir malam yg submit |
| 4 | users | settlements | reviewer_id (nullable) | 0..1 : N | Owner yg review |
| 5 | users | purchases | user_id | 1 : N | Kasir/owner input belanja |
| 6 | users | bills | user_id | 1 : N | Owner input tagihan |
| 7 | users | portion_movements | user_id | 1 : N | Audit trail stok porsi |
| 8 | users | raw_material_movements | user_id | 1 : N | **REV 2.2 BARU** — audit trail raw materials |
| 9 | shifts | transactions | shift_id | 1 : N | Transaksi ter-attach ke shift kasir |
| 10 | shifts | settlements | shift_id | 1 : 1 (UNIQUE) | Settlement tutup shift |
| 11 | menus | portion_stocks | menu_id | 1 : 0..1 | Hanya menu stockType=portion punya stok |
| 12 | menus | transaction_items | menu_id | 1 : N | Histori order |
| 13 | menus | portion_movements | menu_id | 1 : N | Audit perubahan stok porsi |
| 14 | transactions | transaction_items | transaction_id | 1 : 1..N (composition, CASCADE) | Item detail |
| 15 | transactions | transactions | merged_into_id (self, nullable) | 0..1 : N | Merge bill (transaksi B & C punya merged_into_id=A) |
| 16 | vendors | purchases | vendor_id (nullable) | 0..1 : N | Vendor opsional di purchase |
| 17 | purchases | purchase_items | purchase_id | 1 : 1..N (composition, CASCADE) | Detail per item |
| 18 | raw_materials | purchase_items | raw_material_id | 1 : N | Histori pembelian per material |
| 19 | raw_materials | raw_material_movements | raw_material_id | 1 : N | **REV 2.2 BARU** — audit perubahan raw materials |

Total: **19 relasi**.

## 8. Mengapa Struktur Ini Menjawab Masalah Skripsi

| Rumusan Masalah (Bab 1.2) | Entitas yang menjawab |
|---|---|
| A. Percepat durasi transaksi | `transactions` (orderType 2 enum sederhana, tax/discount auto, payment_bank) + `transaction_items` (subOptionsSelected + partyId untuk split, merged_into_id untuk merge) |
| B. Percepat rekonsiliasi + kurangi mismatch | `shifts` (modal awal) + `settlements` (6 totals sistem vs aktual, breakdown bank di runtime) |
| C. Manajemen stok harian | `portion_stocks` (live count + opening snapshot) + `portion_movements` (audit) + `raw_materials` (fleksibel dengan reminder) + **`raw_material_movements` (audit pembelian & opname)** |
| #4 Owner tidak tahu pengeluaran | `purchases` + `purchase_items` (kasir belanja, normalized + vendor opsional) + `bills` (owner tagihan) + dashboard reminder |
| #5 Traceability stok | **`portion_movements` + `raw_material_movements`** — semua perubahan stok ter-audit dengan pelaku & timestamp |

## 9. Narasi untuk Bab 3 Skripsi (paste-ready, REV 2.3 — schema identik REV 2.2)

> **3.5.1 Entity Relationship Diagram**
>
> Gambar 3.X menunjukkan Entity Relationship Diagram (ERD) dari Sistem POS Restoran Ayam Bakar Banjar Monosuko. Sistem terdiri dari empat belas entitas utama yang dirancang untuk merepresentasikan operasional restoran dengan dua kategori stok yang dipisah secara struktural beserta audit log masing-masing (stok porsi siap jual yang berkurang otomatis saat transaksi dengan jejak audit di `portion_movements`, dan bahan baku pendukung yang diperbarui manual melalui pencatatan pembelian dan opname dengan jejak audit di `raw_material_movements`), dua tipe order (dine-in dan takeaway yang dibedakan dari ada/tidaknya pemilihan nomor meja, dengan sumber order takeaway diidentifikasi melalui metode pembayaran), serta dua jenis pencatatan keuangan operasional (pembelian belanja harian oleh kasir dan tagihan bulanan oleh owner).
>
> Entitas `users` menyimpan data tiga jenis pengguna: owner, kasir, dan waiter, dengan PIN enam digit yang boleh duplikat karena identifikasi pengguna dilakukan melalui kombinasi nama dan PIN saat login. Entitas `menus` merupakan katalog enam puluh item dengan klasifikasi `stock_type` (portion, linked, atau nonStock) yang menentukan perilaku decrement stok saat transaksi. Untuk menu paket (Paket Keluarga, A, B, C, D), kolom JSON `sub_options` menyimpan definisi sub-pilihan dinamis (misalnya Paha atau Dada, Bakar atau Goreng) beserta pemetaan ke stok porsi yang harus dikurangi.
>
> Entitas `portion_stocks` menyimpan kondisi stok porsi dengan tambahan kolom `opening_qty_today` dan `opening_qty_date` untuk mengakomodasi snapshot otomatis di awal hari — kondisi ini dipakai untuk menghitung metric "terjual hari ini" pada dashboard. Stok porsi diperbolehkan bernilai negatif untuk mendukung skenario customer tetap memesan saat stok habis; pemilik akan mengirim restock darurat dari rumah melalui Gojek atau Grab, dan kasir mencatatnya melalui fitur "Barang Masuk" yang akan tercatat di `portion_movements` dengan reason `restock_emergency`. Setiap perubahan stok porsi (akibat order, restock, atau opname pagi) tercatat di `portion_movements` beserta delta, alasan, pelaku, dan waktu untuk keperluan audit.
>
> Entitas `raw_materials` (penyempurnaan dari desain awal yang menggunakan model rigid `bulk_stocks`) dirancang fleksibel dengan kolom `is_tracked` yang membedakan dua jenis bahan: bahan yang ditrack (beras, sayur, tahu, tempe, telur) yang stok-nya bertambah otomatis saat pembelian dan muncul di reminder restock, serta bahan yang hanya dicatat sebagai log pengeluaran (cabai, bawang, kemiri, dan bumbu kering lainnya yang dikelompokkan di kategori `bumbu_dasar`). Kolom `freshness_days` opsional digunakan untuk bahan perishable seperti sayur dan petai, yang akan memunculkan reminder "mendekati basi" tiga hari sebelum batas kesegaran. Setiap perubahan kondisi raw material — baik karena pembelian, opname malam, maupun koreksi manual — tercatat di `raw_material_movements` (entitas baru REV 2.2) beserta delta, alasan, pelaku, dan waktu, sehingga pemilik dapat melacak setiap perubahan stok bahan baku untuk evaluasi rutin.
>
> Pencatatan pembelian dinormalisasi melalui dua entitas: `purchases` sebagai header (tanggal, vendor opsional, total) dan `purchase_items` sebagai detail per baris item dengan FK ke `raw_materials`. Entitas `vendors` baru dibuat opsional karena di pasar kadang kasir lupa nama penjual atau penjualnya perorangan tanpa nomor telepon yang sempat dicatat. Saat sebuah `purchase_item` disubmit, sistem otomatis memperbarui `raw_materials.stock_qty` (jika is_tracked), `last_buy_date`, dan `unit_price` ke harga pembelian terakhir, sekaligus menyisipkan record baru di `raw_material_movements` (reason=`purchase`) untuk audit trail.
>
> Entitas `transactions` ditambah kolom `order_type` (dineIn atau takeaway), `payment_bank` (terisi hanya untuk metode EDC dan transfer agar owner dapat mendapatkan laporan per bank untuk rekonsiliasi mutasi rekening), `tax_amount` untuk PB1 sepuluh persen otomatis, serta `merged_into_id` (self-reference nullable) untuk mengakomodasi fitur merge bill di mana dua transaksi meja terpisah dapat digabungkan menjadi satu struk pembayaran. Entitas `transaction_items` ditambah `sub_options_selected` (untuk merekam pilihan customer pada paket) dan `party_id` (untuk fitur split bill — item dengan party_id sama akan menghasilkan satu struk terpisah, sehingga satu transaksi dapat menghasilkan dua atau lebih struk PDF).
>
> Entitas `settlements` disederhanakan dari desain awal yang menggunakan metode blind count menjadi rekap simpel enam metode pembayaran (cash, EDC, QRIS, Gojek, Grab, transfer) yang dilakukan sekali di akhir hari oleh kasir shift malam. Entitas `expenses` pada desain awal dipecah menjadi dua entitas terpisah: `purchases` untuk log belanja kasir di pasar dan `bills` untuk tagihan operasional bulanan (kebersihan, listrik, air, parkir, sewa) yang hanya dapat diinput oleh owner.
>
> Sistem memiliki sembilan belas relasi yang menghubungkan entitas-entitas tersebut, dengan dominasi relasi satu-ke-banyak (1:N), satu relasi satu-ke-satu (1:1) antara shift dan settlement, dan satu relasi self-reference pada `transactions` untuk mengakomodasi merge bill. Relasi banyak-ke-banyak antara menu dan transaksi dijabarkan sebagai entitas asosiatif `transaction_items`, sementara relasi banyak-ke-banyak antara raw_materials dan purchases dijabarkan sebagai `purchase_items`. Detail atribut dan tipe data setiap entitas dijabarkan pada Tabel 3.1 hingga Tabel 3.14 di sub-bab berikutnya.

## 10. HPP dan Bill of Materials (Out of Scope)

ERD ini secara sadar **tidak menyertakan relasi otomatis antara `raw_materials` dan `portion_stocks`** (tidak ada Bill of Materials atau resep yang men-decrement bahan mentah saat order masuk). Hal ini sesuai keputusan operasional bahwa HPP per porsi tidak dimasukkan ke dalam lingkup sistem — proses memasak dilakukan secara batch di rumah owner tanpa penimbangan baku, dan komposisi peracikan bumbu bersifat tidak tetap serta tidak terdokumentasi, sehingga data input yang dibutuhkan untuk menghitung HPP tidak tersedia secara konsisten.

Implikasi struktural di ERD:
- `raw_materials` dan `portion_stocks` adalah dua sumbu data terpisah, tidak ada FK antara keduanya.
- `raw_material_movements` dan `portion_movements` juga terpisah (REV 2.2), masing-masing dengan enum reason yang spesifik untuk konteksnya.
- Konversi bahan mentah → stok porsi terjadi manual di rumah owner, di luar sistem.
- Laporan owner menampilkan: Pendapatan total per periode (dari `transactions`), Pengeluaran total per periode (dari `purchases` + `bills`), Laba Kotor = Pendapatan − Pengeluaran. Tidak ada breakdown HPP per menu.

Justifikasi lengkap (paragraf paste-ready untuk skripsi Bab 3) ada di [`docs/operasional-resto.md` seksi "HPP dan Laba Rugi (Out of Scope)"](../operasional-resto.md).

## 11. Workflow Build di StarUML / Mermaid

Untuk ERD, gunakan **`generate_diagram` dengan Mermaid `erDiagram` syntax** via staruml-mcp. Jangan manual `create_element` per-column (kolom masuk ke `ownedElements` field, bukan `columns` field, sehingga tidak render di entity box). Lihat [[feedback_erd_use_mermaid]] di memory.

ERD REV 2.2 sudah di-build di StarUML, tersave di `Skripsi.mdj`, dalam container "ERD Model" dengan diagram name "Entity Relationship Diagram - Sistem POS Restoran".

## 12.b Perubahan REV 2.2 → REV 2.3 (no schema change)

- ✅ **Tidak ada perubahan schema** — tetap 14 entitas, 19 relasi, semua enum sama.
- ℹ️ **Permission di app layer**: keputusan permission per role per aksi (lihat ground truth seksi "Permission Matrix" REV 2.3) di-implement via middleware backend + frontend conditional UI, tidak ada kolom permission/role granular di DB. Tetap pakai `users.role` enum (`owner`/`cashier`/`waiter`) sebagai single source.
- ℹ️ **Tidak ada kolom audit "input_by_role"** di `transactions` — kalau dibutuhkan untuk skripsi (mis. nge-track waiter fallback input), tambah kolom `transactions.input_by_role UserRole` di REV 2.4. Tapi dirasa overkill untuk family business kecil (3 kasir + 2 waiter), trust verbal cukup.

## 12. Perubahan vs REV 2.1 (Diff REV 2.1 → REV 2.2)

### Entitas
| Status | REV 2.1 | REV 2.2 |
|---|---|---|
| 🔄 RENAME | `stock_movements` | → `portion_movements` (clarify scope) |
| 🆕 NEW | — | `raw_material_movements` (audit log raw materials, analog `portion_movements`) |
| ✅ KEEP | 12 entitas lainnya | Tidak berubah struktural |

**Total: 13 entitas (REV 2.1) → 14 entitas (REV 2.2)** — +1 raw_material_movements.

### Enum
| Status | REV 2.1 | REV 2.2 |
|---|---|---|
| 🔄 RENAME | `StockMovementReason` | → `PortionMovementReason` (konsisten dengan rename tabel) |
| 🆕 NEW | — | `RawMaterialMovementReason` (purchase, opname, manual_adjust) |
| ✅ KEEP | Enum lainnya | Tidak berubah |

### Relasi
| Status | REV 2.1 | REV 2.2 |
|---|---|---|
| 🔄 RENAME | `users → stock_movements` & `menus → stock_movements` | → `users → portion_movements` & `menus → portion_movements` |
| 🆕 NEW | — | `users → raw_material_movements` (user pelaku) |
| 🆕 NEW | — | `raw_materials → raw_material_movements` (1:N audit) |
| ✅ KEEP | 15 relasi lainnya | Tidak berubah |

**Total: 17 relasi (REV 2.1) → 19 relasi (REV 2.2)**.

### Konsekuensi alur (lihat ACTIVITY.md REV 2.2 untuk detail)
- **A.7 Opname Raw Materials**: tambah step "sistem log ke `raw_material_movements` reason=`opname`"
- **A.9 Mencatat Pembelian**: tambah step "sistem log ke `raw_material_movements` reason=`purchase`" saat submit
- **A.6 Opname Stok Porsi**: tetap (sudah pakai portion_movements yang di-rename)

## 13. Referensi Konvensi

- Skill: `.claude/skills/erd-diagram/SKILL.md`
- Schema implementasi: [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma) (saat ini masih REV 2 — pending rewrite ke REV 2.2; REV 2.3 tidak menambah schema)
- Data dictionary penuh (Bab 3, opsional): [`docs/DATA-DICTIONARY.md`](../DATA-DICTIONARY.md) (saat ini masih REV 1)
- Ground truth alur bisnis (REV 2.3, sumber kebenaran tertinggi): [`docs/operasional-resto.md`](../operasional-resto.md)
- Design spec permission matrix (REV 2.3): [`docs/superpowers/specs/2026-05-24-permission-matrix-design.md`](../superpowers/specs/2026-05-24-permission-matrix-design.md)
- Use case sistem (REV 2.3): [`docs/knowledge/USE-CASE.md`](./USE-CASE.md)
- Activity diagram (REV 2.3): [`docs/knowledge/ACTIVITY.md`](./ACTIVITY.md)

## 14. Bad Practice yang Dihindari

- ❌ Entity tanpa PK → setiap entity wajib punya PK
- ❌ M:N digambar langsung dengan crow's-foot fork dua sisi → wajib junction entity (`transaction_items`, `purchase_items`)
- ❌ FK tanpa reference ke entity target → tulis `FK → <entity>`
- ❌ Mix naming (`id_menu` di satu tabel, `menu_id` di tabel lain) → konsisten snake_case
- ❌ Pakai notasi Chen (diamond relationship) untuk skripsi POS → konsisten crow's-foot
- ❌ Menyimpan computed value (mis. `variance_cash` atau `breakdown_bank_per_bank`) → cukup hitung di runtime
- ❌ Hardcoded enum untuk kategori yang sering bertambah (mis. `BulkStockKind`) → pakai entitas terpisah atau enum kategori generik (`RawMaterialCategory`)
- ❌ Relasi otomatis raw_material → portion_stock (BOM/resep) → tidak ada di sistem, sesuai keputusan HPP out of scope
- ❌ **REV 2.2:** Audit log gabungan polymorphic (1 tabel `stock_movements` untuk 2 jenis stok dengan polymorphic FK) → pakai 2 tabel terpisah dengan FK proper (`portion_movements` & `raw_material_movements`)
- ❌ **REV 2.2:** Naming ambigu (`stock_movements` saat ada 2 jenis stok) → rename eksplisit ke `portion_movements`
