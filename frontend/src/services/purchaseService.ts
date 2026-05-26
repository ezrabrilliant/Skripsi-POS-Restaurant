// Service modul purchases. REV 2.1/2.2: owner + kasir. Normalized header + items.
// No update/delete - kalau salah, catat purchase baru sebagai koreksi.

import api from '@/lib/api'
import type { ApiResponse, Purchase } from '@/types'

export interface CreatePurchaseItem {
  rawMaterialId: number
  qty: number
  unitPrice: number
  expiredDate?: string | null
}

export interface CreatePurchasePayload {
  date: string
  vendorId?: number | null
  note?: string | null
  items: CreatePurchaseItem[]
}

export interface ListPurchasesQuery {
  date?: string
  vendorId?: number
  month?: string
}

export const purchaseService = {
  list: async (query: ListPurchasesQuery = {}): Promise<Purchase[]> => {
    const params: Record<string, string | number> = {}
    if (query.date) params.date = query.date
    if (query.vendorId) params.vendorId = query.vendorId
    if (query.month) params.month = query.month
    const res = await api.get<ApiResponse<{ purchases: Purchase[] }>>('/purchases', { params })
    return res.data.data.purchases
  },

  byId: async (id: number): Promise<Purchase> => {
    const res = await api.get<ApiResponse<{ purchase: Purchase }>>(`/purchases/${id}`)
    return res.data.data.purchase
  },

  create: async (payload: CreatePurchasePayload): Promise<Purchase> => {
    const res = await api.post<ApiResponse<{ purchase: Purchase }>>('/purchases', payload)
    return res.data.data.purchase
  },
}
