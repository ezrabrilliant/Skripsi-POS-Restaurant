// MenuPage - REV 2.3 owner-only CRUD menu.
// DataTable responsive + MenuFormModal dengan form builder (no raw JSON).

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, RotateCcw } from 'lucide-react'
import { menuService } from '@/services/menuService'
import type { Menu, StockType } from '@/types'
import { formatCurrency, cn } from '@/lib/utils'
import {
  Button,
  IconButton,
  Combobox,
  Checkbox,
  Badge,
  Skeleton,
  DataTable,
  type DataTableColumn,
  type ComboboxOption,
} from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'
import { useConfirm } from '@/design-system/hooks/useConfirm'
import { MenuFormModal } from '@/components/MenuFormModal'

const STOCK_TYPE_LABEL: Record<StockType, string> = {
  portion: 'Stok Porsi',
  linked: 'Linked',
  nonStock: 'Tidak ditrack',
}

export default function MenuPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const [showInactive, setShowInactive] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null)
  const [creatingNew, setCreatingNew] = useState(false)

  const { data: menus = [], isLoading } = useQuery({
    queryKey: ['menus', 'admin', showInactive],
    queryFn: () => menuService.list({ activeOnly: !showInactive, includeStock: true }),
  })

  const categories = useMemo(() => {
    const set = new Set(menus.map((m) => m.category))
    return Array.from(set).sort()
  }, [menus])

  const filtered = useMemo(() => {
    if (categoryFilter === 'all') return menus
    return menus.filter((m) => m.category === categoryFilter)
  }, [menus, categoryFilter])

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
      header: 'Menu',
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
      header: 'Kategori',
      hideMobile: true,
      cell: (m) => <span className="text-neutral-700">{m.category}</span>,
    },
    {
      key: 'price',
      header: 'Harga',
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
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-headline font-semibold text-neutral-900">Kelola Menu</h1>
            <p className="text-body-sm text-neutral-600">{filtered.length} menu</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Combobox
              hideLabel
              label="Filter kategori"
              value={categoryFilter}
              onValueChange={setCategoryFilter}
              options={categoryOptions}
              searchPlaceholder="Cari kategori..."
              containerClassName="min-w-[180px]"
            />
            <div className="px-2">
              <Checkbox
                label="Tampilkan nonaktif"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
            </div>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setCreatingNew(true)}
            >
              Menu
            </Button>
          </div>
        </header>

        {isLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(m) => m.id}
            emptyTitle="Tidak ada menu"
            emptyDescription="Klik tombol Menu di atas untuk menambah."
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
