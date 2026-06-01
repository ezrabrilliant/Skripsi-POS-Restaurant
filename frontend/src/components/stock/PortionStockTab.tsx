// PortionStockTab - tab pertama di StockPage.
// Display 25 portion stock dengan filter low + actions:
//   - Restock Pagi (batch, qty kelipatan 5)
//   - Barang Masuk (single item, darurat tengah hari)
//   - Opname (batch, input qty fisik)
//   - Mark Habis (quick set 0)

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ClipboardCheck, XCircle, Truck, History, ArrowUpRight } from 'lucide-react'
import { portionService } from '@/services/portionService'
import { PORTION_REASON_LABEL, type PortionStockView, type StockType } from '@/types'
import { MenuTypeFilter, toggleStockType } from './MenuTypeFilter'
import { cn, formatDateTime } from '@/lib/utils'
import { relativeTime, isSameLocalDate } from '@/lib/relativeTime'
import {
  Button,
  IconButton,
  Badge,
  Skeleton,
  Dialog,
  Input,
  DataTable,
  PageContainer,
  type DataTableColumn,
} from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'
import { useConfirm } from '@/design-system/hooks/useConfirm'
import { useStockListControls } from './useStockListControls'
import { StockFilterToolbar } from './StockFilterToolbar'
import { SortableHeader } from './SortableHeader'
import { StockHistorySheet, type HistoryMovement } from './StockHistorySheet'
import { useAuthStore } from '@/stores/authStore'

export default function PortionStockTab() {
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isOwner = user?.role === 'owner'
  const [searchParams, setSearchParams] = useSearchParams()
  const [showRestockMorning, setShowRestockMorning] = useState(false)
  const [showOpname, setShowOpname] = useState(false)
  const [emergencyTarget, setEmergencyTarget] = useState<PortionStockView | null>(null)
  const [historyMenuId, setHistoryMenuId] = useState<number | null>(null)
  // REV 2.11 deep-link: ?focusMenuId=<id> → sorot + scroll baris stok.
  const [focusMenuId, setFocusMenuId] = useState<number | null>(() => {
    const raw = searchParams.get('focusMenuId')
    return raw ? Number(raw) : null
  })
  // REV 2.8.1: filter tipe stok (multi-select). Default tampilkan yang tracked (portion).
  const [types, setTypes] = useState<Set<StockType>>(() => new Set<StockType>(['portion']))

  const { data: stocks = [], isLoading } = useQuery({
    queryKey: ['portionStocks'],
    queryFn: () => portionService.list(),
    // FIX (REV 2.8: filter pindah client-side, key tak lagi pakai filterLow):
    // stok porsi berkurang saat penjualan POS & balik saat void, tapi mutation itu
    // TIDAK invalidate ['portionStocks']. 'always' memaksa refetch tiap tab dibuka
    // supaya stok selalu current.
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

  const typeCounts = useMemo(() => {
    const c: Record<StockType, number> = { portion: 0, linked: 0, nonStock: 0 }
    for (const s of stocks) c[s.stockType]++
    return c
  }, [stocks])

  const typeFiltered = useMemo(() => stocks.filter((s) => types.has(s.stockType)), [stocks, types])

  const toggleType = (t: StockType) => setTypes((prev) => toggleStockType(prev, t))

  // Modal restock/opname hanya untuk menu tracked (punya PortionStock).
  const portionStocks = useMemo(() => stocks.filter((s) => s.stockType === 'portion'), [stocks])

  const controls = useStockListControls<PortionStockView>({
    rows: typeFiltered,
    getName: (s) => s.menuName,
    getCategoryValue: (s) => s.category,
    getCategoryLabel: (s) => s.category,
    getQty: (s) => s.currentQty ?? 0,
    getLastStockedAt: (s) => s.lastStockedAt,
    getStatus: (s) =>
      s.currentQty == null
        ? 'aman'
        : s.currentQty <= 0
          ? 'habis'
          : s.isLow
            ? 'rendah'
            : 'aman',
  })

  // REV 2.11 deep-link: ?action=opname → buka modal Opname sekali, lalu strip param.
  useEffect(() => {
    if (searchParams.get('action') === 'opname') {
      setShowOpname(true)
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev)
          n.delete('action')
          return n
        },
        { replace: true }
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // REV 2.11 deep-link: ?focusMenuId → pastikan baris tampil (reset filter kalau perlu).
  const clearFocusParam = useCallback(() => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        n.delete('focusMenuId')
        return n
      },
      { replace: true }
    )
  }, [setSearchParams])

  useEffect(() => {
    if (focusMenuId == null) return
    if (controls.view.some((s) => s.menuId === focusMenuId)) return
    controls.resetFilters()
    setTypes(new Set<StockType>(['portion', 'linked', 'nonStock']))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMenuId])

  useEffect(() => {
    if (focusMenuId == null) return
    const el = document.getElementById('stock-row-' + focusMenuId)
    if (!el) return
    el.scrollIntoView({ block: 'center' })
    const t = setTimeout(() => {
      setFocusMenuId(null)
      clearFocusParam()
    }, 2000)
    return () => clearTimeout(t)
  }, [focusMenuId, controls.view, clearFocusParam])

  // Riwayat per item (drawer) - pakai endpoint detail yang membawa recentMovements.
  const { data: historyDetail, isLoading: historyLoading } = useQuery({
    queryKey: ['portionStock', historyMenuId],
    queryFn: () => portionService.detail(historyMenuId!),
    enabled: historyMenuId != null,
  })
  const historyMovements: HistoryMovement[] = (historyDetail?.recentMovements ?? []).map((m) => ({
    id: m.id,
    reasonLabel: PORTION_REASON_LABEL[m.reason],
    delta: m.delta,
    qtyBefore: m.qtyBefore,
    qtyAfter: m.qtyAfter,
    note: m.note,
    userName: m.userName,
    createdAt: m.createdAt,
    sourceLabel: m.transactionId != null ? `Transaksi #${m.transactionId}` : null,
  }))

  const columns: DataTableColumn<PortionStockView>[] = [
    {
      key: 'menu',
      header: (
        <SortableHeader
          label="Menu"
          active={controls.sortKey === 'name'}
          dir={controls.sortDir}
          onSort={() => controls.setSort('name')}
        />
      ),
      cell: (s) => (
        <div>
          <div className="font-medium text-neutral-900">{s.menuName}</div>
          <div className="flex items-center gap-1.5">
            <span className="text-caption text-neutral-500">{s.category}</span>
            {s.stockType !== 'portion' && (
              <Badge tone="neutral" size="sm">
                {s.stockType === 'linked' ? 'Ikut menu lain' : 'Tidak di-track'}
              </Badge>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'qty',
      header: (
        <SortableHeader
          label="Qty"
          align="right"
          active={controls.sortKey === 'qty'}
          dir={controls.sortDir}
          onSort={() => controls.setSort('qty')}
        />
      ),
      align: 'right',
      cell: (s) =>
        s.currentQty == null ? (
          <span className="text-neutral-300">-</span>
        ) : (
          <span
            className={cn(
              'font-semibold tabular-nums',
              s.currentQty <= 0
                ? 'text-danger-700'
                : s.isLow
                  ? 'text-warning-700'
                  : 'text-neutral-900'
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
      cell: (s) => (
        <span className="text-neutral-500 tabular-nums">{s.minStock ?? '-'}</span>
      ),
    },
    {
      key: 'lastStocked',
      header: (
        <SortableHeader
          label="Terakhir di-stok"
          align="right"
          active={controls.sortKey === 'lastStocked'}
          dir={controls.sortDir}
          onSort={() => controls.setSort('lastStocked')}
        />
      ),
      align: 'right',
      hideMobile: true,
      cell: (s) =>
        s.stockType !== 'portion' ? (
          <span className="text-neutral-300">-</span>
        ) : s.lastStockedAt ? (
          <div>
            <div className="text-neutral-700">{relativeTime(s.lastStockedAt)}</div>
            <div className="text-caption text-neutral-400">{formatDateTime(s.lastStockedAt)}</div>
          </div>
        ) : (
          <span className="text-neutral-400">belum pernah</span>
        ),
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
          {/* Aksi stok hanya untuk menu tracked (portion). Non-portion tak punya stok/movement. */}
          {s.stockType === 'portion' && (
            <>
              <IconButton
                label={`Barang masuk ${s.menuName}`}
                icon={<Truck />}
                variant="ghost"
                size="sm"
                onClick={() => setEmergencyTarget(s)}
                className="text-success-700 hover:bg-success-50"
              />
              <IconButton
                label={`Riwayat ${s.menuName}`}
                icon={<History />}
                variant="ghost"
                size="sm"
                onClick={() => setHistoryMenuId(s.menuId)}
                className="text-neutral-600 hover:bg-neutral-100"
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
            </>
          )}
          {/* REV 2.11: lompat ke Katalog Menu (owner-only; Menu owner-only route). */}
          {isOwner && (
            <IconButton
              label={`Buka ${s.menuName} di Menu`}
              icon={<ArrowUpRight />}
              variant="ghost"
              size="sm"
              onClick={() => navigate('/menu?focusMenuId=' + s.menuId)}
              className="text-primary-700 hover:bg-primary-50"
            />
          )}
        </div>
      ),
    },
  ]

  return (
    <PageContainer>
      <StockFilterToolbar
        controls={controls}
        searchPlaceholder="Cari menu…"
        extraFilters={<MenuTypeFilter selected={types} counts={typeCounts} onToggle={toggleType} />}
        rightBadge={
          lowCount > 0 ? (
            <Badge tone="warning" size="sm">
              {lowCount} rendah
            </Badge>
          ) : undefined
        }
      >
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
      </StockFilterToolbar>

      {/* List */}
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <DataTable
          columns={columns}
          data={controls.view}
          rowKey={(s) => s.menuId}
          rowId={(s) => 'stock-row-' + s.menuId}
          rowClassName={(s) =>
            s.menuId === focusMenuId ? 'ring-2 ring-primary-400 ring-inset' : undefined
          }
          emptyTitle="Tidak ada item"
          emptyDescription={
            controls.activeFilterCount > 0
              ? 'Tidak ada item cocok dengan filter.'
              : 'Stok porsi belum ada.'
          }
          mobileCard={(s) => {
            const tracked = s.stockType === 'portion'
            return (
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-neutral-900">{s.menuName}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-caption text-neutral-500">{s.category}</span>
                      {!tracked && (
                        <Badge tone="neutral" size="sm">
                          {s.stockType === 'linked' ? 'Ikut menu lain' : 'Tidak di-track'}
                        </Badge>
                      )}
                    </div>
                    {tracked && (
                      <p className="text-caption text-neutral-400">
                        {s.lastStockedAt ? relativeTime(s.lastStockedAt) : 'belum pernah di-stok'}
                        {isSameLocalDate(s.lastStockedAt) && ' · dicek hari ini'}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {tracked ? (
                      <>
                        <p
                          className={cn(
                            'text-title font-semibold tabular-nums',
                            s.currentQty != null && s.currentQty <= 0
                              ? 'text-danger-700'
                              : s.isLow
                                ? 'text-warning-700'
                                : 'text-neutral-900'
                          )}
                        >
                          {s.currentQty}
                        </p>
                        <p className="text-caption text-neutral-500">min {s.minStock}</p>
                      </>
                    ) : (
                      <p className="text-title font-semibold text-neutral-300">-</p>
                    )}
                  </div>
                </div>
                {tracked && (
                  <div className="flex items-center justify-between pt-1.5 border-t border-neutral-100">
                    {s.suggestedRestockMorning > 0 ? (
                      <Badge tone="warning" size="sm">Saran +{s.suggestedRestockMorning}</Badge>
                    ) : (
                      <Badge tone="success" size="sm">Aman</Badge>
                    )}
                    <div className="inline-flex items-center gap-1">
                      <IconButton
                        label={`Riwayat ${s.menuName}`}
                        icon={<History />}
                        variant="ghost"
                        size="sm"
                        onClick={() => setHistoryMenuId(s.menuId)}
                        className="text-neutral-600"
                      />
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
                      {isOwner && (
                        <IconButton
                          label={`Buka ${s.menuName} di Menu`}
                          icon={<ArrowUpRight />}
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate('/menu?focusMenuId=' + s.menuId)}
                          className="text-primary-700"
                        />
                      )}
                    </div>
                  </div>
                )}
                {!tracked && isOwner && (
                  <div className="flex items-center justify-end pt-1.5 border-t border-neutral-100">
                    <IconButton
                      label={`Buka ${s.menuName} di Menu`}
                      icon={<ArrowUpRight />}
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/menu?focusMenuId=' + s.menuId)}
                      className="text-primary-700"
                    />
                  </div>
                )}
              </div>
            )
          }}
        />
      )}

      {showRestockMorning && (
        <RestockMorningModal
          stocks={portionStocks}
          onClose={() => setShowRestockMorning(false)}
          onSuccess={() => {
            setShowRestockMorning(false)
            qc.invalidateQueries({ queryKey: ['portionStocks'] })
          }}
        />
      )}

      {showOpname && (
        <OpnameModal
          stocks={portionStocks}
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

      <StockHistorySheet
        open={historyMenuId != null}
        onOpenChange={(o) => !o && setHistoryMenuId(null)}
        title={historyDetail?.menuName ?? 'Riwayat stok'}
        subtitle={
          historyDetail
            ? `Stok ${historyDetail.currentQty ?? '-'} · min ${historyDetail.minStock ?? '-'}`
            : undefined
        }
        isLoading={historyLoading}
        movements={historyMovements}
        unitSuffix="porsi"
      />
    </PageContainer>
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
  const [qtyFisikByMenu, setQtyFisikByMenu] = useState<Record<number, number | ''>>({})

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
      .filter(([, qty]) => qty !== '' && qty !== undefined && Number(qty) >= 0)
      .map(([menuId, qty]) => ({ menuId: Number(menuId), qtyFisik: Number(qty) }))
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
                setQtyFisikByMenu((prev) => ({
                  ...prev,
                  [s.menuId]: e.target.value === '' ? '' : Number(e.target.value),
                }))
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
