// MenuPage — REV 2.3 owner-only CRUD menu.
// DataTable responsive + Dialog form dgn subOptions JSON editor.

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, RotateCcw } from 'lucide-react'
import { menuService, type CreateMenuPayload, type UpdateMenuPayload } from '@/services/menuService'
import type { Menu, StockType } from '@/types'
import { formatCurrency, cn } from '@/lib/utils'
import {
  Button,
  IconButton,
  Input,
  Select,
  Badge,
  Skeleton,
  Dialog,
  DataTable,
  type DataTableColumn,
  type SelectOption,
} from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'
import { useConfirm } from '@/design-system/hooks/useConfirm'

const STOCK_TYPE_LABEL: Record<StockType, string> = {
  portion: 'Stok Porsi',
  linked: 'Linked',
  nonStock: 'Tidak ditrack',
}

const STOCK_TYPE_OPTIONS: SelectOption[] = [
  { value: 'nonStock', label: 'Tidak ditrack (minuman/nasi/paket)' },
  { value: 'portion', label: 'Stok Porsi (auto-decrement)' },
  { value: 'linked', label: 'Linked (varian, decrement menu lain)' },
]

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

  const categoryOptions: SelectOption[] = [
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
            {m.subOptions && 'options' in m.subOptions && (
              <Badge tone="primary" size="sm">
                Paket · {m.subOptions.options.length} pilihan
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
              {m.portionStock?.currentQty ?? '—'} / min {m.minStock ?? 0}
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
            <Select
              hideLabel
              label="Filter kategori"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              options={categoryOptions}
              containerClassName="min-w-[160px]"
            />
            <label className="flex items-center gap-2 text-body-sm text-neutral-700 cursor-pointer select-none px-2">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="w-4 h-4 rounded text-primary-600 border-neutral-300 focus:ring-primary-500"
              />
              Tampilkan nonaktif
            </label>
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
                      {m.subOptions && 'options' in m.subOptions && (
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

function MenuFormModal({
  existing,
  onClose,
  onSuccess,
}: {
  existing: Menu | null
  onClose: () => void
  onSuccess: () => void
}) {
  const toast = useToast()
  const [name, setName] = useState(existing?.name ?? '')
  const [category, setCategory] = useState(existing?.category ?? '')
  const [price, setPrice] = useState(existing?.price ?? 0)
  const [stockType, setStockType] = useState<StockType>(existing?.stockType ?? 'nonStock')
  const [minStock, setMinStock] = useState(existing?.minStock ?? 5)
  const [imageUrl, setImageUrl] = useState(existing?.imageUrl ?? '')
  const [subOptionsJson, setSubOptionsJson] = useState(
    existing?.subOptions ? JSON.stringify(existing.subOptions, null, 2) : ''
  )

  const mutation = useMutation({
    mutationFn: () => {
      let subOptions: CreateMenuPayload['subOptions'] = null
      if (subOptionsJson.trim()) {
        try {
          subOptions = JSON.parse(subOptionsJson)
        } catch {
          throw new Error('subOptions JSON tidak valid')
        }
      }
      const payload: CreateMenuPayload = {
        name,
        category,
        price,
        stockType,
        minStock: stockType === 'portion' ? minStock : undefined,
        imageUrl: imageUrl || null,
        subOptions,
      }
      if (existing) {
        const updatePayload: UpdateMenuPayload = {
          name: payload.name,
          category: payload.category,
          price: payload.price,
          stockType: payload.stockType,
          minStock: payload.minStock,
          imageUrl: payload.imageUrl,
          subOptions: payload.subOptions,
        }
        return menuService.update(existing.id, updatePayload)
      }
      return menuService.create(payload)
    },
    onSuccess: () => {
      toast.success(existing ? 'Menu diperbarui' : 'Menu dibuat')
      onSuccess()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={existing ? `Edit: ${existing.name}` : 'Tambah Menu'}
      size="lg"
      footer={
        <Button
          variant="primary"
          size="md"
          fullWidth
          onClick={() => mutation.mutate()}
          disabled={!name || !category || price <= 0}
          loading={mutation.isPending}
        >
          Simpan
        </Button>
      }
    >
      <div className="space-y-3">
        <Input
          label="Nama"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Kategori"
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Signature Ayam Bakar"
            required
          />
          <Input
            label="Harga (Rp)"
            type="number"
            inputMode="numeric"
            value={price || ''}
            onChange={(e) => setPrice(Number(e.target.value) || 0)}
            min={0}
            step={1000}
            required
          />
        </div>
        <Select
          label="Stock Type"
          value={stockType}
          onChange={(e) => setStockType(e.target.value as StockType)}
          options={STOCK_TYPE_OPTIONS}
        />
        {stockType === 'portion' && (
          <Input
            label="Min Stock"
            type="number"
            inputMode="numeric"
            value={minStock}
            onChange={(e) => setMinStock(Number(e.target.value) || 0)}
            min={0}
            helper="Reminder muncul di dashboard saat qty ≤ min."
          />
        )}
        <Input
          label="Image URL (opsional)"
          type="text"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="/menu/ayam-bakar.webp"
        />
        <div>
          <label className="text-label text-neutral-700 block mb-1.5">
            subOptions JSON{' '}
            <span className="text-caption text-neutral-500 font-normal">
              (linked / paket — kosongkan kalau tidak relevan)
            </span>
          </label>
          <textarea
            value={subOptionsJson}
            onChange={(e) => setSubOptionsJson(e.target.value)}
            rows={6}
            placeholder={`{"stockTarget":"Empal"}\natau\n{"options":[{"key":"cook","label":"Cara","options":["Bakar","Goreng"]}],"stockMap":{"Bakar":"X","Goreng":"Y"}}`}
            className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-md font-mono text-caption text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
          />
          <p className="text-caption text-neutral-500 mt-1">
            <strong>Linked:</strong> <code>{`{"stockTarget":"NamaMenu"}`}</code>.{' '}
            <strong>Paket:</strong> <code>{`{"options":[...],"stockMap":{...}}`}</code> — pakai key
            gabungan dgn separator <code>|</code> sesuai urutan.
          </p>
        </div>
      </div>
    </Dialog>
  )
}
