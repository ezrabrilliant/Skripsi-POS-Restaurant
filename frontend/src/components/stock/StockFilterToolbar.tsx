// REV 2.8: toolbar filter+sort untuk halaman Stok (PortionStockTab).
// Delegasi layout ke FilterToolbar primitive bersama: desktop inline, mobile
// sekunder masuk Sheet. Search selalu terlihat. Sort desktop via header kolom
// (SortableHeader); mobile via Combobox di sini (card mobile tak punya header).
import type { ReactNode } from 'react'
import { Combobox, FilterToolbar } from '@/design-system/primitives'
import type {
  StockSortKey,
  StockSortDir,
  StockStatusFilter,
  OpnameStatusFilter,
} from './useStockListControls'

const SORT_OPTIONS = [
  { value: 'category', label: 'Kategori' },
  { value: 'name', label: 'Nama (A–Z)' },
  { value: 'qty', label: 'Stok (sedikit dulu)' },
  { value: 'lastStocked', label: 'Terakhir di-stok' },
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'Semua status' },
  { value: 'habis', label: 'Habis' },
  { value: 'rendah', label: 'Rendah' },
  { value: 'aman', label: 'Aman' },
]

const OPNAME_OPTIONS = [
  { value: 'all', label: 'Semua opname' },
  { value: 'sudah', label: 'Sudah dicek' },
  { value: 'belum', label: 'Belum dicek' },
]

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
  /** Tombol aksi spesifik tab (Restock Pagi / Opname). */
  children?: ReactNode
  /** Badge hitung kanan (lowCount). */
  rightBadge?: ReactNode
  /** Slot filter tambahan spesifik tab (mis. filter Tipe menu di tab Porsi). */
  extraFilters?: ReactNode
  searchPlaceholder?: string
}

export function StockFilterToolbar({
  controls: c,
  children,
  rightBadge,
  extraFilters,
  searchPlaceholder,
}: StockFilterToolbarProps) {
  const filterFields = (
    <>
      <Combobox
        hideLabel
        label="Filter kategori"
        value={c.category}
        onValueChange={c.setCategory}
        options={c.categoryOptions}
        searchPlaceholder="Cari kategori..."
        containerClassName="min-w-[12rem]"
      />
      <Combobox
        hideLabel
        label="Filter status stok"
        value={c.statusFilter}
        onValueChange={(v) => c.setStatusFilter(v as StockStatusFilter)}
        options={STATUS_OPTIONS}
        containerClassName="min-w-[10rem]"
      />
      <Combobox
        hideLabel
        label="Filter status opname"
        value={c.opnameStatus}
        onValueChange={(v) => c.setOpnameStatus(v as OpnameStatusFilter)}
        options={OPNAME_OPTIONS}
        containerClassName="min-w-[10rem]"
      />
    </>
  )

  const sortControl = (
    <Combobox
      hideLabel
      label="Urutkan"
      value={c.sortKey}
      onValueChange={(v) => c.setSort(v as StockSortKey)}
      options={SORT_OPTIONS}
      containerClassName="w-[12rem] shrink-0"
    />
  )

  return (
    <FilterToolbar
      search={{ value: c.search, onChange: c.setSearch, placeholder: searchPlaceholder }}
      filters={filterFields}
      chipFilters={extraFilters}
      sortControl={sortControl}
      actions={children}
      rightBadge={rightBadge}
      onReset={c.resetFilters}
      activeFilterCount={c.activeFilterCount}
    />
  )
}
