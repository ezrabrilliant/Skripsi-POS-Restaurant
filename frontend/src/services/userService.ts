import api from '@/lib/api'
import { User, UserRole } from '@/types'

export interface CreateUserData {
  name: string
  pin: string
  role: UserRole
}

export interface UpdateUserData {
  name?: string
  pin?: string
  role?: UserRole
}

export const userService = {
  getAllUsers: async (): Promise<User[]> => {
    const response = await api.get('/users')
    return response.data.data
  },
  
  getUserById: async (id: string): Promise<User> => {
    const response = await api.get(`/users/${id}`)
    return response.data.data
  },
  
  createUser: async (data: CreateUserData): Promise<User> => {
    const response = await api.post('/users', data)
    return response.data.data
  },
  
  updateUser: async (id: string, data: UpdateUserData): Promise<User> => {
    const response = await api.put(`/users/${id}`, data)
    return response.data.data
  },
  
  deleteUser: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`)
  },
}
