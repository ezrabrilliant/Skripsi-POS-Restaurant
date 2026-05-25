// CashierDashboard - REV 2.3
// Conditional primary:
//   - Belum buka shift → CTA besar "Buka Kasir" dgn Dialog form
//   - Shift aktif → 3 action card + ringkasan hari ini 6 buckets
// Secondary: reminder stok + secondary action links.

import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Wallet,
  LayoutGrid,
  Receipt,
  Calculator,
  AlertCircle,
  Sun,
  Moon,
  Package,
  ShoppingCart,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { dashboardService, type MethodTotals } from '@/services/dashboardService'
import { shiftService, type OpenShiftPayload } from '@/services/shiftService'
import type { ShiftType } from '@/types'
import { formatCurrency, formatTime, cn } from '@/lib/utils'
import { Dialog, Button, Input, Badge, Skeleton } from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'

const METHOD_LABEL: Record<string, string> = {
  cash: 'Tunai',
  edc: 'EDC',
  qris: 'QRIS',
  gojek: 'Gojek',
  grab: 'Grab',
  transfer: 'Transfer',
}

export default function CashierDashboard() {
  const { user } = useAuthStore()
  const [showOpenModal, setShowOpenModal] = useState(false)

  const { data: dashboard, isLoading, refetch } = useQuery({
    queryKey: ['cashierDashboard'],
    queryFn: dashboardService.getCashierDashboard,
  })

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 pt-safe">
        {/* Header */}
        <header>
          <h1 className="text-headline font-semibold text-neutral-900">Halo, {user?.name}</h1>
          <p className="text-body-sm text-neutral-600">Dashboard Kasir</p>
        </header>

        {isLoading && (
          <>
            <Skeleton className="h-32" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
            </div>
          </>
        )}

        {dashboard && !dashboard.activeShift && (
          <NoActiveShiftCTA onOpen={() => setShowOpenModal(true)} />
        )}

        {dashboard && dashboard.activeShift && (
          <ActiveShiftPanel
            activeShift={dashboard.activeShift}
            today={dashboard.today}
          />
        )}

        {dashboard && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-safe">
            <ReminderCard reminders={dashboard.reminders} />
            <SecondaryActionsCard />
          </div>
        )}

        {showOpenModal && (
          <OpenShiftModal
            onClose={() => setShowOpenModal(false)}
            onSuccess={() => {
              setShowOpenModal(false)
              refetch()
            }}
          />
        )}
      </div>
    </div>
  )
}

function NoActiveShiftCTA({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl p-6 sm:p-8 text-white shadow-md">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
          <Wallet className="w-7 h-7" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-title sm:text-headline font-semibold mb-1">Belum buka kasir</h2>
          <p className="text-primary-50/90 text-body-sm sm:text-body mb-4">
            Buka kasir dengan modal awal sebelum mulai menerima transaksi hari ini.
          </p>
          <Button
            variant="secondary"
            size="md"
            onClick={onOpen}
            className="!bg-white !text-primary-700 hover:!bg-primary-50"
          >
            Buka Kasir Sekarang
          </Button>
        </div>
      </div>
    </div>
  )
}

function ActiveShiftPanel({
  activeShift,
  today,
}: {
  activeShift: { id: number; type: ShiftType; openingCash: number; createdAt: string }
  today: {
    revenue: number
    transactionCount: number
    byMethod: MethodTotals
    openTransactionCount: number
  }
}) {
  const ShiftIcon = activeShift.type === 'pagi' ? Sun : Moon
  return (
    <>
      {/* Active shift banner */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border-l-4 border-success-500 border-y border-r border-neutral-200/60">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-10 h-10 bg-success-50 text-success-600 rounded-lg flex items-center justify-center shrink-0">
            <ShiftIcon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-caption text-neutral-500">Shift aktif</p>
            <p className="text-body font-semibold text-neutral-900 truncate">
              Shift {activeShift.type === 'pagi' ? 'Pagi' : 'Malam'} · dibuka {formatTime(activeShift.createdAt)}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-caption text-neutral-500">Modal awal</p>
            <p className="text-body font-semibold text-neutral-900 tabular-nums">
              {formatCurrency(activeShift.openingCash)}
            </p>
          </div>
        </div>
      </div>

      {/* 3 primary action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ActionCard
          icon={LayoutGrid}
          to="/pos"
          title="Input Order Baru"
          subtitle="Mulai transaksi"
          color="primary"
        />
        <ActionCard
          icon={Receipt}
          to="/history?status=open"
          title="Transaksi Open"
          subtitle={`${today.openTransactionCount} belum dibayar`}
          color="warning"
          badge={today.openTransactionCount > 0 ? today.openTransactionCount : undefined}
        />
        <ActionCard
          icon={Calculator}
          to="/settlement"
          title="Tutup Kasir"
          subtitle="Settlement shift"
          color="neutral"
        />
      </div>

      {/* Today summary */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-neutral-200/60">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-title font-semibold text-neutral-900">Ringkasan Hari Ini</h3>
          <Badge tone="neutral" size="sm">
            {today.transactionCount} transaksi dibayar
          </Badge>
        </div>
        <div className="mb-4">
          <p className="text-caption text-neutral-500">Total pendapatan</p>
          <p className="text-display text-neutral-900 tabular-nums">{formatCurrency(today.revenue)}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-neutral-100">
          {(Object.keys(today.byMethod) as Array<keyof typeof today.byMethod>).map((m) => (
            <div key={m}>
              <p className="text-caption text-neutral-500">{METHOD_LABEL[m as string]}</p>
              <p className="text-body-sm font-semibold text-neutral-900 tabular-nums">
                {formatCurrency(today.byMethod[m])}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function ActionCard({
  icon: Icon,
  to,
  title,
  subtitle,
  color,
  badge,
}: {
  icon: typeof Wallet
  to: string
  title: string
  subtitle: string
  color: 'primary' | 'warning' | 'neutral'
  badge?: number
}) {
  const colorClasses: Record<string, string> = {
    primary: 'bg-primary-50 text-primary-700',
    warning: 'bg-warning-100 text-warning-700',
    neutral: 'bg-neutral-100 text-neutral-700',
  }
  return (
    <Link
      to={to}
      className="group bg-white rounded-xl p-4 hover:shadow-sm hover:border-primary-300 transition-all relative block border border-neutral-200/60 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
    >
      {badge !== undefined && (
        <Badge
          tone="warning"
          variant="solid"
          size="sm"
          className="absolute top-3 right-3"
        >
          {badge > 9 ? '9+' : badge}
        </Badge>
      )}
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center mb-2', colorClasses[color])}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-body font-semibold text-neutral-900">{title}</p>
      <p className="text-caption text-neutral-500 mt-0.5">{subtitle}</p>
    </Link>
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
          <span className="text-neutral-700">Stok porsi rendah</span>
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

function SecondaryActionsCard() {
  return (
    <div className="bg-white rounded-xl p-4 sm:p-5 border border-neutral-200/60">
      <h3 className="text-title font-semibold text-neutral-900 mb-3">Aksi Lain</h3>
      <div className="space-y-1">
        <Link
          to="/stock"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-neutral-50 active:bg-neutral-100 transition-colors min-h-[44px]"
        >
          <Package className="w-4 h-4 text-neutral-500" />
          <span className="text-body-sm text-neutral-800">Cek Stok / Opname</span>
        </Link>
        <Link
          to="/purchases"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-neutral-50 active:bg-neutral-100 transition-colors min-h-[44px]"
        >
          <ShoppingCart className="w-4 h-4 text-neutral-500" />
          <span className="text-body-sm text-neutral-800">Catat Pembelian Pasar</span>
        </Link>
      </div>
    </div>
  )
}

function OpenShiftModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const toast = useToast()
  const [type, setType] = useState<ShiftType>('pagi')
  const [openingCash, setOpeningCash] = useState('')
  const qc = useQueryClient()

  const openMutation = useMutation({
    mutationFn: (payload: OpenShiftPayload) => shiftService.openShift(payload),
    onSuccess: () => {
      toast.success('Shift berhasil dibuka')
      qc.invalidateQueries({ queryKey: ['cashierDashboard'] })
      onSuccess()
    },
    onError: (err: Error) => toast.error(err.message || 'Gagal membuka shift'),
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const amount = Number(openingCash)
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error('Modal awal tidak valid')
      return
    }
    openMutation.mutate({ type, openingCash: amount })
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Buka Kasir"
      description="Pilih shift dan input modal awal cash."
      size="sm"
      preventOutsideClose={openMutation.isPending}
      footer={
        <Button
          type="submit"
          form="open-shift-form"
          variant="primary"
          size="md"
          fullWidth
          loading={openMutation.isPending}
        >
          Buka Kasir
        </Button>
      }
    >
      <form id="open-shift-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="text-label text-neutral-700 mb-2">Tipe Shift</p>
          <div className="grid grid-cols-2 gap-2">
            {(['pagi', 'malam'] as const).map((t) => {
              const Icon = t === 'pagi' ? Sun : Moon
              const active = type === t
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  aria-pressed={active}
                  className={cn(
                    'min-h-[52px] flex items-center justify-center gap-2 px-3 rounded-lg border text-body-sm font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
                    active
                      ? 'bg-primary-50 border-primary-500 text-primary-800 ring-1 ring-primary-500/40'
                      : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {t === 'pagi' ? 'Pagi' : 'Malam'}
                </button>
              )
            })}
          </div>
        </div>

        <Input
          label="Modal Awal (Rp)"
          type="number"
          inputMode="numeric"
          value={openingCash}
          onChange={(e) => setOpeningCash(e.target.value)}
          min={0}
          step={1000}
          placeholder="500000"
          autoFocus
          required
          helper="Total uang cash di laci sebelum mulai shift."
        />
      </form>
    </Dialog>
  )
}
