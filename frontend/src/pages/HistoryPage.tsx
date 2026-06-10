// HistoryPage - REV 2.3 base + REV 2.5 cleanup.
// List transaksi dengan filter status/date/orderType. Mobile-first DataTable dengan
// card view + DropdownMenu actions (void). Click row untuk expand detail items +
// payment breakdown.
//
// REV 2.5 changes:
//   - Drop Split Bill + Merge Bill row actions (split bill multi-party dihapus dari
//     scope, merge bill trigger pindah ke TablesPage + PaymentModal).
//   - Drop SplitBillModal + MergeBillModal imports + state.
//   - Refactor payment display dari tx.paymentMethod/paymentBank tunggal jadi iterate
//     tx.payments[] (support split tender N slice).
//   - Tambah audit badges di expanded body:
//       * Tx target (mergedFrom ada) → "🔗 Gabungan dari #A, #B" (clickable scroll)
//       * Tx source (mergedIntoId set) → "🔗 Tergabung ke → #X" (clickable scroll)
//     Click badge → setExpandedId(target) + scrollIntoView.

import { Fragment, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronRight,
  ChevronDown,
  Ban,
  MoreVertical,
  Filter,
  Receipt,
  Link2,
  Wallet,
} from 'lucide-react'
import { transactionService } from '@/services/transactionService'
import PaymentModal from '@/components/PaymentModal'
import { paymentMethodService } from '@/services/paymentMethodService'
import { ORDER_TYPE_LABELS } from '@/types'
import type { TransactionStatus, OrderType, Transaction } from '@/types'
import { formatCurrency, formatDateTime, cn } from '@/lib/utils'
import {
  Button,
  Input,
  Combobox,
  Badge,
  Skeleton,
  EmptyState,
  Sheet,
  DropdownMenu,
  Page,
  type ComboboxOption,
  type DropdownItem,
} from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'
import { useConfirm } from '@/design-system/hooks/useConfirm'
import { useIsMobile } from '@/design-system/hooks/useMediaQuery'

const STATUS_OPTIONS: ComboboxOption[] = [
  { value: 'all', label: 'Semua status' },
  { value: 'open', label: 'Open' },
  { value: 'paid', label: 'Dibayar' },
  { value: 'void', label: 'Void' },
]

const ORDER_TYPE_OPTIONS: ComboboxOption[] = [
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
  // Preset dari URL (?status=open&date=YYYY-MM-DD) — dipakai saat di-redirect dari
  // CloseShiftBlockedModal / OverdueShiftGate supaya mendarat ter-filter pada hari &
  // status yang tepat. Lazy initial state = baca sekali saat mount; user bebas ubah sesudahnya.
  const [searchParams] = useSearchParams()
  const today = new Date().toISOString().substring(0, 10)
  const [filterDate, setFilterDate] = useState(() => searchParams.get('date') || today)
  const [filterStatus, setFilterStatus] = useState<TransactionStatus | 'all'>(() => {
    const s = searchParams.get('status')
    return s === 'open' || s === 'paid' || s === 'void' ? s : 'all'
  })
  const [filterOrderType, setFilterOrderType] = useState<OrderType | 'all'>('all')
  // Tx yang sedang dibayar lewat Riwayat (reuse PaymentModal apa adanya). null = tertutup.
  const [payTx, setPayTx] = useState<Transaction | null>(null)
  // Multi-expand: user bisa buka beberapa Tx sekaligus (mis. target merge + source-nya
  // berdampingan untuk cross-check). Sebelumnya single accordion (expandedId number|null).
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set())
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  const toggleExpanded = (id: number) =>
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', filterDate, filterStatus, filterOrderType],
    queryFn: () =>
      transactionService.list({
        date: filterDate,
        status: filterStatus === 'all' ? undefined : filterStatus,
        orderType: filterOrderType === 'all' ? undefined : filterOrderType,
      }),
    // FIX: key composite ['transactions',date,status,type] TIDAK kena prefix-invalidate
    // dari pembayaran (addPayMutation invalidate ['transactions','open-today'] dll, bukan
    // bare ['transactions']). Tanpa 'always', bayar di POS → balik ke History dalam 5 menit
    // masih menampilkan Tx itu sebagai 'open'. 'always' memaksa refetch tiap halaman dibuka.
    refetchOnMount: 'always',
  })

  // REV 2.6: lookup label dari master payment_methods (sumber: tabel
  // `payment_methods` owner-configurable). Pakai shared queryKey 'active' supaya
  // cache hit dengan PaymentModal. Fallback ke uppercase code kalau method
  // sudah dihapus dari master (historical Tx tetap render readable).
  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['paymentMethods', 'active'],
    queryFn: () => paymentMethodService.list(false),
    staleTime: 5 * 60_000,
  })
  const methodLabelMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const pm of paymentMethods) map.set(pm.code, pm.label)
    return map
  }, [paymentMethods])
  const labelForMethod = (code: string): string =>
    methodLabelMap.get(code) ?? code.toUpperCase()

  // REV 2.5: derive mergedFromMap dari list - untuk setiap Tx target, kumpulkan OBJEK
  // source-nya (bukan cuma id) supaya detail target bisa menampilkan item dari tiap
  // pesanan yang digabung + breakdown rekonsiliasi ke total aggregate. Hanya source
  // yang ikut ter-filter (visible) yang tersedia - target & source selalu satu status
  // + tanggal sama, jadi keduanya muncul/hilang bareng di view ter-filter.
  const mergedFromMap = useMemo(() => {
    const map = new Map<number, Transaction[]>()
    for (const tx of transactions) {
      if (tx.mergedIntoId !== null) {
        const arr = map.get(tx.mergedIntoId) ?? []
        arr.push(tx)
        map.set(tx.mergedIntoId, arr)
      }
    }
    return map
  }, [transactions])

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
      description:
        'Stok akan dikembalikan otomatis dan audit log tercatat. Tindakan tidak bisa di-undo.',
      confirmText: 'Ya, Batalkan',
      tone: 'danger',
    })
    if (!ok) return
    voidMutation.mutate(tx.id)
  }

  // REV 2.5: scroll-to-Tx helper untuk audit badges. Cari node via data-tx-row
  // attribute (DOM query lebih simple daripada ref Map untuk variable-length list).
  const handleScrollToTx = (id: number) => {
    // Multi-expand: tambahkan ke set (jangan ganti) supaya Tx asal tetap terbuka.
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
    requestAnimationFrame(() => {
      const node = document.querySelector(`[data-tx-row="${id}"]`)
      if (node) node.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
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
      <Combobox
        label="Status"
        value={filterStatus}
        onValueChange={(v) => setFilterStatus(v as TransactionStatus | 'all')}
        options={STATUS_OPTIONS}
        searchPlaceholder="Cari status..."
      />
      <Combobox
        label="Tipe Order"
        value={filterOrderType}
        onValueChange={(v) => setFilterOrderType(v as OrderType | 'all')}
        options={ORDER_TYPE_OPTIONS}
        searchPlaceholder="Cari tipe..."
      />
    </div>
  )

  return (
    <Page
      title="Riwayat Transaksi"
      subtitle={
        <>
          {transactions.length} transaksi · total dibayar{' '}
          <span className="font-medium text-neutral-900 tabular-nums">
            {formatCurrency(totalRevenue)}
          </span>
        </>
      }
      actions={
        isMobile ? (
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Filter className="w-4 h-4" />}
            onClick={() => setFilterSheetOpen(true)}
          >
            Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Button>
        ) : undefined
      }
    >
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
                mergedSources={mergedFromMap.get(tx.id) ?? []}
                expanded={expandedIds.has(tx.id)}
                onToggle={() => toggleExpanded(tx.id)}
                onVoid={() => handleVoid(tx)}
                onPay={() => setPayTx(tx)}
                onScrollToTx={handleScrollToTx}
                labelForMethod={labelForMethod}
              />
            ))}
          </div>
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
              <Button
                variant="primary"
                size="md"
                fullWidth
                onClick={() => setFilterSheetOpen(false)}
              >
                Terapkan
              </Button>
            </div>
          </div>
        </Sheet>

        {payTx && (
          <PaymentModal
            transactionId={payTx.id}
            tableNumber={payTx.tableNumber ?? null}
            candidateSourceIds={[]}
            onClose={() => setPayTx(null)}
            onSuccess={() => {
              setPayTx(null)
              // Key komposit ['transactions',date,status,type] kena prefix-invalidate dari
              // ['transactions'] → baris flip dari 'open' ke 'paid'.
              qc.invalidateQueries({ queryKey: ['transactions'] })
            }}
          />
        )}
    </Page>
  )
}

function TransactionRow({
  tx,
  mergedSources,
  expanded,
  onToggle,
  onVoid,
  onPay,
  onScrollToTx,
  labelForMethod,
}: {
  tx: Transaction
  /** Objek Tx source yang di-merge ke Tx ini (merge target). Kosong = bukan target. */
  mergedSources: Transaction[]
  expanded: boolean
  onToggle: () => void
  onVoid: () => void
  /** Buka PaymentModal untuk Tx open ini (dibayar lewat Riwayat). */
  onPay: () => void
  onScrollToTx: (id: number) => void
  /** REV 2.6: lookup label dari master payment_methods (fallback uppercase code). */
  labelForMethod: (code: string) => string
}) {
  const canVoid = tx.status !== 'void'
  // Bayar hanya untuk Tx open yang BUKAN merge-source (source dibayar via parent —
  // konsisten dgn cascade addPayment). Merge target & single tetap bisa dibayar.
  const canPay = tx.status === 'open' && tx.mergedIntoId === null
  const isMergedSource = tx.mergedIntoId !== null
  const isMergedTarget = mergedSources.length > 0
  const hasMergeRelation = isMergedSource || isMergedTarget
  const mergedFromIds = mergedSources.map((s) => s.id)

  // Merge target: subtotal + jumlah item ditampilkan agregat (own + semua source)
  // supaya breakdown item rekonsiliasi ke tx.total (yang sudah aggregate-based saat
  // pembayaran). Non-target: pakai nilai sendiri seperti biasa.
  const sourcesSubtotal = mergedSources.reduce((s, src) => s + src.subtotal, 0)
  const sourcesItemCount = mergedSources.reduce((s, src) => s + src.items.length, 0)
  const displaySubtotal = isMergedTarget ? tx.subtotal + sourcesSubtotal : tx.subtotal
  const displayItemCount = tx.items.length + (isMergedTarget ? sourcesItemCount : 0)

  const menuItems: DropdownItem[] = []
  if (canVoid) {
    menuItems.push({
      label: 'Batalkan Transaksi',
      icon: <Ban />,
      onSelect: onVoid,
      danger: true,
    })
  }

  // REV 2.5: payments display - iterate tx.payments[] supaya support split tender.
  // Single tender (1 slice) tampil compact "Tunai" / "EDC BCA". Multi-slice tampil
  // comma-separated "Tunai + QRIS". Bank dipisah spasi setelah method label.
  const paymentsLabel = tx.payments.length > 0
    ? tx.payments
        .map((p) => (p.bank ? `${labelForMethod(p.method)} ${p.bank}` : labelForMethod(p.method)))
        .join(' + ')
    : null

  return (
    <div
      data-tx-row={tx.id}
      className={cn(expanded && 'bg-neutral-50/50', 'scroll-mt-4')}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 min-w-0 text-left p-3 sm:p-4 flex items-center gap-2 hover:bg-neutral-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-inset"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-neutral-900 tabular-nums inline-flex items-center gap-1">
                #{tx.id}
                {hasMergeRelation && (
                  <Link2
                    className="w-3.5 h-3.5 text-primary-600"
                    aria-label="Transaksi terkait merge"
                  />
                )}
              </span>
              <Badge tone="neutral" size="sm">
                {ORDER_TYPE_LABELS[tx.orderType]}
                {tx.tableNumber && ` · Meja ${tx.tableNumber}`}
              </Badge>
              <Badge tone={STATUS_TONE[tx.status]} size="sm">
                {tx.status}
              </Badge>
              {paymentsLabel && (
                <span className="text-caption text-neutral-500">{paymentsLabel}</span>
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
            {isMergedSource ? (
              // REV 2.5: source Tx post-merge - total=0 setelah cascade pembayaran di
              // parent. Tampilkan label jelas "Digabung" supaya user tidak bingung
              // kira-kira Tx ini terhapus atau masih belum bayar.
              <p className="font-medium text-neutral-500 italic text-body-sm">Digabung</p>
            ) : (
              <p className="font-semibold text-neutral-900 tabular-nums">
                {formatCurrency(tx.total || tx.subtotal)}
              </p>
            )}
            <p className="text-caption text-neutral-500">{displayItemCount} item</p>
          </div>
        </button>
        {canPay && (
          <div className="flex items-center pr-1 sm:pr-2">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Wallet className="w-4 h-4" />}
              onClick={onPay}
            >
              Bayar
            </Button>
          </div>
        )}
        {menuItems.length > 0 && (
          <div className="flex items-center pr-3 sm:pr-4">
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
      </div>

      {expanded && (
        <div className="px-3 sm:px-4 pb-4 pl-9 sm:pl-10 -mt-1 space-y-3">
          {/* REV 2.5: audit badges merge - clickable scroll-to-Tx target. */}
          {hasMergeRelation && (
            <div className="flex flex-wrap items-center gap-2">
              {isMergedTarget && (
                <div className="inline-flex items-center gap-1.5 flex-wrap rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5">
                  <Link2 className="w-3.5 h-3.5 text-primary-600 shrink-0" />
                  <span className="text-caption text-primary-800">Gabungan dari:</span>
                  {mergedFromIds.map((sid) => (
                    <button
                      key={sid}
                      type="button"
                      onClick={() => onScrollToTx(sid)}
                      className="text-caption font-semibold tabular-nums text-primary-700 hover:text-primary-800 hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 rounded px-0.5"
                    >
                      #{sid}
                    </button>
                  ))}
                </div>
              )}
              {isMergedSource && tx.mergedIntoId !== null && (
                <button
                  type="button"
                  onClick={() => onScrollToTx(tx.mergedIntoId!)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                >
                  <Link2 className="w-3.5 h-3.5 text-neutral-600" />
                  <span className="text-caption text-neutral-700">Tergabung ke</span>
                  <span className="text-caption font-semibold tabular-nums text-primary-700">
                    #{tx.mergedIntoId}
                  </span>
                </button>
              )}
            </div>
          )}

          <div className="rounded-lg border border-neutral-200/60 bg-white p-3">
            <ul className="text-body-sm space-y-1.5 mb-3">
              {tx.items.map((it) => (
                <ItemLine key={it.id} item={it} />
              ))}
              {/* Merge target: tampilkan item dari tiap pesanan yang digabung ke Tx ini,
                  dipisah divider "dari #N" supaya kasir lihat asal tiap item +
                  jumlah item rekonsiliasi ke subtotal aggregate di bawah. */}
              {mergedSources.map((src) => (
                <Fragment key={`src-${src.id}`}>
                  <li
                    className="flex items-center gap-2 pt-1.5 select-none"
                    aria-label={`Item dari transaksi #${src.id}`}
                  >
                    <span className="h-px flex-1 bg-primary-200/70" />
                    <span className="text-caption font-medium text-primary-700 shrink-0">
                      dari #{src.id}
                    </span>
                    <span className="h-px flex-1 bg-primary-200/70" />
                  </li>
                  {src.items.map((it) => (
                    <ItemLine key={it.id} item={it} />
                  ))}
                </Fragment>
              ))}
              {tx.items.length === 0 && mergedSources.length === 0 && (
                <li className="text-caption text-neutral-500 italic">
                  Tidak ada item (sudah di-merge ke parent).
                </li>
              )}
            </ul>
            <div className="text-body-sm text-neutral-700 space-y-0.5 pt-3 border-t border-neutral-100 tabular-nums">
              <Row label="Subtotal" value={formatCurrency(displaySubtotal)} />
              {tx.discountAmount > 0 && (
                <Row
                  label="Diskon"
                  value={`− ${formatCurrency(tx.discountAmount)}`}
                  tone="warning"
                />
              )}
              {tx.taxAmount > 0 && (
                <Row label="PB1 10%" value={formatCurrency(tx.taxAmount)} />
              )}
              <div className="pt-1.5 mt-1 border-t border-neutral-100">
                <Row label="Total" value={formatCurrency(tx.total)} bold />
              </div>
            </div>

            {/* REV 2.5: payments breakdown - tampil di expanded body untuk split tender
                detail (header cuma compact summary). */}
            {tx.payments.length > 0 && (
              <div className="mt-3 pt-3 border-t border-neutral-100">
                <p className="text-label text-neutral-600 mb-1.5">
                  Pembayaran ({tx.payments.length} slice
                  {tx.payments.length > 1 ? ' - split tender' : ''})
                </p>
                <ul className="space-y-1 text-body-sm tabular-nums">
                  {tx.payments.map((p, idx) => (
                    <li
                      key={p.id}
                      className="flex justify-between text-neutral-800"
                    >
                      <span className="text-neutral-700">
                        #{idx + 1} · {labelForMethod(p.method)}
                        {p.bank && (
                          <Badge tone="neutral" size="sm" className="ml-1.5">
                            {p.bank}
                          </Badge>
                        )}
                      </span>
                      <span className="font-medium">{formatCurrency(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Satu baris item di expanded detail. Dipakai untuk item milik Tx sendiri maupun
 *  item dari Tx source yang digabung (merge target).
 *
 *  REV 2.10: tampilkan varian + selections (slot paket + free-preference). Legacy
 *  subOptionsSelected dipertahankan sebagai fallback untuk row historis yang tidak
 *  punya selections (pre-REV 2.10). */
function ItemLine({ item }: { item: Transaction['items'][number] }) {
  const selections = item.selections ?? []
  const slotChoices = selections.filter((s) => !s.isPreference)
  const preferences = selections.filter((s) => s.isPreference)
  const hasSelections = selections.length > 0

  return (
    <li className="flex justify-between text-neutral-800 gap-2">
      <span className="min-w-0">
        {item.menuName}{' '}
        <span className="text-neutral-500 tabular-nums">× {item.qty}</span>
        {/* REV 2.10: label varian (mis. "Paha · Bakar") */}
        {item.variantLabel && (
          <span className="ml-1.5 text-caption text-primary-700">{item.variantLabel}</span>
        )}
        {/* REV 2.10: slot paket (chosenLabel per groupOrSlotLabel) */}
        {slotChoices.length > 0 && (
          <span className="mt-0.5 flex flex-wrap gap-1">
            {slotChoices.map((s, i) => (
              <Badge key={`slot-${i}`} tone="primary" size="sm">
                {s.groupOrSlotLabel}: {s.chosenLabel}
              </Badge>
            ))}
          </span>
        )}
        {/* REV 2.10: free-preference (mis. "Suhu: Dingin") */}
        {preferences.length > 0 && (
          <span className="mt-0.5 flex flex-wrap gap-1">
            {preferences.map((s, i) => (
              <Badge key={`pref-${i}`} tone="neutral" size="sm">
                {s.groupOrSlotLabel}: {s.chosenLabel}
              </Badge>
            ))}
          </span>
        )}
        {/* LEGACY fallback: subOptionsSelected hanya kalau tidak ada selections REV 2.10. */}
        {!hasSelections && item.subOptionsSelected && (
          <span className="ml-1.5 text-caption text-primary-700">
            ({Object.values(item.subOptionsSelected).join(', ')})
          </span>
        )}
        {item.notes && (
          <span className="ml-1.5 text-caption text-neutral-500 italic">📝 {item.notes}</span>
        )}
      </span>
      <span className="text-neutral-900 tabular-nums shrink-0">
        {formatCurrency(item.subtotal)}
      </span>
    </li>
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
      <span
        className={cn(
          bold && 'font-semibold text-neutral-900',
          tone === 'warning' && 'text-warning-700',
        )}
      >
        {value}
      </span>
    </div>
  )
}
