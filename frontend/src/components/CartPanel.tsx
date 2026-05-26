// REV 2.4 CartPanel - display cart items + order type tab + table picker (dineIn) +
// subtotal + tombol aksi yang variatif per mode.
//
// 3 mode UI (deduce dari props + state internal):
//   1. View mode (dineIn + table picked + activeOrders.length > 0 + !inputMode):
//      Tampilkan ActiveOrdersView (Pesanan #1, #2, ... read-only). Footer:
//      "Tambah Pesanan" (semua role) + "Bayar" (owner+kasir only - waiter sembunyi).
//   2. AddPesanan mode (dineIn + table picked + activeOrders.length > 0 + inputMode):
//      Tampilkan cart items dari store (input pesanan baru untuk meja yang sudah
//      punya Pesanan). Footer: "Batal" (kembali ke view) + "Submit Pesanan".
//   3. InputNew mode (takeaway atau dineIn empty table):
//      Tampilkan cart items dari store (input pesanan baru, table belum punya
//      transaksi terbuka). Footer: "Simpan" + "Bayar" (owner+kasir) atau cuma
//      "Submit Pesanan" (waiter).
//
// Quick suhu toggle [Dingin]/[Panas] di CartItemRow untuk menu yang ambigu
// (teh, jeruk, kopi, susu kedelai) - klik mengubah CartItem.notes.
// Touch target: qty ± pakai IconButton size=sm (44×44).
// Grid meja REV 2.4: 5 cols mobile + desktop (2 baris untuk 9 meja), h-12 md:h-14.

import { useState } from 'react'
import { Minus, Plus, Trash2, ShoppingBag, Receipt, Pencil, Inbox } from 'lucide-react'
import { useCartStore, cartSubtotal } from '@/stores/cartStore'
import { useAuthStore } from '@/stores/authStore'
import { ORDER_TYPE_LABELS, type OrderType, type CartItem, type Transaction } from '@/types'
import { formatCurrency, cn } from '@/lib/utils'
import { Button, IconButton, Tabs, Badge, EmptyState, Input } from '@/design-system/primitives'
import ActiveOrdersView from './ActiveOrdersView'
import ActiveTakeawaysView from './ActiveTakeawaysView'

const TABLE_COUNT = 9 // sesuai backend env TABLE_COUNT

/// REV 2.4: menu yang naturally ambigu suhu (bisa Panas atau Dingin). Click
/// quick toggle di CartItemRow akan set notes = "Dingin" atau "Panas".
/// Kopi Hangat sengaja TIDAK di-include - namanya sudah menyatakan suhu.
/// Susu Kedelai sekarang netral (was "Es Susu Kedelai" pre-REV 2.4).
const AMBIGUOUS_TEMP_MENUS = new Set<string>([
  'Teh Tawar Biasa',
  'Teh Tawar Jumbo',
  'Teh Manis Biasa',
  'Teh Manis Jumbo',
  'Jeruk Nipis',
  'Jeruk Peras',
  'Jeruk Murni',
  'Kopi',
  'Susu Kedelai',
])

interface Props {
  disabled?: boolean
  /// Input mode submit handler (create new Transaction tanpa pay).
  /// Dipakai juga sebagai "Submit Pesanan" di addPesanan mode + inputNew mode (waiter).
  onSubmit: () => void
  /// Input mode submit + langsung pay (kasir/owner di empty table atau takeaway).
  onSubmitAndPay: () => void
  isSubmitting?: boolean
  // REV 2.4 props baru
  /// True kalau:
  ///   - dineIn + tableNumber selected + activeOrders.length > 0 + !inputMode, ATAU
  ///   - takeaway + openTakeaways.length > 0 + !inputMode
  /// Render ActiveOrdersView (dineIn) atau ActiveTakeawaysView (takeaway) + footer adaptif.
  viewMode?: boolean
  /// Active orders untuk meja terpilih (dineIn). Tidak dipakai untuk takeaway.
  activeOrders?: Transaction[]
  /// Open takeaway transactions (untuk view mode takeaway).
  openTakeaways?: Transaction[]
  /// Trigger transisi view → addPesanan (inputMode=true). Dipakai oleh kedua dineIn + takeaway.
  onAddPesanan?: () => void
  /// Trigger transisi addPesanan → view (inputMode=false + clearItems).
  onCancelInput?: () => void
  /// View mode dineIn "Bayar Semua" handler (orchestrate merge + pay di POSPage).
  onPayTable?: () => void
  /// View mode takeaway per-Tx pay handler (no merge, single Tx pay).
  onPayTakeaway?: (tx: Transaction) => void
  /// REV 2.5: per-Pesanan pay handler untuk dineIn view mode. Customer pilih
  /// bayar 1 Pesanan saja (tidak ikut Pesanan lain di meja yang sama). Backend
  /// logic identik dengan onPayTakeaway (single Tx pay tanpa merge).
  onPayOrder?: (tx: Transaction) => void
  /// REV 2.4: hapus item dari Tx open (dineIn atau takeaway). Parent handle confirm + mutation.
  onDeleteItem?: (txId: number, itemId: number, itemLabel: string) => void
  /// REV 2.4: update qty item dari Tx open.
  onUpdateItemQty?: (txId: number, itemId: number, newQty: number) => void
  /// REV 2.4: update notes item dari Tx open.
  onUpdateItemNotes?: (txId: number, itemId: number, newNotes: string) => void
  /// Disable mutate buttons selama mutation berjalan.
  isDeleting?: boolean
  isUpdatingItem?: boolean
}

export default function CartPanel({
  disabled,
  onSubmit,
  onSubmitAndPay,
  isSubmitting,
  viewMode = false,
  activeOrders = [],
  openTakeaways = [],
  onAddPesanan,
  onCancelInput,
  onPayTable,
  onPayTakeaway,
  onPayOrder,
  onDeleteItem,
  onUpdateItemQty,
  onUpdateItemNotes,
  isDeleting,
  isUpdatingItem,
}: Props) {
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
  const { user } = useAuthStore()

  // Permission: kasir/owner boleh akses Bayar; waiter cuma input.
  const canProcessPayment = user?.role === 'owner' || user?.role === 'cashier'

  // Subtotal: view mode dine-in pakai aggregate dari activeOrders; view mode takeaway
  // TIDAK ada footer subtotal (Bayar per-Tx, total per-Tx ada di card masing-masing);
  // input mode pakai cartSubtotal dari store.
  const aggregateSubtotal = activeOrders.reduce(
    (s, o) => s + o.items.reduce((is, it) => is + it.subtotal, 0),
    0,
  )
  const takeawaysGrandTotal = openTakeaways.reduce(
    (s, t) => s + t.items.reduce((is, it) => is + it.subtotal, 0),
    0,
  )
  const cartSub = cartSubtotal(items)
  const isTakeawayViewMode = viewMode && orderType === 'takeaway'
  const isDineInViewMode = viewMode && orderType === 'dineIn'
  const displayedSubtotal = isDineInViewMode
    ? aggregateSubtotal
    : isTakeawayViewMode
      ? takeawaysGrandTotal
      : cartSub

  const itemCount = items.reduce((s, it) => s + it.qty, 0)
  const totalActiveItems = activeOrders.reduce((s, o) => s + o.items.length, 0)
  const isEmpty = items.length === 0

  // Input mode submit logic - sama untuk addPesanan dan inputNew (waiter)
  const canSubmitInput =
    !isEmpty && !disabled && !isSubmitting && (orderType === 'takeaway' || tableNumber !== null)

  // addMode = sedang input pesanan baru sementara sudah ada open Tx di context (meja yg sama / takeaway list).
  // Render: Batal + Submit (no Simpan/Bayar - bayar nanti via view mode masing-masing).
  const isAddPesananMode =
    !viewMode &&
    ((orderType === 'dineIn' && activeOrders.length > 0) ||
      (orderType === 'takeaway' && openTakeaways.length > 0))

  return (
    <aside className="bg-white w-full h-full flex flex-col md:border-l border-neutral-200">
      {/* Header */}
      <div className="px-4 pt-3 pb-3 border-b border-neutral-100">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="font-semibold text-neutral-900 flex items-center gap-2 text-title">
            <ShoppingBag className="w-4 h-4 text-primary-600" />
            Pesanan
            {isDineInViewMode && totalActiveItems > 0 && (
              <Badge tone="primary" size="sm">{totalActiveItems} item</Badge>
            )}
            {isTakeawayViewMode && openTakeaways.length > 0 && (
              <Badge tone="primary" size="sm">{openTakeaways.length} pesanan</Badge>
            )}
            {!viewMode && itemCount > 0 && (
              <Badge tone="primary" size="sm">{itemCount} item</Badge>
            )}
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

        {/* Table picker - hanya dineIn. REV 2.4: 2-baris desktop, button lebih besar */}
        {orderType === 'dineIn' && (
          <div className="mt-3">
            <p className="text-label text-neutral-600 mb-1.5">Pilih meja</p>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: TABLE_COUNT }, (_, i) => i + 1).map((n) => {
                const selected = tableNumber === n
                return (
                  <button
                    key={n}
                    onClick={() => setTableNumber(n)}
                    aria-pressed={selected}
                    className={cn(
                      'h-12 md:h-14 rounded-lg font-semibold text-body tabular-nums transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
                      selected
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 active:bg-neutral-300',
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

      {/* Middle section - view mode (active orders) vs input mode (cart items) */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {isDineInViewMode ? (
          activeOrders.length > 0 ? (
            <ActiveOrdersView
              orders={activeOrders}
              onDeleteItem={onDeleteItem}
              onUpdateQty={onUpdateItemQty}
              onUpdateNotes={onUpdateItemNotes}
              onPayOrder={onPayOrder}
              canPay={canProcessPayment}
              isDeleting={isDeleting}
              isUpdating={isUpdatingItem}
              isSubmitting={isSubmitting}
            />
          ) : (
            <EmptyState
              icon={<Inbox />}
              title="Tidak ada pesanan aktif"
              description="Belum ada Pesanan terbuka di meja ini."
              compact
            />
          )
        ) : isTakeawayViewMode ? (
          <ActiveTakeawaysView
            takeaways={openTakeaways}
            onPay={onPayTakeaway}
            canPay={canProcessPayment}
            isSubmitting={isSubmitting}
            onDeleteItem={onDeleteItem}
            onUpdateQty={onUpdateItemQty}
            onUpdateNotes={onUpdateItemNotes}
            isDeleting={isDeleting}
            isUpdating={isUpdatingItem}
          />
        ) : isEmpty ? (
          <EmptyState
            icon={<Inbox />}
            title="Belum ada pesanan"
            description={
              isAddPesananMode
                ? orderType === 'takeaway'
                  ? 'Pilih menu untuk pesanan takeaway baru.'
                  : 'Pilih menu untuk Pesanan baru di meja ini.'
                : 'Pilih menu untuk mulai menambah pesanan.'
            }
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

      {/* Footer - subtotal + actions per mode */}
      <div className="border-t border-neutral-100 px-4 py-3 space-y-2.5 pb-safe">
        {isTakeawayViewMode ? (
          <p className="text-caption text-neutral-500">
            Bayar per pesanan via tombol di kartu di atas. Total semua: {' '}
            <span className="font-medium text-neutral-700 tabular-nums">
              {formatCurrency(takeawaysGrandTotal)}
            </span>
          </p>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <span className="text-body-sm text-neutral-600">Subtotal</span>
              <span className="text-title font-semibold text-neutral-900 tabular-nums">
                {formatCurrency(displayedSubtotal)}
              </span>
            </div>
            <p className="text-caption text-neutral-500">PB1 10% dihitung saat pembayaran.</p>
          </>
        )}

        {isDineInViewMode ? (
          // View mode dineIn: Tambah Pesanan (semua role) + Bayar (owner+kasir).
          // Bayar = orchestrate merge (kalau multi-Tx) + pay parent.
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: canProcessPayment ? '1fr 1fr' : '1fr' }}
          >
            <Button
              variant="outline"
              size="md"
              fullWidth
              onClick={onAddPesanan}
              leftIcon={<ShoppingBag className="w-4 h-4" />}
            >
              Tambah Pesanan
            </Button>
            {canProcessPayment && (
              <Button
                variant="primary"
                size="md"
                fullWidth
                disabled={activeOrders.length === 0 || disabled}
                loading={isSubmitting}
                onClick={onPayTable}
                leftIcon={<Receipt className="w-4 h-4" />}
              >
                Bayar
              </Button>
            )}
          </div>
        ) : isTakeawayViewMode ? (
          // View mode takeaway: cuma "Tambah Pesanan Baru" - Bayar dilakukan per-Tx
          // via tombol di kartu ActiveTakeawaysView (tidak di-merge antar Tx).
          <Button
            variant="outline"
            size="md"
            fullWidth
            onClick={onAddPesanan}
            leftIcon={<ShoppingBag className="w-4 h-4" />}
          >
            Tambah Pesanan Baru
          </Button>
        ) : isAddPesananMode ? (
          // AddPesanan mode: Batal + Submit Pesanan (no Bayar - kasir bayar dari view mode)
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="md"
              fullWidth
              onClick={onCancelInput}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              size="md"
              fullWidth
              disabled={!canSubmitInput}
              loading={isSubmitting}
              onClick={onSubmit}
              leftIcon={<ShoppingBag className="w-4 h-4" />}
            >
              Submit Pesanan
            </Button>
          </div>
        ) : canProcessPayment ? (
          // InputNew mode (empty table / takeaway) untuk owner+kasir: Simpan + Bayar
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="md"
              fullWidth
              disabled={!canSubmitInput}
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
              disabled={!canSubmitInput}
              loading={isSubmitting}
              onClick={onSubmitAndPay}
              leftIcon={<Receipt className="w-4 h-4" />}
            >
              Bayar
            </Button>
          </div>
        ) : (
          // InputNew mode untuk waiter: cuma Submit (no Bayar - payment kasir-only)
          <Button
            variant="primary"
            size="md"
            fullWidth
            disabled={!canSubmitInput}
            loading={isSubmitting}
            onClick={onSubmit}
            leftIcon={<ShoppingBag className="w-4 h-4" />}
          >
            Submit Pesanan
          </Button>
        )}

        {!viewMode &&
          orderType === 'dineIn' &&
          tableNumber === null &&
          !isEmpty && (
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
  const showSuhuToggle = AMBIGUOUS_TEMP_MENUS.has(item.menuName)
  const suhuSelected: 'Dingin' | 'Panas' | null =
    item.notes === 'Dingin' ? 'Dingin' : item.notes === 'Panas' ? 'Panas' : null

  const handleSuhuClick = (suhu: 'Dingin' | 'Panas') => {
    // Toggle: kalau klik suhu yang sudah selected, clear notes. Kalau beda, set ke suhu itu.
    onUpdateNotes(suhuSelected === suhu ? '' : suhu)
  }

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
          {/* REV 2.4: quick toggle Dingin/Panas untuk minuman ambigu suhu */}
          {showSuhuToggle && (
            <div className="mt-1.5 flex gap-1">
              <button
                type="button"
                onClick={() => handleSuhuClick('Dingin')}
                aria-pressed={suhuSelected === 'Dingin'}
                className={cn(
                  'px-2.5 py-1 rounded-md text-caption font-medium border transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
                  suhuSelected === 'Dingin'
                    ? 'bg-info-50 text-info-700 border-info-200'
                    : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50',
                )}
              >
                Dingin
              </button>
              <button
                type="button"
                onClick={() => handleSuhuClick('Panas')}
                aria-pressed={suhuSelected === 'Panas'}
                className={cn(
                  'px-2.5 py-1 rounded-md text-caption font-medium border transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
                  suhuSelected === 'Panas'
                    ? 'bg-warning-100 text-warning-800 border-warning-200'
                    : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50',
                )}
              >
                Panas
              </button>
            </div>
          )}
          {item.notes && !editingNotes && !suhuSelected && (
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
              placeholder="Catatan (mis. kurang manis, pedas level 2)"
              containerClassName="mt-2"
            />
          ) : (
            !suhuSelected && (
              <button
                onClick={() => setEditingNotes(true)}
                className="text-caption text-neutral-500 hover:text-neutral-800 mt-1.5 inline-flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" />
                {item.notes ? 'Ubah catatan' : 'Tambah catatan'}
              </button>
            )
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
