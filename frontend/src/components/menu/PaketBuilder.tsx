/**
 * PaketBuilder REV 2.6 - form visual untuk paket dengan struktur
 * "fixed items + choice slots".
 *
 * - **Item Tetap (fixedItems)**: menu yang selalu masuk paket. Saat order,
 *   stok portion/linked target di-decrement otomatis; nonStock cuma jadi
 *   catatan dapur.
 * - **Pilihan Customer (choices)**: slot yang customer harus pilih 1 opsi saat
 *   order paket. Tiap opsi punya label (display) + stockTarget (menu yang
 *   di-decrement, null = info-only).
 */

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { Input } from '@/design-system/primitives/Input'
import { Button } from '@/design-system/primitives/Button'
import { Combobox, type ComboboxOption } from '@/design-system/primitives/Combobox'
import { MenuTargetCombobox } from './MenuTargetCombobox'
import { menuService } from '@/services/menuService'
import type { PaketSubOptions, PaketChoice, PaketChoiceOption } from '@/types'

export type PaketBuilderValue = PaketSubOptions

interface PaketBuilderProps {
  value: PaketBuilderValue
  onChange: (next: PaketBuilderValue) => void
  /** Nama menu yang sedang di-edit (di-exclude dari pilihan target). */
  excludeMenuName?: string
}

// ============================================================
// Helpers
// ============================================================

export const emptyPaketBuilderValue: PaketBuilderValue = {
  description: '',
  fixedItems: [],
  choices: [],
}

function deriveKey(label: string, index: number): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
  return slug || `slot${index + 1}`
}

/**
 * Bangun final paket subOptions dengan key yang dedupe.
 * Backend butuh tiap choice.key unik untuk lookup subOptionsSelected.
 */
export function buildPaketFromState(state: PaketBuilderValue): PaketSubOptions {
  const used = new Set<string>()
  const choices: PaketChoice[] = state.choices.map((c, i) => {
    const base = deriveKey(c.label, i)
    let key = base
    let suffix = 1
    while (used.has(key)) {
      suffix += 1
      key = `${base}${suffix}`
    }
    used.add(key)
    return {
      key,
      label: c.label.trim(),
      options: c.options
        .map((o) => ({
          label: o.label.trim(),
          stockTarget: o.stockTarget?.trim() || null,
        }))
        .filter((o) => o.label.length > 0),
    }
  })

  return {
    description: state.description?.trim() || undefined,
    fixedItems: state.fixedItems.filter((s) => s.trim().length > 0),
    choices,
  }
}

/** Konversi backend shape -> state internal (untuk edit mode). */
export function paketToBuilderState(paket: PaketSubOptions): PaketBuilderValue {
  return {
    description: paket.description ?? '',
    fixedItems: [...(paket.fixedItems ?? [])],
    choices: (paket.choices ?? []).map((c) => ({
      key: c.key,
      label: c.label,
      options: c.options.map((o) => ({ label: o.label, stockTarget: o.stockTarget })),
    })),
  }
}

// ============================================================
// Section: Fixed items
// ============================================================

function FixedItemsSection({
  items,
  onChange,
  menuOptions,
  excludeMenuName,
}: {
  items: string[]
  onChange: (next: string[]) => void
  menuOptions: ComboboxOption[]
  excludeMenuName?: string
}) {
  const [draft, setDraft] = useState('')

  const addItem = (menuName: string) => {
    if (!menuName || items.includes(menuName)) {
      setDraft('')
      return
    }
    onChange([...items, menuName])
    setDraft('')
  }

  const removeAt = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx))
  }

  const filteredOptions = useMemo(
    () =>
      menuOptions.filter(
        (o) => o.value !== excludeMenuName && !items.includes(o.value),
      ),
    [menuOptions, excludeMenuName, items],
  )

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
        <ul className="flex flex-wrap gap-1.5">
          {items.map((item, idx) => (
            <li
              key={`${item}-${idx}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-white border border-neutral-300 pl-3 pr-1 py-1"
            >
              <span className="text-body-sm text-neutral-900">{item}</span>
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="rounded-full p-1 hover:bg-danger-50 text-danger-700"
                aria-label={`Hapus ${item}`}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Combobox
        label="Tambah menu"
        hideLabel
        value={draft}
        onValueChange={(v) => {
          setDraft(v)
          addItem(v)
        }}
        options={filteredOptions}
        placeholder="+ Tambah menu ke paket"
        searchPlaceholder="Cari menu..."
        emptyText="Semua menu sudah ditambah"
      />
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
  excludeMenuName,
  slotIndex,
}: {
  choice: PaketChoice
  onChange: (next: PaketChoice) => void
  onRemove: () => void
  excludeMenuName?: string
  slotIndex: number
}) {
  const updateOption = (idx: number, patch: Partial<PaketChoiceOption>) => {
    const next = choice.options.map((o, i) => (i === idx ? { ...o, ...patch } : o))
    onChange({ ...choice, options: next })
  }

  const addOption = () => {
    onChange({
      ...choice,
      options: [...choice.options, { label: '', stockTarget: null }],
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
          placeholder="Nama pilihan (mis. Pilih Ayam)"
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
        <ul className="flex flex-col gap-2 sm:gap-1.5">
          {choice.options.map((opt, idx) => (
            <li
              key={idx}
              className="flex flex-col gap-1.5 rounded-md bg-neutral-50 p-2 sm:bg-transparent sm:p-0 sm:grid sm:grid-cols-[1fr_1fr_auto] sm:gap-2 sm:items-center"
            >
              <div className="flex items-center gap-2 sm:contents">
                <Input
                  label="Tulisan untuk customer"
                  hideLabel
                  value={opt.label}
                  onChange={(e) => updateOption(idx, { label: e.target.value })}
                  placeholder="Tulisan customer (mis. Paha Bakar)"
                  containerClassName="flex-1 min-w-0"
                />
                <button
                  type="button"
                  onClick={() => removeOption(idx)}
                  className="rounded-md p-2 text-danger-600 hover:bg-danger-50 shrink-0 sm:order-last"
                  aria-label={`Hapus opsi ${idx + 1}`}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <MenuTargetCombobox
                value={opt.stockTarget ?? ''}
                onChange={(name) => updateOption(idx, { stockTarget: name || null })}
                label="Kurangi stok"
                hideLabel
                placeholder="Kurangi stok... (kosong = info aja)"
                excludeNames={excludeMenuName ? [excludeMenuName] : []}
                containerClassName="min-w-0"
              />
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
  const { data: menus = [] } = useQuery({
    queryKey: ['menus', 'admin', false],
    queryFn: () => menuService.list({ activeOnly: true }),
    staleTime: 30_000,
  })

  // Semua menu aktif sebagai opsi fixed item (termasuk nonStock seperti Nasi Putih).
  const allMenuOptions = useMemo<ComboboxOption[]>(
    () =>
      menus.map((m) => ({
        value: m.name,
        label: m.name,
        helper: m.category,
      })),
    [menus],
  )

  const updateChoice = (idx: number, next: PaketChoice) => {
    onChange({
      ...value,
      choices: value.choices.map((c, i) => (i === idx ? next : c)),
    })
  }

  const addChoice = () => {
    onChange({
      ...value,
      choices: [...value.choices, { key: '', label: '', options: [] }],
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
      <Input
        label="Catatan paket (opsional)"
        value={value.description ?? ''}
        onChange={(e) => onChange({ ...value, description: e.target.value })}
        placeholder="Mis. Ayam + Nasi + Sayur + Minuman"
      />

      <FixedItemsSection
        items={value.fixedItems}
        onChange={(next) => onChange({ ...value, fixedItems: next })}
        menuOptions={allMenuOptions}
        excludeMenuName={excludeMenuName}
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
            excludeMenuName={excludeMenuName}
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
