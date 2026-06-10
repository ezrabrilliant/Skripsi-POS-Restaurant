# Alur Stok Porsi & Opname — Ayam Bakar Banjar Monosuko

> Dokumentasi alur pengelolaan stok & opname untuk keperluan sidang skripsi.
> Fokus pada **alur bisnis**, bukan detail teknis. Disusun dari pembacaan kode aktual
> (modul `stocks/portion`, skema basis data). Pendamping [`MENU_FLOW.md`](MENU_FLOW.md)
> dan [`TRANSACTION_FLOW.md`](TRANSACTION_FLOW.md).

---

## Konsep Dasar: Stok = Porsi Siap Jual (Finished Goods)

Sistem **hanya melacak stok porsi siap jual** (mis. "Paha Ayam Bakar" sekian porsi),
**bukan** bahan mentah (ayam hidup, beras, bumbu). Konversi bahan mentah → porsi
terjadi **di rumah owner** dan **di luar cakupan** sistem.

Ciri stok porsi:
- **Hitungan hidup (live count):** satu angka `currentQty` per menu yang terus berubah,
  **bukan** per tanggal.
- **Boleh minus.** Kalau stok 3 lalu terjual 5, jadi −2 (artinya nanti perlu restock 2
  dulu untuk balik nol). Ini sengaja — penjualan tidak boleh terhalang stok telat dicatat.
- **Berkurang otomatis** saat order masuk, **kembali otomatis** saat transaksi dibatalkan.
- **Setiap perubahan dicatat** di buku audit (ledger).

Hanya menu bertipe **stok porsi** yang punya hitungan ini. Menu *non-stok* (mis.
sebagian minuman) tampil di kasir tapi tidak memengaruhi stok.

---

## Empat Operasi Stok

```
   ┌──────────────────────────────────────────────────────────────┐
   │                     STOK PORSI (currentQty)                   │
   │                                                              ▲ │
   │   ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┴┐│
   │   │ Restock    │  │ Barang     │  │  OPNAME    │  │ Mark Habis ││
   │   │ Pagi  (+)  │  │ Masuk (+)  │  │  (±)       │  │   (→0)     ││
   │   └────────────┘  └────────────┘  └────────────┘  └───────────┘│
   │         ▲ tiap pagi    ▲ darurat       ▲ cek fisik    ▲ cepat   │
   │                                                              │ │
   │                        Order (−)  /  Void (+)  ◀─────────────┘ │
   │                        otomatis dari transaksi                 │
   └──────────────────────────────────────────────────────────────┘
```

| Operasi | Kapan dipakai | Cara | Tercatat sebagai |
|---|---|---|---|
| **Restock Pagi** | Tiap pagi sebelum buka | Tambah stok beberapa menu sekaligus, **kelipatan** tertentu (default 5, diatur owner) | `restock_morning` |
| **Barang Masuk** (darurat) | Tengah hari, stok nyusul/diantar | Tambah **satu** menu, jumlah bebas (mis. "diantar Gojek 18:30") | `restock_emergency` |
| **Opname** | Cek stok fisik vs catatan | Input jumlah **fisik**, sistem hitung selisih | `manual_adjust` (hanya bila ada selisih) |
| **Mark Habis** | Stok suatu menu habis, mau cepat | Set jadi 0 sekali klik | `manual_adjust` |

Selain itu, stok juga berubah **otomatis** dari transaksi:
- **Order masuk** → stok porsi target **berkurang** (lihat [`MENU_FLOW.md`](MENU_FLOW.md)
  untuk paket/varian yang berkurang lebih dari satu jenis).
- **Transaksi dibatalkan (void)** → stok **dikembalikan** (`refund_void`).

---

## Detail Alur Opname (yang paling sering ditanya)

**Opname = mencocokkan stok fisik di lapangan dengan angka di sistem**, lalu
meluruskan angka sistem agar sesuai kenyataan.

```
   1. Petugas HITUNG FISIK tiap menu        (mis. Paha Ayam: hitung manual = 18)
              │
              ▼
   2. INPUT jumlah fisik ke sistem          (ketik 18)
              │
              ▼
   3. Sistem hitung SELISIH = fisik − sistem
              │
       ┌──────┴───────┐
       ▼              ▼
   selisih = 0     selisih ≠ 0
   (cocok)         (mis. sistem 20, fisik 18 → selisih −2)
       │              │
       ▼              ▼
   tidak ada      • angka sistem diluruskan jadi 18
   yang dicatat   • dicatat di buku audit:
   (dianggap        "sistem 20 → fisik 18, selisih −2,
    sukses)          oleh siapa, kapan"
```

**Poin penting:**
- Opname bisa untuk **banyak menu sekaligus** (sekali sesi).
- **Hanya menu yang punya selisih** yang dicatat di buku audit. Yang sudah cocok
  (selisih 0) tetap dihitung "sudah di-opname" tapi tidak membuat catatan — supaya
  buku audit bersih, hanya berisi kejadian yang berarti.
- Opname **tidak menebak** penyebab selisih (rusak, salah hitung, terbuang). Itu
  diputuskan manusia; sistem hanya mencatat **fakta selisihnya**.

---

## Buku Audit Stok (Ledger)

Setiap perubahan stok — dari operasi mana pun — membuat satu baris audit yang
**berdiri sendiri** dan **tak bisa dihapus diam-diam**:

| Yang dicatat | Contoh |
|---|---|
| **Menu apa** | Paha Ayam Bakar |
| **Perubahan (delta)** | −2 |
| **Alasan** | Opname / Restock pagi / Order / Void, dst. |
| **Stok sebelum → sesudah** | 20 → 18 |
| **Siapa & kapan** | Yanti, 10 Jun 07:15 |
| **Tautan sumber** | (kalau dari order/void) nomor transaksi penyebab |

Karena tiap baris menyimpan **stok sebelum & sesudah**, riwayat stok bisa ditelusuri
tanpa harus menjumlah ulang dari awal — penting untuk audit dan akuntabilitas.

---

## Metrik "Terjual Hari Ini"

Saat petugas pertama login pagi, sistem **memotret (snapshot)** stok awal hari itu.
Lalu sepanjang hari:

```
   Terjual hari ini = Stok Awal (snapshot pagi) + Restock hari ini − Stok Sekarang
```

Ini dipakai di dashboard untuk memantau pergerakan stok harian tanpa perlu mencatat
penjualan stok secara terpisah.

---

## Siapa Boleh Apa

| Aksi | Owner | Kasir | Waiter |
|---|:---:|:---:|:---:|
| Lihat stok | ✅ | ✅ | ✅ |
| Opname | ✅ | ✅ | ✅ |
| Mark Habis | ✅ | ✅ | ✅ |
| Restock Pagi / Barang Masuk | ✅ | ✅ | ✅ |
| Kelola menu & atur stok master (min. stok, jenis stok) | ✅ | ❌ | ❌ |

Operasi stok harian **terbuka untuk semua peran** (waiter yang menyiapkan minuman pun
bisa opname), sedangkan pengaturan **master menu** hanya Owner.

---

## Ringkasan untuk Sidang

1. Sistem melacak **stok porsi siap jual** (finished goods), **bukan** bahan mentah.
2. Stok adalah **hitungan hidup** yang boleh minus; berubah otomatis dari order/void
   dan manual dari 4 operasi: **Restock Pagi, Barang Masuk, Opname, Mark Habis**.
3. **Opname** = hitung fisik → sistem hitung **selisih** → luruskan angka + catat audit
   **hanya bila ada selisih**.
4. **Semua perubahan stok masuk buku audit** (siapa, kapan, sebelum→sesudah, alasan,
   tautan transaksi) → akuntabel & bisa ditelusuri.
5. Operasi stok **terbuka semua peran**; master menu **owner-only**.

---

*Perilaku sistem apa adanya (as-built) per Juni 2026. Detail entitas di
[`../DATA-DICTIONARY.md`](../DATA-DICTIONARY.md); aturan operasional di
[`../operasional-resto.md`](../operasional-resto.md).*
