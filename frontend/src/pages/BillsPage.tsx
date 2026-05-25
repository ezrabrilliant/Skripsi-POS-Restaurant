// BillsPage — REV 2.3 owner-only tagihan operasional bulanan.
// 5 BillCategory: kebersihan / listrik / air / parkir / sewa.

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Receipt, Trash2, Edit2 } from 'lucide-react'
import { billService, type CreateBillPayload } from '@/services/billService'
import { BILL_CATEGORY_LABEL } from '@/types'
import type { Bill, BillCategory } from '@/types'
import { formatCurrency } from '@/lib/utils'
import {
  Button,
  IconButton,
  Input,
  Select,
  Skeleton,
  DataTable,
  Dialog,
  type DataTableColumn,
  type SelectOption,
} from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'
import { useConfirm } from '@/design-system/hooks/useConfirm'

const CATEGORIES: BillCategory[] = ['kebersihan', 'listrik', 'air', 'parkir', 'sewa']
const CATEGORY_OPTIONS: SelectOption[] = CATEGORIES.map((c) => ({
  value: c,
  label: BILL_CATEGORY_LABEL[c],
}))

export default function BillsPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const [showCreate, setShowCreate] = useState<{ existing: Bill | null } | null>(null)
  const [monthFilter, setMonthFilter] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  const { data: bills = [], isLoading } = useQuery({
    queryKey: ['bills', monthFilter],
    queryFn: () => billService.list({ month: monthFilter }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => billService.delete(id),
    onSuccess: () => {
      toast.success('Tagihan dihapus')
      qc.invalidateQueries({ queryKey: ['bills'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleDelete = async (b: Bill) => {
    const ok = await confirm({
      title: 'Hapus tagihan?',
      description: `${BILL_CATEGORY_LABEL[b.category]} ${b.month} sebesar ${formatCurrency(b.amount)}.`,
      confirmText: 'Ya, Hapus',
      tone: 'danger',
    })
    if (!ok) return
    deleteMutation.mutate(b.id)
  }

  const totalMonth = bills.reduce((s, b) => s + b.amount, 0)

  const columns: DataTableColumn<Bill>[] = [
    {
      key: 'category',
      header: 'Kategori',
      cell: (b) => (
        <div>
          <div className="font-medium text-neutral-900">{BILL_CATEGORY_LABEL[b.category]}</div>
          {b.note && <div className="text-caption text-neutral-500">{b.note}</div>}
        </div>
      ),
    },
    {
      key: 'note',
      header: 'Catatan',
      hideMobile: true,
      cell: (b) => <span className="text-neutral-700">{b.note ?? '—'}</span>,
    },
    {
      key: 'amount',
      header: 'Jumlah',
      align: 'right',
      cell: (b) => (
        <span className="font-semibold text-neutral-900 tabular-nums">{formatCurrency(b.amount)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (b) => (
        <div className="inline-flex items-center gap-1">
          <IconButton
            label={`Edit ${BILL_CATEGORY_LABEL[b.category]}`}
            icon={<Edit2 />}
            variant="ghost"
            size="sm"
            onClick={() => setShowCreate({ existing: b })}
          />
          <IconButton
            label={`Hapus ${BILL_CATEGORY_LABEL[b.category]}`}
            icon={<Trash2 />}
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(b)}
            className="text-danger-700 hover:bg-danger-50"
          />
        </div>
      ),
    },
  ]

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 space-y-3 pt-safe pb-safe">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-headline font-semibold text-neutral-900">Tagihan Operasional</h1>
            <p className="text-body-sm text-neutral-600">
              {bills.length} tagihan ·{' '}
              <span className="font-medium text-neutral-900 tabular-nums">
                {formatCurrency(totalMonth)}
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
              onClick={() => setShowCreate({ existing: null })}
            >
              Tagihan
            </Button>
          </div>
        </header>

        {isLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <DataTable
            columns={columns}
            data={bills}
            rowKey={(b) => b.id}
            emptyTitle="Belum ada tagihan bulan ini"
            emptyDescription="Klik tombol Tagihan di atas untuk menambah."
            mobileCard={(b) => (
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-neutral-900">
                      <Receipt className="w-3.5 h-3.5 inline -mt-0.5 mr-1 text-neutral-400" />
                      {BILL_CATEGORY_LABEL[b.category]}
                    </p>
                    {b.note && <p className="text-caption text-neutral-500 mt-0.5">{b.note}</p>}
                  </div>
                  <p className="font-semibold text-neutral-900 tabular-nums shrink-0">
                    {formatCurrency(b.amount)}
                  </p>
                </div>
                <div className="flex items-center justify-end gap-1 pt-1.5 border-t border-neutral-100">
                  <IconButton
                    label="Edit"
                    icon={<Edit2 />}
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCreate({ existing: b })}
                  />
                  <IconButton
                    label="Hapus"
                    icon={<Trash2 />}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(b)}
                    className="text-danger-700"
                  />
                </div>
              </div>
            )}
          />
        )}

        {showCreate && (
          <BillFormModal
            existing={showCreate.existing}
            defaultMonth={monthFilter}
            onClose={() => setShowCreate(null)}
            onSuccess={() => {
              setShowCreate(null)
              qc.invalidateQueries({ queryKey: ['bills'] })
            }}
          />
        )}
      </div>
    </div>
  )
}

function BillFormModal({
  existing,
  defaultMonth,
  onClose,
  onSuccess,
}: {
  existing: Bill | null
  defaultMonth: string
  onClose: () => void
  onSuccess: () => void
}) {
  const toast = useToast()
  const [form, setForm] = useState<CreateBillPayload>({
    month: existing?.month ?? defaultMonth,
    category: existing?.category ?? 'listrik',
    amount: existing?.amount ?? 0,
    note: existing?.note ?? '',
  })

  const mutation = useMutation({
    mutationFn: () =>
      existing ? billService.update(existing.id, form) : billService.create(form),
    onSuccess: () => {
      toast.success(existing ? 'Tagihan diperbarui' : 'Tagihan dicatat')
      onSuccess()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={existing ? 'Edit Tagihan' : 'Tambah Tagihan'}
      size="md"
      footer={
        <Button
          variant="primary"
          size="md"
          fullWidth
          onClick={() => mutation.mutate()}
          disabled={form.amount <= 0}
          loading={mutation.isPending}
        >
          Simpan
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-label text-neutral-700 block mb-1.5">Bulan</label>
            <input
              type="month"
              value={form.month}
              onChange={(e) => setForm({ ...form, month: e.target.value })}
              className="w-full h-10 px-3 bg-white border border-neutral-300 rounded-md text-body focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
            />
          </div>
          <Select
            label="Kategori"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as BillCategory })}
            options={CATEGORY_OPTIONS}
          />
        </div>
        <Input
          label="Jumlah (Rp)"
          type="number"
          inputMode="numeric"
          value={form.amount || ''}
          onChange={(e) => setForm({ ...form, amount: Number(e.target.value) || 0 })}
          min={0}
          step={1000}
          required
        />
        <Input
          label="Catatan (opsional)"
          type="text"
          value={form.note ?? ''}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          placeholder="Mis. PLN periode 24 Apr - 24 Mei"
        />
      </div>
    </Dialog>
  )
}
