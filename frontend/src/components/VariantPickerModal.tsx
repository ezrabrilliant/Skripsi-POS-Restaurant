// REV 2.10 VariantPickerModal - generic POS picker driven by menu.kind.
// Menggantikan SubOptionsModal (paket berbasis nama → data-driven catalog layer).
//
// 3 mode by menu.kind:
//   - 'variant': 1 group block per optionGroup (ordered displayOrder), pilih 1 opsi
//     per group. Grup affectsVariant=true menentukan MenuVariant (match by optionId set
//     EXACT). Grup affectsVariant=false = free-preference (mis. Suhu) - tidak pengaruh
//     varian, dikumpulkan jadi preferences[]. Confirm disabled sampai semua grup terisi
//     dan ada varian yang match. Harga live = varian yang match.
//   - 'paket': komponen fixed read-only (label + qty); tiap komponen choice = group block
//     dari choiceOptions (pilih 1). Kalau targetMenu opsi adalah kind=variant, buka
//     VariantPickerModal NESTED untuk capture sub-varian. Bentuk paketChoices
//     { [slotLabel]: { targetMenuId, variantId?, chosenLabel } }. unitPrice = paket base.
//   - 'simple': biasanya tidak dibuka (MenuGrid addItem langsung). Kalau dibuka, confirm
//     dengan { menuId, unitPrice: menu.price, displayLabel: menu.name }.
//
// Kalau menu tidak punya nested catalog (optionGroups/variants/paketComponents
// undefined), fetch menuService.detail(menu.id) via React Query + loading state.
//
// Tone/typography mengikuti SubOptionsModal lama + PaymentModal: Dialog primitive,
// button grid min-h-[44px], text-label group header, footer Button primary fullWidth.

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import type { Menu, MenuVariant } from '@/types'
import { menuService } from '@/services/menuService'
import { formatCurrency, cn } from '@/lib/utils'
import { Dialog, Button, Skeleton } from '@/design-system/primitives'

/** REV 2.10: hasil VariantPickerModal yang dikirim ke parent (POSPage → addItem). */
export interface VariantPickResult {
  menuId: number
  /** Harga per unit untuk cart line (varian = varian.price; paket = base; simple = menu.price). */
  unitPrice: number
  /** Label display di cart row. */
  displayLabel: string
  /** Set untuk menu varian. */
  variantId?: number | null
  variantLabel?: string | null
  /** Set untuk menu paket - 1 entry per slot choice. */
  paketChoices?: Record<
    string,
    { targetMenuId: number; variantId?: number | null; chosenLabel: string }
  >
  /** Free-preference (grup affectsVariant=false). */
  preferences?: { groupLabel: string; chosenLabel: string }[]
}

interface Props {
  menu: Menu
  onConfirm: (result: VariantPickResult) => void
  onClose: () => void
}

/** Cek apakah catalog layer sudah ter-include di menu (list pakai menuDetailInclude). */
function hasCatalog(menu: Menu): boolean {
  return (
    menu.optionGroups !== undefined &&
    menu.variants !== undefined &&
    menu.paketComponents !== undefined
  )
}

export default function VariantPickerModal({ menu, onConfirm, onClose }: Props) {
  // Kalau menu list belum bawa nested catalog, fetch detail. Umumnya sudah ada
  // (backend list pakai menuDetailInclude) → query disabled, langsung pakai menu prop.
  const needsFetch = !hasCatalog(menu)
  const { data: fetched, isLoading } = useQuery({
    queryKey: ['menu', 'detail', menu.id],
    queryFn: () => menuService.detail(menu.id),
    enabled: needsFetch,
  })

  const resolved = needsFetch ? fetched : menu

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={menu.name}
      description={
        <span className="tabular-nums">
          {formatCurrency(menu.price)}
          {menu.kind === 'paket' ? ' · Paket' : menu.kind === 'variant' ? ' · Varian' : ''}
        </span>
      }
      size="md"
    >
      {needsFetch && isLoading ? (
        <div className="space-y-3 py-2">
          <Skeleton className="h-5 w-32" rounded="md" />
          <Skeleton className="h-11 w-full" rounded="lg" />
          <Skeleton className="h-11 w-full" rounded="lg" />
        </div>
      ) : !resolved ? (
        <p className="text-body-sm text-neutral-600 py-4">Gagal memuat detail menu.</p>
      ) : (
        <PickerBody menu={resolved} onConfirm={onConfirm} onClose={onClose} />
      )}
    </Dialog>
  )
}

// ============================================================
// PickerBody - render setelah catalog tersedia (resolved menu).
// Footer button + content keduanya di dalam Dialog children supaya state
// (selection) bisa drive enable/disable confirm. Footer Dialog tidak dipakai
// karena butuh akses ke selection state — pakai sticky button di akhir body.
// ============================================================

function PickerBody({
  menu,
  onConfirm,
  onClose,
}: {
  menu: Menu
  onConfirm: (result: VariantPickResult) => void
  onClose: () => void
}) {
  if (menu.kind === 'variant') {
    return <VariantPicker menu={menu} onConfirm={onConfirm} />
  }
  if (menu.kind === 'paket') {
    return <PaketPicker menu={menu} onConfirm={onConfirm} />
  }
  // simple - jarang dibuka. Confirm langsung.
  return (
    <div className="space-y-4">
      <p className="text-body-sm text-neutral-600">
        Menu ini tidak punya pilihan tambahan.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="md" fullWidth onClick={onClose}>
          Batal
        </Button>
        <Button
          variant="primary"
          size="md"
          fullWidth
          onClick={() =>
            onConfirm({ menuId: menu.id, unitPrice: menu.price, displayLabel: menu.name })
          }
        >
          Tambah ke Pesanan
        </Button>
      </div>
    </div>
  )
}

// ============================================================
// Shared: option button grid (sama style dengan SubOptionsModal lama).
// ============================================================

function OptionGrid({
  options,
  selectedKey,
  onSelect,
}: {
  options: { key: string; label: string; sub?: string }[]
  selectedKey: string | null
  onSelect: (key: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isActive = selectedKey === opt.key
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onSelect(opt.key)}
            aria-pressed={isActive}
            className={cn(
              'min-h-[44px] px-4 py-2 rounded-lg border text-body-sm font-medium transition-colors text-left',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
              isActive
                ? 'bg-primary-50 border-primary-500 text-primary-800 ring-1 ring-primary-500/40'
                : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50 active:bg-neutral-100',
            )}
          >
            <span>{opt.label}</span>
            {opt.sub && (
              <span className="block text-caption font-normal text-neutral-500 tabular-nums">
                {opt.sub}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ============================================================
// VariantPicker - menu kind=variant.
// ============================================================

function VariantPicker({
  menu,
  onConfirm,
}: {
  menu: Menu
  onConfirm: (result: VariantPickResult) => void
}) {
  const groups = useMemo(
    () => [...(menu.optionGroups ?? [])].sort((a, b) => a.displayOrder - b.displayOrder),
    [menu.optionGroups],
  )
  // REV 2.10 P7: varian nonaktif (isActive=false) tidak boleh ikut matching/selection.
  const variants = useMemo(
    () => (menu.variants ?? []).filter((v) => v.isActive !== false),
    [menu.variants],
  )

  // selection: { groupId -> optionId }
  const [selection, setSelection] = useState<Record<number, number>>({})

  const handleSelect = (groupId: number, optionId: number) => {
    setSelection((prev) => ({ ...prev, [groupId]: optionId }))
  }

  // Resolve matched variant: set chosen optionId dari grup affectsVariant=true
  // harus EXACT EQUAL dengan variant.optionIds set.
  const matchedVariant: MenuVariant | null = useMemo(() => {
    const variantGroups = groups.filter((g) => g.affectsVariant)
    // Semua grup affectsVariant harus sudah dipilih.
    if (variantGroups.some((g) => selection[g.id] === undefined)) return null
    const chosenIds = variantGroups
      .map((g) => selection[g.id]!)
      .slice()
      .sort((a, b) => a - b)
    return (
      variants.find((v) => {
        if (v.optionIds.length !== chosenIds.length) return false
        const sorted = [...v.optionIds].sort((a, b) => a - b)
        return sorted.every((id, i) => id === chosenIds[i])
      }) ?? null
    )
  }, [groups, variants, selection])

  // Preferences dari grup affectsVariant=false.
  const preferences = useMemo(() => {
    return groups
      .filter((g) => !g.affectsVariant)
      .map((g) => {
        const optId = selection[g.id]
        const opt = g.options.find((o) => o.id === optId)
        return opt ? { groupLabel: g.name, chosenLabel: opt.label } : null
      })
      .filter((p): p is { groupLabel: string; chosenLabel: string } => p !== null)
  }, [groups, selection])

  // Semua grup (variant + preference) harus terisi (kalau punya opsi).
  const allGroupsChosen = groups.every(
    (g) => g.options.length === 0 || selection[g.id] !== undefined,
  )
  const canConfirm = allGroupsChosen && matchedVariant !== null

  const handleConfirm = () => {
    if (!matchedVariant) return
    onConfirm({
      menuId: menu.id,
      variantId: matchedVariant.id,
      unitPrice: matchedVariant.price,
      variantLabel: matchedVariant.label,
      displayLabel: matchedVariant.label,
      preferences: preferences.length > 0 ? preferences : undefined,
    })
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.id}>
          <p className="text-label text-neutral-700 mb-2">{group.name}</p>
          <OptionGrid
            options={[...group.options]
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map((o) => ({ key: String(o.id), label: o.label }))}
            selectedKey={
              selection[group.id] !== undefined ? String(selection[group.id]) : null
            }
            onSelect={(key) => handleSelect(group.id, Number(key))}
          />
        </div>
      ))}

      {/* Harga live varian yang match */}
      <div className="flex items-baseline justify-between border-t border-neutral-200 pt-3">
        <span className="text-body-sm text-neutral-600">Harga</span>
        <span className="text-title font-semibold text-neutral-900 tabular-nums">
          {matchedVariant ? formatCurrency(matchedVariant.price) : '—'}
        </span>
      </div>
      {/* REV 2.10 P7: semua grup terpilih tapi tidak ada varian AKTIF yang match. */}
      {!matchedVariant && allGroupsChosen && (
        <p className="text-caption text-warning-700">Kombinasi ini tidak tersedia</p>
      )}

      <Button
        variant="primary"
        size="md"
        fullWidth
        disabled={!canConfirm}
        onClick={handleConfirm}
      >
        Tambah ke Pesanan
      </Button>
    </div>
  )
}

// ============================================================
// PaketPicker - menu kind=paket.
// ============================================================

function PaketPicker({
  menu,
  onConfirm,
}: {
  menu: Menu
  onConfirm: (result: VariantPickResult) => void
}) {
  const components = useMemo(
    () => [...(menu.paketComponents ?? [])].sort((a, b) => a.displayOrder - b.displayOrder),
    [menu.paketComponents],
  )
  const fixedComponents = components.filter((c) => c.kind === 'fixed')
  const choiceComponents = components.filter((c) => c.kind === 'choice')

  // selection per choice slot: { componentId -> optionId }
  const [selection, setSelection] = useState<Record<number, number>>({})
  // sub-variant pick per slot (kalau opsi target adalah menu varian): { componentId -> {variantId, variantLabel} }
  const [subPicks, setSubPicks] = useState<
    Record<number, { variantId: number; variantLabel: string }>
  >({})
  // nested picker target: menu varian + komponen yang sedang dipilih sub-variannya.
  const [nestedTarget, setNestedTarget] = useState<{
    componentId: number
    targetMenuId: number
  } | null>(null)

  const handleSelectOption = (componentId: number, optionId: number, targetMenuId: number | null) => {
    setSelection((prev) => ({ ...prev, [componentId]: optionId }))
    // Reset sub-pick lama untuk slot ini saat ganti opsi.
    setSubPicks((prev) => {
      const next = { ...prev }
      delete next[componentId]
      return next
    })
    // Kalau target adalah menu (cek di nested fetch kalau varian).
    if (targetMenuId != null) {
      // Buka nested picker - VariantPickerModal nested akan fetch detail + tahu
      // apakah kind=variant. Kalau bukan variant, nested onConfirm balik tanpa variantId.
      setNestedTarget({ componentId, targetMenuId })
    }
  }

  const handleNestedConfirm = (componentId: number, result: VariantPickResult) => {
    if (result.variantId != null && result.variantLabel) {
      setSubPicks((prev) => ({
        ...prev,
        [componentId]: { variantId: result.variantId!, variantLabel: result.variantLabel! },
      }))
    }
    setNestedTarget(null)
  }

  // Semua choice slot harus terpilih.
  const allChoicesChosen = choiceComponents.every(
    (c) => c.choiceOptions.length === 0 || selection[c.id] !== undefined,
  )

  const handleConfirm = () => {
    const paketChoices: Record<
      string,
      { targetMenuId: number; variantId?: number | null; chosenLabel: string }
    > = {}
    for (const comp of choiceComponents) {
      const optId = selection[comp.id]
      const opt = comp.choiceOptions.find((o) => o.id === optId)
      if (!opt || opt.targetMenuId == null) continue
      const sub = subPicks[comp.id]
      paketChoices[comp.label] = {
        targetMenuId: opt.targetMenuId,
        variantId: sub?.variantId ?? opt.targetVariantId ?? null,
        chosenLabel: opt.label,
      }
    }
    onConfirm({
      menuId: menu.id,
      unitPrice: menu.price, // paket base; sub-picks tidak ubah harga paket.
      displayLabel: menu.name,
      paketChoices: Object.keys(paketChoices).length > 0 ? paketChoices : undefined,
    })
  }

  return (
    <div className="space-y-4">
      {/* Komponen fixed (read-only) */}
      {fixedComponents.length > 0 && (
        <div>
          <p className="text-label text-neutral-700 mb-2">Item Termasuk</p>
          <ul className="flex flex-col gap-1">
            {fixedComponents.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-2 text-body-sm text-neutral-800"
              >
                <Check className="h-4 w-4 text-success-600 shrink-0" aria-hidden />
                <span>
                  {c.label}
                  {c.qty > 1 && (
                    <span className="text-neutral-500 tabular-nums"> ×{c.qty}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Komponen choice (slot pilihan) */}
      {choiceComponents.map((comp) => {
        const chosenOptId = selection[comp.id]
        const sub = subPicks[comp.id]
        return (
          <div key={comp.id}>
            <p className="text-label text-neutral-700 mb-2">
              {comp.label}
              {comp.qty > 1 && (
                <span className="text-neutral-500 tabular-nums"> (×{comp.qty})</span>
              )}
            </p>
            <OptionGrid
              options={comp.choiceOptions.map((o) => ({
                key: String(o.id),
                label: o.label,
                sub: o.upcharge > 0 ? `+${formatCurrency(o.upcharge)}` : undefined,
              }))}
              selectedKey={chosenOptId !== undefined ? String(chosenOptId) : null}
              onSelect={(key) => {
                const opt = comp.choiceOptions.find((o) => o.id === Number(key))
                handleSelectOption(comp.id, Number(key), opt?.targetMenuId ?? null)
              }}
            />
            {sub && (
              <p className="text-caption text-primary-700 mt-1.5">
                Varian: {sub.variantLabel}
              </p>
            )}
          </div>
        )
      })}

      <Button
        variant="primary"
        size="md"
        fullWidth
        disabled={!allChoicesChosen}
        onClick={handleConfirm}
      >
        Tambah ke Pesanan
      </Button>

      {/* Nested variant picker untuk slot yang target-nya menu varian. */}
      {nestedTarget && (
        <NestedVariantLoader
          targetMenuId={nestedTarget.targetMenuId}
          onConfirm={(result) => handleNestedConfirm(nestedTarget.componentId, result)}
          onClose={() => setNestedTarget(null)}
        />
      )}
    </div>
  )
}

// ============================================================
// NestedVariantLoader - fetch target menu detail; kalau kind=variant buka
// VariantPickerModal nested, kalau bukan langsung confirm tanpa varian (close).
// ============================================================

function NestedVariantLoader({
  targetMenuId,
  onConfirm,
  onClose,
}: {
  targetMenuId: number
  onConfirm: (result: VariantPickResult) => void
  onClose: () => void
}) {
  const { data: targetMenu, isLoading } = useQuery({
    queryKey: ['menu', 'detail', targetMenuId],
    queryFn: () => menuService.detail(targetMenuId),
  })

  // Loading: tampilkan dialog kecil placeholder.
  if (isLoading || !targetMenu) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()} title="Memuat varian…" size="sm">
        <div className="space-y-3 py-2">
          <Skeleton className="h-11 w-full" rounded="lg" />
          <Skeleton className="h-11 w-full" rounded="lg" />
        </div>
      </Dialog>
    )
  }

  // Target bukan menu varian → tidak perlu sub-pick. Tutup loader (selection sudah
  // tercatat di paket level lewat opsi yang dipilih).
  if (targetMenu.kind !== 'variant') {
    onClose()
    return null
  }

  return <VariantPickerModal menu={targetMenu} onConfirm={onConfirm} onClose={onClose} />
}
