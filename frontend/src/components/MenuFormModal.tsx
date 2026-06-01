/**
 * MenuFormModal REV 2.10 - form Tambah/Edit Menu untuk owner dengan
 * **progressive disclosure**: owner tidak memilih "jenis menu" di awal.
 *
 * Alur:
 * 1. Selalu tampil: basics (foto, nama, kategori, harga).
 * 2. Bagian "Menu ini punya pilihan?" - 2 tombol mutually-exclusive:
 *      [+ Tambah pilihan varian]  → reveal VariantBuilder, working kind=variant
 *      [+ Jadikan paket]          → reveal PaketBuilder,  working kind=paket
 *    Neither aktif → kind=simple.
 * 3. Saat SAVE: rakit MenuUpsertPayload dengan kind ter-infer + posVisible
 *    (true untuk menu baru; pertahankan nilai existing saat edit) + builder
 *    output. Submit via menuService.upsert(payload, existingId).
 *
 * Edit mode: fetch menuService.detail(id) lalu seed builder dari
 * optionGroups+variants (variant) atau paketComponents (paket).
 */

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Layers, Package, X } from 'lucide-react'
import { Button, Dialog, Input, Checkbox, ComboboxFree } from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'
import { menuService } from '@/services/menuService'
import { formatCurrency } from '@/lib/utils'
import type { Menu, MenuKind, MenuUpsertPayload, StockType } from '@/types'
import { MenuImageUpload } from '@/components/menu/MenuImageUpload'
import {
  PaketBuilder,
  buildPaketComponentsPayload,
  emptyPaketBuilderValue,
  menuToPaketBuilderState,
  type PaketBuilderValue,
} from '@/components/menu/PaketBuilder'
import {
  VariantBuilder,
  buildOptionGroupsPayload,
  buildVariantsPayload,
  computeVariantRows,
  emptyVariantBuilderValue,
  menuToVariantBuilderState,
  type VariantBuilderValue,
} from '@/components/menu/VariantBuilder'

interface MenuFormModalProps {
  existing: Menu | null
  onClose: () => void
  onSuccess: () => void
  /** Mode "Tambah SKU" dari tab Varian SKU: bikin item stok tersembunyi
   * (posVisible=false, kind=simple, tanpa builder varian/paket). */
  createSku?: boolean
}

// ============================================================
// Form state
// ============================================================

/** Working mode = kind yang sedang di-edit (di-infer dari tombol yang aktif). */
type WorkingMode = 'simple' | 'variant' | 'paket'

interface FormState {
  name: string
  category: string
  price: number
  /** REV 2.11: harga modal / COGS per porsi (hanya untuk menu simple/leaf). */
  cost: number
  imageUrl: string | null
  isActive: boolean
  /** Posisi tampil di grid POS - dipertahankan dari existing saat edit. */
  posVisible: boolean
  /** stockType tersimpan (untuk menu simple). Variant/paket → nonStock. */
  stockType: StockType
  minStock: number
  mode: WorkingMode
  variantState: VariantBuilderValue
  paketState: PaketBuilderValue
}

function initFromExisting(existing: Menu | null, createSku = false): FormState {
  if (!existing) {
    return {
      name: '',
      category: '',
      price: 0,
      cost: 0,
      imageUrl: null,
      isActive: true,
      posVisible: !createSku,
      stockType: 'portion',
      minStock: 5,
      mode: 'simple',
      variantState: emptyVariantBuilderValue,
      paketState: emptyPaketBuilderValue,
    }
  }

  const mode: WorkingMode =
    existing.kind === 'variant'
      ? 'variant'
      : existing.kind === 'paket'
        ? 'paket'
        : 'simple'

  return {
    name: existing.name,
    category: existing.category,
    price: existing.price,
    cost: existing.cost ?? 0,
    imageUrl: existing.imageUrl,
    isActive: existing.isActive,
    posVisible: existing.posVisible,
    stockType: existing.stockType,
    minStock: existing.minStock ?? 5,
    mode,
    variantState:
      mode === 'variant'
        ? menuToVariantBuilderState(existing)
        : emptyVariantBuilderValue,
    paketState:
      mode === 'paket'
        ? menuToPaketBuilderState(existing)
        : emptyPaketBuilderValue,
  }
}

interface ValidationErrors {
  name?: string
  category?: string
  price?: string
  variant?: string
  paket?: string
}

function validate(state: FormState): ValidationErrors {
  const errs: ValidationErrors = {}
  if (!state.name.trim()) errs.name = 'Nama wajib diisi'
  if (!state.category.trim()) errs.category = 'Kategori wajib diisi'
  if (state.price <= 0) errs.price = 'Harga harus lebih dari 0'

  if (state.mode === 'variant') {
    const rows = computeVariantRows(state.variantState, state.price)
    const affectsGroups = state.variantState.groups.filter((g) => g.affectsVariant)
    if (affectsGroups.length === 0) {
      errs.variant = 'Tambahkan minimal 1 grup "ubah harga/stok"'
    } else if (state.variantState.groups.some((g) => !g.name.trim())) {
      errs.variant = 'Setiap grup harus punya nama'
    } else if (
      state.variantState.groups.some(
        (g) => !g.optionLabels.some((o) => o.trim()),
      )
    ) {
      errs.variant = 'Setiap grup harus punya minimal 1 opsi terisi'
    } else if (rows.length === 0) {
      errs.variant = 'Belum ada kombinasi varian yang terbentuk'
    }
  }

  if (state.mode === 'paket') {
    const paket = state.paketState
    const hasFixed = paket.fixedItems.some((f) => f.targetMenuId !== null)
    const hasChoice = paket.choices.length > 0
    if (!hasFixed && !hasChoice) {
      errs.paket = 'Tambahkan minimal 1 item tetap atau 1 slot pilihan'
    } else if (paket.choices.some((c) => !c.label.trim())) {
      errs.paket = 'Setiap slot pilihan harus punya label'
    } else if (
      paket.choices.some((c) => c.options.filter((o) => o.label.trim()).length === 0)
    ) {
      errs.paket = 'Setiap slot pilihan harus punya minimal 1 opsi'
    }
  }

  return errs
}

/**
 * Pre-submit validation yang mengembalikan pesan toast (Indonesia, singkat,
 * menyebut slot yang bermasalah) kalau ada yang invalid - atau null kalau lolos.
 * Tujuannya mencegah save yang silent-broken / 422 dari backend.
 *
 * - paket: ≥1 komponen; SETIAP fixed punya targetMenuId; SETIAP choice punya
 *   ≥1 opsi DAN setiap opsi punya targetMenuId.
 * - variant: ≥1 varian; setiap grup punya nama + ≥1 opsi (grid menjamin varian
 *   ada bila grup ada).
 */
function preSubmitToastError(
  state: FormState,
  menuNameById: Map<number, string>,
): string | null {
  if (state.mode === 'paket') {
    const paket = state.paketState
    const hasFixed = paket.fixedItems.length > 0
    const hasChoice = paket.choices.length > 0
    if (!hasFixed && !hasChoice) {
      return 'Paket butuh minimal 1 komponen'
    }
    // Setiap item tetap wajib punya menu target.
    for (let i = 0; i < paket.fixedItems.length; i++) {
      if (paket.fixedItems[i].targetMenuId === null) {
        return `Item tetap ${i + 1} belum dipilih menunya`
      }
    }
    // Setiap slot pilihan wajib ≥1 opsi, dan tiap opsi wajib menu target.
    for (let i = 0; i < paket.choices.length; i++) {
      const c = paket.choices[i]
      const slotName = c.label.trim() || `Pilihan ${i + 1}`
      if (!c.label.trim()) {
        return `Pilihan ${i + 1} belum punya nama`
      }
      const realOptions = c.options.filter((o) => o.label.trim())
      if (realOptions.length === 0) {
        return `Komponen "${slotName}" belum punya opsi`
      }
      for (let j = 0; j < c.options.length; j++) {
        const o = c.options[j]
        if (!o.label.trim()) continue
        if (o.targetMenuId === null) {
          return `Opsi "${o.label.trim()}" di "${slotName}" belum dipilih menunya`
        }
      }
    }
  }

  if (state.mode === 'variant') {
    const v = state.variantState
    const affectsGroups = v.groups.filter((g) => g.affectsVariant)
    if (affectsGroups.length === 0) {
      return 'Tambahkan minimal 1 grup "ubah harga/stok"'
    }
    for (let i = 0; i < v.groups.length; i++) {
      const g = v.groups[i]
      if (!g.name.trim()) {
        return `Grup ${i + 1} belum punya nama`
      }
      if (!g.optionLabels.some((o) => o.trim())) {
        return `Grup "${g.name.trim()}" belum punya opsi`
      }
    }
    const rows = computeVariantRows(v, state.price)
    if (rows.length === 0) {
      return 'Belum ada kombinasi varian yang terbentuk'
    }
  }

  void menuNameById
  return null
}

/** Rakit payload final dari state. menuNameById dipakai untuk derive label
 * komponen paket fixed (backend wajib label non-empty). */
function buildPayload(
  state: FormState,
  menuNameById: Map<number, string>,
): MenuUpsertPayload {
  const kind: MenuKind = state.mode
  // Variant & paket selalu nonStock di level menu induk (stok lewat target).
  const stockType: StockType = kind === 'simple' ? state.stockType : 'nonStock'

  return {
    name: state.name.trim(),
    category: state.category.trim(),
    price: state.price,
    // REV 2.11: modal/COGS hidup di leaf/simple; parent variant/paket biarkan 0.
    cost: state.cost,
    imageUrl: state.imageUrl,
    kind,
    posVisible: state.posVisible,
    stockType,
    minStock: kind === 'simple' && stockType === 'portion' ? state.minStock : null,
    optionGroups:
      kind === 'variant' ? buildOptionGroupsPayload(state.variantState) : [],
    variants:
      kind === 'variant'
        ? buildVariantsPayload(state.variantState, state.price)
        : [],
    paketComponents:
      kind === 'paket'
        ? buildPaketComponentsPayload(state.paketState, menuNameById)
        : [],
  }
}

// ============================================================
// Main component
// ============================================================

export function MenuFormModal({ existing, onClose, onSuccess, createSku = false }: MenuFormModalProps) {
  const toast = useToast()
  const qc = useQueryClient()

  // Edit mode: fetch detail lengkap (optionGroups + variants + paketComponents).
  // List item mungkin sudah punya nested catalog, tapi detail lebih authoritative.
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['menus', 'detail', existing?.id],
    queryFn: () => menuService.detail(existing!.id),
    enabled: !!existing,
    staleTime: 0,
  })

  const seed = existing ? detail ?? existing : null

  const [state, setState] = useState<FormState>(() => initFromExisting(existing, createSku))
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [submitted, setSubmitted] = useState(false)

  // Re-seed saat detail tiba (edit) atau saat existing berubah.
  useEffect(() => {
    setState(initFromExisting(seed, createSku))
    setErrors({})
    setSubmitted(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed?.id, detail])

  // List semua menu (incl. hidden) untuk kategori autocomplete + name lookup paket.
  const { data: allMenus = [] } = useQuery({
    queryKey: ['menus', 'admin', true],
    queryFn: () => menuService.list({ activeOnly: false, includeHidden: true }),
    staleTime: 30_000,
  })

  const categoryOptions = useMemo(() => {
    const set = new Set(allMenus.map((m) => m.category).filter(Boolean))
    return Array.from(set)
      .sort()
      .map((c) => ({ value: c, label: c }))
  }, [allMenus])

  const menuNameById = useMemo(
    () => new Map(allMenus.map((m) => [m.id, m.name])),
    [allMenus],
  )

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }))
  }

  const mutation = useMutation({
    mutationFn: () => menuService.upsert(buildPayload(state, menuNameById), existing?.id),
    onSuccess: () => {
      toast.success(existing ? 'Menu diperbarui' : 'Menu dibuat')
      qc.invalidateQueries({ queryKey: ['menus'] })
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
    // Pre-submit guard varian/paket: toast jelas + sebut slot yang bermasalah,
    // cegah save silent-broken / 422 dari backend.
    const preErr = preSubmitToastError(state, menuNameById)
    if (preErr) {
      toast.error(preErr)
      return
    }
    mutation.mutate()
  }

  useEffect(() => {
    if (submitted) setErrors(validate(state))
  }, [state, submitted])

  const switchToSimple = () => setState((prev) => ({ ...prev, mode: 'simple' }))

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !mutation.isPending && onClose()}
      title={existing ? `Edit: ${existing.name}` : createSku ? 'Tambah SKU (item stok)' : 'Tambah Menu Baru'}
      size="lg"
      preventOutsideClose={mutation.isPending}
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
            disabled={!!existing && detailLoading}
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
            label={state.mode === 'simple' ? 'Harga (Rp)' : 'Harga Dasar (Rp)'}
            type="number"
            inputMode="numeric"
            value={state.price || ''}
            onChange={(e) => update('price', Number(e.target.value) || 0)}
            min={0}
            step={1000}
            placeholder="0"
            error={errors.price}
            helper={
              state.mode === 'variant'
                ? 'Dipakai sebagai harga default tiap varian.'
                : undefined
            }
            required
          />
        </div>

        {/* REV 2.11: Harga modal / COGS - hanya untuk menu simple (leaf/simple
            carry cost; variant/paket parent biarkan 0, modal hidup di leaf). */}
        {state.mode === 'simple' && (
          <div>
            <Input
              label="Harga Modal / COGS (Rp)"
              type="number" inputMode="numeric"
              value={state.cost || ''}
              onChange={(e) => update('cost', Number(e.target.value) || 0)}
              min={0} step={1000} placeholder="0"
              helper="Modal per porsi (untuk laba). Boleh dikosongkan = 0."
            />
            {state.cost > 0 && state.price > 0 && (
              <p className="text-caption text-neutral-500 mt-1">
                Margin {formatCurrency(state.price - state.cost)} (
                {(((state.price - state.cost) / state.price) * 100).toFixed(0)}%)
              </p>
            )}
          </div>
        )}

        {/* REV 2.12: toggle lacak stok untuk menu simple (portion <-> nonStock).
            linked tidak diekspos di sini (itu ranah SKU varian). Backend upsert
            sudah sinkron PortionStock saat beralih ke portion. */}
        {state.mode === 'simple' && (
          <div className="pt-1">
            <Checkbox
              label="Lacak stok porsi (hitung sisa & ingatkan saat menipis)"
              checked={state.stockType === 'portion'}
              onCheckedChange={(c) => update('stockType', c ? 'portion' : 'nonStock')}
            />
            <p className="text-caption text-neutral-500 mt-1">
              {state.stockType === 'portion'
                ? 'Stok dihitung per porsi & otomatis berkurang tiap terjual. Mulai dari 0 — restock dulu setelah disimpan.'
                : 'Tidak dilacak — menu selalu bisa dijual (mis. minuman racik / item tanpa stok).'}
            </p>
          </div>
        )}

        {/* Stok minimum hanya untuk menu simple portion */}
        {state.mode === 'simple' && state.stockType === 'portion' && (
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

        {/* ============================================================
            Progressive disclosure - "Menu ini punya pilihan?"
            Disembunyikan di mode createSku (SKU = leaf, tak punya varian/paket).
            ============================================================ */}
        {!createSku && (
        <div className="flex flex-col gap-2 pt-1 border-t border-neutral-200">
          <div className="pt-2">
            <h3 className="text-body-sm font-semibold text-neutral-900">
              Menu ini punya pilihan?
            </h3>
            <p className="text-caption text-neutral-500">
              Opsional. Biarkan kosong untuk menu biasa (1 harga, tanpa pilihan).
            </p>
          </div>

          {state.mode === 'simple' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => update('mode', 'variant')}
                className="flex flex-col items-start gap-1 rounded-md border border-neutral-300 bg-white p-3 text-left transition-colors hover:border-primary-400 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
              >
                <span className="flex items-center gap-2 text-body-sm font-semibold text-neutral-900">
                  <Layers className="h-4 w-4 text-primary-600" aria-hidden />
                  + Tambah pilihan varian
                </span>
                <span className="text-caption text-neutral-500">
                  ukuran · rasa · bakar/goreng
                </span>
              </button>
              <button
                type="button"
                onClick={() => update('mode', 'paket')}
                className="flex flex-col items-start gap-1 rounded-md border border-neutral-300 bg-white p-3 text-left transition-colors hover:border-primary-400 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
              >
                <span className="flex items-center gap-2 text-body-sm font-semibold text-neutral-900">
                  <Package className="h-4 w-4 text-primary-600" aria-hidden />
                  + Paket (gabungan item)
                </span>
                <span className="text-caption text-neutral-500">
                  ayam + nasi + minuman
                </span>
              </button>
            </div>
          )}

          {state.mode === 'variant' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-body-sm font-semibold text-neutral-900">
                  <Layers className="h-4 w-4 text-primary-600" aria-hidden />
                  Pilihan Varian
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={switchToSimple}
                  leftIcon={<X className="h-4 w-4" aria-hidden />}
                  className="text-danger-700 hover:bg-danger-50"
                >
                  Hapus varian
                </Button>
              </div>
              <VariantBuilder
                value={state.variantState}
                onChange={(v) => update('variantState', v)}
                basePrice={state.price}
                excludeMenuName={existing?.name}
              />
              {errors.variant && (
                <p className="text-caption text-danger-700" role="alert">
                  {errors.variant}
                </p>
              )}
            </div>
          )}

          {state.mode === 'paket' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-body-sm font-semibold text-neutral-900">
                  <Package className="h-4 w-4 text-primary-600" aria-hidden />
                  Paket
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={switchToSimple}
                  leftIcon={<X className="h-4 w-4" aria-hidden />}
                  className="text-danger-700 hover:bg-danger-50"
                >
                  Hapus paket
                </Button>
              </div>
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
            </div>
          )}
        </div>
        )}

        {/* Status aktif (edit only) */}
        {existing && (
          <div className="pt-2 border-t border-neutral-200">
            <Checkbox
              label={
                existing.posVisible
                  ? 'Menu aktif (tampil di POS)'
                  : 'Item stok aktif (bisa dipakai jenis menu lain)'
              }
              checked={state.isActive}
              onCheckedChange={(c) => update('isActive', c)}
            />
          </div>
        )}
      </div>
    </Dialog>
  )
}
