import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Dialog, Button } from '@/design-system/primitives'

export interface OpenOrdersGroup { groupKey: string; label: string; tableNumber: number | null; txIds: number[] }

export default function CloseShiftBlockedModal({
  groups,
  shiftDate,
  onClose,
}: {
  groups: OpenOrdersGroup[]
  /** Tanggal shift yang sedang ditutup → preset filter Riwayat ke hari itu. */
  shiftDate?: string
  onClose: () => void
}) {
  const navigate = useNavigate()
  const historyUrl = `/history?status=open${shiftDate ? `&date=${shiftDate}` : ''}`
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Ada pesanan belum dibayar"
      description="Bayar atau batalkan pesanan ini lewat Riwayat dulu, baru tutup kasir."
      size="sm"
    >
      <ul className="space-y-2 mb-4">
        {groups.map((g) => (
          <li key={g.groupKey} className="rounded-lg border border-neutral-200 p-3">
            <span className="font-medium text-neutral-900">{g.label}</span>
            <p className="text-caption text-neutral-500 mt-1">
              {g.txIds.map((id) => `Tx #${id}`).join(' · ')}
            </p>
          </li>
        ))}
      </ul>
      <Button variant="primary" size="md" fullWidth onClick={() => navigate(historyUrl)}>
        <span className="flex items-center gap-1">
          Buka Riwayat <ArrowRight className="w-4 h-4" />
        </span>
      </Button>
    </Dialog>
  )
}
