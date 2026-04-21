# Skripsi POS — Diagram Spec

Dokumen tunggal: seluruh diagram skripsi (Use Case, ERD, Activity, Sequence, Blok, Flowchart). Ter-grounding di:
- **Skripsi.mdj** (StarUML) — file UML otoritatif
- **docs/extracted/skripsi.txt** — naskah Bab 1–3
- **docs/extracted/adsi.txt** — Modul Pembelajaran ADSI (konvensi diagram)
- **docs/prompt.txt** — latar belakang + backend plan yang dikonfirmasi user

Dipakai sebagai referensi ketika build/review diagram di StarUML, dan sebagai sumber narasi untuk Bab 3 skripsi.

---

## 0. Konteks Proyek

**Judul:** Pembuatan Sistem Point of Sales (POS) pada Restoran X (Ayam Bakar Banjar Monosuko)
**Penyusun:** Ezra Brilliant Konterliem (C14220315) — Sistem Informasi Bisnis, UK Petra

**Tech stack (sesuai Bab 1.4 Ruang Lingkup):**
- Backend: Node.js 20 + Express 4 + TypeScript + Prisma + PostgreSQL 16
- Frontend: React 18 + Vite (PWA installable — Level A: manifest + static cache, butuh internet untuk data)
- Auth: JWT (Authorization: Bearer) + PIN 6-digit
- Platform: Web, optimized untuk desktop (Owner) dan tablet/HP (Kasir, Kitchen)

**Masalah operasional yang ingin dipecahkan (Bab 1.1):**
1. Pencatatan stok + order + pengeluaran semuanya di satu buku tulis (sisi kiri stok+pengeluaran, sisi kanan penjualan) → kacau, rawan mismatch
2. Pegawai sering lupa opname pagi → kasir nggak tau stok → iya-kan order → pernah harus GoSend stok dari rumah pemilik
3. Rekonsiliasi 3 metode bayar (cash/EDC/QRIS — sekarang diperluas jadi 6) manual di akhir hari, rawan selisih tidak terdeteksi
4. Owner nggak tau pasti pendapatan vs pengeluaran bulanan

**Out of scope (batas dari sidang proposal):**
- HPP / cost calculation (dosen penguji: tidak perlu)
- Offline-capable PWA (Level B) — future work
- Notifikasi realtime order ke kitchen

---

## 1. Actor List

Per backend plan (UserRole enum: `owner | cashier | kitchen`):

| Actor | Role DB | Tugas utama | Primary/Secondary |
|---|---|---|---|
| **Owner** | `owner` | Master data (menu, pengguna), catat pengeluaran, monitoring dashboard & laporan, otorisasi void | Primary (dashboard flow), Secondary (PIN elevation pada `Membatalkan Pesanan`) |
| **Kasir / Cashier** | `cashier` | Operasional POS: buka/tutup kasir, order, split/merge bill, bayar, struk, opname akhir shift | Primary |
| **Kitchen** | `kitchen` | **Hanya 1 UC**: input stok masuk pagi saat stok tiba dari rumah pemilik. Tidak ada notifikasi order, tidak ada workflow kompleks (hindari scope creep). | Primary |

Tidak ada actor Customer — customer tidak berinteraksi langsung dengan sistem POS (Kasir yang mewakili input order).

---

## 2. Use Case Diagram (S.2)

**File:** `Skripsi.mdj` → diagram `Use Case Diagram - Sistem POS Restoran`
**System Boundary:** `Sistem POS Restoran` (UMLSubsystem, wajib per ADSI skripsi meskipun ADSI §5 tulis "opsional")

### 2.1. Daftar 12 Use Cases

Prinsip per ADSI §5 + lesson atomicity: **1 UC = 1 atomic business goal**, bukan daftar sub-view/sub-laporan. Detail sub-flow masuk Use Case Scenario (ADSI §6), bukan di diagram.

**Shared (1):**

| # | Use Case | Deskripsi singkat |
|---|---|---|
| UC-01 | `Login` | Autentikasi dengan PIN 6-digit, dapat JWT untuk session. Semua actor pakai UC yang sama. |

**Kasir (9):**

| # | Use Case | Deskripsi singkat |
|---|---|---|
| UC-02 | `Buka Kasir` | Input modal awal (petty cash) → bikin `shifts` row baru, status open. |
| UC-03 | `Mengelola Pesanan Meja` | Buka meja kosong → create `transactions` (status=open), tambah/edit/hapus item sebelum pembayaran. Include cek `daily_menu_stocks` + force-order warning. |
| UC-04 | `Memecah Tagihan (Split Bill)` | Pisahkan item di 1 transaksi jadi 2+ invoice terpisah (untuk customer yang mau bayar masing-masing). |
| UC-05 | `Menggabungkan Tagihan (Merge Bill)` | Gabungkan 2+ transaksi open jadi 1 invoice. |
| UC-06 | `Membatalkan Pesanan` | Void transaksi. **Include** `<<include>>` PIN verification Owner. |
| UC-07 | `Memproses Pembayaran` | Pilih metode (cash/qris/transfer/debit/credit/ojol), input nominal, sistem auto-decrement stok, status→paid. |
| UC-08 | `Mencetak Struk` | **Extend** `<<extend>>` `Memproses Pembayaran` — opsional, kalau customer minta. |
| UC-09 | `Melakukan Stock Opname` | Akhir shift: cocokkan stok fisik vs sistem → hitung variance (deteksi loss/miscount). |
| UC-10 | `Tutup Kasir (Blind Count)` | Akhir shift: input fisik uang + total EDC/QRIS dll **tanpa lihat total sistem** → sistem hitung over/short → settlement status=submitted. |

**Kitchen (1):**

| # | Use Case | Deskripsi singkat |
|---|---|---|
| UC-11 | `Menginput Stok Masuk` | Pagi, saat stok dari rumah pemilik tiba: input qty per menu → create/update `daily_menu_stocks` untuk hari itu. Gantikan catatan tangan di sisi kiri buku. |

**Owner (4):**

| # | Use Case | Deskripsi singkat |
|---|---|---|
| UC-12 | `Mengelola Menu` | CRUD menu (nama, kategori, harga, is_active). |
| UC-13 | `Mengelola Pengguna` | CRUD users (kasir + kitchen). |
| UC-14 | `Mengelola Pengeluaran` | CRUD expenses (total rupiah + kategori + tanggal + paid_by + catatan). Gantikan struk yang ditempel solatip + catatan total di sisi kiri buku. Tidak per-bahan (dosen penguji: tidak perlu HPP). |
| UC-15 | `Melihat Dashboard dan Laporan` | **Satu UC umbrella** untuk monitoring: dashboard realtime (low-stock alert, pendapatan hari ini per-method, pengeluaran hari ini, variance kas), laporan pendapatan harian/bulanan split per payment method, laporan pengeluaran agregat per kategori, laporan laba kotor bulanan (Total Pendapatan − Total Pengeluaran), laporan rekonsiliasi variance per shift. Sub-view detil = tabs/filter di UI, ada di Use Case Scenario — **bukan UC terpisah**. |

### 2.2. Dependencies

- `Mencetak Struk` **`<<extend>>`** `Memproses Pembayaran` — arrow points ke base (Pembayaran). Cetak struk opsional berdasarkan request customer.
- `Membatalkan Pesanan` **`<<include>>`** `Verify PIN Owner` — PIN elevation selalu wajib untuk void. *(Verify PIN tidak digambar sebagai UC terpisah di diagram untuk menjaga kebersihan; masuk dalam scenario Membatalkan Pesanan.)*

### 2.3. Asosiasi

Total **17 assosiasi** actor ↔ use case:
- Kasir → UC-01, 02, 03, 04, 05, 06, 07, 08 (extend via UC-07), 09, 10 *(9 associations)*
- Kitchen → UC-01, 11 *(2 associations)*
- Owner → UC-01, 12, 13, 14, 15, 06 (secondary for PIN elevation) *(6 associations)*

---

## 3. ERD (S.3)

**File:** `Skripsi.mdj` → diagram `ERD - Sistem POS Restoran`
**Notasi:** crow's-foot (StarUML native ERD). PK/FK marked dalam nama kolom untuk kejelasan.

### 3.1. Enum Definitions (Prisma)

```prisma
enum UserRole         { owner, cashier, kitchen }
enum TransactionStatus { open, paid, void }
enum PaymentMethod    { cash, qris, transfer, debit, credit, ojol }
enum SettlementStatus { pending, submitted, reviewed }
enum ExpenseCategory  { ingredients, utilities, salary, transport, other }
enum ShiftStatus      { open, closed }
```

### 3.2. Entities (8 tabel)

#### `users`
Akun semua role. PIN plaintext VARCHAR(6) (bukan hash) agar lookup by PIN di login cepat — trade-off security didokumentasikan di SKRIPSI.md.

| Kolom | Tipe | Catatan |
|---|---|---|
| id | UUID | PK |
| name | VARCHAR(100) | |
| pin | VARCHAR(6) | UNIQUE, index |
| role | ENUM UserRole | owner / cashier / kitchen |
| is_active | BOOLEAN | default true |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### `menus`
Katalog menu (barang siap jual, bukan bahan baku).

| Kolom | Tipe | Catatan |
|---|---|---|
| id | UUID | PK |
| name | VARCHAR(100) | |
| category | VARCHAR(50) | e.g. "Paket Ayam", "Minuman" |
| price | DECIMAL(10,2) | |
| is_active | BOOLEAN | |
| created_at, updated_at | TIMESTAMP | |

#### `daily_menu_stocks`
Stok per-hari per-menu. Kitchen input pagi, kasir decrement saat pay. UNIQUE(date, menu_id).

| Kolom | Tipe | Catatan |
|---|---|---|
| id | UUID | PK |
| date | DATE | |
| menu_id | UUID | FK → menus |
| opening_stock | INT | stok yang dibawa pagi |
| current_stock | INT | sisa realtime |
| updated_at | TIMESTAMP | |

#### `shifts`
Siklus buka/tutup kasir per-hari per-cashier. Parent dari transactions + settlement. **Baru vs Laravel** (sebelumnya tidak ada).

| Kolom | Tipe | Catatan |
|---|---|---|
| id | UUID | PK |
| date | DATE | |
| cashier_id | UUID | FK → users |
| opening_cash | DECIMAL(12,2) | petty cash awal |
| closed_at | TIMESTAMP | nullable (null = open) |
| created_at | TIMESTAMP | |

#### `transactions`
Header order per-meja.

| Kolom | Tipe | Catatan |
|---|---|---|
| id | UUID | PK |
| shift_id | UUID | FK → shifts |
| table_number | INT | |
| cashier_id | UUID | FK → users |
| status | ENUM TransactionStatus | open / paid / void |
| payment_method | ENUM PaymentMethod | nullable (null saat open) |
| subtotal | DECIMAL(12,2) | |
| discount_amount | DECIMAL(12,2) | default 0 |
| total | DECIMAL(12,2) | subtotal − discount |
| created_at | TIMESTAMP | |
| paid_at | TIMESTAMP | nullable |
| voided_at | TIMESTAMP | nullable |

#### `transaction_items`
Item dalam transaksi. Composition dari transactions (item lifecycle terikat transaksi).

| Kolom | Tipe | Catatan |
|---|---|---|
| id | UUID | PK |
| transaction_id | UUID | FK → transactions (ON DELETE CASCADE) |
| menu_id | UUID | FK → menus |
| qty | INT | |
| unit_price | DECIMAL(10,2) | snapshot harga saat order |
| subtotal | DECIMAL(12,2) | qty × unit_price |
| is_force_order | BOOLEAN | true kalau stok tidak cukup tapi Owner izinkan |
| created_at | TIMESTAMP | |

#### `settlements`
Blind count rekonsiliasi akhir shift. 5 metode bayar × 3 kolom (system/actual/variance) = 15 kolom keuangan.

| Kolom | Tipe | Catatan |
|---|---|---|
| id | UUID | PK |
| shift_id | UUID | FK → shifts, UNIQUE (satu settlement per shift) |
| date | DATE | |
| cashier_id | UUID | FK → users |
| reviewer_id | UUID | FK → users, nullable (Owner yang review) |
| system_cash, system_qris, system_transfer, system_debit_credit, system_ojol | DECIMAL(12,2) | total per-method dari sistem |
| actual_cash, actual_qris, actual_transfer, actual_debit_credit, actual_ojol | DECIMAL(12,2) | input fisik kasir (blind — tanpa lihat system) |
| variance_cash, variance_qris, variance_transfer, variance_debit_credit, variance_ojol | DECIMAL(12,2) | actual − system (positive=over, negative=short) |
| status | ENUM SettlementStatus | pending / submitted / reviewed |
| submitted_at | TIMESTAMP | saat kasir submit |
| reviewed_at | TIMESTAMP | nullable, saat Owner approve |

#### `expenses`
Pengeluaran harian. Total rupiah + kategori + deskripsi, **tidak per-bahan** (batasan skripsi). Dinaikkan dari Phase 13 ke ERD utama karena UC `Mengelola Pengeluaran` ada.

| Kolom | Tipe | Catatan |
|---|---|---|
| id | UUID | PK |
| date | DATE | |
| category | ENUM ExpenseCategory | ingredients / utilities / salary / transport / other |
| amount | DECIMAL(12,2) | |
| description | VARCHAR(255) | |
| paid_by | UUID | FK → users (Owner yang input) |
| notes | TEXT | nullable |
| created_at | TIMESTAMP | |

### 3.3. Relationships (9 edges)

| # | From (1) | To (*) | Field | Cardinality | Catatan |
|---|---|---|---|---|---|
| R1 | users | transactions | cashier_id | 1 : 0..* | kasir membuat banyak transaksi |
| R2 | users | shifts | cashier_id | 1 : 0..* | kasir buka shift |
| R3 | users | settlements | cashier_id | 1 : 0..* | kasir submit settlement |
| R4 | users | expenses | paid_by | 1 : 0..* | owner input pengeluaran |
| R5 | shifts | transactions | shift_id | 1 : 0..* | shift berisi banyak transaksi |
| R6 | shifts | settlements | shift_id | 1 : 1 | satu settlement per shift (UNIQUE) |
| R7 | menus | daily_menu_stocks | menu_id | 1 : 0..* | menu punya stok harian |
| R8 | menus | transaction_items | menu_id | 1 : 0..* | menu dipesan di banyak item |
| R9 | transactions | transaction_items | transaction_id | 1 : 1..* | transaksi punya ≥1 item (composition) |

**Tidak digambar (relasi via Owner review, redundant dengan R3):** settlements.reviewer_id → users. Bisa di-note dalam ERD atau dokumentasi kolom.

---

## 4. Activity Diagrams (S.4, S.5, A.9, A.10)

Per ADSI Bab 7: activity diagram dibangun **berdasarkan use case** (1+ UC critical per diagram). Setiap action punya **1 incoming + 1 outgoing** — branch/merge/fork/join lewat node khusus.

### 4.1. A.3 Activity Diagram — Order Flow (S.4)

**Sumber UC:** UC-03 `Mengelola Pesanan Meja`
**Swimlane:** Kasir | Sistem
**Tujuan:** menjawab masalah #2 (kasir iya-kan order tanpa cek stok → force order logic)

**Alur (12 nodes):**
1. Start (Kasir)
2. Action "Pilih Meja Kosong" (Kasir)
3. Action "Buka Pesanan Meja" — create transaction open (Kasir)
4. Action "Pilih Menu dan Qty" (Kasir) ← **loop target**
5. Action "Query daily_menu_stocks (date, menu_id)" (Sistem)
6. Decision "stok cukup? (current_stock >= qty)" (Sistem)
   - **[Ya]** → 7
   - **[Tidak]** → 9
7. Action "Insert Item (is_force_order=false) + decrement current_stock" (Sistem)
8. (merge path normal) → 13
9. Decision "Force order? (konfirmasi Kasir/Owner)" (Kasir)
   - **[Ya]** → 10 → 11
   - **[Tidak]** → 12
10. Action "Konfirmasi Force Order" (Kasir)
11. Action "Insert Item (is_force_order=true); current_stock = MAX(0, current_stock − qty)" (Sistem)
12. Action "Batalkan Item" (Kasir)
13. Merge (gabung 7, 11, 12)
14. Decision "Tambah item lagi?" (Kasir)
    - **[Ya]** → loop ke 4
    - **[Tidak]** → 15
15. Action "Simpan Pesanan (status=open)" (Kasir)
16. End (Kasir)

### 4.2. A.4 Activity Diagram — Pay Flow

**Sumber UC:** UC-07 `Memproses Pembayaran` + UC-08 `Mencetak Struk`
**Swimlane:** Kasir | Sistem
**Tujuan:** menjawab rumusan masalah A (percepat transaksi) + B (rekonsiliasi)

**Alur (13 nodes):**
1. Start (Kasir)
2. Action "Ambil Transaksi Open dari Meja" (Sistem)
3. Action "Tampilkan Tagihan (subtotal, diskon, total)" (Kasir)
4. Action "Pilih Metode Pembayaran" — cash/qris/transfer/debit/credit/ojol (Kasir)
5. Action "Input Nominal Bayar" (Kasir)
6. Decision "nominal >= total?" (Sistem)
   - **[Tidak]** → kembali ke 5
   - **[Ya]** → 7
7. **Fork** (Sistem)
   - 7a. Action "Update transaction.status=paid, payment_method, paid_at"
   - 7b. Action "Pastikan stok sudah ter-decrement saat add item" *(noop jika decrement di order flow sudah dilakukan — defensive)*
   - 7c. Action "Log ke shift totals"
8. **Join** (Sistem)
9. Decision "Customer minta struk?" (Kasir)
   - **[Ya]** → 10
   - **[Tidak]** → 11
10. Action "Cetak Struk" (Kasir, extends Pembayaran)
11. Merge
12. Action "Tampilkan Receipt Page / Confirmation" (Sistem)
13. End (Kasir)

### 4.3. A.2 + A.8 Activity Diagram — Stock Opname Pagi & Sore (S.5)

Bundle 2 alur terkait jadi 1 diagram dengan 3 swimlane: Kitchen | Kasir | Sistem.

**Sumber UC:** UC-11 `Menginput Stok Masuk` (pagi) + UC-09 `Melakukan Stock Opname` (sore)
**Tujuan:** menjawab masalah #1 (pegawai lupa opname pagi → kasir nggak tau stok)

**Alur A — Pagi (Kitchen):**
1. Start
2. Action "Login sebagai Kitchen" (Kitchen)
3. Action "Scan daftar menu aktif" (Sistem)
4. Loop "per menu":
   - 4a. Action "Input qty opening_stock" (Kitchen)
   - 4b. Action "Upsert daily_menu_stocks (date=today, menu_id, opening_stock, current_stock=opening_stock)" (Sistem)
5. Decision "Semua menu sudah di-input?"
   - **[Tidak]** → loop ke 4
   - **[Ya]** → 6
6. Action "Mark opname_done=true untuk tanggal hari ini" (Sistem)
7. End

**Alur B — Sore (Kasir, saat Tutup Kasir):**
8. Start (setelah Tutup Kasir triggered)
9. Action "Ambil daftar menu + current_stock dari sistem" (Sistem)
10. Loop "per menu":
    - 10a. Action "Input qty fisik aktual" (Kasir)
    - 10b. Action "Hitung variance_stock = actual − current_stock" (Sistem)
11. Action "Simpan stock opname record (variance per menu)" (Sistem)
12. End

**Peringatan di POS kasir:** kalau Alur A (pagi) belum done saat kasir buka POS, tampilkan warning "Stok opname pagi belum dilakukan — stok dapat tidak akurat" via `GET /api/stocks/status`.

### 4.4. A.9 Activity Diagram — Tutup Kasir Blind Count

**Sumber UC:** UC-10 `Tutup Kasir (Blind Count)`
**Swimlane:** Kasir | Sistem
**Tujuan:** menjawab rumusan masalah B (mismatch rekonsiliasi)

**Alur (12 nodes):**
1. Start (Kasir menekan "Tutup Kasir")
2. Decision "Masih ada transaksi status=open di shift ini?" (Sistem)
   - **[Ya]** → 3. Action "Tampilkan warning: selesaikan dulu order open" → return ke main
   - **[Tidak]** → 4
4. Action "Tampilkan form Blind Count (tanpa total sistem)" (Sistem)
5. Loop "per payment method (cash, qris, transfer, debit_credit, ojol)":
   - 5a. Action "Input actual_X (fisik uang / total struk EDC / mutasi rekening)" (Kasir)
6. Action "Submit" (Kasir)
7. Action "Hitung system_X dari sum(transactions.total WHERE shift_id + payment_method)" (Sistem)
8. Action "Hitung variance_X = actual_X − system_X untuk semua method" (Sistem)
9. Action "Tampilkan rekap: system vs actual vs variance per method + total over/short" (Sistem)
10. Action "Insert settlements row (status=submitted)" (Sistem)
11. Action "Update shift.closed_at = NOW()" (Sistem)
12. End — settlement siap di-review Owner

### 4.5. A.10 Activity Diagram — Mencatat Pengeluaran

**Sumber UC:** UC-14 `Mengelola Pengeluaran`
**Swimlane:** Owner | Sistem
**Tujuan:** menjawab masalah #4 (owner nggak tau pengeluaran bulanan)

**Alur (sederhana, 8 nodes):**
1. Start (Owner)
2. Action "Buka halaman Pengeluaran" (Owner)
3. Action "Pilih tanggal + kategori (ENUM)" (Owner)
4. Action "Input amount + description (+ notes opsional)" (Owner)
5. Action "Submit" (Owner)
6. Decision "Input valid? (amount > 0, kategori valid)" (Sistem)
   - **[Tidak]** → kembali ke 4 dengan error message
   - **[Ya]** → 7
7. Action "Insert expenses row (paid_by=session.user.id, date, category, amount, description, notes)" (Sistem)
8. End — pengeluaran muncul di dashboard + laporan

---

## 5. Sequence Diagrams (S.6, S.7) — planned

Per ADSI Bab 10: sequence diagram per use case scenario, pakai stereotype `<<boundary>>` / `<<control>>` / `<<entity>>`.

### 5.1. SQ.1 Sequence Diagram — Login (Happy Path, S.6)

**Lifelines (L→R):**
- Actor: `Kasir`
- `:LoginScreen` `<<boundary>>` (React page)
- `:AuthService` `<<control>>` (Express module)
- `user : User` `<<entity>>` (Prisma model)

**Messages (numbered, synchronous solid arrows kecuali return):**
1. Kasir → LoginScreen : `submitPIN(pin)`
2. LoginScreen → AuthService : `POST /api/auth/login {pin}`
3. AuthService → User : `findByPin(pin)`
4. User →→ AuthService : `: User | null` *(reply, dashed)*
5. `alt [user found]`
   - 5.1. AuthService → AuthService : `signJWT(user) : token`
   - 5.2. AuthService →→ LoginScreen : `{success, data: {user, token}}`
   - 5.3. LoginScreen → Kasir : display POS page
6. `else [null]`
   - 6.1. AuthService →→ LoginScreen : `{success:false, message:"PIN salah"}`
   - 6.2. LoginScreen → Kasir : display error

### 5.2. SQ.2 Sequence Diagram — Pay Transaction (S.7)

**Lifelines (L→R):**
- Actor: `Kasir`
- `:PaymentForm` `<<boundary>>`
- `:TransactionController` `<<control>>`
- `transaction : Transaction` `<<entity>>`
- `stock : DailyMenuStock` `<<entity>>`
- `shift : Shift` `<<entity>>`

**Messages:**
1. Kasir → PaymentForm : `submitPayment(method, amount)`
2. PaymentForm → TransactionController : `POST /api/transactions/{id}/pay`
3. TransactionController → Transaction : `findById(id)`
4. Transaction →→ TransactionController : return transaction + items
5. `loop [each item]`:
   - 5.1. TransactionController → DailyMenuStock : `decrement(menu_id, qty)` *(noop jika sudah decrement saat add item; defensive)*
6. TransactionController → Transaction : `update(status=paid, payment_method=method, paid_at=NOW())`
7. `opt [customer minta struk]`:
   - 7.1. TransactionController →→ PaymentForm : return receipt data
   - 7.2. PaymentForm → Kasir : print
8. TransactionController →→ PaymentForm : `{success, data: transaction}`

---

## 6. Blok Diagram / Deployment (S.1) — planned

**Tipe UML:** Deployment Diagram (UMLDeploymentDiagram)
**Tujuan:** gambaran arsitektur runtime — apa run di mana, protokol apa.

**Nodes (UMLDevice / UMLExecutionEnvironment):**
1. **HP Kasir** (Device) — Chrome/PWA exec env — `pos-frontend` artifact
2. **HP Kitchen** (Device) — Chrome/PWA — `pos-frontend` artifact (same bundle, beda role login)
3. **Laptop Owner** (Device) — Chrome — `pos-frontend`
4. **Router WiFi Restoran** (Device) — penghubung
5. **Server Restoran** (Device) — Node.js 20 runtime (Docker opsional) — `server.ts (Express + Prisma)` artifact
6. **PostgreSQL 16** (ExecutionEnvironment di server atau device terpisah) — `pos_db` schema artifact
7. **Printer Struk** (Device, opsional) — USB/Bluetooth ke HP Kasir

**Communication paths (protocol stereotype):**
- HP Kasir/Kitchen/Owner ↔ Router : `<<WiFi>>`
- Router ↔ Server : `<<Ethernet/LAN>>`
- pos-frontend → server.ts : `<<HTTPS/REST JSON + JWT>>`
- server.ts ↔ PostgreSQL : `<<TCP/IP SQL>>` (port 5432)
- HP Kasir ↔ Printer : `<<USB>>` atau `<<Bluetooth>>`

---

## 7. Flowchart (S.8) — planned

**Tipe:** ANSI/ISO 5807 flowchart (bukan UML activity — classical flowchart). Distinguisi dari activity diagram: tidak pakai swimlane, pakai decision Yes/No simple.

**Algoritma:** Force Order Logic (dari UC-03 sub-flow)

**Pseudocode:**
```
1. User pick (menu_id, qty_request)
2. Fetch current_stock FOR UPDATE
3. IF qty_request <= current_stock:
     current_stock -= qty_request
     INSERT transaction_item(..., is_force_order=false)
4. ELSE:
     SHOW ForceOrderModal
     ASK Owner PIN
     IF PIN valid:
       current_stock = MAX(0, current_stock − qty_request)
       INSERT transaction_item(..., is_force_order=true)
     ELSE:
       REJECT / CANCEL
```

**Shapes yang dipakai:**
- Terminator oval: Start, End
- Process rectangle: "current_stock -= qty_request", "INSERT item", dll
- Decision diamond (Yes/No): "qty_request ≤ current_stock?", "PIN valid?"
- Data parallelogram: "Fetch current_stock", "ASK Owner PIN"
- Flow arrows vertikal

---

## 8. Traceability Matrix (UC ↔ Diagram)

| Use Case | Activity | Sequence | Flowchart |
|---|---|---|---|
| UC-01 Login | — | **SQ.1** Login | — |
| UC-02 Buka Kasir | (bagian dari A.9 pre) | — | — |
| UC-03 Mengelola Pesanan Meja | **A.3 Order Flow** (S.4) | — | **S.8 Force Order** (sub-logic) |
| UC-04 Split Bill | (opsional A.5 future) | — | — |
| UC-05 Merge Bill | (opsional A.6 future) | — | — |
| UC-06 Membatalkan Pesanan | (opsional A.7 future, PIN elevation flow) | — | — |
| UC-07 Memproses Pembayaran | **A.4 Pay Flow** | **SQ.2** Pay Transaction | — |
| UC-08 Mencetak Struk | (extend di A.4) | (opt fragment di SQ.2) | — |
| UC-09 Stock Opname | **A.8** (Kasir sore, bundle di S.5) | — | — |
| UC-10 Tutup Kasir | **A.9 Blind Count** | — | — |
| UC-11 Input Stok Masuk | **A.2** (Kitchen pagi, bundle di S.5) | — | — |
| UC-12 Mengelola Menu | (CRUD, activity tidak wajib) | — | — |
| UC-13 Mengelola Pengguna | (CRUD, activity tidak wajib) | — | — |
| UC-14 Mengelola Pengeluaran | **A.10** | — | — |
| UC-15 Dashboard dan Laporan | (baca-saja, activity tidak wajib) | — | — |

**Critical diagrams wajib untuk skripsi (6):** S.1, S.2, S.3, S.4 (A.3), S.5 (A.2+A.8), S.7 (SQ.2). Sisanya optional bonus.

---

## 9. Mapping ke Rumusan Masalah Skripsi (Bab 1.2)

| Rumusan Masalah | Dijawab oleh (diagram + UC) |
|---|---|
| **A.** Sistem POS mempercepat durasi transaksi? | UC-03 Order + UC-07 Pay + A.3 + A.4 + SQ.2 — hitung duration rata-rata order→pay pre vs post |
| **B.** Sistem mempercepat rekonsiliasi + turunkan mismatch? | UC-10 Blind Count + A.9 + settlements variance_* kolom — hitung selisih harian sebelum vs sesudah |
| **C.** Fitur manajemen stok harian + opname minimalisir mismatch? | UC-09 + UC-11 + A.2/A.8 (S.5) + daily_menu_stocks entity — hitung stock_variance avg pre vs post |

---

## 10. Checklist Build Status (per Apr 2026)

- [x] S.2 Use Case Diagram — 3 actors + 12 UCs + 17 associations + 1 extend
- [x] S.3 ERD — 8 entities + 77 columns + 9 relationships
- [ ] S.4 / A.3 Activity Order Flow — *blocked: extension UMLInitialNode tidak bisa di-create, perlu fix view class resolver*
- [ ] A.4 Activity Pay Flow — blocked (same root cause)
- [ ] S.5 Activity Stock Opname (A.2+A.8) — blocked
- [ ] A.9 Activity Tutup Kasir — blocked
- [ ] A.10 Activity Mencatat Pengeluaran — blocked
- [ ] S.1 Blok Diagram (Deployment) — belum dibuat
- [ ] S.6 Sequence Login — belum dibuat
- [ ] S.7 Sequence Pay — belum dibuat
- [ ] S.8 Flowchart Force Order — belum dibuat

**Known blocker (Activity Diagrams):** `staruml-mcp-extension` v0.2.3 saat ini gagal create UMLInitialNode/ActivityFinalNode/DecisionNode/MergeNode/ActivityPartition — error `"ViewType is not a constructor"`. Root cause: StarUML factory butuh view class specific (bukan `UMLInitialNodeView` string). Fix direction: introspect `type.*` global dari extension untuk dapatkan nama view class yang benar. Dokumentasi di file ini tetap bisa dipakai manual di StarUML GUI sementara auto-build via MCP belum jalan.

---

*Dokumen ini auto-generated summary. Sumber otoritatif tetap `Skripsi.mdj` (untuk diagram visual) dan `skripsi.txt` (untuk narasi Bab 1–3). Update dokumen ini setiap kali diagram di-rebuild atau scope berubah.*
