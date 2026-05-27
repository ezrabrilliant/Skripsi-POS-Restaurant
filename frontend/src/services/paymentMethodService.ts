// Service modul payment-methods. REV 2.6:
//   - GET (list, byId): semua role authenticated (PaymentModal kasir konsumsi list).
//   - POST/PATCH/toggle/assign/unassign/reorder: owner-only (enforce backend layer).
// Soft delete only via toggle isActive — code immutable setelah create.

import api from '@/lib/api'
import type { ApiResponse, PaymentMethodView } from '@/types'

/** REV 2.6: 8 icon preset dari lucide-react di-whitelist backend.
 * Mirror backend `ALLOWED_ICONS` di payment-methods.schema.ts. */
export const ALLOWED_PAYMENT_ICONS = [
  'Banknote',
  'CreditCard',
  'QrCode',
  'Bike',
  'Truck',
  'ArrowLeftRight',
  'Wallet',
  'Smartphone',
] as const

export type PaymentIconName = (typeof ALLOWED_PAYMENT_ICONS)[number]

export interface CreatePaymentMethodInput {
  code: string
  label: string
  colorHex: string
  iconName: PaymentIconName
  requiresBank: boolean
  allowDineIn: boolean
  allowTakeaway: boolean
  displayOrder?: number
  bankIds: number[]
}

export interface UpdatePaymentMethodInput {
  label?: string
  colorHex?: string
  iconName?: PaymentIconName
  requiresBank?: boolean
  allowDineIn?: boolean
  allowTakeaway?: boolean
  displayOrder?: number
}

export interface ReorderPaymentMethodEntry {
  id: number
  displayOrder: number
}

export const paymentMethodService = {
  list: async (includeInactive = false): Promise<PaymentMethodView[]> => {
    const params = includeInactive ? { includeInactive: 'true' } : undefined
    const res = await api.get<ApiResponse<{ paymentMethods: PaymentMethodView[] }>>(
      '/payment-methods',
      { params },
    )
    return res.data.data.paymentMethods
  },

  byId: async (id: number): Promise<PaymentMethodView> => {
    const res = await api.get<ApiResponse<{ paymentMethod: PaymentMethodView }>>(
      `/payment-methods/${id}`,
    )
    return res.data.data.paymentMethod
  },

  create: async (input: CreatePaymentMethodInput): Promise<PaymentMethodView> => {
    const res = await api.post<ApiResponse<{ paymentMethod: PaymentMethodView }>>(
      '/payment-methods',
      input,
    )
    return res.data.data.paymentMethod
  },

  update: async (id: number, input: UpdatePaymentMethodInput): Promise<PaymentMethodView> => {
    const res = await api.patch<ApiResponse<{ paymentMethod: PaymentMethodView }>>(
      `/payment-methods/${id}`,
      input,
    )
    return res.data.data.paymentMethod
  },

  toggleActive: async (id: number, isActive: boolean): Promise<PaymentMethodView> => {
    const res = await api.patch<ApiResponse<{ paymentMethod: PaymentMethodView }>>(
      `/payment-methods/${id}/toggle-active`,
      { isActive },
    )
    return res.data.data.paymentMethod
  },

  assignBank: async (methodId: number, bankId: number): Promise<PaymentMethodView> => {
    const res = await api.post<ApiResponse<{ paymentMethod: PaymentMethodView }>>(
      `/payment-methods/${methodId}/banks/${bankId}`,
    )
    return res.data.data.paymentMethod
  },

  unassignBank: async (methodId: number, bankId: number): Promise<PaymentMethodView> => {
    const res = await api.delete<ApiResponse<{ paymentMethod: PaymentMethodView }>>(
      `/payment-methods/${methodId}/banks/${bankId}`,
    )
    return res.data.data.paymentMethod
  },

  reorder: async (ordered: ReorderPaymentMethodEntry[]): Promise<PaymentMethodView[]> => {
    const res = await api.post<ApiResponse<{ paymentMethods: PaymentMethodView[] }>>(
      '/payment-methods/reorder',
      { ordered },
    )
    return res.data.data.paymentMethods
  },
}
