# Review Anomali Data Buku (sebelum import dev + prod)

Disusun 30 Mei 2026 setelah: (1) validasi 27 doc vs `book-data.ts` (23/27 cocok),
(2) reconciliation sweep (Σ harga item × qty vs nominal yang ditagih).

**PENTING:** Nominal & ringkasan per-metode SUDAH BENAR (nominal buku = otoritas →
revenue, settlement, breakdown pembayaran semua akurat). Anomali di bawah hanya soal
**itemisasi** (rincian item tidak menjumlah ke nominal). Total transaksi tidak berubah.

## Keputusan terkonfirmasi (sudah diterapkan)
- `TF MK` → transfer/**BCA**. `Qris BM` → qris/**Mandiri**. Label lain: KK/Kartu/Debit BCA→edc·BCA; Kes/Cas→cash.
- gojek×1 (10 Mei) + grab×2 (4 & 20 Mei). 17 Mei baris dicoret → tetap paid. Inhaler (10 & 21 Mei) → skip.
- 21 Mei tx#2 = **385.000** (koreksi user, AI salah baca 305).
- Mapping stok: `Susuk/Susu K`→Susu Kedelai, `Sarang B`→Sarang Burung, `Ikan`→Gurame Bakar, `PAHA C`→**Paha Goreng** (salah baca), `Semur A`→**menu baru Semur Ayam**, `Krupuk B`→Kerupuk, `Krupuk C`→Kerupuk Udang.
- Reclass `portion` (ditrack stok harian): Petai Goreng, Sarang Burung, Susu Kedelai, Semur Ayam (baru), Kerupuk, Kerupuk Udang.

## Cara penanganan anomali itemisasi (usulan)
Tiap transaksi dibuat **konsisten** (Σ item ± diskon = total = nominal buku):
- **Σ item > nominal** → `discountAmount = selisih` (pelanggan dapat diskon; lazim utk borongan ekor).
- **Σ item < nominal** → tambah 1 baris **"Penyesuaian"** (atau "Ongkir"/"Online") = selisih, supaya Σ item = nominal.

Ini menjaga total tetap benar + data rapi, tanpa menebak itemisasi "benar". Pola umum:
- **Borongan ayam ekor**: kadang Rp100rb/ekor (diskon dari 120rb) — mis. 8/11/14 Mei. → diskon.
- **Online (gojek/grab)**: markup ~Rp24rb dari harga normal (10 & 20 Mei, 1 Ekor 120→144). → Penyesuaian "Online".
- **Ongkir nempel** di transfer (13/26/27 Mei): "Gojek/ongkir Rp16–20rb" masuk total. → baris "Ongkir".
- **Kerupuk +Rp8rb** (banyak hari): "Krupuk" kemungkinan Kerupuk Udang(15k) bukan Kerupuk(7k). → diskon/penyesuaian kecil.

---

## A. Anomali RUTIN (usul: auto-handle diskon/penyesuaian, tidak perlu klarifikasi satu-satu)

| Tgl | tx | Nominal | Σ item | Selisih | Raw | Handle |
|---|---|---|---|---|---|---|
| 2 Mei | 2 | 105.000 | 90.000 | +15.000 | PAKET A, PAKET B (Paha) | Penyesuaian +15k |
| 2 Mei | 4 | 115.000 | 107.000 | +8.000 | …1 Krupuk | Krupuk=15k? → +8k |
| 3 Mei | 1 | 185.000 | 172.000 | +13.000 | Paket Keluarga, Sayur Asem, Krupuk | Penyesuaian +13k |
| 4 Mei | 2 | 242.000 | 234.000 | +8.000 | Paket K… krupuk | +8k |
| 4 Mei | 3 | 66.000 | 55.000 | +11.000 | Grab (2 Jeruk Murni, 1 Rempelo) | Online +11k |
| 4 Mei | 4 | 242.000 | 249.000 | −7.000 | Paket K… Sarang B, krupuk | diskon 7k |
| 7 Mei | 2 | 552.000 | 554.000 | −2.000 | (besar, 10+ item) | diskon 2k |
| 7 Mei | 4 | 358.000 | 346.000 | +12.000 | (besar) | +12k |
| 7 Mei | 5 | 330.000 | 312.000 | +18.000 | 2 udang w, 1 tahu tempe | +18k |
| 7 Mei | 6 | 80.000 | 70.000 | +10.000 | 1 Paket C Gulai D (1 AM) | +10k |
| 7 Mei | 7 (#8 buku) | 500.000 | 600.000 | −100.000 | 5 ekor Ayam Goreng | diskon 100k (100rb/ekor) |
| 8 Mei | 1 | 177.000 | 160.000 | +17.000 | Paket K… 1 T G | +17k |
| 8 Mei | 2 | 400.000 | 480.000 | −80.000 | 4 EKOR BM (Yuxia) | diskon 80k (100rb/ekor) |
| 10 Mei | 1 | 188.000 | 190.000 | −2.000 | (besar) | diskon 2k |
| 10 Mei | 2 | 156.000 | 160.000 | −4.000 | 2 Paket D, 2 Paket C | diskon 4k |
| 10 Mei | 3 | 189.000 | 181.000 | +8.000 | …1 Krupuk | +8k |
| 10 Mei | 6 | 144.000 | 120.000 | +24.000 | 1 Ekor B (Gojek) | Online +24k |
| 10 Mei | 7 | 95.000 | 80.000 | +15.000 | 2 paket | +15k |
| 11 Mei | 1 | 200.000 | 240.000 | −40.000 | 2 EKOR BM (Yuxia) | diskon 40k (100rb/ekor) |
| 11 Mei | 2 | 200.000 | 240.000 | −40.000 | 2 EKOR B (Yeni) | diskon 40k |
| 12 Mei | 1 | 226.000 | 240.000 | −14.000 | (besar) | diskon 14k |
| 13 Mei | 1 | 220.000 | 240.000 | −20.000 | 2 EKOR G + Gojek 20rb | 100rb/ekor + ongkir 20k |
| 13 Mei | 2 | 118.000 | 120.000 | −2.000 | (besar) | diskon 2k |
| 14 Mei | 1 | 200.000 | 240.000 | −40.000 | 2 Ekor B | diskon 40k (100rb/ekor) |
| 15 Mei | 4 | 105.000 | 112.000 | −7.000 | Paket Hemat… Krupuk | diskon 7k |
| 17 Mei | 4 | 345.000 | 337.000 | +8.000 | …1 Krupuk | +8k |
| 17 Mei | 7 | 436.000 | 430.000 | +6.000 | …1 DADA C… | +6k |
| 18 Mei | 1 | 192.000 | 177.000 | +15.000 | …2 krupuk C | +15k |
| 19 Mei | 1 | 210.000 | 202.000 | +8.000 | …1 krupuk | +8k |
| 19 Mei | 4 | 100.000 | 95.000 | +5.000 | 2 paket… | +5k |
| 20 Mei | 1 | 144.000 | 120.000 | +24.000 | 1 EKOR B (Gojek/Grab) | Online +24k |
| 23 Mei | 2 | 190.000 | 182.000 | +8.000 | …1 Krupuk | +8k |
| 23 Mei | 7 | 240.000 | 224.000 | +16.000 | (besar, 2 Krupuk) | +16k |
| 24 Mei | 1 | 145.000 | 137.000 | +8.000 | …1 Krupuk | +8k |
| 25 Mei | 2 | 115.000 | 107.000 | +8.000 | …1 Krupuk | +8k |
| 26 Mei | 3 | 416.000 | 400.000 | +16.000 | 10 Paket B… Gojek 16rb | Ongkir +16k |
| 27 Mei | 1 | 185.000 | 180.000 | +5.000 | Udang W B… ongkir 20rb | Ongkir +5k |

## B. Anomali yang BUTUH KLARIFIKASI (selisih besar, tidak jelas polanya)

| # | Tgl | tx | Nominal | Σ item | Selisih | Raw | Pertanyaan |
|---|---|---|---|---|---|---|---|
| 1 | 4 Mei | 1 | 455.000 | 635.000 | −180.000 | **4 Ekor (BM/B), 14 Nasi, Susuk K** | "14 Nasi" salah baca? 4 ekor borongan 100rb=400 + brp nasi? |
| 2 | 9 Mei | 1 | 180.000 | 116.000 | +64.000 | 2 Paket A (1 Paha B, 2 Dada G), 2 es teh | Item kurang? Σ cuma 116 tapi tagih 180 |
| 3 | 9 Mei | 2 | 88.000 | 114.000 | −26.000 | 2 Krupuk, 1 Paket A, 1 Paket B, 1 Teh m | diskon 26k atau item salah? |
| 4 | 10 Mei | 5 | 165.000 | 80.000 | +85.000 | 2 Paket B (1 Paha B, Dada G) | Σ cuma 80 tapi tagih 165 — item kurang banyak |
| 5 | 15 Mei | 2 | 240.000 | 270.000 | −30.000 | 1 Ekor, 1 Semur, 1 Gasem, 1 Gule, 1 Rawon, 1 Paha B | diskon 30k? |
| 6 | 19 Mei | 2 | 167.000 | 207.000 | −40.000 | 1 Gurame, Sayur Asem, Nasi, 2 AM, Pete, Tahu Tempe, Paket D | diskon 40k? |
| 7 | 19 Mei | 3 | 121.000 | 83.000 | +38.000 | 1 Paket B (Dada G), 1 Empal P, 1 Teh M, 1 Teh T | item kurang? +38k |

> Untuk yang di Bagian B, beri koreksi (item benar / nominal benar / "anggap diskon"/"anggap penyesuaian"). Sisanya (Bagian A) saya tangani otomatis dengan aturan diskon/penyesuaian.
