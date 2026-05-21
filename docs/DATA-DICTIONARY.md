# Data Dictionary — Sistem POS Ayam Bakar Banjar Monosuko

Dokumen ini melengkapi ERD di Skripsi.mdj. Setiap entity di ERD punya tabel definisi lengkap di bawah ini, mengikuti format standar skripsi UK Petra (ref: tabel 3.1-3.8 di contoh skripsi POS).

**Format:** `Field | Tipe Data | Keterangan`. Ikuti urutan ini saat menyalin ke naskah Bab 3.

---

## Tabel 3.1 Tabel users

Menyimpan data pengguna sistem (owner, cashier, kitchen).

| Field       | Tipe Data                        | Keterangan                                        |
|-------------|----------------------------------|---------------------------------------------------|
| id          | INT – PK                        | ID unik user                                      |
| name        | Varchar(100)                     | Nama lengkap user                                 |
| pin         | Varchar(6) – UNIQUE              | PIN 6-digit untuk login (unik antar user)         |
| role        | Enum(owner, cashier, kitchen)    | Peran user dalam sistem                           |
| is_active   | Boolean                          | Status aktif / non-aktif user                     |
| created_at  | Timestamp                        | Waktu user dibuat                                 |
| updated_at  | Timestamp                        | Waktu update terakhir                             |

---

## Tabel 3.2 Tabel menus

Katalog menu siap jual yang dijual di restoran.

| Field       | Tipe Data         | Keterangan                                   |
|-------------|-------------------|----------------------------------------------|
| id          | INT – PK         | ID unik menu                                 |
| name        | Varchar(100)      | Nama menu (contoh: "Paket Serasi")           |
| category    | Varchar(50)       | Kategori menu (ayam / minuman / nasi / dll)  |
| price       | Decimal(10,2)     | Harga jual satuan                            |
| is_active   | Boolean           | Menu aktif (bisa dipesan) atau tidak         |
| created_at  | Timestamp         | Waktu menu ditambahkan                       |
| updated_at  | Timestamp         | Waktu update terakhir                        |

---

## Tabel 3.3 Tabel daily_menu_stocks

Stok per menu per hari. Diinput pagi oleh Kitchen, dikurangi otomatis saat pembayaran.

| Field          | Tipe Data         | Keterangan                                                |
|----------------|-------------------|-----------------------------------------------------------|
| id             | INT – PK         | ID unik record stok                                       |
| date           | Date              | Tanggal stok (bagian dari UNIQUE(date, menu_id))          |
| menu_id        | INT – FK → menus | Referensi ke menu                                         |
| opening_stock  | Integer           | Jumlah stok awal dari rumah pemilik (pagi)                |
| current_stock  | Integer           | Stok tersisa realtime (berkurang saat transaction paid)   |
| updated_at     | Timestamp         | Waktu update terakhir                                     |

**Index/Constraint:** UNIQUE(date, menu_id) — satu menu hanya punya satu record per hari.

---

## Tabel 3.4 Tabel shifts

Shift buka/tutup kasir per cashier per hari. Parent dari transactions + settlement.

| Field         | Tipe Data          | Keterangan                                           |
|---------------|--------------------|------------------------------------------------------|
| id            | INT – PK          | ID unik shift                                        |
| date          | Date               | Tanggal shift                                        |
| cashier_id    | INT – FK → users  | Kasir yang membuka shift                             |
| opening_cash  | Decimal(12,2)      | Modal awal (petty cash) saat Buka Kasir              |
| closed_at     | Timestamp nullable | Waktu Tutup Kasir (null = shift masih open)          |
| created_at    | Timestamp          | Waktu shift dibuat                                   |

---

## Tabel 3.5 Tabel transactions

Header pesanan per meja. Satu meja = satu transaction sampai dibayar.

| Field            | Tipe Data                                              | Keterangan                                       |
|------------------|--------------------------------------------------------|--------------------------------------------------|
| id               | INT – PK                                              | ID unik transaksi                                |
| shift_id         | INT – FK → shifts                                     | Shift di mana transaksi dilakukan                |
| table_number     | Integer                                                | Nomor meja                                       |
| cashier_id       | INT – FK → users                                      | Kasir yang menangani transaksi                   |
| status           | Enum(open, paid, void)                                 | Status: open=belum bayar, paid=lunas, void=batal |
| payment_method   | Enum(cash, qris, transfer, debit, credit, ojol) null   | Metode bayar (diisi saat pay; null saat open)    |
| subtotal         | Decimal(12,2)                                          | Total sebelum diskon                             |
| discount_amount  | Decimal(12,2)                                          | Nominal diskon (default 0)                       |
| total            | Decimal(12,2)                                          | subtotal − discount_amount                       |
| created_at       | Timestamp                                              | Waktu transaksi dibuka                           |
| paid_at          | Timestamp nullable                                     | Waktu pembayaran                                 |
| voided_at        | Timestamp nullable                                     | Waktu transaksi dibatalkan                       |

---

## Tabel 3.6 Tabel transaction_items

Detail item dalam satu transaksi (junction menu × transaction). Atribut qty + harga snapshot.

| Field          | Tipe Data                     | Keterangan                                                       |
|----------------|-------------------------------|------------------------------------------------------------------|
| id             | INT – PK                     | ID unik item transaksi                                           |
| transaction_id | INT – FK → transactions      | Transaksi parent (ON DELETE CASCADE)                             |
| menu_id        | INT – FK → menus             | Menu yang dipesan                                                |
| qty            | Integer                       | Jumlah porsi                                                     |
| unit_price     | Decimal(10,2)                 | Harga per satuan saat order (snapshot)                           |
| subtotal       | Decimal(12,2)                 | qty × unit_price                                                 |
| is_force_order | Boolean                       | true = dipaksakan meski stok kurang (dikonfirmasi Owner)         |
| created_at     | Timestamp                     | Waktu item ditambahkan                                           |

---

## Tabel 3.7 Tabel settlements

Hasil blind count rekonsiliasi akhir shift. Satu settlement per shift (1:1 dengan shifts).

| Field                  | Tipe Data                                 | Keterangan                                                     |
|------------------------|-------------------------------------------|----------------------------------------------------------------|
| id                     | INT – PK                                 | ID unik settlement                                             |
| shift_id               | INT – FK → shifts, UNIQUE                | Shift terkait (UNIQUE = 1 settlement per shift)                |
| date                   | Date                                      | Tanggal shift                                                  |
| cashier_id             | INT – FK → users                         | Kasir yang submit rekonsiliasi                                 |
| reviewer_id            | INT – FK → users, nullable               | Owner yang review; null sampai direview                        |
| system_cash            | Decimal(12,2)                             | Total cash di sistem (sum transaction.total WHERE method=cash) |
| system_qris            | Decimal(12,2)                             | Total QRIS di sistem                                           |
| system_transfer        | Decimal(12,2)                             | Total transfer bank di sistem                                  |
| system_debit_credit    | Decimal(12,2)                             | Total EDC debit+credit di sistem                               |
| system_ojol            | Decimal(12,2)                             | Total pembayaran via ojol di sistem                            |
| actual_cash            | Decimal(12,2)                             | Input fisik Kasir (blind, tanpa lihat system)                  |
| actual_qris            | Decimal(12,2)                             | Input mutasi QRIS fisik                                        |
| actual_transfer        | Decimal(12,2)                             | Input mutasi transfer fisik                                    |
| actual_debit_credit    | Decimal(12,2)                             | Input total struk EDC fisik                                    |
| actual_ojol            | Decimal(12,2)                             | Input total pembayaran ojol fisik                              |
| variance_cash          | Decimal(12,2)                             | actual_cash − system_cash (+=over, −=short)                    |
| variance_qris          | Decimal(12,2)                             | Selisih QRIS                                                   |
| variance_transfer      | Decimal(12,2)                             | Selisih transfer                                               |
| variance_debit_credit  | Decimal(12,2)                             | Selisih debit_credit                                           |
| variance_ojol          | Decimal(12,2)                             | Selisih ojol                                                   |
| status                 | Enum(pending, submitted, reviewed)        | Status rekonsiliasi                                            |
| submitted_at           | Timestamp                                 | Waktu Kasir submit                                             |
| reviewed_at            | Timestamp nullable                        | Waktu Owner review (null sampai di-approve)                    |

---

## Tabel 3.8 Tabel expenses

Pengeluaran harian dari Owner. Total rupiah + kategori + deskripsi (tidak per-bahan, per batasan skripsi).

| Field       | Tipe Data                                                                 | Keterangan                                 |
|-------------|---------------------------------------------------------------------------|--------------------------------------------|
| id          | INT – PK                                                                 | ID unik pengeluaran                        |
| date        | Date                                                                      | Tanggal pengeluaran                        |
| category    | Enum(ingredients, utilities, salary, transport, other)                    | Kategori pengeluaran                       |
| amount      | Decimal(12,2)                                                             | Nominal pengeluaran                        |
| description | Varchar(255)                                                              | Deskripsi singkat pengeluaran              |
| paid_by     | INT – FK → users                                                         | Owner yang menginput (dari session)        |
| notes       | Text nullable                                                             | Catatan tambahan                           |
| created_at  | Timestamp                                                                 | Waktu pengeluaran diinput                  |

---

## Enum definitions

```sql
-- UserRole
CREATE TYPE user_role AS ENUM ('owner', 'cashier', 'kitchen');

-- TransactionStatus
CREATE TYPE transaction_status AS ENUM ('open', 'paid', 'void');

-- PaymentMethod
CREATE TYPE payment_method AS ENUM ('cash', 'qris', 'transfer', 'debit', 'credit', 'ojol');

-- SettlementStatus
CREATE TYPE settlement_status AS ENUM ('pending', 'submitted', 'reviewed');

-- ExpenseCategory
CREATE TYPE expense_category AS ENUM ('ingredients', 'utilities', 'salary', 'transport', 'other');
```

---

## Summary Relationships (9 relasi)

| # | Parent (1) | Child (N) | FK field        | Catatan                                       |
|---|------------|-----------|-----------------|-----------------------------------------------|
| 1 | users      | transactions | cashier_id   | 1 cashier menangani banyak transaksi          |
| 2 | users      | shifts    | cashier_id      | 1 cashier bisa buka banyak shift              |
| 3 | users      | settlements | cashier_id    | 1 cashier submit banyak settlement (over time)|
| 4 | users      | expenses  | paid_by         | Owner input banyak pengeluaran                |
| 5 | shifts     | transactions | shift_id     | 1 shift berisi banyak transaksi               |
| 6 | shifts     | settlements | shift_id      | 1:1 (UNIQUE) — 1 shift = 1 settlement         |
| 7 | menus      | daily_menu_stocks | menu_id | 1 menu punya banyak record stok harian        |
| 8 | menus      | transaction_items | menu_id | 1 menu dipesan di banyak item                 |
| 9 | transactions | transaction_items | transaction_id | Composition (item hidup bersama transaksi) |

---

## Notes untuk naskah skripsi

- Semua tabel + data dictionary ini dimasukkan ke **Bab 3 section 3.5 (Desain Database)** atau similar.
- Sebelum tabel, sertakan penjelasan 1-2 paragraf per tabel seperti contoh skripsi:
  > *"Tabel users digunakan untuk menyimpan data pengguna sistem. Setiap user punya role (owner, cashier, kitchen) yang menentukan hak akses. PIN 6-digit dipakai untuk login cepat (didokumentasikan trade-off keamanan di section 3.2)."*
- ERD visual di Skripsi.mdj (StarUML) = sumber kebenaran struktur. Data dictionary ini = dokumentasi tekstual yang menyertai ERD.
- Kalau mau tabel diubah (add/drop kolom), ubah **ERD dan dictionary ini secara bersamaan** agar konsisten.
