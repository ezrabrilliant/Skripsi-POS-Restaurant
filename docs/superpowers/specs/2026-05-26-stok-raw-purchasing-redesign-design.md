# Design Spec: Pencatatan Stok Raw Materials & Purchasing Redesign

**Tanggal**: 2026-05-26
**Status**: Design locked, implementation pending
**Versi**: REV 2.5 (lanjutan REV 2.4 multi-pesanan + notes)
**Plan file**: `~/.claude/plans/saya-mau-brainstorm-tentang-greedy-deer.md`
**Trigger**: User Ezra menilai fitur raw materials + purchasing REV 2.3 "cacat banget" dan minta brainstorm best practice dari nol.

---

## Context

Fitur `raw_materials` + `purchases` di REV 2.3 dianggap user "cacat banget". Setelah brainstorm terstruktur (tanpa baca code dulu), masalah ter-identifikasi di 3 area:

1. **Bumbu dasar**: master cabai/bawang/kemiri/dll terpisah → input form purchase harus klik tambah-baris satu-satu (lambat). Display laporan owner ngga cukup grouped.
2. **Unit raw material**: kolom `unit` varchar bebas → ngga konsisten (mis. "kg" vs "Kg" vs "kilogram"), ngga ada dropdown master, dan sulit edit (mis. telur dari `butir` → `karton`).
3. **Opname mode**: sistem assume semua item bisa ditrack exact-count, padahal beberapa item (beras) realistically perlu skala 0-5 karena ngga mungkin ditimbang setiap closing.

Spec ini merancang refactor di 3 area tersebut sambil mempertahankan workflow operasional yang sudah jalan (stok porsi, reminder, permission matrix, settlement, dll).

---

## Ground truth workflow manual (sebagai baseline)

Sebelum sistem POS, resto memakai buku fisik 2 sisi:
- **Kiri**: stok per hari (pagi only, lengkap = sisa kemarin + restock pagi)
- **Kanan**: penjualan harian

Alur belanja & opname:
1. **Malam (di resto)**: waiter cek fisik stok, **lapor lisan** ke kasir tentang "yang kurang" saja. Rawan miss-handover.
2. **Malam (sesudah tutup resto)**: kasir belanja ke pasar, belanjaan dibawa pulang ke rumah owner.
3. **Pagi**: kasir bawa 2 jenis restock dari rumah ke resto: stok porsi (dari owner & Lisa) + raw material (dari belanja kemarin malam).
4. **Pagi-pagi di resto**: hitung sisa kemarin + restock pagi → stok awal hari, catat di buku sisi kiri.
5. **Restock darurat porsi tengah hari** (mis. ayam habis, owner kirim via Gojek): manual ditunda catatannya ke pagi besoknya.

Klasifikasi belanjaan:
- **Bumbu dasar** (cabai, bawang, daun jeruk, lengkuas, kemiri, dll) = 1 entri "Bumbu Dasar" di buku, dipencet → muncul rinciannya
- **Ayam mentah, ikan, udang mentah** = log pengeluaran saja (BUKAN stok resto, karena stok resto = finished good dari rumah)
- **Tahu, tempe, sayur, beras, telur** = masuk stok resto (di-track)

Unit & opname insight dari user:
- Tahu/tempe: **balok**, baseline ±5, reminder saat sisa 2
- Beras: pakai **skala 0-5** (0=habis, 1=sisa sedikit, 5=banyak) karena ngga mungkin ditimbang setiap closing
- Telur: pakai exact (butir atau karton)
- Sayur: track tanggal beli (untuk reminder mendekati basi)
- **Satuan bisa di-edit per raw material** (mis. telur biji → karton)

Lokasi & scope:
- Raw material yang di-track fisiknya **di resto** (bukan rumah owner)
- Scope sistem **hanya resto**, bukan inventory rumah owner
- Cah kangkung, nasi, tahu/tempe goreng = dimasak **fresh on-demand di resto** (resto punya freezer + kulkas)

---

## Keputusan Design Final

### 1. Bumbu dasar = Master tetap + UX fix (Option C')

**Keputusan**: master cabai/bawang/kemiri/dll TETAP ada di tabel `raw_materials` dengan `is_tracked=false`, `category=bumbu_dasar`.

**Yang berubah**: UI form purchase dapat tombol **"Quick Add Bumbu Dasar"** yang spawn multiple rows preset sekaligus (bukan klik-tambah-baris satu-satu).

**Laporan owner**: tetap group by category → "Bumbu Dasar" jadi 1 baris dengan breakdown expandable.

**Schema migration**: minimal/none.

**Defense ke penguji**: `is_tracked` flag adalah polymorphic switch — master tetap konsisten untuk semua bahan supaya reporting + grouping by category mengikuti schema relational orthodox.

### 2. Units = master table dengan `opname_mode`

**Tabel baru `units`**: `id`, `label`, `opname_mode` enum {`exact`, `scale_0_5`}.

Pre-seeded:
- `exact`: kg, gram, liter, butir, balok, karung, ikat, batang, pcs
- `scale_0_5`: "skala 0-5"

**Owner add unit baru** via dropdown "Tambah satuan" di form raw material — modal kecil (label + pilih exact/scale), Odoo-style inline add.

**`raw_materials.unit_id`** = FK ke `units` (rename + retype dari `unit` varchar).

**Behavior dipicu `unit.opname_mode`**:

| Aspect | Exact mode | Scale mode (0-5) |
|---|---|---|
| `stock_qty` domain | integer ≥ 0 dalam unit | integer 0..5 |
| `min_stock` domain | integer ≥ 0 | integer 0..5 |
| Purchase effect | `stock_qty += qty` | NO stock change |
| Purchase form | qty + unit_price required | total_price (subtotal) + note required; qty/unit_price disabled |
| Opname UI | input angka | segmented control 0-5 |

**Defense ke penguji**: unit dan opname mode secara konseptual terikat (skala inherently scale, kg inherently exact). Gabung di `units` jadi single source of truth — schema ortodoks.

### 3. Edit unit handling = prompt manual

Saat owner edit unit raw material yang sudah punya `stock_qty > 0`, sistem tampilkan modal:

```
Unit lama: butir
Unit baru: karton
Stok saat ini: 30 butir
Stok setelah konversi: [____] karton
   (kosongkan = reset 0, opname ulang)
[Batal] [Simpan]
```

Owner input nilai baru (mis. 1 karton kalau 1 karton = 30 butir) atau kosongkan → reset ke 0 + force waiter opname ulang.

**Audit log** ke `raw_material_movements` reason=`manual_adjust` note "Unit changed: butir → karton, stock 30 → 1". Berlaku juga kalau opname_mode berubah karena unit baru (mis. butir → skala 0-5).

### 4. Workflow purchase

- **Timing**: bebas. Tanggal field di form default today, bisa di-edit. Sistem ngga enforce malam vs pagi.
- **Schema `purchase_items`**: `qty` + `unit_price` jadi nullable (untuk scale items). `subtotal` tetap required. `note` text nullable (BARU, untuk describe "1 karung 50kg" dll).
- Exact items: `qty` + `unit_price` + `subtotal` terisi normal
- Scale items: `qty` + `unit_price` NULL, cuma `subtotal` + `note` terisi
- Non-tracked items (bumbu individual, ayam mentah): `qty` + `unit_price` + `subtotal` terisi (cuma `stock_qty` ngga di-update)

### 5. Restock darurat porsi tengah hari (NO CHANGE)

Tetap sistem REV 2.3 — catat saat barang datang via fitur "Barang Masuk" (lebih real-time + audit log akurat). Manual buku ditunda-ke-besok tidak diadopsi.

### 6. Opname malam raw material (NO CHANGE)

Tetap sistem REV 2.3 — waiter punya akses formal opname digital (input qty fisik / skala 0-5). Menghilangkan miss-handover lisan yang user sebut "rada miss" di workflow manual.

### 7. Stok porsi (NO CHANGE)

Behavior REV 2.3 dipertahankan:
- Auto-snapshot `opening_qty_today` saat user pertama login pagi
- Restock pagi kelipatan 5 (existing)
- "Barang Masuk" untuk restock darurat tengah hari (existing)
- Opname manual pagi (existing)

---

## Schema delta

### Tabel baru: `units`

| Kolom | Type | Note |
|---|---|---|
| `id` | BIGINT PK | |
| `label` | VARCHAR UNIQUE | "kg", "butir", "balok", "skala 0-5", dll |
| `opname_mode` | ENUM { `exact`, `scale_0_5` } | Menentukan UI + behavior |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

Pre-seeded saat `db:seed`.

### Tabel `raw_materials` (MODIFIED)

| Kolom lama | Kolom baru | Note |
|---|---|---|
| `unit` (VARCHAR) | `unit_id` (BIGINT FK ke `units`) | rename + retype |

Sisanya tetap: `name`, `category`, `is_tracked`, `stock_qty`, `min_stock`, `unit_price`, `freshness_days`, `last_buy_date`.

### Tabel `purchase_items` (MODIFIED)

| Kolom | Perubahan |
|---|---|
| `qty` (DECIMAL) | jadi NULLABLE (scale items NULL) |
| `unit_price` (DECIMAL) | jadi NULLABLE (scale items NULL) |
| `subtotal` (DECIMAL) | tetap NOT NULL |
| `note` (TEXT) | BARU, nullable |

### Migration plan

1. Buat tabel `units` + seed pre-defined units
2. Tambah kolom `unit_id` di `raw_materials` (nullable sementara)
3. Backfill `unit_id` dari `unit` varchar → match label ke seeded units (case-insensitive) atau create row baru kalau ngga ada
4. Set `unit_id` NOT NULL + drop kolom `unit`
5. Modify `purchase_items`: qty + unit_price jadi nullable, tambah kolom `note`

---

## UI Mockup

### Form Master Raw Material (owner-only)

```
Nama:        [_____________________]
Unit:        [butir   ▼] [+ Tambah satuan]  ⤷ opens modal
Category:    [bahan_pokok ▼]
Min stock:   [____]
Tracked:     [✓]
Freshness:   [____] hari (kosong = bukan perishable)
[Batal] [Simpan]
```

Modal "Tambah satuan baru":
```
Label:       [karton________________]
Opname mode: ◉ Exact (angka)
             ○ Skala (0-5)
[Simpan & pilih]
```

### Form Purchase

```
Header:
  Tanggal:  [2026-05-26]
  Vendor:   [Bu Sari       ▼] (opsional, [+ add inline])

Items:
  [+ Tambah Item]
  [+ Quick Add Bumbu Dasar]   ⤷ spawn multiple rows preset

  Row 1: [Telur ▼]   qty:[30]  unit_price:[2500]  =75000   note:[__]
  Row 2: [Beras ▼]   qty:─     unit_price:─       =300000  note:[1 karung 50kg]
  Row 3: [Cabai rawit ▼] qty:[1] unit_price:[30000] =30000  note:[__]
  Row 4: [Bawang merah ▼] qty:[0.5] unit_price:[30000] =15000 note:[__]

TOTAL                                          Rp 420.000
[Submit]
```

Quick Add Bumbu Dasar UI:
- Click → spawn 4-5 rows pre-filled untuk preset bumbu dasar (cabai rawit, bawang merah, bawang putih, kemiri, daun jeruk)
- Kasir tinggal isi qty + price masing-masing
- Bisa hapus row yang ngga jadi dibeli

### Opname Raw Material (waiter / kasir akses)

```
Page: Opname Raw Material

Bahan Pokok:
  Beras       [● 0  ○ 1  ○ 2  ○ 3  ○ 4  ◉ 5]   ⤷ skala segmented
  Tahu        [3___] balok                       ⤷ exact angka
  Tempe       [5___] balok
  Telur       [25__] butir

Bahan Segar:
  Kangkung    [2___] ikat
  Petai       [1___] ikat

[Simpan opname]
```

Submit batch → update `stock_qty` + log `raw_material_movements` reason=`opname` per item dengan selisih.

---

## Critical files

### Backend

- `backend/prisma/schema.prisma` — add `units`, modify `raw_materials.unit` → `unit_id`, modify `purchase_items`
- `backend/prisma/seed.ts` — seed pre-defined units
- `backend/src/modules/units/` (BARU) — routes/service/controller/schema CRUD units
- `backend/src/modules/stocks/raw-materials.service.ts` — integrate units + edit unit handling + audit log
- `backend/src/modules/stocks/raw-materials.routes.ts` — endpoint update
- `backend/src/modules/purchases/purchases.service.ts` — handle nullable qty/unit_price + bifurcate by `unit.opname_mode`
- `backend/scripts/smoke-phase-X-units.sh` (BARU) — test units integration

### Frontend

- `frontend/src/types/index.ts` — add `Unit` type, modify `RawMaterial`
- `frontend/src/services/unitService.ts` (BARU)
- `frontend/src/services/rawMaterialsService.ts` — update
- `frontend/src/components/UnitDropdown.tsx` (BARU) — dropdown + "Tambah satuan" modal
- `frontend/src/components/QuickAddBumbuDasar.tsx` (BARU)
- `frontend/src/pages/RawMaterialsTab.tsx` — opname UI bifurcation + edit unit modal
- `frontend/src/pages/PurchasesPage.tsx` — QuickAddBumbuDasar integration + nullable qty handling

---

## Verification (end-to-end manual test)

1. **Units master CRUD**: owner buka form raw material → "Tambah satuan baru" → input "karton" exact → save → verify ada di dropdown + auto-selected.
2. **Create exact**: owner create "Telur" unit=butir, min_stock=10 → verify default stock_qty=0.
3. **Create scale**: owner create "Beras" unit=skala 0-5, min_stock=1 → verify min_stock bounded 0..5.
4. **Edit unit dengan stock**: set Telur stock=30 → ganti unit butir → karton → modal prompt → input 1 → verify stock=1 + audit log.
5. **Purchase exact**: Telur qty=30 unit_price=2500 → verify stock=31, last_buy_date today, unit_price=2500.
6. **Purchase scale**: Beras → form auto-disable qty/unit_price → subtotal=300000 note="1 karung 50kg" → verify stock TIDAK berubah, last_buy_date today, unit_price=300000.
7. **Quick Add Bumbu Dasar**: click → spawn rows kategori bumbu_dasar → isi qty + harga → submit → verify purchase tercatat + total benar.
8. **Opname bifurcation**: waiter buka opname → Beras tampil segmented 0-5, Telur tampil input angka → submit → verify stock + audit log.
9. **Reminder dashboard**: Beras stock=1 (= min_stock) → owner dashboard "Perlu restock". Telur stock=5 (< min_stock=10) → "Perlu restock".
10. **Laporan owner**: pengeluaran bulan ini → bumbu_dasar collapsed → expand → list per item dengan qty + harga.

---

## Scope estimasi

- **Backend**: 2 phase (units module standalone + raw-materials/purchases refactor)
- **Frontend**: 1 phase (UnitDropdown component + RawMaterialsTab opname bifurcation + QuickAddBumbuDasar)
- **Total**: ~2-3 hari kerja inkremental dengan smoke test per phase

**Bumbu dasar pre-seed** (untuk Quick Add): cabai rawit, cabai merah keriting, bawang merah, bawang putih, kemiri, daun jeruk, sereh, lengkuas, kunyit, jahe — tambahan boleh owner via CRUD master raw material.

---

## Open follow-ups (deferred — bisa di iterasi kemudian)

- Konversi unit otomatis (kalau owner mau telur biji → karton + tetap track sub-quantity). Sekarang manual via opname.
- Per-bumbu price trend chart (kalau owner ingin lihat "cabai naik dari 25rb ke 35rb bulan ini"). Sekarang owner cek manual via purchase history.
- Reminder threshold konfigurable per category (mis. bahan_segar perishable lebih agresif vs bahan_pokok). Sekarang fixed `freshness_days - 3` hari.
