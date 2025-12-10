import { X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { transactionService } from '@/services/transactionService'
import { cn } from '@/lib/utils'

interface TableSelectModalProps {
  isOpen: boolean
  selectedTable: string
  onSelect: (table: string) => void
  onClose: () => void
}

export default function TableSelectModal({ isOpen, selectedTable, onSelect, onClose }: TableSelectModalProps) {
  const { data: tableStatuses = [] } = useQuery({
    queryKey: ['tableStatuses'],
    queryFn: () => transactionService.getTableStatuses(),
    enabled: isOpen,
  })
  
  if (!isOpen) return null
  
  const tables = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600"
        >
          <X className="w-5 h-5" />
        </button>
        
        <h3 className="text-lg font-semibold text-neutral-800 mb-4">
          Pilih Nomor Meja
        </h3>
        
        <div className="grid grid-cols-4 gap-2">
          {tables.map((table) => {
            const status = tableStatuses.find((t) => t.tableNumber === table)
            const isOccupied = status?.status === 'occupied'
            const isSelected = selectedTable === table
            
            return (
              <button
                key={table}
                onClick={() => onSelect(table)}
                disabled={isOccupied && !isSelected}
                className={cn(
                  'p-4 rounded-lg border-2 font-medium transition-colors',
                  isSelected
                    ? 'border-primary-500 bg-primary-50 text-primary-600'
                    : isOccupied
                    ? 'border-warning-300 bg-warning-50 text-warning-600 cursor-not-allowed'
                    : 'border-neutral-200 hover:border-primary-300 hover:bg-primary-50'
                )}
              >
                <span className="text-lg">{table}</span>
                {isOccupied && !isSelected && (
                  <span className="block text-xs mt-1">Terisi</span>
                )}
              </button>
            )
          })}
        </div>
        
        <div className="mt-4 flex gap-4 text-xs text-neutral-500">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-neutral-200" />
            <span>Kosong</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-warning-200" />
            <span>Terisi</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-primary-200" />
            <span>Dipilih</span>
          </div>
        </div>
      </div>
    </div>
  )
}
