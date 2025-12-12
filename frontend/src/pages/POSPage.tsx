import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ShoppingCart, X } from 'lucide-react'
import MenuGrid from '@/components/MenuGrid'
import CartPanel from '@/components/CartPanel'
import { transactionService } from '@/services/transactionService'
import { useCartStore } from '@/stores/cartStore'
import { formatCurrency, cn } from '@/lib/utils'
import type { CartItem } from '@/types'

export default function POSPage() {
  const { tableNumber: urlTableNumber } = useParams()
  const queryClient = useQueryClient()
  const [showMobileCart, setShowMobileCart] = useState(false)
  
  const {
    items,
    tableNumber,
    transactionId,
    notes,
    discountAmount,
    total,
    setTableNumber,
    loadTransaction,
  } = useCartStore()
  
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)
  
  // Load existing transaction if table number is provided via URL
  const { data: existingTransaction } = useQuery({
    queryKey: ['transaction', 'table', urlTableNumber],
    queryFn: () => transactionService.getTransactionByTable(urlTableNumber!),
    enabled: !!urlTableNumber,
  })
  
  // Load transaction into cart when found
  useEffect(() => {
    if (urlTableNumber) {
      setTableNumber(urlTableNumber)
    }
    
    if (existingTransaction) {
      const cartItems: CartItem[] = existingTransaction.items.map((item) => ({
        id: item.id,
        menuId: item.menuId,
        menuName: item.menuName,
        price: item.priceAtTime,
        quantity: item.quantity,
        notes: item.notes || '',
        isForceOrder: item.isForceOrder,
        subtotal: item.subtotal,
      }))
      
      loadTransaction(
        existingTransaction.id,
        existingTransaction.tableNumber,
        cartItems,
        existingTransaction.notes || '',
        existingTransaction.discountAmount
      )
    }
  }, [urlTableNumber, existingTransaction, setTableNumber, loadTransaction])
  
  // Save order mutation
  const saveOrderMutation = useMutation({
    mutationFn: async () => {
      if (transactionId) {
        // Update existing transaction
        return transactionService.updateTransaction(transactionId, {
          items,
          notes,
          discountAmount,
        })
      } else {
        // Create new transaction
        return transactionService.createTransaction({
          tableNumber,
          items,
          notes,
          discountAmount,
        })
      }
    },
    onSuccess: (data) => {
      toast.success('Pesanan berhasil disimpan')
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['tableStatuses'] })
      queryClient.invalidateQueries({ queryKey: ['menus'] })
      
      // Update cart with transaction ID
      loadTransaction(
        data.id,
        data.tableNumber,
        items,
        notes,
        discountAmount
      )
      
      // Close mobile cart after successful save
      setShowMobileCart(false)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Gagal menyimpan pesanan')
    },
  })
  
  const handleSaveOrder = () => {
    if (items.length === 0) {
      toast.error('Tidak ada item di keranjang')
      return
    }
    if (!tableNumber) {
      toast.error('Pilih nomor meja terlebih dahulu')
      return
    }
    saveOrderMutation.mutate()
  }
  
  return (
    <div className="h-full flex flex-col md:flex-row relative">
      {/* Menu Grid - Full width on mobile, 60-65% on larger screens */}
      <div className="flex-1 md:w-[60%] lg:w-[65%] md:border-r border-neutral-200 pb-20 md:pb-0">
        <MenuGrid />
      </div>
      
      {/* Desktop/Tablet: Side Cart Panel */}
      <div className="hidden md:block md:w-[40%] lg:w-[35%]">
        <CartPanel 
          onSaveOrder={handleSaveOrder}
          isSaving={saveOrderMutation.isPending}
        />
      </div>
      
      {/* Mobile: Floating Cart Button */}
      <button
        onClick={() => setShowMobileCart(true)}
        className={cn(
          'md:hidden fixed bottom-20 right-4 z-30',
          'flex items-center gap-2 px-4 py-3 rounded-full shadow-lg',
          'bg-primary-500 text-white font-medium',
          'transition-transform active:scale-95'
        )}
      >
        <ShoppingCart className="w-5 h-5" />
        {itemCount > 0 && (
          <>
            <span className="text-sm">{itemCount} item</span>
            <span className="text-sm font-bold">{formatCurrency(total)}</span>
          </>
        )}
        {itemCount === 0 && <span className="text-sm">Keranjang</span>}
      </button>
      
      {/* Mobile: Cart Badge */}
      {itemCount > 0 && !showMobileCart && (
        <span className="md:hidden fixed bottom-[88px] right-4 z-30 w-6 h-6 flex items-center justify-center bg-danger-500 text-white text-xs font-bold rounded-full transform translate-x-1/2 -translate-y-1/2">
          {itemCount}
        </span>
      )}
      
      {/* Mobile: Slide-up Cart Panel */}
      <div
        className={cn(
          'md:hidden fixed inset-0 z-40 transition-opacity duration-300',
          showMobileCart ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      >
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/50"
          onClick={() => setShowMobileCart(false)}
        />
        
        {/* Cart Panel */}
        <div
          className={cn(
            'absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl',
            'max-h-[85vh] flex flex-col',
            'transition-transform duration-300 ease-out',
            showMobileCart ? 'translate-y-0' : 'translate-y-full'
          )}
        >
          {/* Handle & Close */}
          <div className="flex items-center justify-between p-4 border-b border-neutral-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-1 bg-neutral-300 rounded-full mx-auto" />
              <h2 className="font-semibold text-neutral-800">
                Keranjang ({itemCount})
              </h2>
            </div>
            <button
              onClick={() => setShowMobileCart(false)}
              className="p-2 -mr-2 text-neutral-500 hover:text-neutral-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Cart Content */}
          <div className="flex-1 overflow-hidden">
            <CartPanel 
              onSaveOrder={handleSaveOrder}
              isSaving={saveOrderMutation.isPending}
              isMobile={true}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
