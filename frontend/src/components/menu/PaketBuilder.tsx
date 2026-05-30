/**
 * PaketBuilder REV 2.10 — form visual untuk menu kind=paket dengan komponen
 * berbasis FK (targetMenuId), menggantikan shape name-JSON legacy.
 *
 * Emit/consume `PaketComponentUpsertPayload[]`:
 * - **Item Tetap (kind='fixed')**: menu yang selalu masuk paket + qty.
 *   targetMenuId = menu yang stoknya di-decrement (portion/linked); nonStock
 *   target = info-only.
 * - **Slot Pilihan (kind='choice')**: customer pilih 1 opsi. choiceOptions =
 *   list { label, targetMenuId, upcharge }. targetVariantId dibiarkan null
 *   untuk sekarang.
 */

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { Input } from '@/design-system/primitives/Input'
import { Button } from '@/design-system/primitives/Button'
import { Combobox, type ComboboxOption } from '@/design-system/primitives/Combobox'
import { menuService } from '@/services/menuService'
import type { Menu } from '@/types'
import type {
  PaketComponentUpsertPayload,
  PaketChoiceOptionUpsertPayload,
} from '@/types'

// ============================================================
// Working state (round-trips ke PaketComponentUpsertPayload[])
// ============================================================

export interface PaketFixedState {
  targetMenuId: number | null
  qty: number
}

export interface PaketChoiceOptionState {
  label: string
  targetMenuId: number | null
  upcharge: number
}

export interface PaketChoiceState {
  label: string
  options: PaketChoiceOptionState[]
}

export interface PaketBuilderValue {
  fixedItems: PaketFixedState[]
  choices: PaketChoiceState[]
}

interface PaketBuilderProps {
  value: PaketBuilderValue
  onChange: (next: PaketBuilderValue) => void
  /** Nama menu yang sedang di-edit (di-exclude dari pilihan target). */
  excludeMenuName?: string
}

// ============================================================
// Helpers (round-trip)
// ============================================================

export const emptyPaketBuilderValue: PaketBuilderValue = {
  fixedItems: [],
  choices: [],
}

/**
 * Bangun payload FK final (fixed dulu, lalu choices) dengan displayOrder.
 *
 * Backend `paketComponentSchema.label` wajib non-empty untuk SEMUA komponen,
 * termasuk fixed. Fixed item label di-derive dari nama menu target via
 * `menuNameById` (fallback "Item" kalau tak ketemu).
 */
export function buildPaketComponentsPayload(
  state: PaketBuilderValue,
  menuNameById: Map<number, string> = new Map(),
): PaketComponentUpsertPayload[] {
  const components: PaketComponentUpsertPayload[] = []
  let order = 0

  for (const f of state.fixedItems) {
    if (f.targetMenuId === null) continue
    components.push({
      kind: 'fixed',
      label: menuNameById.get(f.targetMenuId) || 'Item',
      qty: f.qty > 0 ? f.qty : 1,
      displayOrder: order++,
      targetMenuId: f.targetMenuId,
      targetVariantId: null,
      choiceOptions: [],
    })
  }

  for (const c of state.choices) {
    const choiceOptions: PaketChoiceOptionUpsertPayload[] = c.options
      .filter((o) => o.label.trim())
      .map((o) => ({
        label: o.label.trim(),
        targetMenuId: o.targetMenuId,
        targetVariantId: null,
        upcharge: o.upcharge > 0 ? o.upcharge : 0,
      }))
    components.push({
      kind: 'choice',
      label: c.label.trim(),
      qty: 1,
      displayOrder: order++,
      targetMenuId: null,
      targetVariantId: null,
      choiceOptions,
    })
  }

  return components
}

/** Konversi Menu detail (paketComponents) -> editor state (edit mode). */
export function menuToPaketBuilderState(menu: Menu): PaketBuilderValue {
  const comps = (menu.paketComponents ?? [])
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)

  const fixedItems: PaketFixedState[] = comps
    .filter((c) => c.kind === 'fixed')
    .map((c) => ({ targetMenuId: c.targetMenuId, qty: c.qty > 0 ? c.qty : 1 }))

  const choices: PaketChoiceState[] = comps
    .filter((c) => c.kind === 'choice')
    .map((c) => ({
      label: c.label,
      options: c.choiceOptions.map((o) => ({
        label: o.label,
        targetMenuId: o.targetMenuId,
        upcharge: o.upcharge,
      })),
    }))

  return { fixedItems, choices }
}

// ============================================================
// Section: Fixed items
// ============================================================

function FixedItemsSection({
  items,
  onChange,
  menuOptions,
}: {
  items: PaketFixedState[]
  onChange: (next: PaketFixedState[]) => void
  menuOptions: ComboboxOption[]
}) {
  const updateAt = (idx: number, patch: Partial<PaketFixedState>) => {
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  const addItem = () => {
    onChange([...items, { targetMenuId: null, qty: 1 }])
  }

  const removeAt = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx))
  }

  return (
    <section className="flex flex-col gap-2.5">
      <div>
        <h4 className="text-body-sm font-semibold text-neutral-900">
          Yang Selalu Masuk
        </h4>
        <p className="text-caption text-neutral-500">
          Stok otomatis terhitung tiap paket terjual.
        </p>
      </div>

      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((item, idx) => (
            <li
              key={idx}
              className="flex items-end gap-2 rounded-md border border-neutral-200 bg-white p-2.5"
            >
              <Combobox
                label="Menu"
                value={item.targetMenuId !== null ? String(item.targetMenuId) : ''}
                onValueChange={(v) =>
                  updateAt(idx, { targetMenuId: v ? Number(v) : null })
                }
                options={menuOptions}
                placeholder="Pilih menu..."
                searchPlaceholder="Cari menu..."
                emptyText="Tidak ada menu"
                containerClassName="flex-1 min-w-0"
              />
              <Input
                label="Qty"
                type="number"
                inputMode="numeric"
                value={item.qty || ''}
                onChange={(e) => updateAt(idx, { qty: Number(e.target.value) || 0 })}
                min={1}
                placeholder="1"
                containerClassName="w-20 shrink-0"
              />
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="rounded-md p-2.5 text-danger-600 hover:bg-danger-50 shrink-0"
                aria-label={`Hapus item tetap ${idx + 1}`}
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
        onClick={addItem}
        leftIcon={<Plus className="h-4 w-4" aria-hidden />}
        className="self-start"
      >
        Tambah item tetap
      </Button>
    </section>
  )
}

// ============================================================
// Section: Choice slot editor
// ============================================================

function ChoiceSlotEditor({
  choice,
  onChange,
  onRemove,
  menuOptions,
  slotIndex,
}: {
  choice: PaketChoiceState
  onChange: (next: PaketChoiceState) => void
  onRemove: () => void
  menuOptions: ComboboxOption[]
  slotIndex: number
}) {
  const updateOption = (idx: number, patch: Partial<PaketChoiceOptionState>) => {
    const next = choice.options.map((o, i) => (i === idx ? { ...o, ...patch } : o))
    onChange({ ...choice, options: next })
  }

  const addOption = () => {
    onChange({
      ...choice,
      options: [...choice.options, { label: '', targetMenuId: null, upcharge: 0 }],
    })
  }

  const removeOption = (idx: number) => {
    onChange({
      ...choice,
      options: choice.options.filter((_, i) => i !== idx),
    })
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <Input
          label={`Pilihan ${slotIndex + 1}`}
          hideLabel
          value={choice.label}
          onChange={(e) => onChange({ ...choice, label: e.target.value })}
          placeholder="Nama pilihan (mis. Pilih Minuman)"
          containerClassName="flex-1"
        />
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md p-2 text-danger-600 hover:bg-danger-50"
          aria-label={`Hapus pilihan ${slotIndex + 1}`}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {choice.options.length > 0 && (
        <ul className="flex flex-col gap-2">
          {choice.options.map((opt, idx) => (
            <li
              key={idx}
              className="flex flex-col gap-2 rounded-md bg-neutral-50 p-2"
            >
              <div className="flex items-center gap-2">
                <Input
                  label="Tulisan untuk customer"
                  hideLabel
                  value={opt.label}
                  onChange={(e) => updateOption(idx, { label: e.target.value })}
                  placeholder="Tulisan customer (mis. Teh Manis)"
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
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Combobox
                  label="Kurangi stok"
                  hideLabel
                  value={
                    opt.targetMenuId !== null ? String(opt.targetMenuId) : ''
                  }
                  onValueChange={(v) =>
                    updateOption(idx, { targetMenuId: v ? Number(v) : null })
                  }
                  options={menuOptions}
                  placeholder="Kurangi stok... (kosong = info aja)"
                  searchPlaceholder="Cari menu..."
                  emptyText="Tidak ada menu"
                  containerClassName="min-w-0"
                />
                <Input
                  label="Tambahan harga"
                  hideLabel
                  type="number"
                  inputMode="numeric"
                  value={opt.upcharge || ''}
                  onChange={(e) =>
                    updateOption(idx, { upcharge: Number(e.target.value) || 0 })
                  }
                  min={0}
                  step={1000}
                  placeholder="Tambahan harga (0)"
                  containerClassName="min-w-0"
                />
              </div>
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

export function PaketBuilder({ value, onChange, excludeMenuName }: PaketBuilderProps) {
  // Semua menu (incl. hidden SKU) sebagai pilihan target paket — owner perlu
  // bisa arahkan ke nonStock (Nasi Putih) maupun SKU stok granular.
  const { data: menus = [] } = useQuery({
    queryKey: ['menus', 'paket-targets'],
    queryFn: () => menuService.list({ activeOnly: false, includeHidden: true }),
    staleTime: 30_000,
  })

  const menuOptions = useMemo<ComboboxOption[]>(
    () =>
      menus
        .filter((m) => m.name !== excludeMenuName)
        .map((m) => ({ value: String(m.id), label: m.name, helper: m.category })),
    [menus, excludeMenuName],
  )

  const updateChoice = (idx: number, next: PaketChoiceState) => {
    onChange({
      ...value,
      choices: value.choices.map((c, i) => (i === idx ? next : c)),
    })
  }

  const addChoice = () => {
    onChange({
      ...value,
      choices: [...value.choices, { label: '', options: [] }],
    })
  }

  const removeChoice = (idx: number) => {
    onChange({
      ...value,
      choices: value.choices.filter((_, i) => i !== idx),
    })
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-neutral-50 border border-neutral-200 p-4">
      <FixedItemsSection
        items={value.fixedItems}
        onChange={(next) => onChange({ ...value, fixedItems: next })}
        menuOptions={menuOptions}
      />

      <section className="flex flex-col gap-2.5">
        <div>
          <h4 className="text-body-sm font-semibold text-neutral-900">
            Pilihan Customer
          </h4>
          <p className="text-caption text-neutral-500">
            Customer pilih 1 opsi tiap pilihan saat order.
          </p>
        </div>

        {value.choices.map((c, idx) => (
          <ChoiceSlotEditor
            key={idx}
            choice={c}
            onChange={(next) => updateChoice(idx, next)}
            onRemove={() => removeChoice(idx)}
            menuOptions={menuOptions}
            slotIndex={idx}
          />
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addChoice}
          leftIcon={<Plus className="h-4 w-4" aria-hidden />}
          className="self-start"
        >
          Tambah Pilihan
        </Button>
      </section>
    </div>
  )
}
