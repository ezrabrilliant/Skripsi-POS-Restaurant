// REV 2.3 shift-decoupling: standalone dialog buka kasir. Dipakai oleh CashierDashboard
// dan POSPage saat kasir login + belum ada shift aktif system-wide.
// Permission: caller WAJIB pastikan user.role === 'cashier' sebelum render (per matrix
// REV 2.3 - buka shift kasir-only, owner/waiter tidak punya CTA).
//
// REV 2.x window-aware: tipe shift yang boleh dibuka diatur oleh jendela jam owner
// (advisory di client via canOpenClient; backend tetap authority). Fail-closed kalau
// settings belum termuat. Saat sudah ada shift terbuka (kasir manapun), dialog jadi
// alur SERAH-TERIMA: tutup shift berjalan (mode handover) lalu buka shift baru.

import { useState, useEffect, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Sun, Moon } from 'lucide-react'
import { shiftService, type OpenShiftPayload } from '@/services/shiftService'
import { settingsService } from '@/services/settingsService'
import { canOpenClient } from '@/lib/shiftWindow'
import type { Shift, ShiftType } from '@/types'
import { cn } from '@/lib/utils'
import { Dialog, Button, Input } from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'

export interface OpenShiftDialogProps {
  onClose: () => void
  onSuccess: () => void
  /** Shift aktif (kasir manapun) system-wide. Saat ada isinya, dialog jadi alur
   * serah-terima: tutup shift berjalan dulu lalu buka shift baru. */
  activeShifts?: Shift[]
}

export default function OpenShiftDialog({ onClose, onSuccess, activeShifts = [] }: OpenShiftDialogProps) {
  const toast = useToast()
  const qc = useQueryClient()

  // Settings (jendela jam shift) + shift hari ini untuk cek pagiOpenedToday.
  const settingsQ = useQuery({ queryKey: ['settings'], queryFn: settingsService.get, refetchOnMount: 'always' })
  const today = new Date().toISOString().slice(0, 10)
  const todayShiftsQ = useQuery({
    queryKey: ['shifts', 'byDate', today],
    queryFn: () => shiftService.listShifts({ date: today }),
  })

  const settings = settingsQ.data
  const hasOpenShift = activeShifts.length > 0
  const pagiOpenedToday = (todayShiftsQ.data ?? []).some((s) => s.type === 'pagi')

  // Carry-over: sudah ada ≥1 shift hari ini → laci dilanjutkan, kasir tidak isi modal
  // baru (cegah double-count). Modal hari ini = Σ openingCash shift hari ini.
  const todayShifts = todayShiftsQ.data ?? []
  const isCarryOver = todayShifts.length > 0
  const runningModal = todayShifts.reduce((sum, s) => sum + s.openingCash, 0)

  // Advisory openable; fail-closed (false) ketika settings belum termuat.
  const openable = (t: ShiftType) =>
    settings ? canOpenClient({ type: t, settings, hasOpenShift, pagiOpenedToday }) : false
  // Untuk alur serah-terima shift berjalan akan ditutup dulu → evaluasi hasOpenShift:false.
  const openableForHandover = (t: ShiftType) =>
    settings ? canOpenClient({ type: t, settings, hasOpenShift: false, pagiOpenedToday }) : false

  const pagiOk = openable('pagi')
  const malamOk = openable('malam')
  const anyOpenable = pagiOk || malamOk

  // Pemilih tipe untuk dipakai UI: alur normal pakai openable, alur handover pakai openableForHandover.
  const typeSelectable = (t: ShiftType) => (hasOpenShift ? openableForHandover(t) : openable(t))

  const [type, setType] = useState<ShiftType>('pagi')
  const [openingCash, setOpeningCash] = useState('')

  // Auto-select tipe yang valid sesuai jendela jam (+ apakah ini alur handover).
  useEffect(() => {
    if (!settings) return
    if (typeSelectable('pagi')) setType('pagi')
    else if (typeSelectable('malam')) setType('malam')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, hasOpenShift, pagiOpenedToday])

  const amount = Number(openingCash)
  const openingCashValid = isCarryOver || (openingCash !== '' && Number.isFinite(amount) && amount >= 0)

  const openMutation = useMutation({
    mutationFn: (payload: OpenShiftPayload) => shiftService.openShift(payload),
    onSuccess: () => {
      toast.success('Shift berhasil dibuka')
      qc.invalidateQueries({ queryKey: ['shifts', 'active'] })
      qc.invalidateQueries({ queryKey: ['cashierDashboard'] })
      onSuccess()
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal membuka shift'),
  })

  const handoverMutation = useMutation({
    mutationFn: async (payload: { type: ShiftType; openingCash: number }) => {
      const open = activeShifts[0]
      if (open) await shiftService.closeShift(open.id, 'handover')
      return shiftService.openShift(payload)
    },
    onSuccess: () => {
      toast.success('Serah-terima berhasil')
      qc.invalidateQueries({ queryKey: ['shifts', 'active'] })
      qc.invalidateQueries({ queryKey: ['cashierDashboard'] })
      onSuccess()
    },
    onError: (e: Error) => toast.error(e.message || 'Gagal serah-terima shift'),
  })

  const busy = openMutation.isPending || handoverMutation.isPending

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const effectiveCash = isCarryOver ? 0 : amount
    if (!isCarryOver && !openingCashValid) {
      toast.error('Modal awal tidak valid')
      return
    }
    if (hasOpenShift) {
      if (!openableForHandover(type)) {
        toast.error('Tipe shift di luar jam untuk serah-terima')
        return
      }
      handoverMutation.mutate({ type, openingCash: effectiveCash })
      return
    }
    if (!openable(type)) {
      toast.error('Tipe shift di luar jam')
      return
    }
    openMutation.mutate({ type, openingCash: effectiveCash })
  }

  // Caption alasan tombol tipe disabled.
  const disabledReason = (t: ShiftType): string | undefined => {
    if (typeSelectable(t)) return undefined
    if (!settings) return 'memuat…'
    // Alur handover: shift berjalan ditutup dulu, jadi alasan satu-satunya = di luar jam.
    if (hasOpenShift) return 'di luar jam'
    return 'di luar jam'
  }

  // Footer: alur normal = tombol Buka Kasir; alur handover = tombol serah-terima.
  const footer = settingsQ.isLoading ? (
    <Button variant="primary" size="md" fullWidth disabled>
      Memuat…
    </Button>
  ) : hasOpenShift ? (
    <Button
      type="submit"
      form="open-shift-form"
      variant="primary"
      size="md"
      fullWidth
      loading={handoverMutation.isPending}
      disabled={!settings || !openableForHandover(type) || busy || !openingCashValid}
    >
      Serah-terima: tutup &amp; buka {type === 'pagi' ? 'Pagi' : 'Malam'}
    </Button>
  ) : (
    <Button
      type="submit"
      form="open-shift-form"
      variant="primary"
      size="md"
      fullWidth
      loading={openMutation.isPending}
      disabled={!settings || !openable(type) || busy || !openingCashValid || (!anyOpenable && !hasOpenShift)}
    >
      Buka Kasir
    </Button>
  )

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={hasOpenShift ? 'Serah-terima Kasir' : 'Buka Kasir'}
      description={
        hasOpenShift
          ? 'Tutup shift berjalan lalu buka shift baru dengan modal awal cash.'
          : 'Pilih shift dan input modal awal cash.'
      }
      size="sm"
      preventOutsideClose={busy}
      footer={footer}
    >
      <form id="open-shift-form" onSubmit={handleSubmit} className="space-y-4">
        {settingsQ.isLoading ? (
          <div className="space-y-3" aria-busy>
            <div className="h-4 w-24 rounded bg-neutral-100" />
            <div className="grid grid-cols-2 gap-2">
              <div className="h-[52px] rounded-lg bg-neutral-100" />
              <div className="h-[52px] rounded-lg bg-neutral-100" />
            </div>
            <div className="h-10 rounded-lg bg-neutral-100" />
          </div>
        ) : (
          <>
            <div>
              <p className="text-label text-neutral-700 mb-2">Tipe Shift</p>
              <div className="grid grid-cols-2 gap-2">
                {(['pagi', 'malam'] as const).map((t) => {
                  const Icon = t === 'pagi' ? Sun : Moon
                  const active = type === t
                  const selectable = typeSelectable(t)
                  const reason = disabledReason(t)
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => selectable && setType(t)}
                      disabled={!selectable}
                      title={reason}
                      aria-pressed={active}
                      aria-disabled={!selectable}
                      className={cn(
                        'min-h-[52px] flex flex-col items-center justify-center gap-0.5 px-3 rounded-lg border text-body-sm font-medium transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
                        !selectable
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
                      {reason && (
                        <span className="text-caption text-neutral-500 truncate max-w-full">{reason}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {settings && !anyOpenable && !hasOpenShift ? (
              <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-body-sm text-neutral-600">
                Di luar jam operasional - tidak ada shift yang bisa dibuka sekarang.
              </p>
            ) : null}

            {isCarryOver ? (
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5">
                <p className="text-label text-neutral-700">Modal awal (carry-over)</p>
                <p className="text-body font-semibold text-neutral-900 tabular-nums mt-0.5">
                  {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(runningModal)}
                </p>
                <p className="text-caption text-neutral-500 mt-1">
                  Lanjut dari laci shift sebelumnya — tidak perlu isi modal baru.
                </p>
              </div>
            ) : (
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
            )}
          </>
        )}
      </form>
    </Dialog>
  )
}
