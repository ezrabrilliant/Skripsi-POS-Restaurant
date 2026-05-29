// REV 2.8: toolbar filter+sort untuk halaman Stok (dipakai PortionStockTab &
// RawMaterialsTab). Mobile-first: desktop inline, mobile sekunder masuk Sheet
// (pola HistoryPage). Search selalu terlihat. Sort desktop via header kolom
// (SortableHeader); mobile via Select di sini (card mobile tak punya header).

import { type ReactNode, useState } from 'react'
import { Filter, Search } from 'lucide-react'
import { Button, Combobox, Input, Sheet } from '@/design-system/primitives'
import { useIsMobile } from '@/design-system/hooks/useMediaQuery'
import type {
  OpnameStatusFilter,
  StockSortDir,
  StockSortKey,
  StockStatusFilter,
} from './useStockListControls'

interface ToolbarControls {
  search: string
  setSearch: (v: string) => void
  category: string
  setCategory: (v: string) => void
  categoryOptions: { value: string; label: string }[]
  statusFilter: StockStatusFilter
  setStatusFilter: (v: StockStatusFilter) => void
  opnameStatus: OpnameStatusFilter
  setOpnameStatus: (v: OpnameStatusFilter) => void
  sortKey: StockSortKey
  setSort: (k: StockSortKey) => void
  sortDir: StockSortDir
  resetFilters: () => void
  activeFilterCount: number
}

interface StockFilterToolbarProps {
  controls: ToolbarControls
  /** Tombol aksi spesifik tab (Restock Pagi / Opname / Tambah Bahan). */
  children?: ReactNode
  /** Badge hitung kanan (lowCount / reminderCount). */
  rightBadge?: ReactNode
  /** Slot owner-only (mis. checkbox "Tampilkan nonaktif" raw material). */
  ownerSlot?: ReactNode
  /** Slot filter tambahan spesifik tab (mis. filter Tipe menu di tab Porsi). */
  extraFilters?: ReactNode
  searchPlaceholder?: string
}

const STATUS_OPTIONS: { value: StockStatusFilter; label: string }[] = [
  { value: 'all', label: 'Semua status' },
  { value: 'aman', label: 'Aman' },
  { value: 'rendah', label: 'Rendah' },
  { value: 'habis', label: 'Habis' },
]

const OPNAME_OPTIONS: { value: OpnameStatusFilter; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'sudah', label: 'Sudah dicek hari ini' },
  { value: 'belum', label: 'Belum dicek hari ini' },
]

// Mobile sort: 1 opsi per kolom dengan arah natural-nya.
const SORT_OPTIONS: { value: StockSortKey; label: string }[] = [
  { value: 'category', label: 'Kategori' },
  { value: 'name', label: 'Nama (A–Z)' },
  { value: 'qty', label: 'Stok (sedikit dulu)' },
  { value: 'lastStocked', label: 'Terakhir di-stok (lama dulu)' },
]

export function StockFilterToolbar({
  controls,
  children,
  rightBadge,
  ownerSlot,
  extraFilters,
  searchPlaceholder = 'Cari nama…',
}: StockFilterToolbarProps) {
  const isMobile = useIsMobile()
  const [sheetOpen, setSheetOpen] = useState(false)

  const c = controls

  // Field filter dipakai di desktop inline & di mobile Sheet.
  const filterFields = (
    <>
      <Combobox
        label="Kategori"
        hideLabel
        value={c.category}
        onValueChange={c.setCategory}
        options={c.categoryOptions}
        placeholder="Semua kategori"
        containerClassName="min-w-[10rem]"
      />
      <Combobox
        label="Status stok"
        hideLabel
        value={c.statusFilter}
        onValueChange={(v) => c.setStatusFilter(v as StockStatusFilter)}
        options={STATUS_OPTIONS}
        containerClassName="min-w-[9rem]"
      />
      <Combobox
        label="Status opname"
        hideLabel
        value={c.opnameStatus}
        onValueChange={(v) => c.setOpnameStatus(v as OpnameStatusFilter)}
        options={OPNAME_OPTIONS}
        containerClassName="min-w-[11rem]"
      />
      {ownerSlot}
    </>
  )

  return (
    <div className="bg-white rounded-xl p-3 border border-neutral-200/60 space-y-2.5">
      {/* Baris aksi + badge + (mobile) tombol Filter */}
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <div className="ml-auto flex items-center gap-2">
          {rightBadge}
          {isMobile && (
            <Button
              variant="outline"
              size="md"
              leftIcon={<Filter className="w-4 h-4" />}
              onClick={() => setSheetOpen(true)}
            >
              Filter{c.activeFilterCount > 0 ? ` (${c.activeFilterCount})` : ''}
            </Button>
          )}
        </div>
      </div>

      {/* Search selalu terlihat + (mobile) sort Select */}
      <div className="flex items-center gap-2">
        <Input
          label="Cari"
          hideLabel
          type="search"
          inputMode="search"
          value={c.search}
          onChange={(e) => c.setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          leftIcon={<Search className="w-4 h-4" />}
          containerClassName="flex-1"
        />
        {isMobile && (
          <Combobox
            label="Urutkan"
            hideLabel
            value={c.sortKey}
            onValueChange={(v) => c.setSort(v as StockSortKey)}
            options={SORT_OPTIONS}
            containerClassName="w-[12rem] shrink-0"
          />
        )}
      </div>

      {/* Filter desktop inline */}
      {!isMobile && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-end gap-2">{filterFields}</div>
          {extraFilters}
        </div>
      )}

      {/* Filter Sheet mobile */}
      {isMobile && (
        <Sheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title="Filter Stok"
          description="Saring berdasarkan kategori, status stok, dan status opname."
        >
          <div className="px-4 py-3 space-y-3">
            {filterFields}
            {extraFilters}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="md" fullWidth onClick={c.resetFilters}>
                Reset
              </Button>
              <Button variant="primary" size="md" fullWidth onClick={() => setSheetOpen(false)}>
                Terapkan
              </Button>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  )
}
