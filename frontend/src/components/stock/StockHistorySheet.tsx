// REV 2.8: drawer riwayat pergerakan stok per item (tap baris). Memanfaatkan
// endpoint detail (recentMovements) yang kini membawa qtyBefore/qtyAfter, userName,
// dan FK sumber. Shape movement sudah dinormalisasi oleh tab (reasonLabel +
// sourceLabel sudah jadi) supaya Sheet ini generic.

import { ArrowRight } from 'lucide-react'
import { Badge, EmptyState, Sheet, Skeleton } from '@/design-system/primitives'
import { useIsMobile } from '@/design-system/hooks/useMediaQuery'
import { cn, formatDateTime } from '@/lib/utils'

export interface HistoryMovement {
  id: number
  /** Label alasan siap-tampil (Indonesian). */
  reasonLabel: string
  delta: number
  qtyBefore: number | null
  qtyAfter: number | null
  note: string | null
  userName: string
  createdAt: string
  /** "Transaksi #5" bila ada FK sumber; null kalau tidak. */
  sourceLabel?: string | null
}

interface StockHistorySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle?: string
  isLoading: boolean
  movements: HistoryMovement[]
  /** Satuan untuk tampilan qty (mis. "porsi"). */
  unitSuffix?: string
}

function fmtQty(n: number | null): string {
  return n == null ? '?' : String(n)
}

export function StockHistorySheet({
  open,
  onOpenChange,
  title,
  subtitle,
  isLoading,
  movements,
  unitSuffix = 'porsi',
}: StockHistorySheetProps) {
  // Responsif: HP → bottom sheet (jempol); tablet/desktop → panel kanan (side drawer).
  const isMobile = useIsMobile()
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={subtitle}
      side={isMobile ? 'bottom' : 'right'}
      height={isMobile ? '85vh' : 'auto'}
    >
      <div className="px-4 py-3 sm:px-5">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : movements.length === 0 ? (
          <EmptyState title="Belum ada pergerakan" description="Item ini belum punya riwayat stok." compact />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {movements.map((m) => {
              const up = m.delta > 0
              const flat = m.delta === 0
              return (
                <li key={m.id} className="py-3 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <Badge tone="neutral" size="sm">
                        {m.reasonLabel}
                      </Badge>
                      <span
                        className={cn(
                          'font-semibold tabular-nums',
                          flat ? 'text-neutral-500' : up ? 'text-success-700' : 'text-danger-700'
                        )}
                      >
                        {up ? '+' : ''}
                        {m.delta}
                      </span>
                      {m.sourceLabel && (
                        <span className="text-caption text-primary-700">{m.sourceLabel}</span>
                      )}
                    </div>
                    <span className="text-caption text-neutral-400 shrink-0 tabular-nums">
                      {formatDateTime(m.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-body-sm text-neutral-700 tabular-nums">
                    <span>{fmtQty(m.qtyBefore)}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
                    <span className="font-medium text-neutral-900">{fmtQty(m.qtyAfter)}</span>
                    <span className="text-neutral-400">{unitSuffix}</span>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-caption text-neutral-500">
                    {m.note ? <span className="italic truncate">{m.note}</span> : <span />}
                    <span className="shrink-0">oleh {m.userName}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Sheet>
  )
}
