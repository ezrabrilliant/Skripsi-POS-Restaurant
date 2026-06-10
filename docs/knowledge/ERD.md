# ERD - Sistem POS Ayam Bakar Banjar Monosuko (REV 2.13)

> **Status:** REV 2.13 (2026-06-02) - diselaraskan **penuh** ke `backend/prisma/schema.prisma` nyata: **23 entitas, 11 enum, ~39 relasi (FK)**. Skema sebenarnya jauh lebih kaya dari himpunan "10 entitas" baseline REV 2.11 (yang hanya mencatat core minimal). Versi ini melipat seluruh layer yang sudah lama berjalan di kode tapi belum masuk hitungan ERD: split-tender (`transaction_payments`), pembayaran extensible (`payment_methods`/`banks`/junction), settlement dinamis whole-business-day (`settlement_method_counts`), katalog varian & paket (REV 2.10), pengaturan aplikasi (`app_settings`), serta COGS per menu (`menu_cost_movements`). Inventori tetap finished-goods porsi saja. Lihat [`docs/superpowers/specs/2026-05-30-cogs-per-menu-remove-belanja-design.md`](../superpowers/specs/2026-05-30-cogs-per-menu-remove-belanja-design.md).
> **Sumber alur bisnis:** [`docs/operasional-resto.md`](../operasional-resto.md) (sumber kebenaran tertinggi)
> **Schema implementasi (kebenaran struktur):** [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma)
> **Visual:** ERD StarUML (`Skripsi.mdj`) sudah di-**rebuild REV 2.13** (Mermaid `erDiagram`, 23 entitas). Diagram lama dihapus (1 sisa "Login lama" di-flag HAPUS MANUAL).

> ⚠️ **Riwayat versi:**
> - **REV 2.13 (2026-06-02)** - rekonsiliasi penuh ke schema nyata: ERD dibumpkan dari "10 entitas/17 relasi" baseline ke **23 entitas / 11 enum / ~39 relasi** terkelompok (core operasional / katalog & varian / stok porsi / konfigurasi pembayaran / admin-config-audit). **Hapus total** referensi basi: split-bill/`party_id`, enum `PaymentMethod`, raw-materials/purchases/vendors & BoM, settlement "kasir malam only" + 12 kolom `system_*`/`actual_*`. Tambah deskripsi entitas yang sudah lama jalan di kode (`transaction_payments`, `settlement_method_counts`, `payment_methods`, `banks`, `payment_method_banks`, `app_settings`, layer katalog REV 2.10, `menu_cost_movements`). Perbaiki tabel kolom `transactions` (drop `payment_method`/`payment_bank`; + `tax_borne_amount`/`merged_into_id`), `settlements` (drop 12 kolom; + child `settlement_method_counts`; `@@unique([date])`), `shifts` (+ `active_marker` single-OPEN guard).
> - **REV 2.11 (2026-05-30)** - drop `vendors`/`purchases`/`purchase_items`/`raw_materials`/`raw_material_movements` + enum terkait. Tambah `menu_cost_movements` + enum `MenuCostChangeReason`{initialSet, manualEdit} + kolom `menus.cost`/`transaction_items.unit_cost`/`menu_variants.cost_source_menu_id`. Inventori = finished-goods porsi saja (selaras proposal Bab 1 §1.4).
> - **REV 2.10 (2026-05-30)** - menu variants & paket: tambah layer katalog `menu_option_groups`/`menu_options`/`menu_variants`/`menu_variant_options`/`paket_components`/`paket_choice_options`/`transaction_item_selections` + enum `MenuKind`/`PaketComponentKind` + kolom `menus.kind`/`menus.pos_visible` + `transaction_items.variant_id`.
> - **REV 2.7 (2026-05-29)** - shift redesign: `shifts.active_marker` (single-OPEN guard, `@@unique([active_marker])`); drop `@@unique([date, cashier, type])`. Atribusi revenue re-stamp `shift_id` saat bayar. Settlement keyed `@@unique([date])` (whole business day). `app_settings` window shift owner-configurable.
> - **REV 2.6 (2026-05-27)** - payment methods & banks extensible: drop enum `PaymentMethod` jadi master `payment_methods` + `banks` + junction `payment_method_banks`. Settlement dinamis via child `settlement_method_counts` (drop 12 kolom `system_*`/`actual_*`). `app_settings` (PB1 toggle owner-configurable). Tambah `transaction_payments` (split tender, REV 2.5); drop `transactions.payment_method`/`payment_bank`; drop `transaction_items.party_id`.
> - **REV 2.3 (2026-05-24)** - version bump kosmetik. No schema change. Alignment dengan permission matrix.
> - **REV 2.2 (2026-05-24)** - rename `stock_movements` → `portion_movements`.

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

## 3. Konvensi

- **Naming entity**: snake_case plural lowercase (`users`, `menus`, `transactions`, `transaction_payments`, `settlement_method_counts`, dst).
- **Naming column**: snake_case (`created_at`, `menu_id`, `current_qty`, `min_stock`, `unit_cost`, `tax_borne_amount`).
- **Primary key**: kolom `id` int auto-increment, kecuali:
  - `portion_stocks` yang PK-nya `menu_id` (1:1 dengan Menu),
  - `app_settings` yang PK-nya `id` singleton tetap `1`,
  - tabel junction composite-key (`payment_method_banks` = `[payment_method_id, bank_id]`, `menu_variant_options` = `[menu_variant_id, option_id]`, `settlement_method_counts` = `[settlement_id, payment_method_code]`).
- **Foreign key**: `<entity>_id` referring to `<entity>.id`. Marker `FK → <entity>`.
- **Tipe data**:
  - `INT` untuk PK & FK
  - `VARCHAR(n)` untuk string pendek
  - `DECIMAL(p, s)` untuk uang/kuantitas: `Decimal(10,2)` untuk price/cost/unit, `Decimal(12,2)` untuk total/subtotal/amount, `Decimal(5,2)` untuk persen pajak
  - `DATE` untuk tanggal tanpa jam
  - `DATETIME` untuk audit (`created_at`, `updated_at`, `paid_at`, dll)
  - `ENUM(...)` untuk status/kategori terbatas
  - `JSON` untuk struktur dinamis LEGACY (`menus.sub_options`, `transaction_items.sub_options_selected`) - sudah diganti relasi katalog REV 2.10, dipertahankan untuk data historis.
  - `BOOLEAN` untuk flag (`is_active`, `pos_visible`, `tax_enabled`, `requires_bank`)
- **M:N harus via junction**:
  - `menus × transactions` di-resolve via `transaction_items`,
  - `payment_methods × banks` di-resolve via `payment_method_banks`,
  - `menu_variants × menu_options` di-resolve via `menu_variant_options`.

## 4. Enum Definitions (11 enum REV 2.13)

```prisma
enum UserRole                  { owner, cashier, waiter }                          // kitchen DIHAPUS (masak out of scope)
enum TransactionStatus         { open, paid, void }
enum OrderType                 { dineIn, takeaway }                                // disederhanakan dari 5 jadi 2
enum SettlementStatus          { submitted, reviewed }
enum ShiftType                 { pagi, malam }                                     // 2 shift fixed
enum StockType                 { portion, linked, nonStock }                      // klasifikasi menu untuk stok
enum MenuKind                  { simple, variant, paket }                          // REV 2.10: jenis katalog menu
enum PaketComponentKind        { fixed, choice }                                   // REV 2.10: jenis komponen paket
enum PortionMovementReason     { order, restockMorning, restockEmergency,          // map: restock_morning/restock_emergency/manual_adjust/refund_void
                                 manualAdjust, refundVoid }
enum MenuCostChangeReason      { initialSet, manualEdit }                          // REV 2.11: log perubahan modal/COGS menu
enum BillCategory              { kebersihan, listrik, air, parkir, sewa }          // tagihan operasional bulanan owner
```

> ⚠️ **TIDAK ADA enum `PaymentMethod`.** Metode pembayaran adalah **master table extensible** (`payment_methods`, owner-configurable) - bukan enum. Slice pembayaran di `transaction_payments.method` menyimpan `code` string (denormalize dari `payment_methods.code`, audit-safe). Enum `RawMaterialMovementReason`/`RawMaterialCategory` sudah **dihapus** (raw materials di-drop REV 2.11).

## 5. Dua Puluh Tiga Entitas REV 2.13 (5 kelompok)

### 5.A Core operasional (7)
| #   | Entity                      | Purpose                                                              | Notes                                                                |
| --- | --------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | `users`                     | Pengguna: owner, kasir, waiter                                       | PIN 6 digit BOLEH DUPLIKAT (identifikasi via nama)                   |
| 2   | `shifts`                    | Siklus shift kasir (container per tanggal+tipe)                      | + `active_marker` (UK, single-OPEN guard sistem-wide); NO `@@unique([date,cashier,type])` |
| 3   | `transactions`              | Header pesanan                                                      | `order_type` 2 enum, `tax_borne_amount`, `merged_into_id?` (self-ref merge). **TIDAK ada** `payment_method`/`payment_bank` |
| 4   | `transaction_items`         | Junction menu × transactions + detail item                          | `unit_cost` (snapshot modal), `variant_id`, `notes`. **NO `party_id`** |
| 5   | `transaction_payments`      | **Slice pembayaran per transaksi (split tender)**                   | 1 Tx punya 1+ slice; Σ amount == total saat paid; bank wajib utk edc/transfer |
| 6   | `settlements`               | Rekap setoran whole-business-day                                   | `@@unique([date])`; rekap dinamis via child `settlement_method_counts` |
| 7   | `settlement_method_counts`  | **Child settlement per metode (dinamis)**                          | `counted` + `system` per metode; ganti 12 kolom `system_*`/`actual_*` lama |

### 5.B Katalog & varian (8)
| #   | Entity                       | Purpose                                                              | Notes                                                                |
| --- | ---------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 8   | `menus`                      | Katalog menu dengan `stock_type`, `kind`, `cost` (modal/COGS owner-only) | `cost` TIDAK bocor ke GET publik POS; `pos_visible` sembunyikan SKU granular |
| 9   | `menu_option_groups`         | Grup pilihan per-menu (axis varian atau free-preference)            | `affects_variant` true→bentuk varian; false→free pref (mis. Suhu)    |
| 10  | `menu_options`               | Nilai opsi dalam grup (mis. "Tawar", "Bakar")                       | -                                                                    |
| 11  | `menu_variants`              | Kombinasi sellable varian (harga eksak per-kombinasi)              | `stock_target_menu_id` decrement stok; `cost_source_menu_id` (Int? **soft-ref, BUKAN FK terdeklarasi**) sumber modal |
| 12  | `menu_variant_options`       | Junction varian × opsi pembentuk                                    | composite PK `[menu_variant_id, option_id]`                          |
| 13  | `paket_components`           | Komponen paket: fixed / choice                                      | target menu atau varian; choice punya `paket_choice_options[]`       |
| 14  | `paket_choice_options`       | Opsi pilihan dalam komponen paket kind=choice                       | `upcharge` per-opsi; target boleh varian (POS bercabang ke pemilih)  |
| 15  | `transaction_item_selections`| Pilihan tersimpan per item (slot paket + free-preference)          | `is_preference=true` → tak pengaruh stok/harga                       |

### 5.C Stok porsi (2)
| #   | Entity              | Purpose                                                            | Notes                                                                |
| --- | ------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 16  | `portion_stocks`    | Live count stok porsi per menu + opening snapshot pagi             | 1:1 dengan Menu (stockType=portion), boleh minus. **Pola SNAPSHOT**  |
| 17  | `portion_movements` | Audit log perubahan stok porsi (ledger)                            | delta +/- per order/restock/adjust. FK opsional → transactions + transaction_items (SET NULL). **Pola LEDGER** |

### 5.D Konfigurasi pembayaran (3)
| #   | Entity                | Purpose                                                            | Notes                                                                |
| --- | --------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 18  | `payment_methods`     | **Master metode pembayaran (extensible, owner-only)**             | code/label/colorHex/iconName/requiresBank/allowDineIn/allowTakeaway/displayOrder/isActive. **Ganti enum** |
| 19  | `banks`               | **Master bank reusable lintas metode**                            | soft-delete via `is_active`                                          |
| 20  | `payment_method_banks`| **Junction many-to-many metode ↔ bank**                          | composite PK `[payment_method_id, bank_id]`, CASCADE                 |

### 5.E Admin / config / audit (3)
| #   | Entity                | Purpose                                                            | Notes                                                                |
| --- | --------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 21  | `bills`               | Tagihan operasional bulanan owner                                  | kebersihan/listrik/air/parkir/sewa. Tampil **terpisah**, tidak dikurangkan ke laba kotor |
| 22  | `app_settings`        | **Pengaturan aplikasi global (singleton id=1)**                  | PB1 2-sumbu + identitas/branding resto + aturan stok + window shift  |
| 23  | `menu_cost_movements` | Audit log perubahan modal/COGS menu (REV 2.11)                    | costBefore/costAfter + reason(initialSet/manualEdit) + user pelaku   |

Total: **23 entitas**. (REV 2.11 sudah men-drop `raw_materials`/`raw_material_movements`/`vendors`/`purchases`/`purchase_items`.)

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
| category | VARCHAR(50) | - | "Signature Ayam Bakar", "Seafood", "Minuman", "Paket Hemat", dll |
| price | DECIMAL(10,2) | - | Rupiah (harga jual) |
| cost | DECIMAL(10,2)? | - | **Modal/COGS per unit (owner-only, TIDAK dibocorkan ke GET publik POS)**. null = belum di-set (0 saat hitung laba) |
| stock_type | StockType | - | portion / linked / nonStock (default nonStock) |
| min_stock | INT? | - | Hanya untuk stockType=portion |
| image_url | VARCHAR(255)? | - | Path foto (/menu/*.webp) atau URL CDN |
| sub_options | JSON? | - | **LEGACY (pre-REV 2.10)**: paket/linked berbasis nama. Diganti relasi katalog; dipertahankan untuk backfill |
| is_active | BOOLEAN | - | Default true |
| kind | MenuKind | - | **REV 2.10**: simple / variant / paket (default simple) |
| pos_visible | BOOLEAN | - | **REV 2.10**: false = SKU stok granular yang disembunyikan dari grid POS (hanya target stok varian) |
| created_at, updated_at | DATETIME | - | |

### 6.3. `portion_stocks`
| Kolom              | Tipe     | PK/FK/UK      | Keterangan                                                              |
| ------------------ | -------- | ------------- | ----------------------------------------------------------------------- |
| menu_id            | INT      | PK + FK→menus (CASCADE) | 1:1 dengan Menu stockType=portion                               |
| current_qty        | INT      | -             | Live count, BOLEH NEGATIF (stok minus didukung)                         |
| min_stock          | INT      | -             | Ambang reminder (duplicate dari menus.min_stock untuk query convenience) |
| opening_qty_today  | INT      | -             | Snapshot otomatis qty saat user pertama login pagi                       |
| opening_qty_date   | DATE     | -             | Tanggal snapshot, dipakai untuk trigger re-snapshot hari baru            |
| updated_at         | DATETIME | -             |                                                                         |

> Metric "Terjual Hari Ini" = `opening_qty_today + restock_today − current_qty`. Restock hari ini dihitung dari `SUM(portion_movements.delta WHERE reason IN ('restock_morning','restock_emergency') AND created_at::date = today)`.

### 6.4. `portion_movements`
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | |
| menu_id | INT | FK→menus | Item stok porsi yang berubah |
| delta | INT | - | + saat restock, − saat order |
| reason | PortionMovementReason | - | order / restock_morning / restock_emergency / manual_adjust / refund_void |
| transaction_id | INT? | FK→transactions (SET NULL) | Transaksi sumber (order/refund_void). FK **opsional** |
| transaction_item_id | INT? | FK→transaction_items (SET NULL) | Baris item penyebab decrement. 1 item paket bisa decrement banyak stok (N:1) |
| qty_before | INT? | - | Stok sebelum perubahan |
| qty_after | INT? | - | Stok sesudah (= qty_before + delta) |
| note | VARCHAR(255)? | - | Konteks manusiawi opsional (tautan dokumen via FK, bukan teks) |
| user_id | INT | FK→users | Siapa yang trigger |
| created_at | DATETIME | - | `@@index([menu_id, created_at])`, `@@index([transaction_id])` |

> **Catatan pola SNAPSHOT + LEDGER:** `portion_stocks` (snapshot live count) dan `portion_movements` (ledger delta) **TIDAK punya FK langsung satu sama lain** - keduanya FK ke `menus`. Konsistensi level stok terjaga lewat `qty_before`/`qty_after` per baris ledger + `current_qty` di snapshot.

### 6.5. `shifts`
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | |
| date | DATE | - | Tanggal business day shift |
| type | ShiftType | - | pagi / malam |
| cashier_id | INT | FK→users | Kasir pembuka shift |
| opening_cash | DECIMAL(12,2) | - | Modal awal laci kas (float baseline; Σ opening_cash dipakai di settlement) |
| closed_at | DATETIME? | - | null = shift terbuka |
| active_marker | INT? | **UK** | **REV 2.7: single-OPEN guard.** `@@unique([active_marker])` - hanya 1 shift OPEN sistem-wide per marker. Di-null-kan saat tutup. **NO `@@unique([date,cashier,type])`** (di-DROP REV 2.7) |
| created_at | DATETIME | - | `@@index([date, type, closed_at])` |

### 6.6. `transactions`
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | |
| shift_id | INT | FK→shifts | ID shift fiskal aktif. **REV 2.7: di-RE-STAMP ke shift aktif saat bayar** (atribusi revenue by payment) |
| order_type | OrderType | - | dineIn / takeaway (cuma 2 enum) |
| table_number | INT? | - | NULLABLE - hanya wajib untuk dineIn |
| created_by_id | INT | FK→users | **User yang submit order** (kasir/owner/waiter). RENAME dari `cashier_id` (shift-decoupling). "Kasir pemilik shift" diakses via `shift.cashier` |
| status | TransactionStatus | - | open / paid / void |
| merged_into_id | INT? | FK→transactions (self) | Merge bill: transaksi sumber yang di-merge punya pointer ke ID parent |
| subtotal | DECIMAL(12,2) | - | Σ subtotal items |
| discount_amount | DECIMAL(12,2) | - | Diskon manual |
| tax_amount | DECIMAL(12,2) | - | PB1 yang **ditambahkan ke total** (saat taxChargedToCustomer=true) |
| tax_borne_amount | DECIMAL(12,2) | - | **REV 2.12 BARU**: PB1 yang **DITANGGUNG resto** (TIDAK masuk total pelanggan; dikurangkan ke laba di dashboard). 0 saat PB1 dibebankan ke pelanggan / PB1 nonaktif |
| total | DECIMAL(12,2) | - | subtotal − discount + tax_amount |
| created_at, paid_at, voided_at | DATETIME | - | |

> ⚠️ **TIDAK ADA kolom `payment_method` / `payment_bank` di `transactions`** (di-drop REV 2.5). Pembayaran pindah ke `transaction_payments` (1-N split tender); bank via junction `payment_method_banks`.

### 6.7. `transaction_items`
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | |
| transaction_id | INT | FK→transactions (CASCADE) | |
| menu_id | INT | FK→menus | |
| qty | INT | - | |
| unit_price | DECIMAL(10,2) | - | Snapshot harga jual saat order |
| subtotal | DECIMAL(12,2) | - | qty × unit_price |
| unit_cost | DECIMAL(10,2)? | - | **REV 2.11**: snapshot modal/COGS per unit saat order (mirror unit_price). Untuk paket = Σ modal komponen. null = baris historis pra-backfill (dihitung 0). Laba: Σ unit_cost × qty |
| sub_options_selected | JSON? | - | **LEGACY (pre-REV 2.10)**: pilihan paket berbasis label. Diganti relasi `selections` + `variant_id`; dipertahankan untuk data historis |
| notes | VARCHAR(255)? | - | **REV 2.4**: catatan per item dari waiter/kasir (mis. "kurang manis", "Panas"/"Dingin" untuk minuman ambigu suhu via quick toggle CartItemRow) |
| variant_id | INT? | FK→menu_variants (SET NULL) | **REV 2.10**: varian yang terjual (null untuk simple/paket). unit_price = harga varian |
| created_at | DATETIME | - | |

> ⚠️ **TIDAK ADA kolom `party_id`** (di-drop REV 2.5). Split bill multi-party **tidak diadopsi**; diganti **split-tender** (`transaction_payments` multi-method per 1 transaksi).

### 6.8. `transaction_payments` (REV 2.5 BARU - split tender)
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | |
| transaction_id | INT | FK→transactions (CASCADE) | `@@index([transaction_id])` |
| method | VARCHAR(20) | - | **Denormalize dari `payment_methods.code`** (audit-safe). Validasi runtime: harus exist di payment_methods |
| bank | VARCHAR(50)? | - | Wajib untuk method dengan requiresBank=true (mis. EDC/transfer); divalidasi via junction payment_method_banks |
| amount | DECIMAL(12,2) | - | Nominal slice. Σ amount per transaksi == total saat status=paid |
| recorded_by_id | INT | FK→users | User yang submit slice (audit per slice) |
| recorded_at | DATETIME | - | |

> Single tender = 1 record (method+amount=total). Split tender = N records (mis. cash 100k + qris 65k).

### 6.9. `settlements`
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | |
| shift_id | INT | FK→shifts, **UK** | 1:1 dengan shift (penanda shift terkait setoran) |
| date | DATE | **UK** | **REV 2.7: `@@unique([date])` - setoran per WHOLE BUSINESS DAY** (bukan per shift malam) |
| cashier_id | INT | FK→users | Penyetor = **kasir penutup shift terakhir hari itu / owner** (BUKAN "kasir malam only") |
| reviewer_id | INT? | FK→users | Owner yang review |
| status | SettlementStatus | - | submitted / reviewed |
| submitted_at, reviewed_at | DATETIME | - | |

> ⚠️ **TIDAK ADA 12 kolom `system_*` / `actual_*`** (di-drop REV 2.6). Rekap per metode pindah ke child `settlement_method_counts` (dinamis sesuai jumlah payment_methods aktif). Variance dihitung runtime (`counted − system`). Breakdown per bank dihitung runtime dari `transaction_payments GROUP BY method, bank`.

### 6.10. `settlement_method_counts` (REV 2.6 BARU - child settlement dinamis)
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| settlement_id | INT | PK (composite) + FK→settlements (CASCADE) | |
| payment_method_code | VARCHAR(20) | PK (composite) + FK→payment_methods.code (NoAction) | Denormalize code; method tak bisa hard-delete jika masih di-refer (pakai soft-delete isActive) |
| system | INT | - | Total dari sistem untuk metode ini (groupBy transaction_payments) |
| counted | INT | - | Total fisik input kasir saat blind count |

> Composite PK `[settlement_id, payment_method_code]`. `@@index([payment_method_code])`. Variance = `counted − system` (runtime).

### 6.11. `payment_methods` (REV 2.6 BARU - master extensible, ganti enum)
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | |
| code | VARCHAR(20) | **UK** | Kode unik (mis. "cash", "edc", "qris", "gojek", "grab", "transfer", "shopeepay") |
| label | VARCHAR(50) | - | Nama tampil |
| color_hex | VARCHAR(7) | - | Warna tombol/chart |
| icon_name | VARCHAR(30) | - | Nama ikon |
| requires_bank | BOOLEAN | - | true → wajib pilih bank saat bayar (mis. EDC/transfer) |
| allow_dine_in | BOOLEAN | - | Tampil untuk order dine-in? |
| allow_takeaway | BOOLEAN | - | Tampil untuk order takeaway? |
| is_active | BOOLEAN | - | Soft delete |
| display_order | INT | - | Urutan tampil (atomic reorder) |
| created_at, updated_at | DATETIME | - | |

### 6.12. `banks` (REV 2.6 BARU)
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | |
| name | VARCHAR(50) | **UK** | Nama bank (mis. "BCA", "Mandiri") |
| is_active | BOOLEAN | - | Soft delete |
| created_at, updated_at | DATETIME | - | |

### 6.13. `payment_method_banks` (REV 2.6 BARU - junction M:N)
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| payment_method_id | INT | PK (composite) + FK→payment_methods (CASCADE) | |
| bank_id | INT | PK (composite) + FK→banks (CASCADE) | |
| created_at | DATETIME | - | Composite PK `[payment_method_id, bank_id]` |

### 6.14. `bills`
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | |
| month | VARCHAR(7) | - | YYYY-MM. `@@index([month])` |
| category | BillCategory | - | kebersihan / listrik / air / parkir / sewa |
| amount | DECIMAL(12,2) | - | |
| note | VARCHAR(255)? | - | |
| user_id | INT | FK→users | OWNER ONLY (validasi di layer service) |
| created_at | DATETIME | - | |

### 6.15. `app_settings` (REV 2.6/2.7/2.12 - singleton id=1)
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | Singleton, selalu = 1 |
| tax_enabled | BOOLEAN | - | PB1 aktif? **DEFAULT false** (resto ini tidak charge PB1) |
| tax_rate | DECIMAL(5,2) | - | Persen pajak (default 10.00) |
| tax_charged_to_customer | BOOLEAN | - | **REV 2.12 sumbu-2**: true = PB1 ditambah ke tagihan pelanggan; false = ditanggung resto (→ `tax_borne_amount`) |
| restaurant_name | VARCHAR(120) | - | Identitas resto (header struk + branding) |
| restaurant_address | VARCHAR(255)? | - | |
| opening_hours | VARCHAR(64)? | - | |
| restaurant_phone | VARCHAR(32)? | - | |
| restaurant_logo_url | VARCHAR(255)? | - | Logo untuk struk/branding |
| restock_multiple | INT | - | **REV 2.12**: kelipatan restock pagi (ganti hardcode 5) |
| low_stock_threshold | INT | - | Ambang reminder stok rendah |
| timezone | VARCHAR(64) | - | Default "Asia/Jakarta" (business day window) |
| shift_pagi_start | VARCHAR(5) | - | Jam mulai shift pagi (default "07:00") |
| shift_changeover | VARCHAR(5) | - | Jam pergantian pagi→malam (default "18:00") |
| shift_malam_end | VARCHAR(5) | - | Jam akhir shift malam (default "23:00") |
| updated_at | DATETIME | - | |
| updated_by_id | INT? | FK→users (SET NULL) | Owner pengubah terakhir |

### 6.16. `menu_cost_movements` (REV 2.11 - audit log modal/COGS)
| Kolom | Tipe | PK/FK/UK | Keterangan |
|---|---|---|---|
| id | INT | PK | |
| menu_id | INT | FK→menus | Menu (SKU leaf / simple) yang modalnya berubah |
| cost_before | DECIMAL(10,2)? | - | Modal sebelum (null = sebelumnya belum di-set) |
| cost_after | DECIMAL(10,2)? | - | Modal sesudah |
| reason | MenuCostChangeReason | - | initialSet (null→nilai pertama) / manualEdit (ubah nilai) |
| note | VARCHAR(255)? | - | Konteks manusiawi opsional |
| user_id | INT | FK→users | Owner yang mengubah modal |
| created_at | DATETIME | - | `@@index([menu_id, created_at])` |

> Auto-generated rows di dalam `$transaction` `upsertMenu` saat `Menu.cost` berubah. Read owner-only via `GET /menus/:id/cost-history`.

### 6.17. Layer katalog varian & paket (REV 2.10)

**`menu_option_groups`** - id PK · menu_id FK→menus (CASCADE) · name VARCHAR(50) · affects_variant BOOLEAN (true→bentuk varian; false→free-preference) · display_order INT.

**`menu_options`** - id PK · option_group_id FK→menu_option_groups (CASCADE) · label VARCHAR(50) · display_order INT.

**`menu_variants`** - id PK · menu_id FK→menus (CASCADE, "MenuOwnsVariant") · label VARCHAR(120) · price DECIMAL(10,2) eksak per-kombinasi · stock_target_menu_id FK→menus (Restrict, "VariantStockTarget") menu porsi yang di-decrement · **cost_source_menu_id INT? (SOFT-REFERENCE, BUKAN FK terdeklarasi)** - kolom integer biasa, sumber modal varian nonStock (resolusi = cost_source_menu_id ?? stock_target_menu_id) · is_active BOOLEAN · display_order INT.

**`menu_variant_options`** - junction M:N. Composite PK `[menu_variant_id, option_id]` · menu_variant_id FK→menu_variants (CASCADE) · option_id FK→menu_options (CASCADE).

**`paket_components`** - id PK · paket_menu_id FK→menus (CASCADE, "PaketOwner") · kind PaketComponentKind (fixed/choice) · label VARCHAR(60) · qty INT · display_order INT · target_menu_id FK→menus? (Restrict) · target_variant_id FK→menu_variants? (Restrict).

**`paket_choice_options`** - id PK · paket_component_id FK→paket_components (CASCADE) · label VARCHAR(60) · target_menu_id FK→menus? (Restrict) · target_variant_id FK→menu_variants? (Restrict) · upcharge DECIMAL(10,2) per-opsi.

**`transaction_item_selections`** - id PK · transaction_item_id FK→transaction_items (CASCADE) · group_or_slot_label VARCHAR(60) · chosen_label VARCHAR(120) · target_menu_id INT? · target_variant_id INT? · is_preference BOOLEAN (true→free-preference, tak pengaruh stok/harga).

## 7. Relasi REV 2.13 (~39 FK, dikelompokkan)

### 7.A Core operasional
| Parent | Child | Via | Cardinality | Catatan |
|---|---|---|---|---|
| users | transactions | created_by_id | 1 : N | User yang submit order (audit trail) |
| users | shifts | cashier_id | 1 : N | Kasir pembuka shift |
| users | transaction_payments | recorded_by_id | 1 : N | User perekam slice (split tender) |
| users | settlements | cashier_id ("SettlementCashier") | 1 : N | Penyetor |
| users | settlements | reviewer_id (nullable, "SettlementReviewer") | 0..1 : N | Owner reviewer |
| users | bills | user_id | 1 : N | Owner input tagihan |
| users | portion_movements | user_id | 1 : N | Audit trail stok porsi |
| users | menu_cost_movements | user_id | 1 : N | Owner pengubah modal/COGS |
| users | app_settings | updated_by_id (nullable, SET NULL) | 0..1 : N | Owner pengubah pengaturan |
| shifts | transactions | shift_id | 1 : N | Transaksi ter-attach ke shift (re-stamp saat bayar) |
| shifts | settlements | shift_id | 1 : 1 (UNIQUE) | Penanda shift terkait setoran |
| transactions | transaction_items | transaction_id | 1 : 1..N (composition, CASCADE) | Item detail |
| transactions | transaction_payments | transaction_id | 1 : N (CASCADE) | Slice pembayaran (split tender) |
| transactions | transactions | merged_into_id (self, nullable) | 0..1 : N | Merge bill (set pointer; **query revenue/settlement exclude merged_into_id IS NOT NULL**) |
| transactions | portion_movements | transaction_id (nullable, SET NULL) | 1 : N | Movement order/void ke transaksi sumber |
| transaction_items | portion_movements | transaction_item_id (nullable, SET NULL) | 1 : N | Movement ke baris item penyebab decrement |
| settlements | settlement_method_counts | settlement_id | 1 : N (CASCADE) | Rekap per metode (dinamis) |

### 7.B Katalog & varian (REV 2.10)
| Parent | Child | Via | Cardinality | Catatan |
|---|---|---|---|---|
| menus | menu_option_groups | menu_id | 1 : N (CASCADE) | Grup pilihan per-menu |
| menu_option_groups | menu_options | option_group_id | 1 : N (CASCADE) | Nilai opsi |
| menus | menu_variants | menu_id ("MenuOwnsVariant") | 1 : N (CASCADE) | Varian milik menu |
| menus | menu_variants | stock_target_menu_id ("VariantStockTarget", Restrict) | 1 : N | Menu porsi target decrement varian |
| menu_variants | menu_variant_options | menu_variant_id | 1 : N (CASCADE) | Junction sisi varian |
| menu_options | menu_variant_options | option_id | 1 : N (CASCADE) | Junction sisi opsi (M:N varian×opsi) |
| menus | paket_components | paket_menu_id ("PaketOwner") | 1 : N (CASCADE) | Komponen paket |
| menus | paket_components | target_menu_id (nullable, Restrict, "PaketComponentTargetMenu") | 1 : N | Target menu komponen fixed |
| menu_variants | paket_components | target_variant_id (nullable, Restrict, "PaketComponentTargetVariant") | 1 : N | Target varian komponen |
| paket_components | paket_choice_options | paket_component_id | 1 : N (CASCADE) | Opsi pilihan paket choice |
| menus | paket_choice_options | target_menu_id (nullable, Restrict, "ChoiceOptTargetMenu") | 1 : N | Target menu opsi |
| menu_variants | paket_choice_options | target_variant_id (nullable, Restrict, "ChoiceOptTargetVariant") | 1 : N | Target varian opsi |
| menus | transaction_items | menu_id | 1 : N | Histori order |
| menu_variants | transaction_items | variant_id (nullable, SET NULL) | 1 : N | Varian terjual |
| transaction_items | transaction_item_selections | transaction_item_id | 1 : N (CASCADE) | Pilihan slot/free-preference tersimpan |

> ⚠️ `menu_variants.cost_source_menu_id` adalah kolom **Int? soft-reference TANPA FK terdeklarasi** - JANGAN gambar/anggap sebagai relasi FK di ERD.

### 7.C Stok porsi & COGS
| Parent | Child | Via | Cardinality | Catatan |
|---|---|---|---|---|
| menus | portion_stocks | menu_id | 1 : 0..1 (CASCADE) | Hanya menu stockType=portion punya stok (1:1) |
| menus | portion_movements | menu_id | 1 : N | Audit perubahan stok porsi (ledger) |
| menus | menu_cost_movements | menu_id | 1 : N | Audit perubahan modal/COGS menu |

### 7.D Konfigurasi pembayaran (REV 2.6)
| Parent | Child | Via | Cardinality | Catatan |
|---|---|---|---|---|
| payment_methods | payment_method_banks | payment_method_id | 1 : N (CASCADE) | Junction sisi metode |
| banks | payment_method_banks | bank_id | 1 : N (CASCADE) | Junction sisi bank (M:N metode×bank) |
| payment_methods | settlement_method_counts | code → payment_method_code (NoAction) | 1 : N | Denormalize code; method tak bisa hard-delete jika di-refer |

Total: **~39 relasi FK** (REV 2.13). Termasuk self-ref merge (`transactions.merged_into_id → transactions`), 2 junction M:N, 3 FK opsional onDelete:SetNull, dan beberapa relasi multi-FK ke `menus`/`menu_variants` (target stok + target paket).

## 8. Mengapa Struktur Ini Menjawab Masalah Skripsi

| Rumusan Masalah (Bab 1.2) | Entitas yang menjawab |
|---|---|
| A. Percepat durasi transaksi | `transactions` (orderType 2 enum, tax/discount auto, merged_into_id untuk merge) + `transaction_items` (variant_id, selections, notes) + `transaction_payments` (**split-tender**: 1 transaksi bisa beberapa metode bayar tanpa pisah struk) |
| B. Percepat rekonsiliasi + kurangi mismatch | `shifts` (modal awal, active_marker single-OPEN guard, atribusi re-stamp) + `settlements` whole-business-day + `settlement_method_counts` (system vs counted **dinamis per metode**) + breakdown per bank runtime via `transaction_payments GROUP BY method, bank` |
| C. Manajemen stok harian | `portion_stocks` (live count + opening snapshot) + `portion_movements` (ledger audit perubahan stok porsi dengan qty_before/after) |
| #4 Owner tahu laba & pengeluaran | `menus.cost` + `transaction_items.unit_cost` + `menu_cost_movements` → **Laba Kotor = Pendapatan − COGS − PB1-borne** (`tax_borne_amount`); `bills` (tagihan owner) ditampilkan **terpisah**, tidak dikurangkan ke laba kotor |
| #5 Konfigurasi mandiri owner | `payment_methods`/`banks`/`payment_method_banks` (metode bayar extensible) + `app_settings` (PB1 2-sumbu + identitas/branding + window shift + aturan stok) - owner tidak perlu developer untuk konfigurasi operasional |
| #6 Traceability stok & modal | `portion_movements` (perubahan stok) + `menu_cost_movements` (perubahan modal) - ter-audit dengan pelaku & timestamp |

## 9. Narasi untuk Bab 3 Skripsi (paste-ready, REV 2.13)

> ⚠️ **Catatan REV 2.13:** narasi di bawah perlu **review thesis-level oleh Ezra** + renumber Gambar/Tabel. Sebagian kalimat menyederhanakan untuk keterbacaan; struktur faktual sudah disesuaikan ke 23 entitas.
>
> **3.5.1 Entity Relationship Diagram**
>
> Gambar 3.X menunjukkan Entity Relationship Diagram (ERD) dari Sistem POS Restoran Ayam Bakar Banjar Monosuko. Sistem terdiri dari dua puluh tiga entitas yang dapat dikelompokkan menjadi lima bagian: inti operasional (pengguna, shift, transaksi beserta item, slice pembayaran, dan setoran beserta rincian per metodenya), katalog dan varian menu, stok porsi, konfigurasi pembayaran, serta administrasi dan audit. Rancangan ini merepresentasikan operasional restoran dengan satu kategori stok (stok porsi siap jual yang berkurang otomatis saat transaksi dengan jejak audit di `portion_movements`), dua tipe order (dine-in dan takeaway yang dibedakan dari ada/tidaknya pemilihan nomor meja, dengan sumber order takeaway diidentifikasi melalui metode pembayaran), serta perhitungan laba kotor harian melalui modal/COGS per menu.
>
> Entitas `users` menyimpan data tiga jenis pengguna: owner, kasir, dan waiter, dengan PIN enam digit yang boleh duplikat karena identifikasi pengguna dilakukan melalui kombinasi nama dan PIN saat login. Entitas `menus` merupakan katalog menu dengan klasifikasi `stock_type` (portion, linked, atau nonStock) yang menentukan perilaku decrement stok, serta `kind` (simple, variant, atau paket) yang menentukan presentasi katalog. Untuk menu varian, struktur pilihan disusun melalui entitas `menu_option_groups`, `menu_options`, `menu_variants`, dan tabel relasi `menu_variant_options`, di mana setiap kombinasi sellable memiliki harga eksak tersendiri. Untuk menu paket, komposisi dirinci melalui `paket_components` (komponen tetap maupun pilihan) dan `paket_choice_options`.
>
> Entitas `portion_stocks` menyimpan kondisi stok porsi dengan kolom `opening_qty_today` dan `opening_qty_date` untuk mengakomodasi snapshot otomatis di awal hari - kondisi ini dipakai untuk menghitung metric "terjual hari ini" pada dashboard. Stok porsi diperbolehkan bernilai negatif untuk mendukung skenario pemesanan saat stok habis; restock darurat dicatat melalui fitur "Barang Masuk" yang tercatat di `portion_movements` dengan reason `restock_emergency`. Penting dicatat bahwa `portion_stocks` (pola snapshot) dan `portion_movements` (pola ledger) tidak terhubung langsung melalui kunci asing, melainkan sama-sama merujuk ke `menus`; konsistensi nilai stok dijaga melalui kolom `qty_before` dan `qty_after` pada tiap baris pergerakan.
>
> Untuk perhitungan laba kotor, entitas `menus` memiliki kolom `cost` (modal/COGS per unit) yang hanya dapat diakses owner dan tidak dibocorkan ke katalog publik. Setiap perubahan modal dicatat di entitas `menu_cost_movements` (nilai sebelum/sesudah, alasan set-awal atau penyesuaian, pelaku, dan waktu). Sistem secara sadar tidak mencatat bahan baku mentah - inventori dibatasi pada barang siap jual satuan porsi, sesuai ruang lingkup penelitian (lihat sub-bab Batasan Penelitian).
>
> Entitas `transactions` menyimpan kepala pesanan dengan kolom `order_type` (dineIn atau takeaway), `tax_amount` untuk PB1 yang dibebankan ke pelanggan, `tax_borne_amount` untuk PB1 yang ditanggung resto (tidak menambah total pelanggan namun dikurangkan dari laba), serta `merged_into_id` (self-reference nullable) untuk mengakomodasi penggabungan dua transaksi meja menjadi satu pembayaran. Pembayaran tidak lagi disimpan sebagai kolom tunggal pada transaksi, melainkan dipecah ke entitas `transaction_payments` (split tender) sehingga satu transaksi dapat dilunasi dengan beberapa metode sekaligus (misalnya sebagian tunai dan sebagian QRIS). Metode pembayaran sendiri tidak lagi berupa enum tetap, melainkan master data `payment_methods` yang dapat dikonfigurasi owner, dengan relasi banyak-ke-banyak ke `banks` melalui `payment_method_banks` untuk pelaporan mutasi per bank.
>
> Entitas `settlements` menyimpan rekap setoran satu kali per hari kerja penuh (business day), dikunci unik per tanggal, dan dilakukan oleh kasir penutup shift terakhir hari itu atau oleh owner. Rincian per metode tidak lagi disimpan sebagai dua belas kolom tetap, melainkan dinamis melalui entitas anak `settlement_method_counts` yang menyimpan nilai sistem dan nilai hitung fisik untuk tiap metode aktif; selisihnya dihitung saat runtime. Entitas `bills` menyimpan tagihan operasional bulanan (kebersihan, listrik, air, parkir, sewa) yang hanya dapat diinput owner dan ditampilkan terpisah dari laba kotor. Entitas `app_settings` (baris tunggal) menampung pengaturan global yang dapat diatur owner secara mandiri: aktivasi dan tarif PB1 beserta penanggungnya, identitas dan logo restoran untuk struk, aturan kelipatan restock, serta jendela waktu (window) shift pagi dan malam.
>
> Sistem memiliki sekitar tiga puluh sembilan relasi yang menghubungkan entitas-entitas tersebut, dengan dominasi relasi satu-ke-banyak (1:N), relasi satu-ke-satu (1:1) antara shift dan settlement, relasi self-reference pada `transactions` untuk merge, serta dua relasi banyak-ke-banyak yang dijabarkan melalui tabel asosiatif (`payment_method_banks` dan `menu_variant_options`). Relasi banyak-ke-banyak antara menu dan transaksi tetap dijabarkan melalui entitas asosiatif `transaction_items`. Detail atribut dan tipe data setiap entitas dijabarkan pada tabel-tabel di sub-bab berikutnya.

## 10. Modal/COGS per Menu + Bill of Materials (Out of Scope)

ERD ini secara sadar **tidak mencatat bahan baku mentah maupun Bill of Materials / resep** - inventori dibatasi pada barang siap jual satuan porsi (`portion_stocks`). Modal/COGS dinyatakan langsung per menu oleh owner (`menus.cost`), bukan dihitung dari konsumsi bahan baku terukur. Proses memasak dilakukan batch di rumah owner tanpa penimbangan baku, dan komposisi peracikan bumbu bersifat tidak tetap serta tidak terdokumentasi.

Implikasi struktural di ERD:
- **Tidak ada entitas `raw_materials`, `vendors`, atau `purchases`/`purchase_items`** (dihapus REV 2.11); tidak ada FK BoM/resep yang men-decrement bahan mentah saat order masuk.
- Modal/COGS melekat per menu (`menus.cost`, owner-only), di-snapshot per item transaksi (`transaction_items.unit_cost`) sebagai nilai point-in-time mirip harga jual, dengan jejak perubahan di `menu_cost_movements`.
- Untuk varian nonStock, sumber modal ditunjuk via kolom soft-reference `menu_variants.cost_source_menu_id` (resolusi = `cost_source_menu_id ?? stock_target_menu_id`).
- Konversi bahan mentah → stok porsi terjadi manual di rumah owner, di luar sistem.
- Laporan owner menampilkan: Pendapatan total per periode (dari `transactions` paid, exclude `merged_into_id` IS NOT NULL), COGS total (Σ `unit_cost` × qty), PB1-ditanggung (Σ `tax_borne_amount`), dan **Laba Kotor = Pendapatan − COGS − PB1-borne**. Tagihan operasional bulanan (`bills`) ditampilkan terpisah dan tidak dikurangkan ke laba kotor.

Justifikasi lengkap (paragraf paste-ready) ada di [`docs/operasional-resto.md`](../operasional-resto.md) seksi "Bill of Materials / HPP per Bahan (Out of Scope)" dan "COGS per Menu + Laporan Laba Rugi Harian".

## 11. Workflow Build di StarUML / Mermaid

Untuk ERD, gunakan **`generate_diagram` dengan Mermaid `erDiagram` syntax** via staruml-mcp. Jangan manual `create_element` per-column (kolom masuk ke `ownedElements` field, bukan `columns` field, sehingga tidak render di entity box). Lihat [[feedback_erd_use_mermaid]] di memory.

ERD sudah di-**rebuild REV 2.13** di StarUML (`Skripsi.mdj`) dalam container "ERD Model" - 23 entitas via Mermaid `erDiagram`. Diagram versi lama (REV 2.2/2.11) sudah dihapus; satu sisa "Login lama" di-flag HAPUS MANUAL.

## 12. Perubahan REV 2.11 → REV 2.13 (rekonsiliasi ke schema nyata)

ERD baseline REV 2.11 hanya mencatat himpunan "10 entitas core" dan menunda pelipatan layer REV 2.5–2.10 (split-tender, payment methods, varian, app settings) ke spec masing-masing. REV 2.13 melipat **seluruh** layer yang sudah berjalan di kode menjadi satu ERD utuh.

### Entitas
| Status | Detail |
|---|---|
| ✅ Sudah ada (10 core) | `users`, `menus`, `portion_stocks`, `portion_movements`, `menu_cost_movements`, `shifts`, `transactions`, `transaction_items`, `settlements`, `bills` |
| 🆕 Dilipat ke ERD (13) | `transaction_payments`, `settlement_method_counts`, `payment_methods`, `banks`, `payment_method_banks`, `app_settings`, `menu_option_groups`, `menu_options`, `menu_variants`, `menu_variant_options`, `paket_components`, `paket_choice_options`, `transaction_item_selections` |
| ❌ Tetap DROP | `vendors`, `purchases`, `purchase_items`, `raw_materials`, `raw_material_movements` (REV 2.11) |

### Kolom (koreksi vs doc lama)
| Tabel | Koreksi |
|---|---|
| `transactions` | **DROP** `payment_method` (enum) + `payment_bank` → pindah `transaction_payments`. **TAMBAH** `tax_borne_amount`, `created_by_id` (rename dari `cashier_id`). Pertahankan `merged_into_id`. |
| `transaction_items` | **DROP** `party_id` (split-bill obsolete → split-tender). **TAMBAH** `unit_cost`, `variant_id`, `notes`. |
| `settlements` | **DROP** 12 kolom `system_*`/`actual_*` → child `settlement_method_counts`. **TAMBAH** `@@unique([date])` (whole business day). Penyetor = kasir penutup terakhir / owner (bukan "kasir malam only"). |
| `shifts` | **TAMBAH** `active_marker` (UK, single-OPEN guard). **DROP** `@@unique([date,cashier,type])`. |
| `menus` | **TAMBAH** `kind`, `pos_visible` (REV 2.10) + `cost` (REV 2.11). |

### Enum
| Status | Detail |
|---|---|
| ❌ DROP | enum `PaymentMethod` (→ master table `payment_methods`); `RawMaterialMovementReason`/`RawMaterialCategory` (raw materials dihapus). |
| 🆕 ADA | `MenuKind`, `PaketComponentKind` (REV 2.10), `MenuCostChangeReason` (REV 2.11). |

**Total: 23 entitas / 11 enum / ~39 relasi FK (REV 2.13).**

## 13. Referensi Konvensi

- Skill: `.claude/skills/erd-diagram/SKILL.md`
- Schema implementasi (kebenaran struktur): [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma)
- Data dictionary penuh (Bab 3): [`docs/DATA-DICTIONARY.md`](../DATA-DICTIONARY.md)
- Ground truth alur bisnis (sumber kebenaran tertinggi): [`docs/operasional-resto.md`](../operasional-resto.md)
- Design spec permission matrix: [`docs/superpowers/specs/2026-05-24-permission-matrix-design.md`](../superpowers/specs/2026-05-24-permission-matrix-design.md)
- Spec COGS per menu: [`docs/superpowers/specs/2026-05-30-cogs-per-menu-remove-belanja-design.md`](../superpowers/specs/2026-05-30-cogs-per-menu-remove-belanja-design.md)
- Use case sistem: [`docs/knowledge/USE-CASE.md`](./USE-CASE.md)
- Activity diagram: [`docs/knowledge/ACTIVITY.md`](./ACTIVITY.md)

## 14. Bad Practice yang Dihindari

- ❌ Entity tanpa PK → setiap entity wajib punya PK
- ❌ M:N digambar langsung dengan crow's-foot fork dua sisi → wajib junction entity (`transaction_items`, `payment_method_banks`, `menu_variant_options`)
- ❌ FK tanpa reference ke entity target → tulis `FK → <entity>`
- ❌ Mix naming (`id_menu` di satu tabel, `menu_id` di tabel lain) → konsisten snake_case
- ❌ Pakai notasi Chen (diamond relationship) untuk skripsi POS → konsisten crow's-foot
- ❌ Menyimpan computed value (mis. `variance_cash` atau breakdown bank) → cukup hitung di runtime
- ❌ Hardcoded enum untuk kategori yang sering bertambah (mis. metode pembayaran) → pakai master table extensible (`payment_methods`/`banks`)
- ❌ Relasi otomatis raw_material → portion_stock (BOM/resep) → tidak ada di sistem, HPP out of scope
- ❌ Audit log gabungan polymorphic 1 tabel untuk 2 jenis stok → pakai tabel terpisah dengan FK proper
- ❌ Naming ambigu (`stock_movements`) → rename eksplisit ke `portion_movements`
- ❌ **REV 2.13:** menggambar `menu_variants.cost_source_menu_id` sebagai relasi FK → ini kolom Int? soft-reference TANPA FK terdeklarasi, jangan tarik garis relasi
