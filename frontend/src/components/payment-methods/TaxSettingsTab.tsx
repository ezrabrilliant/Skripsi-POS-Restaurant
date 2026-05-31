// TaxSettingsTab - REV 2.6 owner-only kontrol PB1 (pajak).
// Toggle taxEnabled + input taxRate (persen). Default OFF karena resto Ayam Bakar
// Banjar Monosuko tidak charge PB1 ke customer (harga menu = final).
// Saat ON, PB1 dihitung di backend addPayment: tax = (subtotal - diskon) * rate%.
// Pola toggle inline + tokens konsisten dengan BanksTab.

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Receipt, Info } from 'lucide-react'
import { settingsService } from '@/services/settingsService'
import { Button, Input, Skeleton } from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'
import { cn } from '@/lib/utils'

export default function TaxSettingsTab() {
  const qc = useQueryClient()
  const toast = useToast()

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: settingsService.get,
  })

  // Local draft state - di-sync dari server saat load, lalu user edit sebelum Simpan.
  const [enabled, setEnabled] = useState(false)
  const [rate, setRate] = useState('10')
  // REV 2.12: true = PB1 ditambahkan ke tagihan pelanggan; false = ditanggung resto.
  const [charged, setCharged] = useState(false)

  useEffect(() => {
    if (settingsQuery.data) {
      setEnabled(settingsQuery.data.taxEnabled)
      setRate(String(settingsQuery.data.taxRate))
      setCharged(settingsQuery.data.taxChargedToCustomer)
    }
  }, [settingsQuery.data])

  const saveMutation = useMutation({
    mutationFn: () =>
      settingsService.update({
        taxEnabled: enabled,
        taxRate: Number(rate),
        taxChargedToCustomer: charged,
      }),
    onSuccess: (s) => {
      const mode = !s.taxEnabled
        ? 'nonaktif'
        : s.taxChargedToCustomer
          ? `aktif ${s.taxRate}% (dibebankan ke pelanggan)`
          : `aktif ${s.taxRate}% (ditanggung resto)`
      toast.success(`Pengaturan PB1 disimpan - ${mode}`)
      qc.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const rateNum = Number(rate)
  const rateInvalid = rate === '' || Number.isNaN(rateNum) || rateNum < 0 || rateNum > 100
  const dirty =
    !!settingsQuery.data &&
    (enabled !== settingsQuery.data.taxEnabled ||
      rateNum !== settingsQuery.data.taxRate ||
      charged !== settingsQuery.data.taxChargedToCustomer)

  if (settingsQuery.isLoading) {
    return (
      <div className="p-3 sm:p-4 max-w-2xl mx-auto">
        <Skeleton className="h-48" />
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-4 space-y-3 max-w-2xl mx-auto">
      <div className="bg-white rounded-xl border border-neutral-200/60 p-4 space-y-4">
        {/* Toggle row */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
            <Receipt size={20} className="text-neutral-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-neutral-900">Pajak PB1</p>
            <p className="text-caption text-neutral-500">
              Aktifkan untuk menghitung PB1 10%. Lalu pilih di bawah: dibebankan ke
              pelanggan (ditambah ke total) atau ditanggung resto (mengurangi laba).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEnabled((v) => !v)}
            aria-pressed={enabled}
            aria-label={`${enabled ? 'Nonaktifkan' : 'Aktifkan'} PB1`}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 mt-0.5',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
              enabled ? 'bg-success-600' : 'bg-neutral-300',
            )}
          >
            <span
              className={cn(
                'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
                enabled ? 'translate-x-5' : 'translate-x-1',
              )}
            />
          </button>
        </div>

        {/* Rate input - disabled kalau toggle off */}
        <div className={cn('space-y-1.5', !enabled && 'opacity-50')}>
          <label htmlFor="tax-rate" className="text-body-sm font-medium text-neutral-700">
            Tarif PB1 (%)
          </label>
          <div className="flex items-center gap-2 max-w-[160px]">
            <Input
              id="tax-rate"
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step={0.5}
              value={rate}
              disabled={!enabled}
              onChange={(e) => setRate(e.target.value)}
              aria-invalid={enabled && rateInvalid}
            />
            <span className="text-body text-neutral-500">%</span>
          </div>
          {enabled && rateInvalid && (
            <p className="text-caption text-danger-600">Tarif harus antara 0 dan 100.</p>
          )}
        </div>

        {/* REV 2.12: 2-sumbu - siapa yang menanggung PB1. Hanya relevan kalau aktif. */}
        <div className={cn('flex items-start gap-3 border-t border-neutral-100 pt-3', !enabled && 'opacity-50')}>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-neutral-900">Bebankan PB1 ke pelanggan?</p>
            <p className="text-caption text-neutral-500">
              {charged
                ? 'Pelanggan membayar harga + PB1 (PB1 ditambahkan ke total).'
                : 'Pelanggan membayar harga apa adanya; resto menanggung PB1 (mengurangi laba). Kondisi resto saat ini.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCharged((v) => !v)}
            disabled={!enabled}
            aria-pressed={charged}
            aria-label={`${charged ? 'Jangan bebankan' : 'Bebankan'} PB1 ke pelanggan`}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 mt-0.5',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
              charged ? 'bg-success-600' : 'bg-neutral-300',
              !enabled && 'cursor-not-allowed',
            )}
          >
            <span
              className={cn(
                'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
                charged ? 'translate-x-5' : 'translate-x-1',
              )}
            />
          </button>
        </div>

        {/* Info note */}
        <div className="flex items-start gap-2 rounded-lg bg-info-50 border border-info-100 p-2.5">
          <Info size={16} className="text-info-600 shrink-0 mt-0.5" />
          <p className="text-caption text-info-700">
            Perubahan berlaku untuk transaksi baru. Transaksi yang sudah dibayar tidak
            terpengaruh (PB1 sudah tersimpan per transaksi).
          </p>
        </div>

        <div className="flex justify-end pt-1">
          <Button
            variant="primary"
            size="md"
            onClick={() => saveMutation.mutate()}
            disabled={!dirty || (enabled && rateInvalid) || saveMutation.isPending}
            loading={saveMutation.isPending}
          >
            Simpan
          </Button>
        </div>
      </div>
    </div>
  )
}
