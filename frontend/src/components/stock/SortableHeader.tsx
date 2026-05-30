// REV 2.8: header kolom DataTable yang bisa diklik untuk sort. DataTable tidak
// punya sort bawaan - data di-sort di luar (useStockListControls), komponen ini
// hanya UI header + indikator arah + aria-sort.

import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StockSortDir } from './useStockListControls'

interface SortableHeaderProps {
  label: string
  active: boolean
  dir: StockSortDir
  onSort: () => void
  align?: 'left' | 'right'
}

export function SortableHeader({ label, active, dir, onSort, align = 'left' }: SortableHeaderProps) {
  return (
    <button
      type="button"
      onClick={onSort}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn(
        'inline-flex items-center gap-1 text-label font-semibold transition-colors',
        'hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 rounded',
        active ? 'text-primary-700' : 'text-neutral-600',
        align === 'right' && 'flex-row-reverse'
      )}
    >
      <span>{label}</span>
      {active ? (
        dir === 'asc' ? (
          <ArrowUp className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <ArrowDown className="h-3.5 w-3.5" aria-hidden />
        )
      ) : (
        <ChevronsUpDown className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
      )}
    </button>
  )
}
