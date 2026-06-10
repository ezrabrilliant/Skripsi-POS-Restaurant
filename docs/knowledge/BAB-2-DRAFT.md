# BAB 2 — METODOLOGI PROYEK (DRAFT)

> **Status:** draf paste-ready, mengikuti **Pedoman Program SIB** (Bab 2 = *tahapan proyek*, bukan alur program; wajib mencakup studi literatur + ulasan software sejenis) dan **dikalibrasi ke pola Bab 2 rekan seangkatan** (Satriya C14220311: tahapan granular + subbab Landasan Teori). Diselaraskan dengan sistem nyata **REV 2.11+** dan rencana pengujian 3-lapis (`docs/pengujian/`).
>
> ⚠️ **Perlu review thesis-level Ezra:** tata tulis (sitasi, penomoran gambar/tabel) mengacu pedoman Perpustakaan UK Petra. Tense memakai bentuk lampau/netral karena sistem sudah selesai dibangun.

---

# BAB 2 METODOLOGI PROYEK

Bab ini menjelaskan tahapan pelaksanaan proyek pembuatan sistem *Point of Sale* (POS) Restoran X, dari pengumpulan landasan dan kebutuhan hingga sistem siap diuji. Pembahasan difokuskan pada **bagaimana proyek dikerjakan** (tahapan proyek), bukan alur kerja program yang dijelaskan pada Bab 3. Proyek dilaksanakan secara bertahap dengan penyempurnaan iteratif dan validasi berkala kepada pemilik restoran. Tahapan proyek terdiri atas studi literatur, pengumpulan data, analisis kebutuhan, perancangan sistem, pengembangan sistem, pengujian sistem, dan pembuatan laporan. Landasan teori yang mendukung diuraikan pada subbab terakhir.

## 2.1 Studi Literatur

Studi literatur dilakukan untuk membangun landasan dan wawasan terhadap solusi sejenis, mencakup dua bagian.

**Kajian penelitian terdahulu.** Dikaji penelitian implementasi POS berbasis web pada usaha kuliner: sistem POS pada Olive Cafe terbukti membantu pencatatan pesanan, perhitungan pembayaran, dan pelaporan yang lebih tertib dibanding manual (Alexander, 2021); sistem e-kasir Cafe Unico mampu mempercepat transaksi dan menghasilkan laporan otomatis (Rozi dkk., 2024). Dikaji pula penelitian pengukuran efisiensi waktu transaksi sistem dibanding manual (Permana & Sarif, 2025; Ardiansyah dkk., 2023) sebagai acuan metode pengujian efisiensi.

**Ulasan perangkat lunak sejenis.** Ditinjau dua POS yang umum di Indonesia, **Moka POS** dan **iReap POS**, yang menyediakan pencatatan transaksi, manajemen produk, dan pelaporan berbasis cloud. Namun keduanya bersifat umum dan belum menjawab kebutuhan spesifik Restoran X, yaitu inventori berbasis porsi siap jual, rekonsiliasi *blind count* per metode dan per bank, modal/COGS per menu, serta kebutuhan *mobile-first* (restoran tidak memiliki komputer dan jaringan sendiri). Keterbatasan ini menjadi dasar pengembangan sistem yang disesuaikan.

## 2.2 Pengumpulan Data

Data dikumpulkan melalui wawancara dengan pemilik restoran serta penelusuran dokumen operasional. Data yang diperoleh meliputi: (a) alur proses bisnis berjalan dan kendalanya dari hasil wawancara; (b) katalog menu beserta harga; dan (c) **catatan operasional historis** berupa buku penjualan dan stok harian. Catatan historis ini juga dipakai sebagai data acuan kondisi "sebelum sistem" pada tahap pengujian.

## 2.3 Analisis Kebutuhan

Hasil pengumpulan data dianalisis untuk memetakan permasalahan proses berjalan (*as-is*) dan menurunkannya menjadi **kebutuhan fungsional dan non-fungsional**. Kebutuhan fungsional dirumuskan per peran pengguna (pemilik, kasir, waiter), mencakup autentikasi, manajemen menu dan modal, manajemen stok porsi, pemesanan, pembayaran dan rekonsiliasi shift, serta pelaporan. Kebutuhan non-fungsional mencakup kemudahan penggunaan (*mobile-first*), aksesibilitas lintas perangkat, dan keamanan akses berbasis peran. Rincian disajikan pada Bab 3.

## 2.4 Perancangan Sistem

Perancangan menghasilkan cetak biru sistem menggunakan **StarUML**: *use case diagram* (interaksi aktor–sistem), *activity diagram* (alur tiap proses bisnis), dan *Entity Relationship Diagram* (struktur data). Dirancang pula proses bisnis usulan (*to-be*), gambaran antarmuka (*UI mockup*) bergaya *mobile-first*, serta **pembagian hak akses per peran** sebagai dasar kewenangan tiap fitur.

## 2.5 Pengembangan Sistem

Sistem dibangun sebagai aplikasi web *client–server* dengan teknologi:

- **Backend:** Node.js + Express (TypeScript), ORM Prisma.
- **Frontend:** React (TypeScript) + Vite + Tailwind CSS, dikemas sebagai *Progressive Web App* (PWA).
- **Basis data:** MySQL.
- **Deployment:** VPS Ubuntu pada Tencent Cloud, dengan Cloudflare sebagai *proxy*/CDN dan SSL (Let's Encrypt).

Pengembangan dilakukan **modular dan iteratif** — dimulai dari autentikasi dan data master, lalu manajemen stok porsi, operasional POS (pemesanan dan pembayaran), rekonsiliasi shift, hingga pelaporan dan dashboard. Tiap modul yang selesai divalidasi terhadap kebutuhan dan ditinjau bersama pemilik sebelum modul berikutnya dikerjakan.

## 2.6 Pengujian Sistem

Pengujian membuktikan sistem memenuhi kebutuhan proses bisnis dan kebutuhan informasi, sekaligus menjawab rumusan masalah, melalui **tiga lapisan**:

1. **User Acceptance Testing (UAT)** — pengujian fungsional berbasis skenario (*black-box*, teknik *Equivalence Partitioning* dan *Boundary Value Analysis*) yang melibatkan pemilik, kasir, dan waiter untuk membuktikan tiap fitur berjalan sesuai kebutuhan.
2. **System Usability Scale (SUS)** — kuesioner baku sepuluh pernyataan untuk mengukur tingkat kemudahan penggunaan, dihitung menjadi skor 0–100.
3. **Pengukuran perbandingan efisiensi dan akurasi (*sebelum* vs *sesudah*)** — membandingkan durasi transaksi, waktu rekonsiliasi, serta insiden ketidaksesuaian stok dan biaya pengiriman darurat, untuk menjawab rumusan masalah yang bersifat kuantitatif-komparatif.

UAT membuktikan sistem *berfungsi* dan SUS membuktikan sistem *mudah dipakai*, sementara pembuktian klaim *lebih cepat* dan *lebih sedikit ketidaksesuaian* memerlukan lapisan pengukuran perbandingan tersendiri. Rincian instrumen dan prosedur dibahas pada Bab 4.

## 2.7 Pembuatan Laporan

Tahap akhir adalah penyusunan laporan yang memuat seluruh proses penelitian, hasil pengujian (UAT, SUS, dan pengukuran perbandingan), serta interpretasi temuan. Berdasarkan hasil tersebut ditarik kesimpulan yang menjawab rumusan masalah dan disusun saran untuk pengembangan lanjutan.

## 2.8 Landasan Teori

Landasan teori berikut menguraikan konsep dan teknologi yang menjadi dasar pembangunan sistem, mengikuti cakupan pada proposal dengan penyesuaian terhadap arsitektur akhir yang diimplementasikan.

### 2.8.1 Sistem Informasi Kasir (Point of Sale) pada Restoran

Sistem kasir (*Point of Sale*, POS) pada restoran berfungsi mencatat transaksi penjualan, menghitung tagihan, mengelola metode pembayaran, dan menyusun laporan penjualan, sekaligus menjadi penghubung informasi antara waiter, kasir, dan pemilik. Penelitian pada usaha kuliner menunjukkan POS terkomputerisasi mampu mengurangi kesalahan pencatatan dan mempercepat pembayaran dibanding pencatatan manual berbasis buku (Hidayati dkk., 2023; Andarwati dkk., 2020). POS modern juga dituntut memiliki fleksibilitas operasional, seperti pembayaran kombinasi beberapa metode (*split-tender*) dan penggabungan tagihan antar meja (*merge bill*), untuk mengakomodasi preferensi pembayaran pelanggan tanpa mengganggu alur kerja kasir (Widiyanti & Tisnawati, 2024).

### 2.8.2 Progressive Web App (PWA) dan Arsitektur Web yang Dioptimalkan untuk Ponsel

*Progressive Web App* (PWA) adalah aplikasi web yang berjalan di peramban ponsel namun berperilaku menyerupai aplikasi natif: responsif, dapat dipasang, dan tetap berfungsi dasar saat jaringan lemah melalui mekanisme *cache* dan *service worker* (Fauzan dkk., 2022). Antarmuka dibangun dengan pustaka React agar interaksi responsif dan dinamis. Pendekatan ini sesuai untuk restoran skala kecil karena tidak membutuhkan perangkat POS khusus dan memudahkan penerapan konsep *Bring Your Own Device* (BYOD), mengingat restoran tidak memiliki komputer maupun jaringan sendiri.

### 2.8.3 Node.js dan Express sebagai Platform Backend

Node.js adalah lingkungan *runtime* JavaScript di sisi server yang bersifat *open-source* dan lintas platform, dengan arsitektur *asynchronous event-driven* dan *non-blocking I/O* sehingga efisien menangani banyak permintaan secara bersamaan. Node.js dipadukan dengan *framework* Express yang menyediakan *routing* HTTP dan *middleware* sehingga pembuatan layanan RESTful API menjadi terstruktur. Pada penelitian ini, Node.js + Express berperan sebagai *backend* yang menerima permintaan dari aplikasi React serta mengelola logika bisnis (pencatatan pesanan, sinkronisasi stok, perhitungan tagihan, dan rekonsiliasi).

### 2.8.4 Basis Data Relasional (MySQL) dan ORM Prisma

Basis data relasional (RDBMS) digunakan untuk menyimpan data secara terstruktur dengan dukungan transaksi yang konsisten (ACID), penting untuk menjaga integritas data penjualan dan stok. Penelitian ini menggunakan **MySQL** sebagai RDBMS dan **Prisma** sebagai *Object-Relational Mapping* (ORM) yang memetakan skema basis data ke tipe data TypeScript, sehingga kueri dan migrasi skema menjadi lebih aman dan terstruktur. *(Catatan: arsitektur ini menggantikan rencana awal pada proposal yang menggunakan Supabase/PostgreSQL; pembatasan akses tidak lagi memakai Row-Level Security melainkan ditangani di lapisan aplikasi — lihat 2.8.5.)*

### 2.8.5 Role-Based Access Control (RBAC) dan Autentikasi

*Role-Based Access Control* (RBAC) membatasi fungsi yang dapat diakses pengguna sesuai peran (Sandhu dkk., 1996): waiter mencatat pesanan dan stok, kasir memproses pembayaran serta membuka/menutup shift, sementara pemilik mengelola data master dan laporan. Pada sistem ini, RBAC diterapkan di **lapisan aplikasi** melalui *middleware* otorisasi pada *backend* dan penyesuaian antarmuka pada *frontend*, dipadukan dengan autentikasi berbasis token (JWT) untuk memastikan hanya pengguna berwenang yang dapat menjalankan fungsi tertentu.

### 2.8.6 Pengendalian Internal Kas dan Rekonsiliasi Pendapatan

Pengendalian internal (*internal control*) pada operasional kasir bertujuan menjaga aset dan memastikan akurasi data akuntansi (Kieso dkk., 2018). Salah satu prosedur utamanya adalah rekonsiliasi harian, yaitu membandingkan beberapa set catatan untuk memastikan kesesuaian: total penjualan tercatat di sistem POS, uang fisik di laci kasir, serta bukti penyelesaian (*settlement*) EDC/QRIS dan mutasi rekening bank. Sistem menerapkan prinsip ini melalui rekonsiliasi *blind count* per metode dan rincian per bank pada saat tutup kasir, sehingga selisih (*over/short*) dapat terdeteksi.

### 2.8.7 Harga Pokok Penjualan (COGS) dan Laba Kotor

*Cost of Goods Sold* (COGS) atau Harga Pokok Penjualan adalah biaya yang melekat langsung pada barang terjual, dan laba kotor merupakan selisih antara pendapatan penjualan dengan COGS (Kieso dkk., 2018). Konsep ini menjadi dasar Laporan Laba Rugi Harian pada sistem, di mana Laba Kotor = Pendapatan − COGS. Modal/COGS dinyatakan langsung per menu oleh pemilik (tanpa perhitungan berbasis bahan baku), dan tagihan operasional bulanan ditampilkan terpisah tanpa mengurangi laba kotor.

### 2.8.8 Manajemen Stok Barang Jadi (Finished Goods) dan Stock Opname

Berbeda dengan manajemen bahan baku mentah yang kompleks, restoran skala kecil sering lebih efektif memakai pendekatan stok barang jadi atau porsi siap jual (*daily stock*), yang berfokus pada pengendalian kuantitas produk akhir yang tersedia untuk dijual (Sutanto, 2022). Prinsip utamanya adalah *stock opname* harian: stok awal dikurangi jumlah porsi terjual seharusnya sama dengan sisa fisik; bila terjadi selisih, diidentifikasi sebagai kehilangan (*shrinkage*) atau pemakaian tak tercatat. Sistem menerapkan pengurangan stok otomatis saat transaksi, *opname* harian untuk koreksi selisih, serta peringatan stok rendah untuk mencegah kehabisan mendadak.

### 2.8.9 Metode Pengujian: User Acceptance Testing (UAT) dan System Usability Scale (SUS)

*User Acceptance Testing* (UAT) adalah pengujian oleh pengguna akhir untuk memastikan sistem berjalan sesuai kebutuhan bisnis sebelum dinyatakan layak, dengan acuan standar pengujian perangkat lunak ISO/IEC 29119; aspek penerimaan ini juga sejalan dengan *Technology Acceptance Model* (TAM) yang menekankan persepsi kemudahan dan kemanfaatan sistem (Andarwati dkk., 2020). *System Usability Scale* (SUS) adalah instrumen baku pengukuran kemudahan penggunaan berupa sepuluh pernyataan skala Likert 1–5 yang menghasilkan skor 0–100 (Brooke, 1996), dengan adaptasi Bahasa Indonesia yang telah teruji validitas dan reliabilitasnya (Sharfina & Santoso, 2016). Kedua metode ini menjadi dasar pengujian pada Bab 4.

---

## Catatan penyusunan (hapus saat final)

- **Struktur** mengikuti pola peer (Satriya): tahapan granular (2.1–2.7) + Landasan Teori sebagai subbab terakhir (2.8). Prosa diringkas agar prosedural.
- **Landasan Teori (2.8) mengikuti cakupan proposal (bagian 5)** — komprehensif & system-specific: POS, PWA/React, Node.js+Express, basis data, RBAC, pengendalian internal kas, stok finished-goods — **+ tambahan COGS/Laba Kotor (2.8.7)** yang baru ada di sistem final (REV 2.11) dan belum di proposal.
- ⚠️ **KOREKSI tech dari proposal:** proposal memakai **Supabase (PostgreSQL) + Row-Level Security**; sistem final memakai **MySQL + Prisma**, dengan RBAC di **lapisan aplikasi (middleware) + JWT**, BUKAN RLS. Bagian 2.8.4 & 2.8.5 sudah disesuaikan. Pastikan Daftar Pustaka **menghapus** referensi "Supabase (2025)" jika tidak lagi dipakai.
- **Selaras sistem nyata REV 2.11+:** 3 peran (owner/kasir/waiter, waiter input langsung), inventori porsi (tanpa bahan baku/pembelian), COGS per menu, split-tender + combine bill (bukan split per item), 6 metode bayar configurable, PB1 configurable, deploy Tencent Cloud + Cloudflare (**bukan Domainesia**), PWA.
- **Sitasi yang dipakai di 2.8** (semua sudah ada di Daftar Pustaka kecuali yang ditandai): Hidayati dkk. (2023), Andarwati dkk. (2020), Widiyanti & Tisnawati (2024), Fauzan dkk. (2022), Sandhu dkk. (1996), Kieso dkk. (2018), Sutanto (2022 — **verifikasi ada di Daftar Pustaka**), Brooke (1996 — **tambahkan**), Sharfina & Santoso (2016 — **tambahkan**).
- **Sitasi pengujian** (Bab 2.6 / Bab 4) yang perlu masuk Daftar Pustaka: Permana & Sarif (2025), Ardiansyah dkk. (2023) — format APA lengkap di `docs/pengujian/referensi-pengujian-terdahulu.md`.
- **Konsistensi wajib:** Bab 2.6 (3 lapis + waiter) harus sinkron dengan Ruang Lingkup 1.4 poin 7 dan Bab 4.
- **Catatan:** "Alur Operasional Restoran" (proposal 5.8, kondisi *as-is*) TIDAK dimasukkan ke Landasan Teori — tempatnya di Bab 3.1.1 Analisis Permasalahan (sesuai format buku).
