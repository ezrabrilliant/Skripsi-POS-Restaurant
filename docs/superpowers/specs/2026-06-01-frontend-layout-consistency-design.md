# Frontend Layout Consistency — Design Spec (2026-06-01)

**Status:** Approved. Implementation in progress on branch `feat/frontend-layout-consistency`.
**Plan:** `~/.claude/plans/hashed-honking-perlis.md`

## 1. Problem

The frontend grew across many sessions; each page's layout drifted. An audit of all 13 pages (1 agent/page) found three independent drift axes the user can visually perceive:

1. **Header style** — only Menu/Stock/Setting render the shared white **pinned** header bar; POS has a bespoke white bar; the other **8 pages use a plain inline `<h1>+<p>` header that scrolls away** with the content. ("ada header putih, ada yang ngga.")
2. **Content width** — five values across pages: `max-w-6xl`, `max-w-5xl`, `max-w-4xl`, `max-w-3xl`, and **none/full-width** (Stock + Setting). ("menu ada space kiri-kanan; stock full 1 screen terlalu jauh.")
3. **Padding** — three variants: `px-3 sm:px-4 py-4` (list pages), `px-4 sm:px-6 py-4 sm:py-6` (dashboards), `p-3 sm:p-4` (Stock/Setting).

**Root cause:** half the pages predate the design-system primitives (`PageHeader`, `FilterToolbar`, `DataTable`). The fix is **not** a new design language — it is to standardize every content page onto the shell the user already likes (MenuPage).

## 2. Decisions (locked via AskUserQuestion)

- **Header:** every content page uses the shared `PageHeader` white pinned bar.
- **Width:** uniform `max-w-6xl mx-auto` everywhere; form-centric pages keep an **inner** narrow column (`max-w-3xl mx-auto`) so fields stay readable while page chrome aligns at 6xl.
- **Rollout:** phased, reviewed per batch.

## 3. Canonical pattern (reference = MenuPage)

```tsx
<div className="h-full flex flex-col">
  <PageHeader title subtitle actions tabs />        {/* white bar, pinned, owns pt-safe */}
  <div className="flex-1 min-h-0 overflow-y-auto">  {/* scroll region — min-h-0 mandatory */}
    <PageContainer> … </PageContainer>              {/* max-w-6xl mx-auto px-3 sm:px-4 py-4 space-y-3 */}
  </div>
</div>
```

**Load-bearing facts (verified in code):**
- `Layout` `<main className="flex-1 overflow-hidden pb-safe-nav md:pb-0">` (Layout.tsx:198) reserves mobile bottom-nav clearance → per-page `pb-safe` must be **removed**.
- `PageHeader` already applies `pt-safe md:pt-2.5` (PageHeader.tsx) → per-page `pt-safe` must be **removed** on adoption.
- `FilterToolbar` is **not** sticky → no z-index conflict under the pinned header; do not make it sticky in this pass.
- `Tabs` already supports `scrollable` (Tabs.tsx:21).
- LoginPage is routed **outside** `<Layout>` (App.tsx:57) → out of scope.

## 4. New primitives (Batch 0)

- **`PageContainer`** — single source of truth for the content column string `max-w-6xl mx-auto px-3 sm:px-4 py-4 space-y-3`; `className` escape hatch; use once per scroll region, never nest.
- **`Page`** — thin shell wrapper (`h-full flex flex-col` + `PageHeader` + scroll region + `PageContainer`); `bare` prop skips the auto-container for tab-swapped bodies that wrap their own; `containerClassName` overrides rhythm.
- **`PageHeader.tabsScrollable?: boolean`** — forwarded to `Tabs scrollable`; the only sanctioned primitive change. Keeps `variant="segmented"`.

Barrel: export `PageContainer` + `Page` from `design-system/primitives/index.ts`.

## 5. Per-page migration map

Recipe for old-pattern pages: replace root `h-full overflow-y-auto` + inline `<header>` with the canonical shell; `<h1>`→`title`, `<p>`→`subtitle`, header buttons→`actions`, header tabs→`tabs`; wrap body in `PageContainer` (forms add inner `max-w-3xl mx-auto`); delete `pt-safe`/`pb-safe`; padding→`px-3 sm:px-4 py-4`.

| Page | Change | Width | Notes |
|---|---|---|---|
| `StockPage` + `PortionStockTab` | wrap body in `PageContainer`; subtitle `"{n} item · {low} rendah"` via shared-key `['portionStocks']` query (cache hit) | full→6xl | headline "terlalu jauh" fix |
| `PaymentMethodsPage` | custom header → `<PageHeader>` (1:1 classes); wrap tabs body in `PageContainer`; `tabsScrollable` | full→6xl | 5 tabs segmented already |
| `CashierDashboard`, `WaiterDashboard` | shell A; `title="Halo, {name}"` + `subtitle`; remove inner `pb-safe` | 5xl→6xl | keep `OverdueShiftGate` early-return outside shell |
| `OwnerDashboard` | shell A; 4 section tabs → `PageHeader.tabs` (`tabsScrollable`, underline→segmented); `PeriodControl` stays as 1st body child | 6xl | the 4 `*Tab` children have no own padding → safe in `PageContainer` |
| `TablesPage` | shell A; `subtitle` w/ colored spans (ReactNode) | 5xl→6xl | `CombineTableModal` at shell root |
| `HistoryPage` | shell A; mobile Filter btn → `actions`; filter card into `PageContainer` | 5xl→6xl | defer full FilterToolbar adoption (needs optional-search/feature add) |
| `SettlementPage` | shell A; inner `max-w-3xl mx-auto` | 3xl→6xl+inner3xl | form-centric; `CloseShiftBlockedModal` at shell root |
| `UsersPage` | shell A; "Tambah User" → `actions`; inner `max-w-3xl` | 4xl→6xl+inner3xl | preserve `space-y-5` on inner |
| `BillsPage` | shell A; month `<input>` + "Tagihan" → `actions`; inner `max-w-3xl` | 3xl→6xl+inner3xl | uses DataTable |
| `POSPage` | header normalization only — align left `<header>` classes to PageHeader tokens (add `sm:px-4`); do NOT restructure 2-col | n/a | PageHeader has no leading-slot for mobile back btn; full reuse deferred |
| `LoginPage` | out of scope | — | outside Layout chrome |

## 6. Gotchas

- `min-h-0` on inner scroll div mandatory.
- Remove every per-page `pt-safe`/`pb-safe` (PageHeader owns top, `main` owns bottom). Re-test Cashier/Waiter dashboards (inner `pb-safe`).
- No double `PageContainer` (use `bare`).
- Dashboards: native page-scroll → inner scroll; no sub-tab uses `position: sticky`; Recharts `ResponsiveContainer` measures parent (unaffected).
- Subtitles accept colored `<span>` (ReactNode).
- Drop unused imports after header swaps (e.g. `Tabs` in PaymentMethodsPage).
- Preserve deep-links: Menu/Stock `?focusMenuId`, Stock `?action=opname`.

## 7. Batches

0. Primitives + spec → 1. Stock + Setting → 2. Dashboards → 3. Tables + History → 4. Settlement + Users + Bills → 5. POS header. Checkpoint after each.

## 8. Verification (per batch, from `frontend/`)

`npx tsc --noEmit` · `npm run build` · `npm run lint` · browser pass @375px + ≥1280px: pinned header fixed; content edge aligns with Menu; no horizontal overflow; tab rows scroll not wrap; last row clears bottom-nav; page-specific smoke (Owner tabs/PeriodControl, PM 5 tabs, Settlement narrow, Bills filter, POS header + cart, Menu/Stock deep-links).
