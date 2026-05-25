// Service modul stocks/raw-materials. REV 2.2:
//   - View + opname + mark-habis SEMUA role
//   - CRUD master OWNER-only (edit master rename/unit/isTracked/minStock)

import api from '@/lib/api'
import type {
  ApiResponse,
  RawMaterialView,
  RawMaterialDetail,
  RawMaterialCategory,
} from '@/types'

export interface ListRawMaterialsQuery {
  category?: RawMaterialCategory
  isTracked?: boolean
  needsRestock?: boolean
}

export interface CreateRawMaterialPayload {
  name: string
  unit: string
  category: RawMaterialCategory
  isTracked: boolean
  stockQty?: number
  minStock?: number | null
  unitPrice?: number | null
  freshnessDays?: number | null
}

export type UpdateRawMaterialPayload = Partial<Omit<CreateRawMaterialPayload, 'stockQty'>>

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
    if (query.isTracked !== undefined) params.isTracked = String(query.isTracked)
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
