// REV 2.5 UnitDropdown - dropdown satuan untuk RawMaterial form, dengan
// tombol "+ Satuan" inline (Odoo-style). Owner klik tombol → modal kecil
// terbuka untuk input label + opnameMode. Setelah save, unit baru
// auto-selected di parent form.
//
// Permission: hanya owner yang lihat tombol "+ Satuan" (CRUD master unit).
// Role lain cuma lihat read-only dropdown.
//
// Konvensi: pakai Combobox primitive (per anjuran Select.tsx: "Untuk picker
// baru pakai Combobox dari './Combobox'") - dukung typeahead + konsisten
// cross-OS. Modal pakai Dialog + Input + Button primitives existing.

import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Sigma, Gauge } from 'lucide-react'
import { unitService, type CreateUnitPayload } from '@/services/unitService'
import { useAuthStore } from '@/stores/authStore'
import type { Unit, OpnameMode } from '@/types'
import { cn } from '@/lib/utils'
import {
  Dialog,
  Button,
  Input,
  Combobox,
  type ComboboxOption,
} from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'

export interface UnitDropdownProps {
  value: number | null
  onChange: (unitId: number, unit: Unit) => void
  label?: string
  placeholder?: string
  helper?: string
  error?: string
  disabled?: boolean
  required?: boolean
  containerClassName?: string
}

const OPNAME_MODE_LABEL: Record<OpnameMode, string> = {
  exact: 'Eksak (angka)',
  scale_0_5: 'Skala 0-5',
}

export default function UnitDropdown({
  value,
  onChange,
  label = 'Satuan',
  placeholder = 'Pilih satuan...',
  helper,
  error,
  disabled,
  required,
  containerClassName,
}: UnitDropdownProps) {
  const toast = useToast()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isOwner = user?.role === 'owner'

  const { data: units = [], isLoading } = useQuery({
    queryKey: ['units'],
    queryFn: unitService.list,
  })

  const [showAddModal, setShowAddModal] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newMode, setNewMode] = useState<OpnameMode>('exact')
  const [formError, setFormError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: (payload: CreateUnitPayload) => unitService.create(payload),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['units'] })
      toast.success(`Satuan "${created.label}" ditambahkan`)
      onChange(created.id, created)
      handleCloseModal()
    },
    onError: (err: Error) => {
      setFormError(err.message || 'Gagal menambah satuan')
    },
  })

  const handleCloseModal = () => {
    setShowAddModal(false)
    setNewLabel('')
    setNewMode('exact')
    setFormError(null)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = newLabel.trim()
    if (!trimmed) {
      setFormError('Label satuan wajib diisi')
      return
    }
    createMutation.mutate({ label: trimmed, opnameMode: newMode })
  }

  const options: ComboboxOption[] = units.map((u) => ({
    value: String(u.id),
    label: u.label,
    helper: OPNAME_MODE_LABEL[u.opnameMode],
  }))

  const handleComboChange = (v: string) => {
    if (!v) return
    const id = Number(v)
    const unit = units.find((u) => u.id === id)
    if (unit) onChange(id, unit)
  }

  return (
    <>
      <div className={cn('flex flex-col gap-1.5', containerClassName)}>
        {label && (
          <label className="text-label text-neutral-700">
            {label}
            {required && <span className="text-danger-600 ml-0.5">*</span>}
          </label>
        )}
        <div className="flex items-stretch gap-2">
          <Combobox
            label={label}
            hideLabel
            options={options}
            value={value != null ? String(value) : ''}
            onValueChange={handleComboChange}
            placeholder={isLoading ? 'Memuat satuan...' : placeholder}
            searchPlaceholder="Cari satuan..."
            emptyText="Belum ada satuan"
            disabled={disabled || isLoading}
            error={error}
            containerClassName="flex-1 min-w-0"
          />
          {isOwner && !disabled && (
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setShowAddModal(true)}
              aria-label="Tambah satuan baru"
              className="shrink-0 border border-neutral-300 hover:bg-neutral-50"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Satuan</span>
            </Button>
          )}
        </div>
        {helper && !error && (
          <p className="text-caption text-neutral-500">{helper}</p>
        )}
      </div>

      {showAddModal && (
        <Dialog
          open
          onOpenChange={(o) => !o && !createMutation.isPending && handleCloseModal()}
          title="Tambah Satuan Baru"
          description="Buat satuan kustom untuk bahan baku. Mode opname menentukan cara hitung stok."
          size="sm"
          preventOutsideClose={createMutation.isPending}
          footer={
            <>
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={handleCloseModal}
                disabled={createMutation.isPending}
              >
                Batal
              </Button>
              <Button
                type="submit"
                form="add-unit-form"
                variant="primary"
                size="md"
                loading={createMutation.isPending}
              >
                Simpan & Pilih
              </Button>
            </>
          }
        >
          <form id="add-unit-form" onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Label Satuan"
              value={newLabel}
              onChange={(e) => {
                setNewLabel(e.target.value)
                if (formError) setFormError(null)
              }}
              placeholder="mis. karton, ikat, sachet"
              autoFocus
              required
              maxLength={32}
              helper="Nama satuan yang muncul di dropdown (mis. kg, liter, pcs)."
            />

            <div>
              <p className="text-label text-neutral-700 mb-2">
                Mode Opname
                <span className="text-danger-600 ml-0.5">*</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(['exact', 'scale_0_5'] as const).map((m) => {
                  const Icon = m === 'exact' ? Sigma : Gauge
                  const active = newMode === m
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setNewMode(m)}
                      aria-pressed={active}
                      className={cn(
                        'min-h-[64px] flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg border text-body-sm font-medium transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
                        active
                          ? 'bg-primary-50 border-primary-500 text-primary-800 ring-1 ring-primary-500/40'
                          : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        {m === 'exact' ? 'Eksak' : 'Skala 0-5'}
                      </div>
                      <span className="text-caption text-neutral-500 leading-tight">
                        {m === 'exact' ? 'Input angka (kg, liter)' : 'Subjektif (sachet, sdt)'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {formError && (
              <p className="text-body-sm text-danger-700" role="alert">
                {formError}
              </p>
            )}
          </form>
        </Dialog>
      )}
    </>
  )
}
