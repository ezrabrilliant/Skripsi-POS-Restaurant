// RingkasanTab REV 2.13 - konten dashboard owner "Ringkasan" (eks-OwnerDashboard).
// KPI Pendapatan/COGS/Laba + Margin% (BARU) + shift panel + chart per metode +
// tabel bank + reminder + quick links. Fetch GET /dashboard/owner (period).
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
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
  type OwnerReport,
  type OwnerReportQuery,
  type ReminderCounts,
} from '@/services/dashboardService'
import { shiftService } from '@/services/shiftService'
import { formatCurrency, formatShiftDate } from '@/lib/utils'
import { Stat, Badge, Skeleton, EmptyState, Button } from '@/design-system/primitives'

export default function RingkasanTab({
  period,
  preview = false,
  headerAction,
}: {
  period: OwnerReportQuery
  preview?: boolean
  headerAction?: React.ReactNode
}) {
  const { data: report, isLoading, error } = useQuery({
    queryKey: ['ownerReport', period],
    queryFn: () => dashboardService.getOwnerReport(period),
  })

  // Preview beranda: Laba Bersih bersifat bulanan (tagihan = beban tetap bulanan),
  // jadi KPI pakai periode terpilih (7 hari) tapi panel Laba Bersih pakai "Bulan Ini".
  const { data: monthReport } = useQuery({
    queryKey: ['ownerReport', { period: 'month' }],
    queryFn: () => dashboardService.getOwnerReport({ period: 'month' }),
    enabled: preview,
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
        {!preview && <Skeleton className="h-64" />}
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

  // ── Mode ringkas (beranda): KPI (periode terpilih) + Estimasi Laba Bersih prorata ──
  // Laba kotor = aktual window. Tagihan = alokasi rata harian dari tagihan bulan ini
  // (billTotal ÷ jumlah hari bulan × jumlah hari window). Ditandai "estimasi".
  if (preview) {
    const windowDays =
      period.fromDate && period.toDate
        ? Math.round(
            (new Date(period.toDate).getTime() - new Date(period.fromDate).getTime()) / 86_400_000,
          ) + 1
        : 7
    const now = new Date()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const monthlyBill = monthReport?.expense.billTotal ?? 0
    const estBills = (monthlyBill / daysInMonth) * windowDays
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-title font-semibold text-neutral-900">Ringkasan</h3>
          {headerAction}
        </div>
        <KpiGrid report={report} marginPct={marginPct} />
        {monthReport && (
          <NetProfitPanel
            label={`${windowDays} hari terakhir`}
            grossProfit={report.profit}
            billAmount={estBills}
            revenue={report.revenue.total}
            billLabel={`− Tagihan (alokasi ${windowDays} hari)`}
            estimate
            footnote={`Estimasi: tagihan bulan ini (${formatCurrency(monthlyBill)}) dibagi rata ${daysInMonth} hari × ${windowDays} hari. Angka aktual ada di Laporan (Bulan Ini).`}
          />
        )}
      </div>
    )
  }

  // Laba Bersih = Laba Kotor − Tagihan. Hanya bermakna pada periode bulan/tahun karena
  // tagihan (beban operasional) bersifat tetap bulanan. (lihat docs/flow/OWNER_REPORT_FLOW.md)
  const showNetProfit = report.period.type === 'month' || report.period.type === 'year'

  return (
    <div className="space-y-4">
      {/* KPI: Pendapatan / COGS / Laba / Margin% */}
      <KpiGrid report={report} marginPct={marginPct} />

      {/* Laba-Rugi bulanan: Laba Bersih = Laba Kotor − Tagihan (hanya periode bulan/tahun) */}
      {showNetProfit && (
        <NetProfitPanel
          label={report.period.label}
          grossProfit={report.profit}
          billAmount={report.expense.billTotal}
          revenue={report.revenue.total}
        />
      )}

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

// KPI cards: Pendapatan / COGS / Laba Kotor / Margin Kotor. Dipakai full + preview.
function KpiGrid({ report, marginPct }: { report: OwnerReport; marginPct: number }) {
  return (
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
        hint={report.expense.pb1BorneTotal > 0 ? `+ PB1 ${formatCurrency(report.expense.pb1BorneTotal)}` : ``}
      />
      <Stat
        label="Laba Kotor"
        value={report.profit}
        format="rupiah"
        icon={<TrendingUp className="w-4 h-4" />}
        hint={report.expense.pb1BorneTotal > 0 ? 'Pendapatan − COGS − PB1' : 'Pendapatan − COGS'}
        className={
          report.profit < 0 ? '!border-danger-200 !bg-danger-50/30' : '!border-success-200 !bg-success-50/30'
        }
      />
      <Stat
        label="Margin Kotor"
        value={marginPct}
        format="percent"
        icon={<Percent className="w-4 h-4" />}
        hint="Laba Kotor ÷ Pendapatan"
      />
    </div>
  )
}

// Panel Laba Bersih = Laba Kotor − Tagihan. Menerima nilai eksplisit supaya bisa
// dipakai dua mode: (1) aktual per periode (laba & tagihan dari report yang sama),
// (2) estimasi prorata beranda (laba kotor aktual window + tagihan dialokasikan
// rata harian dari rata-rata bulanan). `estimate` menandai angka non-aktual.
function NetProfitPanel({
  label,
  grossProfit,
  billAmount,
  revenue,
  billLabel = '− Tagihan (beban operasional)',
  estimate = false,
  footnote,
}: {
  label: string
  grossProfit: number
  billAmount: number
  revenue: number
  billLabel?: string
  estimate?: boolean
  footnote?: string
}) {
  const netProfit = grossProfit - billAmount
  const netMarginPct = revenue > 0 ? (netProfit / revenue) * 100 : 0
  return (
    <div className="bg-white rounded-xl p-4 sm:p-5 border border-neutral-200/60">
      <div className="flex items-center gap-2 mb-3">
        <Receipt className="w-5 h-5 text-neutral-500" />
        <h3 className="text-title font-semibold text-neutral-900">
          {estimate ? 'Estimasi Laba Bersih' : 'Laba Bersih'} · {label}
        </h3>
        {estimate && (
          <Badge tone="warning" variant="soft" size="sm" className="ml-auto">
            ≈ estimasi
          </Badge>
        )}
      </div>
      <dl className="space-y-1.5 text-body-sm tabular-nums">
        <div className="flex justify-between gap-3">
          <dt className="text-neutral-600">Laba Kotor</dt>
          <dd className="font-medium text-neutral-900">{formatCurrency(grossProfit)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-neutral-600">{billLabel}</dt>
          <dd className="font-medium text-warning-700">−{formatCurrency(billAmount)}</dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-neutral-100 pt-2 mt-1">
          <dt className="font-semibold text-neutral-900">= {estimate ? 'Estimasi ' : ''}Laba Bersih</dt>
          <dd className={netProfit < 0 ? 'font-bold text-danger-700' : 'font-bold text-success-700'}>
            {formatCurrency(netProfit)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-caption text-neutral-500">Margin Bersih</dt>
          <dd className="text-caption text-neutral-500">{netMarginPct.toFixed(1)}%</dd>
        </div>
      </dl>
      <p className="mt-3 text-caption text-neutral-500">
        {footnote ??
          'Tagihan (listrik/air/sewa) bersifat bulanan, jadi laba bersih dihitung per bulan/tahun — bukan harian.'}
      </p>
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
  shifts: Array<{
    id: number
    date: string
    type?: 'pagi' | 'malam'
    cashierName?: string
    createdAt: string
    openingCash: number
    isOverdue?: boolean
  }>
}) {
  const navigate = useNavigate()

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
  const overdueShift = shifts.find((s) => s.isOverdue) ?? null
  const needsClose = !!overdueShift || isOverlap

  return (
    <div
      className={
        needsClose
          ? 'bg-warning-50 border border-warning-300 rounded-xl p-3 sm:p-4'
          : 'bg-success-50 border border-success-200 rounded-xl p-3 sm:p-4'
      }
    >
      <div className="flex items-center gap-2 mb-1">
        {needsClose ? (
          <AlertCircle className="w-4 h-4 text-warning-700" />
        ) : (
          <Wallet className="w-4 h-4 text-success-700" />
        )}
        <h3 className="text-body-sm font-semibold text-neutral-900">
          {overdueShift
            ? `Shift ${formatShiftDate(overdueShift.date)} (kasir ${overdueShift.cashierName ?? '-'}) belum ditutup`
            : isOverlap
              ? `Ada ${shifts.length} shift aktif (overlap)`
              : 'Shift aktif hari ini'}
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
      {needsClose && (
        <div className="mt-3 space-y-2">
          <p className="text-caption text-warning-700">
            {overdueShift
              ? 'Shift hari sebelumnya belum disetor. Tutup & setor dulu sebelum mulai hari baru.'
              : 'Input order baru ditolak sampai salah satu shift ditutup.'}
          </p>
          <Button variant="primary" size="sm" onClick={() => navigate('/settlement')}>
            Tutup &amp; Setor Shift
          </Button>
        </div>
      )}
    </div>
  )
}
