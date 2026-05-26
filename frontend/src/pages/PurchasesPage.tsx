// PurchasesPage - REV 2.3 owner+kasir. List belanja pasar + create dengan
// vendor picker (optional) + multiple items. Auto-effect ke raw_materials di
// backend (stockQty + unitPrice + lastBuyDate untuk tracked items).

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ShoppingCart, Trash2 } from 'lucide-react'
import {
  purchaseService,
  type CreatePurchasePayload,
  type CreatePurchaseItem,
} from '@/services/purchaseService'
import { vendorService } from '@/services/vendorService'
import { rawMaterialsService } from '@/services/rawMaterialsService'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import {
  Button,
  IconButton,
  Input,
  Combobox,
  Badge,
  Skeleton,
  EmptyState,
  Dialog,
  type ComboboxOption,
} from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'

export default function PurchasesPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [monthFilter, setMonthFilter] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ['purchases', monthFilter],
    queryFn: () => purchaseService.list({ month: monthFilter }),
  })

  const monthTotal = purchases.reduce((s, p) => s + p.totalAmount, 0)

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 space-y-3 pt-safe pb-safe">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-headline font-semibold text-neutral-900">Belanja Pasar</h1>
            <p className="text-body-sm text-neutral-600">
              {purchases.length} transaksi ·{' '}
              <span className="font-medium text-neutral-900 tabular-nums">
                {formatCurrency(monthTotal)}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="h-10 px-3 bg-white border border-neutral-300 rounded-md text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
              aria-label="Filter bulan"
            />
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setShowCreate(true)}
            >
              Catat Belanja
            </Button>
          </div>
        </header>

        {isLoading ? (
          <Skeleton className="h-64" />
        ) : purchases.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart />}
            title="Belum ada belanja bulan ini"
            description="Klik tombol Catat Belanja untuk menambah pencatatan."
          />
        ) : (
          <div className="bg-white rounded-xl divide-y divide-neutral-100 border border-neutral-200/60 overflow-hidden">
            {purchases.map((p) => (
              <div key={p.id} className="p-3 sm:p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-neutral-900">{formatDate(p.date)}</span>
                      {p.vendorName && (
                        <Badge tone="neutral" size="sm">{p.vendorName}</Badge>
                      )}
                      <span className="text-caption text-neutral-500">oleh {p.userName}</span>
                    </div>
                    {p.note && <p className="text-caption text-neutral-600 mt-1 italic">{p.note}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-caption text-neutral-500">Total</p>
                    <p className="text-title font-semibold text-neutral-900 tabular-nums">
                      {formatCurrency(p.totalAmount)}
                    </p>
                  </div>
                </div>
                <ul className="text-body-sm space-y-1 mt-2 pt-2 border-t border-neutral-100">
                  {p.items.map((it) => (
                    <li
                      key={it.id}
                      className="flex justify-between text-neutral-800 gap-2 tabular-nums"
                    >
                      <span className="min-w-0">
                        <span className="font-medium">{it.rawMaterialName}</span>
                        <span className="text-neutral-500">
                          {' '}
                          · {it.qty} {it.rawMaterialUnit} @ {formatCurrency(it.unitPrice)}
                        </span>
                        {!it.isTracked && (
                          <Badge tone="neutral" variant="outline" size="sm" className="ml-2">
                            log-only
                          </Badge>
                        )}
                      </span>
                      <span className="font-medium text-neutral-900 shrink-0">
                        {formatCurrency(it.subtotal)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {showCreate && (
          <CreatePurchaseModal
            onClose={() => setShowCreate(false)}
            onSuccess={() => {
              setShowCreate(false)
              qc.invalidateQueries({ queryKey: ['purchases'] })
              qc.invalidateQueries({ queryKey: ['rawMaterials'] })
            }}
          />
        )}
      </div>
    </div>
  )
}

function CreatePurchaseModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const toast = useToast()
  const today = new Date().toISOString().substring(0, 10)
  const [date, setDate] = useState(today)
  const [vendorId, setVendorId] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [items, setItems] = useState<CreatePurchaseItem[]>([])

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => vendorService.list(),
  })

  const { data: rawMaterials = [] } = useQuery({
    queryKey: ['rawMaterials', 'all'],
    queryFn: () => rawMaterialsService.list(),
  })

  const create = useMutation({
    mutationFn: (payload: CreatePurchasePayload) => purchaseService.create(payload),
    onSuccess: () => {
      toast.success('Belanja berhasil dicatat')
      onSuccess()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const addItem = () => {
    if (rawMaterials.length === 0) {
      toast.error('Tidak ada raw material. Owner harus tambah master raw material dulu.')
      return
    }
    setItems([...items, { rawMaterialId: rawMaterials[0]!.id, qty: 1, unitPrice: 0 }])
  }

  const updateItem = (idx: number, patch: Partial<CreatePurchaseItem>) => {
    setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx))
  }

  const totalAmount = items.reduce((s, it) => s + it.qty * it.unitPrice, 0)

  const handleSubmit = () => {
    if (items.length === 0) {
      toast.error('Tambah minimal 1 item')
      return
    }
    create.mutate({
      date,
      vendorId: vendorId ?? null,
      note: note.trim() || null,
      items,
    })
  }

  const vendorOptions: ComboboxOption[] = [
    { value: '', label: '- Tidak dicatat -' },
    ...vendors.map((v) => ({ value: String(v.id), label: v.name, helper: v.type })),
  ]

  const rmOptions: ComboboxOption[] = rawMaterials.map((r) => ({
    value: String(r.id),
    label: r.name,
    helper: r.unit,
  }))

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Catat Belanja"
      description="Item dengan tracked=true akan otomatis menambah stok di raw_materials."
      size="xl"
      footer={
        <div className="w-full flex items-center justify-between gap-3">
          <div>
            <p className="text-caption text-neutral-500">Total</p>
            <p className="text-title font-semibold text-neutral-900 tabular-nums">
              {formatCurrency(totalAmount)}
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit}
            disabled={items.length === 0}
            loading={create.isPending}
          >
            Simpan Belanja
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-label text-neutral-700 block mb-1.5">Tanggal</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-10 px-3 bg-white border border-neutral-300 rounded-md text-body focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
            />
          </div>
          <Combobox
            label="Vendor (opsional)"
            value={vendorId !== null ? String(vendorId) : ''}
            onValueChange={(v) => setVendorId(v ? Number(v) : null)}
            options={vendorOptions}
            searchPlaceholder="Cari vendor..."
            emptyText="Vendor tidak ditemukan"
          />
        </div>
        <Input
          label="Catatan (opsional)"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Mis. Belanja pagi pasar pak Budi"
        />

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-label text-neutral-700">Items</label>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={addItem}
            >
              Tambah item
            </Button>
          </div>
          {items.length === 0 ? (
            <EmptyState
              title="Belum ada item"
              description="Klik 'Tambah item' di atas untuk menambah baris."
              compact
            />
          ) : (
            <div className="space-y-2">
              {items.map((it, idx) => {
                const rm = rawMaterials.find((r) => r.id === it.rawMaterialId)
                const subtotal = it.qty * it.unitPrice
                return (
                  <div
                    key={idx}
                    className="bg-neutral-50/80 border border-neutral-200/60 rounded-lg p-2.5 space-y-2"
                  >
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <Combobox
                        label="Bahan"
                        hideLabel
                        value={String(it.rawMaterialId)}
                        onValueChange={(v) => updateItem(idx, { rawMaterialId: Number(v) })}
                        options={rmOptions}
                        placeholder="Pilih bahan..."
                        searchPlaceholder="Cari bahan..."
                        emptyText="Bahan tidak ditemukan"
                        containerClassName="col-span-12 sm:col-span-5"
                      />
                      <Input
                        label={`Qty item ${idx + 1}`}
                        hideLabel
                        type="number"
                        inputMode="decimal"
                        value={it.qty || ''}
                        onChange={(e) => updateItem(idx, { qty: Number(e.target.value) || 0 })}
                        placeholder="qty"
                        min={0}
                        step={0.01}
                        containerClassName="col-span-3 sm:col-span-2"
                        className="text-right tabular-nums"
                      />
                      <Input
                        label={`Harga unit item ${idx + 1}`}
                        hideLabel
                        type="number"
                        inputMode="numeric"
                        value={it.unitPrice || ''}
                        onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) || 0 })}
                        placeholder="harga/unit"
                        min={0}
                        containerClassName="col-span-5 sm:col-span-3"
                        className="text-right tabular-nums"
                      />
                      <div className={cn('col-span-3 sm:col-span-1 text-right text-body-sm font-medium text-neutral-900 tabular-nums')}>
                        {subtotal > 0 ? formatCurrency(subtotal).replace('Rp', '').trim() : '-'}
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <IconButton
                          label="Hapus item"
                          icon={<Trash2 />}
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(idx)}
                          className="text-danger-700 hover:bg-danger-50"
                        />
                      </div>
                    </div>
                    {rm && !rm.isTracked && (
                      <p className="text-caption text-neutral-500 italic">
                        Item ini log-only - stok tidak ditrack di sistem.
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  )
}
