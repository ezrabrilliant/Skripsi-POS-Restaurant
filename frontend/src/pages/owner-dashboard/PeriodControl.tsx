// PeriodControl REV 2.13 - pemilih periode dashboard owner.
// Preset cepat (Hari ini / Kemarin / Minggu ini / Bulan / Tahun) + rentang Custom.
// Emit OwnerReportQuery; preset Kemarin/Minggu ini dipetakan ke period='custom'
// dengan tanggal KALENDER lokal device (aproksimasi business-day, cukup utk resto kecil).
import { useState } from 'react'
import { Calendar } from 'lucide-react'
import { Tabs, Input, Button } from '@/design-system/primitives'
import type { OwnerReportQuery } from '@/services/dashboardService'

type Preset = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'custom'

const PRESET_ITEMS = [
  { value: 'today', label: 'Hari Ini' },
  { value: 'yesterday', label: 'Kemarin' },
  { value: 'week', label: 'Minggu Ini' },
  { value: 'month', label: 'Bulan Ini' },
  { value: 'year', label: 'Tahun Ini' },
  { value: 'custom', label: 'Custom' },
]

// --- date helpers (kalender lokal device) ---
function localISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
/** Default dashboard owner: "Minggu Ini" = 7 hari terakhir (hari ini − 6 → hari
 *  ini, SELALU 7 hari penuh apa pun harinya). Dipakai oleh preset "Minggu Ini"
 *  sekaligus initial state OwnerDashboard supaya chip & data konsisten. */
export function last7DaysQuery(): OwnerReportQuery {
  const now = new Date()
  return { period: 'custom', fromDate: localISODate(addDays(now, -6)), toDate: localISODate(now) }
}

function presetToQuery(preset: Preset, from: string, to: string): OwnerReportQuery {
  const now = new Date()
  switch (preset) {
    case 'today':
      return { period: 'today' }
    case 'yesterday': {
      const d = localISODate(addDays(now, -1))
      return { period: 'custom', fromDate: d, toDate: d }
    }
    case 'week':
      return last7DaysQuery()
    case 'month':
      return { period: 'month' }
    case 'year':
      return { period: 'year' }
    case 'custom':
      return { period: 'custom', fromDate: from, toDate: to }
  }
}

interface PeriodControlProps {
  onChange: (q: OwnerReportQuery) => void
}

export function PeriodControl({ onChange }: PeriodControlProps) {
  const [preset, setPreset] = useState<Preset>('week')
  const [from, setFrom] = useState(localISODate(addDays(new Date(), -7)))
  const [to, setTo] = useState(localISODate(new Date()))

  const handlePreset = (p: Preset) => {
    setPreset(p)
    if (p !== 'custom') onChange(presetToQuery(p, from, to))
  }

  const customValid = from <= to

  return (
    <div className="space-y-2">
      <Tabs
        value={preset}
        onValueChange={(v) => handlePreset(v as Preset)}
        items={PRESET_ITEMS}
        variant="segmented"
        scrollable
      />
      {preset === 'custom' && (
        <div className="flex flex-col sm:flex-row sm:items-end gap-2 bg-white border border-neutral-200/60 rounded-xl p-3">
          <Input
            type="date"
            label="Dari"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            leftIcon={<Calendar />}
            containerClassName="flex-1"
          />
          <Input
            type="date"
            label="Sampai"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            leftIcon={<Calendar />}
            containerClassName="flex-1"
          />
          <Button
            onClick={() => onChange({ period: 'custom', fromDate: from, toDate: to })}
            disabled={!customValid}
            className="sm:mb-0.5"
          >
            Terapkan
          </Button>
        </div>
      )}
    </div>
  )
}
