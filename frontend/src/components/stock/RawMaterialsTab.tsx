// RawMaterialsTab — tab kedua di StockPage.
// REV 2.3 permission: view + opname + mark-habis semua role; CRUD master owner-only.

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ClipboardCheck, XCircle, Edit2, Trash2 } from 'lucide-react'
import { rawMaterialsService, type CreateRawMaterialPayload } from '@/services/rawMaterialsService'
import { useAuthStore } from '@/stores/authStore'
import type { RawMaterialView, RawMaterialCategory } from '@/types'
import { RAW_MATERIAL_CATEGORY_LABEL } from '@/types'
import { cn } from '@/lib/utils'
import {
  Button,
  IconButton,
  Badge,
  Skeleton,
  Dialog,
  Input,
  Select,
  DataTable,
  type DataTableColumn,
  type SelectOption,
} from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'
import { useConfirm } from '@/design-system/hooks/useConfirm'

const CATEGORIES: RawMaterialCategory[] = [
  'bumbuDasar',
  'bahanSegar',
  'bahanPokok',
  'bahanKering',
  'lainnya',
]

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'Semua kategori' },
  ...CATEGORIES.map((c) => ({ value: c, label: RAW_MATERIAL_CATEGORY_LABEL[c] })),
]

const CATEGORY_FORM_OPTIONS: SelectOption[] = CATEGORIES.map((c) => ({
  value: c,
  label: RAW_MATERIAL_CATEGORY_LABEL[c],
}))

export default function RawMaterialsTab() {
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuthStore()
  const isOwner = user?.role === 'owner'
  const [filterCategory, setFilterCategory] = useState<RawMaterialCategory | 'all'>('all')
  const [showOpname, setShowOpname] = useState(false)
  const [editingRm, setEditingRm] = useState<RawMaterialView | null>(null)
  const [creatingNew, setCreatingNew] = useState(false)

  const { data: rawMaterials = [], isLoading } = useQuery({
    queryKey: ['rawMaterials', filterCategory],
    queryFn: () =>
      rawMaterialsService.list(filterCategory === 'all' ? {} : { category: filterCategory }),
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
    onSuccess: () => {
      toast.success('Raw material dihapus')
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
    const ok = await confirm({
      title: `Hapus "${rm.name}"?`,
      description: 'Master raw material akan dihapus permanen. Tidak bisa dilakukan kalau masih ada referensi di pembelian.',
      confirmText: 'Ya, Hapus',
      tone: 'danger',
    })
    if (!ok) return
    deleteMutation.mutate(rm.id)
  }

  const reminderCount = useMemo(
    () => rawMaterials.filter((r) => r.isLowStock || r.isNearExpiry).length,
    [rawMaterials]
  )

  const columns: DataTableColumn<RawMaterialView>[] = [
    {
      key: 'name',
      header: 'Nama',
      cell: (rm) => (
        <div>
          <div className="font-medium text-neutral-900">{rm.name}</div>
          <div className="text-caption text-neutral-500">
            {rm.unit} · {rm.isTracked ? 'tracked' : 'log-only'}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Kategori',
      hideMobile: true,
      cell: (rm) => <span className="text-neutral-700">{RAW_MATERIAL_CATEGORY_LABEL[rm.category]}</span>,
    },
    {
      key: 'stock',
      header: 'Stok',
      align: 'right',
      cell: (rm) => (
        <span className={cn('font-semibold tabular-nums', rm.isLowStock ? 'text-warning-700' : 'text-neutral-900')}>
          {rm.stockQty} <span className="text-caption text-neutral-500">{rm.unit}</span>
        </span>
      ),
    },
    {
      key: 'min',
      header: 'Min',
      align: 'right',
      hideMobile: true,
      cell: (rm) => <span className="text-neutral-500 tabular-nums">{rm.minStock ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      hideMobile: true,
      cell: (rm) =>
        rm.suggestedAction ? (
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
            label={`Tandai ${rm.name} habis`}
            icon={<XCircle />}
            variant="ghost"
            size="sm"
            onClick={() => handleMarkHabis(rm)}
            className="text-warning-700 hover:bg-warning-50"
          />
          {isOwner && (
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
        </div>
      ),
    },
  ]

  return (
    <div className="p-3 sm:p-4 space-y-3">
      {/* Toolbar */}
      <div className="bg-white rounded-xl p-3 border border-neutral-200/60 flex flex-wrap gap-2 items-center">
        <Button
          variant="primary"
          size="md"
          leftIcon={<ClipboardCheck className="w-4 h-4" />}
          onClick={() => setShowOpname(true)}
          className="!bg-success-600 hover:!bg-success-700"
        >
          Opname
        </Button>
        {isOwner && (
          <Button
            variant="outline"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setCreatingNew(true)}
          >
            Tambah Bahan
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2 min-w-[180px]">
          <Select
            hideLabel
            label="Filter kategori"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as RawMaterialCategory | 'all')}
            options={CATEGORY_OPTIONS}
            containerClassName="flex-1"
          />
          {reminderCount > 0 && (
            <Badge tone="warning" size="sm">{reminderCount}</Badge>
          )}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <DataTable
          columns={columns}
          data={rawMaterials}
          rowKey={(rm) => rm.id}
          emptyTitle="Belum ada raw material"
          emptyDescription={
            isOwner
              ? 'Klik "Tambah Bahan" untuk membuat master baru.'
              : 'Belum ada master raw material yang terdaftar.'
          }
          mobileCard={(rm) => (
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-neutral-900">{rm.name}</p>
                  <p className="text-caption text-neutral-500">
                    {RAW_MATERIAL_CATEGORY_LABEL[rm.category]} · {rm.isTracked ? 'tracked' : 'log-only'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={cn(
                      'text-body font-semibold tabular-nums',
                      rm.isLowStock ? 'text-warning-700' : 'text-neutral-900'
                    )}
                  >
                    {rm.stockQty} {rm.unit}
                  </p>
                  {rm.minStock !== null && (
                    <p className="text-caption text-neutral-500 tabular-nums">min {rm.minStock}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between pt-1.5 border-t border-neutral-100">
                {rm.suggestedAction ? (
                  <Badge tone="warning" size="sm">{rm.suggestedAction}</Badge>
                ) : (
                  <Badge tone="success" size="sm">OK</Badge>
                )}
                <div className="inline-flex items-center gap-1">
                  <IconButton
                    label="Tandai habis"
                    icon={<XCircle />}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMarkHabis(rm)}
                    className="text-warning-700"
                  />
                  {isOwner && (
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
                </div>
              </div>
            </div>
          )}
        />
      )}

      {showOpname && (
        <RmOpnameModal
          rawMaterials={rawMaterials}
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
    </div>
  )
}

// ============================================================
// Modals
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
      description="Isi qty fisik aktual (boleh desimal, mis. 1.5). Audit log dibuat untuk yang ada selisih."
      size="lg"
      footer={
        <Button variant="primary" size="md" fullWidth onClick={handleSubmit} loading={opname.isPending}>
          Konfirmasi Opname
        </Button>
      }
    >
      <div className="space-y-1.5">
        {rawMaterials.map((rm) => (
          <div
            key={rm.id}
            className="flex items-center gap-3 py-1.5 border-b border-neutral-100 last:border-0"
          >
            <span className="flex-1 truncate text-body-sm text-neutral-800">{rm.name}</span>
            <span className="text-caption text-neutral-500 w-20 text-right tabular-nums">
              sistem {rm.stockQty} {rm.unit}
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={qtyByRm[rm.id] ?? ''}
              onChange={(e) => setQtyByRm((prev) => ({ ...prev, [rm.id]: Number(e.target.value) }))}
              placeholder="—"
              className="w-20 px-2 py-1.5 border border-neutral-300 rounded-md text-right text-body-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
            />
          </div>
        ))}
      </div>
    </Dialog>
  )
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
  const [form, setForm] = useState<CreateRawMaterialPayload>({
    name: existing?.name ?? '',
    unit: existing?.unit ?? '',
    category: existing?.category ?? 'bumbuDasar',
    isTracked: existing?.isTracked ?? false,
    stockQty: existing?.stockQty ?? 0,
    minStock: existing?.minStock ?? null,
    unitPrice: existing?.unitPrice ?? null,
    freshnessDays: existing?.freshnessDays ?? null,
  })

  const mutation = useMutation({
    mutationFn: () =>
      existing
        ? rawMaterialsService.update(existing.id, {
            name: form.name,
            unit: form.unit,
            category: form.category,
            isTracked: form.isTracked,
            minStock: form.minStock,
            unitPrice: form.unitPrice,
            freshnessDays: form.freshnessDays,
          })
        : rawMaterialsService.create(form),
    onSuccess: () => {
      toast.success(existing ? 'Raw material diperbarui' : 'Raw material dibuat')
      onSuccess()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={existing ? `Edit: ${existing.name}` : 'Tambah Raw Material'}
      description={existing ? 'Nama tidak bisa diubah untuk menjaga referensi historis.' : undefined}
      size="md"
      footer={
        <Button
          variant="primary"
          size="md"
          fullWidth
          onClick={() => mutation.mutate()}
          disabled={!form.name || !form.unit}
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
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          disabled={!!existing}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Unit"
            type="text"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            placeholder="kg, ikat, gram"
            required
          />
          <Select
            label="Kategori"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as RawMaterialCategory })}
            options={CATEGORY_FORM_OPTIONS}
          />
        </div>
        <label className="flex items-center gap-2 text-body-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.isTracked}
            onChange={(e) => setForm({ ...form, isTracked: e.target.checked })}
            className="w-4 h-4 rounded text-primary-600 border-neutral-300 focus:ring-primary-500"
          />
          <span className="text-neutral-800">
            Track stok <span className="text-caption text-neutral-500">(update qty saat purchase + reminder)</span>
          </span>
        </label>
        {form.isTracked && (
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
        )}
        <Input
          label="Harga unit terakhir (opsional)"
          type="number"
          value={form.unitPrice ?? ''}
          onChange={(e) =>
            setForm({ ...form, unitPrice: e.target.value ? Number(e.target.value) : null })
          }
        />
      </div>
    </Dialog>
  )
}
