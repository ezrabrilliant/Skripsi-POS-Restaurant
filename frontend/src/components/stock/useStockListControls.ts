// REV 2.8: hook kontrol daftar stok (search + kategori + status stok + status
// opname hari ini + sort). Generic via accessor agar dipakai PortionStockTab &
// RawMaterialsTab. Semua client-side (dataset kecil ~25/~13 item).

import { useMemo, useState } from 'react'
import { isSameLocalDate } from '@/lib/relativeTime'

export type StockSortKey = 'lastStocked' | 'qty' | 'name' | 'category'
export type StockSortDir = 'asc' | 'desc'
export type StockStatus = 'habis' | 'rendah' | 'aman'
export type StockStatusFilter = 'all' | StockStatus
export type OpnameStatusFilter = 'all' | 'sudah' | 'belum'

export interface StockListControlsConfig<T> {
  rows: T[]
  getName: (r: T) => string
  /** Nilai kategori untuk filter (enum/string mentah). */
  getCategoryValue: (r: T) => string
  /** Label kategori untuk display + sort. */
  getCategoryLabel: (r: T) => string
  getQty: (r: T) => number
  getLastStockedAt: (r: T) => string | null
  getStatus: (r: T) => StockStatus
  /** Override daftar kategori (mis. enum tetap raw material). Default: derive dari rows. */
  categoryOptions?: { value: string; label: string }[]
  /**
   * REV 2.9: nilai awal filter saat tiba via deep-link (`/stock?status=…&q=…`).
   * Hanya dipakai sekali saat mount (useState initializer); perubahan setelahnya
   * diabaikan agar interaksi user tidak ter-reset.
   */
  initial?: { search?: string; category?: string; status?: StockStatusFilter }
}

// Arah default saat pertama klik tiap kolom.
const DEFAULT_DIR: Record<StockSortKey, StockSortDir> = {
  lastStocked: 'asc', // lama → baru (null/"belum pernah" paling atas)
  qty: 'asc', // rendah → tinggi
  name: 'asc',
  category: 'asc',
}

export function useStockListControls<T>(config: StockListControlsConfig<T>) {
  // Seed awal dari deep-link (config.initial) — initializer hanya jalan sekali.
  const [search, setSearch] = useState(() => config.initial?.search ?? '')
  const [category, setCategory] = useState(() => config.initial?.category ?? 'all')
  const [statusFilter, setStatusFilter] = useState<StockStatusFilter>(
    () => config.initial?.status ?? 'all'
  )
  const [opnameStatus, setOpnameStatus] = useState<OpnameStatusFilter>('all')
  const [sortKey, setSortKey] = useState<StockSortKey>('category')
  const [sortDir, setSortDir] = useState<StockSortDir>('asc')

  function setSort(key: StockSortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(DEFAULT_DIR[key])
    }
  }

  function resetFilters() {
    setSearch('')
    setCategory('all')
    setStatusFilter('all')
    setOpnameStatus('all')
  }

  const categoryOptions = useMemo(() => {
    const head = { value: 'all', label: 'Semua kategori' }
    if (config.categoryOptions) return [head, ...config.categoryOptions]
    const seen = new Map<string, string>()
    for (const r of config.rows) seen.set(config.getCategoryValue(r), config.getCategoryLabel(r))
    return [head, ...[...seen].map(([value, label]) => ({ value, label }))]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.rows, config.categoryOptions])

  const activeFilterCount =
    (search.trim() ? 1 : 0) +
    (category !== 'all' ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0) +
    (opnameStatus !== 'all' ? 1 : 0)

  const view = useMemo(() => {
    const { rows, getName, getCategoryValue, getCategoryLabel, getQty, getLastStockedAt, getStatus } =
      config
    let arr = rows.slice()

    const q = search.trim().toLowerCase()
    if (q) arr = arr.filter((r) => getName(r).toLowerCase().includes(q))
    if (category !== 'all') arr = arr.filter((r) => getCategoryValue(r) === category)
    if (statusFilter !== 'all') arr = arr.filter((r) => getStatus(r) === statusFilter)
    if (opnameStatus !== 'all') {
      arr = arr.filter((r) => {
        const checkedToday = isSameLocalDate(getLastStockedAt(r))
        return opnameStatus === 'sudah' ? checkedToday : !checkedToday
      })
    }

    const dir = sortDir === 'asc' ? 1 : -1
    const byName = (a: T, b: T) => getName(a).localeCompare(getName(b), 'id')
    const ts = (r: T) => {
      const v = getLastStockedAt(r)
      return v ? new Date(v).getTime() : Number.NEGATIVE_INFINITY // null = paling lama
    }

    arr.sort((a, b) => {
      let primary = 0
      switch (sortKey) {
        case 'name':
          primary = byName(a, b)
          break
        case 'qty':
          primary = getQty(a) - getQty(b)
          break
        case 'category':
          primary = getCategoryLabel(a).localeCompare(getCategoryLabel(b), 'id')
          break
        case 'lastStocked':
          primary = ts(a) - ts(b)
          break
      }
      if (primary !== 0) return primary * dir
      return byName(a, b) // tiebreak stabil (dir-independent)
    })

    return arr
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.rows, search, category, statusFilter, opnameStatus, sortKey, sortDir])

  return {
    search,
    setSearch,
    category,
    setCategory,
    statusFilter,
    setStatusFilter,
    opnameStatus,
    setOpnameStatus,
    sortKey,
    sortDir,
    setSort,
    resetFilters,
    categoryOptions,
    activeFilterCount,
    view,
  }
}
