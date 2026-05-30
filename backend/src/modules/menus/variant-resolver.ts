// REV 2.10: pure helpers for menu variants + order-time stock resolution.
// No Prisma/DB dependency — operates on plain in-memory objects so it is unit-testable.
// The transaction service builds a MenuNode graph from the DB and calls resolveStockTargets.

export function buildVariantLabel(parts: { groupOrder: number; label: string }[]): string {
  return [...parts].sort((a, b) => a.groupOrder - b.groupOrder).map((p) => p.label).join(' / ')
}

export function cartesian<T>(groups: T[][]): T[][] {
  if (groups.length === 0) return []
  return groups.reduce<T[][]>(
    (acc, group) => acc.flatMap((combo) => group.map((item) => [...combo, item])),
    [[]],
  )
}

export interface MenuNode {
  id: number
  kind: 'simple' | 'variant' | 'paket'
  stockType: 'portion' | 'linked' | 'nonStock'
  variants?: Record<number, { id: number; stockTargetMenuId: number | null }>
  paket?: {
    fixed: { qty: number; targetMenuId?: number | null; targetVariantId?: number | null }[]
    choices: {
      label: string
      options: { targetMenuId?: number | null; targetVariantId?: number | null }[]
    }[]
  }
}

export interface ChosenItem {
  menuId: number
  variantId?: number | null
  paketChoices?: Record<string, { targetMenuId?: number | null; variantId?: number | null }>
}

export interface StockDeduction {
  menuId: number
  qty: number
}

// Resolve one (menu, variant?) to its single stock target menu id, or null.
function targetOf(
  graph: Record<number, MenuNode>,
  menuId: number,
  variantId?: number | null,
): number | null {
  const node = graph[menuId]
  if (!node) return null
  if (node.kind === 'variant') {
    if (variantId == null) return null
    return node.variants?.[variantId]?.stockTargetMenuId ?? null
  }
  // simple/paket-as-target: portion deducts itself; otherwise no stock
  return node.stockType === 'portion' ? node.id : null
}

export function resolveStockTargets(
  graph: Record<number, MenuNode>,
  item: ChosenItem,
): StockDeduction[] {
  const node = graph[item.menuId]
  if (!node) return []
  const acc: StockDeduction[] = []
  const push = (menuId: number | null, qty: number) => {
    if (menuId != null) acc.push({ menuId, qty })
  }

  if (node.kind === 'paket' && node.paket) {
    for (const f of node.paket.fixed) {
      if (f.targetMenuId != null) push(targetOf(graph, f.targetMenuId, f.targetVariantId), f.qty)
    }
    for (const c of node.paket.choices) {
      const chosen = item.paketChoices?.[c.label]
      if (chosen?.targetMenuId != null) push(targetOf(graph, chosen.targetMenuId, chosen.variantId), 1)
    }
    return mergeDeductions(acc)
  }

  push(targetOf(graph, item.menuId, item.variantId), 1)
  return mergeDeductions(acc)
}

function mergeDeductions(d: StockDeduction[]): StockDeduction[] {
  const m = new Map<number, number>()
  for (const x of d) m.set(x.menuId, (m.get(x.menuId) ?? 0) + x.qty)
  return [...m].map(([menuId, qty]) => ({ menuId, qty }))
}
