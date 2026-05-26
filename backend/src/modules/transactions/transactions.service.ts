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
//   - PB1 10% dihitung saat payment pertama dari (subtotal - discount).
//   - Void boleh dilakukan kasir sendiri tanpa approval.

import {
  OrderType,
  PaymentMethod,
  Prisma,
  PortionMovementReason,
  ShiftType,
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
  AddPaymentInput,
  ListTransactionsQuery,
  OrderItemInput,
  MergeInput,
  UpdateItemInput,
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
  /// REV 2.4: catatan per item dari waiter/kasir saat input. Mis. "kurang manis"
  /// atau "Panas"/"Dingin" untuk minuman ambigu suhu.
  notes: string | null;
  createdAt: string;
}

/// REV 2.5: payment slice per Transaction. Single tender = 1 record, split tender = N records.
export interface TransactionPaymentView {
  id: number;
  method: PaymentMethod;
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
    items: { include: { menu: { select: { name: true } } } };
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
  items: { include: { menu: { select: { name: true } } } },
  payments: {
    include: { recordedBy: { select: { name: true } } },
    orderBy: { recordedAt: 'asc' },
  },
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
        // REV 2.4: persist notes kalau ada. null kalau tidak diisi.
        notes: r.input.notes ?? null,
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
  // REV 2.3 shift-decoupling + REV 2.5 multi-cashier sharing:
  // Auto-resolve shift dari active shifts system-wide. Frontend tidak kirim shiftId.
  //   - 0 active           -> 409 (kasir harus buka shift dulu).
  //   - 1 active           -> attach ke shift itu.
  //   - 2 active beda tipe -> pagi+malam transition (valid). Resolve via jam
  //                           server: pagi < 18:00, malam >= 18:00.
  //   - 2+ active tipe sama-> Anomaly. Shouldn't happen post-REV 2.5 openShift
  //                           constraint. Defensive 409.
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
  let shift: typeof activeShifts[number];
  if (activeShifts.length === 1) {
    shift = activeShifts[0]!;
  } else {
    const types = new Set(activeShifts.map((s) => s.type));
    if (types.size === activeShifts.length) {
      // 2+ beda tipe (mis. pagi + malam transition). Pick via jam server.
      const hour = new Date().getHours();
      const targetType = hour >= 18 ? ShiftType.malam : ShiftType.pagi;
      shift = activeShifts.find((s) => s.type === targetType) ?? activeShifts[0]!;
    } else {
      // Anomaly: tipe duplikat.
      const list = activeShifts.map((s) => `#${s.id} (${s.type})`).join(', ');
      throw new AppError(
        `Anomaly: ada ${activeShifts.length} shift aktif dengan tipe duplikat (${list}). ` +
        `Hubungi owner untuk audit data.`,
        409,
      );
    }
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

/// REV 2.5: addPayment - tambah 1 payment slice ke Transaction.
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
///   - bank wajib untuk method=edc atau transfer (validasi Zod superRefine)
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

  // REV 2.5: gojek + grab = GoFood/GrabFood merchant app settlement → takeaway only.
  // Per docs/operasional-resto.md Mapping pembayaran: dine-in customer datang ke
  // resto, tidak masuk via app merchant. Block di service layer (Zod schema tidak
  // punya akses ke Tx.orderType).
  if (
    existing.orderType === OrderType.dineIn &&
    (input.method === PaymentMethod.gojek || input.method === PaymentMethod.grab)
  ) {
    throw new AppError(
      'Metode GoFood/GrabFood hanya untuk takeaway (settlement merchant app). Pilih cash/EDC/QRIS/transfer untuk dine-in.',
      400,
    );
  }

  const isFirstSlice = existing.payments.length === 0;
  const discountInput = input.discountAmount ?? 0;
  if (!isFirstSlice && discountInput > 0) {
    throw new AppError(
      'Diskon hanya bisa di-set saat pembayaran pertama (sebelum ada slice)',
      400,
    );
  }

  // Aggregate subtotal (parent + mergedFrom open Tx)
  const mergedFrom = await prisma.transaction.findMany({
    where: { mergedIntoId: transactionId },
    select: { id: true, subtotal: true, status: true },
  });
  const aggregateSubtotal = mergedFrom.reduce(
    (sum, m) => sum.add(m.subtotal),
    existing.subtotal,
  );
  if (aggregateSubtotal.isZero()) {
    throw new AppError('Transaksi tidak punya item, tidak bisa dibayar', 400);
  }

  // Resolve effective discount/tax/total
  let effectiveDiscount: Prisma.Decimal;
  let effectiveTax: Prisma.Decimal;
  let effectiveTotal: Prisma.Decimal;

  if (isFirstSlice) {
    effectiveDiscount = new Prisma.Decimal(discountInput);
    if (effectiveDiscount.greaterThan(aggregateSubtotal)) {
      throw new AppError('Diskon tidak boleh lebih besar dari subtotal agregat', 400);
    }
    const baseAfterDiscount = aggregateSubtotal.sub(effectiveDiscount);
    effectiveTax = baseAfterDiscount.mul('0.10').toDecimalPlaces(2);
    effectiveTotal = baseAfterDiscount.add(effectiveTax);
  } else {
    // Slice ke-2+: pakai nilai existing yang sudah ter-set saat first slice
    effectiveDiscount = existing.discountAmount;
    effectiveTax = existing.taxAmount;
    effectiveTotal = existing.total;
  }

  // Compute remaining
  const sumExistingPayments = existing.payments.reduce(
    (sum, p) => sum.add(p.amount),
    new Prisma.Decimal(0),
  );
  const remaining = effectiveTotal.sub(sumExistingPayments);
  const amount = new Prisma.Decimal(input.amount);

  if (amount.lessThanOrEqualTo(0)) {
    throw new AppError('Nominal pembayaran harus lebih dari 0', 400);
  }
  if (amount.greaterThan(remaining)) {
    throw new AppError(
      `Nominal melebihi sisa tagihan. Sisa: Rp ${remaining.toFixed(0)}, dimasukkan: Rp ${amount.toFixed(0)}`,
      400,
    );
  }

  await prisma.$transaction(async (tx) => {
    // Update tax/total/discount kalau first slice
    if (isFirstSlice) {
      await tx.transaction.update({
        where: { id: transactionId },
        data: {
          discountAmount: effectiveDiscount,
          taxAmount: effectiveTax,
          total: effectiveTotal,
        },
      });
    }

    // Insert payment slice
    await tx.transactionPayment.create({
      data: {
        transactionId,
        method: input.method,
        bank: input.bank ?? null,
        amount,
        recordedById: userId,
      },
    });

    // Cek apakah sudah lunas
    const newSum = sumExistingPayments.add(amount);
    if (newSum.greaterThanOrEqualTo(effectiveTotal)) {
      const paidAt = new Date();
      await tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: TransactionStatus.paid,
          paidAt,
        },
      });
      // Cascade ke mergedFrom open Tx: status=paid, total=0, discount=0, tax=0
      const openSources = mergedFrom.filter((m) => m.status === TransactionStatus.open);
      if (openSources.length > 0) {
        await tx.transaction.updateMany({
          where: { mergedIntoId: transactionId, status: TransactionStatus.open },
          data: {
            status: TransactionStatus.paid,
            discountAmount: new Prisma.Decimal(0),
            taxAmount: new Prisma.Decimal(0),
            total: new Prisma.Decimal(0),
            paidAt,
          },
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
    include: { items: { where: { id: itemId } } },
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

  // Resolve stock target hanya kalau qty berubah (notes-only update skip stok).
  let stockTargetMenuId: number | null = null;
  let resolvedMenuName: string = '';
  if (qtyDelta !== 0) {
    const resolved = await resolveItems([
      {
        menuId: item.menuId,
        qty: Math.abs(qtyDelta),
        subOptionsSelected:
          typeof item.subOptionsSelected === 'object' && item.subOptionsSelected !== null
            ? (item.subOptionsSelected as Record<string, string>)
            : undefined,
      },
    ]);
    stockTargetMenuId = resolved[0]!.stockTargetMenuId;
    resolvedMenuName = resolved[0]!.menu.name;
  }

  await prisma.$transaction(async (tx) => {
    await tx.transactionItem.update({
      where: { id: itemId },
      data: {
        qty: newQty,
        subtotal: newSubtotal,
        notes: newNotes,
      },
    });
    if (qtyDelta !== 0 && stockTargetMenuId !== null) {
      if (qtyDelta > 0) {
        // qty naik → decrement stok lebih banyak (audit reason=order)
        await tx.portionStock.update({
          where: { menuId: stockTargetMenuId },
          data: { currentQty: { decrement: qtyDelta } },
        });
        await tx.portionMovement.create({
          data: {
            menuId: stockTargetMenuId,
            delta: -qtyDelta,
            reason: PortionMovementReason.order,
            note: `Edit Tx ${transactionId} item ${itemId} qty +${qtyDelta} (${resolvedMenuName})`,
            userId,
          },
        });
      } else {
        // qty turun → reverse stok (audit reason=refundVoid)
        const reverseAmt = Math.abs(qtyDelta);
        await tx.portionStock.update({
          where: { menuId: stockTargetMenuId },
          data: { currentQty: { increment: reverseAmt } },
        });
        await tx.portionMovement.create({
          data: {
            menuId: stockTargetMenuId,
            delta: reverseAmt,
            reason: PortionMovementReason.refundVoid,
            note: `Edit Tx ${transactionId} item ${itemId} qty ${qtyDelta} (${resolvedMenuName})`,
            userId,
          },
        });
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
    include: { items: { where: { id: itemId } } },
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

  // Resolve stock target via existing pattern supaya reverse decrement konsisten
  // dengan logic create/void.
  const resolved = await resolveItems([
    {
      menuId: item.menuId,
      qty: item.qty,
      subOptionsSelected:
        typeof item.subOptionsSelected === 'object' && item.subOptionsSelected !== null
          ? (item.subOptionsSelected as Record<string, string>)
          : undefined,
    },
  ]);
  const r = resolved[0]!;

  await prisma.$transaction(async (tx) => {
    await tx.transactionItem.delete({ where: { id: itemId } });
    if (r.stockTargetMenuId !== null) {
      await tx.portionStock.update({
        where: { menuId: r.stockTargetMenuId },
        data: { currentQty: { increment: item.qty } },
      });
      await tx.portionMovement.create({
        data: {
          menuId: r.stockTargetMenuId,
          delta: item.qty,
          reason: PortionMovementReason.refundVoid,
          note: `Edit Tx ${transactionId}: hapus item "${r.menu.name}" qty=${item.qty}`,
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

/// Merge bill: sourceIds mendapat mergedIntoId=targetId. Semua harus status=open
/// + sama shift + bukan sudah merged ke transaksi lain.
///
/// REV 2.5: dipakai untuk 2 use case dengan UI berbeda tapi logic sama:
///   1. Add Round (intra-table, sudah ada REV 2.4) - merge multi-Tx sebelum bayar
///   2. Combine Tables (inter-table, baru REV 2.5) - merge dari TablesPage atau PaymentModal
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
    if (s.shiftId !== target.shiftId) {
      throw new AppError(`Source transaction ${s.id} beda shift dengan target - tidak bisa merged`, 400);
    }
  }

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

