// Service modul settlements. REV 2.6:
//   - preview, create, list, detail = owner + kasir (kasir-malam-own enforce di server).
//   - review = owner only.
//   - counts dinamis per payment_method.code (drop 6 actualXxx field hardcoded).
//   - System totals + bank breakdown computed dari TransactionPayment di backend;
//     FE konsumsi result via `methodCounts[]` + `bankBreakdown[]` di view shape.

import api from '@/lib/api'
import type {
  ApiResponse,
  Settlement,
  SettlementPreview,
  SettlementStatus,
} from '@/types'

/** REV 2.6: counts dinamis per method code. Backend validate keys harus
 * exist di master payment_methods (422 kalau ada code tak dikenal). Method
 * yang tidak disebut di counts otomatis di-treat sebagai counted=0 (tapi
 * row tetap muncul kalau punya system total > 0). */
export interface CreateSettlementPayload {
  /** Business date YYYY-MM-DD. Backend re-key settlement ke tanggal bisnis
   * (bukan shiftId) supaya aggregate seluruh shift di hari itu. */
  date: string
  counts: Record<string, number>
  /** Reserved untuk future migration; backend Phase 6 accept tapi discard
   * sampai kolom note ditambahkan ke tabel settlements. */
  note?: string | null
}

export interface ListSettlementsQuery {
  date?: string
  month?: string
  cashierId?: number
  status?: SettlementStatus
}

export const settlementService = {
  preview: async (date: string): Promise<SettlementPreview> => {
    const res = await api.get<ApiResponse<{ preview: SettlementPreview }>>(
      '/settlements/preview',
      { params: { date } },
    )
    return res.data.data.preview
  },

  create: async (payload: CreateSettlementPayload): Promise<Settlement> => {
    const res = await api.post<ApiResponse<{ settlement: Settlement }>>('/settlements', payload)
    return res.data.data.settlement
  },

  list: async (query: ListSettlementsQuery = {}): Promise<Settlement[]> => {
    const res = await api.get<ApiResponse<{ settlements: Settlement[] }>>('/settlements', {
      params: query,
    })
    return res.data.data.settlements
  },

  byId: async (id: number): Promise<Settlement> => {
    const res = await api.get<ApiResponse<{ settlement: Settlement }>>(`/settlements/${id}`)
    return res.data.data.settlement
  },

  review: async (id: number): Promise<Settlement> => {
    const res = await api.put<ApiResponse<{ settlement: Settlement }>>(
      `/settlements/${id}/review`,
    )
    return res.data.data.settlement
  },

  delete: async (id: number): Promise<{ id: number }> => {
    const res = await api.delete<ApiResponse<{ id: number }>>(`/settlements/${id}`)
    return res.data.data
  },
}
