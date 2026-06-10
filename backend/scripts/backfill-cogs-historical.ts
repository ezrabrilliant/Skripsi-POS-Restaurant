// REV 2.11 — HISTORICAL COGS backfill for the May 1-27 book import.
//
// PROBLEM: import-book-data.ts raw-inserted paid items with NO unitCost and (for
// pakets) NO recorded choice slot. Plain backfill-cogs.ts therefore leaves the 105
// imported transactions at COGS=0, and would price pakets on fixed components only
// (understating ~Rp 1.5M because the main protein lives in a choice slot).
//
// THIS SCRIPT recomputes unitCost from CURRENT Menu.cost via the same resolver, but
// for paket items WITHOUT recorded selections it fills each choice slot with the
// MEDIAN-COST option (deterministic representative). Items that DO have real
// selections (live recent orders) use their actual choices untouched.
//
// SAFE: idempotent recompute-and-set, touches ONLY transaction_items.unit_cost.
// Dry-run by default. Pass --apply to write.
//
//   npx tsx --env-file=.env scripts/backfill-cogs-historical.ts          # dry-run
//   npx tsx --env-file=.env scripts/backfill-cogs-historical.ts --apply  # write

import { PrismaClient, Prisma } from '@prisma/client'
import {
  resolveCostComponents,
  type MenuNode,
  type ChosenItem,
} from '../src/modules/menus/variant-resolver'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')

// Inline copy of variant-resolver's (non-exported) costTargetOf: every menu has a
// cost, so simple/leaf returns itself; nonStock variant → costSource ?? stockTarget ?? own.
function costTargetOf(graph: Record<number, MenuNode>, menuId: number | null, variantId?: number | null): number | null {
  if (menuId == null) return null
  const node = graph[menuId]
  if (!node) return null
  if (node.kind === 'variant') {
    if (variantId == null) return menuId
    const v = node.variants?.[variantId]
    return v?.costSourceMenuId ?? v?.stockTargetMenuId ?? menuId
  }
  return menuId
}

async function buildGraphAndCostMap() {
  const menus = await prisma.menu.findMany({
    select: {
      id: true, kind: true, stockType: true, cost: true,
      variants: { select: { id: true, stockTargetMenuId: true, costSourceMenuId: true } },
      paketComponents: {
        select: { kind: true, label: true, qty: true, targetMenuId: true, targetVariantId: true,
          choiceOptions: { select: { label: true, targetMenuId: true, targetVariantId: true } } },
      },
    },
  })
  const variantOwner = new Map<number, number>()
  for (const m of menus) for (const v of m.variants) variantOwner.set(v.id, m.id)
  const resolveTarget = (tm: number | null, tv: number | null) => ({
    targetMenuId: tm ?? (tv != null ? variantOwner.get(tv) ?? null : null), targetVariantId: tv })
  const graph: Record<number, MenuNode> = {}
  const costMap: Record<number, number> = {}
  for (const m of menus) {
    const cost = m.cost ? m.cost.toNumber() : 0
    costMap[m.id] = cost
    const node: MenuNode = { id: m.id, kind: m.kind as MenuNode['kind'],
      stockType: m.stockType === 'portion' ? 'portion' : m.stockType === 'linked' ? 'linked' : 'nonStock', cost }
    if (m.variants.length) { node.variants = {}; for (const v of m.variants) node.variants[v.id] = { id: v.id, stockTargetMenuId: v.stockTargetMenuId, costSourceMenuId: v.costSourceMenuId } }
    if (m.kind === 'paket') node.paket = {
      fixed: m.paketComponents.filter(c => c.kind === 'fixed').map(c => ({ qty: c.qty, ...resolveTarget(c.targetMenuId, c.targetVariantId) })),
      choices: m.paketComponents.filter(c => c.kind === 'choice').map(c => ({ label: c.label, options: c.choiceOptions.map(co => resolveTarget(co.targetMenuId, co.targetVariantId)) })) }
    graph[m.id] = node
  }
  return { graph, costMap }
}

function reconstructPaketChoices(sels: { groupOrSlotLabel: string; targetMenuId: number | null; targetVariantId: number | null; isPreference: boolean }[]) {
  const out: Record<string, { targetMenuId?: number | null; variantId?: number | null }> = {}
  for (const s of sels) { if (s.isPreference) continue; if (s.targetMenuId == null) continue; out[s.groupOrSlotLabel] = { targetMenuId: s.targetMenuId, variantId: s.targetVariantId } }
  return out
}

// Representative choices for a paket: median-cost option per choice slot.
function representativeChoices(graph: Record<number, MenuNode>, costMap: Record<number, number>, node: MenuNode) {
  const out: Record<string, { targetMenuId?: number | null; variantId?: number | null }> = {}
  if (!node.paket) return out
  for (const c of node.paket.choices) {
    if (c.options.length === 0) continue
    const scored = c.options.map((o) => {
      const ct = costTargetOf(graph, o.targetMenuId ?? null, o.targetVariantId ?? null)
      return { o, cost: ct != null ? (costMap[ct] ?? 0) : 0 }
    }).sort((a, b) => a.cost - b.cost)
    const median = scored[Math.floor((scored.length - 1) / 2)] // lower-middle for even counts
    out[c.label] = { targetMenuId: median.o.targetMenuId ?? null, variantId: median.o.targetVariantId ?? null }
  }
  return out
}

async function main() {
  const { graph, costMap } = await buildGraphAndCostMap()
  const items = await prisma.transactionItem.findMany({
    where: { transaction: { status: 'paid' } },
    select: {
      id: true, menuId: true, variantId: true, qty: true,
      selections: { select: { groupOrSlotLabel: true, targetMenuId: true, targetVariantId: true, isPreference: true } },
      menu: { select: { kind: true } },
    },
  })

  let scanned = 0, updated = 0, zero = 0, paketEstimated = 0
  let totalCogs = new Prisma.Decimal(0)
  for (const it of items) {
    scanned++
    const node = graph[it.menuId]
    const realChoices = reconstructPaketChoices(it.selections)
    // Paket with no recorded choice → fill representative (median). Else use real.
    let paketChoices = realChoices
    if (node?.kind === 'paket' && Object.keys(realChoices).length === 0) {
      paketChoices = representativeChoices(graph, costMap, node)
      paketEstimated++
    }
    const chosen: ChosenItem = { menuId: it.menuId, variantId: it.variantId, paketChoices }
    const components = resolveCostComponents(graph, chosen)
    const unitCost = components.reduce((acc, c) => acc.add(new Prisma.Decimal(costMap[c.menuId] ?? 0).mul(c.qty)), new Prisma.Decimal(0))
    if (unitCost.isZero()) zero++
    totalCogs = totalCogs.add(unitCost.mul(it.qty))
    if (APPLY) {
      await prisma.transactionItem.update({ where: { id: it.id }, data: { unitCost } })
    }
    updated++
  }

  console.log(`=== HISTORICAL COGS BACKFILL ${APPLY ? '(APPLIED)' : '(DRY-RUN, no writes)'} ===`)
  console.log(`  items scanned (paid)     : ${scanned}`)
  console.log(`  items ${APPLY ? 'updated' : 'would update'}        : ${updated}`)
  console.log(`  paket items estimated    : ${paketEstimated} (median-cost choice fill)`)
  console.log(`  items still zero cost    : ${zero}`)
  console.log(`  TOTAL paid COGS          : Rp ${Math.round(totalCogs.toNumber())}`)
  if (!APPLY) console.log('\n  (dry-run) re-run with --apply to write unit_cost.')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
