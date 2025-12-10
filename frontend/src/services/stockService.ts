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
  getStocks: async (): Promise<StockItem[]> => {
    const response = await api.get<ApiResponse<StockItem[]>>('/stocks')
    return response.data.data
  },
  
  getDailyStock: async (date: string): Promise<StockItem[]> => {
    const response = await api.get<ApiResponse<StockItem[]>>('/stocks', { params: { date } })
    return response.data.data
  },
  
  initializeStock: async (menuId: string, date?: string): Promise<StockItem> => {
    const response = await api.post<ApiResponse<StockItem>>('/stocks/initialize', { menuId, date })
    return response.data.data
  },
  
  adjustStock: async (stockId: string, adjustment: number): Promise<StockItem> => {
    const response = await api.put<ApiResponse<StockItem>>(`/stocks/${stockId}/adjust`, { adjustment })
    return response.data.data
  },
  
  updateStock: async (menuId: string, data: { stockStart?: number; addStock?: number }): Promise<StockItem> => {
    const response = await api.put<ApiResponse<StockItem>>(`/stocks/${menuId}`, data)
    return response.data.data
  },
}
