// MenuPerformanceTab REV 2.13 - tab "Menu" dashboard owner.
// Menu Terlaris (tabel: qty/omzet/laba/margin) + Penjualan per Kategori (bar + tabel).
// Owner-only (laba/margin dari unitCost). Fetch GET /dashboard/owner/menu-performance.
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip as ChartTooltip, ResponsiveContainer, Cell } from 'recharts'
import {
  dashboardService,
  type OwnerReportQuery,
  type MenuPerfRow,
  type CategoryPerfRow,
} from '@/services/dashboardService'
import { formatCurrency } from '@/lib/utils'
import { Badge, Skeleton, EmptyState, DataTable, type DataTableColumn } from '@/design-system/primitives'

// Palet hex untuk bar chart kategori (recharts butuh fill hex, bukan class Tailwind).
const CAT_COLORS = ['#2f7d5b', '#c2761b', '#2563eb', '#7c3aed', '#dc2626', '#0891b2', '#65a30d', '#db2777']

const pctText = (n: number) => `${n.toFixed(0)}%`
const profitClass = (n: number) => (n < 0 ? 'text-danger-700' : 'text-success-700')

export default function MenuPerformanceTab({ period }: { period: OwnerReportQuery }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['ownerMenuPerformance', period],
    queryFn: () => dashboardService.getOwnerMenuPerformance(period),
  })

  if (error) {
    return (
      <div className="bg-danger-50 border border-danger-200 rounded-xl p-4 text-danger-700 text-body-sm">
        Gagal memuat: {(error as Error).message}
      </div>
    )
  }

  const catChart = (data?.byCategory ?? []).map((c) => ({ category: c.category, omzet: c.revenue }))

  const menuColumns: DataTableColumn<MenuPerfRow>[] = [
    { key: 'rank', header: '#', className: 'w-8', cell: (_r, i) => <span className="text-neutral-400 tabular-nums">{i + 1}</span> },
    { key: 'name', header: 'Menu', cell: (r) => <span className="font-medium text-neutral-900">{r.name}</span> },
    {
      key: 'category',
      header: 'Kategori',
      hideMobile: true,
      cell: (r) => (
        <Badge tone="neutral" variant="soft" size="sm">
          {r.category}
        </Badge>
      ),
    },
    { key: 'qtySold', header: 'Terjual', align: 'right', cell: (r) => <span className="tabular-nums">{r.qtySold}</span> },
    { key: 'revenue', header: 'Omzet', align: 'right', cell: (r) => <span className="tabular-nums">{formatCurrency(r.revenue)}</span> },
    { key: 'profit', header: 'Laba', align: 'right', cell: (r) => <span className={`tabular-nums font-medium ${profitClass(r.profit)}`}>{formatCurrency(r.profit)}</span> },
    { key: 'marginPct', header: 'Margin', align: 'right', cell: (r) => <span className="tabular-nums text-neutral-600">{pctText(r.marginPct)}</span> },
  ]

  const catColumns: DataTableColumn<CategoryPerfRow>[] = [
    { key: 'category', header: 'Kategori', cell: (r) => <span className="font-medium text-neutral-900">{r.category}</span> },
    { key: 'qtySold', header: 'Terjual', align: 'right', cell: (r) => <span className="tabular-nums">{r.qtySold}</span> },
    { key: 'revenue', header: 'Omzet', align: 'right', cell: (r) => <span className="tabular-nums">{formatCurrency(r.revenue)}</span> },
    { key: 'profit', header: 'Laba', align: 'right', cell: (r) => <span className={`tabular-nums font-medium ${profitClass(r.profit)}`}>{formatCurrency(r.profit)}</span> },
  ]

  return (
    <div className="space-y-4">
      {/* Menu Terlaris */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-neutral-200/60">
        <h3 className="text-title font-semibold text-neutral-900 mb-3">Menu Terlaris</h3>
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <DataTable
            columns={menuColumns}
            data={data?.topMenus}
            rowKey={(r) => r.menuId}
            emptyTitle="Belum ada penjualan menu"
            emptyDescription="Data muncul setelah ada transaksi dibayar di periode ini."
            mobileCard={(r, i) => (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-neutral-900 truncate">
                    <span className="text-neutral-400 mr-1">{i + 1}.</span>
                    {r.name}
                  </p>
                  <p className="text-caption text-neutral-500">
                    {r.qtySold} terjual · {r.category} · margin {pctText(r.marginPct)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-body-sm font-semibold text-neutral-900 tabular-nums">{formatCurrency(r.revenue)}</p>
                  <p className={`text-caption tabular-nums ${profitClass(r.profit)}`}>laba {formatCurrency(r.profit)}</p>
                </div>
              </div>
            )}
          />
        )}
      </div>

      {/* Penjualan per Kategori */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-neutral-200/60">
        <h3 className="text-title font-semibold text-neutral-900 mb-3">Penjualan per Kategori</h3>
        {isLoading ? (
          <Skeleton className="h-56" />
        ) : catChart.length === 0 ? (
          <EmptyState title="Belum ada data kategori" compact />
        ) : (
          <div className="space-y-4">
            <div style={{ height: Math.max(140, catChart.length * 40) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={catChart} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <XAxis type="number" hide domain={[0, 'dataMax']} />
                  <YAxis
                    type="category"
                    dataKey="category"
                    width={90}
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
                  <Bar dataKey="omzet" radius={[0, 6, 6, 0]} barSize={20}>
                    {catChart.map((_d, i) => (
                      <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <DataTable columns={catColumns} data={data?.byCategory} rowKey={(r) => r.category} />
          </div>
        )}
      </div>
    </div>
  )
}
