// REV 2.3 shift-decoupling: standalone dialog buka kasir. Dipakai oleh CashierDashboard
// dan POSPage saat kasir login + belum ada shift aktif system-wide.
// Permission: caller WAJIB pastikan user.role === 'cashier' sebelum render (per matrix
// REV 2.3 — buka shift kasir-only, owner/waiter tidak punya CTA).

import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Sun, Moon } from 'lucide-react'
import { shiftService, type OpenShiftPayload } from '@/services/shiftService'
import type { ShiftType } from '@/types'
import { cn } from '@/lib/utils'
import { Dialog, Button, Input } from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'

export interface OpenShiftDialogProps {
  onClose: () => void
  onSuccess: () => void
}

export default function OpenShiftDialog({ onClose, onSuccess }: OpenShiftDialogProps) {
  const toast = useToast()
  const qc = useQueryClient()
  const [type, setType] = useState<ShiftType>('pagi')
  const [openingCash, setOpeningCash] = useState('')

  const openMutation = useMutation({
    mutationFn: (payload: OpenShiftPayload) => shiftService.openShift(payload),
    onSuccess: () => {
      toast.success('Shift berhasil dibuka')
      qc.invalidateQueries({ queryKey: ['cashierDashboard'] })
      qc.invalidateQueries({ queryKey: ['shifts', 'active'] })
      onSuccess()
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal membuka shift'),
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const amount = Number(openingCash)
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error('Modal awal tidak valid')
      return
    }
    openMutation.mutate({ type, openingCash: amount })
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Buka Kasir"
      description="Pilih shift dan input modal awal cash."
      size="sm"
      preventOutsideClose={openMutation.isPending}
      footer={
        <Button
          type="submit"
          form="open-shift-form"
          variant="primary"
          size="md"
          fullWidth
          loading={openMutation.isPending}
        >
          Buka Kasir
        </Button>
      }
    >
      <form id="open-shift-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="text-label text-neutral-700 mb-2">Tipe Shift</p>
          <div className="grid grid-cols-2 gap-2">
            {(['pagi', 'malam'] as const).map((t) => {
              const Icon = t === 'pagi' ? Sun : Moon
              const active = type === t
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  aria-pressed={active}
                  className={cn(
                    'min-h-[52px] flex items-center justify-center gap-2 px-3 rounded-lg border text-body-sm font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
                    active
                      ? 'bg-primary-50 border-primary-500 text-primary-800 ring-1 ring-primary-500/40'
                      : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {t === 'pagi' ? 'Pagi' : 'Malam'}
                </button>
              )
            })}
          </div>
        </div>

        <Input
          label="Modal Awal (Rp)"
          type="number"
          inputMode="numeric"
          value={openingCash}
          onChange={(e) => setOpeningCash(e.target.value)}
          min={0}
          step={1000}
          placeholder="500000"
          autoFocus
          required
          helper="Total uang cash di laci sebelum mulai shift."
        />
      </form>
    </Dialog>
  )
}
