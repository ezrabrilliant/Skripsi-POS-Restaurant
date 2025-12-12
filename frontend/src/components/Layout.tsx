import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useCartStore } from '@/stores/cartStore'
import { useState } from 'react'
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
  BarChart3,
  Menu,
  ChevronRight
} from 'lucide-react'

export default function Layout() {
  const { user, logout } = useAuthStore()
  const { clearCart } = useCartStore()
  const navigate = useNavigate()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  
  const handleLogout = () => {
    clearCart()
    logout()
    navigate('/login')
    setIsMenuOpen(false)
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

  // Mobile bottom nav items (limited)
  const mobileNavItems = navItems.slice(0, 3)
  
  return (
    <div className="h-screen flex flex-col md:flex-row bg-neutral-100">
      {/* Desktop/Tablet Sidebar - Hidden on mobile */}
      <aside className="hidden md:flex w-20 lg:w-64 bg-white border-r border-neutral-200 flex-col flex-shrink-0">
        {/* Logo */}
        <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-neutral-200">
          <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">P</span>
          </div>
          <span className="hidden lg:block ml-3 font-bold text-lg text-neutral-800">POS Resto</span>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center py-3 px-3 mx-2 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-600'
                        : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span className="hidden lg:block ml-3 font-medium">{item.label}</span>
                </NavLink>
              </li>
            ))}
            
            {user?.role === 'owner' && (
              <>
                <li className="my-3 mx-4 border-t border-neutral-200" />
                <li className="hidden lg:block px-4 mb-2">
                  <span className="text-xs font-semibold text-neutral-400 uppercase">Owner</span>
                </li>
                {ownerItems.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center py-3 px-3 mx-2 rounded-lg transition-colors ${
                          isActive
                            ? 'bg-primary-50 text-primary-600'
                            : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700'
                        }`
                      }
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      <span className="hidden lg:block ml-3 font-medium">{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </>
            )}
          </ul>
        </nav>
        
        {/* User & Logout - Desktop */}
        <div className="p-2 border-t border-neutral-200">
          <div className="flex items-center py-2 px-3 text-neutral-600">
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-primary-600" />
            </div>
            <div className="hidden lg:block ml-3 overflow-hidden">
              <p className="font-medium text-sm truncate">{user?.name}</p>
              <p className="text-xs text-neutral-400 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center py-3 px-3 rounded-lg text-neutral-500 hover:bg-danger-50 hover:text-danger-600 transition-colors"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className="hidden lg:block ml-3 font-medium">Keluar</span>
          </button>
        </div>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 overflow-hidden pb-16 md:pb-0">
        <Outlet />
      </main>
      
      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 z-40">
        <div className="flex items-center justify-around h-16">
          {mobileNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                  isActive ? 'text-primary-600' : 'text-neutral-400'
                }`
              }
            >
              <item.icon className="w-6 h-6" />
              <span className="text-[10px] mt-1 font-medium">{item.label}</span>
            </NavLink>
          ))}
          
          {/* More Menu Button */}
          <button
            onClick={() => setIsMenuOpen(true)}
            className="flex flex-col items-center justify-center flex-1 h-full text-neutral-400"
          >
            <Menu className="w-6 h-6" />
            <span className="text-[10px] mt-1 font-medium">Lainnya</span>
          </button>
        </div>
      </nav>
      
      {/* Mobile Slide-up Menu */}
      {isMenuOpen && (
        <>
          <div 
            className="md:hidden fixed inset-0 bg-black/50 z-50"
            onClick={() => setIsMenuOpen(false)}
          />
          
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 max-h-[85vh] overflow-y-auto">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-neutral-300 rounded-full" />
            </div>
            
            {/* User Info */}
            <div className="px-4 py-3 border-b border-neutral-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <p className="font-semibold text-neutral-800">{user?.name}</p>
                  <p className="text-sm text-neutral-500 capitalize">{user?.role}</p>
                </div>
              </div>
            </div>
            
            {/* Menu Items */}
            <div className="p-3">
              <p className="px-3 py-2 text-xs font-semibold text-neutral-400 uppercase">Menu</p>
              {[navItems[3]].map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setIsMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-3.5 rounded-xl ${
                      isActive ? 'bg-primary-50 text-primary-600' : 'text-neutral-700 active:bg-neutral-100'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  <span className="flex-1 font-medium">{item.label}</span>
                  <ChevronRight className="w-5 h-5 text-neutral-400" />
                </NavLink>
              ))}
              
              {user?.role === 'owner' && (
                <>
                  <p className="px-3 py-2 mt-2 text-xs font-semibold text-neutral-400 uppercase">Owner</p>
                  {ownerItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setIsMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-3.5 rounded-xl ${
                          isActive ? 'bg-primary-50 text-primary-600' : 'text-neutral-700 active:bg-neutral-100'
                        }`
                      }
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="flex-1 font-medium">{item.label}</span>
                      <ChevronRight className="w-5 h-5 text-neutral-400" />
                    </NavLink>
                  ))}
                </>
              )}
              
              {/* Logout */}
              <div className="border-t border-neutral-100 mt-3 pt-3">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-3 py-3.5 rounded-xl w-full text-danger-600 active:bg-danger-50"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="flex-1 font-medium text-left">Keluar</span>
                </button>
              </div>
            </div>
            
            {/* Close */}
            <div className="p-4 pt-0">
              <button
                onClick={() => setIsMenuOpen(false)}
                className="w-full py-3 bg-neutral-100 rounded-xl text-neutral-600 font-medium active:bg-neutral-200"
              >
                Tutup
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
