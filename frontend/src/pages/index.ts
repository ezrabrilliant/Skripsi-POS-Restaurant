// REV 2.11 pages index. Drop PurchasesPage (belanja subsystem removed).

export { default as LoginPage } from './LoginPage'
export { default as POSPage } from './POSPage'
export { default as TablesPage } from './TablesPage'
export { default as HistoryPage } from './HistoryPage'
export { default as SettlementPage } from './SettlementPage'
export { default as StockPage } from './StockPage'
export { default as MenuPage } from './MenuPage'
export { default as UsersPage } from './UsersPage'
export { default as BillsPage } from './BillsPage'
export { default as PaymentMethodsPage } from './PaymentMethodsPage'

// REV 2.14: halaman laporan owner (eks konten dashboard ber-tab)
export { default as LaporanPage } from './LaporanPage'

// REV 2.3: 3 dashboard per role
export { default as OwnerDashboard } from './OwnerDashboard'
export { default as CashierDashboard } from './CashierDashboard'
export { default as WaiterDashboard } from './WaiterDashboard'
