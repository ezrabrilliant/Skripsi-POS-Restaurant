// REV 2.8.1: filter tipe stok menu - checkbox-chip multi-select. Dipakai di tab
// Stok Porsi (PortionStockTab) dan halaman Kelola Menu (MenuPage) agar konsisten.

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StockType } from '@/types'

export const MENU_TYPE_META: { value: StockType; label: string }[] = [
  { value: 'portion', label: 'Stok porsi' },
  { value: 'linked', label: 'Ikut menu lain' },
  { value: 'nonStock', label: 'Tidak di-track' },
]

interface MenuTypeFilterProps {
  selected: Set<StockType>
  counts: Record<StockType, number>
  onToggle: (t: StockType) => void
}

export function MenuTypeFilter({ selected, counts, onToggle }: MenuTypeFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-label text-neutral-500 mr-0.5">Tipe:</span>
      {MENU_TYPE_META.map((t) => {
        const active = selected.has(t.value)
        return (
          <button
            key={t.value}
            type="button"
            role="checkbox"
            aria-checked={active}
            onClick={() => onToggle(t.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border h-8 pl-1.5 pr-3 text-body-sm transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30',
              active
                ? 'border-primary-500 bg-primary-50 text-primary-800'
                : 'border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400'
            )}
          >
            <span
              className={cn(
                'flex h-4 w-4 items-center justify-center rounded border',
                active ? 'border-primary-600 bg-primary-600 text-white' : 'border-neutral-300'
              )}
            >
              {active && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
            {t.label}
            <span className="text-caption text-neutral-400 tabular-nums">{counts[t.value]}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Helper toggle untuk Set<StockType> (dipakai bersama useState). */
export function toggleStockType(prev: Set<StockType>, t: StockType): Set<StockType> {
  const next = new Set(prev)
  if (next.has(t)) next.delete(t)
  else next.add(t)
  return next
}
