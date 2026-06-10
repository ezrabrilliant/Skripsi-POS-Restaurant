# Alur Laporan Owner: Laba, COGS, PB1 & Tagihan — Ayam Bakar Banjar Monosuko

> Dokumentasi cara **laporan keuangan Owner** dihitung (pendapatan, modal/COGS,
> PB1 ditanggung, laba, tagihan). Untuk keperluan sidang skripsi. Fokus alur bisnis +
> contoh angka. Disusun dari pembacaan kode aktual (modul `dashboard`, `pb1`, `bills`).
> Pendamping [`PAYMENT_SETTLEMENT_FLOW.md`](PAYMENT_SETTLEMENT_FLOW.md).

---

## Rumus Inti Laba

```
   Laba Kotor = Pendapatan − COGS − PB1 ditanggung
                   │            │           │
                   │            │           └─ PB1 yang ditanggung resto (kalau modenya begitu)
                   │            └───────────── modal bahan per menu yang terjual
                   └────────────────────────── total uang masuk dari transaksi lunas

   Tagihan bulanan (listrik/air/sewa/…) → DITAMPILKAN TERPISAH, TIDAK dikurangkan.
```

Laporan ini bisa difilter per **periode** (hari ini / bulan ini / tahun ini / rentang
khusus), dan — seperti laporan lain — pendapatan diatribusikan berdasarkan **tanggal
shift** (*business day*), bukan jam pembayaran.

---

## Empat Kartu Utama di Dashboard Owner

| Kartu | Isi | Rumus |
|---|---|---|
| **Pendapatan** | Total uang masuk | Σ total transaksi **lunas** pada periode |
| **Beban Pokok (COGS)** | Modal bahan terjual | Σ (modal per menu × qty) |
| **Laba Kotor** | Untung kotor | Pendapatan − COGS − PB1 ditanggung |
| **Margin Laba** | Persentase untung | Laba Kotor ÷ Pendapatan |

Di kartu COGS ada catatan kecil: *"PB1 ditanggung Rp… · Tagihan Rp… (terpisah)"* —
mengingatkan owner bahwa tagihan **tidak** masuk hitungan laba kotor.

---

## 1. Pendapatan (Revenue)

- Jumlah **total** semua transaksi berstatus **LUNAS** pada periode itu.
- Hanya transaksi yang sah; pesanan yang **digabung (merge)** tidak dihitung dua kali.
- Juga dirinci **per metode pembayaran** (tunai/QRIS/EDC/…) dan **per bank** (EDC/transfer).

## 2. COGS (Modal / Harga Pokok per Menu)

**COGS = Σ (modal per menu × jumlah terjual)** atas semua item transaksi lunas.

Hal penting:
- **Modal diisi Owner** per menu (`Menu.cost`). Bersifat **rahasia** — tidak pernah
  ikut tampil di layar kasir atau data publik.
- Saat order terjadi, modal di-**potret (snapshot)** ke barisnya. Jadi kalau nanti
  Owner mengubah modal sebuah menu, **transaksi lama tetap memakai modal saat itu**
  (laporan historis tidak ikut berubah → akurat).
- Untuk **paket/varian**, modal dijumlahkan dari **tiap komponennya** (lihat
  [`MENU_FLOW.md`](MENU_FLOW.md) bagian "hitung modal/COGS").

> ⚠️ **Wajib diperhatikan:** kalau modal sebuah menu **belum diisi**, modalnya dihitung
> **0** → COGS jadi terlalu kecil → **Laba Kotor terlihat terlalu besar**. Maka tiap
> menu perlu diisi modalnya agar laba realistis.

## 3. PB1 Ditanggung (kalau PB1 mode "ditanggung resto")

PB1 (pajak restoran 10%) punya 2 mode (lihat [`PAYMENT_SETTLEMENT_FLOW.md`](PAYMENT_SETTLEMENT_FLOW.md)):

| Mode PB1 | Pengaruh ke laba |
|---|---|
| **Ditagih ke pelanggan** | PB1 dibayar pelanggan → **tidak** mengurangi laba resto (`pb1Borne = 0`) |
| **Ditanggung resto** (kondisi Monosuko) | PB1 menjadi **beban resto** → **dikurangkan** dari Laba Kotor |

Jadi saat PB1 ditanggung, laba yang ditampilkan sudah "bersih" dari PB1 — pelanggan
tetap bayar harga menu, tapi laba owner sudah memperhitungkan pajak yang ditanggung.

## 4. Tagihan Bulanan (Bills) — Terpisah

- Tagihan = biaya operasional bulanan: **kebersihan, listrik, air, parkir, sewa**
  (diinput Owner, owner-only).
- Di dashboard **ditampilkan terpisah**, **TIDAK** dikurangkan ke Laba Kotor.

**Kenapa dipisah?**

```
   Biaya PER-TRANSAKSI            Biaya OVERHEAD TETAP
   (nempel ke tiap penjualan)    (bulanan, tak terkait 1 penjualan)
   ┌─────────────────────┐       ┌─────────────────────┐
   │ • COGS (modal bahan)│       │ • Listrik, Air      │
   │ • PB1 ditanggung    │       │ • Sewa, Kebersihan  │
   └──────────┬──────────┘       │ • Parkir            │
              │                  └──────────┬──────────┘
              ▼                             ▼
   masuk hitungan LABA KOTOR      ditampilkan TERPISAH
   (Pendapatan − ini)             (owner kurangi sendiri untuk laba bersih)
```

Dengan dipisah, owner bisa membaca dua angka berbeda:
- **Laba Kotor** = hasil dari aktivitas jualan harian.
- **Laba Bersih** (dihitung owner) = Laba Kotor − Tagihan bulanan.

---

## Contoh Lengkap

```
   Misal SATU HARI:
   • Pendapatan (semua transaksi lunas)        = Rp 2.300.000
   • COGS (Σ modal menu terjual)               = Rp 1.150.000
   • PB1 ditanggung (Σ, mode ditanggung resto) = Rp   230.000
   ────────────────────────────────────────────────────────────
   Laba Kotor = 2.300.000 − 1.150.000 − 230.000 = Rp 920.000
   Margin     = 920.000 / 2.300.000             = 40%

   (Terpisah) Tagihan bulan ini: Rp 1.563.000
   → Owner hitung sendiri laba bersih bulanan:
     Σ Laba Kotor sebulan − Tagihan bulan itu
```

---

## Bagian Lain di Dashboard Owner (sekilas)

Selain ringkasan laba, dashboard owner juga menampilkan (analitik REV 2.13):
- **Pendapatan per metode & per bank** (untuk rekonsiliasi).
- **Performa menu** (menu terlaris / penyumbang omzet).
- **Tren** pendapatan antar waktu.
- **Per kasir** (kontribusi tiap shift/kasir).
- **Reminder stok** (menu di bawah stok minimum).

Semua ini **owner-only** — kasir & waiter tidak melihat laporan laba/modal.

---

## Ringkasan untuk Sidang

1. **Laba Kotor = Pendapatan − COGS − PB1 ditanggung.**
2. **COGS** = Σ(modal menu × qty), modal **rahasia owner**, di-**snapshot** saat order
   (akurat secara historis); **paket/varian** dijumlah per komponen.
3. **PB1 ditanggung** mengurangi laba **hanya** bila modenya "ditanggung resto"
   (kondisi Monosuko). Bila ditagih ke pelanggan, tidak mengurangi laba.
4. **Tagihan bulanan TERPISAH**, tidak dikurangkan ke Laba Kotor — karena overhead
   tetap, bukan biaya per-transaksi. Laba bersih = Laba Kotor − Tagihan (dihitung owner).
5. Kalau **modal menu belum diisi**, COGS = 0 → laba over-estimasi → modal wajib diisi.
6. Laporan ini **owner-only**.

---

*Perilaku sistem apa adanya (as-built) per Juni 2026. Detail entitas di
[`../DATA-DICTIONARY.md`](../DATA-DICTIONARY.md); aturan operasional di
[`../operasional-resto.md`](../operasional-resto.md).*
