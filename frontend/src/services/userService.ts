// Service modul users. Backend pakai pattern envelope { users: [...] } atau
// { user: {...} } via sendSuccess(res, { users/user }, ...) — sama dengan
// service lain (shifts, transactions, vendors, bills, dll). Extract field-nya
// di sini supaya consumer dapat shape yang sesuai.

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
    const res = await api.get<ApiResponse<{ users: User[] }>>('/users')
    return res.data.data.users
  },

  getUserById: async (id: number): Promise<User> => {
    const res = await api.get<ApiResponse<{ user: User }>>(`/users/${id}`)
    return res.data.data.user
  },

  createUser: async (data: CreateUserData): Promise<User> => {
    const res = await api.post<ApiResponse<{ user: User }>>('/users', data)
    return res.data.data.user
  },

  updateUser: async (id: number, data: UpdateUserData): Promise<User> => {
    const res = await api.put<ApiResponse<{ user: User }>>(`/users/${id}`, data)
    return res.data.data.user
  },

  deleteUser: async (id: number): Promise<void> => {
    await api.delete(`/users/${id}`)
  },
}
