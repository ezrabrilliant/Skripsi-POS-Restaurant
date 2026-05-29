// MenuPage - REV 2.3 owner-only CRUD menu.
// DataTable responsive + MenuFormModal dengan form builder (no raw JSON).

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, RotateCcw, Search, PackageSearch } from 'lucide-react'
import { menuService } from '@/services/menuService'
import type { Menu, StockType } from '@/types'
import { formatCurrency, cn } from '@/lib/utils'
import { resolveMenuStockLink } from '@/lib/menuStockLink'
import {
  Button,
  IconButton,
  Combobox,
  Checkbox,
  Input,
  Badge,
  Skeleton,
  DataTable,
  type DataTableColumn,
  type ComboboxOption,
} from '@/design-system/primitives'
import { useIsMobile } from '@/design-system/hooks/useMediaQuery'
import { useToast } from '@/design-system/hooks/useToast'
import { useConfirm } from '@/design-system/hooks/useConfirm'
import { MenuFormModal } from '@/components/MenuFormModal'
import { SortableHeader } from '@/components/stock/SortableHeader'
import { MenuTypeFilter, toggleStockType } from '@/components/stock/MenuTypeFilter'

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

export default function MenuPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const isMobile = useIsMobile()
  const [showInactive, setShowInactive] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  // Default tampilkan SEMUA tipe (halaman kelola — owner perlu lihat semua menu,
  // beda dgn tab Stok yang default cuma tracked).
  const [types, setTypes] = useState<Set<StockType>>(
    () => new Set<StockType>(['portion', 'linked', 'nonStock'])
  )
  const [sortKey, setSortKey] = useState<MenuSortKey>('category')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null)
  const [creatingNew, setCreatingNew] = useState(false)

  // REV 2.9 (B2): terima deep-link Stok→Menu (`/menu?focusMenuId=…`). Tangkap
  // sekali lalu bersihkan URL + sorot baris ~3s (pola sama dengan StockPage).
  const [searchParams, setSearchParams] = useSearchParams()
  const focusMenuIdRef = useRef<number | null>(
    (() => {
      const raw = searchParams.get('focusMenuId')
      const n = raw != null ? Number(raw) : NaN
      return Number.isInteger(n) && n > 0 ? n : null
    })()
  )
  const [highlightId, setHighlightId] = useState<number | null>(focusMenuIdRef.current)
  useEffect(() => {
    if (searchParams.toString()) setSearchParams({}, { replace: true })
    if (focusMenuIdRef.current != null) {
      const t = setTimeout(() => setHighlightId(null), 3000)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data: menus = [], isLoading } = useQuery({
    queryKey: ['menus', 'admin', showInactive],
    queryFn: () => menuService.list({ activeOnly: !showInactive, includeStock: true }),
  })

  const categories = useMemo(() => {
    const set = new Set(menus.map((m) => m.category))
    return Array.from(set).sort()
  }, [menus])

  const typeCounts = useMemo(() => {
    const c: Record<StockType, number> = { portion: 0, linked: 0, nonStock: 0 }
    for (const m of menus) c[m.stockType]++
    return c
  }, [menus])

  const setSort = (k: MenuSortKey) => {
    if (k === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(k)
      setSortDir('asc')
    }
  }
  const toggleType = (t: StockType) => setTypes((prev) => toggleStockType(prev, t))

  const filtered = useMemo(() => {
    let arr = menus.slice()
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
  }, [menus, categoryFilter, types, search, sortKey, sortDir])

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
            {m.subOptions && 'choices' in m.subOptions && (
              <Badge tone="primary" size="sm">
                Paket · {m.subOptions.choices.length} slot pilihan
              </Badge>
            )}
            {m.subOptions && 'stockTarget' in m.subOptions && (
              <Badge tone="warning" size="sm">
                Linked → {m.subOptions.stockTarget}
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
          <StockJumpLink menu={m} menus={menus} />
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (m) => (
        <div className="inline-flex items-center gap-1">
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

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 space-y-3 pt-safe pb-safe">
        <header className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-headline font-semibold text-neutral-900">Kelola Menu</h1>
            <p className="text-body-sm text-neutral-600">
              {filtered.length} dari {menus.length} menu
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setCreatingNew(true)}
          >
            Menu
          </Button>
        </header>

        <div className="bg-white rounded-xl p-3 border border-neutral-200/60 space-y-2.5">
          <div className="flex items-center gap-2">
            <Input
              label="Cari"
              hideLabel
              type="search"
              inputMode="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari menu…"
              leftIcon={<Search className="w-4 h-4" />}
              containerClassName="flex-1"
            />
            {isMobile && (
              <Combobox
                hideLabel
                label="Urutkan"
                value={sortKey}
                onValueChange={(v) => setSort(v as MenuSortKey)}
                options={MENU_SORT_OPTIONS}
                containerClassName="w-[12rem] shrink-0"
              />
            )}
          </div>
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
          <MenuTypeFilter selected={types} counts={typeCounts} onToggle={toggleType} />
        </div>

        {isLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(m) => m.id}
            highlightKey={highlightId}
            emptyTitle="Tidak ada menu"
            emptyDescription={
              search || categoryFilter !== 'all' || types.size < 3
                ? 'Tidak ada menu cocok dengan filter.'
                : 'Klik tombol Menu di atas untuk menambah.'
            }
            mobileCard={(m) => (
              <div className={cn(!m.isActive && 'opacity-60', 'space-y-1.5')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-neutral-900">{m.name}</p>
                    <p className="text-caption text-neutral-500">{m.category}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {m.subOptions && 'choices' in m.subOptions && (
                        <Badge tone="primary" size="sm">Paket</Badge>
                      )}
                      {m.subOptions && 'stockTarget' in m.subOptions && (
                        <Badge tone="warning" size="sm">Linked</Badge>
                      )}
                      {m.stockType === 'portion' && (
                        <Badge tone="neutral" size="sm">
                          {m.portionStock?.currentQty ?? 0}/{m.minStock ?? 0}
                        </Badge>
                      )}
                      {!m.isActive && <Badge tone="neutral" variant="outline" size="sm">Nonaktif</Badge>}
                    </div>
                    <StockJumpLink menu={m} menus={menus} />
                  </div>
                  <p className="font-semibold text-neutral-900 tabular-nums shrink-0">
                    {formatCurrency(m.price)}
                  </p>
                </div>
                <div className="flex items-center justify-end gap-1 pt-1.5 border-t border-neutral-100">
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
        )}

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
      </div>
    </div>
  )
}

// REV 2.9 (B2): tautan "lihat stok" kontekstual dari baris menu.
// portion → fokus baris stoknya sendiri; linked → fokus stok menu target
// (resolve nama→id, fallback pencarian); nonStock → tidak dirender.
function StockJumpLink({ menu, menus }: { menu: Menu; menus: Menu[] }) {
  const link = resolveMenuStockLink(menu, menus)
  if (!link) return null
  return (
    <Link
      to={link.to}
      className={cn(
        'mt-1 inline-flex items-center gap-1 text-caption font-medium hover:underline underline-offset-2',
        link.isFallback ? 'text-neutral-500 hover:text-neutral-700' : 'text-primary-700 hover:text-primary-800'
      )}
    >
      <PackageSearch className="w-3.5 h-3.5" />
      {link.label}
    </Link>
  )
}
