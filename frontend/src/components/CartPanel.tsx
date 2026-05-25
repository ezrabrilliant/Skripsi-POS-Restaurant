// REV 2.3 CartPanel — display cart items + order type tab + table picker (dineIn) +
// subtotal + 2 button: Simpan (create transaction tanpa bayar) atau Bayar (create +
// open PaymentModal). subOptionsSelected ditampilkan sebagai chips.
//
// Touch target: qty ± pakai IconButton size=sm (44×44).

import { useState } from 'react'
import { Minus, Plus, Trash2, ShoppingBag, Receipt, Pencil, Inbox } from 'lucide-react'
import { useCartStore, cartSubtotal } from '@/stores/cartStore'
import { ORDER_TYPE_LABELS, type OrderType, type CartItem } from '@/types'
import { formatCurrency, cn } from '@/lib/utils'
import { Button, IconButton, Tabs, Badge, EmptyState, Input } from '@/design-system/primitives'

const TABLE_COUNT = 9 // sesuai backend env TABLE_COUNT

interface Props {
  disabled?: boolean
  onSubmit: () => void
  onSubmitAndPay: () => void
  isSubmitting?: boolean
}

export default function CartPanel({ disabled, onSubmit, onSubmitAndPay, isSubmitting }: Props) {
  const {
    items,
    orderType,
    tableNumber,
    setOrderType,
    setTableNumber,
    updateQty,
    removeItem,
    updateNotes,
  } = useCartStore()

  const total = cartSubtotal(items)
  const itemCount = items.reduce((s, it) => s + it.qty, 0)
  const isEmpty = items.length === 0
  const canSubmit =
    !isEmpty && !disabled && !isSubmitting && (orderType === 'takeaway' || tableNumber !== null)

  return (
    <aside className="bg-white h-full flex flex-col md:border-l border-neutral-200">
      {/* Header */}
      <div className="px-4 pt-3 pb-3 border-b border-neutral-100">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="font-semibold text-neutral-900 flex items-center gap-2 text-title">
            <ShoppingBag className="w-4 h-4 text-primary-600" />
            Keranjang
            {itemCount > 0 && <Badge tone="primary" size="sm">{itemCount} item</Badge>}
          </h3>
        </div>

        {/* Order type tabs */}
        <Tabs
          value={orderType}
          onValueChange={(v) => setOrderType(v as OrderType)}
          items={[
            { value: 'dineIn', label: ORDER_TYPE_LABELS.dineIn },
            { value: 'takeaway', label: ORDER_TYPE_LABELS.takeaway },
          ]}
          variant="segmented"
        />

        {/* Table picker — hanya dineIn */}
        {orderType === 'dineIn' && (
          <div className="mt-3">
            <p className="text-label text-neutral-600 mb-1.5">Pilih meja</p>
            <div className="grid grid-cols-5 sm:grid-cols-9 gap-1.5">
              {Array.from({ length: TABLE_COUNT }, (_, i) => i + 1).map((n) => {
                const selected = tableNumber === n
                return (
                  <button
                    key={n}
                    onClick={() => setTableNumber(n)}
                    aria-pressed={selected}
                    className={cn(
                      'h-11 rounded-md font-semibold text-body-sm tabular-nums transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
                      selected
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 active:bg-neutral-300'
                    )}
                  >
                    {n}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {isEmpty ? (
          <EmptyState
            icon={<Inbox />}
            title="Keranjang kosong"
            description="Pilih menu untuk mulai menambah pesanan."
            compact
          />
        ) : (
          items.map((it) => (
            <CartItemRow
              key={it.id}
              item={it}
              onIncrement={() => updateQty(it.id, it.qty + 1)}
              onDecrement={() => updateQty(it.id, it.qty - 1)}
              onRemove={() => removeItem(it.id)}
              onUpdateNotes={(notes) => updateNotes(it.id, notes)}
            />
          ))
        )}
      </div>

      {/* Footer — subtotal + actions */}
      <div className="border-t border-neutral-100 px-4 py-3 space-y-2.5 pb-safe">
        <div className="flex items-baseline justify-between">
          <span className="text-body-sm text-neutral-600">Subtotal</span>
          <span className="text-title font-semibold text-neutral-900 tabular-nums">
            {formatCurrency(total)}
          </span>
        </div>
        <p className="text-caption text-neutral-500">PB1 10% dihitung saat pembayaran.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="md"
            fullWidth
            disabled={!canSubmit}
            loading={isSubmitting}
            onClick={onSubmit}
            leftIcon={<ShoppingBag className="w-4 h-4" />}
          >
            Simpan
          </Button>
          <Button
            variant="primary"
            size="md"
            fullWidth
            disabled={!canSubmit}
            loading={isSubmitting}
            onClick={onSubmitAndPay}
            leftIcon={<Receipt className="w-4 h-4" />}
          >
            Bayar
          </Button>
        </div>
        {orderType === 'dineIn' && tableNumber === null && !isEmpty && (
          <p className="text-caption text-warning-700 text-center">Pilih nomor meja dulu.</p>
        )}
      </div>
    </aside>
  )
}

function CartItemRow({
  item,
  onIncrement,
  onDecrement,
  onRemove,
  onUpdateNotes,
}: {
  item: CartItem
  onIncrement: () => void
  onDecrement: () => void
  onRemove: () => void
  onUpdateNotes: (notes: string) => void
}) {
  const [editingNotes, setEditingNotes] = useState(false)
  return (
    <div className="bg-neutral-50/80 border border-neutral-200/50 rounded-lg p-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-body-sm font-medium text-neutral-900 line-clamp-2">{item.menuName}</p>
          <p className="text-caption text-neutral-500 tabular-nums">
            {formatCurrency(item.price)} × {item.qty}
          </p>
          {item.subOptionsSelected && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {Object.entries(item.subOptionsSelected).map(([k, v]) => (
                <Badge key={k} tone="primary" variant="soft" size="sm">
                  {v}
                </Badge>
              ))}
            </div>
          )}
          {item.notes && !editingNotes && (
            <p className="text-caption text-neutral-600 mt-1.5 italic line-clamp-2">📝 {item.notes}</p>
          )}
          {editingNotes ? (
            <Input
              autoFocus
              defaultValue={item.notes ?? ''}
              onBlur={(e) => {
                onUpdateNotes(e.target.value)
                setEditingNotes(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onUpdateNotes((e.target as HTMLInputElement).value)
                  setEditingNotes(false)
                }
                if (e.key === 'Escape') setEditingNotes(false)
              }}
              placeholder="Catatan (mis. tidak pedas)"
              containerClassName="mt-2"
            />
          ) : (
            <button
              onClick={() => setEditingNotes(true)}
              className="text-caption text-neutral-500 hover:text-neutral-800 mt-1.5 inline-flex items-center gap-1"
            >
              <Pencil className="w-3 h-3" />
              {item.notes ? 'Ubah catatan' : 'Tambah catatan'}
            </button>
          )}
        </div>
        <p className="text-body-sm font-semibold text-neutral-900 whitespace-nowrap tabular-nums">
          {formatCurrency(item.subtotal)}
        </p>
      </div>
      <div className="flex items-center justify-between mt-2.5">
        <div className="flex items-center gap-1">
          <IconButton
            label="Kurangi"
            icon={<Minus />}
            variant="outline"
            size="sm"
            onClick={onDecrement}
            disabled={item.qty <= 1}
          />
          <span className="min-w-[2.25rem] text-center text-body font-semibold tabular-nums">
            {item.qty}
          </span>
          <IconButton
            label="Tambah"
            icon={<Plus />}
            variant="outline"
            size="sm"
            onClick={onIncrement}
          />
        </div>
        <IconButton
          label="Hapus item"
          icon={<Trash2 />}
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="text-danger-600 hover:bg-danger-50"
        />
      </div>
    </div>
  )
}
