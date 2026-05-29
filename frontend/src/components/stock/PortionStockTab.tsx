// PortionStockTab - tab pertama di StockPage.
// Display 25 portion stock dengan filter low + actions:
//   - Restock Pagi (batch, qty kelipatan 5)
//   - Barang Masuk (single item, darurat tengah hari)
//   - Opname (batch, input qty fisik)
//   - Mark Habis (quick set 0)

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ClipboardCheck, XCircle, Truck } from 'lucide-react'
import { portionService } from '@/services/portionService'
import type { PortionStockView } from '@/types'
import { cn } from '@/lib/utils'
import {
  Button,
  IconButton,
  Badge,
  Skeleton,
  Dialog,
  Input,
  Checkbox,
  DataTable,
  type DataTableColumn,
} from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'
import { useConfirm } from '@/design-system/hooks/useConfirm'

export default function PortionStockTab() {
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const [filterLow, setFilterLow] = useState(false)
  const [showRestockMorning, setShowRestockMorning] = useState(false)
  const [showOpname, setShowOpname] = useState(false)
  const [emergencyTarget, setEmergencyTarget] = useState<PortionStockView | null>(null)

  const { data: stocks = [], isLoading } = useQuery({
    queryKey: ['portionStocks', filterLow],
    queryFn: () => portionService.list(filterLow ? { lowStock: true } : {}),
    // FIX: stok porsi berkurang saat penjualan POS (createMutation) & balik saat void,
    // tapi mutation-mutation itu TIDAK invalidate ['portionStocks']. Tanpa 'always',
    // jual di POS → buka tab Stok dalam 5 menit menyajikan stok basi (pra-penjualan).
    // 'always' memaksa refetch tiap tab dibuka sehingga stok selalu current.
    refetchOnMount: 'always',
  })

  const markHabisMutation = useMutation({
    mutationFn: (menuId: number) => portionService.markHabis(menuId),
    onSuccess: () => {
      toast.success('Item ditandai habis')
      qc.invalidateQueries({ queryKey: ['portionStocks'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleMarkHabis = async (s: PortionStockView) => {
    if (s.currentQty === 0) {
      toast.info(`${s.menuName} sudah 0`)
      return
    }
    const ok = await confirm({
      title: 'Tandai habis?',
      description: `${s.menuName} akan di-set qty=0. Audit log akan tercatat.`,
      confirmText: 'Ya, Tandai Habis',
      tone: 'danger',
    })
    if (!ok) return
    markHabisMutation.mutate(s.menuId)
  }

  const lowCount = useMemo(() => stocks.filter((s) => s.isLow).length, [stocks])

  const columns: DataTableColumn<PortionStockView>[] = [
    {
      key: 'menu',
      header: 'Menu',
      cell: (s) => (
        <div>
          <div className="font-medium text-neutral-900">{s.menuName}</div>
          <div className="text-caption text-neutral-500">{s.category}</div>
        </div>
      ),
    },
    {
      key: 'qty',
      header: 'Qty',
      align: 'right',
      cell: (s) => (
        <span
          className={cn(
            'font-semibold tabular-nums',
            s.currentQty <= 0 ? 'text-danger-700' : s.isLow ? 'text-warning-700' : 'text-neutral-900'
          )}
        >
          {s.currentQty}
        </span>
      ),
    },
    {
      key: 'min',
      header: 'Min',
      align: 'right',
      cell: (s) => <span className="text-neutral-500 tabular-nums">{s.minStock}</span>,
    },
    {
      key: 'suggested',
      header: 'Saran',
      align: 'right',
      hideMobile: true,
      cell: (s) =>
        s.suggestedRestockMorning > 0 ? (
          <Badge tone="warning" size="sm">+{s.suggestedRestockMorning}</Badge>
        ) : (
          <span className="text-neutral-400">-</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (s) => (
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
  ]

  return (
    <div className="p-3 sm:p-4 space-y-3">
      {/* Action toolbar */}
      <div className="bg-white rounded-xl p-3 border border-neutral-200/60 flex flex-wrap gap-2 items-center">
        <Button
          variant="primary"
          size="md"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setShowRestockMorning(true)}
        >
          Restock Pagi
        </Button>
        <Button
          variant="outline"
          size="md"
          leftIcon={<ClipboardCheck className="w-4 h-4" />}
          onClick={() => setShowOpname(true)}
        >
          Opname
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Checkbox
            label="Yang rendah saja"
            checked={filterLow}
            onCheckedChange={setFilterLow}
          />
          {lowCount > 0 && <Badge tone="warning" size="sm">{lowCount}</Badge>}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <DataTable
          columns={columns}
          data={stocks}
          rowKey={(s) => s.menuId}
          emptyTitle="Tidak ada item"
          emptyDescription={filterLow ? 'Tidak ada stok yang rendah. Bagus!' : 'Stok porsi belum ada.'}
          mobileCard={(s) => (
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-neutral-900">{s.menuName}</p>
                  <p className="text-caption text-neutral-500">{s.category}</p>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={cn(
                      'text-title font-semibold tabular-nums',
                      s.currentQty <= 0
                        ? 'text-danger-700'
                        : s.isLow
                          ? 'text-warning-700'
                          : 'text-neutral-900'
                    )}
                  >
                    {s.currentQty}
                  </p>
                  <p className="text-caption text-neutral-500">min {s.minStock}</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1.5 border-t border-neutral-100">
                {s.suggestedRestockMorning > 0 ? (
                  <Badge tone="warning" size="sm">Saran +{s.suggestedRestockMorning}</Badge>
                ) : (
                  <Badge tone="success" size="sm">Aman</Badge>
                )}
                <div className="inline-flex items-center gap-1">
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
            </div>
          )}
        />
      )}

      {showRestockMorning && (
        <RestockMorningModal
          stocks={stocks}
          onClose={() => setShowRestockMorning(false)}
          onSuccess={() => {
            setShowRestockMorning(false)
            qc.invalidateQueries({ queryKey: ['portionStocks'] })
          }}
        />
      )}

      {showOpname && (
        <OpnameModal
          stocks={stocks}
          onClose={() => setShowOpname(false)}
          onSuccess={() => {
            setShowOpname(false)
            qc.invalidateQueries({ queryKey: ['portionStocks'] })
          }}
        />
      )}

      {emergencyTarget && (
        <EmergencyInModal
          stock={emergencyTarget}
          onClose={() => setEmergencyTarget(null)}
          onSuccess={() => {
            setEmergencyTarget(null)
            qc.invalidateQueries({ queryKey: ['portionStocks'] })
          }}
        />
      )}
    </div>
  )
}

// ============================================================
// Modals
// ============================================================

function RestockMorningModal({
  stocks,
  onClose,
  onSuccess,
}: {
  stocks: PortionStockView[]
  onClose: () => void
  onSuccess: () => void
}) {
  const toast = useToast()
  const [qtyByMenu, setQtyByMenu] = useState<Record<number, number>>(() => {
    const init: Record<number, number> = {}
    for (const s of stocks) {
      if (s.suggestedRestockMorning > 0) init[s.menuId] = s.suggestedRestockMorning
    }
    return init
  })

  const restock = useMutation({
    mutationFn: portionService.restockMorning,
    onSuccess: () => {
      toast.success('Restock pagi berhasil')
      onSuccess()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleSubmit = () => {
    const items = Object.entries(qtyByMenu)
      .filter(([, qty]) => qty > 0)
      .map(([menuId, qty]) => ({ menuId: Number(menuId), qty }))
    if (items.length === 0) {
      toast.error('Isi minimal 1 item dengan qty > 0')
      return
    }
    for (const it of items) {
      if (it.qty % 5 !== 0) {
        const name = stocks.find((s) => s.menuId === it.menuId)?.menuName ?? `Item #${it.menuId}`
        toast.error(`Qty restock pagi harus kelipatan 5 (${name})`)
        return
      }
    }
    restock.mutate({ items })
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Restock Pagi"
      description="Qty harus kelipatan 5. Pre-fill mengikuti saran sistem untuk item yang rendah."
      size="lg"
      footer={
        <Button
          variant="primary"
          size="md"
          fullWidth
          onClick={handleSubmit}
          loading={restock.isPending}
        >
          Simpan Restock
        </Button>
      }
    >
      <div className="space-y-2">
        {stocks.map((s) => (
          <div
            key={s.menuId}
            className="flex items-center gap-3 py-2 border-b border-neutral-100 last:border-0"
          >
            <span className="flex-1 truncate text-body-sm text-neutral-800">{s.menuName}</span>
            <span className="text-caption text-neutral-500 w-16 text-right tabular-nums">
              {s.currentQty}/{s.minStock}
            </span>
            <Input
              label={`Qty restock ${s.menuName}`}
              hideLabel
              type="number"
              inputMode="numeric"
              min={0}
              step={5}
              value={qtyByMenu[s.menuId] ?? ''}
              onChange={(e) =>
                setQtyByMenu((prev) => ({ ...prev, [s.menuId]: Number(e.target.value) || 0 }))
              }
              placeholder="0"
              containerClassName="w-24"
              className="text-right tabular-nums"
            />
          </div>
        ))}
      </div>
    </Dialog>
  )
}

function OpnameModal({
  stocks,
  onClose,
  onSuccess,
}: {
  stocks: PortionStockView[]
  onClose: () => void
  onSuccess: () => void
}) {
  const toast = useToast()
  const [qtyFisikByMenu, setQtyFisikByMenu] = useState<Record<number, number>>({})

  const opname = useMutation({
    mutationFn: portionService.opname,
    onSuccess: () => {
      toast.success('Opname berhasil')
      onSuccess()
    },
    onError: (err: Error) => toast.error(err.message),
  })

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

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Opname Stok Porsi"
      description="Isi qty fisik aktual untuk item yang dicek. Sistem akan hitung selisih + audit log."
      size="lg"
      footer={
        <Button
          variant="primary"
          size="md"
          fullWidth
          onClick={handleSubmit}
          loading={opname.isPending}
        >
          Konfirmasi Opname
        </Button>
      }
    >
      <div className="space-y-2">
        {stocks.map((s) => (
          <div
            key={s.menuId}
            className="flex items-center gap-3 py-2 border-b border-neutral-100 last:border-0"
          >
            <span className="flex-1 truncate text-body-sm text-neutral-800">{s.menuName}</span>
            <span className="text-caption text-neutral-500 w-16 text-right tabular-nums">
              sistem {s.currentQty}
            </span>
            <Input
              label={`Qty fisik ${s.menuName}`}
              hideLabel
              type="number"
              inputMode="numeric"
              min={0}
              value={qtyFisikByMenu[s.menuId] ?? ''}
              onChange={(e) =>
                setQtyFisikByMenu((prev) => ({ ...prev, [s.menuId]: Number(e.target.value) }))
              }
              placeholder="-"
              containerClassName="w-24"
              className="text-right tabular-nums"
            />
          </div>
        ))}
      </div>
    </Dialog>
  )
}

function EmergencyInModal({
  stock,
  onClose,
  onSuccess,
}: {
  stock: PortionStockView
  onClose: () => void
  onSuccess: () => void
}) {
  const toast = useToast()
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')

  const emergencyIn = useMutation({
    mutationFn: portionService.emergencyIn,
    onSuccess: () => {
      toast.success(`Barang masuk ${stock.menuName}`)
      onSuccess()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleSubmit = () => {
    const n = Number(qty)
    if (!Number.isInteger(n) || n < 1) {
      toast.error('Qty harus integer ≥ 1')
      return
    }
    emergencyIn.mutate({ menuId: stock.menuId, qty: n, note: note || undefined })
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Barang Masuk: ${stock.menuName}`}
      description="Restock darurat tengah hari. Qty bebas (tidak wajib kelipatan 5)."
      size="sm"
      footer={
        <Button
          variant="primary"
          size="md"
          fullWidth
          onClick={handleSubmit}
          loading={emergencyIn.isPending}
        >
          Simpan
        </Button>
      }
    >
      <div className="space-y-3">
        <Input
          label="Qty datang"
          type="number"
          inputMode="numeric"
          min={1}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="5"
          autoFocus
          required
        />
        <Input
          label="Catatan (opsional)"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Mis. Antar via Gojek 18:30"
        />
      </div>
    </Dialog>
  )
}
