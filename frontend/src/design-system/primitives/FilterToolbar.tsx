import { useState, type ReactNode } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import { Input } from './Input'
import { Button } from './Button'
import { Sheet } from './Sheet'
import { useIsMobile } from '../hooks/useMediaQuery'

interface FilterToolbarProps {
  search: { value: string; onChange: (v: string) => void; placeholder?: string }
  filters?: ReactNode
  chipFilters?: ReactNode
  sortControl?: ReactNode
  actions?: ReactNode
  rightBadge?: ReactNode
  onReset?: () => void
  activeFilterCount?: number
}

export function FilterToolbar({ search, filters, chipFilters, sortControl, actions, rightBadge, onReset, activeFilterCount = 0 }: FilterToolbarProps) {
  const isMobile = useIsMobile()
  const [sheetOpen, setSheetOpen] = useState(false)
  const hasFilters = Boolean(filters || chipFilters)
  return (
    <div className="bg-white rounded-xl p-3 border border-neutral-200/60 space-y-2.5">
      {(actions || rightBadge) && (
        <div className="flex items-center gap-2 flex-wrap">
          {actions}
          {rightBadge && <div className="ml-auto">{rightBadge}</div>}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input label="Cari" hideLabel type="search" inputMode="search" value={search.value} onChange={(e) => search.onChange(e.target.value)} placeholder={search.placeholder ?? 'Cari…'} leftIcon={<Search className="w-4 h-4" />} containerClassName="flex-1" />
        {isMobile && sortControl}
        {isMobile && hasFilters && (
          <Button variant="outline" size="md" leftIcon={<SlidersHorizontal className="w-4 h-4" />} onClick={() => setSheetOpen(true)} className="shrink-0">
            Filter{activeFilterCount > 0 ? ' (' + activeFilterCount + ')' : ''}
          </Button>
        )}
      </div>
      {!isMobile && hasFilters && (
        <div className="space-y-2.5">
          {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}
          {chipFilters}
        </div>
      )}
      {isMobile && (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen} title="Filter">
          <div className="px-4 py-3 space-y-3">
            {filters}
            {chipFilters}
            <div className="flex gap-2 pt-2">
              {onReset && <Button variant="outline" size="md" fullWidth onClick={onReset}>Reset</Button>}
              <Button variant="primary" size="md" fullWidth onClick={() => setSheetOpen(false)}>Terapkan</Button>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  )
}
