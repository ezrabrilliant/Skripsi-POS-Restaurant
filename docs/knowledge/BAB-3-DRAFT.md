# BAB 3 — Analisis dan Desain (Draft Paste-Ready, REV 2.13)

> 🚧 **REV 2.13 (2026-06-02) — diselaraskan ke sistem nyata + diagram StarUML hasil rebuild & verifikasi.** **Struktur mengikuti Pedoman Program SIB UK Petra** (`docs/Pedoman Program SIB.pdf`): 3.1 Analisis (3.1.1–3.1.3) + 3.2 Desain Sistem (3.2.1 Blok Diagram · 3.2.2 Use Case · 3.2.3 Activity · 3.2.4 ERD · 3.2.5 Pengolahan Data dan Metode). Sub-bab 3.2.5 dinyatakan **tidak berlaku** (sistem operasional-transaksional tanpa algoritma analitik). Diagram: **Blok Diagram + Use Case + Activity + ERD** (Sequence/Class/Flowchart tidak dipakai, arahan pembimbing).
>
> Sumber kebenaran: `backend/prisma/schema.prisma` (23 entitas) + `docs/knowledge/{ERD,USE-CASE,ACTIVITY}.md` REV 2.13 + `docs/operasional-resto.md`. Live: `monosuko.my.id`.
>
> **Perubahan utama vs draft REV 2.11:** ERD 10→**23 entitas** (≈39 FK); Use Case 19→**23 bubble** (21 dasar + 2 «extend»); Activity 9→**11 diagram** (A.1–A.11). Koreksi faktual: (1) *split bill* per-item/`party_id` dihapus → **split-tender**; (2) metode pembayaran jadi **master table** (`payment_methods`), `transactions` tanpa kolom `payment_method`/`payment_bank`; (3) subsistem belanja/vendor/raw-materials dihapus; (4) **PB1 owner-configurable 2-sumbu**, default nonaktif; (5) **settlement whole-business-day** (`@@unique(date)`, dinamis); (6) **shift REV 2.7** (window + `active_marker` + re-stamp); (7) **+Blok Diagram (3.2.1)** + Tutup Kasir & Setoran dipisah.
>
> ⚠️ **Perlu review thesis-level Ezra:** kehalusan prosa + ekspor PNG diagram + finalisasi caption. Penomoran Gambar konsisten: Blok 3.1 → Use Case 3.2 → Activity 3.3–3.13 → ERD 3.14 (14 Gambar).

---

## Pemetaan Gambar & Tabel

**Total: 14 Gambar + 12 Tabel** (1 tabel kebutuhan informasi + 11 tabel kamus data inti; skema penuh 23 entitas di `docs/DATA-DICTIONARY.md`).

| Gambar | Sub-bab | Judul | File screenshot |
|---|---|---|---|
| 3.1 | 3.2.1 | Blok Diagram Desain Sistem | `blok-diagram-desain-sistem.png` |
| 3.2 | 3.2.2 | Use Case Diagram | `use-case-diagram-sistem-pos-restoran.png` |
| 3.3 | 3.2.3 | Activity Diagram Login (A.1) | `activity-diagram-login.png` |
| 3.4 | 3.2.3 | Activity Diagram Mengelola Pesanan (A.2) | `activity-diagram-mengelola-pesanan.png` |
| 3.5 | 3.2.3 | Activity Diagram Memproses Pembayaran (A.3) | `activity-diagram-memproses-pembayaran.png` |
| 3.6 | 3.2.3 | Activity Diagram Buka Kasir (A.4) | `activity-diagram-buka-kasir.png` |
| 3.7 | 3.2.3 | Activity Diagram Tutup Kasir (A.5) | `activity-diagram-tutup-kasir.png` |
| 3.8 | 3.2.3 | Activity Diagram Setoran Akhir Hari (A.6) | `activity-diagram-setoran-akhir-hari.png` |
| 3.9 | 3.2.3 | Activity Diagram Restock Stok Porsi Pagi (A.7) | `activity-diagram-restock-stok-porsi-pagi.png` |
| 3.10 | 3.2.3 | Activity Diagram Mencatat Barang Masuk (A.8) | `activity-diagram-mencatat-barang-masuk.png` |
| 3.11 | 3.2.3 | Activity Diagram Opname Stok Porsi (A.9) | `activity-diagram-opname-stok-porsi.png` |
| 3.12 | 3.2.3 | Activity Diagram Mencatat Tagihan Bulanan (A.10) | `activity-diagram-mencatat-tagihan.png` |
| 3.13 | 3.2.3 | Activity Diagram Kelola Menu dan Modal/COGS (A.11) | `activity-diagram-kelola-menu-cogs.png` |
| 3.14 | 3.2.4 | Entity Relationship Diagram | `erd-sistem-pos-restoran.png` |

| Tabel | Sub-bab | Konten |
|---|---|---|
| 3.1 | 3.1.2 | Kebutuhan Informasi per Peran Pengguna |
| 3.2–3.12 | 3.2.4 | Kamus Data entitas inti (11 tabel); skema penuh 23 entitas di `DATA-DICTIONARY.md` |

> 🚧 **Catatan:** Tabel `raw_materials`, `raw_material_movements`, `vendors`, `purchases`, `purchase_items` **dihapus** (subsistem belanja/raw-materials keluar dari lingkup REV 2.11). Sebaliknya `menu_cost_movements`, `transaction_payments`, dan child `settlement_method_counts` **ditambahkan**.

---

## 3.1 Analisis

### 3.1.1 Analisis Permasalahan

Restoran X menghadapi permasalahan utama berupa ketidakteraturan pencatatan operasional harian yang berdampak langsung pada efisiensi kasir, akurasi rekonsiliasi pendapatan, dan ketersediaan stok. Permasalahan tersebut terjadi karena seluruh aktivitas operasional — pencatatan stok pagi, pesanan pelanggan, hingga rekap penjualan — masih dicatat dalam satu buku tulis tanpa pemisahan yang jelas.

Proses bisnis yang berjalan saat ini (*as-is*) dimulai dari pengiriman stok porsi siap jual dari rumah pemilik ke outlet setiap pagi, yang dicatat manual di sisi kiri buku. Saat operasional berlangsung, waiter mencatat pesanan pelanggan di kertas lalu menyerahkannya ke kasir, dan kasir menghitung tagihan secara manual. Pembayaran diterima melalui beberapa metode (tunai, EDC, QRIS, transfer, serta layanan ojek daring untuk pesanan online) namun pencatatannya tercampur, sehingga menyulitkan rekonsiliasi akhir hari yang dilakukan dengan mencocokkan uang fisik, struk EDC, dan mutasi rekening secara manual per bank.

Kondisi tersebut menimbulkan dampak nyata. Pertama, **stok tidak terpantau**: pencatatan stok di sisi kiri buku sering terlewat, sehingga restoran tidak mengetahui sisa stok dan baru sadar habis saat pelanggan memesan — memaksa pengiriman darurat dari rumah via Gojek/Grab yang menambah biaya operasional. Kedua, **rekonsiliasi lambat dan rawan selisih tak terdeteksi** karena pencatatan tercampur dan tidak terpilah per metode maupun per bank. Ketiga, **pemilik tidak memperoleh laporan laba dan pengeluaran yang akurat dan cepat** karena rekap manual dilakukan di akhir periode.

### 3.1.2 Analisis Kebutuhan Informasi

Berdasarkan analisis permasalahan pada sub-bab 3.1.1, dapat diidentifikasi kebutuhan informasi untuk masing-masing peran pengguna, yaitu **informasi apa yang dibutuhkan setiap aktor untuk menjalankan aktivitas dan mengambil keputusan**. Tabel 3.1 merangkum informasi tersebut beserta tujuan penggunaannya per peran. (Catatan: tabel ini berorientasi pada informasi yang *dikonsultasi/dipakai* aktor, bukan daftar fitur laporan; rincian atribut data yang disimpan sistem dijabarkan pada Kamus Data di sub-bab 3.2.4.)

**Tabel 3.1** *Kebutuhan Informasi per Peran Pengguna*

| Peran Pengguna    | Informasi yang Dibutuhkan                                                          | Tujuan Penggunaan                                                              |
| ----------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Kasir             | Daftar menu aktif beserta harga jual                                              | Menginput pesanan pelanggan dan menghitung tagihan                            |
| Kasir             | Ketersediaan stok porsi *real-time*                                               | Memutuskan kapan perlu menghubungi pemilik untuk restock darurat              |
| Kasir             | Status meja (kosong/terisi) dan pesanan terbuka per meja                          | Mengelola alokasi pesanan dan melanjutkan pesanan dalam satu sesi meja        |
| Kasir             | Total tagihan per meja (termasuk PB1 bila aktif) dan metode pembayaran tersedia   | Memproses pembayaran dan menyampaikan rincian tagihan kepada pelanggan        |
| Kasir             | Total penjualan per metode pembayaran beserta rincian per bank                    | Membuka/menutup kasir per shift dan melakukan setoran (*settlement*) akhir hari             |
| Waiter            | Daftar menu aktif dan ketersediaan stok porsi                                     | Membantu mengambil dan menginput pesanan pelanggan                            |
| Waiter            | Daftar item stok porsi di bawah batas minimum                                     | Melakukan restock pagi dan opname stok porsi                                  |
| Waiter            | Status meja                                                                       | Mengantar pesanan ke meja yang tepat                                          |
| Pemilik (*Owner*) | Pendapatan harian per metode pembayaran beserta rincian per bank                  | Mencocokkan pemasukan dengan mutasi rekening per bank dan mengevaluasi pendapatan |
| Pemilik (*Owner*) | Harga pokok (COGS) per menu, laba kotor harian, dan tagihan operasional (terpisah)| Menetapkan modal/harga menu, mencatat tagihan operasional, dan mengevaluasi profitabilitas |
| Pemilik (*Owner*) | Selisih kas (*over/short*) akhir hari per metode pembayaran                       | Mendeteksi *mismatch* atau potensi kebocoran kas                              |
| Pemilik (*Owner*) | Kondisi stok porsi (item menipis atau habis)                                      | Memutuskan jumlah restock harian yang dibawa dari rumah                       |
| Pemilik (*Owner*) | Daftar transaksi yang dibatalkan (*void*)                                         | Memantau penggunaan pembatalan oleh kasir (pengendalian internal)            |

Kasir sebagai operator utama POS membutuhkan informasi operasional *real-time* — daftar menu beserta harga, ketersediaan stok porsi, status meja, serta total tagihan — agar dapat mencatat pesanan, memproses pembayaran, dan melakukan rekonsiliasi dengan cepat dan akurat. Waiter membutuhkan informasi menu, ketersediaan stok, dan status meja untuk membantu pengambilan dan input pesanan serta pengelolaan stok porsi. Pemilik, yang berperan mengawasi dan mengambil keputusan, membutuhkan informasi keuangan dan operasional yang terangkum — pendapatan per metode dan per bank, harga pokok dan laba kotor, selisih kas, kondisi stok, serta daftar pembatalan — sebagai dasar evaluasi performa, pengendalian internal, dan penetapan modal/harga. Seluruh kebutuhan informasi ini menjadi acuan perumusan kebutuhan fungsional pada sub-bab 3.1.3.

### 3.1.3 Analisis Kebutuhan Sistem

Berdasarkan permasalahan dan kebutuhan informasi yang teridentifikasi, dirumuskan kebutuhan sistem yang dibagi menjadi kebutuhan fungsional dan non-fungsional.

#### Kebutuhan Fungsional

Sistem yang dirancang harus dapat memenuhi kebutuhan fungsional sebagai berikut:

1. Mengelola autentikasi pengguna melalui form login untuk tiga peran (Pemilik, Kasir, dan Waiter). Saat pertama kali login di suatu perangkat, pegawai mengisi nama pengguna dan PIN enam digit secara manual. Setelah login berhasil, sistem menyimpan nama tersebut di penyimpanan lokal perangkat sehingga login berikutnya di perangkat yang sama hanya memerlukan input PIN enam digit pada *numpad* (nama otomatis terisi dari cache). Tombol *Ganti Pengguna* tersedia untuk mereset cache. PIN diperbolehkan duplikat antar pegawai karena identifikasi dilakukan melalui kombinasi nama dan PIN — nama berfungsi sebagai identifier, PIN sebagai kata sandi. Sistem tidak menampilkan daftar seluruh pegawai untuk dipilih.
2. Mengelola katalog menu yang mencakup nama, kategori, harga, klasifikasi jenis stok (porsi yang ditrack, varian yang berbagi stok, atau tanpa stok), jenis menu (sederhana/varian/paket), batas minimum stok, serta konfigurasi varian dan komposisi paket.
3. Mendukung dua tipe order: *dine-in* dengan pemilihan meja, dan *takeaway* tanpa meja. Sumber order takeaway (walk-in, GoFood, GrabFood, atau gosend) dibedakan melalui metode pembayaran, bukan melalui sub-tipe order yang terpisah.
4. Mendukung penambahan, perubahan, dan pembatalan item pesanan sebelum pembayaran. Pencatatan pesanan ke sistem dapat dilakukan oleh **kasir maupun waiter secara ** melalui perangkat masing-masing; menuliskan pesanan di kertas lalu menyerahkannya ke kasir merupakan cara alternatif yang opsional. Pembatalan transaksi tidak memerlukan otorisasi khusus.
5. Mendukung penggabungan tagihan (*merge bill*) dari beberapa meja menjadi satu transaksi melalui mekanisme *self-reference* pada transaksi sumber, sehingga rombongan lintas-meja dapat membayar sekaligus. Mekanisme ini dilakukan oleh kasir atau Pemilik, tidak diakses oleh waiter.
6. Menyediakan mekanisme sub-pilihan dinamis untuk menu paket dan menu varian: kasir atau waiter memilih variant (misalnya paha atau dada, bakar atau goreng, jenis minuman) saat menambahkan item, dan sistem mengurangi stok porsi sesuai pilihan tersebut.
7. Memproses pembayaran melalui metode pembayaran yang dapat dikonfigurasi oleh Pemilik (master *payment methods* yang dapat ditambah, dinonaktifkan, dan diurutkan — mencakup tunai, EDC, QRIS, dompet digital, dan transfer), dengan dukungan **pembayaran gabungan (*split-tender*)** yaitu satu transaksi dibayar dengan beberapa metode sekaligus. Untuk metode yang memerlukan bank (misalnya EDC dan transfer), sistem meminta input bank pendamping dari master bank agar laporan rekonsiliasi dapat dilakukan per bank. Pembayaran dilakukan oleh kasir atau Pemilik saja. Diskon manual didukung, dan struk pembayaran dicetak dalam format PDF.
8. Menyediakan pengaturan Pajak Pembangunan 1 (PB1) yang dapat dikonfigurasi Pemilik pada dua sumbu: aktif atau tidak, dan apabila aktif, dibebankan ke pelanggan (ditambahkan ke total) atau ditanggung restoran (tidak masuk total pelanggan, dicatat sebagai pengurang laba). Pada restoran objek penelitian ini, PB1 berstatus nonaktif (harga menu sudah final).
9. Melakukan pengurangan stok porsi secara otomatis saat pesanan diinput ke POS (bukan saat pembayaran), dengan memperbolehkan stok bernilai negatif untuk mengakomodasi situasi habis di tengah hari.
10. Mencatat masuknya stok darurat (fitur "Barang Masuk") saat pemilik mengirim restock dari rumah pada tengah hari.
11. Memungkinkan restock pagi stok porsi dengan formula kelipatan lima yang menjaga stok akhir di atas batas minimum.
12. Menyediakan fitur opname untuk koreksi nilai stok porsi ketika kondisi sistem menyimpang dari realita fisik, dengan jejak audit yang mencatat selisih dan pelaku koreksi.
13. Menyediakan pencatatan modal/harga pokok (COGS) per menu yang hanya dapat diakses Pemilik, dengan nilai modal dinyatakan langsung per menu (bukan dihitung dari konsumsi bahan baku), serta jejak riwayat perubahan modal. Modal tidak ditampilkan pada katalog menu publik (POS).
14. Mengelola shift: kasir membuka kasir dengan modal awal (sadar window jam shift yang dikonfigurasi owner dan dijaga guard satu shift terbuka sekaligus) dan menutup shift dengan mode penutupan final atau serah-terima.
15. Melakukan setoran akhir hari (*settlement*) sekali untuk satu hari bisnis penuh oleh kasir penutup shift terakhir atau Pemilik, dengan rekap per metode pembayaran secara dinamis (total sistem dan total fisik *blind count*) beserta rincian per bank dan perhitungan variansnya.
16. Menghitung laba rugi harian dengan rumus laba kotor = total penjualan dikurangi total harga modal (Σ `unit_cost` × jumlah terjual atas transaksi lunas), di mana modal di-*snapshot* per item saat order dibuat. Tagihan operasional bulanan ditampilkan terpisah dan tidak dikurangkan ke laba kotor.
17. Mencatat tagihan operasional bulanan (kebersihan, listrik, air, parkir, sewa) yang hanya dapat diakses oleh Pemilik.
18. Menyediakan dashboard per peran dengan reminder stok porsi menipis, serta laporan periodik pendapatan, COGS, dan laba kotor bagi Pemilik.
19. Menyimpan jejak audit untuk seluruh perubahan stok porsi (`portion_movements`) dan modal menu (`menu_cost_movements`), sehingga pemilik dapat menelusuri kapan dan oleh siapa setiap perubahan terjadi.
20. Menyediakan konfigurasi metode pembayaran dan bank serta pengaturan aplikasi (pajak PB1, jam shift untuk batas hari bisnis, identitas restoran) oleh Pemilik.
21. Menerapkan pembatasan akses (otorisasi) per peran pada tingkat fungsional sesuai matriks kewenangan: Pemilik berakses penuh (termasuk tagihan, modal/COGS, master data, konfigurasi metode/bank, dan pengaturan aplikasi); kasir berakses ke pengelolaan transaksi (input order, pembayaran, merge, void), stok porsi, serta buka/tutup kasir dan setoran; sedangkan waiter **** dengan kasir dalam input pesanan dan pengelolaan stok porsi serta pemantauan meja, namun tidak berakses ke pembayaran, merge/void, buka/tutup kasir, setoran, modal/COGS, tagihan, maupun konfigurasi. Pembatasan diterapkan di antarmuka maupun di *endpoint* basis data.

#### Kebutuhan Non-Fungsional

1. **Kemudahan penggunaan** — antarmuka dapat dioperasikan pegawai non-teknis dengan minimal pelatihan.
2. **Aksesibilitas mobile-first sebagai PWA** — diakses via peramban ponsel, dapat dipasang ke layar utama, karena restoran tidak memiliki komputer maupun jaringan WiFi internal.
3. **Konektivitas berbasis paket data / WiFi seadanya** — sistem tetap responsif pada koneksi tidak stabil.
4. **Keamanan akses dengan pembatasan per peran** — fitur sensitif (tagihan, modal/COGS, konfigurasi) hanya untuk Pemilik.
5. **Konsistensi dan jejak audit** — setiap perubahan stok porsi dan modal menu tercatat di log audit (alasan, kuantitas/nilai, pengguna pelaku).
6. **Kecepatan respons** — proses pembayaran satu transaksi tidak melebihi 30 detik sejak kasir menekan tombol bayar hingga konfirmasi muncul.

**Batasan sistem (Bill of Materials dan inventori bahan baku — *out of scope*).** Perhitungan harga pokok produksi (HPP) berbasis bahan memerlukan data konsumsi bahan baku terukur per siklus produksi melalui *Bill of Materials* atau resep. Namun pada restoran kecil berbasis keluarga ini, proses memasak dilakukan secara *batch* tanpa penimbangan baku dan komposisi bumbu tidak terdokumentasi, sehingga data tersebut tidak tersedia konsisten. Oleh karena itu sistem tidak menyertakan *Bill of Materials*, resep, maupun pencatatan inventori bahan baku mentah, vendor, dan pembelian; inventori dibatasi pada barang siap jual satuan porsi (selaras ruang lingkup Bab 1.4). Sebagai gantinya, harga modal (COGS) dinyatakan langsung per menu oleh Pemilik dan laba kotor dihitung dari Pendapatan - (modal satuan × jumlah terjual) yang di-*snapshot* per item saat order.

---

## 3.2 Desain Sistem

### 3.2.1 Blok Diagram Desain Sistem

Gambaran umum rancangan sistem ditunjukkan pada Gambar 3.1 dalam bentuk blok diagram yang memetakan empat komponen: *sumber data* (masukan), *modul utama* (proses), *keluaran*, dan *pengguna* sistem.

**Sumber data** yang menjadi masukan sistem meliputi data pengguna dan hak akses; data menu beserta varian, paket, dan modal (COGS); data stok porsi; data transaksi dan pembayaran; data shift, setoran, dan tagihan operasional; serta data konfigurasi (metode pembayaran, bank, pajak PB1, jam shift, dan identitas restoran).

**Modul utama** sistem terdiri atas tujuh modul. *Modul Autentikasi & Hak Akses* mengatur login dan kewenangan per peran. *Modul Manajemen Menu & Modal/COGS* mengelola katalog menu beserta varian, paket, dan harga modal. *Modul Manajemen Stok Porsi* menangani restock pagi, barang masuk, dan opname. *Modul Pemesanan (POS)* mencatat pesanan dine-in dan takeaway. *Modul Pembayaran & Rekonsiliasi Shift* memproses pembayaran (termasuk *split-tender*) serta buka/tutup kasir dan setoran akhir hari. *Modul Dashboard & Laporan* menyajikan informasi sesuai peran. *Modul Konfigurasi & Pengaturan* mengatur metode pembayaran, bank, PB1, jam shift, dan identitas restoran.

**Keluaran** yang dihasilkan meliputi laporan laba rugi harian (Pendapatan - COGS), rekap pendapatan per metode dan per bank, hasil setoran akhir hari beserta selisih kas (*over/short*), status dan pengingat (*reminder*) stok porsi, struk pembayaran PDF, serta riwayat transaksi dan jejak audit.

**Pengguna** sistem terdiri atas tiga peran — Pemilik (*Owner*), Kasir, dan Waiter — yang mengakses modul sesuai kewenangan masing-masing sebagaimana diuraikan pada sub-bab 3.1.3.

**Gambar 3.1** *Blok Diagram Desain Sistem POS Restoran*
*(File: `docs/diagrams/blok-diagram-desain-sistem.png`)*

### 3.2.2 Use Case Diagram

Pada proses bisnis yang diusulkan (*to-be*), pencatatan manual berbasis buku digantikan sistem terintegrasi sehingga setiap peran mencatat dan mengakses data melalui satu basis data. Interaksi antara pengguna dan sistem digambarkan pada *use case diagram* di Gambar 3.2, yang melibatkan tiga aktor — Pemilik (*Owner*), Kasir, dan Waiter — beserta fitur yang dapat diakses masing-masing sesuai kewenangannya. Kasir dan Waiter setara (*co-equal*) dalam mencatat pesanan, sedangkan pemrosesan pembayaran, pembukaan/penutupan kasir, dan setoran hanya untuk Kasir dan Pemilik, serta pengelolaan data master (menu, modal/COGS, pengguna, tagihan) dan konfigurasi aplikasi hanya untuk Pemilik.

**Gambar 3.2** *Use Case Diagram Sistem POS Restoran*
*(File: `docs/diagrams/use-case-diagram-sistem-pos-restoran.png`)*

### 3.2.3 Activity Diagram

Berdasarkan *use case*, dirancang sebelas *activity diagram* yang menggambarkan alur tiap proses bisnis menggunakan *swimlane* per aktor, masing-masing dengan satu *initial node* dan satu *activity final node*. Ringkasan alur tiap diagram diuraikan berikut; diagram lengkap dapat ditempatkan pada Lampiran sesuai Pedoman.

**Login (A.1).** Pengguna memasukkan nama dan PIN; bila valid sistem mengarahkan ke dashboard sesuai peran, bila salah pengguna diminta mengulang. 
**Mengelola Pesanan (A.2).** Kasir atau waiter (*co-equal*) memilih tipe order (dine-in pilih meja / takeaway) dan menambahkan item dengan pemilihan varian/paket bila perlu — lalu menyimpan pesanan sehingga stok porsi otomatis berkurang dan modal di-*snapshot*
**Memproses Pembayaran (A.3).** Kasir memilih metode pembayaran (memilih bank bila diperlukan) dan menambah *slice* hingga lunas (*split-tender*), lalu mencetak struk bila diminta
**Buka Kasir (A.4).** Kasir membuka shift dengan modal awal setelah sistem memastikan tidak ada shift lain yang aktif dan masih dalam jam operasional
**Tutup Kasir (A.5).** Kasir menutup shift dengan mode final (diblok bila masih ada transaksi belum dibayar) atau serah-terima ke kasir berikutnya
**Setoran Akhir Hari (A.6).** Kasir atau Pemilik menginput jumlah fisik per metode secara *blind count*; sistem menghitung selisih terhadap total sistem lalu menyimpan setoran untuk satu hari bisnis
**Restock Stok Porsi Pagi (A.7).** Waiter atau kasir menginput jumlah restock (kelipatan lima) mengikuti rekomendasi sistem sehingga stok bertambah dan tercatat di log
**Mencatat Barang Masuk (A.8).** Saat restock darurat tengah hari tiba, waiter atau kasir menginput jumlah yang datang sehingga stok porsi bertambah dan tercatat di log
**Opname Stok Porsi (A.9).** Waiter atau kasir menginput jumlah fisik per item; bila ada selisih, sistem mengoreksi stok dan mencatat penyesuaian
**Mencatat Tagihan Bulanan (A.10).** Pemilik mengisi bulan, kategori, dan jumlah tagihan; setelah validasi, sistem menyimpan dan menampilkan daftar tagihan bulan itu
**Kelola Menu dan Modal/COGS (A.11).** Pemilik menambah atau mengubah menu beserta modal; bila modal berubah, sistem mencatatnya ke log riwayat modal 


### 3.2.4 Entity Relationship Diagram dan Kamus Data

Struktur penyimpanan data sistem dirancang dengan pendekatan basis data relasional yang digambarkan dalam *Entity Relationship Diagram* pada Gambar 3.14 menggunakan notasi *crow's-foot*.

**Gambar 3.14** *Entity Relationship Diagram Sistem POS Restoran*
*(File: `docs/diagrams/erd-sistem-pos-restoran.png`)*

Sistem menyimpan data dalam **dua puluh tiga entitas** yang dikelompokkan menjadi lima: (1) operasional inti (`users`, `shifts`, `transactions`, `transaction_items`, `transaction_payments`, `settlements`, `settlement_method_counts`); (2) katalog dan varian (`menus`, `menu_option_groups`, `menu_options`, `menu_variants`, `menu_variant_options`, `paket_components`, `paket_choice_options`, `transaction_item_selections`); (3) stok porsi (`portion_stocks`, `portion_movements`); (4) konfigurasi pembayaran (`payment_methods`, `banks`, `payment_method_banks`); dan (5) administrasi/audit (`bills`, `app_settings`, `menu_cost_movements`). Antar entitas terhubung oleh sekitar tiga puluh sembilan relasi *foreign key* yang didominasi relasi satu-ke-banyak, dengan satu relasi satu-ke-satu (`shifts`–`settlements`), satu *self-reference* (`transactions.merged_into_id` untuk merge bill), dan dua relasi banyak-ke-banyak melalui entitas junction (`payment_method_banks` dan `menu_variant_options`). Sesuai ruang lingkup, sistem tidak menyertakan entitas bahan baku mentah, vendor, maupun pembelian; modal/COGS dinyatakan langsung per menu pada kolom `cost` (lihat batasan pada sub-bab 3.1.3).

Definisi atribut sebelas entitas inti dijabarkan pada Tabel 3.2 hingga Tabel 3.12 berikut; skema lengkap 23 entitas terdapat pada [`docs/DATA-DICTIONARY.md`](../DATA-DICTIONARY.md).

Tabel `users` menyimpan data seluruh pengguna (Pemilik, Kasir, Waiter) beserta PIN autentikasi yang boleh duplikat antar pegawai karena identifikasi dilakukan via kombinasi nama dan PIN, sebagaimana ditunjukkan pada Tabel 3.2.

**Tabel 3.2** *Definisi Atribut Tabel `users`*

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT (PK, auto-increment) | ID unik pengguna |
| name | VARCHAR(100) | Nama pegawai |
| pin | VARCHAR(6) | PIN 6-digit; boleh duplikat antar pegawai |
| role | ENUM(owner, cashier, waiter) | Peran pengguna |
| is_active | BOOLEAN | Status aktif (default true) |
| created_at, updated_at | DATETIME | Waktu dibuat dan update terakhir |

Tabel `menus` menyimpan master katalog menu siap jual beserta harga, kategori, klasifikasi jenis stok, jenis menu, batas minimum, dan modal/COGS yang hanya dapat diakses Pemilik, sebagaimana ditunjukkan pada Tabel 3.3.

**Tabel 3.3** *Definisi Atribut Tabel `menus`*

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT (PK) | ID unik menu |
| name | VARCHAR(100) | Nama menu |
| category | VARCHAR(50) | Kategori menu |
| price | DECIMAL(10,2) | Harga jual satuan (Rupiah) |
| cost | DECIMAL(10,2), nullable | Modal/COGS per unit (owner-only, tidak dibocorkan ke POS); null = belum di-set |
| stock_type | ENUM(portion, linked, nonStock) | Klasifikasi stok |
| min_stock | INT, nullable | Ambang minimum (untuk stockType=portion) |
| image_url | VARCHAR(255), nullable | Path/URL foto menu |
| sub_options | JSON, nullable | Legacy definisi sub-pilihan paket |
| is_active | BOOLEAN | Menu aktif (default true) |
| kind | ENUM(simple, variant, paket) | Jenis menu (default simple) |
| pos_visible | BOOLEAN | Tampil di grid POS (default true) |
| created_at, updated_at | DATETIME | Audit |

Tabel `portion_stocks` menyimpan kondisi stok porsi terkini per menu sebagai *live count* (boleh negatif) beserta kondisi awal hari (*opening qty*) yang otomatis di-*snapshot* saat pengguna pertama login pagi, sebagaimana ditunjukkan pada Tabel 3.4.

**Tabel 3.4** *Definisi Atribut Tabel `portion_stocks`*

| Field | Tipe Data | Keterangan |
|---|---|---|
| menu_id | INT (PK + FK → menus, CASCADE) | PK sekaligus FK (1:1 dengan menu) |
| current_qty | INT | *Live count*; boleh negatif |
| min_stock | INT | Ambang reminder restock (default 0) |
| opening_qty_today | INT | *Snapshot* stok saat login pagi pertama (default 0) |
| opening_qty_date | DATE | Tanggal *snapshot* |
| updated_at | DATETIME | Waktu update terakhir |

Tabel `portion_movements` menyimpan log audit setiap perubahan stok porsi beserta alasan, nilai sebelum/sesudah, dan pengguna pelakunya, sebagaimana ditunjukkan pada Tabel 3.5.

**Tabel 3.5** *Definisi Atribut Tabel `portion_movements`*

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT (PK) | ID unik log |
| menu_id | INT (FK → menus) | Item stok yang berubah |
| delta | INT | Positif saat restock, negatif saat order/void |
| reason | ENUM(order, restockMorning, restockEmergency, manualAdjust, refundVoid) | Alasan perubahan |
| transaction_id | INT, nullable (FK → transactions, SET NULL) | Transaksi sumber (order/refundVoid) |
| transaction_item_id | INT, nullable (FK → transaction_items, SET NULL) | Baris item penyebab decrement |
| qty_before | INT, nullable | Stok sebelum perubahan |
| qty_after | INT, nullable | Stok sesudah (= qty_before + delta) |
| note | VARCHAR(255), nullable | Catatan manusiawi opsional |
| user_id | INT (FK → users) | Pengguna pelaku |
| created_at | DATETIME | Waktu perubahan |

Tabel `menu_cost_movements` menyimpan log audit setiap perubahan modal/COGS menu (nilai sebelum dan sesudah, alasan, pelaku, dan waktu), sebagaimana ditunjukkan pada Tabel 3.6.

**Tabel 3.6** *Definisi Atribut Tabel `menu_cost_movements`*

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT (PK) | ID unik log |
| menu_id | INT (FK → menus) | Menu yang modalnya berubah |
| cost_before | DECIMAL(10,2), nullable | Modal sebelum (null = belum di-set) |
| cost_after | DECIMAL(10,2), nullable | Modal sesudah |
| reason | ENUM(initialSet, manualEdit) | Set awal atau penyesuaian |
| note | VARCHAR(255), nullable | Catatan opsional |
| user_id | INT (FK → users) | Owner pelaku |
| created_at | DATETIME | Waktu perubahan |

Tabel `shifts` mencatat siklus shift kasir berbasis *business day* beserta modal awal dan penanda *single-OPEN* yang menjamin hanya satu shift terbuka pada satu waktu, sebagaimana ditunjukkan pada Tabel 3.7.

**Tabel 3.7** *Definisi Atribut Tabel `shifts`*

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT (PK) | ID unik shift |
| date | DATE | Tanggal *business day* |
| type | ENUM(pagi, malam) | Jenis shift |
| cashier_id | INT (FK → users) | Kasir pembuka shift |
| opening_cash | DECIMAL(12,2) | Modal awal laci kas |
| closed_at | DATETIME, nullable | Waktu tutup (null = masih terbuka) |
| active_marker | INT, nullable (UNIQUE) | Penanda *single-OPEN*; null saat tutup |
| created_at | DATETIME | Waktu buka kasir |

Tabel `transactions` menyimpan *header* pesanan beserta tipe order, status, rincian nominal (termasuk PB1 yang ditanggung resto), dan *self-reference* untuk merge bill — tanpa menyimpan metode/bank pembayaran, sebagaimana ditunjukkan pada Tabel 3.8.

**Tabel 3.8** *Definisi Atribut Tabel `transactions`*

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT (PK) | ID unik transaksi |
| shift_id | INT (FK → shifts) | Shift fiskal (di-*re-stamp* saat bayar) |
| order_type | ENUM(dineIn, takeaway) | Tipe order |
| table_number | INT, nullable | Nomor meja (wajib untuk dineIn) |
| created_by_id | INT (FK → users) | User penginput order |
| status | ENUM(open, paid, void) | Status pesanan |
| merged_into_id | INT, nullable (FK → transactions, self) | Parent gabungan; query revenue meng-exclude yang non-null |
| subtotal | DECIMAL(12,2) | Σ subtotal item |
| discount_amount | DECIMAL(12,2) | Diskon manual |
| tax_amount | DECIMAL(12,2) | PB1 yang ditagih ke pelanggan |
| tax_borne_amount | DECIMAL(12,2) | PB1 yang ditanggung resto (tidak masuk total; kurangi laba) |
| total | DECIMAL(12,2) | subtotal − discount + tax_amount |
| created_at, paid_at, voided_at | DATETIME, nullable | Waktu dibuka, dibayar, dibatalkan |

Tabel `transaction_items` menyimpan rincian item per transaksi (entitas asosiatif menu × transaksi) lengkap dengan jumlah, harga *snapshot*, modal *snapshot*, dan varian terjual, sebagaimana ditunjukkan pada Tabel 3.9.

**Tabel 3.9** *Definisi Atribut Tabel `transaction_items`*

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT (PK) | ID unik item |
| transaction_id | INT (FK → transactions, CASCADE) | Transaksi parent |
| menu_id | INT (FK → menus) | Menu yang dipesan |
| qty | INT | Jumlah porsi |
| unit_price | DECIMAL(10,2) | Harga jual *snapshot* saat order |
| subtotal | DECIMAL(12,2) | qty × unit_price |
| unit_cost | DECIMAL(10,2), nullable | Modal *snapshot* (laba: Σ unit_cost × qty) |
| sub_options_selected | JSON, nullable | Legacy pilihan paket berbasis label |
| notes | VARCHAR(255), nullable | Catatan per item |
| variant_id | INT, nullable (FK → menu_variants, SET NULL) | Varian yang terjual |
| created_at | DATETIME | Waktu item ditambahkan |

Tabel `transaction_payments` menyimpan satu atau beberapa *slice* pembayaran per transaksi untuk mendukung *split-tender*, masing-masing berisi kode metode, bank pendamping, dan nominal, sebagaimana ditunjukkan pada Tabel 3.10.

**Tabel 3.10** *Definisi Atribut Tabel `transaction_payments`*

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT (PK) | ID unik *slice* pembayaran |
| transaction_id | INT (FK → transactions, CASCADE) | Transaksi yang dibayar |
| method | VARCHAR(20) | Kode metode (denormalisasi `payment_methods.code`) |
| bank | VARCHAR(50), nullable | Bank (wajib untuk metode `requires_bank`) |
| amount | DECIMAL(12,2) | Nominal *slice* (Σ = total saat paid) |
| recorded_at | DATETIME | Waktu *slice* direkam |
| recorded_by_id | INT (FK → users) | User perekam *slice* |

Tabel `settlements` menyimpan rekap setoran akhir hari secara *whole business day* (satu setoran per tanggal), dengan rincian per metode di tabel anak `settlement_method_counts`, sebagaimana ditunjukkan pada Tabel 3.11.

**Tabel 3.11** *Definisi Atribut Tabel `settlements`*

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT (PK) | ID unik setoran |
| shift_id | INT (FK → shifts, UNIQUE) | Shift acuan (1:1) |
| date | DATE (UNIQUE) | Tanggal *business day* (satu setoran per hari) |
| cashier_id | INT (FK → users) | Penyetor (kasir penutup terakhir / owner) |
| reviewer_id | INT, nullable (FK → users) | Owner yang me-review |
| status | ENUM(submitted, reviewed) | Status setoran |
| submitted_at | DATETIME | Waktu submit |
| reviewed_at | DATETIME, nullable | Waktu review |

Tabel `bills` menyimpan tagihan operasional bulanan yang hanya dapat diakses Pemilik dan ditampilkan terpisah dari laba kotor, sebagaimana ditunjukkan pada Tabel 3.12.

**Tabel 3.12** *Definisi Atribut Tabel `bills`*

| Field | Tipe Data | Keterangan |
|---|---|---|
| id | INT (PK) | ID unik tagihan |
| month | VARCHAR(7) | Bulan tagihan (format YYYY-MM) |
| category | ENUM(kebersihan, listrik, air, parkir, sewa) | Kategori tagihan |
| amount | DECIMAL(12,2) | Nominal tagihan |
| note | VARCHAR(255), nullable | Catatan opsional |
| user_id | INT (FK → users) | Pemilik penginput |
| created_at | DATETIME | Waktu input |

### 3.2.5 Pengolahan Data dan Metode yang Digunakan

Sub-bab ini **tidak berlaku** karena sistem bersifat operasional-transaksional tanpa metode atau algoritma analitik khusus (peramalan, klasifikasi, dan sejenisnya). Seluruh perhitungan bersifat aritmetika operasional langsung: total dan pajak PB1, rekomendasi restock (kelipatan lima), selisih (*variance*) setoran per metode, serta laba kotor harian (Pendapatan - COGS).

---

## Tips Teknis Penulisan

1. **Caption gambar** di **bawah** gambar; **caption tabel** di **atas** tabel (konvensi UK Petra).
2. **Setiap gambar/tabel WAJIB dirujuk** di paragraf ("ditunjukkan pada Gambar 3.x" / "seperti pada Tabel 3.x").
3. **Istilah teknis dimiringkan** saat pertama muncul: *swimlane*, *snapshot*, *live count*, *progressive web app*, *split-tender*, *merge bill*, *self-reference*, *blind count*, *over/short*, *foreign key*.
4. **Bahasa pasif** untuk teks akademik.
5. **Penamaan aktor konsisten**: *Pemilik (Owner)*, Kasir, Waiter.
6. **Tabel WAJIB dijelaskan dalam kalimat** (Pedoman SIB).

## Self-Check sebelum Submit Bab 3

- [ ] Struktur sesuai Pedoman (flat, mengikuti pola peer): 3.1 Analisis (3.1.1–3.1.3) · 3.2 Desain Sistem → 3.2.1 Blok Diagram, 3.2.2 Use Case, 3.2.3 Activity, 3.2.4 ERD + Kamus Data, 3.2.5 Pengolahan Data dan Metode (tidak berlaku).
- [ ] Export **14 PNG** diagram dari StarUML ke `docs/diagrams/` lalu sisipkan (Gambar 3.1–3.14).
- [ ] 3.1.3: Kebutuhan Fungsional (21 item) + Non-Fungsional (6 item) + paragraf batasan.
- [ ] 3.2.3: sebelas activity diagram (Gambar 3.3–3.13), tiap diagram 1 *initial* + 1 *final*.
- [ ] 3.2.4: ERD (Gambar 3.14) narasi 23 entitas + ≈39 relasi; lengkapi 11 tabel kamus data inti (Tabel 3.2–3.12) dari `DATA-DICTIONARY.md`.
- [ ] Konsistensi: Bab 3 ↔ Bab 2 (tahapan + pengujian) ↔ Ruang Lingkup 1.4.

---

*Selaras dengan sistem REV 2.13 (live `monosuko.my.id`) + diagram StarUML hasil rebuild & verifikasi 2026-06-02. Struktur mengikuti Pedoman Program SIB UK Petra. Sumber: `schema.prisma` (23 entitas), `ERD.md`/`USE-CASE.md`/`ACTIVITY.md` REV 2.13.*
