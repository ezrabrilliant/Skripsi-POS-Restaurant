// REV 2.10 P4 — idempotent backfill of the menu-variant redesign onto a REAL DB.
//
// Consumes the collapse spec in `prisma/variant-catalog.ts` and applies it to the
// existing catalog (dev/prod) WITHOUT deleting any data:
//   - NEW_PORTION_SKUS  : flip a menu to portion + create its PortionStock (Kecap split).
//   - VARIANT_MENUS     : create/update display variant menus (kind=variant) whose
//                         variants point at the existing portion SKUs (stock holders).
//   - hides             : posVisible=false on the collapsed granular SKUs (kept for history).
//   - PAKET_SPECS       : convert legacy paket menus in place into FK components.
//
// ADDITIVE + IDEMPOTENT: re-running creates no duplicate variant menus, never deletes
// menus/transactions, and leaves history (transactions / transaction_items) untouched.
//
// Reuses menus.service `upsertMenu` (handles nested create + replace-children +
// reference validation) and variant-resolver `buildVariantLabel` — single source of truth.
//
// NEVER prisma migrate reset / db push --force-reset. Run with:
//   npx tsx --env-file=.env scripts/backfill-menu-variants.ts

import { PrismaClient } from '@prisma/client'
import {
  VARIANT_MENUS,
  PAKET_SPECS,
  NEW_PORTION_SKUS,
} from '../prisma/variant-catalog'
import { buildVariantLabel } from '../src/modules/menus/variant-resolver'
import { upsertMenu } from '../src/modules/menus/menus.service'
import type { MenuUpsertInput } from '../src/modules/menus/menus.schema'

type PrismaLike = Pick<PrismaClient, 'menu' | 'portionStock' | 'user'>

interface Report {
  newPortionSkus: number
  variantMenusCreated: number
  variantMenusUpdated: number
  skusHidden: number
  paketsConverted: number
  /** REV 2.11: count of nonStock variants stamped with a resolved costSourceMenuId. */
  costSourceSet: number
  paketsSkipped: string[]
  unresolved: string[]
}

/**
 * Apply the REV 2.10 variant catalog to the connected DB. Idempotent + additive.
 * Exported so seed.ts can reuse it on a fresh DB (same structure either way).
 */
export async function applyVariantCatalog(prisma: PrismaLike): Promise<Report> {
  const report: Report = {
    newPortionSkus: 0,
    variantMenusCreated: 0,
    variantMenusUpdated: 0,
    skusHidden: 0,
    paketsConverted: 0,
    costSourceSet: 0,
    paketsSkipped: [],
    unresolved: [],
  }

  // Helper: find a menu by exact name (any kind).
  const findMenuByName = (name: string) =>
    prisma.menu.findFirst({ where: { name } })

  // REV 2.11: upsertMenu butuh userId untuk MenuCostMovement (initialSet/manualEdit).
  // Backfill tidak men-set cost, jadi tidak ada movement yang ditulis — tapi signature
  // tetap butuh user valid. Pakai owner pertama yang ter-seed.
  const owner = await prisma.user.findFirst({ where: { role: 'owner' } })
  if (!owner) {
    throw new Error('Backfill GAGAL: tidak ada user role=owner untuk atribusi upsertMenu')
  }
  const ownerUserId = owner.id

  // Helper: resolve a stock-target NAME to a menu id, EXCLUDING display variant
  // menus. This is critical for the Kerupuk clash — a display menu named "Kerupuk"
  // (kind=variant) must never resolve as its own stock target; the real holder is
  // the hidden simple SKU also named "Kerupuk".
  const resolveStockTarget = async (
    name: string | null,
  ): Promise<number | null> => {
    if (name === null) return null
    const m = await prisma.menu.findFirst({
      where: { name, NOT: { kind: 'variant' } },
    })
    if (!m) {
      report.unresolved.push(name)
      return null
    }
    return m.id
  }

  // =========================================================================
  // STEP 2 — NEW_PORTION_SKUS (Kecap own stock)
  // =========================================================================
  console.log('=== STEP 2: NEW_PORTION_SKUS ===')
  for (const sku of NEW_PORTION_SKUS) {
    const menu = await findMenuByName(sku.name)
    if (!menu) {
      report.unresolved.push(sku.name)
      console.log(`  ! "${sku.name}" tidak ditemukan — tidak bisa jadi portion SKU`)
      continue
    }
    if (menu.stockType !== 'portion') {
      await prisma.menu.update({
        where: { id: menu.id },
        data: { stockType: 'portion', minStock: sku.minStock },
      })
      console.log(`  ~ "${sku.name}" (#${menu.id}) → stockType=portion min${sku.minStock}`)
    } else {
      console.log(`  = "${sku.name}" (#${menu.id}) sudah portion`)
    }
    const ps = await prisma.portionStock.findUnique({ where: { menuId: menu.id } })
    if (!ps) {
      await prisma.portionStock.create({
        data: {
          menuId: menu.id,
          currentQty: sku.initialQty,
          minStock: sku.minStock,
          openingQtyToday: sku.initialQty,
          openingQtyDate: new Date(),
        },
      })
      report.newPortionSkus++
      console.log(`  + PortionStock dibuat untuk "${sku.name}" (qty ${sku.initialQty}, min ${sku.minStock})`)
    } else {
      console.log(`  = PortionStock "${sku.name}" sudah ada (qty ${ps.currentQty}) — dibiarkan`)
    }
  }

  // =========================================================================
  // STEP 3 — Variant menus (resolve stock targets BEFORE create, then upsert)
  // =========================================================================
  console.log('\n=== STEP 3: VARIANT MENUS ===')
  for (const spec of VARIANT_MENUS) {
    // 3a. Resolve every variant's stock target FIRST (NOT-variant lookup) so the
    //     Kerupuk display menu never shadows its own stock holder.
    const resolvedTargets: (number | null)[] = []
    for (const v of spec.variants) {
      resolvedTargets.push(await resolveStockTarget(v.stockTargetName))
    }

    // 3a-bis. REV 2.11: resolve each variant's costSource leaf (nonStock variants
    //     whose modal differs per variant: Es Teh / Es Jeruk / Tahu Tempe). The
    //     leaf is a hidden simple SKU (kind != variant), so resolveStockTarget's
    //     NOT-variant lookup resolves it unambiguously. Stock-bearing variants omit
    //     costSourceName → null (backend cost resolver falls back to stockTargetMenuId).
    const resolvedCostSources: (number | null)[] = []
    for (const v of spec.variants) {
      resolvedCostSources.push(
        v.costSourceName ? await resolveStockTarget(v.costSourceName) : null,
      )
    }

    // 3b. Build option groups (displayOrder by index; options displayOrder by index).
    const optionGroups: MenuUpsertInput['optionGroups'] = spec.groups.map(
      (g, gi) => ({
        name: g.name,
        affectsVariant: g.affectsVariant,
        displayOrder: gi,
        options: g.options.map((label, oi) => ({ label, displayOrder: oi })),
      }),
    )

    // Group-order lookup for affectsVariant=true groups (for buildVariantLabel).
    const groupOrder = new Map<string, number>()
    spec.groups.forEach((g, gi) => {
      if (g.affectsVariant) groupOrder.set(g.name, gi)
    })

    // 3c. Build variants. label = buildVariantLabel over the affectsVariant groups.
    const variants: MenuUpsertInput['variants'] = spec.variants.map((v, vi) => {
      const labelParts = Object.entries(v.optionLabels)
        .filter(([groupName]) => groupOrder.has(groupName))
        .map(([groupName, label]) => ({
          groupOrder: groupOrder.get(groupName)!,
          label,
        }))
      if (resolvedCostSources[vi] != null) report.costSourceSet++
      return {
        optionLabels: v.optionLabels,
        label: buildVariantLabel(labelParts),
        price: v.price,
        stockTargetMenuId: resolvedTargets[vi],
        costSourceMenuId: resolvedCostSources[vi],
        isActive: true,
        displayOrder: vi,
      }
    })

    const payload: MenuUpsertInput = {
      name: spec.name,
      category: spec.category,
      price: spec.basePrice,
      imageUrl: spec.imageUrl,
      kind: 'variant',
      posVisible: true,
      stockType: 'nonStock',
      minStock: null,
      optionGroups,
      variants,
      paketComponents: [],
    }

    const existing = await prisma.menu.findFirst({
      where: { name: spec.name, kind: 'variant' },
    })
    await upsertMenu(existing?.id ?? null, payload, ownerUserId)
    if (existing) {
      report.variantMenusUpdated++
      console.log(`  ~ variant menu "${spec.name}" (#${existing.id}) diperbarui (${variants.length} varian)`)
    } else {
      report.variantMenusCreated++
      console.log(`  + variant menu "${spec.name}" dibuat (${variants.length} varian)`)
    }
  }

  // =========================================================================
  // STEP 4 — Hide collapsed SKUs (posVisible=false), keep stockType + PortionStock
  // =========================================================================
  console.log('\n=== STEP 4: HIDE COLLAPSED SKUS ===')
  for (const spec of VARIANT_MENUS) {
    for (const name of spec.hides) {
      const res = await prisma.menu.updateMany({
        where: { name, kind: { not: 'variant' } },
        data: { posVisible: false },
      })
      report.skusHidden += res.count
      console.log(`  - hide "${name}" → ${res.count} baris (posVisible=false)`)
    }
  }

  // =========================================================================
  // STEP 5 — Pakets (convert legacy paket menus in place into FK components)
  // =========================================================================
  console.log('\n=== STEP 5: PAKETS ===')
  for (const spec of PAKET_SPECS) {
    const existing = await findMenuByName(spec.name)
    if (!existing) {
      report.paketsSkipped.push(spec.name)
      console.log(`  ! paket "${spec.name}" tidak ditemukan — dilewati (tidak dibuat)`)
      continue
    }

    const paketComponents: MenuUpsertInput['paketComponents'] = []
    for (let ci = 0; ci < spec.components.length; ci++) {
      const comp = spec.components[ci]
      if (comp.kind === 'fixed') {
        const targetMenuId = await resolveStockTarget(comp.targetName ?? null)
        paketComponents.push({
          kind: 'fixed',
          label: comp.label,
          qty: comp.qty ?? 1,
          displayOrder: ci,
          targetMenuId,
          targetVariantId: null,
          choiceOptions: [],
        })
      } else {
        const choiceOptions: MenuUpsertInput['paketComponents'][number]['choiceOptions'] = []
        for (const opt of comp.options ?? []) {
          const targetMenuId = await resolveStockTarget(opt.targetName)
          choiceOptions.push({
            label: opt.label,
            targetMenuId,
            targetVariantId: null,
            upcharge: 0,
          })
        }
        paketComponents.push({
          kind: 'choice',
          label: comp.label,
          qty: 1,
          displayOrder: ci,
          targetMenuId: null,
          targetVariantId: null,
          choiceOptions,
        })
      }
    }

    await upsertMenu(existing.id, {
      name: spec.name,
      category: existing.category,
      price: spec.price ?? Number(existing.price),
      imageUrl: existing.imageUrl ?? undefined,
      kind: 'paket',
      posVisible: true,
      stockType: 'nonStock',
      minStock: null,
      optionGroups: [],
      variants: [],
      paketComponents,
    }, ownerUserId)
    report.paketsConverted++
    console.log(`  ~ paket "${spec.name}" (#${existing.id}) dikonversi (${paketComponents.length} komponen)`)
  }

  // =========================================================================
  // STEP 6 — Reconciliation report
  // =========================================================================
  console.log('\n=== RECONCILIATION ===')
  console.log(`  Variant menus created : ${report.variantMenusCreated}`)
  console.log(`  Variant menus updated : ${report.variantMenusUpdated}`)
  console.log(`  Pakets converted      : ${report.paketsConverted}`)
  console.log(`  SKUs hidden (rows)    : ${report.skusHidden}`)
  console.log(`  New portion SKUs      : ${report.newPortionSkus}`)
  console.log(`  costSource set        : ${report.costSourceSet}`)
  if (report.paketsSkipped.length > 0) {
    console.log(`  Pakets SKIPPED (missing): ${report.paketsSkipped.join(', ')}`)
  }
  // De-dup unresolved before reporting/failing.
  report.unresolved = [...new Set(report.unresolved)]
  if (report.unresolved.length > 0) {
    console.log(`  UNRESOLVED target names : ${report.unresolved.join(', ')}`)
    throw new Error(
      `Backfill GAGAL: ${report.unresolved.length} target name tidak resolve → ${report.unresolved.join(', ')}`,
    )
  }
  console.log('  UNRESOLVED target names : 0 ✓')

  return report
}

// ===========================================================================
// CLI entrypoint
// ===========================================================================
async function main() {
  const prisma = new PrismaClient()
  try {
    const [menusBefore, txBefore, itemsBefore] = await Promise.all([
      prisma.menu.count(),
      prisma.transaction.count(),
      prisma.transactionItem.count(),
    ])
    console.log('=== BEFORE COUNTS ===')
    console.log(`  menus=${menusBefore} transactions=${txBefore} transaction_items=${itemsBefore}\n`)

    await applyVariantCatalog(prisma)

    const [menusAfter, txAfter, itemsAfter] = await Promise.all([
      prisma.menu.count(),
      prisma.transaction.count(),
      prisma.transactionItem.count(),
    ])
    console.log('\n=== AFTER COUNTS ===')
    console.log(`  menus=${menusAfter} transactions=${txAfter} transaction_items=${itemsAfter}`)
    console.log(`  Δmenus=${menusAfter - menusBefore} (pakets converted in place; only variant menus add rows)`)
    console.log(`  Δtransactions=${txAfter - txBefore} (must be 0)`)
    console.log(`  Δtransaction_items=${itemsAfter - itemsBefore} (must be 0)`)
    if (txAfter !== txBefore || itemsAfter !== itemsBefore) {
      throw new Error('HISTORY MUTATED — transactions/items count changed! Investigate.')
    }
    console.log('\nBackfill selesai ✓ (additive, idempotent, history intact).')
  } finally {
    await prisma.$disconnect()
  }
}

// Run only when invoked directly (not when imported by seed.ts).
if (process.argv[1] && process.argv[1].includes('backfill-menu-variants')) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
