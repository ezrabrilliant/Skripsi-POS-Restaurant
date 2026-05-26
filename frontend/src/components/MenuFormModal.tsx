/**
 * MenuFormModal - form Tambah/Edit Menu untuk owner.
 *
 * Pengganti MenuFormModal lama yang inline di MenuPage.tsx (raw JSON textarea).
 * Sekarang adaptive per stockType + visual paket builder + image upload otomatis.
 */

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Boxes, Layers, Soup } from 'lucide-react'
import {
  Button,
  Dialog,
  Input,
  ComboboxFree,
} from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'
import { menuService, type CreateMenuPayload, type UpdateMenuPayload } from '@/services/menuService'
import type { Menu, StockType, SubOptions } from '@/types'
import { MenuImageUpload } from '@/components/menu/MenuImageUpload'
import { MenuTargetCombobox } from '@/components/menu/MenuTargetCombobox'
import {
  PaketBuilder,
  buildPaketFromState,
  emptyPaketBuilderValue,
  paketToBuilderState,
  type PaketBuilderValue,
} from '@/components/menu/PaketBuilder'
import { cn } from '@/lib/utils'

interface MenuFormModalProps {
  existing: Menu | null
  onClose: () => void
  onSuccess: () => void
}

// ============================================================
// StockType selector (button group 3 tombol)
// ============================================================

interface StockTypeOption {
  value: StockType
  label: string
  description: string
  icon: typeof Boxes
}

const STOCK_TYPE_OPTIONS: StockTypeOption[] = [
  {
    value: 'portion',
    label: 'Stok Porsi',
    description: 'Punya stok porsi sendiri, auto-decrement tiap order',
    icon: Boxes,
  },
  {
    value: 'linked',
    label: 'Linked / Varian',
    description: 'Ikut stok menu lain (mis. varian rasa)',
    icon: Layers,
  },
  {
    value: 'nonStock',
    label: 'Tidak Ditrack',
    description: 'Minuman/nasi/sambal/paket — tidak ada stok porsi',
    icon: Soup,
  },
]

function StockTypeSelector({
  value,
  onChange,
}: {
  value: StockType
  onChange: (v: StockType) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-label text-neutral-700">Tipe Stok</label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {STOCK_TYPE_OPTIONS.map((opt) => {
          const active = value === opt.value
          const Icon = opt.icon
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                'flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
                active
                  ? 'bg-primary-50 border-primary-500 ring-1 ring-primary-500/40'
                  : 'bg-white border-neutral-300 hover:border-primary-400 hover:bg-neutral-50',
              )}
            >
              <div className="flex items-center gap-2">
                <Icon
                  className={cn(
                    'h-5 w-5',
                    active ? 'text-primary-700' : 'text-neutral-500',
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    'text-body-sm font-semibold',
                    active ? 'text-primary-900' : 'text-neutral-900',
                  )}
                >
                  {opt.label}
                </span>
              </div>
              <p
                className={cn(
                  'text-caption',
                  active ? 'text-primary-800' : 'text-neutral-600',
                )}
              >
                {opt.description}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// Form state derivation
// ============================================================

interface FormState {
  name: string
  category: string
  price: number
  stockType: StockType
  minStock: number
  imageUrl: string | null
  isActive: boolean
  linkedStockTarget: string
  isPaket: boolean
  paketState: PaketBuilderValue
}

function initFromExisting(existing: Menu | null): FormState {
  if (!existing) {
    return {
      name: '',
      category: '',
      price: 0,
      stockType: 'portion',
      minStock: 5,
      imageUrl: null,
      isActive: true,
      linkedStockTarget: '',
      isPaket: false,
      paketState: emptyPaketBuilderValue,
    }
  }

  const sub = existing.subOptions
  const isLinked = sub && 'stockTarget' in sub
  const isPaket = sub !== null && sub !== undefined && 'choices' in sub

  return {
    name: existing.name,
    category: existing.category,
    price: existing.price,
    stockType: existing.stockType,
    minStock: existing.minStock ?? 5,
    imageUrl: existing.imageUrl,
    isActive: existing.isActive,
    linkedStockTarget: isLinked ? sub.stockTarget : '',
    isPaket,
    paketState: isPaket ? paketToBuilderState(sub) : emptyPaketBuilderValue,
  }
}

/** Bangun subOptions final berdasarkan stockType + state internal. */
function buildSubOptions(state: FormState): SubOptions {
  if (state.stockType === 'linked') {
    return { stockTarget: state.linkedStockTarget.trim() }
  }
  if (state.stockType === 'nonStock' && state.isPaket) {
    return buildPaketFromState(state.paketState)
  }
  return null
}

interface ValidationErrors {
  name?: string
  category?: string
  price?: string
  linkedStockTarget?: string
  paket?: string
}

function validate(state: FormState): ValidationErrors {
  const errs: ValidationErrors = {}
  if (!state.name.trim()) errs.name = 'Nama wajib diisi'
  if (!state.category.trim()) errs.category = 'Kategori wajib diisi'
  if (state.price <= 0) errs.price = 'Harga harus lebih dari 0'

  if (state.stockType === 'linked') {
    if (!state.linkedStockTarget.trim()) {
      errs.linkedStockTarget = 'Pilih menu target dulu'
    }
  }

  if (state.stockType === 'nonStock' && state.isPaket) {
    const paket = state.paketState
    if (paket.fixedItems.length === 0 && paket.choices.length === 0) {
      errs.paket = 'Tambahkan minimal 1 item tetap atau 1 slot pilihan'
    } else if (paket.choices.some((c) => !c.label.trim())) {
      errs.paket = 'Setiap slot pilihan harus punya label'
    } else if (paket.choices.some((c) => c.options.length === 0)) {
      errs.paket = 'Setiap slot pilihan harus punya minimal 1 opsi'
    } else if (
      paket.choices.some((c) => c.options.some((o) => !o.label.trim()))
    ) {
      errs.paket = 'Setiap opsi harus punya label'
    }
  }

  return errs
}

// ============================================================
// Main component
// ============================================================

export function MenuFormModal({ existing, onClose, onSuccess }: MenuFormModalProps) {
  const toast = useToast()
  const [state, setState] = useState<FormState>(() => initFromExisting(existing))
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [submitted, setSubmitted] = useState(false)

  // Re-init state kalau existing berubah (jaga-jaga, biasanya MenuFormModal di-mount baru)
  useEffect(() => {
    setState(initFromExisting(existing))
    setErrors({})
    setSubmitted(false)
  }, [existing])

  // Fetch list menu untuk kategori autocomplete
  const { data: allMenus = [] } = useQuery({
    queryKey: ['menus', 'admin', true],
    queryFn: () => menuService.list({ activeOnly: false }),
    staleTime: 30_000,
  })

  const categoryOptions = useMemo(() => {
    const set = new Set(allMenus.map((m) => m.category).filter(Boolean))
    return Array.from(set)
      .sort()
      .map((c) => ({ value: c, label: c }))
  }, [allMenus])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }))
  }

  const mutation = useMutation({
    mutationFn: () => {
      const payload: CreateMenuPayload = {
        name: state.name.trim(),
        category: state.category.trim(),
        price: state.price,
        stockType: state.stockType,
        minStock: state.stockType === 'portion' ? state.minStock : undefined,
        imageUrl: state.imageUrl,
        subOptions: buildSubOptions(state),
        isActive: state.isActive,
      }
      if (existing) {
        const updatePayload: UpdateMenuPayload = { ...payload }
        return menuService.update(existing.id, updatePayload)
      }
      return menuService.create(payload)
    },
    onSuccess: () => {
      toast.success(existing ? 'Menu diperbarui' : 'Menu dibuat')
      onSuccess()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleSubmit = () => {
    setSubmitted(true)
    const errs = validate(state)
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      toast.error('Ada field yang belum lengkap')
      return
    }
    mutation.mutate()
  }

  // Re-validate saat user sudah pernah submit (live feedback)
  useEffect(() => {
    if (submitted) {
      setErrors(validate(state))
    }
  }, [state, submitted])

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={existing ? `Edit: ${existing.name}` : 'Tambah Menu Baru'}
      size="lg"
      footer={
        <div className="flex gap-2 w-full">
          <Button variant="ghost" size="md" onClick={onClose} disabled={mutation.isPending}>
            Batal
          </Button>
          <Button
            variant="primary"
            size="md"
            fullWidth
            onClick={handleSubmit}
            loading={mutation.isPending}
          >
            {existing ? 'Simpan Perubahan' : 'Simpan Menu'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Foto */}
        <MenuImageUpload
          value={state.imageUrl}
          onChange={(url) => update('imageUrl', url)}
          name={state.name}
          disabled={mutation.isPending}
        />

        {/* Nama */}
        <Input
          label="Nama Menu"
          value={state.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder="Mis. Paha Ayam Bakar"
          error={errors.name}
          required
        />

        {/* Kategori + Harga */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ComboboxFree
            label="Kategori"
            value={state.category}
            onValueChange={(v) => update('category', v)}
            options={categoryOptions}
            placeholder="Pilih atau ketik baru"
            searchPlaceholder="Cari kategori..."
            addLabel="Pakai kategori baru"
            emptyText="Belum ada kategori"
            error={errors.category}
          />
          <Input
            label="Harga (Rp)"
            type="number"
            inputMode="numeric"
            value={state.price || ''}
            onChange={(e) => update('price', Number(e.target.value) || 0)}
            min={0}
            step={1000}
            placeholder="0"
            error={errors.price}
            required
          />
        </div>

        {/* StockType selector */}
        <StockTypeSelector
          value={state.stockType}
          onChange={(v) => update('stockType', v)}
        />

        {/* Conditional per stockType */}
        {state.stockType === 'portion' && (
          <Input
            label="Stok Minimum"
            type="number"
            inputMode="numeric"
            value={state.minStock}
            onChange={(e) => update('minStock', Number(e.target.value) || 0)}
            min={0}
            helper="Reminder muncul di dashboard saat qty saat ini ≤ angka ini."
          />
        )}

        {state.stockType === 'linked' && (
          <MenuTargetCombobox
            value={state.linkedStockTarget}
            onChange={(v) => update('linkedStockTarget', v)}
            label="Mengikuti Stok Dari Menu"
            placeholder="Pilih menu porsi..."
            helper={
              state.linkedStockTarget
                ? `Saat menu ini dipesan, stok porsi dari "${state.linkedStockTarget}" akan dikurangi otomatis.`
                : 'Pilih menu porsi yang stoknya akan dikurangi setiap kali menu ini dipesan.'
            }
            error={errors.linkedStockTarget}
            excludeNames={existing ? [existing.name] : []}
          />
        )}

        {state.stockType === 'nonStock' && (
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={state.isPaket}
                onChange={(e) => update('isPaket', e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-body text-neutral-900">
                Menu ini paket dengan pilihan customer
              </span>
            </label>
            <p className="text-caption text-neutral-500 pl-6">
              Centang kalau customer perlu pilih varian saat order (mis. bagian
              ayam, cara masak). Kosongkan untuk minuman/nasi biasa.
            </p>

            {state.isPaket && (
              <>
                <PaketBuilder
                  value={state.paketState}
                  onChange={(v) => update('paketState', v)}
                  excludeMenuName={existing?.name}
                />
                {errors.paket && (
                  <p className="text-caption text-danger-700" role="alert">
                    {errors.paket}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Status aktif (untuk edit; default aktif untuk new) */}
        {existing && (
          <label className="flex items-center gap-2 cursor-pointer pt-2 border-t border-neutral-200">
            <input
              type="checkbox"
              checked={state.isActive}
              onChange={(e) => update('isActive', e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-body text-neutral-900">Menu aktif (tampil di POS)</span>
          </label>
        )}
      </div>
    </Dialog>
  )
}
