import api from '@/lib/api'
import type { ApiResponse } from '@/types'

interface StockItem {
  id: string
  menuId: string
  menuName: string
  category: string
  price: number
  stockStart: number
  stockSold: number
  stockRemaining: number
}

// Transform snake_case to camelCase
const transformStock = (stock: any): StockItem => ({
  id: stock.id,
  menuId: stock.menu_id,
  menuName: stock.menu_name,
  category: stock.category,
  price: stock.price,
  stockStart: stock.stock_start,
  stockSold: stock.stock_sold,
  stockRemaining: stock.stock_remaining,
})

export const stockService = {
  getStocks: async (): Promise<StockItem[]> => {
    const response = await api.get<ApiResponse<any[]>>('/stocks')
    return response.data.data.map(transformStock)
  },
  
  getDailyStock: async (date: string): Promise<StockItem[]> => {
    const response = await api.get<ApiResponse<any[]>>('/stocks', { params: { date } })
    return response.data.data.map(transformStock)
  },
  
  setStock: async (menuId: string, stockStart: number, date?: string): Promise<StockItem> => {
    const response = await api.post<ApiResponse<any>>('/stocks', { 
      menu_id: menuId, 
      stock_start: stockStart,
      date 
    })
    return transformStock(response.data.data)
  },
  
  bulkSetStock: async (stocks: { menuId: string; stockStart: number }[], date?: string): Promise<StockItem[]> => {
    const response = await api.post<ApiResponse<any[]>>('/stocks/bulk', { 
      stocks: stocks.map(s => ({ menu_id: s.menuId, stock_start: s.stockStart })),
      date 
    })
    return response.data.data.map(transformStock)
  },
  
  updateStock: async (stockId: string, data: { stockStart?: number; addStock?: number }): Promise<StockItem> => {
    const apiData: any = {}
    if (data.stockStart !== undefined) apiData.stock_start = data.stockStart
    if (data.addStock !== undefined) apiData.add_stock = data.addStock
    const response = await api.put<ApiResponse<any>>(`/stocks/${stockId}`, apiData)
    return transformStock(response.data.data)
  },
}
