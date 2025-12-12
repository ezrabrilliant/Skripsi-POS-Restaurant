import api from '@/lib/api'
import type { Transaction, TableStatus, PaymentMethod, ApiResponse } from '@/types'

// Transform snake_case to camelCase for TransactionItem
const transformItem = (item: any) => ({
  id: item.id,
  menuId: item.menu_id,
  menuName: item.menu_name,
  price: item.price,
  priceAtTime: item.price,
  quantity: item.quantity,
  subtotal: item.subtotal,
  notes: item.notes,
  isForceOrder: item.is_force_order,
})

// Transform snake_case to camelCase for Transaction
const transformTransaction = (t: any): Transaction => ({
  id: t.id,
  tableNumber: t.table_number,
  status: t.status,
  subtotal: t.subtotal || 0,
  discountAmount: t.discount_amount || 0,
  totalAmount: t.total_amount || 0,
  paymentMethod: t.payment_method,
  amountPaid: t.amount_paid || 0,
  changeAmount: t.change_amount || 0,
  cashierId: t.cashier_id,
  cashierName: t.cashier?.name,
  notes: t.notes,
  paidAt: t.paid_at,
  createdAt: t.created_at,
  updatedAt: t.updated_at,
  items: t.items?.map(transformItem) || [],
})

export const transactionService = {
  // Get all transactions with optional filters
  getTransactions: async (params?: { 
    status?: string
    date?: string
    startDate?: string
    endDate?: string
    limit?: number
    today?: boolean
  }): Promise<Transaction[]> => {
    const apiParams: any = {}
    if (params?.status) apiParams.status = params.status
    if (params?.startDate) apiParams.start_date = params.startDate
    if (params?.endDate) apiParams.end_date = params.endDate
    if (params?.date) apiParams.date = params.date
    if (params?.limit) apiParams.per_page = params.limit
    if (params?.today) apiParams.today = true
    
    const response = await api.get<ApiResponse<any[]>>('/transactions', { params: apiParams })
    return response.data.data.map(transformTransaction)
  },

  // Get transaction history (paid/void)
  getHistory: async (params?: { startDate?: string; endDate?: string }): Promise<Transaction[]> => {
    const apiParams: any = {}
    if (params?.startDate) apiParams.start_date = params.startDate
    if (params?.endDate) apiParams.end_date = params.endDate
    
    const response = await api.get<ApiResponse<any[]>>('/transactions/history', { params: apiParams })
    return response.data.data.map(transformTransaction)
  },
  
  // Get table statuses
  getTableStatuses: async (): Promise<TableStatus[]> => {
    const response = await api.get<ApiResponse<any[]>>('/tables')
    return response.data.data.map((t: any) => ({
      tableNumber: t.table_number,
      status: t.status,
      transactionId: t.transaction_id,
      totalAmount: t.total_amount || 0,
    }))
  },
  
  // Get single transaction by ID
  getTransaction: async (id: string): Promise<Transaction> => {
    const response = await api.get<ApiResponse<any>>(`/transactions/${id}`)
    return transformTransaction(response.data.data)
  },
  
  // Get open transaction for a table
  getTransactionByTable: async (tableNumber: string): Promise<Transaction | null> => {
    try {
      const response = await api.get<ApiResponse<any>>(`/tables/${tableNumber}/transaction`)
      return response.data.data ? transformTransaction(response.data.data) : null
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null
      }
      throw error
    }
  },
  
  // Create new transaction (open bill)
  createTransaction: async (data: { tableNumber: string; notes?: string }): Promise<Transaction> => {
    const response = await api.post<ApiResponse<any>>('/transactions', {
      table_number: data.tableNumber,
      notes: data.notes,
    })
    return transformTransaction(response.data.data)
  },
  
  // Add item to transaction
  addItem: async (transactionId: string, data: {
    menuId: string
    quantity: number
    notes?: string
    forceOrder?: boolean
  }): Promise<Transaction> => {
    const response = await api.post<ApiResponse<any>>(`/transactions/${transactionId}/items`, {
      menu_id: data.menuId,
      quantity: data.quantity,
      notes: data.notes,
      force_order: data.forceOrder,
    })
    return transformTransaction(response.data.data)
  },
  
  // Update item quantity
  updateItem: async (transactionId: string, itemId: string, data: {
    quantity?: number
    notes?: string
  }): Promise<Transaction> => {
    const response = await api.put<ApiResponse<any>>(`/transactions/${transactionId}/items/${itemId}`, data)
    return transformTransaction(response.data.data)
  },
  
  // Remove item from transaction
  removeItem: async (transactionId: string, itemId: string): Promise<Transaction> => {
    const response = await api.delete<ApiResponse<any>>(`/transactions/${transactionId}/items/${itemId}`)
    return transformTransaction(response.data.data)
  },
  
  // Sync all items at once (replaces all items in transaction)
  syncItems: async (transactionId: string, items: {
    menuId: string
    quantity: number
    notes?: string
    forceOrder?: boolean
  }[]): Promise<Transaction> => {
    const response = await api.put<ApiResponse<any>>(`/transactions/${transactionId}/items`, {
      items: items.map(item => ({
        menu_id: item.menuId,
        quantity: item.quantity,
        notes: item.notes,
        force_order: item.forceOrder,
      })),
    })
    return transformTransaction(response.data.data)
  },
  
  // Process payment
  processPayment: async (id: string, data: {
    paymentMethod: PaymentMethod
    amountPaid: number
  }): Promise<Transaction> => {
    const response = await api.post<ApiResponse<any>>(`/transactions/${id}/pay`, {
      payment_method: data.paymentMethod,
      amount_paid: data.amountPaid,
    })
    return transformTransaction(response.data.data)
  },
  
  // Void transaction
  voidTransaction: async (id: string): Promise<{ success: boolean; message?: string }> => {
    const response = await api.post<ApiResponse<{ message: string }>>(`/transactions/${id}/void`)
    return { success: response.data.success, message: response.data.message }
  },
  
  // Get daily summary
  getDailySummary: async (date?: string) => {
    const params = date ? { date } : {}
    const response = await api.get<ApiResponse<any>>('/transactions/daily-summary', { params })
    const data = response.data.data
    return {
      date: data.date,
      totalTransactions: data.total_transactions,
      cashTotal: data.cash_total,
      edcTotal: data.edc_total,
      transferTotal: data.transfer_total,
      grandTotal: data.grand_total,
    }
  },

  // Transfer table
  transferTable: async (fromTable: string, toTable: string): Promise<Transaction> => {
    const response = await api.post<ApiResponse<any>>(`/tables/${fromTable}/transfer`, {
      to_table: toTable,
    })
    return transformTransaction(response.data.data)
  },
}
