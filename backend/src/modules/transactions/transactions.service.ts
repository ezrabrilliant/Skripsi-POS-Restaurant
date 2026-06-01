// Service modul transactions. REV 2.5 - core POS flow.
//
// REV 2.5 (2026-05-26) Split Tender + Combine Tables:
//   - Drop splitTransaction (split bill multi-party tidak diadopsi - lihat
//     docs/knowledge/SPLIT-MERGE-PATTERNS.md untuk justifikasi konteks Indo).
//   - Drop payTransaction (single-method) → diganti addPayment + removePayment
//     untuk support Split Tender (1 Tx multi-method via TransactionPayment table).
//   - TransactionView shape: drop paymentMethod/paymentBank top-level,
//     tambah payments[] (TransactionPaymentView).
//   - mergeBills tetap sama - kini juga dipakai untuk Combine Tables (inter-table)
//     dengan UI trigger baru di TablesPage + PaymentModal (frontend).
//
// REV 2.3 shift-decoupling (tetap berlaku):
//   - Field DB `cashier_id` -> `created_by_id` (user yang submit order).
//   - createTransaction tidak terima `shiftId` lagi dari frontend - auto-resolve
//     dari single active shift system-wide. 0 atau 2+ active = 409.
//   - View shape: createdById/createdByName + shiftCashierName denormalize dari
//     shift.cashier.name.
//
// Konsep utama (tidak berubah):
//   - Setiap transaksi terikat ke shift yang masih open.
//   - Decrement PortionStock terjadi saat order di-submit (boleh minus per ground truth).
//   - Resolusi stok target via stockType menu (portion/linked/nonStock).
//   - PB1 dihitung saat payment pertama dari (subtotal - discount). REV 2.6: tarif +
//     toggle on/off dari AppSetting (default OFF, resto tidak charge PB1).
//   - Void boleh dilakukan kasir sendiri tanpa approval.

// REV 2.6: PaymentMethod sekarang dynamic master table (payment_methods).
// Method values di runtime adalah string code dari payment_methods.code.
// Lookup + validasi requiresBank/junction terjadi di addPayment via prisma query.
import {
  OrderType,
  Prisma,
  PortionMovementReason,
  StockType,
  TransactionStatus,
  UserRole,
  type Shift,
} from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { AppError, notFound } from '../../utils/errors';
import { computePb1 } from './pb1';
import { getShiftWindow } from '../settings/settings.service';
import { isShiftStale } from '../shifts/shift-time';
import {
  resolveStockTargets,
  resolveCostComponents,
  resolvePaketUpcharge,
  type MenuNode,
  type StockDeduction,
} from '../menus/variant-resolver';
import type {
  CreateTransactionInput,
  AddItemsInput,
  AddPaymentInput,
  ListTransactionsQuery,
  OrderItemInput,
  MergeInput,
  UpdateItemInput,
} from './transactions.schema';

// ============================================================
// View shape (mapper)
// ============================================================

/// REV 2.10: baris selection yang dipersist per TransactionItem - slot paket
/// (isPreference=false) + free-preference (isPreference=true, mis. Suhu). Mirror
/// frontend TransactionItemSelection (types/index.ts).
export interface TransactionItemSelectionView {
  groupOrSlotLabel: string;
  chosenLabel: string;
  targetMenuId: number | null;
  targetVariantId: number | null;
  isPreference: boolean;
}

export interface TransactionItemView {
  id: number;
  menuId: number;
  menuName: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
  subOptionsSelected: Prisma.JsonValue;
  /// REV 2.4: catatan per item dari waiter/kasir saat input. Mis. "kurang manis"
  /// atau "Panas"/"Dingin" untuk minuman ambigu suhu.
  notes: string | null;
  /// REV 2.10: varian terjual untuk menu kind=variant (null untuk simple/paket).
  variantId: number | null;
  /// REV 2.10: label varian untuk display (null kalau bukan item varian).
  variantLabel: string | null;
  /// REV 2.10: pilihan slot paket + free-preference yang dipersist.
  selections: TransactionItemSelectionView[];
  createdAt: string;
}

/// REV 2.5: payment slice per Transaction. Single tender = 1 record, split tender = N records.
/// REV 2.6: method = plain string (denormalize dari payment_methods.code).
/// Validasi method existence + bank rules dilakukan di addPayment service via
/// lookup payment_methods table (lihat addPayment for detail).
export interface TransactionPaymentView {
  id: number;
  method: string;
  bank: string | null;
  amount: number;
  recordedAt: string;
  recordedById: number;
  recordedByName: string;
}

export interface TransactionView {
  id: number;
  shiftId: number;
  orderType: OrderType;
  tableNumber: number | null;
  /// REV 2.3 shift-decoupling: user yang submit order (kasir/owner/waiter).
  createdById: number;
  createdByName: string;
  /// REV 2.3: denormalize dari shift.cashier.name supaya HistoryPage bisa display
  /// "oleh {createdByName} · shift {shiftCashierName}" tanpa extra query.
  shiftCashierName: string;
  status: TransactionStatus;
  /// REV 2.1: self-ref. Non-null = transaksi sumber yang sudah di-merge.
  mergedIntoId: number | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  /// REV 2.12: PB1 ditanggung resto (0 kalau dibebankan ke pelanggan / nonaktif).
  taxBorneAmount: number;
  total: number;
  items: TransactionItemView[];
  /// REV 2.5: payment slices (1 untuk single tender, N untuk split tender).
  /// sum(payments.amount) === total saat status=paid.
  payments: TransactionPaymentView[];
  createdAt: string;
  paidAt: string | null;
  voidedAt: string | null;
}

type TransactionWithRelations = Prisma.TransactionGetPayload<{
  include: {
    createdBy: true;
    shift: { include: { cashier: { select: { name: true } } } };
    items: {
      include: {
        menu: { select: { name: true } };
        // REV 2.10: bawa varian + selections supaya view bisa display variant/paket.
        variant: { select: { id: true; label: true } };
        selections: true;
      };
    };
    payments: { include: { recordedBy: { select: { name: true } } } };
  };
}>;

function toTransactionView(t: TransactionWithRelations): TransactionView {
  return {
    id: t.id,
    shiftId: t.shiftId,
    orderType: t.orderType,
    tableNumber: t.tableNumber,
    createdById: t.createdById,
    createdByName: t.createdBy.name,
    shiftCashierName: t.shift.cashier.name,
    status: t.status,
    mergedIntoId: t.mergedIntoId,
    subtotal: t.subtotal.toNumber(),
    discountAmount: t.discountAmount.toNumber(),
    taxAmount: t.taxAmount.toNumber(),
    taxBorneAmount: t.taxBorneAmount.toNumber(),
    total: t.total.toNumber(),
    createdAt: t.createdAt.toISOString(),
    paidAt: t.paidAt ? t.paidAt.toISOString() : null,
    voidedAt: t.voidedAt ? t.voidedAt.toISOString() : null,
    items: t.items.map((it) => ({
      id: it.id,
      menuId: it.menuId,
      menuName: it.menu.name,
      qty: it.qty,
      unitPrice: it.unitPrice.toNumber(),
      subtotal: it.subtotal.toNumber(),
      subOptionsSelected: it.subOptionsSelected,
      notes: it.notes,
      // REV 2.10: varian + label + selections untuk display di HistoryPage.
      variantId: it.variantId ?? null,
      variantLabel: it.variant?.label ?? null,
      selections: it.selections.map((s) => ({
        groupOrSlotLabel: s.groupOrSlotLabel,
        chosenLabel: s.chosenLabel,
        targetMenuId: s.targetMenuId,
        targetVariantId: s.targetVariantId,
        isPreference: s.isPreference,
      })),
      createdAt: it.createdAt.toISOString(),
    })),
    payments: t.payments.map((p) => ({
      id: p.id,
      method: p.method,
      bank: p.bank,
      amount: p.amount.toNumber(),
      recordedAt: p.recordedAt.toISOString(),
      recordedById: p.recordedById,
      recordedByName: p.recordedBy.name,
    })),
  };
}

const transactionInclude = {
  createdBy: true,
  shift: { include: { cashier: { select: { name: true } } } },
  items: {
    // REV 2.10: variant + selections agar toTransactionView bisa emit variant/paket
    // info. Satu sumber include shared oleh getById + list + listByTable.
    include: {
      menu: { select: { name: true } },
      variant: { select: { id: true, label: true } },
      selections: true,
    },
  },
  payments: {
    include: { recordedBy: { select: { name: true } } },
    orderBy: { recordedAt: 'asc' },
  },
} satisfies Prisma.TransactionInclude;

// ============================================================
// Stock resolution (REV 2.10 - FK-based via MenuNode graph)
// ============================================================
//
// REV 2.10: resolusi stok berbasis FK (MenuVariant.stockTargetMenuId + PaketComponent
// target FK) menggantikan resolusi berbasis NAMA (subOptions JSON). Graph MenuNode
// dibangun sekali per request dari catalog (kecil, ~60-90 baris) lalu dipakai oleh
// pure resolver `resolveStockTargets` (unit-tested di variant-resolver.test.ts).
//
// `linkedSubOptionsSchema` / `paketSubOptionsSchema` tidak lagi dipakai untuk order
// baru - backfill REV 2.10 sudah memindah pilihan ke relasi MenuVariant/PaketComponent.

interface ResolvedItem {
  input: OrderItemInput;
  menu: { id: number; name: string; price: Prisma.Decimal };
  /// Harga jual efektif: harga varian kalau variantId di-set, else harga menu.
  unitPrice: Prisma.Decimal;
  /// REV 2.11: snapshot modal per unit (Σ cost komponen). Beku di TransactionItem.unitCost.
  unitCost: Prisma.Decimal;
  /// Varian yang dipersist di TransactionItem.variantId (null untuk simple/paket).
  variantId: number | null;
  /// Stok yang harus di-decrement. qty = per 1 unit menu (paket fixed bisa >1).
  /// Decrement aktual = deduction.qty * item.qty.
  deductions: StockDeduction[];
  /// Baris TransactionItemSelection yang dipersist (slot paket + free-preference).
  selections: {
    groupOrSlotLabel: string;
    chosenLabel: string;
    targetMenuId: number | null;
    targetVariantId: number | null;
    isPreference: boolean;
  }[];
}

/// Bentuk MenuNode graph dari seluruh katalog (di dalam $transaction via `tx`).
/// Dipakai resolveStockTargets untuk resolusi FK-based. Variant target di paket
/// (targetVariantId) dipetakan ke owning menuId supaya `targetOf` resolver bekerja.
async function buildMenuGraph(
  tx: Prisma.TransactionClient,
): Promise<Record<number, MenuNode>> {
  const menus = await tx.menu.findMany({
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
            select: { label: true, targetMenuId: true, targetVariantId: true, upcharge: true },
          },
        },
      },
    },
  });

  // variantId -> owning menuId (untuk resolusi target varian di paket).
  const variantOwner = new Map<number, number>();
  for (const m of menus) {
    for (const v of m.variants) variantOwner.set(v.id, m.id);
  }
  // Kalau target hanya menyebut variantId, isi targetMenuId dari owning menu-nya
  // supaya targetOf(graph, targetMenuId, targetVariantId) menemukan node varian.
  const resolveTarget = (targetMenuId: number | null, targetVariantId: number | null) => ({
    targetMenuId: targetMenuId ?? (targetVariantId != null ? variantOwner.get(targetVariantId) ?? null : null),
    targetVariantId,
  });

  const graph: Record<number, MenuNode> = {};
  for (const m of menus) {
    const node: MenuNode = {
      id: m.id,
      kind: m.kind as MenuNode['kind'],
      stockType:
        m.stockType === StockType.portion
          ? 'portion'
          : m.stockType === StockType.linked
            ? 'linked'
            : 'nonStock',
    };
    node.cost = m.cost ? m.cost.toNumber() : 0;
    if (m.variants.length > 0) {
      node.variants = {};
      for (const v of m.variants) {
        node.variants[v.id] = {
          id: v.id,
          stockTargetMenuId: v.stockTargetMenuId,
          costSourceMenuId: v.costSourceMenuId,
        };
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
            options: c.choiceOptions.map((co) => ({
              ...resolveTarget(co.targetMenuId, co.targetVariantId),
              upcharge: co.upcharge.toNumber(),
            })),
          })),
      };
    }
    graph[m.id] = node;
  }
  return graph;
}

/// REV 2.10 P3: validasi pilihan slot paket SEBELUM resolveStockTargets.
/// `resolveStockTargets` adalah pure no-throw resolver yang MEMPERCAYAI input -
/// tanpa guard ini, paketChoices yang ngawur (slot hilang, slot tak dikenal,
/// opsi bukan anggota slot) bisa men-decrement stok sembarang menu. Guard ini
/// memakai daftar opsi yang diizinkan per slot dari graph (node.paket.choices[].options,
/// yaitu {targetMenuId, targetVariantId} dari PaketChoiceOption).
///
/// Aturan match (allowed option = {targetMenuId, targetVariantId}):
///   - option.targetVariantId != null → match iff picked.variantId === option.targetVariantId.
///   - else option.targetMenuId != null → picked.targetMenuId harus === option.targetMenuId, DAN
///       - target menu kind=variant: picked.variantId harus varian nyata menu itu;
///       - selain itu (simple/paket, mis. Air Mineral): picked.variantId harus null/undefined.
function validatePaketChoices(
  graph: Record<number, MenuNode>,
  node: MenuNode,
  item: OrderItemInput,
): void {
  if (node.kind !== 'paket' || !node.paket) return;
  const choices = node.paket.choices;
  const picks = item.paketChoices ?? {};

  // 1. Slot wajib: setiap slot choice paket harus punya entri matching by label.
  for (const slot of choices) {
    if (!Object.prototype.hasOwnProperty.call(picks, slot.label)) {
      throw new AppError(`Pilihan "${slot.label}" wajib diisi`, 400);
    }
  }

  // 2. Slot tak dikenal: setiap key di paketChoices harus punya slot dengan label itu.
  const slotByLabel = new Map(choices.map((c) => [c.label, c]));
  for (const key of Object.keys(picks)) {
    if (!slotByLabel.has(key)) {
      throw new AppError(`Slot pilihan "${key}" tidak dikenal`, 400);
    }
  }

  // 3. Keanggotaan: setiap pilihan harus cocok dengan salah satu opsi yang diizinkan.
  for (const slot of choices) {
    // Aman: rule 1 sudah memastikan setiap slot punya entri picks[slot.label].
    const picked = picks[slot.label]!;
    const pickedVariantId = picked.variantId ?? null;
    const matched = slot.options.some((opt) => {
      const optVariantId = opt.targetVariantId ?? null;
      const optMenuId = opt.targetMenuId ?? null;
      if (optVariantId != null) {
        return pickedVariantId === optVariantId;
      }
      if (optMenuId != null) {
        if (picked.targetMenuId !== optMenuId) return false;
        const targetNode = graph[optMenuId];
        // Kalau target menu varian → picked.variantId harus varian nyata menu itu;
        // selain itu (simple/paket, mis. Air Mineral) → picked.variantId harus null.
        if (targetNode?.kind === 'variant') {
          return pickedVariantId != null && targetNode.variants?.[pickedVariantId] != null;
        }
        return pickedVariantId == null;
      }
      return false;
    });
    if (!matched) {
      const label = picked.chosenLabel ?? String(picked.targetMenuId);
      throw new AppError(`Pilihan "${label}" tidak valid untuk slot "${slot.label}"`, 400);
    }
  }
}

/// Validasi item + resolve stok target untuk setiap item via graph FK-based.
/// `graph` dibangun sekali oleh caller (buildMenuGraph). `menuMeta` menyimpan
/// price + name + variant prices untuk unitPrice + audit note.
async function resolveItems(
  tx: Prisma.TransactionClient,
  graph: Record<number, MenuNode>,
  items: OrderItemInput[],
): Promise<ResolvedItem[]> {
  const resolved: ResolvedItem[] = [];

  for (const input of items) {
    const menu = await tx.menu.findUnique({
      where: { id: input.menuId },
      select: {
        id: true,
        name: true,
        price: true,
        isActive: true,
        variants: { select: { id: true, price: true } },
      },
    });
    if (!menu) {
      throw new AppError(`Menu id=${input.menuId} tidak ditemukan`, 400);
    }
    if (!menu.isActive) {
      throw new AppError(`Menu "${menu.name}" sudah nonaktif`, 400);
    }

    // unitPrice: harga varian kalau variantId di-set, else harga menu (simple+paket).
    let unitPrice = menu.price;
    const variantId = input.variantId ?? null;
    if (variantId !== null) {
      const variant = menu.variants.find((v) => v.id === variantId);
      if (!variant) {
        throw new AppError(`Varian id=${variantId} bukan milik menu "${menu.name}"`, 400);
      }
      unitPrice = variant.price;
    }

    // REV: tambahan harga (upcharge) opsi paket terpilih → masuk ke unitPrice paket.
    // Server-side recompute dari graph; jangan percaya harga dari client.
    const paketUpcharge = resolvePaketUpcharge(graph, {
      menuId: input.menuId,
      variantId,
      paketChoices: input.paketChoices,
    });
    if (paketUpcharge > 0) {
      unitPrice = unitPrice.add(new Prisma.Decimal(paketUpcharge));
    }

    // REV 2.10 P3: validasi slot paket SEBELUM resolve stok (resolveStockTargets
    // adalah pure no-throw resolver yang mempercayai input). Untuk item non-paket,
    // helper ini no-op. Mencegah paketChoices ngawur men-decrement stok sembarangan.
    const node = graph[input.menuId];
    if (node) {
      validatePaketChoices(graph, node, input);
    }

    const deductions = resolveStockTargets(graph, {
      menuId: input.menuId,
      variantId,
      paketChoices: input.paketChoices,
    });

    const costComponents = resolveCostComponents(graph, {
      menuId: input.menuId,
      variantId,
      paketChoices: input.paketChoices,
    });
    const unitCost = costComponents.reduce(
      (acc, c) => acc.add(new Prisma.Decimal(graph[c.menuId]?.cost ?? 0).mul(c.qty)),
      new Prisma.Decimal(0),
    );

    // Baris selection: slot paket (isPreference=false) + free-preference (isPreference=true).
    const selections: ResolvedItem['selections'] = [];
    if (input.paketChoices) {
      for (const [slotLabel, choice] of Object.entries(input.paketChoices)) {
        selections.push({
          groupOrSlotLabel: slotLabel,
          chosenLabel: choice.chosenLabel,
          targetMenuId: choice.targetMenuId,
          targetVariantId: choice.variantId ?? null,
          isPreference: false,
        });
      }
    }
    if (input.preferences) {
      for (const pref of input.preferences) {
        selections.push({
          groupOrSlotLabel: pref.groupLabel,
          chosenLabel: pref.chosenLabel,
          targetMenuId: null,
          targetVariantId: null,
          isPreference: true,
        });
      }
    }

    resolved.push({
      input,
      menu: { id: menu.id, name: menu.name, price: menu.price },
      unitPrice,
      unitCost,
      variantId,
      deductions,
      selections,
    });
  }

  return resolved;
}

/// Dijalankan di dalam $transaction. Buat TransactionItem, decrement PortionStock,
/// insert PortionMovement audit, + persist TransactionItemSelection untuk setiap item.
async function persistItemsAndDecrement(
  tx: Prisma.TransactionClient,
  transactionId: number,
  userId: number,
  resolved: ResolvedItem[],
): Promise<void> {
  for (const r of resolved) {
    // REV 2.8: tangkap id item agar movement bisa menautkan transaction_item_id.
    const item = await tx.transactionItem.create({
      data: {
        transactionId,
        menuId: r.menu.id,
        qty: r.input.qty,
        unitPrice: r.unitPrice,
        subtotal: r.unitPrice.mul(r.input.qty),
        unitCost: r.unitCost,
        // LEGACY: tetap tulis subOptionsSelected kalau caller masih kirim (backward compat).
        subOptionsSelected: r.input.subOptionsSelected
          ? (r.input.subOptionsSelected as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        // REV 2.4: persist notes kalau ada. null kalau tidak diisi.
        notes: r.input.notes ?? null,
        // REV 2.10: varian terjual.
        variantId: r.variantId,
      },
    });

    // REV 2.10: persist pilihan slot paket + free-preference.
    if (r.selections.length > 0) {
      await tx.transactionItemSelection.createMany({
        data: r.selections.map((s) => ({ ...s, transactionItemId: item.id })),
      });
    }

    for (const ded of r.deductions) {
      const decBy = ded.qty * r.input.qty;
      const delta = -decBy;
      const updated = await tx.portionStock.update({
        where: { menuId: ded.menuId },
        data: { currentQty: { decrement: decBy } },
      });
      await tx.portionMovement.create({
        data: {
          menuId: ded.menuId,
          delta,
          reason: PortionMovementReason.order,
          // REV 2.8: tautan via FK (bukan lagi teks note); note = konteks manusiawi.
          transactionId,
          transactionItemId: item.id,
          qtyBefore: updated.currentQty - delta,
          qtyAfter: updated.currentQty,
          note: `via "${r.menu.name}"`,
          userId,
        },
      });
    }
  }
}

/// REV 2.10: rekonstruksi paketChoices dari baris selection tersimpan (non-preference),
/// supaya reverse-stock saat void/edit/hapus item men-decrement target yang SAMA
/// dengan saat order dibuat. Slot = groupOrSlotLabel → { targetMenuId, variantId }.
function reconstructPaketChoices(
  selections: { groupOrSlotLabel: string; targetMenuId: number | null; targetVariantId: number | null; isPreference: boolean }[],
): Record<string, { targetMenuId?: number | null; variantId?: number | null }> {
  const out: Record<string, { targetMenuId?: number | null; variantId?: number | null }> = {};
  for (const s of selections) {
    if (s.isPreference) continue;
    if (s.targetMenuId == null) continue;
    out[s.groupOrSlotLabel] = { targetMenuId: s.targetMenuId, variantId: s.targetVariantId };
  }
  return out;
}

/// Resolve deductions untuk satu TransactionItem tersimpan (reverse path). Pakai
/// variantId + selections yang sudah dipersist (bukan input mentah). Graph FK-based.
function deductionsForStoredItem(
  graph: Record<number, MenuNode>,
  item: { menuId: number; variantId: number | null; selections: { groupOrSlotLabel: string; targetMenuId: number | null; targetVariantId: number | null; isPreference: boolean }[] },
): StockDeduction[] {
  return resolveStockTargets(graph, {
    menuId: item.menuId,
    variantId: item.variantId,
    paketChoices: reconstructPaketChoices(item.selections),
  });
}

/// Hitung ulang subtotal Transaction dari semua TransactionItem yang ada.
async function recomputeSubtotal(
  tx: Prisma.TransactionClient,
  transactionId: number,
): Promise<Prisma.Decimal> {
  const agg = await tx.transactionItem.aggregate({
    where: { transactionId },
    _sum: { subtotal: true },
  });
  const subtotal = agg._sum.subtotal ?? new Prisma.Decimal(0);
  await tx.transaction.update({
    where: { id: transactionId },
    data: { subtotal },
  });
  return subtotal;
}

// ============================================================
// Operations
// ============================================================

/// Resolve single active shift system-wide untuk attach order baru atau re-stamp
/// attribution saat payment.
///
/// REV 2.6 shift-redesign: resolusi via partial-unique `activeMarker` (=1 saat
/// open, NULL saat closed). DB constraint menjamin maksimal 1 shift open.
///   - 0 active -> 409 (kasir harus buka shift dulu).
///   - 1 active -> return it.
///   - 2+ active -> anomali (constraint dilanggar). Defensive 409.
///
/// Param `context` muncul di error message buat klarifikasi kapan helper ini
/// gagal (mis. "saat order baru" vs "saat pembayaran").
export async function resolveActiveShift(context: string = 'order baru'): Promise<Shift> {
  const active = await prisma.shift.findMany({ where: { activeMarker: 1 } });
  if (active.length === 0) {
    throw new AppError(`Belum ada shift kasir aktif. Buka shift dulu sebelum ${context} bisa diproses.`, 409);
  }
  if (active.length === 1) return active[0]!;
  throw new AppError(`Anomali: ${active.length} shift open bersamaan. Hubungi owner.`, 409);
}

export async function createTransaction(
  userId: number,
  input: CreateTransactionInput,
): Promise<TransactionView> {
  const shift = await resolveActiveShift('order baru');

  // REV 2.12 clean-slate: tolak order baru kalau shift aktif sudah lewat business day-nya.
  // Pembayaran/void TIDAK kena cek ini (perlu untuk membersihkan order sisa kemarin).
  const window = await getShiftWindow();
  if (isShiftStale(shift.date, window)) {
    throw new AppError(
      `Shift ${shift.date.toISOString().substring(0, 10)} belum ditutup — tuntaskan & tutup shift kemarin dulu sebelum input order baru.`,
      409,
    );
  }

  // Validasi order type vs tableNumber
  if (input.orderType === OrderType.dineIn) {
    if (input.tableNumber === undefined) {
      throw new AppError('Order dineIn wajib menyertakan tableNumber', 400);
    }
    if (input.tableNumber < 1 || input.tableNumber > env.TABLE_COUNT) {
      throw new AppError(`tableNumber harus 1-${env.TABLE_COUNT} untuk dine-in`, 400);
    }
  } else if (input.orderType === OrderType.takeaway) {
    if (input.tableNumber !== undefined) {
      throw new AppError('Order takeaway tidak boleh punya tableNumber', 400);
    }
  }

  const transactionId = await prisma.$transaction(async (tx) => {
    // REV 2.10: bangun MenuNode graph sekali per request (di dalam tx), lalu resolve
    // stok per item via FK-based resolver.
    const graph = await buildMenuGraph(tx);
    const resolved = await resolveItems(tx, graph, input.items);

    const created = await tx.transaction.create({
      data: {
        shiftId: shift.id,
        orderType: input.orderType,
        tableNumber: input.tableNumber ?? null,
        createdById: userId,
        status: TransactionStatus.open,
        subtotal: new Prisma.Decimal(0),
        discountAmount: new Prisma.Decimal(0),
        taxAmount: new Prisma.Decimal(0),
        total: new Prisma.Decimal(0),
      },
    });
    await persistItemsAndDecrement(tx, created.id, userId, resolved);
    await recomputeSubtotal(tx, created.id);
    return created.id;
  });

  return getTransactionById(transactionId);
}

export async function addItems(
  transactionId: number,
  userId: number,
  input: AddItemsInput,
): Promise<TransactionView> {
  const existing = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!existing) throw notFound('Transaction');
  if (existing.status !== TransactionStatus.open) {
    throw new AppError(`Hanya transaksi status open yang bisa ditambah item (saat ini: ${existing.status})`, 400);
  }

  const shiftOfTx = await prisma.shift.findUnique({ where: { id: existing.shiftId } });
  // shiftId non-nullable di schema → shift hilang = anomali integritas, jangan bypass diam-diam.
  if (!shiftOfTx) throw new AppError('Shift untuk transaksi ini tidak ditemukan.', 500);
  const window = await getShiftWindow();
  if (isShiftStale(shiftOfTx.date, window)) {
    throw new AppError(
      `Shift ${shiftOfTx.date.toISOString().substring(0, 10)} belum ditutup — tidak bisa menambah item ke order hari kemarin.`,
      409,
    );
  }

  await prisma.$transaction(async (tx) => {
    const graph = await buildMenuGraph(tx);
    const resolved = await resolveItems(tx, graph, input.items);
    await persistItemsAndDecrement(tx, transactionId, userId, resolved);
    await recomputeSubtotal(tx, transactionId);
  });

  return getTransactionById(transactionId);
}

/// REV 2.6: addPayment - tambah 1 payment slice ke Transaction.
///
/// Single tender: 1x call dengan amount = total.
/// Split tender:  Nx call sampai sum payments >= total. Tx status auto-update ke paid.
///
/// Validasi:
///   - Tx status=open (else 400)
///   - Tx NOT mergedIntoId (kalau di-merge, bayar via parent)
///   - amount > 0
///   - amount <= remaining (sisa tagihan)
///   - discountAmount HANYA valid kalau payments[] empty (first slice). Default 0.
///   - REV 2.6: method dilookup di payment_methods table. requiresBank diverifikasi
///     runtime + bank harus ∈ junction (payment_methods.banks) yang isActive.
///     dineInAllowed flag dari payment_methods (gantikan hardcoded gojek/grab block).
///
/// Effect:
///   - Kalau first slice + discountAmount > 0: update Tx.discountAmount + recompute taxAmount + total
///   - Insert TransactionPayment record (audit recordedById = kasir yang submit slice)
///   - Cek sum(payments) >= total: kalau ya, set Tx.status=paid + paidAt + cascade ke mergedFrom
export async function addPayment(
  transactionId: number,
  userId: number,
  input: AddPaymentInput,
): Promise<TransactionView> {
  const existing = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { payments: true },
  });
  if (!existing) throw notFound('Transaction');
  if (existing.status !== TransactionStatus.open) {
    throw new AppError(
      `Transaksi sudah ${existing.status}, tidak bisa ditambah pembayaran`,
      400,
    );
  }
  if (existing.mergedIntoId !== null) {
    throw new AppError(
      'Transaksi ini sudah di-merge ke transaksi lain. Bayar via parent.',
      400,
    );
  }

  // REV 2.6: lookup payment_methods master + verify bank rules runtime.
  // Method = string code dari payment_methods.code (case-insensitive lookup).
  const paymentMethod = await prisma.paymentMethod.findUnique({
    where: { code: input.method },
    include: {
      banks: {
        include: { bank: true },
      },
    },
  });
  if (!paymentMethod) {
    throw new AppError(`Payment method "${input.method}" tidak ditemukan`, 400);
  }
  if (!paymentMethod.isActive) {
    throw new AppError(`Payment method "${paymentMethod.label}" sedang nonaktif`, 400);
  }

  // OrderType restriction (REV 2.6: flag allowDineIn/allowTakeaway dari master
  // table; gantikan hardcoded gojek/grab block).
  if (existing.orderType === OrderType.dineIn && !paymentMethod.allowDineIn) {
    throw new AppError(
      `Metode "${paymentMethod.label}" tidak tersedia untuk dine-in. Pilih metode lain.`,
      400,
    );
  }
  if (existing.orderType === OrderType.takeaway && !paymentMethod.allowTakeaway) {
    throw new AppError(
      `Metode "${paymentMethod.label}" tidak tersedia untuk takeaway. Pilih metode lain.`,
      400,
    );
  }

  // Bank validation runtime:
  //   requiresBank=true  + no bank          -> 400
  //   requiresBank=true  + bank ∉ junction  -> 400
  //   requiresBank=false + bank provided    -> 400
  const bankInput = input.bank ?? null;
  if (paymentMethod.requiresBank) {
    if (!bankInput) {
      throw new AppError(
        `Bank wajib diisi untuk metode "${paymentMethod.label}"`,
        400,
      );
    }
    const validBankNames = new Set(
      paymentMethod.banks
        .filter((j) => j.bank.isActive)
        .map((j) => j.bank.name.toLowerCase()),
    );
    if (!validBankNames.has(bankInput.toLowerCase())) {
      throw new AppError(
        `Bank "${bankInput}" tidak tersedia untuk metode ${paymentMethod.label}`,
        400,
      );
    }
  } else if (bankInput) {
    throw new AppError(
      `Metode "${paymentMethod.label}" tidak butuh bank`,
      400,
    );
  }

  const isFirstSlice = existing.payments.length === 0;
  const discountInput = input.discountAmount ?? 0;
  if (!isFirstSlice && discountInput > 0) {
    throw new AppError('Diskon hanya bisa di-set saat pembayaran pertama (sebelum ada slice)', 400);
  }
  // REV 2.12 Fix A: gabung pesanan hanya boleh di pembayaran pertama (sebelum agregat terkunci).
  const mergeSourceIds = input.mergeSourceIds ?? [];
  if (mergeSourceIds.length > 0 && !isFirstSlice) {
    throw new AppError('Gabung pesanan hanya bisa saat pembayaran pertama', 400);
  }

  // PB1 setting dibaca sekali (stabil selama pembayaran).
  const setting = await prisma.appSetting.findUnique({ where: { id: 1 } });

  // Atomic finalize: SEMUA di dalam satu $transaction supaya merge + payment all-or-nothing.
  await prisma.$transaction(async (tx) => {
    // Lock parent row to serialize concurrent payments on this Tx.
    await tx.$queryRaw`SELECT id FROM transactions WHERE id = ${transactionId} FOR UPDATE`;

    // (Fix A) Merge candidate sources ke parent ini, atomik dengan payment.
    // Gagal di langkah mana pun setelah ini → seluruh merge ikut rollback.
    if (mergeSourceIds.length > 0) {
      const sources = await tx.transaction.findMany({ where: { id: { in: mergeSourceIds } } });
      if (sources.length !== mergeSourceIds.length) {
        throw new AppError('Sebagian pesanan yang digabung tidak ditemukan', 400);
      }
      for (const s of sources) {
        if (s.id === transactionId) throw new AppError('Tidak bisa menggabung transaksi ke dirinya sendiri', 400);
        if (s.status !== TransactionStatus.open) throw new AppError(`Pesanan #${s.id} tidak open, tidak bisa digabung`, 400);
        if (s.mergedIntoId !== null) throw new AppError(`Pesanan #${s.id} sudah digabung ke #${s.mergedIntoId}`, 400);
      }
      await tx.transaction.updateMany({ where: { id: { in: mergeSourceIds } }, data: { mergedIntoId: transactionId } });
    }

    // Aggregate subtotal (parent + SEMUA merged sources, termasuk yang baru di-merge).
    const mergedFrom = await tx.transaction.findMany({ where: { mergedIntoId: transactionId }, select: { subtotal: true } });
    const aggregateSubtotal = mergedFrom.reduce((sum, m) => sum.add(m.subtotal), existing.subtotal);
    if (aggregateSubtotal.isZero()) throw new AppError('Transaksi tidak punya item, tidak bisa dibayar', 400);

    // Effective discount/tax/total.
    let effectiveDiscount: Prisma.Decimal;
    let effectiveTax: Prisma.Decimal;
    let effectiveTaxBorne: Prisma.Decimal;
    let effectiveTotal: Prisma.Decimal;
    if (isFirstSlice) {
      effectiveDiscount = new Prisma.Decimal(discountInput);
      if (effectiveDiscount.greaterThan(aggregateSubtotal)) {
        throw new AppError('Diskon tidak boleh lebih besar dari subtotal agregat', 400);
      }
      const baseAfterDiscount = aggregateSubtotal.sub(effectiveDiscount);
      const pb1 = computePb1(baseAfterDiscount, {
        taxEnabled: setting?.taxEnabled ?? false,
        taxRate: setting?.taxRate ?? 0,
        taxChargedToCustomer: setting?.taxChargedToCustomer ?? false,
      });
      effectiveTax = pb1.taxAmount;
      effectiveTaxBorne = pb1.taxBorneAmount;
      effectiveTotal = pb1.total;
    } else {
      effectiveDiscount = existing.discountAmount;
      effectiveTax = existing.taxAmount;
      effectiveTaxBorne = existing.taxBorneAmount;
      effectiveTotal = existing.total;
    }

    // Re-read committed payments INSIDE the lock (authoritative).
    const slices = await tx.transactionPayment.findMany({ where: { transactionId } });
    const sumExisting = slices.reduce((acc, p) => acc.add(p.amount), new Prisma.Decimal(0));

    if (isFirstSlice) {
      await tx.transaction.update({
        where: { id: transactionId },
        data: { discountAmount: effectiveDiscount, taxAmount: effectiveTax, taxBorneAmount: effectiveTaxBorne, total: effectiveTotal },
      });
    }

    const remaining = effectiveTotal.sub(sumExisting);
    const amt = new Prisma.Decimal(input.amount);
    if (amt.lessThanOrEqualTo(0)) throw new AppError('Nominal pembayaran harus lebih dari 0', 400);
    if (amt.greaterThan(remaining)) {
      throw new AppError(`Nominal melebihi sisa tagihan. Sisa: Rp ${remaining.toFixed(0)}, dimasukkan: Rp ${amt.toFixed(0)}`, 400);
    }

    const newSum = sumExisting.add(amt);
    const willFinalize = newSum.greaterThanOrEqualTo(effectiveTotal);
    // Re-stamp attribution ke shift aktif saat PEMBAYARAN. resolveActiveShift TIDAK
    // mengecek staleness → order sisa kemarin tetap bisa dilunasi & atribusi ke shift kemarin.
    const finalizeShift = willFinalize ? await resolveActiveShift('pembayaran') : null;

    await tx.transactionPayment.create({
      data: { transactionId, method: input.method, bank: input.bank ?? null, amount: amt, recordedById: userId },
    });

    if (finalizeShift) {
      const paidAt = new Date();
      const flipped = await tx.transaction.updateMany({
        where: { id: transactionId, status: TransactionStatus.open },
        data: { status: TransactionStatus.paid, paidAt, shiftId: finalizeShift.id },
      });
      if (flipped.count === 1) {
        await tx.transaction.updateMany({
          where: { mergedIntoId: transactionId, status: TransactionStatus.open },
          data: { status: TransactionStatus.paid, discountAmount: new Prisma.Decimal(0), taxAmount: new Prisma.Decimal(0), total: new Prisma.Decimal(0), paidAt },
        });
      }
    }
  });

  return getTransactionById(transactionId);
}

/// REV 2.5: removePayment - hapus 1 payment slice. Hanya kalau Tx belum paid.
/// Tidak ada cascade impact (slice belum mempengaruhi mergedFrom).
export async function removePayment(
  transactionId: number,
  paymentId: number,
): Promise<TransactionView> {
  const existing = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });
  if (!existing) throw notFound('Transaction');
  if (existing.status !== TransactionStatus.open) {
    throw new AppError(
      `Tidak bisa hapus pembayaran, transaksi sudah ${existing.status}`,
      400,
    );
  }
  if (existing.mergedIntoId !== null) {
    throw new AppError(
      'Transaksi sudah di-merge. Kelola pembayaran via parent.',
      400,
    );
  }

  const payment = await prisma.transactionPayment.findUnique({
    where: { id: paymentId },
  });
  if (!payment) throw notFound('Payment');
  if (payment.transactionId !== transactionId) {
    throw new AppError(
      `Payment id=${paymentId} bukan milik transaksi ${transactionId}`,
      400,
    );
  }

  await prisma.transactionPayment.delete({ where: { id: paymentId } });

  return getTransactionById(transactionId);
}

export async function voidTransaction(
  transactionId: number,
  userId: number,
): Promise<TransactionView> {
  const existing = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      // REV 2.10: bawa variantId + selections untuk resolve reverse FK-based.
      items: { include: { menu: { select: { name: true } }, selections: true }, orderBy: { id: 'asc' } },
      shift: { select: { date: true } },
    },
  });
  if (!existing) throw notFound('Transaction');
  if (existing.status === TransactionStatus.void) {
    throw new AppError('Transaksi sudah void sebelumnya', 400);
  }
  const settled = await prisma.settlement.findFirst({ where: { date: existing.shift.date } });
  if (settled) {
    throw new AppError('Business day transaksi ini sudah di-settle - tidak bisa diubah (refund di luar lingkup sistem)', 409);
  }

  await prisma.$transaction(async (tx) => {
    // REV 2.10: reverse deductions yang SAMA dengan saat order, di-recompute dari
    // variantId + selections tersimpan via resolver FK-based (graph dibangun sekali).
    const graph = await buildMenuGraph(tx);
    for (const item of existing.items) {
      const deductions = deductionsForStoredItem(graph, item);
      for (const ded of deductions) {
        const incBy = ded.qty * item.qty;
        const updated = await tx.portionStock.update({
          where: { menuId: ded.menuId },
          data: { currentQty: { increment: incBy } },
        });
        await tx.portionMovement.create({
          data: {
            menuId: ded.menuId,
            delta: incBy,
            reason: PortionMovementReason.refundVoid,
            transactionId,
            transactionItemId: item.id,
            qtyBefore: updated.currentQty - incBy,
            qtyAfter: updated.currentQty,
            note: `void reverse "${item.menu.name}"`,
            userId,
          },
        });
      }
    }
    // REV 2.12 Fix C: lepas anak yang ter-merge ke transaksi ini supaya tidak jadi
    // order tersembunyi yang menunjuk parent void. Anak kembali jadi order standalone.
    await tx.transaction.updateMany({
      where: { mergedIntoId: transactionId, status: TransactionStatus.open },
      data: { mergedIntoId: null },
    });
    await tx.transaction.update({
      where: { id: transactionId },
      data: {
        status: TransactionStatus.void,
        voidedAt: new Date(),
      },
    });
  });

  return getTransactionById(transactionId);
}

export async function getTransactionById(id: number): Promise<TransactionView> {
  const t = await prisma.transaction.findUnique({
    where: { id },
    include: transactionInclude,
  });
  if (!t) throw notFound('Transaction');
  return toTransactionView(t);
}

/// REV 2.4: update single item - qty dan/atau notes. Open Tx only.
/// Kalau qty berubah: adjust stock decrement secara delta (qty naik → decrement
/// lebih banyak via reason=order; qty turun → reverse via reason=refundVoid).
/// Subtotal Tx + item subtotal direcompute. Notes-only update tidak nyentuh stok.
export async function updateTransactionItem(
  transactionId: number,
  itemId: number,
  userId: number,
  input: UpdateItemInput,
): Promise<TransactionView> {
  const existing = await prisma.transaction.findUnique({
    where: { id: transactionId },
    // REV 2.10: bawa variantId + selections + menu name untuk resolve FK-based.
    include: { items: { where: { id: itemId }, include: { menu: { select: { name: true } }, selections: true } } },
  });
  if (!existing) throw notFound('Transaction');
  if (existing.status !== TransactionStatus.open) {
    throw new AppError(
      `Hanya transaksi status open yang bisa diedit (saat ini: ${existing.status})`,
      400,
    );
  }
  const item = existing.items[0];
  if (!item) {
    throw new AppError(`Item id=${itemId} tidak ditemukan di transaksi ${transactionId}`, 404);
  }

  const newQty = input.qty ?? item.qty;
  const qtyDelta = newQty - item.qty;
  // notes: explicit undefined = jangan ubah; null atau empty string = clear; else set.
  const newNotes = input.notes !== undefined ? input.notes || null : item.notes;
  const newSubtotal = item.unitPrice.mul(newQty);

  await prisma.$transaction(async (tx) => {
    await tx.transactionItem.update({
      where: { id: itemId },
      data: {
        qty: newQty,
        subtotal: newSubtotal,
        notes: newNotes,
      },
    });
    // Resolve stock target hanya kalau qty berubah (notes-only update skip stok).
    if (qtyDelta !== 0) {
      const graph = await buildMenuGraph(tx);
      const deductions = deductionsForStoredItem(graph, item);
      const absDelta = Math.abs(qtyDelta);
      for (const ded of deductions) {
        const amount = ded.qty * absDelta;
        if (qtyDelta > 0) {
          // qty naik → decrement stok lebih banyak (audit reason=order)
          const delta = -amount;
          const updated = await tx.portionStock.update({
            where: { menuId: ded.menuId },
            data: { currentQty: { decrement: amount } },
          });
          await tx.portionMovement.create({
            data: {
              menuId: ded.menuId,
              delta,
              reason: PortionMovementReason.order,
              transactionId,
              transactionItemId: itemId,
              qtyBefore: updated.currentQty - delta,
              qtyAfter: updated.currentQty,
              note: `Edit item qty +${qtyDelta} (${item.menu.name})`,
              userId,
            },
          });
        } else {
          // qty turun → reverse stok (audit reason=refundVoid)
          const updated = await tx.portionStock.update({
            where: { menuId: ded.menuId },
            data: { currentQty: { increment: amount } },
          });
          await tx.portionMovement.create({
            data: {
              menuId: ded.menuId,
              delta: amount,
              reason: PortionMovementReason.refundVoid,
              transactionId,
              transactionItemId: itemId,
              qtyBefore: updated.currentQty - amount,
              qtyAfter: updated.currentQty,
              note: `Edit item qty ${qtyDelta} (${item.menu.name})`,
              userId,
            },
          });
        }
      }
    }
    await recomputeSubtotal(tx, transactionId);
  });

  return getTransactionById(transactionId);
}

/// REV 2.4: hapus single item dari Tx open. Reverse stock decrement (kalau target
/// portion) + audit log refundVoid + recompute subtotal Tx. Throw kalau Tx tidak
/// open atau itemId bukan milik Tx tersebut.
export async function deleteTransactionItem(
  transactionId: number,
  itemId: number,
  userId: number,
): Promise<TransactionView> {
  const existing = await prisma.transaction.findUnique({
    where: { id: transactionId },
    // REV 2.10: bawa variantId + selections + menu name untuk resolve FK-based.
    include: { items: { where: { id: itemId }, include: { menu: { select: { name: true } }, selections: true } } },
  });
  if (!existing) throw notFound('Transaction');
  if (existing.status !== TransactionStatus.open) {
    throw new AppError(
      `Hanya transaksi status open yang bisa diedit (saat ini: ${existing.status})`,
      400,
    );
  }
  const item = existing.items[0];
  if (!item) {
    throw new AppError(`Item id=${itemId} tidak ditemukan di transaksi ${transactionId}`, 404);
  }

  await prisma.$transaction(async (tx) => {
    // REV 2.10: resolve reverse deductions SEBELUM delete (selections cascade-deleted
    // saat item dihapus). Graph FK-based - konsisten dengan create/void.
    const graph = await buildMenuGraph(tx);
    const deductions = deductionsForStoredItem(graph, item);
    await tx.transactionItem.delete({ where: { id: itemId } });
    for (const ded of deductions) {
      const incBy = ded.qty * item.qty;
      const updated = await tx.portionStock.update({
        where: { menuId: ded.menuId },
        data: { currentQty: { increment: incBy } },
      });
      // REV 2.8: item sudah dihapus → transactionItemId null (hanya tautkan transaksi).
      await tx.portionMovement.create({
        data: {
          menuId: ded.menuId,
          delta: incBy,
          reason: PortionMovementReason.refundVoid,
          transactionId,
          qtyBefore: updated.currentQty - incBy,
          qtyAfter: updated.currentQty,
          note: `hapus item "${item.menu.name}" qty=${item.qty}`,
          userId,
        },
      });
    }
    // REV 2.5: cek remaining items setelah delete. Kalau kosong → auto-void Tx
    // supaya tidak tampil shell kosong di view-mode kasir. Audit trail tetap
    // utuh (status=void + voidedAt). User bisa "Tambah Pesanan" baru kalau
    // mau mulai ulang. Stock decrement sudah ter-reverse via delete item
    // sebelumnya, jadi void di sini cuma penanda status (no stock effect).
    const remaining = await tx.transactionItem.count({ where: { transactionId } });
    if (remaining === 0) {
      await tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: TransactionStatus.void,
          voidedAt: new Date(),
          subtotal: new Prisma.Decimal(0),
          total: new Prisma.Decimal(0),
        },
      });
    } else {
      await recomputeSubtotal(tx, transactionId);
    }
  });

  return getTransactionById(transactionId);
}

export async function listTransactions(query: ListTransactionsQuery): Promise<TransactionView[]> {
  const where: Prisma.TransactionWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.shiftId) where.shiftId = query.shiftId;
  if (query.orderType) where.orderType = query.orderType;
  if (query.date) {
    const day = new Date(query.date);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);
    where.createdAt = { gte: day, lt: nextDay };
  }

  const ts = await prisma.transaction.findMany({
    where,
    include: transactionInclude,
    orderBy: { createdAt: 'desc' },
  });
  return ts.map(toTransactionView);
}

/// REV 2.4: GET /transactions/table/:tableNumber - fetch semua transaksi di meja
/// untuk POS view-mode (multi-Pesanan per meja, grouped by Tx).
///
/// Implicit filter:
///   - orderType=dineIn (takeaway tidak punya tableNumber)
///   - mergedIntoId=null (source yang sudah di-merge tidak ditampilkan ganda - parent saja)
///   - REV 2.5: items.some={} (skip zombie Tx dengan 0 items - shell sisa dari
///     flow lama sebelum auto-void atau dari unmerge edge case. Audit trail
///     tetap visible di HistoryPage; di sini view-mode harus clean.)
///
/// orderBy createdAt ASC supaya Pesanan #1 = paling lama (sesuai display per spec user).
export async function listTransactionsByTable(
  tableNumber: number,
  status?: TransactionStatus,
): Promise<TransactionView[]> {
  const where: Prisma.TransactionWhereInput = {
    tableNumber,
    orderType: OrderType.dineIn,
    mergedIntoId: null,
    items: { some: {} },
  };
  if (status) where.status = status;

  const ts = await prisma.transaction.findMany({
    where,
    include: transactionInclude,
    orderBy: { createdAt: 'asc' },
  });
  return ts.map(toTransactionView);
}

// Helper untuk smoke-test atau debugging: hapus warning unused-var UserRole.
// (UserRole dipakai di authorize layer; export ulang untuk konsistensi modul.)
export { UserRole };

// ============================================================
// Merge Bill (REV 2.1 dasar, REV 2.5 reused untuk Combine Tables)
// ============================================================

/// Merge bill: sourceIds mendapat mergedIntoId=targetId. Source + target harus
/// status=open + belum merged ke transaksi lain.
///
/// REV 2.5: dipakai untuk 2 use case dengan UI berbeda tapi logic sama:
///   1. Add Round (intra-table, sudah ada REV 2.4) - merge multi-Tx sebelum bayar
///   2. Combine Tables (inter-table, baru REV 2.5) - merge dari TablesPage atau PaymentModal
///
/// REV 2.6 shift-redesign: merge tidak lagi memigrasi shiftId. Attribution
/// ditentukan saat payment (addPayment re-stamp parent.shiftId ke shift yang open
/// saat itu). Source tetap di shift lama-nya - tidak masalah karena revenue
/// queries sudah exclude mergedIntoId IS NOT NULL.
export async function mergeBills(input: MergeInput): Promise<TransactionView> {
  const target = await prisma.transaction.findUnique({ where: { id: input.targetId } });
  if (!target) throw notFound('Target transaction');
  if (target.status !== TransactionStatus.open) {
    throw new AppError('Target transaction harus status open', 400);
  }
  if (target.mergedIntoId !== null) {
    throw new AppError('Target sudah merged ke transaksi lain - pilih parent saja', 400);
  }

  const sources = await prisma.transaction.findMany({
    where: { id: { in: input.sourceIds } },
  });
  if (sources.length !== input.sourceIds.length) {
    throw new AppError('Beberapa source transaction tidak ditemukan', 400);
  }

  for (const s of sources) {
    if (s.status !== TransactionStatus.open) {
      throw new AppError(`Source transaction ${s.id} status=${s.status}, hanya yang open boleh di-merge`, 400);
    }
    if (s.mergedIntoId !== null) {
      throw new AppError(`Source transaction ${s.id} sudah merged ke ${s.mergedIntoId}`, 400);
    }
  }

  // Attribution = parent.shiftId only (set at payment via re-stamp); sources
  // excluded from revenue via mergedIntoId. Merge cuma set pointer di sources.
  await prisma.transaction.updateMany({
    where: { id: { in: input.sourceIds } },
    data: { mergedIntoId: target.id },
  });
  return getTransactionById(target.id);
}

/// REV 2.5: Unmerge bill - reverse mergeBills untuk source Tx.
/// Hanya valid kalau target belum punya payment slice (sebelum first slice, total
/// belum di-commit ke aggregate-based). Setelah first slice, aggregate sudah
/// locked di Tx.total → unmerge bakal bikin total ngambang → disallow.
///
/// Use case: kasir miss-click combine, mau cancel sebelum bayar. Atau bayar via
/// PaymentModal lihat detail sources salah, mau lepas salah satunya.
///
/// Validate:
///   - source Tx ada AND mergedIntoId != null
///   - source.status === open (yang sudah paid via cascade tidak boleh dilepas)
///   - target.status === open
///   - target.payments.length === 0 (belum ada slice - aggregate belum locked)
///
/// Effect: set source.mergedIntoId = null. Source kembali jadi standalone Tx.
/// Return target Tx terbaru (caller PaymentModal yang refetch context).
export async function unmergeBill(sourceId: number): Promise<TransactionView> {
  const source = await prisma.transaction.findUnique({
    where: { id: sourceId },
  });
  if (!source) throw notFound('Source transaction');
  if (source.mergedIntoId === null) {
    throw new AppError(`Transaction ${sourceId} tidak di-merge ke mana-mana`, 400);
  }
  if (source.status !== TransactionStatus.open) {
    throw new AppError(
      `Source transaction ${sourceId} status=${source.status}, hanya yang open boleh dilepas`,
      400,
    );
  }

  const targetId = source.mergedIntoId;
  const target = await prisma.transaction.findUnique({
    where: { id: targetId },
    include: { payments: true },
  });
  if (!target) {
    // Defensive: orphan merge reference, allow unmerge supaya source recoverable.
    await prisma.transaction.update({
      where: { id: sourceId },
      data: { mergedIntoId: null },
    });
    return getTransactionById(sourceId);
  }
  if (target.status !== TransactionStatus.open) {
    throw new AppError(
      `Target transaction ${targetId} status=${target.status}, tidak bisa unmerge`,
      400,
    );
  }
  if (target.payments.length > 0) {
    throw new AppError(
      'Target sudah ada pembayaran sebagian. Hapus slice pembayaran dulu sebelum unmerge.',
      400,
    );
  }

  await prisma.transaction.update({
    where: { id: sourceId },
    data: { mergedIntoId: null },
  });

  return getTransactionById(targetId);
}

