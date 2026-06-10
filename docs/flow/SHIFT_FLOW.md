# Alur Shift Kasir Sistem POS — Ayam Bakar Banjar Monosuko

> Dokumentasi daur hidup (lifecycle) shift kasir untuk keperluan sidang skripsi.
> Fokus pada **alur**, bukan detail teknis. Disusun dari pembacaan kode aktual
> (modul `shifts`, `settlements`, dan skema basis data).
> Pendamping dokumen [`TRANSACTION_FLOW.md`](TRANSACTION_FLOW.md).

---

## Apa itu "Shift" dan kenapa ada?

**Shift** = satu sesi kerja kasir dengan **laci uang sendiri**. Setiap transaksi
menempel ke sebuah shift, sehingga di akhir hari bisa dipertanggungjawabkan:
*"uang yang masuk hari ini sebanyak sekian, dipegang kasir siapa, cocok atau tidak
dengan uang fisik di laci."*

Tanpa shift yang terbuka, **tidak ada** transaksi yang bisa masuk ke sistem. Shift
adalah "wadah akuntansi" untuk semua penjualan.

Restoran memakai **2 jenis shift**: **Pagi** dan **Malam**.

---

## Lifecycle Shift (State Lifecycle)

```
                    buka kasir            tutup kasir
   ┌──────────┐    (modal awal +     ┌──────────┐   (tidak ada     ┌──────────┐
   │  BELUM   │    pilih pagi/malam) │          │    order open)   │          │
   │   ADA    │───────────────────▶ │   OPEN   │────────────────▶ │  CLOSED  │
   │  SHIFT   │                      │ (aktif)  │                  │          │
   └──────────┘                      └──────────┘                  └──────────┘
                                          │                             │
                                   transaksi masuk               rekap setoran
                                   ke shift ini                  (SETTLEMENT)
                                                                 per hari bisnis
```

- **OPEN (aktif):** menerima transaksi. **Hanya boleh ada 1 shift OPEN** di seluruh
  sistem pada satu waktu.
- **CLOSED:** ditutup, tidak menerima transaksi baru lagi.
- **SETTLEMENT:** rekap setoran akhir hari (dijelaskan di bawah). Bukan status shift,
  melainkan langkah akuntansi setelah shift-shift hari itu ditutup.

---

## Tahap 1 — Buka Kasir (Open Shift)

| Aspek | Aturan |
|---|---|
| **Siapa** | Kasir (Owner juga boleh). Waiter **tidak** boleh. |
| **Input** | **Modal awal** (uang di laci saat mulai) + pilih jenis: **Pagi** / **Malam**. |
| **Hasil** | Shift berstatus **OPEN** dan menjadi satu-satunya shift aktif. |

Saat buka, sistem memeriksa **dua syarat**:

1. **Hanya 1 shift aktif** — kalau masih ada shift lain yang OPEN, ditolak dengan
   pesan *"Masih ada shift … yang open — tutup dulu"*. (Dijamin di tingkat basis data,
   jadi mustahil ada 2 shift aktif bersamaan.)
2. **Masih di jam operasional** — jenis shift yang dipilih harus cocok dengan jam saat
   itu (lihat tabel di bawah).

### Aturan jam buka shift

```
   00:00        07:00            18:00            23:00
     │  (mulai pagi) │ (pergantian)   │  (akhir malam) │
     ├──────── SHIFT PAGI boleh dibuka ───────┤ (sebelum 18:00)
     │                            ├─ SHIFT MALAM boleh dibuka ─┤ (18:00–23:00)
```

- **Shift Pagi:** boleh dibuka kapan saja **sebelum** jam pergantian (default 18:00).
- **Shift Malam:** boleh dibuka **mulai** jam pergantian sampai akhir malam. Boleh
  lebih awal **hanya jika** shift pagi sudah dibuka (kasus serah-terima sore).

> Jam (`07:00 / 18:00 / 23:00`) dan zona waktu adalah **setelan yang bisa diubah
> Owner**, bukan angka mati di kode.

---

## Tahap 2 — Shift Aktif (menerima transaksi)

- Semua order yang masuk **menempel ke shift yang sedang aktif**.
- **Pendapatan sebuah transaksi mengikuti shift-nya**, bukan mengikuti orang yang
  menginput atau menagih (detail di [`TRANSACTION_FLOW.md`](TRANSACTION_FLOW.md)).
- Order baru **ditolak** kalau shift aktif ternyata sudah "basi" (sudah masuk hari
  baru tapi belum ditutup — lihat Kasus Khusus).

---

## Tahap 3 — Tutup Kasir (Close Shift)

Sistem punya **dua mode** tutup:

| Mode | Kapan dipakai | Siapa | Cek pesanan open? |
|---|---|---|---|
| **Final** | Tutup definitif (selesai sesi/hari) | Kasir pemilik shift atau Owner | **Ya** — diblokir kalau masih ada order belum dibayar |
| **Handover** | Serah-terima kasir tanpa rekap (mis. pagi → malam) | Kasir berikutnya | Tidak |

### Mode Final — blokir bila ada pesanan belum dibayar
Saat tutup final, sistem menghitung pesanan yang masih *open*. Kalau ada, tutup
**ditolak** dan menampilkan **daftar meja** yang masih punya pesanan belum dibayar.

```
   Tutup Kasir (final)
        │
        ▼
   Ada order open?  ──Ya──▶  TOLAK + tampilkan daftar meja
        │                    ("Meja 3: Tx #450", dst.)
        No                          │
        ▼                           ▼
   Shift CLOSED          Bayar / Batalkan dulu lewat Riwayat,
                         baru bisa tutup. (lihat TRANSACTION_FLOW Bagian 4)
```

> **Pengecualian akuntabilitas:** biasanya hanya kasir pemilik shift atau owner yang
> boleh menutup. Tapi kalau shift sudah **basi** (ditinggalkan lewat hari), **kasir
> mana pun** yang masuk pagi boleh menutupnya — supaya hari baru bisa dimulai tanpa
> menunggu pemilik shift kemarin hadir.

---

## Tahap 4 — Settlement (Rekap Setoran Akhir Hari)

Setelah shift-shift hari itu ditutup, dilakukan **settlement**: mencocokkan **uang
fisik** dengan **catatan sistem**.

### Konsep penting: settlement itu **per hari bisnis**, bukan per shift
Walau dalam sehari bisa ada 2 shift (pagi + malam), **settlement-nya satu untuk
seluruh hari** (gabungan semua shift hari itu). Sistem menjamin **hanya satu
settlement per tanggal**.

| Aspek | Aturan |
|---|---|
| **Siapa** | **Kasir penutup shift terakhir** hari itu, atau **Owner**. |
| **Prasyarat** | Shift penutup hari itu sudah ditutup. |
| **Modal awal (float)** | Jumlah modal awal **semua** shift hari itu — ditampilkan sebagai acuan, **tidak** ikut dihitung selisih. |

### Cara kerja: Blind Count → Variance
1. Sistem sudah tahu **Total Sistem** per metode (dari semua transaksi LUNAS hari itu).
2. Kasir menghitung **uang fisik** dan memasukkan **jumlah aktual** per metode —
   idealnya tanpa mengintip angka sistem dulu (*blind count*).
3. Sistem menghitung **Selisih (variance) = Aktual − Sistem** per metode.

```
  Contoh rekap satu hari:
  ┌─────────────┬──────────────┬──────────────┬──────────────┐
  │ Metode      │ Total Sistem │ Hitung Aktual│ Selisih      │
  ├─────────────┼──────────────┼──────────────┼──────────────┤
  │ Tunai       │  Rp 1.200.000│  Rp 1.195.000│ −Rp 5.000    │ ← kurang Rp5rb
  │ QRIS        │  Rp   650.000│  Rp   650.000│  Rp 0        │ ← cocok
  │ EDC (BCA)   │  Rp   300.000│  Rp   300.000│  Rp 0        │
  └─────────────┴──────────────┴──────────────┴──────────────┘
   Modal awal hari ini: Rp 500.000 (acuan, tidak masuk selisih)
```

- **Tunai** dicek dengan menghitung uang di laci.
- **Non-tunai** (QRIS/EDC/transfer) dicek dengan mutasi bank — sistem menyediakan
  **rincian per bank** untuk memudahkan.

### Status settlement: Submitted → Reviewed
- Kasir **submit** rekap → status **Submitted**.
- **Owner me-review** → status **Reviewed** (verifikasi akhir). Owner melihat selisih
  dan mengesahkan.

```
   Kasir submit          Owner review
   ───────────▶ SUBMITTED ───────────▶ REVIEWED
```

---

## Kasus Khusus

### A. Shift Basi / Overdue (ditinggalkan lewat hari)
- Shift yang dibiarkan OPEN melewati hari bisnisnya ditandai **overdue**.
- Penandaan muncul **setelah** masuk hari baru **dan** sudah lewat jam buka pagi.
  Lembur tengah malam (sebelum jam buka pagi) **tidak** dianggap basi — kasir masih
  bisa menuntaskan tagihan tadi malam dengan tenang.
- Saat ada shift overdue, layar Kasir **terkunci**: kasir harus menuntaskan pesanan
  yang belum dibayar (lewat Riwayat), menutup shift kemarin, baru bisa mulai hari baru.

### B. Serah-Terima (Handover) Pagi → Malam
- Sore hari, kasir pagi bisa **serah-terima** ke kasir malam tanpa rekap penuh.
  Mode *handover* tidak memicu blokir pesanan open. Rekap setoran tetap dilakukan
  **sekali di akhir hari** untuk seluruh shift.

### C. Hari Bisnis Lewat Tengah Malam
- Kalau Owner menyetel shift malam **melewati tengah malam** (mis. akhir malam 01:00),
  transaksi dini hari (00:00–01:00) tetap dihitung **hari sebelumnya** — "satu malam
  operasional = satu hari bisnis".

---

## Hubungan Shift dengan Transaksi & Laporan

```
        ┌──────────────────────────────────────────────────┐
        │                   SATU HARI BISNIS               │
        │                                                  │
        │   Shift Pagi (Jason)        Shift Malam (Bryant) │
        │   ┌──────────────┐          ┌──────────────┐     │
        │   │ Tx, Tx, Tx…  │          │ Tx, Tx, Tx…  │     │
        │   └──────┬───────┘          └──────┬───────┘     │
        │          └────────────┬────────────┘             │
        │                       ▼                          │
        │              SETTLEMENT (1 untuk hari itu,        │
        │              oleh kasir penutup = Bryant)         │
        └──────────────────────────────────────────────────┘
                                │
                                ▼
                    LAPORAN OWNER (omzet per hari)
            dihitung berdasarkan TANGGAL SHIFT, bukan jam bayar
```

- Semua transaksi dari shift-shift dalam satu hari → masuk ke **laporan hari itu**.
- Laporan pendapatan diatribusikan berdasarkan **tanggal shift** (*business day*),
  bukan jam dinding pembayaran — sehingga order yang baru dibayar besok pagi tetap
  masuk omzet hari ini (selama dibayar saat shift hari ini masih terbuka).

---

## Ringkasan untuk Sidang

1. **Shift = wadah akuntansi** satu sesi kasir. Tanpa shift aktif, tidak ada transaksi.
2. **Daur hidup:** Buka Kasir → Aktif (terima transaksi) → Tutup Kasir → Settlement.
3. **Hanya 1 shift aktif** pada satu waktu (dijamin basis data) → tidak ada ambiguitas
   "uang masuk ke laci siapa".
4. **Buka shift** divalidasi terhadap **jam operasional** (Pagi sebelum pergantian,
   Malam setelah pergantian) yang **bisa diatur Owner**.
5. **Tutup shift final diblokir** kalau masih ada pesanan belum dibayar → memaksa
   semua tagihan beres dulu.
6. **Settlement per hari bisnis** (bukan per shift): kasir penutup terakhir/owner
   melakukan **blind count**, sistem menghitung **selisih (aktual − sistem)** per
   metode; **modal awal** jadi acuan tapi tidak masuk selisih. Lalu **Owner review**.
7. **Kasus shift basi** ditangani aman: layar kasir terkunci sampai shift kemarin
   dituntaskan & ditutup, agar laporan tiap hari tetap rapi.

---

*Dokumen ini menjelaskan perilaku sistem apa adanya (as-built) per Juni 2026.
Untuk alur transaksi & pembayaran lihat [`TRANSACTION_FLOW.md`](TRANSACTION_FLOW.md);
entitas basis data lengkap di [`../DATA-DICTIONARY.md`](../DATA-DICTIONARY.md);
aturan bisnis operasional di [`../operasional-resto.md`](../operasional-resto.md).*
