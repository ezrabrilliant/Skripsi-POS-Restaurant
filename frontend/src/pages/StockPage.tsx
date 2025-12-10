import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Package, Plus, Minus, RefreshCcw } from 'lucide-react'
import { stockService, menuService } from '@/services'
import { getTodayDate } from '@/lib/utils'
import { MenuWithStock } from '@/types'

interface StockData {
  id: string
  menuId: string
  currentStock: number
}

export default function StockPage() {
  const [selectedDate, setSelectedDate] = useState(getTodayDate())
  const queryClient = useQueryClient()
  
  // Fetch menu items
  const { data: menuItems = [], isLoading: loadingMenu } = useQuery<MenuWithStock[]>({
    queryKey: ['menu'],
    queryFn: menuService.getAllMenu,
  })
  
  // Fetch daily stock
  const { data: stockData = [], isLoading: loadingStock, refetch: refetchStock } = useQuery<StockData[]>({
    queryKey: ['stock', selectedDate],
    queryFn: () => stockService.getDailyStock(selectedDate),
  })
  
  // Initialize stock mutation
  const initStockMutation = useMutation({
    mutationFn: (menuId: string) => stockService.initializeStock(menuId, selectedDate),
    onSuccess: () => {
      toast.success('Stock initialized')
      queryClient.invalidateQueries({ queryKey: ['stock'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
  
  // Adjust stock mutation
  const adjustMutation = useMutation({
    mutationFn: ({ stockId, adjustment }: { stockId: string, adjustment: number }) => 
      stockService.adjustStock(stockId, adjustment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
  
  // Get stock for a menu item
  const getStockForMenu = (menuId: string) => {
    return stockData.find((s) => s.menuId === menuId)
  }
  
  // Group menu by category
  const categories = [...new Set(menuItems.map((m) => m.category))]
  
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-neutral-800">Manajemen Stok</h1>
            <p className="text-neutral-500">Atur stok harian menu</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              onClick={() => refetchStock()}
              className="p-2 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50"
            >
              <RefreshCcw className="w-5 h-5 text-neutral-600" />
            </button>
          </div>
        </div>
        
        {loadingMenu || loadingStock ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-neutral-200 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {categories.map(category => (
              <div key={category}>
                <h2 className="font-semibold text-neutral-700 mb-3">{category}</h2>
                <div className="space-y-2">
                  {menuItems
                    .filter((m) => m.category === category)
                    .map((menu) => {
                      const stock = getStockForMenu(menu.id)
                      return (
                        <div
                          key={menu.id}
                          className="bg-white rounded-lg p-4 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center">
                              <Package className="w-5 h-5 text-neutral-500" />
                            </div>
                            <div>
                              <p className="font-medium text-neutral-800">{menu.name}</p>
                              <p className="text-sm text-neutral-500">
                                Default: {menu.stockStart || 0} porsi
                              </p>
                            </div>
                          </div>
                          
                          {stock ? (
                            <div className="flex items-center gap-3">
                              <div className="text-right mr-4">
                                <p className="text-sm text-neutral-500">Stok Sisa</p>
                                <p className={`text-xl font-bold ${
                                  stock.currentStock > 5 ? 'text-success-600' :
                                  stock.currentStock > 0 ? 'text-warning-600' :
                                  'text-danger-600'
                                }`}>
                                  {stock.currentStock}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => adjustMutation.mutate({
                                    stockId: stock.id,
                                    adjustment: -1
                                  })}
                                  className="p-2 bg-neutral-100 rounded-lg hover:bg-neutral-200"
                                >
                                  <Minus className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => adjustMutation.mutate({
                                    stockId: stock.id,
                                    adjustment: 1
                                  })}
                                  className="p-2 bg-neutral-100 rounded-lg hover:bg-neutral-200"
                                >
                                  <Plus className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => initStockMutation.mutate(menu.id)}
                              disabled={initStockMutation.isPending}
                              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                            >
                              Initialize Stock
                            </button>
                          )}
                        </div>
                      )
                    })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
