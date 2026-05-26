// Service modul stocks/raw-materials. REV 2.5.1:
//   - View + opname + mark-habis SEMUA role
//   - CRUD master OWNER-only (edit master rename/unit/minStock)
//   - is_tracked DROPPED: master selalu tracked. Item ad-hoc (bumbu dasar, ayam
//     mentah) di-input sebagai free-form line item di purchase, bukan master.

import api from '@/lib/api'
import type {
  ApiResponse,
  RawMaterialView,
  RawMaterialDetail,
  RawMaterialCategory,
} from '@/types'

export interface ListRawMaterialsQuery {
  category?: RawMaterialCategory
  needsRestock?: boolean
}

export interface CreateRawMaterialPayload {
  name: string
  /** REV 2.5: unitId FK ke master `units` (sebelumnya `unit: string` bebas). */
  unitId: number
  category: RawMaterialCategory
  stockQty?: number
  minStock?: number | null
  unitPrice?: number | null
  freshnessDays?: number | null
}

export type UpdateRawMaterialPayload = Partial<Omit<CreateRawMaterialPayload, 'stockQty'>> & {
  /** REV 2.5: wajib dikirim bersama unitId saat ganti satuan dan stockQty > 0.
   * Pass number untuk konversi stok ke unit baru, atau null untuk reset ke 0.
   * Backend reject kalau dikirim tanpa unitId. */
  newStockQty?: number | null
}

export interface OpnameRawMaterialItem {
  rawMaterialId: number
  qtyFisik: number
}

export interface OpnameRawMaterialPayload {
  items: OpnameRawMaterialItem[]
  note?: string
}

export const rawMaterialsService = {
  list: async (query: ListRawMaterialsQuery = {}): Promise<RawMaterialView[]> => {
    const params: Record<string, string> = {}
    if (query.category) params.category = query.category
    if (query.needsRestock) params.needsRestock = 'true'
    const res = await api.get<ApiResponse<{ rawMaterials: RawMaterialView[] }>>(
      '/stocks/raw-materials',
      { params },
    )
    return res.data.data.rawMaterials
  },

  detail: async (id: number, limit = 20): Promise<RawMaterialDetail> => {
    const res = await api.get<ApiResponse<{ rawMaterial: RawMaterialDetail }>>(
      `/stocks/raw-materials/${id}`,
      { params: { limit } },
    )
    return res.data.data.rawMaterial
  },

  create: async (payload: CreateRawMaterialPayload): Promise<RawMaterialView> => {
    const res = await api.post<ApiResponse<{ rawMaterial: RawMaterialView }>>(
      '/stocks/raw-materials',
      payload,
    )
    return res.data.data.rawMaterial
  },

  update: async (id: number, payload: UpdateRawMaterialPayload): Promise<RawMaterialView> => {
    const res = await api.put<ApiResponse<{ rawMaterial: RawMaterialView }>>(
      `/stocks/raw-materials/${id}`,
      payload,
    )
    return res.data.data.rawMaterial
  },

  delete: async (id: number): Promise<{ id: number; name: string }> => {
    const res = await api.delete<ApiResponse<{ deleted: { id: number; name: string } }>>(
      `/stocks/raw-materials/${id}`,
    )
    return res.data.data.deleted
  },

  opname: async (payload: OpnameRawMaterialPayload): Promise<RawMaterialView[]> => {
    const res = await api.post<ApiResponse<{ rawMaterials: RawMaterialView[] }>>(
      '/stocks/raw-materials/opname',
      payload,
    )
    return res.data.data.rawMaterials
  },

  markHabis: async (id: number, note?: string): Promise<RawMaterialView> => {
    const res = await api.post<ApiResponse<{ rawMaterial: RawMaterialView }>>(
      `/stocks/raw-materials/${id}/mark-habis`,
      { note },
    )
    return res.data.data.rawMaterial
  },
}
