# Feature Map by Role — POS Restoran Ayam Bakar Banjar Monosuko

> REV 2.13 | Sumber: routes backend + nav Layout.tsx + Permission Matrix REV 2.4

---

## Ringkasan Cepat

| Fitur | Owner | Kasir | Waiter |
|---|:---:|:---:|:---:|
| Dashboard laporan keuangan (full) | ✅ | ❌ | ❌ |
| Dashboard shift hari ini | ✅ | ✅ | ❌ |
| Dashboard stok porsi | ✅ | ✅ | ✅ |
| Input order (POS) | ✅ | ✅ | ✅ |
| Lihat status meja | ✅ | ✅ | ✅ |
| Proses pembayaran | ✅ | ✅ | ❌ |
| Void transaksi | ✅ | ✅ | ❌ |
| Split / merge bill | ✅ | ✅ | ❌ |
| Buka kasir (shift) | ❌* | ✅ | ❌ |
| Tutup kasir (shift) | ✅ | ✅ | ❌ |
| Riwayat transaksi | ✅ | ✅ | ❌ |
| Settlement harian (rekap) | ✅ | ✅ | ❌ |
| Review settlement | ✅ | ❌ | ❌ |
| Stok porsi: view | ✅ | ✅ | ✅ |
| Stok porsi: restock pagi | ✅ | ✅ | ✅ |
| Stok porsi: barang masuk darurat | ✅ | ✅ | ✅ |
| Stok porsi: opname | ✅ | ✅ | ✅ |
| Stok porsi: mark habis | ✅ | ✅ | ✅ |
| Katalog menu: lihat | ✅ | ✅** | ✅** |
| Katalog menu: CRUD + foto + COGS | ✅ | ❌ | ❌ |
| Menu varian + SKU linking | ✅ | ❌ | ❌ |
| Tagihan operasional (bills) | ✅ | ❌ | ❌ |
| Manajemen pengguna | ✅ | ❌ | ❌ |
| Setting metode pembayaran + bank | ✅ | ❌ | ❌ |
| Setting PB1 + identitas resto + logo | ✅ | ❌ | ❌ |
| Analitik menu, trend, staff | ✅ | ❌ | ❌ |

> \* Owner secara teknis tidak membuka shift (pemisahan tugas), tapi bisa tutup paksa.
> \*\* Kasir+Waiter bisa lihat menu di layar POS (untuk input order), bukan di halaman `/menu`.

---

## 1. OWNER

Akses penuh ke semua fitur sistem. Tambahan eksklusif dibanding kasir:

### Dashboard
- Laporan keuangan harian / bulanan / tahunan / custom
- Revenue by payment method (Cash, QRIS, EDC, Transfer, GoFood, GrabFood)
- Breakdown revenue per bank (BCA, BRI, dll. untuk EDC & Transfer)
- **Laba kotor = Pendapatan − COGS** (snapshot `unitCost` per transaksi)
- Tagihan operasional bulan ini
- Analitik tab "Menu Performance" — top seller, kontribusi revenue
- Analitik tab "Trend" — grafik harian/mingguan
- Analitik tab "Staff" — transaksi per kasir/waiter
- Reminder: stok porsi hampir habis
- Panel "Shift hari ini" (status semua shift)

### Kasir / POS
- Input order baru (dine-in pilih meja 1–9, takeaway)
- Tambah pesanan ke transaksi yang sudah ada
- Sub-pilihan paket (pilih varian minuman dll.)
- Catatan per item (notes, misal: "Dingin" / "Panas")
- **Proses pembayaran** (pilih metode + bank untuk EDC/Transfer, preview PB1 10%)
- Void transaksi (reverse stok + audit log)

### Meja
- Lihat grid 9 meja (status: kosong / ada pesanan open)
- Navigasi langsung ke POS meja tertentu

### Riwayat Transaksi
- Filter by: tanggal, status (open/paid/void), tipe order (dine-in/takeaway)
- Lihat detail: items, sub-pilihan, notes, total, PB1, payment method
- Void transaksi dari riwayat
- Split bill per item ke transaksi baru
- Merge bill antar meja (gabungkan transaksi)

### Settlement / Tutup Kasir
- Preview rekap harian (system total per metode pembayaran)
- Submit settlement (rekap final hari itu)
- **Review settlement** — owner verifikasi & approve settlement kasir

### Tagihan Operasional (Bills)
- Catat tagihan bulanan (kebersihan / listrik / air / parkir / sewa)
- Filter by bulan/tahun
- Edit / hapus tagihan

### Stok Porsi
- Lihat daftar stok porsi (filter kategori / tampilkan hampir habis)
- Lihat detail stok + riwayat mutasi terbaru
- Restock pagi (batch, kelipatan 5)
- Barang masuk darurat (single, bebas qty)
- Opname (input qty aktual, auto catat selisih sebagai audit log)
- Mark habis (shortcut set qty = 0)

### Katalog Menu
- Tab "Menu": CRUD menu (nama, harga, kategori, stockType, upload foto)
  - Set / ubah modal/COGS menu (owner-only)
  - Lihat riwayat perubahan modal
  - Soft delete + reaktivasi menu
- Tab "Varian / SKU":
  - Buat varian per menu (misal: Teh Tawar Biasa / Teh Tawar Jumbo)
  - Link varian ke SKU stok porsi
  - Set upcharge harga per varian paket
  - Lihat COGS terhitung per SKU

### Pengguna
- Daftar semua pegawai (nama, role, status aktif)
- Tambah pegawai (nama + PIN 6 digit + role)
- Edit nama / PIN / role
- Nonaktifkan pegawai

### Setting (halaman `/payment-methods`)
- Tab "Metode Pembayaran":
  - Tambah / edit metode (nama, warna, icon, requiresBank, allow dine-in/takeaway)
  - Toggle aktif/nonaktif per metode
  - Atur urutan tampil di PaymentModal
  - Assign / unassign bank ke metode EDC / Transfer
- Tab "Bank":
  - Tambah / edit bank (BCA, BRI, Mandiri, dll.)
  - Soft delete bank (toggle isActive)
- Tab "Pajak": toggle PB1 + set rate (default 10%) + pilih tax-borne (customer atau resto)
- Tab "Identitas Resto": nama restoran, alamat, no. telp, jam operasional
- Tab "Logo": upload logo restoran (tampil di login + sidebar)

---

## 2. KASIR

Fokus pada operasi harian (shift, transaksi, stok). Tidak bisa atur master data.

### Dashboard
- Buka kasir: CTA modal pilih tipe shift (pagi / malam) + input opening cash (jika shift belum ada)
- Jika shift aktif: 3 card utama:
  - **Input Order Baru** → link ke POS
  - **Transaksi Open** (badge jumlah meja open) → link ke POS / Meja
  - **Tutup Kasir** → link ke Settlement
- Ringkasan pendapatan hari ini (6 metode pembayaran)
- Reminder stok porsi hampir habis

### Kasir / POS
- *(identik dengan Owner — lihat §1 di atas)*
- Input order, tambah pesanan, sub-pilihan, notes
- **Proses pembayaran**
- Void transaksi

### Meja
- *(identik — lihat §1)*

### Riwayat Transaksi
- *(identik dengan Owner — lihat §1)*

### Settlement / Tutup Kasir
- Preview rekap harian
- Submit settlement (kasir hanya bisa submit shift milik sendiri, tipe malam; owner bisa bypass)
- Lihat detail settlement

### Stok Porsi
- *(identik dengan Owner — lihat §1)*
- Restock pagi, barang masuk, opname, mark habis

---

## 3. WAITER

Fokus pada pengambilan order dan monitoring stok. Tidak menyentuh uang.

### Dashboard
- **Input Order** — CTA besar utama (link langsung ke POS)
- Kartu stok porsi: total item, item hampir habis (≤ min stock), top 5 item mendekati habis
- Quick actions: "Opname Stok Porsi" + "Mark Item Habis"
- Info shift aktif hari ini (kasir shift pagi / malam)

### Kasir / POS
- Input order baru (dine-in pilih meja, takeaway)
- Tambah pesanan ke transaksi meja yang sudah ada
- Sub-pilihan paket, catatan per item
- ❌ Tombol **Bayar** tidak muncul (disembunyikan di UI + ditolak backend)

### Meja
- Lihat grid status meja (kosong / ada pesanan)
- Navigasi ke POS meja tertentu (untuk tambah pesanan)

### Stok Porsi
- Lihat daftar + detail stok porsi
- Restock pagi (batch, kelipatan 5)
- Barang masuk darurat (single)
- Opname
- Mark habis

---

## Catatan Teknis

| Hal | Detail |
|---|---|
| Auth | JWT bearer token. Login: input nama + PIN 6 digit. Device cache 1 nama terakhir (PIN-only numpad utk login berikutnya). Tombol "Ganti Pengguna" reset cache. |
| PB1 | 10% default, owner-configurable. Bisa dibebankan ke customer atau ke resto. Auto-compute saat proses pembayaran. |
| Stok porsi | Auto-decrement saat order submit (bisa minus). Audit log di `portion_movements`. |
| COGS | `Menu.cost` owner-only (tidak tampil di POS). `TransactionItem.unitCost` disnapshot saat order. Laba = revenue − COGS (bukan revenue − bills). |
| Split / Merge | Split: pisah 1+ item dari transaksi ke transaksi baru. Merge: gabungkan beberapa transaksi meja jadi 1 (bayar aggregate). Fitur kasir/owner only. |
| Settlement | 1x per hari. Keyed by business date. Kasir submit shift sendiri (malam); owner bisa bypass. Review = owner only. |
