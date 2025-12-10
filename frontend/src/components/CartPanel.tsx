import { useState } from 'react'
import { Trash2, Minus, Plus, MessageSquare, ShoppingBag } from 'lucide-react'
import { useCartStore } from '@/stores/cartStore'
import { formatCurrency, cn } from '@/lib/utils'
import PaymentModal from './PaymentModal'
import TableSelectModal from './TableSelectModal'

interface CartPanelProps {
  onSaveOrder: () => void
  isSaving: boolean
}

export default function CartPanel({ onSaveOrder, isSaving }: CartPanelProps) {
  const {
    items,
    tableNumber,
    transactionId,
    notes,
    discountAmount,
    subtotal,
    total,
    setTableNumber,
    setNotes,
    setDiscountAmount,
    updateItemQuantity,
    updateItemNotes,
    removeItem,
    clearCart,
  } = useCartStore()
  
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showTableModal, setShowTableModal] = useState(false)
  const [editingItemNote, setEditingItemNote] = useState<string | null>(null)
  
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)
  
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-4 border-b border-neutral-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-neutral-800">
            {transactionId ? 'Edit Pesanan' : 'Pesanan Baru'}
          </h2>
          {items.length > 0 && (
            <button
              onClick={clearCart}
              className="text-sm text-danger-500 hover:text-danger-600"
            >
              Hapus Semua
            </button>
          )}
        </div>
        
        {/* Table Number */}
        <button
          onClick={() => setShowTableModal(true)}
          className={cn(
            'w-full px-4 py-3 rounded-lg border-2 border-dashed text-left transition-colors',
            tableNumber
              ? 'border-primary-500 bg-primary-50'
              : 'border-neutral-300 hover:border-neutral-400'
          )}
        >
          {tableNumber ? (
            <div>
              <span className="text-xs text-neutral-500">Nomor Meja</span>
              <p className="font-semibold text-primary-600">Meja {tableNumber}</p>
            </div>
          ) : (
            <span className="text-neutral-500">Pilih Nomor Meja</span>
          )}
        </button>
      </div>
      
      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-400">
            <ShoppingBag className="w-12 h-12 mb-2" />
            <p>Belum ada pesanan</p>
            <p className="text-sm">Pilih menu dari kiri</p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {items.map((item) => (
              <li key={item.id} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-neutral-800">
                      {item.menuName}
                      {item.isForceOrder && (
                        <span className="ml-2 px-1.5 py-0.5 bg-warning-100 text-warning-700 text-xs rounded">
                          Force
                        </span>
                      )}
                    </h4>
                    <p className="text-sm text-neutral-500">
                      {formatCurrency(item.price)} × {item.quantity}
                    </p>
                  </div>
                  <p className="font-semibold text-neutral-800">
                    {formatCurrency(item.subtotal)}
                  </p>
                </div>
                
                {/* Item Notes */}
                {editingItemNote === item.id ? (
                  <input
                    type="text"
                    value={item.notes}
                    onChange={(e) => updateItemNotes(item.id, e.target.value)}
                    onBlur={() => setEditingItemNote(null)}
                    onKeyDown={(e) => e.key === 'Enter' && setEditingItemNote(null)}
                    placeholder="Catatan (misal: pedas, tanpa bawang)"
                    className="w-full px-3 py-1.5 text-sm bg-neutral-100 rounded border-0 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    autoFocus
                  />
                ) : item.notes ? (
                  <button
                    onClick={() => setEditingItemNote(item.id)}
                    className="text-sm text-primary-600 flex items-center gap-1"
                  >
                    <MessageSquare className="w-3 h-3" />
                    {item.notes}
                  </button>
                ) : (
                  <button
                    onClick={() => setEditingItemNote(item.id)}
                    className="text-sm text-neutral-400 hover:text-neutral-600 flex items-center gap-1"
                  >
                    <MessageSquare className="w-3 h-3" />
                    Tambah catatan
                  </button>
                )}
                
                {/* Quantity Controls */}
                <div className="flex items-center justify-between mt-3">
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-1.5 text-danger-500 hover:bg-danger-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                      className="p-1.5 bg-neutral-100 hover:bg-neutral-200 rounded"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <button
                      onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                      className="p-1.5 bg-neutral-100 hover:bg-neutral-200 rounded"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      
      {/* Order Notes */}
      {items.length > 0 && (
        <div className="px-4 py-3 border-t border-neutral-200">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Catatan pesanan (opsional)"
            className="w-full px-3 py-2 text-sm bg-neutral-100 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      )}
      
      {/* Summary & Actions */}
      <div className="p-4 border-t border-neutral-200 bg-neutral-50">
        {items.length > 0 && (
          <>
            {/* Discount Input */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-500">Subtotal ({itemCount} item)</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-neutral-500">Diskon</span>
              <input
                type="number"
                value={discountAmount || ''}
                onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                placeholder="0"
                className="w-24 px-2 py-1 text-right text-sm bg-white border border-neutral-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex items-center justify-between mb-4 pt-3 border-t border-neutral-200">
              <span className="font-semibold text-neutral-800">Total</span>
              <span className="text-xl font-bold text-primary-600">
                {formatCurrency(total)}
              </span>
            </div>
          </>
        )}
        
        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onSaveOrder}
            disabled={items.length === 0 || !tableNumber || isSaving}
            className="flex-1 px-4 py-3 bg-neutral-200 text-neutral-700 rounded-lg font-medium hover:bg-neutral-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Menyimpan...' : 'Simpan'}
          </button>
          <button
            onClick={() => setShowPaymentModal(true)}
            disabled={items.length === 0 || !tableNumber}
            className="flex-1 px-4 py-3 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Bayar
          </button>
        </div>
      </div>
      
      {/* Modals */}
      <TableSelectModal
        isOpen={showTableModal}
        selectedTable={tableNumber}
        onSelect={(table) => {
          setTableNumber(table)
          setShowTableModal(false)
        }}
        onClose={() => setShowTableModal(false)}
      />
      
      <PaymentModal
        isOpen={showPaymentModal}
        totalAmount={total}
        onClose={() => setShowPaymentModal(false)}
      />
    </div>
  )
}
