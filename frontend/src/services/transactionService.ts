import api from '@/lib/api'
import type { Transaction, TableStatus, CartItem, PaymentMethod, ApiResponse } from '@/types'

export const transactionService = {
  getTransactions: async (params?: { status?: string; date?: string; startDate?: string; endDate?: string; limit?: number }): Promise<Transaction[]> => {
    const response = await api.get<ApiResponse<Transaction[]>>('/transactions', { params })
    return response.data.data
  },
  
  getTableStatuses: async () => {
    const response = await api.get<ApiResponse<TableStatus[]>>('/transactions/tables')
    return response.data.data
  },
  
  getTransaction: async (id: string) => {
    const response = await api.get<ApiResponse<Transaction>>(`/transactions/${id}`)
    return response.data.data
  },
  
  getTransactionByTable: async (tableNumber: string) => {
    const response = await api.get<ApiResponse<Transaction | null>>(`/transactions/table/${tableNumber}`)
    return response.data.data
  },
  
  createTransaction: async (data: {
    tableNumber: string
    items: CartItem[]
    notes?: string
    discountAmount?: number
  }) => {
    const response = await api.post<ApiResponse<Transaction>>('/transactions', data)
    return response.data.data
  },
  
  updateTransaction: async (id: string, data: {
    items: CartItem[]
    notes?: string
    discountAmount?: number
  }) => {
    const response = await api.put<ApiResponse<Transaction>>(`/transactions/${id}`, data)
    return response.data.data
  },
  
  processPayment: async (id: string, data: {
    paymentMethod: PaymentMethod
    amountPaid: number
  }) => {
    const response = await api.post<ApiResponse<Transaction>>(`/transactions/${id}/pay`, data)
    return response.data.data
  },
  
  voidTransaction: async (id: string) => {
    const response = await api.post<ApiResponse<{ message: string }>>(`/transactions/${id}/void`)
    return response.data
  },
  
  splitBill: async (data: {
    sourceTransactionId: string
    itemIds: string[]
    newTableNumber: string
  }) => {
    const response = await api.post<ApiResponse<{ newTransactionId: string }>>('/transactions/split', data)
    return response.data.data
  },
  
  mergeBills: async (data: {
    sourceTransactionId: string
    targetTransactionId: string
  }) => {
    const response = await api.post<ApiResponse<{ message: string }>>('/transactions/merge', data)
    return response.data
  },
  
  getTodaySummary: async () => {
    const response = await api.get<ApiResponse<{
      totalTransactions: number
      cashTotal: number
      edcTotal: number
      transferTotal: number
      grandTotal: number
    }>>('/transactions/summary/today')
    return response.data.data
  },
}
