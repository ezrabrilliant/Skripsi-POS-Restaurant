import { describe, it, expect } from 'vitest'
import { buildVariantLabel, cartesian, resolveStockTargets, resolveCostComponents, type MenuNode } from '../variant-resolver'

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

describe('resolveCostComponents', () => {
  const graph = {
    1: { id: 1, kind: 'simple' as const, stockType: 'portion' as const, cost: 9000 },
    2: { id: 2, kind: 'simple' as const, stockType: 'nonStock' as const, cost: 2000 }, // nasi
    3: { id: 3, kind: 'simple' as const, stockType: 'nonStock' as const, cost: 1500 }, // teh leaf
    10: {
      id: 10, kind: 'variant' as const, stockType: 'nonStock' as const,
      variants: { 100: { id: 100, stockTargetMenuId: 1, costSourceMenuId: null } }, // ayam -> leaf 1
    },
    11: {
      id: 11, kind: 'variant' as const, stockType: 'nonStock' as const,
      variants: { 110: { id: 110, stockTargetMenuId: null, costSourceMenuId: 3 } }, // es teh -> leaf 3
    },
    20: {
      id: 20, kind: 'paket' as const, stockType: 'nonStock' as const,
      paket: {
        fixed: [{ qty: 2, targetMenuId: 2, targetVariantId: null }], // 2x nasi
        choices: [{ label: 'Ayam', options: [{ targetMenuId: 10, targetVariantId: 100 }] }],
      },
    },
  }

  it('simple portion item -> own cost', () => {
    expect(resolveCostComponents(graph, { menuId: 1 })).toEqual([{ menuId: 1, qty: 1 }])
  })
  it('simple nonStock item still books own cost', () => {
    expect(resolveCostComponents(graph, { menuId: 2 })).toEqual([{ menuId: 2, qty: 1 }])
  })
  it('variant with stockTarget resolves to leaf', () => {
    expect(resolveCostComponents(graph, { menuId: 10, variantId: 100 })).toEqual([{ menuId: 1, qty: 1 }])
  })
  it('nonStock variant resolves to costSourceMenuId leaf', () => {
    expect(resolveCostComponents(graph, { menuId: 11, variantId: 110 })).toEqual([{ menuId: 3, qty: 1 }])
  })
  it('paket sums fixed (with qty) + chosen components', () => {
    const out = resolveCostComponents(graph, {
      menuId: 20,
      paketChoices: { Ayam: { targetMenuId: 10, variantId: 100 } },
    })
    expect(out).toEqual(expect.arrayContaining([{ menuId: 2, qty: 2 }, { menuId: 1, qty: 1 }]))
    expect(out).toHaveLength(2)
  })
})
