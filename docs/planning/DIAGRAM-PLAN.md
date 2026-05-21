# Skripsi POS — Detail Planning (pre-diagram)

Tujuan file ini: align scope + semua actor + semua activity + semua entity **sebelum** diagram dibangun di StarUML. Diagram yang detail butuh plan yang detail dulu.

Sumber fakta:
- `docs/prompt.txt` — latar belakang resto (user's story + backend rewrite plan)
- `docs/extracted/skripsi.txt` — naskah skripsi Bab 1–3
- `docs/extracted/adsi.txt` — konvensi diagram (Bab 5, 7, 8, 10)

---

## 1. Konteks Restoran (ringkas)

Restoran ayam bakar keluarga. Kasir = anggota keluarga pemilik (bukan tech-savvy). Dapur produksi di rumah pemilik; tiap pagi stok setengah-jadi (marinasi porsi) dibawa mobil ke outlet.

**Buku kertas existing = SATU buku, DUA sisi:**
- **Sisi kiri:** daftar stok masuk hari ini (nama item + total saja, bukan rincian gramasi) + pengeluaran harian (sering ada struk ditempel pakai solatip).
- **Sisi kanan:** pesanan + harga total + payment method, dibagi 3 kolom (pesanan | total | method). Satu baris pesanan bisa multi-line kalau item banyak (wordwrap).

**Masalah riil:**
1. Pegawai kadang lupa opname pagi → kasir nggak tau stok → langsung iya-kan order → pernah harus GoSend dari rumah pemilik saat stok habis.
2. Tagihan split/merge dihitung manual → lama, rawan salah.
3. Pencatatan payment method campur aduk (cash/EDC/QRIS/transfer/ojol) → rekonsiliasi akhir hari susah, sering mismatch.
4. Owner nggak tau persis pendapatan + pengeluaran bulanan — masih kira-kira.
5. Batasan penelitian (sidang proposal): **TIDAK hitung HPP**. Pengeluaran dicatat sebagai total rupiah + kategori, tidak per-bahan.

---

## 2. Final Actor List (3 role)

Per plan yang sudah dikonfirmasi (prompt.txt §Decisions #5):

| Actor | Role DB | Kerjaan utama | Primary/Secondary |
|---|---|---|---|
| **Owner** | `owner` | Kelola menu, kelola pengguna, catat pengeluaran, lihat dashboard + laporan, otorisasi void | Primary (dashboard flow), Secondary (PIN elevation pada Membatalkan Pesanan) |
| **Cashier / Kasir** | `cashier` | Operasional POS harian: buka kasir, order, split/merge bill, bayar, struk, opname akhir shift, tutup kasir | Primary |
| **Kitchen** | `kitchen` | **Input stok masuk pagi** (gantikan catatan sisi kiri buku) — itu saja. Tidak ada notifikasi order. | Primary (1 UC saja) |

Catatan: di diagram saya tulis `Pegawai` tadi — **salah**. Harus `Kitchen` sesuai enum `UserRole` di plan.

---

## 3. Lengkap Use Case List (per module)

Tanda ⭐ = critical path. Tanda ➕ = yang tadi belum saya masukkan.

### 3.1 Auth (semua actor)
- **Login** ⭐ — PIN 6-digit, issue JWT.
- **Logout** — revoke token client-side.
- **Verify PIN** — endpoint helper buat elevation (void, owner actions).

### 3.2 Kasir — Shift Lifecycle
- **Buka Kasir** ⭐ — input modal awal (petty cash). Otomatis set shift `open`.
- **Tutup Kasir (Blind Count)** ⭐ — input jumlah fisik per payment method tanpa lihat system total; sistem hitung variance over/short; shift `closed`.

### 3.3 Kasir — Order Flow
- **Mengelola Pesanan Meja** ⭐ — buka meja kosong → status `terisi`. Juga transfer/pindah pesanan antar meja.
- **Menambah Item Pesanan** ⭐ — pilih menu + qty, cek stok (force order modal kalau kurang), tambah ke keranjang, sync ke transaction_items.
- **Mengedit Item Pesanan** — ubah qty atau hapus item sebelum bayar.
- **Memecah Tagihan (Split Bill)** — pilih item-item tertentu → bayar terpisah.
- **Menggabungkan Tagihan (Merge Bill)** — ambil 2+ transaksi open → jadi 1 invoice.
- **Membatalkan Pesanan (Void)** — require Owner PIN elevation.

### 3.4 Kasir — Payment
- **Memproses Pembayaran** ⭐ — pilih method (cash/qris/transfer/debit/credit/ojol), input nominal, sistem auto-decrement stok, status → `paid`.
- **Mencetak Struk** — optional extend dari Memproses Pembayaran.

### 3.5 Kitchen — Stock In
- **Menginput Stok Masuk** ⭐ — pagi, dari rumah pemilik. Per-menu qty masuk. Gantikan sisi kiri buku.

### 3.6 Kasir — Stock Opname
- **Melakukan Stock Opname** — akhir shift, cocokkan stok fisik vs sistem, hitung variance (deteksi loss/miscount).

### 3.7 Owner — Master Data
- **Mengelola Menu** — CRUD menu + harga + kategori + is_active.
- **Mengelola Pengguna** — CRUD users (kasir & kitchen).

### 3.8 Owner — Keuangan (➕ BARU, sebelumnya kelupaan)
- ➕ **Mencatat Pengeluaran** ⭐ — input total rupiah + kategori (ingredients/utilities/salary/transport/other) + deskripsi + tanggal + paid_by. Ini gantikan struk yang ditempel solatip di sisi kiri buku + catatan total pengeluaran harian.
- ➕ **Mengedit/Menghapus Pengeluaran** — koreksi kalau salah input.

### 3.9 Owner — Monitoring
- **Melihat Dashboard** ⭐ — realtime: low-stock alert, pendapatan hari ini per-method, pengeluaran hari ini, selisih kas rekonsiliasi hari ini.
- **Melihat Laporan Pendapatan** ⭐ — per hari / per bulan. Split per payment method.
- **Melihat Laporan Pengeluaran** ➕ — per hari / per bulan, agregat per kategori.
- **Melihat Laporan Laba Kotor** ➕ — *(Total Pendapatan − Total Pengeluaran)* per bulan. Bukan HPP.
- **Melihat Laporan Rekonsiliasi** — per hari, variance per method + total.

### 3.10 Dependencies

- `Mencetak Struk` **<<extend>>** `Memproses Pembayaran` — opsional.
- `Membatalkan Pesanan` **<<include>>** `Verifikasi PIN Owner` — selalu butuh PIN.
- `Tutup Kasir (Blind Count)` **<<include>>** `Hitung Variance Payment Method` — selalu jalan saat tutup shift.
- `Memproses Pembayaran` **<<include>>** `Mengurangi Stok Otomatis` — stok dikurangi saat bayar (tidak saat order → support force-order).
- *(Alternatif: Mengurangi Stok internal system behavior, tidak perlu jadi UC. Saya cenderung skip untuk menjaga diagram bersih.)*

---

## 4. Ruang Lingkup Aktifitas untuk Activity Diagrams

User benar: satu activity diagram per alur proses utama, bukan 2 UC bundled jadi 1 diagram. List aktivitas yang wajib punya activity diagram sendiri:

| # | Activity Diagram | Actors (swimlanes) | Key decisions/forks |
|---|---|---|---|
| **A.1** | **Login + Buka Kasir** | Kasir, Sistem | Decision: PIN valid? Shift sudah open hari ini? |
| **A.2** | **Input Stok Masuk (Pagi)** | Kitchen, Sistem | Loop: per-menu input qty. Decision: stok hari kemarin sudah di-carry-over? |
| **A.3** | **Mengelola Pesanan Meja + Menambah Item** ⭐ | Kasir, Sistem | Decision: meja kosong/terisi. Decision: stok cukup? (kalau kurang → force order modal + Owner PIN). Loop: tambah item sampai customer stop. |
| **A.4** | **Memproses Pembayaran** ⭐ | Kasir, Sistem | Decision per method. Fork: decrement stok ‖ update status ‖ catat payment. Optional: cetak struk. |
| **A.5** | **Split Bill** | Kasir, Sistem | Loop: pilih item ke bucket. Decision: semua item sudah dialokasikan? |
| **A.6** | **Merge Bill** | Kasir, Sistem | Decision: meja target masih open? |
| **A.7** | **Void Pesanan** | Kasir, Owner, Sistem | Include PIN elevation; decision PIN valid; optional rollback stok. |
| **A.8** | **Stock Opname Akhir Shift** | Kasir, Sistem | Loop: per-menu input aktual. Calculate variance. |
| **A.9** | **Tutup Kasir (Blind Count)** ⭐ | Kasir, Sistem | Loop: input aktual per method. Hitung over/short. Persist settlement. |
| **A.10** | **Mencatat Pengeluaran** ➕ | Owner, Sistem | Decision: kategori valid? Bukti/nota (optional). |
| **A.11** | **Melihat Dashboard / Laporan** | Owner, Sistem | Pilih periode → query agregat → render. |

Untuk skripsi, **wajib** activity diagram-nya: A.3, A.4, A.2, A.9, A.10, A.7 (6 critical). A.1, A.5, A.6, A.8, A.11 bisa masuk bila halaman masih cukup.

---

## 5. Entity List untuk ERD

Per plan §Schema Design, dengan tambahan pengeluaran dibawa naik dari Phase 13 supaya ERD skripsi utuh:

| Entity | Purpose | Key fields |
|---|---|---|
| `users` | Semua user (owner/cashier/kitchen) | id, name, pin, role (UserRole enum), is_active |
| `menus` | Katalog | id, name, category, price, is_active |
| `daily_menu_stocks` | Stok per hari per menu (diisi Kitchen pagi) | id, date, menu_id, opening_stock, current_stock, updated_at |
| `shifts` ➕ | Buka/tutup kasir per hari per cashier | id, date, cashier_id, opening_cash, closed_at |
| `transactions` | Header order per meja | id, shift_id, table_number, status (open/paid/void), payment_method, subtotal, discount_amount, total |
| `transaction_items` | Item per transaksi | id, transaction_id, menu_id, qty, unit_price, subtotal, is_force_order |
| `settlements` | Blind count akhir shift | id, shift_id, date, system_cash, system_qris, system_transfer, system_debit_credit, system_ojol, actual_cash, ..., variance_*, status, submitted_at, reviewed_at |
| `expenses` ➕ (naik dari Phase 13) | Pengeluaran harian | id, date, category (ExpenseCategory enum), amount, description, paid_by (FK users), notes |

Catatan penting: saya usul tambah **`shifts`** baru (tidak ada di plan Phase 6) — karena skripsi sec 1.4 eksplisit sebut "buka kasir" + "tutup kasir (clock-out)" sebagai fitur. Settlement lama (di Laravel) tanpa shift table mempersulit ketika 1 hari ada 2 cashier berbeda. `shifts` = agregat per-cashier per-hari yang bisa jadi parent settlement.

**Keputusan yang sudah dikonfirmasi (resolved):**
- [x] Tambah tabel `shifts` — done, jadi parent dari `transactions` + `settlements`
- [x] `expenses` naik dari Phase 13 ke ERD skripsi utama — done

---

## 6. Sequence Diagram yang wajib dibangun

| Seq | Use Case Scenario | Boundary / Control / Entity |
|---|---|---|
| SQ.1 | Login (happy path) | LoginScreen / AuthService / User |
| SQ.2 | Memproses Pembayaran | PaymentForm / TransactionController / Transaction, DailyMenuStock |
| SQ.3 | Input Stok Masuk | StockInScreen / StockService / DailyMenuStock, Menu |
| SQ.4 | Mencatat Pengeluaran ➕ | ExpenseForm / ExpenseService / Expense, User |
| SQ.5 | Tutup Kasir Blind Count | SettlementForm / SettlementService / Settlement, Transaction |

---

## 7. Mapping ke 8 Diagram Skripsi (S.1–S.8)

Revisi plan diagram skripsi (dari rencana awal, dengan tambahan pengeluaran):

| # | Diagram | Isi baru |
|---|---|---|
| S.1 | **Blok Diagram Sistem** | HP Kasir (PWA) ↔ HP Kitchen (PWA) ↔ Laptop Owner (browser) ↔ Router WiFi ↔ Server (Node+Express+Prisma) ↔ MySQL 8 ↔ Printer Struk (opt) |
| S.2 | **Use Case Diagram** | **Rebuild**: 3 actor (Owner, Kasir, Kitchen), ~18 use case (tambah `Mencatat Pengeluaran`, `Melihat Laporan Pengeluaran`, `Melihat Laporan Laba Kotor`) |
| S.3 | **ERD** | 8 entity (tambah `shifts` + `expenses` naik dari Phase 13) |
| S.4 | **Activity — Order & Pay** | Bundle A.3 + A.4 jadi 1 diagram detail (kasir lifecycle lengkap) ATAU split 2 diagram |
| S.5 | **Activity — Stock Opname (Pagi+Sore)** | Bundle A.2 (Kitchen pagi) + A.8 (Kasir sore) — 3 swimlane |
| S.6 | **Sequence — Login** | SQ.1 |
| S.7 | **Sequence — Pay Transaction** | SQ.2 |
| S.8 | **Flowchart — Force Order** | Decision tree: stok cukup? → decrement. Stok kurang → modal → PIN owner → force-order flag, stok tidak di bawah 0 |

Tambahan yang saya usul (bonus, kalau halaman cukup):
- **Activity — Mencatat Pengeluaran** (A.10) → demonstrate owner financial flow (menjawab rumusan masalah "pemilik nggak tau pendapatan/pengeluaran")
- **Activity — Tutup Kasir Blind Count** (A.9) → menjawab rumusan masalah B (rekonsiliasi + mismatch)

---

## 8. Resolusi (semua sudah dijawab via build, per 2026-04-25)

| # | Pertanyaan | Resolusi |
|---|---|---|
| 1 | Rename `Pegawai` → `Kitchen` | ✅ Done — UC Diagram pakai 3 actor: Owner, Kasir, Kitchen |
| 2 | Tambah 3 UC pengeluaran | ✅ Done dengan **konsolidasi atomicity rule** — 4 laporan terpisah (Pendapatan, Pengeluaran, Laba Kotor, Rekonsiliasi) digabung jadi 1 UC `Melihat Dashboard dan Laporan` (umbrella), `Mencatat Pengeluaran` jadi UC tersendiri |
| 3 | Tambah tabel `shifts` ke ERD | ✅ Done — ERD final 8 entitas include shifts |
| 4 | Naikkan `expenses` ke ERD utama | ✅ Done — ERD final 8 entitas include expenses |
| 5 | Bundle/split A.3+A.4 | ✅ **Split** — Order Flow & Pay Flow jadi 2 diagram terpisah |
| 6 | A.10 Mencatat Pengeluaran masuk? | ✅ Done |

## 9. Status build per 2026-04-25 (final)

### Activity Diagrams (7 dibangun, 4 deferred)

| # | Diagram | Status | Note |
|---|---|---|---|
| A.1 | Login | ✅ | Swimlane User\|Sistem, PIN 6-digit + loop salah |
| A.2 | Stock Opname Pagi (Kitchen) | ✅ | |
| A.3 | Order Flow (was: Mengelola Pesanan + Menambah Item) | ✅ | Force-order branching, loop tambah item |
| A.4 | Pay Flow (Memproses Pembayaran) | ✅ | 6-way payment + opsi cetak struk |
| A.5 | Split Bill | ⏳ Defer | Low priority — Bab 3 sudah cukup figure |
| A.6 | Merge Bill | ⏳ Defer | Same |
| A.7 | Void Pesanan | ⏳ Defer | Bisa di-cover sebagai sub-flow nanti |
| A.8 | Stock Opname Sore (Kasir) | ✅ | |
| A.9 | Tutup Kasir Blind Count | ✅ | Rebuilt 2026-04-25 — layout cleaner |
| A.10 | Mencatat Pengeluaran | ✅ | Rebuilt 2026-04-25 — swimlane Owner\|Sistem |
| A.11 | Dashboard / Laporan | ⏳ Defer | Read-only, activity optional |

### Sequence Diagrams (5 dibangun)

| # | Skenario | Status |
|---|---|---|
| SQ.1 | Login (Happy Path) | ✅ |
| SQ.2 | Memproses Pembayaran | ✅ |
| SQ.3 | Input Stok Masuk | ✅ |
| SQ.4 | Mencatat Pengeluaran | ✅ |
| SQ.5 | Tutup Kasir Blind Count | ✅ |

### Mapping S.1–S.8 (semua dibangun)

| # | Diagram | Status | Output |
|---|---|---|---|
| S.1 | Blok Diagram Sistem | ✅ | 4 device + 3 artifact + 3 communication path. **Topology cellular data → Tencent Cloud VPS** (resto tidak punya WiFi sendiri) |
| S.2 | Use Case Diagram | ✅ | 3 actor + 15 UC + 14 dep |
| S.3 | ERD | ✅ | 8 entitas + 9 relasi (crow's-foot via Mermaid) |
| S.4 | Activity Order & Pay | ✅ **Split** | 2 diagram terpisah (Order + Pay) |
| S.5 | Activity Stock Opname | ✅ **Split** | 2 diagram terpisah (Pagi + Sore) |
| S.6 | Sequence Login | ✅ | SQ.1 |
| S.7 | Sequence Pay Transaction | ✅ | SQ.2 |
| S.8 | Flowchart Force Order | ✅ | Decision tree algoritma — bukan UML, ANSI/ISO 5807 style |

**Total final: 15 diagram** (1 blok + 1 use case + 1 ERD + 7 activity + 5 sequence + 1 flowchart) di `Skripsi.mdj` + render PNG di `docs/diagrams/`.
