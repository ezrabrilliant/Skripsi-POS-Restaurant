// RawMaterialsTab - tab kedua di StockPage.
// REV 2.3 permission: view + opname + mark-habis semua role; CRUD master owner-only.
// REV 2.5: unit dari master `units` (UnitDropdown). Opname row UI bifurcation per
// opnameMode unit (exact → input angka; scale_0_5 → segmented 0-5). Edit unit yang
// ganti + stock > 0 → sub-modal "Konversi stok ke satuan baru".
// REV 2.5.1: is_tracked DROPPED — semua master always tracked. Item ad-hoc tanpa
// master (bumbu dasar, ayam mentah) input via free-form line item di Belanja.
// REV 2.5.2: soft-delete via isActive flag. Delete bifurcate: hard kalau no FK
// refs, soft kalau ada refs (audit preserved). Owner UI toggle "Tampilkan
// nonaktif" + visual distinction (badge "Nonaktif" + opacity-50) + tombol
// "Aktifkan" untuk item nonaktif.

import { useState, useMemo, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ClipboardCheck, XCircle, Edit2, Trash2, RotateCcw, History } from 'lucide-react'
import {
  rawMaterialsService,
  type CreateRawMaterialPayload,
  type UpdateRawMaterialPayload,
} from '@/services/rawMaterialsService'
import { useAuthStore } from '@/stores/authStore'
import type { RawMaterialView, RawMaterialCategory, Unit } from '@/types'
import { RAW_MATERIAL_CATEGORY_LABEL, RAW_REASON_LABEL } from '@/types'
import { cn, formatDateTime } from '@/lib/utils'
import { relativeTime, isSameLocalDate } from '@/lib/relativeTime'
import {
  Button,
  IconButton,
  Badge,
  Skeleton,
  Dialog,
  Input,
  Combobox,
  Checkbox,
  DataTable,
  type DataTableColumn,
  type ComboboxOption,
} from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'
import { useConfirm } from '@/design-system/hooks/useConfirm'
import UnitDropdown from '@/components/UnitDropdown'
import { useStockListControls } from './useStockListControls'
import { StockFilterToolbar } from './StockFilterToolbar'
import { SortableHeader } from './SortableHeader'
import { StockHistorySheet, type HistoryMovement } from './StockHistorySheet'

const CATEGORIES: RawMaterialCategory[] = [
  'bumbuDasar',
  'bahanSegar',
  'bahanPokok',
  'bahanKering',
  'lainnya',
]

const CATEGORY_FORM_OPTIONS: ComboboxOption[] = CATEGORIES.map((c) => ({
  value: c,
  label: RAW_MATERIAL_CATEGORY_LABEL[c],
}))

export default function RawMaterialsTab() {
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuthStore()
  // REV 2.8.1: kelola master bahan baku dibuka ke owner + kasir (kasir yang belanja).
  const canManage = user?.role === 'owner' || user?.role === 'cashier'
  // REV 2.5.2: owner toggle untuk lihat item yang sudah di-soft-delete.
  const [includeInactive, setIncludeInactive] = useState(false)
  const [showOpname, setShowOpname] = useState(false)
  const [editingRm, setEditingRm] = useState<RawMaterialView | null>(null)
  const [creatingNew, setCreatingNew] = useState(false)
  const [historyId, setHistoryId] = useState<number | null>(null)

  const { data: rawMaterials = [], isLoading } = useQuery({
    queryKey: ['rawMaterials', includeInactive],
    queryFn: () =>
      rawMaterialsService.list(includeInactive ? { includeInactive: true } : {}),
    // REV 2.8: kategori/status filter pindah client-side; includeInactive tetap
    // server-side (soft-delete). Pembelian mutasi stock_qty di luar key ini →
    // 'always' supaya stok current saat tab dibuka.
    refetchOnMount: 'always',
  })

  const markHabisMutation = useMutation({
    mutationFn: (id: number) => rawMaterialsService.markHabis(id),
    onSuccess: () => {
      toast.success('Raw material ditandai habis')
      qc.invalidateQueries({ queryKey: ['rawMaterials'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => rawMaterialsService.delete(id),
    onSuccess: (deleted) => {
      // REV 2.5.2: backend returns mode 'hard' | 'soft' supaya toast cocok.
      if (deleted.mode === 'hard') {
        toast.success(`"${deleted.name}" dihapus permanen`)
      } else {
        toast.success(
          `"${deleted.name}" dinonaktifkan (history dipertahankan, bisa diaktifkan kembali)`,
        )
      }
      qc.invalidateQueries({ queryKey: ['rawMaterials'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const reactivateMutation = useMutation({
    mutationFn: (id: number) => rawMaterialsService.reactivate(id),
    onSuccess: (rm) => {
      toast.success(`"${rm.name}" diaktifkan kembali`)
      qc.invalidateQueries({ queryKey: ['rawMaterials'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleMarkHabis = async (rm: RawMaterialView) => {
    if (rm.stockQty === 0) {
      toast.info(`${rm.name} sudah 0`)
      return
    }
    const ok = await confirm({
      title: 'Tandai habis?',
      description: `${rm.name} akan di-set qty=0.`,
      confirmText: 'Ya, Tandai Habis',
      tone: 'danger',
    })
    if (!ok) return
    markHabisMutation.mutate(rm.id)
  }

  const handleDelete = async (rm: RawMaterialView) => {
    // REV 2.5.2: backend auto-bifurcate. Kalau ada FK refs (purchase items / audit
    // log), item akan di-soft-delete (set isActive=false) — history tetap. Kalau
    // belum pernah dipakai, hard-delete. UI tidak perlu tahu di muka, toast yang
    // jelasin.
    const ok = await confirm({
      title: `Hapus "${rm.name}"?`,
      description:
        'Kalau belum pernah dipakai akan dihapus permanen. Kalau sudah ada riwayat (pembelian/audit), item akan dinonaktifkan dan bisa diaktifkan kembali kapan saja.',
      confirmText: 'Ya, Hapus',
      tone: 'danger',
    })
    if (!ok) return
    deleteMutation.mutate(rm.id)
  }

  const handleReactivate = async (rm: RawMaterialView) => {
    const ok = await confirm({
      title: `Aktifkan kembali "${rm.name}"?`,
      description: 'Item akan muncul lagi di daftar default dan bisa dipakai untuk pembelian/opname.',
      confirmText: 'Ya, Aktifkan',
    })
    if (!ok) return
    reactivateMutation.mutate(rm.id)
  }

  const reminderCount = useMemo(
    // REV 2.5.2: skip inactive items dari count reminder (mereka tidak relevan).
    () => rawMaterials.filter((r) => r.isActive && (r.isLowStock || r.isNearExpiry)).length,
    [rawMaterials]
  )

  const controls = useStockListControls<RawMaterialView>({
    rows: rawMaterials,
    getName: (rm) => rm.name,
    getCategoryValue: (rm) => rm.category,
    getCategoryLabel: (rm) => RAW_MATERIAL_CATEGORY_LABEL[rm.category],
    getQty: (rm) => rm.stockQty,
    getLastStockedAt: (rm) => rm.lastStockedAt,
    getStatus: (rm) => (rm.stockQty === 0 ? 'habis' : rm.isLowStock ? 'rendah' : 'aman'),
    categoryOptions: CATEGORY_FORM_OPTIONS, // enum tetap (bukan derive dari rows)
  })

  // Riwayat per item (drawer).
  const { data: historyDetail, isLoading: historyLoading } = useQuery({
    queryKey: ['rawMaterial', historyId],
    queryFn: () => rawMaterialsService.detail(historyId!),
    enabled: historyId != null,
  })
  const historyMovements: HistoryMovement[] = (historyDetail?.recentMovements ?? []).map((m) => ({
    id: m.id,
    reasonLabel: RAW_REASON_LABEL[m.reason],
    delta: m.delta,
    qtyBefore: m.qtyBefore,
    qtyAfter: m.qtyAfter,
    note: m.note,
    userName: m.userName,
    createdAt: m.createdAt,
    sourceLabel: m.purchaseId != null ? `Pembelian #${m.purchaseId}` : null,
  }))

  const columns: DataTableColumn<RawMaterialView>[] = [
    {
      key: 'name',
      header: (
        <SortableHeader
          label="Nama"
          active={controls.sortKey === 'name'}
          dir={controls.sortDir}
          onSort={() => controls.setSort('name')}
        />
      ),
      cell: (rm) => (
        <div className={cn(!rm.isActive && 'opacity-60')}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-neutral-900">{rm.name}</span>
            {!rm.isActive && (
              <Badge tone="neutral" size="sm">Nonaktif</Badge>
            )}
          </div>
          <div className="text-caption text-neutral-500">{rm.unit.label}</div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Kategori',
      hideMobile: true,
      cell: (rm) => (
        <span className={cn('text-neutral-700', !rm.isActive && 'opacity-60')}>
          {RAW_MATERIAL_CATEGORY_LABEL[rm.category]}
        </span>
      ),
    },
    {
      key: 'stock',
      header: (
        <SortableHeader
          label="Stok"
          align="right"
          active={controls.sortKey === 'qty'}
          dir={controls.sortDir}
          onSort={() => controls.setSort('qty')}
        />
      ),
      align: 'right',
      cell: (rm) => (
        <span
          className={cn(
            'font-semibold tabular-nums',
            rm.isLowStock && rm.isActive ? 'text-warning-700' : 'text-neutral-900',
            !rm.isActive && 'opacity-60'
          )}
        >
          {rm.stockQty} <span className="text-caption text-neutral-500">{rm.unit.label}</span>
        </span>
      ),
    },
    {
      key: 'min',
      header: 'Min',
      align: 'right',
      hideMobile: true,
      cell: (rm) => (
        <span className={cn('text-neutral-500 tabular-nums', !rm.isActive && 'opacity-60')}>
          {rm.minStock ?? '-'}
        </span>
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
      cell: (rm) =>
        rm.lastStockedAt ? (
          <div className={cn(!rm.isActive && 'opacity-60')}>
            <div className="text-neutral-700">{relativeTime(rm.lastStockedAt)}</div>
            <div className="text-caption text-neutral-400">{formatDateTime(rm.lastStockedAt)}</div>
          </div>
        ) : (
          <span className="text-neutral-400">belum pernah</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      hideMobile: true,
      cell: (rm) =>
        !rm.isActive ? (
          <Badge tone="neutral" size="sm">Nonaktif</Badge>
        ) : rm.suggestedAction ? (
          <Badge tone="warning" size="sm">{rm.suggestedAction}</Badge>
        ) : (
          <Badge tone="success" size="sm">OK</Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (rm) => (
        <div className="inline-flex items-center gap-1">
          <IconButton
            label={`Riwayat ${rm.name}`}
            icon={<History />}
            variant="ghost"
            size="sm"
            onClick={() => setHistoryId(rm.id)}
            className="text-neutral-600 hover:bg-neutral-100"
          />
          {rm.isActive ? (
            <>
              <IconButton
                label={`Tandai ${rm.name} habis`}
                icon={<XCircle />}
                variant="ghost"
                size="sm"
                onClick={() => handleMarkHabis(rm)}
                className="text-warning-700 hover:bg-warning-50"
              />
              {canManage && (
                <>
                  <IconButton
                    label={`Edit ${rm.name}`}
                    icon={<Edit2 />}
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingRm(rm)}
                  />
                  <IconButton
                    label={`Hapus ${rm.name}`}
                    icon={<Trash2 />}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(rm)}
                    className="text-danger-700 hover:bg-danger-50"
                  />
                </>
              )}
            </>
          ) : (
            // REV 2.5.2: item nonaktif — tombol satu-satunya = "Aktifkan kembali" (owner only).
            canManage && (
              <IconButton
                label={`Aktifkan kembali ${rm.name}`}
                icon={<RotateCcw />}
                variant="ghost"
                size="sm"
                onClick={() => handleReactivate(rm)}
                className="text-primary-700 hover:bg-primary-50"
              />
            )
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="p-3 sm:p-4 space-y-3">
      <StockFilterToolbar
        controls={controls}
        searchPlaceholder="Cari bahan…"
        rightBadge={
          reminderCount > 0 ? (
            <Badge tone="warning" size="sm">
              {reminderCount} perlu perhatian
            </Badge>
          ) : undefined
        }
        ownerSlot={
          canManage ? (
            <Checkbox
              label="Tampilkan nonaktif"
              checked={includeInactive}
              onCheckedChange={setIncludeInactive}
            />
          ) : undefined
        }
      >
        <Button
          variant="primary"
          size="md"
          leftIcon={<ClipboardCheck className="w-4 h-4" />}
          onClick={() => setShowOpname(true)}
          className="!bg-success-600 hover:!bg-success-700"
        >
          Opname
        </Button>
        {canManage && (
          <Button
            variant="outline"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setCreatingNew(true)}
          >
            Tambah Bahan
          </Button>
        )}
      </StockFilterToolbar>

      {/* List */}
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <DataTable
          columns={columns}
          data={controls.view}
          rowKey={(rm) => rm.id}
          emptyTitle="Belum ada raw material"
          emptyDescription={
            controls.activeFilterCount > 0
              ? 'Tidak ada bahan cocok dengan filter.'
              : canManage
                ? 'Klik "Tambah Bahan" untuk membuat master baru.'
                : 'Belum ada master raw material yang terdaftar.'
          }
          mobileCard={(rm) => (
            <div className={cn('space-y-1.5', !rm.isActive && 'opacity-60')}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-neutral-900">{rm.name}</p>
                    {!rm.isActive && (
                      <Badge tone="neutral" size="sm">Nonaktif</Badge>
                    )}
                  </div>
                  <p className="text-caption text-neutral-500">
                    {RAW_MATERIAL_CATEGORY_LABEL[rm.category]}
                  </p>
                  <p className="text-caption text-neutral-400">
                    {rm.lastStockedAt ? relativeTime(rm.lastStockedAt) : 'belum pernah di-stok'}
                    {isSameLocalDate(rm.lastStockedAt) && ' · dicek hari ini'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={cn(
                      'text-body font-semibold tabular-nums',
                      rm.isLowStock && rm.isActive ? 'text-warning-700' : 'text-neutral-900'
                    )}
                  >
                    {rm.stockQty} {rm.unit.label}
                  </p>
                  {rm.minStock !== null && (
                    <p className="text-caption text-neutral-500 tabular-nums">min {rm.minStock}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between pt-1.5 border-t border-neutral-100">
                {!rm.isActive ? (
                  <Badge tone="neutral" size="sm">Nonaktif</Badge>
                ) : rm.suggestedAction ? (
                  <Badge tone="warning" size="sm">{rm.suggestedAction}</Badge>
                ) : (
                  <Badge tone="success" size="sm">OK</Badge>
                )}
                <div className="inline-flex items-center gap-1">
                  <IconButton
                    label="Riwayat"
                    icon={<History />}
                    variant="ghost"
                    size="sm"
                    onClick={() => setHistoryId(rm.id)}
                    className="text-neutral-600"
                  />
                  {rm.isActive ? (
                    <>
                      <IconButton
                        label="Tandai habis"
                        icon={<XCircle />}
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkHabis(rm)}
                        className="text-warning-700"
                      />
                      {canManage && (
                        <>
                          <IconButton label="Edit" icon={<Edit2 />} variant="ghost" size="sm" onClick={() => setEditingRm(rm)} />
                          <IconButton
                            label="Hapus"
                            icon={<Trash2 />}
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(rm)}
                            className="text-danger-700"
                          />
                        </>
                      )}
                    </>
                  ) : (
                    canManage && (
                      <IconButton
                        label="Aktifkan kembali"
                        icon={<RotateCcw />}
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReactivate(rm)}
                        className="text-primary-700"
                      />
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        />
      )}

      {showOpname && (
        <RmOpnameModal
          // REV 2.5.2: opname hanya item aktif. Item nonaktif tidak relevan.
          rawMaterials={rawMaterials.filter((r) => r.isActive)}
          onClose={() => setShowOpname(false)}
          onSuccess={() => {
            setShowOpname(false)
            qc.invalidateQueries({ queryKey: ['rawMaterials'] })
          }}
        />
      )}

      {(creatingNew || editingRm) && (
        <RmFormModal
          existing={editingRm}
          onClose={() => {
            setCreatingNew(false)
            setEditingRm(null)
          }}
          onSuccess={() => {
            setCreatingNew(false)
            setEditingRm(null)
            qc.invalidateQueries({ queryKey: ['rawMaterials'] })
          }}
        />
      )}

      <StockHistorySheet
        open={historyId != null}
        onOpenChange={(o) => !o && setHistoryId(null)}
        title={historyDetail?.name ?? 'Riwayat stok'}
        subtitle={
          historyDetail
            ? `Stok ${historyDetail.stockQty} ${historyDetail.unit.label}`
            : undefined
        }
        isLoading={historyLoading}
        movements={historyMovements}
        unitSuffix={historyDetail?.unit.label ?? ''}
      />
    </div>
  )
}

// ============================================================
// Opname Modal — REV 2.5 bifurcation per unit.opnameMode
// ============================================================

function RmOpnameModal({
  rawMaterials,
  onClose,
  onSuccess,
}: {
  rawMaterials: RawMaterialView[]
  onClose: () => void
  onSuccess: () => void
}) {
  const toast = useToast()
  // REV 2.5: scale_0_5 menyimpan integer 0..5; exact menyimpan number desimal.
  const [qtyByRm, setQtyByRm] = useState<Record<number, number>>({})

  const opname = useMutation({
    mutationFn: rawMaterialsService.opname,
    onSuccess: () => {
      toast.success('Opname berhasil')
      onSuccess()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleSubmit = () => {
    const items = Object.entries(qtyByRm)
      .filter(([, qty]) => qty !== undefined && qty >= 0)
      .map(([rawMaterialId, qty]) => ({ rawMaterialId: Number(rawMaterialId), qtyFisik: qty }))
    if (items.length === 0) {
      toast.error('Isi minimal 1 item')
      return
    }
    opname.mutate({ items, note: 'Opname raw materials' })
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Opname Raw Materials"
      description="Isi qty fisik aktual. Item skala 0-5 pilih segmented; item eksak input angka (boleh desimal). Audit log dibuat untuk yang ada selisih."
      size="lg"
      footer={
        <Button variant="primary" size="md" fullWidth onClick={handleSubmit} loading={opname.isPending}>
          Konfirmasi Opname
        </Button>
      }
    >
      <div className="space-y-2">
        {rawMaterials.map((rm) => {
          const isScale = rm.unit.opnameMode === 'scale_0_5'
          return (
            <div
              key={rm.id}
              className="flex items-center gap-3 py-2 border-b border-neutral-100 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <div className="truncate text-body-sm text-neutral-800">{rm.name}</div>
                <div className="text-caption text-neutral-500 tabular-nums">
                  sistem {rm.stockQty} {rm.unit.label}
                </div>
              </div>
              {isScale ? (
                <ScaleSegmented
                  value={qtyByRm[rm.id]}
                  onChange={(v) => setQtyByRm((prev) => ({ ...prev, [rm.id]: v }))}
                  ariaLabel={`Skala 0-5 untuk ${rm.name}`}
                />
              ) : (
                <Input
                  label={`Qty fisik ${rm.name}`}
                  hideLabel
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={qtyByRm[rm.id] ?? ''}
                  onChange={(e) =>
                    setQtyByRm((prev) => ({ ...prev, [rm.id]: Number(e.target.value) }))
                  }
                  placeholder="-"
                  containerClassName="w-24"
                  className="text-right tabular-nums"
                />
              )}
            </div>
          )
        })}
      </div>
    </Dialog>
  )
}

// ScaleSegmented — button group 0..5 (aria-pressed pattern konsisten dengan OpenShiftDialog
// + UnitDropdown opname mode picker).
function ScaleSegmented({
  value,
  onChange,
  ariaLabel,
}: {
  value: number | undefined
  onChange: (v: number) => void
  ariaLabel: string
}) {
  return (
    <div className="inline-flex items-center gap-1" role="group" aria-label={ariaLabel}>
      {[0, 1, 2, 3, 4, 5].map((n) => {
        const active = value === n
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-pressed={active}
            className={cn(
              'w-8 h-8 rounded-md border text-body-sm font-medium tabular-nums transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
              active
                ? 'bg-primary-50 border-primary-500 text-primary-800 ring-1 ring-primary-500/40'
                : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50'
            )}
          >
            {n}
          </button>
        )
      })}
    </div>
  )
}

// ============================================================
// Form Modal — REV 2.5 pakai UnitDropdown + sub-modal konversi stok saat edit unit
// ============================================================

interface RmFormState {
  name: string
  unitId: number | null
  unit: Unit | null
  category: RawMaterialCategory
  stockQty: number
  minStock: number | null
  unitPrice: number | null
  freshnessDays: number | null
}

function RmFormModal({
  existing,
  onClose,
  onSuccess,
}: {
  existing: RawMaterialView | null
  onClose: () => void
  onSuccess: () => void
}) {
  const toast = useToast()

  const [form, setForm] = useState<RmFormState>({
    name: existing?.name ?? '',
    unitId: existing?.unitId ?? null,
    // REV 2.5: existing.unit cuma punya {id,label,opnameMode}; cast ke Unit cukup
    // untuk akses opnameMode (createdAt/updatedAt tidak dipakai di sini).
    unit: existing
      ? ({
          id: existing.unit.id,
          label: existing.unit.label,
          opnameMode: existing.unit.opnameMode,
          createdAt: '',
          updatedAt: '',
        } as Unit)
      : null,
    category: existing?.category ?? 'bumbuDasar',
    stockQty: existing?.stockQty ?? 0,
    minStock: existing?.minStock ?? null,
    unitPrice: existing?.unitPrice ?? null,
    freshnessDays: existing?.freshnessDays ?? null,
  })

  // Sub-modal "Konversi stok": muncul saat edit + unitId ganti + stockQty > 0.
  const [showConvertPrompt, setShowConvertPrompt] = useState(false)
  const [convertNewQty, setConvertNewQty] = useState<string>('')

  const unitChanged = !!existing && form.unitId !== existing.unitId
  const hasStock = !!existing && existing.stockQty > 0

  const mutation = useMutation({
    mutationFn: (newStockQty?: number | null) => {
      if (existing) {
        const payload: UpdateRawMaterialPayload = {
          name: form.name,
          unitId: form.unitId ?? undefined,
          category: form.category,
          minStock: form.minStock,
          unitPrice: form.unitPrice,
          freshnessDays: form.freshnessDays,
        }
        // REV 2.5: hanya kirim newStockQty kalau unit ganti + stock > 0. Backend
        // reject kalau dikirim tanpa unitId atau saat unit sama.
        if (unitChanged && hasStock) {
          payload.newStockQty = newStockQty ?? null
        }
        return rawMaterialsService.update(existing.id, payload)
      }
      // Create — unitId wajib (validated di submit handler).
      const createPayload: CreateRawMaterialPayload = {
        name: form.name,
        unitId: form.unitId as number,
        category: form.category,
        stockQty: form.stockQty,
        minStock: form.minStock,
        unitPrice: form.unitPrice,
        freshnessDays: form.freshnessDays,
      }
      return rawMaterialsService.create(createPayload)
    },
    onSuccess: () => {
      toast.success(existing ? 'Raw material diperbarui' : 'Raw material dibuat')
      setShowConvertPrompt(false)
      onSuccess()
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const handlePrimarySubmit = () => {
    if (!form.name.trim()) {
      toast.error('Nama wajib diisi')
      return
    }
    if (form.unitId == null) {
      toast.error('Satuan wajib dipilih')
      return
    }
    // REV 2.5: edit dengan unit ganti + masih ada stok → tampilkan sub-modal konversi
    // dulu sebelum kirim ke backend. User pilih: input qty baru, atau reset 0.
    if (unitChanged && hasStock && !showConvertPrompt) {
      setShowConvertPrompt(true)
      return
    }
    mutation.mutate(undefined)
  }

  const handleConvertSubmit = (resetToZero: boolean) => {
    if (resetToZero) {
      mutation.mutate(null)
      return
    }
    const num = Number(convertNewQty)
    if (!Number.isFinite(num) || num < 0) {
      toast.error('Stok baru tidak valid')
      return
    }
    mutation.mutate(num)
  }

  return (
    <>
      <Dialog
        open
        onOpenChange={(o) => !o && !mutation.isPending && onClose()}
        title={existing ? `Edit: ${existing.name}` : 'Tambah Raw Material'}
        description={existing ? 'Nama tidak bisa diubah untuk menjaga referensi historis.' : undefined}
        size="md"
        preventOutsideClose={mutation.isPending}
        footer={
          <Button
            type="submit"
            form="rm-form"
            variant="primary"
            size="md"
            fullWidth
            disabled={!form.name || form.unitId == null}
            loading={mutation.isPending && !showConvertPrompt}
          >
            Simpan
          </Button>
        }
      >
        <form
          id="rm-form"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            handlePrimarySubmit()
          }}
          className="space-y-3"
        >
          <Input
            label="Nama"
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            disabled={!!existing}
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <UnitDropdown
              value={form.unitId}
              onChange={(unitId, unit) => setForm({ ...form, unitId, unit })}
              required
              helper={
                existing && unitChanged && hasStock
                  ? 'Ganti satuan akan minta konversi stok saat simpan.'
                  : undefined
              }
            />
            <Combobox
              label="Kategori"
              value={form.category}
              onValueChange={(v) => setForm({ ...form, category: v as RawMaterialCategory })}
              options={CATEGORY_FORM_OPTIONS}
              searchPlaceholder="Cari kategori..."
            />
          </div>
          {/* REV 2.5.1: semua master selalu tracked. Min stock + freshness selalu
              editable. Item ad-hoc tanpa master = free-form line item di Belanja. */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Min Stock"
              type="number"
              value={form.minStock ?? ''}
              onChange={(e) =>
                setForm({ ...form, minStock: e.target.value ? Number(e.target.value) : null })
              }
            />
            <Input
              label="Freshness (hari)"
              type="number"
              value={form.freshnessDays ?? ''}
              onChange={(e) =>
                setForm({ ...form, freshnessDays: e.target.value ? Number(e.target.value) : null })
              }
              placeholder="opsional"
            />
          </div>
          <Input
            label="Harga unit terakhir (opsional)"
            type="number"
            value={form.unitPrice ?? ''}
            onChange={(e) =>
              setForm({ ...form, unitPrice: e.target.value ? Number(e.target.value) : null })
            }
          />
        </form>
      </Dialog>

      {showConvertPrompt && existing && (
        <Dialog
          open
          onOpenChange={(o) => !o && !mutation.isPending && setShowConvertPrompt(false)}
          title="Konversi stok ke satuan baru"
          description="Satuan diubah, stok lama tidak otomatis bisa dikonversi. Pilih stok dalam satuan baru, atau reset ke 0 untuk opname ulang."
          size="sm"
          preventOutsideClose={mutation.isPending}
          footer={
            <>
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => handleConvertSubmit(true)}
                disabled={mutation.isPending}
              >
                Reset ke 0
              </Button>
              <Button
                type="submit"
                form="rm-convert-form"
                variant="primary"
                size="md"
                loading={mutation.isPending}
                disabled={convertNewQty === ''}
              >
                Lanjut
              </Button>
            </>
          }
        >
          <form
            id="rm-convert-form"
            onSubmit={(e: FormEvent) => {
              e.preventDefault()
              handleConvertSubmit(false)
            }}
            className="space-y-3"
          >
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-body-sm space-y-1">
              <div>
                Stok saat ini:{' '}
                <strong className="tabular-nums">
                  {existing.stockQty} {existing.unit.label}
                </strong>
              </div>
              <div>
                Satuan baru: <strong>{form.unit?.label ?? '-'}</strong>
              </div>
            </div>
            <Input
              label={`Stok baru (${form.unit?.label ?? 'satuan baru'})`}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={convertNewQty}
              onChange={(e) => setConvertNewQty(e.target.value)}
              placeholder="contoh: 2.5"
              helper="Kosongkan dan klik 'Reset ke 0' untuk opname ulang."
              autoFocus
            />
          </form>
        </Dialog>
      )}
    </>
  )
}
