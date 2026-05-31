// Service modul dashboard. REV 2.6: 3 endpoint per role + shape dinamis.
//
// - getOwnerReport(query): owner-only, full financial report dengan period filter.
//   revenue.byMethod jadi MethodTotalEntry[] (sebelumnya MethodTotals fixed 6 key).
// - getCashierDashboard(): owner + kasir, ringkasan today + active shift.
//   today.byMethod jadi MethodTotalEntry[].
// - getWaiterDashboard(): semua role, portion + raw materials reminder + active shifts today.
//
// BankBreakdownEntry.method generic string supaya support method requiresBank
// custom (mis. shopeepay) - bukan hanya 'edc' | 'transfer' hardcoded.

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
    /** REV 2.6: method generic string - semua payment_method.code yang
     * `requiresBank=true` dan punya transaksi di periode. */
    bankBreakdown: BankBreakdownEntry[]
  }
  expense: {
    cogsTotal: number
    // REV 2.12: PB1 ditanggung resto (Σ taxBorneAmount). Dikurangkan ke laba.
    pb1BorneTotal: number
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

export interface CashierTopMenu {
  menuId: number
  name: string
  qty: number
  revenue: number
}

export interface OrderTypeStat {
  count: number
  revenue: number
}

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
    /** REV 2.13: kartu ringan kasir. topMenus TANPA cost/laba (owner-only). */
    topMenus: CashierTopMenu[]
    itemCount: number
    atv: number
    orderTypeSplit: { dineIn: OrderTypeStat; takeaway: OrderTypeStat }
  }
  reminders: ReminderCounts
}

// ============================================================
// Owner analytics REV 2.13 (tab Menu / Tren / Kasir)
// ============================================================

export interface MenuPerfRow {
  menuId: number
  name: string
  category: string
  qtySold: number
  revenue: number
  cogs: number
  profit: number
  marginPct: number
}

export interface CategoryPerfRow {
  category: string
  qtySold: number
  revenue: number
  cogs: number
  profit: number
}

export interface MenuPerformance {
  topMenus: MenuPerfRow[]
  byCategory: CategoryPerfRow[]
}

export type TrendGranularity = 'hour' | 'day' | 'month'

export interface TrendBucket {
  bucket: string
  revenue: number
  txCount: number
}

export interface PeakHour {
  hour: number
  revenue: number
  txCount: number
}

export interface OwnerTrend {
  granularity: TrendGranularity
  revenueTrend: TrendBucket[]
  peakHours: PeakHour[]
}

export interface CashierPerfRow {
  cashierId: number
  cashierName: string
  shiftCount: number
  txCount: number
  revenue: number
  atv: number
}

export interface SettlementHistoryRow {
  date: string
  cashierName: string
  totalCounted: number
  totalSystem: number
  variance: number
  status: string
}

export interface OwnerStaff {
  cashierPerformance: CashierPerfRow[]
  settlementHistory: SettlementHistoryRow[]
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

export interface WaiterDashboard {
  portionStocks: {
    totalCount: number
    lowCount: number
    lowSamples: WaiterDashboardPortionSample[]
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

  // REV 2.13: 3 endpoint analitik owner (lazy-load per tab).
  getOwnerMenuPerformance: async (query: OwnerReportQuery = {}): Promise<MenuPerformance> => {
    const res = await api.get<ApiResponse<MenuPerformance>>('/dashboard/owner/menu-performance', {
      params: query,
    })
    return res.data.data
  },

  getOwnerTrend: async (query: OwnerReportQuery = {}): Promise<OwnerTrend> => {
    const res = await api.get<ApiResponse<OwnerTrend>>('/dashboard/owner/trend', { params: query })
    return res.data.data
  },

  getOwnerStaff: async (query: OwnerReportQuery = {}): Promise<OwnerStaff> => {
    const res = await api.get<ApiResponse<OwnerStaff>>('/dashboard/owner/staff', { params: query })
    return res.data.data
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
