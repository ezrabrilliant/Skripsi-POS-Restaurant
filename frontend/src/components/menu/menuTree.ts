import type { Menu } from '@/types'

export interface ParentRef { id: number; name: string }

export function buildParentMap(menus: Menu[]): Map<number, ParentRef[]> {
  const map = new Map<number, ParentRef[]>()
  const add = (skuId: number | null, parent: ParentRef) => {
    if (skuId == null) return
    const arr = map.get(skuId)
    if (arr) { if (!arr.some((p) => p.id === parent.id)) arr.push(parent) }
    else map.set(skuId, [parent])
  }
  for (const m of menus) {
    const ref: ParentRef = { id: m.id, name: m.name }
    if (m.kind === 'variant') {
      for (const v of m.variants ?? []) { add(v.stockTargetMenuId, ref); add(v.costSourceMenuId, ref) }
    } else if (m.kind === 'paket') {
      for (const c of m.paketComponents ?? []) { add(c.targetMenuId, ref); for (const co of c.choiceOptions) add(co.targetMenuId, ref) }
    }
  }
  return map
}

export function buildChildrenMap(menus: Menu[]): Map<number, number[]> {
  const map = new Map<number, number[]>()
  const add = (parentId: number, childId: number | null) => {
    if (childId == null) return
    const arr = map.get(parentId)
    if (arr) { if (!arr.includes(childId)) arr.push(childId) }
    else map.set(parentId, [childId])
  }
  for (const m of menus) {
    if (m.kind === 'variant') {
      for (const v of m.variants ?? []) { add(m.id, v.stockTargetMenuId); add(m.id, v.costSourceMenuId) }
    } else if (m.kind === 'paket') {
      for (const c of m.paketComponents ?? []) { add(m.id, c.targetMenuId); for (const co of c.choiceOptions) add(m.id, co.targetMenuId) }
    }
  }
  return map
}

export function parentBadgeLabel(parents: ParentRef[]): string {
  if (parents.length === 0) return ''
  const [first, ...rest] = parents
  return rest.length > 0 ? '↑ ' + first.name + ' +' + rest.length : '↑ ' + first.name
}

export interface CostRange {
  min: number
  max: number
}

/**
 * COGS terhitung untuk menu varian/paket dari modal SKU komponennya (untuk DISPLAY
 * di katalog — induk variant/paket nyimpan cost=0, modal hidup di SKU/komponen).
 * - simple → null (pakai `m.cost` langsung).
 * - variant → rentang min..max modal antar jenis aktif. Sumber tiap jenis:
 *   `costSourceMenuId ?? stockTargetMenuId`, fallback modal induk kalau tak tertaut.
 * - paket → fixed (Σ modal komponen × qty) + slot pilihan (rentang min..max antar opsi).
 * Mirror longgar dari backend `resolveCostComponents`; hitungan eksak per-order di backend.
 */
export function computeMenuCost(menu: Menu, byId: Map<number, Menu>): CostRange | null {
  const costOf = (id: number | null | undefined): number =>
    id == null ? 0 : byId.get(id)?.cost ?? 0

  if (menu.kind === 'variant') {
    const variants = (menu.variants ?? []).filter((v) => v.isActive !== false)
    if (variants.length === 0) return null
    const costs = variants.map((v) => {
      const src = v.costSourceMenuId ?? v.stockTargetMenuId
      return src != null ? costOf(src) : menu.cost ?? 0
    })
    return { min: Math.min(...costs), max: Math.max(...costs) }
  }

  if (menu.kind === 'paket') {
    const comps = menu.paketComponents ?? []
    if (comps.length === 0) return null
    let fixed = 0
    let choiceMin = 0
    let choiceMax = 0
    for (const c of comps) {
      if (c.kind === 'fixed') {
        fixed += costOf(c.targetMenuId) * (c.qty > 0 ? c.qty : 1)
      } else {
        const optCosts = c.choiceOptions.map((o) => costOf(o.targetMenuId))
        if (optCosts.length > 0) {
          choiceMin += Math.min(...optCosts)
          choiceMax += Math.max(...optCosts)
        }
      }
    }
    return { min: fixed + choiceMin, max: fixed + choiceMax }
  }

  return null
}
