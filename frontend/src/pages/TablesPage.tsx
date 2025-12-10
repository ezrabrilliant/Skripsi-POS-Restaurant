import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Clock, Users } from 'lucide-react'
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
      <div className="p-4 bg-white border-b border-neutral-200">
        <h1 className="text-xl font-semibold text-neutral-800">Status Meja</h1>
        <div className="flex gap-4 mt-2 text-sm text-neutral-500">
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-warning-400" />
            Terisi: {occupiedCount}
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-neutral-200" />
            Kosong: {emptyCount}
          </span>
        </div>
      </div>
      
      {/* Tables Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="aspect-square bg-neutral-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {tableStatuses.map((table) => (
              <button
                key={table.tableNumber}
                onClick={() => handleTableClick(table.tableNumber)}
                className={cn(
                  'aspect-square rounded-xl p-4 flex flex-col items-center justify-center transition-all hover:shadow-lg',
                  table.status === 'occupied'
                    ? 'bg-warning-50 border-2 border-warning-400'
                    : 'bg-white border-2 border-neutral-200 hover:border-primary-300'
                )}
              >
                <span className="text-3xl font-bold text-neutral-800 mb-2">
                  {table.tableNumber}
                </span>
                
                {table.status === 'occupied' ? (
                  <div className="text-center">
                    <p className="text-sm font-semibold text-warning-600">
                      {formatCurrency(table.totalAmount || 0)}
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-1 text-xs text-neutral-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {table.itemCount} item
                      </span>
                      {table.createdAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(table.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <span className="text-sm text-neutral-400">Kosong</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
