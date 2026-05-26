// Service modul transactions. REV 2.5:
//   - Drop split (split bill multi-party - schema partyId dihapus, lihat
//     docs/knowledge/SPLIT-MERGE-PATTERNS.md untuk justifikasi konteks Indo).
//   - Replace pay (single method) → addPayment + removePayment untuk support
//     Split Tender (1 Tx multi-method via TransactionPayment table).
//   - mergeBills tetap; di REV 2.5 juga dipakai untuk Combine Tables inter-table
//     (UI trigger baru di TablesPage + PaymentModal, logika backend identik).
//   - createTransaction tetap REV 2.3 auto-resolve shift dari single active shift
//     system-wide (frontend tidak kirim shiftId; backend 409 kalau 0 atau 2+ active).

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
  /** REV 2.4: catatan per item (komunikasi customer → dapur). */
  notes?: string
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

/** REV 2.5: payload untuk POST /:id/payments (1 slice).
 * - bank wajib untuk method=edc atau transfer (validasi Zod superRefine backend).
 * - discountAmount hanya valid kalau payments[] empty (first slice). Default 0. */
export interface AddPaymentPayload {
  method: PaymentMethod
  bank?: string
  amount: number
  discountAmount?: number
}

export interface ListTransactionsQuery {
  status?: TransactionStatus
  shiftId?: number
  orderType?: OrderType
  date?: string
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

  /** REV 2.4: fetch semua transaksi dineIn di meja tertentu (untuk POS view-mode
   * multi-Pesanan). Backend implicit filter: orderType=dineIn, mergedIntoId=null.
   * Result orderBy createdAt ASC (Pesanan #1 = paling lama). */
  listByTable: async (
    tableNumber: number,
    status?: TransactionStatus,
  ): Promise<Transaction[]> => {
    const params: Record<string, string> = {}
    if (status) params.status = status
    const res = await api.get<ApiResponse<{ transactions: Transaction[] }>>(
      `/transactions/table/${tableNumber}`,
      { params },
    )
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

  /** REV 2.4: hapus single item dari Tx open. Backend reverse stock + audit log + recompute subtotal. */
  deleteItem: async (transactionId: number, itemId: number): Promise<Transaction> => {
    const res = await api.delete<ApiResponse<{ transaction: Transaction }>>(
      `/transactions/${transactionId}/items/${itemId}`,
    )
    return res.data.data.transaction
  },

  /** REV 2.4: update item qty atau notes. Setidaknya salah satu field harus disertakan.
   * Backend adjust stock decrement secara delta saat qty berubah. */
  updateItem: async (
    transactionId: number,
    itemId: number,
    payload: { qty?: number; notes?: string | null },
  ): Promise<Transaction> => {
    const res = await api.patch<ApiResponse<{ transaction: Transaction }>>(
      `/transactions/${transactionId}/items/${itemId}`,
      payload,
    )
    return res.data.data.transaction
  },

  /** REV 2.5: POST /transactions/:id/payments — tambah 1 payment slice.
   * Single tender: 1x call dengan amount = total.
   * Split tender:  Nx call sampai sum payments >= total.
   * Backend auto-set status=paid + cascade ke mergedFrom saat sum payments >= total. */
  addPayment: async (id: number, payload: AddPaymentPayload): Promise<Transaction> => {
    const res = await api.post<ApiResponse<{ transaction: Transaction }>>(
      `/transactions/${id}/payments`,
      payload,
    )
    return res.data.data.transaction
  },

  /** REV 2.5: DELETE /transactions/:id/payments/:paymentId — hapus 1 slice.
   * Hanya valid kalau Tx masih open. */
  removePayment: async (id: number, paymentId: number): Promise<Transaction> => {
    const res = await api.delete<ApiResponse<{ transaction: Transaction }>>(
      `/transactions/${id}/payments/${paymentId}`,
    )
    return res.data.data.transaction
  },

  void: async (id: number): Promise<Transaction> => {
    const res = await api.post<ApiResponse<{ transaction: Transaction }>>(
      `/transactions/${id}/void`,
    )
    return res.data.data.transaction
  },

  /** REV 2.5: Combine Tables (inter-table) atau Add Round intra-table (REV 2.4).
   * Source Tx mendapat mergedIntoId=targetId. Validasi backend: same shift,
   * semua status=open, belum merged ke lain. */
  merge: async (payload: MergePayload): Promise<Transaction> => {
    const res = await api.post<ApiResponse<{ transaction: Transaction }>>(
      '/transactions/merge',
      payload,
    )
    return res.data.data.transaction
  },

  /** REV 2.5: Reverse merge - lepas source Tx kembali jadi standalone.
   * Validasi backend: source mergedIntoId !== null, source AND target status=open,
   * target.payments.length === 0 (belum ada slice; aggregate belum locked).
   * Return target Tx terbaru (subtotal aggregate sudah recompute kalau diquery ulang). */
  unmerge: async (sourceId: number): Promise<Transaction> => {
    const res = await api.post<ApiResponse<{ transaction: Transaction }>>(
      `/transactions/${sourceId}/unmerge`,
    )
    return res.data.data.transaction
  },
}
