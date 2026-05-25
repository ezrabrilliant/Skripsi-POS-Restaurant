// REV 2.3 Phase 4b MergeBillModal — gabung beberapa open transactions ke 1 parent.
// Constraint: semua dineIn open, shift sama, belum mergedIntoId. Target = parent
// yang menerima payment untuk total agregat.

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { GitMerge, Loader2, Inbox } from 'lucide-react'
import { transactionService, type MergePayload } from '@/services/transactionService'
import type { Transaction } from '@/types'
import { formatCurrency, formatTime, cn } from '@/lib/utils'
import { Dialog, Button, Badge, EmptyState } from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'

interface Props {
  targetTransaction: Transaction
  onClose: () => void
  onSuccess: () => void
}

export default function MergeBillModal({ targetTransaction, onClose, onSuccess }: Props) {
  const toast = useToast()
  const [selectedSources, setSelectedSources] = useState<Set<number>>(new Set())

  const { data: openTxs = [], isLoading } = useQuery({
    queryKey: ['transactions', 'open-shift', targetTransaction.shiftId],
    queryFn: () =>
      transactionService.list({
        status: 'open',
        shiftId: targetTransaction.shiftId,
      }),
  })

  const candidates = openTxs.filter(
    (t) => t.id !== targetTransaction.id && t.mergedIntoId === null
  )

  const merge = useMutation({
    mutationFn: (payload: MergePayload) => transactionService.merge(payload),
    onSuccess: () => {
      toast.success('Merge bill berhasil')
      onSuccess()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const toggleSource = (id: number) => {
    const next = new Set(selectedSources)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedSources(next)
  }

  const handleSubmit = () => {
    if (selectedSources.size === 0) {
      toast.error('Pilih minimal 1 source untuk merge')
      return
    }
    merge.mutate({
      sourceIds: Array.from(selectedSources),
      targetId: targetTransaction.id,
    })
  }

  const aggregateSubtotal =
    targetTransaction.subtotal +
    candidates
      .filter((c) => selectedSources.has(c.id))
      .reduce((s, c) => s + c.subtotal, 0)

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={
        <span className="inline-flex items-center gap-2">
          <GitMerge className="w-5 h-5 text-primary-600" />
          Merge Bill ke #{targetTransaction.id}
        </span>
      }
      description="Pilih transaksi open yang akan digabung. PB1 dihitung saat pembayaran di parent."
      size="lg"
      footer={
        <Button
          variant="primary"
          size="md"
          fullWidth
          onClick={handleSubmit}
          loading={merge.isPending}
          disabled={selectedSources.size === 0}
        >
          {selectedSources.size === 0
            ? 'Pilih minimal 1 transaksi'
            : `Merge ${selectedSources.size} transaksi → #${targetTransaction.id}`}
        </Button>
      }
    >
      <div className="space-y-3">
        {/* Target summary */}
        <div className="bg-primary-50/50 border border-primary-100 rounded-xl p-3">
          <p className="text-label text-neutral-600 mb-1">Target (parent)</p>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-body font-semibold text-neutral-900">
              Transaksi #{targetTransaction.id}
              {targetTransaction.tableNumber !== null && (
                <Badge tone="primary" size="sm" className="ml-2">
                  Meja {targetTransaction.tableNumber}
                </Badge>
              )}
            </p>
            <p className="text-body text-neutral-700 tabular-nums">
              {formatCurrency(targetTransaction.subtotal)}
            </p>
          </div>
        </div>

        {/* Candidates list */}
        <div>
          <p className="text-label text-neutral-700 mb-2">Source transaksi (centang untuk gabung)</p>
          {isLoading ? (
            <div className="text-center py-6 text-neutral-500">
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            </div>
          ) : candidates.length === 0 ? (
            <EmptyState
              icon={<Inbox />}
              title="Tidak ada transaksi lain"
              description="Tidak ada transaksi open di shift yang sama yang bisa digabung."
              compact
            />
          ) : (
            <div className="space-y-2">
              {candidates.map((c) => {
                const checked = selectedSources.has(c.id)
                return (
                  <label
                    key={c.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors min-h-[60px]',
                      'focus-within:ring-2 focus-within:ring-primary-500/40',
                      checked
                        ? 'bg-primary-50 border border-primary-300'
                        : 'bg-neutral-50/80 border border-neutral-200/60 hover:bg-neutral-100'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSource(c.id)}
                      className="w-5 h-5 rounded text-primary-600 border-neutral-300 focus:ring-primary-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-body-sm font-medium text-neutral-900">
                        #{c.id}
                        {c.tableNumber !== null && (
                          <Badge tone="neutral" size="sm" className="ml-2">
                            Meja {c.tableNumber}
                          </Badge>
                        )}
                      </p>
                      <p className="text-caption text-neutral-500">
                        {c.items.length} item · {formatTime(c.createdAt)}
                      </p>
                    </div>
                    <span className="text-body-sm font-medium text-neutral-800 whitespace-nowrap tabular-nums">
                      {formatCurrency(c.subtotal)}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        {selectedSources.size > 0 && (
          <div className="bg-success-50 border border-success-200 rounded-xl p-3">
            <p className="text-label text-neutral-600">Total agregat setelah merge</p>
            <p className="text-display text-success-700 tabular-nums mt-0.5">
              {formatCurrency(aggregateSubtotal)}
            </p>
            <p className="text-caption text-neutral-500 mt-0.5">
              PB1 10% dihitung saat pembayaran di parent #{targetTransaction.id}.
            </p>
          </div>
        )}
      </div>
    </Dialog>
  )
}
