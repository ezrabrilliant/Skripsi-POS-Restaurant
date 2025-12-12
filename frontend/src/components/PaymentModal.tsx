import { useState } from 'react'
import { X, Check } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { transactionService } from '@/services/transactionService'
import { useCartStore } from '@/stores/cartStore'
import { formatCurrency, cn } from '@/lib/utils'
import { PAYMENT_METHODS, PaymentMethod } from '@/types'

interface PaymentModalProps {
  isOpen: boolean
  totalAmount: number
  onClose: () => void
}

export default function PaymentModal({ isOpen, totalAmount, onClose }: PaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [amountPaid, setAmountPaid] = useState<string>('')
  const queryClient = useQueryClient()
  
  const { items, tableNumber, transactionId, notes, clearCart } = useCartStore()
  
  const saveAndPayMutation = useMutation({
    mutationFn: async () => {
      let txId = transactionId
      
      // Prepare items for API
      const apiItems = items.map(item => ({
        menuId: item.menuId,
        quantity: item.quantity,
        notes: item.notes,
        forceOrder: item.isForceOrder,
      }))
      
      // If no transaction exists, create one first
      if (!txId) {
        const tx = await transactionService.createTransaction({
          tableNumber,
          notes,
        })
        txId = tx.id
        // Sync items if any
        if (apiItems.length > 0) {
          await transactionService.syncItems(txId, apiItems)
        }
      } else {
        // Update existing transaction - sync all items at once
        await transactionService.syncItems(txId, apiItems)
      }
      
      // Process payment
      const paid = await transactionService.processPayment(txId, {
        paymentMethod,
        amountPaid: Number(amountPaid) || totalAmount,
      })
      
      return paid
    },
    onSuccess: (data) => {
      toast.success('Pembayaran berhasil!')
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['tableStatuses'] })
      queryClient.invalidateQueries({ queryKey: ['menus'] })
      clearCart()
      onClose()
      
      // Show change amount for cash
      if (paymentMethod === 'cash' && data.changeAmount > 0) {
        toast(`Kembalian: ${formatCurrency(data.changeAmount)}`, {
          duration: 5000,
          icon: '💵',
        })
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Gagal memproses pembayaran')
    },
  })
  
  const handlePayment = () => {
    const paid = Number(amountPaid) || totalAmount
    
    if (paymentMethod === 'cash' && paid < totalAmount) {
      toast.error('Jumlah bayar kurang dari total')
      return
    }
    
    saveAndPayMutation.mutate()
  }
  
  const quickAmounts = [
    totalAmount,
    Math.ceil(totalAmount / 10000) * 10000,
    Math.ceil(totalAmount / 50000) * 50000,
    Math.ceil(totalAmount / 100000) * 100000,
  ].filter((v, i, a) => a.indexOf(v) === i) // Remove duplicates
  
  const changeAmount = Math.max(0, (Number(amountPaid) || 0) - totalAmount)
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200">
          <h3 className="text-lg font-semibold text-neutral-800">
            Pembayaran
          </h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4">
          {/* Total */}
          <div className="text-center mb-6">
            <p className="text-sm text-neutral-500 mb-1">Total Tagihan</p>
            <p className="text-3xl font-bold text-neutral-800">
              {formatCurrency(totalAmount)}
            </p>
          </div>
          
          {/* Payment Methods */}
          <div className="mb-6">
            <p className="text-sm font-medium text-neutral-600 mb-2">Metode Pembayaran</p>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.value}
                  onClick={() => setPaymentMethod(method.value)}
                  className={cn(
                    'px-4 py-3 rounded-lg border-2 font-medium transition-colors text-sm',
                    paymentMethod === method.value
                      ? 'border-primary-500 bg-primary-50 text-primary-600'
                      : 'border-neutral-200 hover:border-neutral-300'
                  )}
                >
                  {method.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Amount Input (for cash) */}
          {paymentMethod === 'cash' && (
            <div className="mb-6">
              <p className="text-sm font-medium text-neutral-600 mb-2">Jumlah Diterima</p>
              <input
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder={formatCurrency(totalAmount)}
                className="w-full px-4 py-3 text-xl font-semibold text-center bg-neutral-100 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              
              {/* Quick Amount Buttons */}
              <div className="flex gap-2 mt-2">
                {quickAmounts.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setAmountPaid(String(amount))}
                    className="flex-1 px-2 py-2 text-sm bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                  >
                    {formatCurrency(amount)}
                  </button>
                ))}
              </div>
              
              {/* Change Amount */}
              {changeAmount > 0 && (
                <div className="mt-4 p-3 bg-success-50 rounded-lg text-center">
                  <p className="text-sm text-success-600">Kembalian</p>
                  <p className="text-xl font-bold text-success-700">
                    {formatCurrency(changeAmount)}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-200">
          <button
            onClick={handlePayment}
            disabled={saveAndPayMutation.isPending}
            className="w-full px-4 py-3 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saveAndPayMutation.isPending ? (
              'Memproses...'
            ) : (
              <>
                <Check className="w-5 h-5" />
                Konfirmasi Pembayaran
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
