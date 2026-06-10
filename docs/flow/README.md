# Peta Dokumen Alur Sistem POS — Ayam Bakar Banjar Monosuko

Kumpulan dokumentasi **alur bisnis** sistem POS, disusun untuk keperluan **sidang
skripsi**. Semua dokumen ditulis dengan bahasa sederhana, fokus pada *cara kerja*
(bukan detail teknis), dan **diverifikasi langsung dari kode** (bukan asumsi) —
menggambarkan perilaku sistem apa adanya (*as-built*) per Juni 2026.

---

## Daftar Dokumen

| # | Dokumen | Isi singkat |
|---|---|---|
| 1 | [**TRANSACTION_FLOW.md**](TRANSACTION_FLOW.md) | Alur transaksi penuh: buka kasir → input order → bayar → tutup kasir. Termasuk kasus **lintas hari** (order kemarin dibayar hari ini) & **bayar lewat Riwayat**. |
| 2 | [**SHIFT_FLOW.md**](SHIFT_FLOW.md) | Daur hidup **shift kasir**: buka → aktif → tutup → settlement. Aturan jam kerja, shift basi/overdue, serah-terima. |
| 3 | [**PAYMENT_SETTLEMENT_FLOW.md**](PAYMENT_SETTLEMENT_FLOW.md) | Sisi **uang** mendalam: split-tender, metode pembayaran, **PB1 2-sumbu**, lalu **rekap setoran (settlement)** — Total Sistem vs Aktual → Selisih. |
| 4 | [**OWNER_REPORT_FLOW.md**](OWNER_REPORT_FLOW.md) | **Laporan keuangan Owner**: Laba Kotor = Pendapatan − COGS − PB1 ditanggung; **tagihan terpisah**; modal/COGS rahasia & di-snapshot. |
| 5 | [**MENU_FLOW.md**](MENU_FLOW.md) | Struktur **menu**: Simple, **Varian**, **Paket**. SKU stok tersembunyi, *fan-out* satu pesanan → potong stok + modal + upcharge. |
| 6 | [**STOCK_OPNAME_FLOW.md**](STOCK_OPNAME_FLOW.md) | **Stok porsi & opname**: 4 operasi stok, alur opname (selisih fisik vs sistem), buku audit. |

---

## Urutan Baca yang Disarankan

```
   1. TRANSACTION_FLOW   ← mulai di sini (alur inti end-to-end)
          │
          ├──▶ 2. SHIFT_FLOW             (wadah akuntansi tempat transaksi masuk)
          │
          ├──▶ 3. PAYMENT_SETTLEMENT     (perdalam sisi uang + rekap)
          │         │
          │         └──▶ 4. OWNER_REPORT (laba: pendapatan − COGS − PB1; tagihan terpisah)
          │
          └──▶ 5. MENU_FLOW             (apa yang dipesan + potong stok)
                      │
                      └──▶ 6. STOCK_OPNAME   (pergerakan & koreksi stok)
```

- **Untuk memahami alur transaksi inti:** baca #1, lalu #2.
- **Untuk bab keuangan/akuntansi:** baca #3, lalu #4 (laporan & laba owner).
- **Untuk bab katalog & inventori:** baca #5, lalu #6.

---

## Tiga Konsep yang Mengikat Semua Dokumen

1. **Tiga "siapa" terpisah** — *pencatat order*, *pemilik shift*, *pemroses bayar* —
   bisa orang berbeda, dicatat masing-masing. (lihat TRANSACTION_FLOW)
2. **Uang mengikuti Shift, bukan orang.** Laporan pendapatan dihitung per **tanggal
   shift** (*business day*), bukan jam pembayaran. (lihat SHIFT_FLOW & PAYMENT_SETTLEMENT)
3. **Satu pilihan kasir → banyak efek otomatis.** Memilih satu paket/varian otomatis
   memotong stok yang tepat, menghitung modal, dan menyusun harga. (lihat MENU_FLOW)

---

## Rujukan Terkait (di luar folder ini)

- [`../DATA-DICTIONARY.md`](../DATA-DICTIONARY.md) — kamus data lengkap (semua entitas & kolom).
- [`../operasional-resto.md`](../operasional-resto.md) — ground truth aturan bisnis operasional resto.
- [`../knowledge/`](../knowledge/) — dokumen analisis (ERD, Use Case, Activity Diagram, draf naskah).

---

*Catatan: dokumen-dokumen ini bersifat naratif untuk pemahaman & presentasi. Bila ada
perbedaan antara dokumen dan kode, **kode adalah sumber kebenaran** — dokumen ini sudah
diselaraskan dengan kode per Juni 2026.*
