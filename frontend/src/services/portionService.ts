// Service modul stocks/portion. REV 2.3:
//   - View + opname + mark-habis + restock + barang masuk SEMUA role.
//   - Mounted di /api/stocks/portion (sub-resource).

import api from '@/lib/api'
import type { ApiResponse, PortionStockView, PortionStockDetail } from '@/types'

export interface ListPortionQuery {
  category?: string
  lowStock?: boolean
}

export interface RestockMorningItem {
  menuId: number
  /** Qty WAJIB kelipatan 5 (validasi server). */
  qty: number
}

export interface RestockMorningPayload {
  items: RestockMorningItem[]
}

export interface EmergencyInPayload {
  menuId: number
  qty: number
  note?: string
}

export interface OpnameItem {
  menuId: number
  qtyFisik: number
}

export interface OpnamePayload {
  items: OpnameItem[]
  note?: string
}

export const portionService = {
  list: async (query: ListPortionQuery = {}): Promise<PortionStockView[]> => {
    const params: Record<string, string> = {}
    if (query.category) params.category = query.category
    if (query.lowStock) params.lowStock = 'true'
    const res = await api.get<ApiResponse<{ stocks: PortionStockView[] }>>(
      '/stocks/portion',
      { params },
    )
    return res.data.data.stocks
  },

  detail: async (menuId: number, limit = 20): Promise<PortionStockDetail> => {
    const res = await api.get<ApiResponse<{ stock: PortionStockDetail }>>(
      `/stocks/portion/${menuId}`,
      { params: { limit } },
    )
    return res.data.data.stock
  },

  restockMorning: async (payload: RestockMorningPayload): Promise<PortionStockView[]> => {
    const res = await api.post<ApiResponse<{ stocks: PortionStockView[] }>>(
      '/stocks/portion/restock-morning',
      payload,
    )
    return res.data.data.stocks
  },

  emergencyIn: async (payload: EmergencyInPayload): Promise<PortionStockView> => {
    const res = await api.post<ApiResponse<{ stock: PortionStockView }>>(
      '/stocks/portion/emergency-in',
      payload,
    )
    return res.data.data.stock
  },

  opname: async (payload: OpnamePayload): Promise<PortionStockView[]> => {
    const res = await api.post<ApiResponse<{ stocks: PortionStockView[] }>>(
      '/stocks/portion/opname',
      payload,
    )
    return res.data.data.stocks
  },

  markHabis: async (menuId: number, note?: string): Promise<PortionStockView> => {
    const res = await api.post<ApiResponse<{ stock: PortionStockView }>>(
      `/stocks/portion/${menuId}/mark-habis`,
      { note },
    )
    return res.data.data.stock
  },
}
