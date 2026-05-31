// StaffTab REV 2.13 - tab "Kasir" dashboard owner.
// Performa Kasir (omzet/tx/ATV per pemilik shift) + Riwayat Setoran & Selisih
// (variance counted−system per business day). Fetch GET /dashboard/owner/staff.
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  dashboardService,
  type OwnerReportQuery,
  type CashierPerfRow,
  type SettlementHistoryRow,
} from '@/services/dashboardService'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Badge, Skeleton, DataTable, type DataTableColumn } from '@/design-system/primitives'

function VarianceCell({ v }: { v: number }) {
  if (v === 0) return <Badge tone="success" variant="soft" size="sm">Pas</Badge>
  return (
    <span className={`tabular-nums font-medium ${v < 0 ? 'text-danger-700' : 'text-warning-700'}`}>
      {v > 0 ? '+' : '−'}
      {formatCurrency(Math.abs(v))}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  return status === 'reviewed' ? (
    <Badge tone="success" variant="soft" size="sm">Direview</Badge>
  ) : (
    <Badge tone="neutral" variant="soft" size="sm">Disetor</Badge>
  )
}

export default function StaffTab({ period }: { period: OwnerReportQuery }) {
  const navigate = useNavigate()
  const { data, isLoading, error } = useQuery({
    queryKey: ['ownerStaff', period],
    queryFn: () => dashboardService.getOwnerStaff(period),
  })

  if (error) {
    return (
      <div className="bg-danger-50 border border-danger-200 rounded-xl p-4 text-danger-700 text-body-sm">
        Gagal memuat: {(error as Error).message}
      </div>
    )
  }

  const cashierColumns: DataTableColumn<CashierPerfRow>[] = [
    { key: 'cashierName', header: 'Kasir', cell: (r) => <span className="font-medium text-neutral-900">{r.cashierName}</span> },
    { key: 'shiftCount', header: 'Shift', align: 'right', hideMobile: true, cell: (r) => <span className="tabular-nums">{r.shiftCount}</span> },
    { key: 'txCount', header: 'Transaksi', align: 'right', cell: (r) => <span className="tabular-nums">{r.txCount}</span> },
    { key: 'revenue', header: 'Omzet', align: 'right', cell: (r) => <span className="tabular-nums font-medium">{formatCurrency(r.revenue)}</span> },
    { key: 'atv', header: 'Rata-rata/tx', align: 'right', hideMobile: true, cell: (r) => <span className="tabular-nums text-neutral-600">{formatCurrency(r.atv)}</span> },
  ]

  const settlementColumns: DataTableColumn<SettlementHistoryRow>[] = [
    { key: 'date', header: 'Tanggal', cell: (r) => <span className="text-neutral-900">{formatDate(r.date)}</span> },
    { key: 'cashierName', header: 'Kasir', hideMobile: true, cell: (r) => r.cashierName },
    { key: 'totalCounted', header: 'Setor', align: 'right', cell: (r) => <span className="tabular-nums">{formatCurrency(r.totalCounted)}</span> },
    { key: 'variance', header: 'Selisih', align: 'right', cell: (r) => <VarianceCell v={r.variance} /> },
    { key: 'status', header: 'Status', align: 'right', cell: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <div className="space-y-4">
      {/* Performa Kasir */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-neutral-200/60">
        <h3 className="text-title font-semibold text-neutral-900 mb-1">Performa Kasir</h3>
        <p className="text-caption text-neutral-500 mb-3">Atribusi omzet = kasir pemilik shift</p>
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : (
          <DataTable
            columns={cashierColumns}
            data={data?.cashierPerformance}
            rowKey={(r) => r.cashierId}
            emptyTitle="Belum ada transaksi"
            emptyDescription="Data muncul setelah ada transaksi dibayar di periode ini."
            mobileCard={(r) => (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-neutral-900 truncate">{r.cashierName}</p>
                  <p className="text-caption text-neutral-500">
                    {r.txCount} tx · {r.shiftCount} shift · avg {formatCurrency(r.atv)}
                  </p>
                </div>
                <p className="text-body-sm font-semibold text-neutral-900 tabular-nums shrink-0">{formatCurrency(r.revenue)}</p>
              </div>
            )}
          />
        )}
      </div>

      {/* Riwayat Setoran & Selisih */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-neutral-200/60">
        <h3 className="text-title font-semibold text-neutral-900 mb-1">Riwayat Setoran &amp; Selisih</h3>
        <p className="text-caption text-neutral-500 mb-3">Selisih = uang fisik − sistem (+ lebih / − kurang)</p>
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : (
          <DataTable
            columns={settlementColumns}
            data={data?.settlementHistory}
            rowKey={(r) => r.date}
            onRowClick={() => navigate('/settlement')}
            emptyTitle="Belum ada setoran"
            emptyDescription="Settlement muncul di sini setelah kasir tutup kasir & setor."
            mobileCard={(r) => (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-neutral-900">{formatDate(r.date)}</p>
                  <p className="text-caption text-neutral-500">
                    {r.cashierName} · setor {formatCurrency(r.totalCounted)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <VarianceCell v={r.variance} />
                  <div className="mt-1">
                    <StatusBadge status={r.status} />
                  </div>
                </div>
              </div>
            )}
          />
        )}
      </div>
    </div>
  )
}
