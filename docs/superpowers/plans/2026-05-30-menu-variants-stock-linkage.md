# Menu Variants + Stock Linkage Redesign (REV 2.10) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the name-string-in-JSON menu→stock linkage with a normalized, FK-backed **catalog layer** (option groups + variants with exact per-combination prices + normalized paket), sitting on top of the **unchanged** inventory layer (`PortionStock` keyed by `menuId`), and make the whole thing owner-configurable so new variant menus need zero code.

**Architecture:** Approach A from the spec ("variants as a layer"). New tables `menu_option_groups`, `menu_options`, `menu_variants`, `menu_variant_options`, `paket_components`, `paket_choice_options`, `transaction_item_selections`; `Menu` gains `kind` + `posVisible`; `TransactionItem` gains `variantId`. Order-time stock resolution becomes FK-based (`resolveStockTargets`). Granular stock SKUs stay but hide from POS; variants FK into them. Migration is additive + history-safe (old menus never deleted/repointed).

**Tech Stack:** Backend Express 4 + TypeScript + Prisma + MySQL, Zod, Vitest. Frontend React 18 + TS + Vite + Tailwind + React Query + Zustand. Response shape `{success,message,data}`; `AppError(msg,status)`; Zod errors → 422.

**Spec:** [docs/superpowers/specs/2026-05-30-menu-variants-stock-linkage-design.md](../specs/2026-05-30-menu-variants-stock-linkage-design.md) (D1–D13).

---

## Branch / Worktree

- [ ] Create a fresh branch from `main` (NOT from `feat/ux-elevation-rev29`): `feat/menu-variants-rev210`. (Recommended: a git worktree via superpowers:using-git-worktrees at execution start.)
- Do all work here. Workstream B stays parked on its own branch.

## Critical Don'ts (carry from prior migrations)

- NEVER `prisma migrate reset` / `db push --force-reset` / `db:fresh` on LOCAL or PROD — both hold real data. All schema changes here are **additive** → `prisma db push` only.
- Smoke scripts delete data — run ONLY against `pos_restaurant_test` via `npx tsx --env-file=.env.test scripts/...`. The guard (refuse non-`_test` DB) must be honored/added.
- Local dev `.env` may be missing (deleted earlier) — set `$env:DATABASE_URL="mysql://root:@localhost:3306/pos_restaurant"` or recreate from `.env.example` before running scripts. Prod `.env` is loopback and intact.
- Migration on PROD = backup (mysqldump) first, off-peak, verify counts before/after.

## File Structure (decomposition)

**Backend (new/modified):**
- `backend/prisma/schema.prisma` — add enums `MenuKind`, `PaketComponentKind`; new models; extend `Menu`, `TransactionItem`.
- `backend/src/modules/menus/menus.schema.ts` — add Zod for option-group/variant/paket builder payloads (keep legacy linked/paket JSON schemas during transition for the backfill validator only).
- `backend/src/modules/menus/menus.service.ts` — variant/paket CRUD + nested fetch for POS/owner.
- `backend/src/modules/menus/menus.controller.ts` + `menus.routes.ts` — endpoints.
- `backend/src/modules/menus/variant-resolver.ts` — **NEW pure module**: `resolveStockTargets`, `buildVariantLabel`, combination helpers (unit-tested).
- `backend/src/modules/transactions/transactions.service.ts` — use `resolveStockTargets`; record `variantId` + `transaction_item_selections`; drop name resolver.
- `backend/src/modules/transactions/transactions.schema.ts` — order item payload gains `variantId?` + `selections?`/`paketChoices?`.
- `backend/prisma/menu-catalog.ts` + `seed.ts` — express the new catalog (variant menus) for fresh DBs.
- `backend/scripts/backfill-menu-variants.ts` — **NEW** idempotent backfill (JSON→tables, create display menus, hide granular SKUs).
- `backend/scripts/smoke-menu-variants.ts` — **NEW** integration smoke (test DB).
- `backend/src/modules/menus/__tests__/variant-resolver.test.ts` — **NEW** Vitest unit tests.

**Frontend (new/modified):**
- `frontend/src/types/index.ts` — `MenuKind`, `OptionGroup`, `Option`, `MenuVariant`, `PaketComponent`, `PaketChoiceOption`, `TransactionItemSelection`; extend `Menu`, order payloads.
- `frontend/src/services/menuService.ts` — variant/paket CRUD + nested reads.
- `frontend/src/components/MenuFormModal.tsx` — progressive disclosure shell.
- `frontend/src/components/menu/VariantBuilder.tsx` — **NEW** (option groups + auto variant grid).
- `frontend/src/components/menu/PaketBuilder.tsx` — adapt to FK refs (reuse).
- `frontend/src/components/VariantPickerModal.tsx` — **NEW** generic POS picker (replaces `SubOptionsModal`).
- `frontend/src/components/MenuGrid.tsx` — filter `posVisible`, open picker by `kind`.
- `frontend/src/stores/cartStore.ts` — carry `variantId` + `selections`.
- `frontend/src/services/transactionService.ts` — order payload.
- `frontend/src/pages/HistoryPage.tsx` — display variant + selections.
- `frontend/src/pages/MenuPage.tsx` — show variants; revise B2 `menuStockLink` to use FK.
- `frontend/src/lib/menuStockLink.ts` — simplify to FK-based (no name match).

---

# PHASE 0 — Schema (additive) + Prisma client

### Task 0.1: Add enums + new models + extend Menu/TransactionItem

**Files:** Modify `backend/prisma/schema.prisma`

- [ ] **Step 1: Add enums** (near existing `StockType`):

```prisma
enum MenuKind {
  simple  @map("simple")
  variant @map("variant")
  paket   @map("paket")
}

enum PaketComponentKind {
  fixed  @map("fixed")
  choice @map("choice")
}
```

- [ ] **Step 2: Extend `Menu`** — add fields + relations (keep all existing fields, incl. `subOptions Json?` for now):

```prisma
  // REV 2.10
  kind        MenuKind @default(simple) @map("kind")
  posVisible  Boolean  @default(true)   @map("pos_visible")

  optionGroups        MenuOptionGroup[]
  variants            MenuVariant[]      @relation("MenuOwnsVariant")
  variantStockTargets MenuVariant[]      @relation("VariantStockTarget")
  paketComponents     PaketComponent[]   @relation("PaketOwner")
  fixedInComponents   PaketComponent[]   @relation("PaketComponentTargetMenu")
  choiceOptionMenus   PaketChoiceOption[] @relation("ChoiceOptTargetMenu")
```

- [ ] **Step 3: Add new models:**

```prisma
/// REV 2.10: grup pilihan per-menu (axis varian / free preference).
model MenuOptionGroup {
  id             Int          @id @default(autoincrement())
  menuId         Int          @map("menu_id")
  name           String       @db.VarChar(50)
  affectsVariant Boolean      @default(true) @map("affects_variant")
  displayOrder   Int          @default(0) @map("display_order")
  menu           Menu         @relation(fields: [menuId], references: [id], onDelete: Cascade)
  options        MenuOption[]
  @@map("menu_option_groups")
}

model MenuOption {
  id             Int                 @id @default(autoincrement())
  optionGroupId  Int                 @map("option_group_id")
  label          String              @db.VarChar(50)
  displayOrder   Int                 @default(0) @map("display_order")
  group          MenuOptionGroup     @relation(fields: [optionGroupId], references: [id], onDelete: Cascade)
  variantOptions MenuVariantOption[]
  @@map("menu_options")
}

/// Kombinasi sellable. price = harga eksak per-kombinasi (D2).
model MenuVariant {
  id                Int                 @id @default(autoincrement())
  menuId            Int                 @map("menu_id")
  label             String              @db.VarChar(120)
  price             Decimal             @db.Decimal(10, 2)
  stockTargetMenuId Int?                @map("stock_target_menu_id")
  isActive          Boolean             @default(true) @map("is_active")
  displayOrder      Int                 @default(0) @map("display_order")
  menu              Menu                @relation("MenuOwnsVariant", fields: [menuId], references: [id], onDelete: Cascade)
  stockTarget       Menu?               @relation("VariantStockTarget", fields: [stockTargetMenuId], references: [id], onDelete: Restrict)
  options           MenuVariantOption[]
  transactionItems  TransactionItem[]
  fixedInComponents PaketComponent[]    @relation("PaketComponentTargetVariant")
  choiceOptions     PaketChoiceOption[] @relation("ChoiceOptTargetVariant")
  @@map("menu_variants")
}

/// join varian ↔ opsi pembentuk (hanya untuk option group affectsVariant=true).
model MenuVariantOption {
  menuVariantId Int         @map("menu_variant_id")
  optionId      Int         @map("option_id")
  variant       MenuVariant @relation(fields: [menuVariantId], references: [id], onDelete: Cascade)
  option        MenuOption  @relation(fields: [optionId], references: [id], onDelete: Cascade)
  @@id([menuVariantId, optionId])
  @@map("menu_variant_options")
}

/// komponen paket: fixed (selalu termasuk) atau choice (pilih satu).
model PaketComponent {
  id              Int                 @id @default(autoincrement())
  paketMenuId     Int                 @map("paket_menu_id")
  kind            PaketComponentKind
  label           String              @db.VarChar(60)
  qty             Int                 @default(1)
  displayOrder    Int                 @default(0) @map("display_order")
  targetMenuId    Int?                @map("target_menu_id")
  targetVariantId Int?                @map("target_variant_id")
  paket           Menu                @relation("PaketOwner", fields: [paketMenuId], references: [id], onDelete: Cascade)
  targetMenu      Menu?               @relation("PaketComponentTargetMenu", fields: [targetMenuId], references: [id], onDelete: Restrict)
  targetVariant   MenuVariant?        @relation("PaketComponentTargetVariant", fields: [targetVariantId], references: [id], onDelete: Restrict)
  choiceOptions   PaketChoiceOption[]
  @@map("paket_components")
}

model PaketChoiceOption {
  id               Int            @id @default(autoincrement())
  paketComponentId Int            @map("paket_component_id")
  label            String         @db.VarChar(60)
  targetMenuId     Int?           @map("target_menu_id")
  targetVariantId  Int?           @map("target_variant_id")
  upcharge         Decimal        @default(0) @db.Decimal(10, 2)
  component        PaketComponent @relation(fields: [paketComponentId], references: [id], onDelete: Cascade)
  targetMenu       Menu?          @relation("ChoiceOptTargetMenu", fields: [targetMenuId], references: [id], onDelete: Restrict)
  targetVariant    MenuVariant?   @relation("ChoiceOptTargetVariant", fields: [targetVariantId], references: [id], onDelete: Restrict)
  @@map("paket_choice_options")
}

/// pilihan tersimpan per item (slot paket + free preference). D9.
model TransactionItemSelection {
  id                Int             @id @default(autoincrement())
  transactionItemId Int             @map("transaction_item_id")
  groupOrSlotLabel  String          @map("group_or_slot_label") @db.VarChar(60)
  chosenLabel       String          @map("chosen_label") @db.VarChar(120)
  targetMenuId      Int?            @map("target_menu_id")
  targetVariantId   Int?            @map("target_variant_id")
  isPreference      Boolean         @default(false) @map("is_preference")
  item              TransactionItem @relation(fields: [transactionItemId], references: [id], onDelete: Cascade)
  @@map("transaction_item_selections")
}
```

- [ ] **Step 4: Extend `TransactionItem`** — add `variantId` + relations (keep `subOptionsSelected Json?` for now):

```prisma
  variantId  Int?         @map("variant_id")
  variant    MenuVariant? @relation(fields: [variantId], references: [id], onDelete: SetNull)
  selections TransactionItemSelection[]
```

- [ ] **Step 5: Validate & format**

Run: `cd backend && npx prisma format && npx prisma validate`
Expected: "The schema at prisma/schema.prisma is valid 🚀" (fix any relation-name errors it reports).

- [ ] **Step 6: Apply additively to LOCAL test + dev DB + generate client**

Run (test DB first): `npx tsx --env-file=.env.test -e "console.log('noop')"` then `npx dotenv -e .env.test -- prisma db push` (or set `DATABASE_URL` to `pos_restaurant_test` and `npx prisma db push`).
Then dev: `$env:DATABASE_URL="mysql://root:@localhost:3306/pos_restaurant"; npx prisma db push; npx prisma generate`
Expected: "Your database is now in sync" with NO data-loss prompt (additive). If a data-loss prompt appears → ABORT and investigate.

- [ ] **Step 7: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(schema): REV 2.10 — menu variants + paket + selections (additive)"
```

---

# PHASE 1 — Pure variant resolver (TDD)

The order-time engine and label-building are pure logic → unit-test first.

### Task 1.1: `buildVariantLabel` + combination helper

**Files:** Create `backend/src/modules/menus/variant-resolver.ts`; Test `backend/src/modules/menus/__tests__/variant-resolver.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { buildVariantLabel, cartesian } from '../variant-resolver'

describe('buildVariantLabel', () => {
  it('joins option labels in group order with " / "', () => {
    expect(buildVariantLabel([{ groupOrder: 0, label: 'Manis' }, { groupOrder: 1, label: 'Jumbo' }]))
      .toBe('Manis / Jumbo')
  })
  it('sorts by group order regardless of input order', () => {
    expect(buildVariantLabel([{ groupOrder: 1, label: 'Jumbo' }, { groupOrder: 0, label: 'Manis' }]))
      .toBe('Manis / Jumbo')
  })
})

describe('cartesian', () => {
  it('produces all combinations across groups', () => {
    const out = cartesian([[{ id: 1 }, { id: 2 }], [{ id: 3 }, { id: 4 }]])
    expect(out).toEqual([[{ id: 1 }, { id: 3 }], [{ id: 1 }, { id: 4 }], [{ id: 2 }, { id: 3 }], [{ id: 2 }, { id: 4 }]])
  })
  it('returns [] for no groups', () => {
    expect(cartesian([])).toEqual([])
  })
})
```

- [ ] **Step 2: Run → fail**

Run: `cd backend && npx vitest run src/modules/menus/__tests__/variant-resolver.test.ts`
Expected: FAIL (module/exports missing).

- [ ] **Step 3: Implement**

```ts
// backend/src/modules/menus/variant-resolver.ts
export function buildVariantLabel(parts: { groupOrder: number; label: string }[]): string {
  return [...parts].sort((a, b) => a.groupOrder - b.groupOrder).map((p) => p.label).join(' / ')
}

export function cartesian<T>(groups: T[][]): T[][] {
  if (groups.length === 0) return []
  return groups.reduce<T[][]>((acc, group) => acc.flatMap((combo) => group.map((item) => [...combo, item])), [[]])
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run src/modules/menus/__tests__/variant-resolver.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/menus/variant-resolver.ts backend/src/modules/menus/__tests__/variant-resolver.test.ts
git commit -m "feat(menus): REV 2.10 — variant label + cartesian helpers (TDD)"
```

### Task 1.2: `resolveStockTargets` (pure, over an in-memory menu graph)

Resolve a chosen item → list of stock deductions. Pure function operating on a normalized snapshot (so it's unit-testable and the service just supplies data).

**Files:** Modify `backend/src/modules/menus/variant-resolver.ts`; Modify the test file.

- [ ] **Step 1: Write failing tests** — model the three kinds + cascade + nonStock:

```ts
import { resolveStockTargets, type MenuNode } from '../variant-resolver'

// minimal graph: simple-portion menu 10, variant menu 20 (variant 201 → stock 10),
// drink variant menu 30 (variant 301 → null), paket 40 (fixed 1×menu10 + choice → [variant301 | menu50-airmineral nonStock])
const graph: Record<number, MenuNode> = {
  10: { id: 10, kind: 'simple', stockType: 'portion' },
  20: { id: 20, kind: 'variant', stockType: 'nonStock', variants: { 201: { id: 201, stockTargetMenuId: 10 } } },
  30: { id: 30, kind: 'variant', stockType: 'nonStock', variants: { 301: { id: 301, stockTargetMenuId: null } } },
  50: { id: 50, kind: 'simple', stockType: 'nonStock' },
  40: { id: 40, kind: 'paket', stockType: 'nonStock', paket: {
    fixed: [{ qty: 2, targetMenuId: 10 }],
    choices: [{ label: 'Minuman', options: [{ targetMenuId: 30 }, { targetMenuId: 50 }] }],
  } },
}

it('simple portion → deduct itself ×1', () => {
  expect(resolveStockTargets(graph, { menuId: 10 })).toEqual([{ menuId: 10, qty: 1 }])
})
it('variant → deduct its stock target', () => {
  expect(resolveStockTargets(graph, { menuId: 20, variantId: 201 })).toEqual([{ menuId: 10, qty: 1 }])
})
it('drink variant with null target → no deduction', () => {
  expect(resolveStockTargets(graph, { menuId: 30, variantId: 301 })).toEqual([])
})
it('paket: fixed×2 + chosen variant(30→none) → only fixed target', () => {
  expect(resolveStockTargets(graph, { menuId: 40, paketChoices: { Minuman: { targetMenuId: 30, variantId: 301 } } }))
    .toEqual([{ menuId: 10, qty: 2 }])
})
it('paket choosing air mineral (nonStock) → only fixed', () => {
  expect(resolveStockTargets(graph, { menuId: 40, paketChoices: { Minuman: { targetMenuId: 50 } } }))
    .toEqual([{ menuId: 10, qty: 2 }])
})
```

- [ ] **Step 2: Run → fail.** Run: `npx vitest run src/modules/menus/__tests__/variant-resolver.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** `MenuNode` types + `resolveStockTargets`:

```ts
export interface MenuNode {
  id: number
  kind: 'simple' | 'variant' | 'paket'
  stockType: 'portion' | 'linked' | 'nonStock'
  variants?: Record<number, { id: number; stockTargetMenuId: number | null }>
  paket?: {
    fixed: { qty: number; targetMenuId?: number | null; targetVariantId?: number | null }[]
    choices: { label: string; options: { targetMenuId?: number | null; targetVariantId?: number | null }[] }[]
  }
}
export interface ChosenItem {
  menuId: number
  variantId?: number | null
  paketChoices?: Record<string, { targetMenuId?: number | null; variantId?: number | null }>
}
export interface StockDeduction { menuId: number; qty: number }

// resolve one (menu, variant?) to its single stock target (or null), reused recursively.
function targetOf(graph: Record<number, MenuNode>, menuId: number, variantId?: number | null): number | null {
  const node = graph[menuId]
  if (!node) return null
  if (node.kind === 'variant') {
    if (variantId == null) return null
    return node.variants?.[variantId]?.stockTargetMenuId ?? null
  }
  // simple: portion deducts itself; linked/nonStock simple → treat by stockType
  return node.stockType === 'portion' ? node.id : null
}

export function resolveStockTargets(graph: Record<number, MenuNode>, item: ChosenItem): StockDeduction[] {
  const node = graph[item.menuId]
  if (!node) return []
  const acc: StockDeduction[] = []
  const push = (menuId: number | null, qty: number) => { if (menuId != null) acc.push({ menuId, qty }) }

  if (node.kind === 'paket' && node.paket) {
    for (const f of node.paket.fixed) push(targetOf(graph, f.targetMenuId ?? -1, f.targetVariantId), f.qty)
    for (const c of node.paket.choices) {
      const chosen = item.paketChoices?.[c.label]
      if (chosen?.targetMenuId != null) push(targetOf(graph, chosen.targetMenuId, chosen.variantId), 1)
    }
    return mergeDeductions(acc)
  }
  // simple or variant
  push(targetOf(graph, item.menuId, item.variantId), 1)
  return mergeDeductions(acc)
}

function mergeDeductions(d: StockDeduction[]): StockDeduction[] {
  const m = new Map<number, number>()
  for (const x of d) m.set(x.menuId, (m.get(x.menuId) ?? 0) + x.qty)
  return [...m].map(([menuId, qty]) => ({ menuId, qty }))
}
```

- [ ] **Step 4: Run → pass.** Expected: all tests PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(menus): REV 2.10 — resolveStockTargets engine (TDD, FK-based)"`.

---

# PHASE 2 — Backend CRUD: option groups / variants / paket

### Task 2.1: Zod payloads for the menu builder

**Files:** Modify `backend/src/modules/menus/menus.schema.ts`

- [ ] **Step 1: Add builder schemas** (additive; keep legacy `linkedSubOptionsSchema`/`paketSubOptionsSchema` exported for the backfill validator only):

```ts
export const optionSchema = z.object({ label: z.string().trim().min(1), displayOrder: z.number().int().default(0) })
export const optionGroupSchema = z.object({
  name: z.string().trim().min(1),
  affectsVariant: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
  options: z.array(optionSchema).min(1),
})
export const variantSchema = z.object({
  // optionLabels: label per group (by group name) defining this combination
  optionLabels: z.record(z.string(), z.string()).default({}),
  label: z.string().trim().min(1),
  price: z.number().nonnegative(),
  stockTargetMenuId: z.number().int().positive().nullable().default(null),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
})
export const paketComponentSchema = z.object({
  kind: z.enum(['fixed', 'choice']),
  label: z.string().trim().min(1),
  qty: z.number().int().min(1).default(1),
  displayOrder: z.number().int().default(0),
  targetMenuId: z.number().int().positive().nullable().default(null),
  targetVariantId: z.number().int().positive().nullable().default(null),
  choiceOptions: z.array(z.object({
    label: z.string().trim().min(1),
    targetMenuId: z.number().int().positive().nullable().default(null),
    targetVariantId: z.number().int().positive().nullable().default(null),
    upcharge: z.number().nonnegative().default(0),
  })).default([]),
})
// Full menu create/update payload (REV 2.10):
export const menuUpsertSchema = z.object({
  name: z.string().trim().min(1),
  category: z.string().trim().min(1),
  price: z.number().nonnegative(),          // base price (simple); variants carry their own
  imageUrl: z.string().nullable().optional(),
  kind: z.enum(['simple', 'variant', 'paket']).default('simple'),
  posVisible: z.boolean().default(true),
  stockType: z.enum(['portion', 'linked', 'nonStock']).default('nonStock'),
  minStock: z.number().int().nullable().optional(),
  optionGroups: z.array(optionGroupSchema).default([]),
  variants: z.array(variantSchema).default([]),
  paketComponents: z.array(paketComponentSchema).default([]),
}).superRefine((data, ctx) => {
  if (data.kind === 'variant' && data.variants.length === 0)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['variants'], message: 'Menu varian wajib punya minimal 1 varian' })
  if (data.kind === 'paket' && data.paketComponents.length === 0)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['paketComponents'], message: 'Paket wajib punya minimal 1 komponen' })
  if (data.kind !== 'variant' && data.variants.length > 0)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['variants'], message: 'Hanya menu kind=variant boleh punya varian' })
})
export type MenuUpsertInput = z.infer<typeof menuUpsertSchema>
```

- [ ] **Step 2: Commit** `git commit -m "feat(menus): REV 2.10 — Zod builder payloads (variant/paket)"`.

### Task 2.2: Service — create/update menu with nested option groups + variants + paket

**Files:** Modify `backend/src/modules/menus/menus.service.ts`

- [ ] **Step 1: Implement `upsertMenu`** — wrap in `prisma.$transaction`; on update, replace child rows (delete+recreate option groups/variants/paket components for simplicity; their FKs cascade). Map `variant.optionLabels` (group name → option label) to `MenuVariantOption` rows by matching created option ids. Validate `stockTargetMenuId` exists + is a real menu. Set `Menu.kind`/`posVisible`.

```ts
// signature
export async function upsertMenu(id: number | null, input: MenuUpsertInput): Promise<MenuDetail>
// behavior:
//  - create/update Menu base (name, category, price, imageUrl, kind, posVisible, stockType, minStock)
//  - delete existing optionGroups/variants/paketComponents (cascade) if updating
//  - create optionGroups+options; build label→optionId map keyed by groupName
//  - create variants; for each, create MenuVariantOption from optionLabels (skip free-preference groups)
//  - create paketComponents (+ choiceOptions); validate each targetMenuId/targetVariantId exists
//  - return getMenuDetail(menuId)
```

- [ ] **Step 2: Implement `getMenuDetail(id)` + `listMenus(query)`** — `include` optionGroups.options, variants.options, paketComponents.choiceOptions, portionStock. For POS list, filter `posVisible=true` + `isActive`. For owner list, allow `includeHidden`.

- [ ] **Step 3: Smoke-test via script** (Task 2.4 covers full smoke). For now ad-hoc: create a variant menu (Es Teh, 2 groups, 4 variants) via the service in a scratch and assert 4 variants + correct labels.

- [ ] **Step 4: Commit** `git commit -m "feat(menus): REV 2.10 — upsertMenu + nested fetch service"`.

### Task 2.3: Controller + routes

**Files:** Modify `backend/src/modules/menus/menus.controller.ts`, `menus.routes.ts`

- [ ] **Step 1:** Replace the old create/update handlers to use `menuUpsertSchema` + `upsertMenu`. Keep `GET /menus` (public, posVisible+active), `GET /menus/:id` (detail), `POST /menus` (owner), `PUT /menus/:id` (owner), deactivate/reactivate. Permission: owner-only for mutations (per matrix). Response `{success,message,data:{menu}}`.
- [ ] **Step 2: Register** routes (already registered in `app.ts`; no change unless path changes).
- [ ] **Step 3: Commit** `git commit -m "feat(menus): REV 2.10 — controller/routes for variant/paket upsert"`.

### Task 2.4: Integration smoke (test DB)

**Files:** Create `backend/scripts/smoke-menu-variants.ts`

- [ ] **Step 1:** Guard: refuse to run unless `DATABASE_URL` contains `_test`. Scenarios: (1) create Es Teh variant menu (Rasa×Ukuran + free Suhu) → assert 4 variants, prices 8/10/12/15, Suhu group has affectsVariant=false and no variant rows include it; (2) create Ayam Potong (Bagian×CaraMasak) variants → stockTargetMenuId set; (3) create Paket with fixed + choice(Teh variant-menu | Air Mineral) → assert structure; (4) update menu (rename group) → children replaced cleanly; (5) GET list posVisible filter hides stock SKUs.
- [ ] **Step 2: Run** `npx tsx --env-file=.env.test scripts/smoke-menu-variants.ts` → Expected: all scenarios print PASS.
- [ ] **Step 3: Commit** `git commit -m "test(menus): REV 2.10 — variant/paket CRUD smoke"`.

---

# PHASE 3 — Order-time integration

### Task 3.1: Order item payload schema

**Files:** Modify `backend/src/modules/transactions/transactions.schema.ts`

- [ ] **Step 1:** Extend `orderItemSchema` (additive, keep `notes`):

```ts
// add to order item:
variantId: z.number().int().positive().nullable().optional(),
paketChoices: z.record(z.string(), z.object({
  targetMenuId: z.number().int().positive(),
  variantId: z.number().int().positive().nullable().optional(),
  chosenLabel: z.string().trim().min(1),
})).optional(),
preferences: z.array(z.object({ groupLabel: z.string(), chosenLabel: z.string() })).optional(),
// keep legacy subOptionsSelected optional during transition
```

- [ ] **Step 2: Commit** `git commit -m "feat(tx): REV 2.10 — order item payload (variantId + paketChoices + preferences)"`.

### Task 3.2: Service uses `resolveStockTargets`; records variantId + selections

**Files:** Modify `backend/src/modules/transactions/transactions.service.ts`

- [ ] **Step 1:** Build the `MenuNode` graph for the menus referenced in the order (fetch menus + variants + paket components in one query), then for each order item call `resolveStockTargets(graph, item)`. Replace `resolveTargetNameToPortionId` / name-based block entirely. Decrement each `{menuId, qty}` × order qty (reuse existing decrement + `PortionMovement` write, incl. item-level link).
- [ ] **Step 2:** Set `TransactionItem.unitPrice` = variant.price (variant) / menu.price (simple) / paket.price (paket). Persist `variantId`. Create `TransactionItemSelection` rows from `paketChoices` (isPreference=false) + `preferences` (isPreference=true).
- [ ] **Step 3:** Keep void/reverse logic working (reverse uses the same deductions; ensure movement reversal reads recorded deductions or recomputes from the stored item+variant). Simplest: on void, recompute `resolveStockTargets` from stored `variantId`/selections and reverse.
- [ ] **Step 4: Extend `smoke-tx` (or new smoke)** in test DB: order a variant → correct stock target decremented; order paket with Teh choice → multi-decrement + selections rows present; void → stock restored. Run `npx tsx --env-file=.env.test scripts/smoke-tx.ts`.
- [ ] **Step 5: Commit** `git commit -m "feat(tx): REV 2.10 — FK-based stock resolution + variant/selection recording"`.

---

# PHASE 4 — Backfill + seed + verification (LOCAL)

### Task 4.1: Backfill script (idempotent)

**Files:** Create `backend/scripts/backfill-menu-variants.ts`

- [ ] **Step 1:** Idempotency: tag created display menus (e.g. a known name set) and `findFirst` before create; safe to re-run. Logic:
  1. For each known display group (Es Teh, Ayam Potong, 1 Ekor Ayam, Gurame Bakar/Goreng, Udang Windu, Garang Asem), create/find the display Menu (kind=variant) + option groups + options + variants with **exact prices** from `menu-ayam-bakar-banjar-monosuko.md`.
  2. Point ayam/seafood variant `stockTargetMenuId` at the EXISTING portion menus (lookup by current name). For Es Teh, variants have `stockTargetMenuId=null` (drinks).
  3. Convert each existing paket (parse legacy `subOptions` JSON via `paketSubOptionsSchema`) → `PaketComponent`/`PaketChoiceOption`, resolving names→ids (log unresolved). Set paket `Menu.kind=paket`.
  4. Set `posVisible=false` on: granular stock SKUs now referenced only as variant targets, AND the superseded duplicate display menus (old Teh Tawar Biasa/Jumbo/…).
  5. Print a reconciliation report: counts created, names unresolved (must be 0 before prod).
- [ ] **Step 2: Run on LOCAL dev DB** (after Phase 0 push): `$env:DATABASE_URL=...pos_restaurant; npx tsx scripts/backfill-menu-variants.ts` → review report, 0 unresolved.
- [ ] **Step 3:** Manually verify in `prisma studio` / a query: Es Teh has 4 variants 8/10/12/15; Ayam Potong variants point to existing portion menus; old teh menus `posVisible=false`; paket components populated.
- [ ] **Step 4: Commit** `git commit -m "feat(scripts): REV 2.10 — backfill menu variants (idempotent, history-safe)"`.

### Task 4.2: Update `menu-catalog.ts` + `seed.ts` for fresh DBs

**Files:** Modify `backend/prisma/menu-catalog.ts`, `backend/prisma/seed.ts`

- [ ] **Step 1:** Express the catalog in the new structure (variant menus + paket components) so `npm run db:seed` on a fresh DB yields the same shape as backfill. Keep granular stock SKUs (posVisible=false) as the stock holders.
- [ ] **Step 2:** Verify against a fresh `pos_restaurant_test`: `db push --force-reset` is FORBIDDEN on real DBs but OK on the throwaway test DB → reseed → run `smoke-menu-variants` + `smoke-tx`.
- [ ] **Step 3: Commit** `git commit -m "feat(seed): REV 2.10 — catalog in variant/paket structure"`.

### Task 4.3: Backend gate

- [ ] `cd backend && npx tsc --noEmit` → 0 errors.
- [ ] `npx vitest run` → all pass (incl. variant-resolver).
- [ ] Smoke suite on test DB: `smoke-menu-variants`, `smoke-tx`, `smoke-settlement` → PASS.
- [ ] Commit any fixes.

---

# PHASE 5 — Frontend types + services

### Task 5.1: Types

**Files:** Modify `frontend/src/types/index.ts`

- [ ] **Step 1:** Add `MenuKind`, `OptionGroup`, `Option`, `MenuVariant`, `PaketComponent`, `PaketChoiceOption`, `TransactionItemSelection`; extend `Menu` with `kind`, `posVisible`, `optionGroups?`, `variants?`, `paketComponents?`; extend order item payload + `TransactionItemView` with `variantId`/`variantLabel`/`selections`. Keep legacy `SubOptions` types until POS migration (Phase 7) done, then remove.
- [ ] **Step 2:** `cd frontend && npx tsc --noEmit` → 0. Commit `"feat(fe): REV 2.10 — variant/paket types"`.

### Task 5.2: menuService + transactionService

**Files:** Modify `frontend/src/services/menuService.ts`, `transactionService.ts`

- [ ] **Step 1:** `menuService.upsert(payload)`, `menuService.detail(id)`, `list({ includeHidden })`. `transactionService` order payload carries `variantId`/`paketChoices`/`preferences`.
- [ ] **Step 2:** tsc 0. Commit `"feat(fe): REV 2.10 — menu/transaction services"`.

---

# PHASE 6 — Owner progressive "Add Menu" form

### Task 6.1: VariantBuilder

**Files:** Create `frontend/src/components/menu/VariantBuilder.tsx`

- [ ] **Step 1:** Props `{ groups, variants, onChange, menusForStockTarget }`. UI: add/remove option group (name + affectsVariant toggle + options); **auto-generate** the variant grid as the cartesian of `affectsVariant=true` groups; each row: editable price + stock-target combobox (reuse `MenuTargetCombobox`) + active toggle. Preserve edited price/stock when regenerating (key by sorted optionLabels). Match existing modal tone (design-system primitives, `text-body-sm`, mobile-first).
- [ ] **Step 2:** Audit references first (Frontend Consistency Mandate): `MenuFormModal.tsx`, `PaketBuilder.tsx`, `RawMaterialsTab` form. Use `Dialog`/`Input`/`Combobox`/`Button`/`Checkbox` primitives.
- [ ] **Step 3:** tsc 0 + `vite build`. Commit `"feat(fe): REV 2.10 — VariantBuilder (auto grid + price/stock per combo)"`.

### Task 6.2: Progressive MenuFormModal + PaketBuilder adapt

**Files:** Modify `frontend/src/components/MenuFormModal.tsx`, `frontend/src/components/menu/PaketBuilder.tsx`

- [ ] **Step 1:** State 1 = basics + two buttons ("Tambah pilihan varian" → mount VariantBuilder, set kind=variant; "Jadikan paket" → mount adapted PaketBuilder, set kind=paket; mutually exclusive). Save → `menuService.upsert` with assembled payload + inferred `kind`.
- [ ] **Step 2:** Adapt `PaketBuilder` to emit FK-based `paketComponents` (fixed: targetMenuId/variantId + qty; choice: options referencing menu/variant) instead of legacy name JSON. Reuse `MenuTargetCombobox` for picking targets.
- [ ] **Step 3:** Manual e2e (dev): create Es Teh (4 variants, prices), Ayam Potong (variants→stock), a Paket; reopen to edit. tsc 0 + build + lint 0. Commit `"feat(fe): REV 2.10 — progressive Add Menu (VariantBuilder + PaketBuilder FK)"`.

---

# PHASE 7 — POS generic picker

### Task 7.1: VariantPickerModal (replaces SubOptionsModal)

**Files:** Create `frontend/src/components/VariantPickerModal.tsx`; Modify `frontend/src/components/MenuGrid.tsx`, `frontend/src/stores/cartStore.ts`, `frontend/src/components/CartPanel.tsx`

- [ ] **Step 1:** `VariantPickerModal` renders generically from a menu's `optionGroups`: one selectable row per group (pick exactly 1). For `kind=variant`: resolve chosen options → matching `MenuVariant` → show price; `affectsVariant=false` groups recorded as preferences. For `kind=paket`: render fixed items (read-only) + each choice slot; choosing an option that targets a variant-menu opens that menu's picker inline (recursive — reuse the same component). Emit `{ menuId, variantId?, paketChoices?, preferences?, unitPrice }` to cart.
- [ ] **Step 2:** `MenuGrid` shows only `posVisible` menus; tap → if `kind==='simple'` add directly, else open `VariantPickerModal`. `cartStore` line item carries `variantId`/`paketChoices`/`preferences`/`variantLabel`. `CartPanel` shows the variant label + preference notes (replaces REV 2.4 Panas/Dingin hardcoded toggle).
- [ ] **Step 3:** Delete `SubOptionsModal.tsx` + the hardcoded `AMBIGUOUS_TEMP_MENUS` temp-toggle logic (now data-driven free-preference groups).
- [ ] **Step 4:** Manual e2e: order Es Teh (pick rasa/ukuran/suhu → correct price), Ayam Potong (→ stock), Paket (Teh cascades, Air Mineral terminal). tsc 0 + build + lint 0. Commit `"feat(fe): REV 2.10 — generic VariantPickerModal + POS wiring; drop SubOptionsModal"`.

---

# PHASE 8 — History/Menu display + B2 reconcile

### Task 8.1: HistoryPage + MenuPage display

**Files:** Modify `frontend/src/pages/HistoryPage.tsx`, `frontend/src/pages/MenuPage.tsx`

- [ ] **Step 1:** HistoryPage item rows show `variantLabel` + `selections` (slot → chosen, preferences) instead of raw `subOptionsSelected` JSON. MenuPage rows show variant count/summary + (for variant menus) a way to see variants.
- [ ] **Step 2:** tsc 0 + build. Commit `"feat(fe): REV 2.10 — history/menu variant display"`.

### Task 8.2: Reconcile Workstream B2 (FK-based jump)

**Files:** Modify `frontend/src/lib/menuStockLink.ts`, `frontend/src/pages/MenuPage.tsx`

- [ ] **Step 1:** Replace name-based `resolveStockTargetId` with FK: a menu's stock link uses `variant.stockTargetMenuId` (or the menu's own portion id). Remove name-matching + `?q=` fallback (FK guarantees target). Keep `?focusMenuId` highlight (B1).
- [ ] **Step 2:** tsc 0 + build + lint 0. Commit `"refactor(fe): REV 2.10 — B2 jump links use FK stock target (drop name resolver)"`.

---

# PHASE 9 — Migration execution + verification + docs

### Task 9.1: LOCAL full verification

- [ ] Backend: tsc 0, vitest all pass, smoke (`menu-variants`, `tx`, `settlement`) PASS on test DB.
- [ ] Frontend: tsc 0, `vite build` success, `eslint` 0 errors.
- [ ] Manual e2e in `npm run dev` per role: owner adds variant menu; POS orders variant + paket; stock decrements correct target; history shows variant/selections; B2 jump works.

### Task 9.2: PROD migration (off-peak, gated)

- [ ] **mysqldump** full `pos_restaurant` → `/home/ubuntu/backups/prod-pre-rev210-<ts>.sql` (verify size > 0).
- [ ] Deploy backend code (tarball workflow per [[project_deployment_server]]) + `npx prisma generate`.
- [ ] `npx prisma db push` (env prod) — additive, expect "in sync", **NO data-loss prompt** (else ABORT + restore).
- [ ] `npx tsx --env-file=.env scripts/backfill-menu-variants.ts` → report 0 unresolved; verify counts before/after (old menus + transactions unchanged).
- [ ] Deploy frontend `dist`.
- [ ] Smoke prod: menus list (variant cards), order a test variant + paket off-hours → correct stock, void/cleanup. Watch `journalctl -u pos-backend -f`.
- [ ] **GATE:** stop and report to user before prod push; proceed only on explicit approval.

### Task 9.3: Cleanup legacy + docs

- [ ] After verification stable: drop legacy `Menu.subOptions` usage + `linked` stockType reliance (optional: keep column, stop writing). Update CLAUDE.md status table (REV 2.10 row), `docs/operasional-resto.md`, `docs/DATA-DICTIONARY.md`, and memory (`project_session_handoff`, new continuity memory). ERD StarUML update deferred (per owner).
- [ ] Resume Workstream B (B3/B4/B5) on its branch.

---

## Self-Review (run after writing; fix inline)

- **Spec coverage:** §3 data model → Phase 0; §4 owner flow → Phase 6; §5 POS → Phase 7; §6 engine → Phases 1+3; §7 migration → Phases 4+9; §9 testing → Phases 1,2.4,3.4,4.3,9.1; §11 B impact → Phase 8.2. ✔ all sections mapped.
- **Placeholders:** schema/Zod/resolver/tests have real code; CRUD service (2.2) + UI components (6,7) specified by exact interface + behavior + verify steps (project has no FE unit tests; FE verified by tsc/build/lint/manual e2e per convention) — concrete, no "TBD".
- **Type consistency:** `resolveStockTargets(graph, item)` / `MenuNode` / `StockDeduction` consistent across 1.2 → 3.2; `menuUpsertSchema`/`MenuUpsertInput` consistent 2.1 → 2.2 → 5.2; `stockTargetMenuId` naming consistent across schema/service/resolver/frontend.

## Execution options

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks.
2. **Inline Execution** — executing-plans, batch with checkpoints.
