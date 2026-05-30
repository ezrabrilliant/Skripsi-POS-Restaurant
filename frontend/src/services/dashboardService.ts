// Service modul dashboard. REV 2.6: 3 endpoint per role + shape dinamis.
//
// - getOwnerReport(query): owner-only, full financial report dengan period filter.
//   revenue.byMethod jadi MethodTotalEntry[] (sebelumnya MethodTotals fixed 6 key).
// - getCashierDashboard(): owner + kasir, ringkasan today + active shift.
//   today.byMethod jadi MethodTotalEntry[].
// - getWaiterDashboard(): semua role, portion + raw materials reminder + active shifts today.
//
// BankBreakdownEntry.method generic string supaya support method requiresBank
// custom (mis. shopeepay) — bukan hanya 'edc' | 'transfer' hardcoded.

import api from '@/lib/api'
import type {
  ApiResponse,
  BankBreakdownEntry,
  MethodTotalEntry,
  ShiftType,
} from '@/types'

// ============================================================
// Common types
// ============================================================

export interface ReminderCounts {
  portionLowCount: number
  rawMaterialLowCount: number
  rawMaterialNearExpiryCount: number
}

// ============================================================
// Owner
// ============================================================

export type DashboardPeriodType = 'today' | 'month' | 'year' | 'custom'

export interface OwnerReport {
  period: {
    type: DashboardPeriodType
    label: string
    fromDate: string
    toDate: string
  }
  revenue: {
    total: number
    transactionCount: number
    /** REV 2.6: dinamis per payment method code (sorted descending by total). */
    byMethod: MethodTotalEntry[]
    /** REV 2.6: method generic string — semua payment_method.code yang
     * `requiresBank=true` dan punya transaksi di periode. */
    bankBreakdown: BankBreakdownEntry[]
  }
  expense: {
    cogsTotal: number
    billTotal: number
    total: number
  }
  profit: number
  reminders: ReminderCounts
}

export interface OwnerReportQuery {
  period?: DashboardPeriodType
  date?: string
  month?: string
  year?: string
  fromDate?: string
  toDate?: string
}

// ============================================================
// Cashier
// ============================================================

export interface CashierDashboard {
  activeShift: {
    id: number
    type: ShiftType
    openingCash: number
    createdAt: string
  } | null
  today: {
    revenue: number
    transactionCount: number
    /** REV 2.6: dinamis per payment method code. */
    byMethod: MethodTotalEntry[]
    openTransactionCount: number
  }
  reminders: ReminderCounts
}

// ============================================================
// Waiter
// ============================================================

export interface WaiterDashboardPortionSample {
  menuId: number
  menuName: string
  currentQty: number
  minStock: number
  suggestedRestock: number
}

export interface WaiterDashboardRawMaterialSample {
  id: number
  name: string
  stockQty: number
  minStock: number | null
  unit: string
}

export interface WaiterDashboard {
  portionStocks: {
    totalCount: number
    lowCount: number
    lowSamples: WaiterDashboardPortionSample[]
  }
  rawMaterials: {
    lowCount: number
    nearExpiryCount: number
    lowSamples: WaiterDashboardRawMaterialSample[]
  }
  activeShiftsToday: Array<{
    id: number
    type: ShiftType
    cashierId: number
    cashierName: string
  }>
}

// ============================================================
// Service
// ============================================================

export const dashboardService = {
  getOwnerReport: async (query: OwnerReportQuery = {}): Promise<OwnerReport> => {
    const res = await api.get<ApiResponse<{ report: OwnerReport }>>('/dashboard/owner', {
      params: query,
    })
    return res.data.data.report
  },

  getCashierDashboard: async (): Promise<CashierDashboard> => {
    const res = await api.get<ApiResponse<{ dashboard: CashierDashboard }>>('/dashboard/cashier')
    return res.data.data.dashboard
  },

  getWaiterDashboard: async (): Promise<WaiterDashboard> => {
    const res = await api.get<ApiResponse<{ dashboard: WaiterDashboard }>>('/dashboard/waiter')
    return res.data.data.dashboard
  },
}
