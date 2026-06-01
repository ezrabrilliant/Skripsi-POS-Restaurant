/**
 * VariantBuilder REV 2.10 - form visual untuk menu kind=variant.
 *
 * Owner mendefinisikan **grup opsi** (mis. "Bagian Ayam", "Cara Masak", "Suhu")
 * lalu sistem otomatis menghitung **cartesian product** dari grup yang
 * `affectsVariant=true` jadi grid varian sellable (harga eksak + stock target).
 *
 * - Grup `affectsVariant=true` ("ubah harga/stok") membentuk axis varian.
 * - Grup `affectsVariant=false` ("bebas") = free-preference (mis. Suhu) yang
 *   TIDAK mengkalikan jumlah varian (tidak masuk grid). Persisten sebagai
 *   OptionGroup saja supaya POS bisa render pilihan saat order.
 *
 * Edit preservation: tiap varian di-key dengan signature optionLabels yang
 * di-sort BERDASARKAN NAMA GRUP (group-order-independent). Saat grid regenerate
 * karena owner tambah/hapus opsi ATAU urutan grup berubah (mis. seed dari backend
 * beda urutan dari saat create), harga/stockTarget/active yang sudah di-edit tetap
 * survive untuk kombinasi yang masih ada. Satu helper `variantSignature` dipakai
 * di SEMUA tempat (generate grid, lookup override, seed dari existing) supaya
 * generation & lookup selalu sepakat.
 */

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { Input } from '@/design-system/primitives/Input'
import { Button } from '@/design-system/primitives/Button'
import { Checkbox } from '@/design-system/primitives/Checkbox'
import { type ComboboxOption } from '@/design-system/primitives/Combobox'
import { MenuTargetCombobox } from './MenuTargetCombobox'
import { menuService } from '@/services/menuService'
import { formatCurrency } from '@/lib/utils'
import type {
  Menu,
  OptionGroupUpsertPayload,
  MenuVariantUpsertPayload,
} from '@/types'
import { routeSkuLink, currentSkuId } from './skuLink'

// ============================================================
// Working state (round-trips ke MenuUpsertPayload)
// ============================================================

/** Editor state untuk 1 grup opsi (label opsi disimpan flat list of string). */
export interface VariantGroupState {
  name: string
  affectsVariant: boolean
  optionLabels: string[]
}

/**
 * Override per-kombinasi yang di-edit owner. Disimpan keyed by signature
 * (lihat `variantSignature`) supaya survive regenerate grid.
 */
export interface VariantOverride {
  price: number
  stockTargetMenuId: number | null
  /** REV 2.11: sumber modal untuk varian nonStock (stockTargetMenuId === null).
   * Survive regenerate grid lewat override keyed by signature. */
  costSourceMenuId: number | null
  isActive: boolean
}

export interface VariantBuilderValue {
  groups: VariantGroupState[]
  /** Override per signature kombinasi (group affectsVariant=true). */
  overrides: Record<string, VariantOverride>
}

interface VariantBuilderProps {
  value: VariantBuilderValue
  onChange: (next: VariantBuilderValue) => void
  /** Harga dasar menu - default harga varian baru. */
  basePrice: number
  /** Nama menu yang sedang di-edit (di-exclude dari pilihan stock target). */
  excludeMenuName?: string
}

// ============================================================
// Helpers (round-trip + cartesian)
// ============================================================

export const emptyVariantBuilderValue: VariantBuilderValue = {
  groups: [],
  overrides: {},
}

/**
 * Signature stabil dari pilihan opsi, **group-order-independent**: bagian
 * `groupName=optionLabel` di-SORT by group name sebelum di-join "||", jadi key
 * sama persis tak peduli urutan grup di array. Dipakai konsisten di generate
 * grid, lookup override, dan seed dari existing variants.
 *
 * Satu opsi per grup, jadi `optionLabels` adalah map groupName -> chosen label.
 */
export function variantSignature(optionLabels: Record<string, string>): string {
  return Object.keys(optionLabels)
    .sort()
    .map((g) => `${g}=${optionLabels[g]}`)
    .join('||')
}

/** Cartesian product dari array of arrays. */
function cartesian(lists: string[][]): string[][] {
  return lists.reduce<string[][]>(
    (acc, list) => acc.flatMap((prefix) => list.map((item) => [...prefix, item])),
    [[]],
  )
}

/** 1 baris varian terkomputasi untuk render grid. */
export interface ComputedVariantRow {
  signature: string
  /** Map groupName -> chosen option label (hanya grup affectsVariant=true). */
  optionLabels: Record<string, string>
  /** Display label: option labels joined " / " dalam group order. */
  label: string
  price: number
  stockTargetMenuId: number | null
  /** REV 2.11: sumber modal untuk varian nonStock. */
  costSourceMenuId: number | null
  isActive: boolean
}

/** Hitung grid varian dari grup affectsVariant=true + overrides. */
export function computeVariantRows(
  value: VariantBuilderValue,
  basePrice: number,
): ComputedVariantRow[] {
  const variantGroups = value.groups.filter(
    (g) => g.affectsVariant && g.name.trim() && g.optionLabels.some((o) => o.trim()),
  )
  if (variantGroups.length === 0) return []

  const groupNames = variantGroups.map((g) => g.name.trim())
  const optionLists = variantGroups.map((g) =>
    g.optionLabels.map((o) => o.trim()).filter(Boolean),
  )
  if (optionLists.some((l) => l.length === 0)) return []

  const combos = cartesian(optionLists)
  return combos.map((combo) => {
    const optionLabels: Record<string, string> = {}
    groupNames.forEach((g, i) => {
      optionLabels[g] = combo[i]
    })
    const signature = variantSignature(optionLabels)
    const override = value.overrides[signature]
    return {
      signature,
      optionLabels,
      label: combo.join(' / '),
      price: override?.price ?? basePrice,
      stockTargetMenuId: override?.stockTargetMenuId ?? null,
      costSourceMenuId: override?.costSourceMenuId ?? null,
      isActive: override?.isActive ?? true,
    }
  })
}

/** Bangun optionGroups payload (semua grup, affectsVariant + bebas). */
export function buildOptionGroupsPayload(
  value: VariantBuilderValue,
): OptionGroupUpsertPayload[] {
  return value.groups
    .filter((g) => g.name.trim() && g.optionLabels.some((o) => o.trim()))
    .map((g, gi) => ({
      name: g.name.trim(),
      affectsVariant: g.affectsVariant,
      displayOrder: gi,
      options: g.optionLabels
        .map((o) => o.trim())
        .filter(Boolean)
        .map((label, oi) => ({ label, displayOrder: oi })),
    }))
}

/** Bangun variants payload dari grid terkomputasi. */
export function buildVariantsPayload(
  value: VariantBuilderValue,
  basePrice: number,
): MenuVariantUpsertPayload[] {
  return computeVariantRows(value, basePrice).map((row, idx) => ({
    optionLabels: row.optionLabels,
    label: row.label,
    price: row.price,
    stockTargetMenuId: row.stockTargetMenuId,
    costSourceMenuId: row.costSourceMenuId,
    isActive: row.isActive,
    displayOrder: idx,
  }))
}

/** Konversi Menu detail (optionGroups + variants) -> editor state (edit mode). */
export function menuToVariantBuilderState(menu: Menu): VariantBuilderValue {
  const groups: VariantGroupState[] = (menu.optionGroups ?? [])
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((g) => ({
      name: g.name,
      affectsVariant: g.affectsVariant,
      optionLabels: g.options
        .slice()
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((o) => o.label),
    }))

  const variantGroups = (menu.optionGroups ?? []).filter((g) => g.affectsVariant)

  // MenuVariant.optionIds = id MenuOption penyusun. Map: optionId -> { groupName, label }
  // supaya bisa rekonstruksi kombinasi { groupName -> label } per varian.
  const optionLookup = new Map<number, { groupName: string; label: string }>()
  for (const g of variantGroups) {
    for (const o of g.options) {
      optionLookup.set(o.id, { groupName: g.name.trim(), label: o.label })
    }
  }

  const overrides: Record<string, VariantOverride> = {}
  for (const v of menu.variants ?? []) {
    // Rekonstruksi map groupName -> label dari optionIds varian ini. Pakai
    // SELURUH entri yang ketemu (partial OK) - jangan drop varian kalau ada
    // grup yang hilang (data drift dari backfill). Key by variantSignature
    // (group-order-independent) supaya cocok dengan grid bila kombinasi masih ada.
    const optionLabels: Record<string, string> = {}
    for (const oid of v.optionIds) {
      const entry = optionLookup.get(oid)
      if (entry) optionLabels[entry.groupName] = entry.label
    }
    // Fallback defensif: kalau optionIds tak ter-resolve sama sekali (mis. backend
    // belum kirim optionGroups beririsan), simpan tetap pakai label varian sebagai
    // key supaya price/stock tersimpan & varian tidak hilang.
    const signature =
      Object.keys(optionLabels).length > 0
        ? variantSignature(optionLabels)
        : `__variant_${v.id}__${v.label}`
    overrides[signature] = {
      price: v.price,
      stockTargetMenuId: v.stockTargetMenuId,
      costSourceMenuId: v.costSourceMenuId ?? null,
      isActive: v.isActive,
    }
  }

  return { groups, overrides }
}

// ============================================================
// Section: Option group editor
// ============================================================

function OptionGroupEditor({
  group,
  onChange,
  onRemove,
  index,
}: {
  group: VariantGroupState
  onChange: (next: VariantGroupState) => void
  onRemove: () => void
  index: number
}) {
  const updateOption = (idx: number, label: string) => {
    const next = group.optionLabels.map((o, i) => (i === idx ? label : o))
    onChange({ ...group, optionLabels: next })
  }

  const addOption = () => {
    onChange({ ...group, optionLabels: [...group.optionLabels, ''] })
  }

  const removeOption = (idx: number) => {
    onChange({
      ...group,
      optionLabels: group.optionLabels.filter((_, i) => i !== idx),
    })
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-neutral-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <Input
          label={`Grup ${index + 1}`}
          hideLabel
          value={group.name}
          onChange={(e) => onChange({ ...group, name: e.target.value })}
          placeholder="Nama grup (mis. Bagian Ayam, Cara Masak)"
          containerClassName="flex-1"
        />
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md p-2 text-danger-600 hover:bg-danger-50"
          aria-label={`Hapus grup ${index + 1}`}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* Toggle affectsVariant (radio-style 2 tombol) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange({ ...group, affectsVariant: true })}
          className={
            'rounded-md border p-2.5 text-left text-body-sm transition-colors ' +
            (group.affectsVariant
              ? 'bg-primary-50 border-primary-500 ring-1 ring-primary-500/40 text-primary-900'
              : 'bg-white border-neutral-300 hover:border-primary-400 text-neutral-700')
          }
        >
          <span className="font-semibold block">Ubah harga / stok</span>
          <span className="text-caption text-neutral-500">
            Membentuk varian (harga & stok berbeda)
          </span>
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...group, affectsVariant: false })}
          className={
            'rounded-md border p-2.5 text-left text-body-sm transition-colors ' +
            (!group.affectsVariant
              ? 'bg-primary-50 border-primary-500 ring-1 ring-primary-500/40 text-primary-900'
              : 'bg-white border-neutral-300 hover:border-primary-400 text-neutral-700')
          }
        >
          <span className="font-semibold block">Bebas</span>
          <span className="text-caption text-neutral-500">
            Pilihan saja (mis. suhu) - harga sama
          </span>
        </button>
      </div>

      {/* Daftar opsi */}
      {group.optionLabels.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {group.optionLabels.map((opt, idx) => (
            <li key={idx} className="flex items-center gap-2">
              <Input
                label={`Opsi ${idx + 1}`}
                hideLabel
                value={opt}
                onChange={(e) => updateOption(idx, e.target.value)}
                placeholder="Tulisan opsi (mis. Paha, Dada)"
                containerClassName="flex-1 min-w-0"
              />
              <button
                type="button"
                onClick={() => removeOption(idx)}
                className="rounded-md p-2 text-danger-600 hover:bg-danger-50 shrink-0"
                aria-label={`Hapus opsi ${idx + 1}`}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={addOption}
        leftIcon={<Plus className="h-4 w-4" aria-hidden />}
        className="self-start"
      >
        Tambah opsi
      </Button>
    </div>
  )
}

// ============================================================
// Main component
// ============================================================

export function VariantBuilder({
  value,
  onChange,
  basePrice,
  excludeMenuName,
}: VariantBuilderProps) {
  // Sumber SKU: SEMUA menu leaf (kind=simple), termasuk nonStock & tersembunyi
  // (posVisible=false). Owner hubungkan tiap jenis ke salah satu SKU ini; lacak-stok vs
  // cuma-modal ditentukan otomatis dari stockType SKU-nya (lihat skuLink.ts). Filter
  // portion-only lama dibuang — itu yang bikin SKU nonStock (mis. modal Teh) invisible.
  const { data: allMenus = [] } = useQuery({
    queryKey: ['menus', 'variant-sku-targets'],
    queryFn: () => menuService.list({ activeOnly: false, includeHidden: true }),
    staleTime: 30_000,
  })

  const skuMenus = useMemo(
    () => allMenus.filter((m) => m.kind === 'simple' && m.name !== excludeMenuName),
    [allMenus, excludeMenuName],
  )
  const skuById = useMemo(() => {
    const map = new Map<number, Menu>()
    for (const m of skuMenus) map.set(m.id, m)
    return map
  }, [skuMenus])
  const skuOptions = useMemo<ComboboxOption[]>(() => {
    const opts = skuMenus.map((m) => ({
      value: String(m.id),
      label: m.name,
      helper: m.stockType === 'portion' ? `${m.category} · lacak stok` : m.category,
    }))
    return [{ value: '', label: '— tidak dihubungkan —' }, ...opts]
  }, [skuMenus])

  const rows = useMemo(
    () => computeVariantRows(value, basePrice),
    [value, basePrice],
  )

  const updateGroup = (idx: number, next: VariantGroupState) => {
    onChange({
      ...value,
      groups: value.groups.map((g, i) => (i === idx ? next : g)),
    })
  }

  const addGroup = () => {
    onChange({
      ...value,
      groups: [
        ...value.groups,
        { name: '', affectsVariant: true, optionLabels: [''] },
      ],
    })
  }

  const removeGroup = (idx: number) => {
    onChange({
      ...value,
      groups: value.groups.filter((_, i) => i !== idx),
    })
  }

  const setOverride = (signature: string, patch: Partial<VariantOverride>) => {
    const current =
      value.overrides[signature] ??
      (() => {
        const row = rows.find((r) => r.signature === signature)
        return {
          price: row?.price ?? basePrice,
          stockTargetMenuId: row?.stockTargetMenuId ?? null,
          costSourceMenuId: row?.costSourceMenuId ?? null,
          isActive: row?.isActive ?? true,
        }
      })()
    onChange({
      ...value,
      overrides: { ...value.overrides, [signature]: { ...current, ...patch } },
    })
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-neutral-50 border border-neutral-200 p-4">
      {/* Grup opsi */}
      <section className="flex flex-col gap-2.5">
        <div>
          <h4 className="text-body-sm font-semibold text-neutral-900">Grup Pilihan</h4>
          <p className="text-caption text-neutral-500">
            Grup "ubah harga/stok" membentuk varian otomatis di bawah. Grup
            "bebas" (mis. suhu) hanya jadi pilihan, tidak menggandakan varian.
          </p>
        </div>

        {value.groups.map((g, idx) => (
          <OptionGroupEditor
            key={idx}
            group={g}
            index={idx}
            onChange={(next) => updateGroup(idx, next)}
            onRemove={() => removeGroup(idx)}
          />
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addGroup}
          leftIcon={<Plus className="h-4 w-4" aria-hidden />}
          className="self-start"
        >
          Tambah grup
        </Button>
      </section>

      {/* Grid varian otomatis */}
      <section className="flex flex-col gap-2.5">
        <div>
          <h4 className="text-body-sm font-semibold text-neutral-900">
            Varian Otomatis
          </h4>
          <p className="text-caption text-neutral-500">
            {rows.length > 0
              ? `${rows.length} kombinasi dari grup "ubah harga/stok". Atur harga & stok target tiap baris.`
              : 'Tambah minimal 1 grup "ubah harga/stok" dengan opsi untuk membentuk varian.'}
          </p>
        </div>

        {rows.length > 0 && (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li
                key={row.signature}
                className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-white p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-body-sm font-semibold text-neutral-900">
                    {row.label}
                  </span>
                  <Checkbox
                    label="Dijual"
                    checked={row.isActive}
                    onCheckedChange={(c) =>
                      setOverride(row.signature, { isActive: c })
                    }
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    label="Harga (Rp)"
                    type="number"
                    inputMode="numeric"
                    value={row.price || ''}
                    onChange={(e) =>
                      setOverride(row.signature, {
                        price: Number(e.target.value) || 0,
                      })
                    }
                    min={0}
                    step={1000}
                    placeholder={String(basePrice)}
                    helper={`Default ${formatCurrency(basePrice)}`}
                  />
                  {/* 1 link ke SKU. stockType SKU nentuin otomatis: portion → stok
                      dikurangi + modal ikut; nonStock → cuma modal ikut. Lihat skuLink.ts. */}
                  <MenuTargetCombobox
                    value={(() => {
                      const id = currentSkuId(row)
                      return id !== null ? String(id) : ''
                    })()}
                    onChange={(v) => {
                      const sku = v ? skuById.get(Number(v)) ?? null : null
                      setOverride(row.signature, routeSkuLink(sku))
                    }}
                    options={skuOptions}
                    label="Hubungkan ke SKU"
                    placeholder="— tidak dihubungkan —"
                  />
                </div>
                {(() => {
                  const id = currentSkuId(row)
                  const sku = id !== null ? skuById.get(id) : null
                  if (!sku)
                    return (
                      <p className="text-caption text-neutral-500">
                        Belum terhubung — stok tidak dihitung, modal pakai harga menu ini.
                      </p>
                    )
                  return (
                    <p className="text-caption text-neutral-600">
                      {sku.stockType === 'portion'
                        ? `Stok: dikurangi dari ${sku.name}`
                        : 'Stok: tidak dihitung'}
                      {' · Modal: '}
                      {sku.cost != null ? formatCurrency(sku.cost) : '—'}
                    </p>
                  )
                })()}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
