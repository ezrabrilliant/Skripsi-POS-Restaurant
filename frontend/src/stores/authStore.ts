// REV 2.3.1: cached-name preference. `lastUserName` persist terpisah dari sesi
// auth aktif (token/user), sehingga setelah logout namanya tetap diingat untuk
// quick PIN-only login berikutnya. "Ganti Pengguna" di LoginPage clear field ini.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  /** Nama pegawai terakhir yang login di device ini. Dipersist supaya login
   * berikutnya cukup input PIN saja. Null setelah "Ganti Pengguna". */
  lastUserName: string | null

  login: (user: User, token: string) => void
  setUser: (user: User) => void
  logout: () => void
  /** Hapus cached name - dipanggil saat "Ganti Pengguna" di LoginPage. */
  clearLastUserName: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      lastUserName: null,

      login: (user: User, token: string) => {
        set({ user, token, isAuthenticated: true, lastUserName: user.name })
      },

      setUser: (user: User) => {
        set({ user })
      },

      logout: () => {
        // lastUserName SENGAJA dipertahankan: setelah logout user balik ke
        // LoginPage langsung cached PIN-only mode. Reset hanya lewat tombol
        // "Ganti Pengguna" → clearLastUserName().
        //
        // Zustand persist middleware auto-sync state ke localStorage di
        // setiap set() - tidak perlu manual clearStorage(). State baru
        // (user/token null + isAuthenticated false) sudah cukup mencegah
        // re-hydration sebagai authenticated.
        set({ user: null, token: null, isAuthenticated: false })
      },

      clearLastUserName: () => {
        set({ lastUserName: null })
      },
    }),
    {
      name: 'pos-auth',
    }
  )
)
