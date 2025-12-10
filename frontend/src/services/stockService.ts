import api from '@/lib/api'
import type { ApiResponse } from '@/types'

interface StockItem {
  id: string
  menuId: string
  menuName: string
  category: string
  stockStart: number
  stockSold: number
  stockRemaining: number
}

export const stockService = {
  getStocks: async () => {
    const response = await api.get<ApiResponse<StockItem[]>>('/stocks')
    return response.data.data
  },
  
  initializeStock: async (stocks?: { menuId: string; stockStart: number }[]) => {
    const response = await api.post<ApiResponse<{ message: string }>>('/stocks/initialize', { stocks })
    return response.data
  },
  
  updateStock: async (menuId: string, data: { stockStart?: number; addStock?: number }) => {
    const response = await api.put<ApiResponse<StockItem>>(`/stocks/${menuId}`, data)
    return response.data.data
  },
}
