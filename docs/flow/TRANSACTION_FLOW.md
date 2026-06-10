# Alur Transaksi Sistem POS — Ayam Bakar Banjar Monosuko

> Dokumentasi alur bisnis transaksi untuk keperluan sidang skripsi.
> Fokus pada **alur**, bukan detail teknis. Disusun dari pembacaan kode aktual
> (modul `transactions`, `shifts`, `dashboard`, dan skema basis data).

---

## Pemeran & Konsep Dasar

Sistem punya **3 peran**: **Owner**, **Kasir**, **Waiter**.

Hal terpenting yang harus dipahami dulu: dalam satu transaksi, ada **tiga "siapa"
yang berbeda** dan sering disalahpahami sebagai satu. Pemisahan inilah yang
membuat sistem bisa menangani kasus rumit (lintas hari, bayar dari riwayat) dengan
benar.

| Istilah di sistem | Artinya | Contoh |
|---|---|---|
| **Pencatat order** (`createdBy`) | Orang yang **menginput pesanan** ke sistem | Waiter Amel mencatat pesanan Meja 3 lewat HP |
| **Pemilik shift** (`shift.cashier`) | Kasir yang **buka kasir / pegang laci uang** saat itu | Kasir Jason yang buka shift malam |
| **Pemroses bayar** (`recordedBy`) | Orang yang **menekan tombol Bayar** | Kasir Bryant yang menerima uang pelanggan |

Ketiganya **bisa orang yang berbeda**. Contoh nyata: Amel mencatat order, lalu
Bryant yang menagihnya, padahal shift dimiliki Jason. Sistem mencatat ketiga peran
itu terpisah.

---

## Bagian 1 — Alur Normal (Happy Path)

```
  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
  │ 1. BUKA      │   │ 2. INPUT     │   │ 3. PEMBAYARAN│   │ 4. TUTUP     │
  │    KASIR     │──▶│    ORDER     │──▶│              │──▶│    KASIR     │
  │  (Kasir)     │   │ (Waiter/     │   │ (Kasir/      │   │  (Kasir/     │
  │              │   │  Kasir)      │   │  Owner)      │   │   Owner)     │
  └──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
   modal awal +       pilih meja +       pilih metode +     blokir kalau ada
   pilih pagi/malam   item, stok          PB1, status         order belum bayar
   → shift OPEN        auto-berkurang      jadi LUNAS          → lalu Setoran
```

### Langkah 1 — Buka Kasir (open shift)
- **Siapa:** Kasir (Owner juga boleh). Waiter **tidak** boleh.
- Kasir mengisi **modal awal** (uang laci) dan memilih jenis shift: **Pagi** atau **Malam**.
- Sistem memvalidasi dua hal: (a) belum ada shift lain yang masih buka, dan
  (b) waktu sekarang masih di dalam **jam operasional** shift itu (lihat Bagian 5).
- Setelah valid → shift berstatus **OPEN** dan menjadi satu-satunya shift aktif.
  Tanpa shift aktif, **tidak ada** transaksi yang bisa masuk.

### Langkah 2 — Input Order (pesanan masuk)
- **Siapa:** Waiter **maupun** Kasir (setara — keduanya boleh mencatat dari HP).
- Pilih tipe order: **Dine-in** (wajib pilih nomor meja 1–9) atau **Takeaway** (tanpa meja).
- Pilih menu + jumlah + catatan (mis. "pedas", "Dingin"). Stok porsi **otomatis berkurang**.
- Transaksi tercatat dengan status **OPEN** (belum dibayar), ditempelkan ke **shift yang
  sedang aktif**, dan menyimpan **siapa yang menginput** (pencatat order).
- Satu meja boleh punya beberapa pesanan (multi-ronde) yang nanti bisa **digabung**
  saat bayar.

### Langkah 3 — Pembayaran
- **Siapa:** Kasir atau Owner. Waiter **tidak** boleh memproses pembayaran
  (pemisahan tugas penanganan uang).
- Kasir memilih **metode pembayaran** (tunai, QRIS, EDC, transfer, dll. — daftarnya
  diatur owner). Untuk EDC/transfer wajib pilih **bank**.
- Sistem menghitung **PB1 (pajak 10%)** bila diaktifkan, dan diskon manual bila ada.
- Mendukung **split-tender**: satu tagihan dibayar beberapa metode (mis. tunai
  Rp50.000 + QRIS Rp65.000).
- Bila beberapa pesanan satu meja digabung, penggabungan terjadi **menyatu dengan
  pembayaran** (atomik — tidak meninggalkan kondisi setengah jadi).
- Saat lunas → status berubah jadi **PAID**, waktu bayar dicatat, dan transaksi
  **ditempelkan ke shift yang aktif saat pembayaran** (poin penting, lihat Bagian 3).

### Langkah 4 — Tutup Kasir (close shift) + Setoran
- **Siapa:** Kasir pemilik shift atau Owner.
- Tutup shift **diblokir** bila masih ada pesanan yang belum dibayar — sistem
  menampilkan daftar meja yang masih open. Semua harus **dibayar atau dibatalkan** dulu.
- Setelah bersih → shift **CLOSED**, lalu kasir melakukan **settlement** (rekap
  setoran: hitung uang fisik vs catatan sistem per metode).

---

## Bagian 2 — Relasi Transaction, Shift, dan Payment

```
        ┌───────────────────┐
        │       USER        │  (Owner / Kasir / Waiter)
        └───────────────────┘
            ▲      ▲      ▲
   pemilik  │      │      │  pencatat order
   shift    │      │      │  (createdBy)
            │      │      └──────────────────────┐
            │      │ pemroses bayar              │
            │      │ (recordedBy)                │
   ┌────────┴───┐  │              ┌──────────────┴─────────┐
   │   SHIFT    │  │              │      TRANSACTION       │
   │            │◀─┼──────────────│  (header pesanan)      │
   │ 1 shift    │  │  ditempel    │  status: open / paid / │
   │ : N tx     │  │  ke shift    │          void          │
   └────────────┘  │              └────────────────────────┘
                   │                  │              │
                   │          1 tx : N │      1 tx : N│
                   │                  ▼              ▼
                   │        ┌──────────────┐  ┌──────────────┐
                   └────────│ TRANSACTION  │  │ TRANSACTION  │
                            │   PAYMENT    │  │     ITEM     │
                            │ (slice bayar)│  │ (detail menu)│
                            └──────────────┘  └──────────────┘
```

**Hubungan utama:**

| Relasi | Sifat | Makna bisnis |
|---|---|---|
| **Shift → Transaction** | 1 shift punya banyak transaksi | Semua pesanan satu shift masuk ke laci/laporan shift itu |
| **Transaction → Payment** | 1 transaksi punya 1+ pembayaran | Satu tagihan bisa dibayar beberapa metode (*split-tender*) |
| **Transaction → Item** | 1 transaksi punya banyak item | Detail menu yang dipesan |
| **Transaction → User (pencatat)** | tiap transaksi punya 1 pencatat | Siapa yang menginput order |
| **Shift → User (kasir)** | tiap shift punya 1 kasir | Siapa pemilik shift / pemegang uang |
| **Payment → User (pemroses)** | tiap slice bayar punya 1 pemroses | Siapa yang menerima uang slice itu |

**Intinya:** uang sebuah transaksi **selalu** mengikuti **Shift**-nya (lewat tautan
*Transaction → Shift*). "Siapa yang menginput" dan "siapa yang menagih" dicatat
terpisah dan **tidak** memengaruhi ke laci/laporan mana uang itu masuk.

---

## Bagian 3 — Transaksi Lintas Hari (dibuat hari X, dibayar hari X+1)

Ini kasus paling sering ditanya. Misal: pelanggan makan malam, pesanannya tercatat
**Senin malam**, tapi baru dibayar **Selasa pagi**.

### Aturan kunci sistem

1. **Order menempel ke shift saat dibuat**, tapi **uang ditempel ke shift saat dibayar.**
2. Sistem **memaksa urutan beres**: shift kemarin yang belum ditutup akan
   "menghalangi" hari baru. Selama masih ada pesanan belum dibayar, shift itu
   **tidak bisa ditutup**, dan shift baru **tidak bisa dibuka** (hanya boleh 1 shift
   aktif). Jadi kasir **wajib** melunasi/membatalkan pesanan kemarin **lebih dulu**.
3. Karena urutan itu dipaksa, pesanan sisa kemarin **selalu** dibayar saat shift
   kemarin **masih terbuka** → uangnya tetap masuk ke **shift kemarin**.

### Contoh konkret

```
  SENIN MALAM                          SELASA PAGI
  ───────────                          ───────────
  Jason buka "shift malam"             Jason (atau kasir lain) mau buka
  (tanggal = Senin)                    shift pagi Selasa.
       │                                    │
  Amel input order Meja 3              Sistem: "Shift Senin belum ditutup,
  Rp40.000 (status OPEN)              beresin dulu." → POS terkunci.
       │                                    │
  Pelanggan pulang belum bayar         Bryant buka Riwayat → BAYAR order
  Shift malam dibiarkan terbuka        Meja 3 Rp40.000 → status PAID.
                                            │
                                       Lalu shift Senin baru bisa DITUTUP,
                                       baru shift Selasa bisa dibuka.
```

### Siapa tercatat apa, masuk hari mana?

| Pertanyaan | Jawaban | Alasan |
|---|---|---|
| **Siapa pencatat order?** | **Amel** (Senin malam) | Disimpan saat order dibuat, tidak pernah berubah |
| **Siapa pemroses bayar?** | **Bryant** (Selasa pagi) | Dicatat di slice pembayaran |
| **Masuk shift siapa?** | **Shift Jason** (shift malam Senin) | Saat dibayar, satu-satunya shift aktif masih shift Senin |
| **Masuk laporan hari apa?** | **Senin** (hari shift-nya) | Laporan menghitung pendapatan berdasarkan **tanggal shift**, bukan jam dinding saat bayar |

> **Poin sidang:** pendapatan diatribusikan berdasarkan **tanggal bisnis shift**
> (*business day*), **bukan** jam pembayaran sebenarnya. Order Senin yang baru dibayar
> Selasa pagi tetap **masuk omzet Senin**, karena uang itu masuk ke laci shift Senin.
> Ini mencegah omzet "bocor" ke hari yang salah.

---

## Bagian 4 — Bayar Pesanan Pending Lewat Halaman Riwayat

### Konteks
Saat kasir mau tutup kasir tapi ada pesanan kemarin yang belum dibayar, sistem
mengarahkannya ke **halaman Riwayat** (bukan kembali ke layar kasir). Di Riwayat,
tiap pesanan yang masih *open* punya tombol **Bayar**.

### Bagaimana sistem menangani kepemilikan & shift-nya?

**Tidak ada logika khusus.** Tombol "Bayar" di halaman Riwayat memanggil **proses
pembayaran yang sama persis** dengan tombol Bayar di layar Kasir. Jadi hasilnya identik:

```
  Bayar dari Kasir  ─┐
                     ├─▶  PROSES PEMBAYARAN YANG SAMA  ─▶  hasil identik
  Bayar dari Riwayat ─┘
```

- **Pencatat order** → tetap orang asli yang menginput (tidak berubah).
- **Pemroses bayar** → orang yang menekan "Bayar" di Riwayat saat itu.
- **Shift** → shift yang sedang aktif saat pembayaran (yaitu shift asal yang masih
  terbuka — lihat Bagian 3).
- **Hak akses** → halaman Riwayat hanya bisa dibuka Owner & Kasir, jadi Waiter tidak
  pernah masuk alur ini. Konsisten dengan aturan "pembayaran hanya kasir/owner".

> **Mengapa ini penting (poin sidang):** sebelumnya, pesanan kemarin yang sah hanya
> bisa **dibatalkan**, tidak bisa **ditagih**, sehingga kasir terjebak. Dengan
> menjadikan Riwayat sebagai pintu pembayaran (memakai mesin bayar yang sudah ada),
> pesanan lintas hari bisa **ditagih dengan benar** tanpa membuat logika baru yang
> berisiko — kepemilikan & atribusi shift otomatis benar karena memakai jalur yang sama.

---

## Bagian 5 — Logika Jam Kerja (Work Hours) & Penentuan Shift

### Pengaturan jam (bisa diubah Owner)
Restoran punya **2 shift**: **Pagi** dan **Malam**. Batas jamnya tersimpan sebagai
setelan dan **bisa diatur owner**:

| Setelan | Default | Arti |
|---|---|---|
| **Mulai Pagi** (`pagiStart`) | 07:00 | Patokan jam buka harian |
| **Pergantian** (`changeover`) | 18:00 | Batas Pagi → Malam |
| **Akhir Malam** (`malamEnd`) | 23:00 | Batas akhir buka shift malam |
| **Zona waktu** (`timezone`) | Asia/Jakarta | Acuan jam resto |

### Aturan kapan boleh buka shift

```
   00:00        07:00            18:00            23:00      00:00
     │  (pagiStart)│  (changeover)  │  (malamEnd)    │
     │             │                │                │
     ├─────────── SHIFT PAGI boleh dibuka ──────────┤ (sebelum 18:00)
     │                              ├── SHIFT MALAM boleh dibuka ──┤ (18:00–23:00)
```

- **Shift Pagi:** boleh dibuka kapan saja **sebelum** jam pergantian (18:00).
- **Shift Malam:** boleh dibuka **mulai** jam pergantian (18:00) sampai akhir malam.
  Boleh dibuka lebih awal **hanya jika** shift pagi sudah dibuka lebih dulu (kasus
  serah-terima kasir sore).
- **Hanya 1 shift** yang boleh aktif pada satu waktu (dijamin di tingkat basis data).

### Transaksi masuk ke shift yang mana?
Sederhana: **selalu ke shift yang sedang aktif (open)** saat itu.
- **Order baru** → ditolak kalau tidak ada shift aktif, **atau** kalau shift aktif
  ternyata sudah "basi" (sudah masuk hari baru tapi shift kemarin belum ditutup).
- **Pembayaran** → selalu menempel ke shift aktif (yang sedang menerima uang).

### Konsep "Hari Bisnis" (business day)
- Biasanya hari bisnis = tanggal kalender biasa.
- **Pengecualian:** kalau owner menyetel shift malam **melewati tengah malam** (mis.
  akhir malam 01:00), maka transaksi **dini hari** (sebelum shift malam berakhir)
  tetap dihitung sebagai **hari sebelumnya**. Jadi penjualan jam 00:30 masuk omzet
  hari kemarin, bukan hari baru — sesuai logika "satu malam operasional = satu hari".

### Konsep "Shift Basi / Overdue"
- Shift yang dibiarkan terbuka melewati hari bisnisnya ditandai **overdue**.
- Penanda ini muncul **setelah** masuk hari baru **dan** sudah lewat jam buka pagi.
  Lembur tengah malam (sebelum jam buka pagi) **tidak** dianggap basi, supaya kasir
  bisa menuntaskan tagihan tadi malam dengan tenang.
- Saat ada shift overdue, layar Kasir **terkunci** dengan peringatan, dan kasir
  diarahkan menuntaskan + menutup shift kemarin dulu (lewat alur Riwayat di Bagian 4).

---

## Ringkasan untuk Sidang

1. **Empat tahap:** Buka Kasir → Input Order → Pembayaran → Tutup Kasir + Setoran.
2. **Tiga "siapa" terpisah:** pencatat order, pemilik shift, pemroses bayar.
   Bisa orang berbeda; dicatat masing-masing.
3. **Uang ikut Shift, bukan orang.** Laporan pendapatan dihitung per **tanggal shift**.
4. **Lintas hari aman:** order kemarin yang dibayar hari ini tetap masuk **omzet
   kemarin**, karena sistem memaksa pelunasan terjadi saat shift kemarin masih terbuka.
5. **Bayar dari Riwayat = bayar dari Kasir:** jalur teknis yang sama, sehingga
   kepemilikan dan atribusi shift otomatis benar tanpa logika tambahan.
6. **Jam kerja menentukan kapan shift boleh dibuka** dan **transaksi masuk ke shift
   aktif**; hanya satu shift aktif pada satu waktu.

---

*Dokumen ini menjelaskan perilaku sistem apa adanya (as-built) per Juni 2026.
Detail entitas basis data lengkap ada di [`docs/DATA-DICTIONARY.md`](../DATA-DICTIONARY.md);
aturan bisnis operasional di [`docs/operasional-resto.md`](../operasional-resto.md).*
