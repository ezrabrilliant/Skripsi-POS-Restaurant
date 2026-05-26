// REV 2.4 ActiveTakeawaysView - read-only render daftar takeaway open per-Tx
// dengan tombol Bayar per row (owner + kasir only). Beda dari ActiveOrdersView
// (dine-in): takeaway tidak punya konsep meja, tiap Tx independent - TIDAK
// di-merge. Bayar per Tx individually.

import { useState } from 'react'
import { Package, Receipt, Trash2, Minus, Plus, Pencil, Check } from 'lucide-react'
import type { Transaction, TransactionItem } from '@/types'
import { formatCurrency, cn } from '@/lib/utils'
import { Badge, Button, IconButton, Input } from '@/design-system/primitives'

interface Props {
  takeaways: Transaction[]
  /// Per-Tx pay handler. Render-conditional di parent (hidden untuk waiter).
  onPay?: (tx: Transaction) => void
  /// Apakah user boleh memproses payment (owner + kasir). Waiter false.
  canPay: boolean
  isSubmitting?: boolean
  /// REV 2.4: callback hapus item dari Tx open. POSPage handle confirm + mutation.
  onDeleteItem?: (txId: number, itemId: number, itemLabel: string) => void
  /// REV 2.4: callback update qty item.
  onUpdateQty?: (txId: number, itemId: number, newQty: number) => void
  /// REV 2.4: callback update notes item.
  onUpdateNotes?: (txId: number, itemId: number, newNotes: string) => void
  /// Disable mutate button selama mutation berjalan.
  isDeleting?: boolean
  isUpdating?: boolean
}

const TIME_FMT = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export default function ActiveTakeawaysView({
  takeaways,
  onPay,
  canPay,
  isSubmitting,
  onDeleteItem,
  onUpdateQty,
  onUpdateNotes,
  isDeleting,
  isUpdating,
}: Props) {
  return (
    <div className="space-y-3">
      {takeaways.map((tx) => (
        <TakeawayCard
          key={tx.id}
          tx={tx}
          onPay={onPay}
          canPay={canPay}
          isSubmitting={isSubmitting}
          onDeleteItem={onDeleteItem}
          onUpdateQty={onUpdateQty}
          onUpdateNotes={onUpdateNotes}
          isDeleting={isDeleting}
          isUpdating={isUpdating}
        />
      ))}
    </div>
  )
}

function TakeawayCard({
  tx,
  onPay,
  canPay,
  isSubmitting,
  onDeleteItem,
  onUpdateQty,
  onUpdateNotes,
  isDeleting,
  isUpdating,
}: {
  tx: Transaction
  onPay?: (tx: Transaction) => void
  canPay: boolean
  isSubmitting?: boolean
  onDeleteItem?: (txId: number, itemId: number, itemLabel: string) => void
  onUpdateQty?: (txId: number, itemId: number, newQty: number) => void
  onUpdateNotes?: (txId: number, itemId: number, newNotes: string) => void
  isDeleting?: boolean
  isUpdating?: boolean
}) {
  const time = TIME_FMT.format(new Date(tx.createdAt))
  const itemCount = tx.items.length
  const subtotalSum = tx.items.reduce((s, it) => s + it.subtotal, 0)
  const [editing, setEditing] = useState(false)
  const canEdit = !!(onDeleteItem || onUpdateQty || onUpdateNotes)

  return (
    <section className="bg-neutral-50/80 border border-neutral-200/60 rounded-lg overflow-hidden">
      <header className="flex items-center justify-between px-3 py-2 bg-primary-50/60 border-b border-primary-100/60">
        <div className="flex items-center gap-2 min-w-0">
          <Package className="w-4 h-4 text-primary-700 shrink-0" />
          <span className="font-semibold text-body-sm text-neutral-900">
            #{tx.id} Takeaway
          </span>
          <span className="text-caption text-neutral-500 tabular-nums">· {time}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-caption text-neutral-600 tabular-nums">{itemCount} item</span>
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
        {tx.items.map((item) => (
          <li key={item.id}>
            <TakeawayItem
              item={item}
              editing={editing}
              onDelete={
                onDeleteItem
                  ? () => onDeleteItem(tx.id, item.id, item.menuName)
                  : undefined
              }
              onUpdateQty={
                onUpdateQty ? (newQty) => onUpdateQty(tx.id, item.id, newQty) : undefined
              }
              onUpdateNotes={
                onUpdateNotes ? (newNotes) => onUpdateNotes(tx.id, item.id, newNotes) : undefined
              }
              isDeleting={isDeleting}
              isUpdating={isUpdating}
            />
          </li>
        ))}
      </ul>
      <footer
        className={cn(
          'px-3 py-2 border-t border-neutral-200/60 flex items-center justify-between gap-2',
          canPay && 'flex-wrap',
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-caption text-neutral-600">Subtotal</span>
          <span className="text-body-sm font-semibold text-neutral-900 tabular-nums">
            {formatCurrency(subtotalSum)}
          </span>
        </div>
        {canPay && onPay && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => onPay(tx)}
            loading={isSubmitting}
            leftIcon={<Receipt className="w-4 h-4" />}
          >
            Bayar
          </Button>
        )}
      </footer>
    </section>
  )
}

function TakeawayItem({
  item,
  editing,
  onDelete,
  onUpdateQty,
  onUpdateNotes,
  isDeleting,
  isUpdating,
}: {
  item: TransactionItem
  /// REV 2.4: edit mode toggle dari parent TakeawayCard.
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
          <p className="text-caption text-neutral-500 tabular-nums">
            {formatCurrency(item.unitPrice)} × {item.qty}
          </p>
          {item.subOptionsSelected && Object.keys(item.subOptionsSelected).length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {Object.entries(item.subOptionsSelected).map(([k, v]) => (
                <Badge key={k} tone="primary" variant="soft" size="sm">
                  {v}
                </Badge>
              ))}
            </div>
          )}
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
        </div>
      )}
    </div>
  )
}
