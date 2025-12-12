import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Package, Plus, Minus, RefreshCcw } from 'lucide-react'
import { stockService, menuService } from '@/services'
import { getTodayDate, cn } from '@/lib/utils'
import { MenuWithStock } from '@/types'

interface StockItem {
  id: string
  menuId: string
  menuName: string
  category: string
  stockStart: number
  stockSold: number
  stockRemaining: number
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
  const { data: stockData = [], isLoading: loadingStock, refetch: refetchStock } = useQuery<StockItem[]>({
    queryKey: ['stock', selectedDate],
    queryFn: () => stockService.getDailyStock(selectedDate),
  })
  
  // Set stock mutation (initialize or update)
  const setStockMutation = useMutation({
    mutationFn: ({ menuId, stockStart }: { menuId: string; stockStart: number }) => 
      stockService.setStock(menuId, stockStart, selectedDate),
    onSuccess: () => {
      toast.success('Stock berhasil diset')
      queryClient.invalidateQueries({ queryKey: ['stock'] })
      queryClient.invalidateQueries({ queryKey: ['menus'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
  
  // Update stock mutation
  const updateStockMutation = useMutation({
    mutationFn: ({ stockId, stockStart }: { stockId: string; stockStart: number }) => 
      stockService.updateStock(stockId, { stockStart }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] })
      queryClient.invalidateQueries({ queryKey: ['menus'] })
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
      <div className="max-w-4xl mx-auto p-3 sm:p-4 lg:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-neutral-800">Manajemen Stok</h1>
            <p className="text-sm text-neutral-500">Atur stok harian menu</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
            <button
              onClick={() => refetchStock()}
              className="p-2 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 active:bg-neutral-100"
            >
              <RefreshCcw className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-600" />
            </button>
          </div>
        </div>
        
        {loadingMenu || loadingStock ? (
          <div className="space-y-3 sm:space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 sm:h-20 bg-neutral-200 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {categories.map(category => (
              <div key={category}>
                <h2 className="font-semibold text-neutral-700 mb-2 sm:mb-3 text-sm sm:text-base">{category}</h2>
                <div className="space-y-2">
                  {menuItems
                    .filter((m) => m.category === category)
                    .map((menu) => {
                      const stock = getStockForMenu(menu.id)
                      return (
                        <div
                          key={menu.id}
                          className="bg-white rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          {/* Menu Info */}
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-neutral-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Package className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-500" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-neutral-800 text-sm sm:text-base truncate">{menu.name}</p>
                              <p className="text-xs sm:text-sm text-neutral-500">
                                Default: {menu.stockStart || 0} porsi
                              </p>
                            </div>
                          </div>
                          
                          {/* Stock Controls */}
                          {stock ? (
                            <div className="flex items-center justify-between sm:justify-end gap-3">
                              <div className="text-left sm:text-right sm:mr-2 lg:mr-4">
                                <p className="text-xs text-neutral-500">Stok Sisa</p>
                                <p className={cn(
                                  'text-lg sm:text-xl font-bold',
                                  stock.stockRemaining > 5 ? 'text-success-600' :
                                  stock.stockRemaining > 0 ? 'text-warning-600' :
                                  'text-danger-600'
                                )}>
                                  {stock.stockRemaining}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 sm:gap-2">
                                <button
                                  onClick={() => updateStockMutation.mutate({
                                    stockId: stock.id,
                                    stockStart: Math.max(0, stock.stockStart - 1)
                                  })}
                                  className="p-2 sm:p-2 bg-neutral-100 rounded-lg hover:bg-neutral-200 active:bg-neutral-300"
                                >
                                  <Minus className="w-4 h-4 sm:w-5 sm:h-5" />
                                </button>
                                <span className="w-10 text-center font-medium">{stock.stockStart}</span>
                                <button
                                  onClick={() => updateStockMutation.mutate({
                                    stockId: stock.id,
                                    stockStart: stock.stockStart + 1
                                  })}
                                  className="p-2 sm:p-2 bg-neutral-100 rounded-lg hover:bg-neutral-200 active:bg-neutral-300"
                                >
                                  <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setStockMutation.mutate({ menuId: menu.id, stockStart: 10 })}
                              disabled={setStockMutation.isPending}
                              className="w-full sm:w-auto px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 active:bg-primary-700 text-sm"
                            >
                              Set Stock
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
