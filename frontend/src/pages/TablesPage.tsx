// TablesPage - REV 2.3 base + REV 2.5 Combine Tables entry.
// Display 9 meja sebagai grid dengan status (kosong/terisi) - status dihitung dari
// transactions list filter status=open + orderType=dineIn today.
// Click body meja → /pos/:tableNumber (input order / view existing).
// REV 2.5: tile occupied tambah ⋮ DropdownMenu di pojok dengan opsi
// "Gabung ke meja lain" → trigger CombineTableModal dengan sourceTableId.
// Gate: hanya owner+kasir yang lihat ⋮ (per matrix REV 2.3, combine = owner+kasir).

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  ShoppingBag,
  Clock,
  MoreVertical,
  Link2,
  ExternalLink,
} from 'lucide-react'
import { transactionService } from '@/services/transactionService'
import { useAuthStore } from '@/stores/authStore'
import type { Transaction } from '@/types'
import { formatCurrency, formatTime, cn } from '@/lib/utils'
import {
  Skeleton,
  Badge,
  DropdownMenu,
  Page,
  type DropdownItem,
} from '@/design-system/primitives'
import CombineTableModal from '@/components/CombineTableModal'

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
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const today = new Date().toISOString().substring(0, 10)

  // REV 2.5: hanya owner+kasir yang boleh trigger combine (per matrix REV 2.3).
  const canCombine = user?.role === 'owner' || user?.role === 'cashier'

  // State combine modal source table number.
  const [combineSourceTable, setCombineSourceTable] = useState<number | null>(null)

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

  // Group by tableNumber → pick latest Tx as tile representative untuk display.
  // (Aggregate dari mergedFrom/multi-Pesanan tidak ditampilkan di tile - cuma 1 Tx
  // summary. Untuk full multi-Pesanan view, user click → masuk POSPage view mode.)
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

  const handleCombineSuccess = () => {
    setCombineSourceTable(null)
    qc.invalidateQueries({ queryKey: ['transactions', 'open-today'] })
  }

  return (
    <Page
      title="Status Meja"
      subtitle={
        <>
          {TABLES.length} meja ·{' '}
          <span className="text-warning-700 font-medium">{occupiedCount} terisi</span> ·{' '}
          <span className="text-success-700 font-medium">{emptyCount} kosong</span>
        </>
      }
    >
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
              const showDropdown = occupied && canCombine

              const dropdownItems: DropdownItem[] = [
                {
                  label: 'Buka POS',
                  icon: <ExternalLink />,
                  onSelect: () => navigate(`/pos/${t.number}`),
                },
                {
                  label: 'Gabung ke meja lain',
                  icon: <Link2 />,
                  onSelect: () => setCombineSourceTable(t.number),
                },
              ]

              return (
                <div key={t.number} className="relative">
                  <button
                    onClick={() => navigate(`/pos/${t.number}`)}
                    className={cn(
                      'w-full h-full min-h-[8.5rem] p-4 rounded-xl text-left border-2 transition-all duration-fast active:scale-[0.98]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1',
                      occupied
                        ? 'bg-warning-50 border-warning-300 hover:bg-warning-100 hover:border-warning-400'
                        : 'bg-white border-success-200 hover:bg-success-50 hover:border-success-300',
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-display font-semibold text-neutral-900 tabular-nums">
                        {t.number}
                      </span>
                      {/* Kosong / occupied non-canCombine: Badge capacity di pojok.
                          Occupied + canCombine: pojok diisi DropdownMenu (lihat di luar button). */}
                      {!showDropdown && (
                        <Badge tone="neutral" variant="outline" size="sm">
                          <Users className="w-3 h-3" />
                          {t.capacity}
                        </Badge>
                      )}
                      {/* Spacer 36px (sama dengan ⋮ button) supaya layout tidak shift saat dropdown overlay. */}
                      {showDropdown && <div className="w-9 h-9" aria-hidden />}
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

                  {/* REV 2.5: ⋮ DropdownMenu di pojok atas - hanya occupied + canCombine.
                      Sibling button (bukan nested) supaya tidak invalid HTML; pointer-events
                      naturally tertangkap di absolute overlay. */}
                  {showDropdown && (
                    <div className="absolute top-2 right-2 z-10">
                      <DropdownMenu
                        align="end"
                        trigger={
                          <button
                            type="button"
                            aria-label={`Aksi Meja ${t.number}`}
                            className="h-9 w-9 inline-flex items-center justify-center rounded-md bg-white/80 text-neutral-600 hover:bg-white hover:text-neutral-900 backdrop-blur-sm border border-warning-200/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        }
                        items={dropdownItems}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

      {/* REV 2.5: Combine Tables modal - source mode (caller meja yang dipilih) */}
      {combineSourceTable !== null && (
        <CombineTableModal
          sourceTableId={combineSourceTable}
          onClose={() => setCombineSourceTable(null)}
          onSuccess={handleCombineSuccess}
        />
      )}
    </Page>
  )
}
