import { useState } from 'react'
import { Trash2, Minus, Plus, MessageSquare, ShoppingBag, ChevronUp } from 'lucide-react'
import { useCartStore } from '@/stores/cartStore'
import { formatCurrency, cn } from '@/lib/utils'
import PaymentModal from './PaymentModal'
import TableSelectModal from './TableSelectModal'

interface CartPanelProps {
  onSaveOrder: () => void
  isSaving: boolean
  isMobile?: boolean
  isCollapsed?: boolean // When true, show compact summary with preview
  onExpandRequest?: () => void // Callback to request expansion
}

export default function CartPanel({ onSaveOrder, isSaving, isMobile = false, isCollapsed = false, onExpandRequest }: CartPanelProps) {
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
  
  const canSubmit = tableNumber && items.length > 0
  
  const handleSaveClick = () => {
    if (!canSubmit) return
    onSaveOrder()
  }
  
  const handlePayClick = () => {
    if (!canSubmit) return
    setShowPaymentModal(true)
  }
  
  return (
    <div className={cn(
      "bg-white",
      isMobile ? "flex flex-col h-full" : "flex flex-col h-full"
    )}>
      {/* Header - Hide on mobile since parent has header */}
      {!isMobile && (
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
                Clear All
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
                : items.length > 0
                  ? 'border-warning-400 bg-warning-50 hover:border-warning-500'
                  : 'border-neutral-300 hover:border-neutral-400'
            )}
          >
            {tableNumber ? (
              <div>
                <span className="text-xs text-neutral-500">Nomor Meja</span>
                <p className="font-semibold text-primary-600">Meja {tableNumber}</p>
              </div>
            ) : (
              <span className={items.length > 0 ? 'text-warning-600 font-medium' : 'text-neutral-500'}>
                {items.length > 0 ? 'Pilih Nomor Meja' : 'Pilih Nomor Meja'}
              </span>
            )}
          </button>
        </div>
      )}
      
      {/* ==================== MOBILE COLLAPSED MODE ==================== */}
      {isMobile && isCollapsed && (
        <div className="flex flex-col h-full overflow-hidden">
          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">
            {/* Table Badge */}
            <button
              onClick={() => setShowTableModal(true)}
              className={cn(
                'w-full px-3 py-2 rounded-lg text-sm font-medium mb-3',
                tableNumber
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-warning-100 text-warning-700'
              )}
            >
              {tableNumber ? `Meja ${tableNumber}` : '⚠️ Pilih Meja Dulu'}
            </button>
            
            {/* Item Preview */}
            {items.length > 0 && (
              <button 
                onClick={onExpandRequest}
                className="w-full text-left p-3 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Show first 2 items */}
                    {items.slice(0, 2).map((item, idx) => (
                      <p key={item.id} className={cn(
                        "text-sm truncate",
                        idx === 0 ? "text-neutral-800 font-medium" : "text-neutral-600"
                      )}>
                        {item.quantity}× {item.menuName}
                      </p>
                    ))}
                    {items.length > 2 && (
                      <p className="text-xs text-neutral-400 mt-1">
                        +{items.length - 2} item lainnya
                      </p>
                    )}
                  </div>
                  <ChevronUp className="w-5 h-5 text-neutral-400 ml-2 flex-shrink-0" />
                </div>
              </button>
            )}
          </div>
          
          {/* Summary & Buttons - Always visible at bottom with safe padding */}
          <div className="mt-auto p-4 pb-6 border-t border-neutral-200 bg-neutral-50 flex-shrink-0">
            {items.length > 0 && (
              <div className="flex items-center justify-between mb-3">
                <span className="text-neutral-600">Total ({itemCount} item)</span>
                <span className="text-xl font-bold text-primary-600">
                  {formatCurrency(total)}
                </span>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleSaveClick}
                disabled={!canSubmit || isSaving}
                className={cn(
                  "flex-1 px-4 py-3 rounded-lg font-medium transition-colors",
                  canSubmit 
                    ? "bg-neutral-200 text-neutral-700 hover:bg-neutral-300" 
                    : "bg-neutral-100 text-neutral-400 cursor-not-allowed",
                  isSaving && "opacity-50 cursor-not-allowed"
                )}
              >
                {isSaving ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button
                onClick={handlePayClick}
                disabled={!canSubmit || isSaving}
                className={cn(
                  "flex-1 px-4 py-3 rounded-lg font-medium transition-colors",
                  canSubmit 
                    ? "bg-primary-500 text-white hover:bg-primary-600" 
                    : "bg-primary-200 text-primary-400 cursor-not-allowed"
                )}
              >
                Bayar
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* ==================== MOBILE EXPANDED MODE ==================== */}
      {isMobile && !isCollapsed && (
        <div className="flex flex-col h-full overflow-hidden">
          {/* Table Selector - Fixed at top */}
          <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between flex-shrink-0">
            <button
              onClick={() => setShowTableModal(true)}
              className={cn(
                'flex-1 px-4 py-2 rounded-lg border-2 border-dashed text-center transition-colors',
                tableNumber
                  ? 'border-primary-500 bg-primary-50'
                  : items.length > 0
                    ? 'border-warning-400 bg-warning-50'
                    : 'border-neutral-300'
              )}
            >
              {tableNumber ? (
                <span className="font-semibold text-primary-600">Meja {tableNumber}</span>
              ) : (
                <span className={items.length > 0 ? 'text-warning-600 font-medium' : 'text-neutral-500'}>
                  Pilih Meja
                </span>
              )}
            </button>
            {items.length > 0 && (
              <button
                onClick={clearCart}
                className="ml-3 px-3 py-2 text-sm text-danger-500 hover:bg-danger-50 rounded-lg"
              >
                Clear All
              </button>
            )}
          </div>
          
          {/* Cart Items - Scrollable with overscroll containment */}
          <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-neutral-400 py-8">
                <ShoppingBag className="w-12 h-12 mb-2" />
                <p>Belum ada pesanan</p>
                <p className="text-sm">Pilih menu dari daftar</p>
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
            <div className="px-4 py-3 border-t border-neutral-200 flex-shrink-0">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan pesanan (opsional)"
                className="w-full px-3 py-2 text-sm bg-neutral-100 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}
          
          {/* Summary & Actions - Fixed at bottom */}
          <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex-shrink-0">
            {items.length > 0 && (
              <>
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
                onClick={handleSaveClick}
                disabled={!canSubmit || isSaving}
                className={cn(
                  "flex-1 px-4 py-3 rounded-lg font-medium transition-colors",
                  canSubmit 
                    ? "bg-neutral-200 text-neutral-700 hover:bg-neutral-300" 
                    : "bg-neutral-100 text-neutral-400 cursor-not-allowed",
                  isSaving && "opacity-50 cursor-not-allowed"
                )}
              >
                {isSaving ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button
                onClick={handlePayClick}
                disabled={!canSubmit || isSaving}
                className={cn(
                  "flex-1 px-4 py-3 rounded-lg font-medium transition-colors",
                  canSubmit 
                    ? "bg-primary-500 text-white hover:bg-primary-600" 
                    : "bg-primary-200 text-primary-400 cursor-not-allowed"
                )}
              >
                Bayar
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* ==================== DESKTOP MODE ==================== */}
      {!isMobile && (
        <>
          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto min-h-0">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-neutral-400 py-8">
              <ShoppingBag className="w-12 h-12 mb-2" />
              <p>Belum ada pesanan</p>
              <p className="text-sm">Pilih menu dari daftar</p>
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
          <div className="px-4 py-3 border-t border-neutral-200 flex-shrink-0">
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
              onClick={handleSaveClick}
              disabled={!canSubmit || isSaving}
              className={cn(
                "flex-1 px-4 py-3 rounded-lg font-medium transition-colors",
                canSubmit 
                  ? "bg-neutral-200 text-neutral-700 hover:bg-neutral-300" 
                  : "bg-neutral-100 text-neutral-400 cursor-not-allowed",
                isSaving && "opacity-50 cursor-not-allowed"
              )}
            >
              {isSaving ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button
              onClick={handlePayClick}
              disabled={!canSubmit || isSaving}
              className={cn(
                "flex-1 px-4 py-3 rounded-lg font-medium transition-colors",
                canSubmit 
                  ? "bg-primary-500 text-white hover:bg-primary-600" 
                  : "bg-primary-200 text-primary-400 cursor-not-allowed"
              )}
            >
              Bayar
            </button>
          </div>
        </div>
        </>
      )}
      
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
