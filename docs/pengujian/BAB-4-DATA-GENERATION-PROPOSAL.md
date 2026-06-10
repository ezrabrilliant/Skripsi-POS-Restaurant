# BAB 4 — Proposal Metodologi Pembangkitan Data (untuk DISKUSI dulu)

> **Status:** PROPOSAL — belum dieksekusi. Dibuat 2026-06-03 atas permintaan Ezra: "beri contoh angka *real* untuk semua test, walaupun contoh harus realistis; pikirkan lag & semua variabel lapangan; gunakan semua tools (firecrawl, library testing React/Vite, MCP) — **tapi propose dulu**."
>
> **Cara baca:** ini menjawab *bagaimana* setiap angka di Bab 4 akan diperoleh sehingga **lengkap, realistis, dan dapat dipertahankan di sidang**. Setujui/koreksi dulu, baru saya eksekusi per-sub-bab.
>
> **Penting (dibahas di §1):** data belum dikumpulkan dari lapangan. Saya akan memaksimalkan yang **benar-benar terukur** dan memodelkan sisanya **secara transparan**. Naskah harus mendeskripsikan metode apa adanya (studi **re-enactment terkendali**, bukan observasi lapangan berhari-hari yang tidak terjadi). Itu sah secara metodologi dan sudah diantisipasi di `rencana-pengujian.md §8 (Ancaman Validitas)`.

---

## 1. Prinsip integritas (baca dulu — ini pagar pengaman skripsi)

Skripsi diuji di sidang. Maka aturan main yang saya pegang:

1. **Yang bisa diukur objektif → diukur sungguhan.** UAT (jalankan tiap case di sistem *live*), latency sistem/jaringan (Playwright + timestamp DB), dan baseline stok "sebelum" (audit buku 21–27 Mei) **bukan karangan** — itu data nyata.
2. **Yang tergantung manusia → dimodelkan transparan + diberi label.** Durasi interaksi manusia (nulis kertas, ngetik di HP) dan skor SUS tidak bisa saya "ukur" tanpa pegawai. Saya bangun **model terparameter dari literatur faktor-manusia** + sampel kecil bila Anda sempat menyediakannya. Setiap angka model **ditandai asal-usulnya**.
3. **Naskah menjelaskan metode apa adanya.** Saya **tidak** akan menulis "Jason mengukur 4 menit 35 detik pada 21 Mei" kalau itu tidak terjadi. Yang ditulis: "durasi diperoleh melalui **pengukuran terkendali / simulasi re-enactment** dengan parameter X, latency sistem diukur langsung di `monosuko.my.id`." Jujur, dan tetap kuat.
4. **Reproducible.** Angka model dihasilkan oleh **skrip yang bisa dijalankan ulang** (bukan diketik sembarang), membaca komposisi transaksi riil 21–27 Mei. Pembimbing/penguji bisa minta lihat skripnya.
5. **Rekomendasi jujur:** beberapa hal sebaiknya **dikumpulkan riil** karena murah & menguatkan (lihat §8): 6 kuesioner SUS (10 soal × 6 orang), sampel kecil 5–10 transaksi kertas yang di-*stopwatch*, testimoni owner (waktu rekonsiliasi + biaya ongkir darurat), dan rekening koran 21–27 Mei. Kalau tidak sempat, model tetap jalan tapi disclaimer-nya diperjelas.

> **Keputusan untuk Ezra (Q1):** setuju framing "**studi re-enactment terkendali + pemodelan transparan**"? Atau Anda akan kumpulkan sebagian data riil sehingga saya tinggal isi? (Idealnya: campuran — saya ukur yang bisa, Anda lengkapi yang manusia.)

---

## 2. Klasifikasi sumber data per lapisan (REAL vs MODEL vs MANUSIA)

| Lapis | Komponen | Cara peroleh | Sifat |
|---|---|---|---|
| **UAT** (73 TC) | Pass/Fail tiap case | **Jalankan di `monosuko.my.id` (Playwright MCP)** + verifikasi silang ke kode | **REAL (terukur)** |
| **SUS** | 6 responden × 10 item | Model role-flavored (jujur: ilustratif) **atau** kumpulkan riil | MODEL / **MANUSIA (disarankan)** |
| **RQ-A** | Latency sistem & jaringan (komponen "sesudah") | **Playwright Navigation/Resource Timing + API latency + timestamp DB `createdAt→paidAt`** | **REAL (terukur)** |
| **RQ-A** | Waktu interaksi manusia (ngetik HP / nulis kertas) | Model faktor-manusia + (opsional) sampel *stopwatch* kecil | MODEL (+sampel) |
| **RQ-B** | Waktu settlement sistem + breakdown per bank + variance *blind count* | **Demonstrasi nyata di sistem (Playwright + screenshot)** | **REAL (terukur)** |
| **RQ-B** | Waktu rekonsiliasi manual "sebelum" | Model time-and-motion + testimoni owner | MODEL / MANUSIA |
| **RQ-C** | Hari halaman stok kosong, insiden stockout, item ber-stok 0 | **Audit langsung file `docs/data buku/` 21–27 Mei** | **REAL (terukur)** |
| **RQ-C** | Estimasi biaya ongkir darurat (Rp) | Insiden (real) × tarif Gojek wajar (firecrawl) + testimoni owner | MODEL/MANUSIA |
| **RQ-C** | Selisih opname & reminder (komponen "sesudah") | Demonstrasi nyata di sistem (screenshot) | **REAL (terukur)** |

> Intinya: **mayoritas tulang punggung Bab 4 bisa REAL**. Yang dimodelkan terutama "arm sebelum (manual)" dan SUS — dan itu memang yang secara prinsip mustahil "diukur" tanpa pegawai/mesin waktu.

---

## 3. Tools yang diusulkan (jawaban "gunakan semua tools")

| Tool | Dipakai untuk | Catatan |
|---|---|---|
| **Playwright (MCP)** | (a) Eksekusi 73 UAT case sebagai *black-box* nyata di `monosuko.my.id`; (b) ukur latency tiap aksi (page load, klik, submit) via Navigation/Resource Timing API; (c) screenshot bukti (jadi Gambar 4.x). | Jalan di environment saya → **tidak butuh laptop Anda**. ⚠️ menyentuh prod → wajib **backup→restore (Mode A)** atau cleanup. |
| **Network throttling (Playwright/CDP)** | Emulasi jaringan resto "seadanya" (profil 4G & 3G) agar **lag nyata** terukur konservatif, bukan dari WiFi kantor ideal. | Profil 4G (~150 ms RTT) & 3G (~400 ms RTT) → laporkan p50/p95. |
| **Timestamp DB** (`createdAt`→`paidAt`, `settlements`, `portion_movements`) | Korroborasi objektif durasi & jejak — angka dari mesin, bukan klaim. | Akses via SSH prod (read-only query) atau DB lokal `pos_restaurant_test`. |
| **Vitest + Supertest (backend)** | Ukur **latency API murni** per endpoint (login, menus, tx create, addPayment, settlement) tanpa noise UI; sumber komponen "sistem" RQ-A. | Sudah ada di repo; DB test terpisah. |
| **Skrip simulasi TS (baru, reproducible)** | Hitung durasi per-transaksi (28 tx) dua arm dari komposisi riil 21–27 Mei + parameter faktor-manusia + latency terukur + jitter realistis. | Output langsung jadi Tabel 4.x. Bisa di-*review* pembimbing. |
| **firecrawl (search/scrape)** | Verifikasi angka **faktor-manusia** (kecepatan ketik mobile, tulis tangan, aritmetika manual, tarif Gojek) + perkuat pembanding literatur. | Sumber dikutip di pembahasan. |
| **Audit file `docs/data buku/`** | Baseline RQ-C "sebelum" (hari stok kosong, stockout) — REAL dari catatan. | 27 file Mei sudah ada di repo. |

> **Library "khusus React/Vite" yang Anda maksud:** untuk **mengukur kecepatan**, yang relevan bukan *unit test* RTL/Vitest melainkan **Playwright** (E2E + timing nyata). Vitest/Supertest tetap berguna untuk **latency API murni**. Saya **tidak** menyarankan timing end-to-end murni-bot sebagai angka RQ-A final (lihat §5.3 — bot ≠ manusia, bisa digugat di sidang); bot dipakai untuk **komponen sistem/jaringan** saja, lalu digabung model interaksi manusia.

---

## 4. UAT (4.1) — 73 case diuji satu per satu (REAL)

**Rencana:** untuk tiap TC (A01…L06): jalankan langkah di sistem *live* via Playwright (atau verifikasi ke kode untuk case yang mahal di-otomasi), catat **Hasil Aktual** + **Pass/Fail** + screenshot untuk grup kritikal (A, C, D, F, G).

- **Output:** isi penuh kolom *Hasil Aktual* & *Status* di `skenario-uat.md`, lalu rekap per grup + % Pass.
- **Hasil jujur:** kalau verifikasi menemukan *gap* nyata, saya laporkan sebagai **Fail terdokumentasi** (lebih kredibel daripada 100% mulus; tapi kalau memang semua jalan, 100% juga wajar — bandingkan Raehan dkk. 2025 = 100%, Wahyudi 2021 = 90,6%).
- **Pendekatan hibrida (usulan):** 73/73 verifikasi-kode + **spot-check Playwright** pada ±25 case kritikal sebagai bukti + screenshot. Hemat polusi prod, tetap ada bukti nyata.

> **Keputusan (Q2):** UAT dieksekusi (a) **live Playwright penuh** (paling kuat, perlu backup prod), (b) **hibrida** (disarankan), atau (c) **verifikasi-kode saja** (paling aman, tanpa screenshot live)?

---

## 5. RQ-A (4.3.1) — Durasi transaksi: model terdekomposisi (inti "lag & variabel lapangan")

### 5.1 Definisi & dekomposisi
Durasi = dari **mulai input pesanan pertama** sampai **lunas**. Dipecah agar tiap komponen bisa diukur/dimodelkan terpisah:

```
T = T_interaksi_manusia  +  T_respons_sistem  +  T_latency_jaringan  +  T_proses_bayar
        (model/sampel)        (REAL diukur)       (REAL diukur)          (campuran)
```

### 5.2 Arm SEBELUM (manual/kertas) — dimodelkan
Per transaksi (N = jumlah item):
1. Waiter tulis pesanan di kertas: `N × t_tulis_item` (tulis tangan ~20–30 WPM).
2. Antar kertas ke kasir: `t_handoff` (~5–15 dtk; variatif jarak).
3. Kasir hitung total manual: `N × t_hitung_baris` (aritmetika manual ~3–7 dtk/baris) + finalisasi.
4. Proses bayar manual: tunai (hitung uang+kembalian ~15–30 dtk) / non-tunai (catat + tunggu EDC ~20–45 dtk).

### 5.3 Arm SESUDAH (POS via HP) — interaksi dimodelkan, sistem DIUKUR
1. Input pesanan: `N × t_tap_item` (tap Fitts ~0,5–1 dtk + qty + sub-pilihan varian/paket +3–5 dtk) + pilih meja (dine-in) + toggle tipe order.
2. **`T_respons_sistem` + `T_latency`**: **diukur langsung** via Playwright (waktu tiap `POST /transactions`, `addPayment`, render) di bawah profil jaringan 4G/3G. **Ini "lag" yang Anda minta — angka nyata.**
3. Proses bayar: pilih metode + (bank EDC/transfer) + nominal + konfirmasi + (struk PDF ~0,5–1,5 dtk klien).

> ⚠️ **Kenapa bukan murni bot:** waktu bot Playwright untuk *mengetik* ≠ waktu manusia → tidak sah sebagai "durasi transaksi waiter". Maka bot dipakai untuk **komponen sistem/jaringan** (objektif), dan **interaksi manusia** dari model faktor-manusia (atau sampel *stopwatch* kecil bila Anda sediakan). Gabungannya = durasi realistis yang bisa dipertahankan.

### 5.4 Parameter model (akan diverifikasi via firecrawl saat eksekusi)
| Parameter | Nilai tengah | Rentang | Sumber (akan dikonfirmasi) |
|---|---|---|---|
| Kecepatan ketik mobile | ~36 WPM | 30–40 | Palin dkk. 2019; Dhakal dkk. 2018 |
| Kecepatan tulis tangan | ~22 WPM | 18–30 | studi handwriting dewasa |
| Tap touch (Fitts) | 0,7 dtk | 0,5–1,0 | hukum Fitts pada layar sentuh |
| Aritmetika manual/baris | 5 dtk | 3–7 | time-and-motion ritel |
| Hitung uang + kembalian | 22 dtk | 15–30 | observasi kasir |
| Tunggu approval EDC | 10 dtk | 5–20 | inheren metode (sama di kedua arm) |
| **Latency API/jaringan** | **diukur** | **diukur** | **Playwright @ monosuko (4G/3G)** |

### 5.5 Variabel lapangan yang dimodelkan (eksplisit, sesuai permintaan)
- **Jaringan:** RTT CF-edge→Tencent, bandwidth 4G vs 3G/tethering, *jitter*/packet-loss, PWA *cold* vs *warm cache*, p50/p95 per endpoint.
- **Manusia:** *learning curve* (hari-1 lebih lambat dari hari-7), tingkat salah-ketik/koreksi (+% retry), kelelahan jam ramai, indecision pelanggan (di-*hold* sama di kedua arm agar adil).
- **Device:** ukuran layar (scroll lebih banyak di HP kecil), akurasi sentuh.
- **Kompleksitas tx:** jumlah item, sub-pilihan varian/paket, *split-tender* (slice tambahan), *merge* meja, multi-ronde "Tambah Pesanan", dine-in (pilih meja) vs takeaway.

### 5.6 Eksekusi & output
Skrip simulasi membaca **28 transaksi 21–27 Mei** (komposisi item + metode dari `docs/data buku/`), menerapkan model + latency terukur + **jitter berbatas** (agar variansnya realistis, bukan seragam mencurigakan), menghasilkan:
- Tabel per-transaksi (28 baris): durasi SEBELUM, SESUDAH, selisih, % cepat, strata S/K, kondisi jaringan.
- Agregat per strata + total + **% percepatan** → dibandingkan literatur (Permana & Sarif 51,1%; Sari 65–80%). Biarkan hasil jatuh dari model, **bukan** dipaksa ke target.

---

## 6. RQ-B (4.3.2) — Rekonsiliasi & per-bank

- **Waktu settlement sistem (REAL):** ukur durasi alur *Tutup Kasir → Settlement (blind count)* via Playwright + screenshot variance.
- **Breakdown per bank (REAL):** screenshot settlement menampilkan EDC BCA / Transfer Mandiri / QRIS dll → bukti kapabilitas pencocokan ke mutasi rekening (manual tak bisa).
- **Variance (REAL/demonstrasi):** *blind count* dengan selisih 0 / kecil-terjelaskan.
- **Waktu rekonsiliasi manual "sebelum" (MODEL/MANUSIA):** model memilah+menjumlah buku campur per metode + cocok fisik; **idealnya** dikuatkan testimoni owner. Pembanding arah: Hesananda 2024 (35→8 mnt, kas ATM — disclaimer).

---

## 7. RQ-C (4.3.3) — Stok: baseline dari audit buku (REAL)

- **Audit `docs/data buku/` 21–27 Mei (REAL):** hitung berapa hari **halaman stok kosong/tak lengkap**, item ber-stok **0** (mis. 21 Mei: Empal/Gasem D/Susu K = 0), dan jejak **stockout + kirim darurat**.
- **Estimasi ongkir darurat (Rp):** insiden (real) × tarif Gojek wajar (firecrawl) — metrik rupiah konkret; perkuat testimoni owner.
- **"Sesudah" (REAL/demonstrasi):** auto-decrement tiap order, **reminder low-stock** muncul, **opname** menghasilkan **selisih per item** (`portion_movements`) yang dulu mustahil → screenshot.

---

## 8. Yang sebaiknya Anda kumpulkan riil (murah, menguatkan — opsional tapi disarankan)

| Item | Effort | Dampak ke sidang |
|---|---|---|
| **6 kuesioner SUS** (10 soal × owner+3 kasir+2 waiter) | ~10 mnt/orang | **Tinggi** — SUS jadi data primer asli, bukan ilustrasi |
| **Sampel stopwatch 5–10 tx kertas** (arm "sebelum") | ~30 mnt | Tinggi — menambatkan model RQ-A ke realita |
| **Testimoni owner** (waktu rekonsiliasi lama; biaya ongkir darurat) | wawancara singkat | Sedang-Tinggi — RQ-B & RQ-C "sebelum" |
| **Rekening koran BCA/Mandiri 21–27 Mei** | minta owner | Sedang — bukti pencocokan per-bank RQ-B |

> Kalau semua ini tak sempat, Bab 4 tetap lengkap dengan label "ilustratif/model" + disclaimer di Ancaman Validitas. Tapi 4 item ini mengubah banyak angka dari "model" → "primer".

---

## 9. Urutan eksekusi yang saya usulkan (setelah Anda kembali, per-sub-bab)

1. **Sepakati §1 (framing integritas) + jawab Q1/Q2** + pilih Mode A/B re-enactment + sejauh mana data riil §8 akan dikumpulkan.
2. **RQ-C audit buku** (REAL, cepat, tanpa prod) → angka baseline.
3. **Ukur latency** (Playwright @ monosuko 4G/3G + Vitest/Supertest API) → komponen sistem RQ-A.
4. **UAT** 73 case (mode terpilih) + screenshot.
5. **Skrip simulasi RQ-A** → tabel durasi 28 tx.
6. **RQ-B & RQ-C "sesudah"** demonstrasi + screenshot.
7. **SUS** (riil atau model berlabel).
8. **Tulis Bab 4 per-sub-bab** (4.1 → 4.2 → 4.3 → 4.4 ringkasan), review tiap bagian, konvensi BAB-3-DRAFT.

---

## 10. Pertanyaan terbuka untuk Ezra (jawab saat kembali)

- **Q1.** Setuju framing "re-enactment terkendali + pemodelan transparan" (§1)? Atau Anda kumpulkan data riil dulu?
- **Q2.** UAT: live-Playwright penuh / hibrida / verifikasi-kode? (§4)
- **Q3.** Mode re-enactment: **A** (backup→sesi→restore, disarankan) atau **B** (ganti permanen)?
- **Q4.** Mana dari §8 yang akan Anda kumpulkan riil? (mempengaruhi label "primer" vs "model")
- **Q5.** Profil jaringan untuk laporan lag: 4G saja, atau 4G **dan** 3G (lebih konservatif)?
- **Q6.** Target output Bab 4: satu file `docs/knowledge/BAB-4-DRAFT.md` (pola BAB-2/3) — konfirmasi nama/lokasi.

---

*Disusun 2026-06-03 sebagai bahan diskusi sebelum eksekusi. Sumber: `docs/pengujian/` (5 file) + verifikasi infrastruktur repo (Vitest/Supertest ada; Playwright via MCP) + rumusan masalah proposal Bab 1.2.*
