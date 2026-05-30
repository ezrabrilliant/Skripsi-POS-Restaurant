# REV 2.11 - COGS per Menu + Hapus Belanja/Vendor/Raw Materials - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an owner-set COGS (modal) per menu with a change-history log, snapshot per-unit cost onto every transaction item, report Laba = Pendapatan − COGS on the owner dashboard, and remove the belanja/vendor/raw-materials subsystem entirely.

**Architecture:** COGS lives as a nullable `Menu.cost` scalar on each stock-bearing leaf SKU + simple menu. At order time a pure resolver `resolveCostComponents` walks the variant/paket graph (mirroring `resolveStockTargets` but including nonStock components and the item's own cost) to compute a per-unit `unitCost`, which is frozen on `TransactionItem.unitCost` (point-in-time COGS, like `unitPrice`). Cost edits go through the existing owner-only `upsertMenu` and append a `MenuCostMovement` audit row inside the same `$transaction`. The dashboard sums `unitCost × qty` over paid, non-merged transaction items using the same filter as revenue. Belanja/vendor/raw-materials models + modules + UI are deleted.

**Tech Stack:** Express 4 + TypeScript + Prisma + MySQL (backend); React 18 + TS + Vite + Tailwind + React Query + Zustand (frontend). Vitest for unit tests. `prisma db push` for dev migrations (PROD hard-gated).

**Spec:** [docs/superpowers/specs/2026-05-30-cogs-per-menu-remove-belanja-design.md](../specs/2026-05-30-cogs-per-menu-remove-belanja-design.md) (decisions D1–D6).

**Branch:** `feat/cogs-per-menu-rev211` (already created from `main` `db8062c`).

---

## File Structure

**Created:**
- `backend/scripts/backfill-cogs.ts` - one-time script: seed `costSourceMenuId` for nonStock variant leaves + backfill historical `TransactionItem.unitCost`.
- `backend/scripts/smoke-cogs.ts` - smoke test: order variant + paket, assert `unitCost` snapshot + dashboard COGS.

**Modified (COGS add):**
- `backend/prisma/schema.prisma` - `Menu.cost`, `MenuVariant.costSourceMenuId`, `TransactionItem.unitCost`, new `MenuCostMovement` + enum `MenuCostChangeReason`, back-relations.
- `backend/src/modules/menus/variant-resolver.ts` - `resolveCostComponents` + `costTargetOf`; `MenuNode` gains `cost` + `variants[].costSourceMenuId`.
- `backend/src/modules/menus/__tests__/variant-resolver.test.ts` - `resolveCostComponents` tests.
- `backend/src/modules/menus/menus.schema.ts` - `cost` + `costSourceMenuId` on schemas.
- `backend/src/modules/menus/menus.service.ts` - persist cost/costSource, `MenuView`/`MenuDetail` cost (owner-gated), `upsertMenu(id, input, userId)` + `MenuCostMovement` write, `getCostHistory`, `validateMenuReferences`.
- `backend/src/modules/menus/menus.controller.ts` - thread `req.user.id`, `handleCostHistory`.
- `backend/src/modules/menus/menus.routes.ts` - `GET /:id/cost-history` owner-only.
- `backend/src/modules/transactions/transactions.service.ts` - `buildMenuGraph` cost/costSource, `resolveItems` unitCost, `ResolvedItem.unitCost`, persist.
- `backend/src/modules/dashboard/dashboard.service.ts` - COGS aggregate, `profit = revenue − cogs`, drop purchase + raw-material reminders.
- `backend/prisma/variant-catalog.ts` - `costSourceName` per nonStock variant.
- `frontend/src/types/index.ts` - `Menu.cost`, payload cost, `MenuVariant.costSourceMenuId`, cost-movement view + labels.
- `frontend/src/services/menuService.ts` - `costHistory(id)`.
- `frontend/src/services/dashboardService.ts` - `expense` shape.
- `frontend/src/components/MenuFormModal.tsx` - cost input + margin.
- `frontend/src/components/menu/VariantBuilder.tsx` - costSource round-trip + per-row picker.
- `frontend/src/pages/MenuPage.tsx` - cost column + history drawer.
- `frontend/src/pages/OwnerDashboard.tsx` - relabel COGS card, bills separate.

**Modified (removal):**
- `backend/src/app.ts`, `backend/src/modules/stocks/stocks.routes.ts`, `backend/prisma/seed.ts`, `backend/src/modules/dashboard/dashboard.service.ts` (reminderCounts + waiter).
- `frontend/src/App.tsx`, `frontend/src/components/Layout.tsx`, `frontend/src/pages/CashierDashboard.tsx`, `frontend/src/pages/StockPage.tsx`, `frontend/src/services/index.ts`, `frontend/src/pages/index.ts`.

**Deleted:**
- `backend/src/modules/purchases/`, `backend/src/modules/vendors/`, `backend/src/modules/stocks/raw-materials.*`, `backend/src/modules/units/` (after verify).
- `frontend/src/pages/PurchasesPage.tsx`, `frontend/src/services/{purchaseService,vendorService,rawMaterialsService}.ts`, `frontend/src/components/stock/RawMaterialsTab.tsx`.

---

# PHASE A - COGS (additive, no destructive change yet)

## Task 1: Schema - additive COGS columns + audit model

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add `cost` to Menu + back-relation**

In `model Menu`, after the `price` line add the cost column, and after `portionMovements PortionMovement[]` add the back-relation:

```prisma
  price      Decimal   @db.Decimal(10, 2)
  /// REV 2.11: modal/COGS per unit (owner-only; TIDAK dibocorkan ke GET publik).
  /// null = belum di-set (diperlakukan 0 saat hitung laba).
  cost       Decimal?  @db.Decimal(10, 2) @map("cost")
```
```prisma
  portionStock     PortionStock?
  transactionItems TransactionItem[]
  portionMovements PortionMovement[]
  costMovements    MenuCostMovement[]
```

- [ ] **Step 2: Add `costSourceMenuId` to MenuVariant**

In `model MenuVariant`, after `stockTargetMenuId` add a plain scalar (NO Prisma relation - Menu↔MenuVariant already has two named relations; a third forces extra named-relation boilerplate):

```prisma
  stockTargetMenuId Int?                @map("stock_target_menu_id")
  /// REV 2.11: SKU leaf wakil modal varian. Resolusi modal = costSourceMenuId ?? stockTargetMenuId.
  /// Diisi untuk varian nonStock yang modalnya beda (Es Teh ukuran, Es Jeruk, Tahu Tempe).
  costSourceMenuId  Int?                @map("cost_source_menu_id")
```

- [ ] **Step 3: Add `unitCost` to TransactionItem**

In `model TransactionItem`, after `subtotal`:

```prisma
  subtotal           Decimal  @db.Decimal(12, 2)
  /// REV 2.11: snapshot modal/COGS per unit saat order (mirror unitPrice). null = baris historis pra-backfill (dihitung 0).
  unitCost           Decimal? @map("unit_cost") @db.Decimal(10, 2)
```

- [ ] **Step 4: Add MenuCostMovement model + enum (after PortionMovement block)**

```prisma
/// REV 2.11: audit log perubahan Menu.cost (modal). Mirip PortionMovement: simpan
/// nilai sebelum/sesudah + user + waktu. initialSet saat dari null→nilai pertama.
model MenuCostMovement {
  id         Int                  @id @default(autoincrement())
  menuId     Int                  @map("menu_id")
  costBefore Decimal?             @map("cost_before") @db.Decimal(10, 2)
  costAfter  Decimal?             @map("cost_after") @db.Decimal(10, 2)
  reason     MenuCostChangeReason
  note       String?              @db.VarChar(255)
  userId     Int                  @map("user_id")
  createdAt  DateTime             @default(now()) @map("created_at")

  menu Menu @relation(fields: [menuId], references: [id])
  user User @relation(fields: [userId], references: [id])

  @@index([menuId, createdAt])
  @@map("menu_cost_movements")
}

enum MenuCostChangeReason {
  initialSet @map("initial_set")
  manualEdit @map("manual_edit")
}
```

- [ ] **Step 5: Add User back-relation**

In `model User`, after `portionMovements     PortionMovement[]` add:

```prisma
  portionMovements     PortionMovement[]
  rawMaterialMovements RawMaterialMovement[]
  menuCostChanges      MenuCostMovement[]
```
(Leave `rawMaterialMovements` for now - it is removed in Task 9.)

- [ ] **Step 6: Validate + push to dev DB**

Run: `cd backend && npx prisma format && npx prisma validate`
Expected: "The schema at prisma\schema.prisma is valid 🚀"

Run: `cd backend && npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema." (additive, zero data-loss). If `prisma generate` throws EPERM on Windows (engine dll locked), stop the dev server and re-run; client still functions.

- [ ] **Step 7: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(schema): REV 2.11 P0 - additive COGS (Menu.cost, MenuVariant.costSourceMenuId, TransactionItem.unitCost, MenuCostMovement)"
```

---

## Task 2: Cost resolver (TDD) - `resolveCostComponents`

**Files:**
- Modify: `backend/src/modules/menus/variant-resolver.ts`
- Test: `backend/src/modules/menus/__tests__/variant-resolver.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `variant-resolver.test.ts` (import `resolveCostComponents` alongside existing imports):

```typescript
import { resolveCostComponents } from '../variant-resolver'

describe('resolveCostComponents', () => {
  // simple portion item -> its own menu cost basis
  const graph = {
    1: { id: 1, kind: 'simple' as const, stockType: 'portion' as const, cost: 9000 },
    2: { id: 2, kind: 'simple' as const, stockType: 'nonStock' as const, cost: 2000 }, // nasi
    3: { id: 3, kind: 'simple' as const, stockType: 'nonStock' as const, cost: 1500 }, // teh leaf
    10: {
      id: 10, kind: 'variant' as const, stockType: 'nonStock' as const,
      variants: { 100: { id: 100, stockTargetMenuId: 1, costSourceMenuId: null } }, // ayam -> leaf 1
    },
    11: {
      id: 11, kind: 'variant' as const, stockType: 'nonStock' as const,
      variants: { 110: { id: 110, stockTargetMenuId: null, costSourceMenuId: 3 } }, // es teh -> leaf 3
    },
    20: {
      id: 20, kind: 'paket' as const, stockType: 'nonStock' as const,
      paket: {
        fixed: [{ qty: 2, targetMenuId: 2, targetVariantId: null }], // 2x nasi
        choices: [{ label: 'Ayam', options: [{ targetMenuId: 10, targetVariantId: 100 }] }],
      },
    },
  }

  it('simple portion item -> own cost', () => {
    expect(resolveCostComponents(graph, { menuId: 1 })).toEqual([{ menuId: 1, qty: 1 }])
  })
  it('simple nonStock item still books own cost', () => {
    expect(resolveCostComponents(graph, { menuId: 2 })).toEqual([{ menuId: 2, qty: 1 }])
  })
  it('variant with stockTarget resolves to leaf', () => {
    expect(resolveCostComponents(graph, { menuId: 10, variantId: 100 })).toEqual([{ menuId: 1, qty: 1 }])
  })
  it('nonStock variant resolves to costSourceMenuId leaf', () => {
    expect(resolveCostComponents(graph, { menuId: 11, variantId: 110 })).toEqual([{ menuId: 3, qty: 1 }])
  })
  it('paket sums fixed (with qty) + chosen components', () => {
    const out = resolveCostComponents(graph, {
      menuId: 20,
      paketChoices: { Ayam: { targetMenuId: 10, variantId: 100 } },
    })
    expect(out).toEqual(expect.arrayContaining([{ menuId: 2, qty: 2 }, { menuId: 1, qty: 1 }]))
    expect(out).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run - verify FAIL**

Run: `cd backend && npx vitest run src/modules/menus/__tests__/variant-resolver.test.ts`
Expected: FAIL - `resolveCostComponents is not a function`.

- [ ] **Step 3: Implement**

In `variant-resolver.ts`: (a) add `cost?: number` to `MenuNode`; (b) add `costSourceMenuId?: number | null` to the `variants` record type; (c) add `costTargetOf` + `resolveCostComponents`:

```typescript
export interface MenuNode {
  id: number
  kind: 'simple' | 'variant' | 'paket'
  stockType: 'portion' | 'linked' | 'nonStock'
  cost?: number
  variants?: Record<number, { id: number; stockTargetMenuId: number | null; costSourceMenuId?: number | null }>
  paket?: {
    fixed: { qty: number; targetMenuId?: number | null; targetVariantId?: number | null }[]
    choices: {
      label: string
      options: { targetMenuId?: number | null; targetVariantId?: number | null }[]
    }[]
  }
}
```

```typescript
// Resolve one (menu, variant?) to the leaf menu whose `cost` represents it.
// Unlike targetOf (stock): every menu has a cost, so simple/leaf returns itself
// regardless of stockType; nonStock variants fall back to costSource then own menu.
function costTargetOf(
  graph: Record<number, MenuNode>,
  menuId: number,
  variantId?: number | null,
): number | null {
  const node = graph[menuId]
  if (!node) return null
  if (node.kind === 'variant') {
    if (variantId == null) return menuId
    const v = node.variants?.[variantId]
    return v?.costSourceMenuId ?? v?.stockTargetMenuId ?? menuId
  }
  return menuId
}

// COGS component list: the leaf menus (with qty) whose cost sums to one unit's modal.
// Mirrors resolveStockTargets but includes nonStock components (nasi/drink) + the
// item's own cost. Returns {menuId, qty}[]; caller sums graph[menuId].cost * qty.
export function resolveCostComponents(
  graph: Record<number, MenuNode>,
  item: ChosenItem,
): StockDeduction[] {
  const node = graph[item.menuId]
  if (!node) return []
  const acc: StockDeduction[] = []
  const push = (menuId: number | null, qty: number) => {
    if (menuId != null) acc.push({ menuId, qty })
  }

  if (node.kind === 'paket' && node.paket) {
    for (const f of node.paket.fixed) {
      if (f.targetMenuId != null) push(costTargetOf(graph, f.targetMenuId, f.targetVariantId), f.qty)
    }
    for (const c of node.paket.choices) {
      const chosen = item.paketChoices?.[c.label]
      if (chosen?.targetMenuId != null) push(costTargetOf(graph, chosen.targetMenuId, chosen.variantId), 1)
    }
    return mergeDeductions(acc)
  }

  push(costTargetOf(graph, item.menuId, item.variantId), 1)
  return mergeDeductions(acc)
}
```

- [ ] **Step 4: Run - verify PASS**

Run: `cd backend && npx vitest run src/modules/menus/__tests__/variant-resolver.test.ts`
Expected: PASS (all existing + 5 new).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/menus/variant-resolver.ts backend/src/modules/menus/__tests__/variant-resolver.test.ts
git commit -m "feat(menus): REV 2.11 P1 - resolveCostComponents (cost-aware twin of resolveStockTargets) TDD"
```

---

## Task 3: Transaction - snapshot `unitCost` at order time

**Files:**
- Modify: `backend/src/modules/transactions/transactions.service.ts`

- [ ] **Step 1: Carry cost into the graph**

In `buildMenuGraph()` add `cost: true` to the menu `select` and `costSourceMenuId: true` to the `variants` select; populate the node:

```typescript
  const menus = await tx.menu.findMany({
    select: {
      id: true,
      kind: true,
      stockType: true,
      cost: true,
      variants: { select: { id: true, stockTargetMenuId: true, costSourceMenuId: true } },
      paketComponents: {
```
In the node-construction loop, after setting `stockType`:
```typescript
    node.cost = m.cost ? m.cost.toNumber() : 0
    if (m.variants.length > 0) {
      node.variants = {}
      for (const v of m.variants) {
        node.variants[v.id] = {
          id: v.id,
          stockTargetMenuId: v.stockTargetMenuId,
          costSourceMenuId: v.costSourceMenuId,
        }
      }
    }
```
(Replace the existing `if (m.variants.length > 0)` block with the version above.)

- [ ] **Step 2: Add `unitCost` to ResolvedItem**

In `interface ResolvedItem`, after `unitPrice: Prisma.Decimal;` add:
```typescript
  /// REV 2.11: snapshot modal per unit (Σ cost komponen). Beku di TransactionItem.unitCost.
  unitCost: Prisma.Decimal;
```

- [ ] **Step 3: Compute unitCost in resolveItems**

In `resolveItems()`, import `resolveCostComponents` (extend the existing import from `'../menus/variant-resolver'`). After the `const deductions = resolveStockTargets(...)` block, add:

```typescript
    const costComponents = resolveCostComponents(graph, {
      menuId: input.menuId,
      variantId,
      paketChoices: input.paketChoices,
    });
    const unitCost = costComponents.reduce(
      (acc, c) => acc.add(new Prisma.Decimal(graph[c.menuId]?.cost ?? 0).mul(c.qty)),
      new Prisma.Decimal(0),
    );
```
Then add `unitCost,` to the `resolved.push({ ... })` object literal (right after `unitPrice,`).

- [ ] **Step 4: Persist unitCost**

In `persistItemsAndDecrement()`, add `unitCost` to the `tx.transactionItem.create` data (after `subtotal`):
```typescript
        unitPrice: r.unitPrice,
        subtotal: r.unitPrice.mul(r.input.qty),
        unitCost: r.unitCost,
```

- [ ] **Step 5: Verify type-check**

Run: `cd backend && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/transactions/transactions.service.ts
git commit -m "feat(tx): REV 2.11 P2 - snapshot unitCost (Σ cost komponen) on order create + addItems"
```

---

## Task 4: Menu cost CRUD + change-history log (backend)

**Files:**
- Modify: `backend/src/modules/menus/menus.schema.ts`, `menus.service.ts`, `menus.controller.ts`, `menus.routes.ts`

- [ ] **Step 1: Zod - add cost + costSourceMenuId**

In `menus.schema.ts`, in `variantSchema` add after `stockTargetMenuId`:
```typescript
  stockTargetMenuId: z.number().int().positive().nullable().default(null),
  costSourceMenuId: z.number().int().positive().nullable().default(null),
```
In `menuUpsertSchema` `.object({...})` add after `minStock`:
```typescript
    minStock: z.number().int().nullable().optional(),
    cost: z.number().nonnegative().nullable().optional(),
```

- [ ] **Step 2: Service - owner-gated cost via `includeCost` param**

In `menus.service.ts`: add `cost: number | null` to the `MenuDetail` interface; add `costSourceMenuId: number | null` to `MenuVariantDetail`. Do NOT add cost to `MenuView`/`toMenuView` (the public base shape). Add an `includeCost` param to the detail mapper + readers so cost is emitted ONLY for owner reads:

```typescript
function toMenuDetail(menu: MenuWithDetail, includeCost = false): MenuDetail {
  return {
    ...toMenuView(menu),
    cost: includeCost && menu.cost ? menu.cost.toNumber() : null,
    optionGroups: /* unchanged */,
    variants: menu.variants.map((v) => ({
      // ...existing fields...
      costSourceMenuId: v.costSourceMenuId,
    })),
    paketComponents: /* unchanged */,
  };
}
```
Thread `includeCost` through the readers: `listMenus(query, includeCost = false)` (map `toMenuDetail(m, includeCost)`), `getMenuDetail(id, includeCost = false)`, `getMenuById(id, includeCost = false)`. `upsertMenu` returns `getMenuDetail(menuId, true)` (owner endpoint → always include).

> `Menu.cost` is a scalar → auto-fetched by the existing includes, no include change. But if `menuDetailInclude` uses a `select` (not `include`) on `variants`, add `costSourceMenuId: true` to that variant select so `v.costSourceMenuId` is available in `toMenuDetail` (tsc in Step 7 catches it if missing).

> **Why a param, not "owner-only route":** owner MenuPage (list) + edit form (detail) read via the SAME public `GET /` & `GET /:id` that POS uses. To let the owner SEE/EDIT cost while POS never receives it, the GET routes get a *soft* auth (Step 5/6): `includeCost = req.user?.role === 'owner'`. POS sends no token → `includeCost=false` → cost omitted. Owner axios injects the JWT → cost included.

- [ ] **Step 2b: Add `authenticateOptional` middleware**

In `backend/src/middleware/auth.ts` add a variant that sets `req.user` if a valid bearer token is present but NEVER rejects when it is absent/invalid (so POS stays public):

```typescript
export const authenticateOptional: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = verifyToken(header.slice(7)); // same verify used by `authenticate`
      req.user = { id: payload.userId, role: payload.role };
    } catch {
      /* ignore invalid token - treat as anonymous */
    }
  }
  next();
};
```
(Reuse whatever `authenticate` uses to verify + the same `req.user` shape; do not throw.)

- [ ] **Step 3: Service - persist cost/costSource + MenuCostMovement (thread userId)**

Change signature to `export async function upsertMenu(id: number | null, input: MenuUpsertInput, userId: number): Promise<MenuDetail>`. In the create branch `tx.menu.create` data and update branch `tx.menu.update` data, add after `imageUrl`:
```typescript
        imageUrl: input.imageUrl ?? null,
        cost: input.cost == null ? null : new Prisma.Decimal(input.cost),
```
In the variant create loop add `costSourceMenuId: variant.costSourceMenuId ?? null,` to `tx.menuVariant.create` data (after `stockTargetMenuId`).

In the UPDATE branch, `existing` is already fetched - after the `tx.menu.update`, log the change:
```typescript
      const newCost = input.cost == null ? null : new Prisma.Decimal(input.cost);
      const changed =
        (existing.cost == null) !== (newCost == null) ||
        (existing.cost != null && newCost != null && !existing.cost.equals(newCost));
      if (changed) {
        await tx.menuCostMovement.create({
          data: { menuId: baseId, costBefore: existing.cost, costAfter: newCost, reason: 'manualEdit', userId },
        });
      }
```
In the CREATE branch, after `baseId = created.id;`, if `input.cost != null` log an `initialSet` row:
```typescript
      if (input.cost != null) {
        await tx.menuCostMovement.create({
          data: { menuId: baseId, costBefore: null, costAfter: new Prisma.Decimal(input.cost), reason: 'initialSet', userId },
        });
      }
```
Change the final return to `return getMenuDetail(menuId, true);`.

In `validateMenuReferences`, add `input.costSourceMenuId` for each variant into the validated `menuIds` set (so an invalid cost-source FK throws AppError(400) atomically), mirroring `variant.stockTargetMenuId`.

- [ ] **Step 4: Service - getCostHistory**

Add:
```typescript
export interface MenuCostMovementView {
  id: number;
  costBefore: number | null;
  costAfter: number | null;
  reason: 'initialSet' | 'manualEdit';
  note: string | null;
  userId: number;
  userName: string;
  createdAt: string;
}

export async function getCostHistory(menuId: number): Promise<MenuCostMovementView[]> {
  const rows = await prisma.menuCostMovement.findMany({
    where: { menuId },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true } } },
  });
  return rows.map((m) => ({
    id: m.id,
    costBefore: m.costBefore ? m.costBefore.toNumber() : null,
    costAfter: m.costAfter ? m.costAfter.toNumber() : null,
    reason: m.reason,
    note: m.note,
    userId: m.userId,
    userName: m.user.name,
    createdAt: m.createdAt.toISOString(),
  }));
}
```

- [ ] **Step 5: Controller - owner cost gating + thread userId + handleCostHistory**

In `menus.controller.ts` import `unauthorized` from `'../../utils/errors'` and `UserRole` from `'@prisma/client'`. Update `handleList`/`handleDetail` to pass owner-gated `includeCost`, and add the create/update userId + cost-history handlers:
```typescript
export const handleList = asyncHandler(async (req, res) => {
  const query = listQuerySchema.parse(req.query);
  const includeCost = req.user?.role === UserRole.owner;
  const menus = await menusService.listMenus(query, includeCost);
  sendSuccess(res, { menus }, 'Daftar menu');
});

export const handleDetail = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const includeCost = req.user?.role === UserRole.owner;
  const menu = await menusService.getMenuDetail(id, includeCost);
  sendSuccess(res, { menu }, 'Detail menu');
});

export const handleCreate = asyncHandler(async (req, res) => {
  if (!req.user) throw unauthorized();
  const input = menuUpsertSchema.parse(req.body);
  const menu = await menusService.upsertMenu(null, input, req.user.id);
  sendSuccess(res, { menu }, 'Menu berhasil dibuat', 201);
});

export const handleUpdate = asyncHandler(async (req, res) => {
  if (!req.user) throw unauthorized();
  const id = parseId(req.params.id);
  const input = menuUpsertSchema.parse(req.body);
  const menu = await menusService.upsertMenu(id, input, req.user.id);
  sendSuccess(res, { menu }, 'Menu berhasil diperbarui');
});

export const handleCostHistory = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const movements = await menusService.getCostHistory(id);
  sendSuccess(res, { movements }, 'Riwayat modal menu');
});
```

- [ ] **Step 6: Route - soft-auth GETs + owner-only cost-history**

In `menus.routes.ts` import `authenticateOptional` (from `'../../middleware/auth'`) + `handleCostHistory`. Change the public reads to soft-auth so owner reads carry cost, and add the owner-only cost-history route:
```typescript
// Public reads (soft auth: owner token → cost included; anon/POS → cost omitted)
router.get('/', authenticateOptional, handleList);
router.get('/:id', authenticateOptional, handleDetail);

// Owner-only riwayat modal
router.get('/:id/cost-history', authenticate, requireRole(UserRole.owner), handleCostHistory);
```
(`'/:id/cost-history'` is a distinct path from `'/:id'` so ordering is safe.)

- [ ] **Step 7: Verify type-check**

Run: `cd backend && npx tsc --noEmit`
Expected: zero errors. (If a non-route caller of `upsertMenu` exists, pass a userId or update it - grep `upsertMenu(` first.)

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/menus
git commit -m "feat(menus): REV 2.11 P3 - owner cost CRUD + MenuCostMovement log + GET /:id/cost-history (cost owner-only)"
```

---

## Task 5: Dashboard - Laba = Pendapatan − COGS

**Files:**
- Modify: `backend/src/modules/dashboard/dashboard.service.ts`, `frontend/src/services/dashboardService.ts`, `frontend/src/pages/OwnerDashboard.tsx`

- [ ] **Step 1: Backend - COGS helper + replace purchase aggregate**

In `dashboard.service.ts` add a helper:
```typescript
async function cogsTotalFor(txWhere: Prisma.TransactionWhereInput): Promise<number> {
  const rows = await prisma.transactionItem.findMany({
    where: { transaction: { ...txWhere, mergedIntoId: null } },
    select: { unitCost: true, qty: true },
  });
  return rows.reduce((s, r) => s + (r.unitCost ? r.unitCost.toNumber() : 0) * r.qty, 0);
}
```
In `getOwnerReport`, in the `Promise.all`, replace the `prisma.purchase.aggregate({...})` element with `cogsTotalFor(txWhere)`, and rename the destructured slot from `purchasesAgg` to `cogsTotal`. Replace the post-await computation:
```typescript
  const billTotal = billsAgg._sum.amount?.toNumber() ?? 0;
  const profit = revenue - cogsTotal;
```
and the returned `expense` object:
```typescript
    expense: {
      cogsTotal,
      billTotal,
      total: cogsTotal,
    },
```

- [ ] **Step 2: Backend - OwnerReportView type**

Change `OwnerReportView.expense` to `{ cogsTotal: number; billTotal: number; total: number }` and update the `profit` comment to `revenue.total − cogsTotal`.

- [ ] **Step 3: Frontend - OwnerReport type**

In `dashboardService.ts` change `OwnerReport.expense` to `{ cogsTotal: number; billTotal: number; total: number }`.

- [ ] **Step 4: Frontend - OwnerDashboard cards**

In `OwnerDashboard.tsx` change the middle Stat: `label="Beban Pokok (COGS)"`, `value={report.expense.cogsTotal}`, hint `={`Tagihan ${formatCurrency(report.expense.billTotal)} (terpisah)`}`. Change the "Laba Kotor" card hint to `"Pendapatan − COGS"`.

- [ ] **Step 5: Verify**

Run: `cd backend && npx tsc --noEmit` → zero errors.
(Frontend build verified in Task 14.)

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/dashboard frontend/src/services/dashboardService.ts frontend/src/pages/OwnerDashboard.tsx
git commit -m "feat(dashboard): REV 2.11 P4 - Laba = Pendapatan − COGS (Σ unitCost×qty), tagihan terpisah"
```

---

## Task 6: Frontend - cost input, types, service, history drawer

**Files:**
- Modify: `frontend/src/types/index.ts`, `frontend/src/services/menuService.ts`, `frontend/src/components/MenuFormModal.tsx`, `frontend/src/components/menu/VariantBuilder.tsx`, `frontend/src/pages/MenuPage.tsx`

- [ ] **Step 1: Types**

In `types/index.ts`: add `cost?: number | null` to `Menu`; add `cost?: number | null` to `MenuUpsertPayload`; add `costSourceMenuId?: number | null` to `MenuVariant` and `MenuVariantUpsertPayload`. After `PortionMovementView` add:
```typescript
export type MenuCostChangeReason = 'initialSet' | 'manualEdit'
export const COST_REASON_LABEL: Record<MenuCostChangeReason, string> = {
  initialSet: 'Set Awal',
  manualEdit: 'Penyesuaian Modal',
}
export interface MenuCostMovementView {
  id: number
  costBefore: number | null
  costAfter: number | null
  reason: MenuCostChangeReason
  note: string | null
  userId: number
  userName: string
  createdAt: string
}
```

- [ ] **Step 2: Service**

In `menuService.ts` add (import `MenuCostMovementView` from `'@/types'`):
```typescript
  costHistory: async (id: number): Promise<MenuCostMovementView[]> => {
    const res = await api.get<ApiResponse<{ movements: MenuCostMovementView[] }>>(`/menus/${id}/cost-history`)
    return res.data.data.movements
  },
```

- [ ] **Step 3: MenuFormModal - cost field + margin**

Add `import { formatCurrency } from '@/lib/utils'`. Add `cost: number` to `FormState`; `cost: 0` (new) / `cost: existing.cost ?? 0` (edit) in `initFromExisting`; `cost: state.cost` in `buildPayload`. After the Kategori+Harga grid add a cost Input (mirror price) shown only for `state.mode === 'simple'` (leaf/simple carry cost; variant/paket parents leave it 0 - cost lives on leaves):
```tsx
        {state.mode === 'simple' && (
          <div>
            <Input
              label="Harga Modal / COGS (Rp)"
              type="number" inputMode="numeric"
              value={state.cost || ''}
              onChange={(e) => update('cost', Number(e.target.value) || 0)}
              min={0} step={1000} placeholder="0"
              helper="Modal per porsi (untuk laba). Boleh dikosongkan = 0."
            />
            {state.cost > 0 && state.price > 0 && (
              <p className="text-caption text-neutral-500 mt-1">
                Margin {formatCurrency(state.price - state.cost)} (
                {(((state.price - state.cost) / state.price) * 100).toFixed(0)}%)
              </p>
            )}
          </div>
        )}
```

- [ ] **Step 4: VariantBuilder - costSource round-trip + per-row picker**

Add `costSourceMenuId: number | null` to `VariantOverride` and `ComputedVariantRow`; emit `costSourceMenuId: override?.costSourceMenuId ?? null` in `computeVariantRows`; add `costSourceMenuId: row.costSourceMenuId` in `buildVariantsPayload`; seed `costSourceMenuId: v.costSourceMenuId ?? null` in `menuToVariantBuilderState`. Add a third combobox in the per-row JSX (after the stock-target combobox), shown only when `row.stockTargetMenuId === null` (nonStock variant - modal source needed):
```tsx
                  {row.stockTargetMenuId === null && (
                    <MenuTargetCombobox
                      value={row.costSourceMenuId !== null ? String(row.costSourceMenuId) : ''}
                      onChange={(v) => setOverride(row.signature, { costSourceMenuId: v ? Number(v) : null })}
                      options={stockTargetOptions}
                      label="Modal ikut menu (SKU tersembunyi)"
                      placeholder="- pakai modal menu ini -"
                    />
                  )}
```

- [ ] **Step 5: MenuPage - cost column + history drawer**

Add `import { History } from 'lucide-react'` (extend existing import) and `import { StockHistorySheet, type HistoryMovement } from '@/components/stock/StockHistorySheet'`, `import { COST_REASON_LABEL } from '@/types'`. Add state `const [historyMenuId, setHistoryMenuId] = useState<number | null>(null)`. Change the list query to pass `includeHidden: true` so leaf SKUs are editable. Add a "Modal" column after the price column rendering `m.cost != null ? formatCurrency(m.cost) : '-'`. Add a History `IconButton` (first action) `onClick={() => setHistoryMenuId(m.id)}` in both desktop + mobileCard action blocks. Add the drawer + query as a sibling of `<MenuFormModal>`:
```tsx
        {historyMenuId != null && <CostHistoryDrawer menuId={historyMenuId} onClose={() => setHistoryMenuId(null)} />}
```
and define `CostHistoryDrawer` (inside the file):
```tsx
function CostHistoryDrawer({ menuId, onClose }: { menuId: number; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['menuCostHistory', menuId],
    queryFn: () => menuService.costHistory(menuId),
  })
  const movements: HistoryMovement[] = (data ?? []).map((m) => ({
    id: m.id,
    reasonLabel: COST_REASON_LABEL[m.reason],
    delta: (m.costAfter ?? 0) - (m.costBefore ?? 0),
    qtyBefore: m.costBefore,
    qtyAfter: m.costAfter,
    note: m.note,
    userName: m.userName,
    createdAt: m.createdAt,
    sourceLabel: null,
  }))
  return (
    <StockHistorySheet
      open onOpenChange={(o) => !o && onClose()}
      title="Riwayat Modal" isLoading={isLoading} movements={movements} unitSuffix="Rp"
    />
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/services/menuService.ts frontend/src/components/MenuFormModal.tsx frontend/src/components/menu/VariantBuilder.tsx frontend/src/pages/MenuPage.tsx
git commit -m "feat(fe): REV 2.11 P5 - cost input + margin + cost column + riwayat modal drawer + variant costSource"
```

---

## Task 7: Catalog seed + backfill (costSource + cost values + historical unitCost)

**Files:**
- Modify: `backend/prisma/variant-catalog.ts`
- Create: `backend/scripts/backfill-cogs.ts`

- [ ] **Step 1: variant-catalog - costSourceName for nonStock variants**

Add optional `costSourceName?: string` to `VariantSpec`. For the nonStock variant menus where modal differs (Es Teh, Es Jeruk, Tahu Tempe), set `costSourceName` to the matching hidden leaf (e.g. Es Teh `{ Rasa:'Tawar', Ukuran:'Biasa' }` → `costSourceName: 'Teh Tawar Biasa'`; Es Jeruk `Murni` → `'Jeruk Murni'`; Tahu Tempe `Penyet` → `'Tahu Tempe Penyet'`). In `applyVariantCatalog` (backfill), resolve `costSourceName` → menu id and set it on the created variant (alongside `stockTargetMenuId`). Telur/Sambal (uniform modal) may omit it.

- [ ] **Step 2: backfill-cogs.ts**

Create a script that (a) is idempotent, (b) builds the menu graph + costMap from current `Menu.cost`, (c) for every `TransactionItem` whose `transaction.status='paid'`, reconstructs `ChosenItem` (`menuId`, `variantId`, and `paketChoices` from its `selections` where `isPreference=false`), runs `resolveCostComponents`, computes `unitCost`, and updates the row. Run only after the owner has entered costs. Use the existing `reconstructPaketChoices`/graph helpers from `transactions.service.ts` as reference (import or replicate the pure parts). Log counts (updated / skipped / zero-cost).

- [ ] **Step 3: Verify (dev)**

Run: `cd backend && npx tsx --env-file=.env scripts/backfill-cogs.ts`
Expected: logs "costSource set: N", "unitCost backfilled: M items", "0 errors". Re-run → idempotent (no double change).

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/variant-catalog.ts backend/scripts/backfill-cogs.ts
git commit -m "feat(scripts): REV 2.11 P6 - seed costSource for nonStock variants + backfill historical unitCost"
```

---

## Task 8: Smoke test COGS end-to-end

**Files:**
- Create: `backend/scripts/smoke-cogs.ts`

- [ ] **Step 1: Write smoke (against `.env.test` DB `pos_restaurant_test`)**

Cover: set a leaf SKU cost via upsertMenu (assert MenuCostMovement initialSet row), edit it (assert manualEdit row + costBefore/After), order a variant (assert TransactionItem.unitCost = leaf cost), order a paket (assert unitCost = Σ component costs), call getOwnerReport (assert `expense.cogsTotal` = Σ unitCost×qty and `profit = revenue − cogsTotal`), confirm `GET /menus` (public) response has NO `cost` field.

- [ ] **Step 2: Run**

Run: `cd backend && npx tsx --env-file=.env.test scripts/smoke-cogs.ts`
Expected: all assertions PASS, exit 0.

- [ ] **Step 3: Commit**

```bash
git add backend/scripts/smoke-cogs.ts
git commit -m "test(cogs): REV 2.11 P7 - smoke COGS (cost log + unitCost snapshot + dashboard profit + no public leak)"
```

---

# PHASE B - Remove belanja / vendor / raw materials (DESTRUCTIVE)

> Run only after Phase A is verified. The schema drop is destructive (loses imported belanja data); PROD is HARD-GATED.

## Task 9: Backend removal - modules, routes, reminders, seed

**Files:**
- Modify: `backend/src/app.ts`, `backend/src/modules/stocks/stocks.routes.ts`, `backend/src/modules/dashboard/dashboard.service.ts`, `backend/prisma/seed.ts`
- Delete: `backend/src/modules/purchases/`, `backend/src/modules/vendors/`, `backend/src/modules/stocks/raw-materials.*`

- [ ] **Step 1: Unmount + delete modules**

In `app.ts` delete the `vendorRoutes`/`purchaseRoutes` imports (lines ~19-20) and `app.use('/api/vendors', ...)` + `app.use('/api/purchases', ...)` (lines ~50-51). In `backend/src/modules/stocks/stocks.routes.ts` unmount the raw-materials sub-router (keep portion). Delete dirs `backend/src/modules/vendors/`, `backend/src/modules/purchases/`, and files `backend/src/modules/stocks/raw-materials.*`.

- [ ] **Step 2: Verify `units` usage, then delete if dead**

Run: `cd backend && grep -rn "modules/units\|prisma.unit\b\|unitByLabel" src/ prisma/ | grep -v raw-materials`
If only raw-material references remain → delete `backend/src/modules/units/`, its `app.ts` import + `app.use`, and the `Unit` model + `OpnameMode`/`RawMaterialCategory` enums in Task 10. If used elsewhere → keep Unit (flag in commit).

- [ ] **Step 3: Fix reminderCounts (raw_materials table will be dropped)**

In `dashboard.service.ts` `reminderCounts()`: delete the `rmLowRaw` and `rmNearRaw` raw SQL queries; return `{ portionLowCount }` only. Update `ReminderCounts` interface to `{ portionLowCount: number }`. Remove `rawMaterialLowCount`/`rawMaterialNearExpiryCount` from `getCashierDashboard` + `getWaiterDashboard` (delete the waiter `rmReminders` loop). Update their view types.

- [ ] **Step 4: Seed cleanup**

In `seed.ts` delete `seedVendors` + `vendors` array + the `await seedVendors()` call; delete `seedRawMaterials` + `rawMaterials` array + `RawMaterialSeed` interface + `await seedRawMaterials(...)`; if units dead, delete `seedUnits` + `unitSeeds` + `const unitByLabel = ...` + unused enum imports. Update the header comment.

- [ ] **Step 5: Verify**

Run: `cd backend && npx tsc --noEmit`
Expected: errors ONLY at prisma client call sites for dropped models (resolved in Task 10 after `db push`). If errors elsewhere, fix imports.

- [ ] **Step 6: Commit**

```bash
git add backend/src
git commit -m "refactor(be): REV 2.11 P8 - remove purchases/vendors/raw-materials modules + routes + reminders + seed"
```

---

## Task 10: Schema drop + db push

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Drop models + enum + back-relations**

Delete models `RawMaterial`, `RawMaterialMovement`, `Vendor`, `Purchase`, `PurchaseItem` (and their leading `///` doc comments) and enum `RawMaterialMovementReason`. In `model User` delete `purchases Purchase[]` and `rawMaterialMovements RawMaterialMovement[]`. If `units` confirmed dead (Task 9 Step 2): delete `model Unit` + its `rawMaterials RawMaterial[]` inverse + enums `OpnameMode`, `RawMaterialCategory`; otherwise just delete `Unit.rawMaterials RawMaterial[]`.

- [ ] **Step 2: Validate + push**

Run: `cd backend && npx prisma format && npx prisma validate` → valid.
Run: `cd backend && npx prisma db push` → drops tables (dev). Confirm prompt acknowledges data loss for raw_materials/vendors/purchases/purchase_items/raw_material_movements.

- [ ] **Step 3: Verify type-check**

Run: `cd backend && npx tsc --noEmit`
Expected: zero errors (regenerated client no longer exposes dropped models).

- [ ] **Step 4: Re-run COGS smoke**

Run: `cd backend && npx tsx --env-file=.env.test scripts/smoke-cogs.ts` (after `prisma db push` on test DB) → PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(schema)!: REV 2.11 P9 - drop Vendor/Purchase/PurchaseItem/RawMaterial/RawMaterialMovement (+Unit if dead)"
```

---

## Task 11: Frontend removal

**Files:**
- Modify: `frontend/src/App.tsx`, `Layout.tsx`, `CashierDashboard.tsx`, `StockPage.tsx`, `services/index.ts`, `pages/index.ts`, `types/index.ts`
- Delete: `frontend/src/pages/PurchasesPage.tsx`, `frontend/src/services/{purchaseService,vendorService,rawMaterialsService}.ts`, `frontend/src/components/stock/RawMaterialsTab.tsx`

- [ ] **Step 1: Routes + nav**

`App.tsx`: delete `PurchasesPage` import + `<Route path="purchases" ...>`. `Layout.tsx`: delete the `Belanja` entry from owner + cashier `NAV_BY_ROLE`, delete unused `ShoppingCart` import.

- [ ] **Step 2: Dashboards**

`CashierDashboard.tsx`: delete the `Catat Pembelian Pasar` `<Link to="/purchases">` block + unused `ShoppingCart` import; delete the two raw-material `<li>` rows in `ReminderCard` and simplify `total` to `portionLowCount`. Update the cashier reminders prop type to drop raw-material fields. `OwnerDashboard.tsx`: delete the two raw-material `<li>` rows in `ReminderCard` (keep "Stok porsi"); optionally drop the `/purchases` QuickLink.

- [ ] **Step 3: StockPage → Portion-only**

Collapse to single view: drop `RawMaterialsTab`/`Sprout`/`Tabs` imports + `tab` state, render `<PortionStockTab />` directly under the header.

- [ ] **Step 4: Barrels + service/page deletes + types**

`services/index.ts`: delete `vendorService`/`purchaseService`/`rawMaterialsService` exports. `pages/index.ts`: delete `PurchasesPage` export. Delete the files. In `types/index.ts` remove `Vendor`/`Purchase`/`PurchaseItemView`/`RawMaterial*` interfaces; grep for dangling usages and prune.

- [ ] **Step 5: Verify**

Run: `cd frontend && npx tsc -b`
Expected: zero errors (fix any TS6133 unused-import / TS2307 missing-module).

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "refactor(fe): REV 2.11 P10 - remove Belanja page/services/nav + RawMaterials tab + dashboard rows"
```

---

# PHASE C - Docs + final verification

## Task 12: Docs realign to proposal

**Files:**
- Modify: `docs/operasional-resto.md`, `docs/knowledge/{ERD,USE-CASE,ACTIVITY,DATA-DICTIONARY,FULL,BAB-3-DRAFT}.md`, `docs/superpowers/specs/2026-05-24-permission-matrix-design.md`, memory files
- Modify: `CLAUDE.md` (add REV 2.11 status row)

- [ ] **Step 1: operasional-resto.md**

Delete the "Pembelian (Belanja Kasir)", "Vendor", and "HPP dan Laba Rugi (Out of Scope)" sections + the `portion_stocks` "tidak menyimpan harga" note + raw-materials sections. Add a "COGS per Menu + Laporan Laba Rugi Harian" section: modal owner-input per menu (leaf SKU), Laba Kotor = Pendapatan − COGS (Σ Harga Modal Satuan × Jumlah Terjual), tagihan terpisah; inventori = finished-goods porsi saja. Remove the "Mencatat pembelian" + raw-material rows from the Permission Matrix; add "Edit modal/COGS menu = owner-only".

- [ ] **Step 2: knowledge docs + permission spec + CLAUDE.md**

ERD: drop Vendor/Purchase/PurchaseItem/RawMaterial/RawMaterialMovement (+Unit if dropped); add `MenuCostMovement` + `Menu.cost` + `TransactionItem.unitCost` + `MenuVariant.costSourceMenuId`; recompute entity/relation counts. USE-CASE: drop "Mencatat Pembelian" + raw-material UCs; add "Kelola Modal/COGS Menu". ACTIVITY: drop pembelian diagram. DATA-DICTIONARY: drop dropped tables, add new fields/table. BAB-3-DRAFT: update functional-requirement list. permission-matrix spec: drop pembelian rows, add COGS-edit owner-only. CLAUDE.md: add a REV 2.11 status row.

- [ ] **Step 3: Memory**

Update `project_resto_operational_truths.md` (HPP→COGS, drop belanja/raw-materials, laba=pendapatan−COGS) and `project_session_handoff.md`. Add `MEMORY.md` pointer for a new `project_cogs_rev211.md` continuity note.

- [ ] **Step 4: Commit**

```bash
git add docs CLAUDE.md
git commit -m "docs: REV 2.11 P11 - realign ground-truth + knowledge docs to COGS model (remove belanja/raw-materials)"
```

---

## Task 13: Full verification (verification-before-completion)

- [ ] **Step 1: Backend**

Run: `cd backend && npx tsc --noEmit` → 0 errors.
Run: `cd backend && npx vitest run` → all pass.
Run: `cd backend && npx tsx --env-file=.env.test scripts/smoke-cogs.ts` → PASS.

- [ ] **Step 2: Frontend**

Run: `cd frontend && npm run build` → EXIT 0 (tsc -b + vite build).
Run: `cd frontend && npm run lint` → 0 errors.

- [ ] **Step 3: Manual e2e (browser, dev DB)**

`npm run dev`. As owner: set modal on leaf SKUs (e.g. Paha Ayam Bakar, Jeruk Murni) → MenuPage shows Modal column + margin; open Riwayat Modal drawer (shows initialSet). Order a variant (Ayam Potong–Paha) + paket (Paket A) → pay. OwnerDashboard: COGS card + Laba = Pendapatan − COGS, Tagihan separate. Confirm: no "Belanja" nav, `/purchases` 404, Stok has no Raw Materials tab, `GET /menus` (devtools) has no `cost`.

- [ ] **Step 4: Record evidence**

Note command outputs (exit codes) + e2e observations. Only claim complete with evidence.

---

## Task 14: Prod runbook note (do NOT execute here)

- [ ] **Step 1: Document the gated prod migration**

Append to the spec / a runbook: prod migrate order = (1) deploy REV 2.10 additive variant schema + `backfill-menu-variants.ts` (still pending), then (2) REV 2.11 additive (`Menu.cost`/`costSourceMenuId`/`unitCost`/`MenuCostMovement`) via `prisma db push`, (3) owner enters costs, (4) `backfill-cogs.ts`, (5) verify, (6) drop belanja/raw-materials tables (mysqldump first). All HARD-GATED; do not run against `monosuko.my.id` without explicit go-ahead.

- [ ] **Step 2: Commit (if runbook added to a file)**

```bash
git add docs
git commit -m "docs: REV 2.11 - prod migration runbook (hard-gated, sequenced after REV 2.10)"
```

---

## Notes for the implementer

- **Decimal everywhere** for money (`.mul`/`.add`/`.equals`), never JS `+`/`*` on Decimals. `?.toNumber() ?? 0` to serialize.
- **unitCost is per-unit** (like unitPrice) - never multiply by `qty` when snapshotting; line cost derives as `unitCost × qty`.
- **Cost never leaks to public** `GET /menus` - only owner-gated detail/upsert/cost-history responses carry it.
- **Variant rebuild**: `costSourceMenuId` survives edits via the `variantSignature`-keyed override round-trip (Task 6 Step 4) - verify by editing a seeded nonStock variant menu and re-checking its costSource.
- **`db push` only** - never `migrate reset`/`--force-reset`/`db:fresh` (real data in dev + prod).
- Smoke scripts run ONLY against `.env.test` (`pos_restaurant_test`).
