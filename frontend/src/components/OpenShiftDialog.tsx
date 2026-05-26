// REV 2.3 shift-decoupling: standalone dialog buka kasir. Dipakai oleh CashierDashboard
// dan POSPage saat kasir login + belum ada shift aktif system-wide.
// Permission: caller WAJIB pastikan user.role === 'cashier' sebelum render (per matrix
// REV 2.3 - buka shift kasir-only, owner/waiter tidak punya CTA).
//
// REV 2.5 multi-cashier sharing: caller bisa pass `activeShifts` supaya tombol pilih
// tipe yang sudah aktif (oleh kasir manapun) di-render grayed out + tooltip. Default
// type picker auto-skip yang blocked.

import { useState, useMemo, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Sun, Moon } from 'lucide-react'
import { shiftService, type OpenShiftPayload } from '@/services/shiftService'
import type { Shift, ShiftType } from '@/types'
import { cn } from '@/lib/utils'
import { Dialog, Button, Input } from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'

export interface OpenShiftDialogProps {
  onClose: () => void
  onSuccess: () => void
  /** REV 2.5: shift tipe yang sudah aktif (kasir manapun) di-render grayed out + tooltip
   * "Sudah dibuka oleh {nama}". Default type picker auto-pick non-blocked. */
  activeShifts?: Shift[]
}

export default function OpenShiftDialog({ onClose, onSuccess, activeShifts = [] }: OpenShiftDialogProps) {
  const toast = useToast()
  const qc = useQueryClient()

  // REV 2.5: petakan tipe yang sudah aktif ke nama pemilik shift untuk tooltip.
  const blockedTypeReason = useMemo(() => {
    const map: Partial<Record<ShiftType, string>> = {}
    for (const s of activeShifts) {
      if (s.type) map[s.type] = `Sudah dibuka oleh ${s.cashierName ?? 'kasir lain'}`
    }
    return map
  }, [activeShifts])

  const [type, setType] = useState<ShiftType>(() =>
    blockedTypeReason['pagi'] ? 'malam' : 'pagi'
  )
  const [openingCash, setOpeningCash] = useState('')
  const isCurrentTypeBlocked = !!blockedTypeReason[type]

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
          disabled={isCurrentTypeBlocked}
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
              const blockedReason = blockedTypeReason[t]
              const disabled = !!blockedReason
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => !disabled && setType(t)}
                  disabled={disabled}
                  title={blockedReason}
                  aria-pressed={active}
                  aria-disabled={disabled}
                  className={cn(
                    'min-h-[52px] flex flex-col items-center justify-center gap-0.5 px-3 rounded-lg border text-body-sm font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
                    disabled
                      ? 'bg-neutral-100 border-neutral-200 text-neutral-400 cursor-not-allowed opacity-60'
                      : active
                        ? 'bg-primary-50 border-primary-500 text-primary-800 ring-1 ring-primary-500/40'
                        : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    {t === 'pagi' ? 'Pagi' : 'Malam'}
                  </div>
                  {blockedReason && (
                    <span className="text-caption text-neutral-500 truncate max-w-full">
                      {blockedReason}
                    </span>
                  )}
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
