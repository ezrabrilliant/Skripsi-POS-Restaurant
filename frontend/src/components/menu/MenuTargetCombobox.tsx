/**
 * MenuTargetCombobox - thin wrapper Combobox untuk memilih menu stock target.
 *
 * 2 mode pemakaian:
 * - **Default (legacy, PaketBuilder name-JSON)**: tanpa prop `options`. Komponen
 *   fetch sendiri list menu stockType='portion' aktif dan value = NAMA menu
 *   (string). Konsisten dengan resolusi `findFirst({ name })` lama.
 * - **Controlled (REV 2.10 FK)**: parent mengirim `options` eksplisit (mis.
 *   value = id menu sebagai string, termasuk SKU tersembunyi). Komponen tidak
 *   fetch sendiri - tinggal render options yang dikasih.
 */

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Combobox, type ComboboxOption } from '@/design-system/primitives/Combobox'
import { menuService } from '@/services/menuService'

interface MenuTargetComboboxProps {
  value: string
  onChange: (value: string) => void
  label?: string
  hideLabel?: boolean
  placeholder?: string
  helper?: string
  error?: string
  /** Nama menu yang harus di-exclude dari pilihan (mis. menu yang sedang di-edit).
   * Hanya berlaku di mode default (self-fetch). */
  excludeNames?: string[]
  containerClassName?: string
  /** REV 2.10: kalau diisi, komponen pakai options ini apa adanya (tidak
   * self-fetch). Value yang disimpan mengikuti option.value (mis. id menu). */
  options?: ComboboxOption[]
}

export function MenuTargetCombobox({
  value,
  onChange,
  label = 'Menu Stok Target',
  hideLabel,
  placeholder = 'Pilih menu...',
  helper,
  error,
  excludeNames = [],
  containerClassName,
  options: optionsProp,
}: MenuTargetComboboxProps) {
  const controlled = optionsProp !== undefined

  const { data: menus = [], isLoading } = useQuery({
    queryKey: ['menus', 'portion-targets'],
    queryFn: () => menuService.list({ activeOnly: true }),
    staleTime: 30_000,
    enabled: !controlled,
  })

  const selfOptions = useMemo(() => {
    const excludeSet = new Set(excludeNames)
    return menus
      .filter((m) => m.stockType === 'portion' && !excludeSet.has(m.name))
      .map((m) => ({
        value: m.name,
        label: m.name,
        helper: m.category,
      }))
  }, [menus, excludeNames])

  const options = controlled ? optionsProp! : selfOptions

  return (
    <Combobox
      label={label}
      hideLabel={hideLabel}
      placeholder={!controlled && isLoading ? 'Memuat...' : placeholder}
      searchPlaceholder="Cari nama menu..."
      emptyText="Belum ada SKU"
      options={options}
      value={value}
      onValueChange={onChange}
      helper={helper}
      error={error}
      containerClassName={containerClassName}
    />
  )
}
