import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import Layout from './components/Layout'
import {
  LoginPage,
  POSPage,
  TablesPage,
  HistoryPage,
  SettlementPage,
  StockPage,
  MenuPage,
  UsersPage,
  ReportsPage,
} from './pages'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}

function OwnerRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  if (user?.role !== 'owner') {
    return <Navigate to="/pos" replace />
  }
  
  return <>{children}</>
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
          <Route index element={<Navigate to="/pos" replace />} />
          <Route path="pos" element={<POSPage />} />
          <Route path="pos/:tableNumber" element={<POSPage />} />
          <Route path="tables" element={<TablesPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="settlement" element={<SettlementPage />} />
          
          {/* Owner only routes */}
          <Route path="stock" element={<OwnerRoute><StockPage /></OwnerRoute>} />
          <Route path="menu" element={<OwnerRoute><MenuPage /></OwnerRoute>} />
          <Route path="users" element={<OwnerRoute><UsersPage /></OwnerRoute>} />
          <Route path="reports" element={<OwnerRoute><ReportsPage /></OwnerRoute>} />
        </Route>
        
        <Route path="*" element={<Navigate to="/pos" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
