// skuLink.ts — pure helpers untuk "Hubungkan ke SKU".
//
// Owner cuma milih SATU SKU per jenis. Di belakang layar kita petakan ke dua kolom
// backend yang sudah ada (tanpa migrasi):
//   - SKU lacak stok (stockType=portion) → isi `stockTargetMenuId` (stok dikurangi
//     saat order; modal otomatis ikut SKU itu via fallback costSource ?? stockTarget).
//   - SKU tidak lacak stok (nonStock) → isi `costSourceMenuId` (modal ikut SKU itu,
//     stok tidak dikurangi).
// Cuma satu yang keisi pada satu waktu; yang lain null.

import type { StockType } from '@/types'

export interface SkuLink {
  stockTargetMenuId: number | null
  costSourceMenuId: number | null
}

/** Petakan 1 pilihan SKU ke pasangan field backend. null = tidak dihubungkan. */
export function routeSkuLink(
  sku: { id: number; stockType: StockType } | null,
): SkuLink {
  if (!sku) return { stockTargetMenuId: null, costSourceMenuId: null }
  return sku.stockType === 'portion'
    ? { stockTargetMenuId: sku.id, costSourceMenuId: null }
    : { stockTargetMenuId: null, costSourceMenuId: sku.id }
}

/** SKU id yang sedang tertaut (stockTarget diutamakan, lalu costSource). */
export function currentSkuId(link: SkuLink): number | null {
  return link.stockTargetMenuId ?? link.costSourceMenuId ?? null
}
