# Use Case Diagram - Sistem POS Ayam Bakar Banjar Monosuko (REV 2.13)

> **Status:** REV 2.13 (2026-06-02) - diselaraskan ke kode nyata (`backend/prisma/schema.prisma` + modul backend/frontend). Daftar use case jadi **23 bubble** (21 UC dasar + 2 «extend»). Perubahan utama vs REV 2.11: **split bill → split tender** (1 transaksi multi-metode bayar via `transaction_payments`; tidak ada `party_id`), **payment method jadi master table** owner-configurable (bukan enum), settlement jadi **whole business day** (penyetor = kasir penutup shift terakhir / owner, bukan "kasir malam only"), shift business-day window owner-configurable (REV 2.7), PB1 owner-configurable 2-sumbu (REV 2.12, DEFAULT OFF), tambah UC konfigurasi owner (`Kelola Metode Pembayaran dan Bank`, `Mengatur Pengaturan Aplikasi`) + `Memantau Status Meja`. Lihat [`docs/superpowers/specs/2026-05-30-cogs-per-menu-remove-belanja-design.md`](../superpowers/specs/2026-05-30-cogs-per-menu-remove-belanja-design.md).
> **Sumber alur bisnis:** [`docs/operasional-resto.md`](../operasional-resto.md) (sumber kebenaran tertinggi)
> **Sumber struktur data:** [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma) (23 entitas, ~39 FK, 11 enum)
> **Design spec turunan:** [`docs/superpowers/specs/2026-05-24-permission-matrix-design.md`](../superpowers/specs/2026-05-24-permission-matrix-design.md)
> **Visual:** ERD (Mermaid erDiagram 23 entitas) + Use Case (23 bubble) + 11 activity diagram REV 2.13 sudah di-rebuild di `Skripsi.mdj` (1 sisa "Login lama" di-flag HAPUS MANUAL).

> ⚠️ **Penyempurnaan REV 2.11 → REV 2.13 (selaras kode):**
> 1. **Split bill DIHAPUS** dari sistem. Kolom `transaction_items.party_id` sudah di-drop. Skenario "bayar terpisah" kini ditangani **split tender** (1 transaksi dibayar dengan beberapa metode/slice via tabel `transaction_payments`).
> 2. **Payment method = master table** (`payment_methods`) owner-configurable, bukan enum hardcoded. Transaksi TIDAK punya kolom `payment_method`/`payment_bank`; pembayaran disimpan di `transaction_payments`, bank via junction `payment_method_banks`.
> 3. **Settlement = whole business day** (`@@unique(date)`) dengan child `settlement_method_counts` dinamis per metode. Penyetor = kasir penutup shift terakhir hari itu / owner (bukan "kasir malam only"). 12 kolom `system_*`/`actual_*` lama sudah di-drop.
> 4. **Shift business-day** (REV 2.7): window jam shift owner-configurable; guard single-OPEN via `shifts.active_marker`; atribusi revenue re-stamp `shift_id` saat bayar; `Tutup Kasir` 2-mode (final/handover) dan **dipisah** dari `Setoran Akhir Hari`.
> 5. **PB1 owner-configurable 2-sumbu** (REV 2.12): `tax_enabled` + `tax_rate` + `tax_charged_to_customer`, DEFAULT OFF di resto ini. Jika ditanggung resto → `tax_borne_amount` (tidak masuk total pelanggan, dikurangkan ke laba).
> 6. **UC baru**: `Kelola Metode Pembayaran dan Bank` (owner), `Mengatur Pengaturan Aplikasi` (owner), `Memantau Status Meja` (semua role). UC lama `Memecah Tagihan (Split Bill)` diganti `Memproses Pembayaran [Split Tender]`.

---

## 1. Apa itu Use Case Diagram?

> *"Use case diagram adalah diagram yang menunjukkan kebutuhan pengguna terhadap sistem yang akan dibangun. Secara sederhana, dengan membaca use case diagram, dapat diketahui fitur apa yang disediakan dalam sistem tertentu."* - Modul Pembelajaran ADSI Bab 5

Use Case Diagram adalah diagram UML pada **tahap analisis** untuk mendokumentasikan **Functional Requirements (FR)** - fungsi yang harus disediakan sistem dari sudut pandang pengguna. Diagram menghubungkan **siapa** (actor) dengan **apa yang bisa dilakukan** (use case), tanpa membahas *bagaimana* sistem melakukannya.

## 2. Kegunaan untuk Skripsi

1. **Validasi scope fitur** dengan dosen pembimbing dan pemilik restoran.
2. **Dasar perancangan activity diagram** - setiap UC critical dipecah alurnya.
3. **Batas sistem** - memperjelas apa yang masuk scope (dalam boundary) dan tidak (mis. proses masak di dapur = out of scope, perhitungan HPP/Bill of Materials = out of scope, pengelolaan bahan baku mentah/belanja/vendor = out of scope sejak REV 2.11).

## 3. Elemen Use Case Diagram

| Simbol | Nama | Fungsi |
|---|---|---|
| 🯅 stick figure | **Actor** | Role yang berinteraksi dari luar. Kata benda. |
| ⬭ oval | **Use Case** | Fitur. Kata kerja + objek. |
| ─── | **Association** | Actor ↔ UC |
| ▭ rectangle | **System Boundary** | Batas sistem |
| `<<include>>` | **Include** | Wajib: base UC pasti jalankan included UC |
| `<<extend>>` | **Extend** | Opsional: extending UC jalan jika kondisi tertentu |

## 4. Tiga Actor (REV 2.13)

| Actor | Role di sistem | Tugas utama |
|---|---|---|
| **Owner** | Pemilik restoran (akses penuh + tagihan + master data + modal/COGS + konfigurasi sistem) | CRUD menu/user, set & ubah modal/COGS menu (+ lihat riwayat modal), input tagihan bulanan, review settlement, lihat dashboard & laporan laba rugi, kelola metode pembayaran & bank, atur pengaturan aplikasi (PB1, identitas resto, window shift, parameter stok). Owner juga boleh melakukan semua aksi operasional (input order, bayar, void, shift). |
| **Kasir** | Operator POS shift (Jason, Bryant, Chen Hong). | Buka kasir (kasir-only), input/kelola pesanan, proses pembayaran (split tender + bank picker untuk metode requiresBank), void bebas (tanpa approval), gabungkan pesanan/meja, tutup kasir, setoran akhir hari, restock pagi, barang masuk darurat, opname stok porsi, pantau status meja. |
| **Waiter** | Pelayan + helper (Amel, Yanti). **Input order ke POS dengan kasir (via HP).** | Ambil order ke meja dan input langsung ke POS, antar makanan, buat & antar minuman, cuci piring, restock pagi, opname stok porsi, mark item habis, pantau status meja. **Waiter TIDAK boleh: memproses pembayaran, void, merge, buka/tutup kasir, settlement.** Menuliskan order di kertas lalu menyerahkannya ke kasir merupakan cara alternatif opsional. |

Catatan: Role `Kitchen` (REV 1) **dihapus** karena masak dilakukan di rumah owner, di luar lingkup sistem. Pegawai Lisa (masak only) tidak punya akun sistem. Permission matrix lengkap per role per aksi ada di [`docs/operasional-resto.md`](../operasional-resto.md) seksi "Permission Matrix" dan [`docs/superpowers/specs/2026-05-24-permission-matrix-design.md`](../superpowers/specs/2026-05-24-permission-matrix-design.md).

**Permission nyata (dari kode backend):**
- **Semua 3 role (waiter ):** input/kelola pesanan, manajemen stok porsi (restock/barang masuk/opname/mark habis), pantau status meja, lihat dashboard role masing-masing.
- **Owner + kasir:** memproses pembayaran (split tender), membatalkan pesanan (void), menggabungkan/melepas merge bill, tutup kasir, setoran akhir hari.
- **Kasir-only:** buka kasir.
- **Owner-only:** mereview settlement, kelola menu, kelola modal/COGS menu, kelola pengguna, mencatat tagihan bulanan, kelola metode pembayaran & bank, mengatur pengaturan aplikasi.

## 5. Dua Puluh Satu Use Case Dasar + Dua «extend» (REV 2.13)

> Total **23 bubble** di diagram = 21 UC dasar + 2 UC yang dihubungkan via `<<extend>>` (`Memilih Varian/Paket`, `Mencetak Struk`).

### 5.1. Shared (1)

- **`Login`** (*cached-name UX*) - First login di device: form 2 field input nama + numpad PIN 6 digit, lalu submit. Setelah berhasil, nama disimpan di localStorage (`pos-auth.lastUserName`). Login berikutnya di device sama: tampilan PIN-only numpad dengan nama auto-fill dari cache; pegawai cukup ketik 6 digit, auto-submit. Tombol "Ganti Pengguna" reset cache dan balik ke form 2 field. Sistem lookup user by nama + verifikasi PIN match. PIN boleh duplikat antar pegawai karena identifikasi via kombinasi nama + PIN. **Tidak ada layar pilih dari daftar seluruh pegawai** - cache cuma simpan 1 nama terakhir per device. Lihat ACTIVITY.md A.1 untuk diagram alur.

### 5.2. Operasional - shared kasir + waiter (+ owner) (6)

- **`Mengelola Pesanan`** *(semua role; kasir + waiter )* - waiter atau kasir mencatat pesanan ke POS via HP; alternatif waiter menuliskan di kertas lalu diserahkan ke kasir untuk diinput (opsional). Pilih tipe order:
  - **dineIn**: pilih meja (1 dari 9 meja, 2 kapasitas 6 + 7 kapasitas 4)
  - **takeaway**: tanpa meja (walk-in, GoFood/GrabFood merchant app, atau gosend teman owner - dibedakan via metode pembayaran di tahap pembayaran)
  Tambah/edit item (+ notes per item, mis. "Panas"/"Dingin", "kurang manis"). Customer bisa nambah pesanan kapan saja (multi-round per sesi meja sebelum bill). Saat order, sistem auto-decrement stok porsi terkait dan menyimpan snapshot modal (`transaction_items.unit_cost`). Order otomatis ditautkan ke shift aktif (auto-resolve).
- **`Memilih Varian/Paket`** *(semua role; «extend» Mengelola Pesanan)* - saat item yang ditambah berupa menu **variant** (mis. Teh: Tawar/Manis × suhu) atau **paket** (komponen fixed + slot choice), modal pilihan muncul untuk memilih kombinasi varian / komponen paket. Stok porsi yang berkurang menyesuaikan pilihan (mis. paket pilih Paha Goreng → Ayam Paha Goreng -1). Bubble ini terhubung ke `Mengelola Pesanan` lewat `<<extend>>`.
- **`Memproses Pembayaran [Split Tender]`** *(owner + kasir; waiter TIDAK boleh)* - bayar 1 transaksi dengan **satu atau beberapa slice metode** (split tender), mis. cash 100rb + QRIS 65rb. Metode diambil dari master `payment_methods` (owner-configurable, dinamis - bukan enum). Metode yang `requiresBank=true` (mis. EDC, transfer) memunculkan **picker bank** dari junction `payment_method_banks` (closed list) - wajib karena owner perlu laporan per bank untuk rekonsiliasi mutasi rekening. Filter metode mengikuti `allowDineIn`/`allowTakeaway`. Jika PB1 aktif (`app_settings.tax_enabled`), pajak dihitung otomatis; jika ditanggung resto (`tax_charged_to_customer=false`) pajak masuk `tax_borne_amount` (tidak ditambah ke total pelanggan). Sum(slice.amount) harus = total saat status=paid. Diskon manual opsional.
- **`Menggabungkan Pesanan/Meja`** *(owner + kasir)* - 2+ transaksi meja open digabung jadi 1 saat bayar (rombongan duduk di beberapa meja minta bayar bareng). Sistem menandai transaksi sumber dengan FK `merged_into_id` menunjuk ke parent; pointer ini TIDAK memindahkan `shift_id`, dan semua query revenue/settlement meng-exclude baris ber-`merged_into_id` agar tidak double-count. Aksi melepas merge (unmerge) juga owner+kasir.
- **`Membatalkan Pesanan`** *(owner + kasir)* - void transaksi, **tanpa approval owner** (kasir bebas). Void me-reverse stok porsi (`portion_movements` reason=`refund_void`). Void diblok setelah hari di-settle (refund out-of-scope).
- **`Memantau Status Meja`** *(semua role)* - lihat grid 9 meja dengan status open/kosong berdasarkan transaksi open hari ini; pintu masuk cepat untuk menambah/menutup pesanan per meja.

### 5.3. Shift & Setoran (4)

- **`Buka Kasir`** *(kasir-only)* - pilih ShiftType (pagi/malam) + input modal awal laci kas. Boleh buka hanya jika belum lewat jam-akhir window (`app_settings.shift_pagi_start`/`shift_changeover`/`shift_malam_end`, timezone owner-configurable). Guard **single-OPEN sistem-wide** via `shifts.active_marker` (UNIQUE) - tidak boleh ada dua shift terbuka sekaligus. Mendukung serah-terima (handover) antar kasir dalam window.
- **`Tutup Kasir`** *(owner + kasir)* - tutup shift dengan 2 mode: **final** (blok jika masih ada transaksi open → 409 dengan daftar per-meja) atau **handover** (carry transaksi open ke kasir berikut). Tutup kasir kini **dipisah** dari setoran akhir hari (dulu tergabung).
- **`Setoran Akhir Hari`** *(owner + kasir)* - settlement **whole business day** (`settlements` keyed `@@unique(date)`). Blind count per metode (input fisik), sistem hitung total per metode dinamis dari `transaction_payments` (groupBy method, + breakdown bank untuk metode requiresBank), variance per metode dihitung otomatis, baseline float = Σ openingCash semua shift hari itu. Penyetor = **kasir penutup shift terakhir hari itu / owner** (cek "kasir malam only" sudah dihapus). Disimpan ke child `settlement_method_counts` (counted vs system per baris).
- **`Mereview Settlement`** *(owner-only)* - tandai settlement sebagai `reviewed` (audit step).

### 5.4. Stok Porsi - semua role (4)

- **`Restock Stok Porsi`** *(semua role)* - input restock pagi setelah stok dibawa dari rumah ke resto. Kelipatan parametrik (`app_settings.restock_multiple`, default 5) dengan formula `roundup((min−current)/n)*n`. Sistem catat di `portion_movements` reason=`restock_morning` (+ qty_before/qty_after).
- **`Mencatat Barang Masuk`** *(semua role)* - input restock darurat tengah hari (owner kirim dari rumah via Gojek/Grab/antar sendiri saat stok habis). Stok porsi minus kembali positif. Sistem catat di `portion_movements` reason=`restock_emergency`.
- **`Opname Stok Porsi`** *(semua role)* - cek fisik & koreksi `current_qty` kalau menyimpang dari realita (analog rekonsiliasi cash). Paling pas dilakukan pagi setelah restock pagi dicatat. Sistem catat selisih di `portion_movements` reason=`manual_adjust`.
- **`Menandai Item Habis`** *(semua role)* - shortcut tandai stok porsi habis (set `current_qty` ke 0 / non-positif) tanpa hitung manual; idempotent.

### 5.5. Administrasi owner (5)

- **`Mengelola Menu`** *(owner-only)* - CRUD katalog menu termasuk `kind` (simple/variant/paket), `stockType` (portion/linked/nonStock), `minStock`, `posVisible`, serta konfigurasi varian (option groups → MenuVariant + stock target) dan komposisi paket (PaketComponent fixed/choice + PaketChoiceOption).
- **`Kelola Modal/COGS Menu`** *(owner-only)* - set & ubah modal/COGS per menu (`menus.cost`, di SKU leaf + menu simple/varian via `cost_source_menu_id`), dan lihat **riwayat perubahan modal** per menu via `GET /menus/:id/cost-history` (log `menu_cost_movements`, reason initialSet/manualEdit). Modal dipakai untuk Laporan Laba Rugi Harian (Laba Kotor = Pendapatan − COGS − PB1-borne). Modal **tidak dibocorkan** ke katalog publik (GET menu POS) - hanya owner yang melihatnya.
- **`Mengelola Pengguna`** *(owner-only)* - CRUD user, set role (owner/cashier/waiter). PIN boleh duplikat. Owner yang bertanggung jawab memberikan akun & PIN ke anggota keluarga yang bertugas sebagai kasir/waiter.
- **`Mencatat Tagihan Bulanan`** *(owner-only)* - input tagihan operasional (kebersihan, listrik, air, parkir, sewa) per bulan. Kasir tidak punya akses meskipun anggota keluarga.
- **`Melihat Dashboard dan Laporan`** *(owner; varian dashboard per role)* - dashboard realtime per role: owner (revenue per metode + breakdown bank, COGS, **laba kotor = pendapatan − COGS − PB1-borne**, tagihan ditampilkan **terpisah** dan TIDAK dikurangkan ke laba kotor, reminder stok, analitik menu/trend/staff) + laporan periodic. Kasir & waiter melihat dashboard ringkas sesuai role.

### 5.6. Konfigurasi owner (2)

- **`Kelola Metode Pembayaran dan Bank`** *(owner-only)* - CRUD master `payment_methods` (code/label/warna/ikon/`requiresBank`/`allowDineIn`/`allowTakeaway`/displayOrder/isActive) + master `banks` + assign/unassign bank ke metode (junction `payment_method_banks`) + reorder. Metode bersifat extensible (mis. tambah ShopeePay) tanpa ubah skema. Penghapusan pakai soft-delete (`isActive=false`) agar audit settlement aman.
- **`Mengatur Pengaturan Aplikasi`** *(owner-only)* - atur `app_settings` (singleton id=1): PB1 (`tax_enabled`/`tax_rate`/`tax_charged_to_customer`), identitas resto (nama/alamat/jam buka/telepon/logo untuk struk & branding), parameter stok (`restock_multiple`/`low_stock_threshold`), dan window shift (`timezone`/`shift_pagi_start`/`shift_changeover`/`shift_malam_end`).

## 6. Dependencies (REV 2.13)

### 6.1. `<<include>>` (20x)

Semua UC operasional **wajib login** dulu. Pola umum: panah `<<include>>` dari setiap UC ke `Login`. Total **20 include** (21 UC dasar minus `Login` sendiri = 20 UC ber-include ke `Login`).

### 6.2. `<<extend>>` (2x)

| Extending UC | Base UC | Kondisi |
|---|---|---|
| `Memilih Varian/Paket` | `Mengelola Pesanan` | Jika item yang ditambah adalah menu varian atau paket |
| `Mencetak Struk` | `Memproses Pembayaran [Split Tender]` | Jika pelanggan minta struk (bisa skip kalau pelanggan tidak butuh) |

`Mencetak Struk` *(owner + kasir, mengikuti pemroses pembayaran)* - generate PDF kuitansi pembayaran (struk thermal 58mm via jsPDF), save ke device kasir. **Catatan**: tidak ada cetak struk pesanan untuk dapur (dapur di rumah owner, komunikasi verbal/kertas).

### 6.3. Generalization (opsional)

Karena banyak UC shared antara Kasir & Waiter (Pesanan, Varian/Paket, Restock, Barang Masuk, Opname, Mark Habis, Status Meja), bisa dipertimbangkan generalization. Optional - untuk skripsi, association langsung ke masing-masing UC lebih clear dan tidak menimbulkan ambiguitas inheritance.

## 7. Mengapa Diagram Ini Menjawab Masalah Skripsi

| Rumusan Masalah (Bab 1.2) | Use Case yang menjawab |
|---|---|
| A. Percepat durasi transaksi | `Mengelola Pesanan` (2 tipe sederhana) + `Memilih Varian/Paket` + `Memproses Pembayaran [Split Tender]` (bank picker dari master, split tender) + `Memantau Status Meja` |
| B. Percepat rekonsiliasi + kurangi mismatch | `Setoran Akhir Hari` (blind count per metode dinamis + breakdown per bank, variance per metode dihitung otomatis, whole business day) + `Tutup Kasir` |
| C. Manajemen stok harian + restock darurat | `Restock Stok Porsi` + `Mencatat Barang Masuk` + `Opname Stok Porsi` + `Menandai Item Habis` |
| #4 Owner tidak tahu laba & pengeluaran | `Kelola Modal/COGS Menu` + `Mencatat Tagihan Bulanan` + `Melihat Dashboard dan Laporan` (laba kotor = pendapatan − COGS − PB1-borne, tagihan terpisah) |

## 8. Narasi untuk Bab 3 Skripsi (paste-ready, REV 2.13)

> ⚠️ **Catatan REV 2.13:** narasi ini sudah diselaraskan ke kode nyata (split tender, master payment method, settlement whole-business-day, shift window owner-configurable, PB1 2-sumbu, COGS), tetapi sebaiknya **di-review thesis-level oleh Ezra** untuk kehalusan kalimat naskah final dan penomoran Gambar/Tabel.
>
> **3.4.1 Use Case Diagram**
>
> Use case diagram pada Gambar 3.X mendeskripsikan interaksi antara pengguna dengan Sistem POS Restoran Ayam Bakar Banjar Monosuko yang akan dibangun. Sistem melibatkan tiga aktor: **Owner** sebagai pemilik restoran dengan akses penuh terhadap master data, modal/COGS menu, tagihan operasional, konfigurasi sistem (metode pembayaran, bank, dan pengaturan aplikasi), serta laporan dari mana saja melalui perangkat mobile; **Kasir** sebagai operator POS yang menangani transaksi harian (input order, proses pembayaran, penutupan shift, dan setoran akhir hari) serta pengelolaan stok porsi; serta **Waiter** sebagai pelayan yang mengambil order pelanggan, mengantar makanan dan minuman, mencuci piring, dan melakukan pengelolaan stok porsi. Waiter diberi akun sistem dengan akses input order ke POS **dengan kasir** (lewat HP) serta fitur stok porsi (restock, opname, mark habis, pantau meja), namun **tidak berwenang** memproses pembayaran, membatalkan pesanan, menggabungkan tagihan, maupun membuka/menutup kasir dan setoran. Pencatatan order dapat dilakukan langsung oleh waiter maupun kasir via HP; menuliskan order di kertas lalu menyerahkannya ke kasir merupakan cara alternatif yang opsional, bukan keharusan.
>
> Sistem menyediakan dua puluh satu use case dasar yang terbagi dalam beberapa domain fungsional: (1) **autentikasi** melalui use case `Login` yang wajib dilakukan oleh semua aktor dengan form dua field input nama pengguna dan PIN enam digit (login berikutnya pada perangkat yang sama menampilkan numpad PIN dengan nama tersimpan) - PIN boleh duplikat antar pegawai karena identifikasi dilakukan via kombinasi nama dan PIN; (2) **operasional transaksi** meliputi `Mengelola Pesanan` untuk dua tipe order (dine-in wajib pilih meja, takeaway tanpa meja - sumber order takeaway seperti walk-in, GoFood, GrabFood, atau gosend teman owner dibedakan dari metode pembayaran) yang dapat diinput oleh kasir maupun waiter via HP secara , `Memilih Varian/Paket` sebagai perluasan untuk menu varian dan paket, `Memproses Pembayaran` (owner dan kasir) yang mendukung **split tender** (satu transaksi dibayar dengan beberapa metode/slice) dengan metode pembayaran yang owner-configurable dan picker bank untuk metode yang memerlukan rekonsiliasi per bank, `Menggabungkan Pesanan/Meja` untuk merge beberapa transaksi meja menjadi satu pembayaran, `Membatalkan Pesanan` tanpa perlu approval, serta `Memantau Status Meja`; (3) **shift dan setoran** meliputi `Buka Kasir` (kasir-only, sadar window jam shift yang dapat dikonfigurasi owner serta dijaga guard satu shift terbuka sekaligus), `Tutup Kasir` (mode final atau serah-terima), `Setoran Akhir Hari` yang dilakukan satu kali per hari kerja oleh kasir penutup shift terakhir atau owner dengan rekap dinamis per metode pembayaran beserta breakdown per bank dan perhitungan variance otomatis, serta `Mereview Settlement` oleh owner; (4) **manajemen stok** meliputi `Restock Stok Porsi` pagi dengan formula kelipatan parametrik, `Mencatat Barang Masuk` untuk restock darurat tengah hari, `Opname Stok Porsi` untuk koreksi nilai stok, dan `Menandai Item Habis`; (5) **administrasi dan konfigurasi** meliputi `Mengelola Menu`, `Kelola Modal/COGS Menu` untuk menetapkan dan mengubah modal per menu beserta riwayat perubahannya, `Mengelola Pengguna`, `Mencatat Tagihan Bulanan`, `Melihat Dashboard dan Laporan` dengan laporan laba rugi harian (laba kotor = pendapatan − COGS − PB1 yang ditanggung resto, sedangkan tagihan bulanan ditampilkan terpisah dan tidak dikurangkan ke laba kotor), `Kelola Metode Pembayaran dan Bank`, dan `Mengatur Pengaturan Aplikasi` (PB1, identitas resto, parameter stok, dan window jam shift). Use case `Memilih Varian/Paket` dan `Mencetak Struk` ditampilkan sebagai bubble extend sehingga keseluruhan diagram memuat dua puluh tiga bubble.
>
> Hubungan `<<include>>` ditunjukkan dari setiap use case ke `Login`, menandakan bahwa autentikasi merupakan prasyarat wajib (dua puluh include). Hubungan `<<extend>>` digunakan pada dua skenario opsional: `Memilih Varian/Paket` extends `Mengelola Pesanan` (modal pilihan muncul hanya jika item adalah menu varian atau paket) dan `Mencetak Struk` extends `Memproses Pembayaran` (struk PDF dicetak hanya jika pelanggan meminta). Skenario "bayar terpisah" tidak diwujudkan sebagai split bill per item, melainkan sebagai **split tender** (satu transaksi diselesaikan dengan beberapa slice pembayaran), sementara penggabungan tagihan antar-meja tetap tersedia melalui merge bill. Sistem secara sengaja membatasi inventori pada barang siap jual satuan porsi (tidak ada pengelolaan bahan baku mentah, vendor, maupun pencatatan belanja), sesuai ruang lingkup penelitian, dan PB1 dirancang dapat dikonfigurasi owner serta secara default tidak dibebankan ke pelanggan pada restoran ini.

## 9. Elemen Visual Diagram

Saat membaca diagram use case di `Skripsi.mdj` (REV 2.13 - 23 bubble), perhatikan:
- **Garis solid** actor ↔ UC = association
- **Garis putus-putus berlabel `<<include>>`** = dependency wajib (semua konvergen ke `Login`, 20 include)
- **Garis putus-putus berlabel `<<extend>>`** = dependency opsional (2 UC: `Memilih Varian/Paket`, `Mencetak Struk`)
- **Rectangle luar** berlabel `Sistem POS Restoran Ayam Bakar Banjar Monosuko` = system boundary
- 3 actor di luar boundary: Owner (kanan), Kasir (kiri atas), Waiter (kiri bawah)

## 10. Bad Practice yang Dihindari

- ❌ Over-split UC dashboard (misal 5 UC terpisah) → konsolidasi jadi 1 UC `Melihat Dashboard dan Laporan`.
- ❌ UC berupa UI click (`Klik Tombol Submit`) atau technical primitive (`Validate Input`) → pakai business goal.
- ❌ Actor-to-actor line langsung → pakai shared UC atau generalization.
- ❌ UC tanpa association ke actor manapun (orphan) → setiap UC minimal 1 aktor.
- ❌ Menyertakan UC yang tidak ada di operasional riil (mis. "Hitung HPP per Bahan / Bill of Materials" karena BoM out of scope - modal/COGS dinyatakan langsung per menu via `Kelola Modal/COGS Menu`, bukan dihitung dari konsumsi bahan).
- ❌ Over-engineering tipe order (5 enum padahal cukup 2).
- ❌ UC `Mencatat Pembelian`, `Melakukan Opname Raw Materials`, dan master data `Vendor`/`Raw Material` - subsistem belanja/raw-materials **dihapus** sejak REV 2.11 (inventori = finished-goods porsi saja). Jangan menambahkannya kembali.
- ❌ (REV 2.13) UC `Memecah Tagihan (Split Bill)` dan kolom `party_id` - **dihapus**. Skenario serupa diwujudkan sebagai **split tender** di dalam `Memproses Pembayaran [Split Tender]`. Jangan gambar split bill lagi.
- ❌ Memodelkan metode pembayaran sebagai enum tetap - metode adalah **master table owner-configurable** (`payment_methods`); cukup gambar UC `Kelola Metode Pembayaran dan Bank`.

## 11. Riwayat Versi (ringkas)

| Versi | Tanggal | Perubahan utama |
|---|---|---|
| REV 2.1 | 2026-05 | Tipe order 5→2; bank picker EDC/transfer; opname stok porsi + raw materials. **20 UC.** |
| REV 2.2 | 2026-05 | Audit log raw materials (`raw_material_movements`); rename `stock_movements`→`portion_movements`. **20 UC.** |
| REV 2.3 | 2026-05-24 | Permission matrix + login form 2 field; input order kasir & waiter (REV 2.4). **20 UC.** |
| REV 2.11 | 2026-05-30 | Drop `Mencatat Pembelian`/`Opname Raw Materials` (subsistem belanja/raw-materials dihapus); tambah `Kelola Modal/COGS Menu`. **19 UC.** |
| **REV 2.13** | **2026-06-02** | **Selaras kode nyata. Split bill → split tender (drop `party_id`); payment method jadi master table owner-configurable (bukan enum); settlement whole-business-day (penyetor = penutup shift terakhir/owner, bukan kasir-malam-only, drop 12 kolom fixed); shift business-day window owner-configurable + 2-mode close terpisah dari setoran; PB1 owner-configurable 2-sumbu (default OFF); tambah UC `Kelola Metode Pembayaran dan Bank`, `Mengatur Pengaturan Aplikasi`, `Memantau Status Meja`, `Menandai Item Habis`. Total 23 bubble = 21 UC dasar + 2 «extend» (`Memilih Varian/Paket`, `Mencetak Struk`).** |

## 12. Referensi Konvensi

- **ADSI Bab 5** - Modul Pembelajaran ADSI (`docs/extracted/adsi.txt`)
- Skill: `.claude/skills/use-case-diagram/SKILL.md`
- Pattern dari 3 skripsi POS UK Petra (resto X cross-channel, supermarket ABC-VED, toko inventory)
- Ground truth: [`docs/operasional-resto.md`](../operasional-resto.md)
- Struktur data otoritatif: [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma)
- Design spec permission matrix: [`docs/superpowers/specs/2026-05-24-permission-matrix-design.md`](../superpowers/specs/2026-05-24-permission-matrix-design.md)
- ERD pasangan: [`docs/knowledge/ERD.md`](./ERD.md)
- Activity diagram pasangan: [`docs/knowledge/ACTIVITY.md`](./ACTIVITY.md)
