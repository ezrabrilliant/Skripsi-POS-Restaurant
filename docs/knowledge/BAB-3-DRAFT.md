# BAB 3 — Analisis dan Desain (Draft Paste-Ready, REV 2.3)

> ✅ **Implementasi STATUS per 2026-05-24:** Backend + Frontend FULL DONE (11 phase backend + 11 phase frontend + Phase 4b split/merge bill). Backend `tsc --noEmit` 0 errors, frontend `vite build` SUCCESS 1564 modules, ~170+ smoke test scenarios PASS. Naskah Bab 3 di bawah ini menggambarkan sistem yang **sudah jalan**, bukan rencana.

> **Status:** REV 2.3 (2026-05-24) — bump dari REV 2.2 setelah brainstorming workflow order intake dan permission matrix. Tidak ada perubahan schema (tetap 14 entitas, 19 relasi). Yang berubah: (1) deskripsi Login diperbaiki menjadi form 2 field input nama + PIN murni (sebelumnya REV 2.2 narasi masih menyebut "memilih namanya dari daftar" + "mengingat pengguna terakhir"); (2) workflow order intake diperjelas sebagai berbasis kertas (waiter tulis → kasir input) dengan waiter sebagai fallback bila kasir tidak available; (3) Kebutuhan Fungsional #1 dan #4-6 diperbaiki untuk mencerminkan annotation kasir primary vs waiter fallback.
> **Sumber alur bisnis:** [`docs/operasional-resto.md`](../operasional-resto.md) REV 2.3 (sumber kebenaran tertinggi)
> **Sumber struktur data:** [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma) — schema REV 2.2 (14 entitas, 19 relasi) sudah applied ke MySQL `pos_restaurant` per 2026-05-24. REV 2.3 tidak menambah schema, hanya middleware permission granular per-endpoint.
> **Design spec turunan:** [`docs/superpowers/specs/2026-05-24-permission-matrix-design.md`](../superpowers/specs/2026-05-24-permission-matrix-design.md)
> **Mengikuti:** Pedoman Program SIB UK Petra (`docs/Pedoman Program SIB.pdf`).

> **Cakupan diagram (per arahan pembimbing):** Use Case Diagram + Activity Diagram + Entity Relationship Diagram saja. *Sequence Diagram*, *Block Diagram*, *Class Diagram*, dan *Flowchart Force Order* TIDAK dipakai di Bab 3.

> ⚠️ **Penyempurnaan dari REV 2:** Perubahan utama:
> - Tipe order disederhanakan dari 4 jenis menjadi **2** (dine-in dan takeaway). Sumber takeaway (walk-in, GoFood, GrabFood, gosend) dibedakan via metode pembayaran, bukan via sub-tipe order.
> - Metode pembayaran EDC dan transfer **dipisah per bank** via field `payment_bank` agar owner mendapatkan laporan rekonsiliasi per bank.
> - Stok bahan rigid (`bulk_stocks` dengan 5 jenis hardcoded) diganti dengan **`raw_materials` fleksibel** (is_tracked + category enum + unit varchar bebas + freshness_days untuk perishable).
> - Tabel **`vendors`** baru (opsional) untuk catat toko/pasar tempat belanja.
> - Pembelian dinormalisasi: header `purchases` + detail `purchase_items` (FK ke `raw_materials`).
> - Field `portion_stocks.opening_qty_today` baru untuk auto-snapshot pagi (metric "terjual hari ini").
> - Self-reference `transactions.merged_into_id` untuk merge bill.
> - **HPP dan Bill of Materials EXPLICIT out-of-scope** — ada paragraf justifikasi siap paste di sub-bab "Batasan".
> - 13 entitas (sebelumnya 11), 17 relasi (sebelumnya 13).
> - 20 use case (sebelumnya 17), 11 activity diagram (sebelumnya 10).

---

## Mapping Gambar dan Tabel (REV 2.3)

**Total: 13 Gambar + 15 Tabel** (1 tabel kebutuhan informasi + 14 tabel data dictionary)

| Gambar | Sub-bab | Judul | File screenshot |
|---|---|---|---|
| 3.1 | 3.2.2 | Use Case Diagram | `use-case-diagram-sistem-pos-restoran.png` |
| 3.2 | 3.2.3.1 | Activity Diagram Login | `activity-diagram-login.png` |
| 3.3 | 3.2.3.2 | Activity Diagram Order Flow | `activity-diagram-order-flow.png` |
| 3.4 | 3.2.3.3 | Activity Diagram Pay Flow | `activity-diagram-pay-flow.png` |
| 3.5 | 3.2.3.4 | Activity Diagram Restock Stok Porsi Pagi | `activity-diagram-restock-stok-porsi-pagi.png` |
| 3.6 | 3.2.3.5 | Activity Diagram Mencatat Barang Masuk | `activity-diagram-mencatat-barang-masuk.png` |
| 3.7 | 3.2.3.6 | Activity Diagram Opname Stok Porsi | `activity-diagram-opname-stok-porsi.png` |
| 3.8 | 3.2.3.7 | Activity Diagram Opname Raw Materials | `activity-diagram-opname-raw-materials.png` |
| 3.9 | 3.2.3.8 | Activity Diagram Tutup Kasir | `activity-diagram-tutup-kasir.png` |
| 3.10 | 3.2.3.9 | Activity Diagram Mencatat Pembelian | `activity-diagram-mencatat-pembelian.png` |
| 3.11 | 3.2.3.10 | Activity Diagram Mencatat Tagihan Bulanan | `activity-diagram-mencatat-tagihan.png` |
| 3.12 | 3.2.3.11 | Activity Diagram Split & Merge Bill | `activity-diagram-split-merge-bill.png` |
| 3.13 | 3.2.4 | Entity Relationship Diagram | `erd-sistem-pos-restoran.png` |

| Tabel | Sub-bab | Konten | Sumber |
|---|---|---|---|
| 3.1 | 3.1.2 | Kebutuhan Informasi per Peran Pengguna | (paragraf di bawah) |
| 3.2 | 3.2.5 | Data Dictionary `users` | DATA-DICTIONARY.md §1 |
| 3.3 | 3.2.5 | Data Dictionary `menus` | §2 |
| 3.4 | 3.2.5 | Data Dictionary `portion_stocks` | §3 |
| 3.5 | 3.2.5 | Data Dictionary `portion_movements` (REV 2.2: rename dari `stock_movements`) | §4 |
| 3.6 | 3.2.5 | Data Dictionary `raw_materials` | §5 |
| 3.7 | 3.2.5 | Data Dictionary `raw_material_movements` (REV 2.2: BARU) | §6 |
| 3.8 | 3.2.5 | Data Dictionary `vendors` | §7 |
| 3.9 | 3.2.5 | Data Dictionary `shifts` | §8 |
| 3.10 | 3.2.5 | Data Dictionary `transactions` | §9 |
| 3.11 | 3.2.5 | Data Dictionary `transaction_items` | §10 |
| 3.12 | 3.2.5 | Data Dictionary `settlements` | §11 |
| 3.13 | 3.2.5 | Data Dictionary `purchases` | §12 |
| 3.14 | 3.2.5 | Data Dictionary `purchase_items` | §13 |
| 3.15 | 3.2.5 | Data Dictionary `bills` | §14 |

---

## 3.1.2 Analisis Kebutuhan Informasi

> Berdasarkan analisis permasalahan pada sub-bab 3.1.1, dapat diidentifikasi kebutuhan informasi yang harus dipenuhi sistem agar mendukung proses pengambilan keputusan dan pelaksanaan tugas pada masing-masing peran pengguna. Tabel 3.1 menunjukkan informasi yang dibutuhkan oleh setiap aktor beserta tujuan pemanfaatannya.

**Tabel 3.1** *Kebutuhan Informasi per Peran Pengguna*

| Peran Pengguna | Informasi yang Dibutuhkan | Tujuan Penggunaan |
|---|---|---|
| Pemilik (*Owner*) | Pendapatan harian per metode pembayaran beserta rincian per bank untuk EDC dan transfer | Memantau pemasukan harian dan rekonsiliasi mutasi rekening per bank |
| Pemilik (*Owner*) | Pengeluaran harian (pembelian belanja) dan tagihan operasional bulanan | Mengevaluasi alokasi biaya operasional total |
| Pemilik (*Owner*) | Selisih kas akhir hari per metode pembayaran | Mendeteksi mismatch atau potensi kebocoran kas |
| Pemilik (*Owner*) | Stok porsi yang menipis atau habis dan kondisi raw materials yang perlu restock | Mempersiapkan restock harian dari rumah dan belanja bahan baku |
| Pemilik (*Owner*) | Daftar transaksi yang dibatalkan | Mengontrol penggunaan fitur pembatalan oleh kasir |
| Kasir | Status meja (kosong atau terisi) dan tipe order aktif | Mengelola alokasi pesanan dan tipe layanan |
| Kasir | Ketersediaan stok porsi waktu nyata | Mengetahui kapan perlu menghubungi pemilik untuk restock darurat |
| Kasir | Total tagihan per meja sebelum pembayaran (termasuk pajak PB1) | Menyampaikan rincian tagihan kepada pelanggan |
| Kasir | Total penjualan per enam metode pembayaran beserta rincian per bank | Melakukan rekap akhir hari sebelum tutup kasir |
| Waiter | Daftar item stok porsi yang perlu restock pagi (di bawah batas minimum) | Memberitahu kasir saat input restock pagi |
| Waiter | Kondisi raw materials yang ditrack (beras, sayur, tahu, tempe, telur, petai) beserta countdown freshness untuk perishable | Melakukan opname malam dan menentukan kapan perlu belanja bahan baku |
| Waiter | Daftar menu yang tersedia di POS | Membantu input order pelanggan ke sistem |

> Pemilik membutuhkan informasi keuangan dan operasional yang terintegrasi sebagai dasar evaluasi performa restoran secara menyeluruh, dengan rincian khusus per bank untuk metode pembayaran EDC dan transfer agar memudahkan rekonsiliasi dengan mutasi rekening. Kasir membutuhkan informasi operasional waktu nyata untuk melayani pelanggan dengan cepat, sekaligus memverifikasi keseimbangan kas pada akhir hari. Waiter sebagai aktor pendukung membutuhkan informasi kondisi stok porsi dan raw materials untuk membantu pencatatan restock pagi dan opname raw materials di malam hari.

---

## 3.1.3 Analisis Kebutuhan Sistem

> Berdasarkan permasalahan dan kebutuhan informasi yang teridentifikasi, dirumuskan kebutuhan sistem yang dibagi menjadi kebutuhan fungsional dan non-fungsional.

### Kebutuhan Fungsional

> Sistem yang dirancang harus dapat memenuhi kebutuhan fungsional sebagai berikut:
>
> 1. Mengelola autentikasi pengguna melalui form login untuk tiga peran (Pemilik, Kasir, dan Waiter). Saat pertama kali login di suatu perangkat, pegawai mengisi nama pengguna dan PIN enam digit secara manual. Setelah login berhasil, sistem menyimpan nama tersebut di penyimpanan lokal perangkat sehingga login berikutnya di perangkat yang sama hanya memerlukan input PIN enam digit pada *numpad* (nama otomatis terisi dari cache, mempercepat alur untuk pegawai yang menggunakan satu perangkat berulang). Tombol *Ganti Pengguna* tersedia untuk mereset cache dan kembali menampilkan form dua field bila perangkat dipakai pegawai berbeda. PIN diperbolehkan duplikat antar pegawai karena identifikasi dilakukan melalui kombinasi nama dan PIN — nama yang unik per pegawai berfungsi sebagai identifier, sedangkan PIN hanya sebagai kata sandi. Sistem tidak menampilkan daftar seluruh pegawai untuk dipilih; cache hanya menyimpan satu nama pegawai terakhir per perangkat.
> 2. Mengelola katalog menu yang mencakup nama, kategori, harga, klasifikasi jenis stok (porsi yang ditrack, varian yang berbagi stok, atau tanpa stok), batas minimum stok, dan definisi sub-pilihan untuk menu paket.
> 3. Mendukung dua tipe order: *dine-in* dengan pemilihan meja, dan *takeaway* tanpa meja. Sumber order takeaway (walk-in, GoFood, GrabFood, atau gosend) dibedakan melalui metode pembayaran, bukan melalui sub-tipe order yang terpisah.
> 4. Mendukung penambahan, perubahan, dan pembatalan item pesanan sebelum pembayaran dilakukan oleh kasir sebagai aktor utama yang menerima catatan pesanan kertas dari waiter dan menginputnya ke sistem. Waiter memiliki akses *fallback* untuk menginput pesanan langsung ke sistem apabila kasir sedang tidak tersedia. Pembatalan transaksi tidak memerlukan otorisasi khusus.
> 5. Mendukung pemecahan tagihan (*split bill*) per item per pelanggan menghasilkan beberapa struk terpisah, dan penggabungan tagihan (*merge bill*) dari beberapa meja menjadi satu struk dengan mekanisme *self-reference* pada transaksi sumber. Kedua mekanisme ini dilakukan oleh kasir saja, tidak diakses oleh waiter.
> 6. Menyediakan mekanisme sub-pilihan dinamis untuk menu paket: kasir (atau waiter sebagai *fallback*) memilih variant (misalnya paha atau dada, bakar atau goreng) saat menambahkan paket ke pesanan, dan sistem mengurangi stok porsi sesuai pilihan tersebut.
> 7. Memproses pembayaran dengan enam metode (cash, EDC, QRIS, Gojek, Grab, transfer) yang dilakukan oleh kasir saja (waiter tidak memiliki akses ke pembayaran), dengan input bank pendamping khusus untuk metode EDC dan transfer agar laporan rekonsiliasi dapat dilakukan per bank. Pajak PB1 sepuluh persen ditambahkan otomatis, diskon manual didukung, dan struk pembayaran dicetak dalam format PDF yang disimpan ke perangkat kasir.
> 8. Melakukan pengurangan stok porsi secara otomatis saat pesanan diinput ke POS (bukan saat pembayaran), dengan memperbolehkan stok bernilai negatif untuk mengakomodasi situasi habis di tengah hari.
> 9. Mencatat masuknya stok darurat (fitur "Barang Masuk") saat pemilik mengirim restock dari rumah pada tengah hari, dengan dukungan input kelipatan lima porsi dan dokumentasi detail breakdown.
> 10. Memungkinkan restock pagi stok porsi dengan formula kelipatan lima yang menjaga stok akhir di atas batas minimum.
> 11. Menyediakan fitur opname untuk koreksi nilai stok porsi (pagi, setelah restock) dan raw materials (malam, sebelum tutup) ketika kondisi sistem menyimpang dari realita fisik, dengan jejak audit yang mencatat selisih dan pelaku koreksi.
> 12. Mencatat kondisi raw materials secara fleksibel dengan field `is_tracked` yang membedakan bahan yang stok-nya bertambah otomatis saat pembelian (beras, sayur, tahu, tempe, telur) dan bahan yang hanya dicatat sebagai log pengeluaran (cabai, bawang, kemiri, dan bumbu kering lain). Field `freshness_days` opsional digunakan untuk bahan perishable seperti sayur dan petai dengan reminder mendekati hari batas kesegaran.
> 13. Melakukan tutup kasir akhir hari oleh kasir shift malam saja, dengan rekap sederhana enam total metode pembayaran (sistem dan fisik) beserta rincian per bank untuk EDC dan transfer, dan perhitungan variansnya per metode.
> 14. Mencatat pembelian belanja kasir di pasar dengan struktur header dan detail item ternormalisasi yang terhubung ke `raw_materials` via foreign key, ditambah field vendor opsional. Saat pembelian disubmit, sistem otomatis memperbarui `stock_qty`, `last_buy_date`, dan `unit_price` raw material terkait apabila item bertanda `is_tracked`.
> 15. Mencatat tagihan operasional bulanan (kebersihan, listrik, air, parkir, sewa) yang hanya dapat diakses oleh Pemilik.
> 16. Menyediakan dashboard masing-masing peran dengan reminder stok porsi yang menipis dan raw materials yang perlu restock atau mendekati batas kesegaran, serta laporan periodik pendapatan, pengeluaran, dan laba kotor bagi Pemilik.
> 17. Menyimpan jejak audit untuk seluruh perubahan kondisi stok porsi maupun raw materials melalui dua tabel log terpisah (`portion_movements` dan `raw_material_movements`) yang mencatat delta perubahan, alasan (order, restock pagi, restock darurat, pembelian, opname, atau penyesuaian manual), pengguna pelaku, dan waktu kejadian, sehingga pemilik dapat menelusuri kapan dan oleh siapa setiap perubahan stok terjadi.
> 18. Menerapkan pembatasan akses (otorisasi) per peran pada tingkat fungsional sesuai matriks kewenangan: pemilik memiliki akses penuh terhadap seluruh fitur termasuk tagihan operasional bulanan dan pengelolaan data master; kasir memiliki akses ke pengelolaan transaksi (input order, pembayaran, split/merge bill, void), pengelolaan stok (restock, barang masuk, opname), pencatatan pembelian belanja, serta buka dan tutup kasir; sedangkan waiter memiliki akses ke pengelolaan stok dan opname seperti kasir, ditambah akses *fallback* untuk menginput pesanan ke sistem hanya bila kasir sedang tidak tersedia. Waiter tidak memiliki akses ke proses pembayaran, settlement akhir hari, pencatatan pembelian, maupun tagihan operasional. Pembatasan ini diterapkan baik di sisi antarmuka (tombol/halaman tersembunyi sesuai peran) maupun di sisi *endpoint* basis data (validasi peran pengguna).

### Kebutuhan Non-Fungsional

> Selain kebutuhan fungsional, sistem juga harus memenuhi kebutuhan non-fungsional berikut:
>
> 1. **Kemudahan penggunaan** — antarmuka harus dapat dioperasikan oleh pegawai non-teknis dengan minimal pelatihan, mengingat kasir merupakan anggota keluarga pemilik yang bukan pengguna teknologi mahir, dan waiter dilatih cepat untuk membantu input order.
> 2. **Aksesibilitas mobile-first sebagai PWA** — aplikasi diakses melalui peramban pada telepon seluler dengan dukungan instalasi *progressive web app* ke layar utama, mengingat restoran tidak memiliki komputer maupun jaringan WiFi internal.
> 3. **Konektivitas berbasis paket data atau WiFi tetangga** — sistem harus tetap responsif pada koneksi yang tidak stabil.
> 4. **Keamanan akses dengan pembatasan per peran** — fitur input tagihan bulanan hanya dapat diakses oleh Pemilik meskipun kasir merupakan anggota keluarga.
> 5. **Konsistensi dan jejak audit perubahan stok** — setiap perubahan stok porsi (akibat order, restock pagi, restock darurat, atau penyesuaian manual via opname) tercatat di log audit yang menyimpan alasan, kuantitas, dan pengguna pelakunya.
> 6. **Kecepatan respons** — proses pembayaran satu transaksi tidak melebihi 30 detik sejak kasir menekan tombol bayar hingga konfirmasi muncul.

---

## 3.1.4 Batasan Penelitian — HPP dan Laba Rugi (Out of Scope)

> Perhitungan harga pokok produksi (HPP) per porsi memerlukan data konsumsi bahan baku yang terukur dan tercatat secara akurat untuk setiap siklus produksi. Namun, pada restoran kecil berbasis keluarga seperti objek penelitian ini, proses memasak dilakukan secara batch tanpa penimbangan bahan yang baku, dan komposisi peracikan bumbu bersifat tidak tetap serta tidak terdokumentasi. Hal ini menyebabkan data input yang dibutuhkan untuk menghitung HPP tidak tersedia secara konsisten, sehingga hasil perhitungan yang dihasilkan berpotensi tidak akurat dan menyesatkan. Oleh karena itu, fitur pencatatan HPP tidak dimasukkan ke dalam ruang lingkup sistem ini, agar sistem tetap relevan, mudah digunakan, dan sesuai dengan kapasitas operasional pengguna sasaran.
>
> Pelacakan laba rugi pada sistem ini dilakukan melalui pencatatan total pendapatan harian yang diperoleh dari rekapitulasi transaksi, serta pencatatan pengeluaran operasional secara agregat per periode. Pendekatan ini dipilih karena sesuai dengan karakteristik restoran kecil yang tidak melakukan *standard costing*, namun tetap membutuhkan gambaran arus kas dan profitabilitas secara periodik.

---

## 3.2.1 Proses Bisnis yang Diusulkan

> Sistem yang diusulkan mengubah proses bisnis restoran dari pencatatan manual berbasis buku menjadi pencatatan terintegrasi berbasis aplikasi *progressive web app* dengan basis data tunggal sebagai acuan. Proses bisnis yang dikomputerisasi mencakup sepuluh alur utama berikut.
>
> **Pertama, autentikasi pengguna**, di mana setiap pegawai wajib login menggunakan kombinasi nama dan PIN enam digit. Saat pertama kali login di suatu perangkat, pegawai mengisi nama pengguna pada *field* teks dan PIN pada *numpad* enam digit, lalu menekan tombol kirim; sistem memvalidasi kombinasi nama dan PIN — apabila benar, pegawai diarahkan ke halaman dashboard yang menyesuaikan dengan peran (Pemilik, Kasir, atau Waiter), sekaligus menyimpan nama pegawai tersebut di penyimpanan lokal perangkat. Untuk login berikutnya di perangkat yang sama, sistem menampilkan layar PIN-only dengan nama pegawai terisi otomatis dari *cache* — pegawai cukup memasukkan PIN enam digit dan sistem otomatis memverifikasi. Tombol *Ganti Pengguna* tersedia bila perangkat dipakai pegawai berbeda, yang akan mereset *cache* dan kembali menampilkan form dua *field*. Apabila kombinasi nama dan PIN salah, sistem menampilkan pesan kesalahan dan pegawai mengulang pengisian PIN. PIN diperbolehkan duplikat antar pegawai karena identifikasi dilakukan melalui kombinasi nama dan PIN.
>
> **Kedua, restock stok porsi pagi**, di mana waiter atau kasir mencatat jumlah restock per item stok porsi berdasarkan stok yang dibawa pagi dari rumah pemilik. Sistem menampilkan rekomendasi jumlah restock dalam kelipatan lima berdasarkan formula yang menjaga stok akhir di atas batas minimum, sebagai pengganti pencatatan manual di buku.
>
> **Ketiga, opname stok porsi pagi**, di mana waiter atau kasir melakukan cek fisik stok porsi setelah restock pagi dicatat, kemudian mengoreksi nilai sistem apabila ditemukan selisih dengan kondisi fisik aktual. Aktivitas ini analog dengan rekonsiliasi cash, dilakukan untuk memastikan jumlah di sistem konsisten dengan jumlah nyata.
>
> **Keempat, pengelolaan pesanan**, di mana kasir atau waiter memilih tipe order (dine-in dengan pemilihan meja, atau takeaway tanpa meja), lalu menambahkan item dari katalog. Apabila item yang dipilih adalah paket dengan sub-pilihan, sistem menampilkan dialog pemilihan variant terlebih dahulu (misalnya paha atau dada, bakar atau goreng). Stok porsi otomatis berkurang saat pesanan disimpan, dan diperbolehkan menjadi negatif untuk mengakomodasi situasi habis di tengah hari.
>
> **Kelima, pencatatan barang masuk**, di mana saat pemilik mengirim restock darurat dari rumah pada tengah hari (via Gojek, Grab, atau antar pribadi), kasir mencatat jumlah barang yang datang dan sistem otomatis menambah stok porsi terkait, sehingga stok yang sempat negatif kembali ke nilai positif.
>
> **Keenam, pembayaran**, di mana kasir memilih metode pembayaran dari enam opsi (cash, EDC, QRIS, Gojek, Grab, transfer). Untuk metode EDC dan transfer, sistem menampilkan input bank dengan autocomplete dari riwayat bank sebelumnya agar laporan rekonsiliasi dapat dilakukan per bank. Sistem menambahkan pajak PB1 sepuluh persen secara otomatis, dan mendukung diskon manual. Sistem juga menyediakan dukungan *split bill* (pemecahan tagihan per item per pelanggan menghasilkan beberapa struk) dan *merge bill* (penggabungan tagihan dari beberapa meja menjadi satu struk via mekanisme self-reference). Struk dicetak dalam format PDF dan disimpan ke perangkat kasir.
>
> **Ketujuh, opname raw materials malam**, di mana waiter di akhir shift malam melakukan cek fisik bahan baku yang ditrack (beras, sayur, petai, tahu, tempe, telur), mengoreksi nilai sistem apabila perlu, dan opsional memperbarui tanggal pembelian terakhir untuk bahan perishable. Sistem menampilkan reminder otomatis untuk bahan yang sudah menyentuh ambang restock atau mendekati batas kesegaran.
>
> **Kedelapan, tutup kasir akhir hari** oleh kasir shift malam saja, di mana sistem menampilkan total penjualan per enam metode pembayaran beserta rincian per bank untuk EDC dan transfer, kasir memasukkan jumlah fisik per metode, dan sistem menghitung variansnya untuk dokumentasi rekonsiliasi.
>
> **Kesembilan, pencatatan pembelian belanja kasir**, di mana kasir mencatat log belanja di pasar dengan struktur ternormalisasi: header pembelian (tanggal, vendor opsional, total) dan detail item per baris yang merujuk ke raw material via foreign key. Apabila item yang dibeli adalah raw material baru yang belum terdaftar di sistem, kasir dapat menambahkannya secara *inline* tanpa keluar dari form pembelian. Saat pembelian disimpan, sistem otomatis memperbarui kondisi stok raw materials terkait beserta tanggal pembelian terakhir dan harga satuan.
>
> **Kesepuluh, pencatatan tagihan operasional bulanan** oleh Pemilik dengan kategori (kebersihan, listrik, air, parkir, atau sewa) dan nominal, sebagai pengganti tempelan struk pada buku pencatatan lama. Fitur ini hanya dapat diakses oleh Pemilik meskipun kasir merupakan anggota keluarga.

---

## 3.2.2 Use Case Diagram

> *Use case diagram* pada Gambar 3.1 mendeskripsikan interaksi antara pengguna dengan Sistem POS Restoran. Sistem melibatkan tiga aktor — Pemilik (*Owner*), Kasir, dan Waiter — yang berinteraksi dengan dua puluh *use case* yang terbagi dalam empat domain.
>
> Domain pertama adalah autentikasi melalui *use case* `Login` yang wajib dilakukan oleh seluruh aktor. Domain kedua adalah operasional transaksi yang mencakup `Buka Kasir`, `Mengelola Pesanan Meja` (dua tipe order: dine-in dan takeaway), `Memilih Sub-Pilihan Paket`, `Memecah Tagihan`, `Menggabungkan Tagihan`, `Membatalkan Pesanan`, `Memproses Pembayaran` (dengan input bank untuk EDC dan transfer), `Mencetak Struk`, dan `Tutup Kasir`. Domain ketiga adalah manajemen stok yang mencakup `Restock Stok Porsi` (pagi, kelipatan lima), `Mencatat Barang Masuk` (restock darurat tengah hari), `Melakukan Opname Stok Porsi` (pagi setelah restock), dan `Melakukan Opname Raw Materials` (malam sebelum tutup). Domain keempat adalah administrasi dan laporan yang mencakup `Mencatat Pembelian` (kasir, dengan vendor opsional dan items ternormalisasi), `Mengelola Menu`, `Mengelola Pengguna`, `Mencatat Tagihan Bulanan` (Pemilik), `Mereview Settlement`, dan `Melihat Dashboard dan Laporan`.
>
> Hubungan `<<include>>` ditunjukkan dari setiap *use case* operasional ke `Login`, menandakan bahwa autentikasi merupakan prasyarat wajib (sembilan belas hubungan include). Hubungan `<<extend>>` digunakan pada tiga skenario opsional: `Mencetak Struk` ke `Memproses Pembayaran` (struk dicetak hanya apabila pelanggan meminta), `Memilih Sub-Pilihan Paket` ke `Mengelola Pesanan Meja` (sub-pilihan muncul hanya apabila item yang ditambahkan adalah paket), dan `Memecah Tagihan` ke `Memproses Pembayaran` (split bill dilakukan hanya apabila pelanggan meminta bill terpisah per pelanggan). Master data sekunder seperti `vendors` dan `raw_materials` di-manage secara implicit melalui form `Mencatat Pembelian` (kasir dan pemilik dapat menambah secara *inline*) dan halaman list yang accessible Pemilik, sehingga tidak dibuat sebagai *use case* top-level demi menjaga keterbacaan diagram.

**Gambar 3.1** *Use Case Diagram Sistem POS Restoran*
*(File: `docs/diagrams/use-case-diagram-sistem-pos-restoran.png`)*

---

## 3.2.3 Activity Diagram

> *Activity diagram* digunakan untuk menggambarkan alur kerja proses bisnis utama yang teridentifikasi pada *use case diagram*. Setiap *activity diagram* menggunakan *swimlane* (partisi vertikal) untuk memisahkan tanggung jawab antara aktor dan sistem. Setiap aksi dinyatakan dalam bahasa bisnis yang mudah dipahami oleh pegawai non-teknis. Setiap titik keputusan diberi label pertanyaan dengan jawaban `Ya` atau `Tidak` pada masing-masing cabang. Sub-bab berikut menjelaskan sebelas *activity diagram* yang dirancang untuk sistem ini.

### 3.2.3.1 Activity Diagram Login

> Gambar 3.2 menjelaskan alur proses login. Aktor (Pemilik, Kasir, atau Waiter) membuka aplikasi POS, lalu sistem menampilkan formulir login berisi dua *field*: nama pengguna dan PIN enam digit. Aktor mengetik nama pengguna mereka secara manual dan memasukkan PIN, lalu menekan tombol kirim. Sistem melakukan validasi dengan mencari pengguna berdasarkan nama yang dimasukkan dan mencocokkan PIN — PIN diperbolehkan duplikat antar pegawai karena identifikasi dilakukan melalui kombinasi nama dan PIN, dengan nama yang unik per pegawai berfungsi sebagai identifier dan PIN sebagai kata sandi. Apabila kombinasi nama dan PIN tidak cocok, sistem menampilkan pesan kesalahan dan aktor mengulang pengisian. Apabila cocok, sistem mengarahkan aktor ke halaman dashboard yang menyesuaikan dengan peran pengguna. Aktivitas ini tidak menggunakan layar pemilihan nama dari daftar maupun mekanisme penyimpanan nama pengguna terakhir di perangkat — setiap login pegawai mengetik nama mereka manual, sesuai realita restoran kecil keluarga di mana satu perangkat dapat dipakai bergantian oleh beberapa pegawai dalam satu shift.

**Gambar 3.2** *Activity Diagram Login*
*(File: `docs/diagrams/activity-diagram-login.png`)*

### 3.2.3.2 Activity Diagram Order Flow

> Gambar 3.3 menjelaskan alur pengelolaan pesanan dengan tiga *swimlane*: Waiter, Kasir, dan Sistem. Untuk pesanan *dine-in*, waiter menerima pesanan secara verbal dari pelanggan di meja, mencatatnya di kertas, dan menyerahkan catatan tersebut ke kasir melalui dapur restoran (yang menyiapkan makanan dari stok beku jadi). Kasir kemudian memilih tipe order *dine-in* di sistem dan memilih nomor meja — sistem akan memeriksa apakah meja sudah memiliki transaksi yang masih terbuka sebelumnya dan menggabungkan dengan pesanan yang sudah ada bila perlu, mengakomodasi praktik pelanggan dine-in yang menambah pesanan beberapa kali dalam satu sesi makan. Untuk pesanan *takeaway* (baik pelanggan walk-in yang datang langsung minta dibungkus, maupun pesanan yang masuk dari aplikasi GoFood atau GrabFood), kasir langsung memilih tipe *takeaway* di sistem tanpa pemilihan meja dan tanpa perantara waiter. Sumber order takeaway tidak dipilah pada tahap ini karena akan dibedakan melalui metode pembayaran di tahap berikutnya. Apabila kasir sedang tidak tersedia (misalnya sedang menelepon pemilik untuk koordinasi restock atau sedang menangani urusan operasional lain), waiter dapat menginput pesanan langsung ke sistem sebagai jalur *fallback* dengan akun POS-nya sendiri — diagram pada Gambar 3.3 menggambarkan alur *primary*, sedangkan alur *fallback* memiliki langkah-langkah identik dengan jalur kasir, hanya saja aktor pada *swimlane* berbeda.
>
> Setelah tipe order dipilih, sistem menampilkan grid katalog menu. Saat aktor memilih item, sistem memeriksa apakah item tersebut merupakan paket dengan sub-pilihan dinamis. Apabila ya, sistem menampilkan dialog pemilihan variant (misalnya paha atau dada, bakar atau goreng, jenis minuman). Berdasarkan pilihan tersebut, sistem memetakan ke stok porsi target yang akan berkurang. Apabila item bukan paket, sistem langsung menggunakan item itu sendiri. Item lalu ditambahkan ke keranjang. Setelah selesai menambahkan semua item, aktor menyimpan pesanan, dan sistem mengurangi stok porsi untuk setiap item dengan jenis stok porsi atau berbagi stok (boleh menjadi negatif) sekaligus mencatat log audit perubahan stok pada `portion_movements`.

**Gambar 3.3** *Activity Diagram Order Flow*
*(File: `docs/diagrams/activity-diagram-order-flow.png`)*

### 3.2.3.3 Activity Diagram Pay Flow

> Gambar 3.4 menjelaskan alur pembayaran pesanan. Kasir memilih opsi bayar untuk transaksi yang masih terbuka, kemudian sistem menampilkan rincian: subtotal, diskon (yang dapat diisi manual oleh kasir), pajak PB1 10% yang otomatis dihitung dari subtotal dikurangi diskon, dan total akhir. Sistem menampilkan enam metode pembayaran yang tersedia (cash, EDC, QRIS, Gojek, Grab, transfer) — semua metode tersedia untuk kedua tipe order karena sumber takeaway dibedakan dari metode pembayaran yang dipilih.
>
> Kasir memilih metode pembayaran. Apabila metode adalah EDC atau transfer, sistem menampilkan input bank pendamping dengan autocomplete dari riwayat bank sebelumnya (misalnya BCA, Mandiri, BRI) — input ini wajib karena Pemilik membutuhkan laporan rekonsiliasi per bank untuk mutasi rekening. Apabila metode adalah cash, sistem meminta input jumlah uang diterima dan memvalidasi kecukupan nominal — jika kurang, alur kembali ke input. Setelah validasi lolos, sistem menandai pesanan sebagai lunas. Jika pelanggan meminta split bill, sistem mengalihkan ke alur pemecahan tagihan (Gambar 3.12) yang menghasilkan beberapa struk terpisah. Jika pelanggan meminta cetak struk, sistem menghasilkan struk dalam format PDF dan menyimpannya ke perangkat kasir. Sistem akhirnya menampilkan konfirmasi pembayaran beserta jumlah kembalian apabila pembayaran cash.

**Gambar 3.4** *Activity Diagram Pay Flow*
*(File: `docs/diagrams/activity-diagram-pay-flow.png`)*

### 3.2.3.4 Activity Diagram Restock Stok Porsi Pagi

> Gambar 3.5 menjelaskan alur restock pagi yang dilakukan oleh waiter atau kasir setelah pemilik mengirim stok dari rumah. Aktor membuka halaman Stok Porsi, lalu sistem menampilkan 25 item stok porsi dengan informasi: kondisi stok saat ini, batas minimum, dan rekomendasi jumlah restock yang dihitung dengan formula pembulatan ke atas dari selisih batas minimum dan stok saat ini dibagi lima, dikalikan lima (sehingga restock selalu dalam kelipatan lima dan menjaga stok akhir di atas batas minimum). Aktor memasukkan jumlah restock per item (umumnya mengikuti rekomendasi), lalu sistem memperbarui kondisi stok dan mencatat log audit dengan alasan "restock pagi".

**Gambar 3.5** *Activity Diagram Restock Stok Porsi Pagi*
*(File: `docs/diagrams/activity-diagram-restock-stok-porsi-pagi.png`)*

### 3.2.3.5 Activity Diagram Mencatat Barang Masuk

> Gambar 3.6 menjelaskan alur pencatatan barang masuk untuk restock darurat di tengah hari. Apabila stok porsi habis di tengah jam operasional (misalnya ayam bakar atau goreng yang sering habis), kasir menghubungi pemilik di rumah. Pemilik kemudian mengirim stok ke restoran melalui Gojek, Grab, atau diantar sendiri. Saat barang sampai, kasir atau waiter membuka halaman Stok Porsi dan menekan tombol Barang Masuk, lalu sistem menampilkan daftar item stok porsi beserta kondisi stoknya saat ini. Aktor memasukkan jumlah barang yang datang per item (umumnya dalam kelipatan lima) beserta catatan opsional (misalnya "Antar via Gojek 18:30, ayam bakar 5 + paha bakar 10"). Sistem kemudian menambahkan jumlah tersebut ke stok porsi terkait (sehingga stok yang sempat negatif kembali ke nilai positif) dan mencatat log audit dengan alasan "restock darurat".

**Gambar 3.6** *Activity Diagram Mencatat Barang Masuk*
*(File: `docs/diagrams/activity-diagram-mencatat-barang-masuk.png`)*

### 3.2.3.6 Activity Diagram Opname Stok Porsi

> Gambar 3.7 menjelaskan alur opname stok porsi yang dilakukan kasir atau waiter, paling tepat di pagi hari setelah restock pagi dicatat. Aktor membuka halaman Stok Porsi dan menekan tombol Cek Fisik & Koreksi, lalu sistem menampilkan daftar 25 item dengan kondisi stok saat ini sebagai nilai default. Aktor mengecek kondisi fisik aktual di tempat penyimpanan, lalu memasukkan jumlah fisik untuk item yang berbeda dari kondisi sistem. Saat aktor menyimpan, sistem menghitung selisih per item, memperbarui kondisi stok ke jumlah fisik aktual, dan mencatat log audit dengan alasan "penyesuaian manual" beserta catatan selisih positif atau negatif. Aktivitas ini dirancang sebagai analog terhadap rekonsiliasi kas akhir shift — meskipun sistem sudah mencatat semua transaksi, tetap diperlukan verifikasi fisik untuk mendeteksi kebocoran (tumpah, busuk, salah catat) yang tidak terekam pada transaksi normal.

**Gambar 3.7** *Activity Diagram Opname Stok Porsi*
*(File: `docs/diagrams/activity-diagram-opname-stok-porsi.png`)*

### 3.2.3.7 Activity Diagram Opname Raw Materials

> Gambar 3.8 menjelaskan alur opname *raw materials* (bahan baku) yang dilakukan oleh waiter atau kasir di malam hari sebelum restoran tutup. Tujuan opname ini adalah agar pemilik mengetahui bahan baku apa yang perlu dibeli besok pagi. Aktor membuka halaman Raw Materials dan memfilter item yang `is_tracked` bernilai benar (mis. beras, kangkung, petai, tahu, tempe, telur), lalu sistem menampilkan kondisi stok saat ini per item beserta satuan dan kategori. Aktor mengecek kondisi fisik per item, memasukkan jumlah fisik aktual untuk item yang berbeda dari sistem, dan opsional memperbarui tanggal pembelian terakhir untuk bahan perishable seperti sayur apabila pembelian terakhir tidak terekam di sistem. Sistem kemudian memperbarui `stock_qty` dan `last_buy_date` raw material terkait, lalu menampilkan ringkasan kondisi malam beserta reminder untuk pagi (misalnya "Kangkung 0 ikat → beli besok pagi 2 ikat" atau "Beras skala 1 → beli besok 1 karung").

**Gambar 3.8** *Activity Diagram Opname Raw Materials*
*(File: `docs/diagrams/activity-diagram-opname-raw-materials.png`)*

### 3.2.3.8 Activity Diagram Tutup Kasir

> Gambar 3.9 menjelaskan alur tutup kasir akhir hari yang dilakukan oleh kasir shift malam saja, sekali dalam satu hari. Kasir mengklik tombol Tutup Kasir, lalu sistem memeriksa apakah masih ada pesanan yang belum dibayar. Apabila ada, sistem menampilkan peringatan dan daftar meja yang masih terbuka, serta meminta kasir menyelesaikan pembayaran terlebih dahulu — alur berakhir lebih awal. Apabila tidak ada, sistem menghitung total penjualan per enam metode pembayaran (cash, EDC, QRIS, Gojek, Grab, transfer) berdasarkan data transaksi pada hari tersebut beserta rincian per bank untuk EDC dan transfer (misalnya EDC BCA 200K, EDC Mandiri 150K), kemudian menampilkan form rekap dengan dua kolom: total dari sistem dan input total fisik dari kasir.
>
> Kasir mengisi total fisik untuk masing-masing dari enam metode (cash dihitung dari laci kas, sementara EDC, QRIS, Gojek, Grab, dan transfer dihitung dari mutasi rekening atau aplikasi merchant). Sistem menghitung varians per metode sebagai selisih antara total fisik dan total sistem, lalu menampilkan ringkasan rekap beserta total varians keseluruhan. Setelah kasir mengkonfirmasi, sistem menyimpan hasil rekap ke tabel `settlements` dan menutup shift dengan menandai waktu penutupan.

**Gambar 3.9** *Activity Diagram Tutup Kasir*
*(File: `docs/diagrams/activity-diagram-tutup-kasir.png`)*

### 3.2.3.9 Activity Diagram Mencatat Pembelian

> Gambar 3.10 menjelaskan alur kasir atau pemilik dalam mencatat pembelian belanja di pasar dengan struktur ternormalisasi. Setelah pulang belanja, aktor membuka halaman Pembelian dan menambah entri baru. Sistem menampilkan formulir dengan kolom tanggal (default hari ini), pemilihan vendor (opsional — dapat dilewati atau menambah vendor baru secara *inline* karena di pasar kadang penjual perorangan tidak tercatat namanya), dan daftar item dinamis. Untuk setiap baris item, aktor memilih raw material dari dropdown autocomplete; apabila raw material yang dibeli belum terdaftar, aktor dapat menambahkannya secara *inline* dengan mini-form berisi nama, satuan, kategori, dan status ditrack. Aktor kemudian memasukkan kuantitas dan harga satuan, dan sistem otomatis menghitung subtotal per baris dan total keseluruhan.
>
> Setelah aktor menyimpan, sistem memvalidasi keberadaan minimal satu item dan kuantitas positif. Apabila valid, sistem membuat record header pembelian dan record detail per item dalam satu transaksi basis data. Untuk setiap item dengan raw material yang berstatus ditrack, sistem otomatis memperbarui kondisi stok (`stock_qty += qty`), tanggal pembelian terakhir, dan harga satuan terakhir di tabel `raw_materials`. Sistem kemudian menampilkan konfirmasi beserta ringkasan update kondisi raw materials. Untuk item bumbu dasar yang banyak baris (cabai, bawang, kemiri, dan sejenisnya), laporan pemilik mengelompokkan menjadi satu baris agregat "Bumbu Dasar" dengan rincian per item tetap dapat ditelusuri.

**Gambar 3.10** *Activity Diagram Mencatat Pembelian*
*(File: `docs/diagrams/activity-diagram-mencatat-pembelian.png`)*

### 3.2.3.10 Activity Diagram Mencatat Tagihan Bulanan

> Gambar 3.11 menjelaskan alur Pemilik dalam mencatat tagihan operasional bulanan. Pemilik membuka halaman Tagihan (kasir tidak memiliki akses ke halaman ini meskipun kasir merupakan anggota keluarga, baik di sisi *user interface* maupun *endpoint* basis data). Sistem menampilkan formulir dengan kolom bulan (dalam format YYYY-MM), kategori (kebersihan, listrik, air, parkir, atau sewa), jumlah nominal, dan catatan opsional. Pemilik mengisi data, lalu sistem memvalidasi input. Apabila tidak valid (misalnya jumlah kosong atau peran bukan Pemilik), sistem menampilkan pesan kesalahan. Apabila valid, sistem menyimpan tagihan dan menampilkan daftar tagihan bulan ini beserta total.

**Gambar 3.11** *Activity Diagram Mencatat Tagihan Bulanan*
*(File: `docs/diagrams/activity-diagram-mencatat-tagihan.png`)*

### 3.2.3.11 Activity Diagram Split Bill dan Merge Bill

> Gambar 3.12 menjelaskan dua alur terkait: pemecahan tagihan (*split bill*) dan penggabungan tagihan (*merge bill*).
>
> **Alur split bill** dimulai saat kasir berada di dialog pembayaran dan pelanggan meminta tagihan dipisah per pelanggan. Kasir menekan opsi Split Bill, lalu sistem menampilkan daftar semua item dan tombol untuk menambah pelanggan baru (misalnya Pelanggan A, Pelanggan B). Kasir mengelompokkan item ke pelanggan masing-masing — setiap item dapat ditandai sebagai milik pelanggan tertentu via *party id*. Sistem menghitung total per pelanggan (subtotal beserta proporsi diskon dan PB1). Kasir kemudian memproses pembayaran satu per satu per pelanggan, dengan metode pembayaran dan bank yang bisa berbeda antar pelanggan, dan sistem menghasilkan struk PDF terpisah untuk masing-masing.
>
> **Alur merge bill** dimulai saat kasir berada di halaman Meja dan rombongan dari beberapa meja meminta bayar bersama. Kasir menekan opsi Merge Bill, lalu sistem menampilkan daftar meja yang sedang terisi. Kasir memilih dua atau lebih meja yang akan digabung, dan sistem menampilkan keranjang gabungan berisi semua item dari transaksi-transaksi tersebut. Setelah kasir mengkonfirmasi, sistem membuat transaksi parent baru sebagai gabungan, lalu menandai transaksi sumber dengan *self-reference* `merged_into_id` agar jejak audit tetap terjaga. Kasir kemudian memproses pembayaran normal untuk transaksi parent yang sudah digabung tersebut (bisa juga dipecah lebih lanjut dengan split bill).

**Gambar 3.12** *Activity Diagram Split Bill dan Merge Bill*
*(File: `docs/diagrams/activity-diagram-split-merge-bill.png`)*

---

## 3.2.4 Entity Relationship Diagram

> Struktur penyimpanan data sistem dirancang dengan pendekatan basis data relasional yang digambarkan dalam *Entity Relationship Diagram* pada Gambar 3.13 menggunakan notasi *crow's-foot*.

**Gambar 3.13** *Entity Relationship Diagram Sistem POS Restoran*
*(File: `docs/diagrams/erd-sistem-pos-restoran.png`)*

> Sistem terdiri atas empat belas entitas utama. Entitas `users` menyimpan data seluruh pengguna beserta peran (Pemilik, Kasir, atau Waiter) dan PIN autentikasi yang diperbolehkan duplikat antar pegawai karena identifikasi dilakukan via nama. Entitas `menus` menyimpan master katalog 60 menu beserta klasifikasi jenis stok (porsi yang ditrack, varian yang berbagi stok dengan menu lain, atau tanpa stok), batas minimum stok, dan definisi sub-pilihan dalam format JSON untuk menu paket. Entitas `portion_stocks` menyimpan kondisi stok porsi terkini per menu sebagai *live count* yang terus berubah seiring transaksi (dengan dukungan nilai negatif untuk mengakomodasi situasi habis di tengah hari) beserta kondisi awal hari (*opening qty*) yang otomatis di-snapshot saat pengguna pertama login pagi — kondisi ini dipakai untuk menghitung metric "terjual hari ini" pada dashboard. Entitas `portion_movements` menyimpan log audit setiap perubahan stok porsi beserta alasannya (akibat order, restock pagi, restock darurat, atau penyesuaian manual via opname).
>
> Entitas `raw_materials` menyimpan bahan baku dengan struktur fleksibel yang berisi field `is_tracked` untuk membedakan dua jenis bahan: bahan yang stok-nya bertambah otomatis saat pembelian dan muncul di reminder (beras, sayur, tahu, tempe, telur), serta bahan yang hanya dicatat sebagai log pengeluaran (cabai, bawang, kemiri, dan bumbu kering lainnya yang dikelompokkan di kategori `bumbu_dasar`). Field `freshness_days` opsional digunakan untuk bahan perishable seperti sayur dan petai dengan reminder mendekati hari batas kesegaran. Entitas `raw_material_movements` (penambahan baru pada revisi ini) menyimpan log audit setiap perubahan kondisi raw materials beserta delta perubahan, alasan (pembelian, opname, atau penyesuaian manual), pengguna pelaku, dan waktu kejadian — analog dengan `portion_movements` untuk stok porsi, sehingga setiap perubahan stok bahan baku dapat ditelusuri. Entitas `vendors` menyimpan data toko atau pasar tempat belanja yang dapat dikaitkan dengan pembelian secara opsional — pengisian vendor di tiap pembelian bersifat opsional karena di pasar kadang kasir lupa nama penjual atau penjualnya perorangan tanpa nomor telepon. Pencatatan pembelian dinormalisasi melalui dua entitas: `purchases` sebagai header (tanggal, vendor opsional, total) dan `purchase_items` sebagai detail per baris item dengan *foreign key* ke `raw_materials`; saat sebuah `purchase_item` disubmit, sistem otomatis memperbarui `raw_materials.stock_qty`, `last_buy_date`, dan `unit_price`, sekaligus menyisipkan record baru di `raw_material_movements` (reason=`purchase`) untuk audit trail.
>
> Entitas `shifts` mencatat siklus shift per kasir per hari per jenis (pagi atau malam) beserta modal awal laci kas. Entitas `transactions` menyimpan *header* pesanan dengan dua tipe order (dine-in atau takeaway), nomor meja yang opsional, status pesanan, metode pembayaran beserta nama bank pendamping yang terisi khusus untuk metode EDC dan transfer (agar laporan rekonsiliasi dapat dilakukan per bank), rincian nominal termasuk pajak PB1 10%, dan *self-reference* `merged_into_id` untuk mengakomodasi fitur merge bill. Entitas `transaction_items` sebagai entitas asosiatif (*junction*) antara menu dan transaksi yang menyimpan jumlah, harga *snapshot*, pilihan sub-options untuk paket, dan identifier pelanggan (*party id*) untuk dukungan split bill. Entitas `settlements` menyimpan hasil rekap akhir hari oleh kasir shift malam dengan enam total metode pembayaran (sistem dan fisik); rincian per bank untuk EDC dan transfer dihitung di *runtime* dari tabel transaksi sehingga tidak disimpan duplikat di tabel ini. Entitas `bills` menyimpan tagihan operasional bulanan yang hanya dapat diakses oleh Pemilik.
>
> Sistem memiliki sembilan belas relasi yang menghubungkan entitas-entitas tersebut, dengan dominasi relasi satu-ke-banyak (sebagai contoh, satu kasir dapat melakukan banyak transaksi), satu relasi satu-ke-satu antara `shifts` dan `settlements` di mana setiap shift malam menghasilkan tepat satu rekap, dan satu relasi *self-reference* pada `transactions` untuk merge bill. Relasi banyak-ke-banyak antara menu dan transaksi dijabarkan sebagai entitas asosiatif `transaction_items`, sementara relasi banyak-ke-banyak antara `raw_materials` dan `purchases` dijabarkan sebagai entitas asosiatif `purchase_items`. Sistem secara sengaja tidak menghubungkan `raw_materials` ke `portion_stocks` melalui *foreign key* (tidak ada Bill of Materials atau resep), sesuai keputusan perancangan bahwa HPP per porsi berada di luar lingkup sistem (lihat sub-bab 3.1.4 Batasan Penelitian). Detail atribut dan tipe data setiap entitas dijabarkan pada Tabel 3.2 hingga Tabel 3.15 di sub-bab berikutnya.

---

## 3.2.5 Data Dictionary

> Definisi rinci atribut, tipe data, dan keterangan untuk setiap entitas dijabarkan pada Tabel 3.2 hingga Tabel 3.15 berikut. Tipe data yang digunakan merujuk pada konvensi DBMS basis data relasional standar.

**Cara melengkapi:**

Buka [`docs/DATA-DICTIONARY.md`](../DATA-DICTIONARY.md) (PERLU UPDATE ke REV 2.3 — saat ini masih versi REV 1 dengan 8 entitas; perlu rewrite ke 14 entitas REV 2.2 — REV 2.3 tidak menambah entitas, hanya bump version). Untuk masing-masing entitas, tulis pengantar 1 kalimat lalu tempel tabel di bawahnya:

| Tabel | Entitas | Pengantar (paste-ready) |
|---|---|---|
| 3.2 | `users` | "Tabel `users` menyimpan data seluruh pengguna sistem POS yang terbagi dalam tiga peran (Pemilik, Kasir, Waiter) beserta PIN autentikasinya. PIN diperbolehkan duplikat antar pegawai karena identifikasi via nama. Definisi rinci atribut ditunjukkan pada Tabel 3.2." |
| 3.3 | `menus` | "Tabel `menus` menyimpan master katalog menu siap jual beserta harga, kategori, klasifikasi jenis stok, batas minimum stok, dan definisi sub-pilihan untuk menu paket. Definisi rinci atribut ditunjukkan pada Tabel 3.3." |
| 3.4 | `portion_stocks` | "Tabel `portion_stocks` menyimpan kondisi stok porsi terkini per menu sebagai *live count* (dengan dukungan nilai negatif) beserta kondisi awal hari (*opening qty*) yang otomatis di-snapshot saat pengguna pertama login pagi. Definisi rinci atribut ditunjukkan pada Tabel 3.4." |
| 3.5 | `portion_movements` | "Tabel `portion_movements` (revisi penyesuaian nama dari `stock_movements`) menyimpan log audit setiap perubahan stok porsi beserta alasan dan pengguna yang melakukannya. Definisi rinci atribut ditunjukkan pada Tabel 3.5." |
| 3.6 | `raw_materials` | "Tabel `raw_materials` menyimpan bahan baku dengan struktur fleksibel yang membedakan bahan ditrack dan bahan log pengeluaran via field `is_tracked`, dengan satuan, kategori, dan masa kesegaran opsional. Definisi rinci atribut ditunjukkan pada Tabel 3.6." |
| 3.7 | `raw_material_movements` | "Tabel `raw_material_movements` (penambahan baru pada revisi ini) menyimpan log audit setiap perubahan kondisi raw materials beserta delta perubahan, alasan (pembelian, opname, atau penyesuaian manual), pengguna pelaku, dan waktu kejadian, sebagai pasangan audit log untuk raw materials yang setara dengan `portion_movements` untuk stok porsi. Definisi rinci atribut ditunjukkan pada Tabel 3.7." |
| 3.8 | `vendors` | "Tabel `vendors` menyimpan data toko atau pasar tempat belanja yang dapat dikaitkan dengan pembelian secara opsional. Definisi rinci atribut ditunjukkan pada Tabel 3.8." |
| 3.9 | `shifts` | "Tabel `shifts` mencatat siklus shift per kasir per hari per jenis (pagi atau malam) beserta modal awal yang diinput saat buka kasir. Definisi rinci atribut ditunjukkan pada Tabel 3.9." |
| 3.10 | `transactions` | "Tabel `transactions` menyimpan *header* pesanan beserta tipe order, status, total, metode pembayaran beserta nama bank pendamping untuk EDC dan transfer, pajak PB1, dan *self-reference* untuk merge bill. Definisi rinci atribut ditunjukkan pada Tabel 3.10." |
| 3.11 | `transaction_items` | "Tabel `transaction_items` menyimpan rincian item per transaksi sebagai entitas asosiatif antara menu dan transaksi, lengkap dengan jumlah, harga *snapshot*, pilihan sub-options paket, dan identifier pelanggan untuk split bill. Definisi rinci atribut ditunjukkan pada Tabel 3.11." |
| 3.12 | `settlements` | "Tabel `settlements` menyimpan rekap akhir hari oleh kasir shift malam dengan enam total metode pembayaran sistem dan fisik. Definisi rinci atribut ditunjukkan pada Tabel 3.12." |
| 3.13 | `purchases` | "Tabel `purchases` menyimpan *header* pembelian belanja kasir di pasar (tanggal, vendor opsional, total, catatan), dengan detail per item dipisah ke tabel `purchase_items`. Definisi rinci atribut ditunjukkan pada Tabel 3.13." |
| 3.14 | `purchase_items` | "Tabel `purchase_items` menyimpan detail per baris item dalam satu pembelian dengan *foreign key* ke `raw_materials`, sehingga otomatis memperbarui kondisi stok bahan baku dan menyisipkan record audit di `raw_material_movements` saat pembelian disubmit. Definisi rinci atribut ditunjukkan pada Tabel 3.14." |
| 3.15 | `bills` | "Tabel `bills` menyimpan tagihan operasional bulanan yang hanya dapat diakses oleh Pemilik. Definisi rinci atribut ditunjukkan pada Tabel 3.15." |

> Untuk format tabel itu sendiri, langsung *copy-paste* dari `docs/DATA-DICTIONARY.md` (perlu update ke REV 2.3). Caption tabel pakai format `Tabel 3.X *Definisi Atribut Tabel <nama>*`.

---

## Tips Teknis Penulisan

1. **Caption gambar** di **bawah** gambar; **caption tabel** di **atas** tabel — konvensi UK Petra.
2. **Setiap gambar dan tabel WAJIB di-rujuk** di paragraf dengan kalimat seperti *"ditunjukkan pada Gambar 3.x"* atau *"seperti pada Tabel 3.x"*. Jangan letakkan gambar/tabel tanpa rujukan teks.
3. **Istilah teknis dimiringkan** (*italic*) saat pertama muncul: *swimlane*, *snapshot*, *live count*, *progressive web app*, *split bill*, *merge bill*, *self-reference*, *opening qty*, *foreign key*. Setelahnya boleh tegak.
4. **Bahasa pasif** untuk teks akademik: "*sistem dirancang untuk*", "*proses bisnis dilakukan*", bukan "*kita merancang*" atau "*kami melakukan*".
5. **Konsistensi penamaan aktor** — gunakan istilah Indonesia dengan istilah Inggris dalam tanda kurung saat pertama muncul: "*Pemilik (Owner)*", "*Waiter*". Setelahnya boleh pakai salah satunya saja.
6. **Tabel WAJIB dijelaskan dalam kalimat** di paragraf — bukan sekadar dilemparkan tanpa narasi (per Pedoman SIB hal. 6).

## Self-Check sebelum Submit Bab 3

- [ ] Numbering sudah sesuai pedoman: 3.1 Analisis (umbrella) → 3.1.1, 3.1.2, 3.1.3, 3.1.4 → 3.2 Desain Sistem (umbrella) → 3.2.1, 3.2.2, 3.2.3, 3.2.4, 3.2.5.
- [ ] 3.1.1 Analisis Permasalahan sudah ada (konten yang sudah kamu tulis).
- [ ] 3.1.2 Tabel kebutuhan informasi (Tabel 3.1) dirujuk di paragraf, lalu tabel ditampilkan, lalu dijelaskan dengan paragraf di bawahnya.
- [ ] 3.1.3 Kebutuhan Fungsional (18 item) + Non-Fungsional (6 item).
- [ ] 3.1.4 Batasan Penelitian — HPP dan Bill of Materials out of scope, dengan 2 paragraf justifikasi paste-ready.
- [ ] 3.2.1 Proses Bisnis yang Diusulkan: paragraf naratif sepuluh proses, tanpa figure.
- [ ] 3.2.2 Use Case Diagram (Gambar 3.1) dirujuk di paragraf pertama, lalu narasi tiga paragraf (20 UC, 3 actor, 19 include, 3 extend).
- [ ] 3.2.3 Activity Diagram sebelas sub-bab, masing-masing punya pengantar paragraf + Gambar 3.2 sampai 3.12.
- [ ] 3.2.4 ERD (Gambar 3.13) dirujuk di paragraf pengantar, lalu narasi empat belas entitas + sembilan belas relasi.
- [ ] 3.2.5 Data Dictionary: empat belas tabel di Tabel 3.2 hingga 3.15.
- [ ] Tidak ada penyebutan eksplisit Express, React, MySQL, JWT — istilah teknologi ditahan ke Bab 4. Yang boleh: "*basis data relasional*", "*aplikasi berbasis web*", "*progressive web app*".

---

## Catatan tentang Pedoman SIB

Pedoman SIB UK Petra menyebutkan **3.2.1 Blok Diagram Desain Sistem** dan **3.2.3 Pengolahan Data dan Metode** sebagai sub-bab yang umumnya ada. Kedua sub-bab tersebut **dilewatkan** atas arahan pembimbing yang membatasi cakupan diagram pada Bab 3 ini hanya pada *use case*, *activity*, dan ERD. Selain itu, *sequence diagram*, *class diagram*, dan *flowchart* juga tidak digunakan dalam Bab 3 ini sesuai arahan yang sama.

Pedoman juga menyebutkan bahwa "*Activity diagram boleh diletakkan di lampiran*". Pada draft ini, *activity diagram* tetap diletakkan pada main body (sub-bab 3.2.3) dengan sebelas sub-bab terpisah agar lebih mudah dirujuk dan dievaluasi oleh pembimbing. Apabila pembimbing meminta agar dipindahkan ke lampiran, pengantar pada 3.2.3 dapat diringkas menjadi satu paragraf yang merujuk pada Lampiran A.

---

## Perubahan REV 2.2 → REV 2.3 (permission matrix + login fix, no schema change)

| Aspek | REV 2.2 | REV 2.3 |
|---|---|---|
| Total entitas ERD | 14 | **14 (tetap)** — no schema change |
| Total relasi ERD | 19 | **19 (tetap)** — no schema change |
| Use Case count | 20 UC | **20 UC (tetap)** — annotation aktor diperjelas |
| Activity diagram count | 11 | **11 (tetap)** — A.2 tambah catatan *fallback* waiter, no visual change |
| Total Tabel data dictionary | 14 | **14 (tetap)** |
| Kebutuhan Fungsional | 17 item | **18 item** (+1 item #18 tentang permission matrix per peran) |
| FR #1 Login | "pilih nama dan input PIN... perangkat mengingat pengguna terakhir" (REV 2 awal) → **REV 2.3 form 2 field murni, no localStorage** → **REV 2.3.1 (final)**: cached-name UX. First login di device pakai form 2 *field*, login berikutnya PIN-only numpad (nama auto-fill dari cache `pos-auth.lastUserName`); tombol *Ganti Pengguna* reset cache. Cache simpan 1 nama per device (bukan daftar semua pegawai). |
| FR #4 Pesanan | "kasir atau waiter" (ambigu, dianggap co-equal) | **Kasir primary, waiter fallback only** bila kasir tidak tersedia |
| FR #5 Split/merge bill | Tidak ada anotasi aktor | **Kasir saja, tidak diakses waiter** |
| FR #6 Sub-pilihan paket | "kasir atau waiter" | **Kasir primary, waiter fallback** |
| FR #7 Pembayaran | Tidak ada anotasi aktor eksplisit | **Kasir saja (waiter tidak memiliki akses)** |
| Proses Bisnis "Pertama, autentikasi" | "memilih namanya dari daftar... perangkat akan mengingat pengguna terakhir" | **Form input nama + PIN, ketik manual setiap login** |
| 3.2.3.1 Activity Login narration | "mekanisme dua tahap... sistem memeriksa pengguna terakhir... daftar nama pegawai untuk dipilih" | **Form 2 *field* input nama + PIN, validasi kombinasi nama + PIN, redirect dashboard sesuai peran** |
| 3.2.3.2 Activity Order Flow narration | "kasir atau waiter" | **3 *swimlane*: Waiter (tulis kertas) \| Kasir (input ke POS) \| Sistem, dengan note *fallback* waiter** |
| Sumber otoritatif baru | — | [`docs/superpowers/specs/2026-05-24-permission-matrix-design.md`](../superpowers/specs/2026-05-24-permission-matrix-design.md) |
| Sumber otoritatif update | `docs/operasional-resto.md` (REV 2.2) | **`docs/operasional-resto.md` REV 2.3** dengan seksi "Permission Matrix" baru |

## Perubahan REV 2.1 → REV 2.2

| Aspek | REV 2.1 | REV 2.2 |
|---|---|---|
| Total Tabel data dictionary | 13 | **14** (+1 raw_material_movements) |
| Total Tabel keseluruhan (incl. Tabel 3.1) | 14 | **15** |
| Total entitas ERD | 13 | **14** (drop none, add raw_material_movements) |
| Total relasi ERD | 17 | **19** (+2: users→raw_material_movements, raw_materials→raw_material_movements) |
| Nama tabel audit stok porsi | `stock_movements` | **`portion_movements`** (rename, clarify scope) |
| Audit log raw materials | Tidak ada | **`raw_material_movements`** (BARU, analog dengan `portion_movements`) |
| Enum `StockMovementReason` | `order, restock_morning, restock_emergency, manual_adjust` | **`PortionMovementReason`** (rename) — values tetap + tambah `refund_void` |
| Enum baru | — | **`RawMaterialMovementReason`** (purchase, opname, manual_adjust) |
| Kebutuhan Fungsional | 16 item | **17 item** (+1 tentang audit log per kategori stok) |
| Alur opname raw materials | Update `stock_qty` saja | **Update `stock_qty` + insert log `raw_material_movements`** |
| Alur pembelian | Update `raw_materials.stock_qty/last_buy_date/unit_price` | **... + insert log `raw_material_movements` reason=`purchase`** |
| Use Case count | 20 UC | **20 UC (tetap)** — hanya note di UC opname/pembelian tentang audit log |
| Activity diagram count | 11 | **11 (tetap)** — step audit log ditambah di A.7 dan A.9 |

## Perubahan vs REV 2 (Diff lengkap)

| Aspek | REV 2 | REV 2.1 |
|---|---|---|
| Total Gambar | 12 | **13** (+1 Activity Opname Stok Porsi, +1 Activity Opname Raw Materials, −1 Activity Mencatat Stok Bahan) |
| Total Tabel data dictionary | 11 | **13** (+raw_materials, +vendors, +purchase_items, −bulk_stocks) |
| Total entitas ERD | 11 | **13** |
| Total relasi ERD | 13 | **17** |
| Total use case | 17 | **20** |
| Total activity diagram | 10 | **11** |
| Sub-bab 3.1.4 HPP out of scope | Tidak ada | **BARU — 2 paragraf justifikasi** |
| Tipe order (kebutuhan fungsional & UC & activity) | 4 jenis | **2 jenis** (dineIn/takeaway) |
| Payment + bank picker | Tidak ada | **BARU** (untuk EDC & transfer) |
| Merge bill mekanisme | Tidak detail | **Self-reference `merged_into_id`** |
| Raw materials structure | Rigid 5 jenis | **Fleksibel (is_tracked + category + unit)** |
| Vendor | Tidak ada | **Tabel baru, opsional** |
| Purchase items | JSON ad-hoc | **Normalized ke `purchase_items` dengan FK** |
| Opname stok porsi | Tidak ada UC/activity | **BARU — UC + activity dipisah** |
| Mencatat Stok Bahan (REV 2) | Rigid 5 jenis bahan | **REPLACE → Opname Raw Materials** (lebih fleksibel) |
