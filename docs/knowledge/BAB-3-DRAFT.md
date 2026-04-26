# BAB 3 — Analisis dan Desain (Draft Paste-Ready)

Dokumen ini berisi **paragraf paste-ready** untuk Bab 3 skripsi mengikuti **Pedoman Program SIB UK Petra** (`docs/Pedoman Program SIB.pdf`). Semua konten konseptual — tidak menyebut Express/React/PostgreSQL eksplisit di narasi (tech stack ditahan ke Bab 4).

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
| | `3.2.1 Blok Diagram Desain Sistem` |
| | `3.2.2 Desain Aplikasi` |

Jadi sebelum copy-paste konten di bawah:
1. Buka skripsi kamu, ganti judul `3.1 Analisis Permasalahan` jadi heading dua tingkat: heading utama `3.1 Analisis` (kosong, langsung ke sub-bab), lalu `3.1.1 Analisis Permasalahan` di atas paragraf yang sudah ada.
2. Heading `3.2 Analisis Kebutuhan Informasi` ganti jadi `3.1.2 Analisis Kebutuhan Informasi`.
3. Tambah `3.1.3`, `3.2`, `3.2.1`, `3.2.2` baru sesuai konten di bawah.

---

## 3.1.2 Analisis Kebutuhan Informasi

> Berdasarkan analisis permasalahan pada sub-bab 3.1.1, dapat diidentifikasi kebutuhan informasi yang harus dipenuhi sistem agar mendukung proses pengambilan keputusan dan pelaksanaan tugas pada masing-masing peran pengguna. Tabel 3.1 menunjukkan informasi yang dibutuhkan oleh setiap aktor beserta tujuan pemanfaatannya.

**Tabel 3.1 Kebutuhan Informasi per Peran Pengguna**

| Peran Pengguna | Informasi yang Dibutuhkan | Tujuan Penggunaan |
|---|---|---|
| Pemilik (*Owner*) | Pendapatan harian per metode pembayaran | Memantau pemasukan harian dan rekonsiliasi kas |
| Pemilik (*Owner*) | Pengeluaran harian per kategori | Mengevaluasi alokasi biaya operasional bulanan |
| Pemilik (*Owner*) | Selisih kas akhir shift (rekonsiliasi *blind count*) | Mendeteksi mismatch atau potensi kebocoran kas |
| Pemilik (*Owner*) | Stok harian per menu beserta variansnya | Mengevaluasi efisiensi penggunaan stok dan kebocoran |
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
> 11. Melakukan stok opname pada akhir shift untuk mencocokkan stok fisik dan stok sistem serta menampilkan selisihnya.
> 12. Melakukan tutup kasir dengan metode *blind count* — yaitu rekonsiliasi kas akhir shift dengan input jumlah fisik per metode pembayaran tanpa melihat total dari sistem terlebih dahulu — untuk mendeteksi mismatch.
> 13. Mencatat pengeluaran harian oleh Pemilik beserta kategori (bahan baku, utilitas, gaji, transportasi, atau lainnya) dan jumlah nominalnya.
> 14. Menyediakan dashboard dan laporan yang berisi pendapatan harian, pengeluaran harian, rekonsiliasi shift, dan laba kotor harian bagi Pemilik.
> 15. Memerlukan otorisasi PIN Pemilik (*Owner PIN elevation*) untuk pembatalan pesanan dan tindakan sensitif lainnya.

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

## 3.2.1 Blok Diagram Desain Sistem

> Blok diagram desain sistem POS Restoran menggambarkan empat elemen utama yang saling terkait yaitu sumber data, modul utama, pengguna, dan keluaran sistem. Gambaran umum keterkaitan keempat elemen tersebut ditunjukkan pada Gambar 3.1.

**Gambar 3.1** *Blok Diagram Sistem POS Restoran*
*(File: `docs/diagrams/blok-diagram-sistem-pos-ayam-bakar-banjar-monosuko.png`)*

### Elemen Blok Diagram

> **Sumber data** sistem berasal dari delapan entitas data yang saling berelasi dan disimpan terpusat pada basis data relasional, yaitu data pengguna, data menu, data stok harian per menu, data shift kasir, data transaksi, data item transaksi, data hasil rekonsiliasi shift, dan data pengeluaran. Sumber data ini menjadi acuan tunggal yang digunakan oleh seluruh modul sistem agar tidak terjadi duplikasi atau ketidakkonsistenan informasi seperti pada pencatatan manual.
>
> **Modul utama** sistem terdiri atas enam modul yang masing-masing mendukung satu kelompok proses bisnis. Modul autentikasi mengelola login pengguna dan otorisasi peran. Modul manajemen stok mengelola input stok masuk pagi, pengurangan stok saat transaksi, dan stok opname akhir shift. Modul pesanan dan pembayaran mengelola siklus pesanan meja mulai dari pembukaan hingga pelunasan termasuk mekanisme *force order*. Modul rekonsiliasi mengelola tutup kasir dengan metode *blind count* dan perhitungan selisih kas. Modul pengeluaran mengelola pencatatan biaya operasional harian. Modul pelaporan menghasilkan dashboard dan laporan untuk Pemilik.
>
> **Pengguna** sistem terdiri atas tiga peran yaitu Pemilik (*Owner*) sebagai pemegang akses penuh terhadap master data, pengeluaran, dan laporan; Kasir sebagai operator harian yang menangani pesanan dan pembayaran; serta Pegawai Dapur (*Kitchen*) yang bertanggung jawab atas input stok masuk pagi sebelum jam operasional.
>
> **Keluaran** sistem berupa rincian transaksi setiap meja, struk pembayaran (opsional), laporan pendapatan harian per metode pembayaran, laporan pengeluaran harian per kategori, laporan rekonsiliasi shift dengan rincian variansi per metode, serta laporan laba kotor harian.

> Aspek arsitektur fisik sistem dibahas secara konseptual pada keterangan Gambar 3.1: aplikasi berjalan sebagai perangkat lunak berbasis peramban (*web-based application*) yang diakses oleh pengguna melalui telepon seluler dan komputer, dengan layanan dan basis data di-*host* pada server publik berbasis komputasi awan agar dapat diakses dari semua perangkat klien tanpa bergantung pada jaringan lokal restoran.

---

## 3.2.2 Desain Aplikasi

### Proses Bisnis yang Diusulkan (*to-be*)

> Sistem yang diusulkan mengubah proses bisnis restoran dari pencatatan manual berbasis buku menjadi pencatatan terintegrasi berbasis aplikasi dengan basis data tunggal sebagai acuan. Proses bisnis yang dikomputerisasi mencakup tujuh alur utama berikut.
>
> **Pertama, autentikasi pengguna**, di mana setiap pengguna wajib login dengan PIN 6 digit sebelum dapat mengakses fungsi sistem; halaman setelah login otomatis menyesuaikan dengan peran yang dimiliki.
>
> **Kedua, input stok masuk pagi**, di mana Pegawai Dapur memasukkan jumlah stok pagi untuk masing-masing menu aktif setelah penyiapan dilakukan di rumah Pemilik. Data ini menjadi acuan tunggal bagi pengecekan stok pada saat pesanan diterima.
>
> **Ketiga, pengelolaan pesanan meja**, di mana Kasir membuka pesanan untuk meja kosong, menambahkan item beserta jumlahnya, dan sistem secara otomatis melakukan pengecekan stok hari ini. Apabila stok tidak mencukupi, sistem menawarkan mekanisme *force order* dengan persetujuan Kasir; jika dikonfirmasi, item ditandai dengan penanda *force order* dan stok dipertahankan pada angka nol agar tetap dapat ditelusuri pada laporan.
>
> **Keempat, pembayaran**, di mana Kasir memilih metode pembayaran dari enam pilihan, memasukkan nominal pembayaran, dan sistem memvalidasi kecukupan nominal serta menandai pesanan sebagai lunas. Stok dikurangi secara otomatis pada saat pembayaran berhasil. Pencetakan struk dilakukan secara opsional sesuai permintaan pelanggan.
>
> **Kelima, stok opname akhir shift**, di mana Kasir memasukkan jumlah fisik aktual per menu dan sistem menghitung selisih dengan stok yang tercatat untuk mendeteksi kebocoran atau kesalahan pencatatan.
>
> **Keenam, tutup kasir dengan metode *blind count***, di mana Kasir memasukkan jumlah kas fisik per metode pembayaran tanpa melihat total dari sistem, kemudian sistem menampilkan rekap perbandingan dan total selisih (*over*/*short*) sebelum shift ditutup.
>
> **Ketujuh, pencatatan pengeluaran harian** oleh Pemilik dengan kategori dan nominal, sebagai pengganti tempelan struk pada buku pencatatan lama.

### Use Case Diagram

> Interaksi antara pengguna dengan sistem digambarkan menggunakan *use case diagram* seperti pada Gambar 3.2. Sistem melibatkan tiga aktor — Pemilik, Kasir, dan Pegawai Dapur — yang berinteraksi dengan lima belas *use case* yang terbagi dalam empat domain.
>
> Domain pertama adalah autentikasi melalui *use case* `Login` yang wajib dilakukan oleh seluruh aktor. Domain kedua adalah operasional kasir yang mencakup `Buka Kasir`, `Mengelola Pesanan Meja`, `Memecah Tagihan`, `Menggabungkan Tagihan`, `Membatalkan Pesanan`, `Memproses Pembayaran`, `Mencetak Struk`, `Melakukan Stock Opname`, dan `Tutup Kasir`. Domain ketiga adalah manajemen stok yang dilakukan oleh Pegawai Dapur melalui `Menginput Stok Masuk`. Domain keempat adalah pengelolaan master data dan pemantauan oleh Pemilik melalui `Mengelola Menu`, `Mengelola Pengguna`, `Mengelola Pengeluaran`, dan `Melihat Dashboard dan Laporan`.
>
> Hubungan `<<include>>` ditunjukkan dari setiap *use case* operasional ke `Login`, menandakan bahwa autentikasi merupakan prasyarat wajib sebelum *use case* tersebut dapat dijalankan. Hubungan `<<extend>>` ditunjukkan dari `Mencetak Struk` ke `Memproses Pembayaran`, menandakan bahwa pencetakan struk hanya dilakukan apabila pelanggan memintanya.

**Gambar 3.2** *Use Case Diagram Sistem POS Restoran*
*(File: `docs/diagrams/use-case-diagram-sistem-pos-restoran.png`)*

### Activity Diagram

> Setiap proses bisnis utama yang teridentifikasi pada *use case diagram* dijabarkan alurnya dalam bentuk *activity diagram* dengan *swimlane* (partisi vertikal) untuk memisahkan tanggung jawab antara aktor dan sistem. Mengingat banyaknya proses bisnis yang dirinci, *activity diagram* lengkap untuk tujuh proses utama — yaitu Login, Pengelolaan Pesanan Meja, Pemrosesan Pembayaran, Input Stok Masuk Pagi, Stok Opname Akhir Shift, Tutup Kasir *Blind Count*, dan Pencatatan Pengeluaran — diletakkan pada **Lampiran A**.
>
> Setiap *activity diagram* menggunakan notasi UML standar dengan simbol *initial node* untuk titik mulai, *activity final node* untuk titik akhir, *action* untuk langkah aktivitas, *decision* untuk percabangan keputusan, dan *merge* untuk konvergensi alur. Setiap titik keputusan diberi label pertanyaan dengan jawaban `Ya` atau `Tidak` pada masing-masing cabang.

### Sequence Diagram

> Untuk menggambarkan urutan interaksi antar objek pada skenario kritis, sistem dilengkapi dengan lima *sequence diagram* yang mencakup proses Login, Pemrosesan Pembayaran, Input Stok Masuk Pagi, Pencatatan Pengeluaran, dan Tutup Kasir *Blind Count*. Setiap *sequence diagram* terdiri atas *lifeline* dengan stereotype `<<boundary>>` untuk komponen antarmuka, `<<control>>` untuk layanan pengendali, dan `<<entity>>` untuk objek data. Pesan antar objek dinomori secara berurutan dan menggunakan panah solid untuk pemanggilan sinkron serta panah putus-putus untuk nilai kembalian. *Sequence diagram* lengkap untuk lima skenario tersebut diletakkan pada **Lampiran B**.

### Flowchart Algoritma *Force Order*

> Mekanisme *force order* yang menjadi salah satu kontribusi utama sistem untuk menjawab permasalahan kasir yang sering menerima pesanan tanpa memeriksa stok dijelaskan secara terpisah dalam bentuk *flowchart* algoritma pada **Lampiran C**. Penggunaan notasi *flowchart* klasik dipilih karena kompleksitas pengambilan keputusan dengan jalur kondisional ganda lebih sesuai divisualisasikan dengan notasi algoritma daripada notasi UML.

### Entity Relationship Diagram

> Struktur penyimpanan data sistem dirancang dengan pendekatan basis data relasional yang digambarkan dalam *Entity Relationship Diagram* pada Gambar 3.3 menggunakan notasi *crow's-foot*.

**Gambar 3.3** *Entity Relationship Diagram Sistem POS Restoran*
*(File: `docs/diagrams/erd-sistem-pos-restoran.png`)*

> Sistem terdiri atas delapan entitas utama. Entitas `users` menyimpan data seluruh pengguna beserta peran dan PIN autentikasi. Entitas `menus` menyimpan master katalog makanan siap jual. Entitas `daily_menu_stocks` menyimpan stok per menu per hari dengan *constraint* unik per kombinasi tanggal dan menu. Entitas `shifts` mencatat siklus buka-tutup kasir per hari per kasir. Entitas `transactions` menyimpan *header* pesanan per meja dengan status terbuka, terbayar, atau dibatalkan. Entitas `transaction_items` sebagai entitas asosiatif (*junction*) antara menu dan transaksi yang menyimpan jumlah, harga *snapshot*, dan penanda *force order*. Entitas `settlements` menyimpan hasil rekonsiliasi *blind count* akhir shift dengan kolom terpisah untuk masing-masing dari lima metode pembayaran. Entitas `expenses` menyimpan pencatatan pengeluaran harian beserta kategorinya.
>
> Sistem memiliki sembilan relasi utama yang menghubungkan entitas-entitas tersebut, dengan dominasi relasi satu-ke-banyak — sebagai contoh, satu kasir dapat melakukan banyak transaksi — dan satu relasi satu-ke-satu antara `shifts` dan `settlements` di mana setiap shift menghasilkan tepat satu rekonsiliasi. Relasi banyak-ke-banyak antara menu dan transaksi dijabarkan sebagai entitas asosiatif `transaction_items` yang menyimpan atribut tambahan seperti jumlah dan harga *snapshot* saat transaksi terjadi.

### Data Dictionary

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

## Lampiran (saran isi)

Karena Bab 3 utama sebaiknya tetap ringkas, beberapa diagram pendukung dipindah ke lampiran sesuai pedoman SIB ("Activity diagram boleh diletakkan di lampiran").

### Lampiran A — *Activity Diagram*

| Sub-lampiran | Judul | File screenshot |
|---|---|---|
| A.1 | *Activity Diagram* Login | `activity-diagram-login.png` |
| A.2 | *Activity Diagram* Pengelolaan Pesanan Meja | `activity-diagram-order-flow.png` |
| A.3 | *Activity Diagram* Pemrosesan Pembayaran | `activity-diagram-pay-flow.png` |
| A.4 | *Activity Diagram* Input Stok Masuk Pagi | `activity-diagram-stock-opname-pagi-kitchen.png` |
| A.5 | *Activity Diagram* Stok Opname Akhir Shift | `activity-diagram-stock-opname-sore-kasir.png` |
| A.6 | *Activity Diagram* Tutup Kasir *Blind Count* | `activity-diagram-tutup-kasir-blind-count.png` |
| A.7 | *Activity Diagram* Pencatatan Pengeluaran | `activity-diagram-mencatat-pengeluaran.png` |

> Untuk setiap *activity diagram*, tulis pengantar 2-3 kalimat yang menjelaskan alur diagram secara ringkas. Narasi paste-ready untuk masing-masing tersedia di [docs/knowledge/ACTIVITY.md](ACTIVITY.md) sub-bab 5.1 sampai 5.7.

### Lampiran B — *Sequence Diagram*

| Sub-lampiran | Judul | File screenshot |
|---|---|---|
| B.1 | *Sequence Diagram* Login | `sequence-diagram-login-happy-path.png` |
| B.2 | *Sequence Diagram* Pemrosesan Pembayaran | `sequence-diagram-pay-transaction.png` |
| B.3 | *Sequence Diagram* Input Stok Masuk Pagi | `sequence-diagram-input-stok-masuk-pagi.png` |
| B.4 | *Sequence Diagram* Pencatatan Pengeluaran | `sequence-diagram-mencatat-pengeluaran.png` |
| B.5 | *Sequence Diagram* Tutup Kasir *Blind Count* | `sequence-diagram-tutup-kasir-blind-count.png` |

### Lampiran C — *Flowchart* Algoritma *Force Order*

> Algoritma pengambilan keputusan *force order* yang menjadi kontribusi utama sistem digambarkan secara terpisah dalam *flowchart* klasik pada Lampiran C. Algoritma diawali dengan input menu dan jumlah, kemudian sistem mengambil stok hari ini. Apabila jumlah lebih kecil atau sama dengan stok, sistem mengurangi stok dan menambahkan item secara normal. Apabila jumlah lebih besar dari stok, sistem menampilkan modal konfirmasi *force order*. Konfirmasi dari Kasir akan menghasilkan penambahan item dengan penanda *force order* tanpa membuat stok menjadi negatif, sedangkan pembatalan akan menghasilkan pembatalan penambahan item.

| Sub-lampiran | Judul | File screenshot |
|---|---|---|
| C.1 | *Flowchart* Algoritma *Force Order* | `flowchart-force-order.png` |

---

## Tips Teknis Penulisan

1. **Caption gambar** di **bawah** gambar; **caption tabel** di **atas** tabel — konvensi UK Petra.
2. **Setiap gambar dan tabel WAJIB di-rujuk** di paragraf dengan kalimat seperti *"ditunjukkan pada Gambar 3.x"* atau *"seperti pada Tabel 3.x"*. Jangan letakkan gambar/tabel tanpa rujukan teks.
3. **Istilah teknis dimiringkan** (*italic*) saat pertama muncul: *blind count*, *force order*, *swimlane*, *snapshot*, *boundary*/*control*/*entity*. Setelahnya boleh tegak.
4. **Bahasa pasif** untuk teks akademik: "*sistem dirancang untuk*", "*proses bisnis dilakukan*", bukan "*kita merancang*" atau "*kami melakukan*".
5. **Konsistensi penamaan aktor** — gunakan istilah Indonesia dengan istilah Inggris dalam tanda kurung saat pertama muncul: "*Pemilik (Owner)*", "*Pegawai Dapur (Kitchen)*". Setelahnya boleh pakai salah satunya saja.
6. **Tabel WAJIB dijelaskan dalam kalimat** di paragraf — bukan sekadar dilemparkan tanpa narasi (per Pedoman SIB hal. 6).

## Self-Check sebelum Submit Bab 3

- [ ] Numbering sudah sesuai pedoman: 3.1 Analisis (umbrella) → 3.1.1, 3.1.2, 3.1.3 → 3.2 Desain Sistem (umbrella) → 3.2.1, 3.2.2.
- [ ] 3.1.1 Analisis Permasalahan sudah ada (kontennya yang sudah kamu tulis).
- [ ] 3.1.2 Tabel kebutuhan informasi (Tabel 3.1) dirujuk di paragraf, lalu tabel di tampilkan, lalu dijelaskan dengan paragraf di bawahnya.
- [ ] 3.1.3 Kebutuhan Fungsional + Non-Fungsional ada, masing-masing minimum 5 item.
- [ ] 3.2.1 Blok Diagram (Gambar 3.1) dirujuk di paragraf pertama, lalu narasi 4 elemen (sumber data, modul utama, pengguna, output).
- [ ] 3.2.2 berisi: proses bisnis to-be (paragraf), Use Case Diagram (Gambar 3.2), referensi Activity Diagram di Lampiran A, ERD (Gambar 3.3) + Data Dictionary (Tabel 3.2-3.9).
- [ ] Lampiran A, B, C punya pengantar dan list sub-lampiran berurutan.
- [ ] Tidak ada penyebutan eksplisit Express, React, PostgreSQL, JWT — istilah teknologi ditahan ke Bab 4. Yang boleh: "*basis data relasional*", "*aplikasi berbasis web*", "*server berbasis komputasi awan*".

---

## Catatan tentang Pedoman SIB

Pedoman SIB UK Petra menyebutkan bahwa **3.2.3 Pengolahan Data dan Metode** wajib diisi jika TA menggunakan metode/algoritma seperti *forecasting*, *recommendation*, *clustering*, *classification*, dll. Skripsi POS ini **tidak menggunakan algoritma analitik** seperti itu — *force order* adalah aturan bisnis dengan dua kondisi sederhana, bukan metode analitik yang membutuhkan elaborasi statistik. Oleh karena itu **3.2.3 dapat dilewatkan** dan langsung lanjut ke Bab 4. Apabila pembimbing meminta penjelasan lebih atas algoritma *force order*, tunjukkan *flowchart* di Lampiran C sebagai dokumentasi alur keputusan.
