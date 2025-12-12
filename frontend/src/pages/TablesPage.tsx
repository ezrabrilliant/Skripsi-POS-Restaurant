import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Clock, Users, Plus } from 'lucide-react'
import { transactionService } from '@/services/transactionService'
import { formatCurrency, formatTime, cn } from '@/lib/utils'

export default function TablesPage() {
  const navigate = useNavigate()
  
  const { data: tableStatuses = [], isLoading } = useQuery({
    queryKey: ['tableStatuses'],
    queryFn: () => transactionService.getTableStatuses(),
    refetchInterval: 10000, // Refresh every 10 seconds
  })
  
  const handleTableClick = (tableNumber: string) => {
    navigate(`/pos/${tableNumber}`)
  }
  
  const occupiedCount = tableStatuses.filter((t) => t.status === 'occupied').length
  const emptyCount = tableStatuses.filter((t) => t.status === 'empty').length
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 sm:p-4 bg-white border-b border-neutral-200">
        <h1 className="text-lg sm:text-xl font-semibold text-neutral-800">Status Meja</h1>
        <div className="flex gap-3 sm:gap-4 mt-2 text-xs sm:text-sm text-neutral-500">
          <span className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-warning-400" />
            Terisi: {occupiedCount}
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-neutral-200" />
            Kosong: {emptyCount}
          </span>
        </div>
      </div>
      
      {/* Tables Grid */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {isLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 lg:gap-4">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="aspect-square bg-neutral-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 lg:gap-4">
            {tableStatuses.map((table) => (
              <button
                key={table.tableNumber}
                onClick={() => handleTableClick(table.tableNumber)}
                className={cn(
                  'aspect-square rounded-xl p-2 sm:p-3 lg:p-4 flex flex-col items-center justify-center transition-all hover:shadow-lg active:scale-95',
                  table.status === 'occupied'
                    ? 'bg-warning-50 border-2 border-warning-400'
                    : 'bg-white border-2 border-neutral-200 hover:border-primary-300'
                )}
              >
                <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-neutral-800 mb-1 sm:mb-2">
                  {table.tableNumber}
                </span>
                
                {table.status === 'occupied' ? (
                  <div className="text-center">
                    <p className="text-xs sm:text-sm font-semibold text-warning-600 truncate max-w-full">
                      {formatCurrency(table.totalAmount || 0)}
                    </p>
                    <div className="hidden sm:flex items-center justify-center gap-2 mt-1 text-xs text-neutral-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {table.itemCount}
                      </span>
                      {table.createdAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(table.createdAt)}
                        </span>
                      )}
                    </div>
                    {/* Mobile: Simplified info */}
                    <div className="flex sm:hidden items-center justify-center gap-1 mt-0.5 text-[10px] text-neutral-500">
                      <Users className="w-2.5 h-2.5" />
                      <span>{table.itemCount} item</span>
                    </div>
                  </div>
                ) : (
                  <span className="text-xs sm:text-sm text-neutral-400">Kosong</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Mobile: Quick Add Button */}
      <button
        onClick={() => navigate('/pos')}
        className="md:hidden fixed bottom-20 right-4 z-30 w-14 h-14 flex items-center justify-center bg-primary-500 text-white rounded-full shadow-lg active:scale-95"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  )
}
