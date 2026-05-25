# Session Kickoff Prompt — Untuk Sesi Claude Code Baru (REV 2.3)

> **Cara pakai:** Copy salah satu prompt di bawah, paste sebagai pesan pertama di sesi Claude Code baru. Adjust seperlunya untuk task yang ingin dilanjutkan.
> **State saat ini:** Dokumentasi sudah final REV 2.3 (ground truth + permission matrix + 3 design + naskah Bab 3 + data dictionary). Yang **belum di-refactor**: backend code, frontend code, StarUML UC visual (annotation update). Refactor plan: `~/.claude/plans/ubah-backend-dari-laravel-crystalline-wilkes.md`.

---

## 🟢 Prompt PALING SINGKAT (untuk continuity)

```
Sesi sebelumnya kita audit ground truth resto dan upgrade dokumentasi ke REV 2.3
(ground truth + permission matrix + workflow waiter fallback + Login form input murni).
Schema 14 entitas REV 2.2 stabil — REV 2.3 tidak menambah schema, hanya
middleware permission + 3 dashboard per role.

Sebelum apapun:

1. Baca CLAUDE.md (header "WAJIB BACA DULU")
2. Baca docs/operasional-resto.md (ground truth final REV 2.3, ada seksi Permission Matrix)
3. Baca memory project_session_handoff.md (state + DO/DON'T + TODO pending)
4. Baca docs/superpowers/specs/2026-05-24-permission-matrix-design.md (spec brainstorming)

Setelah baca, konfirmasi state dengan saya, lalu tanya saya mau lanjut dari mana.
JANGAN langsung edit code/schema tanpa diskusi.
```

---

## 🟡 Prompt LENGKAP (rekomendasi untuk handoff yang aman)

```
Halo, ini lanjutan sesi skripsi POS Restoran "Ayam Bakar Banjar Monosuko"
(Ezra Brilliant, C14220315). Sesi sebelumnya kita selesai dokumentasi REV 2.3
(14 entitas + permission matrix + workflow waiter fallback + Login form murni)
tapi belum sempat refactor implementasi code.

**WAJIB BACA DULU sebelum action apapun:**
1. `CLAUDE.md` (header "WAJIB BACA DULU" di root proyek)
2. `docs/operasional-resto.md` (ground truth final REV 2.3 — sumber tertinggi,
   ada seksi "Permission Matrix" baru)
3. `docs/superpowers/specs/2026-05-24-permission-matrix-design.md`
   (design spec brainstorming workflow order intake & permission)
4. `~/.claude/projects/c--Users-ezrak-Documents-Skripsi-Skripsi-POS-Restaurant/memory/project_session_handoff.md`
   (state proyek, DO/DON'T sesi, TODO pending urutan eksekusi)
5. `~/.claude/projects/.../memory/project_resto_operational_truths.md`
   (ringkasan structural ground truth REV 2.3)

**Memory rules yang HARUS dipatuhi:**
- `feedback_ask_resto_specifics.md` — WAJIB tanya saya sebelum desain operasional baru
- `feedback_log_everything_for_session_continuity.md` — catat tiap selesai
  ke MD knowledge + memory yang relevan
- `feedback_incremental_build.md` — satu file/group per step, jelaskan + tunggu review

**State REV 2.3 (penting untuk dipahami):**
- 3 role: Owner, Kasir, Waiter
- **Workflow primary order intake = berbasis kertas**: waiter tulis kertas → kasir
  input ke POS. Waiter punya akses POS untuk input order sebagai FALLBACK ONLY
  bila kasir tidak available (bukan co-equal dengan kasir).
- **Login = form 2 field input nama + PIN murni** (no list picker, no localStorage,
  no remember last user). Setiap login pegawai ketik nama manual.
- **14 entitas, 19 relasi** (REV 2.2 schema, REV 2.3 tidak menambah schema)
- **Permission matrix di app layer** (backend middleware + frontend conditional UI),
  bukan di DB. Tabel `users.role` enum tetap single source of truth.

**JANGAN:**
- Langsung edit schema/code tanpa baca operasional-resto.md REV 2.3
- Bikin asumsi operasional (PIN policy, jumlah meja, payment method, alur stok)
  tanpa tanya saya
- Pakai placeholder palsu (Pak Budi, PIN 100000). Pegawai riil:
  Owner (anonim), Kasir Jason/Bryant/Chen Hong, Waiter Amel/Yanti
- Bikin plan / call ExitPlanMode sebelum diskusi tuntas
- Overengineer (mis. tipe order 5 enum padahal cukup 2)
- Asumsi waiter co-equal dengan kasir untuk input order (REV 2.3 clarify:
  waiter = fallback only)
- Bikin Login flow 2-step pilih nama dari daftar + localStorage (itu REV 2.1
  era, sudah dikoreksi di REV 2.2/2.3 jadi form input nama+PIN murni)

Setelah baca semua, summarize:
1. State proyek sekarang di fase mana (docs vs code)
2. Apa yang completed, apa yang pending
3. Apa yang mau saya lanjutkan

Lalu tunggu saya jawab.
```

---

## 🔴 Prompt SPESIFIK — kalau mau lanjut Phase tertentu

### Untuk lanjut **rewrite schema.prisma ke REV 2.2** (REV 2.3 tidak menambah schema):

```
Lanjutan sesi skripsi POS resto. Baca file handoff dulu:
- CLAUDE.md, docs/operasional-resto.md, memory project_session_handoff.md
- docs/superpowers/specs/2026-05-24-permission-matrix-design.md

Setelah baca, fokus task ini: **rewrite backend/prisma/schema.prisma ke REV 2.2**
(14 entitas — REV 2.3 tidak menambah schema, hanya middleware permission).
Sesuai TODO #1 di handoff doc + ERD.md REV 2.3 §6 untuk detail kolom.

Perubahan dari REV 2 lama:
- Enum UserRole: drop `kitchen`, sisakan `owner | cashier | waiter`
- Enum OrderType: cuma `dineIn | takeaway` (drop 3 lainnya)
- Enum PaymentMethod tetap 6, tambah field Transaction.paymentBank String? nullable
- Drop model BulkStock + enum BulkStockKind → ganti dengan RawMaterial model
  (id, name, unit varchar, category enum, isTracked Bool, stockQty Decimal,
   minStock Int?, unitPrice Decimal?, freshnessDays Int?, lastBuyDate Date?)
- Tambah model Vendor (id, name, type varchar, phone? varchar, note? varchar)
- Drop Purchase.items Json → normalized:
  - Purchase header (id, date, userId, vendorId Int?, totalAmount, note?)
  - PurchaseItem detail (id, purchaseId, rawMaterialId, qty, unitPrice, subtotal,
    expiredDate?)
- PortionStock tambah openingQtyToday Int + openingQtyDate Date (auto-snapshot pagi)
- Transaction tambah mergedIntoId Int? self-ref (untuk merge bill)
- **REV 2.2 BARU**: rename StockMovement → PortionMovement (rename enum
  StockMovementReason → PortionMovementReason)
- **REV 2.2 BARU**: tambah model RawMaterialMovement (id, rawMaterialId, delta Decimal,
  reason enum RawMaterialMovementReason, note?, userId, createdAt) untuk audit log
  raw materials
- Tambah enum RawMaterialMovementReason (purchase, opname, manual_adjust)
- TransactionItem tambah subOptionsSelected Json? + partyId Int? (untuk split bill)
- Drop model Expense (sudah dipecah jadi Purchase + Bill)
- Tambah model Bill (id, month VARCHAR(7), category enum, amount, note?, userId)
- Shift tambah type enum (pagi | malam); modal awal di sini

Plus update menu-catalog.ts + seed.ts + run prisma db:push.

JANGAN apply sebelum kasih saya outline diff schema lengkap dulu, supaya saya
bisa review struktur baru.
```

### Untuk lanjut **refactor backend code ke REV 2.3** (permission middleware granular):

```
Lanjutan sesi skripsi POS resto. Baca file handoff dulu (CLAUDE.md,
docs/operasional-resto.md, memory project_session_handoff.md,
docs/superpowers/specs/2026-05-24-permission-matrix-design.md).

Setelah baca, fokus task: **refactor backend code ke REV 2.3**.

**REV 2.3 utama yang berubah di backend**: granular permission middleware per-aksi.
Sebelumnya pakai `requireRole(['owner', 'cashier'])` di route level. REV 2.3 perlu
split lebih granular:

| Endpoint | Roles |
|---|---|
| POST /transactions | semua role (owner+kasir+waiter — waiter fallback) |
| POST /transactions/:id/payment | owner + kasir saja (waiter ✗) |
| POST /transactions/:id/void | owner + kasir saja |
| POST /shifts/open, /close | kasir saja |
| POST /settlements | owner + kasir |
| PUT /settlements/:id/review | owner saja |
| POST /purchases, /vendors | owner + kasir |
| POST /raw-materials (CRUD master) | owner saja, kecuali inline-add saat purchase = kasir bisa |
| POST /bills | owner saja |
| POST /opname/portion, /opname/raw_materials | semua role |
| PUT /menus, POST /users | owner saja |

Module yang perlu diubah (urut dependency):
1. auth (login by form input nama+PIN — drop 2-step list picker + drop endpoint
   /api/auth/users-public + drop localStorage remember)
2. users (drop pin uniqueness validation)
3. transactions (orderType 2 enum, paymentBank field, mergedIntoId, decrement
   PortionStock saat submit boleh minus, log ke portion_movements)
4. stocks/portion (restock pagi, barang masuk, auto-snapshot pagi, opname)
5. stocks/raw-materials (BARU, dengan audit log raw_material_movements)
6. vendors (BARU)
7. purchases + purchase_items (BARU, normalized + auto-insert raw_material_movements)
8. bills (BARU, owner only)
9. settlements (simplify rekap 6 totals + breakdown bank di runtime)
10. dashboard (reminder per role)
11. Hapus expenses/

Cek typecheck per module via `npx tsc --noEmit`. Selesai 1 module, run typecheck
+ tunjukkan diff ke saya, baru lanjut module berikutnya.
```

### Untuk lanjut **refactor frontend code ke REV 2.3** (3 dashboard per role):

```
Lanjutan sesi skripsi POS resto. Baca file handoff dulu.

Setelah baca, fokus task: **refactor frontend code ke REV 2.3**.

**REV 2.3 utama yang berubah di frontend**:
- LoginPage: form 2 field input nama + PIN murni (drop 2-step list picker, drop
  localStorage remember last user)
- 3 dashboard berbeda layout per role:
  - WaiterDashboard: primary CTA = stok porsi + raw materials reminder + opname
    + mark habis. "Input Order" jadi link sekunder kecil (bukan card primary)
    supaya tidak terbiasa pakai default
  - CashierDashboard: primary CTA = Buka Kasir (kalau shift belum buka) lalu
    Input Order Baru + Daftar Transaksi Open + Tutup Kasir
  - OwnerDashboard: primary = laporan hari ini + tagihan + belanja bulan +
    reminder semua role
- Tambah CashierRoute guard component (selain OwnerRoute existing)
- Hide tombol "Bayar / Selesaikan" untuk role waiter di order detail page
- Hide card "Catat Pembelian", "Buka Kasir", "Tutup Kasir" untuk waiter

File yang perlu diubah:
- LoginPage.tsx — form input nama+PIN murni
- App.tsx — tambah CashierRoute + 3 dashboard routing
- OwnerDashboard.tsx + CashierDashboard.tsx + WaiterDashboard.tsx (BARU)
- POSPage.tsx — 2 tab tipe order (dineIn/takeaway), bukan 5
- PaymentModal.tsx — bank picker untuk EDC/transfer (no fallback waiter, kasir only)
- StockPage.tsx — porsi only (split dengan RawMaterialsPage)
- RawMaterialsPage.tsx (BARU)
- PurchasesPage.tsx (BARU, vendor opsional + add raw material inline)
- BillsPage.tsx (BARU, owner-only route)
- MergeBillModal.tsx (BARU)
- SubOptionsModal.tsx (BARU)
- ReceiptPDF.tsx (BARU pakai pdfmake)
- Hapus ForceOrderModal.tsx
- Tipe Indonesian: useAuth hook untuk role-based conditional render

Kerjakan satu file dulu, tunjukkan ke saya, baru lanjut file berikutnya.
```

### Untuk lanjut **rebuild StarUML Use Case Diagram REV 2.3**:

```
Lanjutan sesi skripsi POS resto. Baca file handoff dulu.

Setelah baca, fokus task: **rebuild Use Case Diagram di Skripsi.mdj ke REV 2.3**.

ERD + 11 Activity Diagram sudah valid REV 2.2/2.3 (no visual change di REV 2.3).
Yang perlu rebuild: Use Case Diagram untuk update annotation aktor sesuai
permission matrix REV 2.3.

Perubahan annotation yang perlu di-reflect di diagram:
- UC "Mengelola Pesanan Meja": dari (kasir+waiter) jadi (kasir primary,
  waiter fallback only)
- UC "Memilih Sub-Pilihan Paket": sama
- Aktor Waiter: tambah note "primary di kertas, fallback POS"
- Aktor Kasir: tambah note "primary input order ke POS"

Build via staruml-mcp (HTTP transport di port 58321). Pastikan StarUML running
dengan apiServer=true. Lihat skill .claude/skills/use-case-diagram/SKILL.md
untuk pattern proven.

Selesai → save Skripsi.mdj + export PNG ke docs/diagrams/use-case-diagram-
sistem-pos-restoran.png (untuk Bab 3 skripsi).
```

---

## 📌 Catatan Penting

### Lokasi file kunci (REV 2.3)

| File | Lokasi |
|---|---|
| Ground truth bisnis (REV 2.3) | `docs/operasional-resto.md` |
| Design spec permission matrix | `docs/superpowers/specs/2026-05-24-permission-matrix-design.md` |
| Handoff memory | `~/.claude/projects/c--Users-ezrak-Documents-Skripsi-Skripsi-POS-Restaurant/memory/project_session_handoff.md` |
| Ringkasan ground truth | `~/.claude/projects/.../memory/project_resto_operational_truths.md` |
| Index memory | `~/.claude/projects/.../memory/MEMORY.md` |
| Plan refactor REV 2.3 | `~/.claude/plans/ubah-backend-dari-laravel-crystalline-wilkes.md` |
| Onboarding repo (REV 2.3) | `CLAUDE.md` |
| Naskah skripsi Bab 3 (REV 2.3) | `docs/knowledge/BAB-3-DRAFT.md` |
| Diagrams knowledge (REV 2.3) | `docs/knowledge/{ERD,USE-CASE,ACTIVITY,FULL}.md` |
| Data dictionary (REV 2.3, 14 entitas) | `docs/DATA-DICTIONARY.md` |
| Proposal awal (referensi) | `docs/Proposal Skripsi.md` |
| Menu lengkap | `docs/menu-ayam-bakar-banjar-monosuko.md` |

### Tips kalau context Claude habis di tengah sesi

Sebelum context habis, minta Claude:
> "Context kamu mau habis. Update memory `project_session_handoff.md` dengan
> apa yang sudah dikerjakan + apa yang belum, supaya sesi baru bisa lanjut.
> Plus catat keputusan baru ke `project_resto_operational_truths.md` kalau ada."

### Kalau Claude mulai asumsi lagi

Tegur dengan referensi ke memory rule:
> "Kamu lagi asumsi. Baca memory `feedback_ask_resto_specifics.md` lagi.
> Tanya saya dulu via AskUserQuestion sebelum lanjut."

### Kalau Claude lupa state REV 2.3

Tegur dengan:
> "REV 2.3 update: waiter input order = FALLBACK ONLY (bukan co-equal kasir).
> Login = form input nama + PIN MURNI (no list picker, no localStorage).
> Permission matrix lengkap di docs/operasional-resto.md seksi Permission Matrix."

---

## Cara pakai paling simpel

Sesi baru → buka Claude Code di project ini → paste prompt 🟡 LENGKAP → Claude bakal baca semua handoff file dulu sebelum apa-apa, lalu summarize state ke Anda, lalu tanya mau lanjut dari mana.

Kalau di tengah sesi context Claude mau habis lagi, kasih instruksi:

> "Context kamu mau habis. Update memory project_session_handoff.md dengan apa yang sudah dikerjakan + apa yang belum, supaya sesi baru bisa lanjut. Plus catat keputusan baru ke project_resto_operational_truths.md kalau ada."
