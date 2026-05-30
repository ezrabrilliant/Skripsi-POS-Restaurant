// REV 2.11 P6 — idempotent backfill of historical COGS (`TransactionItem.unitCost`).
//
// For every TransactionItem belonging to a `status='paid'` transaction, recomputes
// `unitCost` from the CURRENT menu costs using the same engine the order-time path uses
// (`resolveCostComponents` over a MenuNode graph). This stamps historical (pre-REV 2.11)
// items so the owner's Laba/Rugi over imported May data becomes meaningful.
//
// SAFE + IDEMPOTENT:
//   - Pure recompute-and-set: re-running with unchanged costs yields identical values.
//   - Touches ONLY `transaction_items.unit_cost` (never deletes/creates rows, never
//     mutates transactions or stock). costMap is read from current `Menu.cost`.
//   - Run AFTER the owner has entered costs (dev costs are mostly null → unitCost=0,
//     which is fine — the goal is the script runs cleanly + is idempotent).
//
// Resolution rule (design §5.1): variant → costSourceMenuId ?? stockTargetMenuId ?? own
// menu; simple/leaf → itself; paket → Σ all components (fixed + chosen, incl. nonStock).
// Pre-REV-2.10 simple items (menuId, no variantId/selections) resolve to the menu itself.
// Items whose menu was since hidden/edited still resolve (graph keyed by id; missing →
// resolver returns [] → unitCost=0, no crash).
//
// Run with (from within backend/ so it uses the local Prisma 6.x):
//   npx tsx --env-file=.env scripts/backfill-cogs.ts

import { PrismaClient, Prisma } from '@prisma/client'
import {
  resolveCostComponents,
  type MenuNode,
  type ChosenItem,
} from '../src/modules/menus/variant-resolver'

interface Report {
  itemsScanned: number
  itemsUpdated: number
  itemsZeroCost: number
  errors: number
}

/**
 * Build the MenuNode graph + costMap from the CURRENT catalog. Mirrors
 * `buildMenuGraph` in transactions.service.ts (same MenuNode shape) but standalone
 * (no $transaction) so the script stays self-contained. costMap[menuId] = Menu.cost
 * as a number (0 if null).
 */
async function buildGraphAndCostMap(
  prisma: PrismaClient,
): Promise<{ graph: Record<number, MenuNode>; costMap: Record<number, number> }> {
  const menus = await prisma.menu.findMany({
    select: {
      id: true,
      kind: true,
      stockType: true,
      cost: true,
      variants: { select: { id: true, stockTargetMenuId: true, costSourceMenuId: true } },
      paketComponents: {
        select: {
          kind: true,
          label: true,
          qty: true,
          targetMenuId: true,
          targetVariantId: true,
          choiceOptions: {
            select: { label: true, targetMenuId: true, targetVariantId: true },
          },
        },
      },
    },
  })

  // variantId -> owning menuId (so a paket target naming only a variant resolves to
  // its owning variant node, identical to buildMenuGraph's resolveTarget).
  const variantOwner = new Map<number, number>()
  for (const m of menus) {
    for (const v of m.variants) variantOwner.set(v.id, m.id)
  }
  const resolveTarget = (targetMenuId: number | null, targetVariantId: number | null) => ({
    targetMenuId:
      targetMenuId ?? (targetVariantId != null ? variantOwner.get(targetVariantId) ?? null : null),
    targetVariantId,
  })

  const graph: Record<number, MenuNode> = {}
  const costMap: Record<number, number> = {}
  for (const m of menus) {
    const cost = m.cost ? m.cost.toNumber() : 0
    costMap[m.id] = cost
    const node: MenuNode = {
      id: m.id,
      kind: m.kind as MenuNode['kind'],
      stockType:
        m.stockType === 'portion'
          ? 'portion'
          : m.stockType === 'linked'
            ? 'linked'
            : 'nonStock',
      cost,
    }
    if (m.variants.length > 0) {
      node.variants = {}
      for (const v of m.variants) {
        node.variants[v.id] = {
          id: v.id,
          stockTargetMenuId: v.stockTargetMenuId,
          costSourceMenuId: v.costSourceMenuId,
        }
      }
    }
    if (m.kind === 'paket') {
      node.paket = {
        fixed: m.paketComponents
          .filter((c) => c.kind === 'fixed')
          .map((c) => ({ qty: c.qty, ...resolveTarget(c.targetMenuId, c.targetVariantId) })),
        choices: m.paketComponents
          .filter((c) => c.kind === 'choice')
          .map((c) => ({
            label: c.label,
            options: c.choiceOptions.map((co) => resolveTarget(co.targetMenuId, co.targetVariantId)),
          })),
      }
    }
    graph[m.id] = node
  }
  return { graph, costMap }
}

/**
 * Rebuild paketChoices from a stored item's selections rows (mirrors
 * `reconstructPaketChoices` in transactions.service.ts): only non-preference slots
 * with a target carry a stock/cost target. Suhu/Dingin etc. (isPreference=true) skipped.
 */
function reconstructPaketChoices(
  selections: {
    groupOrSlotLabel: string
    targetMenuId: number | null
    targetVariantId: number | null
    isPreference: boolean
  }[],
): Record<string, { targetMenuId?: number | null; variantId?: number | null }> {
  const out: Record<string, { targetMenuId?: number | null; variantId?: number | null }> = {}
  for (const s of selections) {
    if (s.isPreference) continue
    if (s.targetMenuId == null) continue
    out[s.groupOrSlotLabel] = { targetMenuId: s.targetMenuId, variantId: s.targetVariantId }
  }
  return out
}

export async function backfillCogs(prisma: PrismaClient): Promise<Report> {
  const report: Report = { itemsScanned: 0, itemsUpdated: 0, itemsZeroCost: 0, errors: 0 }

  const { graph, costMap } = await buildGraphAndCostMap(prisma)

  // Every TransactionItem whose transaction is paid. Selections drive paket/variant
  // reconstruction; pre-REV-2.10 simple items simply have no selections + no variantId.
  const items = await prisma.transactionItem.findMany({
    where: { transaction: { status: 'paid' } },
    select: {
      id: true,
      menuId: true,
      variantId: true,
      selections: {
        select: {
          groupOrSlotLabel: true,
          targetMenuId: true,
          targetVariantId: true,
          isPreference: true,
        },
      },
    },
  })

  for (const item of items) {
    report.itemsScanned++
    try {
      const chosen: ChosenItem = {
        menuId: item.menuId,
        variantId: item.variantId,
        paketChoices: reconstructPaketChoices(item.selections),
      }
      // resolveCostComponents is pure + no-throw: a missing menu (hidden/edited away)
      // or unknown variant returns [] / falls back gracefully → unitCost = 0.
      const components = resolveCostComponents(graph, chosen)
      const unitCost = components.reduce(
        (acc, c) => acc.add(new Prisma.Decimal(costMap[c.menuId] ?? 0).mul(c.qty)),
        new Prisma.Decimal(0),
      )
      if (unitCost.isZero()) report.itemsZeroCost++
      await prisma.transactionItem.update({
        where: { id: item.id },
        data: { unitCost },
      })
      report.itemsUpdated++
    } catch (e) {
      report.errors++
      console.error(`  ! item #${item.id} (menu ${item.menuId}) GAGAL:`, e instanceof Error ? e.message : e)
    }
  }

  return report
}

// ===========================================================================
// CLI entrypoint
// ===========================================================================
async function main() {
  const prisma = new PrismaClient()
  try {
    console.log('=== BACKFILL COGS (TransactionItem.unitCost) ===')
    const report = await backfillCogs(prisma)
    console.log('\n=== RECONCILIATION ===')
    console.log(`  items scanned (paid)  : ${report.itemsScanned}`)
    console.log(`  unitCost backfilled   : ${report.itemsUpdated} items`)
    console.log(`  items with zero cost  : ${report.itemsZeroCost} (cost null/0 in catalog — expected pre-input)`)
    console.log(`  errors                : ${report.errors}`)
    if (report.errors > 0) {
      throw new Error(`Backfill COGS selesai dengan ${report.errors} error — investigasi log di atas.`)
    }
    console.log('\nBackfill COGS selesai ✓ (idempotent recompute-and-set, history rows intact).')
  } finally {
    await prisma.$disconnect()
  }
}

// Run only when invoked directly (not when imported elsewhere).
if (process.argv[1] && process.argv[1].includes('backfill-cogs')) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
