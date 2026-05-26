// PurchasesPage - REV 2.3 owner+kasir; REV 2.5 bifurcate per opnameMode.
//
// List belanja pasar + create dengan vendor picker (optional) + multiple items.
// Auto-effect ke raw_materials di backend (stockQty + unitPrice + lastBuyDate
// untuk tracked items).
//
// REV 2.5 bifurcation:
// - exact mode (kg, liter, pcs): qty + unitPrice wajib, subtotal auto = qty*unitPrice
// - scale_0_5 mode (sachet, sdt, "secukupnya"): subtotal manual + note recommended
//   ("1 karung 50kg"), qty/unitPrice null. Server validate via superRefine.
//
// Quick-add: tombol "Bumbu Dasar (N)" spawn preset rows untuk semua raw materials
// kategori bumbuDasar sekaligus. Kasir tinggal isi qty/harga, hapus yang ngga
// dibeli.

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
import QuickAddBumbuDasar from '@/components/QuickAddBumbuDasar'
import type { OpnameMode, RawMaterialView } from '@/types'

/** REV 2.5: form row state - nullable qty/unitPrice + note + opnameMode
 * bifurcation. Subtotal manual untuk scale items, auto-compute untuk exact. */
interface PurchaseItemFormRow {
  rawMaterialId: number | null
  rawMaterialName: string | null
  unitLabel: string | null
  opnameMode: OpnameMode | null
  isTracked: boolean
  qty: number | ''
  unitPrice: number | ''
  subtotal: number | ''
  note: string
}

function emptyRow(): PurchaseItemFormRow {
  return {
    rawMaterialId: null,
    rawMaterialName: null,
    unitLabel: null,
    opnameMode: null,
    isTracked: false,
    qty: '',
    unitPrice: '',
    subtotal: '',
    note: '',
  }
}

function rowFromRawMaterial(rm: RawMaterialView): PurchaseItemFormRow {
  return {
    rawMaterialId: rm.id,
    rawMaterialName: rm.name,
    unitLabel: rm.unit.label,
    opnameMode: rm.unit.opnameMode,
    isTracked: rm.isTracked,
    qty: '',
    unitPrice: '',
    subtotal: '',
    note: '',
  }
}

function computeRowSubtotal(row: PurchaseItemFormRow): number {
  if (row.opnameMode === 'scale_0_5') {
    return typeof row.subtotal === 'number' ? row.subtotal : 0
  }
  // exact (atau belum dipilih) → qty * unitPrice
  const qty = typeof row.qty === 'number' ? row.qty : 0
  const price = typeof row.unitPrice === 'number' ? row.unitPrice : 0
  return qty * price
}

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
                  {p.items.map((it) => {
                    const isScale = it.rawMaterialOpnameMode === 'scale_0_5'
                    const hasQtyPrice = it.qty !== null && it.unitPrice !== null
                    return (
                      <li
                        key={it.id}
                        className="flex justify-between text-neutral-800 gap-2 tabular-nums"
                      >
                        <span className="min-w-0">
                          <span className="font-medium">{it.rawMaterialName}</span>
                          {hasQtyPrice ? (
                            <span className="text-neutral-500">
                              {' '}· {it.qty} {it.rawMaterialUnit} @ {formatCurrency(it.unitPrice ?? 0)}
                            </span>
                          ) : (
                            <span className="text-neutral-500">
                              {' '}· skala {it.rawMaterialUnit}
                            </span>
                          )}
                          {it.note && (
                            <span className="text-caption text-neutral-500 italic">
                              {' '}({it.note})
                            </span>
                          )}
                          {isScale && (
                            <Badge tone="neutral" variant="outline" size="sm" className="ml-2">
                              skala
                            </Badge>
                          )}
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
                    )
                  })}
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
  const [items, setItems] = useState<PurchaseItemFormRow[]>([])

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

  const addEmptyItem = () => {
    if (rawMaterials.length === 0) {
      toast.error('Tidak ada raw material. Owner harus tambah master raw material dulu.')
      return
    }
    setItems((prev) => [...prev, emptyRow()])
  }

  const updateItem = (idx: number, patch: Partial<PurchaseItemFormRow>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  const handlePickRawMaterial = (idx: number, rawMaterialId: number) => {
    const rm = rawMaterials.find((r) => r.id === rawMaterialId)
    if (!rm) return
    updateItem(idx, {
      rawMaterialId: rm.id,
      rawMaterialName: rm.name,
      unitLabel: rm.unit.label,
      opnameMode: rm.unit.opnameMode,
      isTracked: rm.isTracked,
      // Reset numeric fields kalau opnameMode berubah (tidak bisa cross-mode).
      qty: '',
      unitPrice: '',
      subtotal: '',
    })
  }

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleQuickAddBumbuDasar = (rms: RawMaterialView[]) => {
    const existingIds = new Set(items.map((it) => it.rawMaterialId).filter((id): id is number => id !== null))
    const newRows = rms
      .filter((rm) => !existingIds.has(rm.id))
      .map((rm) => rowFromRawMaterial(rm))
    if (newRows.length === 0) return
    setItems((prev) => [...prev, ...newRows])
  }

  const totalAmount = items.reduce((s, it) => s + computeRowSubtotal(it), 0)

  const handleSubmit = () => {
    if (items.length === 0) {
      toast.error('Tambah minimal 1 item')
      return
    }
    // Validate per row sesuai opnameMode + map ke payload.
    const payloadItems: CreatePurchaseItem[] = []
    for (let i = 0; i < items.length; i++) {
      const it = items[i]!
      if (it.rawMaterialId == null) {
        toast.error(`Item #${i + 1}: pilih bahan dulu`)
        return
      }
      if (it.opnameMode === 'scale_0_5') {
        // Scale: subtotal wajib, qty/unitPrice null, note recommended.
        if (typeof it.subtotal !== 'number' || it.subtotal <= 0) {
          toast.error(`Item #${i + 1} (${it.rawMaterialName}): isi subtotal (skala)`)
          return
        }
        payloadItems.push({
          rawMaterialId: it.rawMaterialId,
          qty: null,
          unitPrice: null,
          subtotal: it.subtotal,
          note: it.note.trim() || null,
        })
      } else {
        // Exact (default): qty + unitPrice wajib, subtotal server compute.
        if (typeof it.qty !== 'number' || it.qty <= 0) {
          toast.error(`Item #${i + 1} (${it.rawMaterialName}): isi qty`)
          return
        }
        if (typeof it.unitPrice !== 'number' || it.unitPrice <= 0) {
          toast.error(`Item #${i + 1} (${it.rawMaterialName}): isi harga unit`)
          return
        }
        payloadItems.push({
          rawMaterialId: it.rawMaterialId,
          qty: it.qty,
          unitPrice: it.unitPrice,
          note: it.note.trim() || null,
        })
      }
    }
    create.mutate({
      date,
      vendorId: vendorId ?? null,
      note: note.trim() || null,
      items: payloadItems,
    })
  }

  const vendorOptions: ComboboxOption[] = [
    { value: '', label: '- Tidak dicatat -' },
    ...vendors.map((v) => ({ value: String(v.id), label: v.name, helper: v.type })),
  ]

  const rmOptions: ComboboxOption[] = rawMaterials.map((r) => ({
    value: String(r.id),
    label: r.name,
    helper: `${r.unit.label} · ${r.unit.opnameMode === 'scale_0_5' ? 'skala' : 'eksak'}`,
  }))

  const usedRmIds = items
    .map((it) => it.rawMaterialId)
    .filter((id): id is number => id !== null)

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Catat Belanja"
      description="Item dengan tracked=true akan otomatis menambah stok di raw_materials. Item satuan skala (sachet, sdt) cukup catat total Rupiah + catatan."
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
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <label className="text-label text-neutral-700">Items</label>
            <div className="flex items-center gap-2">
              <QuickAddBumbuDasar
                onAdd={handleQuickAddBumbuDasar}
                excludeIds={usedRmIds}
              />
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={addEmptyItem}
              >
                Tambah item
              </Button>
            </div>
          </div>
          {items.length === 0 ? (
            <EmptyState
              title="Belum ada item"
              description="Klik 'Tambah item' atau 'Bumbu Dasar' di atas untuk menambah baris."
              compact
            />
          ) : (
            <div className="space-y-2">
              {items.map((it, idx) => {
                const isScale = it.opnameMode === 'scale_0_5'
                const subtotalAuto = computeRowSubtotal(it)
                return (
                  <div
                    key={idx}
                    className="bg-neutral-50/80 border border-neutral-200/60 rounded-lg p-2.5 space-y-2"
                  >
                    {/* Row 1: bahan picker + delete */}
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <Combobox
                        label={`Bahan item ${idx + 1}`}
                        hideLabel
                        value={it.rawMaterialId !== null ? String(it.rawMaterialId) : ''}
                        onValueChange={(v) => v && handlePickRawMaterial(idx, Number(v))}
                        options={rmOptions}
                        placeholder="Pilih bahan..."
                        searchPlaceholder="Cari bahan..."
                        emptyText="Bahan tidak ditemukan"
                        containerClassName="col-span-11"
                      />
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

                    {/* Row 2: bifurcate per opnameMode */}
                    {it.rawMaterialId !== null && (
                      <>
                        {isScale ? (
                          <div className="grid grid-cols-12 gap-2 items-end">
                            <Input
                              label={`Subtotal item ${idx + 1}`}
                              hideLabel
                              type="number"
                              inputMode="numeric"
                              value={it.subtotal === '' ? '' : it.subtotal}
                              onChange={(e) =>
                                updateItem(idx, {
                                  subtotal: e.target.value === '' ? '' : Number(e.target.value),
                                })
                              }
                              placeholder="Total Rp"
                              min={0}
                              containerClassName="col-span-12 sm:col-span-4"
                              className="text-right tabular-nums"
                            />
                            <Input
                              label={`Catatan item ${idx + 1}`}
                              hideLabel
                              type="text"
                              value={it.note}
                              onChange={(e) => updateItem(idx, { note: e.target.value })}
                              placeholder='Mis. "1 karung 50kg" / "5 sachet 250g"'
                              containerClassName="col-span-12 sm:col-span-7"
                            />
                            <div className="col-span-12 sm:col-span-1 text-right text-body-sm font-medium text-neutral-900 tabular-nums">
                              <Badge tone="neutral" variant="outline" size="sm">skala</Badge>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-12 gap-2 items-end">
                            <Input
                              label={`Qty item ${idx + 1}`}
                              hideLabel
                              type="number"
                              inputMode="decimal"
                              value={it.qty === '' ? '' : it.qty}
                              onChange={(e) =>
                                updateItem(idx, {
                                  qty: e.target.value === '' ? '' : Number(e.target.value),
                                })
                              }
                              placeholder={it.unitLabel ? `qty (${it.unitLabel})` : 'qty'}
                              min={0}
                              step={0.01}
                              containerClassName="col-span-4 sm:col-span-3"
                              className="text-right tabular-nums"
                            />
                            <Input
                              label={`Harga unit item ${idx + 1}`}
                              hideLabel
                              type="number"
                              inputMode="numeric"
                              value={it.unitPrice === '' ? '' : it.unitPrice}
                              onChange={(e) =>
                                updateItem(idx, {
                                  unitPrice: e.target.value === '' ? '' : Number(e.target.value),
                                })
                              }
                              placeholder="harga/unit"
                              min={0}
                              containerClassName="col-span-4 sm:col-span-3"
                              className="text-right tabular-nums"
                            />
                            <Input
                              label={`Catatan item ${idx + 1}`}
                              hideLabel
                              type="text"
                              value={it.note}
                              onChange={(e) => updateItem(idx, { note: e.target.value })}
                              placeholder="Catatan (opsional)"
                              containerClassName="col-span-12 sm:col-span-4"
                            />
                            <div
                              className={cn(
                                'col-span-4 sm:col-span-2 text-right text-body-sm font-medium text-neutral-900 tabular-nums',
                              )}
                            >
                              {subtotalAuto > 0
                                ? formatCurrency(subtotalAuto).replace('Rp', '').trim()
                                : '-'}
                            </div>
                          </div>
                        )}

                        {/* Helper labels */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {it.unitLabel && (
                            <span className="text-caption text-neutral-500">
                              Satuan: <strong>{it.unitLabel}</strong>
                            </span>
                          )}
                          {isScale && (
                            <span className="text-caption text-neutral-500 italic">
                              Cukup catat total Rp + note bentuk fisik (mis. "1 karung 50kg").
                            </span>
                          )}
                          {!it.isTracked && (
                            <span className="text-caption text-neutral-500 italic">
                              Item log-only - stok tidak ditrack di sistem.
                            </span>
                          )}
                        </div>
                      </>
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
