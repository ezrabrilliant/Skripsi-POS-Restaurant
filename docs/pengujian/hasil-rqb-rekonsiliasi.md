# Hasil RQ-B — Rekonsiliasi Pendapatan & Mismatch (sebelum manual vs sesudah POS)

> **Menjawab Rumusan Masalah 2:** apakah sistem POS mempercepat proses rekonsiliasi pendapatan dan menurunkan jumlah *mismatch* antara catatan penjualan dan mutasi rekening? **Metode:** model waktu rekonsiliasi terkendali (sebelum vs sesudah) + demonstrasi kapabilitas pencocokan per bank (terverifikasi di UAT grup 7) + testimoni owner (*pending*). Analisis **deskriptif**.
>
> **Asal angka:** waktu rekonsiliasi = **MODEL** (penjumlahan waktu per-langkah × jumlah transaksi); jumlah transaksi nyata dari buku 21–27 Mei; kapabilitas *settlement* per-bank = NYATA (terverifikasi sistem). Akan dikuatkan **testimoni owner** (lama rekonsiliasi manual) + **rekening koran** 21–27 Mei.

---

## 0. Dua sisi jawaban RM-2

Rumusan masalah kedua memuat dua klaim: **(a) mempercepat rekonsiliasi** dan **(b) menurunkan mismatch**. Keduanya dijawab terpisah karena bersifat berbeda:

| Klaim | Cara jawab | Sifat |
|---|---|---|
| (a) Lebih cepat | model waktu rekonsiliasi manual vs sistem (§1) | terukur (model) |
| (b) Menurunkan mismatch | **kapabilitas pencocokan per bank** (§2): manual mencampur semua metode → mismatch tak terdeteksi; sistem memilah per metode & per bank → owner cocokkan ke rekening koran | kapabilitas (bukan reduksi %) |

> ⚠️ **Catatan kejujuran:** pencatatan buku resto pada dasarnya BENAR, sehingga **tidak ada angka mismatch kas historis** untuk dibandingkan. Karena itu klaim (b) diframing sebagai **kapabilitas mendeteksi & mencegah mismatch**, bukan "mismatch turun X%".

## 1. Waktu Rekonsiliasi (model, per jumlah transaksi/hari)

**Alur manual:** kasir menelusuri buku yang mencampur semua metode, memisahkan & menjumlahkan per metode (tunai/EDC/QRIS/transfer), menghitung uang fisik, mencocokkan struk EDC, lalu menulis rekap. **Alur sistem:** total per metode **dan per bank** dihitung otomatis; kasir cukup membuka *settlement*, melakukan *blind count* (hitung fisik + input per metode), dan meninjau *variance* otomatis.

**Tabel — Komparasi Waktu Rekonsiliasi Akhir Hari**

| Jumlah transaksi/hari | Manual (detik) | Sistem (detik) | Efisiensi |
|---:|---:|---:|---:|
| 5 transaksi | 120,0 | 80,0 | 33,3% |
| 10 transaksi | 150,0 | 80,0 | 46,7% |
| 20 transaksi | 210,0 | 80,0 | 61,9% |
| **Rata-rata** | | | **47,3%** |

**Temuan:** waktu manual **bertambah linear** terhadap jumlah transaksi (karena penyortiran & penjumlahan per metode dilakukan transaksi-per-transaksi), sedangkan waktu sistem **hampir konstan** (penjumlahan otomatis; yang tersisa hanya *blind count* fisik). Makin ramai hari (makin banyak transaksi), makin besar penghematan. Sebagai pembanding arah dari literatur (dengan *disclaimer* konteks berbeda, yaitu kas ATM), Hesananda (2024) mencatat percepatan rekonsiliasi dari 35 menit menjadi 8 menit.

**Parameter model (dapat dikalibrasi):**

| Langkah | Nilai | Sisi |
|---|---|---|
| Sortir + jumlah per metode dari buku campur | 6 s/transaksi | manual |
| Hitung fisik uang + cocokkan struk EDC | 75 s | manual & sistem (sama) |
| Tulis rekap | 15 s | manual |
| Buka *settlement* (total per metode+bank otomatis) | 5 s | sistem |

> Catatan: langkah "hitung fisik" ada di kedua metode (tidak menghemat); yang dihapus sistem = **penyortiran + penjumlahan manual** + penulisan rekap.

## 2. Kapabilitas Pencocokan per Bank (NYATA — menjawab "menurunkan mismatch")

Pada proses manual, seluruh metode pembayaran tercatat **tercampur** dalam satu buku, sehingga pencocokan ke mutasi rekening sulit dan *mismatch* sukar terdeteksi. Sistem memilah penerimaan **per metode dan per bank** (mis. QRIS BCA, EDC BCA, Transfer Mandiri) melalui *settlement*, sehingga pemilik dapat mencocokkannya langsung ke **rekening koran** masing-masing bank. Kapabilitas ini terverifikasi pada UAT grup 7 (preview *settlement* + *bank breakdown* + *variance* terhadap *blind count*).

**Tabel — Demonstrasi pencocokan per bank (TEMPLATE — diisi dari rekening koran 21–27 Mei)**

| Bank / Metode | Total Sistem (Rp) | Mutasi Rekening (Rp) | Selisih |
|---|---:|---:|---:|
| Tunai (kas fisik) | … | … | … |
| QRIS BCA | … | … | … |
| EDC BCA | … | … | … |
| Transfer Mandiri (TF MK) | … | … | … |

> ⏳ Selisih nol (atau kecil-terjelaskan) per baris = bukti akurasi pencocokan. Diisi setelah rekening koran tersedia.

## 3. Pembahasan

- **(a) Lebih cepat:** sistem mempercepat rekonsiliasi rata-rata **47,3%** (33%–62% tergantung keramaian), karena penjumlahan per metode/bank yang manual dan rawan salah dihapus dan diganti otomatis.
- **(b) Menurunkan mismatch:** dijawab sebagai **kapabilitas** — sistem menyajikan rincian per bank yang memungkinkan pencocokan ke rekening koran (mustahil pada buku campur), plus *variance* otomatis terhadap *blind count* yang langsung menyorot selisih. Ini **mencegah** mismatch tak-terdeteksi, bukan menurunkan angka historis (yang tidak ada).
- **Tautan ke RM-1:** tiap penjumlahan manual yang dihapus juga titik rawan salah-hitung; percepatan dan akurasi saling memperkuat.

## 4. Keterbatasan (jujur)

1. Waktu rekonsiliasi = **model**; akan dikuatkan/ditambat **testimoni owner** (lama pencocokan manual sebenarnya).
2. Tabel per-bank §2 menunggu **rekening koran** 21–27 Mei.
3. Pembanding literatur (Hesananda 2024) berkonteks **kas ATM**, bukan resto — dipakai sebagai arah, bukan angka langsung.

---

*Disusun 2026-06-05. Kapabilitas per-bank: NYATA (UAT grup 7). Waktu: MODEL (`build-rqbc-sus.py`). Sumber jumlah transaksi: buku 21–27 Mei.*
