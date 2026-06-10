# Alur Pembayaran & Settlement (Mendalam) — Ayam Bakar Banjar Monosuko

> Dokumentasi mendalam sisi **uang**: dari pembayaran satu transaksi sampai rekap
> setoran akhir hari. Untuk keperluan sidang skripsi. Fokus alur bisnis + contoh angka.
> Disusun dari pembacaan kode aktual (modul `transactions`, `settlements`, `pb1`).
> Pendamping [`TRANSACTION_FLOW.md`](TRANSACTION_FLOW.md) & [`SHIFT_FLOW.md`](SHIFT_FLOW.md).

---

## Gambaran Besar: Perjalanan Uang

```
   Pesanan (OPEN)
        │  kasir proses bayar (1 atau beberapa slice)
        ▼
   PEMBAYARAN ──▶ status LUNAS (PAID), uang menempel ke SHIFT aktif
        │
        │  (sepanjang hari: banyak transaksi LUNAS)
        ▼
   SETTLEMENT (akhir hari): jumlahkan semua pembayaran per metode  → "Total Sistem"
        │  kasir hitung uang fisik                                  → "Hitung Aktual"
        ▼
   SELISIH (Variance) per metode ──▶ Owner REVIEW (sahkan)
```

Bagian 1 menjelaskan **pembayaran satu transaksi**. Bagian 2 menjelaskan **rekap
seluruh transaksi hari itu (settlement)**.

---

# BAGIAN 1 — PEMBAYARAN

## 1.1 Konsep: Satu Tagihan, Bisa Banyak "Slice"

Satu transaksi punya satu **total tagihan**, tapi bisa dibayar lewat **beberapa
potongan pembayaran (slice)**. Transaksi dianggap **LUNAS** ketika jumlah semua slice
**sama dengan** total tagihan.

- **1 slice** = pembayaran tunggal (mis. bayar tunai penuh).
- **Banyak slice** = *split-tender* (mis. sebagian tunai, sebagian QRIS).

## 1.2 Metode Pembayaran (diatur Owner)

Daftar metode **bukan kode mati** — Owner bisa menambah/menonaktifkan (mis.
tambah ShopeePay). Tiap metode punya sifat:

| Sifat metode | Arti |
|---|---|
| **Butuh bank?** | EDC & transfer wajib pilih bank (mis. BCA); tunai/QRIS tidak |
| **Boleh untuk dine-in?** | Sebagian metode dibatasi (mis. layanan ojek online hanya untuk takeaway) |
| **Boleh untuk takeaway?** | idem |

Saat membayar, sistem memvalidasi: metode aktif, cocok dengan tipe order (dine-in/
takeaway), dan **bank wajib diisi** kalau metodenya butuh bank — bank harus salah satu
yang terdaftar untuk metode itu.

## 1.3 PB1 (Pajak Restoran 10%) — Model 2-Sumbu

PB1 dihitung dari **dasar = subtotal − diskon**. Sistem punya **dua sakelar**:

| Sakelar | Pilihan |
|---|---|
| **PB1 aktif?** | ya / tidak |
| **PB1 ditagih ke pelanggan?** | ya (masuk tagihan) / tidak (**ditanggung resto**) |

**Matriks hasil** (dasar Rp100.000, PB1 10%):

| Kondisi | PB1 ditagih | PB1 ditanggung resto | Total bayar pelanggan |
|---|---|---|---|
| PB1 tidak aktif | Rp 0 | Rp 0 | **Rp 100.000** |
| Aktif + ditagih ke pelanggan | Rp 10.000 | Rp 0 | **Rp 110.000** |
| Aktif + ditanggung resto | Rp 0 | Rp 10.000 | **Rp 100.000** |

> **Kondisi Monosuko saat ini:** PB1 **ditanggung resto** — pelanggan tetap bayar harga
> menu (Rp100.000), tapi sistem mencatat "PB1 ditanggung Rp10.000" yang **mengurangi
> laba owner** di dashboard. Ini memisahkan "harga yang dilihat pelanggan" dari "beban
> pajak yang sebenarnya ditanggung resto".

PB1 & diskon **dikunci di slice pertama** — supaya sekali tagihan mulai dibayar,
totalnya tidak berubah-ubah saat slice berikutnya masuk.

## 1.4 Split-Tender (Contoh)

```
   Tagihan: Rp 115.000
   ┌─────────────────────────────────────────────┐
   │ Slice #1: Tunai  Rp 50.000   (oleh Bryant)  │
   │ Slice #2: QRIS   Rp 65.000   (oleh Bryant)  │
   ├─────────────────────────────────────────────┤
   │ Jumlah slice  = Rp 115.000  = Total → LUNAS │
   └─────────────────────────────────────────────┘
```

- Tiap slice mencatat **siapa yang memprosesnya** (audit per slice).
- Sistem menolak slice yang **melebihi sisa tagihan**.
- Selama belum lunas, slice yang salah bisa **dihapus** dan diulang.

## 1.5 Gabung Pesanan (Merge) saat Bayar

Kalau satu meja punya beberapa pesanan terpisah, kasir bisa **menggabungnya** tepat
saat pembayaran (hanya boleh di slice pertama). Penggabungan terjadi **menyatu dengan
pembayaran secara atomik** — kalau gagal di tengah, seluruh proses dibatalkan, tidak
meninggalkan kondisi setengah jadi. Pesanan sumber yang digabung ikut berubah jadi
LUNAS, tagihannya dipindah ke pesanan induk.

## 1.6 Saat Lunas

Begitu jumlah slice mencapai total:
- Status transaksi → **LUNAS (PAID)**, waktu bayar dicatat.
- Transaksi **ditempelkan ke shift yang aktif saat pembayaran** (penting untuk lintas
  hari — lihat [`TRANSACTION_FLOW.md`](TRANSACTION_FLOW.md) Bagian 3).
- **Struk PDF** dibuat di perangkat kasir (bisa disimpan/cetak sebagai bukti).

---

# BAGIAN 2 — SETTLEMENT (REKAP SETORAN)

## 2.1 Konsep: Cocokkan Sistem vs Fisik, Per Hari Bisnis

Di akhir hari, semua pembayaran direkap dan dicocokkan dengan uang fisik. **Satu
settlement untuk satu hari bisnis** (gabungan semua shift hari itu — bukan per shift).
Sistem menjamin hanya ada **satu settlement per tanggal**.

## 2.2 "Total Sistem" — dari mana angkanya?

Untuk tiap metode, **Total Sistem** = jumlah semua **slice pembayaran** dari transaksi
**LUNAS** pada hari bisnis itu.

- Dihitung dari data pembayaran nyata, bukan ketikan manual → **tak bisa dimanipulasi**.
- Pesanan yang sudah **digabung (merge)** tidak dihitung dua kali (hanya induk yang masuk).
- Untuk EDC & transfer, sistem juga menyediakan **rincian per bank** (mis. EDC BCA
  Rp300.000, EDC Mandiri Rp150.000) untuk dicocokkan dengan mutasi bank.

## 2.3 "Hitung Aktual" (Blind Count) → Selisih (Variance)

```
   Kasir menghitung uang fisik per metode, lalu sistem hitung:

        Selisih (Variance) = Aktual − Sistem      (per metode)
```

- **Aktual** diisi kasir (idealnya tanpa mengintip angka sistem dulu = *blind count*).
- **Selisih** positif = uang **lebih**; negatif = **kurang**.
- Tiap metode disimpan **dua angka**-nya (aktual & sistem) supaya selisih bisa
  ditampilkan ulang kapan saja.

## 2.4 Modal Awal (Float) — Acuan, Bukan Selisih

Jumlah **modal awal** semua shift hari itu ditampilkan sebagai acuan (mis. uang laci
awal Rp500.000), tapi **tidak ikut dihitung** dalam selisih — karena itu uang awal,
bukan hasil penjualan.

## 2.5 Contoh Rekap Satu Hari

```
   Settlement — Selasa, 10 Jun 2026   (kasir penutup: Bryant)
   ┌──────────────┬──────────────┬──────────────┬──────────────┐
   │ Metode       │ Total Sistem │ Hitung Aktual│ Selisih      │
   ├──────────────┼──────────────┼──────────────┼──────────────┤
   │ Tunai        │  Rp 1.200.000│  Rp 1.195.000│ −Rp 5.000    │ ← kurang
   │ QRIS         │  Rp   650.000│  Rp   650.000│  Rp 0        │ ← cocok
   │ EDC · BCA    │  Rp   300.000│  Rp   300.000│  Rp 0        │
   │ Transfer·BCA │  Rp   150.000│  Rp   150.000│  Rp 0        │
   ├──────────────┼──────────────┼──────────────┼──────────────┤
   │ TOTAL        │  Rp 2.300.000│  Rp 2.295.000│ −Rp 5.000    │
   └──────────────┴──────────────┴──────────────┴──────────────┘
   Modal awal hari ini: Rp 500.000  (acuan, tidak masuk selisih)
```

## 2.6 Siapa & Status

| Aspek | Aturan |
|---|---|
| **Siapa submit** | **Kasir penutup shift terakhir** hari itu, atau **Owner** |
| **Prasyarat** | Shift penutup sudah ditutup; belum ada settlement untuk tanggal itu |
| **Status** | **Submitted** (kasir kirim) → **Reviewed** (Owner sahkan) |

```
   Kasir submit            Owner review
   ───────────▶ SUBMITTED ───────────▶ REVIEWED
   (hitung + kirim)        (verifikasi selisih, sahkan)
```

> **Catatan akurasi (REV 2.7):** aturan lama *"settlement hanya kasir shift malam"*
> **sudah dihapus**. Sekarang yang berwenang adalah **kasir penutup shift terakhir**
> (siapa pun yang menutup hari itu) atau Owner — sesuai konsep settlement **per hari**,
> bukan per shift.

---

## Bagaimana Pembayaran & Settlement Saling Terhubung

```
   PEMBAYARAN (sepanjang hari)              SETTLEMENT (akhir hari)
   ────────────────────────────            ───────────────────────
   Tx#1 LUNAS  Tunai   Rp 40.000  ┐
   Tx#2 LUNAS  QRIS    Rp 65.000  │  dijumlahkan
   Tx#3 LUNAS  Tunai   Rp 30.000  ├─ per metode ─▶  Tunai = Rp 70.000 (Sistem)
   Tx#4 LUNAS  EDC BCA Rp 50.000  │                  QRIS  = Rp 65.000 (Sistem)
   …                              ┘                  EDC   = Rp 50.000 (Sistem)
                                                          │
                                                          ▼
                                                   dibandingkan uang fisik
                                                   → Selisih → Owner review
```

**Intinya:** settlement **tidak membuat data baru** — ia hanya **menjumlahkan
pembayaran yang sudah terjadi** dan membandingkannya dengan uang fisik. Itu sebabnya
"Total Sistem" akurat dan objektif.

---

## Ringkasan untuk Sidang

1. **Pembayaran**: satu tagihan bisa dibayar **beberapa slice** (*split-tender*); lunas
   saat jumlah slice = total.
2. **Metode pembayaran diatur Owner**; EDC/transfer **wajib bank**.
3. **PB1 model 2-sumbu**: aktif/tidak × ditagih-ke-pelanggan/ditanggung-resto. Monosuko
   saat ini **menanggung PB1** (mengurangi laba, tidak menambah tagihan pelanggan).
4. **Settlement = rekap per hari bisnis**: **Total Sistem** (dari pembayaran nyata) vs
   **Hitung Aktual** (uang fisik) → **Selisih** per metode; modal awal hanya acuan.
5. Settlement **tidak membuat angka baru** — menjumlahkan yang sudah ada → objektif &
   tahan manipulasi. Disahkan lewat alur **Submitted → Reviewed** (Owner).

---

*Perilaku sistem apa adanya (as-built) per Juni 2026. Detail entitas di
[`../DATA-DICTIONARY.md`](../DATA-DICTIONARY.md); aturan operasional di
[`../operasional-resto.md`](../operasional-resto.md).*
