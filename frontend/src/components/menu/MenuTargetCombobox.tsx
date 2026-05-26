/**
 * MenuTargetCombobox - thin wrapper Combobox yang menampilkan list menu dengan
 * stockType='portion' (calon target untuk linked/paket stockMap).
 *
 * Value yang disimpan = NAMA menu (string), bukan id. Konsisten dengan schema
 * backend yang resolve `findFirst({ name })` di transactions.service.
 */

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Combobox } from '@/design-system/primitives/Combobox'
import { menuService } from '@/services/menuService'

interface MenuTargetComboboxProps {
  value: string
  onChange: (name: string) => void
  label?: string
  hideLabel?: boolean
  placeholder?: string
  helper?: string
  error?: string
  /** Nama menu yang harus di-exclude dari pilihan (mis. menu yang sedang di-edit). */
  excludeNames?: string[]
  containerClassName?: string
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
}: MenuTargetComboboxProps) {
  const { data: menus = [], isLoading } = useQuery({
    queryKey: ['menus', 'portion-targets'],
    queryFn: () => menuService.list({ activeOnly: true }),
    staleTime: 30_000,
  })

  const options = useMemo(() => {
    const excludeSet = new Set(excludeNames)
    return menus
      .filter((m) => m.stockType === 'portion' && !excludeSet.has(m.name))
      .map((m) => ({
        value: m.name,
        label: m.name,
        helper: m.category,
      }))
  }, [menus, excludeNames])

  return (
    <Combobox
      label={label}
      hideLabel={hideLabel}
      placeholder={isLoading ? 'Memuat...' : placeholder}
      searchPlaceholder="Cari nama menu..."
      emptyText="Tidak ada menu porsi aktif"
      options={options}
      value={value}
      onValueChange={onChange}
      helper={helper}
      error={error}
      containerClassName={containerClassName}
    />
  )
}
