// HistoryPage — REV 2.3 owner+kasir. List transaksi dengan filter status/date/orderType.
// Mobile-first DataTable dengan card view + DropdownMenu actions (split/merge/void).
// Click row untuk expand detail items + payment breakdown.

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronRight,
  ChevronDown,
  Ban,
  Users,
  GitMerge,
  MoreVertical,
  Filter,
  Receipt,
} from 'lucide-react'
import { transactionService } from '@/services/transactionService'
import SplitBillModal from '@/components/SplitBillModal'
import MergeBillModal from '@/components/MergeBillModal'
import { PAYMENT_LABEL, ORDER_TYPE_LABELS } from '@/types'
import type { TransactionStatus, OrderType, Transaction } from '@/types'
import { formatCurrency, formatDateTime, cn } from '@/lib/utils'
import {
  Button,
  Input,
  Select,
  Badge,
  Skeleton,
  EmptyState,
  Sheet,
  DropdownMenu,
  type SelectOption,
  type DropdownItem,
} from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'
import { useConfirm } from '@/design-system/hooks/useConfirm'
import { useIsMobile } from '@/design-system/hooks/useMediaQuery'

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'Semua status' },
  { value: 'open', label: 'Open' },
  { value: 'paid', label: 'Dibayar' },
  { value: 'void', label: 'Void' },
]

const ORDER_TYPE_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'Semua tipe' },
  { value: 'dineIn', label: 'Dine-in' },
  { value: 'takeaway', label: 'Takeaway' },
]

const STATUS_TONE: Record<TransactionStatus, 'success' | 'warning' | 'neutral'> = {
  paid: 'success',
  open: 'warning',
  void: 'neutral',
}

export default function HistoryPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const isMobile = useIsMobile()
  const today = new Date().toISOString().substring(0, 10)
  const [filterDate, setFilterDate] = useState(today)
  const [filterStatus, setFilterStatus] = useState<TransactionStatus | 'all'>('all')
  const [filterOrderType, setFilterOrderType] = useState<OrderType | 'all'>('all')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [splitTarget, setSplitTarget] = useState<Transaction | null>(null)
  const [mergeTarget, setMergeTarget] = useState<Transaction | null>(null)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', filterDate, filterStatus, filterOrderType],
    queryFn: () =>
      transactionService.list({
        date: filterDate,
        status: filterStatus === 'all' ? undefined : filterStatus,
        orderType: filterOrderType === 'all' ? undefined : filterOrderType,
      }),
  })

  const voidMutation = useMutation({
    mutationFn: (id: number) => transactionService.void(id),
    onSuccess: () => {
      toast.success('Transaksi dibatalkan (stok dikembalikan)')
      qc.invalidateQueries({ queryKey: ['transactions'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleVoid = async (tx: Transaction) => {
    if (tx.status === 'void') {
      toast.info(`Tx #${tx.id} sudah void`)
      return
    }
    const ok = await confirm({
      title: `Batalkan transaksi #${tx.id}?`,
      description: 'Stok akan dikembalikan otomatis dan audit log tercatat. Tindakan tidak bisa di-undo.',
      confirmText: 'Ya, Batalkan',
      tone: 'danger',
    })
    if (!ok) return
    voidMutation.mutate(tx.id)
  }

  const totalRevenue = transactions
    .filter((t) => t.status === 'paid')
    .reduce((s, t) => s + t.total, 0)

  const activeFilterCount =
    (filterStatus !== 'all' ? 1 : 0) + (filterOrderType !== 'all' ? 1 : 0)

  const filterContent = (
    <div className="space-y-3">
      <Input
        label="Tanggal"
        type="date"
        value={filterDate}
        onChange={(e) => setFilterDate(e.target.value)}
      />
      <Select
        label="Status"
        value={filterStatus}
        onChange={(e) => setFilterStatus(e.target.value as TransactionStatus | 'all')}
        options={STATUS_OPTIONS}
      />
      <Select
        label="Tipe Order"
        value={filterOrderType}
        onChange={(e) => setFilterOrderType(e.target.value as OrderType | 'all')}
        options={ORDER_TYPE_OPTIONS}
      />
    </div>
  )

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 space-y-3 pt-safe pb-safe">
        <header className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-headline font-semibold text-neutral-900">Riwayat Transaksi</h1>
            <p className="text-body-sm text-neutral-600">
              {transactions.length} transaksi · total dibayar{' '}
              <span className="font-medium text-neutral-900 tabular-nums">
                {formatCurrency(totalRevenue)}
              </span>
            </p>
          </div>
          {isMobile && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Filter className="w-4 h-4" />}
              onClick={() => setFilterSheetOpen(true)}
            >
              Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Button>
          )}
        </header>

        {/* Filter desktop inline */}
        {!isMobile && (
          <div className="bg-white rounded-xl p-3 border border-neutral-200/60 grid grid-cols-3 gap-3">
            {filterContent}
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : transactions.length === 0 ? (
          <EmptyState
            icon={<Receipt />}
            title="Tidak ada transaksi"
            description="Tidak ditemukan transaksi pada filter di atas."
          />
        ) : (
          <div className="bg-white rounded-xl divide-y divide-neutral-100 border border-neutral-200/60 overflow-hidden">
            {transactions.map((tx) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                expanded={expandedId === tx.id}
                onToggle={() => setExpandedId(expandedId === tx.id ? null : tx.id)}
                onVoid={() => handleVoid(tx)}
                onSplit={() => setSplitTarget(tx)}
                onMerge={() => setMergeTarget(tx)}
              />
            ))}
          </div>
        )}

        {splitTarget && (
          <SplitBillModal
            transaction={splitTarget}
            onClose={() => setSplitTarget(null)}
            onSuccess={() => {
              setSplitTarget(null)
              qc.invalidateQueries({ queryKey: ['transactions'] })
            }}
          />
        )}
        {mergeTarget && (
          <MergeBillModal
            targetTransaction={mergeTarget}
            onClose={() => setMergeTarget(null)}
            onSuccess={() => {
              setMergeTarget(null)
              qc.invalidateQueries({ queryKey: ['transactions'] })
            }}
          />
        )}

        {/* Filter Sheet mobile */}
        <Sheet
          open={filterSheetOpen}
          onOpenChange={setFilterSheetOpen}
          title="Filter Transaksi"
          description="Sesuaikan kriteria pencarian."
        >
          <div className="px-4 py-3 space-y-3">
            {filterContent}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="md"
                fullWidth
                onClick={() => {
                  setFilterStatus('all')
                  setFilterOrderType('all')
                }}
              >
                Reset
              </Button>
              <Button variant="primary" size="md" fullWidth onClick={() => setFilterSheetOpen(false)}>
                Terapkan
              </Button>
            </div>
          </div>
        </Sheet>
      </div>
    </div>
  )
}

function TransactionRow({
  tx,
  expanded,
  onToggle,
  onVoid,
  onSplit,
  onMerge,
}: {
  tx: Transaction
  expanded: boolean
  onToggle: () => void
  onVoid: () => void
  onSplit: () => void
  onMerge: () => void
}) {
  const canSplitMerge = tx.status === 'open' && tx.mergedIntoId === null
  const canVoid = tx.status !== 'void'

  const menuItems: DropdownItem[] = []
  if (canSplitMerge) {
    menuItems.push(
      { label: 'Split Bill', icon: <Users />, onSelect: onSplit },
      { label: 'Merge Bill', icon: <GitMerge />, onSelect: onMerge }
    )
  }
  if (canVoid) {
    if (menuItems.length > 0) menuItems.push({ label: '', separator: true })
    menuItems.push({ label: 'Batalkan Transaksi', icon: <Ban />, onSelect: onVoid, danger: true })
  }

  return (
    <div className={cn(expanded && 'bg-neutral-50/50')}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-3 sm:p-4 flex items-center gap-2 hover:bg-neutral-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-inset"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-neutral-900 tabular-nums">#{tx.id}</span>
            <Badge tone="neutral" size="sm">
              {ORDER_TYPE_LABELS[tx.orderType]}
              {tx.tableNumber && ` · Meja ${tx.tableNumber}`}
            </Badge>
            <Badge tone={STATUS_TONE[tx.status]} size="sm">
              {tx.status}
            </Badge>
            {tx.paymentMethod && (
              <span className="text-caption text-neutral-500">
                {PAYMENT_LABEL[tx.paymentMethod]}
                {tx.paymentBank && ` · ${tx.paymentBank}`}
              </span>
            )}
          </div>
          <div className="text-caption text-neutral-500 mt-0.5">
            {formatDateTime(tx.createdAt)} · oleh {tx.createdByName}
            {tx.createdByName !== tx.shiftCashierName && (
              <span className="text-neutral-400"> · shift {tx.shiftCashierName}</span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="font-semibold text-neutral-900 tabular-nums">
            {formatCurrency(tx.total || tx.subtotal)}
          </p>
          <p className="text-caption text-neutral-500">{tx.items.length} item</p>
        </div>
        {menuItems.length > 0 && (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu
              trigger={
                <button
                  type="button"
                  aria-label="Aksi"
                  className="h-9 w-9 inline-flex items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              }
              items={menuItems}
              align="end"
            />
          </div>
        )}
      </button>

      {expanded && (
        <div className="px-3 sm:px-4 pb-4 pl-9 sm:pl-10 -mt-1">
          <div className="rounded-lg border border-neutral-200/60 bg-white p-3">
            <ul className="text-body-sm space-y-1.5 mb-3">
              {tx.items.map((it) => (
                <li key={it.id} className="flex justify-between text-neutral-800 gap-2">
                  <span className="min-w-0">
                    {it.menuName} <span className="text-neutral-500 tabular-nums">× {it.qty}</span>
                    {it.subOptionsSelected && (
                      <span className="ml-1.5 text-caption text-primary-700">
                        ({Object.values(it.subOptionsSelected).join(', ')})
                      </span>
                    )}
                  </span>
                  <span className="text-neutral-900 tabular-nums shrink-0">
                    {formatCurrency(it.subtotal)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="text-body-sm text-neutral-700 space-y-0.5 pt-3 border-t border-neutral-100 tabular-nums">
              <Row label="Subtotal" value={formatCurrency(tx.subtotal)} />
              {tx.discountAmount > 0 && (
                <Row label="Diskon" value={`− ${formatCurrency(tx.discountAmount)}`} tone="warning" />
              )}
              {tx.taxAmount > 0 && <Row label="PB1 10%" value={formatCurrency(tx.taxAmount)} />}
              <div className="pt-1.5 mt-1 border-t border-neutral-100">
                <Row label="Total" value={formatCurrency(tx.total)} bold />
              </div>
            </div>
            {tx.mergedIntoId !== null && (
              <p className="mt-2 text-caption text-neutral-500 italic">
                Merged ke transaksi #{tx.mergedIntoId}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Row({
  label,
  value,
  bold,
  tone,
}: {
  label: string
  value: string
  bold?: boolean
  tone?: 'warning'
}) {
  return (
    <div className="flex justify-between">
      <span className={cn(bold && 'font-semibold')}>{label}</span>
      <span className={cn(bold && 'font-semibold text-neutral-900', tone === 'warning' && 'text-warning-700')}>
        {value}
      </span>
    </div>
  )
}
