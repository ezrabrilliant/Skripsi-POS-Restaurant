# Activity Diagram — Sistem POS Ayam Bakar Banjar Monosuko

Dokumen ini menjelaskan apa itu Activity Diagram, kegunaannya untuk skripsi, dan isi activity diagram yang menggambarkan alur kerja operasional sistem POS.

**Referensi visual:** lihat folder [`docs/diagrams/`](../diagrams/) — file PNG dengan prefix `activity-diagram-*`.

> ⚠️ **Catatan revisi.** Desain final menetapkan **stok opname hanya pagi** (oleh Kitchen). Activity Diagram **Stock Opname Sore** (oleh Kasir) yang masih tercantum di dokumen ini & di `Skripsi.mdj` sudah **tidak dipakai** — naskah final ([BAB-3-DRAFT.md](BAB-3-DRAFT.md)) memuat 6 activity diagram, bukan 7. Diagram Sore perlu dihapus dari `Skripsi.mdj` saat StarUML dibuka kembali.

---

## 1. Apa itu Activity Diagram?

> *"Activity diagram merupakan penggambaran workflow (aliran kerja) atau aktivitas dari sebuah sistem proses bisnis atau menu yang ada pada perangkat lunak."* — Sukamto & Shalahuddin 2016 (dikutip di Modul ADSI Bab 7)

Activity Diagram adalah diagram UML yang menunjukkan **dynamic behavior sistem** — urutan langkah-langkah (aktivitas), keputusan (decision), dan paralelisme (fork/join) dalam suatu proses bisnis. Diagram ini dibuat **berdasarkan use case** — setiap use case critical dipecah alurnya di activity diagram.

## 2. Kegunaan dalam Skripsi

1. **Visualisasi alur bisnis** untuk validasi dengan stakeholder (pemilik restoran, pegawai) — gampang dipahami orang awam.
2. **Input bagi programmer** — alur langkah demi langkah menjadi panduan implementasi.
3. **Dokumentasi decision rule** — semua percabangan (stok cukup? minta struk?) terdokumentasi visual.
4. **Bab 3 skripsi** — setiap use case non-trivial dijelaskan alurnya lewat activity diagram + narasi.

## 3. Elemen Activity Diagram

| Simbol | Nama | Fungsi |
|---|---|---|
| ● (filled circle) | **Initial Node / Start** | Titik mulai. Hanya 1 per diagram. |
| ◉ (bullseye) | **Activity Final Node / End** | Titik akhir. Boleh lebih dari satu (contoh CRUD dengan multiple exit). |
| ⬭ (rounded rectangle) | **Action** | Sebuah langkah atau aktivitas. Verb phrase bahasa bisnis. |
| ◇ (diamond) | **Decision** | Percabangan exclusive (pilih 1 path). Label = pertanyaan. |
| ◇ (diamond, N incoming) | **Merge** | Konvergensi setelah decision. |
| ▬ (solid bar) | **Fork / Join** | Parallel split / sync. Jarang dipakai di POS (alur biasanya sequential). |
| ║ (vertical lanes) | **Swimlane / Activity Partition** | Kolom yang mengelompokkan action per aktor. |

## 4. Konvensi Penting

### 4.1. Action Naming
- Bahasa bisnis, verb phrase, **bukan** SQL / field names / pseudocode.
- Pilih 1 gaya dan konsisten: **Title Case Indonesian** (contoh: `Membuka Halaman Supplier`) atau lowercase Indonesian.

❌ Bad: `Query daily_menu_stocks WHERE date=today`
✅ Good: `Cek ketersediaan stok hari ini`

### 4.2. Decision Labeling
Simbol diamond sendiri tidak menunjukkan pertanyaan — label harus jelas untuk screenshot. Tiga style yang dipakai di skripsi (semua valid):
- **Teks di dalam diamond**: `Stok cukup?`, `Apakah data duplikat`
- **Teks di atas/samping diamond**
- **Action precedes**: action "Cek stok" lalu diamond polos dengan guards jelas

### 4.3. Guard Labels
Plain text **tanpa bracket**, Title Case:
- `Ya` / `Tidak`
- `Stok cukup` / `Stok kurang`
- `Minta struk` / `Tidak`

### 4.4. Single In/Out Rule
> *"Setiap aksi hanya mendapat satu alur masuk dan satu alur keluar"* — ADSI §7

Percabangan/penggabungan lewat Decision/Merge, bukan dari action langsung.

## 5. Tujuh Activity Diagram Sistem POS

### 5.1. `activity-diagram-login.png` (A.1)

**Source Use Case:** `Login` (shared, prasyarat 13 UC lainnya via `<<include>>`)
**Swimlane:** User (Owner/Kasir/Kitchen) | Sistem
**Tujuan:** Autentikasi PIN 6-digit sebelum masuk sistem. Role menentukan halaman landing.

**Alur singkat:**
1. [User] Membuka Aplikasi POS → [Sistem] Menampilkan Layar Login PIN
2. [User] Memasukkan PIN 6 Digit → [Sistem] Memvalidasi PIN (lookup by PIN + cek role)
3. [Sistem] Decision **PIN valid?**
   - Tidak → [User] Menerima Pesan PIN Salah → loop kembali ke Memasukkan PIN
   - Ya → [Sistem] Menampilkan Dashboard Sesuai Role (Owner/Kasir/Kitchen) → End

Garis alur melintasi partition User ↔ Sistem beberapa kali untuk menegaskan siapa yang bertanggung jawab atas tiap langkah — pola yang sama dengan Activity Diagram Login pada skripsi POS resto cross-channel (Gambar 3.4 pada referensi).

### 5.2. `activity-diagram-order-flow.png` (S.4)

**Source Use Case:** `Mengelola Pesanan Meja` + `Memproses Pembayaran` (bagian order sebelum bayar)
**Swimlane:** Kasir | Sistem
**Tujuan:** Menjawab masalah #2 — kasir iya-kan order tanpa cek stok → force order logic.

**Alur singkat:**
1. Kasir pilih meja kosong → buka pesanan meja → pilih menu & qty
2. Sistem cek ketersediaan stok hari ini
3. Decision **Stok cukup?**
   - Ya → Catat pesanan & kurangi stok
   - Tidak → Decision **Force order?**
     - Ya → Konfirmasi + catat dengan flag `is_force_order=true` (stok max 0)
     - Tidak → Batalkan item
4. Merge semua path → Decision **Tambah item lagi?**
   - Ya → loop kembali ke pilih menu
   - Tidak → Simpan pesanan sebagai open → End

### 5.3. `activity-diagram-pay-flow.png` (A.4)

**Source Use Case:** `Memproses Pembayaran` + `Mencetak Struk`
**Swimlane:** Kasir | Sistem
**Tujuan:** Menjawab rumusan masalah A — percepat durasi transaksi.

**Alur singkat:**
1. Kasir pilih bayar untuk meja → Sistem ambil daftar pesanan meja
2. Kasir tampilkan rincian → pilih metode pembayaran → input nominal
3. Decision **Nominal cukup?** Jika kurang, loop kembali input
4. Sistem tandai pesanan sebagai lunas + catat ke rekap harian
5. Decision **Minta struk?** Jika ya → cetak struk
6. Tampilkan konfirmasi pembayaran → End

### 5.4. `activity-diagram-stock-opname-pagi-kitchen.png` (A.2)

**Source Use Case:** `Menginput Stok Masuk`
**Swimlane:** Kitchen | Sistem
**Tujuan:** Menjawab masalah #1 — pegawai lupa opname pagi → gantikan catatan manual di buku.

**Alur singkat:**
1. Kitchen login → Sistem ambil daftar menu aktif → tampilkan daftar
2. Kitchen input jumlah stok pagi per menu (loop per-menu)
3. Sistem simpan stok awal hari ini ke `daily_menu_stocks`
4. Decision **Semua menu selesai?** Jika tidak, loop input
5. Tandai opname pagi selesai (opname_done=true) → End

### 5.5. `activity-diagram-stock-opname-sore-kasir.png` (A.8)

**Source Use Case:** `Melakukan Stock Opname`
**Swimlane:** Kasir | Sistem
**Tujuan:** Rekonsiliasi stok fisik vs sistem akhir shift — deteksi selisih.

**Alur singkat:**
1. Kasir mulai opname akhir shift → Sistem ambil daftar menu + stok sistem
2. Kasir input qty fisik aktual per menu (loop)
3. Sistem hitung **selisih stok** = actual − current_stock
4. Decision **Semua menu dihitung?** Jika tidak, loop
5. Simpan hasil opname → tampilkan rekap selisih → End

### 5.6. `activity-diagram-tutup-kasir-blind-count.png` (A.9)

**Source Use Case:** `Tutup Kasir (Blind Count)`
**Swimlane:** Kasir | Sistem
**Tujuan:** Menjawab rumusan masalah B — percepat rekonsiliasi + deteksi mismatch 5-way payment.

**Alur singkat (14 langkah):**
1. Kasir klik Tutup Kasir → Sistem periksa apakah ada pesanan belum dibayar
2. Decision **Ada pesanan belum dibayar?**
   - Ya → tampilkan peringatan → End (early exit)
   - Tidak → lanjut
3. Sistem tampilkan form rekonsiliasi (**tanpa total dari sistem** — blind count)
4. Kasir input jumlah fisik per metode (cash / qris / transfer / debit_credit / ojol)
5. Sistem hitung total penjualan per metode dari sistem
6. Hitung **selisih per metode** (actual − system) → rekap + total over/short
7. Simpan hasil rekonsiliasi (status=submitted) → Tutup shift → End

### 5.7. `activity-diagram-mencatat-pengeluaran.png` (A.10)

**Source Use Case:** `Mengelola Pengeluaran`
**Swimlane:** Owner | Sistem
**Tujuan:** Menjawab masalah #4 — owner tidak tau pengeluaran bulanan.

**Alur singkat:**
1. Owner buka halaman pengeluaran → Sistem tampilkan form
2. Owner input tanggal + kategori (enum 5 kategori) + jumlah + deskripsi
3. Submit → Sistem validasi input
4. Decision **Input valid?**
   - Tidak → pesan kesalahan, loop input
   - Ya → simpan data pengeluaran → tampilkan konfirmasi → End

## 6. Narasi Umum untuk Bab 3 Skripsi

> **3.4.2 Activity Diagram**
>
> Activity diagram pada sub-bab ini menggambarkan alur kerja sistem POS Restoran untuk proses-proses kritis yang teridentifikasi di Use Case Diagram. Sistem memiliki tujuh activity diagram yang mencakup: (1) alur autentikasi Login dengan PIN 6-digit sebagai prasyarat seluruh fungsi sistem; (2) alur order pesanan meja dengan logika force-order saat stok kurang; (3) alur pembayaran dengan dukungan enam metode pembayaran dan opsi cetak struk; (4) alur input stok masuk pagi oleh Kitchen yang menggantikan pencatatan manual di buku; (5) alur stock opname akhir shift untuk deteksi selisih stok; (6) alur tutup kasir dengan blind count yang wajib dilakukan kasir tanpa melihat total sistem guna mendeteksi mismatch; dan (7) alur mencatat pengeluaran harian oleh Owner.
>
> Setiap activity diagram menggunakan swimlane untuk memisahkan tanggung jawab aktor (Kasir, Owner, Kitchen) dari sistem. Setiap aksi dinyatakan dalam bahasa bisnis yang mudah dipahami oleh pegawai non-teknis, dengan detail teknis (query database, format API, kalkulasi) tersembunyi di spesifikasi internal sistem. Setiap decision diberi nama pertanyaan (misalnya "Stok cukup?" atau "Minta struk?") dengan guard `Ya`/`Tidak` pada masing-masing cabang untuk menjaga keterbacaan.

## 7. Referensi Konvensi

- **ADSI Bab 7** — Modul Pembelajaran ADSI
- Skill: `.claude/skills/activity-diagram/SKILL.md`
- Pattern dari 3 skripsi POS UK Petra — observed via PDF rendering di `docs/pdf-pages/`

## 8. Bad Practice yang Dihindari

- ❌ Action berisi SQL/code (`Query daily_menu_stocks WHERE ...`, `Insert expenses row (paid_by=...)`)
  - ✅ Verb phrase bahasa bisnis (`Cek ketersediaan stok hari ini`, `Simpan data pengeluaran`)
- ❌ Decision diamond tanpa label pertanyaan
  - ✅ Kasih nama: `Stok cukup?`, `Input valid?`, `Ada pesanan belum dibayar?`
- ❌ Multiple redundant merge (chain Merge → Merge tanpa nilai tambah)
  - ✅ Konsolidasi — semua exclusive path konvergen ke 1 Merge sebelum node berikutnya
- ❌ Guard dengan bracket `[ya]` dan huruf kecil
  - ✅ `Ya` / `Tidak` Title Case tanpa bracket (match skripsi style)
- ❌ Fork/Join untuk alur exclusive (bukan paralel)
  - ✅ Gunakan Decision+Merge; Fork/Join hanya untuk paralelisme nyata
