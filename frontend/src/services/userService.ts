import api from '@/lib/api'
import type { User, UserRole, ApiResponse } from '@/types'

export interface CreateUserData {
  name: string
  pin: string
  role: UserRole
  isActive?: boolean
}

export interface UpdateUserData {
  name?: string
  pin?: string
  role?: UserRole
  isActive?: boolean
}

// Backend mengembalikan User camelCase (tanpa PIN) - tidak perlu transform.

export const userService = {
  getAllUsers: async (): Promise<User[]> => {
    const res = await api.get<ApiResponse<User[]>>('/users')
    return res.data.data
  },

  getUserById: async (id: number): Promise<User> => {
    const res = await api.get<ApiResponse<User>>(`/users/${id}`)
    return res.data.data
  },

  createUser: async (data: CreateUserData): Promise<User> => {
    const res = await api.post<ApiResponse<User>>('/users', data)
    return res.data.data
  },

  updateUser: async (id: number, data: UpdateUserData): Promise<User> => {
    const res = await api.put<ApiResponse<User>>(`/users/${id}`, data)
    return res.data.data
  },

  deleteUser: async (id: number): Promise<void> => {
    await api.delete(`/users/${id}`)
  },
}
