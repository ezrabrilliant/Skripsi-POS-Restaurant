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
  isActive?: boolean
}

// Transform snake_case to camelCase
const transformUser = (user: any): User => ({
  id: user.id,
  name: user.name,
  role: user.role,
  isActive: user.is_active,
  createdAt: user.created_at,
  updatedAt: user.updated_at,
})

export const userService = {
  getAllUsers: async (): Promise<User[]> => {
    const response = await api.get('/users')
    return response.data.data.map(transformUser)
  },
  
  getUserById: async (id: string): Promise<User> => {
    const response = await api.get(`/users/${id}`)
    return transformUser(response.data.data)
  },
  
  createUser: async (data: CreateUserData): Promise<User> => {
    // Transform to snake_case for API
    const response = await api.post('/users', {
      name: data.name,
      pin_code: data.pin,
      role: data.role,
    })
    return transformUser(response.data.data)
  },
  
  updateUser: async (id: string, data: UpdateUserData): Promise<User> => {
    // Transform to snake_case for API
    const apiData: any = {}
    if (data.name) apiData.name = data.name
    if (data.pin) apiData.pin_code = data.pin
    if (data.role) apiData.role = data.role
    if (data.isActive !== undefined) apiData.is_active = data.isActive
    
    const response = await api.put(`/users/${id}`, apiData)
    return transformUser(response.data.data)
  },
  
  deleteUser: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`)
  },
}
