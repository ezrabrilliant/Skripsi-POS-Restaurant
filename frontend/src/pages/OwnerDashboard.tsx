// OwnerDashboard REV 2.14 - beranda owner RINGKAS (preview).
// Bukan lagi halaman laporan ber-tab (itu dipindah ke /laporan). Beranda kini
// menampilkan 4 section preview ringkas (Ringkasan / Menu / Tren / Kasir), masing-masing
// dengan tombol "Lihat Semua →" yang deep-link ke /laporan pada tab terkait.
// Tiap section me-render komponen tab yang sama dalam mode `preview` (single source
// of truth, tanpa duplikasi fetch). Periode beranda TETAP "Minggu Ini" (7 hari) -
// filter periode lengkap ada di /laporan.
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { Page } from '@/design-system/primitives'
import type { OwnerReportQuery } from '@/services/dashboardService'
import { last7DaysQuery } from './owner-dashboard/PeriodControl'
import RingkasanTab from './owner-dashboard/RingkasanTab'
import MenuPerformanceTab from './owner-dashboard/MenuPerformanceTab'
import TrendTab from './owner-dashboard/TrendTab'
import StaffTab from './owner-dashboard/StaffTab'

/** Tombol "Lihat Semua →" ke /laporan pada tab terkait. */
function SeeAllLink({ tab }: { tab: 'ringkasan' | 'menu' | 'tren' | 'kasir' }) {
  return (
    <Link
      to={`/laporan?tab=${tab}`}
      className="inline-flex items-center gap-1 text-body-sm font-medium text-primary-700 hover:underline shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 rounded"
    >
      Lihat Semua
      <ArrowRight className="w-4 h-4" />
    </Link>
  )
}

export default function OwnerDashboard() {
  const { user } = useAuthStore()
  // Beranda pakai periode tetap "Minggu Ini" (7 hari terakhir). Lazy init sekali saat mount.
  const period = useMemo<OwnerReportQuery>(() => last7DaysQuery(), [])

  return (
    <Page title={`Halo, ${user?.name ?? ''}`} subtitle="Dashboard Pemilik · ringkasan 7 hari terakhir">
      <div className="space-y-6">
        {/* Ringkasan: KPI + Laba Bersih (bulan ini) */}
        <RingkasanTab period={period} preview headerAction={<SeeAllLink tab="ringkasan" />} />

        {/* Menu: 5 terlaris */}
        <MenuPerformanceTab period={period} preview headerAction={<SeeAllLink tab="menu" />} />

        {/* Tren: grafik omzet ringkas */}
        <TrendTab period={period} preview headerAction={<SeeAllLink tab="tren" />} />

        {/* Kasir: 5 setoran terbaru */}
        <StaffTab period={period} preview headerAction={<SeeAllLink tab="kasir" />} />
      </div>
    </Page>
  )
}
