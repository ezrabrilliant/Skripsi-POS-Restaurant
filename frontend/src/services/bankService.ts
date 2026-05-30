// Service modul banks. REV 2.6: owner-only CRUD master bank.
//   - list, byId, create, update - semua owner-only di backend.
//   - Soft delete via PATCH isActive=false (tidak ada DELETE hard-delete per
//     Decision #9 spec; bank yang sudah dipakai di payment_method assignment
//     atau historical transactions tetap accessible untuk audit).

import api from '@/lib/api'
import type { ApiResponse, BankView } from '@/types'

export interface CreateBankInput {
  name: string
}

export interface UpdateBankInput {
  name?: string
  isActive?: boolean
}

export const bankService = {
  list: async (includeInactive = false): Promise<BankView[]> => {
    const params = includeInactive ? { includeInactive: 'true' } : undefined
    const res = await api.get<ApiResponse<{ banks: BankView[] }>>('/banks', { params })
    return res.data.data.banks
  },

  byId: async (id: number): Promise<BankView> => {
    const res = await api.get<ApiResponse<{ bank: BankView }>>(`/banks/${id}`)
    return res.data.data.bank
  },

  create: async (input: CreateBankInput): Promise<BankView> => {
    const res = await api.post<ApiResponse<{ bank: BankView }>>('/banks', input)
    return res.data.data.bank
  },

  update: async (id: number, input: UpdateBankInput): Promise<BankView> => {
    const res = await api.patch<ApiResponse<{ bank: BankView }>>(`/banks/${id}`, input)
    return res.data.data.bank
  },

  /** REV 2.6: soft delete = PATCH isActive=false. Backend tidak punya DELETE
   * endpoint (per Decision #9). Convenience wrapper supaya UI yang invoke
   * "Hapus" tidak perlu construct payload manual. */
  deactivate: async (id: number): Promise<BankView> => {
    return bankService.update(id, { isActive: false })
  },

  /** REV 2.6: reactivate bank yang sebelumnya di-deactivate. */
  reactivate: async (id: number): Promise<BankView> => {
    return bankService.update(id, { isActive: true })
  },
}
