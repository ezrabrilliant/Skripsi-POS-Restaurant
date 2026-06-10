// CashierDashboard - REV 2.3 + REV 2.5
// Conditional primary (3 branch):
//   - !myActiveShift && hasOtherActiveSameDay (REV 2.5 multi-cashier):
//     → Card hijau "Bantu Input Order" merujuk ke /pos +
//       Hint kecil "Mau buka shift baru sendiri (tipe lain)?"
//   - !myActiveShift && !hasOtherActiveSameDay:
//     → CTA besar "Buka Kasir" dgn Dialog form (kasir pertama hari ini)
//   - myActiveShift:
//     → 3 action card + ringkasan hari ini 6 buckets + OtherActiveShiftInfo kalau ada
//
// Secondary: reminder stok + secondary action links.

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { shiftService } from '@/services/shiftService'
import { Link, useNavigate } from 'react-router-dom'
import OverdueShiftGate from '@/components/OverdueShiftGate'
import CashierTodayCards from '@/components/CashierTodayCards'
import {
  Wallet,
  LayoutGrid,
  Receipt,
  Calculator,
  AlertCircle,
  Sun,
  Moon,
  Package,
  ArrowRight,
  CheckCircle,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { dashboardService } from '@/services/dashboardService'
import { settlementService } from '@/services/settlementService'
import type { ShiftType, MethodTotalEntry } from '@/types'
import { formatCurrency, formatTime, cn } from '@/lib/utils'
import { Button, Badge, Skeleton, Page } from '@/design-system/primitives'
import OpenShiftDialog from '@/components/OpenShiftDialog'

// REV 2.6: METHOD_LABEL hardcoded dihapus. Label datang dari `entry.methodLabel`
// (sumber: master `payment_methods`). Lihat ActiveShiftPanel.today.byMethod render.

export default function CashierDashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [showOpenModal, setShowOpenModal] = useState(false)

  const { data: dashboard, isLoading, refetch } = useQuery({
    queryKey: ['cashierDashboard'],
    queryFn: dashboardService.getCashierDashboard,
  })

  // REV 2.3 shift-decoupling: cek SEMUA shift aktif system-wide. Filter milik
  // user yang login untuk decide CTA buka shift, dan tampilkan shift kasir
  // lain (overlap) sebagai info kalau ada.
  const { data: activeShifts = [] } = useQuery({
    queryKey: ['shifts', 'active'],
    queryFn: () => shiftService.getActiveShifts(),
  })
  const myActiveShift = activeShifts.find((s) => s.cashierId === user?.id) ?? null
  const otherActiveShifts = activeShifts.filter((s) => s.cashierId !== user?.id)

  // REV 2.15 seal: kalau hari ini sudah disetor & tak ada shift sendiri, jangan
  // tampilkan CTA "Buka Kasir" (backend akan 409). Catatan: pakai tanggal kalender
  // lokal; pada jendela lewat-tengah-malam sebelum changeover businessDate bisa
  // beda - tapi backend tetap otoritas penyegelan.
  const now = new Date()
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const { data: settledList = [] } = useQuery({
    queryKey: ['settlements', 'byDate', todayLocal],
    queryFn: () => settlementService.list({ date: todayLocal }),
    // FIX stale-cache: tanpa ini, buka beranda dalam 5 menit setelah setor (global
    // staleTime 5min) menyajikan settledList basi → tampil CTA "Buka Kasir" yang
    // akan 409. 'always' memaksa refetch tiap mount. Sejalan dengan preview di
    // SettlementPage yang pakai pola sama.
    refetchOnMount: 'always',
  })
  const todaySettled = settledList.length > 0

  // REV 2.12: ada shift overdue → blok dashboard, arahkan tutup shift kemarin.
  const overdueShift = activeShifts.find((s) => s.isOverdue) ?? null
  if (overdueShift) {
    return <OverdueShiftGate shift={overdueShift} onGoToSettlement={() => navigate('/settlement')} />
  }

  return (
    <Page title={`Halo, ${user?.name ?? ''}`} subtitle="Dashboard Kasir">
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

        {/* REV 2.5: kasir kedua login saat ada shift kasir lain aktif → "Bantu Input Order" */}
        {dashboard && !myActiveShift && otherActiveShifts.length > 0 && (
          <>
            <BantuInputOrderCard shifts={otherActiveShifts} />
            <ChangeOrNewShiftHint onOpen={() => setShowOpenModal(true)} />
          </>
        )}

        {/* Kasir pertama hari ini, belum ada shift sama sekali */}
        {dashboard && !myActiveShift && otherActiveShifts.length === 0 && (
          todaySettled ? <SettledTodayCard /> : <NoActiveShiftCTA onOpen={() => setShowOpenModal(true)} />
        )}

        {dashboard && myActiveShift && (
          <>
            <ActiveShiftPanel
              activeShift={{
                id: myActiveShift.id,
                type: myActiveShift.type ?? 'pagi',
                openingCash: myActiveShift.openingCash,
                createdAt: myActiveShift.createdAt,
              }}
              today={dashboard.today}
            />
            {/* REV 2.13: kartu ringan menu terlaris + statistik order hari ini */}
            <CashierTodayCards today={dashboard.today} />
            {otherActiveShifts.length > 0 && (
              <OtherActiveShiftInfo shifts={otherActiveShifts} />
            )}
          </>
        )}

        {dashboard && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ReminderCard reminders={dashboard.reminders} />
            <SecondaryActionsCard />
          </div>
        )}

        {showOpenModal && (
          <OpenShiftDialog
            onClose={() => setShowOpenModal(false)}
            onSuccess={() => {
              setShowOpenModal(false)
              refetch()
            }}
            activeShifts={activeShifts}
          />
        )}
    </Page>
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

function SettledTodayCard() {
  return (
    <div className="bg-white rounded-2xl p-6 sm:p-8 border border-neutral-200/60 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 bg-success-50 rounded-xl flex items-center justify-center flex-shrink-0">
          <CheckCircle className="w-7 h-7 text-success-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-title sm:text-headline font-semibold mb-1 text-neutral-900">
            Hari ini sudah disetor
          </h2>
          <p className="text-neutral-600 text-body-sm sm:text-body">
            Setoran hari ini sudah final dan terkunci. Buka shift lagi untuk hari berikutnya.
          </p>
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
    /** REV 2.6: array dinamis per payment method code (drop MethodTotals 6-key). */
    byMethod: MethodTotalEntry[]
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
        {/* REV 2.6: iterate MethodTotalEntry[] - label + colorHex per row dari
            backend (sumber master payment_methods). Empty state kalau belum ada
            transaksi hari ini (semua method total=0 atau backend kirim []). */}
        {today.byMethod.length === 0 ? (
          <p className="text-body-sm text-neutral-500 pt-3 border-t border-neutral-100">
            Belum ada penjualan hari ini.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-neutral-100">
            {today.byMethod.map((entry) => (
              <div key={entry.paymentMethodCode}>
                <p className="text-caption text-neutral-500 inline-flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: entry.colorHex }}
                    aria-hidden
                  />
                  {entry.methodLabel}
                </p>
                <p className="text-body-sm font-semibold text-neutral-900 tabular-nums">
                  {formatCurrency(entry.total)}
                </p>
              </div>
            ))}
          </div>
        )}
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
  reminders: { portionLowCount: number }
}) {
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
          <span className="text-neutral-700">Stok porsi rendah</span>
          <Link to="/stock" className="font-medium text-primary-700 hover:underline tabular-nums">
            {reminders.portionLowCount}
          </Link>
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
      </div>
    </div>
  )
}

// OpenShiftModal sebelumnya di sini - sekarang di-extract ke @/components/OpenShiftDialog
// supaya POSPage gate (kasir login + 0 active shift) bisa reuse komponen yang sama.

// REV 2.5 multi-cashier sharing: kasir kedua login saat shift tipe sama sudah
// dibuka kasir lain. Card primary hijau yang merujuk ke /pos - BUKAN CTA
// "Belum buka kasir" yang misleading (karena kasir kedua tidak perlu buka shift
// duplikat per backend constraint REV 2.5).
function BantuInputOrderCard({
  shifts,
}: {
  shifts: Array<{ id: number; type?: ShiftType; cashierName?: string; createdAt: string }>
}) {
  const primaryShift = shifts[0]
  return (
    <Link
      to="/pos"
      className="block bg-gradient-to-br from-success-600 to-success-700 rounded-2xl p-6 sm:p-8 text-white shadow-md hover:shadow-lg transition-shadow"
    >
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
          <Receipt className="w-7 h-7" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-title sm:text-headline font-semibold mb-1">
            Bantu Input Order
          </h2>
          <p className="text-success-50/90 text-body-sm sm:text-body mb-3">
            Shift{' '}
            {primaryShift?.type === 'pagi' ? 'pagi' : primaryShift?.type === 'malam' ? 'malam' : ''}{' '}
            sudah dibuka oleh <strong>{primaryShift?.cashierName ?? 'kasir lain'}</strong>
            {primaryShift?.createdAt && <> sejak {formatTime(primaryShift.createdAt)}</>}.
            Anda bisa langsung input pesanan customer kalau ada - tidak perlu buka shift baru.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white text-success-700 rounded-md font-medium text-body-sm hover:bg-success-50 transition-colors">
            Buka Halaman POS
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </Link>
  )
}

// REV 2.5: hint kecil di bawah BantuInputOrderCard supaya kasir kedua tetap punya
// jalur buka shift TIPE LAIN (mis. pagi sudah Bryant → Jason buka malam karena
// memang giliran malam Jason). OpenShiftDialog akan grayed out tipe yang aktif.
function ChangeOrNewShiftHint({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="bg-white rounded-xl p-3 sm:p-4 border border-neutral-200/60 flex items-center justify-between gap-3">
      <div className="text-body-sm text-neutral-600 min-w-0">
        Mau buka shift baru sendiri (tipe lain)?
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="text-body-sm font-medium text-primary-700 hover:underline shrink-0"
      >
        Buka Kasir
      </button>
    </div>
  )
}

// REV 2.3 shift-decoupling: tampilkan info shift kasir LAIN yang aktif.
// Sekarang (REV 2.5) cuma dirender kalau kasir login PUNYA shift sendiri + ada
// shift kasir lain juga aktif (kasus pagi Bryant + malam Jason simultan).
function OtherActiveShiftInfo({
  shifts,
}: {
  shifts: Array<{ id: number; type?: ShiftType; cashierName?: string; createdAt: string }>
}) {
  return (
    <div className="bg-info-50 border border-info-200 rounded-xl p-3 sm:p-4 flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-info-700 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-body-sm font-semibold text-info-800 mb-0.5">
          Shift kasir lain aktif
        </p>
        <ul className="text-caption text-info-700 space-y-0.5">
          {shifts.map((s) => (
            <li key={s.id}>
              {s.cashierName ?? '-'} · {s.type ?? '-'} · sejak {formatTime(s.createdAt)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
