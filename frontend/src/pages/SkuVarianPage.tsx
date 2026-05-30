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
 * Tidak di-export (cuma dipakai di file ini) → hindari warning fast-refresh.
 */
function buildParentMap(menus: Menu[]): Map<number, string[]> {
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
        // fixed → targetMenuId terisi & choiceOptions []; choice → sebaliknya.
        // Iterasi dua-duanya aman (yang tak relevan kosong/null).
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
          return (
            <Badge tone="neutral" variant="outline" size="sm">
              tanpa induk
            </Badge>
          )
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
