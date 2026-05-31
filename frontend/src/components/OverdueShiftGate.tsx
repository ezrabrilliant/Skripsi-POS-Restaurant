// REV 2.12: layar blokir saat shift aktif sudah lewat business day-nya (isOverdue).
// Memaksa kasir menuntaskan + menutup + menyetor shift kemarin sebelum mulai hari ini.
import { AlertTriangle } from 'lucide-react'
import type { Shift } from '@/types'
import { Button } from '@/design-system/primitives'

export default function OverdueShiftGate({
  shift,
  onGoToSettlement,
}: {
  shift: Shift
  onGoToSettlement: () => void
}) {
  return (
    <div className="h-full flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-sm border border-warning-200">
        <div className="w-14 h-14 bg-warning-100 text-warning-700 rounded-full mx-auto mb-3 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-title font-semibold text-neutral-900 mb-1 text-center">
          Shift kemarin belum ditutup
        </h2>
        <p className="text-body-sm text-neutral-600 mb-3 text-center">
          Shift {shift.type ? `${shift.type} ` : ''}tanggal {shift.date} (kasir {shift.cashierName})
          masih terbuka. Tuntaskan semua pesanan yang belum dibayar, lalu tutup &amp; setor shift
          itu dulu sebelum mulai hari ini.
        </p>
        <Button variant="primary" size="md" fullWidth onClick={onGoToSettlement}>
          Tutup &amp; Setor Shift Kemarin
        </Button>
      </div>
    </div>
  )
}
