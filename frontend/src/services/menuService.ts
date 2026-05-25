// Service modul menus. REV 2.3:
//   - GET public (semua role bisa lihat menu untuk POS)
//   - POST/PUT/DELETE/reactivate owner-only

import api from '@/lib/api'
import type { ApiResponse, Menu, StockType, SubOptions } from '@/types'

export interface ListMenuQuery {
  activeOnly?: boolean
  category?: string
  includeStock?: boolean
}

export interface CreateMenuPayload {
  name: string
  category: string
  price: number
  stockType: StockType
  minStock?: number
  imageUrl?: string | null
  subOptions?: SubOptions
  isActive?: boolean
}

export type UpdateMenuPayload = Partial<CreateMenuPayload>

export const menuService = {
  list: async (query: ListMenuQuery = {}): Promise<Menu[]> => {
    const params: Record<string, string> = {}
    if (query.activeOnly !== undefined) params.activeOnly = String(query.activeOnly)
    if (query.category) params.category = query.category
    if (query.includeStock) params.includeStock = 'true'
    const res = await api.get<ApiResponse<{ menus: Menu[] }>>('/menus', { params })
    return res.data.data.menus
  },

  byId: async (id: number): Promise<Menu> => {
    const res = await api.get<ApiResponse<{ menu: Menu }>>(`/menus/${id}`)
    return res.data.data.menu
  },

  create: async (payload: CreateMenuPayload): Promise<Menu> => {
    const res = await api.post<ApiResponse<{ menu: Menu }>>('/menus', payload)
    return res.data.data.menu
  },

  update: async (id: number, payload: UpdateMenuPayload): Promise<Menu> => {
    const res = await api.put<ApiResponse<{ menu: Menu }>>(`/menus/${id}`, payload)
    return res.data.data.menu
  },

  deactivate: async (id: number): Promise<Menu> => {
    const res = await api.delete<ApiResponse<{ menu: Menu }>>(`/menus/${id}`)
    return res.data.data.menu
  },

  reactivate: async (id: number): Promise<Menu> => {
    const res = await api.post<ApiResponse<{ menu: Menu }>>(`/menus/${id}/reactivate`)
    return res.data.data.menu
  },
}
