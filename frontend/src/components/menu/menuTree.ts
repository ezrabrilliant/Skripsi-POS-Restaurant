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
