// CashierTodayCards REV 2.13 - 2 kartu ringan kasir untuk shift berjalan:
//   - Menu Terlaris Hari Ini (top 5 by qty; TANPA cost/laba - owner-only)
//   - Statistik Order Hari Ini (item terjual, rata-rata/transaksi, dine-in vs takeaway)
// Data dari dashboard.today (sudah di-extend backend REV 2.13).
import { TrendingUp, ShoppingBag, Utensils, Package2 } from 'lucide-react'
import type { CashierDashboard } from '@/services/dashboardService'
import { formatCurrency } from '@/lib/utils'

type Today = CashierDashboard['today']

export default function CashierTodayCards({ today }: { today: Today }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <TodayTopMenusCard topMenus={today.topMenus} />
      <TodayOrderStatsCard today={today} />
    </div>
  )
}

function TodayTopMenusCard({ topMenus }: { topMenus: Today['topMenus'] }) {
  return (
    <div className="bg-white rounded-xl p-4 sm:p-5 border border-neutral-200/60">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-5 h-5 text-primary-600" />
        <h3 className="text-title font-semibold text-neutral-900">Menu Terlaris Hari Ini</h3>
      </div>
      {topMenus.length === 0 ? (
        <p className="text-body-sm text-neutral-500">Belum ada penjualan hari ini.</p>
      ) : (
        <ul className="space-y-2">
          {topMenus.map((m, i) => (
            <li key={m.menuId} className="flex items-center justify-between gap-2">
              <span className="text-body-sm text-neutral-800 inline-flex items-center gap-2 min-w-0">
                <span className="text-caption text-neutral-400 tabular-nums w-4 shrink-0">{i + 1}.</span>
                <span className="truncate">{m.name}</span>
              </span>
              <span className="text-body-sm text-neutral-900 tabular-nums shrink-0">
                <span className="font-semibold">{m.qty}</span>
                <span className="text-neutral-400"> · </span>
                <span className="text-neutral-600">{formatCurrency(m.revenue)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TodayOrderStatsCard({ today }: { today: Today }) {
  return (
    <div className="bg-white rounded-xl p-4 sm:p-5 border border-neutral-200/60">
      <div className="flex items-center gap-2 mb-3">
        <ShoppingBag className="w-5 h-5 text-primary-600" />
        <h3 className="text-title font-semibold text-neutral-900">Statistik Order Hari Ini</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <MiniStat label="Item terjual" value={String(today.itemCount)} />
        <MiniStat label="Rata-rata / transaksi" value={formatCurrency(today.atv)} />
      </div>
      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-neutral-100">
        <OrderTypeRow
          icon={<Utensils className="w-4 h-4 text-neutral-500" />}
          label="Dine-in"
          count={today.orderTypeSplit.dineIn.count}
          revenue={today.orderTypeSplit.dineIn.revenue}
        />
        <OrderTypeRow
          icon={<Package2 className="w-4 h-4 text-neutral-500" />}
          label="Takeaway"
          count={today.orderTypeSplit.takeaway.count}
          revenue={today.orderTypeSplit.takeaway.revenue}
        />
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-neutral-50 border border-neutral-200/60 p-3">
      <p className="text-caption text-neutral-500">{label}</p>
      <p className="text-title font-semibold text-neutral-900 tabular-nums mt-0.5">{value}</p>
    </div>
  )
}

function OrderTypeRow({
  icon,
  label,
  count,
  revenue,
}: {
  icon: React.ReactNode
  label: string
  count: number
  revenue: number
}) {
  return (
    <div>
      <p className="text-caption text-neutral-500 inline-flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <p className="text-body-sm font-semibold text-neutral-900 tabular-nums">
        {count}
        <span className="text-caption font-normal text-neutral-500"> order</span>
      </p>
      <p className="text-caption text-neutral-600 tabular-nums">{formatCurrency(revenue)}</p>
    </div>
  )
}
