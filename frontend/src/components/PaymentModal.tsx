// REV 2.5 PaymentModal - stateful, 2 mode (single tender / split tender) + Combine
// Tables overlay. Sebelumnya dumb (subtotal prop + onConfirm callback); sekarang owns
// query + addPayment/removePayment mutations untuk handle multi-slice payment flow.
//
// Props minimal: transactionId + tableNumber (untuk Combine button) + onClose +
// onSuccess. POSPage hanya pass id target Tx (sudah merged kalau multi-Pesanan).
//
// Mode determination:
//   - payments.length === 0 → default 'single'. Toggle visible.
//   - payments.length > 0   → forced 'split' (lock toggle, hidden).
//
// Discount lock (per backend addPayment superRefine):
//   - First slice: editable.
//   - Setelah slice pertama: disabled (display lock + value preserved dari first slice).
//
// Aggregate subtotal compute:
//   - Before first slice: target.subtotal + sum(mergedFromOpen.subtotal). Hitung FE.
//   - After first slice: backend sudah set target.total = effectiveTotal aggregate-based.
//
// Auto-close: useEffect watch transaction.status === 'paid' → setTimeout 600ms → onSuccess()
// supaya toast sempat tampil sebelum modal tutup.

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Receipt,
  Banknote,
  CreditCard,
  QrCode,
  Bike,
  Truck,
  ArrowLeftRight,
  Link2,
  Loader2,
  Trash2,
  Plus,
  Check,
  Unlink,
} from 'lucide-react'
import {
  PAYMENT_METHODS,
  PAYMENT_LABEL,
  type PaymentMethod,
  type Transaction,
  type TransactionPayment,
} from '@/types'
import { transactionService, type AddPaymentPayload } from '@/services/transactionService'
import { formatCurrency, cn } from '@/lib/utils'
import { calculatePB1 } from '@/lib/decimal'
import {
  Dialog,
  Button,
  Input,
  ComboboxFree,
  type ComboboxOption,
  Badge,
} from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'
import { useConfirm } from '@/design-system/hooks/useConfirm'
import CombineTableModal from './CombineTableModal'

interface PaymentModalProps {
  transactionId: number
  /** TableId untuk Combine Tables overlay. null = takeaway (combine button hidden). */
  tableNumber: number | null
  onClose: () => void
  /** Dipanggil setelah Tx fully paid (status='paid'). */
  onSuccess: () => void
}

type Mode = 'single' | 'split'

const METHOD_ICON: Record<PaymentMethod, typeof Banknote> = {
  cash: Banknote,
  edc: CreditCard,
  qris: QrCode,
  gojek: Bike,
  grab: Truck,
  transfer: ArrowLeftRight,
}

const RECENT_BANKS_KEY = 'pos.recent-banks'
const RECENT_BANKS_MAX = 6

function loadRecentBanks(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_BANKS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function saveRecentBank(bank: string) {
  const cur = loadRecentBanks()
  const next = [bank, ...cur.filter((b) => b.toLowerCase() !== bank.toLowerCase())].slice(
    0,
    RECENT_BANKS_MAX,
  )
  try {
    localStorage.setItem(RECENT_BANKS_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

export default function PaymentModal({
  transactionId,
  tableNumber,
  onClose,
  onSuccess,
}: PaymentModalProps) {
  const toast = useToast()
  const qc = useQueryClient()
  const confirm = useConfirm()

  // Query target Tx (subscribed - refetch via invalidate setelah mutation).
  const { data: transaction, isLoading: txLoading } = useQuery({
    queryKey: ['transaction', transactionId],
    queryFn: () => transactionService.byId(transactionId),
    refetchOnWindowFocus: false,
  })

  // Query open Tx system-wide untuk derive mergedFrom (untuk aggregate subtotal display).
  // Lightweight - resto cuma punya 9 meja, max ~18 open Tx aktif.
  const { data: openTxs = [] } = useQuery({
    queryKey: ['transactions', 'open-merge-source-of', transactionId],
    queryFn: () => transactionService.list({ status: 'open' }),
    refetchOnWindowFocus: false,
  })

  const mergedFromOpen = useMemo(
    () => openTxs.filter((t) => t.mergedIntoId === transactionId),
    [openTxs, transactionId],
  )

  // Form state
  const [mode, setMode] = useState<Mode>('single')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [bank, setBank] = useState('')
  const [discountAmount, setDiscountAmount] = useState(0)
  const [amount, setAmount] = useState(0)
  const [combineOpen, setCombineOpen] = useState(false)
  const [recentBanks, setRecentBanks] = useState<string[]>([])

  useEffect(() => {
    setRecentBanks(loadRecentBanks())
  }, [])

  // Sync mode: kalau payments sudah ada → force 'split'.
  useEffect(() => {
    if (transaction && transaction.payments.length > 0 && mode !== 'split') {
      setMode('split')
    }
  }, [transaction, mode])

  // Hitung aggregate subtotal + sisa.
  const isFirstSlice = !transaction || transaction.payments.length === 0
  const aggregateSubtotal = useMemo(() => {
    if (!transaction) return 0
    if (isFirstSlice) {
      return transaction.subtotal + mergedFromOpen.reduce((s, t) => s + t.subtotal, 0)
    }
    // After first slice: backend has updated transaction.total aggregate-based.
    // Reverse-derive aggregateSubtotal = total/1.10 + discountAmount.
    return Math.round(transaction.total / 1.1) + transaction.discountAmount
  }, [transaction, mergedFromOpen, isFirstSlice])

  // Effective discount (lock setelah first slice).
  const effectiveDiscount = isFirstSlice ? discountAmount : (transaction?.discountAmount ?? 0)

  const { tax, total, base } = useMemo(
    () => calculatePB1(aggregateSubtotal, effectiveDiscount),
    [aggregateSubtotal, effectiveDiscount],
  )

  const sumPayments = useMemo(
    () => (transaction?.payments ?? []).reduce((s, p) => s + p.amount, 0),
    [transaction],
  )
  const sisa = Math.max(0, total - sumPayments)
  const isPaid = transaction?.status === 'paid'

  // Default amount: tracking sisa di split mode. Single mode tidak pakai amount input.
  useEffect(() => {
    if (mode === 'split' && !isPaid) {
      setAmount(sisa)
    }
  }, [mode, sisa, isPaid])

  // Auto-close on paid. Delay 600ms supaya toast success terlihat.
  useEffect(() => {
    if (!isPaid) return
    const timer = setTimeout(() => onSuccess(), 600)
    return () => clearTimeout(timer)
  }, [isPaid, onSuccess])

  // REV 2.5: filter metode pembayaran by orderType. Per docs/operasional-resto.md:
  //   - dineIn: cash + EDC + QRIS + transfer (4 methods - customer datang ke resto)
  //   - takeaway: + gojek (GoFood) + grab (GrabFood) (6 methods - merchant app settlement)
  // Backend juga validate (defense in depth), tapi UI filter mencegah click yang
  // bakal di-reject.
  const availableMethods = useMemo(() => {
    if (!transaction) return PAYMENT_METHODS
    if (transaction.orderType === 'dineIn') {
      return PAYMENT_METHODS.filter((m) => m.value !== 'gojek' && m.value !== 'grab')
    }
    return PAYMENT_METHODS
  }, [transaction])

  const selectedMethodMeta = PAYMENT_METHODS.find((m) => m.value === method)
  const needsBank = selectedMethodMeta?.needsBank ?? false

  const bankOptions = useMemo<ComboboxOption[]>(() => {
    const defaults = ['BCA', 'Mandiri', 'BNI', 'BRI']
    const merged: string[] = []
    for (const b of [...recentBanks, ...defaults]) {
      if (!merged.some((x) => x.toLowerCase() === b.toLowerCase())) merged.push(b)
    }
    return merged.map((b, idx) => ({
      value: b,
      label: b,
      helper: idx < recentBanks.length ? 'terakhir dipakai' : undefined,
    }))
  }, [recentBanks])

  // Mutations
  const addPayMutation = useMutation({
    mutationFn: (payload: AddPaymentPayload) =>
      transactionService.addPayment(transactionId, payload),
    onSuccess: (tx) => {
      if (tx.status === 'paid') {
        toast.success(`Pembayaran ${formatCurrency(tx.total)} berhasil`)
      } else {
        toast.success('Slice pembayaran ditambahkan')
      }
      // Invalidate Tx + dashboards + table view.
      qc.invalidateQueries({ queryKey: ['transaction', transactionId] })
      qc.invalidateQueries({ queryKey: ['transactions', 'open-merge-source-of', transactionId] })
      qc.invalidateQueries({ queryKey: ['transactions', 'byTable', tableNumber] })
      qc.invalidateQueries({ queryKey: ['transactions', 'open-today'] })
      qc.invalidateQueries({ queryKey: ['transactions', 'openTakeaway'] })
      qc.invalidateQueries({ queryKey: ['cashierDashboard'] })
      qc.invalidateQueries({ queryKey: ['ownerReport'] })
      qc.invalidateQueries({ queryKey: ['menus', 'pos'] })
      // Reset form fields untuk slice berikutnya (split mode).
      if (tx.status !== 'paid') {
        setBank('')
        // amount akan re-default ke sisa via effect
      }
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal proses pembayaran'),
  })

  const removePayMutation = useMutation({
    mutationFn: (paymentId: number) =>
      transactionService.removePayment(transactionId, paymentId),
    onSuccess: () => {
      toast.success('Slice pembayaran dihapus')
      qc.invalidateQueries({ queryKey: ['transaction', transactionId] })
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal hapus slice'),
  })

  // REV 2.5: unmerge - lepas source meja dari gabungan. Hanya valid kalau target
  // belum ada payment slice (aggregate belum locked). Sekaligus refetch open Tx
  // list supaya mergedFromOpen ter-update + tableNumber-nya muncul lagi di TablesPage.
  const unmergeMutation = useMutation({
    mutationFn: (sourceId: number) => transactionService.unmerge(sourceId),
    onSuccess: () => {
      toast.success('Meja dilepas dari gabungan')
      qc.invalidateQueries({ queryKey: ['transaction', transactionId] })
      qc.invalidateQueries({ queryKey: ['transactions', 'open-merge-source-of', transactionId] })
      qc.invalidateQueries({ queryKey: ['transactions', 'open-today'] })
      qc.invalidateQueries({ queryKey: ['transactions', 'byTable', tableNumber] })
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal lepas merge'),
  })

  // Handlers
  // REV 2.5: konfirmasi terakhir sebelum mutate - safety net untuk mengurangi miss-click
  // kasir saat input cepat. Pesan kontekstual: include method + bank + diskon (single)
  // atau sisa-after + lunas hint (split). Sekali user click "Ya", payment ter-record
  // permanently di backend (cuma bisa di-remove via Trash button per slice di split mode).
  const handleSingleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!transaction || isPaid) return
    if (needsBank && !bank.trim()) return
    if (discountAmount > aggregateSubtotal) return
    const finalBank = needsBank ? bank.trim() : undefined
    const methodDisplay = `${PAYMENT_LABEL[method]}${finalBank ? ` · ${finalBank}` : ''}`
    const ok = await confirm({
      title: `Konfirmasi bayar ${formatCurrency(total)}?`,
      description: (
        <span>
          Metode: <strong>{methodDisplay}</strong>
          {discountAmount > 0 && (
            <>
              <br />
              Diskon: <strong>{formatCurrency(discountAmount)}</strong>
            </>
          )}
          <br />
          Transaksi akan ditandai <strong>lunas</strong> setelah dikonfirmasi.
        </span>
      ),
      confirmText: 'Ya, Bayar',
      cancelText: 'Cek Lagi',
    })
    if (!ok) return
    if (finalBank) saveRecentBank(finalBank)
    addPayMutation.mutate({
      method,
      bank: finalBank,
      amount: total,
      discountAmount,
    })
  }

  const handleAddSlice = async (e: FormEvent) => {
    e.preventDefault()
    if (!transaction || isPaid) return
    if (amount <= 0 || amount > sisa) return
    if (needsBank && !bank.trim()) return
    if (isFirstSlice && discountAmount > aggregateSubtotal) return
    const finalBank = needsBank ? bank.trim() : undefined
    const methodDisplay = `${PAYMENT_LABEL[method]}${finalBank ? ` · ${finalBank}` : ''}`
    const willCloseTx = amount >= sisa
    const sisaAfter = Math.max(0, sisa - amount)
    const ok = await confirm({
      title: `Tambah pembayaran ${formatCurrency(amount)}?`,
      description: (
        <span>
          Metode: <strong>{methodDisplay}</strong>
          {isFirstSlice && discountAmount > 0 && (
            <>
              <br />
              Diskon: <strong>{formatCurrency(discountAmount)}</strong>
            </>
          )}
          <br />
          {willCloseTx ? (
            <>
              Slice ini menutup sisa — transaksi akan menjadi <strong>lunas</strong>.
            </>
          ) : (
            <>
              Sisa setelah ini: <strong>{formatCurrency(sisaAfter)}</strong>
            </>
          )}
        </span>
      ),
      confirmText: willCloseTx ? 'Ya, Selesaikan' : 'Ya, Tambah',
      cancelText: 'Cek Lagi',
    })
    if (!ok) return
    if (finalBank) saveRecentBank(finalBank)
    addPayMutation.mutate({
      method,
      bank: finalBank,
      amount,
      // discountAmount HANYA dikirim di first slice. Backend reject kalau slice ke-2+ kirim > 0.
      discountAmount: isFirstSlice ? discountAmount : undefined,
    })
  }

  const handleRemoveSlice = (paymentId: number) => {
    removePayMutation.mutate(paymentId)
  }

  const handleCombineSuccess = () => {
    setCombineOpen(false)
    qc.invalidateQueries({ queryKey: ['transaction', transactionId] })
    qc.invalidateQueries({ queryKey: ['transactions', 'open-merge-source-of', transactionId] })
    qc.invalidateQueries({ queryKey: ['transactions', 'open-today'] })
    qc.invalidateQueries({ queryKey: ['transactions', 'byTable', tableNumber] })
  }

  // Submit disable conditions
  const singleSubmitDisabled =
    addPayMutation.isPending ||
    (needsBank && !bank.trim()) ||
    discountAmount > aggregateSubtotal ||
    aggregateSubtotal <= 0

  const sliceSubmitDisabled =
    addPayMutation.isPending ||
    amount <= 0 ||
    amount > sisa ||
    (needsBank && !bank.trim()) ||
    (isFirstSlice && discountAmount > aggregateSubtotal)

  // Render
  if (txLoading || !transaction) {
    return (
      <Dialog
        open
        onOpenChange={(o) => !o && onClose()}
        title="Pembayaran"
        size="md"
      >
        <div className="text-center py-8 text-neutral-500">
          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
        </div>
      </Dialog>
    )
  }

  const modeToggleHidden = transaction.payments.length > 0
  const showCombineButton = tableNumber !== null && !isPaid

  return (
    <>
      <Dialog
        open
        onOpenChange={(o) => !o && onClose()}
        title={
          <span className="inline-flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary-600" />
            Pembayaran
            {mode === 'split' && (
              <Badge tone="primary" size="sm">
                Bayar Sebagian
              </Badge>
            )}
          </span>
        }
        description={
          <span className="tabular-nums">
            Tx #{transaction.id}
            {tableNumber !== null && ` · Meja ${tableNumber}`}
            {mergedFromOpen.length > 0 &&
              ` · ${mergedFromOpen.length} tagihan digabung`}
          </span>
        }
        size="md"
        preventOutsideClose={addPayMutation.isPending || removePayMutation.isPending}
        footer={
          mode === 'single' ? (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              form="payment-single-form"
              type="submit"
              loading={addPayMutation.isPending}
              disabled={singleSubmitDisabled}
            >
              {addPayMutation.isPending
                ? 'Memproses…'
                : `Konfirmasi · ${formatCurrency(total)}`}
            </Button>
          ) : isPaid ? (
            <Button variant="primary" size="lg" fullWidth onClick={onSuccess}>
              <Check className="w-5 h-5" />
              Selesai
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              form="payment-slice-form"
              type="submit"
              loading={addPayMutation.isPending}
              disabled={sliceSubmitDisabled}
            >
              <Plus className="w-5 h-5" />
              Tambah Pembayaran · {formatCurrency(amount)}
            </Button>
          )
        }
      >
        <div className="space-y-4">
          {/* Combine Tables + Mode toggle row */}
          {(showCombineButton || !modeToggleHidden) && (
            <div className="flex flex-wrap gap-2">
              {showCombineButton && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCombineOpen(true)}
                >
                  <Link2 className="w-4 h-4" />
                  Gabung Meja Lain
                </Button>
              )}
              {!modeToggleHidden && (
                <ModeToggle mode={mode} onChange={setMode} />
              )}
            </div>
          )}

          {/* REV 2.5: merged sources panel - detail meja-meja yang ter-merge ke
              Tx ini + action [×] unmerge per row. Hanya tampil kalau ada source
              open. Unmerge locked kalau sudah ada payment slice (aggregate locked). */}
          {mergedFromOpen.length > 0 && (
            <MergedSourcesPanel
              sources={mergedFromOpen}
              targetTableNumber={tableNumber}
              onUnmerge={(sourceId) => unmergeMutation.mutate(sourceId)}
              unmerging={unmergeMutation.isPending}
              locked={transaction.payments.length > 0 || isPaid}
            />
          )}

          {/* Sisa indicator - split mode only */}
          {mode === 'split' && (
            <div
              className={cn(
                'rounded-xl border p-3 tabular-nums',
                isPaid
                  ? 'bg-success-50 border-success-200'
                  : 'bg-primary-50/50 border-primary-100',
              )}
            >
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Total" value={formatCurrency(total)} tone="neutral" />
                <Stat
                  label="Sudah Bayar"
                  value={formatCurrency(sumPayments)}
                  tone="neutral"
                />
                <Stat
                  label={isPaid ? 'Lunas' : 'Sisa'}
                  value={formatCurrency(sisa)}
                  tone={isPaid ? 'success' : 'primary'}
                  emphasis
                />
              </div>
            </div>
          )}

          {/* Slice list - split mode only, kalau ada slices */}
          {mode === 'split' && transaction.payments.length > 0 && (
            <PaymentSlicesList
              slices={transaction.payments}
              onRemove={handleRemoveSlice}
              removing={removePayMutation.isPending}
              locked={isPaid}
            />
          )}

          {/* Form submit area - hidden saat sudah paid */}
          {!isPaid && (
            <>
              {mode === 'single' ? (
                <form id="payment-single-form" onSubmit={handleSingleSubmit} className="space-y-4">
                  <MethodGrid methods={availableMethods} method={method} onChange={(m) => {
                    setMethod(m)
                    if (!PAYMENT_METHODS.find((mt) => mt.value === m)?.needsBank) setBank('')
                  }} />
                  {needsBank && (
                    <ComboboxFree
                      label={`Bank (${selectedMethodMeta?.label})`}
                      value={bank}
                      onValueChange={setBank}
                      options={bankOptions}
                      placeholder="Pilih atau ketik bank..."
                      searchPlaceholder="Cari atau ketik nama bank..."
                      emptyText="Belum ada bank tersimpan"
                      addLabel="Pakai bank"
                      helper={recentBanks.length > 0 ? 'Bank terakhir muncul di daftar' : undefined}
                    />
                  )}
                  <Input
                    label="Diskon (opsional)"
                    type="number"
                    inputMode="numeric"
                    value={discountAmount || ''}
                    onChange={(e) =>
                      setDiscountAmount(Math.max(0, Number(e.target.value) || 0))
                    }
                    min={0}
                    max={aggregateSubtotal}
                    // step=100 (ratusan) - min unit mata uang Indonesia.
                    step={100}
                    placeholder="0"
                    error={
                      discountAmount > aggregateSubtotal
                        ? 'Diskon tidak boleh melebihi subtotal.'
                        : undefined
                    }
                    helper="Pakai untuk pelanggan langganan / promo manual."
                  />
                  <PaymentBreakdown
                    subtotal={aggregateSubtotal}
                    discount={discountAmount}
                    base={base}
                    tax={tax}
                    total={total}
                  />
                </form>
              ) : (
                <form id="payment-slice-form" onSubmit={handleAddSlice} className="space-y-4">
                  <MethodGrid methods={availableMethods} method={method} onChange={(m) => {
                    setMethod(m)
                    if (!PAYMENT_METHODS.find((mt) => mt.value === m)?.needsBank) setBank('')
                  }} />
                  {needsBank && (
                    <ComboboxFree
                      label={`Bank (${selectedMethodMeta?.label})`}
                      value={bank}
                      onValueChange={setBank}
                      options={bankOptions}
                      placeholder="Pilih atau ketik bank..."
                      searchPlaceholder="Cari atau ketik nama bank..."
                      emptyText="Belum ada bank tersimpan"
                      addLabel="Pakai bank"
                    />
                  )}
                  <div>
                    <Input
                      label="Nominal Pembayaran"
                      type="number"
                      inputMode="numeric"
                      value={amount || ''}
                      onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
                      // HTML5 number validation: nilai valid = (value - min) / step integer.
                      // min=100 + step=100 → boundary 100, 200, ..., 20000 ✓.
                      // Sebelumnya min=1 + step=100 → boundary 1, 101, ..., 19901, 20001
                      // → input 20000 reject. min=100 = pembayaran minimal Rp 100 (1 unit
                      // mata uang terkecil), masuk akal.
                      min={100}
                      max={sisa}
                      // step=100 - min unit mata uang Indonesia adalah ratusan (Rp 100).
                      // Tidak ada koin/uang puluhan/satuan.
                      step={100}
                      placeholder="0"
                      error={
                        amount > sisa
                          ? `Melebihi sisa Rp ${formatCurrency(sisa).replace('Rp', '').trim()}`
                          : undefined
                      }
                      autoFocus
                    />
                    {amount !== sisa && sisa > 0 && (
                      <button
                        type="button"
                        onClick={() => setAmount(sisa)}
                        className="mt-1.5 text-caption text-primary-600 hover:text-primary-700 underline-offset-2 hover:underline"
                      >
                        Isi sisa ({formatCurrency(sisa)})
                      </button>
                    )}
                  </div>
                  <Input
                    label="Diskon (opsional)"
                    type="number"
                    inputMode="numeric"
                    value={isFirstSlice ? (discountAmount || '') : (effectiveDiscount || '')}
                    onChange={(e) =>
                      setDiscountAmount(Math.max(0, Number(e.target.value) || 0))
                    }
                    min={0}
                    max={aggregateSubtotal}
                    // step=100 (ratusan) - min unit mata uang Indonesia.
                    step={100}
                    placeholder="0"
                    disabled={!isFirstSlice}
                    error={
                      isFirstSlice && discountAmount > aggregateSubtotal
                        ? 'Diskon tidak boleh melebihi subtotal.'
                        : undefined
                    }
                    helper={
                      isFirstSlice
                        ? 'Hanya bisa di-set saat pembayaran pertama.'
                        : 'Terkunci setelah pembayaran pertama.'
                    }
                  />
                  <PaymentBreakdown
                    subtotal={aggregateSubtotal}
                    discount={effectiveDiscount}
                    base={base}
                    tax={tax}
                    total={total}
                  />
                </form>
              )}
            </>
          )}
        </div>
      </Dialog>

      {/* Combine Tables overlay - PaymentModal sebagai target meja */}
      {combineOpen && tableNumber !== null && (
        <CombineTableModal
          targetTableId={tableNumber}
          onClose={() => setCombineOpen(false)}
          onSuccess={handleCombineSuccess}
        />
      )}
    </>
  )
}

// ============================================================
// Sub-components
// ============================================================

function MergedSourcesPanel({
  sources,
  targetTableNumber,
  onUnmerge,
  unmerging,
  locked,
}: {
  sources: Transaction[]
  targetTableNumber: number | null
  onUnmerge: (sourceId: number) => void
  unmerging: boolean
  locked: boolean
}) {
  return (
    <div className="rounded-xl border border-primary-200 bg-primary-50/40 p-3 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-label text-primary-800">
          Tagihan gabungan ({sources.length} meja)
        </p>
        {locked && (
          <span className="text-caption text-neutral-500 italic">
            Terkunci (sudah ada pembayaran)
          </span>
        )}
      </div>
      <ul className="space-y-1.5">
        {sources.map((s) => {
          const label =
            s.tableNumber !== null
              ? `Meja ${s.tableNumber}`
              : 'Takeaway'
          return (
            <li
              key={s.id}
              className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-primary-100"
            >
              <div className="flex-1 min-w-0">
                <p className="text-body-sm font-medium text-neutral-900 inline-flex items-center gap-2">
                  {label}
                  <Badge tone="neutral" size="sm">
                    #{s.id}
                  </Badge>
                  <span className="text-caption text-neutral-500">
                    {s.items.length} item
                  </span>
                </p>
              </div>
              <span className="text-body-sm font-semibold text-neutral-900 tabular-nums whitespace-nowrap">
                {formatCurrency(s.subtotal)}
              </span>
              {!locked && (
                <button
                  type="button"
                  onClick={() => onUnmerge(s.id)}
                  disabled={unmerging}
                  aria-label={`Lepas ${label} dari gabungan`}
                  title={`Lepas ${label} dari gabungan${targetTableNumber !== null ? ` Meja ${targetTableNumber}` : ''}`}
                  className={cn(
                    'h-8 w-8 inline-flex items-center justify-center rounded-md text-neutral-500 transition-colors',
                    'hover:bg-warning-50 hover:text-warning-700 active:bg-warning-100',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning-500/40',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                  )}
                >
                  <Unlink className="w-4 h-4" />
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div
      role="radiogroup"
      aria-label="Mode pembayaran"
      className="inline-flex rounded-lg border border-neutral-300 bg-white p-0.5"
    >
      {(['single', 'split'] as const).map((m) => {
        const active = mode === m
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(m)}
            className={cn(
              'min-h-[36px] px-3 rounded-md text-body-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
              active
                ? 'bg-primary-50 text-primary-800 ring-1 ring-primary-500/40'
                : 'text-neutral-600 hover:bg-neutral-50',
            )}
          >
            {m === 'single' ? 'Bayar Penuh' : 'Bayar Sebagian'}
          </button>
        )
      })}
    </div>
  )
}

function MethodGrid({
  methods,
  method,
  onChange,
}: {
  /** REV 2.5: filtered list - dineIn exclude gojek/grab (takeaway-only methods). */
  methods: typeof PAYMENT_METHODS
  method: PaymentMethod
  onChange: (m: PaymentMethod) => void
}) {
  return (
    <div>
      <p className="text-label text-neutral-700 mb-2">Metode Pembayaran</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {methods.map((m) => {
          const Icon = METHOD_ICON[m.value]
          const active = method === m.value
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => onChange(m.value)}
              aria-pressed={active}
              className={cn(
                'min-h-[72px] py-3 px-2 rounded-lg border text-body-sm font-medium transition-colors',
                'flex flex-col items-center justify-center gap-1.5',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
                active
                  ? 'bg-primary-50 border-primary-500 text-primary-800 ring-1 ring-primary-500/40'
                  : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50 active:bg-neutral-100',
              )}
            >
              <Icon
                className={cn('w-5 h-5', active ? 'text-primary-600' : 'text-neutral-500')}
              />
              <span className="leading-tight text-center">{m.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PaymentSlicesList({
  slices,
  onRemove,
  removing,
  locked,
}: {
  slices: TransactionPayment[]
  onRemove: (paymentId: number) => void
  removing: boolean
  locked: boolean
}) {
  return (
    <div>
      <p className="text-label text-neutral-700 mb-2">
        Riwayat pembayaran ({slices.length})
      </p>
      <div className="space-y-2">
        {slices.map((slice, idx) => {
          const Icon = METHOD_ICON[slice.method]
          return (
            <div
              key={slice.id}
              className="flex items-center gap-3 p-2.5 rounded-lg bg-neutral-50/80 border border-neutral-200/60"
            >
              <span className="h-7 w-7 shrink-0 rounded-md bg-white border border-neutral-200 inline-flex items-center justify-center text-primary-600">
                <Icon className="w-3.5 h-3.5" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-body-sm font-medium text-neutral-900 inline-flex items-center gap-2">
                  #{idx + 1} · {PAYMENT_LABEL[slice.method]}
                  {slice.bank && (
                    <Badge tone="neutral" size="sm">
                      {slice.bank}
                    </Badge>
                  )}
                </p>
                <p className="text-caption text-neutral-500">
                  Oleh {slice.recordedByName}
                </p>
              </div>
              <span className="text-body-sm font-semibold text-neutral-900 tabular-nums whitespace-nowrap">
                {formatCurrency(slice.amount)}
              </span>
              {!locked && (
                <button
                  type="button"
                  onClick={() => onRemove(slice.id)}
                  disabled={removing}
                  aria-label={`Hapus pembayaran #${idx + 1}`}
                  className={cn(
                    'h-8 w-8 inline-flex items-center justify-center rounded-md text-danger-600 transition-colors',
                    'hover:bg-danger-50 active:bg-danger-100',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500/40',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                  )}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PaymentBreakdown({
  subtotal,
  discount,
  base,
  tax,
  total,
}: {
  subtotal: number
  discount: number
  base: number
  tax: number
  total: number
}) {
  return (
    <div className="bg-primary-50/50 border border-primary-100 rounded-xl p-3.5 space-y-1.5 tabular-nums">
      <Row label="Subtotal" value={formatCurrency(subtotal)} muted />
      {discount > 0 && (
        <Row label="Diskon" value={`− ${formatCurrency(discount)}`} muted />
      )}
      <Row label="Setelah diskon" value={formatCurrency(base)} muted />
      <Row label="PB1 10%" value={formatCurrency(tax)} muted />
      <div className="pt-2 mt-1 border-t border-primary-200">
        <Row label="Total Bayar" value={formatCurrency(total)} bold />
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  muted,
  bold,
}: {
  label: string
  value: string
  muted?: boolean
  bold?: boolean
}) {
  return (
    <div className="flex justify-between items-baseline">
      <span
        className={cn(
          'text-body-sm',
          muted ? 'text-neutral-600' : 'text-neutral-900',
          bold && 'font-semibold',
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'text-body',
          bold ? 'font-bold text-primary-700 text-title' : 'font-medium text-neutral-900',
        )}
      >
        {value}
      </span>
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
  emphasis,
}: {
  label: string
  value: string
  tone: 'neutral' | 'primary' | 'success'
  emphasis?: boolean
}) {
  const toneClass =
    tone === 'success'
      ? 'text-success-700'
      : tone === 'primary'
        ? 'text-primary-700'
        : 'text-neutral-800'
  return (
    <div>
      <p className="text-caption text-neutral-500">{label}</p>
      <p
        className={cn(
          'tabular-nums',
          emphasis ? 'text-title font-bold' : 'text-body font-semibold',
          toneClass,
        )}
      >
        {value}
      </p>
    </div>
  )
}
