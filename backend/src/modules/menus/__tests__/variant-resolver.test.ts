import { describe, it, expect } from 'vitest'
import { buildVariantLabel, cartesian, resolveStockTargets, type MenuNode } from '../variant-resolver'

describe('buildVariantLabel', () => {
  it('joins option labels in group order with " / "', () => {
    expect(buildVariantLabel([{ groupOrder: 0, label: 'Manis' }, { groupOrder: 1, label: 'Jumbo' }]))
      .toBe('Manis / Jumbo')
  })
  it('sorts by group order regardless of input order', () => {
    expect(buildVariantLabel([{ groupOrder: 1, label: 'Jumbo' }, { groupOrder: 0, label: 'Manis' }]))
      .toBe('Manis / Jumbo')
  })
})

describe('cartesian', () => {
  it('produces all combinations across groups', () => {
    const out = cartesian([[{ id: 1 }, { id: 2 }], [{ id: 3 }, { id: 4 }]])
    expect(out).toEqual([[{ id: 1 }, { id: 3 }], [{ id: 1 }, { id: 4 }], [{ id: 2 }, { id: 3 }], [{ id: 2 }, { id: 4 }]])
  })
  it('returns [] for no groups', () => {
    expect(cartesian([])).toEqual([])
  })
})

const graph: Record<number, MenuNode> = {
  10: { id: 10, kind: 'simple', stockType: 'portion' },
  20: { id: 20, kind: 'variant', stockType: 'nonStock', variants: { 201: { id: 201, stockTargetMenuId: 10 } } },
  30: { id: 30, kind: 'variant', stockType: 'nonStock', variants: { 301: { id: 301, stockTargetMenuId: null } } },
  50: { id: 50, kind: 'simple', stockType: 'nonStock' },
  40: { id: 40, kind: 'paket', stockType: 'nonStock', paket: {
    fixed: [{ qty: 2, targetMenuId: 10 }],
    choices: [{ label: 'Minuman', options: [{ targetMenuId: 30 }, { targetMenuId: 50 }] }],
  } },
}

describe('resolveStockTargets', () => {
  it('simple portion → deduct itself ×1', () => {
    expect(resolveStockTargets(graph, { menuId: 10 })).toEqual([{ menuId: 10, qty: 1 }])
  })
  it('variant → deduct its stock target', () => {
    expect(resolveStockTargets(graph, { menuId: 20, variantId: 201 })).toEqual([{ menuId: 10, qty: 1 }])
  })
  it('drink variant with null target → no deduction', () => {
    expect(resolveStockTargets(graph, { menuId: 30, variantId: 301 })).toEqual([])
  })
  it('paket: fixed×2 + chosen variant(30→none) → only fixed target', () => {
    expect(resolveStockTargets(graph, { menuId: 40, paketChoices: { Minuman: { targetMenuId: 30, variantId: 301 } } }))
      .toEqual([{ menuId: 10, qty: 2 }])
  })
  it('paket choosing air mineral (nonStock simple) → only fixed', () => {
    expect(resolveStockTargets(graph, { menuId: 40, paketChoices: { Minuman: { targetMenuId: 50 } } }))
      .toEqual([{ menuId: 10, qty: 2 }])
  })
  it('simple nonStock → no deduction', () => {
    expect(resolveStockTargets(graph, { menuId: 50 })).toEqual([])
  })
})
