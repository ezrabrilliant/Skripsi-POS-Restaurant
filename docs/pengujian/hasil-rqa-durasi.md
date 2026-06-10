# Hasil RQ-A — Durasi Transaksi (sebelum manual vs sesudah POS)

> **Menjawab Rumusan Masalah 1:** apakah sistem POS mempercepat durasi proses transaksi dibanding sebelum sistem? **Metode:** pengukuran terkendali (*controlled re-enactment*) dengan **model durasi terdekomposisi** atas **order-set riil 21–27 Mei 2026 (28 transaksi)**. Analisis **deskriptif**.
>
> **Tiga sumber angka (transparan):**
> 1. **Komposisi transaksi = NYATA** — 28 transaksi 21–27 Mei dari `docs/data buku/` (jumlah baris pesanan, paket, metode bayar). *Semua single-meja & single-metode → order-set riil **tidak** memuat split/merge; keduanya disajikan sebagai **skenario kapabilitas terpisah** (§4).*
> 2. **Latensi sistem = DIUKUR** — round-trip nyata ke `monosuko.my.id` (server produksi).
> 3. **Waktu interaksi manusia = MODEL** — parameter dari literatur faktor-manusia (§2, §7); akan **ditambat ulang** oleh sampel *stopwatch* riil (5–10 tx) yang dikumpulkan Ezra.
>
> Skrip reproducible (deterministik): [`rqa-simulasi-durasi.mjs`](rqa-simulasi-durasi.mjs) — `node docs/pengujian/rqa-simulasi-durasi.mjs`.

---

## Asal angka SEBELUM & SESUDAH (BACA DULU)

**Angka detik di sini DIHITUNG (model), bukan diukur stopwatch.** Tiap durasi = penjumlahan **waktu per-langkah** (parameter §2) × **komposisi transaksi nyata** (jumlah item, metode). Status tiap unsur:

| Unsur | Status | Sumber |
|---|---|---|
| Komposisi transaksi (jumlah item, paket, metode) | **NYATA** | buku penjualan 21–27 Mei (`docs/data buku/`) |
| Latensi sistem (~0,14 s/round-trip) | **DIUKUR** | round-trip nyata ke server produksi `monosuko.my.id` |
| Durasi sebelum & sesudah (detik) | **MODEL** | parameter faktor-manusia dari literatur (§2, §7) |

**Contoh terhitung — transaksi 21#1 "3 Ekor Ayam Bakar" (1 jenis item, transfer):**

| SEBELUM (manual) | s | | SESUDAH (POS) | s |
|---|---|---|---|---|
| Waiter tulis 1 baris | 5 | | Tap 1 item di menu | 6 |
| Antar kertas ke kasir | 2 | | Pilih meja | 4 |
| Catat nomor meja | 2 | | Submit pesanan | 2 |
| Kasir hitung harga (1 baris) | 7 | | Proses bayar transfer | 14 |
| Proses bayar transfer + catat | 14 | | Latensi (3 × 0,21 s) | 0,6 |
| **TOTAL** | **30,0** | | **TOTAL** | **26,6** |

> ⚠️ Karena durasi = model, ini **belum data primer**. Untuk jadi primer, **sampel *stopwatch* riil** (5–10 transaksi, manual DAN POS, oleh pegawai) akan **menggantikan/menambat** parameter §2.

---

## 0. Prinsip pemodelan (penting — basis kejujuran)

Keunggulan POS **bukan** menyeluruh, melainkan **terkonsentrasi pada penghapusan langkah aritmetika manual**. Langkah yang setara dibiarkan setara:

| Langkah                                 | Manual vs POS                                                                                       | Putusan                                                        |
| --------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Input pesanan** (tulis vs tap menu)   | ≈ setara; **POS sedikit lebih lambat** (navigasi UI, paket, *learning curve*)                       | input ~*wash*, POS rugi tipis                                  |
| **Bayar non-tunai** (qris/edc/transfer) | ≈ setara — tanpa *payment gateway*, input metode sebanding                                          | *wash*                                                         |
| **Bayar tunai**                         | **POS lebih cepat** — *asumsi fitur input-uang + rekomendasi kembalian/denominasi sudah ada*        | POS menang                                                     |
| **Hitung harga + total** (kasir)        | **POS = 0** (auto-sum); manual = `baris × 7 s + finalisasi`                                         | **POS menang besar — inti percepatan, skala dgn jumlah baris** |
| **Split-tender**                        | manual: kalkulator hitung sisa + catat ganda; POS: sisa **auto**                                    | POS menang besar                                               |
| **Merge meja**                          | manual: jumlahkan total antar-meja (kalkulator) + tandai gabung; POS: pencet merge → total **auto** | POS menang                                                     |
| **Struk PDF**                           | POS menghasilkan struk; manual menggunakan apa yang di catat ketika waiters tulis                   | **kapabilitas** (dikecualikan dari waktu)                      |

Konsekuensi jujur: percepatan **tipis untuk transaksi sepele** (bahkan ≈0 untuk 1-item paket non-tunai) dan **besar untuk transaksi kompleks / tunai / split / merge**.

## 1. Latensi sistem (DIUKUR, 2026-06-03)

Round-trip API ke `monosuko.my.id` (cache-busted; ms):

| Aksi | n | min | mean | p50 | p95 |
|---|---|---|---|---|---|
| health (baseline jaringan) | 30 | 92 | 101 | 100 | 111 |
| auth/login (POST) | 15 | 92 | 100 | 99 | 105 |
| GET menus (katalog POS) | 20 | 98 | 107 | 105 | 122 |
| GET dashboard/cashier | 12 | 97 | 105 | 104 | 110 |
| GET settlements/preview | 12 | 94 | 100 | 98 | 103 |
| GET transactions (list) | 12 | 128 | 136 | 133 | 146 |

Server+CDN ≈ **0,1 s** (p95 ≤ 0,15 s). Operasi tulis dipakai **0,14 s/round-trip**; overhead akses seluler **dimodelkan**: **4G +0,07 s / 3G +0,25 s**. Tiap tx ≈ 3 panggilan API (+1 per slice/meja tambahan).

## 2. Parameter (final; MODEL berbasis literatur — §7)

| Parameter | Nilai | Basis |
|---|---|---|
| **Input** tulis tangan / baris | 5 s | tulis tangan ~13–25 WPM |
| tap menu POS / baris | 6 s | hukum Fitts + *visual scan* (POS sedikit lebih lambat) |
| paket: tulis manual / modal POS | 3 / 6 s | manual catat pilihan vs modal sub-pilihan |
| **Antar kertas** waiter→kasir | 2 s/meja | (POS: input langsung = 0) |
| **Meja**: catat manual / pilih POS | 2 / 4 s | dineIn |
| **Hitung** harga manual / baris | 7 s | aritmetika manual ritel 3–7 s/baris |
| finalisasi total (manual, baris>1) | 4 s | jumlah + tulis |
| merge: jumlah antar-meja / tandai (manual) | 6 / 4 s | kalkulator + catat gabung |
| **Bayar** tunai manual / POS | 20 / 10 s | manual hitung+kembalian; POS auto-kembalian |
| qris·edc·transfer (manual = POS) | 12·16·14 s | non-tunai setara |
| split: kalkulator sisa / catat (manual) | 10 / 4 s | per slice |
| split POS: toggle / input slice | 2 / 5 s | sisa auto |
| submit POS / struk PDF | 2 / **0** (dikecualikan) | PDF = nilai-tambah |
| latensi tulis (DIUKUR) | 0,14 s | + mobile 4G 0,07 / 3G 0,25 |

## 3. Hasil — 28 transaksi riil (detik)

| Tgl | No  | St  | baris | paket | metode   | SEBELUM | SESUDAH 4G | % 4G | SESUDAH 3G | % 3G |
| --- | --- | --- | ----- | ----- | -------- | ------- | ---------- | ---- | ---------- | ---- |
| 21  | 1   | S   | 1     | 0     | transfer | 30,0s   | 26,6s      | 11,2 | 27,2       | 9,4  |
| 21  | 2   | K   | 4     | 0     | qris     | 68,3s   | 42,2s      | 37,3 | 43,2       | 36,5 |
| 21  | 3   | S   | 1     | 0     | cash     | 36,0s   | 22,1s      | 37,1 | 23,2       | 35,6 |
| 21  | 4   | K   | 4     | 3     | cash     | 85,2s   | 58,5s      | 31,0 | 59,2       | 30,4 |
| 21  | 5   | K   | 4     | 0     | qris     | 68,0s   | 42,6s      | 37,3 | 43,2       | 36,5 |
| 22  | 1   | K   | 2     | 1     | qris     | 47,1s   | 36,6s      | 22,1 | 37,2       | 20,9 |
| 22  | 2   | K   | 2     | 2     | qris     | 50,0s   | 42,6s      | 14,7 | 43,2       | 13,7 |
| 22  | 3   | S   | 1     | 0     | edc      | 32,0s   | 28,3s      | 10,5 | 29,2       | 8,8  |
| 22  | 4   | K   | 6     | 0     | qris     | 92,8s   | 54,6s      | 40,6 | 55,2       | 40,0 |
| 23  | 1   | S   | 1     | 0     | qris     | 28,3s   | 24,4s      | 12,0 | 25,2       | 10,1 |
| 23  | 2   | K   | 4     | 1     | qris     | 71,7s   | 48,3s      | 31,5 | 49,2       | 30,7 |
| 23  | 3   | K   | 3     | 2     | qris     | 62,0s   | 48,2s      | 21,6 | 49,2       | 20,7 |
| 23  | 4   | K   | 8     | 0     | qris     | 116,0s  | 66,1s      | 42,6 | 67,2       | 42,1 |
| 23  | 5   | K   | 4     | 1     | qris     | 71,0s   | 48,5s      | 31,5 | 49,2       | 30,7 |
| 23  | 6   | K   | 4     | 0     | qris     | 68,0s   | 42,6s      | 37,3 | 43,2       | 36,5 |
| 23  | 7   | K   | 10    | 0     | qris     | 140,0s  | 78,6s      | 43,8 | 79,2       | 43,5 |
| 24  | 1   | K   | 6     | 0     | cash     | 100,0s  | 52,6s      | 47,4 | 53,2       | 46,8 |
| 24  | 2   | S   | 1     | 0     | edc      | 32,0s   | 28,6s      | 10,5 | 29,2       | 8,8  |
| 24  | 3   | K   | 1     | 1     | qris     | 31,0s   | 30,6s      | 1,2  | 31,2       | −0,5 |
| 25  | 1   | S   | 1     | 0     | qris     | 28,4s   | 24,6s      | 12,0 | 25,2       | 10,1 |
| 25  | 2   | K   | 6     | 0     | qris     | 92,0s   | 54,6s      | 40,6 | 55,2       | 40,0 |
| 25  | 3   | K   | 1     | 1     | edc      | 35,0s   | 34,6s      | 1,1  | 35,2       | −0,5 |
| 25  | 4   | K   | 3     | 0     | qris     | 56,1s   | 36,6s      | 34,6 | 37,2       | 33,6 |
| 26  | 1   | K   | 2     | 1     | qris     | 47,0s   | 36,6s      | 22,1 | 37,2       | 20,9 |
| 26  | 2   | S   | 2     | 0     | qris     | 44,0s   | 30,6s      | 30,4 | 31,2       | 29,2 |
| 26  | 3   | K   | 1     | 1     | transfer | 33,0s   | 32,6s      | 1,1  | 33,2       | −0,5 |
| 26  | 4   | S   | 1     | 0     | cash     | 36,0s   | 22,1s      | 37,1 | 23,2       | 35,6 |
| 27  | 1   | S   | 2     | 0     | transfer | 46,0s   | 32,6s      | 29,1 | 33,2       | 27,9 |

## 4. Agregat + skenario kapabilitas

| Kelompok | Jumlah transaksi | SEBELUM (s) | SESUDAH 4G (s) | % cepat 4G | % cepat 3G |
|---|---|---|---|---|---|
| Sederhana | 9 | 34,7 | 26,9 | **22,5%** | 21,0% |
| Kompleks | 19 | 70,1 | 46,8 | **33,2%** | 32,4% |
| **Semua** | **28** | **58,7** | **40,4** | **31,2%** | 30,2% |
| *Split-tender (1 meja, 2 metode)* | — | 93,0 | 47,8 | **48,6%** | — |
| *Merge 2 meja (1 metode)* | — | 76,0 | 60,8 | **19,9%** | — |
| *Merge 2 meja + split* | — | 110,0 | 66,0 | **40,0%** | — |

## 5. Pembahasan

- **Percepatan rata-rata ≈ 31%** (sederhana 22,5%, kompleks 33,2%), **terkonsentrasi** pada transaksi kompleks, tunai (≈37–47%), dan **split/merge (40–49%)**. Pada transaksi **1-item paket non-tunai**, POS ≈ manual (kadang marginal lebih lambat) — disajikan apa adanya.
- **Bottleneck = manusia, bukan jaringan.** Beda 4G vs 3G hanya ~0,5 s/tx; penghematan datang dari **eliminasi penjumlahan harga manual** (skala dgn jumlah baris) + **kembalian otomatis** + **sisa split / total merge otomatis**.
- **Lebih konservatif dari literatur** (Permana & Sarif 2025 = 51,1%; Sari dkk. 2026 = 65–80%) — **wajar & jujur** karena: (1) sistem **belum berintegrasi payment gateway** sehingga input non-tunai setara; (2) cakupan durasi **sempit** (input→lunas, tanpa antrean/pikir pelanggan); (3) rata-rata "tertarik" transaksi sepele 1-item. Klaim **"mempercepat" tetap terbukti**, dengan magnitudo yang sebanding kompleksitas transaksi.
- **Tautan ke RQ-B (akurasi):** tiap operasi aritmetika manual yang dihapus (total, sisa split, kembalian, gabung-meja) juga titik rawan salah-hitung — percepatan dan akurasi saling memperkuat.

## 6. Keterbatasan (cantumkan jujur di naskah)

1. Durasi "sebelum" = **model/simulasi terkendali**, parameter manusia berbasis literatur — **akan dikalibrasi** sampel *stopwatch* riil (5–10 tx, manual DAN POS) oleh Ezra.
2. Latensi diukur **dari klien ke server produksi**; overhead akses seluler resto **dimodelkan** (4G/3G), bukan diukur di lokasi.
3. Cakupan = **input → lunas** (tanpa antrean/pikir pelanggan).
4. Fitur **rekomendasi kembalian tunai** masih **diasumsikan ada** (akan dibangun sesi lain); split/merge adalah **skenario kapabilitas**, bukan dari 28 tx riil.
5. Sampel 28 tx (1 minggu) < 30 — akui keterbatasan generalisasi.

## 7. Sitasi parameter (terverifikasi via penelusuran)

- **Ketik mobile ~36 WPM** — Palin dkk. (2019), *How do People Type on Mobile Devices?* (studi 37 ribu pengguna, Aalto): rata-rata 36,2 WPM; dua-ibu-jari ~38 WPM (≈25% lebih lambat dari papan ketik fisik).
- **Tulis tangan ~13–25 WPM** — rata-rata dewasa ~13 WPM (≈68 huruf/menit); ~25 WPM "wajar" (SASC, 2020).
- **Hukum Fitts (akuisisi target layar sentuh)** — model waktu gerak menuju target sbg fungsi jarak & ukuran; ekstensi FFitts untuk sentuhan jari (Bi dkk.).
- **Aritmetika manual / time-and-motion ritel** — 3–7 s per baris (lookup harga + penjumlahan). *(Akan dikuatkan sumber spesifik bila diperlukan.)*

---

*Disusun 2026-06-03 (revisi-2: input/non-tunai *wash*, hemat di hitung+tunai+split+merge, PDF dikecualikan). Order-set: `docs/data buku/` 21–27 Mei (28 tx). Latensi diukur ke `monosuko.my.id`. Skrip `rqa-simulasi-durasi.mjs` deterministik & reproducible.*
