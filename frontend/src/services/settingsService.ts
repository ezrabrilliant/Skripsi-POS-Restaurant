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

export interface PublicIdentity {
  restaurantName: string
  restaurantAddress: string | null
  openingHours: string | null
  restaurantPhone: string | null
  restaurantLogoUrl: string | null
}

export const settingsService = {
  get: async (): Promise<AppSettings> => {
    const res = await api.get<ApiResponse<{ settings: AppSettings }>>('/settings')
    return res.data.data.settings
  },

  // REV 2.12: identitas publik (LoginPage belum auth).
  getPublicIdentity: async (): Promise<PublicIdentity> => {
    const res = await api.get<ApiResponse<{ identity: PublicIdentity }>>('/settings/public')
    return res.data.data.identity
  },

  update: async (input: UpdateSettingsInput): Promise<AppSettings> => {
    const res = await api.patch<ApiResponse<{ settings: AppSettings }>>('/settings', input)
    return res.data.data.settings
  },

  // REV 2.12: upload logo resto (owner-only). Mengembalikan url untuk disimpan ke
  // restaurantLogoUrl via update().
  uploadLogo: async (file: File): Promise<{ imageUrl: string }> => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await api.post<ApiResponse<{ imageUrl: string }>>(
      '/settings/logo',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    return res.data.data
  },
}
