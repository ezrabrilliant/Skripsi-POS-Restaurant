# Design Spec - Order Intake Workflow & Permission Matrix (REV 2.3)

**Status:** Approved by Ezra (2026-05-24, brainstorming session).
**Konsekuensi:** Bump dokumentasi proyek dari REV 2.2 → REV 2.3.
**Tidak ada perubahan schema** - semua keputusan di sini di-implement di app layer (middleware + UI conditional).

## 1. Konteks & Masalah

Sampai REV 2.2, dokumentasi menyebut waiter "bisa input order ke sistem POS, sama seperti kasir" (di `docs/operasional-resto.md` seksi "Pengguna Sistem" dan beberapa UC di `docs/knowledge/USE-CASE.md`). Realita lapangan yang dikonfirmasi Ezra: waiter sangat sibuk peak hour - bersih meja, cuci piring, buat & antar minuman, ambil order baru. Memutus alur kerja untuk pegang HP dan input order ke POS sambil tangan kotor tidak realistis.

Konsekuensi: workflow primary tetap kertas (waiter tulis → Yanti di dapur resto baca → kasir input ke POS). Waiter tidak boleh dianggap co-equal dengan kasir untuk input order - itu cuma fallback bila kasir tidak available (misal kasir lagi telepon owner, lagi ke toilet, lagi belanja).

## 2. Keputusan Final

### 2.1. Workflow Order Intake

| Channel | Flow |
|---|---|
| **Dine-in** | Waiter ambil order verbal di meja → tulis di kertas → kasih ke dapur resto (Yanti, panaskan/bakar/goreng) → kertas dilanjut ke kasir → kasir input ke POS. Timing input fleksibel (antara terima kertas dan customer bayar - sistem tidak enforce). |
| **Takeaway walk-in** | Customer datang langsung ke kasir → kasir input langsung. Tidak via waiter, tidak ada kertas. |
| **Takeaway GoFood / GrabFood** | Notif masuk app merchant → kasir input manual ke POS dengan tipe takeaway dan payment method gojek/grab settlement. |

Tidak ada cetak struk pesanan ke dapur. Yanti baca dari kertas waiter langsung. Dapur produksi (frozen batch) tetap di rumah owner.

### 2.2. Permission Matrix

| Resource / Aksi | Owner | Kasir | Waiter |
|---|:---:|:---:|:---:|
| Input order / edit / void transaksi | ✓ | ✓ | ✓ *(fallback only)* |
| Proses payment (selesaikan transaksi, pilih metode + bank) | ✓ | ✓ | ✗ |
| Buka kasir (modal awal shift) | – | ✓ | ✗ |
| Settlement harian (rekap 6 metode) | ✓ | ✓ | ✗ |
| Stok porsi: view + opname + mark habis | ✓ | ✓ | ✓ |
| Raw materials: view + opname + mark habis | ✓ | ✓ | ✓ |
| Pembelian (input belanja pasar, vendor + items) | ✓ | ✓ | ✗ |
| Bills / Tagihan operasional (kebersihan/listrik/air/parkir/sewa) | ✓ | ✗ | ✗ |
| Laporan keuangan & analitik | ✓ *(full)* | ✓ *(hari ini saja, untuk verifikasi shift)* | ✗ |
| Master data: menu, paket, user, raw material CRUD | ✓ | ✗ | ✗ |
| Mereview settlement | ✓ | ✗ | ✗ |

**Interpretasi "fallback only" untuk waiter input order:**
- Backend tidak hard-block waiter dari `POST /transactions`. Endpoint tetap accept role `waiter`.
- Frontend UI yang membentuk perilaku: dashboard waiter menampilkan "Stok Hari Ini" + reminder + tombol Opname sebagai primary CTA. Akses ke "Input Order" ditaruh sebagai link sekunder yang lebih kecil (bukan card besar) supaya waiter tidak terbiasa pakai sebagai default.

### 2.3. UI Implikasi Per Role

**Dashboard Waiter:**
- Primary: card "Stok Porsi Hari Ini" (dengan count item yang ≤ min) + card "Raw Materials Reminder" (item perlu beli / mendekati basi) + tombol "Opname Stok Porsi" + tombol "Opname Raw Materials" + tombol "Mark Item Habis"
- Secondary: link kecil "Input Order (fallback)" di pojok atas

**Dashboard Kasir:**
- Conditional Primary: kalau shift belum dibuka → CTA tunggal besar "Buka Kasir" (input modal awal). Kalau shift sudah buka → 3 card sejajar: "Input Order Baru", "Daftar Transaksi Open" (untuk lanjut bayar / lihat split-merge), "Tutup Kasir" (di akhir shift malam saja)
- Secondary: card "Stok Porsi" + "Raw Materials" + "Catat Pembelian" + reminder

**Dashboard Owner:**
- Primary: card "Laporan Hari Ini" (dengan breakdown bank EDC/transfer) + "Tagihan Operasional" + "Belanja Bulan Ini" + "Reminder Semua Role"
- Secondary: link CRUD master (menu, user, vendor, raw material)

### 2.4. Login (Konfirmasi Ulang dari A.1 ACTIVITY.md REV 2.2)

Form 2 field: input nama pengguna + input PIN 6 digit, lalu submit. **Tidak ada layar pilih nama dari daftar**, **tidak ada localStorage remember last user**. Setiap login pegawai ketik nama mereka manual.

USE-CASE.md REV 2.2 line 48 masih menyebut "pilih nama dari list → input PIN 6 digit. Device ingat last user (localStorage)" - ini OUT OF SYNC dengan ACTIVITY.md A.1 dan operasional-resto.md. Diperbaiki di REV 2.3.

## 3. Konsekuensi ke Dokumentasi

Bump semua docs core dari REV 2.2 → REV 2.3:

| File | Perubahan |
|---|---|
| `docs/operasional-resto.md` | Seksi "Pengguna Sistem" - koreksi waiter "bisa input order sama seperti kasir" → "bisa input order sebagai fallback bila kasir tidak available". Seksi "Alur Transaksi" - perjelas "kasir yang input" (sebelumnya ambigu "kasir/waiter"). Tambah seksi baru **"Permission Matrix"** setelah "Pengguna Sistem". |
| `docs/knowledge/USE-CASE.md` | Bump header ke REV 2.3. Fix UC `Login` (drop mention pilih nama dari list + localStorage). UC `Mengelola Pesanan Meja` annotate *(kasir primary, waiter fallback)*. UC `Memilih Sub-Pilihan Paket` sama. Narasi Bab 3 paragraf 2 update Login mechanism. Update aktor row Waiter di tabel section 4. |
| `docs/knowledge/ACTIVITY.md` | Bump header ke REV 2.3. A.2 tambah note "Waiter dapat fallback langsung input di POS dengan bypass jalur kertas saat kasir tidak available - alur sama dengan jalur kasir input, hanya actor swimlane swap". A.1 sudah aligned REV 2.2 - tidak diubah. |
| `docs/knowledge/ERD.md` | Bump header ke REV 2.3 dengan note "Tidak ada perubahan schema - REV 2.3 hanya alignment dokumentasi dengan permission matrix". |
| `CLAUDE.md` | Bump REV 2.1 → REV 2.3 di "Status REV". Update "3 role" deskripsi - tambah note waiter primary di kertas, fallback POS. |
| Memory `project_resto_operational_truths.md` | Bump REV 2.2 → REV 2.3. Tambah seksi "Permission Matrix". Update seksi "Auth & Pengguna" - clarify waiter fallback. |
| Memory `project_session_handoff.md` | Update fase ke REV 2.3 + sesi 2026-05-24 brainstorming note. |

## 4. Konsekuensi ke Code (akan jadi bagian writing-plans, BUKAN bagian spec ini)

**Backend** ([backend/src/](backend/src/)):
- Tambah granular permission middleware:
  - `POST /transactions` → semua role (owner + kasir + waiter)
  - `POST /transactions/:id/payment` → owner + kasir
  - `POST /transactions/:id/void` → owner + kasir
  - `POST /shifts/open`, `/shifts/close` → kasir saja
  - `POST /settlements`, `PUT /settlements/:id/review` → owner + kasir (review = owner only)
  - `POST /purchases`, `POST /vendors`, `POST /raw_materials` (CRUD master) → owner + kasir
  - `POST /bills` → owner saja
  - `POST /opname/portion`, `POST /opname/raw_materials` → semua role
  - `PUT /menus`, `POST /users`, `PUT /raw_materials/:id` (master edit) → owner saja
- Auto-decrement `portion_stocks.current_qty` saat `POST /transactions` (waiter pun bisa trigger via fallback).

**Frontend** ([frontend/src/](frontend/src/)):
- Tambah `CashierRoute` guard component (selain `OwnerRoute` existing).
- 3 dashboard berbeda layout: `OwnerDashboard`, `CashierDashboard`, `WaiterDashboard`.
- Conditional render: tombol "Bayar / Selesaikan" hidden untuk role waiter di order detail.
- Conditional render: card "Catat Pembelian", "Buka Kasir", "Tutup Kasir" hidden untuk role waiter di dashboard.

**Schema**: tidak ada perubahan. Permission ditangani di app layer.

## 5. Out of Scope

- Tidak menambah "audit trail aksi waiter saat fallback input order". Kalau dibutuhkan untuk skripsi, bisa ditambah di REV 2.4 (kolom `transactions.input_by_role` enum yang track siapa yang input - tapi dirasa over-engineering untuk family business).
- Tidak menambah "approval kasir saat waiter fallback input". Family business, trust tinggi, koordinasi verbal cukup.
- Tidak menambah notifikasi "kasir sedang tidak available" ke waiter. Komunikasi tetap verbal.

## 6. Rationale Singkat

| Keputusan | Why |
|---|---|
| Waiter fallback (bukan blocked) | Family business kecil - kasir bisa tidak available (telepon owner, ke toilet, belanja). Lebih baik UI nudge kasir-first daripada hard-block waiter yang bisa bikin order tidak ter-record |
| Timing input fleksibel | Kasir biasanya lebih lowong dari waiter peak hour. Sistem tidak memaksa timing - kasir input saat lowong atau saat customer minta bill. Realistis untuk family business minim aturan |
| Payment kasir-only (bukan waiter fallback) | Payment menyangkut transaksi uang nyata + pemilihan metode + bank picker untuk EDC/transfer. Lebih aman kasir handle. Family business trust ke kasir (anak owner) lebih tinggi |
| Stok porsi opname semua role | Waiter sering yang cek fisik stok di malam (verbal handover ke kasir). Memberi waiter akses opname digital memberinya ownership data yang sudah dipegangnya secara fisik |
