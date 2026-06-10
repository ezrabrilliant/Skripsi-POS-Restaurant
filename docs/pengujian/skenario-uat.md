# Skenario User Acceptance Testing (UAT) — Sistem POS Restoran X

> **Instrumen Lapisan 1** (lihat [rencana-pengujian.md](rencana-pengujian.md)). Membuktikan sistem memenuhi kebutuhan fungsional (Bab 2.5).
>
> **Metode:** black-box, *scenario-based*, teknik **Equivalence Partitioning (EP)** + **Boundary Value Analysis (BVA)**; acuan **ISO/IEC 29119**.
> **Kriteria penerimaan:** layak fungsional bila **≥ 90% test case Pass**; fungsi kritikal (login, input order, pembayaran, settlement, stok) **wajib 100% Pass**.
> **Penguji:** Owner + 3 kasir + 2 waiter. Cara isi: jalankan langkah → tulis Hasil Aktual → tandai **Pass/Fail**.

---

## Catatan keselarasan dokumen (PENTING untuk sidang)

Sistem ter-deploy (REV 2.11+) **berbeda** dari sebagian narasi proposal/Bab 3 lama. Test case di bawah menguji **sistem yang sebenarnya**. Selaraskan Bab 3 agar tidak kontradiksi saat demo:

| Hal di proposal/Bab 3 lama | Realita sistem REV 2.11+ |
|---|---|
| Aktor "Pegawai Dapur (Kitchen)" | Tidak ada — role: **owner, kasir, waiter** (waiter kini input order langsung via HP) |
| "Force order" (dialog paksa saat stok kurang) | Tidak ada dialog; order item stok 0 **tetap tersimpan, stok jadi negatif & tercatat di riwayat** |
| "Split bill per item" (pecah per menu) | Diganti **Split Tender** (1 tagihan, beberapa metode bayar) + **Combine/Merge meja** |
| "Expenses / pengeluaran harian" | Diganti **Tagihan operasional (bills)** + **COGS per menu** (Laba Kotor = Pendapatan − COGS) |
| 5 metode bayar fixed | **6 metode + master configurable** (cash, EDC, QRIS, Gojek, Grab, transfer) + master **bank** |
| PB1 selalu 10% | PB1 **owner-configurable** (toggle on/off + rate) di tab Pajak |

---

## Ringkasan cakupan

| Grup | Modul/Fitur | # TC |
|---|---|---|
| A | Autentikasi & sesi | 4 |
| B | Buka/Tutup kasir (shift) | 6 |
| C | Input order | 9 |
| D | Pembayaran & struk | 10 |
| E | Combine / Unmerge / Void | 5 |
| F | Stok porsi | 7 |
| G | Settlement (rekonsiliasi) | 6 |
| H | Master menu + COGS | 7 |
| I | Tagihan operasional (bills) | 3 |
| J | Konfigurasi owner (metode bayar, bank, pajak, identitas) | 6 |
| K | Dashboard per role | 4 |
| L | Hak akses / permission (negatif) | 6 |
| | **Total** | **73** |

---

## A. Autentikasi & Sesi

| ID | Skenario | Langkah singkat | Hasil Diharapkan | Penguji | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| TC-A01 | Login berhasil | Isi nama + PIN benar → kirim | Masuk ke dashboard sesuai peran | semua | | |
| TC-A02 | Login PIN salah *(negatif)* | Isi nama benar + PIN salah | Pesan error, tetap di layar login | semua | | |
| TC-A03 | Login nama kosong *(boundary)* | Submit tanpa isi nama | Validasi menolak, tidak login | kasir | | |
| TC-A04 | Ganti pengguna | Tekan "Ganti Pengguna" | Cache nama ter-reset, kembali ke form awal | kasir | | |

## B. Buka/Tutup Kasir (Shift)

| ID | Skenario | Langkah singkat | Hasil Diharapkan | Penguji | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| TC-B01 | Buka kasir + modal awal | Kasir buka shift, input modal awal | Shift aktif, modal tercatat | kasir | | |
| TC-B02 | Cegah 2 shift aktif *(negatif)* | Buka shift saat sudah ada shift OPEN | Ditolak / diarahkan ke shift aktif | kasir | | |
| TC-B03 | POS terkunci tanpa shift | Buka POS saat belum ada shift aktif | Diarahkan ke "Buka Kasir" (kasir) / info (waiter/owner) | kasir | | |
| TC-B04 | Tutup kasir normal | Tutup shift saat tidak ada tx open | Form rekonsiliasi muncul | kasir | | |
| TC-B05 | Tutup diblok ada tx open *(negatif)* | Tutup shift saat ada pesanan belum dibayar | Peringatan + daftar meja/tx open | kasir | | |
| TC-B06 | Window shift owner-configurable | Owner set jam shift di tab Jam Shift | Buka/tutup mengikuti window baru | owner | | |

## C. Input Order

| ID | Skenario | Langkah singkat | Hasil Diharapkan | Penguji | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| TC-C01 | Order dine-in pilih meja | Pilih meja kosong → tambah menu → simpan | Pesanan tersimpan terbuka di meja itu | kasir | | |
| TC-C02 | Dine-in wajib meja *(boundary)* | Coba simpan dine-in tanpa pilih meja | Validasi menolak | kasir | | |
| TC-C03 | Order takeaway tanpa meja | Mode takeaway → tambah menu → simpan | Tersimpan tanpa meja | kasir | | |
| TC-C04 | Tambah pesanan (multi-round) | Meja sudah ada pesanan → "Tambah Pesanan" | Pesanan #2 ditambahkan ke meja sama | kasir | | |
| TC-C05 | Stok auto-decrement | Order item ber-stok | Stok porsi berkurang sesuai qty | kasir | | |
| TC-C06 | Order saat stok 0 | Order item stok = 0 | Tetap tersimpan, stok jadi negatif & tercatat di riwayat | kasir | | |
| TC-C07 | Paket dengan sub-pilihan | Order Paket A → pilih paha/dada, bakar/goreng | Stok komponen terpilih yang berkurang | kasir | | |
| TC-C08 | Catatan item (notes) | Tambah notes "Dingin"/"Panas" via toggle | Notes tersimpan & tampil | waiter | | |
| TC-C09 | Edit/hapus item sebelum bayar | Ubah qty / hapus item pesanan terbuka | Stok ter-adjust + audit log | kasir | | |

## D. Pembayaran & Struk

| ID | Skenario | Langkah singkat | Hasil Diharapkan | Penguji | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| TC-D01 | Bayar tunai lunas | Pilih cash → nominal ≥ total → konfirmasi | Status lunas, kembalian benar | kasir | | |
| TC-D02 | Nominal kurang *(boundary)* | Nominal < total tagihan | Ditolak, minta nominal cukup | kasir | | |
| TC-D03 | EDC wajib pilih bank *(negatif)* | Pilih EDC tanpa pilih bank | Validasi menolak (bank wajib) | kasir | | |
| TC-D04 | Transfer wajib bank *(negatif)* | Pilih transfer tanpa bank | Validasi menolak | kasir | | |
| TC-D05 | QRIS / pilih bank | Bayar QRIS (bank sesuai config) | Lunas, tercatat per bank | kasir | | |
| TC-D06 | Gojek/Grab di dine-in ditolak *(negatif)* | Dine-in → pilih Gojek/Grab | Ditolak (hanya takeaway) | kasir | | |
| TC-D07 | Split tender (2 metode) | Bayar sebagian cash + sisanya transfer | Lunas saat total slice = tagihan | kasir | | |
| TC-D08 | PB1 (jika aktif) | PB1 ON 10% → bayar | Total = subtotal + 10% | owner | | |
| TC-D09 | Diskon manual | Beri diskon di slice pertama | Total berkurang sesuai diskon | kasir | | |
| TC-D10 | Simpan struk PDF | Setelah lunas → "Simpan Struk" | PDF ter-generate & terunduh ke perangkat | kasir | | |

## E. Combine / Unmerge / Void

| ID | Skenario | Langkah singkat | Hasil Diharapkan | Penguji | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| TC-E01 | Combine meja (merge) | Gabung meja 2 ke meja 1 | Tagihan tergabung jadi satu | kasir | | |
| TC-E02 | Bayar tagihan gabungan | Bayar meja gabungan | Lunas, cascade ke sumber | kasir | | |
| TC-E03 | Unmerge sebelum bayar | Batalkan gabungan (target belum bayar) | Tagihan terpisah kembali | kasir | | |
| TC-E04 | Void pesanan | Void pesanan terbuka | Status void, stok dikembalikan | kasir | | |
| TC-E05 | Void setelah settle ditolak *(negatif)* | Void tx pada hari yang sudah di-settle | Ditolak (refund out of scope) | owner | | |

## F. Stok Porsi

| ID | Skenario | Langkah singkat | Hasil Diharapkan | Penguji | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| TC-F01 | Restock pagi (kelipatan 5) | Input restock kelipatan 5 | Stok bertambah, tercatat | waiter | | |
| TC-F02 | Restock bukan kelipatan 5 *(boundary)* | Input restock = 7 | Validasi menolak / dibulatkan sesuai aturan | waiter | | |
| TC-F03 | Barang masuk (darurat) | "Barang Masuk" qty bebas | Stok bertambah, reason restock_emergency | kasir | | |
| TC-F04 | Opname "Cek Fisik & Koreksi" | Input qty fisik berbeda | Selisih dihitung + current_qty ter-update + audit log | waiter | | |
| TC-F05 | Mark habis | Tandai item habis | current_qty = 0, tercatat | waiter | | |
| TC-F06 | Reminder low-stock | Stok ≤ minimum | Reminder muncul di dashboard | waiter | | |
| TC-F07 | Snapshot opening pagi | Login pertama pagi | opening_qty_today ter-snapshot otomatis | kasir | | |

## G. Settlement (Rekonsiliasi Akhir Hari)

| ID | Skenario | Langkah singkat | Hasil Diharapkan | Penguji | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| TC-G01 | Preview sebelum submit | Buka preview settlement | Tampil total sistem + breakdown bank | kasir | | |
| TC-G02 | Blind count submit | Input fisik tanpa lihat total sistem → submit | Sistem hitung selisih per metode | kasir | | |
| TC-G03 | Variance over/short | Input fisik beda dari sistem | Selisih over/short tampil benar | kasir | | |
| TC-G04 | Breakdown per bank | Lihat hasil EDC/transfer per bank | Total per bank tampil (cocok mutasi rekening) | owner | | |
| TC-G05 | Cegah double-submit *(negatif)* | Submit settlement 2× untuk hari sama | Ditolak (UNIQUE per hari, 409) | kasir | | |
| TC-G06 | Review owner | Owner review settlement | Status ter-review | owner | | |

## H. Master Menu + COGS

| ID | Skenario | Langkah singkat | Hasil Diharapkan | Penguji | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| TC-H01 | Tambah menu | Owner buat menu baru (nama/kategori/harga) | Menu tersimpan & muncul di POS | owner | | |
| TC-H02 | Edit menu | Ubah harga/status menu | Perubahan tersimpan | owner | | |
| TC-H03 | Set modal/COGS | Owner input modal per menu | Modal tersimpan + tercatat di riwayat | owner | | |
| TC-H04 | COGS tak bocor ke POS *(negatif)* | Login kasir → buka POS | Angka modal TIDAK terlihat oleh kasir/waiter | kasir | | |
| TC-H05 | Riwayat modal (cost-history) | Owner buka riwayat modal menu | Daftar perubahan (set/edit) tampil | owner | | |
| TC-H06 | Varian + paket | Buat menu varian / paket dengan sub-pilihan | Pemilih varian muncul di POS, harga benar | owner | | |
| TC-H07 | Upload foto menu | Owner unggah foto menu | Foto tersimpan & tampil di katalog/POS | owner | | |

## I. Tagihan Operasional (Bills)

| ID | Skenario | Langkah singkat | Hasil Diharapkan | Penguji | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| TC-I01 | Tambah tagihan | Owner input tagihan (listrik/air/dll) | Tersimpan dengan kategori & nominal | owner | | |
| TC-I02 | Filter per bulan | Filter tagihan per bulan | Daftar terfilter benar | owner | | |
| TC-I03 | Tagihan tampil terpisah dari laba | Cek dashboard | Bills tampil terpisah, TIDAK mengurangi laba kotor | owner | | |

## J. Konfigurasi Owner

| ID | Skenario | Langkah singkat | Hasil Diharapkan | Penguji | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| TC-J01 | Tambah/edit metode bayar | Owner CRUD metode di tab Metode | Metode tersimpan & muncul di PaymentModal | owner | | |
| TC-J02 | Toggle metode aktif | Nonaktifkan satu metode | Metode hilang dari pilihan bayar | owner | | |
| TC-J03 | Kelola bank + assign | Tambah bank, assign ke EDC/transfer | Bank muncul di picker metode terkait | owner | | |
| TC-J04 | Atur pajak PB1 | Toggle PB1 + ubah rate | Perhitungan total mengikuti setting | owner | | |
| TC-J05 | Identitas + logo resto | Set nama/alamat/telp + unggah logo | Tampil di LoginPage & struk | owner | | |
| TC-J06 | Reorder metode | Ubah urutan metode | Urutan di PaymentModal berubah | owner | | |

## K. Dashboard per Role

| ID | Skenario | Langkah singkat | Hasil Diharapkan | Penguji | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| TC-K01 | Dashboard owner | Login owner → dashboard | Pendapatan, COGS, Laba Kotor, tagihan, analitik tampil | owner | | |
| TC-K02 | Period filter owner | Ganti periode (hari/bulan/tahun/custom) | Angka ter-update sesuai periode | owner | | |
| TC-K03 | Dashboard kasir | Login kasir → dashboard | Shift aktif + ringkasan hari ini | kasir | | |
| TC-K04 | Dashboard waiter | Login waiter → dashboard | Stok porsi + reminder sebagai primary | waiter | | |

## L. Hak Akses / Permission (negatif)

| ID | Skenario | Langkah singkat | Hasil Diharapkan | Penguji | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
| TC-L01 | Waiter tidak bisa bayar | Login waiter → coba akses pembayaran | Tombol/akses Bayar tidak tersedia (403 di API) | waiter | | |
| TC-L02 | Kasir tidak bisa CRUD menu | Login kasir → coba ubah menu | Ditolak (owner-only) | kasir | | |
| TC-L03 | Kasir tidak bisa akses bills | Login kasir → coba buka Tagihan | Ditolak (owner-only) | kasir | | |
| TC-L04 | Kasir tidak bisa edit COGS | Login kasir → coba ubah modal | Ditolak (owner-only) | kasir | | |
| TC-L05 | Kasir tidak bisa CRUD user | Login kasir → coba kelola pengguna | Ditolak (owner-only) | kasir | | |
| TC-L06 | Waiter tidak bisa buka kasir | Login waiter → coba buka shift | Ditolak (kasir-only) | waiter | | |

---

## Rekapitulasi Hasil

| Grup | Jumlah TC | Pass | Fail | % Pass |
|---|---|---|---|---|
| A–L | 73 | | | |
| **Total** | **73** | | | **___%** |

**Kesimpulan:** sistem dinyatakan **layak fungsional** bila total ≥ 90% Pass dan seluruh fungsi kritikal (A, C, D, F, G) = 100% Pass. Catat setiap Fail beserta tingkat keparahan (kritikal / dapat ditoleransi) untuk pembahasan.

---

*Instrumen untuk skripsi POS Restoran Ayam Bakar Banjar Monosuko (C14220315). Dipetakan ke fitur sistem REV 2.11+ (verifikasi langsung ke route & komponen).*
