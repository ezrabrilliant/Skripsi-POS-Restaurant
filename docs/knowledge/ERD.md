# ERD - Sistem POS Ayam Bakar Banjar Monosuko (REV 2.11)

> **Status:** REV 2.11 (2026-05-30) - **drop** entitas belanja/raw-materials (`vendors`, `purchases`, `purchase_items`, `raw_materials`, `raw_material_movements`) dan **tambah** COGS per menu: entitas baru `menu_cost_movements` + kolom `menus.cost` + `transaction_items.unit_cost` + `menu_variants.cost_source_menu_id`. Inventori = finished-goods porsi saja (selaras proposal Bab 1 §1.4). Permission tetap di app layer. Lihat [`docs/superpowers/specs/2026-05-30-cogs-per-menu-remove-belanja-design.md`](../superpowers/specs/2026-05-30-cogs-per-menu-remove-belanja-design.md).
> **Sumber alur bisnis:** [`docs/operasional-resto.md`](../operasional-resto.md) REV 2.11 (sumber kebenaran tertinggi)
> **Schema implementasi:** [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma)
> **Visual:** ERD StarUML (`Skripsi.mdj`) masih versi lama - **pending rebuild** untuk drop entitas belanja/raw-materials + tambah `menu_cost_movements`.

> ⚠️ **Riwayat versi:**
> - **REV 2.11 (2026-05-30)** - drop `vendors`/`purchases`/`purchase_items`/`raw_materials`/`raw_material_movements` (5 entitas) + drop enum `RawMaterialMovementReason`/`RawMaterialCategory`. Tambah entitas `menu_cost_movements` + enum `MenuCostChangeReason`{initialSet, manualEdit} + kolom `menus.cost`/`transaction_items.unit_cost`/`menu_variants.cost_source_menu_id`. Entitas baseline 14 → **10**; relasi 23 → **17** (drop 8 relasi belanja/raw, tambah 2 relasi cost-movement).
> - **REV 2.8 (2026-05-29)** - stock ledger integrity: `portion_movements` & `raw_material_movements` dapat FK ke dokumen sumber (transaction/transaction_item, purchase/purchase_item, `ON DELETE SET NULL`) + kolom `qty_before`/`qty_after`. Tautan pindah dari teks `note` ke FK. +4 relasi (19 → 23). (Catatan: REV 2.8 mendahului penghapusan REV 2.11; relasi raw/purchase ledger ikut terhapus di REV 2.11.)
> - **REV 2.3 (2026-05-24)** - version bump kosmetik. No schema change. Hanya alignment dengan permission matrix.
> - **REV 2.2 (2026-05-24)** - tambah `raw_material_movements` (audit log raw materials) + rename `stock_movements` → `portion_movements`. Total entitas naik 13 → 14, relasi naik 17 → 19.
> - **REV 2.1 (2026-05-23)** - order type 2 enum, raw_materials fleksibel, vendor opsional, purchase_items normalized.

---

## 1. Apa itu ERD?

Entity Relationship Diagram (ERD) menggambarkan **struktur data tersimpan** dalam sistem - tabel, kolom, tipe data, dan relasi antar-tabel. ERD dibuat pada tahap perancangan database, setelah use case diagram dan sebelum implementasi skema DBMS.

ERD beda dari Class Diagram:
- **ERD** = desain database: tabel, kolom, PK/FK, cardinality
- **Class Diagram** (UML) = desain object-oriented: class dengan atribut + method + inheritance

Skripsi POS ABM hanya pakai ERD (tidak butuh class diagram terpisah).

## 2. Kegunaan untuk Skripsi

1. **Blueprint database** - acuan `CREATE TABLE` dan migration Prisma.
2. **Validasi integritas data** - semua FK ada; setiap entitas punya PK.
3. **Bab 3 skripsi** - ERD visual + data dictionary tabular = komplit.
4. **Komunikasi ke dosen pembimbing & penguji** - convention crow's-foot yang umum di UK Petra.

## 3. Konvensi (REV 2.2)

- **Naming entity**: snake_case plural lowercase (`users`, `menus`, `portion_stocks`, `portion_movements`, `menu_cost_movements`, `shifts`, `transactions`, `transaction_items`, `settlements`, `bills`).
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
- **M:N harus via junction**: relasi `menus × transactions` di-resolve via `transaction_items`.

## 4. Enum Definitions (REV 2.11)

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
enum MenuCostChangeReason      { initialSet, manualEdit }                          // REV 2.11: BARU - log perubahan modal/COGS menu
enum BillCategory              { kebersihan, listrik, air, parkir, sewa }          // tagihan operasional
// REV 2.11 DROP: RawMaterialMovementReason, RawMaterialCategory (ikut hapus raw materials)
```

## 5. Sepuluh Entitas REV 2.11

| #   | Entity                   | Purpose                                                            | Notes                                                                |
| --- | ------------------------ | ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 1   | `users`                  | Pengguna: owner, kasir, waiter                                     | PIN BOLEH DUPLIKAT (drop unique constraint)                          |
| 2   | `menus`                  | Katalog menu dengan stockType, minStock, subOptions, **cost (modal/COGS, owner-only)** | 60 item (25 porsi + linked + non-stok + 5 paket). REV 2.11: `cost` Decimal? |
| 3   | `portion_stocks`         | Live count stok porsi per menu + opening snapshot pagi             | 1:1 dengan Menu (stockType=portion), boleh minus                     |
| 4   | `portion_movements`      | Audit log perubahan stok porsi (REV 2.2: RENAME dari stock_movements) | delta +/- per order/restock/adjust dengan reason                  |
| 5   | `menu_cost_movements`    | **Audit log perubahan modal/COGS menu (REV 2.11: BARU)**          | costBefore/costAfter + reason(initialSet/manualEdit) + user pelaku    |
| 6   | `shifts`                 | Siklus shift per kasir per tipe per tanggal                        | `type` (pagi/malam), unique (date, cashier, type), modal awal        |
| 7   | `transactions`           | Header pesanan                                                     | `orderType` 2 enum, `payment_bank` (edc/transfer), `merged_into_id?` |
| 8   | `transaction_items`      | Junction menu × transactions                                       | `sub_options_selected` (JSON), `party_id` (split bill), **`unit_cost` (snapshot modal, REV 2.11)** |
| 9   | `settlements`            | Rekap akhir hari (simpel, 6 totals, breakdown bank di runtime)     | 1:1 dengan shift malam saja                                          |
| 10  | `bills`                  | Tagihan operasional bulanan owner                                  | Owner-only, kategori kebersihan/listrik/air/parkir/sewa              |

Total: **10 entitas**. (REV 2.11 drop `raw_materials`, `raw_material_movements`, `vendors`, `purchases`, `purchase_items`.)

> Catatan: tabel `menu_variants`/`paket_components` (REV 2.10 menu variants) belum dilipat ke himpunan baseline ini; REV 2.11 menambah kolom `menu_variants.cost_source_menu_id Int?` (FK→menus, SET NULL) sebagai sumber modal varian nonStock. Entitas REV 2.5–2.7 (`payment_methods`, `banks`, dll) juga terdokumentasi di spec masing-masing.

## 6. Detail Kolom Per Entitas

### 6.1. `users`
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | Auto-increment |
| name | VARCHAR(100) | - | Nama pegawai (Owner, Jason, Bryant, Chen Hong, Amel, Yanti) |
| pin | VARCHAR(6) | - | 6 digit, **boleh duplikat antar pegawai** |
| role | UserRole | - | owner / cashier / waiter |
| is_active | BOOLEAN | - | Default true |
| created_at, updated_at | DATETIME | - | Audit |

### 6.2. `menus`
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | |
| name | VARCHAR(100) | - | mis. "1 Ekor Ayam Bakar Merah", "Paket A (1 org)" |
| category | VARCHAR(50) | - | "Signature Ayam Bakar", "Seafood", "Sayur & Sup", "Side Dish", "Minuman", "Paket Hemat" |
| price | DECIMAL(10,2) | - | Rupiah (harga jual) |
| cost | DECIMAL(10,2)? | - | **REV 2.11 BARU**: modal/COGS per unit (owner-only, TIDAK dibocorkan ke GET publik). null = belum di-set (dihitung 0 saat hitung laba). Diisi di SKU leaf + menu simple |
| stock_type | StockType | - | portion / linked / nonStock |
| min_stock | INT? | - | Hanya untuk stockType=portion |
| image_url | VARCHAR(255)? | - | Path foto (/menu/*.webp) atau URL CDN |
| sub_options | JSON? | - | Untuk paket: `{options: [...], stockMap: {...}}`. Untuk linked: `{stockTarget: "Menu Name"}` |
| is_active | BOOLEAN | - | Default true |
| created_at, updated_at | DATETIME | - | |

### 6.3. `portion_stocks`
| Kolom              | Tipe     | PK/FK/UK      | Keterangan                                                              |
| ------------------ | -------- | ------------- | ----------------------------------------------------------------------- |
| menu_id            | INT      | PK + FK→menus | 1:1 dengan Menu stockType=portion                                       |
| current_qty        | INT      | -             | Live count, BOLEH NEGATIF (stok minus didukung)                         |
| min_stock          | INT      | -             | Ambang reminder (duplicate dari menus.min_stock untuk query convenience) |
| opening_qty_today  | INT      | -             | Snapshot otomatis qty saat user pertama login pagi                       |
| opening_qty_date   | DATE     | -             | Tanggal snapshot, dipakai untuk trigger re-snapshot hari baru            |
| updated_at         | DATETIME | -             |                                                                         |

> Metric "Terjual Hari Ini" = `opening_qty_today + restock_today − current_qty`. Restock hari ini dihitung dari `SUM(portion_movements.delta WHERE reason IN ('restock_morning','restock_emergency') AND created_at::date = today)`.

### 6.4. `portion_movements` (REV 2.2 - RENAME dari `stock_movements`)
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | |
| menu_id | INT | FK→menus | Item stok porsi yang berubah |
| delta | INT | - | + saat restock, − saat order |
| reason | PortionMovementReason | - | order / restock_morning / restock_emergency / manual_adjust / refund_void |
| transaction_id | INT? | FK→transactions (SET NULL) | **REV 2.8**: transaksi sumber (order/refund_void) |
| transaction_item_id | INT? | FK→transaction_items (SET NULL) | **REV 2.8**: baris item penyebab decrement |
| qty_before | INT? | - | **REV 2.8**: stok sebelum perubahan |
| qty_after | INT? | - | **REV 2.8**: stok sesudah (= qty_before + delta) |
| note | VARCHAR(255)? | - | **REV 2.8**: konteks manusiawi (tautan via FK, mis. "Antar via Gojek 18:30") |
| user_id | INT | FK→users | Siapa yang trigger |
| created_at | DATETIME | - | |

### 6.5. `menu_cost_movements` (REV 2.11 - BARU, audit log modal/COGS menu)
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | |
| menu_id | INT | FK→menus | Menu (SKU leaf / simple) yang modalnya berubah |
| cost_before | DECIMAL(10,2)? | - | Modal sebelum perubahan (null = sebelumnya belum di-set) |
| cost_after | DECIMAL(10,2)? | - | Modal sesudah perubahan |
| reason | MenuCostChangeReason | - | initialSet (set pertama dari null) / manualEdit (ubah nilai) |
| note | VARCHAR(255)? | - | Konteks manusiawi opsional (mis. "Penyesuaian modal") |
| user_id | INT | FK→users | Owner yang mengubah modal |
| created_at | DATETIME | - | `@@index([menu_id, created_at])` |

> Auto-generated rows: ditulis di dalam `$transaction` `upsertMenu` saat `Menu.cost` berubah - reason=`initialSet` saat null→nilai pertama, reason=`manualEdit` saat ubah nilai. Read owner-only via `GET /menus/:id/cost-history`.

### 6.6. `shifts`
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | |
| date | DATE | - | + cashier_id + type = UNIQUE |
| type | ShiftType | - | pagi / malam |
| cashier_id | INT | FK→users | |
| opening_cash | DECIMAL(12,2) | - | Modal awal laci kas |
| closed_at | DATETIME? | - | null = shift terbuka |
| created_at | DATETIME | - | |

### 6.7. `transactions`
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | |
| shift_id | INT | FK→shifts | |
| order_type | OrderType | - | **dineIn / takeaway** (cuma 2 enum) |
| table_number | INT? | - | NULLABLE - hanya wajib untuk dineIn |
| cashier_id | INT | FK→users | Kasir/waiter yang input |
| status | TransactionStatus | - | open / paid / void |
| payment_method | PaymentMethod? | - | Set saat paid |
| payment_bank | VARCHAR(50)? | - | Terisi hanya kalau payment=edc/transfer (mis. "BCA", "Mandiri") |
| merged_into_id | INT? | FK→transactions (self) | Kalau transaksi ini sudah di-merge ke transaksi lain, isi ID parent gabungan |
| subtotal | DECIMAL(12,2) | - | Σ subtotal items |
| discount_amount | DECIMAL(12,2) | - | Diskon manual |
| tax_amount | DECIMAL(12,2) | - | PB1 10% otomatis dari (subtotal − discount) |
| total | DECIMAL(12,2) | - | subtotal − discount + tax |
| created_at, paid_at, voided_at | DATETIME | - | |

### 6.8. `transaction_items`
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | |
| transaction_id | INT | FK→transactions (CASCADE) | |
| menu_id | INT | FK→menus | |
| qty | INT | - | |
| unit_price | DECIMAL(10,2) | - | Snapshot harga jual saat order |
| unit_cost | DECIMAL(10,2)? | - | **REV 2.11 BARU**: snapshot modal/COGS per unit saat order (mirror unit_price). Untuk paket = Σ modal komponen. null = baris historis pra-backfill (dihitung 0). Laba: Σ unit_cost × qty |
| subtotal | DECIMAL(12,2) | - | qty × unit_price |
| sub_options_selected | JSON? | - | Hasil pilihan SubOptionsModal untuk paket, mis. `{ayamPart:"Paha", cook:"Bakar"}` |
| **notes** | **VARCHAR(255)?** | - | **REV 2.4 BARU**: catatan per item dari waiter/kasir saat input - komunikasi customer ke dapur (mis. "kurang manis", "pedas level 2", "Panas"/"Dingin" untuk teh & jeruk yang ambigu suhu). Quick toggle di CartItemRow untuk minuman ambigu mengisi field ini otomatis. |
| party_id | INT? | - | Split bill grouping: item dengan party_id sama = 1 struk terpisah. null = tidak split |
| created_at | DATETIME | - | |

### 6.9. `settlements`
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | |
| shift_id | INT | FK→shifts UK | 1:1 dengan shift malam (kasir malam saja yg settle) |
| date | DATE | - | |
| cashier_id | INT | FK→users | |
| reviewer_id | INT? | FK→users | Owner yg review |
| system_cash | DECIMAL(12,2) | - | Total dari sistem per metode |
| system_edc | DECIMAL(12,2) | - | |
| system_qris | DECIMAL(12,2) | - | |
| system_gojek | DECIMAL(12,2) | - | |
| system_grab | DECIMAL(12,2) | - | |
| system_transfer | DECIMAL(12,2) | - | |
| actual_cash, actual_edc, actual_qris, actual_gojek, actual_grab, actual_transfer | DECIMAL(12,2) | - | Total fisik input kasir |
| status | SettlementStatus | - | submitted / reviewed |
| submitted_at, reviewed_at | DATETIME | - | |

> Variance per metode dihitung di runtime (`actual − system`), tidak disimpan.
> Breakdown per bank untuk EDC & transfer dihitung di runtime dari `transactions GROUP BY payment_bank` di tanggal yang sama, tidak disimpan di tabel ini.

### 6.10. `bills`
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | |
| month | VARCHAR(7) | - | YYYY-MM |
| category | BillCategory | - | kebersihan / listrik / air / parkir / sewa |
| amount | DECIMAL(12,2) | - | |
| note | VARCHAR(255)? | - | |
| user_id | INT | FK→users | OWNER ONLY (validation di layer service) |
| created_at | DATETIME | - | |

## 7. Tujuh Belas Relasi REV 2.11

| # | Parent | Child | Via | Cardinality | Catatan |
|---|---|---|---|---|---|
| 1 | users | transactions | cashier_id | 1 : N | Kasir/waiter input transaksi |
| 2 | users | shifts | cashier_id | 1 : N | Modal awal per shift |
| 3 | users | settlements | cashier_id | 1 : N | Kasir malam yg submit |
| 4 | users | settlements | reviewer_id (nullable) | 0..1 : N | Owner yg review |
| 5 | users | bills | user_id | 1 : N | Owner input tagihan |
| 6 | users | portion_movements | user_id | 1 : N | Audit trail stok porsi |
| 7 | users | menu_cost_movements | user_id | 1 : N | **REV 2.11 BARU** - owner pengubah modal/COGS |
| 8 | shifts | transactions | shift_id | 1 : N | Transaksi ter-attach ke shift kasir |
| 9 | shifts | settlements | shift_id | 1 : 1 (UNIQUE) | Settlement tutup shift |
| 10 | menus | portion_stocks | menu_id | 1 : 0..1 | Hanya menu stockType=portion punya stok |
| 11 | menus | transaction_items | menu_id | 1 : N | Histori order |
| 12 | menus | portion_movements | menu_id | 1 : N | Audit perubahan stok porsi |
| 13 | menus | menu_cost_movements | menu_id | 1 : N | **REV 2.11 BARU** - audit perubahan modal/COGS menu |
| 14 | transactions | transaction_items | transaction_id | 1 : 1..N (composition, CASCADE) | Item detail |
| 15 | transactions | transactions | merged_into_id (self, nullable) | 0..1 : N | Merge bill (transaksi B & C punya merged_into_id=A) |
| 16 | transactions | portion_movements | transaction_id (nullable, SET NULL) | 1 : N | **REV 2.8** - movement order/void ke transaksi sumber |
| 17 | transaction_items | portion_movements | transaction_item_id (nullable, SET NULL) | 1 : N | **REV 2.8** - movement ke baris item penyebab decrement |

Total: **17 relasi** (REV 2.11). Diff dari 23 relasi REV 2.8: drop 8 relasi yang menyentuh `purchases`/`purchase_items`/`vendors`/`raw_materials`/`raw_material_movements`, tambah 2 relasi `menu_cost_movements` (menus & users).

> Catatan: relasi REV 2.10 menu variants (`menus → menu_variants`, `menus → paket_components`) + FK `menu_variants.cost_source_menu_id → menus` (SET NULL, REV 2.11) belum masuk hitungan baseline ini.

## 8. Mengapa Struktur Ini Menjawab Masalah Skripsi

| Rumusan Masalah (Bab 1.2) | Entitas yang menjawab |
|---|---|
| A. Percepat durasi transaksi | `transactions` (orderType 2 enum sederhana, tax/discount auto, payment_bank) + `transaction_items` (subOptionsSelected + partyId untuk split, merged_into_id untuk merge) |
| B. Percepat rekonsiliasi + kurangi mismatch | `shifts` (modal awal) + `settlements` (6 totals sistem vs aktual, breakdown bank di runtime) |
| C. Manajemen stok harian | `portion_stocks` (live count + opening snapshot) + `portion_movements` (audit perubahan stok porsi) |
| #4 Owner tahu laba & pengeluaran | `menus.cost` + `transaction_items.unit_cost` + `menu_cost_movements` (modal/COGS per menu + snapshot per item + log riwayat) → Laba Kotor = Pendapatan − COGS; `bills` (owner tagihan, tampil terpisah) |
| #5 Traceability stok & modal | `portion_movements` (perubahan stok) + **`menu_cost_movements`** (perubahan modal) - ter-audit dengan pelaku & timestamp |

## 9. Narasi untuk Bab 3 Skripsi (paste-ready, REV 2.11)

> ⚠️ **Catatan REV 2.11:** narasi paragraf di bawah ini perlu **review thesis-level oleh Ezra** - sebagian kalimat masih bergaya prosa REV 2.2 (sebelum drop belanja/raw-materials). Bagian raw-materials & pembelian sudah dihapus dan diganti COGS, tetapi penghalusan kalimat untuk naskah final sebaiknya dicek ulang.
>
> **3.5.1 Entity Relationship Diagram**
>
> Gambar 3.X menunjukkan Entity Relationship Diagram (ERD) dari Sistem POS Restoran Ayam Bakar Banjar Monosuko. Sistem terdiri dari sepuluh entitas utama yang dirancang untuk merepresentasikan operasional restoran dengan satu kategori stok (stok porsi siap jual yang berkurang otomatis saat transaksi dengan jejak audit di `portion_movements`), dua tipe order (dine-in dan takeaway yang dibedakan dari ada/tidaknya pemilihan nomor meja, dengan sumber order takeaway diidentifikasi melalui metode pembayaran), serta perhitungan laba kotor harian melalui modal/COGS per menu (`menus.cost` yang di-snapshot per item transaksi di `transaction_items.unit_cost`, dengan jejak perubahan di `menu_cost_movements`) dan tagihan operasional bulanan oleh owner.
>
> Entitas `users` menyimpan data tiga jenis pengguna: owner, kasir, dan waiter, dengan PIN enam digit yang boleh duplikat karena identifikasi pengguna dilakukan melalui kombinasi nama dan PIN saat login. Entitas `menus` merupakan katalog enam puluh item dengan klasifikasi `stock_type` (portion, linked, atau nonStock) yang menentukan perilaku decrement stok saat transaksi. Untuk menu paket (Paket Keluarga, A, B, C, D), kolom JSON `sub_options` menyimpan definisi sub-pilihan dinamis (misalnya Paha atau Dada, Bakar atau Goreng) beserta pemetaan ke stok porsi yang harus dikurangi.
>
> Entitas `portion_stocks` menyimpan kondisi stok porsi dengan tambahan kolom `opening_qty_today` dan `opening_qty_date` untuk mengakomodasi snapshot otomatis di awal hari - kondisi ini dipakai untuk menghitung metric "terjual hari ini" pada dashboard. Stok porsi diperbolehkan bernilai negatif untuk mendukung skenario customer tetap memesan saat stok habis; pemilik akan mengirim restock darurat dari rumah melalui Gojek atau Grab, dan kasir mencatatnya melalui fitur "Barang Masuk" yang akan tercatat di `portion_movements` dengan reason `restock_emergency`. Setiap perubahan stok porsi (akibat order, restock, atau opname pagi) tercatat di `portion_movements` beserta delta, alasan, pelaku, dan waktu untuk keperluan audit.
>
> Untuk perhitungan laba kotor, entitas `menus` ditambah kolom `cost` (modal/COGS per unit) yang hanya dapat diakses owner dan tidak dibocorkan ke katalog publik (POS). Modal melekat pada SKU leaf dan menu simple; varian nonStock menunjuk SKU leaf wakil modal melalui kolom `menu_variants.cost_source_menu_id`. Setiap perubahan modal dicatat di entitas `menu_cost_movements` (nilai sebelum/sesudah, alasan set-awal atau penyesuaian, pelaku, dan waktu), sehingga riwayat modal dapat ditelusuri owner. Sistem secara sadar tidak mencatat bahan baku mentah - inventori dibatasi pada barang siap jual satuan porsi, sesuai ruang lingkup penelitian (lihat sub-bab 3.1.4 Batasan Penelitian).
>
> Entitas `transactions` ditambah kolom `order_type` (dineIn atau takeaway), `payment_bank` (terisi hanya untuk metode EDC dan transfer agar owner dapat mendapatkan laporan per bank untuk rekonsiliasi mutasi rekening), `tax_amount` untuk PB1 sepuluh persen otomatis, serta `merged_into_id` (self-reference nullable) untuk mengakomodasi fitur merge bill di mana dua transaksi meja terpisah dapat digabungkan menjadi satu struk pembayaran. Entitas `transaction_items` ditambah `sub_options_selected` (untuk merekam pilihan customer pada paket), `party_id` (untuk fitur split bill - item dengan party_id sama akan menghasilkan satu struk terpisah), dan `unit_cost` (snapshot modal/COGS per unit saat order, mirip `unit_price`, sehingga laba kotor periode lampau tidak berubah saat owner memperbarui modal di kemudian hari).
>
> Entitas `settlements` disederhanakan dari desain awal yang menggunakan metode blind count menjadi rekap simpel enam metode pembayaran (cash, EDC, QRIS, Gojek, Grab, transfer) yang dilakukan sekali di akhir hari oleh kasir shift malam. Entitas `bills` menyimpan tagihan operasional bulanan (kebersihan, listrik, air, parkir, sewa) yang hanya dapat diinput oleh owner dan ditampilkan terpisah dari laba kotor.
>
> Sistem memiliki tujuh belas relasi yang menghubungkan entitas-entitas tersebut, dengan dominasi relasi satu-ke-banyak (1:N), satu relasi satu-ke-satu (1:1) antara shift dan settlement, dan satu relasi self-reference pada `transactions` untuk mengakomodasi merge bill. Relasi banyak-ke-banyak antara menu dan transaksi dijabarkan sebagai entitas asosiatif `transaction_items`. Detail atribut dan tipe data setiap entitas dijabarkan pada Tabel 3.2 hingga Tabel 3.11 di sub-bab berikutnya.

## 10. Modal/COGS per Menu + Bill of Materials (Out of Scope)

ERD ini secara sadar **tidak mencatat bahan baku mentah maupun Bill of Materials / resep** - inventori dibatasi pada barang siap jual satuan porsi (`portion_stocks`). Modal/COGS dinyatakan langsung per menu oleh owner (`menus.cost`), bukan dihitung dari konsumsi bahan baku terukur per siklus produksi. Hal ini sesuai keputusan operasional bahwa HPP berbasis bahan tidak dimasukkan ke dalam lingkup sistem - proses memasak dilakukan secara batch di rumah owner tanpa penimbangan baku, dan komposisi peracikan bumbu bersifat tidak tetap serta tidak terdokumentasi.

Implikasi struktural di ERD:
- Tidak ada entitas raw materials, vendor, atau pembelian; tidak ada FK BoM/resep yang men-decrement bahan mentah saat order masuk.
- Modal/COGS melekat per menu (`menus.cost`, owner-only), di-snapshot per item transaksi (`transaction_items.unit_cost`) sebagai nilai point-in-time mirip harga jual, dengan jejak perubahan di `menu_cost_movements`.
- Konversi bahan mentah → stok porsi terjadi manual di rumah owner, di luar sistem.
- Laporan owner menampilkan: Pendapatan total per periode (dari `transactions`), COGS total per periode (Σ `unit_cost` × qty), Laba Kotor = Pendapatan − COGS. Tagihan operasional bulanan (`bills`) ditampilkan terpisah dan tidak dikurangkan ke laba kotor.

Justifikasi lengkap (paragraf paste-ready untuk skripsi Bab 3) ada di [`docs/operasional-resto.md` seksi "Bill of Materials / HPP per Bahan (Out of Scope)"](../operasional-resto.md) dan "COGS per Menu + Laporan Laba Rugi Harian".

## 11. Workflow Build di StarUML / Mermaid

Untuk ERD, gunakan **`generate_diagram` dengan Mermaid `erDiagram` syntax** via staruml-mcp. Jangan manual `create_element` per-column (kolom masuk ke `ownedElements` field, bukan `columns` field, sehingga tidak render di entity box). Lihat [[feedback_erd_use_mermaid]] di memory.

ERD versi lama (REV 2.2) sudah di-build di StarUML, tersave di `Skripsi.mdj`, dalam container "ERD Model" dengan diagram name "Entity Relationship Diagram - Sistem POS Restoran". **⚠️ REV 2.11 visual ERD pending rebuild** - perlu drop entitas `vendors`/`purchases`/`purchase_items`/`raw_materials`/`raw_material_movements` + tambah `menu_cost_movements` + kolom `menus.cost`/`transaction_items.unit_cost`/`menu_variants.cost_source_menu_id`.

## 12.a Perubahan REV 2.8 → REV 2.11 (drop belanja/raw + tambah COGS)

### Entitas
| Status | REV 2.8 (14 entitas) | REV 2.11 (10 entitas) |
|---|---|---|
| ❌ DROP | `vendors`, `purchases`, `purchase_items`, `raw_materials`, `raw_material_movements` | dihapus total (inventori = finished-goods porsi saja, selaras proposal) |
| 🆕 NEW | - | `menu_cost_movements` (audit log perubahan modal/COGS menu) |
| 🔄 KOLOM | `menus`, `transaction_items` | + `menus.cost` (modal/COGS owner-only), + `transaction_items.unit_cost` (snapshot modal), + `menu_variants.cost_source_menu_id` |
| ✅ KEEP | 9 entitas lainnya | Tidak berubah |

### Enum
| Status | REV 2.8 | REV 2.11 |
|---|---|---|
| ❌ DROP | `RawMaterialMovementReason`, `RawMaterialCategory` | dihapus bersama raw materials |
| 🆕 NEW | - | `MenuCostChangeReason` { initialSet, manualEdit } |

### Relasi
| Status | REV 2.8 | REV 2.11 |
|---|---|---|
| ❌ DROP | 8 relasi: `users→purchases`, `users→raw_material_movements`, `vendors→purchases`, `purchases→purchase_items`, `raw_materials→purchase_items`, `raw_materials→raw_material_movements`, `purchases→raw_material_movements`, `purchase_items→raw_material_movements` | dihapus |
| 🆕 NEW | - | `menus→menu_cost_movements`, `users→menu_cost_movements` |

**Total: 14 entitas / 23 relasi (REV 2.8) → 10 entitas / 17 relasi (REV 2.11)**.

## 12.b Perubahan REV 2.2 → REV 2.3 (no schema change)

- ✅ **Tidak ada perubahan schema** - tetap 14 entitas, 19 relasi, semua enum sama.
- ℹ️ **Permission di app layer**: keputusan permission per role per aksi (lihat ground truth seksi "Permission Matrix" REV 2.3) di-implement via middleware backend + frontend conditional UI, tidak ada kolom permission/role granular di DB. Tetap pakai `users.role` enum (`owner`/`cashier`/`waiter`) sebagai single source.
- ℹ️ **Tidak ada kolom audit "input_by_role"** di `transactions` - kalau dibutuhkan untuk skripsi (mis. nge-track waiter fallback input), tambah kolom `transactions.input_by_role UserRole` di REV 2.4. Tapi dirasa overkill untuk family business kecil (3 kasir + 2 waiter), trust verbal cukup.

## 12. Perubahan vs REV 2.1 (Diff REV 2.1 → REV 2.2)

### Entitas
| Status | REV 2.1 | REV 2.2 |
|---|---|---|
| 🔄 RENAME | `stock_movements` | → `portion_movements` (clarify scope) |
| 🆕 NEW | - | `raw_material_movements` (audit log raw materials, analog `portion_movements`) |
| ✅ KEEP | 12 entitas lainnya | Tidak berubah struktural |

**Total: 13 entitas (REV 2.1) → 14 entitas (REV 2.2)** - +1 raw_material_movements.

### Enum
| Status | REV 2.1 | REV 2.2 |
|---|---|---|
| 🔄 RENAME | `StockMovementReason` | → `PortionMovementReason` (konsisten dengan rename tabel) |
| 🆕 NEW | - | `RawMaterialMovementReason` (purchase, opname, manual_adjust) |
| ✅ KEEP | Enum lainnya | Tidak berubah |

### Relasi
| Status | REV 2.1 | REV 2.2 |
|---|---|---|
| 🔄 RENAME | `users → stock_movements` & `menus → stock_movements` | → `users → portion_movements` & `menus → portion_movements` |
| 🆕 NEW | - | `users → raw_material_movements` (user pelaku) |
| 🆕 NEW | - | `raw_materials → raw_material_movements` (1:N audit) |
| ✅ KEEP | 15 relasi lainnya | Tidak berubah |

**Total: 17 relasi (REV 2.1) → 19 relasi (REV 2.2)**.

### Konsekuensi alur (lihat ACTIVITY.md REV 2.2 untuk detail)
- **A.7 Opname Raw Materials**: tambah step "sistem log ke `raw_material_movements` reason=`opname`"
- **A.9 Mencatat Pembelian**: tambah step "sistem log ke `raw_material_movements` reason=`purchase`" saat submit
- **A.6 Opname Stok Porsi**: tetap (sudah pakai portion_movements yang di-rename)

## 13. Referensi Konvensi

- Skill: `.claude/skills/erd-diagram/SKILL.md`
- Schema implementasi: [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma) (saat ini masih REV 2 - pending rewrite ke REV 2.2; REV 2.3 tidak menambah schema)
- Data dictionary penuh (Bab 3, opsional): [`docs/DATA-DICTIONARY.md`](../DATA-DICTIONARY.md) (saat ini masih REV 1)
- Ground truth alur bisnis (REV 2.3, sumber kebenaran tertinggi): [`docs/operasional-resto.md`](../operasional-resto.md)
- Design spec permission matrix (REV 2.3): [`docs/superpowers/specs/2026-05-24-permission-matrix-design.md`](../superpowers/specs/2026-05-24-permission-matrix-design.md)
- Use case sistem (REV 2.3): [`docs/knowledge/USE-CASE.md`](./USE-CASE.md)
- Activity diagram (REV 2.3): [`docs/knowledge/ACTIVITY.md`](./ACTIVITY.md)

## 14. Bad Practice yang Dihindari

- ❌ Entity tanpa PK → setiap entity wajib punya PK
- ❌ M:N digambar langsung dengan crow's-foot fork dua sisi → wajib junction entity (`transaction_items`)
- ❌ FK tanpa reference ke entity target → tulis `FK → <entity>`
- ❌ Mix naming (`id_menu` di satu tabel, `menu_id` di tabel lain) → konsisten snake_case
- ❌ Pakai notasi Chen (diamond relationship) untuk skripsi POS → konsisten crow's-foot
- ❌ Menyimpan computed value (mis. `variance_cash` atau `breakdown_bank_per_bank`) → cukup hitung di runtime
- ❌ Hardcoded enum untuk kategori yang sering bertambah (mis. `BulkStockKind`) → pakai entitas terpisah atau enum kategori generik (`RawMaterialCategory`)
- ❌ Relasi otomatis raw_material → portion_stock (BOM/resep) → tidak ada di sistem, sesuai keputusan HPP out of scope
- ❌ **REV 2.2:** Audit log gabungan polymorphic (1 tabel `stock_movements` untuk 2 jenis stok dengan polymorphic FK) → pakai 2 tabel terpisah dengan FK proper (`portion_movements` & `raw_material_movements`)
- ❌ **REV 2.2:** Naming ambigu (`stock_movements` saat ada 2 jenis stok) → rename eksplisit ke `portion_movements`
