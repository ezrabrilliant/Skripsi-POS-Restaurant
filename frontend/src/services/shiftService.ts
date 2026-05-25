// Service modul shifts. REV 2.2: schema baru wajib `type` (pagi|malam) saat open.
// Backend response shape: { success, data: { shift: ShiftView } } atau { shifts: [...] }.

import api from '@/lib/api'
import type { Shift, ShiftType, ApiResponse } from '@/types'

export interface OpenShiftPayload {
  type: ShiftType
  openingCash: number
}

export const shiftService = {
  /** Kasir buka kasir dengan modal awal + tipe shift (pagi|malam). */
  openShift: async (payload: OpenShiftPayload): Promise<Shift> => {
    const res = await api.post<ApiResponse<{ shift: Shift }>>('/shifts/open', payload)
    return res.data.data.shift
  },

  /** Shift aktif (closedAt=null) milik pegawai yang sedang login. Null kalau belum buka. */
  getActiveShift: async (): Promise<Shift | null> => {
    const res = await api.get<ApiResponse<{ shift: Shift | null }>>('/shifts/active')
    return res.data.data.shift
  },

  /** Tutup shift. Owner boleh tutup siapapun; kasir hanya bisa tutup shiftnya sendiri. */
  closeShift: async (shiftId: number): Promise<Shift> => {
    const res = await api.post<ApiResponse<{ shift: Shift }>>(`/shifts/${shiftId}/close`)
    return res.data.data.shift
  },

  listShifts: async (params?: {
    date?: string
    cashierId?: number
    status?: 'open' | 'closed'
  }): Promise<Shift[]> => {
    const res = await api.get<ApiResponse<{ shifts: Shift[] }>>('/shifts', { params })
    return res.data.data.shifts
  },
}
