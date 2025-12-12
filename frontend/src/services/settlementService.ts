import api from '@/lib/api'
import type { Settlement, ApiResponse } from '@/types'

// Transform snake_case to camelCase
const transformSettlement = (s: any): Settlement => ({
  id: s.id,
  date: s.date,
  cashierId: s.cashier_id || s.settled_by,
  transactionCount: s.transaction_count,
  systemCash: s.system_cash,
  systemEdc: s.system_edc,
  systemTransfer: s.system_transfer,
  systemTotal: s.system_total,
  actualCash: s.actual_cash,
  actualEdc: s.actual_edc,
  actualTransfer: s.actual_transfer,
  actualTotal: s.actual_total,
  variance: s.variance,
  varianceReason: s.variance_reason,
  status: s.status,
  settledBy: s.settled_by,
  settledByName: s.settled_by_user?.name,
  reviewedBy: s.reviewed_by,
  reviewedByName: s.reviewed_by_user?.name,
  notes: s.notes,
  createdAt: s.created_at,
  updatedAt: s.updated_at,
})

export const settlementService = {
  getSettlements: async (params?: { startDate?: string; endDate?: string; limit?: number }) => {
    const apiParams: any = {}
    if (params?.startDate) apiParams.start_date = params.startDate
    if (params?.endDate) apiParams.end_date = params.endDate
    if (params?.limit) apiParams.per_page = params.limit
    
    const response = await api.get<ApiResponse<any[]>>('/settlements', { params: apiParams })
    return response.data.data.map(transformSettlement)
  },
  
  getSettlementByDate: async (date: string) => {
    const response = await api.get<ApiResponse<any | null>>(`/settlements/date/${date}`)
    return response.data.data ? transformSettlement(response.data.data) : null
  },
  
  calculateSystemTotals: async (date: string) => {
    const response = await api.get<ApiResponse<any>>(`/settlements/calculate/${date}`)
    const data = response.data.data
    return {
      date: data.date,
      transactionCount: data.transaction_count,
      systemCash: data.system_cash,
      systemEdc: data.system_edc,
      systemTransfer: data.system_transfer,
      systemTotal: data.system_total,
    }
  },
  
  createSettlement: async (data: {
    date: string
    actualCash: number
    actualEdc: number
    actualTransfer: number
    varianceReason?: string
    notes?: string
  }) => {
    const response = await api.post<ApiResponse<any>>('/settlements', {
      date: data.date,
      actual_cash: data.actualCash,
      actual_edc: data.actualEdc,
      actual_transfer: data.actualTransfer,
      variance_reason: data.varianceReason,
      notes: data.notes,
    })
    return transformSettlement(response.data.data)
  },
  
  reviewSettlement: async (id: string, notes?: string) => {
    const response = await api.put<ApiResponse<any>>(`/settlements/${id}/review`, { notes })
    return transformSettlement(response.data.data)
  },
}
