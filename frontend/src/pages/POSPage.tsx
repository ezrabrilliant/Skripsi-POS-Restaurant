import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ShoppingCart, X, ChevronUp } from 'lucide-react'
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
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Drag state for swipeable bottom sheet
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef(0)
  const currentTranslateY = useRef(0)
  const isDragging = useRef(false)
  
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
  
  // Collapsed height = ~40% of screen, Expanded = ~95%
  const collapsedHeight = typeof window !== 'undefined' ? window.innerHeight * 0.4 : 300
  const expandedHeight = typeof window !== 'undefined' ? window.innerHeight * 0.95 : 600
  
  const handleDragStart = useCallback((clientY: number) => {
    isDragging.current = true
    dragStartY.current = clientY
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'none'
    }
  }, [])
  
  const handleDragMove = useCallback((clientY: number) => {
    if (!isDragging.current) return
    
    const deltaY = dragStartY.current - clientY
    const currentHeight = isExpanded ? expandedHeight : collapsedHeight
    let newHeight = currentHeight + deltaY
    
    // Clamp height
    newHeight = Math.max(collapsedHeight * 0.8, Math.min(expandedHeight, newHeight))
    
    if (sheetRef.current) {
      sheetRef.current.style.height = `${newHeight}px`
    }
    currentTranslateY.current = deltaY
  }, [isExpanded, collapsedHeight, expandedHeight])
  
  const handleDragEnd = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false
    
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'height 0.3s ease-out'
    }
    
    const threshold = 50
    
    if (isExpanded) {
      // If dragging down from expanded
      if (currentTranslateY.current < -threshold) {
        setIsExpanded(false)
      } else {
        // Stay expanded
        if (sheetRef.current) sheetRef.current.style.height = `${expandedHeight}px`
      }
    } else {
      // If dragging up from collapsed
      if (currentTranslateY.current > threshold) {
        setIsExpanded(true)
      } else if (currentTranslateY.current < -threshold) {
        // Dragging down from collapsed = close
        setShowMobileCart(false)
        setIsExpanded(false)
      } else {
        // Stay collapsed
        if (sheetRef.current) sheetRef.current.style.height = `${collapsedHeight}px`
      }
    }
    
    currentTranslateY.current = 0
  }, [isExpanded, collapsedHeight, expandedHeight])
  
  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientY)
  }, [handleDragStart])
  
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientY)
  }, [handleDragMove])
  
  const handleTouchEnd = useCallback(() => {
    handleDragEnd()
  }, [handleDragEnd])
  
  // Reset sheet height when opening
  useEffect(() => {
    if (showMobileCart && sheetRef.current) {
      sheetRef.current.style.height = isExpanded ? `${expandedHeight}px` : `${collapsedHeight}px`
    }
  }, [showMobileCart, isExpanded, collapsedHeight, expandedHeight])
  
  // Reset expansion state when closing
  useEffect(() => {
    if (!showMobileCart) {
      setIsExpanded(false)
    }
  }, [showMobileCart])
  
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
      // Prepare items for API
      const apiItems = items.map(item => ({
        menuId: item.menuId,
        quantity: item.quantity,
        notes: item.notes,
        forceOrder: item.isForceOrder,
      }))
      
      if (transactionId) {
        // Update existing transaction - sync all items at once
        return transactionService.syncItems(transactionId, apiItems)
      } else {
        // Create new transaction first, then sync items
        const newTransaction = await transactionService.createTransaction({
          tableNumber,
          notes,
        })
        // If there are items, sync them
        if (apiItems.length > 0) {
          return transactionService.syncItems(newTransaction.id, apiItems)
        }
        return newTransaction
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
      
      {/* Mobile: Slide-up Cart Panel - Swipeable Bottom Sheet */}
      <div
        className={cn(
          'md:hidden fixed inset-0 z-40 transition-opacity duration-300',
          showMobileCart ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      >
        {/* Backdrop - fades based on expansion */}
        <div 
          className={cn(
            "absolute inset-0 transition-opacity duration-300",
            isExpanded ? "bg-transparent" : "bg-black/50"
          )}
          onClick={() => {
            setShowMobileCart(false)
            setIsExpanded(false)
          }}
        />
        
        {/* Swipeable Bottom Sheet */}
        <div
          ref={sheetRef}
          className={cn(
            'absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-xl',
            'flex flex-col overflow-hidden',
            'transition-transform duration-300 ease-out',
            showMobileCart ? 'translate-y-0' : 'translate-y-full'
          )}
          style={{ height: isExpanded ? expandedHeight : collapsedHeight }}
        >
          {/* Drag Handle */}
          <div 
            className="flex flex-col items-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={(e) => handleDragStart(e.clientY)}
            onMouseMove={(e) => {
              if (isDragging.current) handleDragMove(e.clientY)
            }}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
          >
            <div className="w-12 h-1.5 bg-neutral-300 rounded-full mb-2" />
            <div className="flex items-center gap-1 text-xs text-neutral-400">
              <ChevronUp className={cn(
                "w-4 h-4 transition-transform",
                isExpanded && "rotate-180"
              )} />
              <span>{isExpanded ? 'Geser turun untuk memperkecil' : 'Geser keatas untuk melihat semua'}</span>
            </div>
          </div>
          
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-200">
            <h2 className="font-semibold text-neutral-800">
              Keranjang ({itemCount})
            </h2>
            <button
              onClick={() => {
                setShowMobileCart(false)
                setIsExpanded(false)
              }}
              className="p-2 -mr-2 text-neutral-500 hover:text-neutral-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Cart Content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <CartPanel 
              onSaveOrder={handleSaveOrder}
              isSaving={saveOrderMutation.isPending}
              isMobile={true}
              isCollapsed={!isExpanded}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
