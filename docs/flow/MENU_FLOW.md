# Alur Menu: Simple, Varian & Paket — Ayam Bakar Banjar Monosuko

> Dokumentasi struktur menu (termasuk bagian rumit: **varian** & **paket**) untuk
> keperluan sidang skripsi. Fokus pada **alur bisnis**, bukan detail teknis.
> Disusun dari pembacaan kode aktual (modul `menus`, resolver order, skema basis data).
> Pendamping [`STOCK_OPNAME_FLOW.md`](STOCK_OPNAME_FLOW.md) &
> [`TRANSACTION_FLOW.md`](TRANSACTION_FLOW.md).

---

## Kenapa Menu Bisa Rumit?

Di permukaan, menu terlihat sederhana: nama + harga. Tapi di restoran nyata ada dua
kebutuhan yang membuatnya berlapis:

1. **Satu nama, banyak variasi & stok berbeda.** "Ayam Bakar" sebenarnya bisa Paha,
   Dada, atau Sayap — **harga beda, dan stoknya pun terpisah** (stok paha ≠ stok dada).
2. **Paket = gabungan beberapa item.** "Paket A" = nasi + ayam + minuman dalam satu
   harga, di mana **satu porsi paket memotong beberapa stok sekaligus**.

Sistem menangani ini dengan **3 jenis menu** + konsep **stok bertarget**. Inilah
bagian yang dimaksud "ribet" — dokumen ini menjelaskannya selangkah demi selangkah.

---

## Tiga Jenis Menu

```
   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
   │   SIMPLE    │     │   VARIAN    │     │    PAKET    │
   │ 1 nama,     │     │ 1 nama,     │     │ gabungan    │
   │ 1 harga     │     │ banyak      │     │ beberapa    │
   │             │     │ kombinasi   │     │ item        │
   └─────────────┘     └─────────────┘     └─────────────┘
   mis. Es Teh         mis. Ayam Bakar     mis. Paket A
                       (Paha/Dada × ...)   (nasi+ayam+minum)
```

| Jenis | Arti | Contoh |
|---|---|---|
| **Simple** | Satu harga, tanpa pilihan | Es Teh, Kerupuk |
| **Varian** | Punya "sumbu pilihan" → membentuk kombinasi ber-harga & ber-stok sendiri | Ayam Bakar: Bagian × Cara Masak |
| **Paket** | Komposit dari item tetap + item pilihan | Paket A: Nasi + (pilih ayam) + (pilih minum) |

---

## Konsep Kunci: Jenis Stok & "SKU Tersembunyi"

Setiap menu/komponen punya **jenis stok**:

| Jenis stok | Arti |
|---|---|
| **Porsi (portion)** | Punya hitungan stok sendiri, berkurang saat terjual |
| **Terhubung (linked)** | Menumpang stok menu lain (mis. varian menunjuk ke stok porsi) |
| **Non-stok (nonStock)** | Tampil di kasir tapi tidak memengaruhi stok (mis. sebagian minuman) |

Selain itu ada konsep **SKU tersembunyi** (`posVisible = false`): menu stok yang
**tidak muncul di layar kasir**, hanya jadi **target stok**. Contoh: "Paha Ayam Bakar"
adalah SKU stok tersembunyi; pelanggan tidak memesannya langsung — ia berkurang ketika
varian "Ayam Bakar (Paha)" terjual.

> Analogi: di kasir kasir cuma lihat **"Ayam Bakar"**. Di gudang, ada rak terpisah
> **Paha / Dada / Sayap**. Varian adalah jembatan antara yang dilihat kasir dan rak
> stok sebenarnya.

---

## 1. Menu Simple

Paling lugas: satu menu, satu harga.
- Kalau jenis stoknya **porsi** → terjual = stok berkurang 1.
- Kalau **non-stok** → terjual = tidak ada efek stok.

Tidak ada pilihan, tidak ada percabangan. Selesai.

---

## 2. Menu Varian

Menu varian punya **grup pilihan (sumbu)**. Tiap kombinasi sumbu = satu **varian**
yang bisa dijual, dengan **harga eksak** dan **target stok** sendiri.

### Contoh: "Ayam Bakar"
```
   Sumbu 1: Bagian   →  [ Paha ] [ Dada ] [ Sayap ]
   Sumbu 2: Masak    →  [ Bakar ] [ Goreng ]

   Kombinasi (varian) yang terbentuk:
   ┌────────────────────┬──────────┬─────────────────────────┐
   │ Varian             │ Harga    │ Target stok (SKU)        │
   ├────────────────────┼──────────┼─────────────────────────┤
   │ Paha · Bakar       │ Rp 20.000│ → stok "Paha Ayam"       │
   │ Dada · Bakar       │ Rp 22.000│ → stok "Dada Ayam"       │
   │ Sayap · Goreng     │ Rp 16.000│ → stok "Sayap Ayam"      │
   │ …                  │ …        │ …                        │
   └────────────────────┴──────────┴─────────────────────────┘
```

Hal penting:
- **Harga per kombinasi bersifat eksak**, bukan penjumlahan ("Paha +Rp0, Bakar +Rp2rb").
  Ini sengaja supaya owner bebas menetapkan harga tiap kombinasi tanpa terpaksa rumus
  aditif (mis. Dada bisa lebih mahal dari Paha walau "Bakar"-nya sama).
- **Tiap varian menunjuk ke satu SKU stok** (rak gudang). Saat "Ayam Bakar (Paha)"
  terjual, yang berkurang adalah stok **Paha Ayam**, bukan stok "Ayam Bakar".
- Ada juga **pilihan yang BUKAN sumbu varian** (disebut *free-preference*), mis.
  **Suhu: Dingin/Panas** untuk teh. Ini **tidak** membentuk varian baru dan **tidak**
  memengaruhi stok/harga — hanya dicatat sebagai catatan untuk dapur.

---

## 3. Menu Paket

Paket = **gabungan beberapa komponen**. Tiap komponen ada dua macam:

| Macam komponen | Arti | Contoh |
|---|---|---|
| **Tetap (fixed)** | Selalu termasuk, jumlah bisa >1 | 1× Nasi Putih |
| **Pilihan (choice)** | Pelanggan memilih satu opsi | Pilih lauk: Paha / Dada / Sayap |

Opsi pilihan bisa punya **tambahan harga (upcharge)**, mis. pilih ukuran "Jumbo"
menambah Rp 4.000. Dan kalau sebuah opsi menunjuk ke **menu varian**, kasir akan
**bercabang ke pemilih varian** (nested picker) saat order.

### Contoh: "Paket A — Rp 35.000"
```
   PAKET A
   ├─ [tetap]   1× Nasi Putih                 → potong stok Nasi
   ├─ [pilihan] Lauk:  ( ) Paha  ( ) Dada      → potong stok lauk yang dipilih
   └─ [pilihan] Minum: ( ) Es Teh
                       ( ) Es Teh Jumbo (+Rp4rb)   ← upcharge
                       ( ) Air Mineral
```

Saat pelanggan memilih **Paha + Es Teh Jumbo**, paket itu:
- memotong stok **Nasi** (1) + stok **Paha Ayam** (1),
- menambah harga **+Rp4.000** (upcharge Jumbo),
- minuman "Es Teh" non-stok → tidak memotong stok, tapi tetap masuk hitungan modal.

---

## Yang Terjadi Saat Order (Bagian Paling Cerdas)

Di layar kasir, pelanggan memesan **satu baris** ("Paket A — Paha, Es Teh Jumbo").
Di belakang layar, sistem **menjabarkannya (fan-out)** menjadi tiga hal sekaligus:

```
   1 baris pesanan: "Paket A (Paha, Es Teh Jumbo)"
                │
     ┌──────────┼───────────────────────┐
     ▼          ▼                        ▼
  POTONG      HITUNG MODAL (COGS)     TAMBAH HARGA
  STOK        (untuk laba owner)      (upcharge)
  • Nasi −1   • modal Nasi            • +Rp4.000
  • Paha −1   • modal Paha              (Es Teh Jumbo)
              • modal Es Teh
```

1. **Potong stok yang benar.** Sistem menelusuri tiap komponen paket/varian sampai ke
   **SKU stok aslinya**, lalu menguranginya. Kalau dua komponen menunjuk stok yang
   sama, pengurangannya **digabung** (mis. paket isi 2 ayam paha → stok Paha −2).
2. **Hitung modal (COGS).** Modal satu porsi paket = jumlah modal **tiap komponennya**
   (termasuk yang non-stok seperti nasi/minuman). Dipakai owner untuk menghitung laba.
   Modal ini **tidak pernah ditampilkan ke kasir/publik** (rahasia owner).
3. **Tambah harga upcharge** dari opsi yang dipilih (mis. Jumbo).

> Inilah inti "keribetan" yang berguna: **kasir cukup pilih satu menu**, sistem
> otomatis tahu rak stok mana yang harus dikurangi, berapa modalnya, dan berapa harga
> akhirnya — tanpa kasir perlu paham SKU stok di belakang.

---

## Yang Tersimpan di Transaksi (untuk Struk & Riwayat)

Setiap item pesanan menyimpan **pilihan-pilihannya** agar bisa ditampilkan ulang di
struk/riwayat:
- **Pilihan slot paket** (mis. "Lauk: Paha", "Minum: Es Teh Jumbo").
- **Free-preference** (mis. "Suhu: Dingin") — ditandai khusus karena tak memengaruhi
  stok/harga.
- **Catatan bebas** dari waiter (mis. "pedas level 2", "kurang manis").

Sehingga di struk, satu baris paket tetap menampilkan rincian yang dipilih pelanggan.

---

## Ringkasan untuk Sidang

1. Ada **3 jenis menu**: **Simple** (1 harga), **Varian** (banyak kombinasi ber-stok
   sendiri), **Paket** (gabungan item tetap + pilihan).
2. **Varian** memetakan satu nama menu ke banyak **SKU stok tersembunyi** (Paha/Dada/…)
   dengan **harga eksak per kombinasi**.
3. **Paket** terdiri dari komponen **tetap** + **pilihan** (boleh ber-*upcharge*, boleh
   bercabang ke varian).
4. Saat order, sistem **menjabarkan satu baris pesanan** menjadi: **potong stok yang
   tepat** + **hitung modal/COGS** + **tambah upcharge** — otomatis.
5. **Free-preference** (mis. Suhu) hanya catatan, **tidak** memengaruhi stok/harga.
6. Tujuan akhirnya: **kasir cukup memilih satu menu**, kerumitan stok & modal di
   belakang ditangani sistem — akurat untuk penjualan **dan** laporan laba.

---

*Perilaku sistem apa adanya (as-built) per Juni 2026. Detail entitas di
[`../DATA-DICTIONARY.md`](../DATA-DICTIONARY.md); pergerakan stok di
[`STOCK_OPNAME_FLOW.md`](STOCK_OPNAME_FLOW.md).*
