# Hasil Pengujian Usability — System Usability Scale (SUS)

> **Menjawab kebutuhan non-fungsional "kemudahan penggunaan"** (Bab 3). Instrumen: 10 pernyataan baku SUS (Brooke, 1996) adaptasi Bahasa Indonesia tervalidasi (Sharfina & Santoso, 2016), skala Likert 1–5.
>
> ⚠️ **Status data:** jawaban 6 responden di bawah adalah **ILUSTRATIF** (contoh realistis untuk melengkapi naskah), **belum** pengisian riil. Akan **digantikan jawaban sebenarnya** setelah owner + 3 kasir + 2 waiter mengisi kuesioner. Skala & skoring sudah final.

---

## 1. Pernyataan (10 item)

| No  | Pernyataan                                                                     | Nada |
| --- | ------------------------------------------------------------------------------ | ---- |
| P1  | Saya berpikir akan menggunakan sistem ini lagi.                                | +    |
| P2  | Saya merasa sistem ini rumit untuk digunakan.                                  | −    |
| P3  | Saya merasa sistem ini mudah digunakan.                                        | +    |
| P4  | Saya membutuhkan bantuan orang lain atau teknisi dalam menggunakan sistem ini. | −    |
| P5  | Saya merasa fitur-fitur sistem ini berjalan dengan semestinya.                 | +    |
| P6  | Saya merasa ada banyak hal yang tidak konsisten pada sistem ini.               | −    |
| P7  | Saya merasa orang lain akan memahami cara menggunakan sistem ini dengan cepat. | +    |
| P8  | Saya merasa sistem ini membingungkan.                                          | −    |
| P9  | Saya merasa tidak ada hambatan dalam menggunakan sistem ini.                   | +    |
| P10 | Saya perlu membiasakan diri terlebih dahulu sebelum menggunakan sistem ini.    | −    |

Skala: 1 = Sangat Tidak Setuju · 2 = Tidak Setuju · 3 = Netral · 4 = Setuju · 5 = Sangat Setuju.

## 2. Cara Skoring

- Item ganjil (positif): kontribusi = jawaban − 1.
- Item genap (negatif): kontribusi = 5 − jawaban.
- Jumlahkan 10 kontribusi (0–40), kalikan 2,5 → skor SUS (0–100).
- Skor akhir sistem = rata-rata skor seluruh responden.

## 3. Jawaban 6 Responden (ilustratif)

**Tabel — Jawaban per item dan skor SUS**

| Responden | Peran | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | P10 | Jumlah | Skor SUS |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| R1 | Pemilik | 5 | 2 | 5 | 1 | 5 | 2 | 5 | 1 | 4 | 2 | 36 | **90,0** |
| R2 | Kasir (Jason) | 5 | 2 | 4 | 2 | 5 | 2 | 4 | 1 | 4 | 2 | 33 | **82,5** |
| R3 | Kasir (Bryant) | 4 | 2 | 5 | 2 | 4 | 1 | 5 | 2 | 4 | 3 | 32 | **80,0** |
| R4 | Kasir (Chen Hong) | 5 | 1 | 4 | 2 | 4 | 2 | 4 | 2 | 3 | 2 | 31 | **77,5** |
| R5 | Waiter (Amel) | 4 | 2 | 4 | 2 | 4 | 2 | 5 | 2 | 4 | 3 | 30 | **75,0** |
| R6 | Waiter (Yanti) | 5 | 2 | 4 | 2 | 4 | 2 | 4 | 2 | 4 | 2 | 31 | **77,5** |
| | | | | | | | | | | | | **Rata-rata** | **80,4** |

## 4. Interpretasi

| Acuan | Posisi skor 80,4 |
|---|---|
| Ambang rata-rata umum (68) | **di atas rata-rata** |
| *Acceptability* (Bangor dkk., 2009) | > 70 → **Acceptable** |
| *Grade* | ≈ batas **A** (≥ 80,3) / B |
| *Adjective rating* | antara **Good** (≈73) dan **Excellent** (≈85) |
| Pembanding POS web sejenis | 78–87 → **konsisten** |

## 5. Pembahasan

Skor rata-rata SUS **80,4** menempatkan sistem pada kategori **Acceptable** dengan *grade* mendekati A, konsisten dengan POS web sejenis pada literatur (Altari 86,5; Buyut Semar 86,8; Yatai Tori 81,5; The King Coffee 78,5). Skor pemilik dan kasir cenderung lebih tinggi (77,5–90), sedangkan waiter sedikit lebih rendah (75–77,5) — wajar karena waiter merupakan pengguna yang paling baru beradaptasi terhadap input order via aplikasi (selaras temuan "masa adaptasi" pada pengukuran efisiensi RM-1). Keterbatasan jumlah responden (n = 6) dinyatakan; jumlah ini lazim pada skripsi POS sejenis (Altari = 5; Buyut Semar = 8).

---

*Disusun 2026-06-05. Jawaban ILUSTRATIF (ganti dengan pengisian riil). Skoring: `build-rqbc-sus.py`. Instrumen: `kuesioner-sus.md`.*
