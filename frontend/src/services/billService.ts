// Service modul bills. REV 2.3: owner-only tagihan operasional bulanan.

import api from '@/lib/api'
import type { ApiResponse, Bill, BillCategory } from '@/types'

export interface CreateBillPayload {
  month: string
  category: BillCategory
  amount: number
  note?: string | null
}

export type UpdateBillPayload = Partial<CreateBillPayload>

export interface ListBillsQuery {
  month?: string
  year?: string
  category?: BillCategory
}

export const billService = {
  list: async (query: ListBillsQuery = {}): Promise<Bill[]> => {
    const res = await api.get<ApiResponse<{ bills: Bill[] }>>('/bills', { params: query })
    return res.data.data.bills
  },

  byId: async (id: number): Promise<Bill> => {
    const res = await api.get<ApiResponse<{ bill: Bill }>>(`/bills/${id}`)
    return res.data.data.bill
  },

  create: async (payload: CreateBillPayload): Promise<Bill> => {
    const res = await api.post<ApiResponse<{ bill: Bill }>>('/bills', payload)
    return res.data.data.bill
  },

  update: async (id: number, payload: UpdateBillPayload): Promise<Bill> => {
    const res = await api.put<ApiResponse<{ bill: Bill }>>(`/bills/${id}`, payload)
    return res.data.data.bill
  },

  delete: async (id: number): Promise<{ id: number; month: string; category: BillCategory }> => {
    const res = await api.delete<
      ApiResponse<{ deleted: { id: number; month: string; category: BillCategory } }>
    >(`/bills/${id}`)
    return res.data.data.deleted
  },
}
