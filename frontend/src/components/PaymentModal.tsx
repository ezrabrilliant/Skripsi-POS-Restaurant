// REV 2.3 PaymentModal — 6 payment methods + bank picker (EDC/transfer).
// PB1 10% precision via calculatePB1 helper. Bank picker pakai datalist
// dengan recent-banks localStorage. Mobile: grid 2-col vertical icon-label
// supaya label tidak truncated.

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Receipt,
  Banknote,
  CreditCard,
  QrCode,
  Bike,
  Truck,
  ArrowLeftRight,
} from 'lucide-react'
import { PAYMENT_METHODS, type PaymentMethod } from '@/types'
import { formatCurrency, cn } from '@/lib/utils'
import { calculatePB1 } from '@/lib/decimal'
import { Dialog, Button, Input } from '@/design-system/primitives'

interface PaymentFormData {
  paymentMethod: PaymentMethod
  paymentBank?: string
  discountAmount: number
}

interface Props {
  subtotal: number
  knownBanks?: string[]
  onClose: () => void
  onConfirm: (data: PaymentFormData) => void
  isSubmitting?: boolean
}

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
    RECENT_BANKS_MAX
  )
  try {
    localStorage.setItem(RECENT_BANKS_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

export default function PaymentModal({
  subtotal,
  knownBanks: defaultBanks = ['BCA', 'Mandiri', 'BNI', 'BRI', 'CIMB'],
  onClose,
  onConfirm,
  isSubmitting,
}: Props) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [paymentBank, setPaymentBank] = useState('')
  const [discountAmount, setDiscountAmount] = useState(0)
  const [recentBanks, setRecentBanks] = useState<string[]>([])

  useEffect(() => {
    setRecentBanks(loadRecentBanks())
  }, [])

  const selectedMethodMeta = PAYMENT_METHODS.find((m) => m.value === paymentMethod)
  const needsBank = selectedMethodMeta?.needsBank ?? false

  const { tax, total, base } = useMemo(
    () => calculatePB1(subtotal, discountAmount),
    [subtotal, discountAmount]
  )

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (discountAmount > subtotal) return
    if (needsBank && !paymentBank.trim()) return
    const finalBank = needsBank ? paymentBank.trim() : undefined
    if (finalBank) saveRecentBank(finalBank)
    onConfirm({
      paymentMethod,
      paymentBank: finalBank,
      discountAmount,
    })
  }

  // Merge recent + default tanpa duplikat
  const bankSuggestions = useMemo(() => {
    const merged: string[] = []
    for (const b of [...recentBanks, ...defaultBanks]) {
      if (!merged.some((x) => x.toLowerCase() === b.toLowerCase())) merged.push(b)
    }
    return merged
  }, [recentBanks, defaultBanks])

  const submitDisabled =
    isSubmitting || (needsBank && !paymentBank.trim()) || discountAmount > subtotal

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Pembayaran"
      description={<><Receipt className="inline w-4 h-4 mr-1 -mt-0.5 text-primary-600" />Subtotal {formatCurrency(subtotal)}</>}
      size="md"
      preventOutsideClose={isSubmitting}
      footer={
        <Button
          variant="primary"
          size="lg"
          fullWidth
          form="payment-form"
          type="submit"
          loading={isSubmitting}
          disabled={submitDisabled}
        >
          {isSubmitting ? 'Memproses…' : `Konfirmasi · ${formatCurrency(total)}`}
        </Button>
      }
    >
      <form id="payment-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Payment method grid */}
        <div>
          <p className="text-label text-neutral-700 mb-2">Metode Pembayaran</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((m) => {
              const Icon = METHOD_ICON[m.value]
              const active = paymentMethod === m.value
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => {
                    setPaymentMethod(m.value)
                    if (!m.needsBank) setPaymentBank('')
                  }}
                  aria-pressed={active}
                  className={cn(
                    'min-h-[72px] py-3 px-2 rounded-lg border text-body-sm font-medium transition-colors',
                    'flex flex-col items-center justify-center gap-1.5',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
                    active
                      ? 'bg-primary-50 border-primary-500 text-primary-800 ring-1 ring-primary-500/40'
                      : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50 active:bg-neutral-100'
                  )}
                >
                  <Icon className={cn('w-5 h-5', active ? 'text-primary-600' : 'text-neutral-500')} />
                  <span className="leading-tight text-center">{m.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Bank picker (EDC/transfer) */}
        {needsBank && (
          <div>
            <Input
              label={`Bank (${selectedMethodMeta?.label})`}
              list="known-banks"
              type="text"
              value={paymentBank}
              onChange={(e) => setPaymentBank(e.target.value)}
              placeholder="Mis. BCA, Mandiri…"
              autoComplete="off"
              required
              helper={recentBanks.length > 0 ? 'Bank terakhir muncul di list autocomplete' : undefined}
            />
            <datalist id="known-banks">
              {bankSuggestions.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>
        )}

        {/* Discount */}
        <Input
          label="Diskon (opsional)"
          type="number"
          inputMode="numeric"
          value={discountAmount || ''}
          onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value) || 0))}
          min={0}
          max={subtotal}
          step={1000}
          placeholder="0"
          error={discountAmount > subtotal ? 'Diskon tidak boleh melebihi subtotal.' : undefined}
          helper="Pakai untuk pelanggan langganan / promo manual."
        />

        {/* Breakdown summary */}
        <div className="bg-primary-50/50 border border-primary-100 rounded-xl p-3.5 space-y-1.5 tabular-nums">
          <Row label="Subtotal" value={formatCurrency(subtotal)} muted />
          {discountAmount > 0 && (
            <Row label="Diskon" value={`− ${formatCurrency(discountAmount)}`} muted />
          )}
          <Row label="Setelah diskon" value={formatCurrency(base)} muted />
          <Row label="PB1 10%" value={formatCurrency(tax)} muted />
          <div className="pt-2 mt-1 border-t border-primary-200">
            <Row label="Total Bayar" value={formatCurrency(total)} bold />
          </div>
        </div>
      </form>
    </Dialog>
  )
}

function Row({ label, value, muted, bold }: { label: string; value: string; muted?: boolean; bold?: boolean }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className={cn('text-body-sm', muted ? 'text-neutral-600' : 'text-neutral-900', bold && 'font-semibold')}>
        {label}
      </span>
      <span
        className={cn(
          'text-body',
          bold ? 'font-bold text-primary-700 text-title' : 'font-medium text-neutral-900'
        )}
      >
        {value}
      </span>
    </div>
  )
}
