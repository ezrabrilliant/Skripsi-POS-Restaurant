// StaffTab REV 2.13 - tab "Kasir" dashboard owner.
// Performa Kasir (omzet/tx/ATV per pemilik shift) + Riwayat Setoran & Selisih
// (variance counted−system per business day). Fetch GET /dashboard/owner/staff.
//
// REV 2.14 (/laporan): tambah aksi "Review" inline untuk setoran berstatus
// submitted (owner-only di /laporan). Settlement.id tidak ada di staff endpoint,
// jadi di-resolve frontend-only via date→id map dari settlementService.list()
// (settlement unik per business day). `preview` = mode ringkas untuk beranda:
// hanya Riwayat Setoran 5 baris terbaru, tanpa Performa Kasir & tanpa tombol.
import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  dashboardService,
  type OwnerReportQuery,
  type CashierPerfRow,
  type SettlementHistoryRow,
} from '@/services/dashboardService'
import { settlementService } from '@/services/settlementService'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Badge, Skeleton, Button, DataTable, type DataTableColumn } from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'
import { useConfirm } from '@/design-system/hooks/useConfirm'

const isoDay = (d: string) => d.slice(0, 10)

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

export default function StaffTab({
  period,
  preview = false,
  headerAction,
}: {
  period: OwnerReportQuery
  preview?: boolean
  headerAction?: React.ReactNode
}) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()

  const { data, isLoading, error } = useQuery({
    queryKey: ['ownerStaff', period],
    queryFn: () => dashboardService.getOwnerStaff(period),
  })

  // Resolusi settlement.id (untuk aksi review). Hanya perlu di mode penuh.
  const { data: allSettlements } = useQuery({
    queryKey: ['settlements', 'all'],
    queryFn: () => settlementService.list({}),
    enabled: !preview,
  })
  const idByDate = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of allSettlements ?? []) m.set(isoDay(s.date), s.id)
    return m
  }, [allSettlements])

  const reviewMutation = useMutation({
    mutationFn: (id: number) => settlementService.review(id),
    onSuccess: () => {
      toast.success('Setoran ditandai sudah direview')
      qc.invalidateQueries({ queryKey: ['ownerStaff'] })
      qc.invalidateQueries({ queryKey: ['settlements'] })
      qc.invalidateQueries({ queryKey: ['settlement'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleReview = async (row: SettlementHistoryRow) => {
    const id = idByDate.get(isoDay(row.date))
    if (!id) {
      toast.error('Gagal menemukan data setoran. Coba muat ulang halaman.')
      return
    }
    const ok = await confirm({
      title: 'Tandai sudah direview?',
      description: `Setoran ${formatDate(row.date)} (${row.cashierName}) akan ditandai sebagai sudah direview.`,
      confirmText: 'Ya, Review',
      cancelText: 'Batal',
    })
    if (ok) reviewMutation.mutate(id)
  }

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

  // Kolom aksi review hanya di mode penuh (/laporan). Disetor → tombol Review;
  // sudah direview → strip kosong.
  if (!preview) {
    settlementColumns.push({
      key: 'action',
      header: '',
      align: 'right',
      cell: (r) =>
        r.status === 'reviewed' ? (
          <span className="text-caption text-neutral-400">—</span>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              void handleReview(r)
            }}
            disabled={reviewMutation.isPending}
          >
            Review
          </Button>
        ),
    })
  }

  const settlementData = preview
    ? (data?.settlementHistory ?? []).slice(0, 5)
    : data?.settlementHistory

  // ── Mode ringkas (beranda): hanya Riwayat Setoran 5 baris terbaru ──
  if (preview) {
    return (
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-neutral-200/60">
        <div className="flex items-center justify-between gap-3 mb-1">
          <h3 className="text-title font-semibold text-neutral-900">Riwayat Setoran &amp; Selisih</h3>
          {headerAction}
        </div>
        <p className="text-caption text-neutral-500 mb-3">5 setoran terbaru · selisih = uang fisik − sistem</p>
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : (
          <DataTable
            columns={settlementColumns}
            data={settlementData}
            rowKey={(r) => r.date}
            emptyTitle="Belum ada setoran"
            emptyDescription="Settlement muncul setelah kasir tutup kasir & setor."
            mobileCard={(r) => <SettlementMobileCard row={r} />}
          />
        )}
      </div>
    )
  }

  // ── Mode penuh (/laporan) ──
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
        <p className="text-caption text-neutral-500 mb-3">
          Selisih = uang fisik − sistem (+ lebih / − kurang) · klik baris untuk detail
        </p>
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : (
          <DataTable
            columns={settlementColumns}
            data={settlementData}
            rowKey={(r) => r.date}
            onRowClick={() => navigate('/settlement')}
            emptyTitle="Belum ada setoran"
            emptyDescription="Settlement muncul di sini setelah kasir tutup kasir & setor."
            mobileCard={(r) => <SettlementMobileCard row={r} onReview={() => void handleReview(r)} reviewing={reviewMutation.isPending} />}
          />
        )}
      </div>
    </div>
  )
}

function SettlementMobileCard({
  row,
  onReview,
  reviewing,
}: {
  row: SettlementHistoryRow
  onReview?: () => void
  reviewing?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="font-medium text-neutral-900">{formatDate(row.date)}</p>
        <p className="text-caption text-neutral-500">
          {row.cashierName} · setor {formatCurrency(row.totalCounted)}
        </p>
      </div>
      <div className="text-right shrink-0 space-y-1">
        <VarianceCell v={row.variance} />
        <div>
          <StatusBadge status={row.status} />
        </div>
        {onReview && row.status !== 'reviewed' && (
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onReview()
            }}
            disabled={reviewing}
          >
            Review
          </Button>
        )}
      </div>
    </div>
  )
}
