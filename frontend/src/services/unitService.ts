// Service modul units (REV 2.5). Master satuan untuk raw materials.
// Permission per matrix REV 2.3:
//   - GET (list, byId): semua role authenticated (dropdown source)
//   - POST/PUT/DELETE: owner only

import api from '@/lib/api'
import type { ApiResponse, OpnameMode, Unit } from '@/types'

export interface CreateUnitPayload {
  label: string
  opnameMode: OpnameMode
}

export type UpdateUnitPayload = Partial<CreateUnitPayload>

export const unitService = {
  list: async (): Promise<Unit[]> => {
    const res = await api.get<ApiResponse<{ units: Unit[] }>>('/units')
    return res.data.data.units
  },

  byId: async (id: number): Promise<Unit> => {
    const res = await api.get<ApiResponse<{ unit: Unit }>>(`/units/${id}`)
    return res.data.data.unit
  },

  create: async (payload: CreateUnitPayload): Promise<Unit> => {
    const res = await api.post<ApiResponse<{ unit: Unit }>>('/units', payload)
    return res.data.data.unit
  },

  update: async (id: number, payload: UpdateUnitPayload): Promise<Unit> => {
    const res = await api.put<ApiResponse<{ unit: Unit }>>(`/units/${id}`, payload)
    return res.data.data.unit
  },

  delete: async (id: number): Promise<{ id: number; label: string }> => {
    const res = await api.delete<ApiResponse<{ deleted: { id: number; label: string } }>>(
      `/units/${id}`,
    )
    return res.data.data.deleted
  },
}
