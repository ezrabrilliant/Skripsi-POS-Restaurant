// BanksTab - REV 2.6 owner-only list bank master.
// Pakai DataTable primitive (konsisten dengan PaymentMethodsTab):
//   - Nama | Dipakai di N metode | Status | Aksi
// Aksi: toggle isActive inline + tombol Edit (open BankFormModal) + tombol
// "+ Tambah Bank" header.
// Soft delete only via toggle isActive (per Decision #9 spec) - bank yang
// pernah dipakai untuk transaksi tetap accessible untuk audit historis.

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Building2 } from 'lucide-react'
import type { BankView } from '@/types'
import { bankService } from '@/services/bankService'
import {
  Button,
  IconButton,
  Badge,
  Skeleton,
  DataTable,
  PageContainer,
  type DataTableColumn,
} from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'
import { BankFormModal } from '@/components/BankFormModal'
import { cn } from '@/lib/utils'

interface Props {
  banks: BankView[]
  loading: boolean
}

export default function BanksTab({ banks, loading }: Props) {
  const qc = useQueryClient()
  const toast = useToast()
  const [editing, setEditing] = useState<BankView | null>(null)
  const [creatingNew, setCreatingNew] = useState(false)

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      bankService.update(id, { isActive }),
    onSuccess: (b) => {
      toast.success(`${b.name} ${b.isActive ? 'diaktifkan' : 'dinonaktifkan'}`)
      qc.invalidateQueries({ queryKey: ['banks'] })
      qc.invalidateQueries({ queryKey: ['paymentMethods'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const columns: DataTableColumn<BankView>[] = [
    {
      key: 'name',
      header: 'Bank',
      cell: (b) => (
        <div className={cn('flex items-center gap-2.5', !b.isActive && 'opacity-60')}>
          <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
            <Building2 size={18} className="text-neutral-600" />
          </div>
          <div className="font-medium text-neutral-900">{b.name}</div>
        </div>
      ),
    },
    {
      key: 'usage',
      header: 'Dipakai',
      align: 'right',
      hideMobile: true,
      cell: (b) => (
        <span className={cn('text-body-sm tabular-nums', !b.isActive && 'opacity-60')}>
          {b.methodCount === 0 ? (
            <span className="text-neutral-400">-</span>
          ) : (
            <>
              <span className="font-medium text-neutral-900">{b.methodCount}</span>{' '}
              <span className="text-neutral-500">metode</span>
            </>
          )}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      cell: (b) => (
        <button
          type="button"
          onClick={() => toggleMutation.mutate({ id: b.id, isActive: !b.isActive })}
          disabled={toggleMutation.isPending}
          aria-pressed={b.isActive}
          aria-label={`${b.isActive ? 'Nonaktifkan' : 'Aktifkan'} ${b.name}`}
          className={cn(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
            b.isActive ? 'bg-success-600' : 'bg-neutral-300',
            toggleMutation.isPending && 'opacity-60 cursor-wait',
          )}
        >
          <span
            className={cn(
              'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
              b.isActive ? 'translate-x-5' : 'translate-x-1',
            )}
          />
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (b) => (
        <IconButton
          label={`Edit ${b.name}`}
          icon={<Edit2 />}
          variant="ghost"
          size="sm"
          onClick={() => setEditing(b)}
        />
      ),
    },
  ]

  return (
    <PageContainer>
      {/* Toolbar */}
      <div className="bg-white rounded-xl p-3 border border-neutral-200/60 flex flex-wrap gap-2 items-center">
        <div className="text-body-sm text-neutral-700">
          <span className="font-medium text-neutral-900 tabular-nums">{banks.length}</span> bank terdaftar
        </div>
        <Button
          variant="primary"
          size="md"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setCreatingNew(true)}
          className="ml-auto"
        >
          Tambah Bank
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-64" />
      ) : (
        <DataTable
          columns={columns}
          data={banks}
          rowKey={(b) => b.id}
          emptyTitle="Belum ada bank"
          emptyDescription='Klik "Tambah Bank" untuk membuat bank baru. Bank dipakai di metode pembayaran EDC / transfer.'
          mobileCard={(b) => (
            <div className={cn('space-y-1.5', !b.isActive && 'opacity-60')}>
              <div className="flex items-start gap-2.5">
                <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                  <Building2 size={20} className="text-neutral-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-neutral-900">{b.name}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {b.methodCount > 0 ? (
                      <Badge tone="neutral" size="sm">
                        Dipakai di {b.methodCount} metode
                      </Badge>
                    ) : (
                      <Badge tone="neutral" size="sm" variant="outline">
                        Belum dipakai
                      </Badge>
                    )}
                    {!b.isActive && (
                      <Badge tone="neutral" size="sm">Nonaktif</Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => toggleMutation.mutate({ id: b.id, isActive: !b.isActive })}
                  disabled={toggleMutation.isPending}
                  aria-pressed={b.isActive}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    b.isActive ? 'bg-success-600' : 'bg-neutral-300',
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
                      b.isActive ? 'translate-x-5' : 'translate-x-1',
                    )}
                  />
                </button>
                <IconButton
                  label="Edit"
                  icon={<Edit2 />}
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(b)}
                />
              </div>
            </div>
          )}
        />
      )}

      {(creatingNew || editing) && (
        <BankFormModal
          existing={editing}
          onClose={() => {
            setCreatingNew(false)
            setEditing(null)
          }}
          onSuccess={() => {
            setCreatingNew(false)
            setEditing(null)
            qc.invalidateQueries({ queryKey: ['banks'] })
          }}
        />
      )}
    </PageContainer>
  )
}
