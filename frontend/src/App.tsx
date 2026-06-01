import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import Layout from './components/Layout'
import type { UserRole } from './types'
import {
  LoginPage,
  POSPage,
  TablesPage,
  HistoryPage,
  SettlementPage,
  StockPage,
  MenuPage,
  UsersPage,
  BillsPage,
  PaymentMethodsPage,
  OwnerDashboard,
  CashierDashboard,
  WaiterDashboard,
} from './pages'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

// Pembatas akses berbasis peran. Bila peran tidak diizinkan,
// dialihkan ke /dashboard (default landing per role).
function RoleRoute({ allow, children }: { allow: UserRole[]; children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!user || !allow.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

// REV 2.3: 3 dashboard berbeda per role. Render branch berdasarkan user.role.
function Dashboard() {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'owner') return <OwnerDashboard />
  if (user.role === 'cashier') return <CashierDashboard />
  if (user.role === 'waiter') return <WaiterDashboard />
  return null
}

// Default landing page setelah login -> /dashboard untuk semua role.
function RoleLanding() {
  return <Navigate to="/dashboard" replace />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<RoleLanding />} />

          {/* Dashboard - semua role authenticated (branch per role di komponen) */}
          <Route path="dashboard" element={<Dashboard />} />

          {/* Order intake: pos + tables = owner/cashier/waiter (waiter input order
              sebagai alur normal; pembayaran tetap kasir-only via gate Bayar di UI
              + requireRole di backend). history/settlement tetap owner+cashier. */}
          <Route path="pos" element={<RoleRoute allow={['owner', 'cashier', 'waiter']}><POSPage /></RoleRoute>} />
          <Route path="pos/:tableNumber" element={<RoleRoute allow={['owner', 'cashier', 'waiter']}><POSPage /></RoleRoute>} />
          <Route path="tables" element={<RoleRoute allow={['owner', 'cashier', 'waiter']}><TablesPage /></RoleRoute>} />
          <Route path="history" element={<RoleRoute allow={['owner', 'cashier']}><HistoryPage /></RoleRoute>} />
          <Route path="settlement" element={<RoleRoute allow={['owner', 'cashier']}><SettlementPage /></RoleRoute>} />

          {/* Stok - semua role per matrix REV 2.3 */}
          <Route path="stock" element={<RoleRoute allow={['owner', 'cashier', 'waiter']}><StockPage /></RoleRoute>} />

          {/* Owner-only */}
          <Route path="menu" element={<RoleRoute allow={['owner']}><MenuPage /></RoleRoute>} />
          <Route path="menu/sku-varian" element={<Navigate to="/menu?tab=varian" replace />} />
          <Route path="users" element={<RoleRoute allow={['owner']}><UsersPage /></RoleRoute>} />
          <Route path="bills" element={<RoleRoute allow={['owner']}><BillsPage /></RoleRoute>} />
          <Route path="payment-methods" element={<RoleRoute allow={['owner']}><PaymentMethodsPage /></RoleRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
