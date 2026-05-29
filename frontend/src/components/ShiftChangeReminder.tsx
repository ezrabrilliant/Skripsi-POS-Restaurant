import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Moon, ArrowRight } from 'lucide-react'
import { settingsService } from '@/services/settingsService'
import { shiftService } from '@/services/shiftService'
import { isAfterChangeover } from '@/lib/shiftWindow'
import { Button } from '@/design-system/primitives'

const AUTO_HIDE_MS = 8000

// Reminder toast (gaya Untitled UI): muncul saat sudah lewat jam pergantian tapi shift
// pagi masih terbuka. Actionable (CTA → /settlement) + auto-hide ~8s supaya tidak
// mengganggu, TAPI pause saat di-hover (best-of-both: hilang kalau diabaikan, tetap
// kalau user mau klik). Dismiss per-shift; tidak nag lagi untuk shift yang sama.
export default function ShiftChangeReminder() {
  const navigate = useNavigate()
  const settingsQ = useQuery({ queryKey: ['settings'], queryFn: settingsService.get })
  const shiftsQ = useQuery({
    queryKey: ['shifts', 'active'],
    queryFn: () => shiftService.getActiveShifts(),
    refetchInterval: 25_000,
  })
  const [dismissedFor, setDismissedFor] = useState<number | null>(null)
  const [paused, setPaused] = useState(false)

  const settings = settingsQ.data
  const pagiShift = (shiftsQ.data ?? []).find((s) => s.type === 'pagi')
  const shiftId = pagiShift?.id ?? null
  const visible = !!settings && !!pagiShift && isAfterChangeover(settings) && dismissedFor !== shiftId

  // Auto-hide setelah AUTO_HIDE_MS, kecuali sedang di-hover.
  useEffect(() => {
    if (!visible || paused || shiftId === null) return
    const t = setTimeout(() => setDismissedFor(shiftId), AUTO_HIDE_MS)
    return () => clearTimeout(t)
  }, [visible, paused, shiftId])

  const goSettlement = () => {
    if (shiftId !== null) setDismissedFor(shiftId)
    navigate('/settlement')
  }

  return (
    <AnimatePresence>
      {visible && pagiShift && (
        <motion.div
          key="shift-reminder"
          initial={{ opacity: 0, y: -12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          role="status"
          aria-live="polite"
          className="fixed right-3 z-50 w-[21rem] max-w-[calc(100vw-1.5rem)] rounded-xl bg-white border border-neutral-200/80 shadow-xl ring-1 ring-black/5"
          style={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}
        >
          <div className="flex gap-3 p-4">
            {/* Featured icon (ring halo ala Untitled UI) */}
            <span className="relative shrink-0 mt-0.5 flex items-center justify-center w-9 h-9 rounded-full bg-warning-100 text-warning-600 ring-8 ring-warning-50">
              <Moon className="w-5 h-5" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-body-sm font-semibold text-neutral-900">Waktunya pergantian shift</p>
              <p className="text-caption text-neutral-600 mt-0.5">
                Shift pagi ({pagiShift.cashierName}) masih terbuka. Mau pindah ke kasir malam?
              </p>
              <div className="mt-3 flex items-center gap-3">
                <Button size="sm" variant="primary" onClick={goSettlement}>
                  <span className="flex items-center gap-1">
                    Tutup Kasir
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </Button>
                <button
                  type="button"
                  onClick={() => shiftId !== null && setDismissedFor(shiftId)}
                  className="text-caption font-medium text-neutral-500 hover:text-neutral-700"
                >
                  Lanjut sendiri
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => shiftId !== null && setDismissedFor(shiftId)}
              aria-label="Tutup"
              className="shrink-0 -mr-1.5 -mt-1.5 p-1 text-neutral-400 hover:text-neutral-600 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
