// OwnerDashboard - REV 2.3
// Primary: Stat cards Revenue / Expense / Profit + period switcher Tabs.
// Plus chart bar pendapatan per metode (Recharts) + tabel bank breakdown.
// Secondary: reminders + quick links ke CRUD master.

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  Receipt,
  ShoppingCart,
  Calendar,
  Users,
  UtensilsCrossed,
  Package,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { useAuthStore } from '@/stores/authStore'
import { dashboardService, type DashboardPeriodType } from '@/services/dashboardService'
import { formatCurrency } from '@/lib/utils'
import { Tabs, Stat, Badge, Skeleton, EmptyState } from '@/design-system/primitives'

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Hari Ini' },
  { value: 'month', label: 'Bulan Ini' },
  { value: 'year', label: 'Tahun Ini' },
]

const METHOD_LABEL: Record<string, string> = {
  cash: 'Tunai',
  edc: 'EDC',
  qris: 'QRIS',
  gojek: 'Gojek',
  grab: 'Grab',
  transfer: 'Transfer',
}

const METHOD_COLOR: Record<string, string> = {
  cash: '#1f7a4d',
  edc: '#2563eb',
  qris: '#9333ea',
  gojek: '#16a34a',
  grab: '#dc2626',
  transfer: '#d97706',
}

export default function OwnerDashboard() {
  const { user } = useAuthStore()
  const [period, setPeriod] = useState<DashboardPeriodType>('today')

  const { data: report, isLoading, error } = useQuery({
    queryKey: ['ownerReport', period],
    queryFn: () => dashboardService.getOwnerReport({ period }),
  })

  const chartData = useMemo(() => {
    if (!report) return []
    return (Object.keys(report.revenue.byMethod) as Array<keyof typeof report.revenue.byMethod>)
      .map((m) => ({
        method: METHOD_LABEL[m as string],
        key: m as string,
        amount: report.revenue.byMethod[m],
      }))
      .filter((d) => d.amount > 0)
      .sort((a, b) => b.amount - a.amount)
  }, [report])

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 pt-safe pb-safe">
        {/* Header + Period switcher */}
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-headline font-semibold text-neutral-900">Halo, {user?.name}</h1>
            <p className="text-body-sm text-neutral-600">
              Dashboard Pemilik · {report?.period.label ?? '…'}
            </p>
          </div>
          <Tabs
            value={period}
            onValueChange={(v) => setPeriod(v as DashboardPeriodType)}
            items={PERIOD_OPTIONS}
            variant="segmented"
          />
        </header>

        {isLoading && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
            <Skeleton className="h-64" />
          </>
        )}

        {error && (
          <div className="bg-danger-50 border border-danger-200 rounded-xl p-4 text-danger-700 text-body-sm">
            Gagal memuat: {(error as Error).message}
          </div>
        )}

        {report && (
          <>
            {/* Top metrics — Revenue / Expense / Profit */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Stat
                label="Pendapatan"
                value={report.revenue.total}
                format="rupiah"
                icon={<Wallet className="w-4 h-4" />}
                hint={`${report.revenue.transactionCount} transaksi`}
              />
              <Stat
                label="Pengeluaran"
                value={report.expense.total}
                format="rupiah"
                icon={<TrendingDown className="w-4 h-4" />}
                hint={
                  <>
                    Belanja {formatCurrency(report.expense.purchaseTotal)} · Tagihan{' '}
                    {formatCurrency(report.expense.billTotal)}
                  </>
                }
              />
              <Stat
                label="Laba Kotor"
                value={report.profit}
                format="rupiah"
                icon={<TrendingUp className="w-4 h-4" />}
                hint="Pendapatan − Pengeluaran"
                className={
                  report.profit < 0
                    ? '!border-danger-200 !bg-danger-50/30'
                    : '!border-success-200 !bg-success-50/30'
                }
              />
            </div>

            {/* Revenue chart + bank breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="bg-white rounded-xl p-4 sm:p-5 border border-neutral-200/60">
                <h3 className="text-title font-semibold text-neutral-900 mb-3">
                  Pendapatan per Metode
                </h3>
                {chartData.length === 0 ? (
                  <EmptyState
                    title="Belum ada transaksi"
                    description="Data muncul setelah ada transaksi yang dibayar."
                    compact
                  />
                ) : (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 8 }}>
                        <XAxis
                          type="number"
                          hide
                          domain={[0, 'dataMax']}
                        />
                        <YAxis
                          type="category"
                          dataKey="method"
                          width={70}
                          tick={{ fontSize: 12, fill: '#5a655e' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <ChartTooltip
                          cursor={{ fill: '#f4f4f3' }}
                          contentStyle={{
                            borderRadius: '8px',
                            border: '1px solid #d1d8d3',
                            fontSize: '12px',
                          }}
                          formatter={(v) => formatCurrency(Number(v) || 0)}
                          labelStyle={{ color: '#1a201c', fontWeight: 600 }}
                        />
                        <Bar dataKey="amount" radius={[0, 6, 6, 0]} barSize={22}>
                          {chartData.map((d) => (
                            <Cell key={d.key} fill={METHOD_COLOR[d.key] ?? '#5a655e'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl p-4 sm:p-5 border border-neutral-200/60">
                <h3 className="text-title font-semibold text-neutral-900 mb-3">
                  Breakdown per Bank
                </h3>
                <p className="text-caption text-neutral-500 mb-2">EDC + Transfer</p>
                {report.revenue.bankBreakdown.length === 0 ? (
                  <EmptyState
                    title="Belum ada transaksi EDC / transfer"
                    compact
                  />
                ) : (
                  <ul className="divide-y divide-neutral-100">
                    {report.revenue.bankBreakdown.map((b, i) => (
                      <li
                        key={`${b.method}-${b.bank}-${i}`}
                        className="flex items-center justify-between py-2"
                      >
                        <span className="text-body-sm text-neutral-700 inline-flex items-center gap-2">
                          <Badge tone="info" variant="soft" size="sm">
                            {b.method.toUpperCase()}
                          </Badge>
                          <span className="text-neutral-900 font-medium">{b.bank}</span>
                        </span>
                        <span className="text-body-sm font-semibold text-neutral-900 tabular-nums">
                          {formatCurrency(b.total)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Reminders + Quick links */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <ReminderCard reminders={report.reminders} />
              <QuickLinks />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ReminderCard({
  reminders,
}: {
  reminders: { portionLowCount: number; rawMaterialLowCount: number; rawMaterialNearExpiryCount: number }
}) {
  const total =
    reminders.portionLowCount + reminders.rawMaterialLowCount + reminders.rawMaterialNearExpiryCount
  return (
    <div className="bg-white rounded-xl p-4 sm:p-5 border border-neutral-200/60">
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle className="w-5 h-5 text-warning-600" />
        <h3 className="text-title font-semibold text-neutral-900">Reminder Stok</h3>
        {total > 0 && (
          <Badge tone="warning" size="sm" className="ml-auto">
            {total} item
          </Badge>
        )}
      </div>
      <ul className="space-y-2 text-body-sm">
        <li className="flex justify-between">
          <span className="text-neutral-700">Stok porsi di bawah min</span>
          <Link to="/stock" className="font-medium text-primary-700 hover:underline tabular-nums">
            {reminders.portionLowCount}
          </Link>
        </li>
        <li className="flex justify-between">
          <span className="text-neutral-700">Raw material perlu restock</span>
          <span className="font-medium text-neutral-900 tabular-nums">{reminders.rawMaterialLowCount}</span>
        </li>
        <li className="flex justify-between">
          <span className="text-neutral-700">Raw material mendekati basi</span>
          <span className="font-medium text-neutral-900 tabular-nums">
            {reminders.rawMaterialNearExpiryCount}
          </span>
        </li>
      </ul>
    </div>
  )
}

function QuickLinks() {
  const links = [
    { to: '/menu', icon: UtensilsCrossed, label: 'Kelola Menu' },
    { to: '/users', icon: Users, label: 'Kelola Pegawai' },
    { to: '/stock', icon: Package, label: 'Stok Porsi & Bahan' },
    { to: '/history', icon: Receipt, label: 'Riwayat Transaksi' },
    { to: '/settlement', icon: Calendar, label: 'Settlement' },
    { to: '/purchases', icon: ShoppingCart, label: 'Belanja' },
    { to: '/bills', icon: Receipt, label: 'Tagihan Bulanan' },
  ]
  return (
    <div className="bg-white rounded-xl p-4 sm:p-5 border border-neutral-200/60">
      <h3 className="text-title font-semibold text-neutral-900 mb-3">Akses Cepat</h3>
      <div className="grid grid-cols-2 gap-2">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-body-sm text-neutral-800 hover:bg-neutral-50 active:bg-neutral-100 transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
          >
            <l.icon className="w-4 h-4 text-neutral-500 shrink-0" />
            <span className="truncate">{l.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
