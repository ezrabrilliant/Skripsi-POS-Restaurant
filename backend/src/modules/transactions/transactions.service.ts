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
  /// Menu IDs yang harus di-decrement (bisa lebih dari 1 untuk paket dengan
  /// fixedItems + chosen options). Array kosong = tidak ada decrement.
  stockTargetMenuIds: number[];
}

/// Resolve nama menu target → ID menu portion. Throw kalau tidak ketemu atau
/// stockType tidak valid. Linked di-resolve rekursif satu hop ke target final.
async function resolveTargetNameToPortionId(
  targetName: string,
  context: string,
): Promise<number | null> {
  const target = await prisma.menu.findFirst({ where: { name: targetName } });
  if (!target) {
    throw new AppError(`Stock target "${targetName}" (${context}) tidak ditemukan`, 500);
  }
  if (target.stockType === StockType.portion) {
    return target.id;
  }
  if (target.stockType === StockType.linked) {
    const linkedParsed = linkedSubOptionsSchema.safeParse(target.subOptions);
    if (!linkedParsed.success) {
      throw new AppError(
        `Linked target "${target.name}" subOptions tidak valid (butuh {stockTarget})`,
        500,
      );
    }
    return resolveTargetNameToPortionId(
      linkedParsed.data.stockTarget,
      `${context} → linked dari "${target.name}"`,
    );
  }
  // nonStock target = skip decrement (mis. Nasi Putih sebagai fixed item di paket)
  return null;
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

    const stockTargetMenuIds: number[] = [];

    if (menu.stockType === StockType.portion) {
      stockTargetMenuIds.push(menu.id);
    } else if (menu.stockType === StockType.linked) {
      const parsed = linkedSubOptionsSchema.safeParse(menu.subOptions);
      if (!parsed.success) {
        throw new AppError(
          `Menu linked "${menu.name}" punya subOptions tidak valid (butuh {stockTarget})`,
          500,
        );
      }
      const targetId = await resolveTargetNameToPortionId(
        parsed.data.stockTarget,
        `linked dari "${menu.name}"`,
      );
      if (targetId === null) {
        throw new AppError(
          `Linked target "${parsed.data.stockTarget}" harus resolve ke menu portion`,
          500,
        );
      }
      stockTargetMenuIds.push(targetId);
    } else if (menu.stockType === StockType.nonStock && menu.subOptions !== null) {
      // Paket REV 2.6: fixedItems + choices struktur
      const parsed = paketSubOptionsSchema.safeParse(menu.subOptions);
      if (!parsed.success) {
        // subOptions ada tapi bukan paket shape valid - mungkin masih shape lama.
        // Hanya error kalau user kirim subOptionsSelected (kemungkinan kira ini paket).
        if (input.subOptionsSelected) {
          throw new AppError(
            `Menu "${menu.name}" tidak menerima sub-options (structure subOptions tidak valid)`,
            500,
          );
        }
      } else {
        const paket = parsed.data;

        // Validasi customer pilihan untuk setiap choice slot (kalau ada)
        if (paket.choices.length > 0) {
          if (!input.subOptionsSelected) {
            throw new AppError(`Menu "${menu.name}" wajib pilih sub-options`, 400);
          }
          for (const choice of paket.choices) {
            const picked = input.subOptionsSelected[choice.key];
            if (picked === undefined) {
              throw new AppError(
                `Pilihan untuk "${choice.label}" (key=${choice.key}) wajib diisi`,
                400,
              );
            }
            const matchOpt = choice.options.find((o) => o.label === picked);
            if (!matchOpt) {
              throw new AppError(
                `Pilihan "${picked}" tidak valid untuk "${choice.label}" (opsi: ${choice.options.map((o) => o.label).join(', ')})`,
                400,
              );
            }
          }
        }

        // Kumpulkan target stockMenuIds: dari fixedItems + dari chosen options
        const targetNames: string[] = [...paket.fixedItems];
        if (input.subOptionsSelected) {
          for (const choice of paket.choices) {
            const picked = input.subOptionsSelected[choice.key];
            const matchOpt = choice.options.find((o) => o.label === picked);
            if (matchOpt?.stockTarget) {
              targetNames.push(matchOpt.stockTarget);
            }
          }
        }

        for (const targetName of targetNames) {
          const targetId = await resolveTargetNameToPortionId(
            targetName,
            `paket "${menu.name}"`,
          );
          // null = nonStock target (mis. Nasi Putih) → skip decrement
          if (targetId !== null) {
            stockTargetMenuIds.push(targetId);
          }
        }
      }
    }
    // else: nonStock tanpa subOptions → tidak ada decrement (minuman, nasi, dll)

    resolved.push({
      input,
      menu: { id: menu.id, name: menu.name, price: menu.price, stockType: menu.stockType },
      stockTargetMenuIds,
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

    for (const targetMenuId of r.stockTargetMenuIds) {
      await tx.portionStock.update({
        where: { menuId: targetMenuId },
        data: { currentQty: { decrement: r.input.qty } },
      });
      await tx.portionMovement.create({
        data: {
          menuId: targetMenuId,
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
    // REV 2.6: tarif PB1 dari AppSetting (toggle on/off + custom rate). Default OFF
    // karena resto tidak charge PB1 ke customer (harga menu = final). Owner nyalakan
    // via tab Pajak. taxEnabled=false -> ratePct 0 -> tax 0 -> total = baseAfterDiscount.
    const setting = await prisma.appSetting.findUnique({ where: { id: 1 } });
    const ratePct = setting?.taxEnabled ? setting.taxRate : new Prisma.Decimal(0);
    effectiveTax = baseAfterDiscount.mul(ratePct).div(100).toDecimalPlaces(2);
    effectiveTotal = baseAfterDiscount.add(effectiveTax);
  } else {
    // Slice ke-2+: pakai nilai existing yang sudah ter-set saat first slice
    effectiveDiscount = existing.discountAmount;
    effectiveTax = existing.taxAmount;
    effectiveTotal = existing.total;
  }

  // Atomic finalize: lock parent row, re-read committed payments, validate, insert
  // slice, dan (kalau lunas) flip status + re-stamp shiftId — semua di dalam SATU
  // $transaction. Race fix: payments-sum read + remaining-check yang dulu di luar
  // transaction bisa di-bypass dua slice near-simultan; sekarang ter-serialize via
  // FOR UPDATE row lock pada parent.
  await prisma.$transaction(async (tx) => {
    // Lock parent row to serialize concurrent payments on this Tx.
    await tx.$queryRaw`SELECT id FROM transactions WHERE id = ${transactionId} FOR UPDATE`;

    // Re-read committed payments INSIDE the lock (authoritative).
    const slices = await tx.transactionPayment.findMany({ where: { transactionId } });
    const sumExisting = slices.reduce((acc, p) => acc.add(p.amount), new Prisma.Decimal(0));

    // First-slice writes discount/tax/total (computed above).
    if (isFirstSlice) {
      await tx.transaction.update({
        where: { id: transactionId },
        data: { discountAmount: effectiveDiscount, taxAmount: effectiveTax, total: effectiveTotal },
      });
    }

    const remaining = effectiveTotal.sub(sumExisting);
    const amt = new Prisma.Decimal(input.amount);
    if (amt.lessThanOrEqualTo(0)) throw new AppError('Nominal pembayaran harus lebih dari 0', 400);
    if (amt.greaterThan(remaining)) {
      throw new AppError(`Nominal melebihi sisa tagihan. Sisa: Rp ${remaining.toFixed(0)}, dimasukkan: Rp ${amt.toFixed(0)}`, 400);
    }

    await tx.transactionPayment.create({
      data: { transactionId, method: input.method, bank: input.bank ?? null, amount: amt, recordedById: userId },
    });

    const newSum = sumExisting.add(amt);
    if (newSum.greaterThanOrEqualTo(effectiveTotal)) {
      // Re-stamp attribution to the shift open at PAYMENT time (throws 409 if 0 open).
      const shift = await resolveActiveShift('pembayaran');
      const paidAt = new Date();
      // Idempotent finalize: only flips if still open.
      const flipped = await tx.transaction.updateMany({
        where: { id: transactionId, status: TransactionStatus.open },
        data: { status: TransactionStatus.paid, paidAt, shiftId: shift.id },
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
    include: { items: { include: { menu: true } }, shift: { select: { date: true } } },
  });
  if (!existing) throw notFound('Transaction');
  if (existing.status === TransactionStatus.void) {
    throw new AppError('Transaksi sudah void sebelumnya', 400);
  }
  const settled = await prisma.settlement.findFirst({ where: { date: existing.shift.date } });
  if (settled) {
    throw new AppError('Business day transaksi ini sudah di-settle — tidak bisa diubah (refund di luar lingkup sistem)', 409);
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
      for (const targetMenuId of r.stockTargetMenuIds) {
        await tx.portionStock.update({
          where: { menuId: targetMenuId },
          data: { currentQty: { increment: r.input.qty } },
        });
        await tx.portionMovement.create({
          data: {
            menuId: targetMenuId,
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
  let stockTargetMenuIds: number[] = [];
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
    stockTargetMenuIds = resolved[0]!.stockTargetMenuIds;
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
    if (qtyDelta !== 0) {
      for (const targetMenuId of stockTargetMenuIds) {
        if (qtyDelta > 0) {
          // qty naik → decrement stok lebih banyak (audit reason=order)
          await tx.portionStock.update({
            where: { menuId: targetMenuId },
            data: { currentQty: { decrement: qtyDelta } },
          });
          await tx.portionMovement.create({
            data: {
              menuId: targetMenuId,
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
            where: { menuId: targetMenuId },
            data: { currentQty: { increment: reverseAmt } },
          });
          await tx.portionMovement.create({
            data: {
              menuId: targetMenuId,
              delta: reverseAmt,
              reason: PortionMovementReason.refundVoid,
              note: `Edit Tx ${transactionId} item ${itemId} qty ${qtyDelta} (${resolvedMenuName})`,
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
    for (const targetMenuId of r.stockTargetMenuIds) {
      await tx.portionStock.update({
        where: { menuId: targetMenuId },
        data: { currentQty: { increment: item.qty } },
      });
      await tx.portionMovement.create({
        data: {
          menuId: targetMenuId,
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

