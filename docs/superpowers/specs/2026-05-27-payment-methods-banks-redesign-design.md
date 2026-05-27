# Payment Methods + Banks Owner-Configurable Redesign (REV 2.6)

**Tanggal**: 2026-05-27
**Status**: Approved by user, ready for writing-plans
**Plan file**: (akan diisi setelah `superpowers:writing-plans` jalan)
**Brainstorming session**: 12 decisions captured via `superpowers:brainstorming` skill

---

## Context

Sistem REV 2.5 punya 6 payment method hardcoded di Prisma enum (`cash`, `edc`, `qris`, `gojek`, `grab`, `transfer`) + flag `needsBank` hardcoded di frontend (EDC + transfer wajib bank, lainnya no bank) + bank list `['BCA', 'Mandiri', 'BNI', 'BRI']` hardcoded di [PaymentModal.tsx:254](../../../frontend/src/components/PaymentModal.tsx#L254). Bank disimpan sebagai free-form string di `TransactionPayment.bank` VARCHAR(50).

**Masalah:**
- Owner tidak bisa enable/disable payment method (mis. matiin GoFood saat tidak pakai)
- Bank list tidak bisa diubah owner (terpaku 4 default)
- Tidak ada konsep "bank per method" — kasir bisa input "BCA" untuk EDC padahal owner mau "BCA hanya untuk Transfer + QRIS"
- Method baru (mis. ShopeePay) tidak bisa di-add tanpa migrasi schema enum
- Free-form bank string → risiko typo `BCA` vs `Bca` → aggregate bank breakdown salah

**Goal REV 2.6:**
- Owner punya page `/payment-methods` untuk full config (CRUD method + bank + assignment)
- Drop enum `PaymentMethod` jadi master table extensible
- Bank jadi master table reusable lintas method
- Settlement schema full dynamic (drop 12 kolom fixed) — method custom muncul konsisten di form Tutup Kasir
- Backward compat: data prod monosuko.my.id zero loss via migration script

---

## Scope Decisions (12 keputusan)

| # | Topik | Keputusan |
|---|---|---|
| 1 | Toggle off method | `is_active=false` cuma hide dari PaymentModal. Historical + settlement tetap utuh. |
| 2 | Data model bank | Master `banks` table + junction `payment_method_banks` (many-to-many). |
| 3 | `requires_bank` per method | Owner-toggleable per method. Validasi: kalau true tapi 0 bank → block save. |
| 4 | Custom bank input saat checkout | TOLAK — kasir wajib pilih dari list owner. PaymentModal pakai `<Combobox>` (bukan `ComboboxFree`). |
| 5 | Method extensibility | YA — owner bisa add method baru (mis. "ShopeePay"). Drop enum, jadi VARCHAR. |
| 6 | Filter per orderType | 2 toggle per method: `allow_dine_in` + `allow_takeaway`. Owner-configurable. |
| 7 | Lokasi UI Settings | Page top-level `/payment-methods` (konsisten dengan BillsPage/MenuPage). |
| 8 | Color + icon picker | Owner pilih saat create/edit. Preset 8 warna + 6 icon lucide. DB simpan `color_hex` + `icon_name`. |
| 9 | Delete behavior | Soft delete only (toggle `is_active`). Tidak ada hard delete. |
| 10 | Migrasi data prod | Proper migrate — extract distinct (method, bank) dari TransactionPayment lama → seed banks + junction. No data loss. |
| 11 | Toggle off saat shift jalan | Permissive — hilang dari PaymentModal next refresh. In-progress submit tetap allowed (server tidak strict). |
| 12 | Settlement schema | FULL DYNAMIC — drop 12 kolom fixed, add child table `settlement_method_counts`. Form Tutup Kasir dinamis sesuai active method. |

---

## Data Model (Prisma)

### 3 tabel baru

```prisma
model PaymentMethod {
  id             Int      @id @default(autoincrement())
  code           String   @unique @db.VarChar(20)
  label          String   @db.VarChar(50)
  colorHex       String   @db.VarChar(7)
  iconName       String   @db.VarChar(30)
  requiresBank   Boolean  @default(false)
  allowDineIn    Boolean  @default(true)
  allowTakeaway  Boolean  @default(true)
  isActive       Boolean  @default(true)
  displayOrder   Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  banks          PaymentMethodBank[]
  settlementCounts SettlementMethodCount[]

  @@map("payment_methods")
}

model Bank {
  id        Int      @id @default(autoincrement())
  name      String   @unique @db.VarChar(50)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  methods   PaymentMethodBank[]

  @@map("banks")
}

model PaymentMethodBank {
  paymentMethodId Int
  bankId          Int
  createdAt       DateTime      @default(now())
  paymentMethod   PaymentMethod @relation(fields: [paymentMethodId], references: [id], onDelete: Cascade)
  bank            Bank          @relation(fields: [bankId], references: [id], onDelete: Cascade)

  @@id([paymentMethodId, bankId])
  @@map("payment_method_banks")
}

model SettlementMethodCount {
  settlementId      Int
  paymentMethodCode String        @db.VarChar(20)
  counted           Int           @default(0)
  system            Int           @default(0)
  settlement        Settlement    @relation(fields: [settlementId], references: [id], onDelete: Cascade)

  @@id([settlementId, paymentMethodCode])
  @@map("settlement_method_counts")
}
```

### Perubahan ke model existing

**TransactionPayment**:
```prisma
model TransactionPayment {
  // ...
  method  String  @db.VarChar(20)   // BERUBAH: enum PaymentMethod → VARCHAR (denormalize code)
  bank    String? @db.VarChar(50)   // TETAP: denormalize bank name
  // ...
}
```

**Settlement** — drop 12 kolom `countedXxx` + `systemXxx` (cash, edc, qris, gojek, grab, transfer). Pakai child table `settlement_method_counts` semua.

**Drop enum `PaymentMethod`** dari Prisma. Enum lain (`PaymentTender`, `OrderType`, `BillCategory`, `ShiftType`, dll) TETAP.

### Kenapa denormalize string method/bank di TransactionPayment + SettlementMethodCount (bukan FK)

- Audit-safe: rename label PaymentMethod tidak break query historis
- Soft delete method/bank tidak cascade ke history
- groupBy(method, bank) tetap jalan tanpa join
- Display label fetch live dari `payment_methods` table → kalau rename, history label otomatis ikut update (accepted consequence)

---

## Backend API surface

### Module baru: `backend/src/modules/payment-methods/`

4 file standar (schema/service/controller/routes) per pattern existing.

| Method | Path | Role | Tujuan |
|---|---|---|---|
| `GET` | `/api/payment-methods` | semua role | List active methods + banks per method. Query `?includeInactive=true` owner-only. |
| `POST` | `/api/payment-methods` | owner | Create method baru. Validate code unique + lowercase + alphanum_underscore, color hex regex, icon ∈ preset. |
| `PATCH` | `/api/payment-methods/:id` | owner | Update label/color/icon/requiresBank/allowDineIn/allowTakeaway/displayOrder. Code immutable. |
| `PATCH` | `/api/payment-methods/:id/toggle-active` | owner | Toggle `is_active`. Permissive (no validation open transactions). |
| `POST` | `/api/payment-methods/:id/banks/:bankId` | owner | Assign bank ke method (junction insert, idempotent). |
| `DELETE` | `/api/payment-methods/:id/banks/:bankId` | owner | Unassign bank. Block 400 kalau `requiresBank=true` + bank terakhir. |
| `POST` | `/api/payment-methods/reorder` | owner | Bulk reorder display_order (swap pair atau full array). |

### Module baru: `backend/src/modules/banks/`

| Method | Path | Role | Tujuan |
|---|---|---|---|
| `GET` | `/api/banks` | owner | List banks. Query `?includeInactive=true`. |
| `POST` | `/api/banks` | owner | Create bank baru. Dedup case-insensitive (utf8mb4_unicode_ci) → 409. |
| `PATCH` | `/api/banks/:id` | owner | Update name (re-dedup) + toggle isActive. |

### Perubahan ke modul existing

**`transactions/transactions.schema.ts`** ([addPaymentSchema:51-77](../../../backend/src/modules/transactions/transactions.schema.ts#L51-L77)):
- Drop hardcoded `needsBank = method === edc || transfer`
- Validasi pindah ke runtime di service: lookup PaymentMethod by code → cek `requiresBank` flag + verify bank ∈ assigned banks

**`transactions/transactions.service.ts`** (`addPayment`):
- Pre-fetch payment_methods + banks junction (cache per request)
- If `requiresBank=true` + bank tidak ada di assigned junction → 400 "Bank X tidak tersedia untuk method Y"
- If `requiresBank=false` + bank provided → 400 "Method ini tidak butuh bank"

**`settlements/settlements.service.ts`**:
- `preview`: groupBy(method) dari TransactionPayment shift terkait → return `SettlementSystemEntry[]` dengan join ke `payment_methods` untuk metadata (label, colorHex)
- `create`: terima `counts: { [methodCode]: number }` → bulk insert `settlement_method_counts`
- `getById`: include child rows + variance per row (counted - system)
- `computeBankBreakdown`: tidak berubah signifikan

**`dashboard/dashboard.service.ts`**:
- `byMethod` shape berubah dari `MethodTotals` (fixed 6 key) → `MethodTotalEntry[]` (array dinamis dengan colorHex + label)
- `bankBreakdown` tidak berubah

---

## Frontend

### ⚠️ Konvensi konsistensi (MANDATE)

Sebelum tulis komponen baru, **WAJIB** audit 3 referensi:
- [MenuPage.tsx](../../../frontend/src/pages/MenuPage.tsx) — CRUD owner-only dengan modal create/edit + tab
- [BillsPage.tsx](../../../frontend/src/pages/BillsPage.tsx) — list+filter+create owner
- [RawMaterialsTab](../../../frontend/src/pages/StockPage.tsx) — CRUD master dengan dialog primitive

Match:
- Dialog primitive: pakai `<Dialog>` existing dari `frontend/src/components/ui/dialog.tsx`
- Combobox/Select: pakai existing dari `frontend/src/components/ui/combobox.tsx`
- Tone+typography: `text-body-sm text-neutral-700`, Badge variant, Button primary/secondary
- Mobile-first: 1-column HP, 2-column desktop
- Padding card konsisten dengan halaman existing

### Page baru: `/payment-methods` (owner-only)

**Layout 2 tab di 1 page:**

```
[Metode Pembayaran] [Bank]   ← tab top

TAB 1: Metode Pembayaran
  [+ Tambah Metode]
  Card list per method:
    [icon color] Label · code              [▲][▼] [toggle active]
    Dine-in ✓  Takeaway ✓  Wajib bank ✓
    Bank: BCA, Mandiri, BRI                [Edit]

TAB 2: Bank
  [+ Tambah Bank]
  Row list:
    BCA          · 3 method · [toggle aktif]   [Edit]
    Mandiri      · 1 method · [toggle aktif]   [Edit]
```

**Modal Edit Method (Dialog primitive):**
- Field: `label` (text), `colorHex` (8-swatch picker), `iconName` (6-chip picker), `requiresBank` (toggle), `allowDineIn` (toggle), `allowTakeaway` (toggle)
- Section "Bank yang tersedia": multi-select checkbox dari banks aktif. Required jika `requiresBank=true`.
- `code` field: read-only kalau edit, editable kalau create
- Submit: PATCH method + sync junction (compute diff)

**Modal Edit Bank (Dialog primitive):**
- Field: `name` (text, validate dedup), `isActive` (toggle)
- Section info read-only: "Dipakai di N method: EDC, Transfer" (count + label dari `_count`)

### Nav owner

Tambah link "Pembayaran" di [Layout.tsx](../../../frontend/src/components/Layout.tsx) nav owner:
```
Beranda · Pesanan · Menu · Pembayaran · Stok · Belanja · Tagihan · Setelan · Histori
```

### Services baru

- `frontend/src/services/paymentMethodService.ts`
- `frontend/src/services/bankService.ts`

React Query keys: `['paymentMethods']`, `['banks']`. Invalidate on mutation.

### Perubahan ke komponen existing

**PaymentModal.tsx**:
- Drop const `PAYMENT_METHODS` di [types/index.ts:100-109](../../../frontend/src/types/index.ts#L100-L109) — sumber data dari `usePaymentMethodsQuery()` (active only)
- MethodGrid filter: `m.isActive && (orderType === 'dineIn' ? m.allowDineIn : m.allowTakeaway)`, sort by `displayOrder`
- Icon resolve dinamis: `LucideIcons[m.iconName] ?? CreditCard`
- Color: pakai `m.colorHex` untuk selected state
- **Bank picker: replace `<ComboboxFree>` jadi `<Combobox>`** — options dari `selectedMethod.banks.filter(b => b.isActive)`
- Drop `loadRecentBanks` + localStorage `pos.recent-banks` (tidak relevan)
- Show bank picker hanya kalau `selectedMethod.requiresBank === true`

**SettlementPage.tsx**:
- System totals row: dinamis sesuai response `SettlementSystemEntry[]`
- Form blind count: dinamis input per active method (terima `counts: { [code]: number }` ke backend)

**OwnerDashboard.tsx**:
- Drop hardcoded `METHOD_COLOR` + `METHOD_LABEL` ([line 42-58](../../../frontend/src/pages/OwnerDashboard.tsx#L42-L58))
- Revenue chart bar count dinamis (bisa 6, 7, 8 method)
- Data dari API langsung punya `colorHex` + `label`

---

## Migration Script (urutan eksekusi prod)

### Step 1 — Schema baru (Prisma migrate pertama)
```
1. CREATE TABLE banks
2. CREATE TABLE payment_methods
3. CREATE TABLE payment_method_banks (composite PK)
4. CREATE TABLE settlement_method_counts (composite PK)
5. ALTER TABLE transaction_payments MODIFY method VARCHAR(20)  -- drop enum
6. (TIDAK DROP 12 kolom Settlement dulu — drop di Step 5 setelah data migrate aman)
```

### Step 2 — Seed master data
```typescript
// scripts/seed-payment-methods.ts
const methods = [
  { code: 'cash',     label: 'Tunai',         color: '#1f7a4d', icon: 'Banknote',       requiresBank: false, allowDineIn: true,  allowTakeaway: true,  order: 1 },
  { code: 'edc',      label: 'EDC',           color: '#2563eb', icon: 'CreditCard',     requiresBank: true,  allowDineIn: true,  allowTakeaway: true,  order: 2 },
  { code: 'qris',     label: 'QRIS',          color: '#9333ea', icon: 'QrCode',         requiresBank: false, allowDineIn: true,  allowTakeaway: true,  order: 3 },
  { code: 'gojek',    label: 'GoFood',        color: '#16a34a', icon: 'Bike',           requiresBank: false, allowDineIn: false, allowTakeaway: true,  order: 4 },
  { code: 'grab',     label: 'GrabFood',      color: '#dc2626', icon: 'Truck',          requiresBank: false, allowDineIn: false, allowTakeaway: true,  order: 5 },
  { code: 'transfer', label: 'Transfer Bank', color: '#d97706', icon: 'ArrowLeftRight', requiresBank: true,  allowDineIn: true,  allowTakeaway: true,  order: 6 },
];
const banks = ['BCA', 'Mandiri', 'BNI', 'BRI'];
// Junction: EDC + Transfer → semua 4 bank
```

### Step 3 — Backfill bank dari TransactionPayment lama
```typescript
// scripts/migrate-banks-from-history.ts
// 1. SELECT DISTINCT method, bank FROM transaction_payments WHERE bank IS NOT NULL
// 2. Upsert bank by name (case-insensitive via collation)
// 3. Upsert junction (method, bank) — idempotent
```

### Step 4 — Backfill `settlement_method_counts` dari Settlement lama
```typescript
// scripts/migrate-settlement-counts.ts
// Untuk setiap Settlement existing, INSERT 6 child rows (cash/edc/qris/gojek/grab/transfer)
// dengan counted = settlement.countedXxx, system = settlement.systemXxx
// Pakai createMany skipDuplicates untuk idempotent
```

### Step 5 — Verify + drop kolom lama (Prisma migrate kedua)
```
1. Sanity check: COUNT(settlement_method_counts) === COUNT(settlements) * 6
2. Sanity check: distinct (method, bank) di TransactionPayment ⊆ payment_method_banks
3. ALTER TABLE settlements DROP COLUMN counted_cash, system_cash, ... (12 kolom)
4. DROP TYPE PaymentMethod (Prisma schema cleanup)
```

### Rollback strategy

Backup dump SQL sebelum Step 1. Kalau ada masalah → restore + investigate. Tiap step idempotent (upsert / skipDuplicates), aman re-run.

---

## Validation Rules

| Rule | Layer | Behavior |
|---|---|---|
| `code` unique + immutable | DB UNIQUE + service block PATCH | 409 "Code sudah dipakai" |
| `code` format | Zod: lowercase, alphanum_underscore, max 20 | 422 |
| `colorHex` format | Zod: regex `^#[0-9a-f]{6}$` | 422 |
| `iconName` allowed | Zod: enum dari 6 lucide preset | 422 |
| `requiresBank=true` + 0 bank di junction | Service block POST/PATCH | 400 "Aktifkan minimal 1 bank dulu" |
| Bank name unique case-insensitive | DB collation + Zod | 409 "Bank sudah ada" |
| Unassign bank terakhir saat `requiresBank=true` | Service block DELETE junction | 400 "Method ini wajib punya minimal 1 bank" |
| Submit payment dengan bank tidak di junction | Service block | 400 "Bank X tidak tersedia untuk method Y" |
| Submit payment `requiresBank=true` tanpa bank | Service block | 400 "Bank wajib diisi" |
| Submit payment `requiresBank=false` dengan bank | Service block | 400 "Method ini tidak butuh bank" |
| Toggle off method saat ada open transaction | TIDAK BLOCK | Permissive per Decision #11 |

---

## Edge Cases

1. **Display order swap**: tombol [▲][▼] per row → PATCH 2 row sekaligus (swap displayOrder) atomic via Prisma `$transaction`.
2. **Empty state**: kalau semua method off → PaymentModal show "Belum ada metode pembayaran aktif. Hubungi owner." (kasir tidak bisa checkout — by design).
3. **Method label diubah**: SettlementPage + dashboard fetch label live dari `payment_methods`. History label = label terbaru (accepted consequence, tidak freeze).
4. **Color contrast**: kalau owner pilih warna gelap, frontend auto-handle text contrast (`text-white` vs `text-black` based on hex brightness via helper util).
5. **Migrasi gagal di tengah**: tiap step idempotent. Re-run aman.
6. **Method built-in (cash) tidak boleh dihapus?**: Soft delete only (Decision #9), jadi cash boleh di-toggle off. Owner aware konsekuensi.

---

## Testing (Verification)

### Backend smoke test (manual + Vitest)
- POST payment_methods + banks happy path
- Validate code unique + lowercase + format
- Toggle requires_bank ↔ bank assignment validation
- Soft delete (toggle is_active) tidak break history queries
- Migration script di-run vs DB snapshot prod copy → diff 0 row data loss

### Frontend manual e2e (browser)
- Owner login → buka `/payment-methods` → tambah method "ShopeePay" + assign bank "OVO" → toggle active
- Kasir login → POSPage → checkout → PaymentModal: ShopeePay muncul, pick bank OVO, submit
- Kasir tutup shift → SettlementPage: ShopeePay muncul di form blind count
- Owner dashboard: ShopeePay muncul di chart dengan color pilihan owner

### Compile-time + lint
- `cd backend && tsc --noEmit` → 0 errors
- `cd frontend && tsc -b && vite build` → success
- `cd frontend && npm run lint` → clean

---

## Out of Scope (untuk skripsi REV 2.6)

- Hard delete method/bank dengan FK cleanup (soft delete only sudah cukup)
- Order method via drag-and-drop (cukup tombol [▲][▼])
- Per-method PB1 tax rate (PB1 tetap global 10%)
- Bank logo/image (cuma name)
- Multi-currency support
- Audit log perubahan config payment_methods (untuk skripsi, accept tidak ada audit)

---

## File yang akan dibuat/diubah (preview, detail di plan)

### Backend
- ✏️ `backend/prisma/schema.prisma` — drop enum PaymentMethod, add 4 model baru, ubah TransactionPayment.method + Settlement
- ➕ `backend/src/modules/payment-methods/{schema,service,controller,routes}.ts`
- ➕ `backend/src/modules/banks/{schema,service,controller,routes}.ts`
- ✏️ `backend/src/modules/transactions/transactions.{schema,service}.ts`
- ✏️ `backend/src/modules/settlements/settlements.{schema,service}.ts`
- ✏️ `backend/src/modules/dashboard/dashboard.service.ts`
- ✏️ `backend/src/app.ts` — register routes baru
- ➕ `backend/scripts/seed-payment-methods.ts`
- ➕ `backend/scripts/migrate-banks-from-history.ts`
- ➕ `backend/scripts/migrate-settlement-counts.ts`
- ✏️ `backend/prisma/seed.ts` — call seed-payment-methods

### Frontend
- ➕ `frontend/src/pages/PaymentMethodsPage.tsx`
- ➕ `frontend/src/components/PaymentMethodFormModal.tsx`
- ➕ `frontend/src/components/BankFormModal.tsx`
- ➕ `frontend/src/services/paymentMethodService.ts`
- ➕ `frontend/src/services/bankService.ts`
- ✏️ `frontend/src/types/index.ts` — drop `PAYMENT_METHODS` const, add types `PaymentMethodView`, `BankView`, `SettlementSystemEntry`, `MethodTotalEntry`
- ✏️ `frontend/src/components/PaymentModal.tsx`
- ✏️ `frontend/src/pages/SettlementPage.tsx`
- ✏️ `frontend/src/pages/OwnerDashboard.tsx`
- ✏️ `frontend/src/App.tsx` — route `/payment-methods` owner-only
- ✏️ `frontend/src/components/Layout.tsx` — nav owner tambah link "Pembayaran"
- ✏️ `frontend/src/services/settlementService.ts` — adapt response shape
- ✏️ `frontend/src/services/dashboardService.ts` — adapt response shape

---

## Acceptance Criteria

- [ ] Owner bisa buka `/payment-methods`, lihat 6 method seeded
- [ ] Owner bisa add method "ShopeePay" + assign bank OVO → muncul di PaymentModal kasir
- [ ] Owner bisa toggle off "GoFood" → hilang dari PaymentModal next refresh
- [ ] Owner bisa add bank baru "Permata" → bisa di-assign ke EDC
- [ ] Kasir submit EDC tanpa bank → ditolak 400 "Bank wajib diisi"
- [ ] Kasir submit EDC dengan bank "OVO" (tidak di-assign ke EDC) → ditolak 400
- [ ] Settlement Tutup Kasir form input dinamis ikut active method (ShopeePay muncul)
- [ ] Owner dashboard revenue chart pakai warna pilihan owner per method
- [ ] Migration script di-run vs prod DB copy → 0 data loss, settlement existing tetap valid
- [ ] `tsc --noEmit` 0 errors backend + frontend
- [ ] `vite build` success
- [ ] CLAUDE.md updated dengan convention superpowers full pipeline + frontend consistency mandate

---

## References

- Decision context: this brainstorming session (2026-05-27)
- Related ground truth: [docs/operasional-resto.md](../../operasional-resto.md) REV 2.3
- Permission matrix: [docs/superpowers/specs/2026-05-24-permission-matrix-design.md](2026-05-24-permission-matrix-design.md)
- Pattern reference (frontend consistency):
  - [frontend/src/pages/MenuPage.tsx](../../../frontend/src/pages/MenuPage.tsx)
  - [frontend/src/pages/BillsPage.tsx](../../../frontend/src/pages/BillsPage.tsx)
  - [frontend/src/pages/StockPage.tsx](../../../frontend/src/pages/StockPage.tsx)
