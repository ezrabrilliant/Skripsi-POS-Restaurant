# Use Case Diagram — Sistem POS Ayam Bakar Banjar Monosuko

Dokumen ini menjelaskan apa itu Use Case Diagram, kegunaannya untuk skripsi, dan isi spesifik Use Case Diagram pada sistem POS Restoran Ayam Bakar Banjar Monosuko.

**Referensi visual:** [`docs/diagrams/use-case-diagram-sistem-pos-restoran.png`](../diagrams/use-case-diagram-sistem-pos-restoran.png)

> ⚠️ **Catatan revisi.** Desain final menghapus use case **Melakukan Stock Opname** (oleh Kasir, sore hari) — stok opname kini hanya pagi oleh Kitchen. Naskah final ([BAB-3-DRAFT.md](BAB-3-DRAFT.md)) memuat **14 use case**, bukan 15. UC tersebut perlu dihapus dari `Skripsi.mdj` saat StarUML dibuka kembali.

---

## 1. Apa itu Use Case Diagram?

> *"Use case diagram adalah diagram yang menunjukkan kebutuhan pengguna terhadap sistem yang akan dibangun. Secara sederhana, dengan membaca use case diagram, dapat diketahui fitur apa yang disediakan dalam sistem tertentu."* — Modul Pembelajaran ADSI Bab 5

Use Case Diagram adalah salah satu diagram UML yang digunakan pada **tahap analisis** untuk mendokumentasikan **Functional Requirements (FR)** — fungsi atau fitur yang harus disediakan sistem dari sudut pandang pengguna. Diagram ini menghubungkan **siapa** (actor) dengan **apa yang dapat dilakukan** (use case) di dalam sistem, tanpa membahas *bagaimana* sistem melakukannya secara teknis.

## 2. Kegunaan dalam Skripsi

1. **Validasi scope fitur** dengan dosen pembimbing dan pemilik restoran sebelum implementasi dimulai.
2. **Menjadi dasar perancangan activity diagram** — setiap use case critical dipecah alurnya di activity diagram.
3. **Menjadi input perancangan sequence diagram** — setiap skenario use case digambarkan interaksinya antar objek.
4. **Batas sistem** — memperjelas apa yang masuk scope (di dalam boundary) dan tidak.

## 3. Elemen Use Case Diagram

| Simbol | Nama | Fungsi |
|---|---|---|
| 🯅 (stick figure) | **Actor** | Role atau pengguna yang berinteraksi dengan sistem dari luar. Kata benda. |
| ⬭ (oval) | **Use Case** | Fitur atau aktivitas yang dapat dilakukan di dalam sistem. Kata kerja + kata benda. |
| ─── (garis lurus) | **Association** | Hubungan actor dengan use case |
| ▭ (rectangle) | **System Boundary** | Batas sistem dengan nama sistem. Aktor di luar, use case di dalam. |
| `<<include>>` (dashed arrow) | **Include dependency** | Wajib: setiap kali base UC dijalankan, included UC pasti juga jalan. Panah menunjuk ke UC yang jalan dulu. |
| `<<extend>>` (dashed arrow) | **Extend dependency** | Opsional: extending UC jalan hanya jika kondisi tertentu. Panah menunjuk ke base UC (yang jalan dulu). |

## 4. Isi Use Case Diagram Sistem POS Restoran

### 4.1. System Boundary
`Sistem POS Restoran` — rectangle yang membatasi 15 use case di dalamnya.

### 4.2. Tiga Actor
- **Owner** (kanan) — pemilik restoran, akses penuh: kelola menu, pengguna, pengeluaran, lihat dashboard + laporan, otorisasi void.
- **Kasir** (kiri) — operasional POS: buka/tutup kasir, kelola pesanan meja, proses pembayaran, opname akhir shift.
- **Kitchen** (kiri bawah) — pegawai dapur/outlet, hanya 1 tugas: input stok masuk pagi (gantikan catatan di buku).

### 4.3. Lima-belas Use Case

**Shared (1):**
- `Login` — autentikasi PIN 6-digit untuk semua role.

**Kasir (9):**
- `Buka Kasir` — input modal awal, start shift.
- `Mengelola Pesanan Meja` — buka meja, tambah/edit item, force-order check.
- `Memecah Tagihan (Split Bill)` — pecah 1 transaksi jadi beberapa invoice.
- `Menggabungkan Tagihan (Merge Bill)` — gabung 2+ transaksi jadi 1.
- `Membatalkan Pesanan` — void, butuh PIN Owner.
- `Memproses Pembayaran` — pilih metode + nominal + kurangi stok otomatis.
- `Mencetak Struk` — opsional, via `<<extend>>` dari Pembayaran.
- `Melakukan Stock Opname` — cocokkan stok fisik akhir shift.
- `Tutup Kasir (Blind Count)` — rekonsiliasi 5-way payment tanpa lihat total sistem.

**Kitchen (1):**
- `Menginput Stok Masuk` — input qty opening_stock pagi per menu.

**Owner (4):**
- `Mengelola Menu` — CRUD katalog menu.
- `Mengelola Pengguna` — CRUD kasir + kitchen user.
- `Mengelola Pengeluaran` — input/edit/hapus pengeluaran harian (kategori + amount).
- `Melihat Dashboard dan Laporan` — 1 UC umbrella: dashboard realtime + laporan pendapatan + laporan pengeluaran + laporan rekonsiliasi + laporan laba kotor.

### 4.4. Empat-belas Dependencies

**13x `<<include>>`** dari main use case ke `Login` — pola umum di skripsi POS (resto X, super X): hampir semua operasi membutuhkan autentikasi dulu.

**1x `<<extend>>`:**
- `Mencetak Struk` `<<extend>>` `Memproses Pembayaran` — cetak struk opsional bergantung apakah customer minta.

## 5. Mengapa Diagram Ini Menjawab Masalah Skripsi

| Rumusan Masalah (Bab 1.2) | Use Case yang menjawab |
|---|---|
| A. Percepat durasi transaksi | `Mengelola Pesanan Meja` + `Memproses Pembayaran` |
| B. Percepat rekonsiliasi + kurangi mismatch | `Tutup Kasir (Blind Count)` |
| C. Manajemen stok harian kurangi mismatch | `Menginput Stok Masuk` + `Melakukan Stock Opname` |
| (latar belakang #4) Owner tidak tau pengeluaran | `Mengelola Pengeluaran` + `Melihat Dashboard dan Laporan` |

## 6. Narasi untuk Bab 3 Skripsi (paste-ready)

> **3.4.1 Use Case Diagram**
>
> Use case diagram pada Gambar 3.X mendeskripsikan interaksi antara pengguna dengan Sistem POS Restoran yang akan dibangun. Sistem melibatkan tiga aktor: Owner sebagai pemilik restoran dengan akses penuh terhadap master data, pengeluaran, dan laporan; Kasir sebagai operator POS yang menangani transaksi harian; dan Kitchen sebagai pegawai dapur yang bertanggung jawab atas input stok masuk pagi hari.
>
> Sistem menyediakan lima belas use case yang terbagi dalam empat domain: (1) autentikasi melalui Login yang wajib dilakukan oleh semua aktor; (2) operasional kasir meliputi buka kasir, kelola pesanan meja termasuk split dan merge bill, proses pembayaran, cetak struk, serta tutup kasir dengan blind count; (3) manajemen stok harian oleh Kitchen melalui input stok masuk dan oleh Kasir melalui stock opname akhir shift; dan (4) master data serta monitoring oleh Owner mencakup kelola menu, pengguna, pengeluaran, dan dashboard laporan.
>
> Hubungan `<<include>>` ditunjukkan dari setiap use case operasional ke Login, menandakan bahwa autentikasi merupakan prasyarat wajib. Sedangkan `<<extend>>` ditunjukkan dari `Mencetak Struk` ke `Memproses Pembayaran`, menandakan bahwa pencetakan struk hanya dilakukan jika pelanggan memintanya.

## 7. Elemen Visual Diagram

Saat membaca diagram di `docs/diagrams/use-case-diagram-sistem-pos-restoran.png`, perhatikan:

- **Garis solid** actor ↔ use case = association
- **Garis putus-putus berlabel `<<include>>`** = dependency wajib (konvergen ke `Login`)
- **Garis putus-putus berlabel `<<extend>>`** = dependency opsional (`Mencetak Struk` → `Memproses Pembayaran`)
- **Rectangle luar** berlabel `Sistem POS Restoran` = system boundary

## 8. Referensi Konvensi

- **ADSI Bab 5** — Modul Pembelajaran ADSI (`docs/extracted/adsi.txt`)
- Skill: `.claude/skills/use-case-diagram/SKILL.md`
- Pattern dari 3 skripsi POS UK Petra (resto X cross-channel, supermarket ABC-VED, toko inventory)

## 9. Bad Practice yang Dihindari

- ❌ Over-split use case — misal `Melihat Dashboard`, `Melihat Laporan Pendapatan`, `Melihat Laporan Pengeluaran`, `Melihat Laporan Laba Kotor`, `Melihat Laporan Rekonsiliasi` (5 UC terpisah untuk hal yang sama: monitoring)
  - ✅ Konsolidasi jadi `Melihat Dashboard dan Laporan` (1 UC)
- ❌ Use case berupa UI click (`Click Tombol Submit`) atau technical primitive (`Validate Input`)
  - ✅ Pakai business goal (`Memproses Pembayaran`)
- ❌ Actor-to-actor line langsung
  - ✅ Jika dua aktor koordinasi, pakai shared use case atau generalization
- ❌ Use case tanpa association ke actor manapun (orphan)
  - ✅ Setiap use case minimal 1 aktor
