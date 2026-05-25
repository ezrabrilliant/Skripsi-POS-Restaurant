// Service modul dashboard. REV 2.3: 3 endpoint per role.
//
// - getOwnerReport(query): owner-only, full financial report dengan period filter.
// - getCashierDashboard(): owner + kasir, ringkasan today + active shift.
// - getWaiterDashboard(): semua role, portion + raw materials reminder + active shifts today.

import api from '@/lib/api'
import type { ApiResponse, ShiftType } from '@/types'

// ============================================================
// Common types
// ============================================================

export interface MethodTotals {
  cash: number
  edc: number
  qris: number
  gojek: number
  grab: number
  transfer: number
}

export interface BankBreakdownEntry {
  method: 'edc' | 'transfer'
  bank: string
  total: number
}

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
    byMethod: MethodTotals
    bankBreakdown: BankBreakdownEntry[]
  }
  expense: {
    purchaseTotal: number
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
    byMethod: MethodTotals
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
