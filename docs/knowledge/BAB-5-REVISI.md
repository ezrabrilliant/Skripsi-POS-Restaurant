# BAB 5 — KESIMPULAN DAN SARAN

> **Revisi 2026-06-06.** Kesimpulan menjawab setiap rumusan masalah Bab 1 berdasarkan hasil pengujian Bab 4 (UAT, SUS, dan efisiensi). Saran memuat keterbatasan sistem dan peluang pengembangan lanjutan. Angka selaras dengan `BAB-4-REVISI.md`.

---

## 5.1 Kesimpulan

Berdasarkan hasil pengujian pada Bab 4 — yang mencakup pengujian fungsional (*User Acceptance Testing*), pengujian *usability* (*System Usability Scale*), dan pengujian efisiensi sebelum–sesudah penerapan sistem — sistem *Point of Sale* (POS) Restoran Ayam Bakar Banjar Monosuko berhasil dibangun dan menjawab seluruh rumusan masalah sebagai berikut.

1. **Sistem mempercepat durasi proses transaksi dibandingkan cara manual (RM-1).** Penghematan terkonsentrasi pada penghapusan langkah hitung-menghitung manual: pemrosesan pembayaran menjadi 79,6% lebih cepat, satu transaksi penuh 41,0% lebih cepat, dan pembayaran gabungan dua metode (*split-tender*) 48,6% lebih cepat (Tabel 4.13). Pada tahap input pesanan sistem justru sedikit lebih lambat, sehingga keunggulan sistem terletak pada perhitungan harga dan kembalian yang otomatis, bukan pada pengetikan data.

2. **Sistem mempercepat rekonsiliasi pendapatan dan membantu menurunkan *mismatch* (RM-2).** Rekonsiliasi akhir hari menjadi sekitar 53,6% lebih cepat untuk hari dengan ±15 transaksi (Tabel 4.14); penghematan ini murni berasal dari penjumlahan penerimaan per metode yang sebelumnya dilakukan manual dari buku dan kini dihitung otomatis, sementara langkah menghitung uang fisik tetap setara. Untuk menurunkan *mismatch*, sistem memilah penerimaan per metode dan per bank sehingga dapat dicocokkan langsung ke rekening koran serta menampilkan selisih otomatis terhadap hitungan fisik — kemampuan yang tidak dimiliki pencatatan manual yang mencampur semua metode dalam satu buku.

3. **Sistem meminimalkan *mismatch* stok dengan tidak lagi bergantung pada ingatan petugas (RM-3).** Stok berkurang otomatis pada setiap pesanan, waktu pencatatan terakhir terekam, dan *reminder* stok menipis muncul di *dashboard* sebelum item benar-benar habis; fitur opname menghasilkan angka selisih per item beserta jejak audit — pembanding yang tidak pernah ada pada buku manual yang halaman stoknya dapat terlupa dicatat secara keseluruhan (Tabel 4.15, Gambar 4.4–4.5).

Selain ketiga hal di atas, pengujian fungsional menunjukkan seluruh fitur berjalan sesuai kebutuhan setiap peran pengguna (seluruh kasus UAT berhasil dan seluruh pengujian *black-box* dinyatakan Valid), sedangkan pengujian *usability* memperoleh skor SUS 75,8 yang termasuk kategori *Acceptable* dengan *adjective rating* *Good*. Dengan demikian, sistem dinilai layak dan dapat diterima untuk mendukung kegiatan operasional harian Restoran Ayam Bakar Banjar Monosuko.

## 5.2 Saran

### 5.2.1 Keterbatasan

1. Pengukuran durasi transaksi dan waktu rekonsiliasi menggunakan model terkendali berbasis komposisi transaksi nyata; angka tersebut masih perlu dikalibrasi dengan pengukuran *stopwatch* langsung di lapangan. Jumlah sampel transaksi (28 transaksi selama satu minggu) dan jumlah responden SUS (enam orang) juga masih terbatas.
2. Pencocokan penerimaan non-tunai masih bergantung pada rekening koran yang diperiksa manual, karena sistem belum terintegrasi dengan *payment gateway* maupun mutasi bank/QRIS secara otomatis.
3. Sistem tidak menangani bahan baku mentah, pembelian, maupun perhitungan harga pokok berbasis konsumsi; modal/COGS dinyatakan langsung per menu oleh pemilik, dan konversi bahan menjadi porsi siap jual dilakukan di luar sistem.
4. Sistem membutuhkan koneksi internet dan belum mendukung mode *offline*, sedangkan operasional restoran mengandalkan jaringan seluler yang tidak selalu stabil.

### 5.2.2 Pengembangan Lanjutan

1. Integrasi dengan *payment gateway* / QRIS dinamis dan penarikan mutasi bank secara otomatis agar rekonsiliasi penerimaan non-tunai dapat dilakukan sepenuhnya otomatis.
2. Penambahan mode *offline* dengan memanfaatkan *Progressive Web App* (PWA) dan sinkronisasi data agar sistem tetap dapat digunakan ketika koneksi terganggu.
3. Fitur rekomendasi nominal kembalian dan denominasi uang tunai untuk semakin mempercepat proses pembayaran tunai.
4. Penyampaian *reminder* stok menipis melalui kanal eksternal (misalnya WhatsApp) agar peringatan tetap sampai meski aplikasi tidak sedang dibuka.
5. Penambahan modul bahan baku dan resep (*bill of materials*) untuk menghitung harga pokok berbasis konsumsi secara otomatis apabila dibutuhkan di kemudian hari.
6. Kalibrasi dan perluasan pengujian, yaitu pengukuran *stopwatch* di lapangan, penambahan jumlah sampel transaksi, serta pengumpulan kuesioner SUS dari seluruh responden riil untuk memperkuat hasil.

---

*Revisi 2026-06-06. Kesimpulan dan angka selaras dengan `docs/knowledge/BAB-4-REVISI.md` (RM-1 Tabel 4.13; RM-2 Tabel 4.14; RM-3 Tabel 4.15 + Gambar 4.4–4.5; UAT Tabel 4.1–4.9; SUS Tabel 4.10–4.12).*
