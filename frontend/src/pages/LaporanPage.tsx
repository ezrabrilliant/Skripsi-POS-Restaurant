// LaporanPage REV 2.14 - halaman laporan owner (eks-OwnerDashboard ber-tab).
// 4 tab: Ringkasan / Menu / Tren / Kasir + PeriodControl (preset + custom range).
// Tab aktif di-sync ke query string ?tab= supaya tombol "Lihat Semua →" di beranda
// bisa deep-link langsung ke tab yang sesuai. Tiap tab lazy-mount + fetch sendiri.
// Owner-only (gate di App.tsx RoleRoute).
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LayoutDashboard, UtensilsCrossed, TrendingUp, Users } from 'lucide-react'
import { Page } from '@/design-system/primitives'
import { formatDate } from '@/lib/utils'
import type { OwnerReportQuery } from '@/services/dashboardService'
import { PeriodControl, last7DaysQuery } from './owner-dashboard/PeriodControl'
import RingkasanTab from './owner-dashboard/RingkasanTab'
import MenuPerformanceTab from './owner-dashboard/MenuPerformanceTab'
import TrendTab from './owner-dashboard/TrendTab'
import StaffTab from './owner-dashboard/StaffTab'

type Section = 'ringkasan' | 'menu' | 'tren' | 'kasir'
const VALID_SECTIONS: Section[] = ['ringkasan', 'menu', 'tren', 'kasir']

/** Label periode dibaca dari query (subtitle). */
function periodLabel(q: OwnerReportQuery): string {
  if (q.period === 'today') return 'Hari Ini'
  if (q.period === 'month') return 'Bulan Ini'
  if (q.period === 'year') return 'Tahun Ini'
  if (q.period === 'custom' && q.fromDate && q.toDate) {
    return q.fromDate === q.toDate ? formatDate(q.fromDate) : `${formatDate(q.fromDate)} – ${formatDate(q.toDate)}`
  }
  return 'Periode'
}

const SECTION_ITEMS = [
  { value: 'ringkasan', label: 'Ringkasan', icon: <LayoutDashboard /> },
  { value: 'menu', label: 'Menu', icon: <UtensilsCrossed /> },
  { value: 'tren', label: 'Tren', icon: <TrendingUp /> },
  { value: 'kasir', label: 'Kasir', icon: <Users /> },
]

export default function LaporanPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab') as Section | null
  const section: Section = tabParam && VALID_SECTIONS.includes(tabParam) ? tabParam : 'ringkasan'
  // Default period = "Minggu Ini" (7 hari terakhir); konsisten dgn chip default 'week'.
  const [period, setPeriod] = useState<OwnerReportQuery>(last7DaysQuery)

  const handleSection = (v: Section) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('tab', v)
        return next
      },
      { replace: true },
    )
  }

  return (
    <Page
      title="Laporan"
      subtitle={`Laporan Pemilik · ${periodLabel(period)}`}
      tabsScrollable
      tabs={{
        value: section,
        onValueChange: (v) => handleSection(v as Section),
        items: SECTION_ITEMS,
      }}
    >
      {/* Period control (berlaku ke semua tab) */}
      <PeriodControl onChange={setPeriod} />

      {/* Lazy: hanya tab aktif yang mount + fetch */}
      {section === 'ringkasan' && <RingkasanTab period={period} />}
      {section === 'menu' && <MenuPerformanceTab period={period} />}
      {section === 'tren' && <TrendTab period={period} />}
      {section === 'kasir' && <StaffTab period={period} />}
    </Page>
  )
}
