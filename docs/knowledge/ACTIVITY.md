# Activity Diagram - Sistem POS Ayam Bakar Banjar Monosuko (REV 2.13)

> **Status:** REV 2.13 (2026-06-02) - diselaraskan ke kode nyata (`backend/prisma/schema.prisma` + modul backend/frontend). Total activity diagram **11** (A.1–A.11). Drop dari REV lama: ~~Opname Raw Materials~~ + ~~Mencatat Pembelian~~ (subsistem belanja/raw-materials dihapus di REV 2.11) dan ~~Split Bill~~ (diganti **Split Tender** - banyak metode bayar / 1 transaksi via `transaction_payments`). Tutup Kasir (A.5) dan Setoran Akhir Hari/Settlement (A.6) kini **dipisah** (dulu tergabung). Tambahan: A.3 dengan split-tender, A.4 Buka Kasir window-aware, A.11 Kelola Menu + Modal/COGS. Lihat [`docs/superpowers/specs/2026-05-30-cogs-per-menu-remove-belanja-design.md`](../superpowers/specs/2026-05-30-cogs-per-menu-remove-belanja-design.md) dan [`docs/superpowers/specs/2026-05-29-shift-redesign-design.md`](../superpowers/specs/2026-05-29-shift-redesign-design.md). Input order kasir & waiter (REV 2.4).
> **Sumber alur bisnis:** [`docs/operasional-resto.md`](../operasional-resto.md) (sumber kebenaran tertinggi)
> **Design spec turunan:** [`docs/superpowers/specs/2026-05-24-permission-matrix-design.md`](../superpowers/specs/2026-05-24-permission-matrix-design.md)
> **Use Case parent:** [`USE-CASE.md`](USE-CASE.md) (REV 2.13)
> **ERD pasangan:** [`ERD.md`](ERD.md) (REV 2.13)
> **Visual:** ✅ Semua 11 activity diagram (A.1–A.11) sudah dibangun di `Skripsi.mdj` dengan swimlane sesuai aktor + sistem, bahasa manusia per SKILL §2, dan **tiap diagram tepat 1 initial node + 1 activity final node** (semua cabang/early-exit bermuara ke satu final node, bukan banyak final terpisah).

> ⚠️ **WAJIB pakai skill `.claude/skills/activity-diagram/SKILL.md` saat build activity diagram di StarUML.** Skill berisi pattern proven untuk:
> - Pre-build swimlane (UMLActivityPartition) BEFORE nodes (avoid orphan)
> - Update partition.nodes via HTTP direct (MCP tool bug stringify value)
> - Bahasa action manusiawi (NO technical jargon: `transaction_payments`, `portion_stocks`, `decrement`, `reason=order` DILARANG di kanvas diagram)
> - UMLActivityFinalNode (bullseye) bukan UMLFinalNode
> - Pattern lengkap §8a-§8g + §2 action naming dengan rename table
>
> Action name di SKILL §2 jadi single source of truth. Step-by-step description di MD ini boleh pakai bahasa lebih teknis untuk implementer reference, tapi yang masuk diagram WAJIB pakai bahasa manusia per SKILL §2.

> ⚠️ **REV 2.13:** Total **11 activity diagram**.
>
> Mapping diagram REV 2.13 (11 diagram):
> - A.1 Login (form input nama + PIN murni)
> - A.2 Mengelola Pesanan (swimlane Waiter | Kasir | Sistem; input order kasir & waiter via HP, kertas opsional; dine-in/takeaway + paket + loop multi-item + kurangi stok; pembayaran dipisah ke A.3)
> - A.3 Memproses Pembayaran (PB1 owner-configurable + bank picker EDC/transfer + loop **split-tender** + finalize/cascade merge + opsi cetak struk)
> - A.4 Buka Kasir (window-aware + single-OPEN guard + serah-terima)
> - A.5 Tutup Kasir (mode final / handover)
> - A.6 Setoran Akhir Hari / Settlement (whole business day + blind count + variance + review owner)
> - A.7 Restock Stok Porsi Pagi (kelipatan 5)
> - A.8 Mencatat Barang Masuk (restock darurat)
> - A.9 Opname Stok Porsi
> - A.10 Mencatat Tagihan Bulanan (owner only)
> - A.11 Kelola Menu dan Modal/COGS (owner only)
>
> **DROP dari doc lama:** ~~Opname Raw Materials~~ + ~~Mencatat Pembelian~~ (subsistem belanja/raw-materials dihapus REV 2.11) + ~~Split Bill / party_id~~ (diganti **Split Tender**; `party_id` sudah dihapus dari schema). Merge bill tetap ada (self-ref `merged_into_id`) dan kini menjadi bagian dari A.3.

---

## 1. Apa itu Activity Diagram?

> *"Activity diagram merupakan penggambaran workflow (aliran kerja) atau aktivitas dari sebuah sistem proses bisnis atau menu yang ada pada perangkat lunak."* - Sukamto & Shalahuddin 2016 (dikutip di Modul ADSI Bab 7)

Activity Diagram adalah diagram UML yang menunjukkan **dynamic behavior sistem** - urutan langkah-langkah (action), keputusan (decision), dan paralelisme (fork/join) dalam suatu proses bisnis. Diagram ini dibuat **berdasarkan use case** - setiap UC critical dipecah alurnya.

## 2. Kegunaan untuk Skripsi

1. **Visualisasi alur bisnis** untuk validasi dengan stakeholder.
2. **Input bagi programmer** - alur langkah demi langkah jadi panduan implementasi.
3. **Dokumentasi decision rule** - semua percabangan (tipe order dine-in? input bank? bayar penuh? mau cetak struk?) terdokumentasi visual.
4. **Bab 3 skripsi** - setiap UC non-trivial dijelaskan alurnya via activity + narasi.

## 3. Elemen Activity Diagram

| Simbol | Nama | Fungsi |
|---|---|---|
| ● filled circle | **Initial Node** | Start, **tepat 1 per diagram** |
| ◉ bullseye | **Activity Final Node** | End, **tepat 1 per diagram** (semua cabang & early-exit bermuara ke sini) |
| ⬭ rounded rectangle | **Action** | Langkah aktivitas. Verb phrase bahasa bisnis. |
| ◇ diamond | **Decision** | Percabangan exclusive. Label = pertanyaan. |
| ◇ diamond (N incoming) | **Merge** | Konvergensi setelah decision |
| ▬ solid bar | **Fork / Join** | Parallel split / sync (jarang dipakai di POS) |
| ║ vertical lanes | **Swimlane / Partition** | Kolom mengelompokkan action per aktor |

## 4. Konvensi Penting

### 4.1. Action Naming
Bahasa bisnis, verb phrase, **bukan SQL / field names / pseudocode**.

❌ `Query portion_stocks WHERE menu_id=?`
✅ `Cek stok porsi item yang dipesan`

### 4.2. Decision Labeling
Diamond wajib punya nama pertanyaan agar visible di screenshot.

✅ `Tipe order dine-in?`, `Item paket?`, `Pelanggan minta struk?`, `Metode butuh bank?`, `Tagihan sudah lunas?`

### 4.3. Guard Labels
Plain text tanpa bracket, Title Case: `Ya` / `Tidak`, `Cash` / `EDC` / `QRIS` / ...

### 4.4. Single In/Out Rule
> "Setiap aksi hanya mendapat satu alur masuk dan satu alur keluar" - ADSI §7

Percabangan/penggabungan lewat Decision/Merge, bukan dari action langsung.

### 4.5. Satu Initial + Satu Final per Diagram (REV 2.13)
Tiap activity diagram memiliki **tepat satu** initial node dan **tepat satu** activity final node. Semua jalur, termasuk jalur early-exit (mis. validasi gagal yang sudah menampilkan pesan, atau tutup kasir yang dibatalkan karena masih ada transaksi terbuka), dikonvergensikan ke satu final node lewat merge node. Ini menjaga keterbacaan dan konsistensi antar diagram.

## 5. Sebelas Activity Diagram REV 2.13

### 5.1. `activity-diagram-login.png` (A.1)

**Source UC:** `Login` (shared, prasyarat 20 UC lainnya via `<<include>>`)
**Swimlane:** User (Owner/Kasir/Waiter) | Sistem
**Tujuan:** Autentikasi via form 2 field (nama pengguna + PIN). **Tidak ada layar pilih nama dari daftar / list picker** - semua pegawai mengetik nama mereka manual. PIN boleh duplikat antar pegawai (identifikasi via nama).

**Alur:**
1. [User] Membuka Aplikasi POS
2. [Sistem] Menampilkan Form Login (2 field: nama pengguna + PIN)
3. [User] Mengisi Nama Pengguna
4. [User] Mengisi PIN 6 digit
5. [User] Mengirim Form Login
6. [Sistem] Memvalidasi Nama dan PIN (lookup user by name + cek PIN match)
7. Decision **Nama dan PIN Benar?**
   - Tidak → [Sistem] Menampilkan Pesan Kesalahan, loop balik ke step 3 (user mengisi ulang via merge node)
   - Ya → [Sistem] Membuka Dashboard Sesuai Peran (Owner / Kasir / Waiter) → Final Node

### 5.2. `activity-diagram-mengelola-pesanan.png` (A.2 - input order kasir & waiter; dine-in + takeaway + paket)

**Source UC:** `Mengelola Pesanan` (+ «extend» `Memilih Varian/Paket`)
**Swimlane:** **Waiter | Kasir | Sistem** (3 swimlanes)
**Tujuan:** Mencatat pesanan pelanggan ke POS. Alur dibedakan berdasarkan tipe order:
- **Dine-in**: pelanggan duduk di meja → waiter dapat langsung input dari HP, atau menuliskan di kertas lalu diserahkan ke kasir untuk diinput.
- **Takeaway** (walk-in, GoFood, GrabFood, gosend): umumnya kasir input langsung ke POS tanpa perantara waiter. Sumber takeaway dibedakan nanti via metode pembayaran di A.3.

**Catatan REV 2.4 - Input order :** Baik waiter maupun kasir dapat menginput pesanan langsung ke POS via HP masing-masing. Alur keduanya **identik** dari step input item onwards - yang berbeda hanya actor di swimlane (Waiter atau Kasir). Sistem backend menerima `POST /transactions` dari kedua role (route POST terbuka untuk semua role authenticated), dan dashboard waiter maupun kasir sama-sama menyediakan akses Input Order sebagai aksi utama. Menuliskan order di kertas lalu menyerahkannya ke kasir merupakan cara alternatif yang opsional.

Pembayaran terpisah di **A.3 Memproses Pembayaran** (owner + kasir; waiter tidak punya akses payment). Tidak ada force-order modal - stok porsi boleh minus normal.

**Alur:**
1. Decision **Tipe Order?**
   - **Dine-in** → jalur via Waiter / Kasir (pilih meja)
   - **Takeaway** → langsung tanpa meja

**Jalur Dine-in:**
2. [Waiter/Kasir] Menerima Pesanan dari Pelanggan (di meja); waiter dapat input langsung dari HP atau menuliskan di kertas lalu diserahkan ke kasir
3. [Waiter/Kasir] Memilih Tipe Dine-in di POS
4. [Waiter/Kasir] Memilih Nomor Meja (dari 9 meja: 2 kapasitas 6, 7 kapasitas 4)
5. [Sistem] Membuka Transaksi Meja (deteksi transaksi open existing untuk multi-round; jika belum ada, buat baru; auto-resolve shift aktif) → lanjut ke step 8

**Jalur Takeaway:**
6. [Kasir/Waiter] Memilih Tipe Takeaway di POS
7. [Sistem] Membuat Transaksi Takeaway (tanpa meja; auto-resolve shift aktif) → lanjut ke step 8

**Input item ke POS:**
8. [Sistem] Menampilkan Form Pesanan (grid menu per kategori: Signature, Seafood, Sayur & Sup, Side Dish, Minuman, Paket Hemat)
9. [Kasir/Waiter] Memilih Item Menu dari grid
10. Decision **Item Punya Varian / Paket?**
    - Ya → [Kasir/Waiter] Memilih Varian atau Pilihan Paket (mis. Paha vs Dada, Bakar vs Goreng, jenis minuman) - «extend» `Memilih Varian/Paket`
    - Tidak → langsung gunakan menu sebagai item
11. Decision **Tambah Catatan Item?**
    - Ya → [Kasir/Waiter] Menambahkan Catatan (mis. "kurang manis", quick toggle "Panas"/"Dingin" untuk teh & jeruk yang ambigu suhu)
    - Tidak → lanjut
12. [Sistem] Menambahkan Item ke Pesanan (cart)
13. Decision **Tambah Item Lagi?**
    - Ya → loop balik ke step 9
    - Tidak → lanjut
14. [Kasir/Waiter] Mengirim Pesanan
15. [Sistem] Mengurangi Stok Porsi untuk tiap item yang men-decrement stok porsi (stockType=portion atau varian dengan stock target; boleh minus) + Mencatat Log Perubahan Stok
16. [Sistem] Menyimpan Pesanan status=open (tunggu pembayaran di A.3) → Final Node

**Catatan:**
- Multi-round (customer nambah pesanan setelah pesanan pertama): cukup ulangi A.2 untuk meja yang sama - sistem deteksi transaksi open existing dan append item baru ke transaksi tersebut.
- Pilihan varian/paket (step 10) digambar sebagai decision sederhana; detail mapping pilihan → stok porsi target ada di logic backend (`menu_variants.stock_target_menu_id`, `paket_components`/`paket_choice_options`).

### 5.3. `activity-diagram-memproses-pembayaran.png` (A.3 - PB1 owner-configurable + split-tender + bank picker + merge)

**Source UC:** `Memproses Pembayaran [Split Tender]` (+ «extend» `Mencetak Struk`) + `Menggabungkan Pesanan/Meja`
**Swimlane:** Kasir | Sistem
**Tujuan:** Proses pembayaran 1 transaksi yang boleh dibayar dengan **banyak metode (split tender)**, dengan PB1 owner-configurable + bank picker untuk metode yang butuh bank + opsi cetak struk PDF. Jika transaksi merupakan gabungan beberapa meja (merge bill), pembayaran transaksi induk meng-cascade ke transaksi sumber.

**Catatan PB1 (owner-configurable, 2 sumbu):** PB1 dikendalikan `app_settings` (`taxEnabled`, `taxRate`, `taxChargedToCustomer`). DEFAULT OFF di resto ini (harga menu = final). Jika `taxEnabled=true` dan `taxChargedToCustomer=true` → PB1 ditambahkan ke total pelanggan (`taxAmount`). Jika `taxEnabled=true` dan `taxChargedToCustomer=false` → PB1 **ditanggung resto** (`taxBorneAmount`, **TIDAK** masuk total pelanggan; dikurangkan ke laba di dashboard). Jika `taxEnabled=false` → tidak ada PB1.

**Catatan Split Tender (BUKAN split bill):** 1 transaksi dapat memiliki banyak slice pembayaran (`transaction_payments`), mis. Cash 100.000 + QRIS 65.000. Tidak ada pemecahan per-pelanggan/per-item (`party_id` sudah dihapus). Selama total terbayar < total transaksi, kasir menambah slice lagi.

**Alur:**
1. [Kasir] Pilih "Bayar" pada transaksi open
2. Decision **Transaksi Hasil Merge?**
   - Ya → [Sistem] Konsolidasi item dari semua transaksi sumber ke transaksi induk (sumber sudah ber-`merged_into_id` ke induk)
   - Tidak → lanjut
3. [Sistem] Tampilkan rincian: subtotal, diskon (input opsional), PB1 sesuai `app_settings`, total
4. [Kasir] Input diskon manual (opsional)
5. [Sistem] Hitung total = subtotal − diskon + PB1-ditagih (PB1-ditanggung-resto dicatat terpisah, tidak masuk total)
6. [Sistem] Tampilkan metode pembayaran aktif yang sesuai tipe order (dari master `payment_methods`, filter `allowDineIn`/`allowTakeaway`)
7. [Kasir] Pilih metode pembayaran untuk slice ini
8. Decision **Metode Butuh Bank?**
   - Ya → [Sistem] Tampilkan bank picker (daftar bank terkait metode dari junction) → [Kasir] Pilih bank
   - Tidak → skip bank input
9. [Kasir] Input nominal slice (default = sisa tagihan)
10. [Sistem] Catat slice pembayaran (metode + bank + nominal)
11. Decision **Tagihan Sudah Lunas (Σ slice ≥ total)?**
    - Tidak → loop balik ke step 7 (tambah slice / split tender)
    - Ya → lanjut
12. [Sistem] Finalisasi transaksi: set status=paid, paidAt=now (atomic + idempotent); jika hasil merge, cascade status=paid + total=0 ke transaksi sumber
13. Decision **Pelanggan Minta Struk?**
    - Ya → [Sistem] Generate struk PDF → simpan/cetak di device kasir - «extend» `Mencetak Struk`
    - Tidak → skip
14. [Sistem] Tampilkan konfirmasi pembayaran (+ kembalian jika cash) → Final Node

### 5.4. `activity-diagram-buka-kasir.png` (A.4 - window-aware + single-OPEN guard)

**Source UC:** `Buka Kasir`
**Swimlane:** Kasir | Sistem
**Tujuan:** Kasir membuka shift dengan modal awal sebelum bisa transaksi. Buka shift divalidasi terhadap **window operasional owner-configurable** (`app_settings`: timezone + `shiftPagiStart`/`shiftChangeover`/`shiftMalamEnd`) dan dijaga **single-OPEN guard sistem-wide** (`shifts.active_marker` UNIQUE - hanya boleh ada satu shift OPEN di seluruh sistem pada satu waktu).

**Catatan aturan window:** Shift pagi boleh dibuka selama belum lewat changeover. Shift malam boleh dibuka setelah changeover, atau lebih dini sebagai **serah-terima** jika shift pagi sudah pernah dibuka hari itu. Di luar window → ditolak (`out_of_window`). Reopen dalam window diperbolehkan (mis. typo modal awal, tutup lalu buka lagi).

**Alur:**
1. [Kasir] Klik "Buka Kasir"
2. [Sistem] Cek single-OPEN guard (apakah sudah ada shift OPEN di sistem)
3. Decision **Sudah Ada Shift Aktif?**
   - Ya → [Sistem] Tampilkan info shift aktif + opsi serah-terima → menuju langkah penutup (lihat A.5) → Final Node
   - Tidak → lanjut
4. [Sistem] Tampilkan dialog buka shift (pilih tipe pagi/malam window-aware + input modal awal)
5. [Kasir] Pilih tipe shift + input modal awal
6. [Sistem] Validasi terhadap window operasional (jam saat ini vs window + apakah pagi sudah dibuka untuk serah-terima)
7. Decision **Dalam Window Operasional?**
   - Tidak → [Sistem] Tampilkan pesan "di luar jam operasional shift" → Final Node
   - Ya → lanjut
8. [Sistem] Buat shift baru (set active_marker, tentukan business day dari window) → Final Node

### 5.5. `activity-diagram-tutup-kasir.png` (A.5 - mode final / handover)

**Source UC:** `Tutup Kasir`
**Swimlane:** Owner / Kasir | Sistem
**Tujuan:** Menutup shift. Dua mode: **final** (penutupan untuk hari itu - memblok jika masih ada transaksi terbuka) dan **handover** (serah-terima ke shift berikutnya - membawa carry, transaksi open boleh tetap diteruskan). Setoran/settlement **terpisah** di A.6 (dilakukan whole business day, tidak otomatis tergabung di tutup kasir).

**Catatan permission:** Kasir boleh tutup shift sendiri; owner boleh tutup shift kasir mana pun. Untuk mode final oleh non-pemilik shift, sistem mengizinkan bila shift sudah "stale" (lewat window) - jika tidak, ditolak.

**Alur:**
1. [Kasir/Owner] Klik "Tutup Kasir" → pilih mode (final / handover)
2. Decision **Mode Penutupan?**
   - **Final** → lanjut ke step 3
   - **Handover** → ke step 6
3. [Sistem] Cek apakah masih ada transaksi belum dibayar di shift ini
4. Decision **Ada Transaksi Belum Dibayar?**
   - Ya → [Sistem] Tampilkan peringatan + daftar meja yang masih terbuka (mode final ditolak; selesaikan dulu) → Final Node
   - Tidak → lanjut ke step 6
5. (mode final lolos cek) → lanjut ke step 6
6. [Sistem] Set `shifts.closed_at=now`, lepas active_marker (shift tidak lagi OPEN)
7. [Sistem] Tampilkan konfirmasi penutupan shift (mode final: hari siap untuk setoran A.6; mode handover: kasir berikutnya dapat buka shift) → Final Node

### 5.6. `activity-diagram-setoran-akhir-hari.png` (A.6 - whole business day + blind count + variance)

**Source UC:** `Setoran Akhir Hari` + `Mereview Settlement`
**Swimlane:** Kasir Penutup | Owner | Sistem
**Tujuan:** Setoran rekap **satu hari bisnis penuh** (whole business day, keyed `@@unique([date])`), bukan per shift. Penyetor adalah **kasir yang menutup shift terakhir hari itu atau owner** (bukan lagi "kasir malam only"). Bentuknya **blind count** (kasir input hitungan fisik tanpa melihat angka sistem dulu), lalu sistem hitung variance per metode secara dinamis dari `transaction_payments`. Rekap per-metode dinamis (`settlement_method_counts`), bukan 12 kolom tetap.

**Alur:**
1. [Kasir Penutup] Klik "Setoran Akhir Hari" setelah shift terakhir hari itu ditutup
2. [Sistem] Cek apakah setoran untuk business day ini sudah ada (unik per tanggal)
3. Decision **Setoran Hari Ini Sudah Ada?**
   - Ya → [Sistem] Tampilkan setoran existing (tidak boleh double-submit) → Final Node
   - Tidak → lanjut
4. [Sistem] Tampilkan form blind count: satu baris input fisik per metode pembayaran aktif (kasir TIDAK melihat angka sistem dulu)
5. [Kasir Penutup] Input total fisik per metode (cash dari laci kas; non-cash dari mutasi/aplikasi aggregator)
6. [Kasir Penutup] Submit setoran
7. [Sistem] Hitung total sistem per metode dari semua transaksi paid hari itu (group by metode; breakdown per bank untuk metode yang butuh bank; exclude transaksi yang sudah di-merge agar tidak dobel)
8. [Sistem] Hitung variance per metode = fisik − sistem + tampilkan ringkasan (termasuk float baseline Σ modal awal shift hari itu)
9. [Sistem] Simpan setoran (status=submitted)
10. Decision **Owner Mereview?**
    - Ya → [Owner] Buka setoran → tinjau variance per metode → tandai status=reviewed - UC `Mereview Settlement` (owner-only)
    - Tidak → biarkan status=submitted
11. [Sistem] Tampilkan konfirmasi → Final Node

### 5.7. `activity-diagram-restock-stok-porsi-pagi.png` (A.7 - kelipatan 5)

**Source UC:** `Restock Stok Porsi`
**Swimlane:** Waiter / Kasir | Sistem
**Tujuan:** Restock pagi dengan kelipatan (default 5, owner-configurable via `app_settings.restock_multiple`) setelah kasir bawa stok dari rumah owner. Akses terbuka untuk semua role.

**Alur:**
1. [Waiter/Kasir] Buka halaman Stok Porsi
2. [Sistem] Tampilkan item stok porsi dengan: nama, qty saat ini, min stok, saran restock (jika qty saat ini < min stok)
3. [Waiter/Kasir] Loop per item: cek qty saat ini vs min stok + input qty restock (default = saran, harus kelipatan yang ditetapkan)
4. [Waiter/Kasir] Submit batch restock
5. [Sistem] Untuk tiap entry: tambah stok porsi + catat log perubahan (reason restock pagi)
6. [Sistem] Tampilkan konfirmasi → Final Node

### 5.8. `activity-diagram-mencatat-barang-masuk.png` (A.8 - restock darurat)

**Source UC:** `Mencatat Barang Masuk`
**Swimlane:** Kasir / Waiter | Sistem
**Tujuan:** Restock darurat tengah hari saat owner kirim stok dari rumah (via Gojek/Grab/antar sendiri). Sering: ayam bakar/goreng habis duluan. Akses terbuka untuk semua role.

**Alur:**
1. [Owner di rumah] Kirim stok ke resto (Gojek/Grab/antar sendiri) - di luar sistem
2. [Kasir/Waiter] Barang datang → buka halaman Stok Porsi → tombol "Barang Masuk"
3. [Sistem] Tampilkan list item stok porsi dengan qty saat ini + input qty datang
4. [Kasir/Waiter] Input qty per item yang datang (kelipatan bebas) + catatan opsional (mis. "Antar via Gojek 18:30, ayam bakar 5 + paha bakar 10")
5. [Kasir/Waiter] Submit
6. [Sistem] Untuk tiap entry: tambah stok porsi + catat log perubahan (reason restock darurat)
7. [Sistem] Tampilkan stok terbaru (mis. item yang sebelumnya −1 jadi 4 setelah datang 5) → Final Node

### 5.9. `activity-diagram-opname-stok-porsi.png` (A.9 - cek fisik & koreksi)

**Source UC:** `Opname Stok Porsi`
**Swimlane:** Kasir / Waiter | Sistem
**Tujuan:** Cek fisik stok porsi & koreksi nilai sistem jika menyimpang dari realita. Paling pas dilakukan pagi setelah restock pagi dicatat. Akses terbuka untuk semua role.

**Alur:**
1. [Kasir/Waiter] Buka halaman Stok Porsi → klik "Cek Fisik & Koreksi" (opname)
2. [Sistem] Tampilkan list item dengan qty saat ini sebagai default
3. [Kasir/Waiter] Loop per item: hitung qty fisik aktual di penyimpanan + input qty fisik (kalau beda dari qty saat ini)
4. [Kasir/Waiter] Submit batch koreksi
5. [Sistem] Untuk tiap entry yang berubah: hitung selisih = qty fisik − qty saat ini + set qty = qty fisik + catat log perubahan (reason koreksi manual, catatan "Opname")
6. [Sistem] Tampilkan ringkasan selisih per item + total → Final Node

### 5.10. `activity-diagram-mencatat-tagihan.png` (A.10 - owner only)

**Source UC:** `Mencatat Tagihan Bulanan`
**Swimlane:** Owner | Sistem
**Tujuan:** Owner-only input tagihan operasional bulanan. Kasir tidak punya akses meskipun anggota keluarga.

**Alur:**
1. [Owner] Buka halaman Tagihan (kasir tidak punya akses - sidebar item hidden dan endpoint protected)
2. [Owner] Klik "Tambah Tagihan"
3. [Sistem] Tampilkan form: bulan (YYYY-MM picker) + kategori (kebersihan/listrik/air/parkir/sewa) + nominal + catatan opsional
4. [Owner] Input data → Submit
5. [Sistem] Validasi (nominal > 0, kategori valid, role=owner)
6. Decision **Input Valid?**
   - Tidak → [Sistem] Tampilkan pesan kesalahan, loop balik ke step 4
   - Ya → lanjut
7. [Sistem] Simpan tagihan (user = owner)
8. [Sistem] Tampilkan list tagihan bulan ini + total + konfirmasi → Final Node

> **Catatan dashboard:** Tagihan (bills) **ditampilkan terpisah** di dashboard owner dan **TIDAK** dikurangkan ke Laba Kotor (Laba Kotor = Pendapatan − COGS − PB1 yang ditanggung resto).

### 5.11. `activity-diagram-kelola-menu-cogs.png` (A.11 - owner only, menu + modal/COGS)

**Source UC:** `Mengelola Menu` + `Kelola Modal/COGS Menu`
**Swimlane:** Owner | Sistem
**Tujuan:** Owner-only kelola katalog menu sekaligus mencatat **modal/COGS per menu**. Modal disimpan di `menus.cost` (owner-only, **TIDAK dibocorkan ke GET publik POS**), setiap perubahan dicatat di change-log `menu_cost_movements` (reason `initialSet` saat pertama di-set dari kosong, `manualEdit` untuk perubahan berikutnya). Snapshot modal disalin ke `transaction_items.unit_cost` saat order dibuat (di A.2), sehingga COGS historis stabil meski modal diubah kemudian.

**Alur:**
1. [Owner] Buka halaman Katalog Menu (kasir/waiter tidak punya akses CRUD)
2. Decision **Aksi?**
   - **Tambah/Edit Menu** → step 3
   - **Atur Modal/COGS** → step 7
3. [Owner] Klik "Tambah Menu" / pilih menu untuk diedit
4. [Sistem] Tampilkan form menu (nama, kategori, harga, jenis menu simple/variant/paket, jenis stok, foto, tampil di POS)
5. [Owner] Input data → Submit
6. [Sistem] Validasi + simpan menu → menuju konfirmasi (step 11)
7. [Owner] Buka menu → input/ubah nilai modal/COGS
8. [Sistem] Validasi nilai modal
9. Decision **Nilai Valid?**
   - Tidak → [Sistem] Tampilkan pesan kesalahan, loop balik ke step 7
   - Ya → lanjut
10. [Sistem] Simpan modal ke menu + catat perubahan ke change-log modal (initialSet / manualEdit, simpan nilai sebelum/sesudah + user + waktu)
11. [Sistem] Tampilkan konfirmasi + katalog terbaru (kolom Laba per menu = harga − modal) → Final Node

> **Catatan riwayat modal:** Owner dapat melihat riwayat perubahan modal via endpoint `GET /menus/:id/cost-history` (owner-only). Riwayat ditampilkan sebagai drawer/detail, alur view sederhana yang tidak digambar sebagai diagram terpisah.

## 6. Narasi Umum untuk Bab 3 Skripsi (paste-ready, REV 2.13)

> ⚠️ **Catatan REV 2.13:** narasi ini sudah diselaraskan ke implementasi nyata (11 activity diagram; drop opname raw materials + mencatat pembelian + split bill; split-tender + window shift + COGS per menu), tetapi sebaiknya **di-review thesis-level oleh Ezra** untuk kehalusan kalimat naskah final dan penomoran Gambar/Tabel.
>
> **3.4.2 Activity Diagram**
>
> Activity diagram pada sub-bab ini menggambarkan alur kerja sistem POS Restoran Ayam Bakar Banjar Monosuko untuk proses-proses kritis yang teridentifikasi di Use Case Diagram. Sistem memiliki sebelas activity diagram yang mencakup: (1) alur autentikasi `Login` dengan form dua field input nama pengguna dan PIN enam digit yang diketik manual oleh pegawai setiap login (tidak ada layar pilih nama dari daftar), karena identifikasi pengguna dilakukan via kombinasi nama dan PIN; (2) alur mengelola pesanan ke POS oleh kasir maupun waiter secara via HP masing-masing (workflow kertas opsional: waiter dapat menuliskan order di kertas lalu menyerahkannya ke kasir untuk diinput), dengan dua tipe order (dine-in yang wajib pilih meja dan takeaway tanpa meja), pemilihan varian dan komponen paket, serta catatan per item; (3) alur memproses pembayaran yang mendukung split tender (satu transaksi dibayar dengan beberapa metode melalui penambahan slice pembayaran berulang sampai lunas), dengan PB1 yang dapat diatur owner (dimatikan secara default; jika diaktifkan dapat dibebankan ke pelanggan atau ditanggung resto), bank picker untuk metode yang membutuhkan bank agar owner mendapatkan rekonsiliasi per bank, kaskade pembayaran ke transaksi sumber bila transaksi merupakan gabungan beberapa meja, serta opsi cetak struk PDF; (4) alur buka kasir yang divalidasi terhadap window operasional yang dapat dikonfigurasi owner dan dijaga oleh penanda shift aktif tunggal di seluruh sistem, termasuk skenario serah-terima; (5) alur tutup kasir dengan dua mode, yaitu mode final yang memblok penutupan bila masih ada transaksi belum dibayar dan mode serah-terima (handover); (6) alur setoran akhir hari yang dilakukan satu kali per hari bisnis penuh oleh kasir penutup shift terakhir atau owner, berupa blind count yang kemudian dibandingkan sistem untuk menghasilkan variance per metode, dilanjutkan peninjauan opsional oleh owner; (7) alur restock stok porsi pagi dengan kelipatan yang dapat dikonfigurasi oleh waiter atau kasir; (8) alur mencatat barang masuk untuk restock darurat tengah hari saat owner mengirim stok dari rumah; (9) alur opname stok porsi untuk cek fisik dan koreksi nilai sistem yang menyimpang dari realita; (10) alur mencatat tagihan operasional bulanan oleh owner; serta (11) alur kelola menu sekaligus pencatatan modal/COGS per menu oleh owner, di mana setiap perubahan modal dicatat pada change-log dan disnapshot ke item transaksi saat order dibuat.
>
> Setiap activity diagram menggunakan swimlane untuk memisahkan tanggung jawab aktor (Kasir, Waiter, Owner) dari Sistem, serta memiliki tepat satu initial node dan satu activity final node sehingga seluruh jalur, termasuk jalur early-exit, dikonvergensikan ke satu titik akhir. Setiap aksi dinyatakan dalam bahasa bisnis yang mudah dipahami pegawai non-teknis, dengan detail teknis (query database, format API, kalkulasi) tersembunyi di spesifikasi internal sistem. Setiap decision diberi nama pertanyaan (misalnya "Tipe order dine-in?", "Metode butuh bank?", "Tagihan sudah lunas?", "Pelanggan minta struk?") dengan guard `Ya`/`Tidak` pada masing-masing cabang untuk menjaga keterbacaan. Berbeda dari desain awal yang menggunakan force-order modal, desain sistem mengizinkan stok porsi bernilai negatif secara langsung saat order masuk - restock darurat dicatat di activity terpisah (Mencatat Barang Masuk) untuk menyederhanakan flow utama dan memisahkan concern stok dari concern transaksi. Sesuai ruang lingkup penelitian, inventori dibatasi pada stok porsi siap jual sehingga tidak terdapat alur pengelolaan bahan baku mentah maupun pencatatan pembelian; modal/COGS dinyatakan langsung per menu oleh owner melalui alur Kelola Menu dan Modal/COGS.

## 7. Bad Practice yang Dihindari

- ❌ Action berisi SQL/code (`Query portion_stocks WHERE menu_id=?`, `Insert bills row`) → verb phrase bahasa bisnis
- ❌ Decision diamond tanpa label pertanyaan → kasih nama: `Tipe order dine-in?`, `Input valid?`, `Metode butuh bank?`
- ❌ Lebih dari satu activity final node → konvergensikan semua jalur (termasuk early-exit) ke satu final node via merge
- ❌ Guard dengan bracket `[ya]` huruf kecil → `Ya` / `Tidak` Title Case tanpa bracket
- ❌ Fork/Join untuk alur exclusive → pakai Decision + Merge
- ❌ Menggambar "Split Bill" / `party_id` (sudah dihapus) → pakai **Split Tender** (banyak slice pembayaran / 1 transaksi)
- ❌ Menggambar metode pembayaran sebagai enum tetap 6 buah → metode dinamis dari master `payment_methods` (filter `allowDineIn`/`allowTakeaway`)
- ❌ Settlement "kasir malam only" / 12 kolom tetap → setoran whole business day oleh kasir penutup/owner + rekap per-metode dinamis
- ❌ Menggambar alur Opname Raw Materials / Mencatat Pembelian → fitur dihapus REV 2.11 (inventori = stok porsi finished-goods saja)

## 7.b Riwayat Versi (ringkas)

- **REV 2.1 → 2.2:** rename `stock_movements` → `portion_movements`; tambah audit log raw materials.
- **REV 2.2 → 2.3:** permission matrix + login fix; input order kasir & waiter (REV 2.4). Visual tidak berubah.
- **REV 2.3 → 2.11:** drop subsistem belanja/raw-materials → drop Opname Raw Materials + Mencatat Pembelian (11 → 9 diagram); modal/COGS per menu (saat itu di-cover narasi tanpa diagram terpisah).
- **REV 2.11 → 2.13:** diselaraskan ke kode nyata. (a) Split Bill / `party_id` diganti **Split Tender** (`transaction_payments`) dan dilebur ke A.3; merge bill tetap (self-ref `merged_into_id`). (b) Tutup Kasir (A.5) dan Setoran/Settlement (A.6) **dipisah** (dulu tergabung). (c) Tambah A.4 Buka Kasir window-aware + single-OPEN guard (REV 2.7). (d) Tambah A.11 Kelola Menu + Modal/COGS. (e) PB1 owner-configurable 2 sumbu (taxEnabled/taxRate/taxChargedToCustomer; ditanggung resto = `tax_borne_amount`). (f) Settlement whole business day + blind count. (g) Konvensi tegas: tiap diagram tepat 1 initial + 1 final node. **Total 9 → 11 diagram.**

## 8. Referensi Konvensi

- **ADSI Bab 7** - Modul Pembelajaran ADSI
- Skill: `.claude/skills/activity-diagram/SKILL.md`
- Pattern dari 3 skripsi POS UK Petra
- Ground truth: [`docs/operasional-resto.md`](../operasional-resto.md)
- Design spec permission matrix: [`docs/superpowers/specs/2026-05-24-permission-matrix-design.md`](../superpowers/specs/2026-05-24-permission-matrix-design.md)
- Design spec shift redesign (window/business-day/atribusi): [`docs/superpowers/specs/2026-05-29-shift-redesign-design.md`](../superpowers/specs/2026-05-29-shift-redesign-design.md)
- Design spec COGS per menu + hapus belanja: [`docs/superpowers/specs/2026-05-30-cogs-per-menu-remove-belanja-design.md`](../superpowers/specs/2026-05-30-cogs-per-menu-remove-belanja-design.md)
- Use Case parent (REV 2.13): [`USE-CASE.md`](USE-CASE.md)
- ERD pasangan (REV 2.13): [`ERD.md`](ERD.md)
