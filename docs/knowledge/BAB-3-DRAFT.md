# BAB 3 - Analisis dan Desain (Draft Paste-Ready, REV 2.11)

> 🚧 **REV 2.11 (2026-05-30) - PERLU REVIEW THESIS-LEVEL OLEH EZRA.** Naskah ini telah disesuaikan secara faktual ke model COGS (drop subsistem belanja/vendor/raw-materials, tambah modal/COGS per menu + Laporan Laba Rugi Harian). Perubahan struktural utama: entitas 14 → **10**, relasi 19 → **17**, use case 20 → **19**, activity diagram 11 → **9**; Kebutuhan Fungsional #12 (raw materials) & #14 (mencatat pembelian) dihapus, ditambah FR modal/COGS; sub-bab activity 3.2.3.7 (Opname Raw Materials) & 3.2.3.9 (Mencatat Pembelian) dihapus; numbering Gambar/Tabel **perlu disusun ulang** (Gambar 3.2–3.12 dan Tabel 3.2–3.15 lama). **Bagian yang BELUM disisir habis (perlu review manual Ezra):** mapping Gambar/Tabel di atas, renumbering caption, dan kehalusan kalimat prosa naratif. Lihat [`docs/superpowers/specs/2026-05-30-cogs-per-menu-remove-belanja-design.md`](../superpowers/specs/2026-05-30-cogs-per-menu-remove-belanja-design.md).

> ✅ **Implementasi STATUS per 2026-05-24:** Backend + Frontend FULL DONE (11 phase backend + 11 phase frontend + Phase 4b split/merge bill). Backend `tsc --noEmit` 0 errors, frontend `vite build` SUCCESS 1564 modules, ~170+ smoke test scenarios PASS. Naskah Bab 3 di bawah ini menggambarkan sistem yang **sudah jalan**, bukan rencana.

> **Status:** REV 2.3 (2026-05-24) - bump dari REV 2.2 setelah brainstorming workflow order intake dan permission matrix. Tidak ada perubahan schema (tetap 14 entitas, 19 relasi). Yang berubah: (1) deskripsi Login diperbaiki menjadi form 2 field input nama + PIN murni (sebelumnya REV 2.2 narasi masih menyebut "memilih namanya dari daftar" + "mengingat pengguna terakhir"); (2) workflow order intake diperjelas sebagai berbasis kertas (waiter tulis → kasir input) dengan waiter sebagai fallback bila kasir tidak available; (3) Kebutuhan Fungsional #1 dan #4-6 diperbaiki untuk mencerminkan annotation kasir primary vs waiter fallback.
> **Sumber alur bisnis:** [`docs/operasional-resto.md`](../operasional-resto.md) REV 2.3 (sumber kebenaran tertinggi)
> **Sumber struktur data:** [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma) - schema REV 2.2 (14 entitas, 19 relasi) sudah applied ke MySQL `pos_restaurant` per 2026-05-24. REV 2.3 tidak menambah schema, hanya middleware permission granular per-endpoint.
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
> - **HPP dan Bill of Materials EXPLICIT out-of-scope** - ada paragraf justifikasi siap paste di sub-bab "Batasan".
> - 13 entitas (sebelumnya 11), 17 relasi (sebelumnya 13).
> - 20 use case (sebelumnya 17), 11 activity diagram (sebelumnya 10).

---

## Mapping Gambar dan Tabel (REV 2.3 - ⚠️ PERLU DISUSUN ULANG untuk REV 2.11)

> 🚧 **REV 2.11:** tabel mapping di bawah ini masih versi REV 2.3 (13 Gambar + 15 Tabel). Setelah penghapusan 2 *activity diagram* (Opname Raw Materials + Mencatat Pembelian) dan 5 entitas data dictionary (`raw_materials`, `raw_material_movements`, `vendors`, `purchases`, `purchase_items`) + penambahan `menu_cost_movements`, mapping ini menjadi **11 Gambar + 11 Tabel** (1 tabel kebutuhan informasi + 10 tabel data dictionary). Penyusunan ulang penomoran Gambar/Tabel diserahkan ke penulis (Ezra) sebagai bagian review thesis-level.

**Total (REV 2.3, BELUM di-update): 13 Gambar + 15 Tabel** (1 tabel kebutuhan informasi + 14 tabel data dictionary)

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
| Pemilik (*Owner*) | Harga pokok (COGS) dan laba kotor harian (pendapatan − COGS) serta tagihan operasional bulanan terpisah | Mengevaluasi profitabilitas dan alokasi biaya operasional |
| Pemilik (*Owner*) | Selisih kas akhir hari per metode pembayaran | Mendeteksi mismatch atau potensi kebocoran kas |
| Pemilik (*Owner*) | Stok porsi yang menipis atau habis | Mempersiapkan restock harian dari rumah |
| Pemilik (*Owner*) | Daftar transaksi yang dibatalkan | Mengontrol penggunaan fitur pembatalan oleh kasir |
| Kasir | Status meja (kosong atau terisi) dan tipe order aktif | Mengelola alokasi pesanan dan tipe layanan |
| Kasir | Ketersediaan stok porsi waktu nyata | Mengetahui kapan perlu menghubungi pemilik untuk restock darurat |
| Kasir | Total tagihan per meja sebelum pembayaran (termasuk pajak PB1) | Menyampaikan rincian tagihan kepada pelanggan |
| Kasir | Total penjualan per enam metode pembayaran beserta rincian per bank | Melakukan rekap akhir hari sebelum tutup kasir |
| Waiter | Daftar item stok porsi yang perlu restock pagi (di bawah batas minimum) | Memberitahu kasir saat input restock pagi |
| Waiter | Daftar menu yang tersedia di POS | Membantu input order pelanggan ke sistem |

> Pemilik membutuhkan informasi keuangan dan operasional yang terintegrasi sebagai dasar evaluasi performa restoran secara menyeluruh, dengan rincian khusus per bank untuk metode pembayaran EDC dan transfer agar memudahkan rekonsiliasi dengan mutasi rekening, serta harga pokok per menu untuk menghitung laba kotor harian. Kasir membutuhkan informasi operasional waktu nyata untuk melayani pelanggan dengan cepat, sekaligus memverifikasi keseimbangan kas pada akhir hari. Waiter sebagai aktor pendukung membutuhkan informasi kondisi stok porsi untuk membantu pencatatan restock dan opname stok porsi.

---

## 3.1.3 Analisis Kebutuhan Sistem

> Berdasarkan permasalahan dan kebutuhan informasi yang teridentifikasi, dirumuskan kebutuhan sistem yang dibagi menjadi kebutuhan fungsional dan non-fungsional.

### Kebutuhan Fungsional

> Sistem yang dirancang harus dapat memenuhi kebutuhan fungsional sebagai berikut:
>
> 1. Mengelola autentikasi pengguna melalui form login untuk tiga peran (Pemilik, Kasir, dan Waiter). Saat pertama kali login di suatu perangkat, pegawai mengisi nama pengguna dan PIN enam digit secara manual. Setelah login berhasil, sistem menyimpan nama tersebut di penyimpanan lokal perangkat sehingga login berikutnya di perangkat yang sama hanya memerlukan input PIN enam digit pada *numpad* (nama otomatis terisi dari cache, mempercepat alur untuk pegawai yang menggunakan satu perangkat berulang). Tombol *Ganti Pengguna* tersedia untuk mereset cache dan kembali menampilkan form dua field bila perangkat dipakai pegawai berbeda. PIN diperbolehkan duplikat antar pegawai karena identifikasi dilakukan melalui kombinasi nama dan PIN - nama yang unik per pegawai berfungsi sebagai identifier, sedangkan PIN hanya sebagai kata sandi. Sistem tidak menampilkan daftar seluruh pegawai untuk dipilih; cache hanya menyimpan satu nama pegawai terakhir per perangkat.
> 2. Mengelola katalog menu yang mencakup nama, kategori, harga, klasifikasi jenis stok (porsi yang ditrack, varian yang berbagi stok, atau tanpa stok), batas minimum stok, dan definisi sub-pilihan untuk menu paket.
> 3. Mendukung dua tipe order: *dine-in* dengan pemilihan meja, dan *takeaway* tanpa meja. Sumber order takeaway (walk-in, GoFood, GrabFood, atau gosend) dibedakan melalui metode pembayaran, bukan melalui sub-tipe order yang terpisah.
> 4. Mendukung penambahan, perubahan, dan pembatalan item pesanan sebelum pembayaran dilakukan oleh kasir sebagai aktor utama yang menerima catatan pesanan kertas dari waiter dan menginputnya ke sistem. Waiter memiliki akses *fallback* untuk menginput pesanan langsung ke sistem apabila kasir sedang tidak tersedia. Pembatalan transaksi tidak memerlukan otorisasi khusus.
> 5. Mendukung pemecahan tagihan (*split bill*) per item per pelanggan menghasilkan beberapa struk terpisah, dan penggabungan tagihan (*merge bill*) dari beberapa meja menjadi satu struk dengan mekanisme *self-reference* pada transaksi sumber. Kedua mekanisme ini dilakukan oleh kasir saja, tidak diakses oleh waiter.
> 6. Menyediakan mekanisme sub-pilihan dinamis untuk menu paket: kasir (atau waiter sebagai *fallback*) memilih variant (misalnya paha atau dada, bakar atau goreng) saat menambahkan paket ke pesanan, dan sistem mengurangi stok porsi sesuai pilihan tersebut.
> 7. Memproses pembayaran dengan enam metode (cash, EDC, QRIS, Gojek, Grab, transfer) yang dilakukan oleh kasir saja (waiter tidak memiliki akses ke pembayaran), dengan input bank pendamping khusus untuk metode EDC dan transfer agar laporan rekonsiliasi dapat dilakukan per bank. Pajak PB1 sepuluh persen ditambahkan otomatis, diskon manual didukung, dan struk pembayaran dicetak dalam format PDF yang disimpan ke perangkat kasir.
> 8. Melakukan pengurangan stok porsi secara otomatis saat pesanan diinput ke POS (bukan saat pembayaran), dengan memperbolehkan stok bernilai negatif untuk mengakomodasi situasi habis di tengah hari.
> 9. Mencatat masuknya stok darurat (fitur "Barang Masuk") saat pemilik mengirim restock dari rumah pada tengah hari, dengan dukungan input kelipatan lima porsi dan dokumentasi detail breakdown.
> 10. Memungkinkan restock pagi stok porsi dengan formula kelipatan lima yang menjaga stok akhir di atas batas minimum.
> 11. Menyediakan fitur opname untuk koreksi nilai stok porsi (pagi, setelah restock) ketika kondisi sistem menyimpang dari realita fisik, dengan jejak audit yang mencatat selisih dan pelaku koreksi.
> 12. Menyediakan pencatatan modal/harga pokok (COGS) per menu yang hanya dapat diakses Pemilik, dengan nilai modal yang dinyatakan langsung per menu (bukan dihitung dari konsumsi bahan baku), serta jejak riwayat perubahan modal. Modal tidak ditampilkan pada katalog menu publik (POS).
> 13. Melakukan tutup kasir akhir hari oleh kasir shift malam saja, dengan rekap sederhana enam total metode pembayaran (sistem dan fisik) beserta rincian per bank untuk EDC dan transfer, dan perhitungan variansnya per metode.
> 14. Menghitung laba rugi harian dengan rumus laba kotor = total penjualan dikurangi total harga modal (jumlah `unit_cost` × jumlah terjual atas transaksi lunas), di mana modal di-*snapshot* per item saat order dibuat sehingga laba periode lampau tidak berubah meskipun modal diperbarui kemudian. Tagihan operasional bulanan ditampilkan terpisah dan tidak dikurangkan ke laba kotor.
> 15. Mencatat tagihan operasional bulanan (kebersihan, listrik, air, parkir, sewa) yang hanya dapat diakses oleh Pemilik.
> 16. Menyediakan dashboard masing-masing peran dengan reminder stok porsi yang menipis, serta laporan periodik pendapatan, COGS, dan laba kotor bagi Pemilik.
> 17. Menyimpan jejak audit untuk seluruh perubahan kondisi stok porsi melalui tabel log `portion_movements` (delta, alasan: order/restock pagi/restock darurat/penyesuaian manual, pengguna pelaku, waktu) serta jejak perubahan modal menu melalui tabel log `menu_cost_movements`, sehingga pemilik dapat menelusuri kapan dan oleh siapa setiap perubahan stok dan modal terjadi.
> 18. Menerapkan pembatasan akses (otorisasi) per peran pada tingkat fungsional sesuai matriks kewenangan: pemilik memiliki akses penuh terhadap seluruh fitur termasuk tagihan operasional bulanan, modal/COGS menu, dan pengelolaan data master; kasir memiliki akses ke pengelolaan transaksi (input order, pembayaran, split/merge bill, void), pengelolaan stok porsi (restock, barang masuk, opname), serta buka dan tutup kasir; sedangkan waiter memiliki akses ke pengelolaan stok porsi dan opname seperti kasir, ditambah akses *fallback* untuk menginput pesanan ke sistem hanya bila kasir sedang tidak tersedia. Waiter tidak memiliki akses ke proses pembayaran, settlement akhir hari, modal/COGS, maupun tagihan operasional. Pembatasan ini diterapkan baik di sisi antarmuka (tombol/halaman tersembunyi sesuai peran) maupun di sisi *endpoint* basis data (validasi peran pengguna).

### Kebutuhan Non-Fungsional

> Selain kebutuhan fungsional, sistem juga harus memenuhi kebutuhan non-fungsional berikut:
>
> 1. **Kemudahan penggunaan** - antarmuka harus dapat dioperasikan oleh pegawai non-teknis dengan minimal pelatihan, mengingat kasir merupakan anggota keluarga pemilik yang bukan pengguna teknologi mahir, dan waiter dilatih cepat untuk membantu input order.
> 2. **Aksesibilitas mobile-first sebagai PWA** - aplikasi diakses melalui peramban pada telepon seluler dengan dukungan instalasi *progressive web app* ke layar utama, mengingat restoran tidak memiliki komputer maupun jaringan WiFi internal.
> 3. **Konektivitas berbasis paket data atau WiFi tetangga** - sistem harus tetap responsif pada koneksi yang tidak stabil.
> 4. **Keamanan akses dengan pembatasan per peran** - fitur input tagihan bulanan hanya dapat diakses oleh Pemilik meskipun kasir merupakan anggota keluarga.
> 5. **Konsistensi dan jejak audit perubahan stok** - setiap perubahan stok porsi (akibat order, restock pagi, restock darurat, atau penyesuaian manual via opname) tercatat di log audit yang menyimpan alasan, kuantitas, dan pengguna pelakunya.
> 6. **Kecepatan respons** - proses pembayaran satu transaksi tidak melebihi 30 detik sejak kasir menekan tombol bayar hingga konfirmasi muncul.

---

## 3.1.4 Batasan Penelitian - Bill of Materials dan Inventori Bahan Baku (Out of Scope)

> Perhitungan harga pokok produksi (HPP) berbasis bahan memerlukan data konsumsi bahan baku yang terukur dan tercatat secara akurat untuk setiap siklus produksi melalui *Bill of Materials* atau resep. Namun, pada restoran kecil berbasis keluarga seperti objek penelitian ini, proses memasak dilakukan secara batch tanpa penimbangan bahan yang baku, dan komposisi peracikan bumbu bersifat tidak tetap serta tidak terdokumentasi. Hal ini menyebabkan data input yang dibutuhkan untuk menghitung HPP berbasis bahan tidak tersedia secara konsisten. Oleh karena itu, sistem tidak menyertakan *Bill of Materials*, resep, maupun pencatatan inventori bahan baku mentah; inventori dibatasi pada barang siap jual satuan porsi (sesuai ruang lingkup penelitian Bab 1).
>
> Sebagai gantinya, harga modal (*Cost of Goods Sold*/COGS) dinyatakan langsung per menu oleh Pemilik sebagai satu nilai modal per porsi yang bersifat *owner-authoritative*. Pelacakan laba rugi harian dilakukan dengan rumus laba kotor = total pendapatan dikurangi total harga modal (modal satuan dikalikan jumlah terjual) yang di-*snapshot* per item transaksi saat order dibuat, sementara tagihan operasional bulanan ditampilkan terpisah. Pendekatan ini dipilih karena sesuai dengan karakteristik restoran kecil yang tidak melakukan *standard costing*, namun tetap membutuhkan gambaran profitabilitas harian.

---

## 3.2.1 Proses Bisnis yang Diusulkan

> Sistem yang diusulkan mengubah proses bisnis restoran dari pencatatan manual berbasis buku menjadi pencatatan terintegrasi berbasis aplikasi *progressive web app* dengan basis data tunggal sebagai acuan. Proses bisnis yang dikomputerisasi mencakup delapan alur utama berikut.
>
> **Pertama, autentikasi pengguna**, di mana setiap pegawai wajib login menggunakan kombinasi nama dan PIN enam digit. Saat pertama kali login di suatu perangkat, pegawai mengisi nama pengguna pada *field* teks dan PIN pada *numpad* enam digit, lalu menekan tombol kirim; sistem memvalidasi kombinasi nama dan PIN - apabila benar, pegawai diarahkan ke halaman dashboard yang menyesuaikan dengan peran (Pemilik, Kasir, atau Waiter), sekaligus menyimpan nama pegawai tersebut di penyimpanan lokal perangkat. Untuk login berikutnya di perangkat yang sama, sistem menampilkan layar PIN-only dengan nama pegawai terisi otomatis dari *cache* - pegawai cukup memasukkan PIN enam digit dan sistem otomatis memverifikasi. Tombol *Ganti Pengguna* tersedia bila perangkat dipakai pegawai berbeda, yang akan mereset *cache* dan kembali menampilkan form dua *field*. Apabila kombinasi nama dan PIN salah, sistem menampilkan pesan kesalahan dan pegawai mengulang pengisian PIN. PIN diperbolehkan duplikat antar pegawai karena identifikasi dilakukan melalui kombinasi nama dan PIN.
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
> **Ketujuh, tutup kasir akhir hari** oleh kasir shift malam saja, di mana sistem menampilkan total penjualan per enam metode pembayaran beserta rincian per bank untuk EDC dan transfer, kasir memasukkan jumlah fisik per metode, dan sistem menghitung variansnya untuk dokumentasi rekonsiliasi.
>
> **Kedelapan, pencatatan tagihan operasional bulanan** oleh Pemilik dengan kategori (kebersihan, listrik, air, parkir, atau sewa) dan nominal, sebagai pengganti tempelan struk pada buku pencatatan lama. Fitur ini hanya dapat diakses oleh Pemilik meskipun kasir merupakan anggota keluarga. Selain itu, Pemilik menetapkan harga modal (COGS) per menu yang dipakai sistem untuk menghitung laporan laba rugi harian (laba kotor = pendapatan dikurangi COGS); penetapan modal ini berupa pengisian satu nilai modal per menu, bukan alur operasional harian, sehingga tidak digambarkan sebagai *activity diagram* tersendiri.

---

## 3.2.2 Use Case Diagram

> *Use case diagram* pada Gambar 3.1 mendeskripsikan interaksi antara pengguna dengan Sistem POS Restoran. Sistem melibatkan tiga aktor - Pemilik (*Owner*), Kasir, dan Waiter - yang berinteraksi dengan sembilan belas *use case* yang terbagi dalam empat domain.
>
> Domain pertama adalah autentikasi melalui *use case* `Login` yang wajib dilakukan oleh seluruh aktor. Domain kedua adalah operasional transaksi yang mencakup `Buka Kasir`, `Mengelola Pesanan Meja` (dua tipe order: dine-in dan takeaway), `Memilih Sub-Pilihan Paket`, `Memecah Tagihan`, `Menggabungkan Tagihan`, `Membatalkan Pesanan`, `Memproses Pembayaran` (dengan input bank untuk EDC dan transfer), `Mencetak Struk`, dan `Tutup Kasir`. Domain ketiga adalah manajemen stok yang mencakup `Restock Stok Porsi` (pagi, kelipatan lima), `Mencatat Barang Masuk` (restock darurat tengah hari), dan `Melakukan Opname Stok Porsi` (pagi setelah restock). Domain keempat adalah administrasi dan laporan yang mencakup `Mengelola Menu`, `Kelola Modal/COGS Menu` (Pemilik), `Mengelola Pengguna`, `Mencatat Tagihan Bulanan` (Pemilik), `Mereview Settlement`, dan `Melihat Dashboard dan Laporan`.
>
> Hubungan `<<include>>` ditunjukkan dari setiap *use case* operasional ke `Login`, menandakan bahwa autentikasi merupakan prasyarat wajib (delapan belas hubungan include). Hubungan `<<extend>>` digunakan pada tiga skenario opsional: `Mencetak Struk` ke `Memproses Pembayaran` (struk dicetak hanya apabila pelanggan meminta), `Memilih Sub-Pilihan Paket` ke `Mengelola Pesanan Meja` (sub-pilihan muncul hanya apabila item yang ditambahkan adalah paket), dan `Memecah Tagihan` ke `Memproses Pembayaran` (split bill dilakukan hanya apabila pelanggan meminta bill terpisah per pelanggan). Sesuai ruang lingkup penelitian, sistem membatasi inventori pada barang siap jual satuan porsi sehingga tidak terdapat *use case* pengelolaan bahan baku mentah, vendor, maupun pencatatan pembelian; harga modal/COGS dinyatakan langsung per menu oleh Pemilik melalui *use case* `Kelola Modal/COGS Menu`.

**Gambar 3.1** *Use Case Diagram Sistem POS Restoran*
*(File: `docs/diagrams/use-case-diagram-sistem-pos-restoran.png`)*

---

## 3.2.3 Activity Diagram

> *Activity diagram* digunakan untuk menggambarkan alur kerja proses bisnis utama yang teridentifikasi pada *use case diagram*. Setiap *activity diagram* menggunakan *swimlane* (partisi vertikal) untuk memisahkan tanggung jawab antara aktor dan sistem. Setiap aksi dinyatakan dalam bahasa bisnis yang mudah dipahami oleh pegawai non-teknis. Setiap titik keputusan diberi label pertanyaan dengan jawaban `Ya` atau `Tidak` pada masing-masing cabang. Sub-bab berikut menjelaskan sembilan *activity diagram* yang dirancang untuk sistem ini. (Catatan REV 2.11: *activity diagram* Opname Raw Materials dan Mencatat Pembelian dihapus bersama subsistem belanja/raw-materials; penomoran Gambar di bawah perlu disusun ulang oleh penulis.)

### 3.2.3.1 Activity Diagram Login

> Gambar 3.2 menjelaskan alur proses login. Aktor (Pemilik, Kasir, atau Waiter) membuka aplikasi POS, lalu sistem menampilkan formulir login berisi dua *field*: nama pengguna dan PIN enam digit. Aktor mengetik nama pengguna mereka secara manual dan memasukkan PIN, lalu menekan tombol kirim. Sistem melakukan validasi dengan mencari pengguna berdasarkan nama yang dimasukkan dan mencocokkan PIN - PIN diperbolehkan duplikat antar pegawai karena identifikasi dilakukan melalui kombinasi nama dan PIN, dengan nama yang unik per pegawai berfungsi sebagai identifier dan PIN sebagai kata sandi. Apabila kombinasi nama dan PIN tidak cocok, sistem menampilkan pesan kesalahan dan aktor mengulang pengisian. Apabila cocok, sistem mengarahkan aktor ke halaman dashboard yang menyesuaikan dengan peran pengguna. Aktivitas ini tidak menggunakan layar pemilihan nama dari daftar maupun mekanisme penyimpanan nama pengguna terakhir di perangkat - setiap login pegawai mengetik nama mereka manual, sesuai realita restoran kecil keluarga di mana satu perangkat dapat dipakai bergantian oleh beberapa pegawai dalam satu shift.

**Gambar 3.2** *Activity Diagram Login*
*(File: `docs/diagrams/activity-diagram-login.png`)*

### 3.2.3.2 Activity Diagram Order Flow

> Gambar 3.3 menjelaskan alur pengelolaan pesanan dengan tiga *swimlane*: Waiter, Kasir, dan Sistem. Untuk pesanan *dine-in*, waiter menerima pesanan secara verbal dari pelanggan di meja, mencatatnya di kertas, dan menyerahkan catatan tersebut ke kasir melalui dapur restoran (yang menyiapkan makanan dari stok beku jadi). Kasir kemudian memilih tipe order *dine-in* di sistem dan memilih nomor meja - sistem akan memeriksa apakah meja sudah memiliki transaksi yang masih terbuka sebelumnya dan menggabungkan dengan pesanan yang sudah ada bila perlu, mengakomodasi praktik pelanggan dine-in yang menambah pesanan beberapa kali dalam satu sesi makan. Untuk pesanan *takeaway* (baik pelanggan walk-in yang datang langsung minta dibungkus, maupun pesanan yang masuk dari aplikasi GoFood atau GrabFood), kasir langsung memilih tipe *takeaway* di sistem tanpa pemilihan meja dan tanpa perantara waiter. Sumber order takeaway tidak dipilah pada tahap ini karena akan dibedakan melalui metode pembayaran di tahap berikutnya. Apabila kasir sedang tidak tersedia (misalnya sedang menelepon pemilik untuk koordinasi restock atau sedang menangani urusan operasional lain), waiter dapat menginput pesanan langsung ke sistem sebagai jalur *fallback* dengan akun POS-nya sendiri - diagram pada Gambar 3.3 menggambarkan alur *primary*, sedangkan alur *fallback* memiliki langkah-langkah identik dengan jalur kasir, hanya saja aktor pada *swimlane* berbeda.
>
> Setelah tipe order dipilih, sistem menampilkan grid katalog menu. Saat aktor memilih item, sistem memeriksa apakah item tersebut merupakan paket dengan sub-pilihan dinamis. Apabila ya, sistem menampilkan dialog pemilihan variant (misalnya paha atau dada, bakar atau goreng, jenis minuman). Berdasarkan pilihan tersebut, sistem memetakan ke stok porsi target yang akan berkurang. Apabila item bukan paket, sistem langsung menggunakan item itu sendiri. Item lalu ditambahkan ke keranjang. Setelah selesai menambahkan semua item, aktor menyimpan pesanan, dan sistem mengurangi stok porsi untuk setiap item dengan jenis stok porsi atau berbagi stok (boleh menjadi negatif) sekaligus mencatat log audit perubahan stok pada `portion_movements`.

**Gambar 3.3** *Activity Diagram Order Flow*
*(File: `docs/diagrams/activity-diagram-order-flow.png`)*

### 3.2.3.3 Activity Diagram Pay Flow

> Gambar 3.4 menjelaskan alur pembayaran pesanan. Kasir memilih opsi bayar untuk transaksi yang masih terbuka, kemudian sistem menampilkan rincian: subtotal, diskon (yang dapat diisi manual oleh kasir), pajak PB1 10% yang otomatis dihitung dari subtotal dikurangi diskon, dan total akhir. Sistem menampilkan enam metode pembayaran yang tersedia (cash, EDC, QRIS, Gojek, Grab, transfer) - semua metode tersedia untuk kedua tipe order karena sumber takeaway dibedakan dari metode pembayaran yang dipilih.
>
> Kasir memilih metode pembayaran. Apabila metode adalah EDC atau transfer, sistem menampilkan input bank pendamping dengan autocomplete dari riwayat bank sebelumnya (misalnya BCA, Mandiri, BRI) - input ini wajib karena Pemilik membutuhkan laporan rekonsiliasi per bank untuk mutasi rekening. Apabila metode adalah cash, sistem meminta input jumlah uang diterima dan memvalidasi kecukupan nominal - jika kurang, alur kembali ke input. Setelah validasi lolos, sistem menandai pesanan sebagai lunas. Jika pelanggan meminta split bill, sistem mengalihkan ke alur pemecahan tagihan (Gambar 3.12) yang menghasilkan beberapa struk terpisah. Jika pelanggan meminta cetak struk, sistem menghasilkan struk dalam format PDF dan menyimpannya ke perangkat kasir. Sistem akhirnya menampilkan konfirmasi pembayaran beserta jumlah kembalian apabila pembayaran cash.

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

> Gambar 3.7 menjelaskan alur opname stok porsi yang dilakukan kasir atau waiter, paling tepat di pagi hari setelah restock pagi dicatat. Aktor membuka halaman Stok Porsi dan menekan tombol Cek Fisik & Koreksi, lalu sistem menampilkan daftar 25 item dengan kondisi stok saat ini sebagai nilai default. Aktor mengecek kondisi fisik aktual di tempat penyimpanan, lalu memasukkan jumlah fisik untuk item yang berbeda dari kondisi sistem. Saat aktor menyimpan, sistem menghitung selisih per item, memperbarui kondisi stok ke jumlah fisik aktual, dan mencatat log audit dengan alasan "penyesuaian manual" beserta catatan selisih positif atau negatif. Aktivitas ini dirancang sebagai analog terhadap rekonsiliasi kas akhir shift - meskipun sistem sudah mencatat semua transaksi, tetap diperlukan verifikasi fisik untuk mendeteksi kebocoran (tumpah, busuk, salah catat) yang tidak terekam pada transaksi normal.

**Gambar 3.7** *Activity Diagram Opname Stok Porsi*
*(File: `docs/diagrams/activity-diagram-opname-stok-porsi.png`)*

> 🚧 **DIHAPUS REV 2.11:** sub-bab "Activity Diagram Opname Raw Materials" beserta Gambar terkait dihapus karena subsistem raw materials keluar dari ruang lingkup sistem (inventori = finished-goods porsi saja). Penomoran Gambar dan sub-bab berikutnya perlu disusun ulang oleh penulis.

### 3.2.3.7 Activity Diagram Tutup Kasir

> Gambar 3.9 menjelaskan alur tutup kasir akhir hari yang dilakukan oleh kasir shift malam saja, sekali dalam satu hari. Kasir mengklik tombol Tutup Kasir, lalu sistem memeriksa apakah masih ada pesanan yang belum dibayar. Apabila ada, sistem menampilkan peringatan dan daftar meja yang masih terbuka, serta meminta kasir menyelesaikan pembayaran terlebih dahulu - alur berakhir lebih awal. Apabila tidak ada, sistem menghitung total penjualan per enam metode pembayaran (cash, EDC, QRIS, Gojek, Grab, transfer) berdasarkan data transaksi pada hari tersebut beserta rincian per bank untuk EDC dan transfer (misalnya EDC BCA 200K, EDC Mandiri 150K), kemudian menampilkan form rekap dengan dua kolom: total dari sistem dan input total fisik dari kasir.
>
> Kasir mengisi total fisik untuk masing-masing dari enam metode (cash dihitung dari laci kas, sementara EDC, QRIS, Gojek, Grab, dan transfer dihitung dari mutasi rekening atau aplikasi merchant). Sistem menghitung varians per metode sebagai selisih antara total fisik dan total sistem, lalu menampilkan ringkasan rekap beserta total varians keseluruhan. Setelah kasir mengkonfirmasi, sistem menyimpan hasil rekap ke tabel `settlements` dan menutup shift dengan menandai waktu penutupan.

**Gambar 3.9** *Activity Diagram Tutup Kasir*
*(File: `docs/diagrams/activity-diagram-tutup-kasir.png`)*

> 🚧 **DIHAPUS REV 2.11:** sub-bab "Activity Diagram Mencatat Pembelian" beserta Gambar terkait dihapus karena fitur pencatatan pembelian belanja (beserta vendor dan raw materials) keluar dari ruang lingkup sistem. Penomoran Gambar dan sub-bab berikutnya perlu disusun ulang oleh penulis.

### 3.2.3.8 Activity Diagram Mencatat Tagihan Bulanan

> Gambar 3.11 menjelaskan alur Pemilik dalam mencatat tagihan operasional bulanan. Pemilik membuka halaman Tagihan (kasir tidak memiliki akses ke halaman ini meskipun kasir merupakan anggota keluarga, baik di sisi *user interface* maupun *endpoint* basis data). Sistem menampilkan formulir dengan kolom bulan (dalam format YYYY-MM), kategori (kebersihan, listrik, air, parkir, atau sewa), jumlah nominal, dan catatan opsional. Pemilik mengisi data, lalu sistem memvalidasi input. Apabila tidak valid (misalnya jumlah kosong atau peran bukan Pemilik), sistem menampilkan pesan kesalahan. Apabila valid, sistem menyimpan tagihan dan menampilkan daftar tagihan bulan ini beserta total.

**Gambar 3.11** *Activity Diagram Mencatat Tagihan Bulanan*
*(File: `docs/diagrams/activity-diagram-mencatat-tagihan.png`)*

### 3.2.3.9 Activity Diagram Split Bill dan Merge Bill

> Gambar 3.12 menjelaskan dua alur terkait: pemecahan tagihan (*split bill*) dan penggabungan tagihan (*merge bill*).
>
> **Alur split bill** dimulai saat kasir berada di dialog pembayaran dan pelanggan meminta tagihan dipisah per pelanggan. Kasir menekan opsi Split Bill, lalu sistem menampilkan daftar semua item dan tombol untuk menambah pelanggan baru (misalnya Pelanggan A, Pelanggan B). Kasir mengelompokkan item ke pelanggan masing-masing - setiap item dapat ditandai sebagai milik pelanggan tertentu via *party id*. Sistem menghitung total per pelanggan (subtotal beserta proporsi diskon dan PB1). Kasir kemudian memproses pembayaran satu per satu per pelanggan, dengan metode pembayaran dan bank yang bisa berbeda antar pelanggan, dan sistem menghasilkan struk PDF terpisah untuk masing-masing.
>
> **Alur merge bill** dimulai saat kasir berada di halaman Meja dan rombongan dari beberapa meja meminta bayar bersama. Kasir menekan opsi Merge Bill, lalu sistem menampilkan daftar meja yang sedang terisi. Kasir memilih dua atau lebih meja yang akan digabung, dan sistem menampilkan keranjang gabungan berisi semua item dari transaksi-transaksi tersebut. Setelah kasir mengkonfirmasi, sistem membuat transaksi parent baru sebagai gabungan, lalu menandai transaksi sumber dengan *self-reference* `merged_into_id` agar jejak audit tetap terjaga. Kasir kemudian memproses pembayaran normal untuk transaksi parent yang sudah digabung tersebut (bisa juga dipecah lebih lanjut dengan split bill).

**Gambar 3.12** *Activity Diagram Split Bill dan Merge Bill*
*(File: `docs/diagrams/activity-diagram-split-merge-bill.png`)*

---

## 3.2.4 Entity Relationship Diagram

> Struktur penyimpanan data sistem dirancang dengan pendekatan basis data relasional yang digambarkan dalam *Entity Relationship Diagram* pada Gambar 3.13 menggunakan notasi *crow's-foot*.

**Gambar 3.13** *Entity Relationship Diagram Sistem POS Restoran*
*(File: `docs/diagrams/erd-sistem-pos-restoran.png`)*

> Sistem terdiri atas sepuluh entitas utama. Entitas `users` menyimpan data seluruh pengguna beserta peran (Pemilik, Kasir, atau Waiter) dan PIN autentikasi yang diperbolehkan duplikat antar pegawai karena identifikasi dilakukan via nama. Entitas `menus` menyimpan master katalog 60 menu beserta klasifikasi jenis stok (porsi yang ditrack, varian yang berbagi stok dengan menu lain, atau tanpa stok), batas minimum stok, definisi sub-pilihan dalam format JSON untuk menu paket, serta harga modal (*Cost of Goods Sold*/COGS) per menu pada kolom `cost` yang hanya dapat diakses Pemilik dan tidak dibocorkan ke katalog publik. Entitas `portion_stocks` menyimpan kondisi stok porsi terkini per menu sebagai *live count* yang terus berubah seiring transaksi (dengan dukungan nilai negatif untuk mengakomodasi situasi habis di tengah hari) beserta kondisi awal hari (*opening qty*) yang otomatis di-snapshot saat pengguna pertama login pagi - kondisi ini dipakai untuk menghitung metric "terjual hari ini" pada dashboard. Entitas `portion_movements` menyimpan log audit setiap perubahan stok porsi beserta alasannya (akibat order, restock pagi, restock darurat, atau penyesuaian manual via opname), dan entitas `menu_cost_movements` menyimpan log audit setiap perubahan harga modal per menu (nilai sebelum dan sesudah, alasan, pengguna pelaku, dan waktu).
>
> Entitas `shifts` mencatat siklus shift per kasir per hari per jenis (pagi atau malam) beserta modal awal laci kas. Entitas `transactions` menyimpan *header* pesanan dengan dua tipe order (dine-in atau takeaway), nomor meja yang opsional, status pesanan, metode pembayaran beserta nama bank pendamping yang terisi khusus untuk metode EDC dan transfer (agar laporan rekonsiliasi dapat dilakukan per bank), rincian nominal termasuk pajak PB1 10%, dan *self-reference* `merged_into_id` untuk mengakomodasi fitur merge bill. Entitas `transaction_items` sebagai entitas asosiatif (*junction*) antara menu dan transaksi yang menyimpan jumlah, harga jual *snapshot*, harga modal *snapshot* (`unit_cost`) untuk perhitungan laba kotor, pilihan sub-options untuk paket, dan identifier pelanggan (*party id*) untuk dukungan split bill. Entitas `settlements` menyimpan hasil rekap akhir hari oleh kasir shift malam dengan enam total metode pembayaran (sistem dan fisik); rincian per bank untuk EDC dan transfer dihitung di *runtime* dari tabel transaksi sehingga tidak disimpan duplikat di tabel ini. Entitas `bills` menyimpan tagihan operasional bulanan yang hanya dapat diakses oleh Pemilik dan ditampilkan terpisah dari laba kotor. Sesuai ruang lingkup penelitian, sistem tidak menyertakan entitas bahan baku mentah (*raw materials*), vendor, maupun pencatatan pembelian.
>
> Sistem memiliki tujuh belas relasi yang menghubungkan entitas-entitas tersebut, dengan dominasi relasi satu-ke-banyak (sebagai contoh, satu kasir dapat melakukan banyak transaksi), satu relasi satu-ke-satu antara `shifts` dan `settlements` di mana setiap shift malam menghasilkan tepat satu rekap, dan satu relasi *self-reference* pada `transactions` untuk merge bill. Relasi banyak-ke-banyak antara menu dan transaksi dijabarkan sebagai entitas asosiatif `transaction_items`. Sistem secara sengaja tidak menyertakan *Bill of Materials* atau resep yang men-*decrement* bahan mentah saat order; harga modal (COGS) dinyatakan langsung per menu, sesuai keputusan perancangan bahwa HPP berbasis bahan berada di luar lingkup sistem (lihat sub-bab 3.1.4 Batasan Penelitian). Detail atribut dan tipe data setiap entitas dijabarkan pada Tabel 3.2 hingga Tabel 3.11 di sub-bab berikutnya. *(Catatan REV 2.11: penomoran Gambar dan Tabel perlu disusun ulang oleh penulis sesuai pengurangan entitas dan diagram.)*

---

## 3.2.5 Data Dictionary

> Definisi rinci atribut, tipe data, dan keterangan untuk setiap entitas dijabarkan pada Tabel 3.2 hingga Tabel 3.15 berikut. Tipe data yang digunakan merujuk pada konvensi DBMS basis data relasional standar.

**Cara melengkapi:**

Buka [`docs/DATA-DICTIONARY.md`](../DATA-DICTIONARY.md) (PERLU UPDATE ke REV 2.3 - saat ini masih versi REV 1 dengan 8 entitas; perlu rewrite ke 14 entitas REV 2.2 - REV 2.3 tidak menambah entitas, hanya bump version). Untuk masing-masing entitas, tulis pengantar 1 kalimat lalu tempel tabel di bawahnya:

| Tabel | Entitas | Pengantar (paste-ready) |
|---|---|---|
| 3.2 | `users` | "Tabel `users` menyimpan data seluruh pengguna sistem POS yang terbagi dalam tiga peran (Pemilik, Kasir, Waiter) beserta PIN autentikasinya. PIN diperbolehkan duplikat antar pegawai karena identifikasi via nama. Definisi rinci atribut ditunjukkan pada Tabel 3.2." |
| 3.3 | `menus` | "Tabel `menus` menyimpan master katalog menu siap jual beserta harga, kategori, klasifikasi jenis stok, batas minimum stok, dan definisi sub-pilihan untuk menu paket. Definisi rinci atribut ditunjukkan pada Tabel 3.3." |
| 3.4 | `portion_stocks` | "Tabel `portion_stocks` menyimpan kondisi stok porsi terkini per menu sebagai *live count* (dengan dukungan nilai negatif) beserta kondisi awal hari (*opening qty*) yang otomatis di-snapshot saat pengguna pertama login pagi. Definisi rinci atribut ditunjukkan pada Tabel 3.4." |
| 3.5 | `portion_movements` | "Tabel `portion_movements` (revisi penyesuaian nama dari `stock_movements`) menyimpan log audit setiap perubahan stok porsi beserta alasan dan pengguna yang melakukannya. Definisi rinci atribut ditunjukkan pada Tabel 3.5." |
| 3.6 | `menu_cost_movements` | "Tabel `menu_cost_movements` menyimpan log audit setiap perubahan harga modal (COGS) per menu beserta nilai sebelum dan sesudah, alasan, pengguna pelaku (Pemilik), dan waktu kejadian. Definisi rinci atribut ditunjukkan pada Tabel 3.6." |
| 3.7 | `shifts` | "Tabel `shifts` mencatat siklus shift per kasir per hari per jenis (pagi atau malam) beserta modal awal yang diinput saat buka kasir. Definisi rinci atribut ditunjukkan pada Tabel 3.7." |
| 3.8 | `transactions` | "Tabel `transactions` menyimpan *header* pesanan beserta tipe order, status, total, metode pembayaran beserta nama bank pendamping untuk EDC dan transfer, pajak PB1, dan *self-reference* untuk merge bill. Definisi rinci atribut ditunjukkan pada Tabel 3.8." |
| 3.9 | `transaction_items` | "Tabel `transaction_items` menyimpan rincian item per transaksi sebagai entitas asosiatif antara menu dan transaksi, lengkap dengan jumlah, harga jual *snapshot*, harga modal *snapshot* (`unit_cost`), pilihan sub-options paket, dan identifier pelanggan untuk split bill. Definisi rinci atribut ditunjukkan pada Tabel 3.9." |
| 3.10 | `settlements` | "Tabel `settlements` menyimpan rekap akhir hari oleh kasir shift malam dengan enam total metode pembayaran sistem dan fisik. Definisi rinci atribut ditunjukkan pada Tabel 3.10." |
| 3.11 | `bills` | "Tabel `bills` menyimpan tagihan operasional bulanan yang hanya dapat diakses oleh Pemilik. Definisi rinci atribut ditunjukkan pada Tabel 3.11." |

> 🚧 **REV 2.11:** Tabel `raw_materials`, `raw_material_movements`, `vendors`, `purchases`, `purchase_items` dihapus dari data dictionary (subsistem belanja/raw-materials keluar dari sistem). Penomoran Tabel di atas (3.6–3.11) sudah mencerminkan penghapusan tersebut + penambahan `menu_cost_movements`; **mapping Gambar/Tabel di bagian atas dokumen ini belum disusun ulang dan perlu review penulis.**

> Untuk format tabel itu sendiri, langsung *copy-paste* dari `docs/DATA-DICTIONARY.md` (perlu update ke REV 2.3). Caption tabel pakai format `Tabel 3.X *Definisi Atribut Tabel <nama>*`.

---

## Tips Teknis Penulisan

1. **Caption gambar** di **bawah** gambar; **caption tabel** di **atas** tabel - konvensi UK Petra.
2. **Setiap gambar dan tabel WAJIB di-rujuk** di paragraf dengan kalimat seperti *"ditunjukkan pada Gambar 3.x"* atau *"seperti pada Tabel 3.x"*. Jangan letakkan gambar/tabel tanpa rujukan teks.
3. **Istilah teknis dimiringkan** (*italic*) saat pertama muncul: *swimlane*, *snapshot*, *live count*, *progressive web app*, *split bill*, *merge bill*, *self-reference*, *opening qty*, *foreign key*. Setelahnya boleh tegak.
4. **Bahasa pasif** untuk teks akademik: "*sistem dirancang untuk*", "*proses bisnis dilakukan*", bukan "*kita merancang*" atau "*kami melakukan*".
5. **Konsistensi penamaan aktor** - gunakan istilah Indonesia dengan istilah Inggris dalam tanda kurung saat pertama muncul: "*Pemilik (Owner)*", "*Waiter*". Setelahnya boleh pakai salah satunya saja.
6. **Tabel WAJIB dijelaskan dalam kalimat** di paragraf - bukan sekadar dilemparkan tanpa narasi (per Pedoman SIB hal. 6).

## Self-Check sebelum Submit Bab 3

- [ ] Numbering sudah sesuai pedoman: 3.1 Analisis (umbrella) → 3.1.1, 3.1.2, 3.1.3, 3.1.4 → 3.2 Desain Sistem (umbrella) → 3.2.1, 3.2.2, 3.2.3, 3.2.4, 3.2.5.
- [ ] 3.1.1 Analisis Permasalahan sudah ada (konten yang sudah kamu tulis).
- [ ] 3.1.2 Tabel kebutuhan informasi (Tabel 3.1) dirujuk di paragraf, lalu tabel ditampilkan, lalu dijelaskan dengan paragraf di bawahnya.
- [ ] 3.1.3 Kebutuhan Fungsional (18 item) + Non-Fungsional (6 item).
- [ ] 3.1.4 Batasan Penelitian - HPP dan Bill of Materials out of scope, dengan 2 paragraf justifikasi paste-ready.
- [ ] 3.2.1 Proses Bisnis yang Diusulkan: paragraf naratif sepuluh proses, tanpa figure.
- [ ] 3.2.2 Use Case Diagram (Gambar 3.1) dirujuk di paragraf pertama, lalu narasi tiga paragraf (20 UC, 3 actor, 19 include, 3 extend).
- [ ] 3.2.3 Activity Diagram sebelas sub-bab, masing-masing punya pengantar paragraf + Gambar 3.2 sampai 3.12.
- [ ] 3.2.4 ERD (Gambar 3.13) dirujuk di paragraf pengantar, lalu narasi empat belas entitas + sembilan belas relasi.
- [ ] 3.2.5 Data Dictionary: empat belas tabel di Tabel 3.2 hingga 3.15.
- [ ] Tidak ada penyebutan eksplisit Express, React, MySQL, JWT - istilah teknologi ditahan ke Bab 4. Yang boleh: "*basis data relasional*", "*aplikasi berbasis web*", "*progressive web app*".

---

## Catatan tentang Pedoman SIB

Pedoman SIB UK Petra menyebutkan **3.2.1 Blok Diagram Desain Sistem** dan **3.2.3 Pengolahan Data dan Metode** sebagai sub-bab yang umumnya ada. Kedua sub-bab tersebut **dilewatkan** atas arahan pembimbing yang membatasi cakupan diagram pada Bab 3 ini hanya pada *use case*, *activity*, dan ERD. Selain itu, *sequence diagram*, *class diagram*, dan *flowchart* juga tidak digunakan dalam Bab 3 ini sesuai arahan yang sama.

Pedoman juga menyebutkan bahwa "*Activity diagram boleh diletakkan di lampiran*". Pada draft ini, *activity diagram* tetap diletakkan pada main body (sub-bab 3.2.3) dengan sebelas sub-bab terpisah agar lebih mudah dirujuk dan dievaluasi oleh pembimbing. Apabila pembimbing meminta agar dipindahkan ke lampiran, pengantar pada 3.2.3 dapat diringkas menjadi satu paragraf yang merujuk pada Lampiran A.

---

## Perubahan REV 2.2 → REV 2.3 (permission matrix + login fix, no schema change)

| Aspek | REV 2.2 | REV 2.3 |
|---|---|---|
| Total entitas ERD | 14 | **14 (tetap)** - no schema change |
| Total relasi ERD | 19 | **19 (tetap)** - no schema change |
| Use Case count | 20 UC | **20 UC (tetap)** - annotation aktor diperjelas |
| Activity diagram count | 11 | **11 (tetap)** - A.2 tambah catatan *fallback* waiter, no visual change |
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
| Sumber otoritatif baru | - | [`docs/superpowers/specs/2026-05-24-permission-matrix-design.md`](../superpowers/specs/2026-05-24-permission-matrix-design.md) |
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
| Enum `StockMovementReason` | `order, restock_morning, restock_emergency, manual_adjust` | **`PortionMovementReason`** (rename) - values tetap + tambah `refund_void` |
| Enum baru | - | **`RawMaterialMovementReason`** (purchase, opname, manual_adjust) |
| Kebutuhan Fungsional | 16 item | **17 item** (+1 tentang audit log per kategori stok) |
| Alur opname raw materials | Update `stock_qty` saja | **Update `stock_qty` + insert log `raw_material_movements`** |
| Alur pembelian | Update `raw_materials.stock_qty/last_buy_date/unit_price` | **... + insert log `raw_material_movements` reason=`purchase`** |
| Use Case count | 20 UC | **20 UC (tetap)** - hanya note di UC opname/pembelian tentang audit log |
| Activity diagram count | 11 | **11 (tetap)** - step audit log ditambah di A.7 dan A.9 |

## Perubahan vs REV 2 (Diff lengkap)

| Aspek | REV 2 | REV 2.1 |
|---|---|---|
| Total Gambar | 12 | **13** (+1 Activity Opname Stok Porsi, +1 Activity Opname Raw Materials, −1 Activity Mencatat Stok Bahan) |
| Total Tabel data dictionary | 11 | **13** (+raw_materials, +vendors, +purchase_items, −bulk_stocks) |
| Total entitas ERD | 11 | **13** |
| Total relasi ERD | 13 | **17** |
| Total use case | 17 | **20** |
| Total activity diagram | 10 | **11** |
| Sub-bab 3.1.4 HPP out of scope | Tidak ada | **BARU - 2 paragraf justifikasi** |
| Tipe order (kebutuhan fungsional & UC & activity) | 4 jenis | **2 jenis** (dineIn/takeaway) |
| Payment + bank picker | Tidak ada | **BARU** (untuk EDC & transfer) |
| Merge bill mekanisme | Tidak detail | **Self-reference `merged_into_id`** |
| Raw materials structure | Rigid 5 jenis | **Fleksibel (is_tracked + category + unit)** |
| Vendor | Tidak ada | **Tabel baru, opsional** |
| Purchase items | JSON ad-hoc | **Normalized ke `purchase_items` dengan FK** |
| Opname stok porsi | Tidak ada UC/activity | **BARU - UC + activity dipisah** |
| Mencatat Stok Bahan (REV 2) | Rigid 5 jenis bahan | **REPLACE → Opname Raw Materials** (lebih fleksibel) |
