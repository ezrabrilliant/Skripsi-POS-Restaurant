# Referensi Pengujian Terdahulu — POS / Kasir Sejenis

> **Tujuan:** bahan pembanding untuk bab Pengujian skripsi POS Restoran X (RQ-A durasi transaksi, RQ-B rekonsiliasi, RQ-C stok, + UAT + SUS).
>
> **Catatan integritas (PENTING):** Semua angka di bawah sudah **diverifikasi balik ke sumber aslinya** (di-fetch & dicek kalimat persisnya). Beberapa angka populer mudah **disalah-kutip** — baca kotak ⚠️ sebelum memakainya. Jangan mengutip angka tanpa membaca catatan jebakannya.

---

## Ringkasan jawaban: "berapa detik sebelum vs sesudah?"

Dua sumber terkuat (durasi nyata dalam menit/detik, konteks ritel/kafe):

| Sumber | SEBELUM (manual) | SESUDAH (sistem POS) | Percepatan |
|---|---|---|---|
| **Permana & Sarif (2025)** — coffee shop, 50 transaksi jam puncak | **4 menit 35 detik** | **2 menit 15 detik** | **51,1%** |
| **Sari dkk. (2026)** — toko kue, manual vs POS web | **2–4 menit** | **20–40 detik** | **±65–80%** |

> **Rentang "angka wajar" untuk studimu: SEBELUM ~2–4½ menit → SESUDAH ~20 detik–2¼ menit; percepatan ~51–80%.** Bukti SEDANG (hanya 2 sumber berdurasi nyata, konteks beda) — sajikan sebagai "kisaran literatur sejenis", bukan target absolut.

---

## 1. Durasi / Kecepatan Transaksi

| Penulis (Tahun) | Sumber | Metrik | Sebelum | Sesudah | Kutipan |
|---|---|---|---|---|---|
| Sari, Arribathi & Astriyani (2026) | ICIT Journal (Univ. Raharja) 12(1) | Waktu transaksi/pelanggan, manual vs POS web | 2–4 menit | 20–40 detik | "Pada metode manual, kasir membutuhkan waktu 2–4 menit per transaksi… Dengan sistem POS, waktu transaksi berkurang menjadi 20–40 detik per pelanggan." |
| Permana & Sarif (2025) | Jurnal Minfo Polgan 14(2) | Rata-rata waktu pemesanan (coffee shop, 50 tx jam puncak) | 4 mnt 35 dtk | 2 mnt 15 dtk (51,1%) | "…penurunan rata-rata waktu pemesanan dari 4 menit 35 detik menjadi 2 menit 15 detik, atau percepatan 51,1%." |
| Ardiansyah, Wijoyo & Wardhono (2023) | J-PTIIK (UB) 7, hlm. 2623–2627 | Uji Mann-Whitney U (data mentah detik), manual vs POS | mean rank 44,65 | mean rank 16,35; sig. 0,000 | "…mean rank aplikasi lebih rendah dibandingkan manual dan nilai signifikansi bernilai 0,000…" |
| Pinandito & Brilliansyach (2024) | JTIIK 11(4), hlm. 805–816 | Waktu bayar QRIS statis vs dinamis (nilai TERTINGGI) | 34,7 dtk (statis) | 21,8 dtk (dinamis) | "Nilai tertinggi… 34,7 detik untuk QRIS statis dan 21,8 detik untuk QRIS dinamis." |
| Pinandito & Brilliansyach (2024) | (idem) | Waktu bayar QRIS (nilai TERCEPAT) | 9,21 dtk (statis) | 8,25 dtk (dinamis) | "…tercepat… QRIS statis 9,21 detik dan… QRIS dinamis 8,25 detik." |

> ⚠️ **Jebakan kutip:**
> - **RM. Ikan Bagor (Ardiansyah 2023):** 44,65 & 16,35 adalah **mean rank** (peringkat statistik Mann-Whitney), **BUKAN detik**. Jangan ditulis "44 detik". Yang valid: "aplikasi POS signifikan lebih cepat, sig. 0,000". (Venue: header PDF Vol.7 No.5 Mei 2023 vs metadata OJS Vol.7 No.6 Juni 2023 — inkonsistensi internal jurnal; hlm. 2623–2627 konsisten.)
> - **QRIS (Pinandito 2024):** 34,7/21,8 = **maksimum**, 9,21/8,25 = **tercepat** — keduanya BUKAN rata-rata & ini **QRIS statis vs dinamis** (bukan manual-vs-sistem). Rata-rata yang dilaporkan: statis nominal-tetap 16,7 dtk; dinamis 14,0 dtk. Ini level **metode pembayaran**, bukan transaksi end-to-end. Jangan dicampur dengan baris manual-vs-sistem.

---

## 2. Rekonsiliasi / Akurasi Kas

| Penulis (Tahun) | Sumber | Metrik | Sebelum | Sesudah | Kutipan |
|---|---|---|---|---|---|
| Hesananda & Mulyawan (2024) | Innotech 1(2), hlm. 24–37 | Waktu rekonsiliasi kas (30 kasus) | 35 menit | 8 menit (hemat ±27 mnt/kasus) | "…mengurangi waktu proses rekonsiliasi dari rata-rata 35 menit menjadi hanya 8 menit per kasus." |

> ⚠️ Ini rekonsiliasi **kas ATM**, bukan kas restoran. Pakai hanya sebagai **analogi arah** untuk fitur settlement/tutup kasir, dengan disclaimer konteks. Bukti TIPIS (1 sumber).

---

## 3. Skor System Usability Scale (SUS) — POS web sejenis

| Penulis (Tahun) | Sumber | n responden | Skor SUS | Kategori |
|---|---|---|---|---|
| Mardika & Widayat (2025) | JPTI 5(6), DOI 10.52436/1.jpti.865 (The King Coffee) | 30 | **78,5** | Good |
| Frastya, Wijoyo & Pramono (2025) | J-PTIIK 9(7) (Yatai Tori) | 10 | **81,5** | Sangat baik / acceptable |
| Juventauricula, Hanggara & Pramono (2024) | J-PTIIK 8(1), hlm. 97–106 (**Restoran Altari**) | 5 | **86,5** | Grade B, acceptable |
| Maulana, Rahaningsih & Pratama (2024) | JATI (Warung Buyut Semar) | 8 | **86,8** | Grade A, acceptable |

> **Rentang terbukti: 78,5–86,8** (semua di atas ambang 68). **Patokan wajar: SUS ≈ 78–87** untuk POS web sejenis. Dua paling relevan = Restoran Altari (86,5) & The King Coffee (78,5).
>
> ⚠️ **Mardika & Widayat (2025):** Tabel 4-nya memuat skor per-responden mustahil (>100: R12=105, R23=107,5), tapi rata-rata 78,5 konsisten dengan penjumlahan mereka (2355/30). Angka **78,5 valid dikutip**; cacat data mentah = masalah penulis asli. **Pelajaran:** validasi tiap skor responden ≤100 sebelum merata-rata.

---

## 4. Pengujian Fungsional / UAT / Black-Box (metodologi)

| Penulis (Tahun) | Sumber | Hasil | Kutipan |
|---|---|---|---|
| Raehan, Jondy & Anwar (2025) | JISBT 1(4), hlm. 143–148 (ISO/IEC 29119, black-box, EP+BVA) | **100% Pass, Zero Defect** | "…status Pass (tingkat keberhasilan 100%). Tidak ditemukan bug… (Zero Defect)…" |
| Wahyudi (2021) | KURAWAL 4(1) (black-box) | **232/256 lulus** (24 gagal, severity S2 ditoleransi) ≈ 90,6% | "…Dari 256 test case, yang dinyatakan gagal adalah 24 test case." |

> **Patokan: ≥90% test case Pass** wajar untuk klaim kelayakan fungsional. Teknik: Equivalence Partitioning + Boundary Value Analysis; acuan standar ISO/IEC 29119.
>
> ⚠️ **Raehan dkk. (2025):** abstrak tulis "27 skenario" tapi tabel+hasil hitung **26** (TC-024 hilang). Klaim 100% tak terpengaruh, tapi kalau menyebut jumlah, tandai diskrepansi 27-vs-26.

---

## 5. Referensi BELUM Terverifikasi / Tanpa Angka — JANGAN dipakai sebagai sumber angka

| Penulis (Tahun) | Status | Yang BOLEH dikutip |
|---|---|---|
| **Sucipta (2023)**, Univ. Terbuka, EPrints 1431 | Full text TIDAK tersedia; abstrak tanpa metrik. Judul "…Efisiensi…" menyesatkan (isinya pengembangan sistem terintegrasi) | Hanya naratif motivasi integrasi kasir-waiter-dapur. BUKAN angka. |
| **Hidayati dkk. (2023)**, J. Pendidikan & Kewirausahaan 11(3) | Studi kasus + SWOT kualitatif, tanpa metrik before/after / SUS | Hanya kutipan kualitatif (pertimbangan adopsi Moka POS untuk efisiensi). |
| **Alkarim, Yunita & Rianto (2025)**, JOECY 5(2) | Instrumen = **IBM CSUQ (19 item, skala 7), BUKAN SUS**. Skor bertentangan: abstrak 87% vs tubuh 84% | Boleh "usability CSUQ 84–87%" **dengan menyebut diskrepansi**. Jangan dilabeli SUS. |
| **Brilliansyach (2024)**, skripsi FILKOM UB, repo 216266 | Full text embargo; abstrak = metodologi (Wilcoxon, **60 sampel**) | Boleh untuk **desain metode** ("uji Wilcoxon, 60 sampel"). Angka hasil pakai versi jurnal JTIIK (§1). |

---

## 6. "Angka Wajar" untuk Studi Ini (hanya dari bukti terbukti)

- **Durasi transaksi:** SEBELUM (manual) **~2–4½ menit** → SESUDAH (sistem) **~20 detik–2¼ menit**; percepatan **~51–80%**. Kekuatan bukti: **SEDANG**.
- **Waktu bayar QRIS (jika dibahas terpisah):** ~8–35 detik (level metode pembayaran, jangan dicampur).
- **Skor SUS:** target wajar **≈ 78–87** (sebanding POS web sejenis). Kekuatan bukti: **CUKUP KUAT** (4 sumber konvergen).
- **UAT/black-box:** **≥90% Pass** wajar untuk klaim kelayakan fungsional.
- **Rekonsiliasi:** bukti TIPIS — jangan jadi patokan utama, analogi arah saja.

---

## 7. Catatan Metodologi yang Bisa Ditiru

**Durasi transaksi (untuk RQ-A):**
- **Permana & Sarif (2025) — model terbaik ditiru:** ukur rata-rata waktu pemesanan pada **50 transaksi di jam puncak**, bandingkan manual vs sistem, sajikan tabel "Pengukuran Kinerja" + % percepatan. Paling dekat dengan alur order-intake-mu.
- **Sari dkk. (2026):** format ringkas (rentang + kolom "% lebih cepat").
- **Ardiansyah dkk. (2023):** model statistik formal (Mann-Whitney U; mean rank + p). Pilih kalau pembimbing menuntut uji hipotesis. *(Kamu sudah memilih deskriptif — ini opsional cadangan.)*
- **Brilliansyach (2024):** Wilcoxon (sampel berpasangan), 60 sampel, ukur waktu **dan** jumlah step.
- **Instrumen waktu:** literatur tak menyebut stopwatch vs timestamp. Untuk objektivitas, manfaatkan **timestamp `createdAt`/`paidAt` dari DB POS-mu** (lebih objektif & sudah tersedia di skema transaksi); stopwatch untuk mengukur interaksi manusia ujung-ke-ujung.

**SUS:** 10 item Likert 1–5 → 0–100. n responden literatur: 5/8/10/30. Untuk skripsi 8–30 lazim; basis realistismu = owner + 3 kasir + 2 waiter. Interpretasi pakai ambang 68 / grade A ≥80,3 (Bangor dkk. 2009).

**Black-box/UAT:** EP + BVA, tabel test case Pass/Fail (+ severity opsional), acuan ISO/IEC 29119.

**Ringkas sampel:** durasi transaksi 50–60 sampel; SUS 5–30 responden; black-box puluhan–ratusan test case.

---

## 8. Daftar Pustaka (format APA, siap tempel)

1. Ardiansyah, M. I., Wijoyo, S. H., & Wardhono, W. S. (2023). Analisis perbandingan aplikasi Point of Sale dengan kasir manual untuk mesin kasir pada RM. Ikan Bagor. *Jurnal Pengembangan Teknologi Informasi dan Ilmu Komputer, 7*(5/6), 2623–2627.
2. Frastya, A., Wijoyo, S. H., & Pramono, D. (2025). Pengembangan sistem informasi aplikasi Point of Sales (POS) berbasis website (Studi kasus: Yatai Tori). *Jurnal Pengembangan Teknologi Informasi dan Ilmu Komputer, 9*(7).
3. Hesananda, R., & Mulyawan, Y. (2024). Meningkatkan efisiensi dalam rekonsiliasi kas ATM: Implementasi sistem informasi berbasis website. *Innovation and Technology (Innotech), 1*(2), 24–37.
4. Juventauricula, P., Hanggara, B. T., & Pramono, D. (2024). Pengembangan Sistem Informasi Point of Sale (POS) berbasis Web (Studi Kasus: Restoran Altari). *Jurnal Pengembangan Teknologi Informasi dan Ilmu Komputer, 8*(1), 97–106.
5. Maulana, M. R., Rahaningsih, N., & Pratama, D. (2024). Analisis usability aplikasi Point of Sales (POS) berbasis web menggunakan metode System Usability Scale (Studi kasus: Warung Buyut Semar). *JATI (Jurnal Mahasiswa Teknik Informatika).*
6. Mardika, S. D., & Widayat, W. (2025). Pengembangan sistem informasi kasir pada The King Coffee Karanganyar berbasis website menggunakan metode Waterfall. *Jurnal Pendidikan dan Teknologi Indonesia (JPTI), 5*(6), 1713–1727. https://doi.org/10.52436/1.jpti.865
7. Permana, A. I., & Sarif, M. I. (2025). Penerapan sistem informasi pemesanan menu makanan di coffee shop. *Jurnal Minfo Polgan, 14*(2).
8. Pinandito, A., & Brilliansyach, R. F. (2024). Efisiensi penggunaan QRIS dengan Merchant Presented Mode dalam transaksi pembayaran non-tunai. *Jurnal Teknologi Informasi dan Ilmu Komputer, 11*(4), 805–816. https://doi.org/10.25126/jtiik.1148570
9. Raehan, M., Jondy, A. A., & Anwar, C. (2025). Evaluasi kualitas fungsional aplikasi Point of Sales (POS) restoran berbasis web (open source) menggunakan standar pengujian ISO/IEC 29119. *Journal of Information Systems and Business Technology (JISBT), 1*(4), 143–148.
10. Sari, M. M., Arribathi, A. H., & Astriyani, E. (2026). Pengembangan aplikasi Point of Sale (POS) berbasis website menggunakan metodologi Agile untuk manajemen penjualan Toko Kue XYZ. *ICIT Journal, 12*(1).

*Belum terverifikasi penuh (pakai hati-hati, lihat §5): Sucipta (2023); Hidayati dkk. (2023); Alkarim dkk. (2025); Brilliansyach (2024, skripsi).*

---

*Disusun dari riset multi-agen terverifikasi (sumber di-fetch & dicek kalimatnya). Konteks: skripsi POS Restoran Ayam Bakar Banjar Monosuko, C14220315.*
