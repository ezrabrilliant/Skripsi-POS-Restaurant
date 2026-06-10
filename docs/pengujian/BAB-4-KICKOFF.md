# BAB 4 — Pengujian Sistem · SESSION KICKOFF / HANDOFF

> **Tujuan dokumen:** entry-point untuk sesi baru yang menulis **Bab 4 (Pengujian Sistem)** skripsi POS Restoran Ayam Bakar Banjar Monosuko (C14220315). Rangkum semua keputusan + materi testing yang sudah dibahas, supaya tidak mengulang diskusi. **Baca ini dulu**, lalu file detail di `docs/pengujian/`.

---

## ⭐ STATUS EKSEKUSI (per 2026-06-04) — sebagian besar SUDAH dikerjakan

| Item | Status | Output |
|---|---|---|
| Deploy + logo fix | ✅ | commit main `efb0bd9`; prod `monosuko.my.id` versi terkini |
| **Lapis 1 — UAT (73 TC)** | ✅ **73/73 Pass** | `hasil-uat-prod.md` + 10 screenshot `screenshots/`. API prod (Mode A backup→uji→**restore**, zero polusi) + UI mobile Playwright |
| **Lapis 3 — RQ-A (durasi)** | ✅ | `hasil-rqa-durasi.md` + skrip `rqa-simulasi-durasi.mjs` + **Excel `RQ-A-komparasi-waktu.xlsx`** (4 sheet, gaya contoh thesis) |
| **Lapis 3 — RQ-C (stok)** | ✅ audit buku | `hasil-rqc-stok.md` (Empal 0 di 6/7 hari, Gasem D 0 di 5/7, 27 Mei 2 item tak tercatat) |
| **Bab 4 draft** | ✅ | `docs/knowledge/BAB-4-DRAFT.md` (4.1 UAT · 4.2 SUS · 4.3 RQ-1/2/3 · 4.4 ringkasan) |
| Lapis 2 — SUS | ⏳ instrumen siap | Ezra kumpulkan 6 responden riil → isi tabel `kuesioner-sus.md` |
| RQ-B (rekonsiliasi) | ⏳ sebagian | settlement+per-bank kapabilitas siap; waktu manual + rekening koran = testimoni owner |
| Kalibrasi RQ-A | ⏳ | sampel *stopwatch* riil (manual & POS) → tambat parameter model |

**Keputusan kunci yang sudah diambil:** Mode A (backup→restore) DIPAKAI · UAT = API prod + verifikasi kode + screenshot (bukan klik bot — bot≠human) · RQ-A pakai **model jujur & NETRAL** (input/non-tunai *wash*; hemat di hitung/tunai/split/merge; PDF dikecualikan; `NOVICE_FACTOR=1,5` untuk membandingkan POS-mahir & POS-awam) · angka durasi = MODEL (komposisi nyata + latensi diukur + interaksi literatur), akan dikalibrasi stopwatch riil.

---

## 0. BACA DULU (urutan)

1. **`docs/pengujian/rencana-pengujian.md`** — dokumen induk: kerangka 3 lapis + protokol per RQ + lembar instrumen + template tabel hasil.
2. **`docs/pengujian/skenario-uat.md`** — 73 test case UAT (12 grup, EP+BVA + negatif + permission).
3. **`docs/pengujian/kuesioner-sus.md`** — 10 item SUS (Sharfina & Santoso 2016) + skoring + interpretasi.
4. **`docs/pengujian/runbook-reenactment.md`** — prosedur teknis ambil data "sesudah" (backup→sesi→restore).
5. **`docs/pengujian/referensi-pengujian-terdahulu.md`** — 17 referensi terverifikasi + angka wajar + sitasi APA.
6. Memory `project_pengujian_uat_sus` + `feedback_natural_language_no_forced_indo`.

> **Pedoman Bab 4** (`docs/Pedoman_SIB_extracted.txt`): "membuktikan sistem memenuhi kebutuhan proses bisnis & informasi; Test case scenario, UAT, SUS dll; **tidak berisi user manual**."

---

## 1. INTI: kerangka 3 lapis (kenapa UAT+SUS saja TIDAK cukup)

Rumusan masalah (Bab 1.2) semuanya **kuantitatif-komparatif** ("mempercepat", "menurunkan mismatch"). **UAT membuktikan fitur jalan; SUS membuktikan mudah dipakai — keduanya TIDAK mengukur "lebih cepat / lebih sedikit mismatch".** Maka Bab 4 = **3 lapis**:

| Lapis | Metode | Menjawab |
|---|---|---|
| 1 | **UAT** (black-box, EP+BVA, ISO/IEC 29119) | "sistem memenuhi kebutuhan fungsional" |
| 2 | **SUS** (10 item, skor 0–100) | "kemudahan penggunaan" |
| 3 | **Pengukuran komparatif (sebelum vs sesudah)** | **RQ-A, RQ-B, RQ-C** |

> Bab 2.5 (metodologi) **harus** menyebut lapis-3 juga, bukan cuma UAT+SUS — agar Bab 4 selaras metodologi.

---

## 2. STRUKTUR Bab 4 yang disarankan (pola Pedoman + peer Satriya)

Satriya: tiap pengujian = **pengujian → hasil → pembahasan**. Untuk Ezra (tanpa algoritma):

- **4.1 Pengujian Fungsional (UAT)** → 4.1.1 Skenario & pelaksanaan · 4.1.2 Hasil (rekap Pass/Fail + % keberhasilan) · 4.1.3 Pembahasan.
- **4.2 Pengujian Usability (SUS)** → 4.2.1 Instrumen & responden · 4.2.2 Hasil (skor per responden + rata-rata + grade) · 4.2.3 Pembahasan.
- **4.3 Pengujian Efisiensi & Akurasi (sebelum vs sesudah)** → menjawab RQ-A/B/C:
  - 4.3.1 RQ-A Durasi transaksi · 4.3.2 RQ-B Rekonsiliasi · 4.3.3 RQ-C Stok.
- **(opsional) 4.4 Ringkasan pemenuhan rumusan masalah** (tabel RQ → bukti → kesimpulan), menjembatani ke Bab 5.

Analisis = **deskriptif** (rata-rata, %, jumlah kejadian; bukan uji inferensial — kecuali pembimbing minta, lalu pakai Wilcoxon/Mann-Whitney sbg cadangan).

---

## 3. JAWABAN per RUMUSAN MASALAH (metrik + sumber + caveat jujur)

**Urutan kekuatan bukti: RQ-A (angka detik) > RQ-C (ada metrik biaya) > RQ-B (kecepatan + kapabilitas).**

### RQ-A — Durasi transaksi (paling kuat)
- **Metrik:** durasi rata-rata per transaksi (detik), dari mulai input pesanan sampai lunas.
- **Sebelum (manual):** sesi **simulasi terkontrol** — waiter tulis kertas + kasir hitung manual, di-stopwatch.
- **Sesudah (sistem):** re-enact pesanan **21–27 Mei** lewat POS **di `monosuko.my.id`** (sengaja, agar **delay jaringan nyata** ikut terukur). **Diukur MANUSIA (kasir/waiter), bukan bot Playwright** — bot time ≠ human time (akan gugur di sidang). Korroborasi dengan timestamp DB `createdAt`→`paidAt`.
- **Stratifikasi:** sederhana (1 item, cash) vs kompleks (multi-item/paket/split-tender). **Sampel ±28 tx** (21–27 Mei); akui keterbatasan bila <30 (literatur 50–60).
- **Model penyajian:** ala Permana & Sarif (tabel + % percepatan).

### RQ-B — Rekonsiliasi & mismatch (jujurkan: tumpu kecepatan + per-bank)
- ⚠️ **Pencatatan buku resto BENAR** (yang keliru cuma OCR saat transkrip). **JANGAN pakai "+Rp35.000 Inhaler 21 Mei" sebagai bukti mismatch kas** — itu artefak OCR, bukan kesalahan resto. Tidak ada angka mismatch kas historis.
- **Jawaban utama (terukur):** **waktu rekonsiliasi** manual (pisah & jumlahkan cash/EDC/QRIS dari buku campur + cocokkan fisik) vs sistem (settlement otomatis + blind-count). Ukur waktunya.
- **"Menurunkan mismatch" = framing kapabilitas:** sistem kasih **breakdown per bank** (EDC BCA, Transfer Mandiri, dll) → owner bisa cocokkan ke **rekening koran**; manual mencampur semua → mismatch tak terdeteksi. Demonstrasi trial: variance settlement = 0/kecil-terjelaskan + total per-bank = mutasi rekening.
- **Sumber "sebelum":** **wawancara/testimoni owner** (sulit & lamanya pencocokan). Bukti pembanding lemah: Hesananda 2024 (35→8 menit, konteks **kas ATM** — disclaimer).
- **Bonus konkret:** minta **rekening koran BCA/Mandiri 21–27 Mei** dari owner → cocokkan dengan total per-bank settlement re-enactment (selisih nol = bukti "after").

### RQ-C — Stok (kuat, ada metrik rupiah)
- **Masalah manual yang asli (dari owner):** waiter sering **lupa catat opname → halaman kiri buku (stok) kosong → stok tak terpantau → stockout → kirim darurat via Gojek dari rumah → biaya ongkir** naik.
- **Metrik "sebelum" (audit buku + testimoni):** (1) jumlah hari halaman stok kosong/tak lengkap; (2) insiden stockout & kirim darurat; (3) **estimasi total ongkir darurat (Rp)** — metrik rupiah konkret.
- **Metrik "sesudah" (sistem):** stok **selalu tercatat** (auto-decrement + opname) + **reminder low-stock** mencegah stockout + opname menghasilkan **angka selisih per item** yang dulu mustahil.
- **Klaim valid:** manual = stok tak terpantau → stockout + biaya darurat; sistem = terpantau real-time + selisih terukur + stockout dicegah. **Bukan** "selisih stok turun X%" (manual tak punya angka selisih).

---

## 4. ANGKA REFERENSI (terverifikasi — untuk pembanding di pembahasan)

| Aspek | Angka wajar (literatur terbukti) |
|---|---|
| Durasi transaksi manual→sistem | **~2–4½ menit → ~20 dtk–2¼ menit; cepat 51–80%** (Permana & Sarif 2025: 51,1%; Sari dkk. 2026: ±65–80%; Ardiansyah dkk. 2023: POS signifikan lebih cepat, Mann-Whitney sig. 0,000) |
| Skor SUS POS sejenis | **78–87** (Altari 86,5; Buyut Semar 86,8; Yatai Tori 81,5; The King Coffee 78,5) |
| UAT pass rate | **≥90%** (Wahyudi 2021: 90,6%; Raehan dkk. 2025: 100%) |
| Rekonsiliasi (analogi, TIPIS) | 35→8 menit (Hesananda 2024, **kas ATM** — disclaimer konteks) |

⚠️ **Jebakan kutip:** (1) angka RM. Ikan Bagor 44,65/16,35 = **mean rank** statistik, BUKAN detik; (2) angka QRIS Pinandito (8–35 dtk) = **statis vs dinamis** level pembayaran, BUKAN manual vs sistem — jangan dicampur. Detail + sitasi APA di `referensi-pengujian-terdahulu.md`.

---

## 5. PENGAMBILAN DATA (yang harus disiapkan SEBELUM nulis hasil)

- **Peserta:** Owner + 3 kasir (Jason/Bryant/Chen Hong) + 2 waiter (Amel/Yanti), n≈6. **Waiter kini pengguna POS penuh** (input order langsung, kertas dihapus) → ikut UAT + SUS.
- **Order-set:** transaksi riil **21–27 Mei** (7 hari, ±28 tx) dari `docs/data buku/data_buku_2{1..7}_mei_2026.md`.
- **Mode re-enactment (pilih):**
  - **Mode A (disarankan):** backup prod → sesi terukur di monosuko → **restore backup**. Latency nyata, prod tak terpolusi.
  - **Mode B:** reset 21–27 Mei (SQL bertarget, bukan `import-book-data.ts --reset` yang hapus 1–s/d) → input ulang via POS → simpan.
- ⚠️ **`import-book-data.ts` = RAW insert** (tak jalankan decrement/PB1/settlement/timing) → **tidak dipakai** untuk arm "sesudah"; arm sesudah HARUS lewat POS.
- **Kumpulkan:** rekening koran BCA/Mandiri 21–27 Mei (RQ-B), surat kesediaan/consent pegawai, foto/screenshot sesi (lampiran).
- **Backup wajib:** `mysqldump ... > /home/ubuntu/backups/prod-pre-reenact-<ts>.sql` sebelum apa pun (detail SSH di memory `project-deployment-server`).

---

## 6. KONVENSI PENULISAN (sudah disepakati Ezra — JANGAN langgar)

- **Bahasa natural, jangan paksa terjemahan Indo** istilah teknis. Pakai Inggris-italic: *real-time* (BUKAN "waktu nyata"), *snapshot*, *split-tender*, *blind count*, *over/short*, *swimlane*. Istilah bisnis tetap Indo (pesanan, tagihan, stok, kasir). Lihat memory `feedback_natural_language_no_forced_indo`.
- **Ringkas ala peer Satriya** — penjelasan jangan bertele-tele; 1 paragraf/sub-bagian cukup, tabel hasil yang bicara.
- **Hindari jargon DB** di prosa naskah (mis. "junction", "opsi pembentuk") — pakai bahasa awam.
- **Struktur flat** (ikut peer), penomoran konsisten. Caption gambar di bawah, caption tabel di atas (UK Petra). Tiap gambar/tabel WAJIB dirujuk di kalimat.
- **Diskusi dulu sebelum ubah** — Ezra suka bahas konsep sampai sepakat, baru file diedit. Jangan langsung edit saat masih diskusi.
- **Verifikasi klaim ke kode** sebelum menulis (jangan bawa klaim stale dari skripsi lama — mis. void TIDAK simpan alasan & TIDAK ada otorisasi/PIN; split = split-tender bukan split-bill; PB1 owner-configurable default OFF).

---

## 7. PENDING / KEPUTUSAN

- [x] ~~Pilih Mode A vs B~~ → **Mode A dipakai** (backup→uji→restore di prod).
- [x] ~~Jalankan UAT + RQ-A~~ → **DONE** (`hasil-uat-prod.md`, `hasil-rqa-durasi.md`, Excel).
- [x] ~~Draft Bab 4~~ → **DONE** (`docs/knowledge/BAB-4-DRAFT.md`).
- [ ] **Kumpulkan 6 kuesioner SUS riil** (owner+3 kasir+2 waiter) → isi tabel 4.2.2 di draft.
- [ ] **Sampel stopwatch riil** (5–10 tx, manual & POS) → kalibrasi parameter RQ-A.
- [ ] **Testimoni owner** (waktu rekonsiliasi manual + biaya ongkir restock darurat) → isi 4.3.2 & 4.3.3.
- [ ] **Rekening koran BCA/Mandiri 21–27 Mei** → bukti pencocokan per-bank RQ-B.
- [ ] Tambah 1 kalimat di **Bab 2.6** bahwa pengujian mencakup pengukuran efisiensi/akurasi (selaras lapis-3).
- [ ] Renumber Gambar/Tabel + finalisasi prosa thesis-level (review Ezra).
- [ ] (Opsional) uji inferensial bila pembimbing minta.

---

## 8. RINGKAS 1 KALIMAT untuk prompt sesi baru

> "Tulis Bab 4 (Pengujian Sistem) skripsi POS dari materi di `docs/pengujian/` (baca `BAB-4-KICKOFF.md` dulu): 3 lapis (UAT 73 test case + SUS 10-item + pengukuran komparatif sebelum-sesudah untuk RQ-A/B/C), struktur pengujian→hasil→pembahasan ala peer Satriya, analisis deskriptif, bahasa natural (real-time bukan 'waktu nyata'), dan jujur pada batasan data (buku resto benar → RQ-B tumpu kecepatan+per-bank; RQ-C pakai metrik stockout+ongkir)."

---

*Disusun 2026-06-03 sebagai handoff sesi Bab 4. Sumber lengkap: `docs/pengujian/` (5 file) + memory `project_pengujian_uat_sus`.*
