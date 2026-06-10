// OwnerDashboard - REV 2.13 shell ber-tab.
// Header (greeting + label periode) + PeriodControl (preset + custom range) +
// section Tabs (Ringkasan / Menu / Tren / Kasir). Tiap section komponennya
// dirender kondisional → hanya tab aktif yang mount + fetch endpoint-nya sendiri
// (lazy). Konten lama ada di RingkasanTab; 3 tab baru = analitik REV 2.13.
import { useState } from 'react'
import { LayoutDashboard, UtensilsCrossed, TrendingUp, Users } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { Page } from '@/design-system/primitives'
import { formatDate } from '@/lib/utils'
import type { OwnerReportQuery } from '@/services/dashboardService'
import { PeriodControl, last7DaysQuery } from './owner-dashboard/PeriodControl'
import RingkasanTab from './owner-dashboard/RingkasanTab'
import MenuPerformanceTab from './owner-dashboard/MenuPerformanceTab'
import TrendTab from './owner-dashboard/TrendTab'
import StaffTab from './owner-dashboard/StaffTab'

type Section = 'ringkasan' | 'menu' | 'tren' | 'kasir'

/** Label periode dibaca dari query (header). */
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

export default function OwnerDashboard() {
  const { user } = useAuthStore()
  const [section, setSection] = useState<Section>('ringkasan')
  // REV 2.x: default period = "Minggu Ini" (7 hari terakhir). Lazy init supaya
  // dihitung sekali saat mount; konsisten dgn chip default 'week' di PeriodControl.
  const [period, setPeriod] = useState<OwnerReportQuery>(last7DaysQuery)

  return (
    <Page
      title={`Halo, ${user?.name ?? ''}`}
      subtitle={`Dashboard Pemilik · ${periodLabel(period)}`}
      tabsScrollable
      tabs={{
        value: section,
        onValueChange: (v) => setSection(v as Section),
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
