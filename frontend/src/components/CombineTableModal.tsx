// REV 2.5 CombineTableModal - inter-table merge (Combine Tables).
//
// Dipakai oleh 2 entry point dengan logika backend identik (mergeBills):
//   - Flow B: TablesPage "⋮" menu meja occupied → pass sourceTableId (self
//     adalah source meja yang akan jadi kosong). User pilih TARGET dari list.
//   - Flow C: PaymentModal "⌕ Gabung Meja Lain" → pass targetTableId (self
//     adalah meja current yang sedang dibayar). User pilih SOURCE dari list.
//
// Logika: untuk meja yang dipilih sebagai partner, ALL open Tx di meja itu
// menjadi sources (handle multi-Pesanan REV 2.4). Target = oldest open Tx di
// target meja (konsisten dengan pattern Add Round multi-Pesanan: parent =
// Pesanan #1 chronologically).
//
// Backend mergeBills validate same shift. Frontend trust backend reject 400
// kalau pilih meja shift berbeda (jarang terjadi pasca-REV 2.5 single active
// shift system-wide). Filter hari ini saja (resto buka 10-22, tidak crossing).

import { useMemo, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Link2, Loader2, Inbox, Check, Clock, ShoppingBag } from 'lucide-react'
import { transactionService, type MergePayload } from '@/services/transactionService'
import type { Transaction } from '@/types'
import { formatCurrency, formatTime, cn } from '@/lib/utils'
import { Dialog, Button, Badge, EmptyState } from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'

interface CombineTableModalProps {
  /** Flow B (TablesPage trigger): self adalah source meja. User pilih TARGET. */
  sourceTableId?: number
  /** Flow C (PaymentModal trigger): self adalah target meja. User pilih SOURCE. */
  targetTableId?: number
  onClose: () => void
  onSuccess: () => void
}

interface TableGroup {
  tableNumber: number
  txs: Transaction[]
  totalSubtotal: number
  oldestTxId: number
  oldestCreatedAt: string
}

function groupOpenTxByTable(txs: Transaction[]): TableGroup[] {
  const map = new Map<number, Transaction[]>()
  for (const tx of txs) {
    if (tx.tableNumber === null || tx.mergedIntoId !== null) continue
    const existing = map.get(tx.tableNumber)
    if (existing) existing.push(tx)
    else map.set(tx.tableNumber, [tx])
  }
  const groups: TableGroup[] = []
  for (const [tableNumber, list] of map.entries()) {
    const sorted = [...list].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
    groups.push({
      tableNumber,
      txs: sorted,
      totalSubtotal: sorted.reduce((s, t) => s + t.subtotal, 0),
      oldestTxId: sorted[0]!.id,
      oldestCreatedAt: sorted[0]!.createdAt,
    })
  }
  return groups.sort((a, b) => a.tableNumber - b.tableNumber)
}

export default function CombineTableModal({
  sourceTableId,
  targetTableId,
  onClose,
  onSuccess,
}: CombineTableModalProps) {
  const toast = useToast()
  const [partnerTableNumber, setPartnerTableNumber] = useState<number | null>(null)

  // Validate props: exactly one of sourceTableId / targetTableId must be set.
  const selfTableNumber = sourceTableId ?? targetTableId
  const flowMode: 'pickTarget' | 'pickSource' =
    sourceTableId !== undefined ? 'pickTarget' : 'pickSource'

  const today = new Date().toISOString().substring(0, 10)
  // REV 2.5: share query key dengan TablesPage (['transactions', 'open-today'])
  // supaya cache + invalidations berlaku konsisten. Sebelumnya 'combine-table'
  // suffix bikin cache terpisah → stale 5 menit setelah createMutation tidak
  // refresh → Tx baru tidak muncul di picker.
  const { data: openTxs = [], isLoading } = useQuery({
    queryKey: ['transactions', 'open-today'],
    queryFn: () =>
      transactionService.list({ status: 'open', orderType: 'dineIn', date: today }),
    refetchOnMount: 'always',
  })

  const allGroups = useMemo(() => groupOpenTxByTable(openTxs), [openTxs])
  const selfGroup = useMemo(
    () => allGroups.find((g) => g.tableNumber === selfTableNumber) ?? null,
    [allGroups, selfTableNumber],
  )
  const candidateGroups = useMemo(
    () => allGroups.filter((g) => g.tableNumber !== selfTableNumber),
    [allGroups, selfTableNumber],
  )
  const selectedPartner = useMemo(
    () => candidateGroups.find((g) => g.tableNumber === partnerTableNumber) ?? null,
    [candidateGroups, partnerTableNumber],
  )

  const merge = useMutation({
    mutationFn: (payload: MergePayload) => transactionService.merge(payload),
    onSuccess: () => {
      const msg =
        flowMode === 'pickTarget'
          ? `Meja ${selfTableNumber} digabungkan ke Meja ${partnerTableNumber}`
          : `Meja ${partnerTableNumber} digabungkan ke Meja ${selfTableNumber}`
      toast.success(msg)
      onSuccess()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleSubmit = () => {
    if (!selectedPartner || !selfGroup) return
    // Resolve source vs target sesuai flowMode.
    // sources = ALL open Tx ids di source meja (handle multi-Pesanan REV 2.4).
    // target = oldest open Tx id di target meja.
    let sourceIds: number[]
    let targetId: number
    if (flowMode === 'pickTarget') {
      // Self = source, partner = target.
      sourceIds = selfGroup.txs.map((t) => t.id)
      targetId = selectedPartner.oldestTxId
    } else {
      // Self = target, partner = source.
      sourceIds = selectedPartner.txs.map((t) => t.id)
      targetId = selfGroup.oldestTxId
    }
    merge.mutate({ sourceIds, targetId })
  }

  const combinedSubtotal =
    selfGroup && selectedPartner ? selfGroup.totalSubtotal + selectedPartner.totalSubtotal : 0

  const title =
    flowMode === 'pickTarget'
      ? `Gabungkan Meja ${selfTableNumber} ke meja lain`
      : `Gabung meja lain ke Meja ${selfTableNumber}`

  const description =
    flowMode === 'pickTarget'
      ? `Pesanan Meja ${selfTableNumber} akan dipindahkan ke meja tujuan. Meja ${selfTableNumber} jadi kosong setelah digabung.`
      : `Pesanan meja sumber akan dipindahkan ke Meja ${selfTableNumber}. Meja sumber jadi kosong setelah digabung.`

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={
        <span className="inline-flex items-center gap-2">
          <Link2 className="w-5 h-5 text-primary-600" />
          {title}
        </span>
      }
      description={description}
      size="lg"
      preventOutsideClose={merge.isPending}
      footer={
        <Button
          variant="primary"
          size="md"
          fullWidth
          onClick={handleSubmit}
          loading={merge.isPending}
          disabled={!selectedPartner || !selfGroup}
        >
          {!selectedPartner
            ? 'Pilih meja partner dulu'
            : flowMode === 'pickTarget'
              ? `Pindahkan Meja ${selfTableNumber} → Meja ${partnerTableNumber}`
              : `Pindahkan Meja ${partnerTableNumber} → Meja ${selfTableNumber}`}
        </Button>
      }
    >
      <div className="space-y-3">
        {/* Self meja summary */}
        {selfGroup ? (
          <div className="bg-primary-50/50 border border-primary-100 rounded-xl p-3">
            <p className="text-label text-neutral-600 mb-1">
              {flowMode === 'pickTarget' ? 'Meja sumber (akan kosong)' : 'Meja tujuan (penerima)'}
            </p>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-body font-semibold text-neutral-900">
                Meja {selfGroup.tableNumber}
                <Badge tone="primary" size="sm" className="ml-2">
                  {selfGroup.txs.length} pesanan
                </Badge>
              </p>
              <p className="text-body text-neutral-700 tabular-nums">
                {formatCurrency(selfGroup.totalSubtotal)}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-warning-50 border border-warning-200 rounded-xl p-3 text-body-sm text-warning-800">
            Meja {selfTableNumber} sudah tidak punya pesanan open. Tutup modal ini.
          </div>
        )}

        {/* Partner candidates list */}
        <div>
          <p className="text-label text-neutral-700 mb-2">
            Pilih meja partner ({candidateGroups.length} tersedia)
          </p>
          {isLoading ? (
            <div className="text-center py-6 text-neutral-500">
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            </div>
          ) : candidateGroups.length === 0 ? (
            <EmptyState
              icon={<Inbox />}
              title="Tidak ada meja lain yang terisi"
              description="Combine Tables butuh minimal 2 meja terisi pada waktu bersamaan."
              compact
            />
          ) : (
            <div className="space-y-2">
              {candidateGroups.map((g) => {
                const checked = partnerTableNumber === g.tableNumber
                return (
                  <button
                    key={g.tableNumber}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    onClick={() => setPartnerTableNumber(g.tableNumber)}
                    className={cn(
                      'w-full text-left flex items-center gap-3 p-3 rounded-lg transition-colors min-h-[60px]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1',
                      checked
                        ? 'bg-primary-50 border border-primary-300'
                        : 'bg-neutral-50/80 border border-neutral-200/60 hover:bg-neutral-100',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'h-[18px] w-[18px] shrink-0 rounded-full border-2 flex items-center justify-center transition-colors',
                        checked
                          ? 'bg-primary-600 border-primary-600 text-white'
                          : 'bg-white border-neutral-300',
                      )}
                    >
                      {checked && <Check className="h-3 w-3" strokeWidth={3.5} />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-body-sm font-medium text-neutral-900 inline-flex items-center gap-2">
                        Meja {g.tableNumber}
                        <Badge tone="neutral" size="sm">
                          <ShoppingBag className="w-3 h-3" />
                          {g.txs.length} pesanan
                        </Badge>
                      </p>
                      <p className="text-caption text-neutral-500 inline-flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        Sejak {formatTime(g.oldestCreatedAt)}
                      </p>
                    </div>
                    <span className="text-body-sm font-medium text-neutral-800 whitespace-nowrap tabular-nums">
                      {formatCurrency(g.totalSubtotal)}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Preview combined total */}
        {selectedPartner && selfGroup && (
          <div className="bg-success-50 border border-success-200 rounded-xl p-3">
            <p className="text-label text-neutral-600">
              Total subtotal setelah digabung
            </p>
            <p className="text-display text-success-700 tabular-nums mt-0.5">
              {formatCurrency(combinedSubtotal)}
            </p>
            <p className="text-caption text-neutral-500 mt-0.5">
              PB1 10% dihitung saat pembayaran di meja tujuan.
            </p>
          </div>
        )}
      </div>
    </Dialog>
  )
}
