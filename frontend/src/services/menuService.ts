import api from '@/lib/api'
import type { MenuWithStock, ApiResponse } from '@/types'

export const menuService = {
  getMenus: async (category?: string): Promise<MenuWithStock[]> => {
    const params = category ? { category } : {}
    const response = await api.get<ApiResponse<MenuWithStock[]>>('/menus', { params })
    return response.data.data
  },
  
  getAllMenu: async (): Promise<MenuWithStock[]> => {
    const response = await api.get<ApiResponse<MenuWithStock[]>>('/menus')
    return response.data.data
  },
  
  getCategories: async () => {
    const response = await api.get<ApiResponse<string[]>>('/menus/categories')
    return response.data.data
  },
  
  getMenu: async (id: string) => {
    const response = await api.get<ApiResponse<MenuWithStock>>(`/menus/${id}`)
    return response.data.data
  },
  
  createMenu: async (data: { name: string; price: number; category: string; description?: string }) => {
    const response = await api.post<ApiResponse<MenuWithStock>>('/menus', data)
    return response.data.data
  },
  
  updateMenu: async (id: string, data: Partial<{ name: string; price: number; category: string; description: string; isActive: boolean }>) => {
    const response = await api.put<ApiResponse<MenuWithStock>>(`/menus/${id}`, data)
    return response.data.data
  },
  
  deleteMenu: async (id: string) => {
    const response = await api.delete<ApiResponse<{ message: string }>>(`/menus/${id}`)
    return response.data
  },
}
