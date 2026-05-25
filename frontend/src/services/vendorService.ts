// Service modul vendors. REV 2.1: owner + kasir CRUD.

import api from '@/lib/api'
import type { ApiResponse, Vendor } from '@/types'

export interface CreateVendorPayload {
  name: string
  type: string
  phone?: string | null
  note?: string | null
}

export type UpdateVendorPayload = Partial<CreateVendorPayload>

export interface ListVendorsQuery {
  type?: string
  search?: string
}

export const vendorService = {
  list: async (query: ListVendorsQuery = {}): Promise<Vendor[]> => {
    const res = await api.get<ApiResponse<{ vendors: Vendor[] }>>('/vendors', { params: query })
    return res.data.data.vendors
  },

  byId: async (id: number): Promise<Vendor> => {
    const res = await api.get<ApiResponse<{ vendor: Vendor }>>(`/vendors/${id}`)
    return res.data.data.vendor
  },

  create: async (payload: CreateVendorPayload): Promise<Vendor> => {
    const res = await api.post<ApiResponse<{ vendor: Vendor }>>('/vendors', payload)
    return res.data.data.vendor
  },

  update: async (id: number, payload: UpdateVendorPayload): Promise<Vendor> => {
    const res = await api.put<ApiResponse<{ vendor: Vendor }>>(`/vendors/${id}`, payload)
    return res.data.data.vendor
  },

  delete: async (id: number): Promise<{ id: number; name: string }> => {
    const res = await api.delete<ApiResponse<{ deleted: { id: number; name: string } }>>(
      `/vendors/${id}`,
    )
    return res.data.data.deleted
  },
}
