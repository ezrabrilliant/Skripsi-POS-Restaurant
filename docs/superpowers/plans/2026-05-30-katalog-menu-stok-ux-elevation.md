# Katalog Menu + Stok UX Elevation - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Satukan Menu + SKU Varian jadi satu halaman ber-tab "Katalog Menu", jadikan relasi induk & navigasi Menu↔Stok sebagai elemen klikable nyata, dan seragamkan header + filter-toolbar antara Katalog Menu & Stok - semua frontend-only.

**Architecture:** Satu halaman host (`MenuPage` → judul "Katalog Menu") dengan segmented `Tabs`: tab **"Menu Jual"** (pohon expandable) + tab **"Varian SKU"** (daftar datar) - keduanya view ter-filter dari satu query bersama `['menus','admin',showInactive]`. Primitive bersama baru: `PageHeader` + `FilterToolbar` + perluasan `DataTable` (`expandable`/`rowId`/`rowClassName`). Stok tetap halaman terpisah, terhubung via deep-link `?focusMenuId` (dua arah; Stok→Menu owner-only) pakai `useSearchParams`. Tidak ada perubahan backend/skema/endpoint.

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind, @tanstack/react-query v5, react-router-dom v7.10.1, primitive design-system berbasis Radix (`@/design-system/primitives`). Tidak ada unit-test runner di frontend.

---

## Plan structure & cross-cutting notes (BACA DULU)

- **Spec:** [docs/superpowers/specs/2026-05-30-katalog-menu-stok-ux-elevation-design.md](../specs/2026-05-30-katalog-menu-stok-ux-elevation-design.md)
- **Branch:** `feat/katalog-menu-ux` (sudah dibuat dari `main`; fitur SKU Varian sudah lebih dulu di-merge ke `main`).
- **Urutan fase (WAJIB):** **Phase 1 (Tasks 1-4, primitive fondasi) HARUS landing sebelum Phase 2-4.** Tasks 5-18 meng-import `PageHeader`/`FilterToolbar`/`menuTree` + props `DataTable` baru; `tsc` gagal kalau belum ada.
- **Realita verifikasi:** frontend **tidak punya unit-test runner** (tak ada vitest). Tiap task diverifikasi dengan `cd frontend && npx tsc -b` (0 error) dan/atau `npm run build` + `npm run lint`. Perilaku end-to-end diverifikasi Playwright di akhir (Task 21). Warning lint pre-existing `react-refresh/only-export-components` pada `*Builder`/`MenuTypeFilter` boleh diabaikan - yang penting **0 error BARU**.
- **Peta Task → Phase:** Phase 1 = Tasks 1-4 (primitive). Phase 2 = Tasks 5-11 (Katalog Menu). Phase 3 = Tasks 12-15 (koneksi Stok). Phase 4 = Tasks 16-18 (bersih-bersih). Phase 5 = Tasks 19-21 (docs + verifikasi). Sebutan "Author A/B/C/D" di prosa task = grup fase ini.
- **REFINEMENT LINTAS-TASK - visibilitas fokus (terapkan di Tasks 5, 6, 14):** Saat sebuah tab/halaman menerima `?focusMenuId` dan baris itu **tidak ada di view ter-filter** (ada filter kategori/tipe/search aktif, atau "Tampilkan nonaktif" menyembunyikannya), efek fokus **HARUS lebih dulu mengosongkan filter lokal** surface itu agar target terlihat **sebelum** `scrollIntoView` - kalau tidak, highlight tak menemukan baris. Konkret: di `useEffect` fokus, bila `!filteredView.some(r => r.id === focusMenuId)`, reset `search=''`, `categoryFilter='all'`, dan (Menu Jual) pastikan `stockType` baris fokus ada di `types` / (Stok) panggil `controls.resetFilters()`; baru scroll. Ini disengaja karena user navigasi ke sini secara eksplisit. (Menutup soft-gap yang ditemukan saat penyusunan plan.)
- **Commit:** tiap task diakhiri commit; pesan diakhiri `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

<!-- ASSEMBLED-SECTIONS-BELOW -->


---

## Phase 1 - Foundation primitives (shared)

> This phase extracts the shared building blocks the rest of the plan depends on: two new design-system primitives (`PageHeader`, `FilterToolbar`), a non-breaking extension to `DataTable` (expandable rows + `rowClassName` + `rowId`), and the pure `menuTree` helper module. Authors B and C only **consume** these contracts - do not change their signatures.
>
> **Verification reality:** this frontend has **no unit-test runner** (no vitest). Per-task verification is `cd frontend && npx tsc -b` (0 errors) plus `npm run lint`/`npm run build` where noted. Pure helpers (`menuTree.ts`) are verified by `tsc` + their downstream e2e (Author D), not by a unit test.

### Task 1: Create `PageHeader` primitive + barrel export

`PageHeader` is the shared page-top archetype: a sticky-feeling white bar with a title, optional count subtitle, an optional segmented `Tabs` control (right side), and an optional `actions` slot (e.g. a "+ Menu" button). It standardizes the three divergent header styles found during the audit (`text-headline` vs `text-title`, inconsistent subtitle/count) into one component used by both Katalog Menu (Author B) and Stok (Author C).

**Page usage pattern (document for downstream authors):** a host page is a full-height flex column where the header is fixed-height and the body scrolls:

```tsx
<div className="h-full flex flex-col">
  <PageHeader title="…" subtitle="…" tabs={{ items, value, onValueChange }} actions={…} />
  <div className="flex-1 min-h-0 overflow-y-auto">
    {/* page body */}
  </div>
</div>
```

- [ ] **Step 1.1: Create `PageHeader.tsx`**

**Files:**
- Create: `frontend/src/design-system/primitives/PageHeader.tsx`

```tsx
import type { ReactNode } from 'react'
import { Tabs, type TabItem } from './Tabs'

interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  tabs?: { items: TabItem[]; value: string; onValueChange: (value: string) => void }
}

export function PageHeader({ title, subtitle, actions, tabs }: PageHeaderProps) {
  return (
    <header className="bg-white border-b border-neutral-200 px-3 sm:px-4 py-2.5 flex items-center gap-3 flex-wrap pt-safe md:pt-2.5">
      <div className="min-w-0">
        <h1 className="text-title font-semibold text-neutral-900">{title}</h1>
        {subtitle != null && <p className="text-caption text-neutral-500">{subtitle}</p>}
      </div>
      {(tabs || actions) && (
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {tabs && (
            <Tabs value={tabs.value} onValueChange={tabs.onValueChange} items={tabs.items} variant="segmented" />
          )}
          {actions}
        </div>
      )}
    </header>
  )
}
```

- [ ] **Step 1.2: Add barrel export**

**Files:**
- Modify: `frontend/src/design-system/primitives/index.ts`

After the last existing export line:

```ts
export { DataTable, type DataTableColumn } from './DataTable'
```

add:

```ts
export { PageHeader } from './PageHeader'
```

- [ ] **Step 1.3: Verify**

```
cd frontend && npx tsc -b
```

Expected: exits with **0 errors**. (The `Tabs`/`TabItem` import resolves from `./Tabs`; `TabItem` is already exported there.)

- [ ] **Step 1.4: Commit**

```
git add frontend/src/design-system/primitives/PageHeader.tsx frontend/src/design-system/primitives/index.ts
git commit -m "feat(design-system): tambah primitive PageHeader (title+subtitle+tabs+actions)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Create `FilterToolbar` primitive + barrel export

`FilterToolbar` generalizes the current one-off `StockFilterToolbar`. It renders a search `Input` plus optional `filters` (Combobox/Select), `chipFilters` (chip-style toggles), `sortControl`, `actions`, and a `rightBadge`. On **desktop** filters render inline below the search; on **mobile** they collapse behind a `Sheet` triggered by a "Filter (N)" button with an active-filter count and a Reset action. Used by both Katalog Menu (Author B) and Stok (Author C).

- [ ] **Step 2.1: Create `FilterToolbar.tsx`**

**Files:**
- Create: `frontend/src/design-system/primitives/FilterToolbar.tsx`

```tsx
import { useState, type ReactNode } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import { Input } from './Input'
import { Button } from './Button'
import { Sheet } from './Sheet'
import { useIsMobile } from '../hooks/useMediaQuery'

interface FilterToolbarProps {
  search: { value: string; onChange: (v: string) => void; placeholder?: string }
  filters?: ReactNode
  chipFilters?: ReactNode
  sortControl?: ReactNode
  actions?: ReactNode
  rightBadge?: ReactNode
  onReset?: () => void
  activeFilterCount?: number
}

export function FilterToolbar({ search, filters, chipFilters, sortControl, actions, rightBadge, onReset, activeFilterCount = 0 }: FilterToolbarProps) {
  const isMobile = useIsMobile()
  const [sheetOpen, setSheetOpen] = useState(false)
  const hasFilters = Boolean(filters || chipFilters)
  return (
    <div className="bg-white rounded-xl p-3 border border-neutral-200/60 space-y-2.5">
      {(actions || rightBadge) && (
        <div className="flex items-center gap-2 flex-wrap">
          {actions}
          {rightBadge && <div className="ml-auto">{rightBadge}</div>}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input label="Cari" hideLabel type="search" inputMode="search" value={search.value} onChange={(e) => search.onChange(e.target.value)} placeholder={search.placeholder ?? 'Cari…'} leftIcon={<Search className="w-4 h-4" />} containerClassName="flex-1" />
        {isMobile && sortControl}
        {isMobile && hasFilters && (
          <Button variant="outline" size="md" leftIcon={<SlidersHorizontal className="w-4 h-4" />} onClick={() => setSheetOpen(true)} className="shrink-0">
            Filter{activeFilterCount > 0 ? ' (' + activeFilterCount + ')' : ''}
          </Button>
        )}
      </div>
      {!isMobile && hasFilters && (
        <div className="space-y-2.5">
          {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}
          {chipFilters}
        </div>
      )}
      {isMobile && (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen} title="Filter">
          <div className="px-4 py-3 space-y-3">
            {filters}
            {chipFilters}
            <div className="flex gap-2 pt-2">
              {onReset && <Button variant="outline" size="md" fullWidth onClick={onReset}>Reset</Button>}
              <Button variant="primary" size="md" fullWidth onClick={() => setSheetOpen(false)}>Terapkan</Button>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  )
}
```

> Note: `sortControl` renders inline only on mobile (beside search); on desktop the consuming page places its sort control among `filters`/`actions` as it sees fit. `Input` already supports `hideLabel`, `leftIcon`, and `containerClassName` (verified against `Input.tsx`), and `Sheet` already accepts `open`/`onOpenChange`/`title`/`children` (verified against `Sheet.tsx`).

- [ ] **Step 2.2: Add barrel export**

**Files:**
- Modify: `frontend/src/design-system/primitives/index.ts`

After the line added in Task 1:

```ts
export { PageHeader } from './PageHeader'
```

add:

```ts
export { FilterToolbar } from './FilterToolbar'
```

- [ ] **Step 2.3: Verify**

```
cd frontend && npx tsc -b
```

Expected: exits with **0 errors**.

- [ ] **Step 2.4: Commit**

```
git add frontend/src/design-system/primitives/FilterToolbar.tsx frontend/src/design-system/primitives/index.ts
git commit -m "feat(design-system): tambah primitive FilterToolbar (search+filters+mobile Sheet)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Extend `DataTable` with `expandable` + `rowClassName` + `rowId` (non-breaking)

The Katalog Menu "Menu Jual" tab (Author B) needs expandable parent rows; the focus-highlight scheme (Authors B & C) needs per-row `id` (for `scrollIntoView`) and a conditional ring `className`. All three new props are **optional**, so existing `DataTable` callers (BillsPage, PaymentMethodsPage, etc.) keep their current behavior unchanged.

**Behavior contract (locked):**
- New props: `expandable?: { canExpand(row): boolean; renderExpanded(row): ReactNode }`, `rowClassName?: (row, index) => string | undefined`, `rowId?: (row, index) => string | undefined`.
- Internal `useState<Set<string|number>>` `expanded`, keyed by `rowKey(row, idx)`.
- **Desktop:** when `expandable` is set, prepend a leading chevron column - a `<th className="w-8" aria-hidden />` and a leading `<td>` per row containing a chevron toggle button shown only when `canExpand(row)`. After each row's `<tr>`, if `expanded.has(key)` render a second `<tr>` with a single `<td colSpan={visibleCols.length + 1}>` wrapping `renderExpanded(row)`.
- **Mobile:** the card wrapper renders a chevron toggle (when `canExpand`) and `renderExpanded(row)` below the `mobileCard` output when expanded.
- Chevron `onClick` calls `e.stopPropagation()` so it coexists with `onRowClick`.
- `rowClassName(row, idx)` is applied to the desktop `<tr>` and the mobile card wrapper. `rowId(row, idx)` is applied as the `id` attribute on the desktop `<tr>` and the mobile card wrapper.
- Icons: `ChevronRight` / `ChevronDown` from `lucide-react`. Exporting `DataTableProps` is not required.

- [ ] **Step 3.1: Rewrite `DataTable.tsx` (complete file)**

**Files:**
- Modify: `frontend/src/design-system/primitives/DataTable.tsx`

Replace the **entire** file with:

```tsx
/**
 * DataTable - responsive list. Desktop tampilan <table> standard,
 * mobile auto-fallback ke card stack via mobileCard render-prop.
 *
 * Tidak include sorting/pagination/virtualization built-in supaya tetap
 * ringan. Untuk dataset besar bisa di-wrap dengan TanStack Table di
 * future kalau perlu.
 *
 * Opsional expandable-row (parent → children inline) + rowClassName +
 * rowId (untuk focus/scrollIntoView). Semua prop baru opsional →
 * pemanggil lama tidak terpengaruh.
 */

import { useState, type ReactNode } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '../hooks/useMediaQuery'
import { EmptyState } from './EmptyState'
import { Skeleton } from './Skeleton'

export interface DataTableColumn<T> {
  /** Unique key. Bisa string atau pakai dot path (mis. 'user.name'). */
  key: string
  /** Header label di desktop. */
  header: ReactNode
  /** Render cell. Default: ambil row[key] via key sederhana. */
  cell?: (row: T, index: number) => ReactNode
  /** Alignment desktop column. */
  align?: 'left' | 'center' | 'right'
  /** Hide kolom ini di mobile (kalau ada mobileCard, ini diabaikan). */
  hideMobile?: boolean
  /** Width hint untuk desktop (mis. 'w-32', 'min-w-40'). */
  className?: string
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: T[] | undefined
  /** Untuk skeleton loading row count. */
  isLoading?: boolean
  emptyTitle?: string
  emptyDescription?: ReactNode
  emptyAction?: ReactNode
  /** Render card untuk mobile (`<md`). Fallback ke table compact kalau tidak diisi. */
  mobileCard?: (row: T, index: number) => ReactNode
  /** Click handler row. */
  onRowClick?: (row: T) => void
  /** Key extractor unique per row. */
  rowKey: (row: T, index: number) => string | number
  className?: string
  /** Expandable row (parent → children inline). Opsional; default tak ada expand. */
  expandable?: { canExpand: (row: T) => boolean; renderExpanded: (row: T) => ReactNode }
  /** Class tambahan per baris (mis. ring sorot focus). */
  rowClassName?: (row: T, index: number) => string | undefined
  /** id attribute per baris (untuk scrollIntoView). */
  rowId?: (row: T, index: number) => string | undefined
}

function getCell<T>(row: T, col: DataTableColumn<T>, index: number): ReactNode {
  if (col.cell) return col.cell(row, index)
  // Simple key access (no dot path support to keep it simple)
  const value = (row as Record<string, unknown>)[col.key]
  return value as ReactNode
}

const ALIGN: Record<NonNullable<DataTableColumn<unknown>['align']>, string> = {
  left:   'text-left',
  center: 'text-center',
  right:  'text-right',
}

export function DataTable<T>({
  columns,
  data,
  isLoading,
  emptyTitle = 'Belum ada data',
  emptyDescription,
  emptyAction,
  mobileCard,
  onRowClick,
  rowKey,
  className,
  expandable,
  rowClassName,
  rowId,
}: DataTableProps<T>) {
  const isMobile = useIsMobile()
  const [expanded, setExpanded] = useState<Set<string | number>>(new Set())

  const toggle = (key: string | number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (isLoading) {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
        compact
      />
    )
  }

  // Mobile card view
  if (isMobile && mobileCard) {
    return (
      <div className={cn('space-y-2', className)}>
        {data.map((row, idx) => {
          const key = rowKey(row, idx)
          const canExpand = expandable ? expandable.canExpand(row) : false
          const isOpen = expanded.has(key)
          const wrapperClass = cn(
            'rounded-lg bg-white border border-neutral-200 p-3',
            rowClassName?.(row, idx)
          )
          const body = (
            <>
              <div className="flex items-start gap-2">
                {canExpand && (
                  <button
                    type="button"
                    aria-label={isOpen ? 'Tutup' : 'Buka'}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggle(key)
                    }}
                    className="shrink-0 -ml-1 mt-0.5 text-neutral-400 hover:text-neutral-600"
                  >
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                )}
                <div className="min-w-0 flex-1">{mobileCard(row, idx)}</div>
              </div>
              {canExpand && isOpen && (
                <div className="mt-2 pt-2 border-t border-neutral-100">
                  {expandable!.renderExpanded(row)}
                </div>
              )}
            </>
          )
          if (onRowClick) {
            return (
              <button
                key={key}
                id={rowId?.(row, idx)}
                type="button"
                onClick={() => onRowClick(row)}
                className={cn(
                  'w-full text-left rounded-lg bg-white border border-neutral-200 hover:border-neutral-300 active:bg-neutral-50 transition-colors p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
                  rowClassName?.(row, idx)
                )}
              >
                {body}
              </button>
            )
          }
          return (
            <div key={key} id={rowId?.(row, idx)} className={wrapperClass}>
              {body}
            </div>
          )
        })}
      </div>
    )
  }

  // Desktop table view
  const visibleCols = isMobile ? columns.filter((c) => !c.hideMobile) : columns
  const totalCols = visibleCols.length + (expandable ? 1 : 0)

  return (
    <div className={cn('rounded-lg border border-neutral-200 bg-white overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-body-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              {expandable && <th className="w-8" aria-hidden />}
              {visibleCols.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-3 py-2.5 text-label font-semibold text-neutral-600',
                    ALIGN[col.align ?? 'left'],
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {data.map((row, idx) => {
              const key = rowKey(row, idx)
              const canExpand = expandable ? expandable.canExpand(row) : false
              const isOpen = expanded.has(key)
              return (
                <tr
                  key={key}
                  id={rowId?.(row, idx)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    onRowClick && 'cursor-pointer hover:bg-neutral-50 transition-colors',
                    rowClassName?.(row, idx)
                  )}
                >
                  {expandable && (
                    <td className="w-8 px-2 py-2.5 align-top">
                      {canExpand && (
                        <button
                          type="button"
                          aria-label={isOpen ? 'Tutup' : 'Buka'}
                          onClick={(e) => {
                            e.stopPropagation()
                            toggle(key)
                          }}
                          className="text-neutral-400 hover:text-neutral-600"
                        >
                          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      )}
                    </td>
                  )}
                  {visibleCols.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-3 py-2.5 text-neutral-800',
                        ALIGN[col.align ?? 'left'],
                        col.className
                      )}
                    >
                      {getCell(row, col, idx)}
                    </td>
                  ))}
                </tr>
              )
            }).reduce<ReactNode[]>((acc, node, idx) => {
              acc.push(node)
              const row = data[idx]
              const key = rowKey(row, idx)
              if (expandable && expandable.canExpand(row) && expanded.has(key)) {
                acc.push(
                  <tr key={key + '-expanded'}>
                    <td colSpan={totalCols} className="px-3 pb-3 pt-0 bg-neutral-50/40">
                      {expandable.renderExpanded(row)}
                    </td>
                  </tr>
                )
              }
              return acc
            }, [])}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

> Implementation note: the desktop `<tbody>` builds the row `<tr>` nodes via `.map(...)` then `.reduce(...)` to interleave each expanded `<tr>` immediately after its parent (a `<tbody>` can hold the extra rows directly; this keeps each parent+panel adjacent). The expanded `<td colSpan={totalCols}>` spans the chevron column plus all visible columns. The chevron buttons call `e.stopPropagation()` so they never trigger `onRowClick`.

- [ ] **Step 3.2: Verify (tsc + build - touches a shared primitive)**

```
cd frontend && npx tsc -b && npm run build
```

Expected: `tsc -b` 0 errors and `npm run build` succeeds (vite build). Because all three props are optional, existing callers (BillsPage, PaymentMethodsPage, HistoryPage, etc.) compile and render unchanged.

- [ ] **Step 3.3: Commit**

```
git add frontend/src/design-system/primitives/DataTable.tsx
git commit -m "feat(design-system): DataTable expandable rows + rowClassName + rowId (non-breaking)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Create `components/menu/menuTree.ts` (shared FK helpers)

`menuTree.ts` holds the pure client-side helpers that invert the menu FK relations into parent/child maps, plus a label formatter for multi-parent badges. `buildParentMap` is the canonical version that **supersedes the inline `buildParentMap` currently embedded in `SkuVarianPage.tsx`** (Author B removes that inline copy when collapsing the page into `VarianSkuTab`). `buildChildrenMap` is new and powers the "Menu Jual" expandable tree (Author B). These are pure functions - verified by `tsc` and by the downstream Playwright e2e (Author D), not by a unit test (no vitest in this repo).

- [ ] **Step 4.1: Create `menuTree.ts`**

**Files:**
- Create: `frontend/src/components/menu/menuTree.ts`

```ts
import type { Menu } from '@/types'

export interface ParentRef { id: number; name: string }

export function buildParentMap(menus: Menu[]): Map<number, ParentRef[]> {
  const map = new Map<number, ParentRef[]>()
  const add = (skuId: number | null, parent: ParentRef) => {
    if (skuId == null) return
    const arr = map.get(skuId)
    if (arr) { if (!arr.some((p) => p.id === parent.id)) arr.push(parent) }
    else map.set(skuId, [parent])
  }
  for (const m of menus) {
    const ref: ParentRef = { id: m.id, name: m.name }
    if (m.kind === 'variant') {
      for (const v of m.variants ?? []) { add(v.stockTargetMenuId, ref); add(v.costSourceMenuId, ref) }
    } else if (m.kind === 'paket') {
      for (const c of m.paketComponents ?? []) { add(c.targetMenuId, ref); for (const co of c.choiceOptions) add(co.targetMenuId, ref) }
    }
  }
  return map
}

export function buildChildrenMap(menus: Menu[]): Map<number, number[]> {
  const map = new Map<number, number[]>()
  const add = (parentId: number, childId: number | null) => {
    if (childId == null) return
    const arr = map.get(parentId)
    if (arr) { if (!arr.includes(childId)) arr.push(childId) }
    else map.set(parentId, [childId])
  }
  for (const m of menus) {
    if (m.kind === 'variant') {
      for (const v of m.variants ?? []) { add(m.id, v.stockTargetMenuId); add(m.id, v.costSourceMenuId) }
    } else if (m.kind === 'paket') {
      for (const c of m.paketComponents ?? []) { add(m.id, c.targetMenuId); for (const co of c.choiceOptions) add(m.id, co.targetMenuId) }
    }
  }
  return map
}

export function parentBadgeLabel(parents: ParentRef[]): string {
  if (parents.length === 0) return ''
  const [first, ...rest] = parents
  return rest.length > 0 ? '↑ ' + first.name + ' +' + rest.length : '↑ ' + first.name
}
```

- [ ] **Step 4.2: Verify**

```
cd frontend && npx tsc -b
```

Expected: 0 errors. (Relies on the existing `Menu` type exposing `kind`, `variants[].stockTargetMenuId`, `variants[].costSourceMenuId`, `paketComponents[].targetMenuId`, and `paketComponents[].choiceOptions[].targetMenuId` - the same fields the current inline `buildParentMap` in `SkuVarianPage.tsx` already reads. If `tsc` flags a field name mismatch, reconcile against `@/types` before committing; do not invent fields.)

- [ ] **Step 4.3: Commit**

```
git add frontend/src/components/menu/menuTree.ts
git commit -m "feat(menu): helper menuTree (buildParentMap+buildChildrenMap+parentBadgeLabel)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```


---

## Phase 2 - Katalog Menu unification (Tasks 5-11)

> **Depends on Phase 1 (Author A):** `PageHeader`, `FilterToolbar`, and the `DataTable` expandable/`rowId`/`rowClassName` additions, plus `buildParentMap` / `buildChildrenMap` / `parentBadgeLabel` in `frontend/src/components/menu/menuTree.ts`. Do not start Phase 2 until those are merged/available; tsc will fail otherwise.
>
> **Shared contracts used here (locked, defined in Phase 1):**
> - `import { PageHeader, FilterToolbar, ... } from '@/design-system/primitives'`
> - `DataTable` props: `expandable?`, `rowClassName?`, `rowId?` (signatures per Phase 1 Task 3).
> - `import { buildParentMap, buildChildrenMap, parentBadgeLabel, type ParentRef } from '@/components/menu/menuTree'`
> - Auth store (verified): `import { useAuthStore } from '@/stores/authStore'`, used as `const { user } = useAuthStore()`. (Not needed in Phase 2 - Menu route is owner-only - but noted for consistency with Phase 3.)
> - `react-router-dom` is v7.10.1; `useSearchParams` / `useNavigate` are valid hooks (currently unused anywhere in `frontend/src`, so this phase introduces them).

---

- [ ] **Step 5: Create `MenuJualTab.tsx` (expandable tree of menu jual)**

This is the largest task. The tab hosts: the menu-jual table (filtered `posVisible=true`), the shared `FilterToolbar`, the expandable child-SKU sub-rows, and BOTH modals (`MenuFormModal` for create+edit, `CostHistoryDrawer` for cost history). It receives `menus` / `isLoading` / `showInactive` / `onShowInactiveChange` / `focusMenuId` / `clearFocus` from the host (Task 7) - it does **not** own the query.

**Files:**
- Create: `frontend/src/components/menu/MenuJualTab.tsx`

```tsx
// MenuJualTab.tsx - tab "Menu Jual" untuk Katalog Menu (REV UX elevation).
// Pohon expandable: baris menu jual (posVisible=true); kind variant/paket bisa
// di-expand → anak SKU (nama, stok, modal) resolved client-side via buildChildrenMap.
// Query + showInactive dimiliki host (MenuPage); tab ini menerima props.
import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, RotateCcw, History, ArrowRight } from 'lucide-react'
import { menuService } from '@/services/menuService'
import type { Menu, StockType } from '@/types'
import { formatCurrency, cn } from '@/lib/utils'
import {
  Button,
  IconButton,
  Combobox,
  Checkbox,
  Badge,
  DataTable,
  FilterToolbar,
  type DataTableColumn,
  type ComboboxOption,
} from '@/design-system/primitives'
import { useIsMobile } from '@/design-system/hooks/useMediaQuery'
import { useToast } from '@/design-system/hooks/useToast'
import { useConfirm } from '@/design-system/hooks/useConfirm'
import { useMutation } from '@tanstack/react-query'
import { MenuFormModal } from '@/components/MenuFormModal'
import { CostHistoryDrawer } from '@/components/menu/CostHistoryDrawer'
import { SortableHeader } from '@/components/stock/SortableHeader'
import { MenuTypeFilter, toggleStockType } from '@/components/stock/MenuTypeFilter'
import { buildChildrenMap } from '@/components/menu/menuTree'

type MenuSortKey = 'name' | 'price' | 'category'
type SortDir = 'asc' | 'desc'

const MENU_SORT_OPTIONS: ComboboxOption[] = [
  { value: 'category', label: 'Kategori' },
  { value: 'name', label: 'Nama (A–Z)' },
  { value: 'price', label: 'Harga (murah dulu)' },
]

const STOCK_TYPE_LABEL: Record<StockType, string> = {
  portion: 'Stok porsi',
  linked: 'Ikut menu lain',
  nonStock: 'Tidak di-track',
}

interface MenuJualTabProps {
  menus: Menu[]
  isLoading: boolean
  showInactive: boolean
  onShowInactiveChange: (v: boolean) => void
  focusMenuId: number | null
  clearFocus: () => void
}

export function MenuJualTab({
  menus,
  isLoading,
  showInactive,
  onShowInactiveChange,
  focusMenuId,
  clearFocus,
}: MenuJualTabProps) {
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const isMobile = useIsMobile()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [types, setTypes] = useState<Set<StockType>>(
    () => new Set<StockType>(['portion', 'linked', 'nonStock'])
  )
  const [sortKey, setSortKey] = useState<MenuSortKey>('category')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null)
  const [creatingNew, setCreatingNew] = useState(false)
  const [historyMenuId, setHistoryMenuId] = useState<number | null>(null)

  // "Menu Jual" hanya menu jual (posVisible=true). SKU tersembunyi ada di tab Varian SKU.
  const visibleMenus = useMemo(() => menus.filter((m) => m.posVisible), [menus])

  // Resolve anak SKU dari FK (kebalikan buildParentMap). menusById untuk lookup Menu lengkap.
  const childrenMap = useMemo(() => buildChildrenMap(menus), [menus])
  const menusById = useMemo(() => {
    const map = new Map<number, Menu>()
    for (const m of menus) map.set(m.id, m)
    return map
  }, [menus])

  const categories = useMemo(() => {
    const set = new Set(visibleMenus.map((m) => m.category))
    return Array.from(set).sort()
  }, [visibleMenus])

  const typeCounts = useMemo(() => {
    const c: Record<StockType, number> = { portion: 0, linked: 0, nonStock: 0 }
    for (const m of visibleMenus) c[m.stockType]++
    return c
  }, [visibleMenus])

  const setSort = (k: MenuSortKey) => {
    if (k === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(k)
      setSortDir('asc')
    }
  }
  const toggleType = (t: StockType) => setTypes((prev) => toggleStockType(prev, t))

  const filtered = useMemo(() => {
    let arr = visibleMenus.slice()
    if (categoryFilter !== 'all') arr = arr.filter((m) => m.category === categoryFilter)
    arr = arr.filter((m) => types.has(m.stockType))
    const q = search.trim().toLowerCase()
    if (q) arr = arr.filter((m) => m.name.toLowerCase().includes(q))
    const dir = sortDir === 'asc' ? 1 : -1
    const byName = (a: Menu, b: Menu) => a.name.localeCompare(b.name, 'id')
    arr.sort((a, b) => {
      let p = 0
      if (sortKey === 'name') p = byName(a, b)
      else if (sortKey === 'price') p = Number(a.price) - Number(b.price)
      else p = a.category.localeCompare(b.category, 'id')
      if (p !== 0) return p * dir
      return byName(a, b)
    })
    return arr
  }, [visibleMenus, categoryFilter, types, search, sortKey, sortDir])

  const deactivate = useMutation({
    mutationFn: (id: number) => menuService.deactivate(id),
    onSuccess: () => {
      toast.success('Menu dinonaktifkan')
      qc.invalidateQueries({ queryKey: ['menus'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const reactivate = useMutation({
    mutationFn: (id: number) => menuService.reactivate(id),
    onSuccess: () => {
      toast.success('Menu diaktifkan kembali')
      qc.invalidateQueries({ queryKey: ['menus'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleDeactivate = async (m: Menu) => {
    const ok = await confirm({
      title: `Nonaktifkan "${m.name}"?`,
      description: 'Menu tidak akan tampil di POS sampai diaktifkan kembali.',
      confirmText: 'Ya, Nonaktifkan',
      tone: 'danger',
    })
    if (!ok) return
    deactivate.mutate(m.id)
  }

  const categoryOptions: ComboboxOption[] = [
    { value: 'all', label: 'Semua kategori' },
    ...categories.map((c) => ({ value: c, label: c })),
  ]

  const columns: DataTableColumn<Menu>[] = [
    {
      key: 'name',
      header: (
        <SortableHeader
          label="Menu"
          active={sortKey === 'name'}
          dir={sortDir}
          onSort={() => setSort('name')}
        />
      ),
      cell: (m) => (
        <div className={cn(!m.isActive && 'opacity-60')}>
          <div className="font-medium text-neutral-900">{m.name}</div>
          <div className="text-caption text-neutral-500 md:hidden">{m.category}</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {/* REV 2.10: badge berbasis kind (variant/paket) gantikan subOptions JSON. */}
            {m.kind === 'variant' && (
              <Badge tone="primary" size="sm">
                {m.variants?.length ?? 0} varian
              </Badge>
            )}
            {m.kind === 'paket' && (
              <Badge tone="primary" size="sm">
                Paket
              </Badge>
            )}
            {!m.isActive && <Badge tone="neutral" variant="outline" size="sm">Nonaktif</Badge>}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: (
        <SortableHeader
          label="Kategori"
          active={sortKey === 'category'}
          dir={sortDir}
          onSort={() => setSort('category')}
        />
      ),
      hideMobile: true,
      cell: (m) => <span className="text-neutral-700">{m.category}</span>,
    },
    {
      key: 'price',
      header: (
        <SortableHeader
          label="Harga"
          align="right"
          active={sortKey === 'price'}
          dir={sortDir}
          onSort={() => setSort('price')}
        />
      ),
      align: 'right',
      cell: (m) => (
        <span className="font-medium text-neutral-900 tabular-nums">
          {formatCurrency(m.price)}
        </span>
      ),
    },
    {
      // REV 2.11: modal/COGS per menu. Parent variant/paket → cost null → "-".
      key: 'cost',
      header: 'Modal',
      align: 'right',
      hideMobile: true,
      cell: (m) => (
        <span className="text-neutral-700 tabular-nums">
          {m.cost != null ? formatCurrency(m.cost) : '-'}
        </span>
      ),
    },
    {
      key: 'stock',
      header: 'Stok',
      cell: (m) => (
        <div>
          <div className="text-caption text-neutral-500">{STOCK_TYPE_LABEL[m.stockType]}</div>
          {m.stockType === 'portion' && (
            <div className="text-body-sm text-neutral-700 tabular-nums">
              {m.portionStock?.currentQty ?? '-'} / min {m.minStock ?? 0}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (m) => (
        <div className="inline-flex items-center gap-1">
          {m.stockType === 'portion' && (
            <Button
              variant="outline"
              size="sm"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              onClick={(e) => {
                e.stopPropagation()
                navigate('/stock?focusMenuId=' + m.id)
              }}
            >
              Stok
            </Button>
          )}
          <IconButton
            label={`Riwayat modal ${m.name}`}
            icon={<History />}
            variant="ghost"
            size="sm"
            onClick={() => setHistoryMenuId(m.id)}
          />
          <IconButton
            label={`Edit ${m.name}`}
            icon={<Pencil />}
            variant="ghost"
            size="sm"
            onClick={() => setEditingMenu(m)}
          />
          {m.isActive ? (
            <IconButton
              label={`Nonaktifkan ${m.name}`}
              icon={<Trash2 />}
              variant="ghost"
              size="sm"
              onClick={() => handleDeactivate(m)}
              className="text-danger-700 hover:bg-danger-50"
            />
          ) : (
            <IconButton
              label={`Aktifkan ${m.name}`}
              icon={<RotateCcw />}
              variant="ghost"
              size="sm"
              onClick={() => reactivate.mutate(m.id)}
              className="text-success-700 hover:bg-success-50"
            />
          )}
        </div>
      ),
    },
  ]

  // Render anak SKU (resolve childrenMap → menusById). Dipakai expandable.renderExpanded.
  const renderExpanded = (m: Menu) => {
    const childIds = childrenMap.get(m.id) ?? []
    const children = childIds
      .map((id) => menusById.get(id))
      .filter((c): c is Menu => c != null)
    if (children.length === 0) {
      return (
        <div className="px-3 py-2 text-caption text-neutral-500">Tidak ada anak SKU.</div>
      )
    }
    return (
      <div className="bg-neutral-50/60 px-3 py-2 space-y-1.5">
        {children.map((c) => {
          const ps = c.portionStock
          const low = ps ? ps.currentQty <= ps.minStock : false
          return (
            <div
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-md bg-white border border-neutral-200/60 px-2.5 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-neutral-800 text-body-sm">{c.name}</p>
                <p className="text-caption text-neutral-500">{c.category}</p>
              </div>
              <div className="text-right shrink-0">
                {c.stockType === 'portion' && ps ? (
                  <span
                    className={cn(
                      'font-semibold tabular-nums text-body-sm',
                      ps.currentQty <= 0
                        ? 'text-danger-700'
                        : low
                          ? 'text-warning-700'
                          : 'text-neutral-900'
                    )}
                  >
                    {ps.currentQty}
                  </span>
                ) : (
                  <span className="text-neutral-300">-</span>
                )}
              </div>
              <div className="text-right shrink-0 text-caption text-neutral-700 tabular-nums w-16">
                {c.cost != null ? formatCurrency(c.cost) : '-'}
              </div>
              <div className="inline-flex items-center gap-1 shrink-0">
                {c.stockType === 'portion' && (
                  <Button
                    variant="outline"
                    size="sm"
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                    onClick={() => navigate('/stock?focusMenuId=' + c.id)}
                  >
                    Stok
                  </Button>
                )}
                <IconButton
                  label={`Edit ${c.name}`}
                  icon={<Pencil />}
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingMenu(c)}
                />
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Focus highlight + auto-expand induk yang difokuskan.
  useEffect(() => {
    if (focusMenuId == null) return
    document.getElementById('katalog-row-' + focusMenuId)?.scrollIntoView({ block: 'center' })
    const t = setTimeout(clearFocus, 2000)
    return () => clearTimeout(t)
  }, [focusMenuId, clearFocus])

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 space-y-3">
      <FilterToolbar
        search={{ value: search, onChange: setSearch, placeholder: 'Cari menu…' }}
        filters={
          <>
            <Combobox
              hideLabel
              label="Filter kategori"
              value={categoryFilter}
              onValueChange={setCategoryFilter}
              options={categoryOptions}
              searchPlaceholder="Cari kategori..."
              containerClassName="min-w-[12rem]"
            />
            <Checkbox
              label="Tampilkan nonaktif"
              checked={showInactive}
              onCheckedChange={onShowInactiveChange}
            />
          </>
        }
        chipFilters={<MenuTypeFilter selected={types} counts={typeCounts} onToggle={toggleType} />}
        sortControl={
          isMobile ? (
            <Combobox
              hideLabel
              label="Urutkan"
              value={sortKey}
              onValueChange={(v) => setSort(v as MenuSortKey)}
              options={MENU_SORT_OPTIONS}
              containerClassName="w-[12rem] shrink-0"
            />
          ) : undefined
        }
        actions={
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setCreatingNew(true)}
          >
            Menu
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={isLoading ? undefined : filtered}
        isLoading={isLoading}
        rowKey={(m) => m.id}
        rowId={(m) => 'katalog-row-' + m.id}
        rowClassName={(m) =>
          m.id === focusMenuId ? 'ring-2 ring-primary-400 ring-inset' : undefined
        }
        expandable={{
          canExpand: (m) => m.kind === 'variant' || m.kind === 'paket',
          renderExpanded,
        }}
        emptyTitle="Belum ada menu"
        emptyDescription={
          search || categoryFilter !== 'all'
            ? 'Tidak ada menu cocok dengan filter.'
            : 'Tambah menu jual lewat tombol Menu.'
        }
        mobileCard={(m) => (
          <div className={cn(!m.isActive && 'opacity-60', 'space-y-1.5')}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-neutral-900">{m.name}</p>
                <p className="text-caption text-neutral-500">{m.category}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {/* REV 2.10: badge berbasis kind. */}
                  {m.kind === 'variant' && (
                    <Badge tone="primary" size="sm">{m.variants?.length ?? 0} varian</Badge>
                  )}
                  {m.kind === 'paket' && (
                    <Badge tone="primary" size="sm">Paket</Badge>
                  )}
                  {m.stockType === 'portion' && (
                    <Badge tone="neutral" size="sm">
                      {m.portionStock?.currentQty ?? 0}/{m.minStock ?? 0}
                    </Badge>
                  )}
                  {!m.isActive && <Badge tone="neutral" variant="outline" size="sm">Nonaktif</Badge>}
                </div>
              </div>
              <p className="font-semibold text-neutral-900 tabular-nums shrink-0">
                {formatCurrency(m.price)}
              </p>
            </div>
            <div className="flex items-center justify-end gap-1 pt-1.5 border-t border-neutral-100">
              {m.stockType === 'portion' && (
                <Button
                  variant="outline"
                  size="sm"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  onClick={() => navigate('/stock?focusMenuId=' + m.id)}
                >
                  Stok
                </Button>
              )}
              <IconButton label="Riwayat modal" icon={<History />} variant="ghost" size="sm" onClick={() => setHistoryMenuId(m.id)} />
              <IconButton label="Edit" icon={<Pencil />} variant="ghost" size="sm" onClick={() => setEditingMenu(m)} />
              {m.isActive ? (
                <IconButton
                  label="Nonaktifkan"
                  icon={<Trash2 />}
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeactivate(m)}
                  className="text-danger-700"
                />
              ) : (
                <IconButton
                  label="Aktifkan"
                  icon={<RotateCcw />}
                  variant="ghost"
                  size="sm"
                  onClick={() => reactivate.mutate(m.id)}
                  className="text-success-700"
                />
              )}
            </div>
          </div>
        )}
      />

      {(creatingNew || editingMenu) && (
        <MenuFormModal
          existing={editingMenu}
          onClose={() => {
            setCreatingNew(false)
            setEditingMenu(null)
          }}
          onSuccess={() => {
            setCreatingNew(false)
            setEditingMenu(null)
            qc.invalidateQueries({ queryKey: ['menus'] })
          }}
        />
      )}

      {historyMenuId != null && (
        <CostHistoryDrawer menuId={historyMenuId} onClose={() => setHistoryMenuId(null)} />
      )}
    </div>
  )
}
```

> **Notes on fidelity to extraction:**
> - Columns/`mobileCard`/mutations/`handleDeactivate`/`filtered`/`setSort`/`toggleType`/`STOCK_TYPE_LABEL`/`MENU_SORT_OPTIONS`/`categoryOptions` are transcribed verbatim from `MenuPage.tsx` (extraction §3–§9). The only additions are the `"Stok"` Button (D5, portion-only) and the expandable `renderExpanded`.
> - The page-shell `<div className="h-full overflow-y-auto">` + `<header>Kelola Menu</header>` from MenuPage are intentionally REMOVED - those move to the host (Task 7) as `PageHeader`. This tab keeps the inner `max-w-6xl mx-auto px-3 sm:px-4 py-4 space-y-3` wrapper for the toolbar+table.
> - `MenuFormModal` (extraction "MenuFormModal" §) and `CostHistoryDrawer` (extraction "CostHistoryDrawer" §) are wired identically to MenuPage; `existing={editingMenu}` (`null` = create when `creatingNew`).
> - `DataTable` receives `data={isLoading ? undefined : filtered}` + `isLoading={isLoading}` so the primitive's own skeleton branch handles loading (no local Skeleton needed; the host no longer renders one).

**Verification:**
- [ ] Run `cd frontend && npx tsc -b` → 0 errors (Phase 1 `DataTable` props + `menuTree` exports must already exist).

**Commit:**
- [ ] `git add frontend/src/components/menu/MenuJualTab.tsx && git commit -m "feat(menu): MenuJualTab pohon expandable + FilterToolbar + Stok link

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

- [ ] **Step 6: Create `VarianSkuTab.tsx` (flat list of hidden SKUs)**

Moves `SkuVarianPage` logic verbatim (filter `!posVisible`, categories from hidden, sort category-then-name) MINUS the page shell. Uses `buildParentMap` from `menuTree` (returns `ParentRef[]`, not `string[]`). The Induk column becomes a real LINK button (D4) instead of a Badge; orphan stays the warning Badge. Adds the `"Stok"` Button on portion rows.

**Files:**
- Create: `frontend/src/components/menu/VarianSkuTab.tsx`

```tsx
// VarianSkuTab.tsx - tab "Varian SKU" untuk Katalog Menu (REV UX elevation).
// Daftar datar semua SKU posVisible=false (termasuk yatim & multi-induk).
// Induk = LINK teks klikable (D4) → tab Menu Jual + focusMenuId. Yatim = badge warning.
// Query + showInactive dimiliki host (MenuPage); tab ini menerima props.
import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Pencil, History, ArrowRight } from 'lucide-react'
import type { Menu } from '@/types'
import { formatCurrency, cn } from '@/lib/utils'
import {
  Combobox,
  Checkbox,
  Badge,
  Button,
  IconButton,
  DataTable,
  FilterToolbar,
  type DataTableColumn,
  type ComboboxOption,
} from '@/design-system/primitives'
import { MenuFormModal } from '@/components/MenuFormModal'
import { CostHistoryDrawer } from '@/components/menu/CostHistoryDrawer'
import { buildParentMap, parentBadgeLabel } from '@/components/menu/menuTree'

interface VarianSkuTabProps {
  menus: Menu[]
  isLoading: boolean
  showInactive: boolean
  onShowInactiveChange: (v: boolean) => void
  focusMenuId: number | null
  clearFocus: () => void
}

export function VarianSkuTab({
  menus,
  isLoading,
  showInactive,
  onShowInactiveChange,
  focusMenuId,
  clearFocus,
}: VarianSkuTabProps) {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null)
  const [historyMenuId, setHistoryMenuId] = useState<number | null>(null)

  // parentMap dari SELURUH menu (induk = menu visible), lalu tampilkan yang hidden.
  const parentMap = useMemo(() => buildParentMap(menus), [menus])
  const hidden = useMemo(() => menus.filter((m) => !m.posVisible), [menus])

  const categories = useMemo(
    () => Array.from(new Set(hidden.map((m) => m.category))).sort(),
    [hidden],
  )

  const filtered = useMemo(() => {
    let arr = hidden.slice()
    if (categoryFilter !== 'all') arr = arr.filter((m) => m.category === categoryFilter)
    const q = search.trim().toLowerCase()
    if (q) arr = arr.filter((m) => m.name.toLowerCase().includes(q))
    arr.sort(
      (a, b) =>
        a.category.localeCompare(b.category, 'id') || a.name.localeCompare(b.name, 'id'),
    )
    return arr
  }, [hidden, categoryFilter, search])

  const categoryOptions: ComboboxOption[] = [
    { value: 'all', label: 'Semua kategori' },
    ...categories.map((c) => ({ value: c, label: c })),
  ]

  const columns: DataTableColumn<Menu>[] = [
    {
      key: 'name',
      header: 'Nama SKU',
      cell: (m) => (
        <div className={cn(!m.isActive && 'opacity-60')}>
          <div className="font-medium text-neutral-900">{m.name}</div>
          <div className="text-caption text-neutral-500 md:hidden">{m.category}</div>
          {!m.isActive && (
            <Badge tone="neutral" variant="outline" size="sm">
              Nonaktif
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'parent',
      header: 'Induk',
      cell: (m) => {
        const parents = parentMap.get(m.id) ?? []
        if (parents.length === 0)
          return (
            <Badge tone="warning" variant="outline" size="sm">
              tanpa induk
            </Badge>
          )
        return (
          <button
            type="button"
            title={parents.map((p) => p.name).join(', ')}
            onClick={(e) => {
              e.stopPropagation()
              navigate('/menu?tab=jual&focusMenuId=' + parents[0].id)
            }}
            className="text-primary-700 hover:underline text-body-sm"
          >
            {parentBadgeLabel(parents)}
          </button>
        )
      },
    },
    {
      key: 'category',
      header: 'Kategori',
      hideMobile: true,
      cell: (m) => <span className="text-neutral-700">{m.category}</span>,
    },
    {
      key: 'stock',
      header: 'Stok',
      align: 'right',
      cell: (m) => {
        if (m.stockType !== 'portion' || !m.portionStock)
          return <span className="text-neutral-300">-</span>
        const { currentQty, minStock } = m.portionStock
        const low = currentQty <= minStock
        return (
          <span
            className={cn(
              'font-semibold tabular-nums',
              currentQty <= 0
                ? 'text-danger-700'
                : low
                  ? 'text-warning-700'
                  : 'text-neutral-900',
            )}
          >
            {currentQty}
          </span>
        )
      },
    },
    {
      key: 'cost',
      header: 'Modal',
      align: 'right',
      cell: (m) => (
        <span className="text-neutral-700 tabular-nums">
          {m.cost != null ? formatCurrency(m.cost) : '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (m) => (
        <div className="inline-flex items-center gap-1">
          {m.stockType === 'portion' && (
            <Button
              variant="outline"
              size="sm"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              onClick={(e) => {
                e.stopPropagation()
                navigate('/stock?focusMenuId=' + m.id)
              }}
            >
              Stok
            </Button>
          )}
          <IconButton
            label={`Riwayat modal ${m.name}`}
            icon={<History />}
            variant="ghost"
            size="sm"
            onClick={() => setHistoryMenuId(m.id)}
          />
          <IconButton
            label={`Edit ${m.name}`}
            icon={<Pencil />}
            variant="ghost"
            size="sm"
            onClick={() => setEditingMenu(m)}
          />
        </div>
      ),
    },
  ]

  useEffect(() => {
    if (focusMenuId == null) return
    document.getElementById('katalog-row-' + focusMenuId)?.scrollIntoView({ block: 'center' })
    const t = setTimeout(clearFocus, 2000)
    return () => clearTimeout(t)
  }, [focusMenuId, clearFocus])

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 space-y-3">
      <FilterToolbar
        search={{ value: search, onChange: setSearch, placeholder: 'Cari SKU…' }}
        filters={
          <>
            <Combobox
              hideLabel
              label="Filter kategori"
              value={categoryFilter}
              onValueChange={setCategoryFilter}
              options={categoryOptions}
              searchPlaceholder="Cari kategori..."
              containerClassName="min-w-[12rem]"
            />
            <Checkbox
              label="Tampilkan nonaktif"
              checked={showInactive}
              onCheckedChange={onShowInactiveChange}
            />
          </>
        }
      />

      <DataTable
        columns={columns}
        data={isLoading ? undefined : filtered}
        isLoading={isLoading}
        rowKey={(m) => m.id}
        rowId={(m) => 'katalog-row-' + m.id}
        rowClassName={(m) =>
          m.id === focusMenuId ? 'ring-2 ring-primary-400 ring-inset' : undefined
        }
        emptyTitle="Belum ada SKU varian"
        emptyDescription={
          search || categoryFilter !== 'all'
            ? 'Tidak ada SKU cocok dengan filter.'
            : 'SKU tersembunyi muncul di sini saat ada menu varian/paket.'
        }
        mobileCard={(m) => {
          const parents = parentMap.get(m.id) ?? []
          return (
            <div className={cn(!m.isActive && 'opacity-60', 'space-y-1.5')}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-neutral-900">{m.name}</p>
                  <p className="text-caption text-neutral-500">{m.category}</p>
                  {/* Mobile: tampilkan nama induk penuh (jangan andalkan tooltip hover). */}
                  {parents.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => navigate('/menu?tab=jual&focusMenuId=' + parents[0].id)}
                      className="text-primary-700 hover:underline text-caption text-left"
                    >
                      ↑ {parents.map((p) => p.name).join(', ')}
                    </button>
                  ) : (
                    <Badge tone="warning" variant="outline" size="sm">
                      tanpa induk
                    </Badge>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {m.stockType === 'portion' && m.portionStock && (
                      <Badge tone="neutral" size="sm">
                        stok {m.portionStock.currentQty}
                      </Badge>
                    )}
                    {!m.isActive && (
                      <Badge tone="neutral" variant="outline" size="sm">
                        Nonaktif
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="text-right shrink-0 text-body-sm text-neutral-700 tabular-nums">
                  {m.cost != null ? formatCurrency(m.cost) : '-'}
                </p>
              </div>
              <div className="flex items-center justify-end gap-1 pt-1.5 border-t border-neutral-100">
                {m.stockType === 'portion' && (
                  <Button
                    variant="outline"
                    size="sm"
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                    onClick={() => navigate('/stock?focusMenuId=' + m.id)}
                  >
                    Stok
                  </Button>
                )}
                <IconButton
                  label="Riwayat modal"
                  icon={<History />}
                  variant="ghost"
                  size="sm"
                  onClick={() => setHistoryMenuId(m.id)}
                />
                <IconButton
                  label="Edit"
                  icon={<Pencil />}
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingMenu(m)}
                />
              </div>
            </div>
          )
        }}
      />

      {editingMenu && (
        <MenuFormModal
          existing={editingMenu}
          onClose={() => setEditingMenu(null)}
          onSuccess={() => {
            setEditingMenu(null)
            qc.invalidateQueries({ queryKey: ['menus'] })
          }}
        />
      )}

      {historyMenuId != null && (
        <CostHistoryDrawer menuId={historyMenuId} onClose={() => setHistoryMenuId(null)} />
      )}
    </div>
  )
}
```

> **Notes on fidelity to extraction:**
> - `parentMap` / `hidden` / `categories` / `filtered` / `categoryOptions` and the desktop columns `name`/`category`/`stock`/`cost`/`actions` + `mobileCard` are transcribed from `SkuVarianPage.tsx` (extraction §5–§9), except:
>   1. `buildParentMap` now returns `Map<number, ParentRef[]>` (Phase 1 `menuTree.ts`), so the parent cell reads `parents[0].id` / `p.name` and `parentBadgeLabel(parents)` takes `ParentRef[]`.
>   2. The Induk cell is a `<button>` link (D4) replacing the old `<Badge tone="primary" variant="outline">`. Orphan badge tone is now **`warning`** (D4, was `neutral` in extraction).
>   3. Added `"Stok"` Button on portion rows (D5) in both desktop `actions` and `mobileCard`.
> - Page shell (`h-full overflow-y-auto` + `<header>SKU Varian</header>` + local `Skeleton`) is removed; host owns `PageHeader`, and `DataTable`'s `isLoading` handles the skeleton.
> - This tab has **no create flow** (edit-only, matching SkuVarianPage) - `MenuFormModal` gated on `editingMenu &&`.

**Verification:**
- [ ] Run `cd frontend && npx tsc -b` → 0 errors.

**Commit:**
- [ ] `git add frontend/src/components/menu/VarianSkuTab.tsx && git commit -m "feat(menu): VarianSkuTab daftar datar + induk link klikable (D4) + Stok link

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

- [ ] **Step 7: Rewrite `MenuPage.tsx` as the Katalog Menu host (PageHeader + Tabs + shared query)**

The host owns: the shared `useQuery` (key `['menus','admin',showInactive]`, params `{ activeOnly:!showInactive, includeStock:true, includeHidden:true }`), `showInactive` state, `useSearchParams`, the `resolvedTab` / `focusMenuId` resolution, the counts, the `PageHeader` (title "Katalog Menu" + tabs), and renders `MenuJualTab` / `VarianSkuTab`. The `focusMenuId` is passed only to the active tab; the inactive tab gets `null`.

**Files:**
- Modify (full rewrite): `frontend/src/pages/MenuPage.tsx`

Replace the ENTIRE file contents with:

```tsx
// MenuPage.tsx - host "Katalog Menu" (REV UX elevation).
// PageHeader + Tabs (Menu Jual / Varian SKU). Memegang query bersama
// (key ['menus','admin',showInactive] - SAMA dgn MenuFormModal supaya cache
// konsisten) + showInactive + routing tab via ?tab + focusMenuId.
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { menuService } from '@/services/menuService'
import { PageHeader } from '@/design-system/primitives'
import { MenuJualTab } from '@/components/menu/MenuJualTab'
import { VarianSkuTab } from '@/components/menu/VarianSkuTab'

export default function MenuPage() {
  const [showInactive, setShowInactive] = useState(false)
  const [params, setParams] = useSearchParams()

  const { data: menus = [], isLoading } = useQuery({
    // includeHidden TETAP true (owner token bikin backend kirim cost) supaya
    // cache konsisten dengan MenuFormModal. SKU posVisible=false ditampilkan di
    // tab "Varian SKU"; menu jual (posVisible=true) di tab "Menu Jual".
    queryKey: ['menus', 'admin', showInactive],
    queryFn: () => menuService.list({ activeOnly: !showInactive, includeStock: true, includeHidden: true }),
  })

  const focusMenuId = params.get('focusMenuId') ? Number(params.get('focusMenuId')) : null
  const explicitTab = params.get('tab')

  const resolvedTab: 'jual' | 'varian' =
    explicitTab === 'varian'
      ? 'varian'
      : explicitTab === 'jual'
        ? 'jual'
        : focusMenuId != null
          ? menus.find((m) => m.id === focusMenuId)?.posVisible === false
            ? 'varian'
            : 'jual'
          : 'jual'

  const setTab = (t: 'jual' | 'varian') =>
    setParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        n.set('tab', t)
        n.delete('focusMenuId')
        return n
      },
      { replace: true },
    )

  const clearFocus = () =>
    setParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        n.delete('focusMenuId')
        return n
      },
      { replace: true },
    )

  const menuJualCount = useMemo(() => menus.filter((m) => m.posVisible).length, [menus])
  const varianCount = useMemo(() => menus.filter((m) => !m.posVisible).length, [menus])

  // Bila focusMenuId resolve ke SKU tersembunyi tapi tab default 'jual', resolvedTab
  // sudah pindah ke 'varian' di atas - tak perlu efek tambahan di sini.
  useEffect(() => {
    // no-op placeholder; tab-aktif yang menangani scrollIntoView + clearFocus.
  }, [focusMenuId])

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Katalog Menu"
        subtitle={`${menuJualCount} menu jual · ${varianCount} varian SKU`}
        tabs={{
          value: resolvedTab,
          onValueChange: (v) => setTab(v as 'jual' | 'varian'),
          items: [
            { value: 'jual', label: 'Menu Jual' },
            { value: 'varian', label: 'Varian SKU' },
          ],
        }}
      />

      <div className="flex-1 min-h-0 overflow-y-auto">
        {resolvedTab === 'jual' ? (
          <MenuJualTab
            menus={menus}
            isLoading={isLoading}
            showInactive={showInactive}
            onShowInactiveChange={setShowInactive}
            focusMenuId={resolvedTab === 'jual' ? focusMenuId : null}
            clearFocus={clearFocus}
          />
        ) : (
          <VarianSkuTab
            menus={menus}
            isLoading={isLoading}
            showInactive={showInactive}
            onShowInactiveChange={setShowInactive}
            focusMenuId={resolvedTab === 'varian' ? focusMenuId : null}
            clearFocus={clearFocus}
          />
        )}
      </div>
    </div>
  )
}
```

> **Notes:**
> - Default export stays `MenuPage` → `App.tsx` route + `pages/index.ts` line 9 (`export { default as MenuPage } from './MenuPage'`) remain valid (no change to either for this task; the route element is touched in Task 8 only to swap the sku-varian redirect).
> - The shared query key + params are byte-identical to the old MenuPage/SkuVarianPage (extraction MenuPage §2, SkuVarian §4) → cache sharing with `MenuFormModal` preserved.
> - `resolvedTab` + `setTab` + `clearFocus` + counts are transcribed verbatim from the locked Routing/URL-scheme contract. Per contract: `setTab` deletes `focusMenuId`; switching tab while a row is focused clears the highlight (acceptable).
> - The empty `useEffect` is a documented no-op (the active tab owns `scrollIntoView`+`clearFocus` per Step 5/6). If lint flags an empty effect, delete it - it carries no logic.

**Verification:**
- [ ] Run `cd frontend && npx tsc -b` → 0 errors.
- [ ] Run `cd frontend && npm run lint` → 0 errors (an empty `useEffect` may warn; if so, remove it and re-run).

**Commit:**
- [ ] `git add frontend/src/pages/MenuPage.tsx && git commit -m "refactor(menu): MenuPage jadi host Katalog Menu (PageHeader + Tabs + query bersama)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

- [ ] **Step 8: Modify `App.tsx` - redirect `/menu/sku-varian` + drop `SkuVarianPage` import**

**Files:**
- Modify: `frontend/src/App.tsx`

Edit 1 - remove `SkuVarianPage` from the `from './pages'` import block (it is no longer referenced after Edit 2). Current (extraction / verified, lines 5-20):

```tsx
import {
  LoginPage,
  POSPage,
  TablesPage,
  HistoryPage,
  SettlementPage,
  StockPage,
  MenuPage,
  SkuVarianPage,
  UsersPage,
  BillsPage,
  PaymentMethodsPage,
  OwnerDashboard,
  CashierDashboard,
  WaiterDashboard,
} from './pages'
```

becomes (delete the `SkuVarianPage,` line):

```tsx
import {
  LoginPage,
  POSPage,
  TablesPage,
  HistoryPage,
  SettlementPage,
  StockPage,
  MenuPage,
  UsersPage,
  BillsPage,
  PaymentMethodsPage,
  OwnerDashboard,
  CashierDashboard,
  WaiterDashboard,
} from './pages'
```

Edit 2 - replace the `/menu/sku-varian` route element with a redirect. Current (extraction, App.tsx:84-85):

```tsx
          <Route path="menu" element={<RoleRoute allow={['owner']}><MenuPage /></RoleRoute>} />
          <Route path="menu/sku-varian" element={<RoleRoute allow={['owner']}><SkuVarianPage /></RoleRoute>} />
```

becomes:

```tsx
          <Route path="menu" element={<RoleRoute allow={['owner']}><MenuPage /></RoleRoute>} />
          <Route path="menu/sku-varian" element={<Navigate to="/menu?tab=varian" replace />} />
```

> `Navigate` is already imported (`App.tsx:1`). The redirect preserves the query string and uses `replace` (no history loop, per spec §15). Bookmark `/menu/sku-varian` stays valid (D3).

**Verification:**
- [ ] Run `cd frontend && npx tsc -b` → 0 errors (no remaining reference to `SkuVarianPage`).

**Commit:**
- [ ] `git add frontend/src/App.tsx && git commit -m "feat(menu): redirect /menu/sku-varian ke /menu?tab=varian + drop import

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

- [ ] **Step 9: Modify `pages/index.ts` - remove `SkuVarianPage` export**

**Files:**
- Modify: `frontend/src/pages/index.ts`

Delete this line (verified, `pages/index.ts:10`):

```tsx
export { default as SkuVarianPage } from './SkuVarianPage'
```

The surrounding context (verified, lines 9-11) before:

```tsx
export { default as MenuPage } from './MenuPage'
export { default as SkuVarianPage } from './SkuVarianPage'
export { default as UsersPage } from './UsersPage'
```

after:

```tsx
export { default as MenuPage } from './MenuPage'
export { default as UsersPage } from './UsersPage'
```

**Verification:**
- [ ] Run `cd frontend && npx tsc -b` → 0 errors.

**Commit:**
- [ ] `git add frontend/src/pages/index.ts && git commit -m "chore(menu): hapus export SkuVarianPage dari pages barrel

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

- [ ] **Step 10: Modify `Layout.tsx` - delete SKU Varian nav item + `Boxes` import**

**Files:**
- Modify: `frontend/src/components/Layout.tsx`

Edit 1 - delete the SKU Varian nav line from the `owner` array. Current (extraction, Layout.tsx owner block, lines 49-50):

```tsx
    { to: '/menu',       icon: UtensilsCrossed,  label: 'Menu', end: true },
    { to: '/menu/sku-varian', icon: Boxes,       label: 'SKU Varian' },
    { to: '/payment-methods', icon: CreditCard,  label: 'Pembayaran' },
```

becomes (remove the `/menu/sku-varian` line; keep `end: true` on Menu - `/menu` is now the only `/menu*` route so exact-match is still correct):

```tsx
    { to: '/menu',       icon: UtensilsCrossed,  label: 'Menu', end: true },
    { to: '/payment-methods', icon: CreditCard,  label: 'Pembayaran' },
```

Edit 2 - remove `Boxes` from the lucide-react import (it has no other use, per extraction note). Locate the lucide-react import line at `Layout.tsx:21` (verified it contains `Boxes`) and delete the `Boxes` token from the destructured list (leave all other icons intact). For example, if the line reads `import { ..., Boxes, CreditCard, ... } from 'lucide-react'`, remove only `Boxes,`.

> Use Grep to confirm the exact lucide-react import line first: `Grep pattern "Boxes" path "frontend/src/components/Layout.tsx"`. Remove `Boxes` from that single import statement. Do NOT touch the `end?` interface field or the three `end={...}` render sites (they stay harmless per extraction). Owner `items.length` goes 11 → 10; `bottomItems = items.slice(0,4)` (Beranda/Kasir/Meja/Riwayat) unaffected; `moreItems = items.slice(4)` now has 6 entries (was 7).

**Verification:**
- [ ] Run `cd frontend && npx tsc -b` → 0 errors (no unused `Boxes` import; `noUnusedLocals` would otherwise fail).
- [ ] Run `cd frontend && npm run lint` → 0 errors.

**Commit:**
- [ ] `git add frontend/src/components/Layout.tsx && git commit -m "feat(nav): hapus item nav SKU Varian (jadi tab di Menu) + drop Boxes import

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

- [ ] **Step 11: Delete `SkuVarianPage.tsx` + verify no remaining importers**

All logic now lives in `VarianSkuTab.tsx`; the redirect (Task 8) replaces the route. Remove the now-dead page file.

**Files:**
- Delete: `frontend/src/pages/SkuVarianPage.tsx`

Run:

```bash
cd frontend && git rm src/pages/SkuVarianPage.tsx
```

> Before committing, confirm nothing still imports it (other than the barrel + App, both already cleaned in Tasks 8-9). Use Grep: `Grep pattern "SkuVarianPage" path "frontend/src"` → expect **No matches found**. If any match remains, fix that reference before proceeding.

**Verification:**
- [ ] `Grep pattern "SkuVarianPage" path "frontend/src"` → No matches found.
- [ ] Run `cd frontend && npm run build` → succeeds (tsc -b + vite build, 0 errors). This is the Phase-2 gate: the full Katalog Menu unification compiles and bundles.
- [ ] Run `cd frontend && npm run lint` → 0 errors.

**Commit:**
- [ ] `git add -A && git commit -m "chore(menu): hapus SkuVarianPage (logika pindah ke VarianSkuTab)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`

---

> **Phase 2 done-criteria:** `/menu` renders Katalog Menu host with two tabs; Menu Jual expands variant/paket parents to show child SKU rows (name/stock/cost + Stok→/Edit); Varian SKU lists hidden SKUs with clickable Induk links and warning "tanpa induk" badges; `/menu?tab=varian`, `/menu?tab=jual&focusMenuId=`, and `/menu/sku-varian` (redirect) all resolve; nav shows a single "Menu" item. End-to-end behavior (focus highlight, cross-tab navigation, mobile accordion) is verified by Author D's Playwright task (Task 19-21).


---

## Phase 3 - Stock connection + consistency

> Tasks 12–15. Adopt the shared `PageHeader` + `FilterToolbar` primitives (built by Author A in Tasks 1–2) on the Stock page, then wire two-way deep-links (`?focusMenuId`, `?action=opname`) and the owner-only "Menu →" cross-link. The auth store import path is `@/stores/authStore`, and existing call sites (`CartPanel.tsx:104`, `POSPage.tsx`) destructure it as `const { user } = useAuthStore()`; `user: User | null` and `User.role` is `'owner' | 'cashier' | 'waiter'`. `react-router-dom` is v7.10.1, so `useSearchParams` / `useNavigate` are available; neither is currently imported anywhere in the Stock area (confirmed in extraction). `ArrowUpRight` from `lucide-react` is the "Menu →" icon.

- [ ] **Step 12: Replace StockPage bespoke `<header>` with shared `PageHeader`**

  **Files:**
  - Modify: `frontend/src/pages/StockPage.tsx`

  The current full file (verbatim from extraction, `StockPage.tsx:1-19`):
  ```tsx
  // REV 2.11 StockPage - Stok Porsi saja (raw-materials subsystem dihapus).
  // Akses semua role (per matrix REV 2.3: view + opname + mark-habis terbuka).
  // Aksi: restock pagi (kelipatan 5), barang masuk darurat, opname batch, mark habis quick.

  import PortionStockTab from '@/components/stock/PortionStockTab'

  export default function StockPage() {
    return (
      <div className="h-full flex flex-col">
        <header className="bg-white border-b border-neutral-200 px-3 sm:px-4 py-2.5 flex items-center gap-3 flex-wrap pt-safe md:pt-2.5">
          <h1 className="text-title font-semibold text-neutral-900">Stok</h1>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <PortionStockTab />
        </div>
      </div>
    )
  }
  ```

  Replace the WHOLE file with (StockPage has no `lowCount` data - the list lives inside `PortionStockTab` - so `PageHeader` is rendered with no `subtitle` and no `tabs`; the page shell archetype `h-full flex flex-col` + `flex-1 min-h-0 overflow-y-auto` body is preserved exactly per the documented usage pattern):
  ```tsx
  // REV 2.11 StockPage - Stok Porsi saja (raw-materials subsystem dihapus).
  // Akses semua role (per matrix REV 2.3: view + opname + mark-habis terbuka).
  // Aksi: restock pagi (kelipatan 5), barang masuk darurat, opname batch, mark habis quick.

  import { PageHeader } from '@/design-system/primitives'
  import PortionStockTab from '@/components/stock/PortionStockTab'

  export default function StockPage() {
    return (
      <div className="h-full flex flex-col">
        <PageHeader title="Stok" />

        <div className="flex-1 min-h-0 overflow-y-auto">
          <PortionStockTab />
        </div>
      </div>
    )
  }
  ```

  Note: `PageHeader` is exported from the barrel `@/design-system/primitives` by Author A (Task 1). The rendered markup of `<PageHeader title="Stok" />` is byte-identical to the old bespoke header for the no-subtitle/no-tabs/no-actions case (same `<header>` classes, same `text-title` h1), so this is a pure consistency swap with no visual change.

- [ ] **Step 12-verify: tsc + build**

  ```
  cd frontend && npx tsc -b
  ```
  Expected: exit 0, no errors. Then:
  ```
  cd frontend && npm run build
  ```
  Expected: `vite build` SUCCESS, 0 errors.

- [ ] **Step 12-commit:**
  ```
  git add frontend/src/pages/StockPage.tsx
  git commit -m "refactor(stock): StockPage pakai PageHeader primitive bersama

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

- [ ] **Step 13: Refactor `StockFilterToolbar` to render shared `FilterToolbar` + strip dead RawMaterialsTab refs**

  **Files:**
  - Modify: `frontend/src/components/stock/StockFilterToolbar.tsx` (full rewrite)

  Goal: `StockFilterToolbar` keeps its existing public contract (the `ToolbarControls` interface + the props PortionStockTab already passes: `controls`, `children`, `rightBadge`, `extraFilters`, `searchPlaceholder`) but internally delegates layout to the shared `FilterToolbar` primitive. The dead `ownerSlot` prop (never passed by any caller - extraction §C3) is REMOVED, and the RawMaterialsTab / "Tambah Bahan" / `~25/~13` dead comments are stripped.

  The current file builds three Comboboxes (category / status / opname) into a `filterFields` block, an always-visible search Input, a mobile-only sort Combobox, and a desktop-inline vs mobile-Sheet fork (extraction §C). We map those to `FilterToolbar` slots exactly:
  - `search={{ value: c.search, onChange: c.setSearch, placeholder: searchPlaceholder }}`
  - `filters={filterFields}` (the 3 Comboboxes)
  - `chipFilters={extraFilters}` (the `MenuTypeFilter` passed by PortionStockTab)
  - `sortControl={<the mobile sort Combobox>}`
  - `actions={children}` (Restock Pagi / Opname buttons)
  - `rightBadge={rightBadge}`
  - `onReset={c.resetFilters}`
  - `activeFilterCount={c.activeFilterCount}`

  `FilterToolbar` (Author A, Task 2) already owns the desktop-inline / mobile-`Sheet` fork, the search Input, the mobile sort + Filter-button placement, and the Reset/Terapkan footer - so this file shrinks to: type defs, the `ToolbarControls` interface, building `filterFields` + the sort Combobox, and one `<FilterToolbar>` call.

  Replace the WHOLE file with:
  ```tsx
  // REV 2.8: toolbar filter+sort untuk halaman Stok (PortionStockTab).
  // Delegasi layout ke FilterToolbar primitive bersama: desktop inline, mobile
  // sekunder masuk Sheet. Search selalu terlihat. Sort desktop via header kolom
  // (SortableHeader); mobile via Combobox di sini (card mobile tak punya header).
  import type { ReactNode } from 'react'
  import { Combobox } from '@/design-system/primitives'
  import { FilterToolbar } from '@/design-system/primitives'
  import type {
    StockSortKey,
    StockSortDir,
    StockStatusFilter,
    OpnameStatusFilter,
  } from './useStockListControls'

  const SORT_OPTIONS = [
    { value: 'category', label: 'Kategori' },
    { value: 'name', label: 'Nama (A–Z)' },
    { value: 'qty', label: 'Stok (sedikit dulu)' },
    { value: 'lastStocked', label: 'Terakhir di-stok' },
  ]

  const STATUS_OPTIONS = [
    { value: 'all', label: 'Semua status' },
    { value: 'habis', label: 'Habis' },
    { value: 'rendah', label: 'Rendah' },
    { value: 'aman', label: 'Aman' },
  ]

  const OPNAME_OPTIONS = [
    { value: 'all', label: 'Semua opname' },
    { value: 'sudah', label: 'Sudah dicek' },
    { value: 'belum', label: 'Belum dicek' },
  ]

  interface ToolbarControls {
    search: string
    setSearch: (v: string) => void
    category: string
    setCategory: (v: string) => void
    categoryOptions: { value: string; label: string }[]
    statusFilter: StockStatusFilter
    setStatusFilter: (v: StockStatusFilter) => void
    opnameStatus: OpnameStatusFilter
    setOpnameStatus: (v: OpnameStatusFilter) => void
    sortKey: StockSortKey
    setSort: (k: StockSortKey) => void
    sortDir: StockSortDir
    resetFilters: () => void
    activeFilterCount: number
  }

  interface StockFilterToolbarProps {
    controls: ToolbarControls
    /** Tombol aksi spesifik tab (Restock Pagi / Opname). */
    children?: ReactNode
    /** Badge hitung kanan (lowCount). */
    rightBadge?: ReactNode
    /** Slot filter tambahan spesifik tab (mis. filter Tipe menu di tab Porsi). */
    extraFilters?: ReactNode
    searchPlaceholder?: string
  }

  export function StockFilterToolbar({
    controls: c,
    children,
    rightBadge,
    extraFilters,
    searchPlaceholder,
  }: StockFilterToolbarProps) {
    const categoryOptions = [{ value: 'all', label: 'Semua kategori' }, ...c.categoryOptions]

    const filterFields = (
      <>
        <Combobox
          hideLabel
          label="Filter kategori"
          value={c.category}
          onValueChange={c.setCategory}
          options={categoryOptions}
          searchPlaceholder="Cari kategori..."
          containerClassName="min-w-[12rem]"
        />
        <Combobox
          hideLabel
          label="Filter status stok"
          value={c.statusFilter}
          onValueChange={(v) => c.setStatusFilter(v as StockStatusFilter)}
          options={STATUS_OPTIONS}
          containerClassName="min-w-[10rem]"
        />
        <Combobox
          hideLabel
          label="Filter status opname"
          value={c.opnameStatus}
          onValueChange={(v) => c.setOpnameStatus(v as OpnameStatusFilter)}
          options={OPNAME_OPTIONS}
          containerClassName="min-w-[10rem]"
        />
      </>
    )

    const sortControl = (
      <Combobox
        hideLabel
        label="Urutkan"
        value={c.sortKey}
        onValueChange={(v) => c.setSort(v as StockSortKey)}
        options={SORT_OPTIONS}
        containerClassName="w-[12rem] shrink-0"
      />
    )

    return (
      <FilterToolbar
        search={{ value: c.search, onChange: c.setSearch, placeholder: searchPlaceholder }}
        filters={filterFields}
        chipFilters={extraFilters}
        sortControl={sortControl}
        actions={children}
        rightBadge={rightBadge}
        onReset={c.resetFilters}
        activeFilterCount={c.activeFilterCount}
      />
    )
  }
  ```

  Notes:
  - `FilterToolbar` is imported from the barrel `@/design-system/primitives` (Author A, Task 2 adds the export).
  - The `Combobox` option arrays (`SORT_OPTIONS`, `STATUS_OPTIONS`, `OPNAME_OPTIONS`) reproduce the labels the original `filterFields` rendered for the same `StockStatusFilter` / `OpnameStatusFilter` / `StockSortKey` unions (defined in `useStockListControls.ts`). The `value` strings are the exact union members, so `onValueChange` casts are sound.
  - `ToolbarControls` interface is KEPT (callers still type their `controls`). The dead `ownerSlot` prop is REMOVED from `StockFilterToolbarProps`. PortionStockTab never passes `ownerSlot` (extraction §B4), so this is non-breaking.
  - PortionStockTab's existing `<StockFilterToolbar controls=... searchPlaceholder=... extraFilters=... rightBadge=...>{buttons}</StockFilterToolbar>` call (extraction §B4) compiles unchanged - same prop names, minus the never-used `ownerSlot`.

- [ ] **Step 13-verify: tsc + lint**
  ```
  cd frontend && npx tsc -b
  ```
  Expected: exit 0. Then:
  ```
  cd frontend && npm run lint
  ```
  Expected: 0 errors (the dead `ownerSlot` and its unused-var risk are gone).

- [ ] **Step 13-commit:**
  ```
  git add frontend/src/components/stock/StockFilterToolbar.tsx
  git commit -m "refactor(stock): StockFilterToolbar delegasi ke FilterToolbar primitive + hapus ownerSlot mati

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

- [ ] **Step 14: PortionStockTab - `?action=opname` auto-open + `?focusMenuId` highlight/scroll**

  **Files:**
  - Modify: `frontend/src/components/stock/PortionStockTab.tsx`

  **14a - add router imports.** The current import block (verbatim, `PortionStockTab.tsx:8-31`) starts with `import { useState, useMemo } from 'react'`. Change that single line and add a `react-router-dom` import right after it:

  Before (line 8):
  ```tsx
  import { useState, useMemo } from 'react'
  ```
  After:
  ```tsx
  import { useState, useMemo, useEffect } from 'react'
  import { useSearchParams } from 'react-router-dom'
  ```

  **14b - read params + add highlight state.** The current parent state block (verbatim, `PortionStockTab.tsx:34-42`):
  ```tsx
  const qc = useQueryClient()
    const toast = useToast()
    const confirm = useConfirm()
    const [showRestockMorning, setShowRestockMorning] = useState(false)
    const [showOpname, setShowOpname] = useState(false)
    const [emergencyTarget, setEmergencyTarget] = useState<PortionStockView | null>(null)
    const [historyMenuId, setHistoryMenuId] = useState<number | null>(null)
    // REV 2.8.1: filter tipe stok (multi-select). Default tampilkan yang tracked (portion).
    const [types, setTypes] = useState<Set<StockType>>(() => new Set<StockType>(['portion']))
  ```
  Replace it with (adds `searchParams`/`setSearchParams` + a `focusMenuId` highlight state derived from the URL):
  ```tsx
  const qc = useQueryClient()
    const toast = useToast()
    const confirm = useConfirm()
    const [searchParams, setSearchParams] = useSearchParams()
    const [showRestockMorning, setShowRestockMorning] = useState(false)
    const [showOpname, setShowOpname] = useState(false)
    const [emergencyTarget, setEmergencyTarget] = useState<PortionStockView | null>(null)
    const [historyMenuId, setHistoryMenuId] = useState<number | null>(null)
    // REV 2.11 deep-link: ?focusMenuId=<id> → sorot + scroll baris stok.
    const [focusMenuId, setFocusMenuId] = useState<number | null>(() => {
      const raw = searchParams.get('focusMenuId')
      return raw ? Number(raw) : null
    })
    // REV 2.8.1: filter tipe stok (multi-select). Default tampilkan yang tracked (portion).
    const [types, setTypes] = useState<Set<StockType>>(() => new Set<StockType>(['portion']))
  ```

  **14c - effects: open Opname from `?action=opname` (once) + scroll/clear focus.** Insert this block immediately AFTER the `useStockListControls` `controls` call (extraction §B2, `PortionStockTab.tsx:93-108`, which ends with the closing `})` of `useStockListControls<PortionStockView>({ ... })`). Add:
  ```tsx
    // REV 2.11 deep-link: ?action=opname → buka modal Opname sekali, lalu strip param.
    useEffect(() => {
      if (searchParams.get('action') === 'opname') {
        setShowOpname(true)
        setSearchParams(
          (prev) => {
            const n = new URLSearchParams(prev)
            n.delete('action')
            return n
          },
          { replace: true }
        )
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // REV 2.11 deep-link: ?focusMenuId → scroll + sorot ~2s lalu hapus highlight + param.
    useEffect(() => {
      if (focusMenuId == null) return
      document.getElementById('stock-row-' + focusMenuId)?.scrollIntoView({ block: 'center' })
      const t = setTimeout(() => {
        setFocusMenuId(null)
        setSearchParams(
          (prev) => {
            const n = new URLSearchParams(prev)
            n.delete('focusMenuId')
            return n
          },
          { replace: true }
        )
      }, 2000)
      return () => clearTimeout(t)
    }, [focusMenuId, setSearchParams])
  ```
  Note: the `?action=opname` effect runs once on mount (empty dep array + eslint-disable, matching the locked shared-contract spec for Author C). The `?focusMenuId` effect fires `scrollIntoView` against the DataTable row whose `id` is `stock-row-<menuId>` (added in 14d), then clears both the highlight ring state and the URL param after ~2s.

  **14d - wire `rowId` + `rowClassName` on the `<DataTable>`.** The current DataTable element opening (verbatim, `PortionStockTab.tsx:302-311`):
  ```tsx
  <DataTable
            columns={columns}
            data={controls.view}
            rowKey={(s) => s.menuId}
            emptyTitle="Tidak ada item"
            emptyDescription={
              controls.activeFilterCount > 0
                ? 'Tidak ada item cocok dengan filter.'
                : 'Stok porsi belum ada.'
            }
  ```
  Replace those opening props with (adds `rowId` for `scrollIntoView` targeting + `rowClassName` for the temporary ring; both are the locked shared-contract DataTable props Author A adds in Task 3):
  ```tsx
  <DataTable
            columns={columns}
            data={controls.view}
            rowKey={(s) => s.menuId}
            rowId={(s) => 'stock-row-' + s.menuId}
            rowClassName={(s) =>
              s.menuId === focusMenuId ? 'ring-2 ring-primary-400 ring-inset' : undefined
            }
            emptyTitle="Tidak ada item"
            emptyDescription={
              controls.activeFilterCount > 0
                ? 'Tidak ada item cocok dengan filter.'
                : 'Stok porsi belum ada.'
            }
  ```
  Leave the rest of the `<DataTable>` (columns, `mobileCard`, closing) unchanged - Steps 15 edits the columns/mobileCard separately.

- [ ] **Step 14-verify: tsc + build**
  ```
  cd frontend && npx tsc -b
  ```
  Expected: exit 0. Then:
  ```
  cd frontend && npm run build
  ```
  Expected: `vite build` SUCCESS. (`rowId`/`rowClassName` resolve against the DataTable additions from Author A Task 3; if tsc errors with "no overload matches", that means Task 3 has not been merged yet - Task 14 depends on it.)

- [ ] **Step 14-commit:**
  ```
  git add frontend/src/components/stock/PortionStockTab.tsx
  git commit -m "feat(stock): PortionStockTab deep-link ?action=opname + ?focusMenuId sorot baris

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

- [ ] **Step 15: PortionStockTab - owner-only "Menu →" row action (all rows, outside the portion gate)**

  **Files:**
  - Modify: `frontend/src/components/stock/PortionStockTab.tsx`

  The "Menu →" link must render for EVERY row (each stock row maps to a menu), not only `stockType==='portion'` rows. The existing desktop `actions` cell and the mobile card both early-return / gate stock-mutating buttons behind `stockType !== 'portion'`; we restructure so "Menu →" sits OUTSIDE that gate while the existing stock buttons stay gated. Shown only when `isOwner` (Menu is owner-only - extraction confirms `/menu` is `RoleRoute allow={['owner']}`).

  **15a - imports.** Add `useNavigate` to the `react-router-dom` import added in Step 14a, add `ArrowUpRight` to the existing `lucide-react` import (verbatim current: `import { Plus, ClipboardCheck, XCircle, Truck, History } from 'lucide-react'`, `PortionStockTab.tsx:10`), and add the auth store import.

  Change the `react-router-dom` line (from Step 14a) - Before:
  ```tsx
  import { useSearchParams } from 'react-router-dom'
  ```
  After:
  ```tsx
  import { useNavigate, useSearchParams } from 'react-router-dom'
  ```

  Change the lucide line - Before:
  ```tsx
  import { Plus, ClipboardCheck, XCircle, Truck, History } from 'lucide-react'
  ```
  After:
  ```tsx
  import { Plus, ClipboardCheck, XCircle, Truck, History, ArrowUpRight } from 'lucide-react'
  ```

  Add the auth store import after the existing primitives/hook imports (the import block ends at `PortionStockTab.tsx:31` with `import { StockHistorySheet, type HistoryMovement } from './StockHistorySheet'`). After that line add:
  ```tsx
  import { useAuthStore } from '@/stores/authStore'
  ```
  (Import path confirmed via grep: every consumer uses `@/stores/authStore`; selector style is destructuring `const { user } = useAuthStore()`.)

  **15b - `navigate` + `isOwner` in the component body.** Right after the `searchParams`/`setSearchParams` line added in Step 14b, add:
  ```tsx
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const isOwner = user?.role === 'owner'
  ```

  **15c - desktop `actions` cell.** The current cell (verbatim, `PortionStockTab.tsx:228-263`):
  ```tsx
  {
        key: 'actions',
        header: '',
        align: 'right',
        // Aksi stok hanya untuk menu tracked (portion). Non-portion tak punya stok/movement.
        cell: (s) =>
          s.stockType !== 'portion' ? null : (
            <div className="inline-flex items-center gap-1">
              <IconButton
                label={`Barang masuk ${s.menuName}`}
                icon={<Truck />}
                variant="ghost"
                size="sm"
                onClick={() => setEmergencyTarget(s)}
                className="text-success-700 hover:bg-success-50"
              />
              <IconButton
                label={`Riwayat ${s.menuName}`}
                icon={<History />}
                variant="ghost"
                size="sm"
                onClick={() => setHistoryMenuId(s.menuId)}
                className="text-neutral-600 hover:bg-neutral-100"
              />
              <IconButton
                label={`Tandai ${s.menuName} habis`}
                icon={<XCircle />}
                variant="ghost"
                size="sm"
                onClick={() => handleMarkHabis(s)}
                disabled={markHabisMutation.isPending}
                className="text-warning-700 hover:bg-warning-50"
              />
            </div>
          ),
      },
  ```
  Replace it with (always render the action container; stock-mutating buttons stay behind the `stockType==='portion'` gate; the owner-only "Menu →" `IconButton` renders for ALL rows):
  ```tsx
  {
        key: 'actions',
        header: '',
        align: 'right',
        cell: (s) => (
          <div className="inline-flex items-center gap-1">
            {/* Aksi stok hanya untuk menu tracked (portion). Non-portion tak punya stok/movement. */}
            {s.stockType === 'portion' && (
              <>
                <IconButton
                  label={`Barang masuk ${s.menuName}`}
                  icon={<Truck />}
                  variant="ghost"
                  size="sm"
                  onClick={() => setEmergencyTarget(s)}
                  className="text-success-700 hover:bg-success-50"
                />
                <IconButton
                  label={`Riwayat ${s.menuName}`}
                  icon={<History />}
                  variant="ghost"
                  size="sm"
                  onClick={() => setHistoryMenuId(s.menuId)}
                  className="text-neutral-600 hover:bg-neutral-100"
                />
                <IconButton
                  label={`Tandai ${s.menuName} habis`}
                  icon={<XCircle />}
                  variant="ghost"
                  size="sm"
                  onClick={() => handleMarkHabis(s)}
                  disabled={markHabisMutation.isPending}
                  className="text-warning-700 hover:bg-warning-50"
                />
              </>
            )}
            {/* REV 2.11: lompat ke Katalog Menu (owner-only; Menu owner-only route). */}
            {isOwner && (
              <IconButton
                label={`Buka ${s.menuName} di Menu`}
                icon={<ArrowUpRight />}
                variant="ghost"
                size="sm"
                onClick={() => navigate('/menu?focusMenuId=' + s.menuId)}
                className="text-primary-700 hover:bg-primary-50"
              />
            )}
          </div>
        ),
      },
  ```

  **15d - mobile card.** The current mobile action row sits inside the `tracked` block (extraction §B3, `PortionStockTab.tsx:356-390`); it only renders when `tracked` (`stockType==='portion'`). We must surface "Menu →" even for non-portion rows on mobile, so add an owner-only action row OUTSIDE the `tracked` conditional. The current mobile card tail (verbatim, the `{tracked && ( ... )}` action block at `PortionStockTab.tsx:356-390`, ending the card) is:
  ```tsx
  {tracked && (
                    <div className="flex items-center justify-between pt-1.5 border-t border-neutral-100">
                      {s.suggestedRestockMorning > 0 ? (
                        <Badge tone="warning" size="sm">Saran +{s.suggestedRestockMorning}</Badge>
                      ) : (
                        <Badge tone="success" size="sm">Aman</Badge>
                      )}
                      <div className="inline-flex items-center gap-1">
                        <IconButton
                          label={`Riwayat ${s.menuName}`}
                          icon={<History />}
                          variant="ghost"
                          size="sm"
                          onClick={() => setHistoryMenuId(s.menuId)}
                          className="text-neutral-600"
                        />
                        <IconButton
                          label={`Barang masuk ${s.menuName}`}
                          icon={<Truck />}
                          variant="ghost"
                          size="sm"
                          onClick={() => setEmergencyTarget(s)}
                          className="text-success-700"
                        />
                        <IconButton
                          label={`Tandai ${s.menuName} habis`}
                          icon={<XCircle />}
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkHabis(s)}
                          className="text-warning-700"
                        />
                      </div>
                    </div>
                  )}
  ```
  Replace that whole `{tracked && ( ... )}` block with (insert the owner-only "Menu →" `IconButton` into the SAME action-row container so it shows for tracked rows, AND add a separate owner-only row for non-tracked rows so "Menu →" is still reachable there):
  ```tsx
  {tracked && (
                    <div className="flex items-center justify-between pt-1.5 border-t border-neutral-100">
                      {s.suggestedRestockMorning > 0 ? (
                        <Badge tone="warning" size="sm">Saran +{s.suggestedRestockMorning}</Badge>
                      ) : (
                        <Badge tone="success" size="sm">Aman</Badge>
                      )}
                      <div className="inline-flex items-center gap-1">
                        <IconButton
                          label={`Riwayat ${s.menuName}`}
                          icon={<History />}
                          variant="ghost"
                          size="sm"
                          onClick={() => setHistoryMenuId(s.menuId)}
                          className="text-neutral-600"
                        />
                        <IconButton
                          label={`Barang masuk ${s.menuName}`}
                          icon={<Truck />}
                          variant="ghost"
                          size="sm"
                          onClick={() => setEmergencyTarget(s)}
                          className="text-success-700"
                        />
                        <IconButton
                          label={`Tandai ${s.menuName} habis`}
                          icon={<XCircle />}
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkHabis(s)}
                          className="text-warning-700"
                        />
                        {isOwner && (
                          <IconButton
                            label={`Buka ${s.menuName} di Menu`}
                            icon={<ArrowUpRight />}
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate('/menu?focusMenuId=' + s.menuId)}
                            className="text-primary-700"
                          />
                        )}
                      </div>
                    </div>
                  )}
                  {!tracked && isOwner && (
                    <div className="flex items-center justify-end pt-1.5 border-t border-neutral-100">
                      <IconButton
                        label={`Buka ${s.menuName} di Menu`}
                        icon={<ArrowUpRight />}
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/menu?focusMenuId=' + s.menuId)}
                        className="text-primary-700"
                      />
                    </div>
                  )}
  ```

- [ ] **Step 15-verify: tsc + build**
  ```
  cd frontend && npx tsc -b
  ```
  Expected: exit 0. Then:
  ```
  cd frontend && npm run build
  ```
  Expected: `vite build` SUCCESS.

- [ ] **Step 15-commit:**
  ```
  git add frontend/src/components/stock/PortionStockTab.tsx
  git commit -m "feat(stock): aksi baris 'Menu →' owner-only (semua baris) lompat ke Katalog Menu

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

## Phase 4 - Cleanups

> Tasks 16–18. Fix the Opname blank-vs-0 footgun, strip remaining dead REV 2.11 raw-materials/purchases references in the stock helpers, and repoint the WaiterDashboard quick-action links so they land on Author C's now-honored `?action=opname` (Task 14) and a plain `/stock`.

- [ ] **Step 16: PortionStockTab OpnameModal - fix blank-vs-0 footgun**

  **Files:**
  - Modify: `frontend/src/components/stock/PortionStockTab.tsx`

  Problem (extraction §B5): `OpnameModal` state is `Record<number, number>` (`PortionStockTab.tsx:557`). When the user clears the input, `Number('') === 0`, so a blank field becomes a deliberate `qtyFisik: 0` opname → spurious selisih + audit log. Fix: store `number | ''` so blank is distinguishable from a real 0, and filter blanks out on submit (mirroring `EmergencyInModal`'s string pattern, extraction §B6).

  **16a - state declaration.** The current declaration (verbatim, `PortionStockTab.tsx:557`):
  ```tsx
  const [qtyFisikByMenu, setQtyFisikByMenu] = useState<Record<number, number>>({})
  ```
  Replace with:
  ```tsx
  const [qtyFisikByMenu, setQtyFisikByMenu] = useState<Record<number, number | ''>>({})
  ```

  **16b - onChange handler.** The current `onChange` (verbatim, `PortionStockTab.tsx:615-617`, inside the Opname `<Input>`):
  ```tsx
  onChange={(e) =>
                  setQtyFisikByMenu((prev) => ({ ...prev, [s.menuId]: Number(e.target.value) }))
                }
  ```
  Replace with (store `''` when the field is empty, else the numeric value):
  ```tsx
  onChange={(e) =>
                  setQtyFisikByMenu((prev) => ({
                    ...prev,
                    [s.menuId]: e.target.value === '' ? '' : Number(e.target.value),
                  }))
                }
  ```
  Note: the `value={qtyFisikByMenu[s.menuId] ?? ''}` on the same `<Input>` (`PortionStockTab.tsx:614`) already coalesces `undefined`/`''` to a blank display, and now correctly round-trips a stored `''` - no change needed there.

  **16c - submit filter.** The current `handleSubmit` (verbatim, `PortionStockTab.tsx:568-577`):
  ```tsx
  const handleSubmit = () => {
      const items = Object.entries(qtyFisikByMenu)
        .filter(([, qty]) => qty !== undefined && qty >= 0)
        .map(([menuId, qty]) => ({ menuId: Number(menuId), qtyFisik: qty as number }))
      if (items.length === 0) {
        toast.error('Isi minimal 1 item qty fisik')
        return
      }
      opname.mutate({ items, note: 'Opname' })
    }
  ```
  Replace with (exclude blank `''` entries; a deliberate `0` still passes; `qtyFisik` is now safely `number`):
  ```tsx
  const handleSubmit = () => {
      const items = Object.entries(qtyFisikByMenu)
        .filter(([, qty]) => qty !== '' && qty !== undefined && Number(qty) >= 0)
        .map(([menuId, qty]) => ({ menuId: Number(menuId), qtyFisik: Number(qty) }))
      if (items.length === 0) {
        toast.error('Isi minimal 1 item qty fisik')
        return
      }
      opname.mutate({ items, note: 'Opname' })
    }
  ```
  Now a cleared field (`''`) is skipped entirely (not sent as a 0-opname), while an explicitly typed `0` (real "habis" count) is kept. This matches `OpnameItem` from `portionService.ts` (`{ menuId: number; qtyFisik: number }`).

- [ ] **Step 16-verify: tsc + build**
  ```
  cd frontend && npx tsc -b
  ```
  Expected: exit 0 (the `as number` cast is gone; `Number(qty)` narrows `number | ''` safely after the `qty !== ''` guard). Then:
  ```
  cd frontend && npm run build
  ```
  Expected: `vite build` SUCCESS.

- [ ] **Step 16-commit:**
  ```
  git add frontend/src/components/stock/PortionStockTab.tsx
  git commit -m "fix(stock): OpnameModal bedakan kosong vs 0 (cegah opname 0 palsu dari field di-clear)

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

- [ ] **Step 17: Strip dead REV 2.11 raw-materials/purchases refs in `useStockListControls` + `StockHistorySheet`**

  **Files:**
  - Modify: `frontend/src/components/stock/useStockListControls.ts`
  - Modify: `frontend/src/components/stock/StockHistorySheet.tsx`

  **17a - `useStockListControls.ts` header comment.** Current (verbatim, `useStockListControls.ts:1-3`):
  ```ts
  // REV 2.8: hook kontrol daftar stok (search + kategori + status stok + status
  // opname hari ini + sort). Generic via accessor agar dipakai PortionStockTab &
  // RawMaterialsTab. Semua client-side (dataset kecil ~25/~13 item).
  ```
  Replace with:
  ```ts
  // REV 2.8: hook kontrol daftar stok (search + kategori + status stok + status
  // opname hari ini + sort). Generic via accessor (dipakai PortionStockTab).
  // Semua client-side (dataset kecil ~25 item porsi).
  ```

  **17b - remove the never-used `categoryOptions?` override param + its branch + eslint-disable.** The config interface field (verbatim, `useStockListControls.ts:24-25`):
  ```ts
  /** Override daftar kategori (mis. enum tetap raw material). Default: derive dari rows. */
    categoryOptions?: { value: string; label: string }[]
  ```
  Delete those two lines entirely (the field + its JSDoc). The closing `}` of `StockListControlsConfig<T>` stays.

  Then the override branch (verbatim, `useStockListControls.ts:62-66`, the `config.categoryOptions` branch + its eslint-disable). The original derives `categoryOptions` from rows but allows an override; per extraction the override is dead. The current branch is:
  ```ts
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const categoryOptions = config.categoryOptions ?? deriveCategoryOptions()
  ```
  Replace with (no override; derive directly; drop the eslint-disable since the disabled rule no longer applies to this line):
  ```ts
    const categoryOptions = deriveCategoryOptions()
  ```
  Note: `deriveCategoryOptions` is the existing local that builds `{ value, label }[]` from `rows` via `getCategoryValue`/`getCategoryLabel`. If the original wrapped derivation in a `useMemo` rather than a `deriveCategoryOptions()` call, keep the original derivation expression verbatim and only delete the `config.categoryOptions ??` prefix + the `// eslint-disable-next-line` comment line directly above it. The goal is: `categoryOptions` is computed purely from `rows`, with no `config.categoryOptions` reference and no orphaned eslint-disable.

  **17c - `StockHistorySheet.tsx` dead refs (3 doc lines).** Current header comment (verbatim, `StockHistorySheet.tsx:4`, part of the top file comment):
  ```tsx
  // generic untuk porsi & raw material
  ```
  Replace with:
  ```tsx
  // generic untuk porsi
  ```

  Current `sourceLabel` JSDoc (verbatim, `StockHistorySheet.tsx:21`):
  ```tsx
  /** "Transaksi #5" / "Pembelian #3" bila ada FK sumber; null kalau tidak. */
  ```
  Replace with:
  ```tsx
  /** "Transaksi #5" bila ada FK sumber; null kalau tidak. */
  ```

  Current `unitSuffix` JSDoc (verbatim, `StockHistorySheet.tsx:32`):
  ```tsx
  /** Satuan untuk tampilan qty (raw: unit.label; porsi: "porsi"). */
  ```
  Replace with:
  ```tsx
  /** Satuan untuk tampilan qty (porsi: "porsi"; modal: "Rp"). */
  ```
  (Both producers pass either `"porsi"` (PortionStockTab) or `"Rp"` (CostHistoryDrawer, extraction), so the doc now reflects the only two real callers.)

- [ ] **Step 17-verify: tsc + lint**
  ```
  cd frontend && npx tsc -b
  ```
  Expected: exit 0. Then:
  ```
  cd frontend && npm run lint
  ```
  Expected: 0 errors (removing the eslint-disable does not surface a new warning because the line is no longer hook-dependency-sensitive).

- [ ] **Step 17-commit:**
  ```
  git add frontend/src/components/stock/useStockListControls.ts frontend/src/components/stock/StockHistorySheet.tsx
  git commit -m "chore(stock): hapus ref mati raw-materials/purchases di useStockListControls + StockHistorySheet

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

- [ ] **Step 18: WaiterDashboard - repoint dead quick-action links**

  **Files:**
  - Modify: `frontend/src/pages/WaiterDashboard.tsx`

  The two quick-action links currently target `/stock?action=opname-portion` and `/stock?action=mark-habis`, both ignored today. Author C's Task 14 makes PortionStockTab honor `?action=opname` (NOT `opname-portion`), and there is no global mark-habis modal (mark-habis is a per-row confirm). So: repoint the first to `/stock?action=opname` and the second to plain `/stock` (the waiter lands on the stock list and taps a row to mark habis). The "Aksi Cepat" block stays.

  Current block (verbatim, `WaiterDashboard.tsx:54-69`):
  ```tsx
  {/* Quick actions */}
              <div className="bg-white rounded-xl p-4 sm:p-5 border border-neutral-200/60">
                <h3 className="text-title font-semibold text-neutral-900 mb-3">Aksi Cepat</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <QuickAction
                    to="/stock?action=opname-portion"
                    icon={ClipboardCheck}
                    label="Opname Stok Porsi"
                  />
                  <QuickAction
                    to="/stock?action=mark-habis"
                    icon={XCircle}
                    label="Mark Item Habis"
                  />
                </div>
              </div>
  ```
  Replace with (first link → `?action=opname`; second → plain `/stock` with a clarifying label; `XCircle`/`ClipboardCheck` imports + `QuickAction` component remain in use, so no import changes):
  ```tsx
  {/* Quick actions */}
              <div className="bg-white rounded-xl p-4 sm:p-5 border border-neutral-200/60">
                <h3 className="text-title font-semibold text-neutral-900 mb-3">Aksi Cepat</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <QuickAction
                    to="/stock?action=opname"
                    icon={ClipboardCheck}
                    label="Opname Stok Porsi"
                  />
                  <QuickAction
                    to="/stock"
                    icon={XCircle}
                    label="Tandai Item Habis"
                  />
                </div>
              </div>
  ```
  Note: `/stock?action=opname` is consumed by PortionStockTab Step 14c (auto-opens the Opname modal then strips the param). The mark-habis quick-action now lands on the stock list (`/stock`); per the spec (§9) mark-habis is a per-row confirmation, so the waiter taps the target row's "Tandai habis" action there.

- [ ] **Step 18-verify: tsc + build**
  ```
  cd frontend && npx tsc -b
  ```
  Expected: exit 0. Then:
  ```
  cd frontend && npm run build
  ```
  Expected: `vite build` SUCCESS.

- [ ] **Step 18-commit:**
  ```
  git add frontend/src/pages/WaiterDashboard.tsx
  git commit -m "fix(dashboard): WaiterDashboard aksi cepat ke /stock?action=opname + /stock (link mati diperbaiki)

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```


---

## Phase 5 - Documentation sync + verification

This phase runs LAST, after Phases 1–4 (Tasks 1–18) are merged into the branch. It synchronizes the now-superseded SKU Varian spec, performs the full static gate (tsc + build + lint), and runs the Playwright e2e checklist derived verbatim from SPEC §14.

### Task 19: Mark the old SKU Varian spec as SUPERSEDED

The spec `docs/superpowers/specs/2026-05-30-sku-varian-page-design.md` described "SKU Varian" as a **separate owner page** at route `/menu/sku-varian` (its D4 decision). This UX-elevation work folds that page into a **tab** inside `/menu` ("Katalog Menu") and redirects the old route. Per the design SPEC §12 last bullet ("Sinkron docs … atau tandai superseded oleh dokumen ini"), we mark it superseded rather than rewriting it, preserving the historical record.

- [ ] **Step 19.1: Prepend a SUPERSEDED banner to the old SKU Varian spec.**

  **Files:**
  - Modify: `docs/superpowers/specs/2026-05-30-sku-varian-page-design.md`

  The current file begins with these exact first 8 lines:

  ```markdown
  # Halaman "SKU Varian" - pisahkan SKU tersembunyi dari "Kelola Menu"

  - **Tanggal:** 2026-05-30
  - **Status:** Disetujui (brainstorming) - siap planning
  - **Scope:** **Frontend-only** - nol perubahan backend / schema / migrasi.
  - **Spec terkait:** [2026-05-30-menu-variants-stock-linkage-design.md](2026-05-30-menu-variants-stock-linkage-design.md) (REV 2.10), [2026-05-30-cogs-per-menu-remove-belanja-design.md](2026-05-30-cogs-per-menu-remove-belanja-design.md) (REV 2.11)

  ---
  ```

  Edit: change the title line and the `**Status:**` line, and insert a blockquote banner immediately after the `**Spec terkait:**` line (before the `---`). Replace the block above with exactly:

  ```markdown
  # Halaman "SKU Varian" - pisahkan SKU tersembunyi dari "Kelola Menu"

  > **⚠️ SUPERSEDED (2026-05-30).** Dokumen ini digantikan oleh
  > [2026-05-30-katalog-menu-stok-ux-elevation-design.md](2026-05-30-katalog-menu-stok-ux-elevation-design.md).
  > Keputusan inti berubah: "SKU Varian" **bukan lagi halaman terpisah** di `/menu/sku-varian` (D4 lama),
  > melainkan menjadi **tab "Varian SKU" di dalam "Katalog Menu" (`/menu?tab=varian`)**. Route lama
  > `/menu/sku-varian` **di-redirect** ke `/menu?tab=varian`, dan item nav "SKU Varian" dihapus (jadi tab).
  > Badge induk yang dulu non-interaktif kini menjadi **link teks klikable** (navigasi nyata ke induk).
  > Spec ini dipertahankan sebagai catatan historis; untuk keputusan terkini lihat dokumen pengganti.

  - **Tanggal:** 2026-05-30
  - **Status:** ❌ SUPERSEDED oleh 2026-05-30-katalog-menu-stok-ux-elevation-design.md
  - **Scope:** **Frontend-only** - nol perubahan backend / schema / migrasi.
  - **Spec terkait:** [2026-05-30-menu-variants-stock-linkage-design.md](2026-05-30-menu-variants-stock-linkage-design.md) (REV 2.10), [2026-05-30-cogs-per-menu-remove-belanja-design.md](2026-05-30-cogs-per-menu-remove-belanja-design.md) (REV 2.11)

  ---
  ```

  Leave the rest of the file (sections 1 onward) untouched.

- [ ] **Step 19.2: Verify the banner edit.**

  Run from repo root (PowerShell):

  ```
  Get-Content "docs/superpowers/specs/2026-05-30-sku-varian-page-design.md" -TotalCount 12
  ```

  Expected: the first non-empty lines show the H1 title, then the `> **⚠️ SUPERSEDED (2026-05-30).**` blockquote, then the metadata bullets with `**Status:** ❌ SUPERSEDED …`. No other content changed.

- [ ] **Step 19.3: Commit the docs sync.**

  ```
  git add docs/superpowers/specs/2026-05-30-sku-varian-page-design.md
  git commit -m "docs(spec): tandai SKU Varian page-design SUPERSEDED oleh katalog-menu-stok UX elevation

  SKU Varian menjadi tab di Katalog Menu (/menu?tab=varian), route lama di-redirect,
  badge induk jadi link klikable. Dokumen lama dipertahankan sebagai catatan historis.

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task 20: Full static verification gate

This is the pre-claim static gate. It MUST pass before the Playwright e2e (Task 21). No commit unless a fix is required (if a fix is needed, fix in the relevant author's file, re-run, then commit that fix separately - do not change behavior in this task).

- [ ] **Step 20.1: TypeScript project build (type-check, no emit failures).**

  **Files:** none (verification only)

  Run from repo root (PowerShell):

  ```
  cd frontend; npx tsc -b
  ```

  Expected: command exits 0 with **no output** (clean). Any `error TS…` line is a failure - locate the owning task (1–18), fix the type error in that file, and re-run. Common suspects: `menuTree.ts` (Task 4) generic Map types; `DataTable.tsx` (Task 3) new `expandable`/`rowClassName`/`rowId` props vs consumers; `PageHeader.tsx`/`FilterToolbar.tsx` (Tasks 1–2) imports of `Tabs`/`TabItem`, `Input`, `Button`, `Sheet`, `useIsMobile`.

- [ ] **Step 20.2: Production build (tsc -b + vite build).**

  **Files:** none (verification only)

  Run from `frontend/` (the working directory persists from Step 20.1 in the same PowerShell call chain; otherwise re-`cd frontend`):

  ```
  npm run build
  ```

  Expected: `vite build` prints `✓ built in …` and emits the bundle under `frontend/dist/` with no error. The `tsc -b` stage inside the script must also pass. A non-zero exit or any `[vite]:` / `Rollup failed` error is a failure.

- [ ] **Step 20.3: ESLint (0 errors).**

  **Files:** none (verification only)

  Run from `frontend/`:

  ```
  npm run lint
  ```

  Expected: **0 errors**. Per project handoff, pre-existing `react-refresh/only-export-components` **warnings** on `*Builder` components and `MenuTypeFilter` are acceptable (they predate this work). The pass criterion is: **0 errors AND no NEW warnings** introduced by Tasks 1–18. If lint reports an error (e.g. unused import after extracting a tab, `react-hooks/exhaustive-deps` on a new `useEffect`, or a new `only-export-components` warning because a new file mixes a hook + component export), fix it in the owning author's file and re-run.

- [ ] **Step 20.4: Record the gate result.**

  No commit. State explicitly in the execution log: "tsc -b: 0 errors; npm run build: success; npm run lint: 0 errors (N pre-existing warnings unchanged)." Only if a fix was needed, commit it with a focused message ending:

  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  ```

---

### Task 21: Manual e2e via Playwright MCP

Drives the real app. Prereqs: dev servers running - backend on `:8000`, frontend on `:3000` (`npm run dev` from repo root starts both). Login as **owner**: name `"Owner"`, PIN `123456`. Use the `mcp__plugin_playwright_playwright__*` tools (`browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_resize`, `browser_take_screenshot`, `browser_wait_for`, `browser_console_messages`). No commit - this task records observations only.

The checklist below enumerates the EXACT scenarios from SPEC §14 (8 e2e scenarios + the consistency check + a regression check). Each is: concrete user action → expected observable result.

- [ ] **Step 21.1: Start dev servers + login owner.**

  - Action: from repo root run `npm run dev` (background); wait for Vite "Local: http://localhost:3000/" and backend "listening on :8000".
  - Action: `browser_navigate` to `http://localhost:3000/login`; type name `Owner`; type PIN `123456`; submit.
  - Expected: redirect to `/dashboard` (owner dashboard). `browser_console_messages` shows no uncaught errors.

- [ ] **Step 21.2: SPEC §14.1 - `/menu` defaults to tab "Menu Jual"; expand a parent shows children with stock + modal; collapse.**

  - Action: `browser_navigate` to `http://localhost:3000/menu`. Snapshot.
  - Expected: `PageHeader` title **"Katalog Menu"**, subtitle in the form `"<N> menu jual · <M> varian SKU"`; segmented tabs **"Menu Jual"** (active) + **"Varian SKU"**. Table shows only `posVisible=true` rows.
  - Action: locate a variant/paket parent row (SPEC §14 names "Ayam Potong"; if the seed parent label differs, pick any row that renders a leading chevron, i.e. `canExpand` true) and click its chevron toggle.
  - Expected: row expands; an inner block lists the child SKU(s) with **name + stock qty + modal (cost)** columns/values. Chevron flips (ChevronRight→ChevronDown).
  - Action: click the chevron again.
  - Expected: row collapses; child block removed. `onRowClick` (if any) did NOT fire on chevron click (stopPropagation works).

- [ ] **Step 21.3: SPEC §14.2 - Tab "Varian SKU"; click a parent (induk) link → switches to "Menu Jual" with parent highlighted.**

  - Action: click the **"Varian SKU"** tab. Snapshot.
  - Expected: URL becomes `/menu?tab=varian`; flat list of `posVisible=false` SKUs with columns **Nama SKU | Induk | Kategori | Stok | Modal | Aksi**. The "Induk" cell renders a **text link** (primary color, "↑" prefix), NOT a static badge.
  - Action: click an "↑ <parent name>" induk link on a row that has a parent.
  - Expected: tab switches to **"Menu Jual"** (URL `/menu?tab=jual` or focus-resolved); the parent row scrolls into center view and shows a temporary `ring-2 ring-primary-400` highlight that clears after ~2s; if the parent is itself a variant/paket it is auto-expanded.

- [ ] **Step 21.4: SPEC §14.3 - Orphan SKU shows warning badge "tanpa induk"; multi-parent shows "+N".**

  - Action: return to **"Varian SKU"** tab. Snapshot the Induk column across rows.
  - Expected: at least one SKU with no parent shows a **warning-tone Badge "tanpa induk"** (status, non-clickable). A multi-parent SKU shows a link label like `"↑ <first> +N"` (e.g. `"↑ Es Teh +1"`); on desktop the remaining parents are in a `title=` tooltip AND there is a small secondary line on mobile (verified in Step 21.8).

- [ ] **Step 21.5: SPEC §14.4 - "Stok →" on a portion SKU → `/stock` row highlighted; owner "Menu →" back → `/menu` highlighted.**

  - Action: on a SKU/menu row whose `stockType==='portion'`, click the **"Stok →"** button (outline, sm, right-arrow icon).
  - Expected: navigates to `/stock?focusMenuId=<id>`; the matching stock row (`id="stock-row-<id>"`) scrolls into center and shows a temporary ring highlight that clears after ~2s.
  - Action: on that highlighted stock row, click the owner-only **"Menu →"** action (IconButton, `ArrowUpRight`, label "Buka di Menu").
  - Expected: navigates to `/menu?focusMenuId=<id>`; tab is resolved from the menu's `posVisible` (jual vs varian); the matching menu row (`id="katalog-row-<id>"`) scrolls into center + temporary ring highlight ~2s.
  - Action (negative, optional): note that "Menu →" must render for **every** stock row when owner (outside the `stockType!=='portion'` gate) - confirm a non-portion row (if any) still shows "Menu →" but NOT the stock-mutating buttons.

- [ ] **Step 21.6: SPEC §14.5 - WaiterDashboard quick actions land correctly (opname modal opens; mark-habis lands on low-stock filter).**

  - Action: log out, log in as a waiter (name `Amel`, PIN `222222`); land on WaiterDashboard. Click the quick action that targets `/stock?action=opname`.
  - Expected: navigates to `/stock`; the **Opname modal opens automatically** (driven by `?action=opname` → `setShowOpname(true)`); the `action` param is stripped from the URL afterward.
  - Action: from WaiterDashboard click the **mark-habis** quick action.
  - Expected: navigates to `/stock` with the **low-stock / habis filter active** (per SPEC §9 - mark-habis is a per-row confirmation, so the quick action lands on the filtered list, not a global modal). No dead/ignored param.

- [ ] **Step 21.7: SPEC §14.6 - `/menu/sku-varian` redirects to `/menu?tab=varian`.**

  - Action: (back as owner) `browser_navigate` directly to `http://localhost:3000/menu/sku-varian`.
  - Expected: URL replaced with `/menu?tab=varian` (no history loop - `browser_navigate_back` once returns to the prior page, not back into `/menu/sku-varian`); the "Varian SKU" tab is active and the nav highlight on "Menu" is correct.

- [ ] **Step 21.8: SPEC §14.7 - Mobile viewport: accordion, labelled buttons, ⋯ overflow, target ≥44px.**

  - Action: `browser_resize` to a phone viewport (e.g. 390×844). `browser_navigate` to `/menu`.
  - Expected: tab "Menu Jual" renders as **mobile cards**; expanding a parent card reveals child cards rendered **below** the card (accordion), indented/nested.
  - Expected: secondary row actions (Riwayat, Nonaktifkan/Aktifkan) are collapsed into a **⋯ overflow (DropdownMenu)**; "Stok →" and "Edit" remain visible as **labelled buttons** (no reliance on hover tooltip).
  - Expected: tap targets (`IconButton sm` / `Button`) are **≥44px** in the smaller dimension - verify via `browser_evaluate` measuring `getBoundingClientRect()` on a sample button, or visually via screenshot.
  - Expected (multi-parent on mobile, ties to §14.3): the extra parents appear on a **small secondary line** in the card (not only in a desktop `title=` tooltip).

- [ ] **Step 21.9: SPEC §14.8 - Owner nav shows a single "Menu" item (no "SKU Varian").**

  - Action: as owner, open the main nav (and the mobile "Lainnya"/overflow if applicable). Snapshot.
  - Expected: exactly **one** "Menu" nav item; the old **"SKU Varian"** nav item is **gone** from both the primary nav and the mobile overflow.

- [ ] **Step 21.10: SPEC §14 consistency + regression - other DataTable consumers still render.**

  - Action (consistency): visually compare the `PageHeader` + `FilterToolbar` on **Katalog Menu** vs **Stok** vs the archetype pages **BillsPage** and **PaymentMethodsPage**. Expected: same header altitude/typography (`text-title` title + caption subtitle) and same toolbar shape (search + filter sheet on mobile).
  - Action (regression): `browser_navigate` to **HistoryPage** (`/history` or its route) and **BillsPage** (`/bills`), as owner.
  - Expected: both pages render their `DataTable` normally - rows, mobile cards, existing row actions all intact. Because `expandable`/`rowClassName`/`rowId` are **opt-in** props (Task 3), these non-expandable consumers must show **no leading chevron column** and behave exactly as before. `browser_console_messages` shows no new errors on either page.

- [ ] **Step 21.11: Record the e2e result.**

  No commit. Summarize pass/fail per scenario (21.2–21.10). If any scenario fails, file the defect against the owning task number (1–18) and route back; this task does not patch behavior itself.
