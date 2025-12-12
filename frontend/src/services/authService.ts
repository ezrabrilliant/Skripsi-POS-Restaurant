import api from '@/lib/api'
import type { User, ApiResponse } from '@/types'

export const authService = {
  login: async (pin: string) => {
    const response = await api.post<ApiResponse<{ user: User; token: string }>>('/auth/login', { pin_code: pin })
    return response.data.data
  },
  
  me: async () => {
    const response = await api.get<ApiResponse<User>>('/auth/me')
    return response.data.data
  },
  
  changePin: async (currentPin: string, newPin: string) => {
    const response = await api.post<ApiResponse<{ message: string }>>('/auth/change-pin', {
      currentPin,
      newPin,
    })
    return response.data
  },
}
