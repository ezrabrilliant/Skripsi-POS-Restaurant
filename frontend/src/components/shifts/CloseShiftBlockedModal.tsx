import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Dialog, Button } from '@/design-system/primitives'

export interface OpenOrdersGroup { groupKey: string; label: string; tableNumber: number | null; txIds: number[] }

export default function CloseShiftBlockedModal({ groups, onClose }: { groups: OpenOrdersGroup[]; onClose: () => void }) {
  const navigate = useNavigate()
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Ada pesanan belum dibayar" description="Selesaikan dulu sebelum tutup kasir." size="sm">
      <ul className="space-y-3">
        {groups.map((g) => (
          <li key={g.groupKey} className="rounded-lg border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-neutral-900">{g.label}</span>
              <Button variant="ghost" size="sm" onClick={() => navigate(g.tableNumber != null ? `/pos/${g.tableNumber}` : '/pos')}>
                <span className="flex items-center gap-1">Buka <ArrowRight className="w-4 h-4" /></span>
              </Button>
            </div>
            <p className="text-caption text-neutral-500 mt-1">{g.txIds.map((id) => `Tx #${id}`).join(' · ')}</p>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}
