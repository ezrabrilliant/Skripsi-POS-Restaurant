import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useCartStore } from '@/stores/cartStore'
import { 
  LayoutGrid, 
  Grid3X3, 
  ClipboardList, 
  Calculator, 
  UtensilsCrossed,
  Package,
  LogOut,
  User,
  Users,
  BarChart3
} from 'lucide-react'

export default function Layout() {
  const { user, logout } = useAuthStore()
  const { clearCart } = useCartStore()
  const navigate = useNavigate()
  
  const handleLogout = () => {
    clearCart()
    logout()
    navigate('/login')
  }
  
  const navItems = [
    { to: '/pos', icon: LayoutGrid, label: 'Kasir' },
    { to: '/tables', icon: Grid3X3, label: 'Meja' },
    { to: '/history', icon: ClipboardList, label: 'Riwayat' },
    { to: '/settlement', icon: Calculator, label: 'Tutup Kasir' },
  ]
  
  const ownerItems = [
    { to: '/stock', icon: Package, label: 'Stok' },
    { to: '/menu', icon: UtensilsCrossed, label: 'Menu' },
    { to: '/users', icon: Users, label: 'User' },
    { to: '/reports', icon: BarChart3, label: 'Laporan' },
  ]
  
  return (
    <div className="h-screen flex bg-neutral-100">
      {/* Sidebar */}
      <aside className="w-20 bg-white border-r border-neutral-200 flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center justify-center border-b border-neutral-200">
          <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">P</span>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `flex flex-col items-center py-3 px-2 mx-2 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-600'
                        : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-xs mt-1">{item.label}</span>
                </NavLink>
              </li>
            ))}
            
            {user?.role === 'owner' && (
              <>
                <li className="my-2 mx-4 border-t border-neutral-200" />
                {ownerItems.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        `flex flex-col items-center py-3 px-2 mx-2 rounded-lg transition-colors ${
                          isActive
                            ? 'bg-primary-50 text-primary-600'
                            : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700'
                        }`
                      }
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="text-xs mt-1">{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </>
            )}
          </ul>
        </nav>
        
        {/* User & Logout */}
        <div className="p-2 border-t border-neutral-200">
          <div className="flex flex-col items-center py-2 text-neutral-500">
            <User className="w-5 h-5" />
            <span className="text-xs mt-1 truncate w-full text-center">{user?.name}</span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex flex-col items-center py-3 px-2 rounded-lg text-neutral-500 hover:bg-danger-50 hover:text-danger-600 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-xs mt-1">Keluar</span>
          </button>
        </div>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
