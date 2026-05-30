# Payment Methods + Banks Owner-Configurable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor payment system jadi owner-configurable - drop `PaymentMethod` enum, jadi master table `payment_methods` extensible. Tambah master `banks` reusable + junction `payment_method_banks`. Settlement schema full dynamic via child table `settlement_method_counts`. Owner punya page `/payment-methods` untuk full CRUD. Spec: [`docs/superpowers/specs/2026-05-27-payment-methods-banks-redesign-design.md`](../specs/2026-05-27-payment-methods-banks-redesign-design.md).

**Architecture:** 4 model Prisma baru (`Bank`, `PaymentMethod`, `PaymentMethodBank`, `SettlementMethodCount`). `TransactionPayment.method` jadi VARCHAR (denormalize code, audit-safe). Settlement 12 kolom fixed dihapus, diganti child table dinamis. Backend 2 module baru (`payment-methods`, `banks`) + 3 module di-adapt (`transactions`, `settlements`, `dashboard`). Frontend 1 page baru + 2 modal + 2 service baru + 4 file existing di-adapt. Migration 3-step script: seed → backfill banks dari history → backfill settlement_method_counts dari Settlement existing.

**Tech Stack:** Backend Express 4 + TypeScript + Prisma 5 + MySQL 8 + Zod. Frontend React 18 + Vite 5 + Tailwind 3 + Zustand + React Query. Smoke test via bash shell script + curl + custom `jq_field` helper (node inline).

**Established conventions to follow:**
- Service pattern: `*.schema.ts` (Zod) + `*.service.ts` + `*.controller.ts` + `*.routes.ts` (4 file per module)
- View shape mappers (`toXView` functions) untuk response transformation
- `Prisma.Decimal` untuk uang/qty arithmetic
- `prisma.$transaction` untuk atomic ops
- Error: `throw new AppError(message, statusCode)` + `notFound('Resource')`
- Snake_case di DB via `@map`, camelCase di TS
- Permission: middleware `requireRole(UserRole.owner)` di route layer
- Frontend service: axios instance via `services/api.ts`, return `data` (unwrap envelope `{success, message, data}`)
- Design primitives di `frontend/src/components/ui/` - wajib pakai existing Dialog, Combobox, Button, Badge, Card
- Smoke test: file `backend/scripts/smoke-phase-XX.sh` pattern dengan `jq_field` helper
- Frontend consistency mandate (CLAUDE.md): audit 2-3 referensi sebelum tulis komponen baru

**Migration strategy:** Dev pakai `prisma db push --accept-data-loss` lalu re-seed. Tidak pakai folder migrations (per CLAUDE.md baseline). Prod (monosuko.my.id) deploy via SQL backup → migrate proper → run 3 script urutan → verify count.

---

## File Structure

### Backend (18 files)

**Create:**
- `backend/src/modules/banks/banks.schema.ts` - Zod validators
- `backend/src/modules/banks/banks.service.ts` - CRUD + dedup case-insensitive
- `backend/src/modules/banks/banks.controller.ts` - Express handlers
- `backend/src/modules/banks/banks.routes.ts` - Router + owner-only guard
- `backend/src/modules/payment-methods/payment-methods.schema.ts` - Zod validators
- `backend/src/modules/payment-methods/payment-methods.service.ts` - CRUD + toggle + assign-bank + reorder
- `backend/src/modules/payment-methods/payment-methods.controller.ts` - Express handlers
- `backend/src/modules/payment-methods/payment-methods.routes.ts` - Router + permission mix
- `backend/scripts/seed-payment-methods.ts` - One-time seed master data (6 methods + 4 banks + junctions)
- `backend/scripts/migrate-banks-from-history.ts` - Backfill banks dari TransactionPayment lama
- `backend/scripts/migrate-settlement-counts.ts` - Backfill settlement_method_counts dari Settlement lama
- `backend/scripts/smoke-payment-methods-banks.sh` - Smoke test 30+ scenario

**Modify:**
- `backend/prisma/schema.prisma` - add 4 model + drop enum PaymentMethod (di Phase 9) + drop 12 kolom Settlement (di Phase 9)
- `backend/prisma/seed.ts` - call seed-payment-methods script
- `backend/src/app.ts` - register `banksRouter` + `paymentMethodsRouter`
- `backend/src/modules/transactions/transactions.schema.ts` - adapt addPaymentSchema (drop hardcoded needsBank)
- `backend/src/modules/transactions/transactions.service.ts` - adapt addPayment (runtime lookup)
- `backend/src/modules/settlements/settlements.schema.ts` - counts as Record<string, number>
- `backend/src/modules/settlements/settlements.service.ts` - preview/create/getById dinamis pakai child table
- `backend/src/modules/dashboard/dashboard.service.ts` - byMethod dinamis

### Frontend (12 files)

**Create:**
- `frontend/src/pages/PaymentMethodsPage.tsx` - Owner page 2 tab
- `frontend/src/components/PaymentMethodFormModal.tsx` - Create/Edit method modal
- `frontend/src/components/BankFormModal.tsx` - Create/Edit bank modal
- `frontend/src/services/paymentMethodService.ts` - API client
- `frontend/src/services/bankService.ts` - API client

**Modify:**
- `frontend/src/types/index.ts` - drop `PAYMENT_METHODS` const, add new types
- `frontend/src/components/PaymentModal.tsx` - dynamic method list, replace ComboboxFree → Combobox
- `frontend/src/pages/SettlementPage.tsx` - dynamic system totals + blind count form
- `frontend/src/pages/OwnerDashboard.tsx` - dynamic chart bars + colors
- `frontend/src/App.tsx` - route `/payment-methods` owner-only
- `frontend/src/components/Layout.tsx` - nav owner tambah "Pembayaran"
- `frontend/src/services/settlementService.ts` - adapt response shape
- `frontend/src/services/dashboardService.ts` - adapt response shape

---

## Phase 0: Setup worktree + branch

### Task 0.1: Create isolated worktree

**Files:** N/A (git operation)

- [ ] **Step 1: Verify clean working tree**

Run: `git status`
Expected: `nothing to commit, working tree clean` (atau cuma file plan/spec yang sudah committed)

- [ ] **Step 2: Create worktree pada branch baru**

Run from project root:
```bash
git worktree add ../Skripsi-POS-Restaurant-payment-redesign -b feat/payment-methods-redesign
```

Expected: `Preparing worktree (new branch 'feat/payment-methods-redesign')`

- [ ] **Step 3: Switch ke worktree baru**

Set working dir untuk semua step berikutnya ke `c:/Users/ezrak/Documents/Skripsi/Skripsi-POS-Restaurant-payment-redesign/`. **Semua path absolut di task berikutnya WAJIB pakai path worktree ini, bukan path aslinya.**

- [ ] **Step 4: Install dependencies (kalau perlu)**

Worktree share node_modules dengan main? Cek dengan:
```bash
ls backend/node_modules/@prisma 2>/dev/null
```

Kalau symlink atau ada, skip. Kalau kosong, run di worktree:
```bash
cd backend && npm install
cd ../frontend && npm install
```

- [ ] **Step 5: Verify backend dev server bisa jalan dari worktree**

Run from worktree root:
```bash
cd backend && npm run dev
```

Expected: `Server berjalan di port 8000`. Kill dengan Ctrl+C, jangan biarkan jalan.

---

## Phase 1: Prisma schema iter 1 (add new models, keep old enum + columns)

**Strategi:** Tambah model baru DULU, jangan drop enum/kolom lama. Drop nanti di Phase 9 setelah semua data ter-migrate dan kode sudah di-adapt. Ini supaya backend tetap compile + jalan di setiap step.

### Task 1.1: Add new Prisma models

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Tambah 4 model baru ke `schema.prisma`**

Buka `backend/prisma/schema.prisma`. Setelah model existing `Bill` (atau di urutan logical lainnya), tambahkan:

```prisma
/// REV 2.6: Master payment method. Drop enum PaymentMethod (Phase 9).
/// Owner-configurable: bisa add method baru (mis. ShopeePay).
model PaymentMethod {
  id             Int      @id @default(autoincrement())
  code           String   @unique @db.VarChar(20)
  label          String   @db.VarChar(50)
  colorHex       String   @map("color_hex") @db.VarChar(7)
  iconName       String   @map("icon_name") @db.VarChar(30)
  requiresBank   Boolean  @default(false) @map("requires_bank")
  allowDineIn    Boolean  @default(true) @map("allow_dine_in")
  allowTakeaway  Boolean  @default(true) @map("allow_takeaway")
  isActive       Boolean  @default(true) @map("is_active")
  displayOrder   Int      @default(0) @map("display_order")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")
  banks          PaymentMethodBank[]
  settlementCounts SettlementMethodCount[]

  @@map("payment_methods")
}

/// REV 2.6: Master bank reusable lintas method.
model Bank {
  id        Int      @id @default(autoincrement())
  name      String   @unique @db.VarChar(50)
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  methods   PaymentMethodBank[]

  @@map("banks")
}

/// REV 2.6: Junction many-to-many method ↔ bank.
model PaymentMethodBank {
  paymentMethodId Int           @map("payment_method_id")
  bankId          Int           @map("bank_id")
  createdAt       DateTime      @default(now()) @map("created_at")
  paymentMethod   PaymentMethod @relation(fields: [paymentMethodId], references: [id], onDelete: Cascade)
  bank            Bank          @relation(fields: [bankId], references: [id], onDelete: Cascade)

  @@id([paymentMethodId, bankId])
  @@map("payment_method_banks")
}

/// REV 2.6: Settlement child table - dinamis per method, ganti 12 kolom fixed di Settlement.
/// paymentMethodCode denormalize dari payment_methods.code (audit-safe kalau method dihapus/rename).
model SettlementMethodCount {
  settlementId      Int        @map("settlement_id")
  paymentMethodCode String     @map("payment_method_code") @db.VarChar(20)
  counted           Int        @default(0)
  system            Int        @default(0)
  settlement        Settlement @relation(fields: [settlementId], references: [id], onDelete: Cascade)
  paymentMethod     PaymentMethod? @relation(fields: [paymentMethodCode], references: [code], onDelete: SetNull)

  @@id([settlementId, paymentMethodCode])
  @@index([paymentMethodCode])
  @@map("settlement_method_counts")
}
```

**Catatan**: `PaymentMethod` ↔ `SettlementMethodCount` pakai relasi via `code` (bukan `id`) supaya audit-safe - settlement_method_counts.payment_method_code adalah denormalize string, tidak hilang kalau method dihapus.

- [ ] **Step 2: Tambah back-relation `methodCounts` ke model `Settlement` existing**

Cari model `Settlement` di schema.prisma. Tambah field di akhir model (sebelum `@@map`):

```prisma
  methodCounts SettlementMethodCount[]
```

Jangan drop kolom `countedXxx`/`systemXxx` dulu - itu Phase 9.

- [ ] **Step 3: Run `prisma format` untuk auto-format**

Run dari `backend/`:
```bash
npx prisma format
```

Expected: no error, file ter-format.

- [ ] **Step 4: Apply schema ke DB lokal**

Run dari `backend/`:
```bash
npx prisma db push --accept-data-loss
```

Expected: tabel baru `banks`, `payment_methods`, `payment_method_banks`, `settlement_method_counts` ter-create. Data existing di table lain tidak hilang (kecuali kalau ada conflict).

- [ ] **Step 5: Verify di Prisma Studio atau MySQL CLI**

Run dari `backend/`:
```bash
npx prisma studio
```

Verify 4 tabel baru muncul di kiri. Close studio.

- [ ] **Step 6: `tsc --noEmit` masih lulus**

Run dari `backend/`:
```bash
npx tsc --noEmit
```

Expected: 0 errors. Kalau ada error, periksa apakah ada code yang refer ke model baru tapi belum impl (harusnya tidak ada di phase ini).

- [ ] **Step 7: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(payment): add Prisma models for payment_methods + banks + settlement_method_counts

Add 4 new models: PaymentMethod, Bank, PaymentMethodBank junction,
SettlementMethodCount child. Existing enum PaymentMethod + Settlement 12
columns kept until Phase 9 cleanup. Spec: docs/superpowers/specs/2026-05-27-payment-methods-banks-redesign-design.md"
```

### Task 1.2: Change TransactionPayment.method dari enum ke VARCHAR

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Find model `TransactionPayment` di `schema.prisma`**

Cari `model TransactionPayment {`. Lihat field `method`. Saat ini bertipe `PaymentMethod` (enum).

- [ ] **Step 2: Ubah jadi VARCHAR**

Ganti baris:
```prisma
  method PaymentMethod
```

Menjadi:
```prisma
  /// REV 2.6: denormalize dari payment_methods.code (audit-safe).
  /// Validasi runtime di service: harus exist di payment_methods table.
  method String @db.VarChar(20)
```

- [ ] **Step 3: Apply via db push**

Run dari `backend/`:
```bash
npx prisma db push --accept-data-loss
```

**Expected warning**: kolom `method` di-modify, data existing (yang enum value) akan dipertahankan sebagai string. MySQL conversion otomatis enum value → string lowercase (`'cash'`, `'edc'`, dll).

- [ ] **Step 4: Verify data existing tidak korup**

Pakai Prisma Studio atau:
```bash
node -e "import('./src/config/prisma.js').then(({prisma}) => prisma.transactionPayment.findMany({take:5}).then(r => console.log(r.map(p => ({id:p.id, method:p.method, bank:p.bank})))))"
```

Atau lebih simpel pakai mysql CLI:
```bash
npx prisma db execute --schema prisma/schema.prisma --stdin <<< "SELECT id, method, bank FROM transaction_payments LIMIT 5"
```

Expected: method tetap string `'cash'`, `'edc'`, dll.

- [ ] **Step 5: `tsc --noEmit` - expect errors di transactions module**

Run dari `backend/`:
```bash
npx tsc --noEmit
```

Expected: error di `transactions.schema.ts` / `transactions.service.ts` karena kode masih refer ke enum `PaymentMethod`. **Jangan fix dulu** - itu Phase 5. Untuk sekarang, kita biarkan dengan workaround:

Buka `backend/src/modules/transactions/transactions.schema.ts`, find import:
```typescript
import { PaymentMethod } from '@prisma/client';
```

Biarkan import - enum masih ada di schema sebagai legacy. `PaymentMethod` enum tetap accessible dari `@prisma/client` sampai Phase 9.

`tsc --noEmit` harusnya tetap lulus karena enum belum di-drop, dan `TransactionPayment.method` field secara TypeScript adalah string (Prisma generate `string` untuk VARCHAR), tapi enum value masih valid sebagai string. Code lama `data.method === PaymentMethod.edc` jadi `data.method === 'edc'` comparison string - masih kompatibel.

Kalau ada error TS lain di transactions module, **stop dan investigate** sebelum lanjut.

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(payment): change TransactionPayment.method enum → VARCHAR(20)

Keep enum PaymentMethod di schema untuk legacy compat sampai Phase 9
cleanup. Data existing (enum values) preserved as lowercase strings
otomatis via MySQL conversion."
```

---

## Phase 2: Migration scripts (seed + backfill)

### Task 2.1: Create seed script untuk master data

**Files:**
- Create: `backend/scripts/seed-payment-methods.ts`

- [ ] **Step 1: Buat file `backend/scripts/seed-payment-methods.ts`**

Content lengkap:

```typescript
// REV 2.6: Seed master payment methods + banks + default junctions.
// Idempotent: re-run aman (upsert by code/name).

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface MethodSeed {
  code: string;
  label: string;
  colorHex: string;
  iconName: string;
  requiresBank: boolean;
  allowDineIn: boolean;
  allowTakeaway: boolean;
  displayOrder: number;
}

const METHODS: MethodSeed[] = [
  { code: 'cash',     label: 'Tunai',         colorHex: '#1f7a4d', iconName: 'Banknote',       requiresBank: false, allowDineIn: true,  allowTakeaway: true,  displayOrder: 1 },
  { code: 'edc',      label: 'EDC',           colorHex: '#2563eb', iconName: 'CreditCard',     requiresBank: true,  allowDineIn: true,  allowTakeaway: true,  displayOrder: 2 },
  { code: 'qris',     label: 'QRIS',          colorHex: '#9333ea', iconName: 'QrCode',         requiresBank: false, allowDineIn: true,  allowTakeaway: true,  displayOrder: 3 },
  { code: 'gojek',    label: 'GoFood',        colorHex: '#16a34a', iconName: 'Bike',           requiresBank: false, allowDineIn: false, allowTakeaway: true,  displayOrder: 4 },
  { code: 'grab',     label: 'GrabFood',      colorHex: '#dc2626', iconName: 'Truck',          requiresBank: false, allowDineIn: false, allowTakeaway: true,  displayOrder: 5 },
  { code: 'transfer', label: 'Transfer Bank', colorHex: '#d97706', iconName: 'ArrowLeftRight', requiresBank: true,  allowDineIn: true,  allowTakeaway: true,  displayOrder: 6 },
];

const BANKS = ['BCA', 'Mandiri', 'BNI', 'BRI'];

const DEFAULT_BANK_ASSIGNMENT: Record<string, string[]> = {
  edc:      ['BCA', 'Mandiri', 'BNI', 'BRI'],
  transfer: ['BCA', 'Mandiri', 'BNI', 'BRI'],
};

async function main() {
  console.log('=== Seeding payment_methods ===');
  for (const m of METHODS) {
    const created = await prisma.paymentMethod.upsert({
      where: { code: m.code },
      update: {
        label: m.label,
        colorHex: m.colorHex,
        iconName: m.iconName,
        requiresBank: m.requiresBank,
        allowDineIn: m.allowDineIn,
        allowTakeaway: m.allowTakeaway,
        displayOrder: m.displayOrder,
      },
      create: m,
    });
    console.log(`  ✓ ${created.code} (${created.label})`);
  }

  console.log('\n=== Seeding banks ===');
  for (const name of BANKS) {
    const created = await prisma.bank.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    console.log(`  ✓ ${created.name}`);
  }

  console.log('\n=== Seeding default bank assignments ===');
  for (const [methodCode, bankNames] of Object.entries(DEFAULT_BANK_ASSIGNMENT)) {
    const method = await prisma.paymentMethod.findUniqueOrThrow({ where: { code: methodCode } });
    for (const bankName of bankNames) {
      const bank = await prisma.bank.findUniqueOrThrow({ where: { name: bankName } });
      await prisma.paymentMethodBank.upsert({
        where: { paymentMethodId_bankId: { paymentMethodId: method.id, bankId: bank.id } },
        update: {},
        create: { paymentMethodId: method.id, bankId: bank.id },
      });
      console.log(`  ✓ ${methodCode} ← ${bankName}`);
    }
  }

  const stats = await Promise.all([
    prisma.paymentMethod.count(),
    prisma.bank.count(),
    prisma.paymentMethodBank.count(),
  ]);
  console.log(`\n=== Done: ${stats[0]} methods, ${stats[1]} banks, ${stats[2]} junctions ===`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run script**

Run dari `backend/`:
```bash
npx tsx --env-file=.env scripts/seed-payment-methods.ts
```

Expected output:
```
=== Seeding payment_methods ===
  ✓ cash (Tunai)
  ✓ edc (EDC)
  ... (6 total)
=== Seeding banks ===
  ✓ BCA
  ... (4 total)
=== Seeding default bank assignments ===
  ✓ edc ← BCA
  ... (8 total)
=== Done: 6 methods, 4 banks, 8 junctions ===
```

- [ ] **Step 3: Verify di Prisma Studio**

Run dari `backend/`:
```bash
npx prisma studio
```

Check: 6 row di `payment_methods`, 4 row di `banks`, 8 row di `payment_method_banks`.

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/seed-payment-methods.ts
git commit -m "feat(payment): add seed script for 6 default methods + 4 banks + junctions

Idempotent via upsert by code/name. Default assignment: EDC + Transfer
ke 4 bank, lainnya no bank (sesuai REV 2.5 behavior existing)."
```

### Task 2.2: Backfill banks dari TransactionPayment history

**Files:**
- Create: `backend/scripts/migrate-banks-from-history.ts`

- [ ] **Step 1: Buat file**

Content:

```typescript
// REV 2.6: Backfill master banks + junction dari TransactionPayment.bank lama.
// Scan distinct (method, bank) yang belum ada di master → auto-create.
// Idempotent.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Scanning distinct (method, bank) di TransactionPayment ===');
  const distinct = await prisma.transactionPayment.findMany({
    where: { bank: { not: null } },
    distinct: ['method', 'bank'],
    select: { method: true, bank: true },
  });
  console.log(`Found ${distinct.length} distinct pairs`);

  let banksCreated = 0;
  let junctionsCreated = 0;

  for (const { method, bank } of distinct) {
    if (!bank) continue;
    const trimmed = bank.trim();
    if (!trimmed) continue;

    // Lookup method (must exist from seed)
    const methodRecord = await prisma.paymentMethod.findUnique({ where: { code: method } });
    if (!methodRecord) {
      console.warn(`  ⚠ method '${method}' tidak ada di payment_methods - skip`);
      continue;
    }

    // Upsert bank (case-insensitive via collation utf8mb4_unicode_ci)
    const bankBefore = await prisma.bank.findUnique({ where: { name: trimmed } });
    const bankRecord = await prisma.bank.upsert({
      where: { name: trimmed },
      update: {},
      create: { name: trimmed },
    });
    if (!bankBefore) {
      banksCreated++;
      console.log(`  ✓ CREATED bank '${bankRecord.name}'`);
    }

    // Upsert junction
    const existing = await prisma.paymentMethodBank.findUnique({
      where: { paymentMethodId_bankId: { paymentMethodId: methodRecord.id, bankId: bankRecord.id } },
    });
    if (!existing) {
      await prisma.paymentMethodBank.create({
        data: { paymentMethodId: methodRecord.id, bankId: bankRecord.id },
      });
      junctionsCreated++;
      console.log(`  ✓ CREATED junction ${method} ← ${bankRecord.name}`);
    }
  }

  console.log(`\n=== Done: ${banksCreated} banks created, ${junctionsCreated} junctions created ===`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run script**

Run dari `backend/`:
```bash
npx tsx --env-file=.env scripts/migrate-banks-from-history.ts
```

Expected: di DB lokal yang baru di-fresh, mungkin 0 created (karena tidak ada history). Di DB prod, akan create bank-bank tambahan yang muncul di history.

- [ ] **Step 3: Verify**

Run query verifikasi:
```bash
node -e "import('./src/config/prisma.js').then(async ({prisma}) => {
  const txns = await prisma.transactionPayment.findMany({ where: { bank: { not: null } }, distinct: ['method', 'bank'], select: { method: true, bank: true } });
  const banksMaster = await prisma.bank.findMany({ select: { name: true } });
  const banksSet = new Set(banksMaster.map(b => b.name.toLowerCase()));
  const missing = txns.filter(t => !banksSet.has(t.bank.toLowerCase().trim()));
  console.log('Missing banks in master:', missing.length, missing);
})"
```

Expected: `Missing banks in master: 0 []`.

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/migrate-banks-from-history.ts
git commit -m "feat(payment): add migration script - backfill master banks dari TransactionPayment history

Scan distinct (method, bank) di transaction_payments. Auto-create bank
+ junction kalau belum ada di master. Idempotent."
```

### Task 2.3: Backfill settlement_method_counts dari Settlement existing

**Files:**
- Create: `backend/scripts/migrate-settlement-counts.ts`

- [ ] **Step 1: Buat file**

Content:

```typescript
// REV 2.6: Backfill settlement_method_counts dari Settlement 12 kolom lama.
// Tiap Settlement existing → 6 child rows (cash/edc/qris/gojek/grab/transfer).
// Idempotent via skipDuplicates.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const LEGACY_METHODS = ['cash', 'edc', 'qris', 'gojek', 'grab', 'transfer'] as const;

async function main() {
  console.log('=== Scanning Settlement existing ===');
  const settlements = await prisma.settlement.findMany({
    select: {
      id: true,
      countedCash: true, systemCash: true,
      countedEdc: true,  systemEdc: true,
      countedQris: true, systemQris: true,
      countedGojek: true, systemGojek: true,
      countedGrab: true,  systemGrab: true,
      countedTransfer: true, systemTransfer: true,
    },
  });
  console.log(`Found ${settlements.length} settlements`);

  let totalChildRowsCreated = 0;

  for (const s of settlements) {
    const rows = LEGACY_METHODS.map((code) => ({
      settlementId: s.id,
      paymentMethodCode: code,
      counted: (s as any)[`counted${code.charAt(0).toUpperCase()}${code.slice(1)}`] ?? 0,
      system: (s as any)[`system${code.charAt(0).toUpperCase()}${code.slice(1)}`] ?? 0,
    }));

    const result = await prisma.settlementMethodCount.createMany({
      data: rows,
      skipDuplicates: true,
    });
    totalChildRowsCreated += result.count;
    console.log(`  ✓ Settlement #${s.id}: created ${result.count} child rows`);
  }

  // Sanity check
  const expectedTotal = settlements.length * LEGACY_METHODS.length;
  const actualTotal = await prisma.settlementMethodCount.count();
  console.log(`\n=== Done ===`);
  console.log(`Settlements: ${settlements.length}`);
  console.log(`Expected child rows: ${expectedTotal}`);
  console.log(`Actual child rows: ${actualTotal}`);
  console.log(`Created in this run: ${totalChildRowsCreated}`);

  if (actualTotal < expectedTotal) {
    console.error('⚠ WARNING: actual < expected. Investigate sebelum lanjut Phase 9.');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run script**

Run dari `backend/`:
```bash
npx tsx --env-file=.env scripts/migrate-settlement-counts.ts
```

Expected: di DB fresh, 0 settlements → 0 child rows created. Di DB prod, akan create N×6 child rows.

- [ ] **Step 3: Verify count cocok**

Output script wajib menunjukkan `Expected child rows == Actual child rows`. Kalau tidak, **stop dan investigate**.

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/migrate-settlement-counts.ts
git commit -m "feat(payment): add migration script - backfill settlement_method_counts dari Settlement 12 kolom legacy

Tiap Settlement existing → 6 child rows (cash/edc/qris/gojek/grab/transfer).
Idempotent via skipDuplicates. Sanity check: actual >= expected."
```

### Task 2.4: Call seed-payment-methods di seed.ts

**Files:**
- Modify: `backend/prisma/seed.ts`

- [ ] **Step 1: Tambah import + call ke seed.ts**

Buka `backend/prisma/seed.ts`. Setelah seed user atau di akhir, tambah:

```typescript
// REV 2.6: seed payment methods + banks
import { spawnSync } from 'child_process';

console.log('\n=== Calling seed-payment-methods ===');
const result = spawnSync('npx', ['tsx', '--env-file=.env', 'scripts/seed-payment-methods.ts'], {
  stdio: 'inherit',
  cwd: __dirname + '/..',
});
if (result.status !== 0) {
  console.error('seed-payment-methods failed');
  process.exit(1);
}
```

Atau lebih clean: extract logic dari `scripts/seed-payment-methods.ts` jadi function reusable + import di seed.ts. Pilih sesuai preference (spawnSync simpel, function lebih DRY).

- [ ] **Step 2: Test re-seed**

Run dari `backend/`:
```bash
npx prisma migrate reset --force
```

Atau setara: drop seluruh data + re-seed. Expected: 6 payment_methods + 4 banks + 8 junctions ter-seed otomatis.

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "chore(seed): integrate seed-payment-methods ke prisma seed runner"
```

---

## Phase 3: Backend module `banks`

### Task 3.1: Banks Zod schema

**Files:**
- Create: `backend/src/modules/banks/banks.schema.ts`

- [ ] **Step 1: Buat folder + file**

Folder baru `backend/src/modules/banks/`. File `banks.schema.ts`:

```typescript
// Zod schema untuk modul banks. REV 2.6: master bank reusable lintas payment method.
// Owner-only CRUD. Name unique case-insensitive (DB collation utf8mb4_unicode_ci).

import { z } from 'zod';

const nameField = z
  .string()
  .trim()
  .min(1, 'Nama bank wajib diisi')
  .max(50, 'Nama bank maksimal 50 karakter');

export const createBankSchema = z.object({
  name: nameField,
});

export const updateBankSchema = z
  .object({
    name: nameField.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Minimal satu field harus diisi untuk update',
  });

export const listBanksQuerySchema = z.object({
  includeInactive: z.coerce.boolean().optional().default(false),
});

export type CreateBankInput = z.infer<typeof createBankSchema>;
export type UpdateBankInput = z.infer<typeof updateBankSchema>;
export type ListBanksQuery = z.infer<typeof listBanksQuerySchema>;
```

- [ ] **Step 2: Verify tsc**

Run dari `backend/`:
```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/banks/banks.schema.ts
git commit -m "feat(banks): add Zod schema for banks module"
```

### Task 3.2: Banks service

**Files:**
- Create: `backend/src/modules/banks/banks.service.ts`

- [ ] **Step 1: Buat file**

```typescript
// Service modul banks. REV 2.6: CRUD master bank, dedup case-insensitive via DB collation.
// Soft delete only (toggle isActive). No hard delete (per Decision #9 spec).

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError, notFound } from '../../utils/errors';
import type { CreateBankInput, UpdateBankInput, ListBanksQuery } from './banks.schema';

export interface BankView {
  id: number;
  name: string;
  isActive: boolean;
  methodCount: number;
  createdAt: string;
}

type BankWithCount = Prisma.BankGetPayload<{ include: { _count: { select: { methods: true } } } }>;

function toBankView(b: BankWithCount): BankView {
  return {
    id: b.id,
    name: b.name,
    isActive: b.isActive,
    methodCount: b._count.methods,
    createdAt: b.createdAt.toISOString(),
  };
}

export async function listBanks(query: ListBanksQuery): Promise<BankView[]> {
  const where: Prisma.BankWhereInput = {};
  if (!query.includeInactive) where.isActive = true;

  const banks = await prisma.bank.findMany({
    where,
    include: { _count: { select: { methods: true } } },
    orderBy: { name: 'asc' },
  });
  return banks.map(toBankView);
}

export async function getBankById(id: number): Promise<BankView> {
  const b = await prisma.bank.findUnique({
    where: { id },
    include: { _count: { select: { methods: true } } },
  });
  if (!b) throw notFound('Bank');
  return toBankView(b);
}

export async function createBank(input: CreateBankInput): Promise<BankView> {
  // Dedup case-insensitive (DB collation handles it via unique index)
  try {
    const created = await prisma.bank.create({
      data: { name: input.name },
      include: { _count: { select: { methods: true } } },
    });
    return toBankView(created);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new AppError(`Bank dengan nama "${input.name}" sudah ada`, 409);
    }
    throw e;
  }
}

export async function updateBank(id: number, input: UpdateBankInput): Promise<BankView> {
  const existing = await prisma.bank.findUnique({ where: { id } });
  if (!existing) throw notFound('Bank');

  try {
    const updated = await prisma.bank.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: { _count: { select: { methods: true } } },
    });
    return toBankView(updated);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new AppError(`Bank dengan nama "${input.name}" sudah ada`, 409);
    }
    throw e;
  }
}
```

- [ ] **Step 2: tsc check**

Run dari `backend/`:
```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/banks/banks.service.ts
git commit -m "feat(banks): add service layer - CRUD + dedup 409 + soft delete via isActive"
```

### Task 3.3: Banks controller

**Files:**
- Create: `backend/src/modules/banks/banks.controller.ts`

- [ ] **Step 1: Buat file**

Reference pola dari `backend/src/modules/bills/bills.controller.ts`. Content:

```typescript
// Controller modul banks. Unwrap validation + delegate ke service.

import type { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import {
  createBankSchema,
  updateBankSchema,
  listBanksQuerySchema,
} from './banks.schema';
import * as service from './banks.service';

export async function handleList(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listBanksQuerySchema.parse(req.query);
    const banks = await service.listBanks(query);
    sendSuccess(res, { banks });
  } catch (e) {
    next(e);
  }
}

export async function handleDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'ID harus integer positif' });
    }
    const bank = await service.getBankById(id);
    sendSuccess(res, { bank });
  } catch (e) {
    next(e);
  }
}

export async function handleCreate(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createBankSchema.parse(req.body);
    const bank = await service.createBank(input);
    res.status(201);
    sendSuccess(res, { bank }, 'Bank berhasil dibuat');
  } catch (e) {
    next(e);
  }
}

export async function handleUpdate(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'ID harus integer positif' });
    }
    const input = updateBankSchema.parse(req.body);
    const bank = await service.updateBank(id, input);
    sendSuccess(res, { bank }, 'Bank berhasil diupdate');
  } catch (e) {
    next(e);
  }
}
```

- [ ] **Step 2: tsc check**

Run: `npx tsc --noEmit`. Expected 0 errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/banks/banks.controller.ts
git commit -m "feat(banks): add Express controller layer"
```

### Task 3.4: Banks routes + register di app.ts

**Files:**
- Create: `backend/src/modules/banks/banks.routes.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Buat routes**

Content `backend/src/modules/banks/banks.routes.ts`:

```typescript
// Routes modul banks. REV 2.6: owner-only semua endpoint.

import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import {
  handleList,
  handleDetail,
  handleCreate,
  handleUpdate,
} from './banks.controller';

const router = Router();
router.use(authenticate, requireRole(UserRole.owner));

router.get('/', handleList);
router.post('/', handleCreate);
router.get('/:id', handleDetail);
router.patch('/:id', handleUpdate);

export default router;
```

- [ ] **Step 2: Register di `backend/src/app.ts`**

Buka `backend/src/app.ts`. Tambah import setelah `billRoutes`:

```typescript
import billRoutes from './modules/bills/bills.routes';
import banksRoutes from './modules/banks/banks.routes';
```

Tambah `app.use(...)` setelah `app.use('/api/bills', billRoutes)`:

```typescript
app.use('/api/bills', billRoutes);
app.use('/api/banks', banksRoutes);
```

- [ ] **Step 3: tsc + start dev server**

Run dari `backend/`:
```bash
npx tsc --noEmit
npm run dev
```

Expected: server start tanpa error. Kill setelah verify.

- [ ] **Step 4: Smoke test manual via curl**

Pastikan server jalan (`npm run dev` di terminal lain). Run:

```bash
# Login owner
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"name":"Owner","pin":"123456"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).data.token))")

# List banks
curl -s http://localhost:8000/api/banks -H "Authorization: Bearer $TOKEN"
# Expected: 4 banks (BCA, BNI, BRI, Mandiri)

# Create bank baru
curl -s -X POST http://localhost:8000/api/banks -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"name":"Permata"}'
# Expected: 201, bank Permata created

# Duplicate
curl -s -X POST http://localhost:8000/api/banks -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"name":"permata"}'
# Expected: 409, "Bank dengan nama permata sudah ada"

# Update (toggle inactive)
curl -s -X PATCH http://localhost:8000/api/banks/1 -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"isActive":false}'
# Expected: 200, isActive=false

# List include inactive
curl -s "http://localhost:8000/api/banks?includeInactive=true" -H "Authorization: Bearer $TOKEN"
# Expected: 5 banks (4 active + 1 inactive)
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/banks/banks.routes.ts backend/src/app.ts
git commit -m "feat(banks): add routes + register di app.ts - owner-only CRUD"
```

---

## Phase 4: Backend module `payment-methods`

### Task 4.1: Payment-methods Zod schema

**Files:**
- Create: `backend/src/modules/payment-methods/payment-methods.schema.ts`

- [ ] **Step 1: Buat file**

```typescript
// Zod schema untuk modul payment-methods. REV 2.6: owner-configurable master.
// Drop enum PaymentMethod (Phase 9). Code immutable setelah create.

import { z } from 'zod';

// 6 icon preset dari lucide-react yang dipakai di project
const ALLOWED_ICONS = [
  'Banknote',
  'CreditCard',
  'QrCode',
  'Bike',
  'Truck',
  'ArrowLeftRight',
  'Wallet',
  'Smartphone',
] as const;

const codeField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Code wajib diisi')
  .max(20, 'Code maksimal 20 karakter')
  .regex(/^[a-z][a-z0-9_]*$/, 'Code harus lowercase alphanum_underscore, mulai huruf');

const labelField = z.string().trim().min(1, 'Label wajib diisi').max(50);

const colorHexField = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Color hex harus format #RRGGBB')
  .transform((v) => v.toLowerCase());

const iconNameField = z.enum(ALLOWED_ICONS);

export const createPaymentMethodSchema = z.object({
  code: codeField,
  label: labelField,
  colorHex: colorHexField,
  iconName: iconNameField,
  requiresBank: z.boolean().default(false),
  allowDineIn: z.boolean().default(true),
  allowTakeaway: z.boolean().default(true),
  displayOrder: z.number().int().min(0).default(0),
  bankIds: z.array(z.number().int().positive()).default([]),
});

export const updatePaymentMethodSchema = z
  .object({
    label: labelField.optional(),
    colorHex: colorHexField.optional(),
    iconName: iconNameField.optional(),
    requiresBank: z.boolean().optional(),
    allowDineIn: z.boolean().optional(),
    allowTakeaway: z.boolean().optional(),
    displayOrder: z.number().int().min(0).optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Minimal satu field harus diisi untuk update',
  });

export const togglePaymentMethodSchema = z.object({
  isActive: z.boolean(),
});

export const reorderPaymentMethodsSchema = z.object({
  ordered: z
    .array(z.object({ id: z.number().int().positive(), displayOrder: z.number().int().min(0) }))
    .min(1),
});

export const listPaymentMethodsQuerySchema = z.object({
  includeInactive: z.coerce.boolean().optional().default(false),
});

export type CreatePaymentMethodInput = z.infer<typeof createPaymentMethodSchema>;
export type UpdatePaymentMethodInput = z.infer<typeof updatePaymentMethodSchema>;
export type TogglePaymentMethodInput = z.infer<typeof togglePaymentMethodSchema>;
export type ReorderPaymentMethodsInput = z.infer<typeof reorderPaymentMethodsSchema>;
export type ListPaymentMethodsQuery = z.infer<typeof listPaymentMethodsQuerySchema>;

export { ALLOWED_ICONS };
```

- [ ] **Step 2: tsc check**

Run: `npx tsc --noEmit`. Expected 0 errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/payment-methods/payment-methods.schema.ts
git commit -m "feat(payment-methods): add Zod schema - code immutable + color hex + icon enum"
```

### Task 4.2: Payment-methods service

**Files:**
- Create: `backend/src/modules/payment-methods/payment-methods.service.ts`

- [ ] **Step 1: Buat file**

```typescript
// Service modul payment-methods. REV 2.6: CRUD + toggle + bank assignment + reorder.
// Soft delete only via toggle isActive (Decision #9). Code immutable.

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError, notFound } from '../../utils/errors';
import type {
  CreatePaymentMethodInput,
  UpdatePaymentMethodInput,
  TogglePaymentMethodInput,
  ReorderPaymentMethodsInput,
  ListPaymentMethodsQuery,
} from './payment-methods.schema';

export interface PaymentMethodView {
  id: number;
  code: string;
  label: string;
  colorHex: string;
  iconName: string;
  requiresBank: boolean;
  allowDineIn: boolean;
  allowTakeaway: boolean;
  isActive: boolean;
  displayOrder: number;
  banks: { id: number; name: string; isActive: boolean }[];
  createdAt: string;
  updatedAt: string;
}

type MethodWithBanks = Prisma.PaymentMethodGetPayload<{
  include: { banks: { include: { bank: true } } };
}>;

function toView(m: MethodWithBanks): PaymentMethodView {
  return {
    id: m.id,
    code: m.code,
    label: m.label,
    colorHex: m.colorHex,
    iconName: m.iconName,
    requiresBank: m.requiresBank,
    allowDineIn: m.allowDineIn,
    allowTakeaway: m.allowTakeaway,
    isActive: m.isActive,
    displayOrder: m.displayOrder,
    banks: m.banks.map((j) => ({ id: j.bank.id, name: j.bank.name, isActive: j.bank.isActive })),
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

export async function listPaymentMethods(query: ListPaymentMethodsQuery): Promise<PaymentMethodView[]> {
  const where: Prisma.PaymentMethodWhereInput = {};
  if (!query.includeInactive) where.isActive = true;

  const methods = await prisma.paymentMethod.findMany({
    where,
    include: { banks: { include: { bank: true } } },
    orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
  });
  return methods.map(toView);
}

export async function getPaymentMethodById(id: number): Promise<PaymentMethodView> {
  const m = await prisma.paymentMethod.findUnique({
    where: { id },
    include: { banks: { include: { bank: true } } },
  });
  if (!m) throw notFound('Payment method');
  return toView(m);
}

export async function createPaymentMethod(input: CreatePaymentMethodInput): Promise<PaymentMethodView> {
  // Validate: if requiresBank=true, bankIds wajib non-empty
  if (input.requiresBank && input.bankIds.length === 0) {
    throw new AppError('Aktifkan minimal 1 bank dulu untuk method yang wajib bank', 400);
  }

  // Validate bank existence
  if (input.bankIds.length > 0) {
    const banks = await prisma.bank.findMany({ where: { id: { in: input.bankIds } } });
    if (banks.length !== input.bankIds.length) {
      throw new AppError('Salah satu bank ID tidak valid', 400);
    }
  }

  try {
    const created = await prisma.paymentMethod.create({
      data: {
        code: input.code,
        label: input.label,
        colorHex: input.colorHex,
        iconName: input.iconName,
        requiresBank: input.requiresBank,
        allowDineIn: input.allowDineIn,
        allowTakeaway: input.allowTakeaway,
        displayOrder: input.displayOrder,
        banks: {
          create: input.bankIds.map((bankId) => ({ bankId })),
        },
      },
      include: { banks: { include: { bank: true } } },
    });
    return toView(created);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new AppError(`Code "${input.code}" sudah dipakai method lain`, 409);
    }
    throw e;
  }
}

export async function updatePaymentMethod(
  id: number,
  input: UpdatePaymentMethodInput,
): Promise<PaymentMethodView> {
  const existing = await prisma.paymentMethod.findUnique({
    where: { id },
    include: { _count: { select: { banks: true } } },
  });
  if (!existing) throw notFound('Payment method');

  // Validate: kalau requiresBank dinaikkan ke true, cek bank count
  if (input.requiresBank === true && existing._count.banks === 0) {
    throw new AppError('Tidak bisa set requiresBank=true: aktifkan minimal 1 bank dulu', 400);
  }

  const updated = await prisma.paymentMethod.update({
    where: { id },
    data: input,
    include: { banks: { include: { bank: true } } },
  });
  return toView(updated);
}

export async function togglePaymentMethodActive(
  id: number,
  input: TogglePaymentMethodInput,
): Promise<PaymentMethodView> {
  const existing = await prisma.paymentMethod.findUnique({ where: { id } });
  if (!existing) throw notFound('Payment method');

  const updated = await prisma.paymentMethod.update({
    where: { id },
    data: { isActive: input.isActive },
    include: { banks: { include: { bank: true } } },
  });
  return toView(updated);
}

export async function assignBank(methodId: number, bankId: number): Promise<PaymentMethodView> {
  const [method, bank] = await Promise.all([
    prisma.paymentMethod.findUnique({ where: { id: methodId } }),
    prisma.bank.findUnique({ where: { id: bankId } }),
  ]);
  if (!method) throw notFound('Payment method');
  if (!bank) throw notFound('Bank');

  // Idempotent
  await prisma.paymentMethodBank.upsert({
    where: { paymentMethodId_bankId: { paymentMethodId: methodId, bankId } },
    update: {},
    create: { paymentMethodId: methodId, bankId },
  });

  return getPaymentMethodById(methodId);
}

export async function unassignBank(methodId: number, bankId: number): Promise<PaymentMethodView> {
  const method = await prisma.paymentMethod.findUnique({
    where: { id: methodId },
    include: { _count: { select: { banks: true } } },
  });
  if (!method) throw notFound('Payment method');

  // Block: kalau requiresBank=true dan ini bank terakhir
  if (method.requiresBank && method._count.banks <= 1) {
    throw new AppError('Method ini wajib punya minimal 1 bank - tidak bisa unassign yang terakhir', 400);
  }

  await prisma.paymentMethodBank.delete({
    where: { paymentMethodId_bankId: { paymentMethodId: methodId, bankId } },
  }).catch((e) => {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      // Not found, idempotent
      return;
    }
    throw e;
  });

  return getPaymentMethodById(methodId);
}

export async function reorderPaymentMethods(input: ReorderPaymentMethodsInput): Promise<PaymentMethodView[]> {
  await prisma.$transaction(
    input.ordered.map((item) =>
      prisma.paymentMethod.update({
        where: { id: item.id },
        data: { displayOrder: item.displayOrder },
      }),
    ),
  );
  return listPaymentMethods({ includeInactive: true });
}
```

- [ ] **Step 2: tsc check**

Run: `npx tsc --noEmit`. Expected 0 errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/payment-methods/payment-methods.service.ts
git commit -m "feat(payment-methods): add service layer - CRUD + toggle + bank assign + reorder atomic"
```

### Task 4.3: Payment-methods controller

**Files:**
- Create: `backend/src/modules/payment-methods/payment-methods.controller.ts`

- [ ] **Step 1: Buat file**

```typescript
// Controller modul payment-methods.

import type { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import {
  createPaymentMethodSchema,
  updatePaymentMethodSchema,
  togglePaymentMethodSchema,
  reorderPaymentMethodsSchema,
  listPaymentMethodsQuerySchema,
} from './payment-methods.schema';
import * as service from './payment-methods.service';

function parseId(req: Request, key = 'id'): number {
  const id = Number(req.params[key]);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`${key} harus integer positif`);
  }
  return id;
}

export async function handleList(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listPaymentMethodsQuerySchema.parse(req.query);
    const methods = await service.listPaymentMethods(query);
    sendSuccess(res, { paymentMethods: methods });
  } catch (e) {
    next(e);
  }
}

export async function handleDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req);
    const method = await service.getPaymentMethodById(id);
    sendSuccess(res, { paymentMethod: method });
  } catch (e) {
    next(e);
  }
}

export async function handleCreate(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createPaymentMethodSchema.parse(req.body);
    const method = await service.createPaymentMethod(input);
    res.status(201);
    sendSuccess(res, { paymentMethod: method }, 'Payment method berhasil dibuat');
  } catch (e) {
    next(e);
  }
}

export async function handleUpdate(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req);
    const input = updatePaymentMethodSchema.parse(req.body);
    const method = await service.updatePaymentMethod(id, input);
    sendSuccess(res, { paymentMethod: method }, 'Payment method berhasil diupdate');
  } catch (e) {
    next(e);
  }
}

export async function handleToggleActive(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req);
    const input = togglePaymentMethodSchema.parse(req.body);
    const method = await service.togglePaymentMethodActive(id, input);
    sendSuccess(res, { paymentMethod: method });
  } catch (e) {
    next(e);
  }
}

export async function handleAssignBank(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req);
    const bankId = parseId(req, 'bankId');
    const method = await service.assignBank(id, bankId);
    sendSuccess(res, { paymentMethod: method }, 'Bank di-assign');
  } catch (e) {
    next(e);
  }
}

export async function handleUnassignBank(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req);
    const bankId = parseId(req, 'bankId');
    const method = await service.unassignBank(id, bankId);
    sendSuccess(res, { paymentMethod: method }, 'Bank di-unassign');
  } catch (e) {
    next(e);
  }
}

export async function handleReorder(req: Request, res: Response, next: NextFunction) {
  try {
    const input = reorderPaymentMethodsSchema.parse(req.body);
    const methods = await service.reorderPaymentMethods(input);
    sendSuccess(res, { paymentMethods: methods }, 'Reorder diterapkan');
  } catch (e) {
    next(e);
  }
}
```

- [ ] **Step 2: tsc check**. Run `npx tsc --noEmit`. Expected 0 errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/payment-methods/payment-methods.controller.ts
git commit -m "feat(payment-methods): add Express controller layer"
```

### Task 4.4: Payment-methods routes + register di app.ts

**Files:**
- Create: `backend/src/modules/payment-methods/payment-methods.routes.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Buat routes dengan permission mix**

`backend/src/modules/payment-methods/payment-methods.routes.ts`:

```typescript
// Routes modul payment-methods. REV 2.6 permission:
//   - GET /payment-methods (active only) - semua role authenticated (untuk PaymentModal kasir)
//   - GET /payment-methods?includeInactive=true - owner only (block di middleware lain)
//   - POST/PATCH/DELETE - owner only

import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import {
  handleList,
  handleDetail,
  handleCreate,
  handleUpdate,
  handleToggleActive,
  handleAssignBank,
  handleUnassignBank,
  handleReorder,
} from './payment-methods.controller';

const router = Router();
router.use(authenticate);

// Public-to-authenticated (semua role)
router.get('/', handleList);
router.get('/:id', handleDetail);

// Owner-only mutations
router.use(requireRole(UserRole.owner));
router.post('/', handleCreate);
router.patch('/:id', handleUpdate);
router.patch('/:id/toggle-active', handleToggleActive);
router.post('/:id/banks/:bankId', handleAssignBank);
router.delete('/:id/banks/:bankId', handleUnassignBank);
router.post('/reorder', handleReorder);

export default router;
```

**Catatan**: `includeInactive=true` di GET tidak strict owner-only di middleware - kalau perlu enforce, tambah check di controller. Untuk REV 2.6 minimal, accept bahwa semua role bisa lihat method inactive (low-risk, no leakage).

- [ ] **Step 2: Register di `backend/src/app.ts`**

Buka `backend/src/app.ts`. Tambah:

```typescript
import banksRoutes from './modules/banks/banks.routes';
import paymentMethodsRoutes from './modules/payment-methods/payment-methods.routes';
```

Setelah `app.use('/api/banks', banksRoutes)`:
```typescript
app.use('/api/payment-methods', paymentMethodsRoutes);
```

- [ ] **Step 3: tsc + start dev server + smoke quick**

Run:
```bash
npx tsc --noEmit
npm run dev
```

Kemudian di terminal lain:
```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"name":"Owner","pin":"123456"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).data.token))")

# List methods
curl -s http://localhost:8000/api/payment-methods -H "Authorization: Bearer $TOKEN"
# Expected: 6 methods seeded (cash, edc, qris, gojek, grab, transfer) dengan banks per method
```

Kill server.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/payment-methods/payment-methods.routes.ts backend/src/app.ts
git commit -m "feat(payment-methods): add routes + register di app.ts - permission mix GET-all/mutations-owner"
```

### Task 4.5: Smoke test comprehensive untuk payment-methods + banks

**Files:**
- Create: `backend/scripts/smoke-payment-methods-banks.sh`

- [ ] **Step 1: Buat smoke test file**

Pattern ikut `backend/scripts/smoke-phase-8.sh`. Skenario yang harus dicover:

1. Login Owner + Jason (kasir) + Amel (waiter) - dapat token
2. Owner POST bank "Permata" → 201
3. Owner POST bank duplicate "permata" → 409
4. Jason POST bank → 403
5. Owner GET /banks → 5 banks (4 default + Permata)
6. Owner POST payment_method ShopeePay code+label+color+icon+banks[Permata.id]+requiresBank:true → 201
7. Owner POST duplicate code "shopeepay" → 409
8. Owner POST payment_method requiresBank=true+bankIds=[] → 400 "Aktifkan minimal 1 bank"
9. Owner POST payment_method invalid color "red" → 422
10. Owner POST payment_method invalid icon "Foo" → 422
11. Owner POST payment_method code "INVALID-Code" → 422 (regex fail)
12. Owner PATCH payment_method label → 200
13. Owner PATCH-toggle-active isActive:false → 200, hilang dari list (default)
14. Owner GET /payment-methods?includeInactive=true → muncul lagi
15. Owner POST /payment-methods/:id/banks/:bankId assign baru → 200
16. Owner DELETE /payment-methods/:id/banks/:bankId (bank terakhir untuk method requiresBank=true) → 400 "Tidak bisa unassign yang terakhir"
17. Owner POST reorder swap 2 method → 200, displayOrder ter-update
18. Owner PATCH payment_method (cash) coba ubah code → field tidak ada di updateSchema, ignored
19. Owner PATCH payment_method requiresBank=true tapi belum ada bank → 400
20. Jason GET /payment-methods → 200 (semua role boleh)
21. Amel GET /payment-methods → 200
22. Jason POST /payment-methods → 403
23. Jason POST /banks → 403

Skeleton script (kompres untuk brevity - engineer wajib expand semua 23 scenario):

```bash
#!/usr/bin/env bash
# Smoke test REV 2.6 - payment-methods + banks
set -u
BASE=http://localhost:8000/api

jq_field() {
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d); $1}catch(e){console.error('JSON parse fail:',d.slice(0,300))}})"
}

OWNER=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"name":"Owner","pin":"123456"}' | jq_field 'console.log(j.data.token)')
JASON=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"name":"Jason","pin":"111111"}' | jq_field 'console.log(j.data.token)')
AMEL=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"name":"Amel","pin":"222222"}' | jq_field 'console.log(j.data.token)')

echo ""
echo "========== BANKS =========="

echo ""
echo "=== 1. Owner POST /banks Permata → 201 ==="
PERMATA=$(curl -s -X POST $BASE/banks -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER" -d '{"name":"Permata"}')
echo "$PERMATA" | head -c 300; echo
PERMATA_ID=$(echo "$PERMATA" | jq_field 'console.log(j.data.bank.id)')

echo ""
echo "=== 2. Owner POST duplicate permata → 409 ==="
curl -s -o /dev/null -w "status=%{http_code}\n" -X POST $BASE/banks -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER" -d '{"name":"permata"}'

echo ""
echo "=== 3. Jason POST /banks → 403 ==="
curl -s -o /dev/null -w "status=%{http_code}\n" -X POST $BASE/banks -H "Content-Type: application/json" -H "Authorization: Bearer $JASON" -d '{"name":"Test"}'

# ... (continue 4-23, follow same pattern: echo step title + curl with assertion)

echo ""
echo "========== PAYMENT METHODS =========="

echo ""
echo "=== 6. Owner POST ShopeePay → 201 ==="
SHOPEE=$(curl -s -X POST $BASE/payment-methods -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER" -d "{\"code\":\"shopeepay\",\"label\":\"ShopeePay\",\"colorHex\":\"#ee4d2d\",\"iconName\":\"Smartphone\",\"requiresBank\":true,\"bankIds\":[$PERMATA_ID]}")
echo "$SHOPEE" | head -c 400; echo
SHOPEE_ID=$(echo "$SHOPEE" | jq_field 'console.log(j.data.paymentMethod.id)')

# ... continue
```

Engineer mengerjakan task ini WAJIB write all 23 scenarios, jangan sebagian.

- [ ] **Step 2: Run script**

Make executable:
```bash
chmod +x backend/scripts/smoke-payment-methods-banks.sh
```

Pastikan backend dev server jalan. Run dari project root atau backend/:
```bash
bash backend/scripts/smoke-payment-methods-banks.sh 2>&1 | tee /tmp/smoke-payment.log
```

Expected: semua 23 step status code match ekspektasi. Review log, fix bug kalau ada.

- [ ] **Step 3: Verify final state**

Run dari `backend/`:
```bash
node -e "import('./src/config/prisma.js').then(async ({prisma}) => {
  const m = await prisma.paymentMethod.count();
  const b = await prisma.bank.count();
  const j = await prisma.paymentMethodBank.count();
  console.log({methods: m, banks: b, junctions: j});
})"
```

Expected: methods >= 7 (6 default + ShopeePay), banks >= 5, junctions >= 9.

- [ ] **Step 4: Reset state (drop test data) sebelum lanjut**

```bash
npx prisma migrate reset --force
```

Re-seed jalan otomatis. Verify 6 methods + 4 banks + 8 junctions.

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/smoke-payment-methods-banks.sh
git commit -m "test(payment): add smoke test 23 scenarios - banks + payment-methods + permission + validation"
```

---

## Phase 5: Adapt `transactions` module

### Task 5.1: Adapt transactions schema

**Files:**
- Modify: `backend/src/modules/transactions/transactions.schema.ts`

- [ ] **Step 1: Read current state**

Buka `backend/src/modules/transactions/transactions.schema.ts`. Find `addPaymentSchema` (sekitar line 51-77). Note struktur existing:

```typescript
const needsBank = data.method === PaymentMethod.edc || data.method === PaymentMethod.transfer;
if (needsBank && !data.bank) { ... }
if (!needsBank && data.bank) { ... }
```

- [ ] **Step 2: Drop hardcoded `needsBank` superRefine**

Ganti `addPaymentSchema`:

```typescript
// REV 2.6: validasi bank dipindah ke service (runtime lookup payment_methods table).
// Schema cuma format check.
export const addPaymentSchema = z.object({
  method: z.string().trim().toLowerCase().min(1).max(20),
  bank: z.string().trim().max(50).nullable().optional(),
  amount: z.number().positive(),
  // ... field lain (discount, etc) tetap
});
```

Drop import `PaymentMethod` dari `@prisma/client` di file ini kalau tidak dipakai lagi.

- [ ] **Step 3: tsc check**

Run: `npx tsc --noEmit`. Expected 0 errors. Kalau ada error di service yang refer `PaymentMethod.edc` etc., **biarkan dulu** - akan di-fix di Task 5.2.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/transactions/transactions.schema.ts
git commit -m "refactor(transactions): drop hardcoded needsBank dari addPaymentSchema

Validasi bank dipindah ke runtime di service (lookup payment_methods.requiresBank + junction)."
```

### Task 5.2: Adapt transactions service

**Files:**
- Modify: `backend/src/modules/transactions/transactions.service.ts`

- [ ] **Step 1: Find `addPayment` function (sekitar line 506-656)**

Cari function yang handle payment submission. Identifikasi line yang validasi bank requirement (hardcoded).

- [ ] **Step 2: Replace dengan runtime lookup**

Pattern baru - di awal addPayment:

```typescript
// REV 2.6: lookup payment_methods + verify bank ∈ junction
const paymentMethod = await prisma.paymentMethod.findUnique({
  where: { code: input.method },
  include: { banks: { include: { bank: true } } },
});
if (!paymentMethod) {
  throw new AppError(`Payment method "${input.method}" tidak ditemukan`, 400);
}

if (paymentMethod.requiresBank) {
  if (!input.bank) {
    throw new AppError('Bank wajib diisi untuk method ini', 400);
  }
  const validBankNames = new Set(
    paymentMethod.banks.filter((j) => j.bank.isActive).map((j) => j.bank.name.toLowerCase()),
  );
  if (!validBankNames.has(input.bank.toLowerCase())) {
    throw new AppError(`Bank "${input.bank}" tidak tersedia untuk method ${paymentMethod.label}`, 400);
  }
} else {
  if (input.bank) {
    throw new AppError('Method ini tidak butuh bank', 400);
  }
}
```

Sisa logic `addPayment` (insert TransactionPayment, dll) tetap sama. `data.method` tetap simpan string `input.method`.

- [ ] **Step 3: Drop semua reference `PaymentMethod.edc`, `PaymentMethod.transfer`, dll**

Grep file untuk `PaymentMethod`:
```bash
grep -n "PaymentMethod" backend/src/modules/transactions/transactions.service.ts
```

Ganti tiap occurrence dengan literal string:
- `PaymentMethod.cash` → `'cash'`
- `PaymentMethod.edc` → `'edc'`
- etc.

Drop import line `import { PaymentMethod } from '@prisma/client'` kalau sudah tidak dipakai.

- [ ] **Step 4: tsc check**

Run: `npx tsc --noEmit`. Expected 0 errors. Kalau ada error, periksa file lain yang mungkin masih refer `PaymentMethod`:
```bash
grep -rn "PaymentMethod\." backend/src/
```

Ganti tiap occurrence dengan literal string (kecuali file `payment-methods/*` yang refer model `PaymentMethod` Prisma, itu beda - model class vs enum value).

- [ ] **Step 5: Smoke test addPayment scenario**

Start dev server. Run mini-smoke:
```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"name":"Jason","pin":"111111"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).data.token))")

# (asumsi sudah ada shift terbuka dan transaction open dari setup data)
# Submit payment EDC tanpa bank → expect 400
curl -s -X POST http://localhost:8000/api/transactions/1/payments -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"method":"edc","amount":50000}'
# Expected: {"success":false,"message":"Bank wajib diisi untuk method ini"}

# Submit EDC dengan bank "Permata" (tidak di-assign ke EDC) → expect 400
curl -s -X POST http://localhost:8000/api/transactions/1/payments -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"method":"edc","bank":"Permata","amount":50000}'
# Expected: {"success":false,"message":"Bank \"Permata\" tidak tersedia untuk method EDC"}

# Submit EDC dengan bank "BCA" → expect 201
curl -s -X POST http://localhost:8000/api/transactions/1/payments -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"method":"edc","bank":"BCA","amount":50000}'
# Expected: 201 success
```

- [ ] **Step 6: Run full smoke-phase-4a.sh untuk regression**

Run dari project root:
```bash
bash backend/scripts/smoke-phase-4a.sh 2>&1 | tee /tmp/smoke-phase-4a.log
```

Expected: skenario existing tetap pass (atau adjusted untuk bank yang diperlukan, sesuai response 6 method default).

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/transactions/transactions.service.ts
git commit -m "refactor(transactions): runtime validate payment_methods + bank junction

Drop hardcoded PaymentMethod enum reference. Service lookup payment_methods
by code + verify bank ∈ assigned junction. Validasi rules:
- requiresBank=true + no bank → 400
- bank tidak di junction → 400
- requiresBank=false + bank provided → 400"
```

---

## Phase 6: Adapt `settlements` module

### Task 6.1: Adapt settlements schema

**Files:**
- Modify: `backend/src/modules/settlements/settlements.schema.ts`

- [ ] **Step 1: Find createSettlementSchema (input untuk closing kasir)**

Buka `backend/src/modules/settlements/settlements.schema.ts`. Cari schema yang validasi input form blind count (sekarang 6 field hardcoded `countedCash`, `countedEdc`, dll).

- [ ] **Step 2: Ganti jadi Record<string, number>**

```typescript
// REV 2.6: counts dinamis per method code, bukan 6 field hardcoded.
export const createSettlementSchema = z.object({
  shiftId: z.number().int().positive(),
  counts: z.record(
    z.string().regex(/^[a-z][a-z0-9_]*$/),  // method code format
    z.number().int().min(0),
  ),
  note: z.string().trim().max(500).nullable().optional(),
});

export type CreateSettlementInput = z.infer<typeof createSettlementSchema>;
```

Drop field `countedCash`, `countedEdc`, dll dari schema. Sisa schema (review, query filter, dll) tetap.

- [ ] **Step 3: tsc check**

Run: `npx tsc --noEmit`. Expected error di service (karena masih refer 6 field). **Biarkan**, fix di Task 6.2.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/settlements/settlements.schema.ts
git commit -m "refactor(settlements): replace 6 fixed countedXxx fields dengan counts: Record<string, number>"
```

### Task 6.2: Adapt settlements service

**Files:**
- Modify: `backend/src/modules/settlements/settlements.service.ts`

- [ ] **Step 1: Adapt view shape**

Buka `backend/src/modules/settlements/settlements.service.ts`. Ganti view interface:

```typescript
// REV 2.6: dinamis per method, bukan 6 field hardcoded.
export interface SettlementMethodCountView {
  paymentMethodCode: string;
  methodLabel: string;
  colorHex: string;
  counted: number;
  system: number;
  variance: number; // counted - system
}

export interface SettlementView {
  id: number;
  shiftId: number;
  shiftType: string;
  cashierName: string;
  methodCounts: SettlementMethodCountView[]; // ← replace 12 fixed fields
  note: string | null;
  status: string;
  reviewedById: number | null;
  reviewerName: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface SettlementSystemEntry {
  paymentMethodCode: string;
  methodLabel: string;
  colorHex: string;
  total: number;
}

export interface SettlementPreviewView {
  shiftId: number;
  shiftType: string;
  system: SettlementSystemEntry[]; // ← dinamis array
  bankBreakdown: { method: string; bank: string; total: number }[];
}
```

- [ ] **Step 2: Rewrite `preview` function**

Pattern:

```typescript
export async function preview(shiftId: number): Promise<SettlementPreviewView> {
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift) throw notFound('Shift');

  // System totals: groupBy method dari TransactionPayment shift terkait
  const rows = await prisma.transactionPayment.groupBy({
    by: ['method'],
    where: {
      transaction: { shiftId, status: TransactionStatus.paid, mergedIntoId: null },
    },
    _sum: { amount: true },
  });

  // Lookup method metadata
  const methodCodes = rows.map((r) => r.method);
  const methods = await prisma.paymentMethod.findMany({
    where: { code: { in: methodCodes } },
  });
  const methodMap = new Map(methods.map((m) => [m.code, m]));

  const system: SettlementSystemEntry[] = rows.map((r) => {
    const meta = methodMap.get(r.method);
    return {
      paymentMethodCode: r.method,
      methodLabel: meta?.label ?? r.method,
      colorHex: meta?.colorHex ?? '#888888',
      total: r._sum.amount?.toNumber() ?? 0,
    };
  });

  // Bank breakdown (unchanged logic)
  const bankRows = await prisma.transactionPayment.groupBy({
    by: ['method', 'bank'],
    where: {
      transaction: { shiftId, status: TransactionStatus.paid, mergedIntoId: null },
      bank: { not: null },
    },
    _sum: { amount: true },
  });
  const bankBreakdown = bankRows
    .filter((r) => r.bank)
    .map((r) => ({
      method: r.method,
      bank: r.bank!,
      total: r._sum.amount?.toNumber() ?? 0,
    }));

  return {
    shiftId: shift.id,
    shiftType: shift.type,
    system,
    bankBreakdown,
  };
}
```

- [ ] **Step 3: Rewrite `create` (submit closing kasir)**

Pattern:

```typescript
export async function createSettlement(userId: number, input: CreateSettlementInput): Promise<SettlementView> {
  // ... existing checks (shift exists, kasir-own, malam, dll)

  // Compute system per method (sama dengan preview.system tapi disimpan)
  const systemRows = await prisma.transactionPayment.groupBy({
    by: ['method'],
    where: { transaction: { shiftId: input.shiftId, status: TransactionStatus.paid, mergedIntoId: null } },
    _sum: { amount: true },
  });
  const systemMap = new Map(systemRows.map((r) => [r.method, r._sum.amount?.toNumber() ?? 0]));

  // Build child rows: union dari counts keys + system keys
  const allCodes = new Set([...Object.keys(input.counts), ...systemMap.keys()]);
  const childRows = Array.from(allCodes).map((code) => ({
    paymentMethodCode: code,
    counted: input.counts[code] ?? 0,
    system: systemMap.get(code) ?? 0,
  }));

  const settlement = await prisma.$transaction(async (tx) => {
    const created = await tx.settlement.create({
      data: {
        shiftId: input.shiftId,
        userId,
        note: input.note ?? null,
        // 12 kolom legacy: set 0 (akan di-drop Phase 9), atau hapus dari data {} kalau optional di schema
        countedCash: 0, systemCash: 0,
        countedEdc: 0, systemEdc: 0,
        countedQris: 0, systemQris: 0,
        countedGojek: 0, systemGojek: 0,
        countedGrab: 0, systemGrab: 0,
        countedTransfer: 0, systemTransfer: 0,
        methodCounts: {
          create: childRows,
        },
      },
    });
    return created;
  });

  return getSettlementById(settlement.id);
}
```

**Catatan**: kolom 12 legacy masih disetting karena belum di-drop. Setelah Phase 9 cleanup, hapus baris-baris ini.

- [ ] **Step 4: Rewrite `getSettlementById`**

```typescript
export async function getSettlementById(id: number): Promise<SettlementView> {
  const s = await prisma.settlement.findUnique({
    where: { id },
    include: {
      shift: { include: { cashier: { select: { name: true } } } },
      reviewedBy: { select: { name: true } },
      methodCounts: true,
    },
  });
  if (!s) throw notFound('Settlement');

  // Lookup method metadata untuk label + color
  const methodCodes = s.methodCounts.map((mc) => mc.paymentMethodCode);
  const methods = await prisma.paymentMethod.findMany({ where: { code: { in: methodCodes } } });
  const methodMap = new Map(methods.map((m) => [m.code, m]));

  const methodCountsView: SettlementMethodCountView[] = s.methodCounts.map((mc) => {
    const meta = methodMap.get(mc.paymentMethodCode);
    return {
      paymentMethodCode: mc.paymentMethodCode,
      methodLabel: meta?.label ?? mc.paymentMethodCode,
      colorHex: meta?.colorHex ?? '#888888',
      counted: mc.counted,
      system: mc.system,
      variance: mc.counted - mc.system,
    };
  });

  return {
    id: s.id,
    shiftId: s.shiftId,
    shiftType: s.shift.type,
    cashierName: s.shift.cashier.name,
    methodCounts: methodCountsView,
    note: s.note,
    status: s.status,
    reviewedById: s.reviewedById,
    reviewerName: s.reviewedBy?.name ?? null,
    createdAt: s.createdAt.toISOString(),
    reviewedAt: s.reviewedAt?.toISOString() ?? null,
  };
}
```

- [ ] **Step 5: Adapt `listSettlements`**

Include `methodCounts: true` dan map ke `SettlementView`. Sama pattern dengan getById.

- [ ] **Step 6: tsc check**

Run: `npx tsc --noEmit`. Expected 0 errors. Kalau ada error di controller (memanggil field lama), fix sebelum lanjut.

- [ ] **Step 7: Smoke test settlement flow**

Run `bash backend/scripts/smoke-phase-8.sh 2>&1 | tee /tmp/smoke-phase-8.log`. Expected: skenario existing tetap pass (atau adjusted untuk response shape baru - `data.settlement.methodCounts` array, bukan 12 field).

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/settlements/settlements.service.ts
git commit -m "refactor(settlements): rewrite service dinamis pakai settlement_method_counts child table

Preview/create/getById switch dari 12 kolom fixed ke groupBy + child table.
Response shape: system: SettlementSystemEntry[] (array), methodCounts:
SettlementMethodCountView[] (array dengan variance). Backward-compat:
12 kolom legacy masih di-set 0 sampai Phase 9 drop."
```

---

## Phase 7: Adapt `dashboard` module

### Task 7.1: Adapt dashboard service byMethod

**Files:**
- Modify: `backend/src/modules/dashboard/dashboard.service.ts`

- [ ] **Step 1: Find `byMethod` computation**

Buka `backend/src/modules/dashboard/dashboard.service.ts`. Cari logic yang return `MethodTotals` (object 6 fixed key).

- [ ] **Step 2: Replace dengan groupBy dinamis**

```typescript
// REV 2.6: byMethod dinamis sesuai active methods (atau methods yang punya data di period).
export interface MethodTotalEntry {
  paymentMethodCode: string;
  methodLabel: string;
  colorHex: string;
  total: number;
}

async function computeByMethod(where: Prisma.TransactionPaymentWhereInput): Promise<MethodTotalEntry[]> {
  const rows = await prisma.transactionPayment.groupBy({
    by: ['method'],
    where,
    _sum: { amount: true },
  });
  const methodCodes = rows.map((r) => r.method);
  const methods = await prisma.paymentMethod.findMany({ where: { code: { in: methodCodes } } });
  const methodMap = new Map(methods.map((m) => [m.code, m]));

  return rows.map((r) => {
    const meta = methodMap.get(r.method);
    return {
      paymentMethodCode: r.method,
      methodLabel: meta?.label ?? r.method,
      colorHex: meta?.colorHex ?? '#888888',
      total: r._sum.amount?.toNumber() ?? 0,
    };
  })
  .sort((a, b) => b.total - a.total);
}
```

- [ ] **Step 3: Update `OwnerReportView` interface**

Ganti field `byMethod` dari `MethodTotals` ke `MethodTotalEntry[]`. Sama untuk `CashierDashboard` dan `WaiterDashboard` kalau ada.

- [ ] **Step 4: Call sites updated**

Cari semua tempat yang return MethodTotals object dan ganti pakai `computeByMethod()`. Pastikan tidak ada hardcoded key `byMethod.cash`, `byMethod.edc`, dll.

- [ ] **Step 5: tsc check**

Run: `npx tsc --noEmit`. Expected 0 errors.

- [ ] **Step 6: Smoke test dashboard**

Cari smoke test phase dashboard atau test manual:
```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"name":"Owner","pin":"123456"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).data.token))")
curl -s "http://localhost:8000/api/dashboard/owner?period=today" -H "Authorization: Bearer $TOKEN" | head -c 500
```

Expected: response punya `byMethod: MethodTotalEntry[]` (array), bukan object 6 key.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/dashboard/dashboard.service.ts
git commit -m "refactor(dashboard): byMethod dinamis - groupBy + lookup payment_methods metadata

Response shape: MethodTotalEntry[] (array), bukan MethodTotals (object 6 fixed key).
Mendukung method custom (mis. ShopeePay) muncul di chart owner."
```

---

## Phase 8: Backend full regression smoke test

### Task 8.1: Run all existing smoke scripts

**Files:** N/A (test only)

- [ ] **Step 1: List all smoke scripts**

```bash
ls backend/scripts/smoke-*.sh
```

- [ ] **Step 2: Reset DB**

```bash
cd backend && npx prisma migrate reset --force
```

- [ ] **Step 3: Run all scripts berurutan**

Start dev server di terminal terpisah. Run each script:

```bash
for s in backend/scripts/smoke-*.sh; do
  echo "=== $s ==="
  bash "$s" 2>&1 | tail -20
  echo ""
done
```

- [ ] **Step 4: Review failures**

Untuk tiap script yang fail, identifikasi penyebab:
- Smoke test legacy expect response shape lama (mis. `byMethod.cash`) → script perlu di-update untuk shape baru
- Schema validation gagal karena field dropped → script perlu adjust payload

**Update smoke scripts yang affected** (terutama `smoke-phase-4a.sh`, `smoke-phase-8.sh`, dashboard tests) untuk shape baru. Commit per script.

- [ ] **Step 5: tsc final check**

```bash
cd backend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit (kalau ada update di scripts)**

```bash
git add backend/scripts/
git commit -m "test: update legacy smoke scripts untuk REV 2.6 response shape baru"
```

---

## Phase 9: Schema cleanup - drop enum + 12 columns

### Task 9.1: Sanity check sebelum drop

**Files:** N/A (verification only)

- [ ] **Step 1: Verify settlement_method_counts complete**

```bash
node -e "import('./src/config/prisma.js').then(async ({prisma}) => {
  const settlements = await prisma.settlement.count();
  const counts = await prisma.settlementMethodCount.count();
  console.log({settlements, counts, expected_counts_min: settlements * 6, ok: counts >= settlements * 6});
})" 
```

Expected: `ok: true`. Kalau false, **run `scripts/migrate-settlement-counts.ts` dulu** untuk backfill.

- [ ] **Step 2: Verify banks master complete**

```bash
node -e "import('./src/config/prisma.js').then(async ({prisma}) => {
  const distinct = await prisma.transactionPayment.findMany({ where: { bank: { not: null } }, distinct: ['bank'], select: { bank: true } });
  const banks = await prisma.bank.findMany({ select: { name: true } });
  const banksLower = new Set(banks.map(b => b.name.toLowerCase()));
  const missing = distinct.filter(d => !banksLower.has(d.bank.toLowerCase().trim()));
  console.log({distinct_banks_in_history: distinct.length, master_banks: banks.length, missing: missing.length});
})"
```

Expected: `missing: 0`. Kalau >0, **run `scripts/migrate-banks-from-history.ts` dulu**.

### Task 9.2: Drop enum PaymentMethod + 12 Settlement columns

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Drop enum PaymentMethod dari schema**

Hapus block:
```prisma
enum PaymentMethod {
  cash
  edc
  qris
  gojek
  grab
  transfer
}
```

- [ ] **Step 2: Drop 12 kolom dari model Settlement**

Hapus 12 baris:
```prisma
  countedCash     Int @default(0) @map("counted_cash")
  systemCash      Int @default(0) @map("system_cash")
  countedEdc      Int @default(0) @map("counted_edc")
  systemEdc       Int @default(0) @map("system_edc")
  countedQris     Int @default(0) @map("counted_qris")
  systemQris      Int @default(0) @map("system_qris")
  countedGojek    Int @default(0) @map("counted_gojek")
  systemGojek     Int @default(0) @map("system_gojek")
  countedGrab     Int @default(0) @map("counted_grab")
  systemGrab      Int @default(0) @map("system_grab")
  countedTransfer Int @default(0) @map("counted_transfer")
  systemTransfer  Int @default(0) @map("system_transfer")
```

(Field names mungkin sedikit berbeda - cari yang relevan di schema actual.)

- [ ] **Step 3: Apply via db push**

```bash
npx prisma db push --accept-data-loss
```

- [ ] **Step 4: Drop reference 12 kolom di settlements.service.ts create**

Buka `backend/src/modules/settlements/settlements.service.ts`. Di function `createSettlement`, hapus baris-baris `countedCash: 0, systemCash: 0, ...` (12 baris) dari `data: {}` Prisma create.

- [ ] **Step 5: tsc check**

```bash
npx tsc --noEmit
```

Expected: 0 errors. Kalau ada error refer `PaymentMethod` enum yang terlewat → grep + fix.

- [ ] **Step 6: Run full smoke test sequence ulang**

```bash
npx prisma migrate reset --force
# start dev server
for s in backend/scripts/smoke-*.sh; do
  echo "=== $s ==="
  bash "$s" 2>&1 | tail -10
done
```

Expected: semua pass.

- [ ] **Step 7: Commit**

```bash
git add backend/prisma/schema.prisma backend/src/modules/settlements/settlements.service.ts
git commit -m "refactor(schema): drop enum PaymentMethod + 12 Settlement count columns (REV 2.6 cleanup)

Sudah di-replace oleh: (1) payment_methods master table dengan code VARCHAR,
(2) settlement_method_counts child table dinamis. Data lama sudah migrated
via scripts/migrate-* di Phase 2. Sanity check pass di Task 9.1."
```

---

## Phase 10: Frontend types + services

### Task 10.1: Update types/index.ts

**Files:**
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Drop hardcoded `PAYMENT_METHODS` const + `MethodTotals` interface**

Buka `frontend/src/types/index.ts`. Hapus:

```typescript
export type PaymentMethod = 'cash' | 'edc' | ... // ← DROP
export const PAYMENT_METHODS = [...]              // ← DROP (line 100-109)
export interface MethodTotals { cash: number; edc: number; ... } // ← DROP
```

- [ ] **Step 2: Add new types**

```typescript
// REV 2.6: Master payment method config from backend.
export interface BankSummary {
  id: number;
  name: string;
  isActive: boolean;
}

export interface PaymentMethodView {
  id: number;
  code: string;
  label: string;
  colorHex: string;
  iconName: string;
  requiresBank: boolean;
  allowDineIn: boolean;
  allowTakeaway: boolean;
  isActive: boolean;
  displayOrder: number;
  banks: BankSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface BankView {
  id: number;
  name: string;
  isActive: boolean;
  methodCount: number;
  createdAt: string;
}

// REV 2.6: Settlement dynamic
export interface SettlementMethodCountView {
  paymentMethodCode: string;
  methodLabel: string;
  colorHex: string;
  counted: number;
  system: number;
  variance: number;
}

export interface SettlementSystemEntry {
  paymentMethodCode: string;
  methodLabel: string;
  colorHex: string;
  total: number;
}

// REV 2.6: Dashboard byMethod dynamic
export interface MethodTotalEntry {
  paymentMethodCode: string;
  methodLabel: string;
  colorHex: string;
  total: number;
}

// REV 2.6: TransactionPayment.method jadi plain string (bukan union 6 enum)
// Update existing interface TransactionPayment:
//   method: string  (sebelumnya: method: PaymentMethod)
```

- [ ] **Step 3: Update `Settlement` interface existing**

Ganti 12 field hardcoded jadi `methodCounts: SettlementMethodCountView[]`. Update field di interface `Settlement`.

- [ ] **Step 4: Update `OwnerReport` / `CashierDashboard` / `WaiterDashboard` interface**

Ganti `byMethod: MethodTotals` jadi `byMethod: MethodTotalEntry[]`.

- [ ] **Step 5: tsc check (frontend)**

```bash
cd frontend && npx tsc --noEmit
```

Expected: banyak error - yang reference PAYMENT_METHODS, MethodTotals, dll. **Catat semua file yang error**, akan di-fix di task berikutnya.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "refactor(types): drop PAYMENT_METHODS const + MethodTotals + add REV 2.6 types

New: PaymentMethodView, BankView, BankSummary, SettlementMethodCountView,
SettlementSystemEntry, MethodTotalEntry. Existing: Settlement.methodCounts
array, byMethod array di dashboard interfaces."
```

### Task 10.2: Create paymentMethodService

**Files:**
- Create: `frontend/src/services/paymentMethodService.ts`

- [ ] **Step 1: Buat file**

```typescript
import api from './api';
import type { PaymentMethodView } from '../types';

interface CreatePaymentMethodInput {
  code: string;
  label: string;
  colorHex: string;
  iconName: string;
  requiresBank: boolean;
  allowDineIn: boolean;
  allowTakeaway: boolean;
  displayOrder?: number;
  bankIds: number[];
}

interface UpdatePaymentMethodInput {
  label?: string;
  colorHex?: string;
  iconName?: string;
  requiresBank?: boolean;
  allowDineIn?: boolean;
  allowTakeaway?: boolean;
  displayOrder?: number;
}

export const paymentMethodService = {
  async list(includeInactive = false): Promise<PaymentMethodView[]> {
    const params = includeInactive ? { includeInactive: 'true' } : undefined;
    const res = await api.get('/payment-methods', { params });
    return res.data.data.paymentMethods;
  },

  async getById(id: number): Promise<PaymentMethodView> {
    const res = await api.get(`/payment-methods/${id}`);
    return res.data.data.paymentMethod;
  },

  async create(input: CreatePaymentMethodInput): Promise<PaymentMethodView> {
    const res = await api.post('/payment-methods', input);
    return res.data.data.paymentMethod;
  },

  async update(id: number, input: UpdatePaymentMethodInput): Promise<PaymentMethodView> {
    const res = await api.patch(`/payment-methods/${id}`, input);
    return res.data.data.paymentMethod;
  },

  async toggleActive(id: number, isActive: boolean): Promise<PaymentMethodView> {
    const res = await api.patch(`/payment-methods/${id}/toggle-active`, { isActive });
    return res.data.data.paymentMethod;
  },

  async assignBank(methodId: number, bankId: number): Promise<PaymentMethodView> {
    const res = await api.post(`/payment-methods/${methodId}/banks/${bankId}`);
    return res.data.data.paymentMethod;
  },

  async unassignBank(methodId: number, bankId: number): Promise<PaymentMethodView> {
    const res = await api.delete(`/payment-methods/${methodId}/banks/${bankId}`);
    return res.data.data.paymentMethod;
  },

  async reorder(ordered: { id: number; displayOrder: number }[]): Promise<PaymentMethodView[]> {
    const res = await api.post('/payment-methods/reorder', { ordered });
    return res.data.data.paymentMethods;
  },
};
```

- [ ] **Step 2: tsc check**

Run: `cd frontend && npx tsc --noEmit`. Errors di file ini = 0 (errors lain dari Task 10.1 masih ada - itu OK).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/paymentMethodService.ts
git commit -m "feat(payment): add paymentMethodService.ts - full CRUD + toggle + assign + reorder"
```

### Task 10.3: Create bankService

**Files:**
- Create: `frontend/src/services/bankService.ts`

- [ ] **Step 1: Buat file**

```typescript
import api from './api';
import type { BankView } from '../types';

interface CreateBankInput {
  name: string;
}

interface UpdateBankInput {
  name?: string;
  isActive?: boolean;
}

export const bankService = {
  async list(includeInactive = false): Promise<BankView[]> {
    const params = includeInactive ? { includeInactive: 'true' } : undefined;
    const res = await api.get('/banks', { params });
    return res.data.data.banks;
  },

  async getById(id: number): Promise<BankView> {
    const res = await api.get(`/banks/${id}`);
    return res.data.data.bank;
  },

  async create(input: CreateBankInput): Promise<BankView> {
    const res = await api.post('/banks', input);
    return res.data.data.bank;
  },

  async update(id: number, input: UpdateBankInput): Promise<BankView> {
    const res = await api.patch(`/banks/${id}`, input);
    return res.data.data.bank;
  },
};
```

- [ ] **Step 2: tsc check + commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/services/bankService.ts
git commit -m "feat(banks): add bankService.ts - list + CRUD + soft delete via isActive"
```

### Task 10.4: Adapt settlementService + dashboardService response shape

**Files:**
- Modify: `frontend/src/services/settlementService.ts`
- Modify: `frontend/src/services/dashboardService.ts`

- [ ] **Step 1: Update settlementService**

Buka `frontend/src/services/settlementService.ts`. Update method signatures:
- `preview`: return type sekarang `{ shiftId, shiftType, system: SettlementSystemEntry[], bankBreakdown: [...] }`
- `create`: input `counts: Record<string, number>` bukan `countedCash`, dll.
- `getById`: return shape pakai `methodCounts: SettlementMethodCountView[]`.

Update interface input + return per typing baru di `types/index.ts`.

- [ ] **Step 2: Update dashboardService**

`byMethod` return type ganti dari `MethodTotals` ke `MethodTotalEntry[]`.

- [ ] **Step 3: tsc check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: errors berkurang signifikan. Sisanya = errors di komponen yang refer types lama (akan di-fix di Phase 11-14).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/settlementService.ts frontend/src/services/dashboardService.ts
git commit -m "refactor(services): adapt settlement + dashboard ke shape array dinamis REV 2.6"
```

---

## Phase 11: Frontend PaymentMethodsPage + 2 modal

### Task 11.1: Konsistensi audit + decision matrix

**Files:** N/A (analysis only)

- [ ] **Step 1: Audit 3 referensi**

Buka 3 file untuk pattern audit:
- `frontend/src/pages/MenuPage.tsx` - CRUD owner-only dengan tab + modal create/edit
- `frontend/src/pages/BillsPage.tsx` - list dengan filter + create modal
- `frontend/src/pages/StockPage.tsx` (RawMaterialsTab) - CRUD master dengan dialog primitive

Catat:
- Pattern fetch via React Query (`useQuery`, `useMutation`)
- Pattern dialog primitive (`<Dialog>`, header/body/footer)
- Pattern button (Button variant primary/secondary)
- Pattern Card padding + typography

- [ ] **Step 2: Read primitive components**

Buka cepat:
- `frontend/src/components/ui/dialog.tsx`
- `frontend/src/components/ui/combobox.tsx`
- `frontend/src/components/ui/button.tsx`
- `frontend/src/components/ui/card.tsx`

Note: API + prop shape, untuk dipakai konsisten.

(Tidak ada commit untuk task ini - audit phase.)

### Task 11.2: PaymentMethodsPage scaffolding (tab switching)

**Files:**
- Create: `frontend/src/pages/PaymentMethodsPage.tsx`

- [ ] **Step 1: Buat file dengan 2 tab + React Query setup**

```typescript
// REV 2.6: Owner-only page untuk config payment methods + banks.
// 2 tab di 1 page, konsisten dengan MenuPage/BillsPage pattern.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { paymentMethodService } from '../services/paymentMethodService';
import { bankService } from '../services/bankService';
import { PaymentMethodsTab } from '../components/payment-methods/PaymentMethodsTab';
import { BanksTab } from '../components/payment-methods/BanksTab';

type Tab = 'methods' | 'banks';

export function PaymentMethodsPage() {
  const [tab, setTab] = useState<Tab>('methods');

  const methodsQuery = useQuery({
    queryKey: ['paymentMethods', 'all'],
    queryFn: () => paymentMethodService.list(true),
  });

  const banksQuery = useQuery({
    queryKey: ['banks', 'all'],
    queryFn: () => bankService.list(true),
  });

  return (
    <div className="space-y-4 p-4">
      <header>
        <h1 className="text-heading-lg">Pembayaran</h1>
        <p className="text-body-sm text-neutral-600">Konfigurasi metode pembayaran + bank yang tersedia</p>
      </header>

      <div className="flex gap-2 border-b border-neutral-200">
        <button
          type="button"
          className={`px-4 py-2 text-body-sm font-medium ${tab === 'methods' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-neutral-500'}`}
          onClick={() => setTab('methods')}
        >
          Metode Pembayaran
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-body-sm font-medium ${tab === 'banks' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-neutral-500'}`}
          onClick={() => setTab('banks')}
        >
          Bank
        </button>
      </div>

      {tab === 'methods' && (
        <PaymentMethodsTab
          methods={methodsQuery.data ?? []}
          banks={banksQuery.data ?? []}
          loading={methodsQuery.isLoading || banksQuery.isLoading}
          refetch={() => { methodsQuery.refetch(); banksQuery.refetch(); }}
        />
      )}

      {tab === 'banks' && (
        <BanksTab
          banks={banksQuery.data ?? []}
          loading={banksQuery.isLoading}
          refetch={() => banksQuery.refetch()}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: tsc check (akan ada error - tab components belum ada)**

```bash
cd frontend && npx tsc --noEmit
```

Expected: error import `PaymentMethodsTab`, `BanksTab` belum ada. Fix di task berikutnya.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/PaymentMethodsPage.tsx
git commit -m "feat(payment-methods): scaffold PaymentMethodsPage 2-tab"
```

### Task 11.3: PaymentMethodsTab + BanksTab components

**Files:**
- Create: `frontend/src/components/payment-methods/PaymentMethodsTab.tsx`
- Create: `frontend/src/components/payment-methods/BanksTab.tsx`

- [ ] **Step 1: Buat PaymentMethodsTab**

Konsultasi MenuPage untuk pattern. Struktur:
- Header: tombol `[+ Tambah Metode]`
- List card per method dengan icon color box, label, toggle active, edit button, badge counter banks
- Open `PaymentMethodFormModal` saat klik [+ Tambah Metode] atau [Edit]

Pseudocode (engineer expand penuh):

```typescript
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentMethodService } from '../../services/paymentMethodService';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { PaymentMethodFormModal } from '../PaymentMethodFormModal';
import type { PaymentMethodView, BankView } from '../../types';
import * as LucideIcons from 'lucide-react';

interface Props {
  methods: PaymentMethodView[];
  banks: BankView[];
  loading: boolean;
  refetch: () => void;
}

export function PaymentMethodsTab({ methods, banks, loading, refetch }: Props) {
  const [editing, setEditing] = useState<PaymentMethodView | null>(null);
  const [creating, setCreating] = useState(false);
  const qc = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      paymentMethodService.toggleActive(id, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paymentMethods'] }),
  });

  return (
    <div className="space-y-3">
      <Button variant="primary" onClick={() => setCreating(true)}>+ Tambah Metode</Button>

      {loading ? <p>Memuat...</p> : (
        methods.map((m) => {
          const Icon = (LucideIcons as any)[m.iconName] ?? LucideIcons.CreditCard;
          return (
            <div key={m.id} className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: m.colorHex }}>
                <Icon size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{m.label}</span>
                  <code className="text-body-xs text-neutral-500">· {m.code}</code>
                </div>
                <div className="flex gap-2 text-body-xs text-neutral-600">
                  {m.allowDineIn && <Badge tone="info" variant="soft" size="sm">Dine-in</Badge>}
                  {m.allowTakeaway && <Badge tone="info" variant="soft" size="sm">Takeaway</Badge>}
                  {m.requiresBank && <Badge tone="warning" variant="soft" size="sm">Wajib bank</Badge>}
                  <span>· {m.banks.length} bank</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={m.isActive}
                onChange={(e) => toggleMutation.mutate({ id: m.id, isActive: e.target.checked })}
              />
              <Button variant="secondary" size="sm" onClick={() => setEditing(m)}>Edit</Button>
            </div>
          );
        })
      )}

      {(creating || editing) && (
        <PaymentMethodFormModal
          method={editing}
          banks={banks}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSuccess={() => { refetch(); setCreating(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Buat BanksTab**

Pattern sama, lebih simpel - list row per bank:

```typescript
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bankService } from '../../services/bankService';
import { Button } from '../ui/button';
import { BankFormModal } from '../BankFormModal';
import type { BankView } from '../../types';

interface Props {
  banks: BankView[];
  loading: boolean;
  refetch: () => void;
}

export function BanksTab({ banks, loading, refetch }: Props) {
  const [editing, setEditing] = useState<BankView | null>(null);
  const [creating, setCreating] = useState(false);
  const qc = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => bankService.update(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['banks'] }),
  });

  return (
    <div className="space-y-3">
      <Button variant="primary" onClick={() => setCreating(true)}>+ Tambah Bank</Button>

      {loading ? <p>Memuat...</p> : (
        banks.map((b) => (
          <div key={b.id} className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3">
            <span className="flex-1 font-medium">{b.name}</span>
            <span className="text-body-sm text-neutral-500">· {b.methodCount} method</span>
            <input
              type="checkbox"
              checked={b.isActive}
              onChange={(e) => toggleMutation.mutate({ id: b.id, isActive: e.target.checked })}
            />
            <Button variant="secondary" size="sm" onClick={() => setEditing(b)}>Edit</Button>
          </div>
        ))
      )}

      {(creating || editing) && (
        <BankFormModal
          bank={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSuccess={() => { refetch(); setCreating(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: tsc check (akan ada error - modal belum ada)**

Run: `cd frontend && npx tsc --noEmit`. Error import modal komponen - wajar.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/payment-methods/
git commit -m "feat(payment-methods): add PaymentMethodsTab + BanksTab - list + toggle active + edit trigger"
```

### Task 11.4: PaymentMethodFormModal

**Files:**
- Create: `frontend/src/components/PaymentMethodFormModal.tsx`

- [ ] **Step 1: Buat modal create/edit method**

Form fields:
- `code` (text, read-only kalau edit)
- `label` (text)
- `colorHex` (8-swatch picker)
- `iconName` (6-chip lucide picker)
- `requiresBank` (toggle)
- `allowDineIn` + `allowTakeaway` (toggle)
- `bankIds` (multi-checkbox dari banks list)

Validasi inline: kalau `requiresBank=true` dan `bankIds.length === 0` → disable submit + hint.

Pakai Dialog primitive existing. React Hook Form atau plain useState (pilih sesuai pattern existing - cek MenuPage modal).

Engineer wajib write full implementation berdasarkan reference. Skeleton:

```typescript
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
import { paymentMethodService } from '../services/paymentMethodService';
import type { PaymentMethodView, BankView } from '../types';

const COLOR_PRESETS = ['#1f7a4d', '#2563eb', '#9333ea', '#16a34a', '#dc2626', '#d97706', '#ee4d2d', '#6366f1'];
const ICON_PRESETS = ['Banknote', 'CreditCard', 'QrCode', 'Bike', 'Truck', 'ArrowLeftRight', 'Wallet', 'Smartphone'] as const;

interface Props {
  method: PaymentMethodView | null;
  banks: BankView[];
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentMethodFormModal({ method, banks, onClose, onSuccess }: Props) {
  const isEdit = !!method;
  const [form, setForm] = useState({
    code: method?.code ?? '',
    label: method?.label ?? '',
    colorHex: method?.colorHex ?? COLOR_PRESETS[0],
    iconName: method?.iconName ?? 'CreditCard',
    requiresBank: method?.requiresBank ?? false,
    allowDineIn: method?.allowDineIn ?? true,
    allowTakeaway: method?.allowTakeaway ?? true,
    bankIds: method?.banks.map((b) => b.id) ?? [],
  });

  const qc = useQueryClient();

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (isEdit && method) {
        // Update method fields
        await paymentMethodService.update(method.id, {
          label: form.label,
          colorHex: form.colorHex,
          iconName: form.iconName,
          requiresBank: form.requiresBank,
          allowDineIn: form.allowDineIn,
          allowTakeaway: form.allowTakeaway,
        });
        // Sync junction: diff existing.banks.id vs form.bankIds
        const existingIds = new Set(method.banks.map((b) => b.id));
        const newIds = new Set(form.bankIds);
        const toAdd = form.bankIds.filter((id) => !existingIds.has(id));
        const toRemove = method.banks.map((b) => b.id).filter((id) => !newIds.has(id));
        for (const bankId of toAdd) await paymentMethodService.assignBank(method.id, bankId);
        for (const bankId of toRemove) await paymentMethodService.unassignBank(method.id, bankId);
      } else {
        await paymentMethodService.create({
          code: form.code,
          label: form.label,
          colorHex: form.colorHex,
          iconName: form.iconName,
          requiresBank: form.requiresBank,
          allowDineIn: form.allowDineIn,
          allowTakeaway: form.allowTakeaway,
          bankIds: form.bankIds,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['paymentMethods'] });
      onSuccess();
    },
  });

  const canSubmit = form.label.trim() && (!form.requiresBank || form.bankIds.length > 0) && (isEdit || form.code.trim());

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Content>
        <Dialog.Header>{isEdit ? `Edit ${method?.label}` : 'Tambah Metode Pembayaran'}</Dialog.Header>
        <div className="space-y-3 p-4">
          {/* code: editable only on create */}
          <label className="block">
            <span className="text-body-sm font-medium">Code (immutable)</span>
            <input
              type="text"
              value={form.code}
              disabled={isEdit}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toLowerCase() }))}
              placeholder="shopeepay"
              className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
            />
          </label>

          {/* label */}
          <label className="block">
            <span className="text-body-sm font-medium">Label</span>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="ShopeePay"
              className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
            />
          </label>

          {/* color picker */}
          <div>
            <span className="text-body-sm font-medium">Warna</span>
            <div className="mt-1 flex gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`h-8 w-8 rounded ${form.colorHex === c ? 'ring-2 ring-offset-2 ring-neutral-700' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setForm((f) => ({ ...f, colorHex: c }))}
                />
              ))}
            </div>
          </div>

          {/* icon picker */}
          <div>
            <span className="text-body-sm font-medium">Icon</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {ICON_PRESETS.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={`rounded border px-2 py-1 text-body-xs ${form.iconName === name ? 'border-primary-600 bg-primary-50' : 'border-neutral-300'}`}
                  onClick={() => setForm((f) => ({ ...f, iconName: name }))}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* toggles */}
          <div className="space-y-1">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.requiresBank} onChange={(e) => setForm((f) => ({ ...f, requiresBank: e.target.checked }))} />
              <span>Wajib pilih bank saat checkout</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.allowDineIn} onChange={(e) => setForm((f) => ({ ...f, allowDineIn: e.target.checked }))} />
              <span>Tersedia untuk dine-in</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.allowTakeaway} onChange={(e) => setForm((f) => ({ ...f, allowTakeaway: e.target.checked }))} />
              <span>Tersedia untuk takeaway</span>
            </label>
          </div>

          {/* banks multi-select */}
          <div>
            <span className="text-body-sm font-medium">Bank yang tersedia {form.requiresBank && <span className="text-error">*</span>}</span>
            <div className="mt-1 max-h-48 space-y-1 overflow-y-auto rounded border border-neutral-200 p-2">
              {banks.filter((b) => b.isActive).map((b) => (
                <label key={b.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.bankIds.includes(b.id)}
                    onChange={(e) => {
                      if (e.target.checked) setForm((f) => ({ ...f, bankIds: [...f.bankIds, b.id] }));
                      else setForm((f) => ({ ...f, bankIds: f.bankIds.filter((id) => id !== b.id) }));
                    }}
                  />
                  <span>{b.name}</span>
                </label>
              ))}
            </div>
            {form.requiresBank && form.bankIds.length === 0 && (
              <p className="mt-1 text-body-xs text-error-600">Pilih minimal 1 bank untuk method yang wajib bank.</p>
            )}
          </div>
        </div>

        <Dialog.Footer>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button variant="primary" disabled={!canSubmit || submitMutation.isPending} onClick={() => submitMutation.mutate()}>
            {submitMutation.isPending ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
```

- [ ] **Step 2: tsc check**

Run: `cd frontend && npx tsc --noEmit`. Errors yang related ke modal ini = 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/PaymentMethodFormModal.tsx
git commit -m "feat(payment-methods): add PaymentMethodFormModal - create/edit dengan color+icon picker + bank multi-select"
```

### Task 11.5: BankFormModal

**Files:**
- Create: `frontend/src/components/BankFormModal.tsx`

- [ ] **Step 1: Buat modal**

Simpler form: name + isActive. Info read-only "Dipakai di N method".

```typescript
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
import { bankService } from '../services/bankService';
import type { BankView } from '../types';

interface Props {
  bank: BankView | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function BankFormModal({ bank, onClose, onSuccess }: Props) {
  const isEdit = !!bank;
  const [form, setForm] = useState({
    name: bank?.name ?? '',
    isActive: bank?.isActive ?? true,
  });
  const qc = useQueryClient();

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (isEdit && bank) await bankService.update(bank.id, form);
      else await bankService.create({ name: form.name });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['banks'] });
      qc.invalidateQueries({ queryKey: ['paymentMethods'] });
      onSuccess();
    },
  });

  const canSubmit = form.name.trim().length > 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Content>
        <Dialog.Header>{isEdit ? `Edit ${bank?.name}` : 'Tambah Bank'}</Dialog.Header>
        <div className="space-y-3 p-4">
          <label className="block">
            <span className="text-body-sm font-medium">Nama Bank</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Permata"
              className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
            />
          </label>

          {isEdit && (
            <>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
                <span>Aktif</span>
              </label>
              {bank && bank.methodCount > 0 && (
                <p className="text-body-xs text-neutral-600">Dipakai di {bank.methodCount} method</p>
              )}
            </>
          )}
        </div>
        <Dialog.Footer>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button variant="primary" disabled={!canSubmit || submitMutation.isPending} onClick={() => submitMutation.mutate()}>
            {submitMutation.isPending ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
```

- [ ] **Step 2: tsc + commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/components/BankFormModal.tsx
git commit -m "feat(banks): add BankFormModal - create/edit + soft delete via isActive toggle"
```

### Task 11.6: Route + nav link

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx`

- [ ] **Step 1: Add route ke App.tsx**

Buka `frontend/src/App.tsx`. Tambah:

```typescript
import { PaymentMethodsPage } from './pages/PaymentMethodsPage';
```

Di routing config:
```tsx
<Route path="/payment-methods" element={<OwnerRoute><PaymentMethodsPage /></OwnerRoute>} />
```

- [ ] **Step 2: Add nav link ke Layout.tsx**

Buka `frontend/src/components/Layout.tsx`. Di nav owner, tambah link "Pembayaran" antara "Menu" dan "Stok":

```tsx
{role === 'owner' && (
  <>
    {/* ... existing links Beranda, Pesanan, Menu ... */}
    <NavLink to="/payment-methods">Pembayaran</NavLink>
    {/* ... continue Stok, Belanja, Tagihan, Setelan, Histori ... */}
  </>
)}
```

(Sesuaikan dengan pattern NavLink existing di file.)

- [ ] **Step 3: tsc + build**

```bash
cd frontend
npx tsc --noEmit
npm run build
```

Expected: tsc 0 errors, build success.

- [ ] **Step 4: Manual e2e di browser**

Start frontend dev:
```bash
npm run dev
```

Backend juga jalan (port 8000). Login sebagai Owner → ke "/payment-methods":
- Verify 6 methods + 4 banks muncul
- Klik [+ Tambah Metode] → modal muncul → fill ShopeePay + color + icon + check Permata bank → submit
- Verify ShopeePay muncul di list, banks tab "Permata" methodCount = 1
- Toggle active off untuk GoFood → verify isActive=false di list

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat(routing): add /payment-methods route owner-only + nav link Pembayaran"
```

---

## Phase 12: Adapt PaymentModal

### Task 12.1: PaymentModal dinamis dari API

**Files:**
- Modify: `frontend/src/components/PaymentModal.tsx`

- [ ] **Step 1: Add React Query untuk paymentMethods**

Di top dari komponen PaymentModal:

```typescript
import { useQuery } from '@tanstack/react-query';
import { paymentMethodService } from '../services/paymentMethodService';
import * as LucideIcons from 'lucide-react';

// Di dalam komponen:
const methodsQuery = useQuery({
  queryKey: ['paymentMethods', 'active'],
  queryFn: () => paymentMethodService.list(false), // active only
});
```

- [ ] **Step 2: Drop hardcoded constants**

Hapus:
- `const bankOptions = useMemo(...)` block (line 252-264)
- `loadRecentBanks` + `saveRecentBank` helpers (line 102-113)
- localStorage `pos.recent-banks` references
- Hardcoded filter `dineIn excludes gojek+grab`
- Import `PAYMENT_METHODS` dari types

- [ ] **Step 3: Adapt MethodGrid filter + render**

Replace MethodGrid logic (line 1144-1186):

```typescript
const filteredMethods = (methodsQuery.data ?? [])
  .filter((m) => m.isActive)
  .filter((m) => orderType === 'dineIn' ? m.allowDineIn : m.allowTakeaway)
  .sort((a, b) => a.displayOrder - b.displayOrder);

// Empty state
if (filteredMethods.length === 0) {
  return <p className="p-4 text-neutral-600">Belum ada metode pembayaran aktif. Hubungi owner.</p>;
}

// Render
return (
  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
    {filteredMethods.map((m) => {
      const Icon = (LucideIcons as any)[m.iconName] ?? LucideIcons.CreditCard;
      const isSelected = selectedMethod?.code === m.code;
      return (
        <button
          key={m.code}
          type="button"
          className={`flex h-16 items-center justify-center gap-2 rounded-lg border-2 ${isSelected ? 'border-primary-600' : 'border-neutral-200'}`}
          style={isSelected ? { backgroundColor: m.colorHex + '20', borderColor: m.colorHex } : {}}
          onClick={() => setSelectedMethod(m)}
        >
          <Icon size={20} style={{ color: m.colorHex }} />
          <span>{m.label}</span>
        </button>
      );
    })}
  </div>
);
```

- [ ] **Step 4: Replace bank picker ComboboxFree → Combobox**

Cari section bank picker (line 690-700 area). Replace:

```typescript
// BEFORE: ComboboxFree dengan free-form input
// AFTER: Combobox dengan list tertutup
import { Combobox } from './ui/combobox';

{selectedMethod?.requiresBank && (
  <div>
    <label className="text-body-sm font-medium">Bank</label>
    <Combobox
      value={selectedBank}
      onChange={setSelectedBank}
      options={selectedMethod.banks
        .filter((b) => b.isActive)
        .map((b) => ({ value: b.name, label: b.name }))}
      placeholder="Pilih bank..."
    />
  </div>
)}
```

- [ ] **Step 5: Submit logic**

Saat submit payment, kirim `method: selectedMethod.code` + `bank: selectedBank` (atau null kalau !requiresBank). Backend akan validasi runtime.

- [ ] **Step 6: tsc + build**

```bash
cd frontend
npx tsc --noEmit
npm run build
```

Expected: 0 errors, build success.

- [ ] **Step 7: Manual e2e**

Login Jason (kasir) → buka POSPage → tambah menu ke cart → klik Bayar → PaymentModal muncul:
- Pilih EDC → bank dropdown muncul dengan BCA/Mandiri/BNI/BRI (no input bebas)
- Coba submit EDC tanpa pilih bank → button disabled (validasi UI) atau error setelah submit
- Pilih BCA → submit → success
- Coba pilih ShopeePay (kalau sebelumnya owner add) → bank Permata muncul → submit success
- Untuk takeaway: GoFood/GrabFood muncul, dineIn: tidak

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/PaymentModal.tsx
git commit -m "refactor(PaymentModal): dinamis dari /payment-methods API

- Drop hardcoded PAYMENT_METHODS + bankOptions[BCA,Mandiri,BNI,BRI]
- Drop localStorage pos.recent-banks
- Replace ComboboxFree → Combobox (closed list, no free input per Decision #4)
- Filter dinamis: isActive + allowDineIn/Takeaway
- Icon resolve dinamis dari iconName + color dari colorHex
- Empty state kalau 0 method active"
```

---

## Phase 13: Adapt SettlementPage

### Task 13.1: SettlementPage dinamis

**Files:**
- Modify: `frontend/src/pages/SettlementPage.tsx`

- [ ] **Step 1: Adapt system totals row**

Cari section yang render preview totals 6 fixed bucket (sekitar line 274-292). Ganti jadi:

```tsx
{preview.system.length === 0 ? (
  <p>Belum ada transaksi paid di shift ini.</p>
) : (
  <ul className="space-y-1">
    {preview.system.map((s) => (
      <li key={s.paymentMethodCode} className="flex justify-between text-body-sm">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: s.colorHex }} />
          {s.methodLabel}
        </span>
        <span className="tabular-nums">{formatCurrency(s.total)}</span>
      </li>
    ))}
  </ul>
)}
```

- [ ] **Step 2: Adapt blind count form (dinamis input per method)**

Cari form dengan 6 input hardcoded (countedCash, countedEdc, dll). Ganti:

```tsx
const [counts, setCounts] = useState<Record<string, number>>({});
const [countsInitialized, setCountsInitialized] = useState(false);

// Initialize counts dari methods yang ada - sekali saat preview pertama datang
useEffect(() => {
  if (preview && !countsInitialized) {
    const initial: Record<string, number> = {};
    for (const s of preview.system) initial[s.paymentMethodCode] = 0;
    setCounts(initial);
    setCountsInitialized(true);
  }
}, [preview, countsInitialized]);

// Render dinamis
{preview.system.map((s) => (
  <label key={s.paymentMethodCode} className="block">
    <span className="text-body-sm">{s.methodLabel} (system: {formatCurrency(s.total)})</span>
    <input
      type="number"
      value={counts[s.paymentMethodCode] ?? 0}
      onChange={(e) => setCounts((c) => ({ ...c, [s.paymentMethodCode]: Number(e.target.value) }))}
      className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
    />
  </label>
))}

// Submit
const handleSubmit = () => {
  submitMutation.mutate({ shiftId, counts, note });
};
```

- [ ] **Step 3: Adapt detail view (SettlementDetailView)**

Iterate `methodCounts` array:

```tsx
{settlement.methodCounts.map((mc) => (
  <li key={mc.paymentMethodCode} className="flex justify-between">
    <span className="flex items-center gap-2">
      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: mc.colorHex }} />
      {mc.methodLabel}
    </span>
    <span>System: {mc.system} · Counted: {mc.counted} · Var: {mc.variance > 0 ? '+' : ''}{mc.variance}</span>
  </li>
))}
```

- [ ] **Step 4: tsc + build**

```bash
cd frontend && npx tsc --noEmit && npm run build
```

Expected: 0 errors.

- [ ] **Step 5: Manual e2e settlement flow**

Login Bryant (kasir) → buka shift malam → submit beberapa paid transactions (EDC, cash, QRIS, ShopeePay kalau ada) → SettlementPage:
- Preview muncul dengan list dinamis (mungkin 3-5 method tergantung transactions)
- Form blind count dinamis muncul (1 input per method)
- Submit → detail view tampil dengan variance per method
- Owner review → status updated

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/SettlementPage.tsx
git commit -m "refactor(SettlementPage): dinamis system + blind count form + detail view

- Preview totals: iterate preview.system array (bukan 6 field hardcoded)
- Blind count form: dinamis input per method (state: Record<string, number>)
- Detail view: iterate methodCounts array dengan variance per row
- Mendukung method custom (mis. ShopeePay) muncul di form Tutup Kasir"
```

---

## Phase 14: Adapt OwnerDashboard

### Task 14.1: OwnerDashboard dinamis byMethod

**Files:**
- Modify: `frontend/src/pages/OwnerDashboard.tsx`

- [ ] **Step 1: Drop hardcoded METHOD_COLOR + METHOD_LABEL**

Buka `frontend/src/pages/OwnerDashboard.tsx`. Hapus const `METHOD_COLOR` + `METHOD_LABEL` (sekitar line 42-58).

- [ ] **Step 2: Adapt revenue chart bar count**

Cari Recharts BarChart yang render `byMethod`. Sekarang `byMethod` array. Ganti:

```tsx
<BarChart data={revenue.byMethod} layout="vertical">
  <XAxis type="number" />
  <YAxis type="category" dataKey="methodLabel" />
  <Tooltip formatter={(v: number) => formatCurrency(v)} />
  <Bar dataKey="total" name="Pendapatan">
    {revenue.byMethod.map((entry) => (
      <Cell key={entry.paymentMethodCode} fill={entry.colorHex} />
    ))}
  </Bar>
</BarChart>
```

- [ ] **Step 3: Tabel "Pendapatan per Metode" (kalau ada)**

Sama pattern: iterate array dengan colorHex per row.

- [ ] **Step 4: tsc + build**

```bash
cd frontend && npx tsc --noEmit && npm run build
```

Expected: 0 errors.

- [ ] **Step 5: Manual e2e**

Login Owner → OwnerDashboard:
- Verify revenue chart bars dinamis (jumlah bar = jumlah method dengan revenue > 0)
- Verify ShopeePay (kalau ada) muncul dengan colorHex pilihan owner
- Bank breakdown card tetap muncul (logic tidak berubah)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/OwnerDashboard.tsx
git commit -m "refactor(OwnerDashboard): dinamis bar chart + colors dari payment_methods config

- Drop hardcoded METHOD_COLOR + METHOD_LABEL
- BarChart Cell.fill pakai entry.colorHex per method
- Method custom (mis. ShopeePay) muncul dengan warna pilihan owner"
```

---

## Phase 15: Full E2E Verification + Cleanup

### Task 15.1: Backend verification

**Files:** N/A

- [ ] **Step 1: Reset + re-seed**

```bash
cd backend && npx prisma migrate reset --force
```

Expected: 6 methods + 4 banks + 8 junctions ter-seed.

- [ ] **Step 2: tsc + lint**

```bash
npx tsc --noEmit
# Kalau ada ESLint config:
npm run lint || echo "(no lint script or already clean)"
```

Expected: 0 errors.

- [ ] **Step 3: Run all smoke scripts**

```bash
# Start dev server di terminal lain
for s in backend/scripts/smoke-*.sh; do
  echo "=== $s ==="
  bash "$s" 2>&1 | tail -5
done
```

Expected: semua pass atau hanya minor warnings.

### Task 15.2: Frontend verification

**Files:** N/A

- [ ] **Step 1: tsc + build + lint**

```bash
cd frontend
npx tsc -b
npm run build
npm run lint
```

Expected: 0 errors, build success, lint clean.

- [ ] **Step 2: Manual e2e end-to-end happy path**

Scenario lengkap:
1. **Owner login** → buka `/payment-methods` → verify 6 default methods + 4 banks
2. **Owner add bank "OVO"** → verify muncul di banks tab
3. **Owner add method "ShopeePay"** dengan color #ee4d2d + icon Smartphone + requiresBank=true + assign OVO → verify muncul di methods tab
4. **Owner toggle off "GoFood"** → verify isActive=false
5. **Kasir Jason login** → buka shift malam → ke POSPage → tambah menu → Bayar:
   - PaymentModal muncul dengan list: cash, EDC, QRIS, ShopeePay, transfer (GoFood + Grab hidden untuk dineIn, GoFood juga inactive)
   - Pilih ShopeePay → bank "OVO" muncul → submit → success
   - Coba EDC tanpa bank → error
6. **Bryant login kasir** → tutup shift → SettlementPage:
   - Preview menunjukkan list dinamis (cash + ShopeePay kalau ada)
   - Form blind count dinamis
   - Submit → variance per method tampil
7. **Owner login** → OwnerDashboard:
   - Bar chart menunjukkan ShopeePay dengan warna #ee4d2d
   - Bank breakdown menunjukkan OVO

### Task 15.3: Cleanup + CLAUDE.md update

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update status table di CLAUDE.md**

Buka root `CLAUDE.md`. Cari section "Status REV..." (sekitar line 19). Tambah baris baru:

```markdown
| **REV 2.6 Payment Methods + Banks Owner-Configurable (sesi 2026-05-27)** | ✅ DONE. Drop enum PaymentMethod jadi master table extensible. Master Bank + junction many-to-many. Settlement schema full dynamic via settlement_method_counts child table. Owner page `/payment-methods` 2-tab CRUD. Migration script 3-step: seed + backfill banks + backfill settlement_counts. Backend smoke 23/23 PASS, frontend tsc 0 errors, vite build SUCCESS. Spec: docs/superpowers/specs/2026-05-27-payment-methods-banks-redesign-design.md. Plan: docs/superpowers/plans/2026-05-27-payment-methods-banks-redesign.md. |
```

- [ ] **Step 2: Verify CLAUDE.md tidak break**

Read first 50 lines:
```bash
head -100 CLAUDE.md
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude-md): update status table REV 2.6 - payment methods + banks DONE"
```

### Task 15.4: Final push + branch finishing

**Files:** N/A (git ops)

- [ ] **Step 1: Review semua commits di branch**

```bash
git log --oneline feat/payment-methods-redesign
```

Expected: ~30+ commits in logical order.

- [ ] **Step 2: Push branch**

```bash
git push -u origin feat/payment-methods-redesign
```

- [ ] **Step 3: Use `superpowers:finishing-a-development-branch` skill**

Per CLAUDE.md mandate, invoke skill ini untuk decide merge/PR strategy. User akan decide: merge to feat/backend-express? Open PR? Cherry-pick selectively?

---

## Acceptance Criteria (Final)

- [ ] Owner bisa buka `/payment-methods`, lihat 6 method seeded + 4 banks default
- [ ] Owner bisa add method baru "ShopeePay" + assign bank baru "OVO" → muncul di PaymentModal kasir
- [ ] Owner bisa toggle off "GoFood" → hilang dari PaymentModal next refresh
- [ ] Kasir submit EDC tanpa bank → 400 "Bank wajib diisi"
- [ ] Kasir submit EDC dengan bank "OVO" (tidak assigned ke EDC) → 400 "Bank OVO tidak tersedia untuk method EDC"
- [ ] Settlement Tutup Kasir form input dinamis ikut active method (ShopeePay muncul)
- [ ] Owner dashboard revenue chart pakai warna pilihan owner per method
- [ ] Backend smoke 23/23 PASS
- [ ] `tsc --noEmit` 0 errors backend + frontend
- [ ] `vite build` success
- [ ] CLAUDE.md updated dengan status REV 2.6

---

## References

- Spec: [`docs/superpowers/specs/2026-05-27-payment-methods-banks-redesign-design.md`](../specs/2026-05-27-payment-methods-banks-redesign-design.md)
- Pattern reference: `backend/src/modules/bills/`, `frontend/src/pages/MenuPage.tsx`, `frontend/src/pages/BillsPage.tsx`
- Smoke test pattern: `backend/scripts/smoke-phase-8.sh`
