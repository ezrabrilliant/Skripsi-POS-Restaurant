# Hasil RQ-C — Manajemen Stok & Mismatch (sebelum manual vs sesudah POS)

> **Menjawab Rumusan Masalah 3:** apakah manajemen stok harian + fitur opname meminimalisir terjadinya *mismatch* stok dibanding pencatatan manual? **Metode:** audit catatan buku 21–27 Mei 2026 (kondisi "sebelum", NYATA) + demonstrasi fitur sistem (kondisi "sesudah", terverifikasi di UAT grup F) + testimoni owner (biaya darurat — *pending*). Analisis **deskriptif**.
>
> **Asal angka:** kolom "sebelum" diaudit langsung dari `docs/data buku/data_buku_2{1..7}_mei_2026.md` (halaman stok pagi). Kondisi "sesudah" mengacu mekanisme sistem yang sudah diuji (UAT C05/C06 auto-decrement, F04 opname, F06/dashboard reminder).

---

## 1. Kondisi "Sebelum" — audit halaman stok buku

Halaman stok ("rekonsiliasi pagi") dicatat tiap hari, tetapi audit menunjukkan **stockout kronis** dan **pencatatan tak lengkap**:

**Tabel — Item ber-stok 0 (habis) per hari, 21–27 Mei**

| Tanggal | Item ber-stok 0 (habis) | Jumlah | Catatan kelengkapan |
|---|---|---:|---|
| 21 Mei | Garang Asem Daging, Empal, Susu Kedelai | 3 | lengkap |
| 22 Mei | Garang Asem Daging, Empal | 2 | lengkap |
| 23 Mei | Garang Asem Daging, Empal | 2 | lengkap |
| 24 Mei | Garang Asem Daging | 1 | Empal terisi (2) |
| 25 Mei | Garang Asem Daging, Empal | 2 | lengkap |
| 26 Mei | Empal | 1 | Garang Asem Daging terisi (3) |
| 27 Mei | Empal | 1 | **2 item tak tercatat** (Garang Asem Ayam & Kerupuk = "–") |
| **Total** | | **12 item-hari habis** | |

**Temuan:**
- **Empal habis (stok 0) pada 6 dari 7 hari** (semua kecuali 24 Mei) — *stockout* kronis.
- **Garang Asem Daging habis pada 5 dari 7 hari** (21–25 Mei).
- **Susu Kedelai habis** pada 21 Mei; persediaan tipis (1) pada 25–27 Mei.
- **27 Mei: halaman stok tidak lengkap** — Garang Asem Ayam dan Kerupuk tidak tercatat (ditulis "–"), bukti nyata pencatatan manual dapat terlewat.
- Pencatatan manual **tidak menghasilkan angka selisih** (opname) — buku hanya mencatat jumlah pagi, tanpa membandingkan sistemik vs fisik, sehingga *mismatch* tak terkuantifikasi.

## 1b. Komparasi Waktu Pengecekan & Opname Stok (model)

Selain akurasi, manajemen stok juga punya dimensi **waktu**. Dua aktivitas dibandingkan: pengecekan ketersediaan stok saat pesanan masuk, dan opname/pencatatan stok.

> **Asal angka:** MODEL (penjumlahan waktu per-langkah). Pola pengujian mengikuti contoh thesis (Toko X) yang membandingkan waktu pengecekan stok tanpa vs dengan sistem berdasarkan jumlah item.

**Tabel — Komparasi Waktu Pengecekan Ketersediaan Stok**

| Jumlah item dicek | Manual (detik) | Sistem (detik) | Efisiensi |
| ----------------: | -------------: | -------------: | --------: |
|            1 item |           19,0 |            9,0 |     52,6% |
|            3 item |           45,0 |           19,0 |     57,8% |
|            5 item |           71,0 |           29,0 |     59,2% |
|     **Rata-rata** |                |                | **56,5%** |

Manual mengharuskan pengecekan fisik ke tempat stok (atau mengira-ngira), sedangkan sistem cukup membuka aplikasi dan melihat angka stok *real-time* (hasil auto-decrement). Efisiensi meningkat seiring banyaknya item — konsisten dengan temuan literatur sejenis (Toko X ≈ 55,7%).

**Tabel — Komparasi Waktu Opname/Pencatatan Stok**

| Aktivitas | Manual (detik/item) | Sistem (detik/item) | Catatan |
|---|---:|---:|---|
| Hitung fisik + catat | 12 | 13 | **Waktu ~setara** |

Untuk opname, waktu manual dan sistem **hampir setara** (keduanya menghitung fisik lalu mencatat). **Keunggulan sistem di sini bukan kecepatan, melainkan akurasi**: input opname langsung menghasilkan **angka selisih per item** (sistemik vs fisik) beserta jejak audit — sesuatu yang mustahil pada pencatatan manual.

**Parameter model (dapat dikalibrasi):**

| Langkah | Nilai | Sisi |
|---|---|---|
| Cek fisik ketersediaan per item | 13 s/item (+6 s overhead) | manual |
| Lihat angka stok di aplikasi per item | 5 s/item (+4 s buka app) | sistem |
| Hitung fisik + catat/input per item | 12 / 13 s | manual / sistem |

## 2. Konsekuensi (dampak operasional)

Item yang habis (Empal, Garang Asem Daging) tidak dapat dijual saat diminta → **kehilangan penjualan** atau **pengiriman darurat dari rumah pemilik** (kirim stok via ojek daring) yang menambah **biaya ongkir**.

> ⚠️ **Pembedaan jujur:** buku 21–27 Mei memuat ongkir **Rp 36.000** (26 Mei Gojek Rp 16.000 + 27 Mei ongkir Rp 20.000), namun itu **ongkir pengiriman pesanan ke pelanggan** (layanan antar), **bukan** ongkir *restock darurat*. Estimasi **biaya restock darurat** (pemilik kirim stok dari rumah saat habis) adalah **metrik dari testimoni owner** (belum tersedia di buku) — *pending* dikumpulkan.

## 3. Kondisi "Sesudah" — mekanisme sistem (terverifikasi UAT grup F & C)

| Masalah manual | Solusi sistem | Bukti UAT |
|---|---|---|
| Stok tak terpantau / lupa catat | **Auto-decrement** tiap order (stok selalu termutakhirkan *real-time*, tercatat di `portion_movements`) | C05 (Ati 3→1), C06 (boleh negatif & tercatat) |
| Habis mendadak tak disadari | **Reminder low-stock** di dashboard + daftar item di bawah batas minimum | F (reminder), Dashboard waiter/owner |
| *Mismatch* tak terkuantifikasi | **Opname** menghasilkan **angka selisih per item** (sistemik vs fisik) + jejak audit pelaku | F04 (opname selisih), F06 |
| Restock pagi tak terstruktur | **Restock pagi** kelipatan 5 menjaga stok ≥ batas minimum | F01/F02 (boundary ×5) |

## 4. Klaim & keterbatasan (jujur)

- **Klaim yang sahih:** pencatatan manual → stok tak terpantau penuh (terbukti: 27 Mei 2 item tak tercatat) + *stockout* kronis (Empal 6/7 hari) + **mismatch tak terkuantifikasi** (buku tak punya angka selisih). Sistem → stok tercatat *real-time*, *reminder* mencegah *stockout* mendadak, dan **opname menghasilkan angka selisih yang dulu mustahil**.
- **Bukan klaim:** "selisih stok turun X%" — manual **tak punya angka selisih** untuk dibandingkan, jadi reduksi persentase tidak dapat dihitung. Kontribusi sistem = **kapabilitas mengukur & mencegah**, bukan reduksi angka historis.
- **Keterbatasan:** biaya restock darurat (rupiah) = testimoni owner (*pending*); periode audit 1 minggu.

---

*Disusun 2026-06-04. Sumber "sebelum": audit `docs/data buku/` 21–27 Mei (NYATA). Sumber "sesudah": UAT grup F & C (`hasil-uat-prod.md`).*
