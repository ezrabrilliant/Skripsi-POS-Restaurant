---
name: erd-diagram
description: Build Entity-Relationship Diagrams (ERD) in StarUML for Indonesian ADSI (Analisis Design Sistem Informasi) skripsi. Use this skill whenever the user asks to create, rebuild, review, or fix an ERD — or says "diagram relasi", "skema database", "model data", or lists tables/columns/foreign keys. Covers skripsi-typical conventions observed across 3 POS case studies (restoran cross-channel, supermarket ABC-VED, toko inventory control): crow's-foot notation, PK/FK markers in left column, snake_case field naming, supplementary data dictionary tables. Uses StarUML's native ER modeling types via staruml-mcp (`create_diagram ERDDiagram`, `create_element_with_view ERDEntity/ERDColumn`, `create_edge_with_view ERDRelationship`). Do not create an ERD without consulting this skill first.
---

# ERD Diagram — skripsi-praktis convention + StarUML MCP

Sumber:
- 3 contoh skripsi POS di UK Petra (`docs/pdf-pages/`)
- StarUML ERD types (ERDDataModel, ERDEntity, ERDColumn, ERDRelationship)
- ADSI Bab 8 CRC noun analysis sebagai input metodologi

**Beda ERD vs Class Diagram:**
- **ERD** = desain database: tabel, kolom, tipe SQL, relasi FK, cardinality
- **Class Diagram** (ADSI Bab 8) = desain OO: class dengan atribut + metode
- Skripsi POS pakai **ERD untuk database** + optional class diagram untuk domain model

---

## 1. Notasi — Crow's-foot (bukan Chen)

**Semua 3 skripsi POS pakai crow's-foot notation**. Chen's (diamond relationship) tidak populer di skripsi database.

**Simbol cardinality:**
```
───●●───  one  (satu endpoint: single bar)
───<●●───  many (fork / crow's foot)
──○●●───  zero or one  (lingkaran)
──○<●●──  zero or many (lingkaran + fork)
```

Artinya:
- `||──<`  = 1 : N (one to many, wajib minimal 1)
- `o|──<o` = 0..1 : 0..N (optional both sides)
- `||──||` = 1 : 1 (strict one-to-one, jarang)

---

## 2. Entity box — 2-column layout

**Observed dari 3 skripsi:**

```
┌─────────────────┐
│   nama_tabel    │  ← header
├────┬────────────┤
│ PK │ id_tabel   │  ← kolom kiri: marker (PK/FK), kolom kanan: field name
│ FK │ id_kategori│
│    │ nama       │  ← kolom kiri blank untuk non-key
│    │ harga      │
│    │ status     │
└────┴────────────┘
```

**Marker di kolom kiri:**
- `PK` — Primary Key
- `FK` — Foreign Key
- (kosong) — atribut biasa
- Jarang: `PK/FK` dual (composite key yang juga FK)

**Field naming:**
- **snake_case** (underscore)
- Mix Indonesian + English umum, tapi konsisten per-entity
- Contoh dari skripsi:
  - resto: `menu_id`, `nama_menu`, `status_ketersediaan`, `harga_offline`, `harga_online`, `stok_default`, `stok_menu`, `limit_stok`, `jenis_menu`, `gambar`, `tgl_mulai`, `nominal_diskon`
  - super: `id_rm`, `id_barang`, `jenis`, `kategori`, `sub_kategori`, `id_supplier`, `no_pembelian`, `tgl_pembelian`
  - toko: `kd_brg`, `total_rupiah_input`, `nomor_reorder`, `reorder_point_notif`

**ID naming pattern:**
- `<entity>_id` atau `id_<entity>`
- Pilih satu pola dan konsisten. resto pakai `menu_id` / `detail_id`. toko pakai `id_barang`/`id_rm`.

---

## 3. Relationship syntax

**3 jenis umum:**

| Jenis | Notation | Contoh di skripsi |
|---|---|---|
| 1 : N | `||─────<` | `kategori 1 ── N menu` (satu kategori punya banyak menu) |
| 1 : 1 | `||─────||` | `user 1 ── 1 profile` (jarang — biasanya digabung 1 tabel) |
| M : N | Harus via **junction/associative entity** | `menu M ── N promo` via `detail_promo` |

**Wajib:** semua M:N di-resolve jadi 2x 1:N via junction entity. Crow's foot tidak support langsung M:N.

**Contoh junction dari skripsi:**
- resto: `detail_promo` = junction (menu × promo) dengan kolom `detail_id PK`, `menu_id FK`, `promo_id FK`
- resto: `detail_transaksi` = junction (transaksi × menu) dengan kolom `detail_id PK`, `menu_id FK`, `transaksi_id FK`, `qty`, `subtotal`, `harga`, `detail_diskon`

Junction boleh punya atribut tambahan (qty, price_at_moment) — **sangat umum** di POS.

---

## 4. Tipe data — simple SQL types

Dari skripsi observed:

| Tipe | Untuk kolom... |
|---|---|
| `Integer` atau `INT` | ID (auto-increment), qty, total Rupiah, stok |
| `Varchar` atau `VARCHAR(n)` | Nama, kategori, string pendek |
| `Text` | Deskripsi, notes panjang |
| `Date` | Tanggal (tanpa jam): `tanggal`, `tgl_mulai`, `tgl_selesai` |
| `Timestamp` atau `DATETIME` | Tanggal + jam: `created_at`, `paid_at`, `tgl_transaksi` |
| `Boolean` | Flag yes/no |
| `Decimal(p,s)` | Nominal uang presisi: `harga Decimal(10,2)`, `total Decimal(12,2)` |
| `Enum('a','b','c')` | Status, tipe: `role ENUM('owner','cashier','kitchen')` — implementasi sebagai Varchar kalau DBMS tidak support |

**Skripsi lebih prefer** `Integer` buat harga/total (bukan Decimal). Acceptable — tapi untuk production prefer Decimal. Ikuti scope skripsi.

---

## 5. Supplementary Data Dictionary (WAJIB di skripsi)

Setelah ERD, **semua 3 contoh skripsi** tambah tabel data dictionary berikut, satu per tabel:

```
Tabel 3.1 Tabel Menu

| Field               | Tipe Data       | Keterangan                  |
|---------------------|-----------------|-----------------------------|
| Menu_id             | Integer – PK    | ID menu                     |
| Category_id         | Integer – FK    | ID kategori menu            |
| Nama_menu           | Varchar         | Nama menu                   |
| Deskripsi           | Varchar         | Deskripsi menu              |
| Status_ketersediaan | Varchar         | Status aktif non-aktif menu |
| Harga_offline       | Integer         | Harga jual transaksi offline|
| Harga_online        | Integer         | Harga jual transaksi online |
| Stock_default       | Integer         | Stok menu secara default    |
| Stock_menu          | Integer         | Stok yang diinput harian    |
| Stock_limit         | Integer         | Limit stok                  |
| Jenis_menu          | Varchar         | Jenis online / offline menu |
| Gambar              | Varchar         | Nama file gambar            |
```

**Dosen skripsi expects this.** ERD diagram + data dictionary tables = komplit. Cuma ERD tanpa dictionary seringkali dapat catatan "jelaskan setiap tabel".

Di StarUML kita hanya bangun ERD; data dictionary ditulis manual di naskah Bab 3.

---

## 6. Scope dan jumlah entity

**Dari skripsi POS:**

| Skripsi | Jumlah entitas |
|---|---|
| resto (cross-channel) | 8: Kategori, Menu, Promo, Detail Promo, Detail Transaksi, Transaksi, Stok Menu, User |
| super (ABC-VED) | 20+: banyak karena ada ABC Analysis, VED Analysis, Reorder, Retur, Supplier, LPB (Laporan Penerimaan Barang), PO, Pembelian, dll |
| toko (market basket) | ~15: Customer, Penjualan, Detail Penjualan, Pembelian, Retur, dsb |

**Untuk POS Restoran (scope skripsi kamu):** 6-10 entitas cukup.

---

## 7. Build di StarUML via staruml-mcp — PAKAI MERMAID

**CRITICAL:** Untuk ERD, **gunakan `generate_diagram` dengan Mermaid code**, JANGAN build manual via `create_element_with_view` + `create_element` per-kolom. Alasan: `ERDColumn` yang dibuat via `create_element` tersimpan di `ownedElements` field, BUKAN `columns` field yang dipakai compartment view → kolom tidak render di diagram, entity box terlihat kosong.

### Metode: generate_diagram dengan erDiagram Mermaid

```
mcp__staruml__generate_diagram code="erDiagram
    users {
        UUID id PK
        VARCHAR name
        VARCHAR pin UK
        VARCHAR role
        BOOLEAN is_active
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }
    menus {
        UUID id PK
        VARCHAR name
        VARCHAR category
        DECIMAL price
        BOOLEAN is_active
    }
    transactions {
        UUID id PK
        UUID shift_id FK
        UUID cashier_id FK
        VARCHAR status
        DECIMAL total
        TIMESTAMP paid_at
    }
    users ||--o{ transactions : 'cashier handles'
    shifts ||--|| settlements : 'closes as'
    menus ||--o{ daily_menu_stocks : 'has stock per day'
    transactions ||--|{ transaction_items : 'contains'
"
```

**Syntax Mermaid erDiagram:**
- `entity_name { TYPE field_name MARKER }` — MARKER: `PK`, `FK`, `UK` (atau kombinasi `PK,FK`)
- Tipe data umum: `UUID`, `VARCHAR`, `INTEGER`, `DECIMAL`, `BOOLEAN`, `DATE`, `TIMESTAMP`, `TEXT`, `FLOAT`
- Relasi cardinality:
    - `||--||` = 1:1 (exactly one : exactly one)
    - `||--o{` = 1:N (exactly one : zero-or-many)
    - `||--|{` = 1:N (exactly one : one-or-many)
    - `}o--o{` = M:N (many to many — tapi di ERD proper harus di-resolve via junction entity)
- Label: `: 'relation label'` (pakai single quote kalau ada spasi)

### Workflow lengkap

1. **Create ERDDataModel parent** (sekali, kalau belum ada):
   ```
   mcp__staruml__create_element type=ERDDataModel parentId=<projectId> name="Data Model"
   ```

2. **Generate ERD via Mermaid** — akan membuat ERDDiagram baru otomatis dengan nama default "ER Diagram by Mermaid" dan parent "Data Model by Mermaid".

3. **Rename ke nama yang meaningful**:
   ```
   mcp__staruml__update_element id=<diagId> field=name value="ERD - Sistem POS <nama>"
   ```

4. **Save project**:
   ```
   mcp__staruml__save_project filename="..."
   ```

### Catatan layout

Mermaid auto-layout sering menghasilkan entity yang tumpang-tindih atau menyebar tidak rapi. **Di StarUML GUI**, user bisa drag entity ke posisi yang lebih baik. Atau:
- Pecah ERD besar (15+ entitas) jadi 2-3 diagram per-domain (customer/sales/inventory) untuk readability
- Setelah generate, update posisi entity view via `update_element field=left/top value=...`

### ❌ Jangan pakai approach manual (deprecated)

```
mcp__staruml__create_element_with_view type=ERDEntity ...
mcp__staruml__create_element type=ERDColumn parent=<entityId> name="..."  # ← kolom masuk ownedElements, TIDAK render
```

Approach ini menghasilkan entity box kosong. **Memory `feedback_erd_use_mermaid.md` mencatat pelajaran ini.**

---

## 8. Checklist verifikasi

1. ✅ Setiap entity punya **≥1 PK**
2. ✅ **FK** di entity child mengacu entity parent (tulis `FK → <entity>` di nama kolom)
3. ✅ **M:N dipecah** jadi 2x 1:N via junction entity
4. ✅ Field **snake_case konsisten**
5. ✅ **Tipe data set** (Integer / Varchar / Decimal / Date / Timestamp / Boolean)
6. ✅ **Cardinality crow's-foot** di kedua endpoint relasi
7. ✅ Tidak ada entity terpisah (disconnected) — kecuali tabel master yang memang standalone (contoh: kategori)
8. ✅ ID pattern konsisten (semua `id_x` ATAU semua `x_id`, jangan campur)
9. ✅ Nama entity **singular noun snake_case** (`menu`, `user`, `transaksi`) — ATAU plural (`menus`, `users`) — pilih satu dan konsisten
10. ✅ Layout: related entity ditempatkan berdekatan, minim line crossing
11. ✅ Data dictionary tables sudah drafted (di-output sebagai MD/docx terpisah, tidak di diagram)

---

## 9. Worked example — POS Ayam Bakar Banjar Monosuko (backend plan)

**8 entities** (dari DIAGRAM-SPEC.md):

### `users`
| Field | Tipe | Marker |
|---|---|---|
| id | UUID | PK |
| name | Varchar(100) | |
| pin | Varchar(6) | UNIQUE |
| role | Enum(owner,cashier,kitchen) | |
| is_active | Boolean | |
| created_at | Timestamp | |
| updated_at | Timestamp | |

### `menus`
| Field | Tipe | Marker |
|---|---|---|
| id | UUID | PK |
| name | Varchar(100) | |
| category | Varchar(50) | |
| price | Decimal(10,2) | |
| is_active | Boolean | |

### `daily_menu_stocks`
PK: `id`, FK `menu_id → menus`, UNIQUE(`date`, `menu_id`)

### `shifts`
PK: `id`, FK `cashier_id → users`

### `transactions`
PK: `id`, FK `shift_id → shifts`, FK `cashier_id → users`
status Enum(open/paid/void), payment_method Enum(cash/qris/transfer/debit/credit/ojol)

### `transaction_items` (junction menu × transactions)
PK: `id`, FK `transaction_id → transactions`, FK `menu_id → menus`
plus `qty`, `unit_price`, `subtotal`, `is_force_order`

### `settlements`
PK: `id`, FK `shift_id → shifts` UNIQUE, FK `cashier_id → users`, FK `reviewer_id → users` (nullable)
Plus 15 kolom blind-count (system/actual/variance × 5 payment methods)

### `expenses`
PK: `id`, FK `paid_by → users`, category Enum(ingredients/utilities/salary/transport/other)

**Relationships (9):**
1. `users 1 ──< transactions` (cashier_id)
2. `users 1 ──< shifts`
3. `users 1 ──< settlements` (cashier_id)
4. `users 1 ──< expenses` (paid_by)
5. `shifts 1 ──< transactions`
6. `shifts 1 ── 1 settlements` (shift_id UNIQUE)
7. `menus 1 ──< daily_menu_stocks`
8. `menus 1 ──< transaction_items`
9. `transactions 1 ──< transaction_items` (composition — weak entity)

---

## 10. Common mistakes

- ❌ Entity tanpa PK → harus ada
- ❌ M:N digambar langsung pakai crow's-foot fork dua sisi → must use junction entity
- ❌ FK tanpa reference (ke entity mana?) → kasih `FK → <entity>` di nama
- ❌ Nama entity/field pakai spasi → snake_case
- ❌ Mix naming convention (entity1 `id_menu`, entity2 `menu_id`) → pilih satu
- ❌ Relationship tanpa cardinality endpoints → wajib keduanya
- ❌ Pakai notation Chen (diamond relationship) → skripsi POS konsisten pakai crow's-foot
- ❌ Data dictionary tidak dibuat → expected oleh dosen, tambahkan MD/docx tables
