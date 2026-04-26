# Panduan Penulisan Bab 3 — Sistem POS Ayam Bakar Banjar Monosuko

Dokumen ini panduan lengkap untuk **menyelesaikan Bab 3 Analisis dan Perancangan Sistem** dari titik kamu sekarang (analisa permasalahan sudah selesai). Berisi: struktur sub-bab, mapping gambar/tabel ke sub-bab, narasi paste-ready, dan tips penulisan.

---

## A. Struktur Bab 3 yang Disarankan

```
BAB 3 ANALISIS DAN PERANCANGAN SISTEM
├── 3.1 Analisis Permasalahan ............................ ✅ sudah selesai
├── 3.2 Analisis Kebutuhan Sistem
│   ├── 3.2.1 Kebutuhan Fungsional
│   └── 3.2.2 Kebutuhan Non-Fungsional
├── 3.3 Perancangan Arsitektur Sistem (Blok Diagram) ..... Gambar 3.1
├── 3.4 Perancangan Sistem (UML)
│   ├── 3.4.1 Use Case Diagram .......................... Gambar 3.2
│   ├── 3.4.2 Activity Diagram
│   │   ├── 3.4.2.1 Login ............................... Gambar 3.3
│   │   ├── 3.4.2.2 Order Flow .......................... Gambar 3.4
│   │   ├── 3.4.2.3 Pay Flow ............................ Gambar 3.5
│   │   ├── 3.4.2.4 Stock Opname Pagi ................... Gambar 3.6
│   │   ├── 3.4.2.5 Stock Opname Sore ................... Gambar 3.7
│   │   ├── 3.4.2.6 Tutup Kasir Blind Count ............. Gambar 3.8
│   │   └── 3.4.2.7 Mencatat Pengeluaran ................ Gambar 3.9
│   ├── 3.4.3 Sequence Diagram
│   │   ├── 3.4.3.1 Login ............................... Gambar 3.10
│   │   ├── 3.4.3.2 Pay Transaction ..................... Gambar 3.11
│   │   ├── 3.4.3.3 Input Stok Masuk .................... Gambar 3.12
│   │   ├── 3.4.3.4 Mencatat Pengeluaran ................ Gambar 3.13
│   │   └── 3.4.3.5 Tutup Kasir Blind Count ............. Gambar 3.14
│   └── 3.4.4 Flowchart Force Order Logic ............... Gambar 3.15
└── 3.5 Perancangan Database
    ├── 3.5.1 Entity Relationship Diagram ............... Gambar 3.16
    └── 3.5.2 Data Dictionary ........................... Tabel 3.1 - 3.8
```

**Total: 16 Gambar + 8 Tabel** di Bab 3.

---

## B. Tabel Mapping Diagram → Section → Screenshot

| Gambar | Sub-bab | Judul | File screenshot |
|---|---|---|---|
| 3.1 | 3.3 | Blok Diagram Sistem | `blok-diagram-sistem-pos-ayam-bakar-banjar-monosuko.png` |
| 3.2 | 3.4.1 | Use Case Diagram | `use-case-diagram-sistem-pos-restoran.png` |
| 3.3 | 3.4.2.1 | Activity Diagram Login | `activity-diagram-login.png` |
| 3.4 | 3.4.2.2 | Activity Diagram Order Flow | `activity-diagram-order-flow.png` |
| 3.5 | 3.4.2.3 | Activity Diagram Pay Flow | `activity-diagram-pay-flow.png` |
| 3.6 | 3.4.2.4 | Activity Diagram Stock Opname Pagi | `activity-diagram-stock-opname-pagi-kitchen.png` |
| 3.7 | 3.4.2.5 | Activity Diagram Stock Opname Sore | `activity-diagram-stock-opname-sore-kasir.png` |
| 3.8 | 3.4.2.6 | Activity Diagram Tutup Kasir Blind Count | `activity-diagram-tutup-kasir-blind-count.png` |
| 3.9 | 3.4.2.7 | Activity Diagram Mencatat Pengeluaran | `activity-diagram-mencatat-pengeluaran.png` |
| 3.10 | 3.4.3.1 | Sequence Diagram Login | `sequence-diagram-login-happy-path.png` |
| 3.11 | 3.4.3.2 | Sequence Diagram Pay Transaction | `sequence-diagram-pay-transaction.png` |
| 3.12 | 3.4.3.3 | Sequence Diagram Input Stok Masuk | `sequence-diagram-input-stok-masuk-pagi.png` |
| 3.13 | 3.4.3.4 | Sequence Diagram Mencatat Pengeluaran | `sequence-diagram-mencatat-pengeluaran.png` |
| 3.14 | 3.4.3.5 | Sequence Diagram Tutup Kasir | `sequence-diagram-tutup-kasir-blind-count.png` |
| 3.15 | 3.4.4 | Flowchart Force Order Logic | `flowchart-force-order.png` |
| 3.16 | 3.5.1 | Entity Relationship Diagram | `erd-sistem-pos-restoran.png` |

| Tabel | Sub-bab | Konten | Sumber |
|---|---|---|---|
| 3.1 | 3.5.2 | Tabel `users` (data dictionary) | DATA-DICTIONARY.md §1 |
| 3.2 | 3.5.2 | Tabel `menus` | DATA-DICTIONARY.md §2 |
| 3.3 | 3.5.2 | Tabel `daily_menu_stocks` | DATA-DICTIONARY.md §3 |
| 3.4 | 3.5.2 | Tabel `shifts` | DATA-DICTIONARY.md §4 |
| 3.5 | 3.5.2 | Tabel `transactions` | DATA-DICTIONARY.md §5 |
| 3.6 | 3.5.2 | Tabel `transaction_items` | DATA-DICTIONARY.md §6 |
| 3.7 | 3.5.2 | Tabel `settlements` | DATA-DICTIONARY.md §7 |
| 3.8 | 3.5.2 | Tabel `expenses` | DATA-DICTIONARY.md §8 |

---

## C. Narasi Paste-Ready per Sub-Bab

> **Tips format:** Untuk caption gambar UK Petra biasanya pakai format:
> *Gambar 3.X **Judul Diagram** (italic untuk judul)*
> Bold untuk angka, italic untuk istilah teknis. Sesuaikan dengan format dari pembimbing.

---

### 3.2 Analisis Kebutuhan Sistem

**Pengantar (paste-ready):**

> Berdasarkan permasalahan yang teridentifikasi di sub-bab 3.1, dirumuskan kebutuhan sistem yang harus disediakan oleh aplikasi POS Restoran. Kebutuhan sistem dibagi menjadi dua: kebutuhan fungsional yang menjelaskan fitur-fitur yang harus ada, dan kebutuhan non-fungsional yang menjelaskan kualitas atau karakteristik sistem secara keseluruhan.

#### 3.2.1 Kebutuhan Fungsional

> Kebutuhan fungsional sistem diturunkan dari setiap permasalahan yang ada serta dari hasil pengamatan operasional restoran. Sistem harus dapat:
>
> 1. Mengelola autentikasi pengguna melalui PIN 6 digit untuk tiga peran (Owner, Kasir, dan Kitchen).
> 2. Mengelola katalog menu termasuk nama, kategori, harga, dan status aktif.
> 3. Mencatat stok masuk per menu setiap pagi melalui input langsung oleh pegawai dapur, menggantikan pencatatan manual di buku.
> 4. Memberikan informasi ketersediaan stok harian secara real-time kepada kasir saat memasukkan pesanan.
> 5. Memungkinkan kasir membuka pesanan per meja dan menambahkan item dengan validasi stok otomatis.
> 6. Mendukung mekanisme *force order* — yaitu pencatatan pesanan meskipun stok kurang — dengan tanda khusus pada item agar bisa dianalisis kemudian.
> 7. Memproses pembayaran dengan enam metode (tunai, QRIS, transfer manual, debit, kredit, dan ojol) serta opsi pencetakan struk.
> 8. Melakukan stock opname akhir shift untuk mencocokkan stok fisik dengan stok sistem dan menampilkan selisihnya.
> 9. Melakukan tutup kasir dengan metode *blind count*, di mana kasir menginput jumlah fisik per metode pembayaran tanpa melihat total dari sistem terlebih dahulu, untuk mendeteksi mismatch kas.
> 10. Mencatat pengeluaran harian oleh Owner dengan kategori (bahan baku, utilitas, gaji, transportasi, lainnya).
> 11. Menyediakan dashboard dan laporan untuk Owner berisi pendapatan harian, pengeluaran harian, dan rekonsiliasi shift.

#### 3.2.2 Kebutuhan Non-Fungsional

> Kebutuhan non-fungsional sistem mencakup kualitas-kualitas berikut:
>
> 1. **Kemudahan penggunaan**: aplikasi harus dapat dioperasikan oleh pegawai non-teknis dengan minimal pelatihan, mengingat kasir adalah anggota keluarga pemilik yang bukan tech-savvy.
> 2. **Aksesibilitas multi-perangkat**: aplikasi harus dapat dijalankan di HP Android (untuk Kasir dan Kitchen) dan laptop browser (untuk Owner) tanpa instalasi aplikasi native.
> 3. **Konektivitas**: sistem harus dapat berfungsi melalui koneksi paket data seluler (4G/5G) karena restoran tidak memiliki WiFi internal.
> 4. **Keamanan**: hanya pengguna terautentikasi yang dapat mengakses sistem; aksi sensitif seperti pembatalan pesanan memerlukan PIN Owner sebagai elevasi otorisasi.
> 5. **Konsistensi data**: setiap transaksi yang tercatat tidak boleh hilang atau diubah tanpa jejak audit.
> 6. **Kecepatan respon**: durasi proses pembayaran satu transaksi tidak melebihi 30 detik sejak kasir menekan tombol bayar.

---

### 3.3 Perancangan Arsitektur Sistem (Blok Diagram)

**Posisi gambar:** [Gambar 3.1] — di bawah paragraf pengantar.

**Narasi paste-ready:**

> Arsitektur sistem POS Restoran Ayam Bakar Banjar Monosuko digambarkan pada Gambar 3.1 dalam bentuk *deployment diagram* (blok diagram sistem). Sistem terdiri dari empat node utama yang saling berkomunikasi melalui internet menggunakan paket data seluler.
>
> Pada sisi klien, terdapat tiga perangkat berbeda yang menjalankan aplikasi *frontend* yang sama (`pos-frontend`, dibangun dengan React, Vite, dan dukungan PWA): HP Kasir untuk operasional POS harian, HP Kitchen untuk input stok masuk pagi, dan Laptop Owner untuk manajemen master data, pengeluaran, serta monitoring melalui dashboard. Ketiga perangkat ini menjalankan aplikasi melalui browser Chrome dengan kemampuan *Add to Home Screen* sehingga terlihat seperti aplikasi *native*.
>
> Pada sisi server, aplikasi *backend* (`server.ts`, dibangun dengan Express, TypeScript, dan Prisma) di-host pada VPS Tencent Cloud beserta basis data PostgreSQL 16 (`pos_db schema`). Pemilihan VPS cloud didasari kondisi operasional restoran yang tidak memiliki jaringan WiFi internal, sehingga server fisik di lokasi tidak memungkinkan untuk menjadi titik akses tunggal.
>
> Setiap perangkat klien terhubung ke server melalui koneksi internet bertanda «HTTPS REST JSON + JWT via Cellular 4G/5G» untuk HP staff, dan «HTTPS REST JSON + JWT via Cellular/WiFi» untuk Laptop Owner. Penggunaan JSON Web Token (JWT) sebagai mekanisme autentikasi memastikan sesi pengguna terjaga tanpa harus menyimpan *session state* di server.

**Caption gambar:**
> Gambar 3.1 *Blok Diagram Sistem POS Ayam Bakar Banjar Monosuko*

---

### 3.4 Perancangan Sistem (UML)

**Pengantar (paste-ready):**

> Perancangan sistem dilakukan dengan pendekatan UML (*Unified Modeling Language*) untuk memodelkan kebutuhan fungsional dari berbagai sudut pandang. Diagram-diagram yang digunakan meliputi *Use Case Diagram* untuk menggambarkan interaksi pengguna dengan sistem, *Activity Diagram* untuk menggambarkan alur kerja proses bisnis utama, dan *Sequence Diagram* untuk menggambarkan urutan interaksi antar objek pada skenario tertentu. Khusus untuk algoritma keputusan *force order* yang merupakan kontribusi utama sistem ini, digambarkan secara terpisah dalam bentuk *flowchart* klasik.

---

#### 3.4.1 Use Case Diagram

**Posisi gambar:** [Gambar 3.2]

**Narasi paste-ready:**

> *Use case diagram* pada Gambar 3.2 mendeskripsikan interaksi antara pengguna dengan Sistem POS Restoran. Sistem melibatkan tiga aktor: **Owner** sebagai pemilik restoran dengan akses penuh terhadap master data, pengeluaran, dan laporan; **Kasir** sebagai operator POS yang menangani transaksi harian; dan **Kitchen** sebagai pegawai dapur yang bertanggung jawab atas input stok masuk pagi hari.
>
> Sistem menyediakan lima belas *use case* yang terbagi dalam empat domain. Domain pertama adalah autentikasi melalui *use case* `Login` yang wajib dilakukan oleh semua aktor. Domain kedua adalah operasional kasir yang meliputi `Buka Kasir`, `Mengelola Pesanan Meja` termasuk pemecahan dan penggabungan tagihan, `Memproses Pembayaran`, `Mencetak Struk`, serta `Tutup Kasir (Blind Count)`. Domain ketiga adalah manajemen stok harian yang dilakukan oleh Kitchen melalui `Menginput Stok Masuk` dan oleh Kasir melalui `Melakukan Stock Opname`. Domain keempat adalah master data dan monitoring oleh Owner yang mencakup `Mengelola Menu`, `Mengelola Pengguna`, `Mengelola Pengeluaran`, dan `Melihat Dashboard dan Laporan`.
>
> Hubungan `<<include>>` ditunjukkan dari setiap *use case* operasional ke `Login`, menandakan bahwa autentikasi merupakan prasyarat wajib. Sedangkan `<<extend>>` ditunjukkan dari `Mencetak Struk` ke `Memproses Pembayaran`, menandakan bahwa pencetakan struk hanya dilakukan jika pelanggan memintanya.

**Caption:**
> Gambar 3.2 *Use Case Diagram Sistem POS Restoran*

---

#### 3.4.2 Activity Diagram

**Pengantar (paste-ready):**

> *Activity diagram* digunakan untuk menggambarkan alur kerja proses bisnis utama yang teridentifikasi pada *use case diagram*. Setiap *activity diagram* menggunakan *swimlane* (partisi vertikal) untuk memisahkan tanggung jawab antara aktor dan sistem. Setiap aksi dinyatakan dalam bahasa bisnis yang mudah dipahami oleh pegawai non-teknis. Setiap titik keputusan diberi label pertanyaan dengan jawaban `Ya` atau `Tidak` pada masing-masing cabang. Sub-bab berikut menjelaskan tujuh *activity diagram* yang dirancang untuk sistem ini.

---

##### 3.4.2.1 Activity Diagram Login

**Posisi gambar:** [Gambar 3.3]

**Narasi paste-ready:**

> Gambar 3.3 menjelaskan alur proses login. Aktor User (yang dapat berperan sebagai Owner, Kasir, atau Kitchen) memulai dengan membuka aplikasi POS, kemudian sistem menampilkan layar login PIN. User memasukkan PIN 6 digit, lalu sistem memvalidasi PIN tersebut dengan memeriksa keberadaan PIN di basis data dan mengambil peran pengguna. Apabila PIN tidak valid, sistem menampilkan pesan kesalahan dan user kembali ke tahap memasukkan PIN. Apabila PIN valid, sistem menampilkan halaman *dashboard* sesuai peran pengguna dan proses login selesai.

**Caption:**
> Gambar 3.3 *Activity Diagram Login*

---

##### 3.4.2.2 Activity Diagram Order Flow

**Posisi gambar:** [Gambar 3.4]

**Narasi paste-ready:**

> Gambar 3.4 menjelaskan alur kasir dalam mengelola pesanan meja. Kasir memilih meja yang masih kosong, membuka pesanan untuk meja tersebut, lalu memilih menu beserta jumlahnya. Sistem kemudian melakukan pengecekan ketersediaan stok hari ini.
>
> Apabila stok mencukupi, sistem mencatat pesanan dan mengurangi stok sebanyak jumlah yang dipesan. Apabila stok tidak mencukupi, sistem menanyakan apakah pesanan akan tetap diteruskan dalam mode *force order* — yakni pencatatan paksa meskipun stok di sistem akan menjadi nol. Jika dikonfirmasi, kasir menyetujui melalui dialog *force order*, lalu sistem mencatat pesanan dengan tanda *force-order* tanpa membuat stok menjadi negatif. Jika tidak dikonfirmasi, sistem membatalkan penambahan item.
>
> Setelah salah satu cabang selesai, sistem menanyakan apakah kasir ingin menambahkan item lain. Jika ya, alur kembali ke pemilihan menu. Jika tidak, sistem menyimpan pesanan sebagai pesanan terbuka dan proses selesai. Mekanisme *force order* ini merupakan kontribusi utama dari sistem untuk menjawab permasalahan kasir yang sering iya-kan pesanan tanpa cek stok.

**Caption:**
> Gambar 3.4 *Activity Diagram Order Flow*

---

##### 3.4.2.3 Activity Diagram Pay Flow

**Posisi gambar:** [Gambar 3.5]

**Narasi paste-ready:**

> Gambar 3.5 menjelaskan alur pembayaran pesanan meja. Kasir memilih opsi bayar untuk meja yang sudah memiliki pesanan terbuka, kemudian sistem mengambil daftar pesanan meja dan menampilkan rincian tagihan. Kasir memilih metode pembayaran yang digunakan pelanggan (tunai, QRIS, transfer manual, debit, kredit, atau ojol) dan memasukkan nominal pembayaran.
>
> Sistem melakukan validasi nominal. Apabila nominal kurang dari total tagihan, alur kembali ke tahap memasukkan nominal. Apabila nominal mencukupi, sistem menandai pesanan sebagai lunas dan mencatatnya ke rekap harian. Setelah pembayaran tercatat, sistem menanyakan apakah pelanggan meminta cetak struk. Jika ya, sistem mencetak struk; jika tidak, alur langsung berlanjut. Kedua cabang menyatu dan sistem menampilkan konfirmasi pembayaran sebelum proses selesai.

**Caption:**
> Gambar 3.5 *Activity Diagram Pay Flow*

---

##### 3.4.2.4 Activity Diagram Stock Opname Pagi

**Posisi gambar:** [Gambar 3.6]

**Narasi paste-ready:**

> Gambar 3.6 menjelaskan alur input stok masuk pagi yang dilakukan oleh Kitchen sebelum jam buka restoran. Setelah Kitchen melakukan login, sistem mengambil daftar menu yang aktif dan menampilkannya bersama kolom input stok. Kitchen kemudian memasukkan jumlah stok pagi untuk masing-masing menu. Sistem menyimpan stok awal hari ini ke tabel `daily_menu_stocks` dan memeriksa apakah semua menu sudah selesai diinput. Apabila masih ada menu yang belum, alur kembali ke tahap input. Apabila semua menu sudah, sistem menandai opname pagi sebagai selesai dan proses berakhir.
>
> Alur ini menggantikan pencatatan manual stok di buku tulis yang sering tidak lengkap, dan menjadi sumber data utama bagi pengecekan stok pada *Activity Diagram Order Flow*.

**Caption:**
> Gambar 3.6 *Activity Diagram Stock Opname Pagi (Kitchen)*

---

##### 3.4.2.5 Activity Diagram Stock Opname Sore

**Posisi gambar:** [Gambar 3.7]

**Narasi paste-ready:**

> Gambar 3.7 menjelaskan alur stock opname akhir shift yang dilakukan oleh Kasir sebelum tutup kasir. Kasir memulai opname akhir shift, sistem mengambil daftar menu beserta stok di sistem dan menampilkannya bersama kolom input stok fisik. Kasir memasukkan jumlah stok fisik aktual per menu. Sistem menghitung selisih antara stok fisik dan stok sistem (`actual − current_stock`) untuk mendeteksi loss atau miscount. Setelah semua menu dihitung, sistem menyimpan hasil opname dan menampilkan rekap selisih sebelum proses berakhir.

**Caption:**
> Gambar 3.7 *Activity Diagram Stock Opname Sore (Kasir)*

---

##### 3.4.2.6 Activity Diagram Tutup Kasir Blind Count

**Posisi gambar:** [Gambar 3.8]

**Narasi paste-ready:**

> Gambar 3.8 menjelaskan alur tutup kasir dengan metode *blind count*, yaitu rekonsiliasi kas akhir shift di mana kasir menginput jumlah fisik tanpa melihat total dari sistem terlebih dahulu. Kasir mengklik tombol Tutup Kasir, lalu sistem memeriksa apakah masih ada pesanan yang belum dibayar. Apabila ada, sistem menampilkan peringatan agar kasir menyelesaikan pesanan yang belum dibayar terlebih dahulu, dan proses berakhir lebih awal.
>
> Apabila tidak ada pesanan yang belum dibayar, sistem menampilkan formulir rekonsiliasi tanpa memperlihatkan total sistem. Kasir memasukkan jumlah fisik untuk masing-masing dari lima metode pembayaran (tunai, QRIS, transfer, debit/kredit, dan ojol). Setelah kasir submit, sistem menghitung total penjualan per metode berdasarkan data transaksi pada shift tersebut, lalu menghitung selisih per metode (`actual − system`). Sistem menampilkan rekap perbandingan beserta total selisih over/short kepada kasir, kemudian menyimpan hasil rekonsiliasi shift dan menutup shift sebelum proses selesai.
>
> Mekanisme *blind count* ini bertujuan agar kasir tidak terpengaruh oleh angka sistem saat menghitung kas fisik, sehingga selisih yang muncul mencerminkan kondisi aktual dan dapat menjadi indikator dini adanya kebocoran atau kesalahan operasional.

**Caption:**
> Gambar 3.8 *Activity Diagram Tutup Kasir Blind Count*

---

##### 3.4.2.7 Activity Diagram Mencatat Pengeluaran

**Posisi gambar:** [Gambar 3.9]

**Narasi paste-ready:**

> Gambar 3.9 menjelaskan alur Owner dalam mencatat pengeluaran harian. Owner membuka halaman pengeluaran, lalu sistem menampilkan formulir pengeluaran. Owner memasukkan tanggal, kategori (bahan baku, utilitas, gaji, transportasi, atau lainnya), jumlah nominal, dan deskripsi. Setelah Owner submit, sistem memvalidasi input.
>
> Apabila input tidak valid (misalnya kategori belum dipilih atau jumlah kosong), sistem menampilkan pesan kesalahan dan alur kembali ke tahap input. Apabila input valid, sistem menyimpan data pengeluaran ke tabel `expenses` dan menampilkan konfirmasi sebelum proses selesai. Alur ini menggantikan pencatatan struk dan total pengeluaran yang sebelumnya ditempel dengan solatip di sisi kiri buku catatan.

**Caption:**
> Gambar 3.9 *Activity Diagram Mencatat Pengeluaran*

---

#### 3.4.3 Sequence Diagram

**Pengantar (paste-ready):**

> *Sequence diagram* digunakan untuk menggambarkan urutan interaksi antar objek pada skenario tertentu. Setiap *sequence diagram* terdiri dari *lifelines* yang merepresentasikan objek dengan stereotype `«boundary»` (komponen antarmuka), `«control»` (layanan/pengontrol), dan `«entity»` (model data). Pesan antar objek dinomori dan menggunakan panah solid untuk *synchronous call* serta panah dashed untuk *return value*. Sub-bab berikut menjelaskan lima *sequence diagram* untuk skenario kritis dalam sistem.

---

##### 3.4.3.1 Sequence Diagram Login

**Posisi gambar:** [Gambar 3.10]

**Narasi paste-ready:**

> Gambar 3.10 menggambarkan urutan interaksi antar objek pada skenario login. Aktor mengirim pesan `submitPin` kepada `LoginScreen` sebagai *boundary*. `LoginScreen` meneruskan pesan tersebut ke `AuthService` sebagai *control* melalui pemanggilan endpoint `POST /api/auth/login`. `AuthService` melakukan *lookup* PIN ke entitas `user` melalui pesan `findByPin`, kemudian *user* mengembalikan data pengguna. Apabila ditemukan, `AuthService` membuat JWT dengan pesan `signToken`, lalu mengembalikan token dan informasi pengguna kepada `LoginScreen`, yang kemudian menampilkan dashboard sesuai peran kepada aktor.

**Caption:**
> Gambar 3.10 *Sequence Diagram Login*

---

##### 3.4.3.2 Sequence Diagram Pay Transaction

**Posisi gambar:** [Gambar 3.11]

**Narasi paste-ready:**

> Gambar 3.11 menggambarkan urutan interaksi pada skenario proses pembayaran transaksi. Kasir mengirim pesan `submitPayment(method, amount)` kepada `PaymentForm`. `PaymentForm` meneruskan pesan ke `TransactionController` melalui endpoint `POST /api/transactions/{id}/pay`. `TransactionController` mengambil data transaksi dengan pesan `findById` ke entitas `transaction`, kemudian melakukan iterasi `loop [per item] decrement(menu_id, qty)` ke entitas `daily_menu_stock` untuk mengurangi stok per item. Setelah seluruh stok ter-update, `TransactionController` memanggil pesan `update(status=paid, payment_method, paid_at)` ke entitas `transaction` dan `logPayment(method, total)` ke entitas `shift` untuk mencatat pembayaran ke shift aktif. Akhirnya `TransactionController` mengembalikan respon kepada `PaymentForm` yang kemudian menampilkan struk konfirmasi kepada kasir.

**Caption:**
> Gambar 3.11 *Sequence Diagram Pay Transaction*

---

##### 3.4.3.3 Sequence Diagram Input Stok Masuk

**Posisi gambar:** [Gambar 3.12]

**Narasi paste-ready:**

> Gambar 3.12 menggambarkan urutan interaksi pada skenario input stok masuk pagi oleh Kitchen. Aktor Kitchen mengirim pesan `submitStockIn(date, items[])` kepada `StockInScreen`. `StockInScreen` meneruskan permintaan ke `StockService` melalui endpoint `POST /api/stocks/today`. `StockService` melakukan iterasi `loop [per menu] upsert(menu_id, opening_stock, current_stock)` ke entitas `daily_menu_stock`, sehingga setiap menu memperoleh entri stok untuk hari berjalan. Setelah seluruh menu ter-update, `StockService` mengembalikan respon sukses ke `StockInScreen` yang kemudian menampilkan konfirmasi kepada Kitchen.

**Caption:**
> Gambar 3.12 *Sequence Diagram Input Stok Masuk*

---

##### 3.4.3.4 Sequence Diagram Mencatat Pengeluaran

**Posisi gambar:** [Gambar 3.13]

**Narasi paste-ready:**

> Gambar 3.13 menggambarkan urutan interaksi pada skenario pencatatan pengeluaran oleh Owner. Owner mengirim pesan `submitExpense(date, category, amount, description)` kepada `ExpenseForm`. `ExpenseForm` meneruskan pesan ke `ExpenseService` melalui endpoint `POST /api/expenses`. `ExpenseService` mengambil data Owner yang sedang aktif dengan pesan `findCurrent` ke entitas `user`, kemudian membuat entri pengeluaran baru melalui pesan `create(...)` ke entitas `expense` dengan `paid_by` di-set ke ID Owner. Setelah berhasil tersimpan, `ExpenseService` mengembalikan data pengeluaran ke `ExpenseForm` yang kemudian menampilkan konfirmasi kepada Owner.

**Caption:**
> Gambar 3.13 *Sequence Diagram Mencatat Pengeluaran*

---

##### 3.4.3.5 Sequence Diagram Tutup Kasir Blind Count

**Posisi gambar:** [Gambar 3.14]

**Narasi paste-ready:**

> Gambar 3.14 menggambarkan urutan interaksi pada skenario tutup kasir dengan metode *blind count*. Kasir mengirim pesan `submitCount(actual_per_method)` kepada `SettlementForm`. `SettlementForm` meneruskan permintaan ke `SettlementService` melalui endpoint `POST /api/settlements`. `SettlementService` mengambil seluruh transaksi pada shift aktif dengan pesan `findByShift` ke entitas `transaction`, lalu menghitung total sistem per metode pembayaran. Setelah itu, `SettlementService` menghitung selisih (`variance`) antara nominal aktual yang dimasukkan kasir dan total sistem untuk masing-masing metode. Hasilnya disimpan melalui pesan `create(system_*, actual_*, variance_*, status=submitted)` ke entitas `settlement`, lalu shift ditutup melalui pesan `close` ke entitas `shift`. Akhirnya `SettlementService` mengembalikan rekap rekonsiliasi ke `SettlementForm` yang kemudian menampilkannya kepada kasir.

**Caption:**
> Gambar 3.14 *Sequence Diagram Tutup Kasir Blind Count*

---

#### 3.4.4 Flowchart Force Order Logic

**Posisi gambar:** [Gambar 3.15]

**Narasi paste-ready:**

> Mekanisme *force order* merupakan kontribusi utama sistem ini untuk menjawab permasalahan kasir yang sering menerima pesanan tanpa terlebih dahulu memeriksa stok. Algoritma keputusan *force order* digambarkan secara terpisah dalam bentuk *flowchart* klasik (mengacu pada notasi ANSI/ISO 5807) pada Gambar 3.15, mengingat kompleksitas pengambilan keputusan yang lebih cocok divisualisasikan dengan notasi algoritma daripada notasi UML.
>
> Algoritma diawali dengan kasir memilih menu beserta jumlah pesanan, kemudian sistem mengambil stok hari ini untuk menu tersebut. Jika jumlah pesanan lebih kecil atau sama dengan stok, sistem mengurangi stok sebanyak jumlah pesanan dan menambahkan item ke pesanan secara normal. Jika tidak, sistem menampilkan modal konfirmasi *force order*. Apabila kasir mengkonfirmasi, sistem menambahkan item dengan tanda *force order* dan mempertahankan stok di angka nol — yakni tidak menjadi negatif — sehingga dapat ditelusuri di laporan. Apabila kasir tidak mengkonfirmasi, sistem membatalkan penambahan item. Ketiga jalur tersebut konvergen ke satu titik penghentian melalui *connector* sebelum algoritma berakhir.

**Caption:**
> Gambar 3.15 *Flowchart Algoritma Force Order*

---

### 3.5 Perancangan Database

#### 3.5.1 Entity Relationship Diagram

**Posisi gambar:** [Gambar 3.16]

**Narasi paste-ready:**

> Gambar 3.16 menunjukkan *Entity Relationship Diagram* (ERD) dari Sistem POS Restoran yang akan dibangun dengan notasi *crow's-foot*. Sistem terdiri dari delapan entitas utama:
>
> 1. **`users`** menyimpan data seluruh pengguna dengan peran `owner`, `cashier`, atau `kitchen`, dan PIN 6 digit untuk autentikasi.
> 2. **`menus`** sebagai master katalog makanan siap jual berisi nama, kategori, harga, dan status aktif.
> 3. **`daily_menu_stocks`** menyimpan stok per menu per hari dengan kolom `opening_stock` (input pagi oleh Kitchen) dan `current_stock` (turun saat pesanan); memiliki *constraint* unik per kombinasi tanggal dan menu untuk mencegah duplikasi.
> 4. **`shifts`** mencatat siklus buka-tutup kasir per hari per kasir, beserta modal awal kasir.
> 5. **`transactions`** sebagai *header* pesanan per meja dengan status `open`, `paid`, atau `void`.
> 6. **`transaction_items`** sebagai *junction* antara menu dan transaksi dengan atribut tambahan jumlah, harga *snapshot* saat transaksi, dan tanda `is_force_order`.
> 7. **`settlements`** untuk rekonsiliasi *blind count* akhir shift dengan pemisahan kolom `system_*`, `actual_*`, dan `variance_*` untuk masing-masing dari lima metode pembayaran.
> 8. **`expenses`** untuk pencatatan pengeluaran harian Owner dengan kategori dan nominal.
>
> Sistem memiliki sembilan relasi utama yang menghubungkan entitas-entitas tersebut, dengan dominasi relasi 1:N (contohnya satu kasir dapat melakukan banyak transaksi) dan satu relasi 1:1 (satu shift menghasilkan tepat satu *settlement*). Relasi *many-to-many* antara menu dan transaksi dijabarkan sebagai entitas asosiatif `transaction_items` yang menyimpan atribut tambahan seperti jumlah dan harga *snapshot* saat transaksi terjadi. Detail atribut, tipe data, dan keterangan setiap entitas dijabarkan pada Tabel 3.1 hingga Tabel 3.8 di sub-bab berikutnya.

**Caption:**
> Gambar 3.16 *Entity Relationship Diagram Sistem POS Restoran*

---

#### 3.5.2 Data Dictionary

**Pengantar (paste-ready):**

> Sub-bab ini menjabarkan *data dictionary* — yaitu definisi rinci tiap kolom pada delapan entitas yang dirancang. Setiap tabel memuat tiga kolom: nama *field*, tipe data, dan keterangan. Definisi tipe data merujuk pada PostgreSQL 16 sebagai DBMS target.

**Cara pakai:**
> Buka [`docs/DATA-DICTIONARY.md`](../DATA-DICTIONARY.md). Setiap §1–§8 di file itu sudah dalam format **paste-ready**. Untuk tiap tabel:
>
> 1. Tulis sub-judul: `Tabel 3.X Data Dictionary <nama_tabel>` (misal: `Tabel 3.1 Data Dictionary users`)
> 2. Tulis paragraf singkat 1–2 kalimat: "Tabel `users` menyimpan data seluruh pengguna sistem..."
> 3. Paste tabel dari DATA-DICTIONARY.md
> 4. Ulangi untuk Tabel 3.2 sampai Tabel 3.8

**Contoh untuk Tabel 3.1 (`users`):**

> Tabel `users` menyimpan data seluruh pengguna sistem POS yang terbagi dalam tiga peran (Owner, Kasir, Kitchen) dan menjadi sumber autentikasi melalui PIN. Definisi rinci kolomnya ditunjukkan pada Tabel 3.1.
>
> [tempel di sini tabel users dari DATA-DICTIONARY.md §1]
>
> Tabel 3.1 *Data Dictionary `users`*

**Catatan caption tabel:** UK Petra biasanya pakai format `Tabel 3.X *Nama Tabel*` dengan judul *italic*. Konsistensi dengan pembimbing.

---

## D. Tips Penulisan & Best Practice

### 1. Konsistensi gambar dan tabel

- **Setiap diagram harus dirujuk** di teks paragraf dengan kalimat seperti "ditunjukkan pada Gambar 3.X". Jangan taruh gambar tanpa rujukan.
- **Setiap tabel harus dirujuk** dengan kalimat seperti "ditunjukkan pada Tabel 3.X".
- **Caption gambar** di **bawah gambar**, caption tabel di **atas tabel**. Ini konvensi UK Petra.

### 2. Bahasa & istilah

- Gunakan **Indonesia formal** untuk teks naratif.
- Istilah teknis (e.g. *force order*, *blind count*, *swimlane*, *use case*) **dimiringkan** (italic) saat pertama kali muncul, lalu boleh tegak.
- Hindari "kita" atau "kami" — gunakan kalimat pasif ("dirancang", "dijelaskan", "diidentifikasi") atau subjek "sistem"/"penulis".

### 3. Jangan over-explain

- Setiap sub-bab paragraf **2–4 paragraf** cukup. Diagram yang menjelaskan, narasi hanya pengiring.
- Contoh anti-pattern: meng-list semua langkah activity diagram dalam paragraf — itu duplikasi gambar. Cukup highlight 2–3 keputusan kunci.

### 4. Urutan kerja yang efisien

Saran urutan tulisnya (jangan urut sub-bab):

1. **Dulu tabel mapping** — pastikan kamu tahu mana Gambar 3.X jadi mana, biar nomor caption tidak berantakan.
2. **Tulis 3.5 dulu** (ERD + Data Dictionary) — ini yang paling rapi karena DATA-DICTIONARY.md sudah ready.
3. **Tulis 3.4.1 Use Case** — paragraf paste-ready sudah siap.
4. **Tulis 3.3 Blok Diagram**.
5. **Tulis 3.4.4 Flowchart**.
6. **Tulis 3.4.2 Activity** (7 sub-bab) sekaligus — narasi sudah ada di sini.
7. **Tulis 3.4.3 Sequence** (5 sub-bab) sekaligus.
8. **Tutup dengan 3.2** — kebutuhan fungsional + non-fungsional. Lebih mudah ditulis setelah semua diagram siap, karena tahu apa saja sistem benar-benar lakukan.

### 5. Screenshot

- Pakai PNG yang ada di [`docs/diagrams/`](../diagrams/). Namanya kebab-case sesuai mapping di **B**.
- Jika ingin **buang watermark "UNREGISTERED"** pakai StarUML berlisensi atau crop manual via Photoshop/GIMP.
- Resolusi minimal 1080p untuk readability di skripsi cetak A4.

### 6. Self-check sebelum submit

- [ ] Setiap Gambar 3.X dan Tabel 3.X di-rujuk minimal sekali di paragraf.
- [ ] Caption format konsisten (`Gambar 3.X *Judul*`).
- [ ] Nomor Gambar/Tabel berurutan dari awal Bab 3.
- [ ] Tidak ada istilah teknis tanpa konteks (jelaskan saat pertama kali muncul).
- [ ] Setiap *use case* punya `<<include>>` ke Login dan dijelaskan di narasi.

---

## E. Referensi Cepat

| Topik | File/lokasi |
|---|---|
| Detail Use Case (15 UC + 14 dep) | [USE-CASE.md](USE-CASE.md) |
| Detail Activity (7 diagram) | [ACTIVITY.md](ACTIVITY.md) |
| Detail ERD (8 entitas + 9 relasi) | [ERD.md](ERD.md) |
| Kompilasi semua | [FULL.md](FULL.md) |
| Data Dictionary 8 tabel | [`../DATA-DICTIONARY.md`](../DATA-DICTIONARY.md) |
| Gallery PNG | [`../diagrams/INDEX.md`](../diagrams/INDEX.md) |
| Mapping ke rumusan masalah | [FULL.md §8](FULL.md) |
