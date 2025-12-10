import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, TrendingUp, TrendingDown, DollarSign, ShoppingBag, Calendar, Download } from 'lucide-react'
import { transactionService, settlementService } from '@/services'
import { formatCurrency, getTodayDate } from '@/lib/utils'
import { Transaction, TransactionItem } from '@/types'

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 7)
    return date.toISOString().split('T')[0]
  })
  const [dateUntil, setDateUntil] = useState(getTodayDate())
  
  // Fetch transactions for the period
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', 'report', dateFrom, dateUntil],
    queryFn: () => transactionService.getTransactions({
      startDate: dateFrom,
      endDate: dateUntil,
      status: 'paid',
    }),
  })
  
  // Fetch settlements
  const { data: settlements = [] } = useQuery({
    queryKey: ['settlements', dateFrom, dateUntil],
    queryFn: () => settlementService.getSettlements({ startDate: dateFrom, endDate: dateUntil }),
  })
  
  // Calculate stats
  const totalRevenue = transactions.reduce((sum: number, t: Transaction) => sum + t.totalAmount, 0)
  const totalTransactions = transactions.length
  const avgTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0
  
  // Payment method breakdown
  const paymentBreakdown = transactions.reduce((acc: Record<string, number>, t: Transaction) => {
    const method = t.paymentMethod || 'unknown'
    acc[method] = (acc[method] || 0) + t.totalAmount
    return acc
  }, {})
  
  // Top selling items
  const itemSales = transactions.reduce((acc: Record<string, { name: string, qty: number, revenue: number }>, t: Transaction) => {
    (t.items || []).forEach((item: TransactionItem) => {
      const key = item.menuId
      if (!acc[key]) {
        acc[key] = { name: item.menu?.name || 'Unknown', qty: 0, revenue: 0 }
      }
      acc[key].qty += item.quantity
      acc[key].revenue += item.subtotal
    })
    return acc
  }, {})
  
  const topItems = Object.values(itemSales)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
  
  // Daily revenue chart data
  const dailyRevenue = transactions.reduce((acc: Record<string, number>, t: Transaction) => {
    const date = new Date(t.createdAt).toISOString().split('T')[0]
    acc[date] = (acc[date] || 0) + t.totalAmount
    return acc
  }, {})
  
  const dailyRevenueArray = Object.entries(dailyRevenue)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date, amount }))
  
  // Settlement summary
  const totalVariance = settlements.reduce((sum: number, s: { variance?: number }) => sum + (s.variance || 0), 0)
  
  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Tanggal', 'No. Transaksi', 'Meja', 'Total', 'Metode Pembayaran', 'Kasir']
    const rows = transactions.map((t: Transaction) => [
      new Date(t.createdAt).toLocaleString('id-ID'),
      t.id.slice(0, 8),
      t.tableNumber || '-',
      t.totalAmount,
      t.paymentMethod || '-',
      t.user?.name || '-',
    ])
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `laporan-${dateFrom}-${dateUntil}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-neutral-800">Laporan</h1>
            <p className="text-neutral-500">Analisis penjualan</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-4 py-2 bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <span className="text-neutral-400">-</span>
              <input
                type="date"
                value={dateUntil}
                onChange={(e) => setDateUntil(e.target.value)}
                className="px-4 py-2 bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
        
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-neutral-200 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-neutral-500">Total Pendapatan</p>
                    <p className="text-2xl font-bold text-neutral-800">{formatCurrency(totalRevenue)}</p>
                  </div>
                  <div className="w-10 h-10 bg-success-100 rounded-full flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-success-600" />
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-neutral-500">Total Transaksi</p>
                    <p className="text-2xl font-bold text-neutral-800">{totalTransactions}</p>
                  </div>
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 text-primary-600" />
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-neutral-500">Rata-rata Transaksi</p>
                    <p className="text-2xl font-bold text-neutral-800">{formatCurrency(avgTransactionValue)}</p>
                  </div>
                  <div className="w-10 h-10 bg-warning-100 rounded-full flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-warning-600" />
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-neutral-500">Selisih Kasir</p>
                    <p className={`text-2xl font-bold ${totalVariance >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                      {formatCurrency(Math.abs(totalVariance))}
                    </p>
                  </div>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    totalVariance >= 0 ? 'bg-success-100' : 'bg-danger-100'
                  }`}>
                    {totalVariance >= 0 ? (
                      <TrendingUp className="w-5 h-5 text-success-600" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-danger-600" />
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Payment Breakdown */}
              <div className="bg-white rounded-xl p-6">
                <h2 className="font-semibold text-neutral-800 mb-4">Metode Pembayaran</h2>
                <div className="space-y-4">
                  {Object.entries(paymentBreakdown).map(([method, amount]) => (
                    <div key={method} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          method === 'cash' ? 'bg-success-500' :
                          method === 'transfer' ? 'bg-primary-500' :
                          'bg-warning-500'
                        }`} />
                        <span className="text-neutral-600 capitalize">
                          {method === 'cash' ? 'Tunai' :
                           method === 'transfer' ? 'Transfer' :
                           method.includes('edc') ? 'EDC' : method}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(amount as number)}</p>
                        <p className="text-xs text-neutral-400">
                          {((amount as number / totalRevenue) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Top Selling Items */}
              <div className="bg-white rounded-xl p-6">
                <h2 className="font-semibold text-neutral-800 mb-4">Menu Terlaris</h2>
                {topItems.length === 0 ? (
                  <p className="text-neutral-500 text-center py-8">Belum ada data</p>
                ) : (
                  <div className="space-y-3">
                    {topItems.map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            index === 0 ? 'bg-warning-100 text-warning-600' :
                            index === 1 ? 'bg-neutral-200 text-neutral-600' :
                            index === 2 ? 'bg-warning-50 text-warning-500' :
                            'bg-neutral-100 text-neutral-500'
                          }`}>
                            {index + 1}
                          </span>
                          <span className="text-neutral-700">{item.name}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(item.revenue)}</p>
                          <p className="text-xs text-neutral-400">{item.qty} porsi</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Daily Revenue */}
              <div className="bg-white rounded-xl p-6 lg:col-span-2">
                <h2 className="font-semibold text-neutral-800 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Pendapatan Harian
                </h2>
                {dailyRevenueArray.length === 0 ? (
                  <p className="text-neutral-500 text-center py-8">Belum ada data</p>
                ) : (
                  <div className="space-y-2">
                    {dailyRevenueArray.map(({ date, amount }) => {
                      const maxAmount = Math.max(...dailyRevenueArray.map(d => d.amount))
                      const percentage = (amount / maxAmount) * 100
                      return (
                        <div key={date} className="flex items-center gap-4">
                          <span className="text-sm text-neutral-500 w-24">
                            {new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                          </span>
                          <div className="flex-1 h-8 bg-neutral-100 rounded-lg overflow-hidden">
                            <div
                              className="h-full bg-primary-500 rounded-lg flex items-center justify-end pr-2"
                              style={{ width: `${percentage}%` }}
                            >
                              {percentage > 30 && (
                                <span className="text-xs text-white font-medium">
                                  {formatCurrency(amount)}
                                </span>
                              )}
                            </div>
                          </div>
                          {percentage <= 30 && (
                            <span className="text-sm text-neutral-600 w-24 text-right">
                              {formatCurrency(amount)}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
