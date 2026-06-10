### 4.1.1.  Hasil Pengujian UAT Owner

#### Tabel 4.1 Tabel Pengujian UAT Owner

|                                                   |                                                                              |       |
| ------------------------------------------------- | ---------------------------------------------------------------------------- | ----- |
| Fitur                                             | Hasil Yang Diharapkan                                                        | Hasil |
| Login dengan Nama dan PIN                         | Berhasil masuk ke halaman dashboard owner                                    | Ok    |
| Ganti Pengguna                                    | Cache nama ter-reset dan kembali ke form login awal                          | Ok    |
| Melihat Dashboard Laporan Keuangan                | Data pendapatan, COGS, laba kotor, dan tagihan ditampilkan                   | Ok    |
| Filter Periode Laporan (Hari Ini / Bulan / Tahun) | Laporan menyesuaikan periode yang dipilih                                    | Ok    |
| Analitik Menu                                     | Data menu terlaris dan kontribusi pendapatan ditampilkan                     | Ok    |
| Analitik Tren Pendapatan                          | Grafik tren harian ditampilkan                                               | Ok    |
| Analitik Kinerja Kasir dan Waiter                 | Data jumlah transaksi per pegawai ditampilkan                                | Ok    |
| Input Order Dine-in (Pilih Meja)                  | Pesanan tersimpan dengan nomor meja yang dipilih                             | Ok    |
| Input Order Takeaway                              | Pesanan tersimpan tanpa nomor meja                                           | Ok    |
| Tambah Pesanan ke Transaksi Berjalan              | Item tambahan berhasil ditambahkan ke transaksi yang sama                    | Ok    |
| Catatan Item pada Pesanan                         | Catatan tersimpan bersama item pesanan                                       | Ok    |
| Edit Item Sebelum Dibayar                         | Jumlah item berhasil diubah dan stok ter-sesuaikan                           | Ok    |
| Hapus Item Sebelum Dibayar                        | Item berhasil dihapus dan stok dikembalikan                                  | Ok    |
| Pembayaran Tunai                                  | Transaksi berstatus lunas                                                    | Ok    |
| Pembayaran QRIS                                   | Transaksi berstatus lunas                                                    | Ok    |
| Pembayaran EDC (Pilih Bank)                       | Transaksi lunas dengan nama bank tercatat                                    | Ok    |
| Pembayaran Transfer (Pilih Bank)                  | Transaksi lunas dengan nama bank tercatat                                    | Ok    |
| Pembayaran Split-tender (Dua Metode Sekaligus)    | Dua metode pembayaran diterima dan transaksi berstatus lunas                 | Ok    |
| Diskon Manual pada Pembayaran                     | Total tagihan berkurang sesuai diskon yang diinput                           | Ok    |
| Penghitungan PB1 (Pajak)                          | Pajak terhitung dan ditampilkan pada ringkasan pembayaran                    | Ok    |
| Simpan Struk PDF                                  | Struk berhasil dibuat dan diunduh di perangkat                               | Ok    |
| Gabung Transaksi Meja (Merge)                     | Dua transaksi meja berhasil digabungkan menjadi satu                         | Ok    |
| Bayar Tagihan Hasil Gabungan                      | Pembayaran ter-cascade ke semua transaksi sumber                             | Ok    |
| Pisah Transaksi (Unmerge)                         | Transaksi berhasil dipisah kembali sebelum dibayar                           | Ok    |
| Void Pesanan                                      | Pesanan dibatalkan dan stok dikembalikan                                     | Ok    |
| Melihat Status Meja                               | Grid 9 meja menampilkan status kosong atau ada pesanan terbuka               | Ok    |
| Melihat Riwayat Transaksi                         | Daftar transaksi dengan filter tanggal dan status tersedia                   | Ok    |
| Preview Rekap Tutup Kasir                         | Total per metode pembayaran dan breakdown per bank ditampilkan               | Ok    |
| Submit Rekap Tutup Kasir                          | Data rekap harian berhasil disimpan                                          | Ok    |
| Review dan Verifikasi Settlement                  | Settlement kasir berhasil diverifikasi oleh owner                            | Ok    |
| Restock Stok Porsi Pagi                           | Stok bertambah dan tercatat sebagai restock pagi                             | Ok    |
| Barang Masuk Darurat                              | Stok bertambah dengan jumlah bebas dan tercatat                              | Ok    |
| Opname Stok Porsi                                 | Selisih antara stok fisik dan sistem tercatat sebagai audit log              | Ok    |
| Mark Habis                                        | Stok porsi berhasil di-set menjadi 0                                         | Ok    |
| Melihat Stok Hampir Habis                         | Daftar item dengan stok di bawah minimum ditampilkan                         | Ok    |
| Tambah Menu Baru                                  | Data menu baru berhasil tersimpan                                            | Ok    |
| Edit Menu                                         | Data menu berhasil diubah                                                    | Ok    |
| Set Modal/COGS Menu                               | Nilai modal tersimpan dan tercatat di riwayat perubahan                      | Ok    |
| Riwayat Perubahan Modal Menu                      | Riwayat perubahan modal ditampilkan                                          | Ok    |
| Upload Foto Menu                                  | Gambar menu berhasil diunggah                                                | Ok    |
| Kelola Varian dan Paket Menu                      | Varian tersedia dan dapat dipilih di layar pemesanan                         | Ok    |
| Tambah Tagihan Operasional                        | Data tagihan operasional berhasil tersimpan                                  | Ok    |
| Filter Tagihan per Bulan                          | Tagihan terfilter sesuai bulan yang dipilih                                  | Ok    |
| Tagihan Terpisah dari Laba Kotor                  | Laba kotor tidak dikurangi tagihan operasional; tagihan ditampilkan terpisah | Ok    |
| Kelola Metode Pembayaran                          | Metode berhasil ditambah, diubah, dan dinonaktifkan                          | Ok    |
| Kelola Bank                                       | Bank berhasil ditambah dan di-assign ke metode pembayaran                    | Ok    |
| Atur Pajak PB1                                    | Toggle pajak dan tarif berhasil diubah                                       | Ok    |
| Identitas Resto dan Logo                          | Nama dan logo tampil di halaman login dan sidebar navigasi                   | Ok    |
| Atur Urutan Metode Pembayaran                     | Urutan metode di layar pembayaran berubah sesuai pengaturan                  | Ok    |
| Kelola Data Pengguna/Pegawai                      | Data pengguna berhasil ditambah, diubah, dan dinonaktifkan                   | Ok    |
### 4.1.2.  Hasil Pengujian UAT Kasir

#### Tabel 4.2 Tabel Pengujian UAT Kasir

|   |   |   |
|---|---|---|
|Fitur|Hasil Yang Diharapkan|Hasil|
|Login dengan Nama dan PIN|Berhasil masuk ke halaman dashboard kasir|Ok|
|Melihat Dashboard Kasir|Info shift aktif dan ringkasan pendapatan hari ini ditampilkan|Ok|
|Buka Kasir (Pilih Shift Pagi/Malam dan Opening Cash)|Shift baru aktif; hanya satu shift dapat aktif sekaligus|Ok|
|Tutup Kasir|Shift berhasil ditutup setelah tidak ada transaksi terbuka|Ok|
|Input Order Dine-in (Pilih Meja)|Pesanan tersimpan dengan nomor meja yang dipilih|Ok|
|Input Order Takeaway|Pesanan tersimpan tanpa nomor meja|Ok|
|Tambah Pesanan ke Transaksi Berjalan|Item tambahan berhasil ditambahkan ke transaksi yang sama|Ok|
|Catatan Item pada Pesanan|Catatan tersimpan bersama item pesanan|Ok|
|Edit Item Sebelum Dibayar|Jumlah item berhasil diubah dan stok ter-sesuaikan|Ok|
|Hapus Item Sebelum Dibayar|Item berhasil dihapus dan stok dikembalikan|Ok|
|Pembayaran Tunai|Transaksi berstatus lunas|Ok|
|Pembayaran QRIS|Transaksi berstatus lunas|Ok|
|Pembayaran EDC (Pilih Bank)|Transaksi lunas dengan nama bank tercatat|Ok|
|Pembayaran Transfer (Pilih Bank)|Transaksi lunas dengan nama bank tercatat|Ok|
|Pembayaran Split-tender (Dua Metode Sekaligus)|Dua metode pembayaran diterima dan transaksi berstatus lunas|Ok|
|Diskon Manual pada Pembayaran|Total tagihan berkurang sesuai diskon yang diinput|Ok|
|Gabung Transaksi Meja (Merge)|Dua transaksi meja berhasil digabungkan menjadi satu|Ok|
|Bayar Tagihan Hasil Gabungan|Pembayaran ter-cascade ke semua transaksi sumber|Ok|
|Pisah Transaksi (Unmerge)|Transaksi berhasil dipisah kembali sebelum dibayar|Ok|
|Void Pesanan|Pesanan dibatalkan dan stok dikembalikan|Ok|
|Simpan Struk PDF|Struk berhasil dibuat dan diunduh di perangkat|Ok|
|Melihat Status Meja|Grid meja menampilkan status terkini|Ok|
|Melihat Riwayat Transaksi|Daftar transaksi dengan filter tanggal dan status tersedia|Ok|
|Restock Stok Porsi Pagi|Stok bertambah dan tercatat sebagai restock pagi|Ok|
|Barang Masuk Darurat|Stok bertambah dengan jumlah bebas dan tercatat|Ok|
|Opname Stok Porsi|Selisih antara stok fisik dan sistem tercatat sebagai audit log|Ok|
|Mark Habis|Stok porsi berhasil di-set menjadi 0|Ok|
|Preview Rekap Tutup Kasir|Total per metode pembayaran dan breakdown per bank ditampilkan|Ok|
|Submit Rekap Tutup Kasir|Data rekap harian berhasil disimpan|Ok|
### 4.1.3.  Hasil Pengujian UAT Waiter

#### Tabel 4.3 Tabel Pengujian UAT Waiter

|   |   |   |
|---|---|---|
|Fitur|Hasil Yang Diharapkan|Hasil|
|Login dengan Nama dan PIN|Berhasil masuk ke halaman dashboard waiter|Ok|
|Melihat Dashboard Waiter|Ringkasan stok porsi dan info shift hari ini ditampilkan|Ok|
|Input Order Dine-in (Pilih Meja)|Pesanan tersimpan dengan nomor meja yang dipilih|Ok|
|Input Order Takeaway|Pesanan tersimpan tanpa nomor meja|Ok|
|Tambah Pesanan ke Transaksi Berjalan|Item tambahan berhasil ditambahkan ke transaksi yang sama|Ok|
|Catatan Item pada Pesanan|Catatan tersimpan bersama item pesanan|Ok|
|Edit Item Sebelum Dibayar|Jumlah item berhasil diubah dan stok ter-sesuaikan|Ok|
|Hapus Item Sebelum Dibayar|Item berhasil dihapus dan stok dikembalikan|Ok|
|Melihat Status Meja|Grid meja menampilkan status terkini|Ok|
|Melihat Stok Porsi|Daftar stok porsi dengan status jumlah ditampilkan|Ok|
|Restock Stok Porsi Pagi|Stok bertambah dan tercatat sebagai restock pagi|Ok|
|Barang Masuk Darurat|Stok bertambah dengan jumlah bebas dan tercatat|Ok|
|Opname Stok Porsi|Selisih antara stok fisik dan sistem tercatat|Ok|
|Mark Habis|Stok porsi berhasil di-set menjadi 0|Ok|

Berdasarkan hasil UAT yang telah dilaksanakan pada sistem produksi monosuko.my.id, seluruh fitur yang diuji mampu berfungsi dengan baik sesuai skenario penggunaan yang ditetapkan. Selama proses pengujian tidak ditemukan kendala yang signifikan sehingga sistem dinyatakan diterima oleh pengguna. Dengan demikian, aplikasi ini dinilai layak dan siap digunakan untuk mendukung kebutuhan operasional restoran Ayam Bakar Banjar Monosuko dalam kegiatan sehari-hari.
## 4.2. Pengujian Black-box Testing

Pengujian sistem dilakukan menggunakan metode Black-box Testing untuk memastikan setiap fungsi berjalan sesuai dengan kebutuhan. Pengujian difokuskan pada validasi input dan output tanpa melihat kode program, menggunakan teknik Equivalence Partitioning dan Boundary Value Analysis. Hasil pengujian menunjukkan bahwa seluruh mekanisme validasi, batasan input, dan pembatasan hak akses berjalan dengan baik dan sesuai dengan yang diharapkan, sehingga sistem dinyatakan layak digunakan.
#### Tabel 4.4 Tabel Autentikasi

|                                                     |                                   |                                                             |                                                                                    |            |
| --------------------------------------------------- | --------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------- |
| Skenario Pengujian                                  | Test Case                         | Hasil yang Diharapkan                                       | Hasil Pengujian                                                                    | Kesimpulan |
| Nama dan PIN tidak diisi kemudian klik tombol login | Nama: kosong, PIN: kosong         | Sistem menampilkan pesan error validasi                     | Sistem menampilkan pesan "Nama pengguna wajib diisi" dan "PIN harus 6 digit angka" | Valid      |
| Nama diisi tetapi PIN salah                         | Nama: Jason, PIN: 999999          | Sistem menampilkan pesan error kredensial salah             | Sistem menampilkan pesan "Nama atau PIN salah"                                     | Valid      |
| Nama dan PIN diisi dengan kredensial yang benar     | Nama: Owner, PIN: 123456          | Sistem menampilkan halaman dashboard sesuai peran           | Sistem menampilkan halaman dashboard owner                                         | Valid      |
| Klik tombol Ganti Pengguna                          | Cache nama tersimpan di perangkat | Sistem menghapus cache dan menampilkan form login dua kolom | Sistem menampilkan kembali form nama dan PIN                                       | Valid      |
#### Tabel 4.5 Tabel Buka dan Tutup Kasir

|   |   |   |   |   |
|---|---|---|---|---|
|Skenario Pengujian|Test Case|Hasil yang Diharapkan|Hasil Pengujian|Kesimpulan|
|Buka kasir dengan tipe shift dan opening cash valid|Tipe: Pagi, Opening cash: Rp 12.000|Shift baru aktif dan opening cash tercatat|Shift aktif terbuat, openingCash=12000 tercatat|Valid|
|Buka shift kedua saat shift pertama masih aktif|Sudah ada shift aktif, buka shift baru|Sistem menolak dan menampilkan pesan error|Sistem menampilkan error 409 (single-OPEN guard)|Valid|
|Akses halaman POS sebelum shift dibuka|Tidak ada shift aktif|Sistem menampilkan informasi untuk membuka kasir terlebih dahulu|Sistem menampilkan gate "Buka Kasir" sesuai peran|Valid|
|Tutup kasir saat masih ada transaksi terbuka|Ada transaksi meja yang belum dibayar|Sistem menolak penutupan dan menampilkan daftar transaksi terbuka|Sistem menampilkan error 409 beserta daftar transaksi yang belum lunas|Valid|
|Tutup kasir setelah semua transaksi lunas|Tidak ada transaksi terbuka|Shift berhasil ditutup|Shift berstatus closed|Valid|
#### Tabel 4.6 Tabel Input Order

|   |   |   |   |   |
|---|---|---|---|---|
|Skenario Pengujian|Test Case|Hasil yang Diharapkan|Hasil Pengujian|Kesimpulan|
|Input order dine-in tanpa memilih nomor meja|Tipe: dineIn, Meja: tidak dipilih|Sistem menolak dan menampilkan pesan error|Sistem menampilkan error 400 "tableNumber wajib untuk dineIn"|Valid|
|Input order dine-in dengan meja valid|Tipe: dineIn, Meja: 3|Pesanan tersimpan dengan nomor meja|Transaksi tersimpan, tableNumber=3|Valid|
|Input order takeaway tanpa meja|Tipe: takeaway, Meja: tidak dipilih|Pesanan tersimpan tanpa nomor meja|Transaksi tersimpan, tableNumber=null|Valid|
|Input order saat stok porsi mencapai 0|Pilih menu dengan stok 0, klik tambah|Sistem menyimpan pesanan dan stok menjadi negatif|Pesanan tersimpan, stok berubah dari 0 menjadi -2|Valid|
|Edit jumlah item sebelum transaksi dibayar|Ubah qty item dari 1 menjadi 3|Item berhasil diubah dan stok ter-sesuaikan|Item berhasil diubah, stok menyesuaikan selisih|Valid|
|Hapus item sebelum transaksi dibayar|Hapus salah satu item dari pesanan|Item terhapus dan stok dikembalikan|Item terhapus, stok dikembalikan|Valid|
#### Tabel 4.7 Tabel Pembayaran

|                                                     |                                                       |                                                        |                                                                    |            |
| --------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------ | ---------- |
| Skenario Pengujian                                  | Test Case                                             | Hasil yang Diharapkan                                  | Hasil Pengujian                                                    | Kesimpulan |
| Bayar dengan nominal lebih kecil dari total tagihan | Total: Rp 10.000, Bayar: Rp 4.000                     | Transaksi tetap berstatus terbuka (pembayaran parsial) | Transaksi tetap open, slice pembayaran tersimpan                   | Valid      |
| Bayar dengan metode EDC tanpa memilih bank          | Metode: EDC, Bank: tidak dipilih                      | Sistem menolak dan menampilkan pesan error             | Sistem menampilkan error 400 "bankName wajib untuk EDC"            | Valid      |
| Bayar dengan metode Transfer tanpa memilih bank     | Metode: Transfer, Bank: tidak dipilih                 | Sistem menolak dan menampilkan pesan error             | Sistem menampilkan error 400 "bankName wajib untuk Transfer"       | Valid      |
| Bayar transaksi dine-in dengan metode GoFood        | Tipe order: dineIn, Metode: gojek                     | Sistem menolak karena GoFood hanya untuk takeaway      | Sistem menampilkan error 400 (allowDineIn=false)                   | Valid      |
| Bayar dengan dua metode sekaligus (split-tender)    | Tunai: Rp 4.000, Transfer: Rp 6.000, Total: Rp 10.000 | Transaksi berstatus lunas                              | Transaksi berstatus paid                                           | Valid      |
| Bayar dengan diskon melebihi total tagihan          | Total: Rp 10.000, Diskon: Rp 15.000                   | Sistem menolak diskon yang melebihi tagihan            | Sistem menampilkan validasi "Diskon tidak boleh melebihi subtotal" | Valid      |
#### Tabel 4.8 Tabel Stok Porsi dan Settlement

|                                                        |                                          |                                                            |                                                                   |            |
| ------------------------------------------------------ | ---------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------- | ---------- |
| Skenario Pengujian                                     | Test Case                                | Hasil yang Diharapkan                                      | Hasil Pengujian                                                   | Kesimpulan |
| Restock pagi dengan jumlah yang bukan kelipatan 5      | Jumlah restock: 7                        | Sistem menolak dan menampilkan pesan error                 | Sistem menampilkan error 422 "jumlah harus kelipatan 5"           | Valid      |
| Restock pagi dengan jumlah kelipatan 5 yang valid      | Jumlah restock: 5                        | Stok bertambah dan tercatat                                | Stok bertambah, movement reason=restockMorning tersimpan          | Valid      |
| Opname stok dengan jumlah fisik berbeda dari sistem    | Stok sistem: 5, Stok fisik: 10           | Selisih +5 tercatat sebagai audit log                      | Movement reason=manualAdjust dengan selisih +5 tersimpan          | Valid      |
| Submit rekap tutup kasir untuk hari yang sudah direkap | Hari yang sama sudah memiliki settlement | Sistem menolak dan menampilkan pesan error                 | Sistem menampilkan error 409 (unique per tanggal)                 | Valid      |
| Preview rekap tutup kasir sebelum submit               | Klik preview rekap                       | Total per metode pembayaran dan breakdown bank ditampilkan | Data system total, bankBreakdown, dan existingSettlementId tampil | Valid      |


#### Tabel 4.9 Tabel Hak Akses (Pembatasan Peran)

|   |   |   |   |   |
|---|---|---|---|---|
|Skenario Pengujian|Test Case|Hasil yang Diharapkan|Hasil Pengujian|Kesimpulan|
|Waiter mencoba memproses pembayaran|Login sebagai Amel (waiter), panggil endpoint pembayaran|Sistem menolak dengan status akses ditolak|Sistem menampilkan error 403|Valid|
|Kasir mencoba menambah atau mengubah data menu|Login sebagai Jason (kasir), panggil endpoint tambah/ubah menu|Sistem menolak dengan status akses ditolak|Sistem menampilkan error 403|Valid|
|Kasir mencoba mengakses tagihan operasional|Login sebagai Jason (kasir), panggil endpoint tagihan|Sistem menolak dengan status akses ditolak|Sistem menampilkan error 403|Valid|
|Kasir mencoba mengubah modal/COGS menu|Login sebagai Jason (kasir), panggil endpoint riwayat modal|Sistem menolak dengan status akses ditolak|Sistem menampilkan error 403|Valid|
|Kasir mencoba mengelola data pengguna|Login sebagai Jason (kasir), panggil endpoint pengguna|Sistem menolak dengan status akses ditolak|Sistem menampilkan error 403|Valid|
|Waiter mencoba membuka kasir|Login sebagai Amel (waiter), panggil endpoint buka shift|Sistem menolak dengan status akses ditolak|Sistem menampilkan error 403|Valid|
