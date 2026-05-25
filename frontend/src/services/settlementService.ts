// Service modul settlements. REV 2.2: 6 buckets.
//   - preview, create, list, detail = owner + kasir (kasir-malam-own enforce di server)
//   - review = owner only

import api from '@/lib/api'
import type {
  ApiResponse,
  Settlement,
  SettlementPreview,
  SettlementStatus,
} from '@/types'

export interface CreateSettlementPayload {
  shiftId: number
  actualCash: number
  actualEdc: number
  actualQris: number
  actualGojek: number
  actualGrab: number
  actualTransfer: number
}

export interface ListSettlementsQuery {
  date?: string
  month?: string
  cashierId?: number
  status?: SettlementStatus
}

export const settlementService = {
  preview: async (shiftId: number): Promise<SettlementPreview> => {
    const res = await api.get<ApiResponse<{ preview: SettlementPreview }>>(
      '/settlements/preview',
      { params: { shiftId } },
    )
    return res.data.data.preview
  },

  create: async (payload: CreateSettlementPayload): Promise<Settlement> => {
    const res = await api.post<ApiResponse<{ settlement: Settlement }>>('/settlements', payload)
    return res.data.data.settlement
  },

  list: async (query: ListSettlementsQuery = {}): Promise<Settlement[]> => {
    const res = await api.get<ApiResponse<{ settlements: Settlement[] }>>('/settlements', {
      params: query,
    })
    return res.data.data.settlements
  },

  byId: async (id: number): Promise<Settlement> => {
    const res = await api.get<ApiResponse<{ settlement: Settlement }>>(`/settlements/${id}`)
    return res.data.data.settlement
  },

  review: async (id: number): Promise<Settlement> => {
    const res = await api.put<ApiResponse<{ settlement: Settlement }>>(
      `/settlements/${id}/review`,
    )
    return res.data.data.settlement
  },
}
