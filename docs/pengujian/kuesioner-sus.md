# Kuesioner System Usability Scale (SUS) — Sistem POS Restoran X

> **Instrumen Lapisan 2** (lihat [rencana-pengujian.md](rencana-pengujian.md)). Mengukur tingkat kemudahan penggunaan sistem (Bab 2.5). Diisi tiap partisipan **setelah** menyelesaikan rangkaian skenario UAT/penggunaan.
>
> Versi pernyataan memakai **adaptasi Bahasa Indonesia tervalidasi** (Sharfina & Santoso, 2016) atas SUS asli (Brooke, 1996). Skala asli **Likert 1–5**.

---

## A. Identitas Responden

| Field | Isi |
|---|---|
| Nama / inisial | |
| Peran | ☐ Owner ☐ Kasir ☐ Waiter |
| Tanggal pengisian | |
| Perangkat yang dipakai | ☐ HP ☐ Tablet ☐ Lainnya: ___ |

---

## B. Petunjuk Pengisian

Berikan **satu** tanda centang per baris sesuai tingkat persetujuan Anda terhadap pernyataan, setelah mencoba menggunakan sistem. Jawablah spontan; tidak ada jawaban benar/salah.

Keterangan skala:

| 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|
| Sangat Tidak Setuju (STS) | Tidak Setuju (TS) | Netral (N) | Setuju (S) | Sangat Setuju (SS) |

---

## C. Pernyataan (10 item)

| No | Pernyataan | 1 (STS) | 2 | 3 | 4 | 5 (SS) |
|----|------------|:---:|:---:|:---:|:---:|:---:|
| 1 | Saya berpikir akan menggunakan sistem ini lagi. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 2 | Saya merasa sistem ini rumit untuk digunakan. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 3 | Saya merasa sistem ini mudah digunakan. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4 | Saya membutuhkan bantuan orang lain atau teknisi dalam menggunakan sistem ini. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 5 | Saya merasa fitur-fitur sistem ini berjalan dengan semestinya. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 6 | Saya merasa ada banyak hal yang tidak konsisten (tidak serasi) pada sistem ini. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 7 | Saya merasa orang lain akan memahami cara menggunakan sistem ini dengan cepat. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 8 | Saya merasa sistem ini membingungkan. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 9 | Saya merasa tidak ada hambatan dalam menggunakan sistem ini. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 10 | Saya perlu membiasakan diri terlebih dahulu sebelum menggunakan sistem ini. | ☐ | ☐ | ☐ | ☐ | ☐ |

> Catatan: item **ganjil bernada positif**, item **genap bernada negatif** — ini bagian dari desain SUS (mencegah jawaban asal-centang). Jangan diubah urutannya.

---

## D. Cara Penghitungan Skor (per responden)

1. **Item ganjil (1, 3, 5, 7, 9):** kontribusi skor = **(jawaban − 1)**.
2. **Item genap (2, 4, 6, 8, 10):** kontribusi skor = **(5 − jawaban)**.
3. **Jumlahkan** ke-10 kontribusi (hasil 0–40).
4. **Kalikan 2,5** → skor SUS responden (rentang **0–100**).

**Skor akhir sistem = rata-rata skor SUS seluruh responden.**

### Contoh terhitung (ilustrasi)

Misal seorang kasir menjawab: P1=5, P2=1, P3=5, P4=2, P5=4, P6=2, P7=5, P8=1, P9=4, P10=2.

| Item | Jawaban | Aturan | Kontribusi |
|---|---|---|---|
| 1 (+) | 5 | 5−1 | 4 |
| 2 (−) | 1 | 5−1 | 4 |
| 3 (+) | 5 | 5−1 | 4 |
| 4 (−) | 2 | 5−2 | 3 |
| 5 (+) | 4 | 4−1 | 3 |
| 6 (−) | 2 | 5−2 | 3 |
| 7 (+) | 5 | 5−1 | 4 |
| 8 (−) | 1 | 5−1 | 4 |
| 9 (+) | 4 | 4−1 | 3 |
| 10 (−) | 2 | 5−2 | 3 |
| **Jumlah** | | | **35** |

Skor SUS = 35 × 2,5 = **87,5**.

---

## E. Lembar Rekap Skoring (semua responden)

| Responden | Peran | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | P10 | Jumlah (0–40) | Skor SUS (×2,5) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| R1 | | | | | | | | | | | | | |
| R2 | | | | | | | | | | | | | |
| R3 | | | | | | | | | | | | | |
| R4 | | | | | | | | | | | | | |
| R5 | | | | | | | | | | | | | |
| R6 | | | | | | | | | | | | | |
| | | | | | | | | | | | | **Rata-rata** | |

> **Validasi wajib** (pelajaran dari literatur): pastikan setiap **Skor SUS ≤ 100** sebelum merata-rata. Bila ada nilai > 100, ada salah hitung kontribusi item.

---

## F. Interpretasi Skor

| Skala | Acuan |
|---|---|
| **Ambang rata-rata** | **68** = rata-rata umum SUS. ≥ 68 berarti di atas rata-rata. |
| **Acceptability** (Bangor dkk., 2009) | < 50 *Not Acceptable* · 50–70 *Marginal* · > 70 *Acceptable* |
| **Grade** | A ≥ 80,3 · B 74–80,3 · C 68–74 · D 51–68 · F < 51 |
| **Adjective rating** | ~52 *OK* · ~73 *Good* · ~85 *Excellent* · ~100 *Best Imaginable* |

**Pembanding (POS web sejenis, terverifikasi):** Altari 86,5 · Buyut Semar 86,8 · Yatai Tori 81,5 · The King Coffee 78,5 → **rentang wajar ≈ 78–87**. Bila sistem Anda meraih ~80+, itu **konsisten dengan literatur** (kategori *Good*–*Excellent*, *Acceptable*).

---

## G. Catatan Pelaksanaan

- **Responden:** pengguna riil — Owner + 3 kasir + 2 waiter (n ≈ 6). Untuk skripsi, n 5–30 lazim (Altari 5; Buyut Semar 8; Yatai Tori 10; The King Coffee 30). Nyatakan keterbatasan n kecil di pembahasan.
- **Waktu pengisian:** setelah responden benar-benar mencoba sistem (jangan diisi sebelum mencoba).
- **Media:** boleh kertas (cetak tabel C) atau **Google Form** (10 pertanyaan skala 1–5; skoring otomatis via rumus §D).
- **Anonimitas:** boleh pakai inisial; jelaskan data untuk skripsi (informed consent).

---

## Daftar Pustaka instrumen

- Brooke, J. (1996). SUS: A "quick and dirty" usability scale. In P. W. Jordan dkk. (Eds.), *Usability Evaluation in Industry* (hlm. 189–194). Taylor & Francis.
- Bangor, A., Kortum, P., & Miller, J. (2009). Determining what individual SUS scores mean: Adding an adjective rating scale. *Journal of Usability Studies, 4*(3), 114–123.
- Sharfina, Z., & Santoso, H. B. (2016). An Indonesian adaptation of the System Usability Scale (SUS). *2016 International Conference on Advanced Computer Science and Information Systems (ICACSIS)*, 145–148. IEEE. https://doi.org/10.1109/ICACSIS.2016.7872776

---

*Instrumen untuk skripsi POS Restoran Ayam Bakar Banjar Monosuko (C14220315).*
