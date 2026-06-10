# Runbook Re-enactment & Pengukuran (Lapisan 3)

> **Prosedur teknis** untuk mengumpulkan data **"sesudah sistem"** (RQ-A/B/C) dengan me-re-enact pesanan riil **21–27 Mei** lewat POS live `monosuko.my.id` (agar **delay jaringan nyata** ikut terukur). Lihat [rencana-pengujian.md](rencana-pengujian.md) §6.
>
> **Prinsip:** arm "sesudah" **harus lewat UI/POS** (bukan skrip import) supaya mekanisme nyata berjalan: auto-decrement stok, PB1, validasi bayar, settlement, dan **timestamp** transaksi. Skrip `import-book-data.ts` hanya RAW-insert (tidak menjalankan mekanisme) → **tidak dipakai** untuk "sesudah".

---

## 0. Keputusan mode (pilih dulu)

| Mode | Cara | Konsekuensi |
|---|---|---|
| **A — Non-destruktif (DISARANKAN)** | Backup prod → jalankan sesi terukur → **restore backup** setelah selesai | Latency nyata terukur; prod **kembali bersih** (revenue/dashboard tidak terpolusi data uji); paling aman |
| **B — Ganti permanen** | Backup prod → hapus data 21–27 Mei (SQL bertarget) → input ulang via POS → **disimpan** | 21–27 Mei jadi data sistem-native permanen; perlu hapus presisi (lihat ⚠️) |

> ⚠️ **Jangan pakai `import-book-data.ts --reset` untuk Mode B.** Flag itu menghapus **seluruh** tanggal 1 s/d `--until` (bukan hanya 21–27). Reset presisi 21–27 harus via SQL bertarget (phpMyAdmin / tunnel) — atau cukup pakai **Mode A** (restore) yang lebih aman.

Default rekomendasi: **Mode A.** Latency tetap nyata karena tetap lewat server live; bedanya cuma di akhir kita kembalikan ke kondisi semula.

---

## 1. Prasyarat

- [ ] Akun per peran siap (Owner / Kasir / Waiter — kredensial di memory deployment).
- [ ] Device HP/tablet + akses `https://monosuko.my.id`; catat **kondisi jaringan** (tethering/seluler).
- [ ] **Stopwatch** + [lembar pengukuran waktu](rencana-pengujian.md) (§6.2/6.3/6.4).
- [ ] **Order-set 21–27 Mei** sebagai "kartu pesanan": ekstrak dari `docs/data buku/data_buku_21..27_mei_2026.md` (deskripsi pesanan + nominal + metode + bank). ±28 transaksi.
- [ ] **Rekening koran BCA/Mandiri 21–27 Mei** dari owner (untuk pencocokan RQ-B).
- [ ] Akses SSH server (key + pattern di memory `project-deployment-server`).

---

## 2. Backup prod (WAJIB, sebelum apa pun)

Via SSH (pola: `ssh.exe -i <key> ubuntu@43.163.89.187 "<cmd>"`). Dump DB ke folder backup standar:

```bash
mysqldump -u monosuko -p'<password monosuko — lihat .env server / memory>' \
  pos_restaurant > /home/ubuntu/backups/prod-pre-reenact-$(date +%Y%m%d-%H%M%S).sql
```

- [ ] Verifikasi file backup terbentuk & ukurannya wajar (`ls -lh /home/ubuntu/backups/`).
- [ ] (Opsional, Mode A) catat baseline cepat: `tx count`, `settlement count`, agar bisa dicek balik setelah restore.

> Jangan tulis password plaintext ke dokumen yang di-commit. Ambil dari `.env` server atau memory deployment saat eksekusi.

---

## 3. RQ-A — Sesi Pengukuran Durasi Transaksi

Untuk **setiap** pesanan dalam order-set (atau sampel ≈30), ukur **dua arm** dengan pesanan identik:

**Arm SEBELUM (manual — tidak menyentuh sistem):**
1. Mulai stopwatch.
2. Waiter menulis pesanan di kertas → serahkan → kasir menghitung total manual (kalkulator/tangan).
3. Stop saat total siap. Catat **durasi SEBELUM (dtk)**.

**Arm SESUDAH (sistem — lewat POS live):**
1. Mulai stopwatch.
2. Waiter input pesanan langsung di HP (POS) → kasir proses pembayaran (metode + bank sesuai buku).
3. Stop saat transaksi lunas. Catat **durasi SESUDAH (dtk)** + **kondisi jaringan**.
4. Korroborasi: timestamp `createdAt`→`paidAt` transaksi (bisa diekspor dari Riwayat/DB).

- Tandai tiap pesanan **Strata** Sederhana (S) / Kompleks (K).
- Isi [Lembar Pengukuran Waktu](rencana-pengujian.md) §6.2.
- **Prasyarat teknis:** sebuah **shift harus terbuka** agar bisa input order — buka shift uji dulu (Kasir → Buka Kasir, modal awal bebas).

---

## 4. RQ-B — Sesi Rekonsiliasi & Pencocokan per Bank

Cukup demonstrasikan pada **1 hari representatif** (mis. hari paling ramai) — tidak perlu 7 hari, karena settlement unik per business-day.

1. Pastikan seluruh pesanan hari itu sudah diinput & dibayar (dari langkah 3).
2. **Ukur waktu rekonsiliasi:**
   - SEBELUM: stopwatch saat kasir memilah & menjumlahkan cash/EDC/QRIS dari "buku campur" lalu cocokkan fisik (simulasi alur lama).
   - SESUDAH: stopwatch saat menyelesaikan **Tutup Kasir → Settlement (blind count)** di sistem.
3. **Blind count:** input jumlah fisik tanpa lihat total sistem → submit → sistem tampilkan **selisih per metode (over/short)**. Catat.
4. **Pencocokan per bank (inti RQ-B):** ambil **breakdown per bank** dari settlement (EDC BCA, Transfer Mandiri, QRIS, dll) → bandingkan dengan **mutasi rekening koran 21–27 Mei** milik owner. Catat: cocok / selisih.
5. Isi [Lembar Log Rekonsiliasi](rencana-pengujian.md) §6.3.

> Klaim yang dihasilkan: (i) waktu rekonsiliasi sebelum vs sesudah; (ii) sistem **bisa** mencocokkan per bank ke mutasi rekening (manual tidak bisa).

---

## 5. RQ-C — Sesi Stok & Opname

1. **Set kondisi awal stok** sesuai halaman stok buku hari itu (via Restock pagi / opname awal) — supaya titik mulai realistis.
2. **Input pesanan** (langkah 3) → amati **auto-decrement** stok porsi tiap order.
3. Pancing **reminder low-stock**: pastikan ada item yang menyentuh ≤ minimum → cek reminder muncul di dashboard.
4. (Bila relevan) demonstrasikan order item stok 0 → tersimpan, stok negatif, tercatat di riwayat.
5. **Opname "Cek Fisik & Koreksi":** input qty fisik berbeda dari sistem → sistem hitung **selisih per item** + audit log. Catat angka selisih (ini yang **mustahil** di manual).
6. **Baseline SEBELUM** (dari audit buku, bukan sesi ini): hitung **hari halaman stok kosong**, **insiden stockout & kirim darurat**, **estimasi ongkir darurat (Rp)**.
7. Isi [Lembar Log Stok](rencana-pengujian.md) §6.4.

---

## 6. Kumpulkan Bukti

- [ ] Screenshot: hasil settlement (variance + breakdown per bank), hasil opname (selisih), reminder low-stock, layar struk PDF.
- [ ] Ekspor/print Riwayat transaksi sesi (untuk timestamp RQ-A).
- [ ] Foto sesi (lampiran skripsi).
- [ ] Lembar pengukuran terisi (§6.2/6.3/6.4) → siap diolah jadi tabel hasil (§7 rencana).

---

## 7. Penutup

**Mode A (restore):**
```bash
mysql -u monosuko -p'<password>' pos_restaurant < /home/ubuntu/backups/prod-pre-reenact-<timestamp>.sql
```
- [ ] Verifikasi `tx count` / `settlement count` kembali = baseline langkah 2.
- [ ] Smoke: `GET https://monosuko.my.id/` 200, login Owner OK, dashboard kembali normal.

**Mode B (keep):**
- [ ] Tidak restore. Pastikan settlement & dashboard 21–27 Mei (kini system-native) tampil benar.
- [ ] Catat bahwa data 21–27 Mei prod sekarang hasil re-enactment (bukan transkrip buku).

---

## Lampiran — Catatan teknis

- **Shift/business-day:** input order butuh shift terbuka. Re-enactment banyak "hari" dalam satu hari kalender → settlement unik per tanggal (`@@unique([date])`), jadi untuk RQ-B cukup 1 hari representatif. Di lembar pengukuran, **petakan tiap transaksi sesi ke hari-buku asalnya** (tanggal internal sistem = tanggal sesi, tidak masalah untuk metrik proses).
- **Kenapa bukan skrip import untuk "sesudah":** `import-book-data.ts` RAW-insert (tak jalankan decrement/PB1/settlement/timing) → hanya cocok untuk seed baseline "sebelum", bukan untuk membuktikan mekanisme sistem.
- **Latency nyata:** seluruh arm "sesudah" lewat `monosuko.my.id` (CF-proxied, server Tencent) → delay jaringan resto ikut terukur. Catat kondisi jaringan tiap sesi.
- **Keamanan:** jangan commit password DB ke repo; ambil dari `.env` server saat eksekusi.

---

*Instrumen untuk skripsi POS Restoran Ayam Bakar Banjar Monosuko (C14220315).*
