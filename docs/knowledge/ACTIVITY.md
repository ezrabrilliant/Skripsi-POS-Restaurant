# Activity Diagram — Sistem POS Ayam Bakar Banjar Monosuko (REV 2.3)

> **Status:** REV 2.3 (2026-05-24) — bump dari REV 2.2 setelah brainstorming workflow order intake. Tidak ada penambahan/penghapusan activity diagram (tetap 11), tidak ada perubahan struktur step. Hanya A.2 yang ditambahkan note tentang fallback waiter, dan annotation aktor diperjelas di A.4–A.7 untuk hindari interpretasi co-equal antara waiter dan kasir.
> **Sumber alur bisnis:** [`docs/operasional-resto.md`](../operasional-resto.md) REV 2.3 (sumber kebenaran tertinggi)
> **Design spec turunan:** [`docs/superpowers/specs/2026-05-24-permission-matrix-design.md`](../superpowers/specs/2026-05-24-permission-matrix-design.md)
> **Use Case parent:** [`USE-CASE.md`](USE-CASE.md) (REV 2.3)
> **ERD pasangan:** [`ERD.md`](ERD.md) (REV 2.3)
> **Visual:** ✅ Semua 11 activity diagram (A.1–A.11) sudah dibangun di `Skripsi.mdj` dengan swimlane sesuai aktor + sistem, bahasa manusia per SKILL §2, dan UMLActivityFinalNode bullseye. REV 2.3 tidak butuh rebuild visual (no step change) — cukup adjust dokumentasi MD ini.

> ⚠️ **WAJIB pakai skill `.claude/skills/activity-diagram/SKILL.md` saat build activity diagram di StarUML.** Skill berisi pattern proven untuk:
> - Pre-build swimlane (UMLActivityPartition) BEFORE nodes (avoid orphan)
> - Update partition.nodes via HTTP direct (MCP tool bug stringify value)
> - Bahasa action manusiawi (NO technical jargon: `localStorage`, `portion_stocks`, `decrement`, `reason=order` DILARANG)
> - UMLActivityFinalNode (bullseye) bukan UMLFinalNode
> - Pattern lengkap §8a-§8g + §2 action naming dengan rename table
>
> Action name di SKILL §2 jadi single source of truth. Step-by-step description di MD ini boleh pakai bahasa lebih teknis untuk implementer reference, tapi yang masuk diagram WAJIB pakai bahasa manusia per SKILL §2.

> ⚠️ **Penyempurnaan dari REV 2:** Total **11 activity diagram** REV 2.1 (REV 2: 10).
>
> Mapping perubahan ringkas:
> - A.1 Login → **REVISED 2026-05-24** (drop 2-step pilih-nama-from-list + localStorage; jadi form input nama + PIN murni)
> - A.2 Take Order → **REVISED 2026-05-24** (swimlane jadi 3: **Waiter | Kasir | Sistem**; jalur dine-in via waiter mediated paper, jalur takeaway langsung kasir; pembayaran dipisah ke A.3)
> - A.3 Pay Flow → **REVISED** (drop filter payment per orderType; tambah bank picker untuk EDC & transfer; PB1 10% tetap auto)
> - A.4 Restock Stok Porsi Pagi → tetap (kelipatan 5)
> - A.5 Mencatat Barang Masuk → tetap (restock darurat)
> - A.6 **NEW** Opname Stok Porsi (kasir+waiter pagi setelah restock)
> - A.7 **REPLACE** ~~Mencatat Stok Bahan~~ → Opname Raw Materials (waiter+kasir malam, lebih general)
> - A.8 Tutup Kasir → **REVISED** (tambah breakdown bank untuk EDC/transfer)
> - A.9 Mencatat Pembelian → **MAJOR REVISED** (vendor opsional + normalized items + add raw material inline + auto-update raw_materials)
> - A.10 Mencatat Tagihan Bulanan → tetap (owner only)
> - A.11 Split + Merge Bill → **REVISED** (merge pakai self-ref `merged_into_id`)

---

## 1. Apa itu Activity Diagram?

> *"Activity diagram merupakan penggambaran workflow (aliran kerja) atau aktivitas dari sebuah sistem proses bisnis atau menu yang ada pada perangkat lunak."* — Sukamto & Shalahuddin 2016 (dikutip di Modul ADSI Bab 7)

Activity Diagram adalah diagram UML yang menunjukkan **dynamic behavior sistem** — urutan langkah-langkah (action), keputusan (decision), dan paralelisme (fork/join) dalam suatu proses bisnis. Diagram ini dibuat **berdasarkan use case** — setiap UC critical dipecah alurnya.

## 2. Kegunaan untuk Skripsi

1. **Visualisasi alur bisnis** untuk validasi dengan stakeholder.
2. **Input bagi programmer** — alur langkah demi langkah jadi panduan implementasi.
3. **Dokumentasi decision rule** — semua percabangan (vendor diisi? input bank? mau cetak struk?) terdokumentasi visual.
4. **Bab 3 skripsi** — setiap UC non-trivial dijelaskan alurnya via activity + narasi.

## 3. Elemen Activity Diagram

| Simbol | Nama | Fungsi |
|---|---|---|
| ● filled circle | **Initial Node** | Start, 1 per diagram |
| ◉ bullseye | **Activity Final Node** | End, boleh >1 |
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

✅ `Stok porsi cukup?`, `Vendor diisi?`, `Pelanggan minta struk?`, `Payment EDC atau transfer?`

### 4.3. Guard Labels
Plain text tanpa bracket, Title Case: `Ya` / `Tidak`, `Cash` / `EDC` / `QRIS` / ...

### 4.4. Single In/Out Rule
> "Setiap aksi hanya mendapat satu alur masuk dan satu alur keluar" — ADSI §7

Percabangan/penggabungan lewat Decision/Merge, bukan dari action langsung.

## 5. Sebelas Activity Diagram REV 2.3

### 5.1. `activity-diagram-login.png` (A.1)

**Source UC:** `Login` (shared, prasyarat 19 UC lainnya via `<<include>>`)
**Swimlane:** User (Owner/Kasir/Waiter) | Sistem
**Tujuan:** Autentikasi via form 2 field (nama pengguna + PIN). **Tidak ada layar pilih nama dari daftar / list picker** — semua pegawai mengetik nama mereka manual. PIN boleh duplikat antar pegawai (identifikasi via nama).

**Alur:**
1. [User] Membuka Aplikasi POS
2. [Sistem] Menampilkan Form Login (2 field: nama pengguna + PIN)
3. [User] Mengisi Nama Pengguna
4. [User] Mengisi PIN 6 digit
5. [User] Mengirim Form Login
6. [Sistem] Memvalidasi Nama dan PIN (lookup user by name + cek PIN match)
7. Decision **Nama dan PIN Benar?**
   - Tidak → [Sistem] Menampilkan Pesan Kesalahan, loop balik ke step 3 (user mengisi ulang via merge node)
   - Ya → [Sistem] Membuka Dashboard Sesuai Peran (Owner / Kasir / Waiter) → End

### 5.2. `activity-diagram-take-order.png` (A.2 REVISED REV 2.3 — Waiter-mediated dine-in + direct kasir takeaway + waiter fallback note)

**Source UC:** `Mengelola Pesanan Meja` + `Mencatat Pesanan Takeaway` + `Memilih Sub-Pilihan Paket`
**Swimlane:** **Waiter | Kasir | Sistem** (3 swimlanes)
**Tujuan:** Mencatat pesanan pelanggan ke POS. Alur dibedakan berdasarkan tipe order:
- **Dine-in**: pelanggan duduk di meja → waiter menerima pesanan dan mencatat di kertas → menyerahkan ke kasir → kasir input ke POS.
- **Takeaway** (walk-in, GoFood, GrabFood, gosend): pelanggan datang langsung ke kasir (atau order via aplikasi) → kasir input ke POS tanpa perantara waiter.

**Catatan REV 2.3 — Fallback Waiter:** Jika kasir tidak available saat kertas sampai (mis. kasir sedang telepon owner, sedang ke toilet, sedang belanja), waiter dapat input langsung ke POS dengan akun-nya sendiri. Alur fallback ini **identik dengan jalur kasir input** di step 6 onwards — yang berubah hanya actor di swimlane (Waiter, bukan Kasir). Sistem backend tidak memblok endpoint `POST /transactions` untuk role waiter; yang membentuk perilaku "fallback only" adalah desain UI di dashboard waiter (tombol "Input Order" ditaruh sebagai link sekunder kecil, bukan card primary). Diagram A.2 menggambarkan **primary path** (kertas → kasir input); fallback path tidak digambar sebagai branch terpisah untuk menjaga keterbacaan diagram.

Pembayaran terpisah di **A.3 Pay Flow** (kasir-only, waiter tidak punya akses payment). Tidak ada force-order modal — stok porsi boleh minus normal.

**Alur:**
1. Decision **Tipe Order?**
   - **Dine-in** → jalur via Waiter (step 2-4)
   - **Takeaway** → langsung ke Kasir (step 5)

**Jalur Dine-in (Waiter mediated):**
2. [Waiter] Menerima Pesanan dari Pelanggan (di meja)
3. [Waiter] Mencatat Pesanan di Kertas
4. [Waiter] Menyerahkan Catatan ke Kasir → lanjut ke step 6

**Jalur Takeaway (direct Kasir, skip Waiter):**
5. [Kasir] Memilih Tipe Takeaway di POS → lanjut ke step 8

**Input ke POS (Kasir):**
6. [Kasir] Memilih Tipe Dine-in di POS
7. [Kasir] Memilih Nomor Meja (dari 9 meja: 2 kapasitas 6, 7 kapasitas 4)
8. [Sistem] Membuka Transaksi:
   - Dine-in → **Membuka Transaksi Meja** (deteksi transaksi open existing untuk multi-round; jika belum ada, buat baru)
   - Takeaway → **Membuat Transaksi Takeaway** (tanpa meja)
9. [Sistem] Menampilkan Form Pesanan (grid menu per kategori: Signature, Seafood, Sayur & Sup, Side Dish, Minuman, Paket Hemat)
10. [Kasir] Memilih Item Menu dari grid
11. Decision **Item Paket?**
    - Ya → [Kasir] Memilih Pilihan Paket (mis. Paha vs Dada, Bakar vs Goreng, jenis minuman — sub-options modal)
    - Tidak → langsung gunakan menu sebagai item
12. [Sistem] Menambahkan Item ke Pesanan (cart)
13. Decision **Tambah Item Lagi?**
    - Ya → loop balik ke step 10
    - Tidak → lanjut
14. [Kasir] Mengirim Pesanan
15. [Sistem] Mengurangi Stok Porsi (untuk tiap item stockType=portion atau linked; boleh minus)
16. [Sistem] Mencatat Log Perubahan Stok (`portion_movements` reason=`order`)
17. [Sistem] Menyimpan Pesanan status=open (tunggu pembayaran di A.3) → End

**Catatan:**
- Multi-round (customer nambah pesanan setelah pesanan pertama): cukup ulangi A.2 untuk meja yang sama — sistem deteksi transaksi open existing dan append item baru ke transaksi tersebut.
- Sub-options paket (step 11) digambar sebagai decision sederhana; detail mapping pilihan → stok porsi target ada di logic backend (`subOptions.stockMap`).
- Untuk takeaway, sumber order (walk-in / GoFood / GrabFood / gosend) tidak dibedakan di A.2 — dibedakan nanti via metode pembayaran di A.3.

### 5.3. `activity-diagram-pay-flow.png` (A.3 REVISED — bank picker + drop filter)

**Source UC:** `Memproses Pembayaran` + `Mencetak Struk`
**Swimlane:** Kasir | Sistem
**Tujuan:** Proses pembayaran dengan PB1 10% auto + bank picker untuk EDC/transfer + opsi cetak PDF.

**Alur:**
1. [Kasir] Pilih "Bayar" pada transaksi open
2. [Sistem] Tampilkan rincian: subtotal, discount (input optional), tax PB1 10% auto-compute, total
3. [Kasir] Input diskon manual (opsional)
4. [Sistem] Recalculate total = subtotal − discount + tax
5. [Sistem] Tampilkan 6 payment options tersedia: **Cash / EDC / QRIS / Gojek / Grab / Transfer** (semua tersedia untuk semua tipe order — sumber takeaway dibedakan dari payment method, bukan sebaliknya)
6. [Kasir] Pilih metode pembayaran
7. Decision **Payment = EDC atau Transfer?**
   - Ya → [Sistem] Tampilkan input bank picker dengan autocomplete dari riwayat bank sebelumnya
   - [Kasir] Pilih bank existing atau ketik nama bank baru (mis. "BCA", "Mandiri", "BRI")
   - Tidak → skip bank input
8. Decision **Cash + amount paid kurang dari total?**
   - Ya → loop input amount
   - Tidak → lanjut
9. [Sistem] Set status=paid, paidAt=now, payment_method, payment_bank (kalau ada)
10. Decision **Pelanggan minta split bill?**
    - Ya → trigger sub-flow Split Bill (lihat A.11) → multiple struk PDF
    - Tidak → 1 struk
11. Decision **Pelanggan minta struk?**
    - Ya → [Sistem] Generate PDF receipt → save ke device kasir (future: thermal Bluetooth)
    - Tidak → skip
12. [Sistem] Tampilkan konfirmasi pembayaran (+ kembalian jika cash) → End

### 5.4. `activity-diagram-restock-stok-porsi-pagi.png` (A.4)

**Source UC:** `Restock Stok Porsi`
**Swimlane:** Waiter / Kasir | Sistem
**Tujuan:** Restock pagi kelipatan 5 setelah kasir bawa stok dari rumah.

**Alur:**
1. [Waiter/Kasir] Buka halaman Stok Porsi
2. [Sistem] Tampilkan 25 item stok porsi dengan: nama, current_qty, min_stock, suggested restock = `roundup((min_stock − current_qty) / 5) * 5` (jika current_qty < min_stock)
3. [Waiter/Kasir] Loop per item:
   - Cek current_qty vs min_stock
   - Input qty restock (default = suggested, harus kelipatan 5)
4. [Waiter/Kasir] Submit batch restock
5. [Sistem] Untuk tiap entry: increment `portion_stocks.current_qty`, log ke `portion_movements` reason=`restock_morning`
6. [Sistem] Tampilkan konfirmasi → End

### 5.5. `activity-diagram-mencatat-barang-masuk.png` (A.5)

**Source UC:** `Mencatat Barang Masuk`
**Swimlane:** Kasir / Waiter | Sistem
**Tujuan:** Restock darurat tengah hari saat owner kirim dari rumah (via Gojek/Grab/antar sendiri). Sering: ayam bakar/goreng habis duluan.

**Alur:**
1. [Owner di rumah] Kirim stok ke resto (Gojek/Grab/antar sendiri) — di luar sistem
2. [Kasir/Waiter] Barang datang → buka halaman Stok Porsi → tombol "Barang Masuk"
3. [Sistem] Tampilkan list item stok porsi dengan current_qty + input qty datang
4. [Kasir/Waiter] Input qty per item yang datang (umumnya kelipatan 5)
5. [Kasir/Waiter] Input note opsional (mis. "Antar via Gojek 18:30, ayam bakar 5 + paha bakar 10")
6. [Kasir/Waiter] Submit
7. [Sistem] Untuk tiap entry: increment `portion_stocks.current_qty`, log ke `portion_movements` reason=`restock_emergency`
8. [Sistem] Tampilkan stok terbaru (mis. item yang sebelumnya −1 sekarang jadi 4 setelah datang 5) → End

### 5.6. `activity-diagram-opname-stok-porsi.png` (A.6 NEW)

**Source UC:** `Melakukan Opname Stok Porsi`
**Swimlane:** Kasir / Waiter | Sistem
**Tujuan:** Cek fisik stok porsi & koreksi nilai sistem jika menyimpang dari realita. Paling pas dilakukan pagi setelah restock pagi dicatat (untuk verifikasi total stok = sisa kemarin + restock pagi + selisih opname). Analog dengan rekonsiliasi cash di akhir shift.

**Alur:**
1. [Kasir/Waiter] Buka halaman Stok Porsi → klik "Cek Fisik & Koreksi" (opname)
2. [Sistem] Tampilkan list 25 item dengan current_qty saat ini sebagai default
3. [Kasir/Waiter] Loop per item:
   - Hitung qty fisik aktual di freezer/penyimpanan
   - Input qty fisik (kalau beda dari current_qty)
4. [Kasir/Waiter] Submit batch koreksi
5. [Sistem] Untuk tiap entry yang berubah:
   - Hitung selisih = qty_fisik − current_qty
   - Update current_qty = qty_fisik
   - Log ke `portion_movements` reason=`manual_adjust`, note="Opname pagi: selisih +1 / −2 / dst."
6. [Sistem] Tampilkan ringkasan selisih per item + total → End

### 5.7. `activity-diagram-opname-raw-materials.png` (A.7 NEW — replace Mencatat Stok Bahan REV 2)

**Source UC:** `Melakukan Opname Raw Materials`
**Swimlane:** Waiter / Kasir | Sistem
**Tujuan:** Cek fisik raw materials di malam hari sebelum tutup (untuk tahu yang perlu dibeli besok pagi). Replace UC lama "Mencatat Stok Bahan" yang rigid 5 jenis (REV 2) — sekarang fleksibel sesuai jumlah raw materials tracked.

**Alur:**
1. [Waiter/Kasir] Buka halaman Raw Materials di akhir shift malam → filter `is_tracked=true`
2. [Sistem] Tampilkan list raw materials yang ditrack (mis. Beras, Kangkung, Petai, Tahu, Tempe, Telur) dengan stock_qty saat ini, unit, kategori, dan reminder badge bila ada
3. [Waiter/Kasir] Loop per item yang perlu di-koreksi:
   - Cek fisik kondisi stok di rak/freezer
   - Input qty fisik aktual (bisa skip kalau sesuai)
   - Untuk perishable (mis. Kangkung) — opsional update `last_buy_date` kalau pembelian terakhir tidak ter-record di sistem
4. [Waiter/Kasir] Submit
5. [Sistem] Untuk tiap entry yang berubah:
   - Update `raw_materials.stock_qty = qty_fisik`
   - Update `raw_materials.last_buy_date` kalau diisi
   - **REV 2.2**: Insert row ke `raw_material_movements` (reason=`opname`, delta=qty_fisik − stock_qty_lama, user_id=pelaku, note="Opname malam: dari X jadi Y") untuk audit trail
6. [Sistem] Generate ringkasan kondisi raw materials malam + reminder untuk pagi (mis. "Kangkung 0 ikat → beli besok pagi 2 ikat"; "Beras skala 1 → beli besok 1 karung") → End

### 5.8. `activity-diagram-tutup-kasir.png` (A.8 REVISED — breakdown bank)

**Source UC:** `Tutup Kasir`
**Swimlane:** Kasir Shift Malam | Sistem
**Tujuan:** Rekap akhir hari 1× sehari (kasir shift malam saja). Bukan blind count — tampilkan total sistem langsung dengan breakdown per bank untuk EDC & transfer, kasir input fisik, variance dihitung.

**Alur:**
1. [Kasir Malam] Klik "Tutup Kasir" di akhir shift
2. [Sistem] Cek apakah ada transaksi open
3. Decision **Ada transaksi belum dibayar?**
   - Ya → tampilkan peringatan + list meja yg masih open → End (early exit, kasir handle dulu)
   - Tidak → lanjut
4. [Sistem] Hitung total per metode dari semua transaksi paid hari ini:
   - system_cash, system_edc (with breakdown per `payment_bank`), system_qris, system_gojek, system_grab, system_transfer (with breakdown per `payment_bank`)
5. [Sistem] Tampilkan form rekap: 6 baris × (system | actual input) + sub-baris breakdown bank untuk EDC & transfer (mis. EDC BCA 200K + EDC Mandiri 150K = EDC total 350K)
6. [Kasir Malam] Input total fisik per metode (cash dihitung dari laci kas, EDC/QRIS/Gojek/Grab/Transfer dari mutasi atau settlement aggregator)
7. [Sistem] Hitung variance per metode = actual − system (di runtime, tidak disimpan)
8. [Sistem] Tampilkan ringkasan: 6 baris variance + total variance
9. [Kasir Malam] Konfirmasi submit
10. [Sistem] Simpan ke `settlements` (status=submitted), set `shifts.closed_at=now` → End

### 5.9. `activity-diagram-mencatat-pembelian.png` (A.9 MAJOR REVISED — normalized + vendor opsional)

**Source UC:** `Mencatat Pembelian`
**Swimlane:** Kasir / Owner | Sistem
**Tujuan:** Log belanja kasir di pasar dengan struktur normalized (purchases header + purchase_items detail dengan FK ke raw_materials). Vendor opsional. Sistem auto-update raw_materials.stock_qty saat submit.

**Alur:**
1. [Kasir] Pulang belanja dari pasar
2. [Kasir/Owner] Buka halaman Pembelian → klik "Tambah Pembelian"
3. [Sistem] Tampilkan form: tanggal (default today) + vendor picker (opsional) + list item dinamis (kosong, tombol "Tambah Baris")
4. Decision **Vendor diisi?**
   - Ya → [Kasir/Owner] Pilih vendor existing dari autocomplete atau klik "Add New Vendor Inline" → input name + type + phone? + note? → vendor baru ter-create
   - Tidak → skip (vendor_id = null)
5. [Kasir/Owner] Loop input baris item:
   - Klik "Tambah Baris"
   - Pilih raw material dari dropdown autocomplete (filter by category bila banyak)
   - Decision **Raw material belum ada di daftar?**
     - Ya → klik "Add New Raw Material Inline" → mini-form: name + unit + category + is_tracked + min_stock? → raw_material baru ter-create
     - Tidak → pilih existing
   - Input qty + unit_price → subtotal auto-hitung (qty × unit_price)
   - Opsional: input expired_date (untuk perishable)
6. Decision **Tambah baris lagi?**
   - Ya → loop ke step 5
   - Tidak → lanjut
7. [Sistem] Hitung total_amount = sum semua subtotal items
8. [Kasir/Owner] Input note opsional + Submit
9. [Sistem] Validasi: ada minimal 1 item, semua qty > 0
10. Decision **Input valid?**
    - Tidak → pesan kesalahan → kembali ke form
    - Ya → lanjut
11. [Sistem] Buat record di `purchases` (header) + records di `purchase_items` (detail) dalam 1 transaction Prisma
12. [Sistem] Untuk tiap `purchase_item` yang raw_material-nya `is_tracked=true`:
    - Update `raw_materials.stock_qty += item.qty`
    - Update `raw_materials.last_buy_date = purchase.date`
    - Update `raw_materials.unit_price = item.unit_price` (overwrite ke harga terbaru)
    - **REV 2.2**: Insert row ke `raw_material_movements` (reason=`purchase`, delta=+item.qty, user_id=purchase.user_id, note="Purchase id=X" + vendor name kalau ada) untuk audit trail
13. [Sistem] Tampilkan konfirmasi: total pembelian + list item + ringkasan update raw_materials → End

### 5.10. `activity-diagram-mencatat-tagihan.png` (A.10)

**Source UC:** `Mencatat Tagihan Bulanan`
**Swimlane:** Owner | Sistem
**Tujuan:** Owner-only input tagihan operasional bulanan. Kasir tidak punya akses meskipun anggota keluarga.

**Alur:**
1. [Owner] Buka halaman Tagihan (kasir tidak punya akses — sidebar item hidden dan endpoint protected)
2. [Owner] Klik "Tambah Tagihan"
3. [Sistem] Tampilkan form: month (YYYY-MM picker) + kategori (kebersihan/listrik/air/parkir/sewa) + amount + note optional
4. [Owner] Input data
5. [Owner] Submit
6. [Sistem] Validasi (amount > 0, kategori valid, role=owner)
7. Decision **Input valid?**
   - Tidak → pesan kesalahan, loop
   - Ya → lanjut
8. [Sistem] Simpan ke `bills` (user_id = owner)
9. [Sistem] Tampilkan list tagihan bulan ini + total + konfirmasi → End

### 5.11. `activity-diagram-split-merge-bill.png` (A.11 REVISED — merge pakai self-ref)

**Source UC:** `Memecah Tagihan (Split Bill)` + `Menggabungkan Tagihan (Merge Bill)`
**Swimlane:** Kasir | Sistem
**Tujuan:** Pecah 1 transaksi jadi 2+ party (split via `party_id`) atau gabung 2+ transaksi meja jadi 1 (merge via `merged_into_id` self-ref).

**Alur Split Bill:**
1. [Kasir] Saat di Payment Modal → klik "Split Bill"
2. [Sistem] Tampilkan list semua items + button "Tambah Party"
3. [Kasir] Loop:
   - Tambah party (Party A, B, C, ...)
   - Drag/assign item ke party tertentu (set `party_id`)
4. [Sistem] Hitung total per party (subtotal + diskon proportional + PB1 per party)
5. [Kasir] Loop per party:
   - Pilih metode pembayaran (per party bisa beda, mis. Party A cash, Party B EDC BCA)
   - Konfirmasi bayar
6. [Sistem] Set `transaction_items.party_id` per item, generate struk PDF per party (1 transaksi → N struk berdasar party_id)
7. End

**Alur Merge Bill:**
1. [Kasir] Saat di halaman Meja → klik "Merge Bill"
2. [Sistem] Tampilkan list meja occupied (yang punya transaksi status=open)
3. [Kasir] Pilih 2+ meja yg mau di-merge
4. [Sistem] Tampilkan combined cart (semua items dari semua transaksi yang dipilih)
5. [Kasir] Konfirmasi merge
6. [Sistem] Buat transaksi parent baru (gabungan) dengan items consolidated
7. [Sistem] Untuk tiap transaksi sumber: set `transactions.merged_into_id = parent.id` (self-ref) untuk audit trail, status sumber → void atau tetap open dengan flag
8. [Sistem] Buka payment modal untuk transaksi parent → bayar normal (bisa juga split bill) → End

## 6. Narasi Umum untuk Bab 3 Skripsi (paste-ready, REV 2.3)

> **3.4.2 Activity Diagram**
>
> Activity diagram pada sub-bab ini menggambarkan alur kerja sistem POS Restoran Ayam Bakar Banjar Monosuko untuk proses-proses kritis yang teridentifikasi di Use Case Diagram. Sistem memiliki sebelas activity diagram yang mencakup: (1) alur autentikasi `Login` dengan form dua field input nama pengguna dan PIN enam digit yang diketik manual oleh pegawai setiap login (tidak ada layar pilih nama dari daftar dan tidak ada penyimpanan nama terakhir di perangkat), karena identifikasi pengguna dilakukan via kombinasi nama dan PIN; (2) alur input pesanan ke POS dengan workflow primary berbasis kertas (waiter ambil order verbal di meja → tulis di kertas → kasir input ke POS), dengan dua tipe order (dine-in yang wajib pilih meja dan takeaway tanpa meja) serta sub-options modal untuk paket hemat dengan modifier dinamis. Waiter memiliki akses fallback untuk input order langsung ke POS bila kasir tidak available, namun secara default workflow tetap kertas-mediated; (3) alur pembayaran dengan PB1 sepuluh persen otomatis dan input bank picker khusus untuk metode EDC dan transfer agar owner mendapatkan laporan rekonsiliasi per bank, ditambah opsi cetak struk PDF; (4) alur restock stok porsi pagi dengan formula kelipatan lima oleh waiter atau kasir; (5) alur mencatat barang masuk untuk restock darurat tengah hari saat owner mengirim stok dari rumah; (6) alur opname stok porsi pagi untuk cek fisik dan koreksi nilai sistem yang menyimpang dari realita; (7) alur opname raw materials malam sebelum tutup untuk mengecek bahan baku yang perlu dibeli besok pagi; (8) alur tutup kasir dengan rekap enam total metode pembayaran beserta breakdown per bank untuk EDC dan transfer; (9) alur mencatat pembelian belanja kasir dengan struktur ternormalisasi yang mendukung vendor opsional dan penambahan raw material baru secara inline saat input pembelian; (10) alur mencatat tagihan operasional bulanan oleh owner; serta (11) alur split bill (memecah satu transaksi menjadi beberapa struk per party) dan merge bill (menggabungkan transaksi beberapa meja menjadi satu struk melalui self-reference `merged_into_id`).
>
> Setiap activity diagram menggunakan swimlane untuk memisahkan tanggung jawab aktor (Kasir, Waiter, Owner) dari Sistem. Setiap aksi dinyatakan dalam bahasa bisnis yang mudah dipahami pegawai non-teknis, dengan detail teknis (query database, format API, kalkulasi) tersembunyi di spesifikasi internal sistem. Setiap decision diberi nama pertanyaan (misalnya "Stok porsi cukup?", "Vendor diisi?", "Payment EDC atau transfer?", "Pelanggan minta struk?") dengan guard `Ya`/`Tidak` pada masing-masing cabang untuk menjaga keterbacaan. Berbeda dari desain awal yang menggunakan force-order modal, desain REV 2.1 mengizinkan stok porsi bernilai negatif secara langsung saat order masuk — restock darurat dicatat di activity terpisah (Mencatat Barang Masuk) untuk menyederhanakan flow utama dan memisahkan concern stok dari concern transaksi. Aktivitas opname dipisah menjadi dua diagram terpisah (stok porsi pagi dan raw materials malam) karena memiliki waktu, data, dan aktor yang berbeda — opname porsi pagi setelah restock untuk verifikasi konsistensi sistem, sementara opname raw materials malam untuk menentukan kebutuhan belanja esok hari.

## 7. Bad Practice yang Dihindari

- ❌ Action berisi SQL/code (`Query portion_stocks WHERE menu_id=?`, `Insert bills row`) → verb phrase bahasa bisnis
- ❌ Decision diamond tanpa label pertanyaan → kasih nama: `Vendor diisi?`, `Input valid?`, `Payment EDC atau transfer?`
- ❌ Multiple redundant merge (chain Merge → Merge) → konsolidasi
- ❌ Guard dengan bracket `[ya]` huruf kecil → `Ya` / `Tidak` Title Case tanpa bracket
- ❌ Fork/Join untuk alur exclusive → pakai Decision + Merge
- ❌ Filter payment per orderType di pay flow (REV 2 punya logic ini, REV 2.1 drop) — semua 6 metode tersedia untuk semua tipe order
- ❌ Activity rigid per jenis bahan (REV 2 punya 5 step terpisah untuk beras/sayur/tahu tempe/telur/petai) → REV 2.1 loop generic untuk semua raw materials yang is_tracked

## 7.b Perubahan REV 2.1 → REV 2.2 (audit log raw materials)

- ✅ **Total activity diagram tetap 11** (no add/remove).
- 🔄 **A.6 Opname Stok Porsi**: rename reference `stock_movements` → `portion_movements` (sesuai rename tabel di ERD REV 2.2).
- 🔄 **A.7 Opname Raw Materials**: tambah step 5c "Insert row ke `raw_material_movements` reason=`opname`, delta=selisih, user_id=pelaku" untuk audit trail.
- 🔄 **A.9 Mencatat Pembelian**: tambah step 12d "Insert row ke `raw_material_movements` reason=`purchase`, delta=+qty, user_id=purchase.user_id" untuk audit trail saat tiap `purchase_item` submit.
- 🔄 **A.4 Restock Stok Porsi Pagi** & **A.5 Mencatat Barang Masuk**: implicit rename log table (stock_movements → portion_movements). Tidak ada perubahan step.

## 7.c Perubahan REV 2.2 → REV 2.3 (permission matrix + waiter fallback note)

- ✅ **Total activity diagram tetap 11** (no add/remove).
- ✅ **Tidak ada perubahan step di diagram visual** — semua 11 diagram di `Skripsi.mdj` tetap valid untuk REV 2.3.
- 🔄 **A.2 Take Order**: tambah paragraf "Catatan REV 2.3 — Fallback Waiter" yang menjelaskan workflow alternatif saat kasir tidak available. Diagram visual tetap menggambarkan primary path; fallback dijelaskan via narasi karena alurnya identik dengan jalur kasir input, hanya actor di swimlane yang berbeda.
- ℹ️ **A.1 Login**: sudah aligned REV 2.2 (form input nama + PIN, no list picker, no localStorage). Tidak ada perubahan.
- ℹ️ **A.4–A.7 (Restock Pagi, Barang Masuk, Opname Porsi, Opname Raw Materials)**: swimlane tetap "Waiter / Kasir | Sistem" karena memang shared access — tidak ada perubahan annotation. Permission matrix di [`docs/operasional-resto.md`](../operasional-resto.md) seksi "Permission Matrix" menjelaskan detail per role per aksi.
- Alasan perubahan: Pre-REV 2.3 ada interpretasi bahwa "kasir+waiter" pada UC `Mengelola Pesanan Meja` = co-equal access. REV 2.3 clarify primary kasir, waiter fallback only — di diagram tidak perlu redraw karena flow-nya identik.

## 8. Referensi Konvensi

- **ADSI Bab 7** — Modul Pembelajaran ADSI
- Skill: `.claude/skills/activity-diagram/SKILL.md`
- Pattern dari 3 skripsi POS UK Petra
- Ground truth (REV 2.3): [`docs/operasional-resto.md`](../operasional-resto.md)
- Design spec permission matrix (REV 2.3): [`docs/superpowers/specs/2026-05-24-permission-matrix-design.md`](../superpowers/specs/2026-05-24-permission-matrix-design.md)
- Use Case parent (REV 2.3): [`USE-CASE.md`](USE-CASE.md)
- ERD pasangan (REV 2.3): [`ERD.md`](ERD.md)
