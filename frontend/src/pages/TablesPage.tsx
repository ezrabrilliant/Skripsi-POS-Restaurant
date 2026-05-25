// TablesPage — REV 2.3. Display 9 meja sebagai grid dengan status (kosong/terisi).
// Status dihitung dari transactions list filter status=open + orderType=dineIn today.
// Click meja kosong → /pos/:tableNumber input order baru.
// Click meja terisi → /pos/:tableNumber load context transaksi.

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Users, ShoppingBag, Clock } from 'lucide-react'
import { transactionService } from '@/services/transactionService'
import type { Transaction } from '@/types'
import { formatCurrency, formatTime, cn } from '@/lib/utils'
import { Skeleton, Badge } from '@/design-system/primitives'

const TABLES = [
  { number: 1, capacity: 6 },
  { number: 2, capacity: 6 },
  { number: 3, capacity: 4 },
  { number: 4, capacity: 4 },
  { number: 5, capacity: 4 },
  { number: 6, capacity: 4 },
  { number: 7, capacity: 4 },
  { number: 8, capacity: 4 },
  { number: 9, capacity: 4 },
]

export default function TablesPage() {
  const navigate = useNavigate()
  const today = new Date().toISOString().substring(0, 10)

  const { data: openTransactions = [], isLoading } = useQuery({
    queryKey: ['transactions', 'open-today'],
    queryFn: () =>
      transactionService.list({
        status: 'open',
        orderType: 'dineIn',
        date: today,
      }),
    refetchInterval: 30_000,
  })

  const txByTable = useMemo(() => {
    const map = new Map<number, Transaction>()
    for (const tx of openTransactions) {
      if (tx.tableNumber !== null && tx.mergedIntoId === null) {
        const existing = map.get(tx.tableNumber)
        if (!existing || tx.createdAt > existing.createdAt) {
          map.set(tx.tableNumber, tx)
        }
      }
    }
    return map
  }, [openTransactions])

  const occupiedCount = txByTable.size
  const emptyCount = TABLES.length - occupiedCount

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 space-y-3 pt-safe pb-safe">
        <header>
          <h1 className="text-headline font-semibold text-neutral-900">Status Meja</h1>
          <p className="text-body-sm text-neutral-600">
            {TABLES.length} meja ·{' '}
            <span className="text-warning-700 font-medium">{occupiedCount} terisi</span> ·{' '}
            <span className="text-success-700 font-medium">{emptyCount} kosong</span>
          </p>
        </header>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {TABLES.map((t) => {
              const tx = txByTable.get(t.number)
              const occupied = !!tx
              return (
                <button
                  key={t.number}
                  onClick={() => navigate(`/pos/${t.number}`)}
                  className={cn(
                    'p-4 rounded-xl text-left border-2 transition-all duration-fast active:scale-[0.98]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1',
                    occupied
                      ? 'bg-warning-50 border-warning-300 hover:bg-warning-100 hover:border-warning-400'
                      : 'bg-white border-success-200 hover:bg-success-50 hover:border-success-300'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-display font-semibold text-neutral-900 tabular-nums">
                      {t.number}
                    </span>
                    <Badge tone="neutral" variant="outline" size="sm">
                      <Users className="w-3 h-3" />
                      {t.capacity}
                    </Badge>
                  </div>
                  {occupied && tx ? (
                    <div className="space-y-1">
                      <Badge tone="warning" size="sm">
                        <ShoppingBag className="w-3 h-3" />
                        Terisi
                      </Badge>
                      <p className="text-body font-semibold text-neutral-900 tabular-nums">
                        {formatCurrency(tx.subtotal)}
                      </p>
                      <p className="text-caption text-neutral-600 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Sejak {formatTime(tx.createdAt)} · {tx.items.length} item
                      </p>
                    </div>
                  ) : (
                    <p className="text-caption text-success-700 font-medium">
                      Kosong · Tap untuk input order
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
