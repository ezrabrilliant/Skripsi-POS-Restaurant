# Use Case Diagram - Sistem POS Ayam Bakar Banjar Monosuko (REV 2.11)

> **Status:** REV 2.11 (2026-05-30) - selaras proposal: **drop** UC `Mencatat Pembelian` + `Melakukan Opname Raw Materials` (subsistem belanja/raw-materials dihapus), **tambah** UC `Kelola Modal/COGS Menu` (owner). UC list: 20 → **19 UC** (1 shared + operasional kasir/waiter + owner). Lihat [`docs/superpowers/specs/2026-05-30-cogs-per-menu-remove-belanja-design.md`](../superpowers/specs/2026-05-30-cogs-per-menu-remove-belanja-design.md). Nuance permission REV 2.3 tetap berlaku (input order primary = kasir, waiter fallback).
> **Sumber alur bisnis:** [`docs/operasional-resto.md`](../operasional-resto.md) REV 2.11 (sumber kebenaran tertinggi)
> **Design spec turunan:** [`docs/superpowers/specs/2026-05-24-permission-matrix-design.md`](../superpowers/specs/2026-05-24-permission-matrix-design.md)
> **Visual:** ERD + 11 activity diagram REV 2.2 sudah di-build di `Skripsi.mdj`. Use Case Diagram REV 2.3 pending rebuild.

> ⚠️ **Penyempurnaan REV 2.2 → REV 2.3:**
> 1. UC `Login` (line 48): drop mention "pilih nama dari list" + "device ingat last user (localStorage)" - diganti dengan form 2 field input nama + PIN murni sesuai ground truth.
> 2. Annotation aktor pada UC shared (`Mengelola Pesanan Meja`, `Memilih Sub-Pilihan Paket`): tambah label *(kasir primary, waiter fallback)* untuk hindari interpretasi co-equal.
> 3. Tabel aktor (§4) row Waiter: clarify "input order = fallback only" + tambah tugas opname.
> 4. Narasi Bab 3 (§8): update paragraf 1 dan paragraf 2 sesuai poin 1-3 di atas.
> 5. Tidak ada perubahan jumlah UC (tetap 20), tidak ada perubahan relasi/include/extend, tidak ada perubahan ERD.

---

## 1. Apa itu Use Case Diagram?

> *"Use case diagram adalah diagram yang menunjukkan kebutuhan pengguna terhadap sistem yang akan dibangun. Secara sederhana, dengan membaca use case diagram, dapat diketahui fitur apa yang disediakan dalam sistem tertentu."* - Modul Pembelajaran ADSI Bab 5

Use Case Diagram adalah diagram UML pada **tahap analisis** untuk mendokumentasikan **Functional Requirements (FR)** - fungsi yang harus disediakan sistem dari sudut pandang pengguna. Diagram menghubungkan **siapa** (actor) dengan **apa yang bisa dilakukan** (use case), tanpa membahas *bagaimana* sistem melakukannya.

## 2. Kegunaan untuk Skripsi

1. **Validasi scope fitur** dengan dosen pembimbing dan pemilik restoran.
2. **Dasar perancangan activity diagram** - setiap UC critical dipecah alurnya.
3. **Batas sistem** - memperjelas apa yang masuk scope (dalam boundary) dan tidak (mis. proses masak di dapur = out of scope, perhitungan HPP = out of scope).

## 3. Elemen Use Case Diagram

| Simbol | Nama | Fungsi |
|---|---|---|
| 🯅 stick figure | **Actor** | Role yang berinteraksi dari luar. Kata benda. |
| ⬭ oval | **Use Case** | Fitur. Kata kerja + objek. |
| ─── | **Association** | Actor ↔ UC |
| ▭ rectangle | **System Boundary** | Batas sistem |
| `<<include>>` | **Include** | Wajib: base UC pasti jalankan included UC |
| `<<extend>>` | **Extend** | Opsional: extending UC jalan jika kondisi tertentu |

## 4. Tiga Actor (REV 2.11)

| Actor | Role di sistem | Tugas utama |
|---|---|---|
| **Owner** | Pemilik restoran (akses penuh + tagihan + master data + modal/COGS) | CRUD menu/user, set & ubah modal/COGS menu (+ lihat riwayat modal), input tagihan bulanan, review settlement, lihat dashboard & laporan laba rugi |
| **Kasir** | Operator POS shift (Jason, Bryant, Chen Hong). **Primary input order ke POS.** | Buka kasir, input/kelola pesanan (primary), proses bayar (bank picker untuk EDC/transfer), void bebas, tutup kasir, restock pagi, barang masuk darurat, opname stok porsi |
| **Waiter** | Pelayan + helper (Amel, Yanti). **Primary di kertas (tulis order verbal ke kertas, kasih kasir).** | Ambil order ke meja (tulis kertas), antar makanan, buat & antar minuman, cuci piring, restock pagi, opname stok porsi pagi, mark item habis. Input order ke POS hanya sebagai **fallback** bila kasir tidak available - bukan tugas rutin. |

Catatan: Role `Kitchen` (REV 1) **dihapus** karena masak dilakukan di rumah owner, di luar lingkup sistem. Pegawai Lisa (masak only) tidak punya akun sistem. Permission matrix lengkap per role per aksi ada di [`docs/operasional-resto.md`](../operasional-resto.md) seksi "Permission Matrix" dan [`docs/superpowers/specs/2026-05-24-permission-matrix-design.md`](../superpowers/specs/2026-05-24-permission-matrix-design.md).

## 5. Sembilan Belas Use Case (REV 2.11)

### 5.1. Shared (1)

- **`Login`** (REV 2.3.1 - *cached-name UX*) - First login di device: form 2 field input nama + numpad PIN 6 digit, lalu submit. Setelah berhasil, nama disimpan di localStorage (`pos-auth.lastUserName`). Login berikutnya di device sama: tampilan PIN-only numpad dengan nama auto-fill dari cache; pegawai cukup ketik 6 digit, auto-submit. Tombol "Ganti Pengguna" reset cache dan balik ke form 2 field. Sistem lookup user by nama + verifikasi PIN match. PIN boleh duplikat antar pegawai karena identifikasi via kombinasi nama + PIN. **Tidak ada layar pilih dari daftar seluruh pegawai** - cache cuma simpan 1 nama terakhir per device. Lihat ACTIVITY.md A.1 untuk diagram alur.

### 5.2. Kasir (12 UC, di mana beberapa shared dengan Waiter/Owner)

- **`Buka Kasir`** *(kasir-only)* - pilih ShiftType (pagi/malam), input modal awal laci kas.
- **`Mengelola Pesanan Meja`** *(kasir primary, waiter fallback only)* - workflow primary: waiter ambil order verbal di meja → tulis di kertas → kasih kertas ke dapur resto (Yanti) → dapur dilanjut ke kasir → kasir input ke POS. Pilih tipe order:
  - **dineIn**: pilih meja (1 dari 9 meja, 2 kapasitas 6 + 7 kapasitas 4)
  - **takeaway**: tanpa meja (walk-in, GoFood/GrabFood merchant app, atau gosend teman owner - dibedakan via payment method di tahap pembayaran)
  Tambah/edit item. Customer bisa nambah pesanan kapan saja (multi-round per sesi meja sebelum bill). Waiter dapat input langsung di POS sebagai **fallback** bila kasir tidak available (alur sama, hanya actor berbeda) - di frontend, akses ini ditaruh sebagai link sekunder di dashboard waiter (bukan primary CTA) untuk hindari penggunaan default.
- **`Memilih Sub-Pilihan Paket`** *(kasir primary, waiter fallback, extends Mengelola Pesanan Meja)* - saat tambah Paket Hemat (A/B/C/D/Keluarga), modal sub-options muncul untuk pilih variant (Paha/Dada, Bakar/Goreng, Minuman). Stok porsi yang berkurang menyesuaikan pilihan (mis. Paket A pilih Paha Goreng → Ayam Paha Goreng -1).
- **`Memproses Pembayaran`** *(kasir-only)* - pilih metode dari 6 enum (cash, EDC, QRIS, Gojek, Grab, transfer). Untuk **EDC** dan **transfer**, sistem munculkan **input bank** (mis. "BCA", "Mandiri") dengan autocomplete dari riwayat bank sebelumnya - wajib karena owner perlu laporan per bank untuk rekonsiliasi mutasi rekening. PB1 10% otomatis ditambah ke total. Diskon manual optional.
- **`Memecah Tagihan (Split Bill)`** *(kasir-only, extends Memproses Pembayaran)* - 1 transaksi meja dipisah jadi multiple party (mis. Customer A bayar item X, Customer B bayar item Y) → 2 struk PDF terpisah dengan PB1 masing-masing.
- **`Menggabungkan Tagihan (Merge Bill)`** *(kasir-only)* - 2+ transaksi meja open yang berbeda digabung jadi 1 struk gabungan (rombongan duduk di 2 meja minta bayar bareng). Sistem buat transaksi parent baru dengan FK `merged_into_id` dari transaksi anak.
- **`Membatalkan Pesanan`** *(kasir-only)* - void transaksi, **tidak perlu approval owner** (kasir bebas).
- **`Mencetak Struk`** *(kasir-only, extends Memproses Pembayaran)* - generate PDF kuitansi pembayaran, save ke device kasir. Future: thermal Bluetooth via Web Bluetooth API. **Catatan**: tidak ada cetak struk pesanan untuk dapur (dapur di rumah owner, komunikasi verbal/kertas).
- **`Restock Stok Porsi`** *(kasir+waiter)* - input restock pagi setelah kasir/waiter bawa stok dari rumah ke resto. Kelipatan 5 dengan formula `roundup((min−current)/5)*5`. Sistem catat di `portion_movements` (rename dari `stock_movements` di REV 2.2) dengan reason=`restock_morning`.
- **`Mencatat Barang Masuk`** *(kasir+waiter)* - input restock darurat tengah hari (saat owner kirim dari rumah via Gojek/Grab/antar sendiri karena stok porsi habis). Stok porsi yang sebelumnya minus akan kembali ke positif. Sistem catat di `portion_movements` dengan reason=`restock_emergency`.
- **`Melakukan Opname Stok Porsi`** *(kasir+waiter)* - cek fisik & koreksi nilai `current_qty` kalau menyimpang dari realita (analog rekonsiliasi cash). Paling pas dilakukan pagi setelah restock pagi dicatat (verifikasi total stok = sisa kemarin + restock pagi + selisih opname). Sistem catat selisih di **`portion_movements`** (rename dari `stock_movements` di REV 2.2) dengan reason=`manual_adjust`.
- **`Tutup Kasir`** *(kasir malam saja)* - rekap 6 totals (cash/EDC/QRIS/Gojek/Grab/Transfer) dengan breakdown per bank untuk EDC & transfer: tampil total sistem + input total fisik per metode → variance per metode dihitung otomatis.

### 5.3. Waiter

Waiter tidak memiliki UC unik selain yang shared dengan kasir (inventory stok porsi: restock pagi, opname stok porsi, mark item habis) + akses *fallback* input order. (REV 2.11: UC `Melakukan Opname Raw Materials` dihapus bersama subsistem raw materials.)

### 5.4. Owner (6 UC)

- **`Mengelola Menu`** *(owner)* - CRUD katalog menu termasuk konfigurasi `stockType` (portion/linked/nonStock), `minStock`, dan `subOptions` untuk paket (definisi pilihan + mapping ke stok porsi yang di-decrement).
- **`Kelola Modal/COGS Menu`** *(owner ONLY)* - set & ubah modal/COGS per menu (di SKU leaf + menu simple), dan lihat **riwayat perubahan modal** per menu (log `menu_cost_movements`). Modal dipakai untuk Laporan Laba Rugi Harian (Laba Kotor = Pendapatan − COGS). Modal **tidak dibocorkan** ke katalog publik (POS) - hanya owner yang melihatnya.
- **`Mengelola Pengguna`** *(owner)* - CRUD user, set role (owner/cashier/waiter). PIN boleh duplikat. Owner yang bertanggung jawab memberikan akun & password ke anggota keluarga yang bertugas sebagai kasir.
- **`Mencatat Tagihan Bulanan`** *(owner ONLY)* - input tagihan operasional (kebersihan, listrik, air, parkir, sewa) per bulan. Kasir tidak punya akses ke fitur ini meskipun anggota keluarga.
- **`Mereview Settlement`** *(owner)* - tandai settlement kasir malam sebagai reviewed (audit step).
- **`Melihat Dashboard dan Laporan`** *(owner)* - dashboard realtime (revenue per metode + breakdown bank untuk EDC/transfer, COGS, laba kotor = pendapatan − COGS, tagihan terpisah) + laporan periodic + reminder stok porsi per role.

## 6. Dependencies (REV 2.11)

### 6.1. `<<include>>` (18x)

Semua UC operasional **wajib login** dulu. Pola umum: panah `<<include>>` dari setiap UC operasional ke `Login`. Total 18 include (semua UC kecuali Login itu sendiri).

### 6.2. `<<extend>>` (3x)

| Extending UC | Base UC | Kondisi |
|---|---|---|
| `Mencetak Struk` | `Memproses Pembayaran` | Jika pelanggan minta struk (bisa skip kalau pelanggan tidak butuh) |
| `Memilih Sub-Pilihan Paket` | `Mengelola Pesanan Meja` | Jika item yang ditambah adalah Paket Hemat (A/B/C/D/Keluarga) |
| `Memecah Tagihan (Split Bill)` | `Memproses Pembayaran` | Jika pelanggan minta bill dipecah per party |

### 6.3. Generalization (opsional)

Karena banyak UC shared antara Kasir & Waiter (Pesanan, Sub-Pilihan, Restock Pagi, Barang Masuk, Opname Porsi), bisa dipertimbangkan generalization: `Kasir <|-- Waiter` atau sebaliknya. Optional - untuk skripsi, association langsung ke masing-masing UC lebih clear dan tidak menimbulkan ambiguitas inheritance.

## 7. Mengapa Diagram Ini Menjawab Masalah Skripsi

| Rumusan Masalah (Bab 1.2) | Use Case yang menjawab |
|---|---|
| A. Percepat durasi transaksi | `Mengelola Pesanan Meja` (2 tipe sederhana) + `Memilih Sub-Pilihan Paket` + `Memproses Pembayaran` (bank picker autocomplete) |
| B. Percepat rekonsiliasi + kurangi mismatch | `Tutup Kasir` (rekap 6 totals + breakdown bank, variance per metode dihitung otomatis) |
| C. Manajemen stok harian + restock darurat | `Restock Stok Porsi` + `Mencatat Barang Masuk` + `Melakukan Opname Stok Porsi` |
| #4 Owner tidak tahu laba & pengeluaran | `Kelola Modal/COGS Menu` (owner) + `Mencatat Tagihan Bulanan` (owner) + `Melihat Dashboard dan Laporan` (laba kotor = pendapatan − COGS, tagihan terpisah) |

## 8. Narasi untuk Bab 3 Skripsi (paste-ready, REV 2.11)

> ⚠️ **Catatan REV 2.11:** narasi ini sudah diselaraskan (drop pembelian/raw-materials, tambah modal/COGS), tetapi sebaiknya **di-review thesis-level oleh Ezra** untuk kehalusan kalimat naskah final.
>
> **3.4.1 Use Case Diagram**
>
> Use case diagram pada Gambar 3.X mendeskripsikan interaksi antara pengguna dengan Sistem POS Restoran Ayam Bakar Banjar Monosuko yang akan dibangun. Sistem melibatkan tiga aktor: **Owner** sebagai pemilik restoran dengan akses penuh terhadap master data, modal/COGS menu, tagihan operasional, dan laporan dari mana saja melalui perangkat mobile; **Kasir** sebagai operator POS yang menangani transaksi harian (input order primary, proses pembayaran, settlement) dan pengelolaan stok porsi; serta **Waiter** sebagai pelayan yang mengambil order pelanggan dengan mencatat di kertas, mengantar makanan dan minuman, mencuci piring, dan melakukan opname stok porsi. Berdasarkan realita lapangan restoran kecil keluarga di mana waiter sangat sibuk pada jam sibuk dengan tugas fisik (cuci piring, antar minuman, ambil order baru), workflow primary untuk pencatatan order tetap berbasis kertas - waiter menulis order di kertas yang kemudian diserahkan ke kasir untuk diinput ke POS. Waiter tetap diberi akun sistem dengan akses ke fitur inventory stok porsi (opname, mark habis), namun untuk input order ke POS waiter hanya memiliki akses sebagai *fallback* bila kasir tidak available.
>
> Sistem menyediakan sembilan belas use case yang terbagi dalam empat domain fungsional: (1) **autentikasi** melalui use case `Login` yang wajib dilakukan oleh semua aktor dengan form dua field input nama pengguna dan PIN enam digit (pegawai mengetik nama secara manual, tidak ada layar pilih nama dari daftar dan tidak ada penyimpanan nama terakhir di perangkat) - PIN boleh duplikat antar pegawai karena identifikasi pengguna dilakukan via kombinasi nama dan PIN; (2) **operasional transaksi** meliputi `Buka Kasir` per shift pagi atau malam dengan modal awal, `Mengelola Pesanan Meja` untuk dua tipe order (dine-in wajib pilih meja, takeaway tanpa meja - sumber order takeaway seperti walk-in, GoFood, GrabFood, atau gosend teman owner dibedakan dari metode pembayaran) dengan workflow primary kasir input dari kertas waiter dan fallback waiter input langsung saat kasir tidak available, `Memilih Sub-Pilihan Paket` untuk paket hemat dengan modifier dinamis, `Memproses Pembayaran` (kasir-only) dengan enam metode (cash, EDC, QRIS, Gojek, Grab, transfer) di mana EDC dan transfer disertai input bank untuk laporan rekonsiliasi per bank, `Memecah Tagihan` per item untuk split bill, `Menggabungkan Tagihan` untuk merge bill antar transaksi meja, `Membatalkan Pesanan` tanpa perlu approval, `Mencetak Struk` PDF, dan `Tutup Kasir` di akhir hari dengan rekap enam total metode pembayaran dan breakdown per bank; (3) **manajemen stok** meliputi `Restock Stok Porsi` pagi dengan formula kelipatan lima porsi, `Mencatat Barang Masuk` untuk restock darurat tengah hari saat owner kirim stok dari rumah via Gojek atau Grab, serta `Melakukan Opname Stok Porsi` untuk cek fisik dan koreksi nilai stok porsi pagi setelah restock; (4) **administrasi & laporan** meliputi `Mengelola Menu` dengan konfigurasi sub-pilihan paket, `Kelola Modal/COGS Menu` (owner) untuk menetapkan dan mengubah modal per menu beserta riwayat perubahannya, `Mengelola Pengguna`, `Mencatat Tagihan Bulanan` (kebersihan, listrik, air, parkir, sewa) yang khusus owner, `Mereview Settlement` kasir malam, dan `Melihat Dashboard dan Laporan` realtime dengan laporan laba rugi harian (laba kotor = pendapatan − COGS, tagihan terpisah) dan reminder stok porsi per role.
>
> Hubungan `<<include>>` ditunjukkan dari setiap use case operasional ke `Login`, menandakan bahwa autentikasi merupakan prasyarat wajib (delapan belas include). Hubungan `<<extend>>` digunakan pada tiga skenario opsional: `Mencetak Struk` extends `Memproses Pembayaran` (struk PDF dicetak hanya jika pelanggan meminta), `Memilih Sub-Pilihan Paket` extends `Mengelola Pesanan Meja` (modifier muncul hanya jika item yang dipilih adalah paket), dan `Memecah Tagihan` extends `Memproses Pembayaran` (split bill dilakukan hanya jika pelanggan meminta bill terpisah per party). Sistem secara sengaja membatasi inventori pada barang siap jual satuan porsi (tidak ada pengelolaan bahan baku mentah, vendor, maupun pencatatan belanja), sesuai ruang lingkup penelitian.

## 9. Elemen Visual Diagram

Saat membaca diagram di `docs/diagrams/use-case-diagram-sistem-pos-restoran.png` (REV 2.3 - visual pending rebuild di StarUML setelah update annotation aktor), perhatikan:
- **Garis solid** actor ↔ UC = association
- **Garis putus-putus berlabel `<<include>>`** = dependency wajib (semua konvergen ke `Login`)
- **Garis putus-putus berlabel `<<extend>>`** = dependency opsional (3 UC)
- **Rectangle luar** berlabel `Sistem POS Restoran Ayam Bakar Banjar Monosuko` = system boundary
- 3 actor di luar boundary: Owner (kanan), Kasir (kiri atas), Waiter (kiri bawah)

## 10. Bad Practice yang Dihindari

- ❌ Over-split UC dashboard (misal 5 UC terpisah: Lihat Dashboard, Lihat Lap Pendapatan, dst.) → konsolidasi jadi 1 UC `Melihat Dashboard dan Laporan`.
- ❌ UC berupa UI click (`Klik Tombol Submit`) atau technical primitive (`Validate Input`) → pakai business goal.
- ❌ Actor-to-actor line langsung → pakai shared UC atau generalization.
- ❌ UC tanpa association ke actor manapun (orphan) → setiap UC minimal 1 aktor.
- ❌ Menyertakan UC yang tidak ada di operasional riil (mis. "Cetak Laporan PDF Bulanan" jika resto tidak butuh; "Hitung HPP per Bahan / Bill of Materials" karena BoM out of scope - modal/COGS dinyatakan langsung per menu via `Kelola Modal/COGS Menu`, bukan dihitung dari konsumsi bahan) → match REV 2.11 ground truth.
- ❌ Over-engineering tipe order (5 enum padahal cukup 2) - REV 2.1 koreksi REV 2 di point ini.
- ❌ (REV 2.11) UC `Mencatat Pembelian`, `Melakukan Opname Raw Materials`, dan master data `Vendor`/`Raw Material` **dihapus** - subsistem belanja/raw-materials keluar dari sistem (inventori = finished-goods porsi saja). Jangan menambahkannya kembali sebagai UC.

## 11. Perubahan vs REV 2 (Diff lengkap REV 2 → REV 2.1)

### Actor
| Status | REV 2 | REV 2.1 |
|---|---|---|
| ✅ KEEP | Owner, Kasir, Waiter | Tetap, tidak ada perubahan actor |

### Use Case
| Status | REV 2 UC | REV 2.1 UC |
|---|---|---|
| 🔄 SIMPLIFY | `Mengelola Pesanan Meja` (4 tipe order: dineIn/takeawayWalkin/takeawayGojek/takeawayGrab/gosend) | `Mengelola Pesanan Meja` **(2 tipe: dineIn/takeaway)**. Sumber takeaway dibedakan via payment method. |
| 🔄 EXPAND | `Memproses Pembayaran` | + Input bank picker untuk EDC & transfer (laporan rekonsiliasi per bank) |
| ❌ DROP | `Mencatat Stok Bahan` (waiter, opname malam 5 jenis bahan rigid) | Diganti dengan `Melakukan Opname Raw Materials` yang lebih general (raw_materials fleksibel, bukan 5 jenis hardcoded) |
| 🆕 NEW | - | `Melakukan Opname Stok Porsi` (kasir+waiter, pagi setelah restock untuk verifikasi nilai system vs fisik) |
| 🆕 NEW | - | `Melakukan Opname Raw Materials` (waiter+kasir, malam sebelum tutup) |
| 🔄 EXPAND | `Mencatat Pembelian` | + Vendor opsional (add inline) + items ternormalisasi (purchase_items dengan FK ke raw_materials) + add raw material inline saat input pembelian + auto-update `raw_materials.stock_qty`/`last_buy_date`/`unit_price` saat submit |
| ❌ DROP (implicit) | - | UC `Mengelola Vendor` & `Mengelola Raw Materials` **tidak dibuat sebagai top-level UC** - di-handle implicit via inline-add di `Mencatat Pembelian` + halaman list accessible owner |
| ✅ KEEP | UC lain (15) | Tetap |

### Dependencies
- `<<include>>` Login → 19 UC (REV 2: 16)
- `<<extend>>` 3 UC (REV 2: 3) - tetap

### Count
- REV 2: 17 UC (sebenarnya 19 jika dihitung detail per actor)
- REV 2.1: **20 UC** (1 shared + 14 operasional kasir/waiter + 5 owner)

## 11.b Perubahan REV 2.1 → REV 2.2 (audit log raw materials)

- ✅ **Tidak ada perubahan jumlah UC** (tetap 20).
- 🔄 **UC #12 Melakukan Opname Stok Porsi**: clarify log ke `portion_movements` (rename dari `stock_movements`).
- 🔄 **UC #15 Melakukan Opname Raw Materials**: tambah note bahwa setiap koreksi otomatis tercatat di tabel `raw_material_movements` (REV 2.2 BARU).
- 🔄 **UC #14 Mencatat Pembelian**: tambah note bahwa submit pembelian juga auto-insert ke `raw_material_movements` (reason=`purchase`) untuk audit trail.
- Alasan perubahan: REV 2.1 hanya `portion_stocks` yang punya audit log (`stock_movements`), `raw_materials` tidak - gap yang menyulitkan traceability. REV 2.2 menutup gap dengan tabel audit log terpisah `raw_material_movements`.

## 11.c Perubahan REV 2.2 → REV 2.3 (permission matrix + login fix)

- ✅ **Tidak ada perubahan jumlah UC** (tetap 20), tidak ada perubahan relasi include/extend, tidak ada perubahan ERD.
- 🔄 **UC `Login` (§5.1)**: drop mention "pilih nama dari list" + "device ingat last user (localStorage)". REV 2.3 align dengan ACTIVITY.md A.1 dan operasional-resto.md - form 2 field input nama + PIN, pegawai ketik manual setiap login.
- 🔄 **UC `Mengelola Pesanan Meja` (§5.2)**: annotation aktor `(kasir+waiter)` → `(kasir primary, waiter fallback only)`. Tambah deskripsi workflow primary kertas-mediated.
- 🔄 **UC `Memilih Sub-Pilihan Paket` (§5.2)**: annotation aktor sama.
- 🔄 **Tabel aktor (§4)**: row Kasir tambah label "Primary input order ke POS". Row Waiter tambah label "Primary di kertas" dan clarify "Input order ke POS hanya sebagai fallback bila kasir tidak available - bukan tugas rutin".
- 🔄 **Narasi Bab 3 (§8)**: paragraf 1 update deskripsi 3 aktor - explisit waiter primary di kertas, fallback POS. Paragraf 2 update mekanisme Login - form input nama + PIN murni (drop "dua langkah pilih nama").
- 🆕 **Referensi baru**: [`docs/operasional-resto.md`](../operasional-resto.md) seksi "Permission Matrix" (REV 2.3 BARU) dan [`docs/superpowers/specs/2026-05-24-permission-matrix-design.md`](../superpowers/specs/2026-05-24-permission-matrix-design.md) untuk detail permission per role per aksi.
- Alasan perubahan: Pre-REV 2.3, dokumentasi menyebut waiter "bisa input order sama seperti kasir" - namun realita lapangan (waiter sibuk peak hour dengan tugas fisik) bikin co-equal access tidak realistis. REV 2.3 clarify primary kasir, waiter fallback only. Login fix sekaligus tutup inconsistency antara USE-CASE.md REV 2.2 (yang masih sebut list picker) dengan ACTIVITY.md A.1 REV 2.2 (yang sudah form input murni).

## 12. Referensi Konvensi

- **ADSI Bab 5** - Modul Pembelajaran ADSI (`docs/extracted/adsi.txt`)
- Skill: `.claude/skills/use-case-diagram/SKILL.md`
- Pattern dari 3 skripsi POS UK Petra (resto X cross-channel, supermarket ABC-VED, toko inventory)
- Ground truth (REV 2.3): [`docs/operasional-resto.md`](../operasional-resto.md)
- Design spec permission matrix (REV 2.3): [`docs/superpowers/specs/2026-05-24-permission-matrix-design.md`](../superpowers/specs/2026-05-24-permission-matrix-design.md)
- ERD pasangan (REV 2.3): [`docs/knowledge/ERD.md`](./ERD.md) - no schema change, hanya bump version
- Activity diagram pasangan (REV 2.3): [`docs/knowledge/ACTIVITY.md`](./ACTIVITY.md)
