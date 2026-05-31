import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock, Info } from 'lucide-react'
import { settingsService } from '@/services/settingsService'
import { Button, Input, Select, Skeleton } from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'

const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3))

// Zona waktu Indonesia (resto satu lokasi). Owner praktis tak pernah ubah,
// tapi dropdown rapi lebih baik daripada free-text yang rawan typo.
const TIMEZONE_OPTIONS = [
  { value: 'Asia/Jakarta', label: 'WIB · Asia/Jakarta' },
  { value: 'Asia/Makassar', label: 'WITA · Asia/Makassar' },
  { value: 'Asia/Jayapura', label: 'WIT · Asia/Jayapura' },
]

export default function ShiftWindowTab() {
  const qc = useQueryClient()
  const toast = useToast()
  const q = useQuery({ queryKey: ['settings'], queryFn: settingsService.get })

  const [tz, setTz] = useState('Asia/Jakarta')
  const [pagiStart, setPagiStart] = useState('07:00')
  const [changeover, setChangeover] = useState('18:00')
  const [malamEnd, setMalamEnd] = useState('23:00')

  useEffect(() => {
    if (q.data) {
      setTz(q.data.timezone)
      setPagiStart(q.data.shiftPagiStart)
      setChangeover(q.data.shiftChangeover)
      setMalamEnd(q.data.shiftMalamEnd)
    }
  }, [q.data])

  const save = useMutation({
    mutationFn: () =>
      settingsService.update({
        timezone: tz,
        shiftPagiStart: pagiStart,
        shiftChangeover: changeover,
        shiftMalamEnd: malamEnd,
      }),
    onSuccess: () => {
      toast.success('Jam shift disimpan')
      qc.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const contiguousOk = toMin(pagiStart) < toMin(changeover)
  const crossMidnight = toMin(malamEnd) <= toMin(changeover)

  // Kalau nilai tersimpan di luar 3 opsi standar, inject jadi opsi ke-4 supaya
  // tidak hilang diam-diam saat owner buka lalu simpan.
  const tzOptions = TIMEZONE_OPTIONS.some((o) => o.value === tz)
    ? TIMEZONE_OPTIONS
    : [...TIMEZONE_OPTIONS, { value: tz, label: tz }]

  if (q.isLoading) {
    return (
      <div className="p-3 sm:p-4 max-w-2xl mx-auto">
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-4 space-y-3 max-w-2xl mx-auto">
      <div className="bg-white rounded-xl border border-neutral-200/60 p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
            <Clock size={20} className="text-neutral-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-neutral-900">Jam Shift</p>
            <p className="text-caption text-neutral-500">Owner atur batas jam buka shift.</p>
          </div>
        </div>

        <Select
          label="Zona waktu"
          options={tzOptions}
          value={tz}
          onChange={(e) => setTz(e.target.value)}
        />

        <Input
          label="Jam Buka Shift Pagi"
          type="time"
          value={pagiStart}
          onChange={(e) => setPagiStart(e.target.value)}
        />
        <Input
          label="Jam Pergantian Shift"
          type="time"
          value={changeover}
          onChange={(e) => setChangeover(e.target.value)}
          helper="Akhir shift pagi sekaligus awal shift malam."
        />
        <Input
          label="Jam Tutup Shift Malam"
          type="time"
          value={malamEnd}
          onChange={(e) => setMalamEnd(e.target.value)}
          helper={crossMidnight ? 'Lewat tengah malam (cross-midnight).' : undefined}
        />

        {!contiguousOk && (
          <p className="text-caption text-danger-600">
            Jam mulai pagi harus sebelum jam pergantian.
          </p>
        )}

        <div className="flex items-start gap-2 rounded-lg bg-info-50 border border-info-100 p-2.5">
          <Info size={16} className="text-info-600 shrink-0 mt-0.5" />
          <p className="text-caption text-info-700">
            Perubahan hanya mempengaruhi aturan BUKA shift ke depan. Shift yang sedang open
            tidak terpengaruh.
          </p>
        </div>

        <div className="flex justify-end">
          <Button
            variant="primary"
            onClick={() => save.mutate()}
            disabled={!contiguousOk || save.isPending}
            loading={save.isPending}
          >
            Simpan
          </Button>
        </div>
      </div>
    </div>
  )
}
