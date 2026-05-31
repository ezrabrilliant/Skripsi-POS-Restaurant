# Design Spec — REV 2.12: Owner Self-Service & Go-Live Readiness

**Tanggal:** 2026-05-31
**Status:** Approved (brainstorming), siap masuk plan berfase
**Branch kerja:** dari `feat/katalog-menu-ux` (lihat §Build Order)
**Pemicu:** Owner tidak bisa mengubah `stockType` sebuah menu (mis. Air Mineral di-seed `nonStock`, padahal botolan → harusnya bisa dilacak). Investigasi mengungkap pola lebih besar: **banyak konfigurasi yang backend-nya bisa diubah tapi tidak ada kontrolnya di UI** — sehingga **setelah live, owner (non-teknis) terdampar** karena tidak mungkin edit lewat kode/database.

---

## 1. Konteks & Motivasi

POS ini akan **live di produksi** (`monosuko.my.id`). Setelah live, owner hanya bisa mengubah konfigurasi lewat **UI aplikasi** — tidak bisa edit source code, jalankan script, atau sentuh database. Apa pun yang wajar berubah selama umur restoran **harus** bisa diatur sendiri dari UI; kalau tidak, owner "terdampar".

Audit menyeluruh (10 area, dibandingkan: field schema/endpoint yang mutable vs yang benar-benar bisa diedit owner di UI) menghasilkan daftar gap berikut. Spec ini menutup gap **critical/high** yang masuk akal untuk skripsi, dan mendokumentasikan sisanya sebagai **known-gap**.

### 1.1 Ringkasan temuan audit (yang ditindaklanjuti)

| Gap | Severity | Backend mutable? | UI sekarang | Workstream |
|---|---|---|---|---|
| Toggle stok menu `portion ↔ nonStock` (Air Mineral) | High | ✅ via upsert (`menus.service.ts:363`, sinkron PortionStock `:397`) | ❌ tidak ada kontrol di `MenuFormModal` | A |
| Reorder metode bayar (`displayOrder`) | High | ✅ `POST /payment-methods/reorder` | ❌ service ada, UI tak panggil | A |
| Reaktivasi staff (`isActive=true`) | High | ✅ `updateUserSchema.isActive` | ❌ form tak ada toggle | A |
| Owner edit akun sendiri (nama/PIN) | High | ✅ `PUT /users/:id` | ❌ tak ada UI profil | A |
| Badge "Nonaktif" staff | Medium | ✅ list kembalikan semua | ❌ tak ada penanda | A |
| PIN mismatch (UI "4-6" vs backend `^\d{6}$`) | Medium | — | ❌ label menyesatkan | A |
| Identitas resto (nama/alamat/jam/telp/logo) hardcoded | High | ❌ tak ada field | ❌ tak ada UI | B |
| PB1: "off" sebenarnya "ditanggung resto", bukan "tak ada pajak" | Critical | sebagian (`taxEnabled`+`taxRate`) | ⚠️ model salah konsep | B |
| Kelipatan restock terkunci `%5` | Medium | ❌ hardcoded `portion.schema.ts:17` | ❌ | B |
| Ambang stok menipis terkunci `≤5` | Low | ❌ hardcoded `utils.ts` | ❌ | B |
| Cetak struk/PDF **belum ada sama sekali** (spec mewajibkan) | Critical (blocker live) | ❌ tak ada implementasi | ❌ | C |
| Kategori tagihan enum 5 tetap (tak bisa tambah internet/gaji) | High | ❌ enum Prisma | ⚠️ pilih dari 5 saja | D |
| Jumlah/kapasitas meja hardcoded `TABLE_COUNT=9` | High | ❌ env var | ❌ tak bisa tambah meja | D |

### 1.2 Yang SUDAH beres (tidak disentuh)
minStock per menu, konversi simple↔variant↔paket, COGS + audit trail, reaktivasi menu, tarif pajak (rate), jam shift (`ShiftWindowTab`), bank assign/unassign, opname/emergency-in/mark-habis, validasi diskon, bounds tarif pajak.

### 1.3 Keluar scope — didokumentasikan sebagai known-gap (TIDAK dikerjakan)
- **Jenis shift `pagi/malam`** (enum Prisma → butuh refactor reference-table + migrasi struktural; risiko tinggi, nilai rendah untuk skripsi).
- **Currency/locale** (`id-ID`/`IDR` hardcoded) — keputusan produk single-tenant, bukan gap.
- **Hard-delete menu** (soft-delete + reactivate sudah audit-safe dan cukup).
- **Bulk-rename kategori menu** (kategori = free-text per menu; rename satu-satu via form edit).
- **Branding `POS ABM` di Layout/Login** — diganti via identitas resto WS-B kalau memungkinkan, tapi tidak wajib.
- **Polling interval / pagination limit** — tuning teknis, bukan konfigurasi bisnis.

---

## 2. Keputusan yang Dikunci (hasil brainstorming)

1. **Scope:** Tier 1 + 2 + 3 (semua) + refactor money-math PB1 + fitur struk PDF.
2. **Urutan:** A → B → C → D (C bergantung B; D independen, paling berat, terakhir).
3. **Dokumentasi:** 1 umbrella spec (file ini) + 1 plan berfase (fase = workstream), dibangun incremental dengan checkpoint review tiap WS. Kalau saat desain detail sebuah WS ternyata kebesaran, baru dipecah.
4. **PB1 = 2 sumbu:**
   - `taxEnabled` (PB1 dihitung sama sekali?) + `taxChargedToCustomer` (ditagih ke pelanggan vs ditanggung resto).
   - Kondisi resto sekarang = **aktif + tidak dibebankan** (pelanggan bayar harga apa adanya; resto menanggung 10%).
   - **PB1 ditanggung OTOMATIS mengurangi laba**: `Laba = Pendapatan − COGS − Σ PB1 ditanggung`.
5. **Struk PDF:** masuk scope (WS-C). Setelah bayar, modal **tidak auto-close** → pesan sukses → klik baru tutup; generate **1 file PDF** nota kecil hitam-putih dengan identitas resto dari Setting.
6. **Logo:** **bisa di-upload** (pakai infra upload gambar yang sudah ada), bukan ditunda.

---

## 3. Desain per Workstream

### WS-A — Quick-win Self-Service (frontend-only, TANPA perubahan schema)

Semua field sudah mutable di backend; pekerjaan murni memasang kontrol UI + menyelaraskan validasi.

**A1. Toggle stok menu (`MenuFormModal.tsx`)**
- Di section `mode === 'simple'`, tambah toggle **"Lacak stok porsi?"** tepat di atas blok "Stok Minimum" (line ~466).
- ON → `stockType = 'portion'` (field "Stok Minimum" muncul, default 5). OFF → `stockType = 'nonStock'`.
- `linked` **tidak** diekspos di toggle ini (itu ranah SKU varian via `VariantBuilder`/`MenuTargetCombobox`).
- Backend `upsertMenu` sudah menulis `stockType` + sinkron `PortionStock` (create qty 0 saat → portion; pertahankan baris saat → nonStock untuk history). **Tanpa perubahan backend.**
- **Interaksi yang harus dijelaskan ke user via helper text:** saat OFF→ON, stok mulai dari 0 (perlu restock); item langsung ikut auto-decrement + reminder + restock pagi.

**A2. Reorder metode bayar (`PaymentMethodsTab.tsx`)**
- Tambah tombol **↑/↓** per baris (mobile-friendly; bukan drag-drop).
- Pada klik, susun ulang array `id` → panggil `paymentMethodService.reorder(orderedIds)` (sudah ada, belum dipakai) → invalidate query.

**A3. Users — reaktivasi + akun sendiri + badge (`UsersPage.tsx`, `Layout.tsx`)**
- **Reaktivasi:** tambah checkbox **"Aktif"** di form edit staff (bind `isActive`), atau tombol "Aktifkan" pada kartu staff nonaktif.
- **Badge "Nonaktif":** tandai baris/kartu staff `isActive=false` (butuh `isActive` ada di tipe `User` frontend + response list — verifikasi; backend sudah kembalikan semua user).
- **Akun Saya:** dialog "Akun Saya" (entry dari avatar/sidebar di `Layout.tsx`) → owner edit **nama + PIN sendiri** via `PUT /users/:id`. Role sendiri tetap **tidak** bisa diubah (sudah di-guard di UI; tambah guard server-side ringan opsional).

**A4. Fix PIN length (`UsersPage.tsx`)**
- Selaraskan validasi + label frontend ke **tepat 6 digit** (cocok dengan backend `^\d{6}$` + seed + `SKRIPSI.md`). Hapus klaim "4-6 digit".

**Verifikasi WS-A:** `tsc` 0 + `vite build` + e2e manual: ubah Air Mineral → portion (muncul di Stok Porsi qty 0), reorder metode, nonaktif→aktifkan staff, owner ganti nama/PIN sendiri lalu login ulang.

---

### WS-B — Settings & Money-Math (AppSetting +field, ikut pola tab yang ada)

Pola referensi: `AppSetting` (singleton id=1) → `settings.schema.ts` (Zod) → `settings.service.ts` → tab baru di halaman owner (sekarang "Pembayaran" punya 4 tab: Metode/Bank/Pajak/Jam Shift).

**B1. Tab "Identitas Resto" (baru)**
- AppSetting +fields: `restaurantName String`, `restaurantAddress String? @db.VarChar(255)`, `openingHours String? @db.VarChar(64)`, `restaurantPhone String? @db.VarChar(32)`, `restaurantLogoUrl String? @db.VarChar(255)`.
- `settings.schema.ts`: tambah field opsional + batas panjang. `settings.service.ts` + `SettingView`: expose field baru.
- **UI tab baru** `RestaurantIdentityTab.tsx`: input nama/alamat/jam/telp + **upload logo**.
- **Logo upload:** generalisasi infra upload yang ada (`menus.upload.ts`: multer + sharp→WebP). Opsi: tambah endpoint `POST /uploads/logo` (atau parameter folder) yang simpan ke `/branding/logo.webp` dan kembalikan url; di frontend ekstrak `MenuImageUpload` jadi primitive `ImageUpload` reusable (atau buat varian tipis `LogoUpload`). Simpan url ke `restaurantLogoUrl`.
- Seed/default: `restaurantName='Ayam Bakar Banjar Monosuko'` agar tidak kosong saat pertama.
- **Konsumen:** `LoginPage` (judul/branding) + `Layout` header membaca dari settings (fallback ke string lama bila kosong). Header struk (WS-C) membaca dari sini.

**B2. PB1 2-sumbu (money-math) — desain penyimpanan aman**

Kondisi kode sekarang (`transactions.service.ts:838-844`): saat first payment slice, `ratePct = taxEnabled ? taxRate : 0`; `taxAmount = base × ratePct/100`; `total = base + taxAmount`. Jadi `taxEnabled=true` = ditagih ke pelanggan; `false` = tak ada pajak.

Perubahan:
- **AppSetting** +`taxChargedToCustomer Boolean @default(false)` (resto sekarang TIDAK membebankan).
- **Transaction** +`taxBorneAmount Decimal @default(0) @db.Decimal(12,2)`. **`taxAmount` tetap = pajak yang ditagih ke pelanggan** (tetap bagian dari `total`) → **formula `total = base + taxAmount` TIDAK berubah, data lama aman** (taxBorneAmount default 0).
- **Logika first slice** (snapshot saat bayar):
  ```
  pb1 = taxEnabled ? round(base × taxRate / 100, 2) : 0
  if (taxChargedToCustomer) { taxAmount = pb1; taxBorneAmount = 0; total = base + pb1 }
  else                      { taxAmount = 0;   taxBorneAmount = pb1; total = base }
  ```
  Karena dua field amount mutually-exclusive, **tidak perlu** menyimpan boolean snapshot di Transaction — `taxBorneAmount > 0` sudah menandai "ditanggung".
- **TransactionView** + service mapper: expose `taxBorneAmount`.
- **Dashboard owner** (`dashboard.service.ts`): `laba = pendapatan − cogs − Σ taxBorneAmount` (filter periode identik dengan revenue/COGS). Tambah baris display "PB1 ditanggung resto".
- **Settlement:** tidak terdampak — settlement merekonsiliasi `total` (uang yang benar-benar masuk); saat ditanggung, `total=base` jadi cash cocok. PB1 ditanggung bukan uang yang ditagih.
- **`TaxSettingsTab.tsx`:** tambah toggle **"Bebankan PB1 ke pelanggan?"** (`taxChargedToCustomer`) + teks penjelas matriks. Pertahankan toggle `taxEnabled` + input rate.

**B3. Setting operasional stok (parametrik)**
- AppSetting +`restockMultiple Int @default(5)` + `lowStockThreshold Int @default(5)`.
- Backend `portion.schema.ts` (validasi kelipatan) baca dari setting (lewat service/context, bukan literal `%5`). `portion.service.ts` `suggestedRestock` ikut parametrik.
- Frontend `PortionStockTab.tsx` validasi + `step` ikut setting; `utils.ts getStockStatus()` terima threshold.
- UI: input di tab baru "Operasional" atau gabung ke tab Stok/Setting. (Detail penempatan diputuskan saat impl WS-B; prioritas rendah, boleh tab sederhana.)

**Verifikasi WS-B:** migrasi aditif zero-loss (count before/after). Unit/integration: 3 kombinasi PB1 (off / charged / borne) hitung `taxAmount`/`taxBorneAmount`/`total` benar; dashboard laba kurangi borne. e2e: isi identitas + upload logo → tampil di header.

---

### WS-C — Struk PDF + UX Pasca-Bayar (bergantung WS-B)

**C1. UX pasca-bayar (`PaymentModal.tsx`)**
- Saat ini modal auto-close on success. Ubah: setelah pembayaran sukses, modal **transisi ke state "Sukses"** (bukan menutup): ikon centang + ringkasan (total, kembalian bila ada) + tombol **"Cetak / Simpan Struk"** dan **"Selesai"**. Hanya "Selesai" (atau klik area) yang menutup → balik ke POS.

**C2. Generate struk PDF (client-side)**
- Library: **jsPDF** (client-side; kasir simpan langsung ke device, cocok PWA, tanpa round-trip backend).
- Format: **nota kecil hitam-putih** (~58mm/80mm width, layout monospace) sesuai standar struk POS resto.
- **Header** dari AppSetting (WS-B): nama, jam buka, alamat, telp, (logo bila ada — kecil, B/W/grayscale).
- **Body:** no. transaksi + tanggal/jam, meja/takeaway, kasir, daftar item (qty × harga = subtotal per item, + notes/subOptions), lalu **Subtotal · Diskon · PB1 · Total · Metode Bayar · (Kembalian)**. Bila PB1 ditanggung → baris "Harga sudah termasuk PB1".
- **Footer:** ucapan terima kasih.
- **Simpan:** `doc.save('struk-<kode>-<tgl>.pdf')` → unduh ke device.
- Entry tambahan: tombol "Cetak Struk" juga di `HistoryPage` row (cetak ulang dari transaksi lama).
- **Layout final difinalkan saat impl WS-C** dengan referensi struk POS standar via firecrawl (header/alignment/lebar kolom), lalu mockup ASCII di-review user sebelum koding.

**Verifikasi WS-C:** e2e: bayar → modal tak menutup → klik "Simpan Struk" → PDF terunduh berisi identitas + rincian benar (cek nominal = PaymentModal). Cetak ulang dari History.

---

### WS-D — Master-Table Dinamis (2 model baru + migrasi; paling berat)

**D1. Kategori tagihan (`BillCategory` enum → master table)**
- Model baru `BillCategory { id, label, isActive, displayOrder }`. `Bill` +`categoryId Int?` FK (aditif).
- Migrasi: seed 5 default (kebersihan/listrik/air/parkir/sewa), backfill `Bill.categoryId` dari enum lama by-label. Tahap destruktif (drop kolom enum lama) **terpisah & PROD hard-gated**.
- Backend: modul/endpoint CRUD owner-only untuk kategori (create/edit/deactivate/reorder). `bills.schema` validasi `categoryId` ada & aktif.
- Frontend: `BillsPage` pilih kategori dari master (query); tombol **"Kelola Kategori"** → modal CRUD.

**D2. Meja (`env TABLE_COUNT` → `RestaurantTable` master)**
- Model baru `RestaurantTable { id, number @unique, capacity, name?, isActive }`.
- Validasi transaksi: `tableNumber` harus ada & `isActive` (ganti cek `< env.TABLE_COUNT`). `tableNumber` tetap identifier stabil (data transaksi lama aman). Hapus meja = soft-delete `isActive=false`.
- Migrasi: seed 9 meja (2× kapasitas 6 + 7× kapasitas 4 sesuai hardcode `TablesPage.tsx`). `env.TABLE_COUNT` hanya jadi sumber seed (deprecate).
- Backend: modul `tables` diperluas (CRUD owner: tambah/edit kapasitas/nama/aktif). Endpoint list publik untuk POS.
- Frontend: `TablesPage` + `CartPanel` picker **fetch dari API** (bukan const). Tab/halaman "Kelola Meja" owner.

**Verifikasi WS-D:** migrasi aditif zero-loss; tambah kategori "internet" lalu pakai di Bill; tambah meja 10 lalu buat transaksi di meja 10; nonaktifkan meja → hilang dari picker tapi transaksi lama tetap valid.

---

## 4. Perubahan Schema (ringkasan)

**Aditif (zero-loss), per workstream:**
- WS-A: **tidak ada.**
- WS-B: `AppSetting` +`taxChargedToCustomer`, `restaurantName`, `restaurantAddress`, `openingHours`, `restaurantPhone`, `restaurantLogoUrl`, `restockMultiple`, `lowStockThreshold`. `Transaction` +`taxBorneAmount`.
- WS-D: model baru `BillCategory` + `RestaurantTable`; `Bill` +`categoryId` FK.

**Destruktif (terpisah, PROD hard-gated, setelah backfill terverifikasi):** drop enum `BillCategory` lama; deprecate `env.TABLE_COUNT`.

**Produksi:** `monosuko.my.id` LIVE → semua migrasi backend dijalankan **manual, additif dulu, backup sebelum**, verifikasi count before/after. Mengikuti pola REV 2.11.

---

## 5. Build Order, Isolasi, & Testing

- **Branch:** kerjakan di worktree/branch dari `feat/katalog-menu-ux` (atau buat `feat/owner-self-service-rev212`). Tiap WS = fase plan dengan checkpoint review (sesuai preferensi incremental).
- **Isolasi antar-unit:** WS-A independen (frontend). WS-B fondasi setting+money. WS-C konsumen WS-B (identitas+PB1). WS-D independen, dijalankan terakhir.
- **Pipeline superpowers per WS:** TDD untuk perubahan backend (Zod + service test dulu), verification-before-completion (tsc + build + lint + e2e), code-review sebelum commit.
- **Konsistensi frontend:** ikuti Frontend Consistency Mandate — audit komponen sejenis (`TaxSettingsTab`/`ShiftWindowTab` untuk tab setting; `BillsPage`/`MenuFormModal` untuk form; `PaymentModal` untuk state modal), pakai primitive `design-system/primitives` + `ui/`.
- **Dokumentasi ground-truth:** setiap WS selesai → update `docs/operasional-resto.md` (khususnya luruskan kalimat "PB1 10% wajib" jadi model 2-sumbu), knowledge docs (ERD/DATA-DICTIONARY untuk model baru WS-D, AppSetting baru WS-B), dan memory continuity.

---

## 6. Open Items (difinalkan saat impl WS terkait, bukan blocker spec)
- WS-B: penempatan persis input `restockMultiple`/`lowStockThreshold` (tab sendiri vs gabung) — prioritas rendah.
- WS-C: layout struk final (lebar 58 vs 80mm, kolom, logo grayscale) — riset firecrawl + mockup ASCII di-review sebelum koding.
- WS-D: apakah `Bill.category` enum di-drop di batch ini atau ditahan sampai prod stabil (default: tahan, destruktif belakangan).
