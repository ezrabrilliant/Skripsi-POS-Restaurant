# Analisis Import Data Buku → Database (27 file, 1-27 Mei 2026)

Dokumen kerja untuk checkpoint sebelum insert. Disusun setelah baca semua 27 file.
**Belum ada yang di-insert** — nunggu keputusan Ezra atas item ambigu (sesuai protokol).

## Ringkasan volume
- 27 hari, ~95 transaksi total.
- Total pemasukan sebulan (jumlah semua summary): akan dihitung saat reconcile.

---

## 1. Metode pembayaran → normalisasi (CLEAR, tidak ambigu)

| Tulisan di buku | → Method | Bank |
|---|---|---|
| BCA Qris, BCA / Qris, Qris BCA, Qris (BCA), Qris | qris | BCA |
| Qris BM (8 Mei) | qris | BM ⚠️ |
| Cash, Kes (Cash), Cas (Cash) | cash | - |
| Debit BCA, Debit (BCA), KK BCA, Kartu BCA, BCA Debit, Debit | edc | BCA |
| TF MK | transfer | MK ⚠️ |
| Gojek | gojek | - |
| Grab | grab | - |

⚠️ **Bank MK & BM** — perlu konfirmasi nama asli (inisial bank/orang?). qris biasanya tidak butuh bank di sistem; "BCA/BM" di qris = provider QR, bisa diabaikan. Yang WAJIB punya bank: edc (BCA) + transfer (MK).

Seed sekarang punya 4 bank — perlu cek apakah MK & BM sudah ada / perlu ditambah.

---

## 2. Online delivery — DISCREPANCY dengan instruksi

Anda bilang: **gojek 1× + grab 1×** sebulan. Tapi buku ADA:
- **Gojek 1×**: 10 Mei #7 (1 Ekor B, 144k)
- **Grab 2×**: 4 Mei #3 (Pesanan Grab, 66k) + 20 Mei #1 (1 Ekor B "(Gojek)", 144k → tertulis method **Grab**)

Plus "ongkir/Gojek/delivery fee" yang NEMPEL di transaksi TF MK (bukan pembayaran platform, cuma ongkos kirim):
- 13 Mei #1: "2 EKOR G + Gojek 20.000" → TF MK 220k
- 26 Mei #3: "10 Paket B ... Gojek 16.000" → TF MK 416k
- 27 Mei #1: "Udang W ... ongkir 20.000" → TF MK 185k

**Keputusan #A**: Online delivery (gojek/grab) mau ikut buku apa adanya (gojek×1 + grab×2, supaya reconcile summary match), atau dipaksa jadi 1+1?

---

## 3. Baris TIDAK reconcile (item-sum ≠ nominal buku)

Per chain data: `Σ(harga item) = subtotal = total = payment` (PB1 off). Baris ini tidak nyambung dengan harga catalog:

| Tgl | Baris | Nominal | Masalah |
|---|---|---|---|
| 4 Mei | #1 "4 Ekor (BM/B), 14 Nasi, Susuk K" | 455.000 | 4 Ekor saja = 480k > 455k. 14 Nasi=140k bikin makin jauh. OCR "14 Nasi" salah? Ekor harga lain? |
| 13 Mei | #1 "2 EKOR G + Gojek 20.000 (Mami)" | 220.000 | 2 Ekor=240k ≠ 220k. (240−20 ongkir?) ambigu |
| 12 Mei | #3 "1 Paket B (Dada B) **Mentah**" | 48.000 | Paket B=40k. "Mentah" (mentah/raw) +8k? |

**Keputusan #B**: Untuk baris yang item-nya tidak menjumlah ke nominal buku — pilih kebijakan:
- (a) **Nominal buku = otoritas**. Items best-effort, selisih ditaruh item "Penyesuaian" supaya subtotal=total=nominal buku. Reconcile summary tetap match.
- (b) Saya tunjukkan tiap baris bermasalah satu-satu, Anda kasih breakdown benar.
- (c) Trust nominal buku sebagai subtotal, items diisi sebagian (subtotal bisa ≠ Σitem — tapi ini langgar integritas data, tidak disarankan).

---

## 4. Baris dibatalkan & item aneh (AMBIGU — perlu keputusan)

| Tgl | Baris | Catatan |
|---|---|---|
| 17 Mei | #6 "9 DADA B (**Dibatalkan/Dicoret**)" 270k | Dicoret TAPI **masuk** summary BCA Qris (1.095k include 270k). Void (status=void, summary tak match) atau keep paid (match summary)? |
| 21 Mei | #3 "**Inhaler**" 35k Cash | "Inhaler" bukan menu. Muncul juga 10 Mei (0 amount). Produk apa? Skip / map / tambah menu? |
| 10 Mei | #6 "1 Rempelo, 1 Ati, 2 Jeruk P, 1 Krupuk, **Inhaler**" 0 | Nominal 0 (gratis/staff meal?). Insert total=0 atau skip? |
| 14 Mei | #6 "Paha C" 30k | "Paha C" — Paha (Bakar?) 30k (harga cocok Paha). C=? |
| Stok | "PAHA C", "DADA C" (2,17,20 Mei) | Varian C di stok — OCR utk G? atau varian lain? |

---

## 5. Item belum ada di catalog (perlu DITAMBAH per keputusan Anda)

| Item buku | Harga di buku | Status |
|---|---|---|
| **Kerupuk** | 7.000 (2 Mei) DAN 15.000 (14,16 Mei) | 2 varian beda harga? "Krupuk B" vs "Krupuk C" di stok. Perlu nama+harga. |
| Susu Kedelai | 15.000 (14 Mei "Susu K") | ✅ SUDAH ADA (id 50). "Susuk"/"Susu K"/"Susuk K" → map ke sini. |
| **Semur Ayam** ("Semur A") | - (cuma di stok, tak pernah dijual) | Catalog cuma Semur Daging. Perlu nan utk stok import. |

**Keputusan #C**: Kerupuk — berapa varian + nama + harga? (mis. "Kerupuk" 7k + "Kerupuk Udang" 15k?)

---

## 6. Mapping singkatan → menu (CLEAR, tinggal konfirmasi)

`EKOR B`→1 Ekor Ayam Bakar Merah(120k) · `EKOR G`→1 Ekor Ayam Goreng(120k) · `PAHA B`→Paha Bakar(30k) · `PAHA G`→Paha Goreng(30k) · `DADA B`→Dada Bakar(30k) · `DADA G`→Dada Goreng(30k) · `Ati`→Ati Ayam(5k) · `Rempelo`→Rempelo Ayam(5k) · `Kepala`→Kepala Ayam(2.5k) · `Gasem A`→Garang Asem Ayam(30k) · `Gasem D`→Garang Asem Daging(30k) · `Rawon`→Rawon Daging(30k) · `Semur D`→Semur Daging(30k) · `Gulai/Gule D`→Gulai Daging(30k) · `Gulai/Gule B`→Gulai Babat(30k) · `Empal`→Empal Penyet(25k) · `Bakwan`→Bakwan Penyet(30k) · `Petai/Pete`→Petai Goreng(20k) · `Udang W`→Udang Windu Bakar(150k) · `Gurame/Ikan B`→Gurame Bakar(100k) · `Sarang B`→Sarang Burung(80k) · `AM`→Air Mineral(5k) · `Nasi`→Nasi Putih(10k) · `Sayur Asem`→Sayur Asem(15k) · `Tahu Tempe G`→Tahu Tempe Goreng(12k) · `Tahu G`→Tahu Goreng(10k) · `Telur Dadar`→Telur Dadar(10k) · `Sambal Tomat`→Sambal Tomat(5k) · `Jeruk N`→Jeruk Nipis(10k) · `Jeruk P`→Jeruk Peras(15k) · `Jeruk Murni`→Jeruk Murni(25k) · `Susuk/Susu K`→Susu Kedelai(15k)

**Teh** (suhu via notes REV 2.4): `TEH T`→Teh Tawar Biasa(8k) · `TEH T J`→Teh Tawar Jumbo(12k) · `TEH M`→Teh Manis Biasa(10k) · `TEH M J`→Teh Manis Jumbo(15k). Suffix `H`(Hangat)→notes "Panas".

**Paket**: `Paket A`→53(50k) · `Paket B`→54(40k) · `Paket C`→55(40k) · `Paket D`→56(40k) · `Paket K/Keluarga/Hemat`→52(150k). Isi kurung = subOptionsSelected (pilih ayam/kuah/minuman).

---

## 7. Stok harian (halaman kiri) — MASALAH SCHEMA

Anda minta import stok kiri. Tapi `PortionStock` cuma simpan **1 snapshot** (currentQty + openingQtyToday), bukan time-series per hari. Tidak ada tabel histori stok harian.

**Keputusan #D**: 
- (a) Tambah tabel baru `daily_stock_snapshot (date, menuId, qty)` khusus histori buku.
- (b) Skip stok harian — fokus transaksi+payment+reconciliation saja (yang utama Anda minta). Stok kiri cuma jadi konteks.
- (c) Set stok hari TERAKHIR (27 Mei) saja ke PortionStock.currentQty (live), 26 hari lain diabaikan.

Catatan: stok kiri juga punya item tak match catalog (Krupuk B/C, Susuk, Semur A, Ikan, PAHA C) + ground truth bilang "tidak ada opname pagi tercatat" → import stok harian agak konflik dengan desain.

---

## Keputusan yang dibutuhkan (ringkas)
- **#A** Online delivery: ikut buku (gojek1+grab2) atau paksa 1+1?
- **#B** Baris non-reconcile: nominal buku otoritas + item "Penyesuaian"? atau review satu-satu?
- **#C** Kerupuk: berapa varian + nama + harga?
- **#D** Stok harian: tabel baru / skip / hari terakhir saja?
- **#E** Bank MK & BM: nama asli?
- **#F** Baris dibatalkan 17 Mei #6: void atau keep paid?
- **#G** "Inhaler" (21 Mei 35k + 10 Mei 0): apa ini?
