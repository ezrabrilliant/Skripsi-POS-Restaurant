// REV 2.4 ActiveOrdersView - read-only render daftar Pesanan aktif per meja.
// Setiap Transaction direpresentasikan sebagai 1 "Pesanan" group dengan header
// (Pesanan #N · jam) dan list items. Tampil di CartPanel saat view-mode aktif
// (orderType=dineIn + tableNumber selected + activeOrders.length > 0).
//
// Kasir/waiter TIDAK bisa edit item dari sini - semua mutation dilakukan via
// "Tambah Pesanan" (bikin Tx baru) atau payment endpoint (untuk Bayar).

import { useState } from 'react'
import { ClipboardList, Trash2, Minus, Plus, Pencil, Check, Receipt } from 'lucide-react'
import type { Transaction, TransactionItem } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { Badge, Button, IconButton, Input } from '@/design-system/primitives'

interface Props {
  orders: Transaction[]
  /// REV 2.4: callback hapus item dari Tx open. POSPage handle confirm + mutation.
  onDeleteItem?: (txId: number, itemId: number, itemLabel: string) => void
  /// REV 2.4: callback update qty item.
  onUpdateQty?: (txId: number, itemId: number, newQty: number) => void
  /// REV 2.4: callback update notes item.
  onUpdateNotes?: (txId: number, itemId: number, newNotes: string) => void
  /// REV 2.5: per-Pesanan pay handler. Customer bisa pilih bayar 1 Pesanan saja
  /// (mis. customer A bayar Pesanan #1 saja, B bayar Pesanan #2). Render-conditional:
  /// only kalau callback ada + canPay=true.
  onPayOrder?: (tx: Transaction) => void
  /// Apakah user boleh memproses payment (owner + kasir). Waiter false → tombol hidden.
  canPay?: boolean
  /// Disable mutate button selama mutation berjalan.
  isDeleting?: boolean
  isUpdating?: boolean
  /// Disable Bayar button per Pesanan saat ada submission (mergeMutation pending).
  isSubmitting?: boolean
}

const TIME_FMT = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export default function ActiveOrdersView({
  orders,
  onDeleteItem,
  onUpdateQty,
  onUpdateNotes,
  onPayOrder,
  canPay,
  isDeleting,
  isUpdating,
  isSubmitting,
}: Props) {
  return (
    <div className="space-y-3">
      {orders.map((order, idx) => (
        <PesananGroup
          key={order.id}
          order={order}
          index={idx + 1}
          onDeleteItem={onDeleteItem}
          onUpdateQty={onUpdateQty}
          onUpdateNotes={onUpdateNotes}
          onPayOrder={onPayOrder}
          canPay={canPay}
          isDeleting={isDeleting}
          isUpdating={isUpdating}
          isSubmitting={isSubmitting}
        />
      ))}
    </div>
  )
}

function PesananGroup({
  order,
  index,
  onDeleteItem,
  onUpdateQty,
  onUpdateNotes,
  onPayOrder,
  canPay,
  isDeleting,
  isUpdating,
  isSubmitting,
}: {
  order: Transaction
  index: number
  onDeleteItem?: (txId: number, itemId: number, itemLabel: string) => void
  onUpdateQty?: (txId: number, itemId: number, newQty: number) => void
  onUpdateNotes?: (txId: number, itemId: number, newNotes: string) => void
  onPayOrder?: (tx: Transaction) => void
  canPay?: boolean
  isDeleting?: boolean
  isUpdating?: boolean
  isSubmitting?: boolean
}) {
  const time = TIME_FMT.format(new Date(order.createdAt))
  const orderSubtotal = order.items.reduce((s, it) => s + it.subtotal, 0)
  const [editing, setEditing] = useState(false)
  // Edit hanya bisa dilakukan kalau handler tersedia (parent pass-in)
  const canEdit = !!(onDeleteItem || onUpdateQty || onUpdateNotes)

  return (
    <section className="bg-neutral-50/80 border border-neutral-200/60 rounded-lg overflow-hidden">
      <header className="flex items-center justify-between px-3 py-2 bg-primary-50/60 border-b border-primary-100/60">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <ClipboardList className="w-4 h-4 text-primary-700 shrink-0" />
          <span className="font-semibold text-body-sm text-neutral-900">
            Pesanan #{index}
          </span>
          <span className="text-caption text-neutral-500 tabular-nums">· {time}</span>
          {/* REV 2.5: db Tx ID sebagai secondary muted - untuk audit + match
              dengan toast "Tx #N disimpan". Sequence #N di-display sebelumnya =
              ronde ke-N di meja ini (reset per meja), bukan db id. */}
          <span className="text-caption text-neutral-400 tabular-nums">· Tx #{order.id}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-caption text-neutral-600 tabular-nums">
            {order.items.length} item
          </span>
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className={
                editing
                  ? 'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-caption font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors'
                  : 'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-caption font-medium text-primary-700 hover:bg-primary-100 transition-colors'
              }
            >
              {editing ? (
                <>
                  <Check className="w-3 h-3" /> Selesai
                </>
              ) : (
                <>
                  <Pencil className="w-3 h-3" /> Ubah
                </>
              )}
            </button>
          )}
        </div>
      </header>
      <ul className="divide-y divide-neutral-200/60">
        {order.items.map((item) => (
          <li key={item.id}>
            <PesananItem
              item={item}
              editing={editing}
              onDelete={
                onDeleteItem
                  ? () => onDeleteItem(order.id, item.id, item.menuName)
                  : undefined
              }
              onUpdateQty={
                onUpdateQty ? (newQty) => onUpdateQty(order.id, item.id, newQty) : undefined
              }
              onUpdateNotes={
                onUpdateNotes ? (newNotes) => onUpdateNotes(order.id, item.id, newNotes) : undefined
              }
              isDeleting={isDeleting}
              isUpdating={isUpdating}
            />
          </li>
        ))}
      </ul>
      <footer className="px-3 py-2 border-t border-neutral-200/60 space-y-2">
        <div className="flex items-center justify-between text-caption text-neutral-600">
          <span>Subtotal Pesanan</span>
          <span className="font-semibold text-neutral-900 tabular-nums">
            {formatCurrency(orderSubtotal)}
          </span>
        </div>
        {/* REV 2.5: per-Pesanan Bayar - customer pilih bayar 1 Pesanan saja
            (mis. customer A bayar Pesanan #1, customer B bayar Pesanan #2).
            Hanya tampil kalau onPayOrder callback ada + canPay (owner+kasir).
            "Bayar Semua" tetap available di footer bawah CartPanel untuk
            common case bayar full meja sekaligus. */}
        {onPayOrder && canPay && order.items.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            fullWidth
            disabled={isSubmitting}
            onClick={() => onPayOrder(order)}
            leftIcon={<Receipt className="w-4 h-4" />}
          >
            Bayar Pesanan ini saja
          </Button>
        )}
      </footer>
    </section>
  )
}

function PesananItem({
  item,
  editing,
  onDelete,
  onUpdateQty,
  onUpdateNotes,
  isDeleting,
  isUpdating,
}: {
  item: TransactionItem
  /// REV 2.4: edit mode toggle dari parent PesananGroup. Kalau false, render
  /// read-only ringkas (UI lama). Kalau true, render qty controls + delete + notes edit.
  editing: boolean
  onDelete?: () => void
  onUpdateQty?: (newQty: number) => void
  onUpdateNotes?: (newNotes: string) => void
  isDeleting?: boolean
  isUpdating?: boolean
}) {
  const [editingNotes, setEditingNotes] = useState(false)
  const busy = isDeleting || isUpdating

  return (
    <div className="px-3 py-2.5">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-body-sm font-medium text-neutral-900 line-clamp-2">
            {item.menuName}
          </p>
          {/* REV 2.10: varian label */}
          {item.variantLabel && (
            <p className="text-caption text-primary-700 font-medium">{item.variantLabel}</p>
          )}
          <p className="text-caption text-neutral-500 tabular-nums">
            {formatCurrency(item.unitPrice)} × {item.qty}
          </p>
          {/* REV 2.10: selections (slot paket + free-preference). Fallback ke legacy
              subOptionsSelected untuk Tx historis yang belum punya selections. */}
          {item.selections && item.selections.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {item.selections.map((sel, i) => (
                <Badge
                  key={`sel-${i}`}
                  tone={sel.isPreference ? 'info' : 'primary'}
                  variant="soft"
                  size="sm"
                >
                  {sel.groupOrSlotLabel}: {sel.chosenLabel}
                </Badge>
              ))}
            </div>
          ) : (
            item.subOptionsSelected &&
            Object.keys(item.subOptionsSelected).length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {Object.entries(item.subOptionsSelected).map(([k, v]) => (
                  <Badge key={k} tone="primary" variant="soft" size="sm">
                    {v}
                  </Badge>
                ))}
              </div>
            )
          )}
          {/* Notes: read mode tampil 📝 saja kalau ada; edit mode munculin Pencil button + inline editor */}
          {editing && editingNotes && onUpdateNotes ? (
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
              placeholder="Catatan (mis. kurang manis)"
              containerClassName="mt-2"
            />
          ) : (
            <>
              {item.notes && (
                <p className="text-caption text-neutral-600 mt-1.5 italic line-clamp-2">
                  📝 {item.notes}
                </p>
              )}
              {editing && onUpdateNotes && (
                <button
                  type="button"
                  onClick={() => setEditingNotes(true)}
                  className="text-caption text-neutral-500 hover:text-neutral-800 mt-1.5 inline-flex items-center gap-1"
                  disabled={busy}
                >
                  <Pencil className="w-3 h-3" />
                  {item.notes ? 'Ubah catatan' : 'Tambah catatan'}
                </button>
              )}
            </>
          )}
        </div>
        <div className="flex items-start gap-1.5 shrink-0">
          <p className="text-body-sm font-semibold text-neutral-900 whitespace-nowrap tabular-nums">
            {formatCurrency(item.subtotal)}
          </p>
          {editing && onDelete && (
            <IconButton
              label="Hapus item"
              icon={<Trash2 />}
              variant="ghost"
              size="sm"
              onClick={onDelete}
              disabled={busy}
              className="text-danger-600 hover:bg-danger-50"
            />
          )}
        </div>
      </div>
      {/* Qty controls - hanya muncul saat edit mode + onUpdateQty diset */}
      {editing && onUpdateQty && (
        <div className="mt-2 flex items-center gap-1">
          <IconButton
            label="Kurangi qty"
            icon={<Minus />}
            variant="outline"
            size="sm"
            onClick={() => onUpdateQty(item.qty - 1)}
            disabled={busy || item.qty <= 1}
          />
          <span className="min-w-[2.25rem] text-center text-body-sm font-semibold tabular-nums">
            {item.qty}
          </span>
          <IconButton
            label="Tambah qty"
            icon={<Plus />}
            variant="outline"
            size="sm"
            onClick={() => onUpdateQty(item.qty + 1)}
            disabled={busy}
          />
          {item.qty <= 1 && (
            <span className="text-caption text-neutral-400 ml-2">
              (min 1 - hapus item kalau mau 0)
            </span>
          )}
        </div>
      )}
    </div>
  )
}
