// Service modul transactions. REV 2.2/2.3 — core POS flow.
//
// REV 2.3 shift-decoupling:
//   - Field DB `cashier_id` -> `created_by_id` (user yang submit order).
//   - createTransaction tidak terima `shiftId` lagi dari frontend — auto-resolve
//     dari single active shift system-wide. 0 atau 2+ active = 409.
//   - View shape: cashierId/cashierName -> createdById/createdByName + tambah
//     shiftCashierName (denormalize dari shift.cashier.name untuk display
//     "oleh {createdByName} · shift {shiftCashierName}" di HistoryPage).
//
// Konsep utama:
//   - Setiap transaksi terikat ke shift yang masih open.
//   - Decrement PortionStock terjadi saat order di-submit (boleh minus per ground truth).
//     Tiap decrement diabadikan ke PortionMovement (reason=order untuk submit,
//     reason=refundVoid untuk void).
//   - Resolusi stok target tergantung stockType menu:
//       portion  -> decrement stok menu itu sendiri
//       linked   -> decrement stok menu lain (subOptions.stockTarget by name)
//       nonStock + paket subOptions -> decrement target menu via stockMap
//       nonStock tanpa subOptions  -> tidak ada decrement (minuman, nasi, dll)
//   - PB1 10% dihitung saat payment dari (subtotal - discount), bukan saat submit.
//   - Void boleh dilakukan kasir sendiri tanpa approval (sesuai ground truth).
//
// Split bill (partyId) dan merge bill (mergedIntoId) DEFERRED ke Phase 4b.

import {
  OrderType,
  PaymentMethod,
  Prisma,
  PortionMovementReason,
  StockType,
  TransactionStatus,
  UserRole,
} from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { AppError, notFound } from '../../utils/errors';
import {
  linkedSubOptionsSchema,
  paketSubOptionsSchema,
} from '../menus/menus.schema';
import type {
  CreateTransactionInput,
  AddItemsInput,
  PaymentInput,
  ListTransactionsQuery,
  OrderItemInput,
  SplitInput,
  MergeInput,
} from './transactions.schema';

// ============================================================
// View shape (mapper)
// ============================================================

export interface TransactionItemView {
  id: number;
  menuId: number;
  menuName: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
  subOptionsSelected: Prisma.JsonValue;
  partyId: number | null;
  createdAt: string;
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
  paymentMethod: PaymentMethod | null;
  paymentBank: string | null;
  mergedIntoId: number | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  items: TransactionItemView[];
  createdAt: string;
  paidAt: string | null;
  voidedAt: string | null;
}

type TransactionWithRelations = Prisma.TransactionGetPayload<{
  include: {
    createdBy: true;
    shift: { include: { cashier: { select: { name: true } } } };
    items: { include: { menu: { select: { name: true } } } };
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
    paymentMethod: t.paymentMethod,
    paymentBank: t.paymentBank,
    mergedIntoId: t.mergedIntoId,
    subtotal: t.subtotal.toNumber(),
    discountAmount: t.discountAmount.toNumber(),
    taxAmount: t.taxAmount.toNumber(),
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
      partyId: it.partyId,
      createdAt: it.createdAt.toISOString(),
    })),
  };
}

const transactionInclude = {
  createdBy: true,
  shift: { include: { cashier: { select: { name: true } } } },
  items: { include: { menu: { select: { name: true } } } },
} satisfies Prisma.TransactionInclude;

// ============================================================
// Stock resolution
// ============================================================

interface ResolvedItem {
  input: OrderItemInput;
  menu: { id: number; name: string; price: Prisma.Decimal; stockType: StockType };
  stockTargetMenuId: number | null; // null = tidak ada decrement (nonStock tanpa subOptions)
}

/// Validasi item + resolve stok target untuk setiap item.
/// Lakukan SEBELUM transaction DB supaya error muncul cepat tanpa rollback besar.
async function resolveItems(items: OrderItemInput[]): Promise<ResolvedItem[]> {
  const resolved: ResolvedItem[] = [];

  for (const input of items) {
    const menu = await prisma.menu.findUnique({ where: { id: input.menuId } });
    if (!menu) {
      throw new AppError(`Menu id=${input.menuId} tidak ditemukan`, 400);
    }
    if (!menu.isActive) {
      throw new AppError(`Menu "${menu.name}" sudah nonaktif`, 400);
    }

    let stockTargetMenuId: number | null = null;

    if (menu.stockType === StockType.portion) {
      stockTargetMenuId = menu.id;
    } else if (menu.stockType === StockType.linked) {
      const parsed = linkedSubOptionsSchema.safeParse(menu.subOptions);
      if (!parsed.success) {
        throw new AppError(
          `Menu linked "${menu.name}" punya subOptions tidak valid (butuh {stockTarget})`,
          500,
        );
      }
      const target = await prisma.menu.findFirst({ where: { name: parsed.data.stockTarget } });
      if (!target) {
        throw new AppError(`Stock target "${parsed.data.stockTarget}" tidak ditemukan`, 500);
      }
      if (target.stockType !== StockType.portion) {
        throw new AppError(
          `Stock target "${parsed.data.stockTarget}" harus stockType=portion`,
          500,
        );
      }
      stockTargetMenuId = target.id;
    } else if (menu.stockType === StockType.nonStock && menu.subOptions !== null) {
      // Paket dengan pilihan dinamis
      const parsed = paketSubOptionsSchema.safeParse(menu.subOptions);
      if (!parsed.success) {
        // Bisa nonStock dengan subOptions bentuk lain (jarang); skip decrement.
        // Tapi kalau memang mau paket, structure-nya salah → error.
        // Karena kita tidak yakin maksudnya, skip dengan log: anggap tidak ada decrement.
        // Hanya error kalau user kirim subOptionsSelected (mengindikasi mereka kira ini paket).
        if (input.subOptionsSelected) {
          throw new AppError(
            `Menu "${menu.name}" tidak menerima sub-options (structure subOptions tidak valid)`,
            500,
          );
        }
      } else {
        const paket = parsed.data;
        if (!input.subOptionsSelected) {
          throw new AppError(`Menu "${menu.name}" wajib pilih sub-options`, 400);
        }
        // Validasi setiap group ada pilihan + pilihan valid
        for (const group of paket.options) {
          const selected = input.subOptionsSelected[group.key];
          if (selected === undefined) {
            throw new AppError(
              `Pilihan untuk "${group.label}" (key=${group.key}) wajib diisi`,
              400,
            );
          }
          if (!group.options.includes(selected)) {
            throw new AppError(
              `Pilihan "${selected}" tidak valid untuk "${group.label}" (opsi: ${group.options.join(', ')})`,
              400,
            );
          }
        }
        // Susun key gabungan sesuai urutan options[]
        const joined = paket.options.map((g) => input.subOptionsSelected![g.key]).join('|');
        const targetName = paket.stockMap[joined];
        if (!targetName) {
          throw new AppError(
            `Kombinasi pilihan "${joined}" tidak ada di stockMap menu "${menu.name}"`,
            500,
          );
        }
        const target = await prisma.menu.findFirst({ where: { name: targetName } });
        if (!target) {
          throw new AppError(`Stock target "${targetName}" tidak ditemukan`, 500);
        }
        if (target.stockType !== StockType.portion) {
          throw new AppError(`Stock target "${targetName}" harus stockType=portion`, 500);
        }
        stockTargetMenuId = target.id;
      }
    }
    // else: nonStock tanpa subOptions → tidak ada decrement (minuman, nasi, dll)

    resolved.push({
      input,
      menu: { id: menu.id, name: menu.name, price: menu.price, stockType: menu.stockType },
      stockTargetMenuId,
    });
  }

  return resolved;
}

/// Dijalankan di dalam $transaction. Buat TransactionItem, decrement PortionStock,
/// dan insert PortionMovement audit untuk setiap resolved item.
async function persistItemsAndDecrement(
  tx: Prisma.TransactionClient,
  transactionId: number,
  userId: number,
  resolved: ResolvedItem[],
): Promise<void> {
  for (const r of resolved) {
    await tx.transactionItem.create({
      data: {
        transactionId,
        menuId: r.menu.id,
        qty: r.input.qty,
        unitPrice: r.menu.price,
        subtotal: r.menu.price.mul(r.input.qty),
        subOptionsSelected: r.input.subOptionsSelected
          ? (r.input.subOptionsSelected as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });

    if (r.stockTargetMenuId !== null) {
      await tx.portionStock.update({
        where: { menuId: r.stockTargetMenuId },
        data: { currentQty: { decrement: r.input.qty } },
      });
      await tx.portionMovement.create({
        data: {
          menuId: r.stockTargetMenuId,
          delta: -r.input.qty,
          reason: PortionMovementReason.order,
          note: `transactionId=${transactionId} via "${r.menu.name}"`,
          userId,
        },
      });
    }
  }
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

export async function createTransaction(
  userId: number,
  input: CreateTransactionInput,
): Promise<TransactionView> {
  // REV 2.3 shift-decoupling: auto-resolve shift dari single active shift system-wide.
  // Frontend tidak lagi kirim shiftId — backend yang resolve. Validasi:
  //   - 0 active shift  -> 409 (kasir harus buka shift dulu)
  //   - 2+ active shift -> 409 (overlap, tutup salah satu — rekap fiskal ambigu)
  //   - 1 active shift  -> attach ke shift itu
  const activeShifts = await prisma.shift.findMany({
    where: { closedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (activeShifts.length === 0) {
    throw new AppError(
      'Belum ada shift kasir aktif. Kasir harus buka shift dulu sebelum order bisa dimasukkan.',
      409,
    );
  }
  if (activeShifts.length > 1) {
    const list = activeShifts.map((s) => `#${s.id} (${s.type})`).join(', ');
    throw new AppError(
      `Ada ${activeShifts.length} shift aktif: ${list}. Tutup salah satu dulu — rekap fiskal jadi ambigu kalau dibiarkan.`,
      409,
    );
  }
  const shift = activeShifts[0]!;

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

  // Resolve dulu (di luar $transaction supaya rollback ringan kalau error)
  const resolved = await resolveItems(input.items);

  const transactionId = await prisma.$transaction(async (tx) => {
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

  const resolved = await resolveItems(input.items);

  await prisma.$transaction(async (tx) => {
    await persistItemsAndDecrement(tx, transactionId, userId, resolved);
    await recomputeSubtotal(tx, transactionId);
  });

  return getTransactionById(transactionId);
}

export async function payTransaction(
  transactionId: number,
  input: PaymentInput,
): Promise<TransactionView> {
  const existing = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!existing) throw notFound('Transaction');
  if (existing.status !== TransactionStatus.open) {
    throw new AppError(`Hanya transaksi status open yang bisa dibayar (saat ini: ${existing.status})`, 400);
  }
  if (existing.mergedIntoId !== null) {
    throw new AppError('Transaksi ini sudah di-merge ke transaksi lain. Bayar parent-nya saja.', 400);
  }

  // REV 2.3 Phase 4b: kalau ini parent yang menerima merge, hitung aggregate
  // subtotal dari parent.items + sum(mergedFrom.items).
  const mergedFrom = await prisma.transaction.findMany({
    where: { mergedIntoId: transactionId, status: TransactionStatus.open },
    select: { id: true, subtotal: true },
  });
  const aggregateSubtotal = mergedFrom.reduce(
    (sum, m) => sum.add(m.subtotal),
    existing.subtotal,
  );

  if (aggregateSubtotal.isZero()) {
    throw new AppError('Transaksi tidak punya item, tidak bisa dibayar', 400);
  }

  // PB1 10% dari (aggregateSubtotal - discount)
  const discount = new Prisma.Decimal(input.discountAmount);
  if (discount.greaterThan(aggregateSubtotal)) {
    throw new AppError('Diskon tidak boleh lebih besar dari subtotal agregat', 400);
  }
  const baseAfterDiscount = aggregateSubtotal.sub(discount);
  const tax = baseAfterDiscount.mul('0.10').toDecimalPlaces(2);
  const total = baseAfterDiscount.add(tax);

  const paidAt = new Date();

  await prisma.$transaction(async (tx) => {
    // Update parent
    await tx.transaction.update({
      where: { id: transactionId },
      data: {
        status: TransactionStatus.paid,
        paymentMethod: input.paymentMethod,
        paymentBank: input.paymentBank ?? null,
        discountAmount: discount,
        taxAmount: tax,
        total,
        paidAt,
      },
    });

    // Cascade: tandai semua mergedFrom sebagai paid juga (dengan total 0 supaya
    // tidak ter-aggregate di laporan revenue — payment sebenarnya ter-record di parent).
    if (mergedFrom.length > 0) {
      await tx.transaction.updateMany({
        where: { mergedIntoId: transactionId, status: TransactionStatus.open },
        data: {
          status: TransactionStatus.paid,
          paymentMethod: input.paymentMethod,
          paymentBank: input.paymentBank ?? null,
          discountAmount: new Prisma.Decimal(0),
          taxAmount: new Prisma.Decimal(0),
          total: new Prisma.Decimal(0),
          paidAt,
        },
      });
    }
  });

  return getTransactionById(transactionId);
}

export async function voidTransaction(
  transactionId: number,
  userId: number,
): Promise<TransactionView> {
  const existing = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { items: { include: { menu: true } } },
  });
  if (!existing) throw notFound('Transaction');
  if (existing.status === TransactionStatus.void) {
    throw new AppError('Transaksi sudah void sebelumnya', 400);
  }

  // Untuk reverse: kita perlu resolve ulang stock target tiap item (karena
  // subOptions bisa berbeda per item paket). Pakai resolver yang sama.
  const itemsInput: OrderItemInput[] = existing.items.map((it) => ({
    menuId: it.menuId,
    qty: it.qty,
    subOptionsSelected:
      typeof it.subOptionsSelected === 'object' && it.subOptionsSelected !== null
        ? (it.subOptionsSelected as Record<string, string>)
        : undefined,
  }));
  const resolved = await resolveItems(itemsInput);

  await prisma.$transaction(async (tx) => {
    for (const r of resolved) {
      if (r.stockTargetMenuId !== null) {
        await tx.portionStock.update({
          where: { menuId: r.stockTargetMenuId },
          data: { currentQty: { increment: r.input.qty } },
        });
        await tx.portionMovement.create({
          data: {
            menuId: r.stockTargetMenuId,
            delta: r.input.qty,
            reason: PortionMovementReason.refundVoid,
            note: `void transactionId=${transactionId} reverse "${r.menu.name}"`,
            userId,
          },
        });
      }
    }
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

// Helper untuk smoke-test atau debugging: hapus warning unused-var UserRole.
// (UserRole dipakai di authorize layer; export ulang untuk konsistensi modul.)
export { UserRole };

// ============================================================
// REV 2.3 Phase 4b — Split + Merge Bill
// ============================================================

/// Assign partyId per TransactionItem. Cuma valid pada transaksi status=open.
/// partyId null = main (default), >= 1 = party terpisah untuk display struk.
/// MVP scope: visual grouping saja, payment tetap single per transaksi.
export async function splitTransaction(
  transactionId: number,
  input: SplitInput,
): Promise<TransactionView> {
  const existing = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { items: true },
  });
  if (!existing) throw notFound('Transaction');
  if (existing.status !== TransactionStatus.open) {
    throw new AppError('Split bill hanya untuk transaksi status open', 400);
  }

  // Validasi semua itemId milik transaksi ini
  const itemIds = new Set(existing.items.map((it) => it.id));
  for (const a of input.assignments) {
    if (!itemIds.has(a.itemId)) {
      throw new AppError(`TransactionItem id=${a.itemId} bukan milik transaksi ${transactionId}`, 400);
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const a of input.assignments) {
      await tx.transactionItem.update({
        where: { id: a.itemId },
        data: { partyId: a.partyId },
      });
    }
  });

  return getTransactionById(transactionId);
}

/// Merge bill: sourceIds mendapat mergedIntoId=targetId. Semua harus status=open
/// + tipe order sama (dineIn-only sebenarnya, tapi kita allow keduanya) + shift sama
/// + bukan sudah merged ke transaksi lain.
export async function mergeBills(input: MergeInput): Promise<TransactionView> {
  const target = await prisma.transaction.findUnique({ where: { id: input.targetId } });
  if (!target) throw notFound('Target transaction');
  if (target.status !== TransactionStatus.open) {
    throw new AppError('Target transaction harus status open', 400);
  }
  if (target.mergedIntoId !== null) {
    throw new AppError('Target sudah merged ke transaksi lain — pilih parent saja', 400);
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
    if (s.shiftId !== target.shiftId) {
      throw new AppError(`Source transaction ${s.id} beda shift dengan target — tidak bisa merged`, 400);
    }
  }

  await prisma.transaction.updateMany({
    where: { id: { in: input.sourceIds } },
    data: { mergedIntoId: target.id },
  });

  return getTransactionById(target.id);
}

