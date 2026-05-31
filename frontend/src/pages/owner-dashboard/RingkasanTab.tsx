// RingkasanTab REV 2.13 - konten dashboard owner "Ringkasan" (eks-OwnerDashboard).
// KPI Pendapatan/COGS/Laba + Margin% (BARU) + shift panel + chart per metode +
// tabel bank + reminder + quick links. Fetch GET /dashboard/owner (period).
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  Percent,
  AlertCircle,
  Receipt,
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
import {
  dashboardService,
  type OwnerReportQuery,
  type ReminderCounts,
} from '@/services/dashboardService'
import { shiftService } from '@/services/shiftService'
import { formatCurrency } from '@/lib/utils'
import { Stat, Badge, Skeleton, EmptyState } from '@/design-system/primitives'

export default function RingkasanTab({ period }: { period: OwnerReportQuery }) {
  const { data: report, isLoading, error } = useQuery({
    queryKey: ['ownerReport', period],
    queryFn: () => dashboardService.getOwnerReport(period),
  })

  const { data: activeShifts = [] } = useQuery({
    queryKey: ['shifts', 'active'],
    queryFn: () => shiftService.getActiveShifts(),
  })

  const chartData = useMemo(() => {
    if (!report) return []
    return report.revenue.byMethod
      .filter((entry) => entry.total > 0)
      .map((entry) => ({
        method: entry.methodLabel,
        key: entry.paymentMethodCode,
        amount: entry.total,
        color: entry.colorHex,
      }))
  }, [report])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-danger-50 border border-danger-200 rounded-xl p-4 text-danger-700 text-body-sm">
        Gagal memuat: {(error as Error).message}
      </div>
    )
  }

  if (!report) return null

  const marginPct = report.revenue.total > 0 ? (report.profit / report.revenue.total) * 100 : 0

  return (
    <div className="space-y-4">
      {/* KPI: Pendapatan / COGS / Laba / Margin% */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label="Pendapatan"
          value={report.revenue.total}
          format="rupiah"
          icon={<Wallet className="w-4 h-4" />}
          hint={`${report.revenue.transactionCount} transaksi`}
        />
        <Stat
          label="Beban Pokok (COGS)"
          value={report.expense.cogsTotal}
          format="rupiah"
          icon={<TrendingDown className="w-4 h-4" />}
          hint={
            report.expense.pb1BorneTotal > 0
              ? `PB1 ditanggung ${formatCurrency(report.expense.pb1BorneTotal)} · Tagihan ${formatCurrency(report.expense.billTotal)} (terpisah)`
              : `Tagihan ${formatCurrency(report.expense.billTotal)} (terpisah)`
          }
        />
        <Stat
          label="Laba Kotor"
          value={report.profit}
          format="rupiah"
          icon={<TrendingUp className="w-4 h-4" />}
          hint={
            report.expense.pb1BorneTotal > 0
              ? 'Pendapatan − COGS − PB1 ditanggung'
              : 'Pendapatan − COGS'
          }
          className={
            report.profit < 0
              ? '!border-danger-200 !bg-danger-50/30'
              : '!border-success-200 !bg-success-50/30'
          }
        />
        <Stat
          label="Margin Laba"
          value={marginPct}
          format="percent"
          icon={<Percent className="w-4 h-4" />}
          hint="Laba ÷ Pendapatan"
        />
      </div>

      <ShiftPanel shifts={activeShifts} />

      {/* Revenue chart + bank breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-neutral-200/60">
          <h3 className="text-title font-semibold text-neutral-900 mb-3">Pendapatan per Metode</h3>
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
                  <XAxis type="number" hide domain={[0, 'dataMax']} />
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
                    contentStyle={{ borderRadius: '8px', border: '1px solid #d1d8d3', fontSize: '12px' }}
                    formatter={(v) => formatCurrency(Number(v) || 0)}
                    labelStyle={{ color: '#1a201c', fontWeight: 600 }}
                  />
                  <Bar dataKey="amount" radius={[0, 6, 6, 0]} barSize={22}>
                    {chartData.map((d) => (
                      <Cell key={d.key} fill={d.color || '#5a655e'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-4 sm:p-5 border border-neutral-200/60">
          <h3 className="text-title font-semibold text-neutral-900 mb-3">Breakdown per Bank</h3>
          <p className="text-caption text-neutral-500 mb-2">EDC + Transfer</p>
          {report.revenue.bankBreakdown.length === 0 ? (
            <EmptyState title="Belum ada transaksi EDC / transfer" compact />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {report.revenue.bankBreakdown.map((b, i) => (
                <li key={`${b.method}-${b.bank}-${i}`} className="flex items-center justify-between py-2">
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
    </div>
  )
}

function ReminderCard({ reminders }: { reminders: ReminderCounts }) {
  const total = reminders.portionLowCount
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
      </ul>
    </div>
  )
}

function QuickLinks() {
  const links = [
    { to: '/menu', icon: UtensilsCrossed, label: 'Kelola Menu' },
    { to: '/users', icon: Users, label: 'Kelola Pegawai' },
    { to: '/stock', icon: Package, label: 'Stok Porsi' },
    { to: '/history', icon: Receipt, label: 'Riwayat Transaksi' },
    { to: '/settlement', icon: Calendar, label: 'Settlement' },
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

// Shift panel REV 2.3 shift-decoupling (dipindah dari OwnerDashboard).
function ShiftPanel({
  shifts,
}: {
  shifts: Array<{ id: number; type?: 'pagi' | 'malam'; cashierName?: string; createdAt: string; openingCash: number }>
}) {
  if (shifts.length === 0) {
    return (
      <div className="bg-white rounded-xl p-3 sm:p-4 border border-neutral-200/60 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-neutral-100 text-neutral-500 flex items-center justify-center">
          <Wallet className="w-4 h-4" />
        </div>
        <div className="text-body-sm text-neutral-600">Belum ada shift kasir aktif hari ini.</div>
      </div>
    )
  }
  const isOverlap = shifts.length > 1
  return (
    <div
      className={
        isOverlap
          ? 'bg-warning-50 border border-warning-300 rounded-xl p-3 sm:p-4'
          : 'bg-success-50 border border-success-200 rounded-xl p-3 sm:p-4'
      }
    >
      <div className="flex items-center gap-2 mb-1">
        {isOverlap ? (
          <AlertCircle className="w-4 h-4 text-warning-700" />
        ) : (
          <Wallet className="w-4 h-4 text-success-700" />
        )}
        <h3 className="text-body-sm font-semibold text-neutral-900">
          {isOverlap ? `Ada ${shifts.length} shift aktif (overlap)` : 'Shift aktif hari ini'}
        </h3>
      </div>
      <ul className="text-body-sm space-y-1 text-neutral-700">
        {shifts.map((s) => (
          <li key={s.id} className="flex flex-wrap gap-x-2">
            <span className="font-medium text-neutral-900">{s.cashierName ?? '-'}</span>
            <span className="text-neutral-500">·</span>
            <span>{s.type === 'pagi' ? 'Pagi' : s.type === 'malam' ? 'Malam' : '-'}</span>
            <span className="text-neutral-500">·</span>
            <span>modal awal {formatCurrency(s.openingCash)}</span>
          </li>
        ))}
      </ul>
      {isOverlap && (
        <p className="mt-2 text-caption text-warning-700">
          Input order baru akan ditolak sampai salah satu shift ditutup. Owner force-close belum
          tersedia di UI - minta kasir tutup shift via menu Settlement.
        </p>
      )}
    </div>
  )
}
