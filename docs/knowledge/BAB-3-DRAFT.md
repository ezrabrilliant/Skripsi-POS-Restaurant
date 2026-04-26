# BAB 3 — Analisis dan Desain (Draft Paste-Ready)

Dokumen ini berisi **paragraf paste-ready** untuk Bab 3 skripsi mengikuti **Pedoman Program SIB UK Petra** (`docs/Pedoman Program SIB.pdf`). Semua konten konseptual — tidak menyebut Express/React/PostgreSQL eksplisit di narasi (tech stack ditahan ke Bab 4).

> **Cakupan diagram (per arahan pembimbing):** Use Case Diagram + Activity Diagram + Entity Relationship Diagram saja. *Sequence Diagram*, *Block Diagram*, dan *Flowchart Force Order* TIDAK dipakai di Bab 3.

---

## ⚠️ Penting: Renumbering yang harus kamu lakukan dulu

Naskah kamu sekarang (`SKRIPSI_C14220315.pdf`) punya numbering yang **tidak sesuai pedoman**:

| Sekarang (salah) | Harus jadi (benar per Pedoman) |
|---|---|
| `3.1 Analisis Permasalahan` | `3.1 Analisis` *(umbrella, tanpa konten langsung)* |
| | `3.1.1 Analisis Permasalahan` *(konten yang sudah kamu tulis pindah ke sini)* |
| `3.2 Analisis Kebutuhan Informasi` | `3.1.2 Analisis Kebutuhan Informasi` |
| *(belum ada)* | `3.1.3 Analisis Kebutuhan Sistem` |
| *(belum ada)* | `3.2 Desain Sistem` *(umbrella)* |
| | `3.2.1 Proses Bisnis yang Diusulkan` |
| | `3.2.2 Use Case Diagram` |
| | `3.2.3 Activity Diagram` *(7 sub-bab)* |
| | `3.2.4 Entity Relationship Diagram` |
| | `3.2.5 Data Dictionary` |

Sebelum copy-paste konten di bawah:
1. Buka skripsi kamu, ganti judul `3.1 Analisis Permasalahan` jadi heading dua tingkat: heading utama `3.1 Analisis` (kosong, langsung ke sub-bab), lalu `3.1.1 Analisis Permasalahan` di atas paragraf yang sudah ada.
2. Heading `3.2 Analisis Kebutuhan Informasi` ganti jadi `3.1.2 Analisis Kebutuhan Informasi`.
3. Tambah `3.1.3`, `3.2`, `3.2.1`–`3.2.5` baru sesuai konten di bawah.

---

## Mapping Gambar dan Tabel

**Total: 8 Gambar + 9 Tabel**

| Gambar | Sub-bab | Judul | File screenshot |
|---|---|---|---|
| 3.1 | 3.2.2 | Use Case Diagram | `use-case-diagram-sistem-pos-restoran.png` |
| 3.2 | 3.2.3.1 | Activity Diagram Login | `activity-diagram-login.png` |
| 3.3 | 3.2.3.2 | Activity Diagram Order Flow | `activity-diagram-order-flow.png` |
| 3.4 | 3.2.3.3 | Activity Diagram Pay Flow | `activity-diagram-pay-flow.png` |
| 3.5 | 3.2.3.4 | Activity Diagram Stock Opname Pagi | `activity-diagram-stock-opname-pagi-kitchen.png` |
| 3.6 | 3.2.3.5 | Activity Diagram Tutup Kasir Blind Count | `activity-diagram-tutup-kasir-blind-count.png` |
| 3.7 | 3.2.3.6 | Activity Diagram Mencatat Pengeluaran | `activity-diagram-mencatat-pengeluaran.png` |
| 3.8 | 3.2.4 | Entity Relationship Diagram | `erd-sistem-pos-restoran.png` |

| Tabel | Sub-bab | Konten | Sumber |
|---|---|---|---|
| 3.1 | 3.1.2 | Kebutuhan Informasi per Peran Pengguna | (paragraf di bawah) |
| 3.2 | 3.2.5 | Data Dictionary `users` | DATA-DICTIONARY.md §1 |
| 3.3 | 3.2.5 | Data Dictionary `menus` | DATA-DICTIONARY.md §2 |
| 3.4 | 3.2.5 | Data Dictionary `daily_menu_stocks` | DATA-DICTIONARY.md §3 |
| 3.5 | 3.2.5 | Data Dictionary `shifts` | DATA-DICTIONARY.md §4 |
| 3.6 | 3.2.5 | Data Dictionary `transactions` | DATA-DICTIONARY.md §5 |
| 3.7 | 3.2.5 | Data Dictionary `transaction_items` | DATA-DICTIONARY.md §6 |
| 3.8 | 3.2.5 | Data Dictionary `settlements` | DATA-DICTIONARY.md §7 |
| 3.9 | 3.2.5 | Data Dictionary `expenses` | DATA-DICTIONARY.md §8 |

---

## 3.1.2 Analisis Kebutuhan Informasi

> Berdasarkan analisis permasalahan pada sub-bab 3.1.1, dapat diidentifikasi kebutuhan informasi yang harus dipenuhi sistem agar mendukung proses pengambilan keputusan dan pelaksanaan tugas pada masing-masing peran pengguna. Tabel 3.1 menunjukkan informasi yang dibutuhkan oleh setiap aktor beserta tujuan pemanfaatannya.

**Tabel 3.1** *Kebutuhan Informasi per Peran Pengguna*

| Peran Pengguna | Informasi yang Dibutuhkan | Tujuan Penggunaan |
|---|---|---|
| Pemilik (*Owner*) | Pendapatan harian per metode pembayaran | Memantau pemasukan harian dan rekonsiliasi kas |
| Pemilik (*Owner*) | Pengeluaran harian per kategori | Mengevaluasi alokasi biaya operasional bulanan |
| Pemilik (*Owner*) | Selisih kas akhir shift (rekonsiliasi *blind count*) | Mendeteksi mismatch atau potensi kebocoran kas |
| Pemilik (*Owner*) | Stok harian per menu beserta variansnya | Mengevaluasi efisiensi penggunaan stok |
| Pemilik (*Owner*) | Daftar transaksi yang dibatalkan beserta alasannya | Mengontrol penyalahgunaan otorisasi pembatalan pesanan |
| Kasir | Status meja (kosong, terisi, menunggu pembayaran) | Mengelola alokasi pesanan ke meja tersedia |
| Kasir | Ketersediaan stok harian per menu | Menentukan apakah menu dapat dipesan atau perlu *force order* |
| Kasir | Total tagihan per meja sebelum pembayaran | Menyampaikan rincian tagihan kepada pelanggan |
| Kasir | Total penjualan dan jumlah kas fisik per metode pembayaran akhir shift | Melakukan rekonsiliasi *blind count* sebelum tutup kasir |
| Pegawai Dapur (*Kitchen*) | Daftar menu aktif yang harus diisi stok pagi | Memastikan seluruh menu memiliki stok awal sebelum operasional |

> Pemilik membutuhkan informasi keuangan dan operasional yang terintegrasi sebagai dasar evaluasi performa restoran secara menyeluruh, baik dari sisi pendapatan, pengeluaran, maupun pengendalian internal. Kasir membutuhkan informasi operasional waktu nyata untuk melayani pelanggan dengan cepat sekaligus memverifikasi keseimbangan kas pada akhir shift. Pegawai Dapur sebagai aktor pendukung membutuhkan daftar menu aktif sebagai acuan input stok pagi yang menjadi sumber data utama bagi pengecekan stok kasir.

---

## 3.1.3 Analisis Kebutuhan Sistem

> Berdasarkan permasalahan dan kebutuhan informasi yang teridentifikasi, dirumuskan kebutuhan sistem yang dibagi menjadi kebutuhan fungsional dan non-fungsional.

### Kebutuhan Fungsional

> Sistem yang dirancang harus dapat memenuhi kebutuhan fungsional sebagai berikut:
>
> 1. Mengelola autentikasi pengguna melalui PIN 6 digit untuk tiga peran (Pemilik, Kasir, dan Pegawai Dapur).
> 2. Mengelola katalog menu yang mencakup nama menu, kategori, harga jual, dan status aktif.
> 3. Mencatat stok masuk per menu setiap pagi melalui input langsung oleh Pegawai Dapur sebagai pengganti pencatatan manual di buku.
> 4. Menyediakan informasi ketersediaan stok harian per menu kepada Kasir secara waktu nyata saat memasukkan pesanan.
> 5. Mendukung pembukaan pesanan per meja dengan status meja kosong, terisi, dan menunggu pembayaran.
> 6. Mendukung penambahan, perubahan, dan pembatalan item pesanan sebelum pembayaran dilakukan.
> 7. Menyediakan mekanisme *force order* yang memungkinkan kasir tetap mencatat pesanan meskipun stok kurang, dengan tanda khusus pada item agar dapat ditelusuri pada laporan.
> 8. Mendukung pemecahan tagihan (*split bill*) dan penggabungan tagihan (*merge bill*) untuk fleksibilitas pembayaran.
> 9. Memproses pembayaran dengan enam metode: tunai, QRIS, transfer, debit, kredit, dan layanan ojek daring (*ojol*), serta opsi pencetakan struk.
> 10. Melakukan pengurangan stok secara otomatis saat pembayaran berhasil dilakukan.
> 11. Melakukan tutup kasir dengan metode *blind count* — yaitu rekonsiliasi kas akhir shift dengan input jumlah fisik per metode pembayaran tanpa melihat total dari sistem terlebih dahulu — untuk mendeteksi mismatch.
> 12. Mencatat pengeluaran harian oleh Pemilik beserta kategori (bahan baku, utilitas, gaji, transportasi, atau lainnya) dan jumlah nominalnya.
> 13. Menyediakan dashboard dan laporan yang berisi pendapatan harian, pengeluaran harian, rekonsiliasi shift, dan laba kotor harian bagi Pemilik.
> 14. Memerlukan otorisasi PIN Pemilik (*Owner PIN elevation*) untuk pembatalan pesanan dan tindakan sensitif lainnya.

### Kebutuhan Non-Fungsional

> Selain kebutuhan fungsional, sistem juga harus memenuhi kebutuhan non-fungsional berikut:
>
> 1. **Kemudahan penggunaan** — antarmuka harus dapat dioperasikan oleh pegawai non-teknis dengan minimal pelatihan, mengingat Kasir merupakan anggota keluarga Pemilik yang bukan pengguna teknologi mahir.
> 2. **Aksesibilitas multi-perangkat** — aplikasi dapat diakses melalui peramban pada telepon seluler (untuk Kasir dan Pegawai Dapur) maupun komputer (untuk Pemilik) tanpa harus melakukan pemasangan aplikasi *native*.
> 3. **Konektivitas berbasis paket data** — sistem harus tetap dapat berfungsi melalui koneksi paket data seluler karena restoran tidak memiliki jaringan WiFi internal.
> 4. **Keamanan akses** — hanya pengguna terautentikasi yang dapat mengakses sistem, dan tindakan sensitif memerlukan elevasi otorisasi melalui PIN Pemilik.
> 5. **Konsistensi dan jejak audit data** — setiap transaksi yang tercatat tidak dapat hilang atau diubah tanpa meninggalkan jejak.
> 6. **Kecepatan respons** — proses pembayaran satu transaksi tidak melebihi 30 detik sejak Kasir menekan tombol bayar hingga konfirmasi muncul.

---

## 3.2.1 Proses Bisnis yang Diusulkan

> Sistem yang diusulkan mengubah proses bisnis restoran dari pencatatan manual berbasis buku menjadi pencatatan terintegrasi berbasis aplikasi dengan basis data tunggal sebagai acuan. Proses bisnis yang dikomputerisasi mencakup enam alur utama berikut.
>
> **Pertama, autentikasi pengguna**, di mana setiap pengguna wajib login dengan PIN 6 digit sebelum dapat mengakses fungsi sistem; halaman setelah login otomatis menyesuaikan dengan peran yang dimiliki.
>
> **Kedua, input stok masuk pagi**, di mana Pegawai Dapur memasukkan jumlah stok pagi untuk masing-masing menu aktif setelah penyiapan dilakukan di rumah Pemilik. Data ini menjadi acuan tunggal bagi pengecekan stok pada saat pesanan diterima.
>
> **Ketiga, pengelolaan pesanan meja**, di mana Kasir membuka pesanan untuk meja kosong, menambahkan item beserta jumlahnya, dan sistem secara otomatis melakukan pengecekan stok hari ini. Apabila stok tidak mencukupi, sistem menawarkan mekanisme *force order* dengan persetujuan Kasir; jika dikonfirmasi, item ditandai dengan penanda *force order* dan stok dipertahankan pada angka nol agar tetap dapat ditelusuri pada laporan.
>
> **Keempat, pembayaran**, di mana Kasir memilih metode pembayaran dari enam pilihan, memasukkan nominal pembayaran, dan sistem memvalidasi kecukupan nominal serta menandai pesanan sebagai lunas. Stok dikurangi secara otomatis pada saat pembayaran berhasil. Pencetakan struk dilakukan secara opsional sesuai permintaan pelanggan.
>
> **Kelima, tutup kasir dengan metode *blind count***, di mana Kasir memasukkan jumlah kas fisik per metode pembayaran tanpa melihat total dari sistem, kemudian sistem menampilkan rekap perbandingan dan total selisih (*over*/*short*) sebelum shift ditutup.
>
> **Keenam, pencatatan pengeluaran harian** oleh Pemilik dengan kategori dan nominal, sebagai pengganti tempelan struk pada buku pencatatan lama.

---

## 3.2.2 Use Case Diagram

> *Use case diagram* pada Gambar 3.1 mendeskripsikan interaksi antara pengguna dengan Sistem POS Restoran. Sistem melibatkan tiga aktor — Pemilik, Kasir, dan Pegawai Dapur — yang berinteraksi dengan empat belas *use case* yang terbagi dalam empat domain.
>
> Domain pertama adalah autentikasi melalui *use case* `Login` yang wajib dilakukan oleh seluruh aktor. Domain kedua adalah operasional kasir yang mencakup `Buka Kasir`, `Mengelola Pesanan Meja`, `Memecah Tagihan`, `Menggabungkan Tagihan`, `Membatalkan Pesanan`, `Memproses Pembayaran`, `Mencetak Struk`, dan `Tutup Kasir`. Domain ketiga adalah manajemen stok yang dilakukan oleh Pegawai Dapur melalui `Menginput Stok Masuk` setiap pagi sebelum jam operasional. Domain keempat adalah pengelolaan master data dan pemantauan oleh Pemilik melalui `Mengelola Menu`, `Mengelola Pengguna`, `Mengelola Pengeluaran`, dan `Melihat Dashboard dan Laporan`.
>
> Hubungan `<<include>>` ditunjukkan dari setiap *use case* operasional ke `Login`, menandakan bahwa autentikasi merupakan prasyarat wajib sebelum *use case* tersebut dapat dijalankan. Hubungan `<<extend>>` ditunjukkan dari `Mencetak Struk` ke `Memproses Pembayaran`, menandakan bahwa pencetakan struk hanya dilakukan apabila pelanggan memintanya.

**Gambar 3.1** *Use Case Diagram Sistem POS Restoran*
*(File: `docs/diagrams/use-case-diagram-sistem-pos-restoran.png`)*

---

## 3.2.3 Activity Diagram

> *Activity diagram* digunakan untuk menggambarkan alur kerja proses bisnis utama yang teridentifikasi pada *use case diagram*. Setiap *activity diagram* menggunakan *swimlane* (partisi vertikal) untuk memisahkan tanggung jawab antara aktor dan sistem. Setiap aksi dinyatakan dalam bahasa bisnis yang mudah dipahami oleh pegawai non-teknis. Setiap titik keputusan diberi label pertanyaan dengan jawaban `Ya` atau `Tidak` pada masing-masing cabang. Sub-bab berikut menjelaskan enam *activity diagram* yang dirancang untuk sistem ini.

### 3.2.3.1 Activity Diagram Login

> Gambar 3.2 menjelaskan alur proses login. Aktor (yang dapat berperan sebagai Pemilik, Kasir, atau Pegawai Dapur) memulai dengan membuka aplikasi POS, kemudian sistem menampilkan layar login PIN. Aktor memasukkan PIN 6 digit, lalu sistem memvalidasi PIN tersebut dengan memeriksa keberadaannya di basis data dan mengambil peran pengguna. Apabila PIN tidak valid, sistem menampilkan pesan kesalahan dan aktor kembali ke tahap memasukkan PIN. Apabila PIN valid, sistem menampilkan halaman dashboard sesuai peran pengguna dan proses login selesai.

**Gambar 3.2** *Activity Diagram Login*
*(File: `docs/diagrams/activity-diagram-login.png`)*

### 3.2.3.2 Activity Diagram Order Flow

> Gambar 3.3 menjelaskan alur Kasir dalam mengelola pesanan meja. Kasir memilih meja yang masih kosong, membuka pesanan untuk meja tersebut, lalu memilih menu beserta jumlahnya. Sistem kemudian melakukan pengecekan ketersediaan stok hari ini.
>
> Apabila stok mencukupi, sistem mencatat pesanan dan mengurangi stok sebanyak jumlah yang dipesan. Apabila stok tidak mencukupi, sistem menanyakan apakah pesanan akan tetap diteruskan dalam mode *force order* — yakni pencatatan paksa meskipun stok di sistem akan menjadi nol. Jika dikonfirmasi, Kasir menyetujui melalui dialog *force order*, lalu sistem mencatat pesanan dengan tanda *force order* tanpa membuat stok menjadi negatif. Jika tidak dikonfirmasi, sistem membatalkan penambahan item.
>
> Setelah salah satu cabang selesai, sistem menanyakan apakah Kasir ingin menambahkan item lain. Jika ya, alur kembali ke pemilihan menu. Jika tidak, sistem menyimpan pesanan sebagai pesanan terbuka dan proses selesai. Mekanisme *force order* ini merupakan kontribusi utama dari sistem untuk menjawab permasalahan kasir yang sering menerima pesanan tanpa memeriksa stok terlebih dahulu.

**Gambar 3.3** *Activity Diagram Order Flow*
*(File: `docs/diagrams/activity-diagram-order-flow.png`)*

### 3.2.3.3 Activity Diagram Pay Flow

> Gambar 3.4 menjelaskan alur pembayaran pesanan meja. Kasir memilih opsi bayar untuk meja yang sudah memiliki pesanan terbuka, kemudian sistem mengambil daftar pesanan meja dan menampilkan rincian tagihan. Kasir memilih metode pembayaran yang digunakan pelanggan (tunai, QRIS, transfer, debit, kredit, atau *ojol*) dan memasukkan nominal pembayaran.
>
> Sistem melakukan validasi nominal. Apabila nominal kurang dari total tagihan, alur kembali ke tahap memasukkan nominal. Apabila nominal mencukupi, sistem menandai pesanan sebagai lunas dan mencatatnya ke rekap harian. Setelah pembayaran tercatat, sistem menanyakan apakah pelanggan meminta cetak struk. Jika ya, sistem mencetak struk; jika tidak, alur langsung berlanjut. Kedua cabang menyatu dan sistem menampilkan konfirmasi pembayaran sebelum proses selesai.

**Gambar 3.4** *Activity Diagram Pay Flow*
*(File: `docs/diagrams/activity-diagram-pay-flow.png`)*

### 3.2.3.4 Activity Diagram Stock Opname Pagi

> Gambar 3.5 menjelaskan alur input stok masuk pagi yang dilakukan oleh Pegawai Dapur sebelum jam buka restoran. Setelah Pegawai Dapur melakukan login, sistem mengambil daftar menu yang aktif dan menampilkannya bersama kolom input stok. Pegawai Dapur kemudian memasukkan jumlah stok pagi untuk masing-masing menu. Sistem menyimpan stok awal hari ini dan memeriksa apakah semua menu sudah selesai diinput. Apabila masih ada menu yang belum, alur kembali ke tahap input. Apabila semua menu sudah, sistem menandai opname pagi sebagai selesai dan proses berakhir.
>
> Alur ini menggantikan pencatatan manual stok di buku tulis yang sering tidak lengkap, dan menjadi sumber data utama bagi pengecekan stok pada *Activity Diagram Order Flow*.

**Gambar 3.5** *Activity Diagram Stock Opname Pagi*
*(File: `docs/diagrams/activity-diagram-stock-opname-pagi-kitchen.png`)*

### 3.2.3.5 Activity Diagram Tutup Kasir Blind Count

> Gambar 3.6 menjelaskan alur tutup kasir dengan metode *blind count*, yaitu rekonsiliasi kas akhir shift di mana Kasir memasukkan jumlah fisik tanpa melihat total dari sistem terlebih dahulu. Kasir mengklik tombol Tutup Kasir, lalu sistem memeriksa apakah masih ada pesanan yang belum dibayar. Apabila ada, sistem menampilkan peringatan agar Kasir menyelesaikan pesanan yang belum dibayar terlebih dahulu, dan proses berakhir lebih awal.
>
> Apabila tidak ada pesanan yang belum dibayar, sistem menampilkan formulir rekonsiliasi tanpa memperlihatkan total sistem. Kasir memasukkan jumlah fisik untuk masing-masing dari lima metode pembayaran (tunai, QRIS, transfer, debit/kredit, dan *ojol*). Setelah Kasir submit, sistem menghitung total penjualan per metode berdasarkan data transaksi pada shift tersebut, lalu menghitung selisih per metode. Sistem menampilkan rekap perbandingan beserta total selisih *over*/*short* kepada Kasir, kemudian menyimpan hasil rekonsiliasi shift dan menutup shift sebelum proses selesai.
>
> Mekanisme *blind count* ini bertujuan agar Kasir tidak terpengaruh oleh angka sistem saat menghitung kas fisik, sehingga selisih yang muncul mencerminkan kondisi aktual dan dapat menjadi indikator dini adanya kebocoran atau kesalahan operasional.

**Gambar 3.6** *Activity Diagram Tutup Kasir Blind Count*
*(File: `docs/diagrams/activity-diagram-tutup-kasir-blind-count.png`)*

### 3.2.3.6 Activity Diagram Mencatat Pengeluaran

> Gambar 3.7 menjelaskan alur Pemilik dalam mencatat pengeluaran harian. Pemilik membuka halaman pengeluaran, lalu sistem menampilkan formulir pengeluaran. Pemilik memasukkan tanggal, kategori (bahan baku, utilitas, gaji, transportasi, atau lainnya), jumlah nominal, dan deskripsi. Setelah Pemilik submit, sistem memvalidasi input.
>
> Apabila input tidak valid (misalnya kategori belum dipilih atau jumlah kosong), sistem menampilkan pesan kesalahan dan alur kembali ke tahap input. Apabila input valid, sistem menyimpan data pengeluaran dan menampilkan konfirmasi sebelum proses selesai. Alur ini menggantikan pencatatan struk dan total pengeluaran yang sebelumnya ditempel dengan solatip di sisi kiri buku catatan.

**Gambar 3.7** *Activity Diagram Mencatat Pengeluaran*
*(File: `docs/diagrams/activity-diagram-mencatat-pengeluaran.png`)*

---

## 3.2.4 Entity Relationship Diagram

> Struktur penyimpanan data sistem dirancang dengan pendekatan basis data relasional yang digambarkan dalam *Entity Relationship Diagram* pada Gambar 3.8 menggunakan notasi *crow's-foot*.

**Gambar 3.8** *Entity Relationship Diagram Sistem POS Restoran*
*(File: `docs/diagrams/erd-sistem-pos-restoran.png`)*

> Sistem terdiri atas delapan entitas utama. Entitas `users` menyimpan data seluruh pengguna beserta peran dan PIN autentikasi. Entitas `menus` menyimpan master katalog makanan siap jual. Entitas `daily_menu_stocks` menyimpan stok per menu per hari dengan *constraint* unik per kombinasi tanggal dan menu. Entitas `shifts` mencatat siklus buka-tutup kasir per hari per kasir. Entitas `transactions` menyimpan *header* pesanan per meja dengan status terbuka, terbayar, atau dibatalkan. Entitas `transaction_items` sebagai entitas asosiatif (*junction*) antara menu dan transaksi yang menyimpan jumlah, harga *snapshot*, dan penanda *force order*. Entitas `settlements` menyimpan hasil rekonsiliasi *blind count* akhir shift dengan kolom terpisah untuk masing-masing dari lima metode pembayaran. Entitas `expenses` menyimpan pencatatan pengeluaran harian beserta kategorinya.
>
> Sistem memiliki sembilan relasi utama yang menghubungkan entitas-entitas tersebut, dengan dominasi relasi satu-ke-banyak — sebagai contoh, satu kasir dapat melakukan banyak transaksi — dan satu relasi satu-ke-satu antara `shifts` dan `settlements` di mana setiap shift menghasilkan tepat satu rekonsiliasi. Relasi banyak-ke-banyak antara menu dan transaksi dijabarkan sebagai entitas asosiatif `transaction_items` yang menyimpan atribut tambahan seperti jumlah dan harga *snapshot* saat transaksi terjadi.

---

## 3.2.5 Data Dictionary

> Definisi rinci atribut, tipe data, dan keterangan untuk setiap entitas dijabarkan pada Tabel 3.2 hingga Tabel 3.9 berikut. Tipe data yang digunakan merujuk pada konvensi DBMS basis data relasional standar.

**Cara melengkapi:**

Buka [`docs/DATA-DICTIONARY.md`](../DATA-DICTIONARY.md) — file itu sudah berisi 8 tabel siap *paste*. Untuk masing-masing entitas, tulis pengantar 1 kalimat lalu tempel tabel di bawahnya:

| Tabel | Entitas | Pengantar (paste-ready) |
|---|---|---|
| 3.2 | `users` | "Tabel `users` menyimpan data seluruh pengguna sistem POS yang terbagi dalam tiga peran (Pemilik, Kasir, Pegawai Dapur) beserta PIN autentikasinya. Definisi rinci atribut tabel `users` ditunjukkan pada Tabel 3.2." |
| 3.3 | `menus` | "Tabel `menus` menyimpan master katalog menu siap jual beserta harga, kategori, dan status aktifnya. Definisi rinci atribut tabel `menus` ditunjukkan pada Tabel 3.3." |
| 3.4 | `daily_menu_stocks` | "Tabel `daily_menu_stocks` menyimpan stok per menu per hari dengan kolom stok awal yang diisi oleh Pegawai Dapur pada pagi hari dan kolom stok berjalan yang berkurang otomatis saat pembayaran terjadi. Definisi rinci atribut tabel `daily_menu_stocks` ditunjukkan pada Tabel 3.4." |
| 3.5 | `shifts` | "Tabel `shifts` mencatat siklus buka-tutup kasir per hari per kasir beserta modal awal yang diinput saat buka kasir. Definisi rinci atribut tabel `shifts` ditunjukkan pada Tabel 3.5." |
| 3.6 | `transactions` | "Tabel `transactions` menyimpan *header* pesanan per meja beserta status, total, metode pembayaran, dan referensi ke shift kasir yang menanganinya. Definisi rinci atribut tabel `transactions` ditunjukkan pada Tabel 3.6." |
| 3.7 | `transaction_items` | "Tabel `transaction_items` menyimpan rincian item per transaksi sebagai entitas asosiatif antara menu dan transaksi, lengkap dengan jumlah, harga *snapshot*, dan penanda *force order*. Definisi rinci atribut tabel `transaction_items` ditunjukkan pada Tabel 3.7." |
| 3.8 | `settlements` | "Tabel `settlements` menyimpan hasil rekonsiliasi *blind count* akhir shift dengan pemisahan kolom sistem, aktual, dan variansi untuk masing-masing dari lima metode pembayaran. Definisi rinci atribut tabel `settlements` ditunjukkan pada Tabel 3.8." |
| 3.9 | `expenses` | "Tabel `expenses` menyimpan pencatatan pengeluaran harian oleh Pemilik beserta kategori, nominal, dan referensi pengguna yang membayarkan. Definisi rinci atribut tabel `expenses` ditunjukkan pada Tabel 3.9." |

> Untuk format tabel itu sendiri, langsung *copy-paste* dari `docs/DATA-DICTIONARY.md` §1–§8. Caption tabel pakai format `Tabel 3.X *Definisi Atribut Tabel <nama>*`.

---

## Tips Teknis Penulisan

1. **Caption gambar** di **bawah** gambar; **caption tabel** di **atas** tabel — konvensi UK Petra.
2. **Setiap gambar dan tabel WAJIB di-rujuk** di paragraf dengan kalimat seperti *"ditunjukkan pada Gambar 3.x"* atau *"seperti pada Tabel 3.x"*. Jangan letakkan gambar/tabel tanpa rujukan teks.
3. **Istilah teknis dimiringkan** (*italic*) saat pertama muncul: *blind count*, *force order*, *swimlane*, *snapshot*. Setelahnya boleh tegak.
4. **Bahasa pasif** untuk teks akademik: "*sistem dirancang untuk*", "*proses bisnis dilakukan*", bukan "*kita merancang*" atau "*kami melakukan*".
5. **Konsistensi penamaan aktor** — gunakan istilah Indonesia dengan istilah Inggris dalam tanda kurung saat pertama muncul: "*Pemilik (Owner)*", "*Pegawai Dapur (Kitchen)*". Setelahnya boleh pakai salah satunya saja.
6. **Tabel WAJIB dijelaskan dalam kalimat** di paragraf — bukan sekadar dilemparkan tanpa narasi (per Pedoman SIB hal. 6).

## Self-Check sebelum Submit Bab 3

- [ ] Numbering sudah sesuai pedoman: 3.1 Analisis (umbrella) → 3.1.1, 3.1.2, 3.1.3 → 3.2 Desain Sistem (umbrella) → 3.2.1, 3.2.2, 3.2.3, 3.2.4, 3.2.5.
- [ ] 3.1.1 Analisis Permasalahan sudah ada (kontennya yang sudah kamu tulis).
- [ ] 3.1.2 Tabel kebutuhan informasi (Tabel 3.1) dirujuk di paragraf, lalu tabel ditampilkan, lalu dijelaskan dengan paragraf di bawahnya.
- [ ] 3.1.3 Kebutuhan Fungsional + Non-Fungsional ada, masing-masing minimum 5 item.
- [ ] 3.2.1 Proses Bisnis yang Diusulkan: paragraf naratif tujuh proses, tanpa figure.
- [ ] 3.2.2 Use Case Diagram (Gambar 3.1) dirujuk di paragraf pertama, lalu narasi tiga paragraf.
- [ ] 3.2.3 Activity Diagram enam sub-bab, masing-masing punya pengantar paragraf + Gambar 3.2 sampai 3.7.
- [ ] 3.2.4 ERD (Gambar 3.8) dirujuk di paragraf pengantar, lalu narasi delapan entitas + sembilan relasi.
- [ ] 3.2.5 Data Dictionary: tujuh tabel `users`, `menus`, `daily_menu_stocks`, `shifts`, `transactions`, `transaction_items`, `settlements`, `expenses` di Tabel 3.2 hingga 3.9.
- [ ] Tidak ada penyebutan eksplisit Express, React, PostgreSQL, JWT — istilah teknologi ditahan ke Bab 4. Yang boleh: "*basis data relasional*", "*aplikasi berbasis web*", "*server berbasis komputasi awan*".

---

## Catatan tentang Pedoman SIB

Pedoman SIB UK Petra menyebutkan **3.2.1 Blok Diagram Desain Sistem** dan **3.2.3 Pengolahan Data dan Metode** sebagai sub-bab yang umumnya ada. Kedua sub-bab tersebut **dilewatkan** atas arahan pembimbing yang membatasi cakupan diagram pada Bab 3 ini hanya pada *use case*, *activity*, dan ERD.

Pedoman juga menyebutkan bahwa "*Activity diagram boleh diletakkan di lampiran*". Pada draft ini, *activity diagram* tetap diletakkan pada main body (sub-bab 3.2.3) dengan tujuh sub-bab terpisah agar lebih mudah dirujuk dan dievaluasi oleh pembimbing. Apabila pembimbing meminta agar dipindahkan ke lampiran, pengantar pada 3.2.3 dapat diringkas menjadi satu paragraf yang merujuk pada Lampiran A.
