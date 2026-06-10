// TrendTab REV 2.13 - tab "Tren" dashboard owner.
// Tren Omzet (area chart, bucket adaptif jam/hari/bulan) + Jam Ramai (bar chart,
// distribusi per jam-of-day; disembunyikan saat granularity='hour' = redundan).
// Fetch GET /dashboard/owner/trend.
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  dashboardService,
  type OwnerReportQuery,
  type TrendGranularity,
} from '@/services/dashboardService'
import { formatCurrency } from '@/lib/utils'
import { Skeleton, EmptyState } from '@/design-system/primitives'

function trendLabel(bucket: string, gran: TrendGranularity): string {
  if (gran === 'hour') return `${bucket}:00`
  if (gran === 'month') {
    const [y, m] = bucket.split('-').map(Number)
    return new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(new Date(y!, m! - 1, 1))
  }
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(`${bucket}T00:00:00`))
}

const axisTick = { fontSize: 11, fill: '#5a655e' }
const tooltipStyle = { borderRadius: '8px', border: '1px solid #d1d8d3', fontSize: '12px' }
const compactRupiah = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}jt` : v >= 1000 ? `${Math.round(v / 1000)}rb` : String(v)

export default function TrendTab({
  period,
  preview = false,
  headerAction,
}: {
  period: OwnerReportQuery
  preview?: boolean
  headerAction?: React.ReactNode
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['ownerTrend', period],
    queryFn: () => dashboardService.getOwnerTrend(period),
  })

  if (error) {
    return (
      <div className="bg-danger-50 border border-danger-200 rounded-xl p-4 text-danger-700 text-body-sm">
        Gagal memuat: {(error as Error).message}
      </div>
    )
  }

  const gran = data?.granularity ?? 'day'
  const trendData = (data?.revenueTrend ?? []).map((b) => ({
    label: trendLabel(b.bucket, gran),
    omzet: b.revenue,
    tx: b.txCount,
  }))
  const peakData = (data?.peakHours ?? []).map((h) => ({ label: `${h.hour}:00`, omzet: h.revenue, tx: h.txCount }))
  // Jam Ramai disembunyikan saat granularity='hour' (redundan) atau di preview beranda.
  const showPeak = gran !== 'hour' && !preview

  return (
    <div className="space-y-4">
      {/* Tren Omzet */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-neutral-200/60">
        <div className="flex items-center justify-between gap-3 mb-1">
          <h3 className="text-title font-semibold text-neutral-900">Tren Omzet</h3>
          {headerAction}
        </div>
        <p className="text-caption text-neutral-500 mb-3">
          Per {gran === 'hour' ? 'jam' : gran === 'month' ? 'bulan' : 'hari'}
        </p>
        {isLoading ? (
          <Skeleton className={preview ? 'h-48' : 'h-64'} />
        ) : trendData.length === 0 ? (
          <EmptyState title="Belum ada transaksi" description="Data muncul setelah ada transaksi dibayar." compact />
        ) : (
          <div className={preview ? 'h-48' : 'h-64'}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ left: 0, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2f7d5b" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#2f7d5b" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1ef" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} width={44} tickFormatter={compactRupiah} />
                <ChartTooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: '#1a201c', fontWeight: 600 }}
                  formatter={(v) => [formatCurrency(Number(v) || 0), 'Omzet']}
                />
                <Area type="monotone" dataKey="omzet" stroke="#2f7d5b" strokeWidth={2} fill="url(#trendFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Jam Ramai */}
      {showPeak && (
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-neutral-200/60">
          <h3 className="text-title font-semibold text-neutral-900 mb-1">Jam Ramai</h3>
          <p className="text-caption text-neutral-500 mb-3">Distribusi omzet per jam (akumulasi periode)</p>
          {isLoading ? (
            <Skeleton className="h-56" />
          ) : peakData.length === 0 ? (
            <EmptyState title="Belum ada data jam" compact />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={peakData} margin={{ left: 0, right: 8, top: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef1ef" vertical={false} />
                  <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} width={44} tickFormatter={compactRupiah} />
                  <ChartTooltip
                    cursor={{ fill: '#f4f4f3' }}
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: '#1a201c', fontWeight: 600 }}
                    formatter={(v) => [formatCurrency(Number(v) || 0), 'Omzet']}
                  />
                  <Bar dataKey="omzet" fill="#c2761b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
