import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Receipt, ChevronRight, ArrowLeft } from 'lucide-react'
import { transactionService } from '@/services/transactionService'
import { formatCurrency, formatDateTime, getTodayDate, cn } from '@/lib/utils'
import type { Transaction } from '@/types'

export default function HistoryPage() {
  const [selectedDate, setSelectedDate] = useState(getTodayDate())
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showMobileDetail, setShowMobileDetail] = useState(false)
  
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', selectedDate, statusFilter],
    queryFn: () => transactionService.getTransactions({
      date: selectedDate,
      status: statusFilter !== 'all' ? statusFilter : undefined,
    }),
  })
  
  const { data: summary } = useQuery({
    queryKey: ['todaySummary'],
    queryFn: () => transactionService.getDailySummary(),
  })
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <span className="px-2 py-0.5 bg-success-100 text-success-700 text-xs rounded-full">Lunas</span>
      case 'open':
        return <span className="px-2 py-0.5 bg-warning-100 text-warning-700 text-xs rounded-full">Open</span>
      case 'void':
        return <span className="px-2 py-0.5 bg-danger-100 text-danger-700 text-xs rounded-full">Batal</span>
      default:
        return null
    }
  }
  
  const handleSelectTransaction = (tx: Transaction) => {
    setSelectedTransaction(tx)
    setShowMobileDetail(true)
  }
  
  return (
    <div className="h-full flex flex-col md:flex-row">
      {/* Left - Transaction List */}
      <div className={cn(
        "flex-1 md:w-1/2 md:border-r border-neutral-200 flex flex-col",
        showMobileDetail && "hidden md:flex"
      )}>
        {/* Header */}
        <div className="p-3 sm:p-4 bg-white border-b border-neutral-200">
          <h1 className="text-lg sm:text-xl font-semibold text-neutral-800 mb-3 sm:mb-4">Riwayat Transaksi</h1>
          
          {/* Date Filter */}
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-neutral-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          
          {/* Status Filter */}
          <div className="flex gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
            {['all', 'paid', 'open', 'void'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  'px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap',
                  statusFilter === status
                    ? 'bg-primary-500 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                )}
              >
                {status === 'all' ? 'Semua' : status === 'paid' ? 'Lunas' : status === 'open' ? 'Open' : 'Batal'}
              </button>
            ))}
          </div>
        </div>
        
        {/* Summary Cards */}
        {selectedDate === getTodayDate() && summary && (
          <div className="p-3 sm:p-4 bg-neutral-50 border-b border-neutral-200">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white p-2.5 sm:p-3 rounded-lg">
                <p className="text-[10px] sm:text-xs text-neutral-500">Total Transaksi</p>
                <p className="font-semibold text-neutral-800 text-sm sm:text-base">{summary.totalTransactions}</p>
              </div>
              <div className="bg-white p-2.5 sm:p-3 rounded-lg">
                <p className="text-[10px] sm:text-xs text-neutral-500">Total Penjualan</p>
                <p className="font-semibold text-primary-600 text-sm sm:text-base">{formatCurrency(summary.grandTotal)}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Transaction List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-neutral-200 h-16 sm:h-20 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-neutral-400">
              <Receipt className="w-10 h-10 sm:w-12 sm:h-12 mb-2" />
              <p className="text-sm">Tidak ada transaksi</p>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {transactions.map((tx) => (
                <li key={tx.id}>
                  <button
                    onClick={() => handleSelectTransaction(tx)}
                    className={cn(
                      'w-full p-3 sm:p-4 text-left hover:bg-neutral-50 transition-colors flex items-center justify-between active:bg-neutral-100',
                      selectedTransaction?.id === tx.id && 'bg-primary-50'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5 sm:mb-1">
                        <span className="font-medium text-neutral-800 text-sm sm:text-base">Meja {tx.tableNumber}</span>
                        {getStatusBadge(tx.status)}
                      </div>
                      <p className="text-xs sm:text-sm text-neutral-500 truncate">
                        {formatDateTime(tx.createdAt)}
                      </p>
                      {tx.paymentMethod && (
                        <p className="text-[10px] sm:text-xs text-neutral-400 mt-0.5 sm:mt-1">
                          {tx.paymentMethod === 'cash' ? 'Tunai' : tx.paymentMethod.toUpperCase()}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-2">
                      <p className="font-semibold text-neutral-800 text-sm sm:text-base">
                        {formatCurrency(tx.totalAmount)}
                      </p>
                      <ChevronRight className="w-4 h-4 text-neutral-400 mt-1 ml-auto" />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      
      {/* Right - Transaction Detail (Desktop: side panel, Mobile: full screen overlay) */}
      <div className={cn(
        "md:w-1/2 bg-white",
        // Mobile: Full screen when shown
        "fixed inset-0 z-50 md:relative md:z-auto",
        showMobileDetail ? "block" : "hidden md:block"
      )}>
        {selectedTransaction ? (
          <div className="h-full flex flex-col">
            <div className="p-3 sm:p-4 border-b border-neutral-200">
              {/* Mobile Back Button */}
              <button
                onClick={() => setShowMobileDetail(false)}
                className="md:hidden flex items-center gap-2 text-neutral-600 mb-3"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Kembali</span>
              </button>
              
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base sm:text-lg font-semibold text-neutral-800">
                  Detail Transaksi
                </h2>
                {getStatusBadge(selectedTransaction.status)}
              </div>
              <p className="text-xs sm:text-sm text-neutral-500">
                Meja {selectedTransaction.tableNumber} • {formatDateTime(selectedTransaction.createdAt)}
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
              {/* Items */}
              <h3 className="font-medium text-neutral-600 mb-2 text-sm sm:text-base">Items</h3>
              <ul className="space-y-2 mb-6">
                {selectedTransaction.items.map((item) => (
                  <li key={item.id} className="flex justify-between text-sm sm:text-base">
                    <div className="min-w-0 flex-1">
                      <span className="text-neutral-800">{item.menuName}</span>
                      <span className="text-neutral-500 ml-2">x{item.quantity}</span>
                      {item.notes && (
                        <p className="text-xs text-neutral-400 truncate">{item.notes}</p>
                      )}
                    </div>
                    <span className="text-neutral-800 ml-2">{formatCurrency(item.subtotal)}</span>
                  </li>
                ))}
              </ul>
              
              {/* Summary */}
              <div className="border-t border-neutral-200 pt-4 space-y-2">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-neutral-500">Subtotal</span>
                  <span>{formatCurrency(selectedTransaction.subtotal)}</span>
                </div>
                {selectedTransaction.discountAmount > 0 && (
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-neutral-500">Diskon</span>
                    <span className="text-danger-500">-{formatCurrency(selectedTransaction.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-base sm:text-lg pt-2 border-t border-neutral-200">
                  <span>Total</span>
                  <span className="text-primary-600">{formatCurrency(selectedTransaction.totalAmount)}</span>
                </div>
                
                {selectedTransaction.status === 'paid' && (
                  <>
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-neutral-500">Dibayar</span>
                      <span>{formatCurrency(selectedTransaction.amountPaid)}</span>
                    </div>
                    {selectedTransaction.changeAmount > 0 && (
                      <div className="flex justify-between text-xs sm:text-sm">
                        <span className="text-neutral-500">Kembalian</span>
                        <span>{formatCurrency(selectedTransaction.changeAmount)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full hidden md:flex items-center justify-center text-neutral-400">
            <div className="text-center">
              <Receipt className="w-12 h-12 mx-auto mb-2" />
              <p>Pilih transaksi untuk melihat detail</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
