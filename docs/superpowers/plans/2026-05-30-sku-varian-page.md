# Halaman "SKU Varian" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pindahkan ~34 SKU tersembunyi (`posVisible=false`, pegang stok/modal di balik menu varian & paket) dari "Kelola Menu" ke halaman owner terpisah `/menu/sku-varian`, dan bersihkan "Kelola Menu" jadi cuma menu jual.

**Architecture:** Frontend-only (nol backend/schema/migrasi). Backend `listMenus({includeHidden:true})` sudah mengembalikan `MenuDetail` lengkap (variants + paketComponents + cost + portionStock), jadi badge "induk" dihitung client-side via fungsi murni `buildParentMap`. Reuse `MenuFormModal` (edit modal/COGS + struktural) dan `CostHistoryDrawer` (riwayat) — `CostHistoryDrawer` diangkat dulu dari MenuPage jadi komponen sendiri (DRY).

**Tech Stack:** React 18 + TypeScript + Vite + React Query + React Router v7 + Tailwind + design-system primitives lokal. **Tidak ada test runner di frontend** — verifikasi = `tsc -b` + `vite build` + ESLint + manual e2e (pola frontend project).

**Spec:** [docs/superpowers/specs/2026-05-30-sku-varian-page-design.md](../specs/2026-05-30-sku-varian-page-design.md)

**Catatan commit:** Selalu `git add <file spesifik>` (JANGAN `git add -A`/`.`) karena working tree punya perubahan pra-sesi yang tidak boleh ikut ter-commit. Branch kerja: `feat/sku-varian-page`.

---

## Task 1: Ekstrak `CostHistoryDrawer` jadi komponen sendiri

`CostHistoryDrawer` saat ini fungsi lokal (non-export) di `MenuPage.tsx` (baris 441-466). Angkat jadi komponen reusable supaya dipakai bareng MenuPage + SkuVarianPage.

**Files:**
- Create: `frontend/src/components/menu/CostHistoryDrawer.tsx`
- Modify: `frontend/src/pages/MenuPage.tsx` (hapus fungsi lokal + import yang pindah, tambah import komponen baru)

- [ ] **Step 1: Buat komponen `CostHistoryDrawer.tsx`**

Create `frontend/src/components/menu/CostHistoryDrawer.tsx`:

```tsx
// CostHistoryDrawer - drawer riwayat perubahan modal/COGS per menu (REV 2.11).
// Diekstrak dari MenuPage supaya dipakai bareng MenuPage + SkuVarianPage.
// Memetakan MenuCostMovementView ke HistoryMovement (shape generic StockHistorySheet):
// costBefore→qtyBefore, costAfter→qtyAfter, delta = after − before, unit "Rp".

import { useQuery } from '@tanstack/react-query'
import { menuService } from '@/services/menuService'
import { COST_REASON_LABEL } from '@/types'
import { StockHistorySheet, type HistoryMovement } from '@/components/stock/StockHistorySheet'

export function CostHistoryDrawer({ menuId, onClose }: { menuId: number; onClose: () => void }) {
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
      open
      onOpenChange={(o) => !o && onClose()}
      title="Riwayat Modal"
      isLoading={isLoading}
      movements={movements}
      unitSuffix="Rp"
    />
  )
}
```

- [ ] **Step 2: Hapus import yang pindah di `MenuPage.tsx`**

Ganti blok import (baris 8-11):

```tsx
import type { Menu, StockType } from '@/types'
import { COST_REASON_LABEL } from '@/types'
import { formatCurrency, cn } from '@/lib/utils'
import { StockHistorySheet, type HistoryMovement } from '@/components/stock/StockHistorySheet'
```

menjadi:

```tsx
import type { Menu, StockType } from '@/types'
import { formatCurrency, cn } from '@/lib/utils'
```

- [ ] **Step 3: Tambah import `CostHistoryDrawer` di `MenuPage.tsx`**

Ganti (baris 27-28):

```tsx
import { MenuFormModal } from '@/components/MenuFormModal'
import { SortableHeader } from '@/components/stock/SortableHeader'
```

menjadi:

```tsx
import { MenuFormModal } from '@/components/MenuFormModal'
import { CostHistoryDrawer } from '@/components/menu/CostHistoryDrawer'
import { SortableHeader } from '@/components/stock/SortableHeader'
```

- [ ] **Step 4: Hapus fungsi lokal `CostHistoryDrawer` di `MenuPage.tsx`**

Hapus seluruh blok berikut (baris 441-466, termasuk komentar di atasnya). Pemakaian `<CostHistoryDrawer menuId={historyMenuId} onClose={...} />` di dalam komponen (baris 433-435) tetap, sekarang merujuk ke versi yang di-import.

```tsx
/** REV 2.11: drawer riwayat perubahan modal/COGS. Memetakan
 * MenuCostMovementView ke HistoryMovement (shape generic StockHistorySheet):
 * costBefore→qtyBefore, costAfter→qtyAfter, delta = after − before, unit "Rp". */
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

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc -b`
Expected: 0 error (MenuPage tetap kompil; `CostHistoryDrawer` sekarang dari import; `COST_REASON_LABEL`/`StockHistorySheet`/`HistoryMovement` sudah tidak dipakai langsung di MenuPage sehingga tidak ada unused-import error).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/menu/CostHistoryDrawer.tsx frontend/src/pages/MenuPage.tsx
git commit -m "refactor(menu): ekstrak CostHistoryDrawer jadi komponen reusable"
```

---

## Task 2: Buat `SkuVarianPage` + helper `buildParentMap`

**Files:**
- Create: `frontend/src/pages/SkuVarianPage.tsx`

- [ ] **Step 1: Buat halaman + helper**

Create `frontend/src/pages/SkuVarianPage.tsx`:

```tsx
// SkuVarianPage - halaman owner kelola SKU tersembunyi (posVisible=false):
// item di balik menu varian & paket yang pegang stok dan/atau modal/COGS.
// Tidak tampil di kasir. Aksi stok (restock/opname) tetap di halaman Stok.
//
// Frontend-only: list({includeHidden,includeStock}) sudah bawa variants +
// paketComponents + cost + portionStock. Badge "induk" dihitung client-side
// via buildParentMap. Edit modal/COGS + struktural lewat MenuFormModal (reuse).

import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Search, History } from 'lucide-react'
import { menuService } from '@/services/menuService'
import type { Menu } from '@/types'
import { formatCurrency, cn } from '@/lib/utils'
import {
  Combobox,
  Checkbox,
  Input,
  Badge,
  IconButton,
  Skeleton,
  DataTable,
  type DataTableColumn,
  type ComboboxOption,
} from '@/design-system/primitives'
import { MenuFormModal } from '@/components/MenuFormModal'
import { CostHistoryDrawer } from '@/components/menu/CostHistoryDrawer'

/**
 * Bangun map skuId -> daftar nama menu induk (parent) yang mereferensikan SKU
 * itu, lewat variant (stockTarget/costSource) atau paket (component/choiceOption
 * target). Dipakai untuk badge "induk". Fungsi murni; nama induk di-dedup.
 */
export function buildParentMap(menus: Menu[]): Map<number, string[]> {
  const map = new Map<number, string[]>()
  const add = (skuId: number | null, parentName: string) => {
    if (skuId == null) return
    const arr = map.get(skuId)
    if (arr) {
      if (!arr.includes(parentName)) arr.push(parentName)
    } else {
      map.set(skuId, [parentName])
    }
  }
  for (const m of menus) {
    if (m.kind === 'variant') {
      for (const v of m.variants ?? []) {
        add(v.stockTargetMenuId, m.name)
        add(v.costSourceMenuId, m.name)
      }
    } else if (m.kind === 'paket') {
      for (const c of m.paketComponents ?? []) {
        add(c.targetMenuId, m.name)
        for (const co of c.choiceOptions) add(co.targetMenuId, m.name)
      }
    }
  }
  return map
}

/** Label badge induk: "← Induk" atau "← Induk +N" kalau dipakai banyak menu. */
function parentBadgeLabel(parents: string[]): string {
  if (parents.length === 0) return ''
  const [first, ...rest] = parents
  return rest.length > 0 ? `← ${first} +${rest.length}` : `← ${first}`
}

export default function SkuVarianPage() {
  const qc = useQueryClient()
  const [showInactive, setShowInactive] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null)
  const [historyMenuId, setHistoryMenuId] = useState<number | null>(null)

  // Query identik dengan MenuPage (key + params SAMA) supaya berbagi cache
  // React Query & konsisten (lihat spec §5.4 anti-bug cache).
  const { data: menus = [], isLoading } = useQuery({
    queryKey: ['menus', 'admin', showInactive],
    queryFn: () =>
      menuService.list({ activeOnly: !showInactive, includeStock: true, includeHidden: true }),
  })

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
          return <span className="text-neutral-300">—</span>
        return (
          <span title={parents.join(', ')}>
            <Badge tone="primary" variant="outline" size="sm">
              {parentBadgeLabel(parents)}
            </Badge>
          </span>
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
          return <span className="text-neutral-300">—</span>
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
          {m.cost != null ? formatCurrency(m.cost) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (m) => (
        <div className="inline-flex items-center gap-1">
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

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 space-y-3 pt-safe pb-safe">
        <header>
          <h1 className="text-headline font-semibold text-neutral-900">SKU Varian</h1>
          <p className="text-body-sm text-neutral-600">
            Item di balik menu varian &amp; paket — pegang stok dan/atau modal. Tidak
            tampil di kasir.
          </p>
        </header>

        <div className="bg-white rounded-xl p-3 border border-neutral-200/60 space-y-2.5">
          <Input
            label="Cari"
            hideLabel
            type="search"
            inputMode="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari SKU…"
            leftIcon={<Search className="w-4 h-4" />}
          />
          <div className="flex flex-wrap items-center gap-2">
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
              onCheckedChange={setShowInactive}
            />
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(m) => m.id}
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
                      <div className="flex flex-wrap gap-1 mt-1">
                        {parents.length > 0 ? (
                          <Badge tone="primary" variant="outline" size="sm">
                            {parentBadgeLabel(parents)}
                          </Badge>
                        ) : (
                          <Badge tone="neutral" variant="outline" size="sm">
                            tanpa induk
                          </Badge>
                        )}
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
                      {m.cost != null ? formatCurrency(m.cost) : '—'}
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-1 pt-1.5 border-t border-neutral-100">
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
        )}

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
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc -b`
Expected: 0 error. (Halaman belum di-route, jadi belum kelihatan di app — itu Task 3.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/SkuVarianPage.tsx
git commit -m "feat(menu): halaman SKU Varian + helper buildParentMap (belum di-route)"
```

---

## Task 3: Wire barrel export + route + nav (dengan fix active-state `/menu`)

**Files:**
- Modify: `frontend/src/pages/index.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx`

- [ ] **Step 1: Tambah barrel export**

Di `frontend/src/pages/index.ts`, ganti baris:

```tsx
export { default as MenuPage } from './MenuPage'
```

menjadi:

```tsx
export { default as MenuPage } from './MenuPage'
export { default as SkuVarianPage } from './SkuVarianPage'
```

- [ ] **Step 2: Import + route di `App.tsx`**

Ganti blok import (baris 5-19) — tambah `SkuVarianPage`:

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

menjadi:

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

Lalu tambah route owner-only. Ganti (baris 83):

```tsx
          <Route path="menu" element={<RoleRoute allow={['owner']}><MenuPage /></RoleRoute>} />
```

menjadi:

```tsx
          <Route path="menu" element={<RoleRoute allow={['owner']}><MenuPage /></RoleRoute>} />
          <Route path="menu/sku-varian" element={<RoleRoute allow={['owner']}><SkuVarianPage /></RoleRoute>} />
```

- [ ] **Step 3: Nav owner di `Layout.tsx` — tambah item + `Boxes` icon + dukung `end`**

(a) Tambah `Boxes` ke import lucide (baris 6-21). Ganti:

```tsx
import {
  LayoutGrid,
  Grid3X3,
  ClipboardList,
  Calculator,
  UtensilsCrossed,
  Package,
  LogOut,
  User,
  Users,
  Receipt,
  Menu as MenuIcon,
  ChevronRight,
  Home,
  CreditCard,
} from 'lucide-react'
```

menjadi (sisipkan `Boxes`):

```tsx
import {
  LayoutGrid,
  Grid3X3,
  ClipboardList,
  Calculator,
  UtensilsCrossed,
  Package,
  LogOut,
  User,
  Users,
  Receipt,
  Menu as MenuIcon,
  ChevronRight,
  Home,
  CreditCard,
  Boxes,
} from 'lucide-react'
```

(b) Tambah field opsional `end` ke interface `NavItem` (baris 27-31). Ganti:

```tsx
interface NavItem {
  to: string
  icon: typeof LayoutGrid
  label: string
}
```

menjadi:

```tsx
interface NavItem {
  to: string
  icon: typeof LayoutGrid
  label: string
  /** Bila true, NavLink hanya aktif saat path EXACT (cegah '/menu' ikut aktif
   *  di '/menu/sku-varian'). Default: match prefix (kecuali root '/'). */
  end?: boolean
}
```

(c) Sisipkan item nav owner + tandai `/menu` `end:true`. Ganti (baris 45):

```tsx
    { to: '/menu',       icon: UtensilsCrossed,  label: 'Menu' },
```

menjadi:

```tsx
    { to: '/menu',       icon: UtensilsCrossed,  label: 'Menu', end: true },
    { to: '/menu/sku-varian', icon: Boxes,       label: 'SKU Varian' },
```

(d) Teruskan `end` ke 3 NavLink. **Sidebar desktop** — ganti `<NavLink to={item.to} title={item.label}` (baris 113-115) jadi tambah `end`:

```tsx
                <NavLink
                  to={item.to}
                  end={item.end}
                  title={item.label}
```

**Bottom-nav mobile** — ganti `end={item.to === '/'}` (baris 199) jadi:

```tsx
              end={item.end ?? item.to === '/'}
```

**Sheet "Lainnya" mobile** (moreItems) — ganti `<NavLink to={item.to} onClick={() => setMoreOpen(false)}` (baris 257-259) jadi tambah `end`:

```tsx
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={() => setMoreOpen(false)}
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc -b`
Expected: 0 error.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/index.ts frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat(menu): route /menu/sku-varian + nav owner SKU Varian"
```

---

## Task 4: Bersihin "Kelola Menu" (filter posVisible + hapus badge)

**Files:**
- Modify: `frontend/src/pages/MenuPage.tsx`

- [ ] **Step 1: Update komentar query (opsional, jaga akurasi)**

Ganti (baris 67-71):

```tsx
  const { data: menus = [], isLoading } = useQuery({
    // REV 2.11: includeHidden agar leaf SKU (posVisible=false) ikut tampil +
    // editable; owner token (auto-inject) bikin backend kirim field cost.
    queryKey: ['menus', 'admin', showInactive],
    queryFn: () => menuService.list({ activeOnly: !showInactive, includeStock: true, includeHidden: true }),
  })
```

menjadi:

```tsx
  const { data: menus = [], isLoading } = useQuery({
    // includeHidden TETAP true (owner token bikin backend kirim cost) supaya
    // cache konsisten dengan MenuFormModal & SkuVarianPage. SKU posVisible=false
    // di-FILTER client-side (lihat visibleMenus) — dikelola di halaman SKU Varian.
    queryKey: ['menus', 'admin', showInactive],
    queryFn: () => menuService.list({ activeOnly: !showInactive, includeStock: true, includeHidden: true }),
  })
```

- [ ] **Step 2: Tambah `visibleMenus` + pakai di `categories`**

Ganti (baris 73-76):

```tsx
  const categories = useMemo(() => {
    const set = new Set(menus.map((m) => m.category))
    return Array.from(set).sort()
  }, [menus])
```

menjadi:

```tsx
  // "Kelola Menu" hanya menu jual (posVisible=true). SKU tersembunyi pindah ke
  // halaman SKU Varian.
  const visibleMenus = useMemo(() => menus.filter((m) => m.posVisible), [menus])

  const categories = useMemo(() => {
    const set = new Set(visibleMenus.map((m) => m.category))
    return Array.from(set).sort()
  }, [visibleMenus])
```

- [ ] **Step 3: `typeCounts` basis visible**

Ganti (baris 78-82):

```tsx
  const typeCounts = useMemo(() => {
    const c: Record<StockType, number> = { portion: 0, linked: 0, nonStock: 0 }
    for (const m of menus) c[m.stockType]++
    return c
  }, [menus])
```

menjadi:

```tsx
  const typeCounts = useMemo(() => {
    const c: Record<StockType, number> = { portion: 0, linked: 0, nonStock: 0 }
    for (const m of visibleMenus) c[m.stockType]++
    return c
  }, [visibleMenus])
```

- [ ] **Step 4: `filtered` basis visible**

Ganti (baris 93-94):

```tsx
  const filtered = useMemo(() => {
    let arr = menus.slice()
```

menjadi:

```tsx
  const filtered = useMemo(() => {
    let arr = visibleMenus.slice()
```

Lalu pada array dependency `useMemo` `filtered` (baris 110), ganti:

```tsx
  }, [menus, categoryFilter, types, search, sortKey, sortDir])
```

menjadi:

```tsx
  }, [visibleMenus, categoryFilter, types, search, sortKey, sortDir])
```

- [ ] **Step 5: Header count basis visible**

Ganti (baris 291-293):

```tsx
            <p className="text-body-sm text-neutral-600">
              {filtered.length} dari {menus.length} menu
            </p>
```

menjadi:

```tsx
            <p className="text-body-sm text-neutral-600">
              {filtered.length} dari {visibleMenus.length} menu
            </p>
```

- [ ] **Step 6: Hapus badge "Tersembunyi dari POS" (desktop, baris 173-178)**

Hapus blok:

```tsx
            {/* SKU stok granular yang disembunyikan dari grid POS (collapse REV 2.10). */}
            {!m.posVisible && (
              <Badge tone="neutral" variant="outline" size="sm">
                Tersembunyi dari POS
              </Badge>
            )}
```

- [ ] **Step 7: Hapus badge "Tersembunyi" (mobile, baris 375-377)**

Hapus blok:

```tsx
                      {!m.posVisible && (
                        <Badge tone="neutral" variant="outline" size="sm">Tersembunyi</Badge>
                      )}
```

- [ ] **Step 8: Typecheck**

Run: `cd frontend && npx tsc -b`
Expected: 0 error. (Setelah filter, semua row di MenuPage `posVisible=true`, jadi pengecekan `!m.posVisible` memang sudah tak relevan.)

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/MenuPage.tsx
git commit -m "refactor(menu): Kelola Menu hanya menu jual (filter posVisible, hapus badge tersembunyi)"
```

---

## Task 5: Label checkbox kondisional di `MenuFormModal`

**Files:**
- Modify: `frontend/src/components/MenuFormModal.tsx`

- [ ] **Step 1: Ubah label checkbox status aktif**

Ganti (baris 587-595):

```tsx
        {existing && (
          <div className="pt-2 border-t border-neutral-200">
            <Checkbox
              label="Menu aktif (tampil di POS)"
              checked={state.isActive}
              onCheckedChange={(c) => update('isActive', c)}
            />
          </div>
        )}
```

menjadi:

```tsx
        {existing && (
          <div className="pt-2 border-t border-neutral-200">
            <Checkbox
              label={
                existing.posVisible
                  ? 'Menu aktif (tampil di POS)'
                  : 'SKU aktif (bisa dipakai stok/modal varian)'
              }
              checked={state.isActive}
              onCheckedChange={(c) => update('isActive', c)}
            />
          </div>
        )}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc -b`
Expected: 0 error.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/MenuFormModal.tsx
git commit -m "polish(menu): label checkbox MenuFormModal kondisional untuk SKU tersembunyi"
```

---

## Task 6: Verifikasi penuh (build + lint + manual e2e)

**Files:** none (verifikasi saja)

- [ ] **Step 1: Build penuh + lint**

Run: `cd frontend && npm run build && npm run lint`
Expected: `tsc -b` 0 error, `vite build` sukses (bundle ter-emit), ESLint 0 error/0 warning.

- [ ] **Step 2: Manual e2e browser (jalankan `npm run dev` dari root, login owner)**

Checklist:
- [ ] Nav owner ada item **"SKU Varian"** (desktop sidebar / mobile sheet "Lainnya"). Klik → buka `/menu/sku-varian`.
- [ ] Daftar SKU tersembunyi muncul (mis. Paha Ayam Bakar, Teh Tawar Biasa, Jeruk Nipis). Kolom **Induk** benar (Paha Ayam Bakar ← Ayam Potong; Teh Tawar Biasa ← Es Teh, dengan `+N` kalau juga dipakai paket).
- [ ] Kolom **Stok**: SKU `portion` tampil angka (warna sesuai low/habis); SKU `nonStock` tampil `—`.
- [ ] Kolom **Modal**: tampil `Rp …` / `—`.
- [ ] Klik ✎ Edit → `MenuFormModal` terbuka; checkbox bawah berlabel **"SKU aktif (bisa dipakai stok/modal varian)"** (bukan "tampil di POS"). Ubah modal/COGS → Simpan → toast sukses; buka ⏱ Riwayat → perubahan tercatat.
- [ ] Buka **"Kelola Menu"**: TIDAK ada lagi SKU tersembunyi, TIDAK ada badge "Tersembunyi dari POS". Hitungan "X dari Y menu" = jumlah menu jual saja. Filter "Tampilkan nonaktif" tetap jalan.
- [ ] Buka **Kasir (POS)**: grid menu tidak berubah (SKU tersembunyi tetap tidak muncul; menu varian/paket tetap normal).
- [ ] NavLink active-state: saat di `/menu/sku-varian`, item "Menu" TIDAK ikut ter-highlight (hanya "SKU Varian").

- [ ] **Step 3: Verifikasi-before-completion**

Gunakan skill `superpowers:verification-before-completion` — pastikan semua bukti (output build/lint + hasil checklist e2e) terkumpul SEBELUM klaim selesai. Bila ada langkah gagal, debug dulu (`superpowers:systematic-debugging`).

---

## Self-Review (penulis plan)

- **Spec coverage:** D1 halaman terpisah (Task 2-3) ✓ · D2 nama + subjudul (Task 2 header) ✓ · D3 kapabilitas: daftar+modal+riwayat (Task 2) + stok read-only (kolom Stok) + badge induk (`buildParentMap`) + edit struktural (reuse MenuFormModal) ✓ · D4 route `/menu/sku-varian` + nav setelah Menu (Task 3) ✓ · D5 reuse MenuFormModal + CostHistoryDrawer (Task 1+2) ✓ · D6 label kondisional (Task 5) ✓ · §5.4 bersihin MenuPage + cache konsisten (Task 4) ✓ · §6 edge cases (multi-induk `+N`, yatim `—`/`tanpa induk`, nonStock `—`, nonaktif via showInactive) ✓ · §7 verifikasi (Task 6) ✓.
- **Placeholder scan:** tidak ada TBD/TODO; semua step punya kode/COMMAND eksak.
- **Type consistency:** `buildParentMap(menus: Menu[]): Map<number,string[]>` dipakai konsisten; field `stockTargetMenuId`/`costSourceMenuId` (MenuVariant), `targetMenuId`/`choiceOptions[].targetMenuId` (PaketComponent/PaketChoiceOptionDetail), `portionStock.{currentQty,minStock}`, `cost`, `kind`, `posVisible` semua cocok dengan `frontend/src/types/index.ts`. `CostHistoryDrawer({menuId,onClose})` signature sama di Task 1 (definisi) & Task 2 (pemakaian).
