// REV 2.3: login = form 2 field input nama + PIN murni.
// Tidak ada lagi `verifyPin` (waiter fallback ditangani via UI saja, bukan elevasi PIN)
// dan tidak ada call `/auth/logout` (server stateless - token cukup dihapus di klien).

import api from '@/lib/api'
import type { User, ApiResponse } from '@/types'

export interface LoginPayload {
  name: string
  pin: string
}

export interface LoginResponse {
  user: User
  token: string
}

export const authService = {
  /** Login pegawai dengan nama + PIN 6 digit. Server cari user yang cocok dan terbitkan JWT. */
  login: async (payload: LoginPayload): Promise<LoginResponse> => {
    const res = await api.post<ApiResponse<LoginResponse>>('/auth/login', payload)
    return res.data.data
  },

  /** Profil pemilik token saat ini. Dipakai untuk verifikasi token sesi yang masih hidup. */
  me: async (): Promise<User> => {
    const res = await api.get<ApiResponse<{ user: User }>>('/auth/me')
    return res.data.data.user
  },
}
