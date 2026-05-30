import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useCartStore } from '@/stores/cartStore'
import { useState } from 'react'
import ShiftChangeReminder from '@/components/ShiftChangeReminder'
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
  Receipt,
  Menu as MenuIcon,
  ChevronRight,
  Home,
  CreditCard,
} from 'lucide-react'
import { ROLE_LABELS, type UserRole } from '@/types'
import { Sheet, Button } from '@/design-system/primitives'
import { useConfirm } from '@/design-system/hooks/useConfirm'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  icon: typeof LayoutGrid
  label: string
}

// REV 2.3: nav per role. Item pertama selalu Beranda (landing setelah login).
// Waiter primary nav = Beranda + Stok (POS access fallback only, via link kecil
// di WaiterDashboard).
const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  owner: [
    { to: '/dashboard',  icon: Home,             label: 'Beranda' },
    { to: '/pos',        icon: LayoutGrid,       label: 'Kasir' },
    { to: '/tables',     icon: Grid3X3,          label: 'Meja' },
    { to: '/history',    icon: ClipboardList,    label: 'Riwayat' },
    { to: '/settlement', icon: Calculator,       label: 'Tutup Kasir' },
    { to: '/stock',      icon: Package,          label: 'Stok' },
    { to: '/bills',      icon: Receipt,          label: 'Tagihan' },
    { to: '/menu',       icon: UtensilsCrossed,  label: 'Menu' },
    { to: '/payment-methods', icon: CreditCard,  label: 'Pembayaran' },
    { to: '/users',      icon: Users,            label: 'Pengguna' },
  ],
  cashier: [
    { to: '/dashboard',  icon: Home,             label: 'Beranda' },
    { to: '/pos',        icon: LayoutGrid,       label: 'Kasir' },
    { to: '/tables',     icon: Grid3X3,          label: 'Meja' },
    { to: '/history',    icon: ClipboardList,    label: 'Riwayat' },
    { to: '/settlement', icon: Calculator,       label: 'Tutup Kasir' },
    { to: '/stock',      icon: Package,          label: 'Stok' },
  ],
  waiter: [
    { to: '/dashboard',  icon: Home,             label: 'Beranda' },
    { to: '/stock',      icon: Package,          label: 'Stok' },
  ],
}

export default function Layout() {
  const { user, logout } = useAuthStore()
  const { clearCart } = useCartStore()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [moreOpen, setMoreOpen] = useState(false)

  const handleLogout = async () => {
    // Tutup Sheet "Lainnya" duluan supaya tidak tumpang tindih dgn confirm Dialog.
    setMoreOpen(false)
    const ok = await confirm({
      title: 'Keluar dari sistem?',
      description: 'Anda akan kembali ke halaman login. Pastikan tidak ada transaksi yang belum diproses.',
      confirmText: 'Ya, Keluar',
      cancelText: 'Batal',
      tone: 'danger',
    })
    if (!ok) return
    clearCart()
    logout()
    navigate('/login')
  }

  const items = NAV_BY_ROLE[user?.role ?? 'cashier']
  // Mobile: max 4 item primary di bottom-nav, sisanya masuk Sheet "Lainnya"
  const bottomItems = items.slice(0, 4)
  const moreItems = items.slice(4)
  const roleLabel = user ? ROLE_LABELS[user.role] : ''
  const hasMore = moreItems.length > 0

  return (
    <div className="h-[100dvh] flex flex-col md:flex-row bg-neutral-100">
      {/* Sidebar desktop/tablet */}
      <aside className="hidden md:flex w-20 lg:w-64 bg-white border-r border-neutral-200 flex-col flex-shrink-0 pt-safe">
        {/* Brand header */}
        <div className="h-16 flex items-center justify-center lg:justify-start lg:px-5 border-b border-neutral-200 shrink-0">
          <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center shadow-sm shrink-0">
            <span className="text-white font-bold text-body tracking-tight">ABM</span>
          </div>
          <div className="hidden lg:flex flex-col ml-3 leading-tight">
            <span className="font-semibold text-body text-neutral-900">POS ABM</span>
            <span className="text-caption text-neutral-500">Ayam Bakar Banjar</span>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 overflow-y-auto">
          <ul className="space-y-0.5 px-2 lg:px-3">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  title={item.label}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex items-center gap-3 rounded-lg transition-colors duration-fast',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
                      // collapsed (md) - center icon, no label
                      'justify-center px-0 py-2.5',
                      // expanded (lg) - icon + label
                      'lg:justify-start lg:px-3 lg:py-2',
                      isActive
                        ? 'bg-primary-50 text-primary-700 font-semibold'
                        : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 font-medium'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* Active accent bar (lg only) */}
                      {isActive && (
                        <span className="hidden lg:block absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 bg-primary-600 rounded-r-full" />
                      )}
                      <item.icon className="w-5 h-5 shrink-0" />
                      <span className="hidden lg:inline text-body whitespace-nowrap">
                        {item.label}
                      </span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* User profile + logout */}
        <div className="border-t border-neutral-200 p-2 lg:p-3 pb-safe space-y-1">
          <div className="flex items-center justify-center lg:justify-start gap-3 px-0 lg:px-2 py-2 rounded-lg">
            <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center shrink-0 font-semibold text-primary-700">
              {user?.name?.charAt(0).toUpperCase() ?? <User className="w-4 h-4" />}
            </div>
            <div className="hidden lg:flex flex-col min-w-0 leading-tight">
              <p className="font-semibold text-body-sm text-neutral-900 truncate">{user?.name}</p>
              <p className="text-caption text-neutral-500">{roleLabel}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Keluar"
            className={cn(
              'w-full flex items-center gap-3 rounded-lg transition-colors duration-fast text-neutral-600',
              'hover:bg-danger-50 hover:text-danger-700',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
              'justify-center px-0 py-2.5',
              'lg:justify-start lg:px-3 lg:py-2 font-medium'
            )}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className="hidden lg:inline text-body">Keluar</span>
          </button>
        </div>
      </aside>

      {/* Konten utama */}
      <main className="flex-1 overflow-hidden pb-safe-nav md:pb-0">
        <Outlet />
      </main>

      {/* Bottom nav mobile */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 pb-safe"
        style={{ zIndex: 10 }}
        aria-label="Navigasi utama"
      >
        <div className="flex items-stretch h-16">
          {bottomItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center flex-1 gap-0.5 transition-colors relative',
                  'focus-visible:outline-none',
                  isActive ? 'text-primary-700' : 'text-neutral-500 active:text-neutral-700'
                )
              }
              end={item.to === '/'}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-primary-600 rounded-full" />
                  )}
                  <item.icon className={cn('w-6 h-6', isActive && 'fill-primary-100')} />
                  <span className="text-caption font-medium">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
          {hasMore && (
            <button
              onClick={() => setMoreOpen(true)}
              className={cn(
                'flex flex-col items-center justify-center flex-1 gap-0.5 text-neutral-500 active:text-neutral-700 transition-colors',
                moreOpen && 'text-primary-700'
              )}
              aria-label="Buka menu lainnya"
            >
              <MenuIcon className="w-6 h-6" />
              <span className="text-caption font-medium">Lainnya</span>
            </button>
          )}
        </div>
      </nav>

      {/* Global shift-change reminder banner (fixed overlay, dismissible per shift) */}
      <ShiftChangeReminder />

      {/* Sheet "Lainnya" mobile */}
      <Sheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        side="bottom"
        height="auto"
        hideHeader
      >
        <div className="px-4 pt-2 pb-4">
          {/* Profile section */}
          <div className="flex items-center gap-3 mb-4 px-1">
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center font-semibold text-primary-700 text-lg shrink-0">
              {user?.name?.charAt(0).toUpperCase() ?? <User className="w-5 h-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-body font-semibold text-neutral-900 truncate">{user?.name}</p>
              <p className="text-body-sm text-neutral-500">{roleLabel}</p>
            </div>
          </div>

          {hasMore && (
            <>
              <p className="px-2 mb-1 text-label text-neutral-500 uppercase tracking-wider">Menu lain</p>
              <ul className="space-y-0.5">
                {moreItems.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={() => setMoreOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 px-3 py-3 rounded-lg transition-colors min-h-[52px]',
                          isActive
                            ? 'bg-primary-50 text-primary-700'
                            : 'text-neutral-800 active:bg-neutral-100'
                        )
                      }
                    >
                      <item.icon className="w-5 h-5 shrink-0" />
                      <span className="flex-1 text-body font-medium">{item.label}</span>
                      <ChevronRight className="w-5 h-5 text-neutral-400" />
                    </NavLink>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="mt-4 pt-3 border-t border-neutral-200">
            <Button
              variant="ghost"
              fullWidth
              leftIcon={<LogOut className="w-4 h-4" />}
              onClick={handleLogout}
              className="!justify-start text-danger-700 hover:bg-danger-50"
            >
              Keluar
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  )
}
