// REV 2.3 Phase 4b SplitBillModal — assign partyId per item.
// MVP: visual grouping untuk struk PDF. Payment tetap single per transaksi.

import { useState, useMemo } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { transactionService, type SplitPayload } from '@/services/transactionService'
import type { Transaction } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { Dialog, Button, Select } from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'

interface Props {
  transaction: Transaction
  onClose: () => void
  onSuccess: () => void
}

const PARTY_OPTIONS = [
  { value: '', label: 'Main' },
  { value: '1', label: 'Party 1' },
  { value: '2', label: 'Party 2' },
  { value: '3', label: 'Party 3' },
  { value: '4', label: 'Party 4' },
  { value: '5', label: 'Party 5' },
]

export default function SplitBillModal({ transaction, onClose, onSuccess }: Props) {
  const toast = useToast()
  const [assignments, setAssignments] = useState<Record<number, number | null>>(() => {
    const init: Record<number, number | null> = {}
    for (const it of transaction.items) {
      init[it.id] = it.partyId
    }
    return init
  })

  const split = useMutation({
    mutationFn: (payload: SplitPayload) => transactionService.split(transaction.id, payload),
    onSuccess: () => {
      toast.success('Split bill berhasil')
      onSuccess()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const setParty = (itemId: number, partyId: number | null) => {
    setAssignments({ ...assignments, [itemId]: partyId })
  }

  const handleSubmit = () => {
    split.mutate({
      assignments: Object.entries(assignments).map(([itemId, partyId]) => ({
        itemId: Number(itemId),
        partyId,
      })),
    })
  }

  const partyTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const it of transaction.items) {
      const pid = assignments[it.id]
      const key = pid === null || pid === undefined ? 'Main' : `Party ${pid}`
      totals[key] = (totals[key] ?? 0) + it.subtotal
    }
    return totals
  }, [assignments, transaction.items])

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={
        <span className="inline-flex items-center gap-2">
          <Users className="w-5 h-5 text-primary-600" />
          Split Bill #{transaction.id}
        </span>
      }
      description="Assign tiap item ke party untuk pemisahan struk. Items dengan party sama akan tampil di satu struk terpisah."
      size="lg"
      footer={
        <Button
          variant="primary"
          size="md"
          fullWidth
          onClick={handleSubmit}
          loading={split.isPending}
        >
          Simpan Split
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          {transaction.items.map((it) => (
            <div
              key={it.id}
              className="bg-neutral-50/80 border border-neutral-200/60 rounded-lg p-3 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-body-sm font-medium text-neutral-900 truncate">
                  {it.menuName} × {it.qty}
                </p>
                <p className="text-caption text-neutral-500 tabular-nums">
                  {formatCurrency(it.subtotal)}
                </p>
              </div>
              <Select
                hideLabel
                label="Party"
                value={assignments[it.id] === null || assignments[it.id] === undefined ? '' : String(assignments[it.id])}
                onChange={(e) => setParty(it.id, e.target.value === '' ? null : Number(e.target.value))}
                options={PARTY_OPTIONS}
                containerClassName="min-w-[120px]"
              />
            </div>
          ))}
        </div>

        <div className="bg-primary-50/50 border border-primary-100 rounded-xl p-3 space-y-1 tabular-nums">
          <p className="text-label text-neutral-600 mb-1.5">Preview Total per Party</p>
          {Object.entries(partyTotals)
            .filter(([, total]) => total > 0)
            .map(([key, total]) => (
              <div key={key} className="flex justify-between text-body-sm">
                <span className="text-neutral-700">{key}</span>
                <span className="font-medium text-neutral-900">{formatCurrency(total)}</span>
              </div>
            ))}
        </div>

        <p className="text-caption text-neutral-500 italic">
          Catatan MVP: split saat ini hanya visual grouping. Payment tetap satu kali per transaksi.
        </p>
      </div>
    </Dialog>
  )
}
