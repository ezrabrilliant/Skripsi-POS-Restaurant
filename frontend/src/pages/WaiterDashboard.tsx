// WaiterDashboard - REV 2.3 (+ order-intake co-equal)
// Primary: kartu CTA "Input Order" (POS) di paling atas + kartu "Stok Porsi" +
// quick action Opname/Mark Habis. Waiter kini input order sebagai alur normal;
// pembayaran tetap diproses kasir (tombol Bayar disembunyikan + ditolak backend).

import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Package,
  ClipboardCheck,
  XCircle,
  ArrowRight,
  Sun,
  Moon,
  Users,
  CheckCircle2,
  LayoutGrid,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { dashboardService } from '@/services/dashboardService'
import { cn } from '@/lib/utils'
import { Skeleton, Badge, Page } from '@/design-system/primitives'

export default function WaiterDashboard() {
  const { user } = useAuthStore()

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['waiterDashboard'],
    queryFn: dashboardService.getWaiterDashboard,
  })

  return (
    <Page title={`Halo, ${user?.name ?? ''}`} subtitle="Dashboard Pelayan">
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        )}

        {dashboard && (
          <>
            {/* Primary CTA: Input Order (POS). Alur utama waiter sekarang.
                Pembayaran tetap kasir-only (Bayar disembunyikan + ditolak backend). */}
            <Link
              to="/pos"
              className="block bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl p-6 sm:p-8 text-white shadow-md hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <LayoutGrid className="w-7 h-7" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-title sm:text-headline font-semibold mb-1">Input Order</h2>
                  <p className="text-primary-50/90 text-body-sm sm:text-body mb-3">
                    Buat pesanan baru untuk meja atau takeaway. Pembayaran diproses kasir.
                  </p>
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-white text-primary-700 rounded-md font-medium text-body-sm hover:bg-primary-50 transition-colors">
                    Buka Halaman POS
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </Link>

            {/* Stok porsi */}
            <div className="grid grid-cols-1 gap-3">
              <PortionStockCard data={dashboard.portionStocks} />
            </div>

            {/* Quick actions */}
            <div className="bg-white rounded-xl p-4 sm:p-5 border border-neutral-200/60">
              <h3 className="text-title font-semibold text-neutral-900 mb-3">Aksi Cepat</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <QuickAction
                  to="/stock?action=opname"
                  icon={ClipboardCheck}
                  label="Opname Stok Porsi"
                />
                <QuickAction
                  to="/stock"
                  icon={XCircle}
                  label="Mark Item Habis"
                />
              </div>
            </div>

            {/* Active shifts today */}
            {dashboard.activeShiftsToday.length > 0 && (
              <div className="bg-white rounded-xl p-4 sm:p-5 border border-neutral-200/60">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-neutral-500" />
                  <h3 className="text-title font-semibold text-neutral-900">Shift Aktif Hari Ini</h3>
                </div>
                <ul className="space-y-2">
                  {dashboard.activeShiftsToday.map((s) => {
                    const Icon = s.type === 'pagi' ? Sun : Moon
                    return (
                      <li key={s.id} className="flex items-center gap-3 text-body-sm">
                        <Icon className="w-4 h-4 text-neutral-400 shrink-0" />
                        <span className="text-neutral-800">{s.cashierName}</span>
                        <Badge tone="neutral" size="sm" className="ml-auto">
                          Shift {s.type === 'pagi' ? 'Pagi' : 'Malam'}
                        </Badge>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

          </>
        )}
    </Page>
  )
}

function PortionStockCard({
  data,
}: {
  data: {
    totalCount: number
    lowCount: number
    lowSamples: Array<{
      menuId: number
      menuName: string
      currentQty: number
      minStock: number
      suggestedRestock: number
    }>
  }
}) {
  const allSafe = data.lowCount === 0
  return (
    <div className="bg-white rounded-xl p-4 sm:p-5 border border-neutral-200/60">
      <div className="flex items-center gap-2 mb-3">
        <Package className="w-5 h-5 text-primary-600" />
        <h3 className="text-title font-semibold text-neutral-900">Stok Porsi Hari Ini</h3>
      </div>
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-neutral-100">
        <div>
          <p className="text-headline font-semibold text-neutral-900 tabular-nums">
            {data.totalCount}
          </p>
          <p className="text-caption text-neutral-500">Total item</p>
        </div>
        <div className="text-right">
          <p
            className={cn(
              'text-headline font-semibold tabular-nums',
              allSafe ? 'text-success-600' : 'text-warning-700'
            )}
          >
            {data.lowCount}
          </p>
          <p className="text-caption text-neutral-500">di bawah min</p>
        </div>
      </div>
      {allSafe ? (
        <div className="text-center py-3 text-success-700 text-body-sm flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" />
          Semua stok aman
        </div>
      ) : (
        <div>
          <p className="text-label text-neutral-600 uppercase tracking-wide mb-2">Perlu restock</p>
          <ul className="space-y-1.5">
            {data.lowSamples.map((s) => (
              <li
                key={s.menuId}
                className="flex items-center justify-between text-body-sm py-1"
              >
                <span className="text-neutral-800 truncate flex-1 mr-2">{s.menuName}</span>
                <span className="text-warning-700 font-medium whitespace-nowrap tabular-nums">
                  {s.currentQty}/{s.minStock}
                  {s.suggestedRestock > 0 && (
                    <span className="ml-1 text-caption text-neutral-500">(+{s.suggestedRestock})</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Link
        to="/stock"
        className="mt-3 block text-center text-body-sm font-medium text-primary-700 hover:text-primary-800 hover:underline"
      >
        Lihat semua stok porsi →
      </Link>
    </div>
  )
}

function QuickAction({
  to,
  icon: Icon,
  label,
}: {
  to: string
  icon: typeof ClipboardCheck
  label: string
}) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center text-center gap-1.5 p-3 rounded-lg bg-neutral-50 hover:bg-neutral-100 active:bg-neutral-200 transition-colors min-h-[80px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
    >
      <Icon className="w-5 h-5 text-neutral-700" />
      <span className="text-caption font-medium text-neutral-800 leading-tight">{label}</span>
    </Link>
  )
}
