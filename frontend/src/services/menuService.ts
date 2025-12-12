import api from '@/lib/api'
import type { MenuWithStock, ApiResponse } from '@/types'

// Transform snake_case to camelCase for frontend
const transformMenu = (menu: any): MenuWithStock => ({
  id: menu.id,
  name: menu.name,
  price: menu.price,
  category: menu.category,
  description: menu.description,
  defaultStock: menu.default_stock || 0,
  isActive: menu.is_active,
  stockStart: menu.stock_start,
  stockSold: menu.stock_sold,
  stockRemaining: menu.stock_remaining,
})

export const menuService = {
  getMenus: async (category?: string): Promise<MenuWithStock[]> => {
    const params = category ? { category } : {}
    const response = await api.get<ApiResponse<any[]>>('/menus', { params })
    return response.data.data.map(transformMenu)
  },
  
  getAllMenu: async (): Promise<MenuWithStock[]> => {
    const response = await api.get<ApiResponse<any[]>>('/menus')
    return response.data.data.map(transformMenu)
  },
  
  getCategories: async () => {
    const response = await api.get<ApiResponse<string[]>>('/menus/categories')
    return response.data.data
  },
  
  getMenu: async (id: string) => {
    const response = await api.get<ApiResponse<any>>(`/menus/${id}`)
    return transformMenu(response.data.data)
  },
  
  createMenu: async (data: { name: string; price: number; category: string; description?: string }) => {
    const response = await api.post<ApiResponse<any>>('/menus', data)
    return transformMenu(response.data.data)
  },
  
  updateMenu: async (id: string, data: Partial<{ name: string; price: number; category: string; description: string; isActive: boolean }>) => {
    // Transform camelCase to snake_case for API
    const apiData: any = { ...data }
    if ('isActive' in data) {
      apiData.is_active = data.isActive
      delete apiData.isActive
    }
    const response = await api.put<ApiResponse<any>>(`/menus/${id}`, apiData)
    return transformMenu(response.data.data)
  },
  
  deleteMenu: async (id: string) => {
    const response = await api.delete<ApiResponse<{ message: string }>>(`/menus/${id}`)
    return response.data
  },
}
