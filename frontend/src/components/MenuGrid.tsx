import { useState } from 'react'
import { Search, AlertTriangle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { menuService } from '@/services/menuService'
import { useCartStore } from '@/stores/cartStore'
import { formatCurrency, getStockStatus, cn } from '@/lib/utils'
import type { MenuWithStock } from '@/types'
import ForceOrderModal from './ForceOrderModal'

export default function MenuGrid() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [forceOrderMenu, setForceOrderMenu] = useState<MenuWithStock | null>(null)
  
  const { addItem, needsForceOrder } = useCartStore()
  
  // Fetch menus
  const { data: menus = [], isLoading } = useQuery({
    queryKey: ['menus'],
    queryFn: () => menuService.getMenus(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })
  
  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => menuService.getCategories(),
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  })
  
  // Filter menus
  const filteredMenus = menus.filter((menu) => {
    if (!menu.isActive) return false
    
    const matchesSearch = menu.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !selectedCategory || menu.category === selectedCategory
    
    return matchesSearch && matchesCategory
  })
  
  const handleMenuClick = (menu: MenuWithStock) => {
    if (needsForceOrder(menu)) {
      setForceOrderMenu(menu)
    } else {
      addItem(menu, false)
    }
  }
  
  const handleForceOrder = () => {
    if (forceOrderMenu) {
      addItem(forceOrderMenu, true)
      setForceOrderMenu(null)
    }
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="p-4 bg-white border-b border-neutral-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <input
            type="text"
            placeholder="Cari menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-neutral-100 border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>
      
      {/* Category Tabs */}
      <div className="px-4 py-3 bg-white border-b border-neutral-200 overflow-x-auto no-scrollbar">
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
              !selectedCategory
                ? 'bg-primary-500 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            )}
          >
            Semua
          </button>
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                selectedCategory === category
                  ? 'bg-primary-500 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              )}
            >
              {category}
            </button>
          ))}
        </div>
      </div>
      
      {/* Menu Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-neutral-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-neutral-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredMenus.length === 0 ? (
          <div className="text-center py-12 text-neutral-500">
            <p>Tidak ada menu ditemukan</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredMenus.map((menu) => {
              const stockStatus = getStockStatus(menu.stockRemaining)
              
              return (
                <button
                  key={menu.id}
                  onClick={() => handleMenuClick(menu)}
                  className={cn(
                    'relative bg-white rounded-lg p-4 text-left transition-all hover:shadow-md border-2',
                    stockStatus === 'available' && 'border-primary-500',
                    stockStatus === 'low' && 'border-warning-400',
                    stockStatus === 'empty' && 'border-warning-500 bg-warning-50'
                  )}
                >
                  {/* Stock Badge */}
                  {stockStatus === 'empty' && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 bg-warning-500 text-white text-xs font-medium rounded">
                      Habis
                    </span>
                  )}
                  {stockStatus === 'low' && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 bg-warning-400 text-white text-xs font-medium rounded">
                      Sisa {menu.stockRemaining}
                    </span>
                  )}
                  
                  <h3 className="font-medium text-neutral-800 mb-1 pr-12 line-clamp-2">
                    {menu.name}
                  </h3>
                  <p className="text-primary-600 font-semibold">
                    {formatCurrency(menu.price)}
                  </p>
                  
                  {stockStatus === 'empty' && (
                    <div className="mt-2 flex items-center gap-1 text-warning-600 text-xs">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Klik untuk Force Order</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
      
      {/* Force Order Modal */}
      <ForceOrderModal
        isOpen={!!forceOrderMenu}
        menu={forceOrderMenu}
        onClose={() => setForceOrderMenu(null)}
        onConfirm={handleForceOrder}
      />
    </div>
  )
}
