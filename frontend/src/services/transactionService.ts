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
  /** LEGACY (pre-REV 2.10): paket berbasis NAMA. Dipertahankan optional untuk
   * backward-compat sampai POS di-refactor ke variantId/paketChoices. */
  subOptionsSelected?: Record<string, string>
  /** REV 2.4: catatan per item (komunikasi customer → dapur). */
  notes?: string
  /** REV 2.10: varian terpilih (menu kind=variant). null/undefined untuk
   * simple + paket. Stok di-decrement ke variant.stockTargetMenuId. */
  variantId?: number | null
  /** REV 2.10: pilihan per slot paket kind=choice. Key = slot label
   * (PaketComponent.label). targetMenuId = menu yang dipilih untuk slot;
   * variantId = varian-nya kalau target adalah menu varian; chosenLabel =
   * label opsi yang dipilih (audit display). Mirror orderItemSchema.paketChoices. */
  paketChoices?: Record<
    string,
    { targetMenuId: number; variantId?: number | null; chosenLabel: string }
  >
  /** REV 2.10: free-preference (grup affectsVariant=false, mis. Suhu dingin/panas).
   * Dicatat sebagai TransactionItemSelection isPreference=true - tidak pengaruh
   * stok/harga. Mirror orderItemSchema.preferences. */
  preferences?: { groupLabel: string; chosenLabel: string }[]
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
  /** REV 2.12: id pesanan intra-meja yang digabung saat bayar (atomik di backend). */
  mergeSourceIds?: number[]
}

export interface ListTransactionsQuery {
  status?: TransactionStatus
  shiftId?: number
  orderType?: OrderType
  date?: string
  /** REV 2.x: date-range Riwayat. Kalau diisi, diprioritaskan di atas `date`. */
  fromDate?: string
  toDate?: string
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
    if (query.fromDate) params.fromDate = query.fromDate
    if (query.toDate) params.toDate = query.toDate
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

  /** REV 2.14: ubah varian / pilihan paket item yang sudah ada (in-place).
   * Backend reverse stok lama → re-resolve pilihan baru → apply stok baru +
   * update harga/cost/subtotal + ganti selections. Open Tx only. */
  changeItemVariant: async (
    transactionId: number,
    itemId: number,
    payload: {
      variantId?: number | null
      paketChoices?: Record<
        string,
        { targetMenuId: number; variantId?: number | null; chosenLabel: string }
      >
      preferences?: { groupLabel: string; chosenLabel: string }[]
    },
  ): Promise<Transaction> => {
    const res = await api.patch<ApiResponse<{ transaction: Transaction }>>(
      `/transactions/${transactionId}/items/${itemId}/variant`,
      payload,
    )
    return res.data.data.transaction
  },

  /** REV 2.5: POST /transactions/:id/payments - tambah 1 payment slice.
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

  /** REV 2.5: DELETE /transactions/:id/payments/:paymentId - hapus 1 slice.
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
