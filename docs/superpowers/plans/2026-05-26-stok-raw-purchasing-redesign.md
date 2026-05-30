# Raw Materials & Purchasing Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor raw materials + purchasing dengan tabel `units` master (label + opname_mode) + bifurcate behavior exact vs scale 0-5, plus tombol "Quick Add Bumbu Dasar" di form purchase. Spec: [`docs/superpowers/specs/2026-05-26-stok-raw-purchasing-redesign-design.md`](../specs/2026-05-26-stok-raw-purchasing-redesign-design.md).

**Architecture:** Tabel `units` baru dengan kolom `opname_mode` enum {exact, scale_0_5}. `raw_materials.unit` varchar diganti `unit_id` FK ke `units`. `purchase_items.qty` + `unit_price` jadi nullable (untuk scale items), tambah kolom `note`. Behavior bifurcates di backend service + frontend UI berdasarkan `unit.opname_mode`. Stok porsi + reminder + permission matrix REV 2.3 tidak berubah.

**Tech Stack:** Backend Express 4 + TypeScript + Prisma 5 + MySQL 8 + Zod. Frontend React 18 + Vite 5 + Tailwind 3 + Zustand + React Query. Smoke test via shell script + curl.

**Established conventions to follow:**
- Service pattern: `*.schema.ts` (Zod) + `*.service.ts` + `*.controller.ts` + `*.routes.ts`
- View shape mappers (`toXView` functions) untuk response transformation
- `Prisma.Decimal` untuk arithmetic uang/qty
- `prisma.$transaction` untuk atomic ops
- Error: `throw new AppError(message, statusCode)` + `notFound('Resource')`
- Snake_case di DB via `@map`, camelCase di TS
- Smoke test pattern: `backend/scripts/smoke-phase-X.sh` dengan curl + jq + `assert_status_code` helper
- Frontend service: axios instance via `services/api.ts`, return `data` (unwrap envelope `{success, message, data}`)
- Design primitives di `frontend/src/design-system/primitives/` - wajib pakai existing Dialog, FormField, Select, dll
- Permission: middleware `requireRole('owner')` di route layer

**Migration strategy:** Dev mode pakai `prisma db push --accept-data-loss` lalu re-seed. Tidak pakai folder migrations (per CLAUDE.md baseline). Data raw_materials existing akan re-seed dengan FK units.

---

## File Structure

### Backend (10 files)

**Create:**
- `backend/src/modules/units/units.schema.ts` - Zod validators
- `backend/src/modules/units/units.service.ts` - CRUD logic + pre-seed check
- `backend/src/modules/units/units.controller.ts` - handler
- `backend/src/modules/units/units.routes.ts` - router + permission
- `backend/scripts/smoke-units-rawmat-purchases.sh` - smoke test 1 file untuk 3 phase

**Modify:**
- `backend/prisma/schema.prisma` - add `Unit` model + modify `RawMaterial` (unit_id FK) + modify `PurchaseItem` (nullable qty/unit_price + note)
- `backend/prisma/seed.ts` - seed pre-defined units + reseed raw materials dengan unit_id
- `backend/src/app.ts` - register `unitsRouter`
- `backend/src/modules/stocks/raw-materials.service.ts` - integrate units + edit unit handling
- `backend/src/modules/stocks/raw-materials.schema.ts` - replace `unit` validator dengan `unitId` + validate min_stock range untuk scale items
- `backend/src/modules/purchases/purchases.service.ts` - bifurcate by `unit.opname_mode`
- `backend/src/modules/purchases/purchases.schema.ts` - qty/unitPrice nullable + note

### Frontend (8 files)

**Create:**
- `frontend/src/services/unitService.ts` - CRUD units API client
- `frontend/src/components/UnitDropdown.tsx` - dropdown + "Tambah satuan baru" modal
- `frontend/src/components/QuickAddBumbuDasar.tsx` - spawn preset rows di form purchase

**Modify:**
- `frontend/src/types/index.ts` - add `Unit` + `OpnameMode` types, modify `RawMaterial` (replace unit string dengan populated unit object)
- `frontend/src/services/rawMaterialsService.ts` - adapt untuk unit_id
- `frontend/src/services/purchaseService.ts` - adapt nullable qty/unitPrice + note
- `frontend/src/components/stock/RawMaterialsTab.tsx` - UnitDropdown integration + edit unit prompt modal + opname UI bifurcation exact vs scale
- `frontend/src/pages/PurchasesPage.tsx` - QuickAddBumbuDasar integration + nullable qty form

---

## Task 1: Schema migration - add Unit model + modify RawMaterial + PurchaseItem

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add `OpnameMode` enum + `Unit` model**

Setelah enum `BillCategory` di `schema.prisma`, tambah:

```prisma
/// REV 2.5 (raw materials redesign): Mode opname per satuan.
/// - exact: stock_qty integer/decimal dalam unit, purchase auto stock_qty += qty
/// - scale_0_5: stock_qty 0..5 (subjective fullness), purchase HANYA log expense
enum OpnameMode {
  exact
  scale_0_5
}

/// REV 2.5 BARU: Master satuan untuk raw materials. Dropdown source di form
/// add/edit raw material. opname_mode menentukan UI + behavior:
/// - exact mode: opname input angka, purchase auto stock_qty += qty
/// - scale_0_5 mode: opname segmented 0..5, purchase HANYA log expense
///
/// Pre-seeded di seed.ts: kg, gram, liter, butir, balok, karung, ikat, batang,
/// pcs (semua exact) + "skala 0-5" (scale_0_5). Owner dapat add unit baru
/// via dropdown modal di form raw material.
model Unit {
  id         Int        @id @default(autoincrement())
  label      String     @unique @db.VarChar(50)
  opnameMode OpnameMode @map("opname_mode")
  createdAt  DateTime   @default(now()) @map("created_at")
  updatedAt  DateTime   @updatedAt @map("updated_at")

  rawMaterials RawMaterial[]

  @@map("units")
}
```

- [ ] **Step 2: Modify `RawMaterial` model - replace `unit` varchar dengan `unitId` FK**

Cari model `RawMaterial`, ganti field `unit`:

```prisma
// SEBELUM:
unit          String              @db.VarChar(20)

// SESUDAH:
unitId        Int                 @map("unit_id")
unit          Unit                @relation(fields: [unitId], references: [id])
```

Pastikan field-field lain (stockQty, minStock, dll) tetap.

- [ ] **Step 3: Modify `PurchaseItem` model - qty + unit_price nullable + add note**

Cari model `PurchaseItem`, ubah field:

```prisma
// SEBELUM:
qty           Decimal   @db.Decimal(10, 2)
unitPrice     Decimal   @map("unit_price") @db.Decimal(10, 2)
subtotal      Decimal   @db.Decimal(12, 2)

// SESUDAH:
qty           Decimal?  @db.Decimal(10, 2)
unitPrice     Decimal?  @map("unit_price") @db.Decimal(10, 2)
subtotal      Decimal   @db.Decimal(12, 2)
note          String?   @db.VarChar(255)
```

`expiredDate` tetap. Tambah `note` kalau belum ada.

- [ ] **Step 4: Update header comment schema.prisma**

Di komentar baris 1-12 ganti versi & entitas count:

```prisma
// Skema basis data Sistem POS Restoran Ayam Bakar Banjar Monosuko (REV 2.5).
// REV 2.5 raw-materials-redesign: tambah Unit master + opname_mode bifurcation.
// Lihat docs/superpowers/specs/2026-05-26-stok-raw-purchasing-redesign-design.md
//
// 16 entitas (+ Unit baru), 22 relasi.
```

- [ ] **Step 5: Apply schema via db push**

Run:
```bash
cd backend && npx prisma db push --accept-data-loss
```

Expected: "Your database is now in sync with your Prisma schema." Tidak ada error.

Kalau error karena FK conflict, bisa pakai `--force-reset` (CLAUDE.md baseline pattern):
```bash
cd backend && npx prisma db push --force-reset
```

- [ ] **Step 6: Verify schema applied**

```bash
cd backend && npx prisma studio
```
Atau cek via:
```bash
cd backend && node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();(async()=>{console.log(Object.keys(p));await p.\$disconnect();})()"
```

Pastikan `unit` muncul di output (sebagai delegate `p.unit`).

- [ ] **Step 7: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(schema): add Unit master + opname_mode bifurcation untuk raw materials

- Tambah model Unit (label + opnameMode enum exact/scale_0_5)
- RawMaterial.unit varchar diganti unitId FK ke Unit
- PurchaseItem.qty + unit_price jadi nullable + tambah note untuk scale items
- Lihat spec docs/superpowers/specs/2026-05-26-stok-raw-purchasing-redesign-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Seed pre-defined units + reseed raw materials dengan unit_id

**Files:**
- Modify: `backend/prisma/seed.ts`

- [ ] **Step 1: Read existing seed.ts untuk lihat struktur**

```bash
# Baca seed.ts (head section + raw materials section)
```

Cari blok yang seed raw materials (kemungkinan `seedRawMaterials()` atau inline `await prisma.rawMaterial.createMany(...)`).

- [ ] **Step 2: Tambah seed pre-defined units sebelum raw materials**

Di `seed.ts`, sebelum block raw materials, tambah:

```typescript
// REV 2.5: Pre-defined units. Owner bisa add custom unit via UnitDropdown.
const unitSeeds: { label: string; opnameMode: 'exact' | 'scale_0_5' }[] = [
  { label: 'kg', opnameMode: 'exact' },
  { label: 'gram', opnameMode: 'exact' },
  { label: 'liter', opnameMode: 'exact' },
  { label: 'butir', opnameMode: 'exact' },
  { label: 'balok', opnameMode: 'exact' },
  { label: 'karung', opnameMode: 'exact' },
  { label: 'ikat', opnameMode: 'exact' },
  { label: 'batang', opnameMode: 'exact' },
  { label: 'pcs', opnameMode: 'exact' },
  { label: 'skala 0-5', opnameMode: 'scale_0_5' },
];

const unitByLabel = new Map<string, number>();
for (const u of unitSeeds) {
  const created = await prisma.unit.upsert({
    where: { label: u.label },
    update: {},
    create: u,
  });
  unitByLabel.set(created.label, created.id);
}
console.log(`✓ Seeded ${unitSeeds.length} units`);
```

- [ ] **Step 3: Adapt raw materials seed untuk pakai unitId**

Cari raw material seed list. Ubah dari `unit: 'ikat'` ke `unitId: unitByLabel.get('ikat')!`.

Contoh transformasi:
```typescript
// SEBELUM:
{ name: 'Kangkung', unit: 'ikat', category: 'bahanSegar', isTracked: true, ... }

// SESUDAH:
{ name: 'Kangkung', unitId: unitByLabel.get('ikat')!, category: 'bahanSegar', isTracked: true, ... }
```

Untuk beras yang sebelumnya `unit: 'skala'`, map ke `unitByLabel.get('skala 0-5')!`.

Lakukan untuk semua raw materials. Pastikan setiap unit di-seed dulu sebelum dipakai.

- [ ] **Step 4: Run seed**

```bash
cd backend && npm run db:seed
```

Expected output mengandung "✓ Seeded 10 units" dan tidak ada error FK constraint.

- [ ] **Step 5: Verify via Prisma client**

```bash
cd backend && node -e "
const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const units = await p.unit.findMany();
  console.log('Units:', units.length);
  const beras = await p.rawMaterial.findFirst({ where: { name: 'Beras' }, include: { unit: true } });
  console.log('Beras:', beras?.name, 'unit:', beras?.unit.label, 'mode:', beras?.unit.opnameMode);
  await p.\$disconnect();
})();
"
```

Expected: "Units: 10" + "Beras: Beras unit: skala 0-5 mode: scale_0_5"

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "feat(seed): pre-defined units + reseed raw materials dengan unit_id FK

- Seed 9 exact units (kg, gram, liter, butir, balok, karung, ikat, batang, pcs)
- Seed 1 scale unit (skala 0-5) untuk beras
- Raw materials existing dimigrasi ke unitId FK

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Units module - Zod schema + service

**Files:**
- Create: `backend/src/modules/units/units.schema.ts`
- Create: `backend/src/modules/units/units.service.ts`

- [ ] **Step 1: Write `units.schema.ts`**

```typescript
// Zod validators untuk units endpoints (REV 2.5).
import { z } from 'zod';

export const opnameModeEnum = z.enum(['exact', 'scale_0_5']);

export const createUnitSchema = z.object({
  label: z.string().trim().min(1).max(50),
  opnameMode: opnameModeEnum,
});

export const updateUnitSchema = z.object({
  label: z.string().trim().min(1).max(50).optional(),
  opnameMode: opnameModeEnum.optional(),
});

export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
```

- [ ] **Step 2: Write `units.service.ts`**

```typescript
// Service modul units. CRUD master satuan untuk raw materials.
// Pre-seeded di seed.ts. Owner dapat add/edit/delete unit baru.
// Delete diblock kalau ada raw_materials yang merefer (FK protection, pesan ramah).

import { OpnameMode, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError, notFound } from '../../utils/errors';
import type { CreateUnitInput, UpdateUnitInput } from './units.schema';

export interface UnitView {
  id: number;
  label: string;
  opnameMode: OpnameMode;
  createdAt: string;
  updatedAt: string;
}

function toUnitView(u: Prisma.UnitGetPayload<{}>): UnitView {
  return {
    id: u.id,
    label: u.label,
    opnameMode: u.opnameMode,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

export async function listUnits(): Promise<UnitView[]> {
  const units = await prisma.unit.findMany({
    orderBy: [{ opnameMode: 'asc' }, { label: 'asc' }],
  });
  return units.map(toUnitView);
}

export async function getUnitById(id: number): Promise<UnitView> {
  const u = await prisma.unit.findUnique({ where: { id } });
  if (!u) throw notFound('Unit');
  return toUnitView(u);
}

export async function createUnit(input: CreateUnitInput): Promise<UnitView> {
  const existing = await prisma.unit.findUnique({ where: { label: input.label } });
  if (existing) {
    throw new AppError(`Unit "${input.label}" sudah ada`, 409);
  }
  const created = await prisma.unit.create({
    data: { label: input.label, opnameMode: input.opnameMode },
  });
  return toUnitView(created);
}

export async function updateUnit(id: number, input: UpdateUnitInput): Promise<UnitView> {
  const existing = await prisma.unit.findUnique({ where: { id } });
  if (!existing) throw notFound('Unit');

  if (input.label && input.label !== existing.label) {
    const dup = await prisma.unit.findUnique({ where: { label: input.label } });
    if (dup) throw new AppError(`Unit "${input.label}" sudah ada`, 409);
  }

  const data: Prisma.UnitUpdateInput = {};
  if (input.label !== undefined) data.label = input.label;
  if (input.opnameMode !== undefined) data.opnameMode = input.opnameMode;

  const updated = await prisma.unit.update({ where: { id }, data });
  return toUnitView(updated);
}

export async function deleteUnit(id: number): Promise<{ id: number; label: string }> {
  const existing = await prisma.unit.findUnique({ where: { id } });
  if (!existing) throw notFound('Unit');

  const rmCount = await prisma.rawMaterial.count({ where: { unitId: id } });
  if (rmCount > 0) {
    throw new AppError(
      `Unit "${existing.label}" tidak bisa dihapus - dipakai ${rmCount} raw material. Ganti unit di raw material dulu atau hapus raw material yang merefer.`,
      409,
    );
  }
  await prisma.unit.delete({ where: { id } });
  return { id: existing.id, label: existing.label };
}
```

- [ ] **Step 3: Compile check**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors. Kalau ada error di file lain (raw-materials.service.ts) karena unit→unitId change, itu OK - akan di-fix di Task 5.

Untuk skip non-task files saat dev, bisa skip tsc check sekarang dan lanjut.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/units/
git commit -m "feat(units): backend service + Zod schema CRUD units

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Units module - controller + routes + register

**Files:**
- Create: `backend/src/modules/units/units.controller.ts`
- Create: `backend/src/modules/units/units.routes.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Read existing controller pattern (mis. vendors.controller.ts)**

```bash
# Baca backend/src/modules/vendors/vendors.controller.ts untuk pattern
```

- [ ] **Step 2: Write `units.controller.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { createUnitSchema, updateUnitSchema } from './units.schema';
import * as unitsService from './units.service';

export async function listUnitsHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const units = await unitsService.listUnits();
    sendSuccess(res, { units });
  } catch (e) { next(e); }
}

export async function getUnitHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const unit = await unitsService.getUnitById(id);
    sendSuccess(res, { unit });
  } catch (e) { next(e); }
}

export async function createUnitHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createUnitSchema.parse(req.body);
    const unit = await unitsService.createUnit(input);
    sendSuccess(res, { unit }, 'Unit dibuat', 201);
  } catch (e) { next(e); }
}

export async function updateUnitHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const input = updateUnitSchema.parse(req.body);
    const unit = await unitsService.updateUnit(id, input);
    sendSuccess(res, { unit }, 'Unit diperbarui');
  } catch (e) { next(e); }
}

export async function deleteUnitHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const result = await unitsService.deleteUnit(id);
    sendSuccess(res, result, 'Unit dihapus');
  } catch (e) { next(e); }
}
```

- [ ] **Step 3: Write `units.routes.ts`**

```typescript
// Routes units. Permission per matrix REV 2.3:
// - GET (list, byId): semua role authenticated (dropdown source di frontend)
// - POST/PUT/DELETE: owner only (master CRUD)
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import {
  listUnitsHandler,
  getUnitHandler,
  createUnitHandler,
  updateUnitHandler,
  deleteUnitHandler,
} from './units.controller';

export const unitsRouter = Router();

unitsRouter.use(authenticate);

unitsRouter.get('/', listUnitsHandler);
unitsRouter.get('/:id', getUnitHandler);
unitsRouter.post('/', requireRole('owner'), createUnitHandler);
unitsRouter.put('/:id', requireRole('owner'), updateUnitHandler);
unitsRouter.delete('/:id', requireRole('owner'), deleteUnitHandler);
```

- [ ] **Step 4: Register di `app.ts`**

Cari blok router registration (mis. `app.use('/api/vendors', vendorsRouter)`). Tambah satu line:

```typescript
import { unitsRouter } from './modules/units/units.routes';
// ...
app.use('/api/units', unitsRouter);
```

- [ ] **Step 5: Compile check + restart dev server**

```bash
cd backend && npx tsc --noEmit | grep -v "src/modules/stocks\|src/modules/purchases" || true
```

(Ignore errors di stocks/purchases - itu task 5+).

Start dev server:
```bash
npm run dev:backend
```

- [ ] **Step 6: Quick test endpoint exists**

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"name":"Owner","pin":"123456"}' | jq -r '.data.token')
curl -s http://localhost:8000/api/units -H "Authorization: Bearer $TOKEN" | jq '.data.units | length'
```

Expected: `10` (pre-seeded units).

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/units/units.controller.ts backend/src/modules/units/units.routes.ts backend/src/app.ts
git commit -m "feat(units): controller + routes + register di app.ts

Permission: GET semua role authenticated (dropdown), POST/PUT/DELETE owner only.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Refactor raw-materials.service untuk unit_id + edit unit handling

**Files:**
- Modify: `backend/src/modules/stocks/raw-materials.service.ts`

- [ ] **Step 1: Update `RawMaterialView` interface - replace `unit: string` dengan populated object**

```typescript
export interface RawMaterialView {
  id: number;
  name: string;
  unitId: number;
  unit: {
    id: number;
    label: string;
    opnameMode: 'exact' | 'scale_0_5';
  };
  category: RawMaterialCategory;
  isTracked: boolean;
  stockQty: number;
  minStock: number | null;
  unitPrice: number | null;
  freshnessDays: number | null;
  lastBuyDate: string | null;
  isLowStock: boolean;
  isNearExpiry: boolean;
  daysUntilExpiry: number | null;
  suggestedAction: string | null;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Update `RawMaterialRow` type + mapper**

```typescript
type RawMaterialRow = Prisma.RawMaterialGetPayload<{ include: { unit: true } }>;

function toRawMaterialView(rm: RawMaterialRow): RawMaterialView {
  const stockQty = rm.stockQty.toNumber();
  const minStock = rm.minStock;
  const lastBuyDate = rm.lastBuyDate;
  const freshnessDays = rm.freshnessDays;

  const isLowStock = rm.isTracked && minStock !== null && stockQty <= minStock;

  let isNearExpiry = false;
  let daysUntilExpiry: number | null = null;
  if (rm.isTracked && freshnessDays !== null && lastBuyDate !== null) {
    const daysSinceBuy = daysBetween(lastBuyDate, new Date());
    daysUntilExpiry = freshnessDays - daysSinceBuy;
    isNearExpiry = daysUntilExpiry <= 3;
  }

  let suggestedAction: string | null = null;
  if (isLowStock) suggestedAction = 'Perlu restock';
  else if (isNearExpiry && daysUntilExpiry !== null && daysUntilExpiry <= 0) {
    suggestedAction = 'Sudah lewat freshness, beli baru';
  } else if (isNearExpiry) {
    suggestedAction = `Mendekati basi (${daysUntilExpiry} hari lagi), beli baru`;
  }

  return {
    id: rm.id,
    name: rm.name,
    unitId: rm.unitId,
    unit: {
      id: rm.unit.id,
      label: rm.unit.label,
      opnameMode: rm.unit.opnameMode,
    },
    category: rm.category,
    isTracked: rm.isTracked,
    stockQty,
    minStock,
    unitPrice: rm.unitPrice ? rm.unitPrice.toNumber() : null,
    freshnessDays,
    lastBuyDate: lastBuyDate ? lastBuyDate.toISOString().substring(0, 10) : null,
    isLowStock,
    isNearExpiry,
    daysUntilExpiry,
    suggestedAction,
    createdAt: rm.createdAt.toISOString(),
    updatedAt: rm.updatedAt.toISOString(),
  };
}
```

- [ ] **Step 3: Update all queries to include unit relation**

`listRawMaterials`:
```typescript
const rms = await prisma.rawMaterial.findMany({
  where,
  include: { unit: true },
  orderBy: [{ category: 'asc' }, { name: 'asc' }],
});
```

`getRawMaterialDetail`:
```typescript
const rm = await prisma.rawMaterial.findUnique({
  where: { id },
  include: { unit: true },
});
```

`opname` final fetch (di dalam transaction loop):
```typescript
const updated = await tx.rawMaterial.findUniqueOrThrow({
  where: { id: item.rawMaterialId },
  include: { unit: true },
});
```

`createRawMaterial` return:
```typescript
const created = await prisma.rawMaterial.create({
  data: { /* ... */ },
  include: { unit: true },
});
```

`updateRawMaterial` (handled di Step 4 di bawah).

`markHabis` return:
```typescript
const u = await tx.rawMaterial.update({
  where: { id },
  data: { stockQty: new Prisma.Decimal(0) },
  include: { unit: true },
});
// ... lalu return toRawMaterialView(u)
```

- [ ] **Step 4: Refactor `createRawMaterial` - pakai unitId**

```typescript
export async function createRawMaterial(input: CreateRawMaterialInput): Promise<RawMaterialView> {
  const existing = await prisma.rawMaterial.findFirst({ where: { name: input.name } });
  if (existing) {
    throw new AppError(`Raw material "${input.name}" sudah ada`, 409);
  }

  // Validasi unit exists + ambil opname_mode untuk validate min_stock range
  const unit = await prisma.unit.findUnique({ where: { id: input.unitId } });
  if (!unit) throw new AppError(`Unit id=${input.unitId} tidak ditemukan`, 400);

  // Validate min_stock range untuk scale items
  if (input.minStock !== null && input.minStock !== undefined) {
    if (unit.opnameMode === 'scale_0_5' && (input.minStock < 0 || input.minStock > 5)) {
      throw new AppError('min_stock untuk satuan skala harus 0..5', 422);
    }
  }

  const created = await prisma.rawMaterial.create({
    data: {
      name: input.name,
      unitId: input.unitId,
      category: input.category,
      isTracked: input.isTracked,
      stockQty: new Prisma.Decimal(input.stockQty),
      minStock: input.minStock ?? null,
      unitPrice: input.unitPrice !== null && input.unitPrice !== undefined
        ? new Prisma.Decimal(input.unitPrice)
        : null,
      freshnessDays: input.freshnessDays ?? null,
    },
    include: { unit: true },
  });
  return toRawMaterialView(created);
}
```

- [ ] **Step 5: Refactor `updateRawMaterial` dengan edit unit handling**

```typescript
export async function updateRawMaterial(
  id: number,
  userId: number,
  input: UpdateRawMaterialInput,
): Promise<RawMaterialView> {
  const existing = await prisma.rawMaterial.findUnique({
    where: { id },
    include: { unit: true },
  });
  if (!existing) throw notFound('RawMaterial');

  return prisma.$transaction(async (tx) => {
    const data: Prisma.RawMaterialUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.category !== undefined) data.category = input.category;
    if (input.isTracked !== undefined) data.isTracked = input.isTracked;
    if (input.minStock !== undefined) data.minStock = input.minStock;
    if (input.unitPrice !== undefined) {
      data.unitPrice = input.unitPrice === null ? null : new Prisma.Decimal(input.unitPrice);
    }
    if (input.freshnessDays !== undefined) data.freshnessDays = input.freshnessDays;

    // Unit change handling - kalau unitId berubah dan stock_qty > 0,
    // owner WAJIB pass newStockQty (atau null untuk reset 0).
    if (input.unitId !== undefined && input.unitId !== existing.unitId) {
      const newUnit = await tx.unit.findUnique({ where: { id: input.unitId } });
      if (!newUnit) throw new AppError(`Unit id=${input.unitId} tidak ditemukan`, 400);

      const currentStock = existing.stockQty.toNumber();
      if (currentStock > 0 && input.newStockQty === undefined) {
        throw new AppError(
          `Stok saat ini ${currentStock} ${existing.unit.label}. Wajib pass newStockQty untuk konversi ke ${newUnit.label} (atau null untuk reset 0).`,
          422,
        );
      }

      const targetStock = input.newStockQty ?? 0;
      if (newUnit.opnameMode === 'scale_0_5' && (targetStock < 0 || targetStock > 5)) {
        throw new AppError('newStockQty untuk satuan skala harus 0..5', 422);
      }

      data.unitId = input.unitId;
      data.stockQty = new Prisma.Decimal(targetStock);

      const delta = new Prisma.Decimal(targetStock).sub(existing.stockQty);
      if (!delta.isZero()) {
        await tx.rawMaterialMovement.create({
          data: {
            rawMaterialId: id,
            delta,
            reason: 'manualAdjust',
            note: `Unit changed: ${existing.unit.label} → ${newUnit.label}, stok ${currentStock} → ${targetStock}`,
            userId,
          },
        });
      }
    }

    // Re-validate min_stock kalau opname_mode unit (lama atau baru) = scale
    const effectiveUnitId = (data.unitId ?? existing.unitId) as number;
    const effectiveUnit = effectiveUnitId === existing.unitId
      ? existing.unit
      : await tx.unit.findUniqueOrThrow({ where: { id: effectiveUnitId } });
    if (data.minStock !== undefined && data.minStock !== null) {
      if (effectiveUnit.opnameMode === 'scale_0_5' && (data.minStock < 0 || data.minStock > 5)) {
        throw new AppError('min_stock untuk satuan skala harus 0..5', 422);
      }
    }

    const updated = await tx.rawMaterial.update({
      where: { id },
      data,
      include: { unit: true },
    });
    return toRawMaterialView(updated);
  });
}
```

- [ ] **Step 6: Update markHabis untuk include unit**

Sudah dicakup di Step 3 (markHabis return harus include unit). Pastikan toRawMaterialView call menerima row dengan unit relation.

- [ ] **Step 7: Compile check**

```bash
cd backend && npx tsc --noEmit
```

Expected: errors hanya di `purchases.service.ts` (yang akan di-fix Task 7). Errors di `raw-materials.service.ts` harus zero. Error di controller mungkin karena signature `updateRawMaterial(id, input)` jadi `(id, userId, input)` - fix call site di controller (Step 8 berikutnya, atau lakukan sekarang).

- [ ] **Step 8: Update `raw-materials.controller.ts` untuk pass userId ke updateRawMaterial**

Cari handler `updateRawMaterial` (atau `update`). Tambah passing `req.user.id` (atau `req.user!.id` per existing convention):

```typescript
// SEBELUM:
const updated = await rawMaterialsService.updateRawMaterial(id, input);

// SESUDAH:
const updated = await rawMaterialsService.updateRawMaterial(id, req.user!.id, input);
```

Compile check lagi:
```bash
cd backend && npx tsc --noEmit 2>&1 | grep -v "purchases" | head -20
```

Expected: hanya errors di purchases module.

- [ ] **Step 9: Commit**

```bash
git add backend/src/modules/stocks/raw-materials.service.ts backend/src/modules/stocks/raw-materials.controller.ts
git commit -m "refactor(raw-materials): integrate units FK + edit unit handling dengan audit

- View shape expose unit object (id+label+opnameMode) bukan string
- updateRawMaterial sekarang transactional: kalau unitId berubah, validate newStockQty dan log raw_material_movements
- min_stock validation per opname_mode (scale 0-5 wajib range 0..5)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Refactor raw-materials.schema (Zod) - unitId + newStockQty + min_stock validation

**Files:**
- Modify: `backend/src/modules/stocks/raw-materials.schema.ts`

- [ ] **Step 1: Read existing schema**

```bash
# Baca backend/src/modules/stocks/raw-materials.schema.ts
```

- [ ] **Step 2: Replace `unit: z.string()` dengan `unitId: z.number().int().positive()`**

Di `createRawMaterialSchema`:

```typescript
export const createRawMaterialSchema = z.object({
  name: z.string().trim().min(1).max(100),
  unitId: z.number().int().positive(), // BARU, ganti unit string
  category: z.enum(['bumbuDasar', 'bahanSegar', 'bahanPokok', 'bahanKering', 'lainnya']),
  isTracked: z.boolean(),
  stockQty: z.number().min(0),
  minStock: z.number().int().nullable().optional(),
  unitPrice: z.number().positive().nullable().optional(),
  freshnessDays: z.number().int().positive().nullable().optional(),
});
```

Di `updateRawMaterialSchema` tambah `unitId` + `newStockQty` optional:

```typescript
export const updateRawMaterialSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  unitId: z.number().int().positive().optional(),
  newStockQty: z.number().min(0).nullable().optional(), // dipakai saat unit berubah + stock > 0
  category: z.enum(['bumbuDasar', 'bahanSegar', 'bahanPokok', 'bahanKering', 'lainnya']).optional(),
  isTracked: z.boolean().optional(),
  minStock: z.number().int().nullable().optional(),
  unitPrice: z.number().positive().nullable().optional(),
  freshnessDays: z.number().int().positive().nullable().optional(),
});
```

Export inferred types:
```typescript
export type CreateRawMaterialInput = z.infer<typeof createRawMaterialSchema>;
export type UpdateRawMaterialInput = z.infer<typeof updateRawMaterialSchema>;
```

- [ ] **Step 3: Compile check**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep "raw-materials" | head -10
```

Expected: zero errors di raw-materials module.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/stocks/raw-materials.schema.ts
git commit -m "refactor(raw-materials): Zod schema unitId + newStockQty untuk edit unit handling

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Refactor purchases.service untuk bifurcate by unit.opname_mode

**Files:**
- Modify: `backend/src/modules/purchases/purchases.service.ts`

- [ ] **Step 1: Update view shape - qty + unitPrice nullable + note**

```typescript
export interface PurchaseItemView {
  id: number;
  rawMaterialId: number;
  rawMaterialName: string;
  rawMaterialUnit: string;
  rawMaterialOpnameMode: 'exact' | 'scale_0_5';
  isTracked: boolean;
  qty: number | null;
  unitPrice: number | null;
  subtotal: number;
  note: string | null;
  expiredDate: string | null;
  createdAt: string;
}
```

- [ ] **Step 2: Update `PurchaseWithRelations` type untuk include rawMaterial.unit**

```typescript
type PurchaseWithRelations = Prisma.PurchaseGetPayload<{
  include: {
    user: { select: { name: true } };
    vendor: { select: { name: true } };
    items: {
      include: {
        rawMaterial: {
          select: {
            name: true;
            isTracked: true;
            unit: { select: { label: true; opnameMode: true } };
          };
        };
      };
    };
  };
}>;
```

Update `purchaseInclude`:
```typescript
const purchaseInclude = {
  user: { select: { name: true } },
  vendor: { select: { name: true } },
  items: {
    include: {
      rawMaterial: {
        select: {
          name: true,
          isTracked: true,
          unit: { select: { label: true, opnameMode: true } },
        },
      },
    },
  },
} satisfies Prisma.PurchaseInclude;
```

Update mapper:
```typescript
function toPurchaseView(p: PurchaseWithRelations): PurchaseView {
  return {
    id: p.id,
    date: p.date.toISOString().substring(0, 10),
    userId: p.userId,
    userName: p.user.name,
    vendorId: p.vendorId,
    vendorName: p.vendor?.name ?? null,
    totalAmount: p.totalAmount.toNumber(),
    note: p.note,
    createdAt: p.createdAt.toISOString(),
    items: p.items.map((it) => ({
      id: it.id,
      rawMaterialId: it.rawMaterialId,
      rawMaterialName: it.rawMaterial.name,
      rawMaterialUnit: it.rawMaterial.unit.label,
      rawMaterialOpnameMode: it.rawMaterial.unit.opnameMode,
      isTracked: it.rawMaterial.isTracked,
      qty: it.qty ? it.qty.toNumber() : null,
      unitPrice: it.unitPrice ? it.unitPrice.toNumber() : null,
      subtotal: it.subtotal.toNumber(),
      note: it.note,
      expiredDate: it.expiredDate ? it.expiredDate.toISOString().substring(0, 10) : null,
      createdAt: it.createdAt.toISOString(),
    })),
  };
}
```

- [ ] **Step 3: Refactor `createPurchase` - bifurcate by opname_mode**

```typescript
export async function createPurchase(
  userId: number,
  input: CreatePurchaseInput,
): Promise<PurchaseView> {
  if (input.vendorId) {
    const vendor = await prisma.vendor.findUnique({ where: { id: input.vendorId } });
    if (!vendor) throw new AppError(`Vendor id=${input.vendorId} tidak ditemukan`, 400);
  }

  const rawMaterialIds = input.items.map((i) => i.rawMaterialId);
  const rawMaterials = await prisma.rawMaterial.findMany({
    where: { id: { in: rawMaterialIds } },
    include: { unit: true },
  });
  const rmMap = new Map(rawMaterials.map((r) => [r.id, r]));
  for (const item of input.items) {
    if (!rmMap.has(item.rawMaterialId)) {
      throw new AppError(`RawMaterial id=${item.rawMaterialId} tidak ditemukan`, 400);
    }
  }

  const purchaseDate = parseDateUtcMidnight(input.date);

  // Bifurcate per item - kalau opname_mode=scale_0_5 wajib subtotal+note, qty+unitPrice opsional.
  // Kalau exact wajib qty+unitPrice, subtotal hitung server.
  const itemsProcessed = input.items.map((item) => {
    const rm = rmMap.get(item.rawMaterialId)!;
    const isScale = rm.unit.opnameMode === 'scale_0_5';

    if (isScale) {
      if (item.subtotal === undefined || item.subtotal === null) {
        throw new AppError(
          `Item ${rm.name} (skala mode) wajib subtotal (total harga). qty + unitPrice opsional.`,
          422,
        );
      }
      return {
        item,
        rm,
        qty: item.qty !== undefined && item.qty !== null ? new Prisma.Decimal(item.qty) : null,
        unitPrice: item.unitPrice !== undefined && item.unitPrice !== null
          ? new Prisma.Decimal(item.unitPrice)
          : null,
        subtotal: new Prisma.Decimal(item.subtotal),
      };
    } else {
      if (item.qty === undefined || item.qty === null || item.unitPrice === undefined || item.unitPrice === null) {
        throw new AppError(
          `Item ${rm.name} (exact mode) wajib qty + unitPrice.`,
          422,
        );
      }
      const qty = new Prisma.Decimal(item.qty);
      const unitPrice = new Prisma.Decimal(item.unitPrice);
      const subtotal = qty.mul(unitPrice);
      return { item, rm, qty, unitPrice, subtotal };
    }
  });

  const totalAmount = itemsProcessed.reduce(
    (sum, x) => sum.add(x.subtotal),
    new Prisma.Decimal(0),
  );

  const purchaseId = await prisma.$transaction(async (tx) => {
    const header = await tx.purchase.create({
      data: {
        date: purchaseDate,
        userId,
        vendorId: input.vendorId ?? null,
        totalAmount,
        note: input.note ?? null,
      },
    });

    for (const { item, rm, qty, unitPrice, subtotal } of itemsProcessed) {
      const isScale = rm.unit.opnameMode === 'scale_0_5';

      // 1. Create PurchaseItem
      await tx.purchaseItem.create({
        data: {
          purchaseId: header.id,
          rawMaterialId: item.rawMaterialId,
          qty,
          unitPrice,
          subtotal,
          note: item.note ?? null,
          expiredDate: item.expiredDate ? parseDateUtcMidnight(item.expiredDate) : null,
        },
      });

      // 2. Update RawMaterial: last_buy_date selalu, unit_price kalau ada,
      //    stock_qty cuma kalau exact mode + isTracked
      const rmUpdateData: Prisma.RawMaterialUpdateInput = {
        lastBuyDate: purchaseDate,
      };
      if (unitPrice) rmUpdateData.unitPrice = unitPrice;
      if (!isScale && rm.isTracked && qty) {
        rmUpdateData.stockQty = { increment: qty };
      }
      await tx.rawMaterial.update({
        where: { id: item.rawMaterialId },
        data: rmUpdateData,
      });

      // 3. Insert audit log raw_material_movements
      let movementNote: string;
      if (isScale) {
        movementNote = `Purchase id=${header.id}: total Rp${subtotal.toString()}${item.note ? ` (${item.note})` : ''} (skala mode, stok manual via opname)`;
      } else if (rm.isTracked) {
        movementNote = `Purchase id=${header.id}: +${qty!.toString()} ${rm.unit.label} @ Rp${unitPrice!.toString()}`;
      } else {
        movementNote = `Purchase id=${header.id}: +${qty!.toString()} ${rm.unit.label} @ Rp${unitPrice!.toString()} (tidak tracked, hanya log pengeluaran)`;
      }
      // delta semantic: untuk audit, bukan stock impact.
      // - Scale: 0 (qty tidak meaningful, stock manual via opname)
      // - Exact (tracked atau non-tracked): qty (audit history pembelian)
      const movementDelta = isScale ? new Prisma.Decimal(0) : qty!;
      await tx.rawMaterialMovement.create({
        data: {
          rawMaterialId: item.rawMaterialId,
          delta: movementDelta,
          reason: 'purchase',
          note: movementNote,
          userId,
        },
      });
    }

    return header.id;
  });

  return getPurchaseById(purchaseId);
}
```

- [ ] **Step 4: Compile check**

```bash
cd backend && npx tsc --noEmit
```

Expected: zero errors. Kalau ada error di `purchases.controller.ts` atau `purchases.schema.ts`, akan di-fix Task 8.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/purchases/purchases.service.ts
git commit -m "refactor(purchases): bifurcate by unit.opname_mode untuk scale vs exact items

- Scale items (beras): wajib subtotal + note, qty+unitPrice opsional, stock TIDAK auto-update
- Exact items (telur dll): wajib qty+unitPrice, subtotal auto = qty*unitPrice, stock += qty (tracked)
- Audit log raw_material_movements adapt context-aware note

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Refactor purchases.schema (Zod) - nullable qty/unitPrice + subtotal + note

**Files:**
- Modify: `backend/src/modules/purchases/purchases.schema.ts`

- [ ] **Step 1: Read existing schema**

```bash
# Baca backend/src/modules/purchases/purchases.schema.ts
```

- [ ] **Step 2: Modify item shape - qty/unitPrice optional, subtotal optional (auto kalau exact), note**

```typescript
const purchaseItemInputSchema = z.object({
  rawMaterialId: z.number().int().positive(),
  qty: z.number().positive().nullable().optional(),
  unitPrice: z.number().positive().nullable().optional(),
  subtotal: z.number().positive().nullable().optional(), // server akan compute kalau exact, tapi scale wajib provide
  note: z.string().trim().max(255).nullable().optional(),
  expiredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const createPurchaseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vendorId: z.number().int().positive().nullable().optional(),
  note: z.string().trim().max(255).nullable().optional(),
  items: z.array(purchaseItemInputSchema).min(1),
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
```

`ListPurchasesQuery` tetap.

- [ ] **Step 3: Compile check**

```bash
cd backend && npx tsc --noEmit
```

Expected: zero errors backend-wide.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/purchases/purchases.schema.ts
git commit -m "refactor(purchases): Zod schema nullable qty/unitPrice/subtotal + note

Server enforce validity based on rawMaterial.unit.opname_mode di service layer.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Smoke test backend - units + raw materials + purchases integration

**Files:**
- Create: `backend/scripts/smoke-units-rawmat-purchases.sh`

- [ ] **Step 1: Read existing smoke script untuk pattern**

```bash
# Baca backend/scripts/smoke-phase-6.sh dan smoke-phase-7.sh
```

Catat helper functions yang biasa dipakai: `assert_status_code`, login helper, dll.

- [ ] **Step 2: Write smoke test**

```bash
#!/usr/bin/env bash
# Smoke test REV 2.5: units + raw materials + purchases integration.
# Tests:
#   1. List units (10 pre-seeded)
#   2. Create custom unit "karton" exact
#   3. Create raw_material "Telur Test" unit_id=karton
#   4. Create raw_material "Beras Test" unit_id=skala 0-5 (min_stock=1)
#   5. Edit unit Telur Test dari karton → butir (stock=2 → newStockQty=60)
#   6. Purchase exact: Telur Test 30 butir @ 2500 → stock += 30
#   7. Purchase scale: Beras Test subtotal=300000 note="1 karung 50kg" → stock TIDAK berubah
#   8. Verify min_stock validation: scale unit + min_stock=10 → 422
#   9. Verify edit unit tanpa newStockQty saat stock>0 → 422

set -euo pipefail

API=${API_URL:-http://localhost:8000/api}
PASS=0
FAIL=0

color_ok() { printf "\033[32m%s\033[0m" "$1"; }
color_err() { printf "\033[31m%s\033[0m" "$1"; }

assert_status() {
  local got=$1 want=$2 label=$3
  if [ "$got" = "$want" ]; then
    echo "  $(color_ok '✓') $label (HTTP $got)"
    PASS=$((PASS+1))
  else
    echo "  $(color_err '✗') $label (expected $want got $got)"
    FAIL=$((FAIL+1))
  fi
}

login() {
  local name=$1 pin=$2
  curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" \
    -d "{\"name\":\"$name\",\"pin\":\"$pin\"}" | jq -r '.data.token'
}

echo "==> Login Owner"
OWNER_TOKEN=$(login "Owner" "123456")
[ -z "$OWNER_TOKEN" ] || [ "$OWNER_TOKEN" = "null" ] && { echo "Owner login failed"; exit 1; }

echo "==> Login Kasir Jason"
KASIR_TOKEN=$(login "Jason" "111111")

echo
echo "=== Test 1: List units (10 pre-seeded) ==="
RESP=$(curl -s "$API/units" -H "Authorization: Bearer $OWNER_TOKEN")
COUNT=$(echo "$RESP" | jq '.data.units | length')
assert_status "$COUNT" "10" "10 pre-seeded units"

echo
echo "=== Test 2: Create custom unit karton (exact) ==="
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/units" \
  -H "Authorization: Bearer $OWNER_TOKEN" -H "Content-Type: application/json" \
  -d '{"label":"karton","opnameMode":"exact"}')
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
assert_status "$CODE" "201" "create unit karton"
KARTON_ID=$(echo "$BODY" | jq -r '.data.unit.id')

echo "==> Get butir id"
BUTIR_ID=$(curl -s "$API/units" -H "Authorization: Bearer $OWNER_TOKEN" | jq -r '.data.units[] | select(.label=="butir") | .id')
SKALA_ID=$(curl -s "$API/units" -H "Authorization: Bearer $OWNER_TOKEN" | jq -r '.data.units[] | select(.label=="skala 0-5") | .id')

echo
echo "=== Test 3: Create raw_material Telur Test ==="
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/raw-materials" \
  -H "Authorization: Bearer $OWNER_TOKEN" -H "Content-Type: application/json" \
  -d "{\"name\":\"Telur Test\",\"unitId\":$KARTON_ID,\"category\":\"bahanPokok\",\"isTracked\":true,\"stockQty\":2,\"minStock\":1}")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
assert_status "$CODE" "201" "create Telur Test unit=karton"
TELUR_ID=$(echo "$BODY" | jq -r '.data.rawMaterial.id')

echo
echo "=== Test 4: Create raw_material Beras Test (skala) ==="
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/raw-materials" \
  -H "Authorization: Bearer $OWNER_TOKEN" -H "Content-Type: application/json" \
  -d "{\"name\":\"Beras Test\",\"unitId\":$SKALA_ID,\"category\":\"bahanPokok\",\"isTracked\":true,\"stockQty\":3,\"minStock\":1}")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
assert_status "$CODE" "201" "create Beras Test unit=skala 0-5"
BERAS_ID=$(echo "$BODY" | jq -r '.data.rawMaterial.id')

echo
echo "=== Test 5: Min_stock validation - scale + min_stock=10 → 422 ==="
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/raw-materials" \
  -H "Authorization: Bearer $OWNER_TOKEN" -H "Content-Type: application/json" \
  -d "{\"name\":\"Beras Invalid\",\"unitId\":$SKALA_ID,\"category\":\"bahanPokok\",\"isTracked\":true,\"stockQty\":0,\"minStock\":10}")
CODE=$(echo "$RESP" | tail -1)
assert_status "$CODE" "422" "scale + min_stock=10 ditolak"

echo
echo "=== Test 6: Edit unit Telur Test karton→butir tanpa newStockQty saat stock=2 → 422 ==="
RESP=$(curl -s -w "\n%{http_code}" -X PUT "$API/raw-materials/$TELUR_ID" \
  -H "Authorization: Bearer $OWNER_TOKEN" -H "Content-Type: application/json" \
  -d "{\"unitId\":$BUTIR_ID}")
CODE=$(echo "$RESP" | tail -1)
assert_status "$CODE" "422" "edit unit tanpa newStockQty ditolak"

echo
echo "=== Test 7: Edit unit Telur Test karton→butir DENGAN newStockQty=60 ==="
RESP=$(curl -s -w "\n%{http_code}" -X PUT "$API/raw-materials/$TELUR_ID" \
  -H "Authorization: Bearer $OWNER_TOKEN" -H "Content-Type: application/json" \
  -d "{\"unitId\":$BUTIR_ID,\"newStockQty\":60}")
CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
assert_status "$CODE" "200" "edit unit dengan newStockQty=60"
NEW_STOCK=$(echo "$BODY" | jq '.data.rawMaterial.stockQty')
assert_status "$NEW_STOCK" "60" "stock_qty Telur Test = 60"

echo
echo "=== Test 8: Purchase exact (Telur Test) - qty=30 unit_price=2500 ==="
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/purchases" \
  -H "Authorization: Bearer $KASIR_TOKEN" -H "Content-Type: application/json" \
  -d "{\"date\":\"$(date +%Y-%m-%d)\",\"items\":[{\"rawMaterialId\":$TELUR_ID,\"qty\":30,\"unitPrice\":2500}]}")
CODE=$(echo "$RESP" | tail -1)
assert_status "$CODE" "201" "purchase exact Telur Test"

NEW_STOCK=$(curl -s "$API/raw-materials/$TELUR_ID" -H "Authorization: Bearer $OWNER_TOKEN" | jq '.data.rawMaterial.stockQty')
assert_status "$NEW_STOCK" "90" "stock_qty Telur Test = 60+30 = 90"

echo
echo "=== Test 9: Purchase scale (Beras Test) - subtotal=300000 note=1 karung 50kg ==="
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/purchases" \
  -H "Authorization: Bearer $KASIR_TOKEN" -H "Content-Type: application/json" \
  -d "{\"date\":\"$(date +%Y-%m-%d)\",\"items\":[{\"rawMaterialId\":$BERAS_ID,\"subtotal\":300000,\"note\":\"1 karung 50kg\"}]}")
CODE=$(echo "$RESP" | tail -1)
assert_status "$CODE" "201" "purchase scale Beras Test"

NEW_STOCK=$(curl -s "$API/raw-materials/$BERAS_ID" -H "Authorization: Bearer $OWNER_TOKEN" | jq '.data.rawMaterial.stockQty')
assert_status "$NEW_STOCK" "3" "stock_qty Beras Test TIDAK berubah (masih 3)"

echo
echo "=== Cleanup: hapus raw materials + custom unit ==="
curl -s -X DELETE "$API/raw-materials/$TELUR_ID" -H "Authorization: Bearer $OWNER_TOKEN" > /dev/null || true
curl -s -X DELETE "$API/raw-materials/$BERAS_ID" -H "Authorization: Bearer $OWNER_TOKEN" > /dev/null || true
curl -s -X DELETE "$API/units/$KARTON_ID" -H "Authorization: Bearer $OWNER_TOKEN" > /dev/null || true

echo
echo "==================================="
echo "Pass: $PASS  Fail: $FAIL"
echo "==================================="
[ "$FAIL" -gt 0 ] && exit 1
exit 0
```

- [ ] **Step 3: Make executable + run**

```bash
chmod +x backend/scripts/smoke-units-rawmat-purchases.sh
backend/scripts/smoke-units-rawmat-purchases.sh
```

Expected: Pass: 11 Fail: 0 (atau lebih).

Kalau ada Fail, baca output assert, identify error, fix di service/schema, re-run.

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/smoke-units-rawmat-purchases.sh
git commit -m "test(smoke): units + raw materials + purchases REV 2.5 integration

11 skenario: list units, create custom unit, create raw materials exact+scale,
min_stock validation, edit unit guard, purchase exact (stock incremented),
purchase scale (stock NOT incremented, hanya log expense).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Frontend types - Unit + OpnameMode + RawMaterial update

**Files:**
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Read existing types untuk lokasi RawMaterialView**

```bash
# Cari interface RawMaterialView atau RawMaterial di frontend/src/types/index.ts
```

- [ ] **Step 2: Tambah Unit + OpnameMode types**

```typescript
export type OpnameMode = 'exact' | 'scale_0_5';

export interface Unit {
  id: number;
  label: string;
  opnameMode: OpnameMode;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 3: Update RawMaterial / RawMaterialView**

Cari interface yang representasi raw material (kemungkinan namanya `RawMaterialView`). Ganti field `unit: string` jadi populated:

```typescript
export interface RawMaterialView {
  id: number;
  name: string;
  unitId: number;
  unit: {
    id: number;
    label: string;
    opnameMode: OpnameMode;
  };
  category: RawMaterialCategory;
  isTracked: boolean;
  stockQty: number;
  minStock: number | null;
  unitPrice: number | null;
  freshnessDays: number | null;
  lastBuyDate: string | null;
  isLowStock: boolean;
  isNearExpiry: boolean;
  daysUntilExpiry: number | null;
  suggestedAction: string | null;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 4: Update PurchaseItem types kalau ada di sini**

Cari `PurchaseItem` atau `PurchaseItemView` interface. Update qty + unitPrice jadi nullable + tambah note + rawMaterialOpnameMode:

```typescript
export interface PurchaseItemView {
  id: number;
  rawMaterialId: number;
  rawMaterialName: string;
  rawMaterialUnit: string;
  rawMaterialOpnameMode: OpnameMode;
  isTracked: boolean;
  qty: number | null;
  unitPrice: number | null;
  subtotal: number;
  note: string | null;
  expiredDate: string | null;
  createdAt: string;
}
```

- [ ] **Step 5: Compile check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: errors di services/components yang masih reference `unit` string. Akan di-fix di task berikutnya.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat(types): Unit + OpnameMode types, RawMaterial.unit jadi populated object

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Frontend unitService.ts CRUD

**Files:**
- Create: `frontend/src/services/unitService.ts`

- [ ] **Step 1: Read existing service pattern (mis. vendorService.ts)**

```bash
# Baca frontend/src/services/vendorService.ts
```

- [ ] **Step 2: Write unitService.ts**

```typescript
import { api } from './api';
import type { Unit, OpnameMode } from '../types';

interface CreateUnitPayload {
  label: string;
  opnameMode: OpnameMode;
}

interface UpdateUnitPayload {
  label?: string;
  opnameMode?: OpnameMode;
}

export const unitService = {
  list: async (): Promise<Unit[]> => {
    const res = await api.get('/units');
    return res.data.data.units;
  },
  getById: async (id: number): Promise<Unit> => {
    const res = await api.get(`/units/${id}`);
    return res.data.data.unit;
  },
  create: async (payload: CreateUnitPayload): Promise<Unit> => {
    const res = await api.post('/units', payload);
    return res.data.data.unit;
  },
  update: async (id: number, payload: UpdateUnitPayload): Promise<Unit> => {
    const res = await api.put(`/units/${id}`, payload);
    return res.data.data.unit;
  },
  delete: async (id: number): Promise<{ id: number; label: string }> => {
    const res = await api.delete(`/units/${id}`);
    return res.data.data;
  },
};
```

- [ ] **Step 3: Compile check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "unitService" | head -5
```

Expected: no errors di unitService.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/unitService.ts
git commit -m "feat(frontend): unitService.ts CRUD client untuk units endpoint

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Frontend rawMaterialsService + purchaseService - adapt unit_id + nullable qty

**Files:**
- Modify: `frontend/src/services/rawMaterialsService.ts`
- Modify: `frontend/src/services/purchaseService.ts`

- [ ] **Step 1: Update rawMaterialsService payload**

Cari fungsi `create` dan `update`. Ganti `unit: string` jadi `unitId: number`. Update payload untuk `update` supaya support `newStockQty`:

```typescript
interface CreateRawMaterialPayload {
  name: string;
  unitId: number;
  category: RawMaterialCategory;
  isTracked: boolean;
  stockQty: number;
  minStock?: number | null;
  unitPrice?: number | null;
  freshnessDays?: number | null;
}

interface UpdateRawMaterialPayload {
  name?: string;
  unitId?: number;
  newStockQty?: number | null; // wajib kalau unitId berubah + stock_qty > 0
  category?: RawMaterialCategory;
  isTracked?: boolean;
  minStock?: number | null;
  unitPrice?: number | null;
  freshnessDays?: number | null;
}
```

- [ ] **Step 2: Update purchaseService - qty/unitPrice/subtotal/note**

Cari payload interface untuk create purchase:

```typescript
interface PurchaseItemPayload {
  rawMaterialId: number;
  qty?: number | null;
  unitPrice?: number | null;
  subtotal?: number | null; // server compute kalau exact, scale wajib provide
  note?: string | null;
  expiredDate?: string | null;
}

interface CreatePurchasePayload {
  date: string;
  vendorId?: number | null;
  note?: string | null;
  items: PurchaseItemPayload[];
}
```

- [ ] **Step 3: Compile check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "rawMaterialsService|purchaseService" | head -10
```

Expected: no errors di service files (errors mungkin masih ada di pages/components yang pakai service).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/rawMaterialsService.ts frontend/src/services/purchaseService.ts
git commit -m "refactor(frontend): rawMaterialsService unitId + purchaseService nullable qty/unitPrice/note

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Frontend UnitDropdown component dengan "Tambah satuan" modal

**Files:**
- Create: `frontend/src/components/UnitDropdown.tsx`

- [ ] **Step 1: Read existing dropdown pattern (Select primitive) + Dialog primitive**

```bash
# Baca frontend/src/design-system/primitives/Select.tsx
# Baca frontend/src/design-system/primitives/Dialog.tsx
# Baca frontend/src/design-system/primitives/FormField.tsx
```

- [ ] **Step 2: Write UnitDropdown.tsx**

```tsx
// UnitDropdown - dropdown satuan dengan tombol "Tambah satuan baru" inline.
// Saat tombol diklik, modal kecil terbuka untuk input label + opnameMode.
// Setelah save, unit baru auto-selected.
//
// Permission: hanya owner yang lihat tombol "Tambah satuan baru" (CRUD master).
// Role lain cuma lihat dropdown read-only dari units yang sudah ada.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { unitService } from '../services/unitService';
import { useAuthStore } from '../stores/authStore';
import { Select } from '../design-system/primitives/Select';
import { Dialog } from '../design-system/primitives/Dialog';
import { FormField } from '../design-system/primitives/FormField';
import type { Unit, OpnameMode } from '../types';

interface UnitDropdownProps {
  value: number | null;
  onChange: (unitId: number, unit: Unit) => void;
  disabled?: boolean;
  required?: boolean;
}

export function UnitDropdown({ value, onChange, disabled, required }: UnitDropdownProps) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'owner';

  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: unitService.list,
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newMode, setNewMode] = useState<OpnameMode>('exact');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: unitService.create,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      onChange(created.id, created);
      setShowAddModal(false);
      setNewLabel('');
      setNewMode('exact');
      setError(null);
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      setError(e.response?.data?.message ?? 'Gagal tambah satuan');
    },
  });

  const handleAddSubmit = () => {
    if (!newLabel.trim()) {
      setError('Label wajib diisi');
      return;
    }
    createMutation.mutate({ label: newLabel.trim(), opnameMode: newMode });
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Select
          value={value ?? ''}
          onChange={(e) => {
            const id = Number(e.target.value);
            const unit = units.find((u) => u.id === id);
            if (unit) onChange(id, unit);
          }}
          disabled={disabled}
          required={required}
          className="flex-1"
        >
          <option value="" disabled>Pilih satuan...</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}{u.opnameMode === 'scale_0_5' ? ' (skala)' : ''}
            </option>
          ))}
        </Select>
        {isOwner && !disabled && (
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            + Satuan
          </button>
        )}
      </div>

      <Dialog
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Tambah satuan baru"
      >
        <div className="space-y-4">
          <FormField label="Label" required>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="mis. karton, ikat, skala 1-10"
              className="w-full px-3 py-2 border border-gray-300 rounded"
              autoFocus
            />
          </FormField>

          <FormField label="Mode opname" required>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={newMode === 'exact'}
                  onChange={() => setNewMode('exact')}
                />
                <span>Exact (input angka)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={newMode === 'scale_0_5'}
                  onChange={() => setNewMode('scale_0_5')}
                />
                <span>Skala 0-5 (subjective fullness)</span>
              </label>
            </div>
          </FormField>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleAddSubmit}
              disabled={createMutation.isPending}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Menyimpan...' : 'Simpan & pilih'}
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
```

NOTE: classNames di atas adalah Tailwind default. Pastikan match existing design-system convention. Kalau project pakai design tokens, ganti dengan token classes (cek `tokens.css` & existing `Select.tsx`).

- [ ] **Step 3: Compile check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "UnitDropdown" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/UnitDropdown.tsx
git commit -m "feat(frontend): UnitDropdown component dengan 'Tambah satuan baru' modal

Owner only sees + tombol; role lain cuma read-only dropdown. Modal pakai
Dialog primitive + FormField + radio opnameMode selector.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Refactor RawMaterialsTab - integrate UnitDropdown + edit unit prompt

**Files:**
- Modify: `frontend/src/components/stock/RawMaterialsTab.tsx`

- [ ] **Step 1: Read existing RawMaterialsTab.tsx**

```bash
# Baca frontend/src/components/stock/RawMaterialsTab.tsx
```

Catat struktur: kemungkinan ada `AddRawMaterialModal` + `EditRawMaterialModal` + list table + opname/markHabis flows.

- [ ] **Step 2: Ganti input `unit` string dengan `<UnitDropdown />`**

Di form add/edit raw material modal, ganti:

```tsx
// SEBELUM:
<input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} />

// SESUDAH:
<UnitDropdown
  value={unitId}
  onChange={(id, unit) => {
    setUnitId(id);
    setUnit(unit); // simpan full object untuk reference opnameMode
  }}
  required
/>
```

State change: dari `const [unit, setUnit] = useState('')` jadi:

```tsx
const [unitId, setUnitId] = useState<number | null>(null);
const [unit, setUnit] = useState<Unit | null>(null);
```

- [ ] **Step 3: Tambah edit unit prompt modal**

Di EditRawMaterialModal, deteksi kalau `unitId` berubah dari nilai awal AND `stockQty > 0`:

```tsx
const [showUnitChangePrompt, setShowUnitChangePrompt] = useState(false);
const [newStockQty, setNewStockQty] = useState<number | ''>('');

const handleSubmit = () => {
  const unitChanged = unitId !== rawMaterial.unitId;
  const hasStock = rawMaterial.stockQty > 0;

  if (unitChanged && hasStock && newStockQty === '') {
    setShowUnitChangePrompt(true);
    return;
  }

  updateMutation.mutate({
    id: rawMaterial.id,
    payload: {
      name,
      unitId: unitChanged ? unitId : undefined,
      newStockQty: unitChanged ? (newStockQty === '' ? null : Number(newStockQty)) : undefined,
      category,
      isTracked,
      minStock: minStock === '' ? null : Number(minStock),
      freshnessDays: freshnessDays === '' ? null : Number(freshnessDays),
    },
  });
};
```

Tambah modal prompt (sub-dialog):

```tsx
<Dialog
  open={showUnitChangePrompt}
  onClose={() => setShowUnitChangePrompt(false)}
  title="Konversi stok ke satuan baru"
>
  <div className="space-y-4">
    <p className="text-sm">
      Stok saat ini: <strong>{rawMaterial.stockQty} {rawMaterial.unit.label}</strong>
    </p>
    <p className="text-sm">
      Setelah unit jadi <strong>{unit?.label}</strong>, stok berapa?
    </p>
    <FormField label="Stok baru" hint="Kosongkan untuk reset ke 0 (opname ulang)">
      <input
        type="number"
        value={newStockQty}
        onChange={(e) => setNewStockQty(e.target.value === '' ? '' : Number(e.target.value))}
        placeholder="0"
        className="w-full px-3 py-2 border border-gray-300 rounded"
      />
    </FormField>
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={() => { setNewStockQty(0); setShowUnitChangePrompt(false); handleSubmit(); }}
        className="px-4 py-2 text-sm border border-gray-300 rounded"
      >
        Reset ke 0
      </button>
      <button
        type="button"
        onClick={() => { setShowUnitChangePrompt(false); handleSubmit(); }}
        disabled={newStockQty === ''}
        className="px-4 py-2 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
      >
        Lanjut
      </button>
    </div>
  </div>
</Dialog>
```

- [ ] **Step 4: Update list table - tampilkan `rm.unit.label` bukan `rm.unit`**

```tsx
// SEBELUM:
<td>{rm.unit}</td>

// SESUDAH:
<td>{rm.unit.label}</td>
```

Cari semua referensi `.unit` (string) → ganti dengan `.unit.label`.

- [ ] **Step 5: Compile check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "RawMaterialsTab" | head -10
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/stock/RawMaterialsTab.tsx
git commit -m "refactor(frontend): RawMaterialsTab integrate UnitDropdown + edit unit prompt

- Add/edit modal pakai UnitDropdown (state unitId + unit object)
- Edit modal deteksi unitId change + stock>0 → prompt newStockQty
- Display tabel pakai rm.unit.label

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: RawMaterialsTab opname UI bifurcation exact vs scale

**Files:**
- Modify: `frontend/src/components/stock/RawMaterialsTab.tsx`

- [ ] **Step 1: Identify opname form/modal di RawMaterialsTab**

Cari section/komponen yang handle opname (kemungkinan `OpnameModal` atau inline form).

- [ ] **Step 2: Bifurcate input per item berdasarkan `rm.unit.opnameMode`**

```tsx
// Untuk tiap item dalam opname list:
{rms.map((rm) => (
  <tr key={rm.id}>
    <td>{rm.name}</td>
    <td>
      {rm.unit.opnameMode === 'scale_0_5' ? (
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="flex items-center gap-1">
              <input
                type="radio"
                name={`qty-${rm.id}`}
                value={n}
                checked={qtyByRm[rm.id] === n}
                onChange={() => setQtyByRm({ ...qtyByRm, [rm.id]: n })}
              />
              <span>{n}</span>
            </label>
          ))}
        </div>
      ) : (
        <input
          type="number"
          value={qtyByRm[rm.id] ?? ''}
          onChange={(e) => setQtyByRm({ ...qtyByRm, [rm.id]: e.target.value === '' ? null : Number(e.target.value) })}
          className="w-24 px-2 py-1 border border-gray-300 rounded"
        />
      )}
    </td>
    <td className="text-sm text-gray-500">{rm.unit.label}</td>
  </tr>
))}
```

- [ ] **Step 3: Compile check + tsc full sweep**

```bash
cd frontend && npx tsc --noEmit
```

Expected: zero errors di seluruh frontend (kecuali PurchasesPage yang akan di-handle Task 17).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/stock/RawMaterialsTab.tsx
git commit -m "feat(frontend): RawMaterialsTab opname UI bifurcation exact vs scale

Items dengan opname_mode=scale_0_5 tampil segmented 0-5; lainnya input angka.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: QuickAddBumbuDasar component

**Files:**
- Create: `frontend/src/components/QuickAddBumbuDasar.tsx`

- [ ] **Step 1: Write component**

```tsx
// QuickAddBumbuDasar - tombol yang spawn multiple rows preset dari raw_materials
// kategori bumbu_dasar sekaligus di form purchase. Kasir tinggal isi qty + harga.
// Bisa hapus row yang ngga jadi dibeli.

import { useQuery } from '@tanstack/react-query';
import { rawMaterialsService } from '../services/rawMaterialsService';
import type { RawMaterialView } from '../types';

interface QuickAddBumbuDasarProps {
  onAdd: (items: RawMaterialView[]) => void;
}

export function QuickAddBumbuDasar({ onAdd }: QuickAddBumbuDasarProps) {
  const { data: allRms = [] } = useQuery({
    queryKey: ['raw-materials', { category: 'bumbuDasar' }],
    queryFn: () => rawMaterialsService.list({ category: 'bumbuDasar' }),
  });

  const handleClick = () => {
    if (allRms.length === 0) return;
    onAdd(allRms);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={allRms.length === 0}
      className="px-3 py-2 text-sm border border-dashed border-orange-400 text-orange-700 rounded hover:bg-orange-50 disabled:opacity-50"
      title={allRms.length === 0 ? 'Belum ada raw material kategori bumbu_dasar' : `Spawn ${allRms.length} baris preset`}
    >
      + Quick Add Bumbu Dasar ({allRms.length})
    </button>
  );
}
```

- [ ] **Step 2: Compile check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "QuickAdd" | head -5
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/QuickAddBumbuDasar.tsx
git commit -m "feat(frontend): QuickAddBumbuDasar component

Tombol di form purchase yang spawn multiple preset rows dari raw_materials
category=bumbu_dasar sekaligus. UX cepat untuk input belanja bumbu campur.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 17: PurchasesPage - QuickAddBumbuDasar integration + bifurcate form per item

**Files:**
- Modify: `frontend/src/pages/PurchasesPage.tsx`

- [ ] **Step 1: Read existing PurchasesPage.tsx**

```bash
# Baca frontend/src/pages/PurchasesPage.tsx
```

Catat state shape untuk items dalam create form (kemungkinan `useState<PurchaseItemForm[]>`).

- [ ] **Step 2: Update item state shape - qty/unitPrice nullable + opnameMode aware**

```tsx
interface PurchaseItemFormRow {
  rawMaterialId: number | null;
  rawMaterialName: string | null;
  unitLabel: string | null;
  opnameMode: OpnameMode | null;
  qty: number | '';
  unitPrice: number | '';
  subtotal: number | ''; // scale items input manual, exact items auto-compute
  note: string;
}
```

- [ ] **Step 3: Integrate QuickAddBumbuDasar di form header**

Tambah tombol di samping "Tambah Item":

```tsx
<div className="flex gap-2 mb-4">
  <button type="button" onClick={addEmptyItem} className="...">+ Tambah Item</button>
  <QuickAddBumbuDasar
    onAdd={(rms) => {
      const newRows = rms.map((rm) => ({
        rawMaterialId: rm.id,
        rawMaterialName: rm.name,
        unitLabel: rm.unit.label,
        opnameMode: rm.unit.opnameMode,
        qty: '' as const,
        unitPrice: '' as const,
        subtotal: '' as const,
        note: '',
      }));
      setItems([...items, ...newRows]);
    }}
  />
</div>
```

- [ ] **Step 4: Bifurcate row inputs berdasarkan opnameMode**

```tsx
{items.map((row, i) => (
  <tr key={i}>
    <td>
      <RawMaterialPicker
        value={row.rawMaterialId}
        onChange={(rm) => {
          const next = [...items];
          next[i] = {
            ...row,
            rawMaterialId: rm.id,
            rawMaterialName: rm.name,
            unitLabel: rm.unit.label,
            opnameMode: rm.unit.opnameMode,
            qty: '', unitPrice: '', subtotal: '',
          };
          setItems(next);
        }}
      />
    </td>
    {row.opnameMode === 'scale_0_5' ? (
      <>
        <td className="text-gray-400 italic text-sm">-</td>
        <td className="text-gray-400 italic text-sm">-</td>
        <td>
          <input
            type="number"
            value={row.subtotal}
            onChange={(e) => updateRow(i, { subtotal: e.target.value === '' ? '' : Number(e.target.value) })}
            placeholder="Total harga"
            className="w-32"
          />
        </td>
        <td>
          <input
            type="text"
            value={row.note}
            onChange={(e) => updateRow(i, { note: e.target.value })}
            placeholder="mis. 1 karung 50kg"
            className="w-48"
          />
        </td>
      </>
    ) : (
      <>
        <td>
          <input
            type="number"
            value={row.qty}
            onChange={(e) => {
              const v = e.target.value === '' ? '' : Number(e.target.value);
              const next = { ...row, qty: v };
              if (typeof v === 'number' && typeof row.unitPrice === 'number') {
                next.subtotal = v * row.unitPrice;
              }
              updateRow(i, next);
            }}
            className="w-20"
          />
        </td>
        <td>
          <input
            type="number"
            value={row.unitPrice}
            onChange={(e) => {
              const v = e.target.value === '' ? '' : Number(e.target.value);
              const next = { ...row, unitPrice: v };
              if (typeof v === 'number' && typeof row.qty === 'number') {
                next.subtotal = row.qty * v;
              }
              updateRow(i, next);
            }}
            className="w-32"
          />
        </td>
        <td className="text-right">{typeof row.subtotal === 'number' ? row.subtotal.toLocaleString('id-ID') : '-'}</td>
        <td>
          <input
            type="text"
            value={row.note}
            onChange={(e) => updateRow(i, { note: e.target.value })}
            placeholder="(opsional)"
            className="w-32"
          />
        </td>
      </>
    )}
    <td>
      <button onClick={() => removeRow(i)}>Hapus</button>
    </td>
  </tr>
))}
```

- [ ] **Step 5: Submit handler - adapt payload per opnameMode**

```tsx
const handleSubmit = () => {
  const payload: CreatePurchasePayload = {
    date,
    vendorId,
    note: headerNote || null,
    items: items.map((row) => {
      if (row.opnameMode === 'scale_0_5') {
        return {
          rawMaterialId: row.rawMaterialId!,
          subtotal: typeof row.subtotal === 'number' ? row.subtotal : 0,
          note: row.note || null,
          qty: null,
          unitPrice: null,
        };
      } else {
        return {
          rawMaterialId: row.rawMaterialId!,
          qty: typeof row.qty === 'number' ? row.qty : 0,
          unitPrice: typeof row.unitPrice === 'number' ? row.unitPrice : 0,
          note: row.note || null,
        };
      }
    }),
  };
  createMutation.mutate(payload);
};
```

- [ ] **Step 6: Update purchase list display - handle nullable qty + show note**

```tsx
{purchase.items.map((it) => (
  <li key={it.id}>
    {it.qty !== null && it.unitPrice !== null ? (
      <span>{it.rawMaterialName}: {it.qty} {it.rawMaterialUnit} @ Rp{it.unitPrice.toLocaleString('id-ID')} = Rp{it.subtotal.toLocaleString('id-ID')}</span>
    ) : (
      <span>{it.rawMaterialName}: Rp{it.subtotal.toLocaleString('id-ID')} {it.note ? `(${it.note})` : ''}</span>
    )}
  </li>
))}
```

- [ ] **Step 7: Compile check + vite build**

```bash
cd frontend && npx tsc --noEmit
cd frontend && npm run build
```

Expected: tsc zero errors, vite build success.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/PurchasesPage.tsx
git commit -m "feat(frontend): PurchasesPage QuickAddBumbuDasar + bifurcate row per opnameMode

- Scale items: qty/unitPrice disabled, subtotal+note required (mis. '1 karung 50kg')
- Exact items: qty + unitPrice required, subtotal auto = qty*unitPrice
- Quick Add Bumbu Dasar tombol spawn preset rows dari category=bumbu_dasar

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 18: Manual end-to-end verification (browser)

**Files:** none (verification only)

- [ ] **Step 1: Start both servers**

```bash
npm run dev
```

Tunggu sampai backend listening :8000 + frontend listening :3000.

- [ ] **Step 2: Login sebagai Owner**

Buka `http://localhost:3000`, login `Owner` / `123456`.

- [ ] **Step 3: Verify Units di Master Raw Material**

Navigate ke Stok → Raw Materials → tombol "Tambah" (atau Edit existing item).

Modal Add muncul → Unit dropdown harus list 10 units (kg, gram, liter, ..., skala 0-5). Tombol "+ Satuan" muncul (owner only).

Klik "+ Satuan" → modal kecil → input "karton" + pilih exact → Save → unit baru muncul di dropdown auto-selected.

- [ ] **Step 4: Verify create raw material exact**

Create "Telur Test" unit=butir, category=bahanPokok, isTracked=true, stockQty=2, minStock=1 → Save.

Verify muncul di list dengan unit "butir".

- [ ] **Step 5: Verify create raw material scale**

Create "Beras Test" unit=skala 0-5, category=bahanPokok, isTracked=true, stockQty=3, minStock=1 → Save.

Try set minStock=10 → expected error "min_stock untuk satuan skala harus 0..5".

- [ ] **Step 6: Verify edit unit dengan stock prompt**

Edit "Telur Test" → ganti unit dari butir → karton → Save.

Modal prompt muncul "Stok saat ini 2 butir. Setelah unit jadi karton, stok jadi berapa?" → input 1 → Lanjut.

Verify list update: Telur Test 1 karton.

Cek raw_material_movements via API:
```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"name":"Owner","pin":"123456"}' | jq -r '.data.token')
curl -s "http://localhost:8000/api/raw-materials/<TELUR_ID>" -H "Authorization: Bearer $TOKEN" | jq '.data.rawMaterial.recentMovements'
```

Expected: ada entry dengan reason=`manual_adjust`, note "Unit changed: butir → karton, stok 2 → 1".

- [ ] **Step 7: Verify purchase exact**

Login sebagai Kasir Jason / 111111. Navigate ke Belanja.

"Tambah Pembelian" → pilih tanggal, vendor opsional, items: Telur Test qty=10 unitPrice=2500 → submit.

Verify stock Telur Test = 1 + 10 = 11.

- [ ] **Step 8: Verify purchase scale**

Di form yang sama, tambah item Beras Test → form auto-hide qty + unitPrice (atau show "-") → input subtotal=300000 note="1 karung 50kg" → submit.

Verify stock Beras Test TIDAK berubah (masih 3).

Verify purchase list tampil: "Beras Test: Rp 300.000 (1 karung 50kg)".

- [ ] **Step 9: Verify Quick Add Bumbu Dasar**

Di form purchase, klik "+ Quick Add Bumbu Dasar (N)" → spawn N preset rows dari category=bumbuDasar (cabai, bawang, dll).

Isi 2-3 row qty + unitPrice → hapus row yang tidak jadi dibeli → submit.

Verify items tersimpan + total accurate.

- [ ] **Step 10: Verify opname UI bifurcation**

Login sebagai Waiter Amel / 222222. Navigate ke Stok → Raw Materials → tombol "Opname" (atau "Cek Fisik").

Verify per item:
- Beras Test tampil segmented control 0-5
- Telur Test tampil input angka

Set Beras = 2, Telur = 5 → submit.

Verify update + audit log.

- [ ] **Step 11: Cleanup**

Hapus "Telur Test", "Beras Test", custom unit "karton" via owner UI.

- [ ] **Step 12: Commit verification log**

Kalau ada bug found + di-fix, commit per-fix. Kalau semua lulus, tidak ada commit di task ini.

Update plan file dengan checkbox completion (Optional - pure tracking):

```bash
git add docs/superpowers/plans/2026-05-26-stok-raw-purchasing-redesign.md
git commit -m "docs(plan): mark verification tasks complete

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Post-implementation followups

- Update `CLAUDE.md` Status REV 2.5 row: tambah "Raw materials redesign DONE - units master + opname mode bifurcation + Quick Add Bumbu Dasar"
- Update `docs/knowledge/ERD.md` dengan entity Unit baru + FK ke RawMaterial
- Update `docs/DATA-DICTIONARY.md` dengan tabel `units` + ubah `raw_materials.unit` jadi `unit_id` + ubah `purchase_items` (nullable qty/unit_price + note)
- Update `docs/operasional-resto.md` REV 2.4 → REV 2.5 dengan section units & opname bifurcation
- Hapus memory `project_raw_materials_redesign_pending.md` (jadikan archived; ganti dengan status "DONE" di session handoff)

Out-of-scope (deferred):
- Unit conversion factor (telur biji ↔ karton otomatis)
- Per-bumbu price trend chart
- Reminder threshold konfigurable per category
