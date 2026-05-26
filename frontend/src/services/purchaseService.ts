// Service modul purchases. REV 2.5.1: 3-kind line item:
//   A. Free-form (rawMaterialId null, label set, subtotal wajib) — bumbu dasar,
//      ayam mentah, item tanpa master.
//   B. Typed-scale (rawMaterialId set, unit.opnameMode=scale_0_5, subtotal wajib)
//   C. Typed-exact (rawMaterialId set, unit.opnameMode=exact, qty + unitPrice wajib)
// Server validate via superRefine: exactly one of {rawMaterialId, label} + per-kind
// payload requirements.

import api from '@/lib/api'
import type { ApiResponse, Purchase } from '@/types'

/** REV 2.5.1: 3-kind line item. Server bifurcate via {rawMaterialId, label}. */
export interface CreatePurchaseItem {
  /** Typed item: set rawMaterialId (label null). Free-form: null + isi label. */
  rawMaterialId?: number | null
  /** Free-form label (mis. "Bumbu dasar pasar"). Mutex dengan rawMaterialId. */
  label?: string | null
  qty?: number | null
  unitPrice?: number | null
  subtotal?: number | null
  note?: string | null
  expiredDate?: string | null
}

export interface CreatePurchasePayload {
  date: string
  vendorId?: number | null
  note?: string | null
  items: CreatePurchaseItem[]
}

export interface ListPurchasesQuery {
  date?: string
  vendorId?: number
  month?: string
}

export const purchaseService = {
  list: async (query: ListPurchasesQuery = {}): Promise<Purchase[]> => {
    const params: Record<string, string | number> = {}
    if (query.date) params.date = query.date
    if (query.vendorId) params.vendorId = query.vendorId
    if (query.month) params.month = query.month
    const res = await api.get<ApiResponse<{ purchases: Purchase[] }>>('/purchases', { params })
    return res.data.data.purchases
  },

  byId: async (id: number): Promise<Purchase> => {
    const res = await api.get<ApiResponse<{ purchase: Purchase }>>(`/purchases/${id}`)
    return res.data.data.purchase
  },

  create: async (payload: CreatePurchasePayload): Promise<Purchase> => {
    const res = await api.post<ApiResponse<{ purchase: Purchase }>>('/purchases', payload)
    return res.data.data.purchase
  },
}
