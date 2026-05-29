// Service modul shifts. REV 2.3 shift-decoupling: active shift = konsep system-wide.
// Backend response /shifts/active sekarang { shifts: Shift[] } (bukan { shift }).
// Frontend yang filter `myActiveShift` vs `otherActiveShifts` untuk presentasi per-role.

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

  /** REV 2.3 shift-decoupling: SEMUA shift aktif (closedAt=null) di sistem.
   * - length 0: belum ada kasir buka shift
   * - length 1: happy path
   * - length 2+: pergantian overlap, perlu tutup salah satu */
  getActiveShifts: async (): Promise<Shift[]> => {
    const res = await api.get<ApiResponse<{ shifts: Shift[] }>>('/shifts/active')
    return res.data.data.shifts
  },

  /** Tutup shift. Owner boleh tutup siapapun; kasir hanya bisa tutup shiftnya sendiri.
   * mode='final' (default): tutup penuh, blok 409 kalau masih ada open order.
   * mode='handover': pergantian shift, tidak memicu blok open order. */
  closeShift: async (shiftId: number, mode: 'final' | 'handover' = 'final'): Promise<Shift> => {
    const res = await api.post<ApiResponse<{ shift: Shift }>>(`/shifts/${shiftId}/close`, { mode })
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
