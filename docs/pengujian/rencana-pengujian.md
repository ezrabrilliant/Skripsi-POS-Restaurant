# Rencana Pengujian Sistem POS Restoran X

> **Dokumen induk pengujian.** Menurunkan metode UAT + SUS (Bab 2.5 skripsi) menjadi protokol konkret yang **langsung menjawab ketiga rumusan masalah**. Dokumen turunan: [tabel skenario UAT](skenario-uat.md), [kuesioner SUS](kuesioner-sus.md), [runbook re-enactment](runbook-reenactment.md). Pembanding literatur: [referensi-pengujian-terdahulu.md](referensi-pengujian-terdahulu.md).
>
> Objek uji: sistem live **`monosuko.my.id`** (sengaja, agar delay jaringan nyata di lokasi resto ikut terukur). Order-set: transaksi riil **21–27 Mei 2026 (1 minggu, ±28 transaksi)** (dari buku). Analisis: **deskriptif**.

---

## 1. Tujuan & Pemetaan ke Rumusan Masalah

Pengujian membuktikan sistem memenuhi kebutuhan proses bisnis & informasi Restoran X (Bab 2.5) **dan** menjawab ketiga rumusan masalah yang bersifat **kuantitatif-komparatif** (sebelum vs sesudah sistem).

| Rumusan Masalah | Klaim yang diuji | Metrik | Lapisan |
|---|---|---|---|
| **RQ-A** | Sistem POS mempercepat durasi proses transaksi | Durasi rata-rata per transaksi (detik) | 3 (komparatif) |
| **RQ-B** | Sistem mempercepat rekonsiliasi & menurunkan mismatch penjualan vs mutasi rekening | (i) Waktu rekonsiliasi akhir hari; (ii) kapabilitas deteksi/pencocokan per bank | 3 (komparatif) |
| **RQ-C** | Manajemen stok harian + opname meminimalisir mismatch dibanding manual | Hari stok tak tercatat, insiden stockout & biaya kirim darurat, selisih opname terdeteksi | 3 (komparatif) |
| (umum) | Sistem memenuhi kebutuhan fungsional | % test case Pass | 1 (UAT) |
| (umum) | Sistem mudah digunakan | Skor SUS (0–100) | 2 (SUS) |

> **Catatan metodologis penting:** UAT membuktikan fitur *bekerja*; SUS membuktikan *mudah dipakai*. Keduanya **tidak** mengukur "lebih cepat/lebih sedikit mismatch". Karena itu RQ-A/B/C dijawab oleh **Lapisan 3 (pengukuran komparatif)**, bukan oleh UAT/SUS. Ketiga lapisan saling melengkapi, tidak saling menggantikan.

---

## 2. Kerangka 3 Lapis

```
Lapisan 1 — UAT (fungsional)       → "sistem memenuhi kebutuhan"  (Bab 2.5)
Lapisan 2 — SUS (usability)        → "kemudahan penggunaan"       (Bab 2.5)
Lapisan 3 — Pengukuran komparatif  → RQ-A, RQ-B, RQ-C  (sebelum vs sesudah)
```

---

## 3. Partisipan, Lingkungan, & Etika

**Partisipan** (pengguna riil):

| Peran | Nama | Tugas dalam pengujian |
|---|---|---|
| Owner | Owner | UAT modul owner (menu, COGS, tagihan, dashboard) + responden SUS + wawancara baseline RQ-B |
| Kasir | Jason, Bryant, Chen Hong | UAT operasional + re-enactment (input & rekonsiliasi) + responden SUS |
| Waiter | Amel, Yanti | UAT input order via HP + re-enactment (input order di meja) + responden SUS |

> **Perubahan model (keputusan owner):** waiter kini **input order langsung via HP** (pencatatan kertas dihapus). Ini menjadi *to-be* resmi dan menempatkan waiter sebagai pengguna POS penuh — sehingga ikut sebagai penguji UAT & responden SUS (n ≈ 6). Penyelarasan dokumen (`operasional-resto.md`, permission matrix, Bab 3) menyusul.

**Lingkungan:**
- Aplikasi: PWA `https://monosuko.my.id` (produksi), diakses dari **HP/tablet** (mobile-first, sesuai kondisi resto).
- Jaringan: koneksi internet di lokasi resto — **sengaja tidak dikondisikan ideal** agar delay nyata terukur. Catat kondisi jaringan saat sesi (mis. tethering HP / sinyal seluler) di lembar pengukuran.
- Akun: satu akun per peran (login nama + PIN).

**Etika:** sebelum sesi, mintakan **persetujuan (informed consent)** dari owner & pegawai; jelaskan data dipakai untuk skripsi. Dokumentasikan dengan foto/screenshot sesi sebagai lampiran.

---

## 4. Lapisan 1 — UAT (ringkas)

Black-box, scenario-based; teknik **Equivalence Partitioning + Boundary Value Analysis**; acuan **ISO/IEC 29119**. Penguji menjalankan skenario, mencatat Pass/Fail.

- **Kriteria penerimaan:** sistem dinyatakan **layak fungsional bila ≥ 90% test case Pass** (fungsi kritikal — login, input order, pembayaran, settlement, stok — wajib 100%). *(Patokan ≥90% dari literatur: Wahyudi 2021 = 90,6%; Raehan dkk. 2025 = 100%.)*
- Daftar skenario lengkap (dipetakan ke seluruh fitur REV 2.11): **[skenario-uat.md](skenario-uat.md)**.

---

## 5. Lapisan 2 — SUS (ringkas)

Kuesioner baku **10 pernyataan, skala Likert 1–5**, dihitung jadi skor **0–100**; diisi tiap partisipan **setelah** menyelesaikan rangkaian skenario.

- **Skoring:** item ganjil = (jawaban − 1); item genap = (5 − jawaban); jumlah × 2,5; lalu rata-rata seluruh responden.
- **Interpretasi:** ambang rata-rata **68**; grade A ≥ 80,3 (Bangor dkk., 2009); acceptability > 70 = *Acceptable*.
- **Target wajar:** **SUS ≈ 78–87** (sebanding POS web sejenis: Altari 86,5; Yatai Tori 81,5; The King Coffee 78,5; Buyut Semar 86,8).
- Instrumen + lembar skoring: **[kuesioner-sus.md](kuesioner-sus.md)**.

---

## 6. Lapisan 3 — Pengukuran Komparatif (inti penjawab RQ)

### 6.1 Desain: *paired comparison* dengan order-set identik

Ambil pesanan riil **21–27 Mei (7 hari / 1 minggu, ±28 transaksi)** dan eksekusi dua cara untuk pesanan **yang sama persis**:

- **Arm SEBELUM (manual)** = cara lama (waiter tulis kertas → kasir hitung/rekap manual). Sumber data: file `docs/data buku/data_buku_21..27_mei_2026.md`.
- **Arm SESUDAH (sistem)** = pesanan sama di-input ulang lewat POS di `monosuko.my.id`.

Karena input (pesanan) dikontrol konstan, satu-satunya yang berubah adalah **metode** → perbedaan hasil murni efek sistem. Desain ini *within-subject/paired*.

> **Lihat juga** [runbook-reenactment.md](runbook-reenactment.md) untuk langkah teknis (backup prod → reset 21–27 Mei → input via POS → ambil timestamp → settlement → opname).

### 6.2 Protokol RQ-A — Durasi Transaksi

**Definisi durasi:** dari *mulai memasukkan pesanan pertama* sampai *transaksi tersimpan/lunas* untuk satu transaksi.

| | Arm SEBELUM (manual) | Arm SESUDAH (sistem) |
|---|---|---|
| Alur | Waiter tulis pesanan di kertas → serahkan → kasir hitung total manual → catat | Waiter input langsung di HP → kasir proses pembayaran di POS |
| Instrumen waktu | **Stopwatch** (alur fisik tidak terekam sistem) | **Stopwatch** + korroborasi **timestamp DB** (`createdAt` → `paidAt`) |
| Pelaku | Waiter + kasir | Waiter + kasir (peran sama) |

- **Sampel:** seluruh transaksi 21–27 Mei (±28 tx). Bila ingin mendekati literatur (50–60), tambah skenario representatif; akui keterbatasan bila sampel < 30.
- **Stratifikasi:** pisahkan **sederhana** (1 item, cash) vs **kompleks** (multi-item / paket / split-merge) — gain waktunya berbeda.
- **Analisis (deskriptif):** rata-rata durasi sebelum vs sesudah, **selisih detik**, dan **% percepatan** = (sebelum − sesudah)/sebelum × 100. Sajikan per strata + total.
- **Pembanding literatur:** percepatan wajar **~51–80%** (Permana & Sarif 2025: 51,1%; Sari dkk. 2026: ±65–80%). Model penyajian: tabel "Pengukuran Kinerja" ala Permana & Sarif.
- *(Opsional, bila pembimbing menuntut uji hipotesis: uji beda non-parametrik **Wilcoxon**/Mann-Whitney pada data detik — cadangan, di luar pilihan deskriptif.)*

**Lembar Pengukuran Waktu (template):**

| No tx | Tgl asal | Strata (S/K) | Ringkasan pesanan | Durasi SEBELUM (dtk) | Durasi SESUDAH (dtk) | Selisih (dtk) | % cepat | Kondisi jaringan |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

### 6.3 Protokol RQ-B — Rekonsiliasi & Mismatch

> **Catatan kejujuran data:** pencatatan nominal di buku resto **sudah benar** (yang sempat keliru hanyalah ekstraksi OCR saat transkrip — sudah dikoreksi). Maka **tidak ada angka mismatch kas historis** yang bisa dikutip. Nilai sistem **bukan** "memperbaiki angka salah", melainkan **mempercepat rekonsiliasi** + **menyediakan mekanisme deteksi/pencocokan per bank** yang manual tidak punya.

**(i) Waktu rekonsiliasi akhir hari** *(metrik utama RQ-B — terukur)*
- SEBELUM: waktu kasir memisahkan & menjumlahkan cash/EDC/QRIS dari buku campur lalu mencocokkan uang fisik (ukur via simulasi / estimasi-wawancara owner).
- SESUDAH: waktu menyelesaikan **Tutup Kasir / Settlement** di sistem (blind-count → sistem hitung otomatis per metode).
- Pembanding (analogi arah, bukan patokan): Hesananda & Mulyawan (2024) 35→8 menit (konteks kas ATM — sebut disclaimer).

**(ii) Mismatch penjualan vs mutasi rekening — fokus DETEKTABILITAS per bank** *(framing kapabilitas, bukan angka)*
- SEBELUM: buku mencampur semua metode dalam satu kolom deskripsi (mis. "Qris BCA", "TF MK", "BCA Qris") → owner **tidak bisa menjumlahkan per bank** untuk dicocokkan ke tiap mutasi rekening → potensi selisih **tak terdeteksi** (persis keluhan di Latar Belakang). Sumber "sebelum" = **wawancara/testimoni owner** soal sulit & lamanya pencocokan (data kualitatif).
- SESUDAH: settlement memberi **breakdown per metode + per bank** (EDC BCA, Transfer Mandiri, dll) → owner mencocokkan tiap mutasi rekening; **blind-count** menyingkap selisih fisik vs sistem. Selama trial, demonstrasikan variance = 0 / kecil-terjelaskan + total per bank cocok dengan mutasi.
- **Argumen akurasi:** sistem **memungkinkan deteksi & pencocokan per bank** yang sebelumnya mustahil, sekaligus meniadakan error penjumlahan manual karena agregasi otomatis terikat transaksi.

**Lembar Log Rekonsiliasi (template):**

| Tgl | Waktu rekon SEBELUM | Waktu rekon SESUDAH | Pencocokan per bank SEBELUM (bisa/tidak) | Variance settlement SESUDAH (Rp) | Total per bank cocok mutasi? |
|---|---|---|---|---|---|
| | | | | | |

### 6.4 Protokol RQ-C — Mismatch Stok

> **Masalah manual yang asli (dari owner):** waiter/pegawai **sering lupa mencatat stok** — **halaman kiri buku (stok) kosong**, hanya halaman kanan (penjualan) yang terisi. Akibatnya resto **tidak tahu sisa stok**; saat pelanggan memesan ternyata stok habis → harus **kirim darurat via Gojek dari rumah** → **menambah biaya operasional (ongkir)**. Inilah "mismatch" stok versi resto: bukan sekadar angka selisih, tapi **stok tak terpantau** yang berujung stockout & biaya.

- SEBELUM (audit buku + testimoni): hitung **berapa hari halaman stok kosong/tidak lengkap**, **insiden stok habis & kirim darurat**, dan **estimasi total ongkir darurat (Rp)** — metrik rupiah konkret. Stok yang tercatat 0 (mis. 21 Mei: Empal 0, Gasem D 0, Susu K 0) menandai kondisi rawan habis.
- SESUDAH (sistem): **stok selalu tercatat** (auto-decrement tiap order + opname pagi "Cek Fisik & Koreksi"); **reminder low-stock** memunculkan peringatan **sebelum** habis → mencegah stockout & kirim darurat; opname menghasilkan **angka selisih per item** (`portion_movements`, reason `manual_adjust`) yang sebelumnya mustahil.
- **Klaim RQ-C yang valid:** manual = stok **tak terpantau** → stockout mendadak + biaya darurat; sistem = stok **terpantau real-time** + selisih **terukur** + stockout **dicegah** lewat reminder. Hubungkan ke **penurunan biaya operasional darurat** sebagai bukti dampak nyata.

**Lembar Log Stok (template):**

| Tgl | Halaman stok kosong? (sebelum) | Stockout & kirim darurat (sebelum) | Estimasi ongkir darurat (Rp) | Selisih opname (sesudah, item: ±qty) | Reminder low-stock muncul? |
|---|---|---|---|---|---|
| | | | | | |

---

## 7. Template Tabel Hasil (untuk Bab Hasil/Pengujian)

- **Tabel RQ-A:** durasi rata-rata sebelum vs sesudah (per strata + total) + % percepatan.
- **Tabel RQ-B:** waktu rekonsiliasi sebelum vs sesudah + kemampuan pencocokan per bank (sebelum: tidak; sesudah: ya) + variance trial.
- **Tabel RQ-C:** hari stok tak tercatat + insiden stockout/darurat + biaya ongkir (sebelum) vs stok selalu tercatat + selisih opname terdeteksi + reminder (sesudah).
- **Tabel UAT:** rekap Pass/Fail + % keberhasilan.
- **Tabel SUS:** skor per responden + rata-rata + interpretasi grade.

---

## 8. Ancaman Validitas & Keterbatasan (cantumkan jujur di skripsi)

1. **RQ-A "sebelum" adalah simulasi**, bukan rekaman masa lalu — kasir/waiter bisa lebih cepat/lambat dari kondisi asli (efek belajar/Hawthorne). Mitigasi: order-set identik, pelaku sama, sampel cukup.
2. **n kecil** (6 pegawai) untuk SUS — wajar untuk studi usability skripsi, tapi sebutkan keterbatasan generalisasi.
3. **RQ-B "sebelum" bersifat kualitatif** — karena pencatatan kas buku sudah benar, tidak ada angka mismatch historis; jawaban RQ-B bertumpu pada **kecepatan rekonsiliasi (terukur)** + **kapabilitas pencocokan per bank** (didukung testimoni owner). Nyatakan eksplisit.
4. **RQ-C "sebelum" tanpa angka selisih stok** — memakai **proxy** (hari halaman stok kosong, insiden stockout/kirim darurat, biaya ongkir); dinyatakan eksplisit.
5. **Bukti literatur durasi = SEDANG** (2 sumber konteks beda) → disajikan sebagai kisaran, bukan target.
6. Pengujian di **lingkungan produksi** → siapkan **backup** sebelum reset data (lihat runbook).

---

## 9. Checklist Persiapan

- [ ] Surat/persetujuan kesediaan owner + pegawai
- [ ] [Tabel skenario UAT](skenario-uat.md) tercetak/siap
- [ ] [Kuesioner SUS](kuesioner-sus.md) (cetak / Google Form)
- [ ] Lembar pengukuran waktu + log rekonsiliasi + log stok (template §6)
- [ ] Ekstrak baseline "sebelum" dari `docs/data buku/` (audit hari stok kosong + insiden stockout/kirim darurat) + **wawancara owner** (waktu & kesulitan rekonsiliasi, biaya ongkir darurat)
- [ ] Backup prod `monosuko.my.id` sebelum re-enactment ([runbook](runbook-reenactment.md))
- [ ] HP/tablet + akun per peran siap; catat kondisi jaringan
- [ ] Dokumentasi foto/screenshot sesi

---

*Disusun untuk skripsi POS Restoran Ayam Bakar Banjar Monosuko (C14220315). Selaras dengan operasional REV 2.11 & metodologi Bab 2.5.*
