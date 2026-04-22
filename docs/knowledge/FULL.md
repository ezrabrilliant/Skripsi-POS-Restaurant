# Full Knowledge — Sistem POS Ayam Bakar Banjar Monosuko

Kompilasi lengkap pengetahuan tentang semua diagram skripsi ini. Dokumen ini **self-contained** — reviewer, dosen pembimbing, atau future agent bisa baca satu file ini dan memahami seluruh design.

Untuk deep-dive per jenis diagram, lihat file terpisah:
- [USE-CASE.md](USE-CASE.md) — Use Case Diagram detail
- [ACTIVITY.md](ACTIVITY.md) — 7 Activity Diagrams detail
- [ERD.md](ERD.md) — Entity Relationship Diagram detail
- (sequence diagrams dijelaskan singkat di §6 dokumen ini)

File terkait:
- [DIAGRAM-SPEC.md](../DIAGRAM-SPEC.md) — design specification (pre-build)
- [DATA-DICTIONARY.md](../DATA-DICTIONARY.md) — 8 tabel data dictionary (Bab 3 paste-ready)
- [diagrams/INDEX.md](../diagrams/INDEX.md) — gallery PNG hasil render
- [planning/DIAGRAM-PLAN.md](../planning/DIAGRAM-PLAN.md) — 6 keputusan awal design

---

## 1. Konteks Skripsi

**Judul:** Pembuatan Sistem Point of Sales (POS) pada Restoran X (Ayam Bakar Banjar Monosuko)
**Penyusun:** Ezra Brilliant Konterliem (C14220315), Sistem Informasi Bisnis UK Petra.

### 1.1. Masalah yang Dipecahkan (Bab 1.1)

1. Semua order + stok + pengeluaran dicatat manual di **satu buku tulis** dua sisi. Kekacauan administrasi.
2. Pegawai lupa opname pagi → kasir tidak tau stok → pernah GoSend dari rumah pemilik saat stok habis.
3. Pencatatan 3 metode bayar (cash/EDC/QRIS) manual → mismatch tidak terdeteksi.
4. Owner tidak tau persis pendapatan + pengeluaran bulanan.

### 1.2. Batasan Penelitian (dari Sidang Proposal)
- Tidak hitung HPP (dosen penguji: tidak perlu)
- Pengeluaran dicatat total + kategori (tidak per-bahan)
- PWA Level A (installable, tetap butuh internet)

### 1.3. Stack Teknis (final per plan)
- Backend: Node.js 20 + Express 4 + TypeScript + Prisma + PostgreSQL 16
- Frontend: React 18 + Vite (PWA Level A)
- Auth: JWT + PIN 6-digit
- Role: `owner`, `cashier`, `kitchen`

---

## 2. Tiga Aktor Sistem

| Aktor | Role DB | Tanggung Jawab |
|---|---|---|
| **Owner** | `owner` | Master data (menu, pengguna), catat pengeluaran, monitoring dashboard & laporan, otorisasi void |
| **Kasir / Cashier** | `cashier` | Operasional POS: buka/tutup kasir, order, split/merge bill, bayar, struk, opname |
| **Kitchen** | `kitchen` | Input stok masuk pagi (1 use case saja) |

---

## 3. Use Case Diagram (detail → [USE-CASE.md](USE-CASE.md))

### Ringkasan

- **System Boundary:** `Sistem POS Restoran`
- **3 Actor** (Owner, Kasir, Kitchen)
- **15 Use Case** terbagi 4 domain:
  1. Autentikasi: `Login`
  2. Operasional kasir: `Buka Kasir`, `Mengelola Pesanan Meja`, `Memecah Tagihan`, `Menggabungkan Tagihan`, `Membatalkan Pesanan`, `Memproses Pembayaran`, `Mencetak Struk`, `Melakukan Stock Opname`, `Tutup Kasir (Blind Count)`
  3. Manajemen stok: `Menginput Stok Masuk` (Kitchen)
  4. Master data + monitoring: `Mengelola Menu`, `Mengelola Pengguna`, `Mengelola Pengeluaran`, `Melihat Dashboard dan Laporan` (Owner)
- **14 Dependencies:**
  - 13 `<<include>>` dari main UC → `Login`
  - 1 `<<extend>>`: `Mencetak Struk` → `Memproses Pembayaran`

![Use Case](../diagrams/use-case-diagram-sistem-pos-restoran.png)

---

## 4. Activity Diagrams (detail → [ACTIVITY.md](ACTIVITY.md))

### Ringkasan 7 Diagram

| # | Nama | Swimlane | Tujuan |
|---|---|---|---|
| A.1 | Login | User, Sistem | Autentikasi PIN 6-digit, prasyarat semua UC lain |
| S.4 | Order Flow | Kasir, Sistem | Alur order meja + force-order check |
| A.4 | Pay Flow | Kasir, Sistem | 6-way payment + optional cetak struk |
| A.2 | Stock Opname Pagi | Kitchen, Sistem | Kitchen input stok harian (gantikan buku manual) |
| A.8 | Stock Opname Sore | Kasir, Sistem | Cocokkan stok fisik vs sistem akhir shift |
| A.9 | Tutup Kasir (Blind Count) | Kasir, Sistem | Rekonsiliasi 5-way payment tanpa lihat total sistem |
| A.10 | Mencatat Pengeluaran | Owner, Sistem | Input expense kategori + amount harian |

![Order Flow](../diagrams/activity-diagram-order-flow.png)

### Konvensi Activity

- Action names: **Title Case Indonesian business language**, bukan SQL atau code
- Decision diberi **nama pertanyaan** (e.g. "Stok cukup?", "Input valid?")
- Guards: **plain text tanpa bracket** (`Ya`, `Tidak`, `Minta struk`)
- Single merge untuk multiple exclusive path konvergen

---

## 5. ERD (detail → [ERD.md](ERD.md))

### Ringkasan

- **8 Entitas:** `users`, `menus`, `daily_menu_stocks`, `shifts`, `transactions`, `transaction_items`, `settlements`, `expenses`
- **77 Kolom total**
- **9 Relasi** (8× 1:N + 1× 1:1 + 1 komposisi via junction `transaction_items`)
- Notasi: **crow's-foot** (bukan Chen)

![ERD](../diagrams/erd-sistem-pos-restoran.png)

### Relasi Utama

| Parent | Child | Cardinality |
|---|---|---|
| users | transactions, shifts, settlements, expenses | 1 : N |
| shifts | transactions | 1 : N |
| shifts | settlements | 1 : 1 (shift_id UNIQUE) |
| menus | daily_menu_stocks, transaction_items | 1 : N |
| transactions | transaction_items | 1 : 1..N (komposisi) |

Data dictionary lengkap (8 tabel × Field/Tipe/Keterangan) di [DATA-DICTIONARY.md](../DATA-DICTIONARY.md).

---

## 6. Sequence Diagrams

5 sequence diagram dibuat untuk skenario-skenario kritis:

| # | Skenario | Actor + Lifelines |
|---|---|---|
| SQ.1 | Login (Happy Path) | Kasir → LoginScreen → AuthService → user:User |
| SQ.2 | Pay Transaction | Kasir → PaymentForm → TransactionController → transaction, stock, shift |
| SQ.3 | Input Stok Masuk (Pagi) | Kitchen → StockInScreen → StockService → menu, stock |
| SQ.4 | Mencatat Pengeluaran | Owner → ExpenseForm → ExpenseService → user, expense |
| SQ.5 | Tutup Kasir Blind Count | Kasir → SettlementForm → SettlementService → transaction, settlement, shift |

### Konvensi Sequence (per ADSI Bab 10)

- Lifeline stereotype: **«boundary»** (UI), **«control»** (service), **«entity»** (model)
- Message arrows: **synchronous solid**; reply dashed
- Messages numbered: `1`, `2`, `2.1`, `3`, dst
- Parent container: `UMLInteraction` (bukan `UMLCollaboration`) — kalau salah parent, StarUML gagal render SeqLifelineView

PNG files di `docs/diagrams/sequence-diagram-*.png`.

---

## 7. Traceability Matrix — Use Case × Diagram

| Use Case | Activity | Sequence |
|---|---|---|
| UC-01 Login | — | SQ.1 |
| UC-02 Buka Kasir | (bagian dari A.9 pre) | — |
| UC-03 Mengelola Pesanan Meja | **S.4 Order Flow** | — |
| UC-04 Split Bill | (future A.5) | — |
| UC-05 Merge Bill | (future A.6) | — |
| UC-06 Membatalkan Pesanan | (future A.7 PIN elevation) | — |
| UC-07 Memproses Pembayaran | **A.4 Pay Flow** | **SQ.2** |
| UC-08 Mencetak Struk | (extend di A.4) | (opt fragment SQ.2) |
| UC-09 Stock Opname | **A.8** (sore) | — |
| UC-10 Tutup Kasir | **A.9 Blind Count** | **SQ.5** |
| UC-11 Input Stok Masuk | **A.2** (pagi) | **SQ.3** |
| UC-12 Mengelola Menu | (CRUD, activity optional) | — |
| UC-13 Mengelola Pengguna | (CRUD, activity optional) | — |
| UC-14 Mengelola Pengeluaran | **A.10** | **SQ.4** |
| UC-15 Dashboard dan Laporan | (read-only, activity optional) | — |

---

## 8. Mapping ke Rumusan Masalah Skripsi

| Rumusan Masalah (Bab 1.2) | Diagram yang Menjawab |
|---|---|
| **A.** Percepat durasi transaksi | UC-03 + UC-07 + S.4 + A.4 + SQ.2 — alur order + pay yang systemized |
| **B.** Percepat rekonsiliasi + turunkan mismatch | UC-10 + A.9 + SQ.5 + entity `settlements` (5-way variance) |
| **C.** Manajemen stok harian turunkan mismatch | UC-09 + UC-11 + A.2 + A.8 + entity `daily_menu_stocks` |
| **(#4 latar belakang)** Owner tidak tau pengeluaran | UC-14 + UC-15 + A.10 + entity `expenses` |

---

## 9. Status Build

- ✅ **S.2 Use Case Diagram** (1 diagram)
- ✅ **S.3 ERD** (1 diagram, 8 entitas, 77 kolom, 9 relasi)
- ✅ **5 Sequence Diagrams** (SQ.1-5)
- ✅ **7 Activity Diagrams** (A.1, S.4, A.4, A.2, A.8, A.9, A.10)
- ⏳ **S.1 Blok Diagram Sistem** (Deployment) — belum dibangun
- ⏳ **S.8 Flowchart Force Order** — belum dibangun
- ✅ **Data Dictionary** (DATA-DICTIONARY.md, 8 tabel)

Total **13 dari 15 diagram yang direncanakan** sudah dibangun.

---

## 10. Output Files

### Diagrams (PNG) di `docs/diagrams/`
```
use-case-diagram-sistem-pos-restoran.png      (217 KB)
erd-sistem-pos-restoran.png                   (212 KB)
activity-diagram-order-flow.png               (168 KB)
activity-diagram-pay-flow.png                 (162 KB)
activity-diagram-stock-opname-pagi-kitchen.png (129 KB)
activity-diagram-stock-opname-sore-kasir.png  (142 KB)
activity-diagram-tutup-kasir-blind-count.png  (197 KB)
activity-diagram-mencatat-pengeluaran.png     (138 KB)
sequence-diagram-login-happy-path.png         (79 KB)
sequence-diagram-pay-transaction.png          (114 KB)
sequence-diagram-input-stok-masuk-pagi.png    (105 KB)
sequence-diagram-mencatat-pengeluaran.png     (96 KB)
sequence-diagram-tutup-kasir-blind-count.png  (144 KB)
```

### StarUML Source
```
Skripsi.mdj  (project file, editable di StarUML v7+)
```

### Dokumentasi
```
docs/knowledge/
├── USE-CASE.md    (§3)
├── ACTIVITY.md    (§4)
├── ERD.md         (§5)
└── FULL.md        (this file)

docs/
├── DIAGRAM-SPEC.md        (design spec, pre-build)
├── DATA-DICTIONARY.md     (8 tabel Bab 3)
├── diagrams/INDEX.md      (gallery)
└── planning/DIAGRAM-PLAN.md (decisions log)
```

---

## 11. Konvensi Global (untuk konsistensi)

### Bahasa
- **Indonesian Title Case** untuk nama elemen yang orang awam baca (actor, use case, activity action)
- **snake_case English-Indonesian mix** untuk nama tabel, kolom, enum value
- **Bahasa bisnis** untuk activity actions — hindari SQL/code/pseudocode

### Naming Pola
- Entity ERD: lowercase snake_case (`users`, `daily_menu_stocks`)
- Primary key: `id` (UUID)
- Foreign key: `<entity>_id` (contoh: `menu_id`, `cashier_id`)
- Enum values: lowercase underscore (`cash`, `debit_credit`)

### Konsistensi Arrow Direction
- `<<include>>`: panah **ke UC yang jalan dulu** (biasanya ke Login)
- `<<extend>>`: panah **ke base UC** (extending jalan opsional)
- Generalization (hollow triangle): panah ke **parent/superclass**

---

## 12. Referensi Konvensi

- **ADSI Modul Pembelajaran** — Bab 5 (Use Case), Bab 7 (Activity), Bab 10 (Interaction/Sequence), Bab 8 (Class)
- **3 skripsi POS UK Petra** yang distudi:
  - Cross-channel strategy pada Resto X (Gobiz integration)
  - Supermarket XYZ dengan metode Market Basket Analysis
  - Toko X dengan analisis ABC-VED (inventory control)
- **Skills** di `.claude/skills/` — use-case-diagram, activity-diagram, erd-diagram, sequence-diagram, block-diagram, flowchart, class-diagram

## 13. Memory Snapshot (untuk future agents)

Memory feedback yang accumulated selama build:

- **Atomicity UC**: konsolidasi over-split UC (5 "Melihat Laporan" → 1 "Melihat Dashboard dan Laporan")
- **Activity bahasa bisnis**: no SQL/field names dalam UMLAction name
- **Decision names + guards**: diamond diberi nama pertanyaan, guards plain text tanpa bracket
- **ERD Mermaid**: pakai `generate_diagram` dengan erDiagram, jangan manual per-kolom
- **Sequence parent**: UMLLifeline + UMLMessage parent wajib UMLInteraction (bukan UMLCollaboration)
- **LinePart height**: StarUML SeqLifeline linePart bisa balloon ke 14k px — manually cap atau extension v0.2.6+ auto-cap
- **Save after every edit**: StarUML no auto-save, panggil save_project setelah setiap mutation

Memory files di `C:\Users\ezrak\.claude\projects\c--Users-ezrak-Documents-Skripsi-Skripsi-POS-Restaurant\memory\`.

---

*Dokumen ini auto-compiled dari USE-CASE.md, ACTIVITY.md, ERD.md + integrations. Update bersamaan kalau diagram/design berubah.*
