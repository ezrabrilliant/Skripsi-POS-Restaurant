# ERD — Sistem POS Ayam Bakar Banjar Monosuko

Dokumen ini menjelaskan apa itu Entity Relationship Diagram (ERD), kegunaannya untuk skripsi, dan isi lengkap ERD pada sistem POS Restoran Ayam Bakar Banjar Monosuko.

**Referensi visual:** [`docs/diagrams/erd-sistem-pos-restoran.png`](../diagrams/erd-sistem-pos-restoran.png)
**Data dictionary lengkap:** [`docs/DATA-DICTIONARY.md`](../DATA-DICTIONARY.md) (8 tabel, format Bab 3)

---

## 1. Apa itu ERD?

Entity Relationship Diagram (ERD) adalah diagram yang menggambarkan **struktur data tersimpan** dalam sebuah sistem — tabel, kolom, tipe data, dan relasi antar-tabel. ERD dibuat pada tahap perancangan database, setelah use case diagram dan sebelum implementasi skema DBMS.

ERD **beda dari Class Diagram**:
- **ERD** = desain database: tabel SQL, kolom, primary key / foreign key, cardinality
- **Class Diagram** (UML) = desain object-oriented: class dengan atribut + method + inheritance

Di skripsi POS biasanya cukup **ERD saja** untuk struktur data (tidak butuh class diagram terpisah).

## 2. Kegunaan dalam Skripsi

1. **Blueprint database** — jadi acuan untuk `CREATE TABLE` dan migration script.
2. **Validasi integritas data** — semua foreign key ada; setiap entitas punya primary key.
3. **Bab 3 skripsi** — ERD visual + data dictionary tabular (Tabel 3.1, 3.2, dst) = komplit.
4. **Alat komunikasi dengan dosen pembimbing dan penguji** — dosen skripsi UK Petra expects ini.

## 3. Elemen ERD

| Simbol | Nama | Fungsi |
|---|---|---|
| ▭ Entity box | **Entity** | Tabel dalam database. Nama = kata benda snake_case (`users`, `transactions`). |
| Kolom dalam entity | **Column / Attribute** | Field dalam tabel. Format: `nama : Tipe`. |
| `PK` marker | **Primary Key** | Identifier unik. Biasanya kolom pertama. |
| `FK` marker | **Foreign Key** | Reference ke PK di entity lain. |
| `UK` marker | **Unique Key** | Constraint unique (bukan PK tapi unik). |
| Garis relasi | **Relationship** | Koneksi antar entity. |
| Crow's foot endpoint | **Cardinality** | Multiplicitas: one (||), many (<), zero (o). |

### 3.1. Cardinality Crow's-foot

| Notasi | Arti |
|---|---|
| `||─────||` | 1 : 1 (exactly one : exactly one) |
| `||────o|` | 1 : 0..1 (exactly one : zero or one) |
| `||────o{` | 1 : N (exactly one : zero or many) |
| `||────\|{` | 1 : 1..N (exactly one : one or many) |
| `}o────o{` | M : N (harus di-resolve via junction entity) |

## 4. Konvensi Penting

### 4.1. Naming
- **Entity**: snake_case plural lowercase (`users`, `transactions`, `daily_menu_stocks`). Bisa juga singular per preferensi.
- **Column**: snake_case (`created_at`, `menu_id`, `opening_stock`).
- **Primary key**: biasanya `id` atau `<entity>_id` (`menu_id`). Pilih 1 pola konsisten.
- **Foreign key**: `<entity>_id` merujuk ke `<entity>.id`. Tambahkan marker `FK → <entity>` di ERD atau komentar.

### 4.2. Tipe Data
- `UUID` untuk primary key & foreign key (di Prisma/Postgres modern)
- `VARCHAR(n)` untuk string pendek
- `TEXT` untuk deskripsi panjang
- `INTEGER` untuk jumlah, qty
- `DECIMAL(p, s)` untuk nominal uang (precision matters) — contoh `Decimal(12,2)` untuk total transaksi
- `BOOLEAN` untuk flag
- `DATE` untuk tanggal tanpa jam
- `TIMESTAMP` untuk tanggal + jam (audit: `created_at`, `updated_at`)
- `ENUM('a','b','c')` untuk status/kategori terbatas

### 4.3. M:N harus via Junction Entity
Crow's-foot tidak support M:N langsung. Resolve dengan tabel junction.

Contoh di ERD kita: `menus × transactions` = tabel `transaction_items` (junction dengan atribut tambahan qty, unit_price, subtotal, is_force_order).

### 4.4. Supplementary Data Dictionary (WAJIB di skripsi)
ERD visual saja tidak cukup. Wajib ditambah tabel **data dictionary** untuk setiap entitas (contoh Tabel 3.1 Tabel Menu) berisi:
- Field | Tipe Data | Keterangan

Sudah tersedia di [`docs/DATA-DICTIONARY.md`](../DATA-DICTIONARY.md).

## 5. Isi ERD Sistem POS Restoran

### 5.1. Delapan Entitas

| Entity | Purpose | Jumlah Kolom |
|---|---|---|
| `users` | Semua user (owner/cashier/kitchen) | 7 |
| `menus` | Katalog menu siap jual | 7 |
| `daily_menu_stocks` | Stok per hari per menu (input Kitchen pagi) | 6 |
| `shifts` | Siklus buka/tutup kasir per hari per cashier | 6 |
| `transactions` | Header pesanan per meja | 12 |
| `transaction_items` | Junction menu × transactions (qty + harga snapshot) | 8 |
| `settlements` | Blind count rekonsiliasi akhir shift (5-way payment) | 23 |
| `expenses` | Pengeluaran harian (Owner, kategori + amount) | 8 |

Total: **8 entitas, 77 kolom**.

### 5.2. Enum Definitions

```sql
CREATE TYPE user_role AS ENUM ('owner', 'cashier', 'kitchen');
CREATE TYPE transaction_status AS ENUM ('open', 'paid', 'void');
CREATE TYPE payment_method AS ENUM ('cash', 'qris', 'transfer', 'debit', 'credit', 'ojol');
CREATE TYPE settlement_status AS ENUM ('pending', 'submitted', 'reviewed');
CREATE TYPE expense_category AS ENUM ('ingredients', 'utilities', 'salary', 'transport', 'other');
```

### 5.3. Sembilan Relasi

| # | Parent | Child | Via | Cardinality |
|---|---|---|---|---|
| 1 | users | transactions | `cashier_id` | 1 : N |
| 2 | users | shifts | `cashier_id` | 1 : N |
| 3 | users | settlements | `cashier_id` | 1 : N |
| 4 | users | expenses | `paid_by` | 1 : N |
| 5 | shifts | transactions | `shift_id` | 1 : N |
| 6 | shifts | settlements | `shift_id` (UNIQUE) | 1 : 1 |
| 7 | menus | daily_menu_stocks | `menu_id` | 1 : N |
| 8 | menus | transaction_items | `menu_id` | 1 : N |
| 9 | transactions | transaction_items | `transaction_id` | 1 : 1..N (composition) |

## 6. Mengapa Struktur Ini Menjawab Masalah Skripsi

| Rumusan Masalah | Entitas yang menjawab |
|---|---|
| A. Percepat transaksi | `transactions` + `transaction_items` — struktur bersih untuk order + pay |
| B. Rekonsiliasi + kurangi mismatch | `shifts` + `settlements` 5-way payment split + variance kolom |
| C. Manajemen stok harian | `daily_menu_stocks` dengan `opening_stock` + `current_stock` + UNIQUE(date, menu_id) |
| #4 Owner tidak tau pengeluaran | `expenses` tabel baru (dinaikkan dari Phase 13 backend plan) |

## 7. Narasi untuk Bab 3 Skripsi

> **3.5.1 Entity Relationship Diagram**
>
> Gambar 3.X menunjukkan Entity Relationship Diagram (ERD) dari Sistem POS Restoran yang akan dibangun. Sistem terdiri dari delapan entitas utama: users yang menyimpan data seluruh pengguna dengan role owner/cashier/kitchen; menus sebagai master katalog makanan siap jual; daily_menu_stocks yang menyimpan stok harian per menu dengan constraint unik per kombinasi tanggal dan menu; shifts yang mencatat siklus buka-tutup kasir per hari; transactions sebagai header pesanan meja; transaction_items sebagai junction menu-transaksi dengan atribut tambahan qty dan harga snapshot; settlements untuk rekonsiliasi blind count akhir shift dengan pemisahan kolom system/actual/variance per lima metode pembayaran; dan expenses untuk pencatatan pengeluaran harian.
>
> Sistem memiliki sembilan relasi utama yang menghubungkan entitas-entitas tersebut, dengan dominasi relasi 1:N (contoh: satu kasir dapat melakukan banyak transaksi) dan satu relasi 1:1 (satu shift menghasilkan tepat satu settlement). Relasi banyak-ke-banyak antara menu dan transaksi dijabarkan sebagai entitas asosiatif `transaction_items` yang menyimpan atribut tambahan seperti jumlah dan harga snapshot saat transaksi. Detail atribut dan tipe data setiap entitas dijabarkan pada Tabel 3.1 hingga Tabel 3.8 di sub-bab berikutnya.

## 8. Referensi Konvensi

- Skill: `.claude/skills/erd-diagram/SKILL.md`
- Pattern dari 3 skripsi POS UK Petra:
  - resto (cross-channel): 8 entitas, crow's-foot, snake_case
  - supermarket ABC-VED: 20+ entitas untuk inventory control
  - toko market basket: 15 entitas + algoritma analytics

## 9. Bad Practice yang Dihindari

- ❌ Entity tanpa PK → setiap entity wajib punya PK
- ❌ M:N digambar langsung pakai crow's-foot fork kedua sisi → wajib junction entity
- ❌ FK tanpa reference ke entity target → tulis `FK → <entity>` di nama kolom
- ❌ Mix naming (`id_menu` di satu tabel, `menu_id` di tabel lain) → konsisten 1 pola
- ❌ Pakai notasi Chen (diamond relationship) untuk skripsi POS → konsisten pakai crow's-foot (mengikuti konvensi 3 skripsi POS UK Petra)
- ❌ Data dictionary tidak dibuat → dosen pasti minta; siapkan MD dengan Tabel 3.1-3.N

## 10. Workflow Build di StarUML

**Penting:** Untuk ERD, pakai **`generate_diagram` dengan Mermaid erDiagram syntax**, jangan manual `create_element` per-column. Alasan: manual-add kolom masuk ke `ownedElements` field, bukan `columns` field, sehingga kolom tidak render di entity box.

Contoh Mermaid:
```
erDiagram
    users {
        UUID id PK
        VARCHAR pin UK
        VARCHAR role
    }
    transactions {
        UUID id PK
        UUID cashier_id FK
        DECIMAL total
    }
    users ||--o{ transactions : 'cashier handles'
```

Setelah generate, rapikan layout manual di StarUML GUI (drag entity ke posisi yang enak dibaca).
