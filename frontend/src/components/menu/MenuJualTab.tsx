// MenuJualTab.tsx — tab "Menu Jual" untuk Katalog Menu (REV UX elevation).
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
      // REV 2.11: modal/COGS per menu. Parent variant/paket → cost null → "—".
      key: 'cost',
      header: 'Modal',
      align: 'right',
      hideMobile: true,
      cell: (m) => (
        <span className="text-neutral-700 tabular-nums">
          {m.cost != null ? formatCurrency(m.cost) : '—'}
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
                  <span className="text-neutral-300">—</span>
                )}
              </div>
              <div className="text-right shrink-0 text-caption text-neutral-700 tabular-nums w-16">
                {c.cost != null ? formatCurrency(c.cost) : '—'}
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

  // Focus highlight + auto-reset filter bila row tidak ada di view ter-filter.
  useEffect(() => {
    if (focusMenuId == null) return
    // Cek apakah baris ada di filtered view; kalau tidak, reset filter dulu.
    const inView = filtered.some((r) => r.id === focusMenuId)
    if (!inView) {
      // Cari baris di visibleMenus untuk tahu stockType-nya.
      const target = visibleMenus.find((m) => m.id === focusMenuId)
      setSearch('')
      setCategoryFilter('all')
      if (target && !types.has(target.stockType)) {
        setTypes(new Set<StockType>(['portion', 'linked', 'nonStock']))
      }
      // scrollIntoView setelah state flush (next microtask).
      setTimeout(() => {
        document.getElementById('katalog-row-' + focusMenuId)?.scrollIntoView({ block: 'center' })
        const t = setTimeout(clearFocus, 2000)
        return () => clearTimeout(t)
      }, 0)
    } else {
      document.getElementById('katalog-row-' + focusMenuId)?.scrollIntoView({ block: 'center' })
      const t = setTimeout(clearFocus, 2000)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMenuId])

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
