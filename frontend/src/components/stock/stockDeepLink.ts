// REV 2.9: kontrak deep-link halaman Stok. StockPage mem-parse query (`tab`,
// `action`, `focusMenuId`, `status`, `q`) sekali saat tiba lalu menyerahkannya
// (handoff) ke tab yang dituju. Tab mengonsumsi: buka modal (action), sorot baris
// (focusId), seed filter (status/query). Param dibersihkan dari URL setelah
// dikonsumsi agar refresh/back/ganti-tab tidak memicu ulang.

import type { StockStatusFilter } from './useStockListControls'

export type StockTabId = 'portion' | 'raw'
export type StockDeepLinkAction = 'opname' | 'restock'

/** Bagian intent yang relevan untuk satu tab (tanpa `tab`). */
export interface StockTabHandoff {
  /** Modal yang harus dibuka saat tab mount. `restock` hanya valid di tab porsi. */
  action?: StockDeepLinkAction
  /** Baris yang harus disorot (porsi: menuId, raw: id master). */
  focusId?: number
  /** Seed filter status stok. */
  status?: StockStatusFilter
  /** Seed kotak pencarian. */
  query?: string
}

export interface StockDeepLinkIntent extends StockTabHandoff {
  tab: StockTabId
}

const STATUS_VALUES: StockStatusFilter[] = ['all', 'aman', 'rendah', 'habis']

/**
 * Parse query stok jadi intent ter-validasi. Mengembalikan null bila tidak ada
 * param deep-link sama sekali (kunjungan biasa) — pemanggil bisa skip handoff.
 */
export function parseStockDeepLink(params: URLSearchParams): StockDeepLinkIntent | null {
  const rawTab = params.get('tab')
  const tab: StockTabId = rawTab === 'raw' ? 'raw' : 'portion'

  const rawAction = params.get('action')
  const action: StockDeepLinkAction | undefined =
    rawAction === 'opname' || rawAction === 'restock' ? rawAction : undefined

  const focusRaw = params.get('focusMenuId') ?? params.get('focusId')
  const focusNum = focusRaw != null ? Number(focusRaw) : NaN
  const focusId = Number.isInteger(focusNum) && focusNum > 0 ? focusNum : undefined

  const rawStatus = params.get('status')
  const status = STATUS_VALUES.includes(rawStatus as StockStatusFilter)
    ? (rawStatus as StockStatusFilter)
    : undefined

  const query = params.get('q')?.trim() || undefined

  const hasIntent = rawTab != null || !!action || !!focusId || !!status || !!query
  if (!hasIntent) return null
  return { tab, action, focusId, status, query }
}
