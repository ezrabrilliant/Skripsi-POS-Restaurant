// PaymentMethodsTab - REV 2.6 owner-only list metode pembayaran.
// Pakai DataTable primitive (konsisten dengan MenuPage/RawMaterialsTab):
//   - Desktop: tabel kolom Icon | Label | Code | Aturan | Bank | Status | Aksi
//   - Mobile: card stack
// Aksi: toggle isActive inline + tombol Edit (open PaymentMethodFormModal) +
// tombol "+ Tambah Metode" header.
// Permission: owner-only (page sudah di-gate). Method `code` immutable setelah
// create (display read-only) — diatur di modal.

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2 } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import type { PaymentMethodView, BankView } from '@/types'
import { paymentMethodService } from '@/services/paymentMethodService'
import {
  Button,
  IconButton,
  Badge,
  Skeleton,
  DataTable,
  type DataTableColumn,
} from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'
import { PaymentMethodFormModal } from '@/components/PaymentMethodFormModal'
import { cn } from '@/lib/utils'

interface Props {
  methods: PaymentMethodView[]
  banks: BankView[]
  loading: boolean
}

/** Resolve nama icon lucide ke komponen React. Fallback CreditCard kalau
 * iconName tidak terdaftar (defensive — backend whitelist tapi data lama
 * mungkin saja punya nilai berbeda). */
function resolveIcon(iconName: string) {
  const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[iconName]
  return Icon ?? LucideIcons.CreditCard
}

export default function PaymentMethodsTab({ methods, banks, loading }: Props) {
  const qc = useQueryClient()
  const toast = useToast()
  const [editing, setEditing] = useState<PaymentMethodView | null>(null)
  const [creatingNew, setCreatingNew] = useState(false)

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      paymentMethodService.toggleActive(id, isActive),
    onSuccess: (m) => {
      toast.success(`${m.label} ${m.isActive ? 'diaktifkan' : 'dinonaktifkan'}`)
      qc.invalidateQueries({ queryKey: ['paymentMethods'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const columns: DataTableColumn<PaymentMethodView>[] = [
    {
      key: 'label',
      header: 'Metode',
      cell: (m) => {
        const Icon = resolveIcon(m.iconName)
        return (
          <div className={cn('flex items-center gap-2.5', !m.isActive && 'opacity-60')}>
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: m.colorHex }}
            >
              <Icon size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <div className="font-medium text-neutral-900">{m.label}</div>
              <div className="text-caption text-neutral-500 font-mono">{m.code}</div>
            </div>
          </div>
        )
      },
    },
    {
      key: 'rules',
      header: 'Aturan',
      hideMobile: true,
      cell: (m) => (
        <div className="flex flex-wrap gap-1">
          {m.allowDineIn && <Badge tone="primary" size="sm" variant="outline">Dine-in</Badge>}
          {m.allowTakeaway && <Badge tone="primary" size="sm" variant="outline">Takeaway</Badge>}
          {m.requiresBank && <Badge tone="warning" size="sm" variant="outline">Wajib bank</Badge>}
        </div>
      ),
    },
    {
      key: 'banks',
      header: 'Bank',
      hideMobile: true,
      cell: (m) =>
        m.banks.length === 0 ? (
          <span className="text-caption text-neutral-400">-</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {m.banks.map((b) => (
              <Badge key={b.id} tone="neutral" size="sm">
                {b.name}
              </Badge>
            ))}
          </div>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      cell: (m) => (
        <button
          type="button"
          onClick={() => toggleMutation.mutate({ id: m.id, isActive: !m.isActive })}
          disabled={toggleMutation.isPending}
          aria-pressed={m.isActive}
          aria-label={`${m.isActive ? 'Nonaktifkan' : 'Aktifkan'} ${m.label}`}
          className={cn(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
            m.isActive ? 'bg-success-600' : 'bg-neutral-300',
            toggleMutation.isPending && 'opacity-60 cursor-wait',
          )}
        >
          <span
            className={cn(
              'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
              m.isActive ? 'translate-x-5' : 'translate-x-1',
            )}
          />
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (m) => (
        <IconButton
          label={`Edit ${m.label}`}
          icon={<Edit2 />}
          variant="ghost"
          size="sm"
          onClick={() => setEditing(m)}
        />
      ),
    },
  ]

  return (
    <div className="p-3 sm:p-4 space-y-3">
      {/* Toolbar */}
      <div className="bg-white rounded-xl p-3 border border-neutral-200/60 flex flex-wrap gap-2 items-center">
        <div className="text-body-sm text-neutral-700">
          <span className="font-medium text-neutral-900 tabular-nums">{methods.length}</span> metode terdaftar
        </div>
        <Button
          variant="primary"
          size="md"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setCreatingNew(true)}
          className="ml-auto"
        >
          Tambah Metode
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-64" />
      ) : (
        <DataTable
          columns={columns}
          data={methods}
          rowKey={(m) => m.id}
          emptyTitle="Belum ada metode pembayaran"
          emptyDescription='Klik "Tambah Metode" untuk membuat metode pembayaran baru.'
          mobileCard={(m) => {
            const Icon = resolveIcon(m.iconName)
            return (
              <div className={cn('space-y-1.5', !m.isActive && 'opacity-60')}>
                <div className="flex items-start gap-2.5">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: m.colorHex }}
                  >
                    <Icon size={20} className="text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-neutral-900">{m.label}</p>
                    <p className="text-caption text-neutral-500 font-mono">{m.code}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {m.allowDineIn && <Badge tone="primary" size="sm" variant="outline">Dine-in</Badge>}
                      {m.allowTakeaway && <Badge tone="primary" size="sm" variant="outline">Takeaway</Badge>}
                      {m.requiresBank && <Badge tone="warning" size="sm" variant="outline">Wajib bank</Badge>}
                    </div>
                    {m.banks.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {m.banks.map((b) => (
                          <Badge key={b.id} tone="neutral" size="sm">
                            {b.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => toggleMutation.mutate({ id: m.id, isActive: !m.isActive })}
                    disabled={toggleMutation.isPending}
                    aria-pressed={m.isActive}
                    className={cn(
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                      m.isActive ? 'bg-success-600' : 'bg-neutral-300',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
                        m.isActive ? 'translate-x-5' : 'translate-x-1',
                      )}
                    />
                  </button>
                  <IconButton
                    label="Edit"
                    icon={<Edit2 />}
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(m)}
                  />
                </div>
              </div>
            )
          }}
        />
      )}

      {(creatingNew || editing) && (
        <PaymentMethodFormModal
          existing={editing}
          allBanks={banks}
          onClose={() => {
            setCreatingNew(false)
            setEditing(null)
          }}
          onSuccess={() => {
            setCreatingNew(false)
            setEditing(null)
            qc.invalidateQueries({ queryKey: ['paymentMethods'] })
          }}
        />
      )}
    </div>
  )
}
