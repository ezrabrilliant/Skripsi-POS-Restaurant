// Service modul settings. REV 2.6: singleton AppSetting (PB1 toggle + rate).
//   - get: semua role authenticated (PaymentModal baca untuk tampil/sembunyi PB1).
//   - update: owner-only di backend (tab Pajak di halaman Pembayaran).

import api from '@/lib/api'
import type { ApiResponse } from '@/types'

export interface AppSettings {
  taxEnabled: boolean
  taxRate: number // persen
  // REV 2.12: PB1 2-sumbu + identitas resto + aturan operasional stok.
  taxChargedToCustomer: boolean
  restaurantName: string
  restaurantAddress: string | null
  openingHours: string | null
  restaurantPhone: string | null
  restaurantLogoUrl: string | null
  restockMultiple: number
  lowStockThreshold: number
  timezone: string
  shiftPagiStart: string
  shiftChangeover: string
  shiftMalamEnd: string
  updatedAt: string
  updatedById: number | null
}

export interface UpdateSettingsInput {
  taxEnabled?: boolean
  taxRate?: number
  taxChargedToCustomer?: boolean
  restaurantName?: string
  restaurantAddress?: string | null
  openingHours?: string | null
  restaurantPhone?: string | null
  restaurantLogoUrl?: string | null
  restockMultiple?: number
  lowStockThreshold?: number
  timezone?: string
  shiftPagiStart?: string
  shiftChangeover?: string
  shiftMalamEnd?: string
}

export const settingsService = {
  get: async (): Promise<AppSettings> => {
    const res = await api.get<ApiResponse<{ settings: AppSettings }>>('/settings')
    return res.data.data.settings
  },

  update: async (input: UpdateSettingsInput): Promise<AppSettings> => {
    const res = await api.patch<ApiResponse<{ settings: AppSettings }>>('/settings', input)
    return res.data.data.settings
  },
}
