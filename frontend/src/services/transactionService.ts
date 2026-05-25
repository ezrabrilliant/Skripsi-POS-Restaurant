// Service modul transactions. REV 2.2/2.3:
//   - POST / create dengan auto-decrement PortionStock + resolusi subOptions
//     REV 2.3 shift-decoupling: payload TIDAK kirim shiftId, backend auto-resolve
//     dari single active shift (0 atau 2+ active -> 409).
//   - POST /:id/items add multi-round
//   - POST /:id/payment dengan PB1 10% + paymentBank wajib EDC/transfer
//   - POST /:id/void reverse decrement
//   - Permission: POST semua role (waiter fallback), payment/void owner+kasir
//   - Response shape: TransactionView punya createdById/createdByName +
//     shiftCashierName (replace cashierId/cashierName REV 2.2).

import api from '@/lib/api'
import type {
  ApiResponse,
  OrderType,
  PaymentMethod,
  Transaction,
  TransactionStatus,
} from '@/types'

export interface OrderItemInput {
  menuId: number
  qty: number
  subOptionsSelected?: Record<string, string>
}

/** REV 2.3 shift-decoupling: shiftId TIDAK dikirim. Backend auto-resolve dari single
 * active shift system-wide. Backend throw 409 kalau 0 atau 2+ active shift. */
export interface CreateTransactionPayload {
  orderType: OrderType
  tableNumber?: number
  items: OrderItemInput[]
}

export interface AddItemsPayload {
  items: OrderItemInput[]
}

export interface PaymentPayload {
  paymentMethod: PaymentMethod
  paymentBank?: string
  discountAmount?: number
}

export interface ListTransactionsQuery {
  status?: TransactionStatus
  shiftId?: number
  orderType?: OrderType
  date?: string
}

// REV 2.3 Phase 4b — Split + Merge
export interface SplitAssignment {
  itemId: number
  partyId: number | null
}

export interface SplitPayload {
  assignments: SplitAssignment[]
}

export interface MergePayload {
  sourceIds: number[]
  targetId: number
}

export const transactionService = {
  list: async (query: ListTransactionsQuery = {}): Promise<Transaction[]> => {
    const params: Record<string, string | number> = {}
    if (query.status) params.status = query.status
    if (query.shiftId) params.shiftId = query.shiftId
    if (query.orderType) params.orderType = query.orderType
    if (query.date) params.date = query.date
    const res = await api.get<ApiResponse<{ transactions: Transaction[] }>>('/transactions', {
      params,
    })
    return res.data.data.transactions
  },

  byId: async (id: number): Promise<Transaction> => {
    const res = await api.get<ApiResponse<{ transaction: Transaction }>>(`/transactions/${id}`)
    return res.data.data.transaction
  },

  create: async (payload: CreateTransactionPayload): Promise<Transaction> => {
    const res = await api.post<ApiResponse<{ transaction: Transaction }>>(
      '/transactions',
      payload,
    )
    return res.data.data.transaction
  },

  addItems: async (id: number, payload: AddItemsPayload): Promise<Transaction> => {
    const res = await api.post<ApiResponse<{ transaction: Transaction }>>(
      `/transactions/${id}/items`,
      payload,
    )
    return res.data.data.transaction
  },

  pay: async (id: number, payload: PaymentPayload): Promise<Transaction> => {
    const res = await api.post<ApiResponse<{ transaction: Transaction }>>(
      `/transactions/${id}/payment`,
      payload,
    )
    return res.data.data.transaction
  },

  void: async (id: number): Promise<Transaction> => {
    const res = await api.post<ApiResponse<{ transaction: Transaction }>>(
      `/transactions/${id}/void`,
    )
    return res.data.data.transaction
  },

  // REV 2.3 Phase 4b — Split + Merge
  split: async (id: number, payload: SplitPayload): Promise<Transaction> => {
    const res = await api.put<ApiResponse<{ transaction: Transaction }>>(
      `/transactions/${id}/split`,
      payload,
    )
    return res.data.data.transaction
  },

  merge: async (payload: MergePayload): Promise<Transaction> => {
    const res = await api.post<ApiResponse<{ transaction: Transaction }>>(
      '/transactions/merge',
      payload,
    )
    return res.data.data.transaction
  },
}
