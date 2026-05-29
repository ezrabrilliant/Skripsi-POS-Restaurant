import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Clock } from 'lucide-react'
import { settingsService } from '@/services/settingsService'
import { shiftService } from '@/services/shiftService'
import { isAfterChangeover } from '@/lib/shiftWindow'

export default function ShiftChangeReminder() {
  const settingsQ = useQuery({ queryKey: ['settings'], queryFn: settingsService.get })
  const shiftsQ = useQuery({ queryKey: ['shifts', 'active'], queryFn: () => shiftService.getActiveShifts(), refetchInterval: 25_000 })
  const [dismissedFor, setDismissedFor] = useState<number | null>(null)

  const settings = settingsQ.data
  const pagiShift = (shiftsQ.data ?? []).find((s) => s.type === 'pagi')
  const show = !!settings && !!pagiShift && isAfterChangeover(settings) && dismissedFor !== pagiShift.id
  if (!show || !pagiShift) return null

  return (
    <div className="fixed right-3 z-40 max-w-xs rounded-lg bg-warning-50 border border-warning-200 shadow-lg p-3"
      style={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}>
      <div className="flex items-start gap-2">
        <Clock className="w-4 h-4 text-warning-700 mt-0.5 shrink-0" />
        <p className="text-caption text-warning-800">Sudah masuk jam shift malam. Kalau ada pergantian kasir, tutup shift untuk diserahkan; kalau lanjut sendiri, abaikan.</p>
        <button onClick={() => setDismissedFor(pagiShift.id)} aria-label="Tutup" className="shrink-0 text-warning-600"><X className="w-4 h-4" /></button>
      </div>
    </div>
  )
}
