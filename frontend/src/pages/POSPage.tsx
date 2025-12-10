import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import MenuGrid from '@/components/MenuGrid'
import CartPanel from '@/components/CartPanel'
import { transactionService } from '@/services/transactionService'
import { useCartStore } from '@/stores/cartStore'
import type { CartItem } from '@/types'

export default function POSPage() {
  const { tableNumber: urlTableNumber } = useParams()
  const queryClient = useQueryClient()
  
  const {
    items,
    tableNumber,
    transactionId,
    notes,
    discountAmount,
    setTableNumber,
    loadTransaction,
    clearCart,
  } = useCartStore()
  
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
    <div className="h-full flex">
      {/* Left Panel - Menu Grid (65%) */}
      <div className="w-[65%] border-r border-neutral-200">
        <MenuGrid />
      </div>
      
      {/* Right Panel - Cart (35%) */}
      <div className="w-[35%]">
        <CartPanel 
          onSaveOrder={handleSaveOrder}
          isSaving={saveOrderMutation.isPending}
        />
      </div>
    </div>
  )
}
