// SettlementPage - REV 2.6 dinamis per payment_method.code (drop 6-bucket hardcoded).
// 4 mode:
//   1. Tidak ada shift active → CTA balik ke /dashboard.
//   2. Shift active belum closed → reminder tutup shift dulu (pakai useMutation).
//   3. Shift closed + belum ada settlement → preview + blind count form dinamis.
//   4. Sudah ada settlement → display detail + button review (owner only).

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Calculator, CheckCircle, AlertCircle, Wallet } from 'lucide-react'
import { shiftService } from '@/services/shiftService'
import { settlementService, type CreateSettlementPayload } from '@/services/settlementService'
import { useAuthStore } from '@/stores/authStore'
import type { SettlementPreview, Settlement } from '@/types'
import { formatCurrency, cn } from '@/lib/utils'
import { Button, Badge, Skeleton, Checkbox } from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'
import { useConfirm } from '@/design-system/hooks/useConfirm'

export default function SettlementPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()

  const { data: shifts = [], isLoading: shiftsLoading } = useQuery({
    queryKey: ['shifts', 'my-recent', user?.id],
    queryFn: () => shiftService.listShifts({ cashierId: user?.id }),
    enabled: !!user,
  })

  const targetShift = shifts.length > 0 ? shifts[0] : null

  const closeShiftMutation = useMutation({
    mutationFn: (id: number) => shiftService.closeShift(id),
    onSuccess: () => {
      toast.success('Shift ditutup')
      qc.invalidateQueries({ queryKey: ['shifts'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleCloseShift = async () => {
    if (!targetShift) return
    const ok = await confirm({
      title: `Tutup shift ${targetShift.type}?`,
      description: 'Setelah ditutup tidak bisa terima transaksi baru. Lanjut ke settlement.',
      confirmText: 'Ya, Tutup',
      tone: 'danger',
    })
    if (!ok) return
    closeShiftMutation.mutate(targetShift.id)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 space-y-3 pt-safe pb-safe">
        <header>
          <h1 className="text-headline font-semibold text-neutral-900">Settlement Shift</h1>
          <p className="text-body-sm text-neutral-600">
            Rekap akhir shift - dinamis per metode pembayaran
          </p>
        </header>

        {shiftsLoading && <Skeleton className="h-48" />}

        {!shiftsLoading && !targetShift && (
          <EmptyStateCard
            icon={Wallet}
            title="Belum ada shift"
            message="Buka kasir dulu di Dashboard sebelum settlement."
            actionLabel="Ke Dashboard"
            onAction={() => navigate('/dashboard')}
          />
        )}

        {!shiftsLoading && targetShift && !targetShift.closedAt && (
          <EmptyStateCard
            icon={AlertCircle}
            tone="warning"
            title={`Shift ${targetShift.type} masih aktif`}
            message="Tutup shift dulu sebelum settlement."
            actionLabel="Tutup Shift"
            onAction={handleCloseShift}
            actionLoading={closeShiftMutation.isPending}
          />
        )}

        {!shiftsLoading && targetShift && targetShift.closedAt && (
          <SettlementFlow shiftId={targetShift.id} />
        )}
      </div>
    </div>
  )
}

function SettlementFlow({ shiftId }: { shiftId: number }) {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const toast = useToast()

  const { data: preview, isLoading } = useQuery({
    queryKey: ['settlements', 'preview', shiftId],
    queryFn: () => settlementService.preview(shiftId),
    // FIX: preview dihitung server-side dari transaksi paid di shift ini, tapi key
    // ['settlements','preview',*] TIDAK pernah di-invalidate oleh pembayaran/void.
    // Tanpa 'always', buka Settlement → ke POS bayar → balik dalam 5 menit menyajikan
    // preview basi (total + variance salah). 'always' memaksa refetch tiap buka halaman.
    refetchOnMount: 'always',
  })

  const { data: existingSettlement } = useQuery({
    queryKey: ['settlement', 'byId', preview?.existingSettlementId],
    queryFn: () => settlementService.byId(preview!.existingSettlementId!),
    enabled: !!preview?.existingSettlementId,
  })

  const reviewMutation = useMutation({
    mutationFn: (id: number) => settlementService.review(id),
    onSuccess: () => {
      toast.success('Settlement di-review')
      qc.invalidateQueries({ queryKey: ['settlement'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading || !preview) {
    return <Skeleton className="h-96" />
  }

  if (existingSettlement) {
    return (
      <SettlementDetailView
        settlement={existingSettlement}
        canReview={user?.role === 'owner' && existingSettlement.status === 'submitted'}
        onReview={() => reviewMutation.mutate(existingSettlement.id)}
        isReviewing={reviewMutation.isPending}
      />
    )
  }

  return <BlindCountForm preview={preview} />
}

function BlindCountForm({ preview }: { preview: SettlementPreview }) {
  const qc = useQueryClient()
  const toast = useToast()
  // REV 2.6: counts dinamis per payment_method.code (drop 6-field hardcoded).
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [countsInitialized, setCountsInitialized] = useState(false)
  const [useSystemAsActual, setUseSystemAsActual] = useState(false)

  // Initialize counts dari methods yang muncul di preview.system (sekali saja).
  useEffect(() => {
    if (!countsInitialized && preview.system.length > 0) {
      const initial: Record<string, number> = {}
      for (const s of preview.system) initial[s.paymentMethodCode] = 0
      setCounts(initial)
      setCountsInitialized(true)
    }
  }, [preview.system, countsInitialized])

  // Auto-isi dari sistem: copy system totals ke counts.
  useEffect(() => {
    if (useSystemAsActual) {
      const next: Record<string, number> = {}
      for (const s of preview.system) next[s.paymentMethodCode] = s.total
      setCounts(next)
    }
  }, [useSystemAsActual, preview.system])

  const submit = useMutation({
    mutationFn: (payload: CreateSettlementPayload) => settlementService.create(payload),
    onSuccess: () => {
      toast.success('Settlement berhasil disubmit')
      qc.invalidateQueries({ queryKey: ['settlements'] })
      qc.invalidateQueries({ queryKey: ['settlement'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleSubmit = () => {
    submit.mutate({
      shiftId: preview.shiftId,
      counts,
    })
  }

  const totalActual = preview.system.reduce(
    (s, m) => s + (counts[m.paymentMethodCode] ?? 0),
    0,
  )
  const totalVariance = totalActual - preview.totalSystem
  const hasAnyCount = preview.system.some((m) => (counts[m.paymentMethodCode] ?? 0) > 0)

  return (
    <div className="space-y-3">
      {/* Shift summary header */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-neutral-200/60">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-10 h-10 bg-primary-50 text-primary-700 rounded-lg flex items-center justify-center">
            <Calculator className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-title font-semibold text-neutral-900">
              Shift {preview.shiftType}
            </h2>
            <p className="text-caption text-neutral-500">
              {preview.date} · {preview.cashierName}
            </p>
          </div>
        </div>
        <div className="bg-primary-50/50 border border-primary-100 rounded-lg p-3">
          <p className="text-caption text-neutral-600">Total sistem</p>
          <p className="text-headline font-semibold text-primary-800 tabular-nums">
            {formatCurrency(preview.totalSystem)}
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-neutral-200/60 space-y-3">
        {preview.system.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-body-sm text-neutral-600">
              Belum ada transaksi paid di shift ini. Settlement tetap bisa disubmit
              dengan total Rp 0.
            </p>
          </div>
        ) : (
          <>
            <div className="bg-neutral-50 p-3 rounded-lg">
              <Checkbox
                label={<span className="font-medium">Auto-isi dari sistem</span>}
                description="Skip blind count - gunakan kalau yakin tidak ada selisih."
                checked={useSystemAsActual}
                onCheckedChange={setUseSystemAsActual}
              />
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-label text-neutral-500 px-1">
                <span className="col-span-4">Metode</span>
                <span className="col-span-4 text-right">Sistem</span>
                <span className="col-span-4 text-right">Fisik</span>
              </div>
              {preview.system.map((s) => {
                const sysVal = s.total
                const actVal = counts[s.paymentMethodCode] ?? 0
                const diff = actVal - sysVal
                return (
                  <div
                    key={s.paymentMethodCode}
                    className="grid grid-cols-12 gap-2 items-center py-1.5 border-b border-neutral-100 last:border-0"
                  >
                    <span className="col-span-4 text-body-sm font-medium text-neutral-800 flex items-center gap-2 min-w-0">
                      <span
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: s.colorHex }}
                        aria-hidden="true"
                      />
                      <span className="truncate">{s.methodLabel}</span>
                    </span>
                    <span className="col-span-4 text-right text-body-sm text-neutral-600 tabular-nums">
                      {formatCurrency(sysVal)}
                    </span>
                    <input
                      type="number"
                      value={counts[s.paymentMethodCode] || ''}
                      onChange={(e) =>
                        setCounts((c) => ({
                          ...c,
                          [s.paymentMethodCode]: Number(e.target.value) || 0,
                        }))
                      }
                      min={0}
                      step={1000}
                      disabled={useSystemAsActual}
                      placeholder="0"
                      className={cn(
                        'col-span-4 px-2 py-2 border border-neutral-300 rounded-md text-right text-body-sm tabular-nums',
                        'focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500',
                        'disabled:bg-neutral-50 disabled:cursor-not-allowed',
                        diff !== 0 &&
                          actVal > 0 &&
                          (diff > 0 ? 'border-primary-300' : 'border-danger-300'),
                      )}
                    />
                  </div>
                )
              })}
            </div>

            {/* Live variance preview */}
            {hasAnyCount && (
              <div
                className={cn(
                  'mt-3 p-3 rounded-lg flex items-center justify-between',
                  totalVariance === 0 && 'bg-success-50 text-success-800',
                  totalVariance > 0 && 'bg-primary-50 text-primary-800',
                  totalVariance < 0 && 'bg-danger-50 text-danger-800',
                )}
              >
                <span className="text-body-sm font-medium">Selisih total</span>
                <span className="text-body font-semibold tabular-nums">
                  {totalVariance >= 0 ? '+' : ''}
                  {formatCurrency(totalVariance)}
                </span>
              </div>
            )}

            {preview.bankBreakdown.length > 0 && (
              <div className="mt-3 pt-3 border-t border-neutral-100">
                <p className="text-label text-neutral-600 mb-2">Breakdown per Bank</p>
                <ul className="space-y-1">
                  {preview.bankBreakdown.map((b, i) => (
                    <li
                      key={i}
                      className="flex justify-between text-body-sm text-neutral-700 tabular-nums"
                    >
                      <span>
                        <Badge tone="info" variant="soft" size="sm">
                          {b.method.toUpperCase()}
                        </Badge>
                        <span className="ml-2 font-medium">{b.bank}</span>
                      </span>
                      <span>{formatCurrency(b.total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleSubmit}
          loading={submit.isPending}
        >
          Submit Settlement
        </Button>
      </div>
    </div>
  )
}

function SettlementDetailView({
  settlement,
  canReview,
  onReview,
  isReviewing,
}: {
  settlement: Settlement
  canReview: boolean
  onReview: () => void
  isReviewing: boolean
}) {
  const totalDiff = settlement.totalVariance
  const isReviewed = settlement.status === 'reviewed'

  return (
    <div className="bg-white rounded-xl p-4 sm:p-5 border border-neutral-200/60 space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle
          className={cn('w-5 h-5', isReviewed ? 'text-success-600' : 'text-warning-600')}
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-title font-semibold text-neutral-900">
            Settlement #{settlement.id}
          </h2>
          <p className="text-caption text-neutral-500">
            {settlement.date} · {settlement.cashierName}
          </p>
        </div>
        <Badge tone={isReviewed ? 'success' : 'warning'} size="md">
          {settlement.status}
        </Badge>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-body-sm tabular-nums">
          <thead>
            <tr className="text-label text-neutral-500 border-b border-neutral-200">
              <th className="text-left py-2">Metode</th>
              <th className="text-right py-2">Sistem</th>
              <th className="text-right py-2">Fisik</th>
              <th className="text-right py-2">Selisih</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {settlement.methodCounts.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-neutral-500">
                  Tidak ada metode pembayaran tercatat.
                </td>
              </tr>
            )}
            {settlement.methodCounts.map((mc) => {
              const sys = mc.system
              const act = mc.counted
              const diff = mc.variance
              return (
                <tr key={mc.paymentMethodCode}>
                  <td className="py-2 font-medium text-neutral-800">
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: mc.colorHex }}
                        aria-hidden="true"
                      />
                      <span className="truncate">{mc.methodLabel}</span>
                    </span>
                  </td>
                  <td className="py-2 text-right text-neutral-600">{formatCurrency(sys)}</td>
                  <td className="py-2 text-right text-neutral-900 font-medium">
                    {formatCurrency(act)}
                  </td>
                  <td
                    className={cn(
                      'py-2 text-right font-medium',
                      diff === 0 && 'text-neutral-400',
                      diff > 0 && 'text-primary-700',
                      diff < 0 && 'text-danger-700',
                    )}
                  >
                    {diff > 0 ? '+' : ''}
                    {formatCurrency(diff)}
                  </td>
                </tr>
              )
            })}
            <tr className="bg-neutral-50 font-semibold border-t-2 border-neutral-300">
              <td className="py-2.5 text-neutral-900">TOTAL</td>
              <td className="py-2.5 text-right text-neutral-700">
                {formatCurrency(settlement.totalSystem)}
              </td>
              <td className="py-2.5 text-right text-neutral-900">
                {formatCurrency(settlement.totalCounted)}
              </td>
              <td
                className={cn(
                  'py-2.5 text-right',
                  totalDiff === 0 && 'text-success-700',
                  totalDiff > 0 && 'text-primary-700',
                  totalDiff < 0 && 'text-danger-700',
                )}
              >
                {totalDiff > 0 ? '+' : ''}
                {formatCurrency(totalDiff)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {settlement.bankBreakdown.length > 0 && (
        <div>
          <p className="text-label text-neutral-600 mb-2">Breakdown per Bank</p>
          <ul className="divide-y divide-neutral-100">
            {settlement.bankBreakdown.map((b, i) => (
              <li
                key={i}
                className="flex justify-between text-body-sm text-neutral-700 py-2 tabular-nums"
              >
                <span>
                  <Badge tone="info" variant="soft" size="sm">
                    {b.method.toUpperCase()}
                  </Badge>
                  <span className="ml-2 font-medium text-neutral-900">{b.bank}</span>
                </span>
                <span>{formatCurrency(b.total)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {settlement.reviewerName && (
        <p className="text-caption text-neutral-500">
          Reviewed oleh {settlement.reviewerName} pada {settlement.reviewedAt}
        </p>
      )}

      {canReview && (
        <Button
          variant="primary"
          size="md"
          fullWidth
          onClick={onReview}
          loading={isReviewing}
          className="!bg-success-600 hover:!bg-success-700"
        >
          Tandai Sudah Direview
        </Button>
      )}
    </div>
  )
}

function EmptyStateCard({
  icon: Icon,
  title,
  message,
  actionLabel,
  onAction,
  actionLoading,
  tone = 'warning',
}: {
  icon: typeof Wallet
  title: string
  message: string
  actionLabel: string
  onAction: () => void
  actionLoading?: boolean
  tone?: 'warning' | 'neutral'
}) {
  return (
    <div className="bg-white rounded-2xl p-6 sm:p-8 text-center border border-neutral-200/60">
      <div
        className={cn(
          'w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center',
          tone === 'warning' ? 'bg-warning-100 text-warning-700' : 'bg-neutral-100 text-neutral-600'
        )}
      >
        <Icon className="w-7 h-7" />
      </div>
      <h2 className="text-title font-semibold text-neutral-900 mb-1">{title}</h2>
      <p className="text-body-sm text-neutral-600 mb-4">{message}</p>
      <Button variant="primary" size="md" onClick={onAction} loading={actionLoading}>
        {actionLabel}
      </Button>
    </div>
  )
}
