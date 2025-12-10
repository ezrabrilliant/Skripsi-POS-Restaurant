import api from '@/lib/api'
import type { Settlement, ApiResponse } from '@/types'

export const settlementService = {
  getSettlements: async (params?: { startDate?: string; endDate?: string; limit?: number }) => {
    const response = await api.get<ApiResponse<Settlement[]>>('/settlements', { params })
    return response.data.data
  },
  
  getSettlementByDate: async (date: string) => {
    const response = await api.get<ApiResponse<Settlement | null>>(`/settlements/date/${date}`)
    return response.data.data
  },
  
  calculateSystemTotals: async (date: string) => {
    const response = await api.get<ApiResponse<{
      date: string
      transactionCount: number
      systemCash: number
      systemEdc: number
      systemTransfer: number
      systemTotal: number
    }>>(`/settlements/calculate/${date}`)
    return response.data.data
  },
  
  createSettlement: async (data: {
    date: string
    actualCash: number
    actualEdc: number
    actualTransfer: number
    varianceReason?: string
    notes?: string
  }) => {
    const response = await api.post<ApiResponse<Settlement>>('/settlements', data)
    return response.data.data
  },
  
  reviewSettlement: async (id: string, notes?: string) => {
    const response = await api.put<ApiResponse<Settlement>>(`/settlements/${id}/review`, { notes })
    return response.data.data
  },
}
