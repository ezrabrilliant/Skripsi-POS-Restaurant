// VarianSkuTab.tsx — tab "Varian SKU" untuk Katalog Menu (REV UX elevation).
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

  // Focus highlight + auto-reset filter bila row tidak ada di view ter-filter.
  useEffect(() => {
    if (focusMenuId == null) return
    const inView = filtered.some((r) => r.id === focusMenuId)
    if (!inView) {
      setSearch('')
      setCategoryFilter('all')
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
                  {m.cost != null ? formatCurrency(m.cost) : '—'}
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
