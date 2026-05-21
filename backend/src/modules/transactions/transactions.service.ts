// Logika bisnis modul transaksi: siklus pesanan meja dari buka hingga
// dibayar/dibatalkan, termasuk mekanisme force order.

import type { Prisma, TransactionStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError, notFound } from '../../utils/errors';
import { todayString, toDateOnly } from '../../utils/date';
import { requireOpenShift } from '../shifts/shifts.service';
import { verifyPin } from '../auth/auth.service';
import type {
  AddItemInput,
  UpdateItemInput,
  SyncItemsInput,
  PayInput,
} from './transactions.schema';

// ---- Bentuk DTO ----

export interface TransactionItemDto {
  id: number;
  menuId: number;
  menuName: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
  isForceOrder: boolean;
}

export interface TransactionDto {
  id: number;
  shiftId: number;
  tableNumber: number;
  cashierId: number;
  status: TransactionStatus;
  paymentMethod: string | null;
  subtotal: number;
  discountAmount: number;
  total: number;
  createdAt: string;
  paidAt: string | null;
  voidedAt: string | null;
  items: TransactionItemDto[];
}

const txInclude = {
  items: {
    include: { menu: { select: { name: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.TransactionInclude;

type TxWithItems = Prisma.TransactionGetPayload<{ include: typeof txInclude }>;

function toDto(tx: TxWithItems): TransactionDto {
  return {
    id: tx.id,
    shiftId: tx.shiftId,
    tableNumber: tx.tableNumber,
    cashierId: tx.cashierId,
    status: tx.status,
    paymentMethod: tx.paymentMethod,
    subtotal: Number(tx.subtotal),
    discountAmount: Number(tx.discountAmount),
    total: Number(tx.total),
    createdAt: tx.createdAt.toISOString(),
    paidAt: tx.paidAt ? tx.paidAt.toISOString() : null,
    voidedAt: tx.voidedAt ? tx.voidedAt.toISOString() : null,
    items: tx.items.map((it) => ({
      id: it.id,
      menuId: it.menuId,
      menuName: it.menu.name,
      qty: it.qty,
      unitPrice: Number(it.unitPrice),
      subtotal: Number(it.subtotal),
      isForceOrder: it.isForceOrder,
    })),
  };
}

// ---- Helper internal ----

/** Ambil transaksi + item, atau lempar 404. */
async function fetchTx(id: number): Promise<TxWithItems> {
  const tx = await prisma.transaction.findUnique({ where: { id }, include: txInclude });
  if (!tx) throw notFound('Transaksi');
  return tx;
}

/** Ambil transaksi yang harus berstatus open. */
async function fetchOpenTx(id: number): Promise<TxWithItems> {
  const tx = await fetchTx(id);
  if (tx.status !== 'open') {
    throw new AppError('Transaksi sudah ditutup (lunas/batal), tidak bisa diubah', 409);
  }
  return tx;
}

/** Stok tersisa sebuah menu hari ini (0 bila belum ada entri stok). */
async function availableStock(menuId: number): Promise<number> {
  const row = await prisma.dailyMenuStock.findUnique({
    where: { date_menuId: { date: toDateOnly(todayString()), menuId } },
  });
  return row?.currentStock ?? 0;
}

/** Hitung ulang subtotal & total transaksi dari item-itemnya. */
async function recomputeTotals(txId: number): Promise<void> {
  const items = await prisma.transactionItem.findMany({ where: { transactionId: txId } });
  const subtotal = items.reduce((sum, it) => sum + Number(it.subtotal), 0);
  const tx = await prisma.transaction.findUniqueOrThrow({ where: { id: txId } });
  const total = subtotal - Number(tx.discountAmount);
  await prisma.transaction.update({
    where: { id: txId },
    data: { subtotal, total: total < 0 ? 0 : total },
  });
}

/**
 * Validasi satu item & siapkan datanya. Menerapkan aturan force order:
 * bila qty melebihi stok dan forceOrder belum dikonfirmasi, lempar error 409.
 */
async function prepareItem(input: {
  menuId: number;
  qty: number;
  forceOrder: boolean;
}): Promise<{ menuId: number; qty: number; unitPrice: number; subtotal: number; isForceOrder: boolean }> {
  const menu = await prisma.menu.findUnique({ where: { id: input.menuId } });
  if (!menu) throw notFound('Menu');
  if (!menu.isActive) throw new AppError(`Menu "${menu.name}" sedang non-aktif`, 400);

  const available = await availableStock(input.menuId);
  const insufficient = input.qty > available;

  if (insufficient && !input.forceOrder) {
    throw new AppError(
      `Stok "${menu.name}" tidak cukup (tersisa ${available}, diminta ${input.qty}). ` +
        'Konfirmasi force order untuk tetap melanjutkan.',
      409,
    );
  }

  const unitPrice = Number(menu.price);
  return {
    menuId: input.menuId,
    qty: input.qty,
    unitPrice,
    subtotal: unitPrice * input.qty,
    isForceOrder: insufficient,
  };
}

// ---- Operasi utama ----

/** Buka transaksi baru untuk sebuah meja kosong. */
export async function createTransaction(
  cashierId: number,
  tableNumber: number,
): Promise<TransactionDto> {
  const shift = await requireOpenShift(cashierId);

  const occupied = await prisma.transaction.findFirst({
    where: { tableNumber, status: 'open' },
  });
  if (occupied) {
    throw new AppError(`Meja ${tableNumber} sedang terisi (ada pesanan belum dibayar)`, 409);
  }

  const tx = await prisma.transaction.create({
    data: { shiftId: shift.id, tableNumber, cashierId },
    include: txInclude,
  });
  return toDto(tx);
}

/** Detail satu transaksi. */
export async function getTransaction(id: number): Promise<TransactionDto> {
  return toDto(await fetchTx(id));
}

/** Daftar transaksi yang masih terbuka. */
export async function listOpenTransactions(): Promise<TransactionDto[]> {
  const rows = await prisma.transaction.findMany({
    where: { status: 'open' },
    include: txInclude,
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(toDto);
}

/** Tambah satu item ke transaksi. */
export async function addItem(txId: number, input: AddItemInput): Promise<TransactionDto> {
  await fetchOpenTx(txId);
  const prepared = await prepareItem(input);
  await prisma.transactionItem.create({ data: { transactionId: txId, ...prepared } });
  await recomputeTotals(txId);
  return getTransaction(txId);
}

/** Ubah jumlah satu item. */
export async function updateItem(
  txId: number,
  itemId: number,
  input: UpdateItemInput,
): Promise<TransactionDto> {
  await fetchOpenTx(txId);
  const item = await prisma.transactionItem.findUnique({ where: { id: itemId } });
  if (!item || item.transactionId !== txId) throw notFound('Item transaksi');

  const prepared = await prepareItem({
    menuId: item.menuId,
    qty: input.qty,
    forceOrder: input.forceOrder,
  });
  await prisma.transactionItem.update({
    where: { id: itemId },
    data: { qty: prepared.qty, subtotal: prepared.subtotal, isForceOrder: prepared.isForceOrder },
  });
  await recomputeTotals(txId);
  return getTransaction(txId);
}

/** Hapus satu item dari transaksi. */
export async function removeItem(txId: number, itemId: number): Promise<TransactionDto> {
  await fetchOpenTx(txId);
  const item = await prisma.transactionItem.findUnique({ where: { id: itemId } });
  if (!item || item.transactionId !== txId) throw notFound('Item transaksi');

  await prisma.transactionItem.delete({ where: { id: itemId } });
  await recomputeTotals(txId);
  return getTransaction(txId);
}

/** Sinkronkan seluruh isi keranjang: ganti semua item dengan daftar baru. */
export async function syncItems(txId: number, input: SyncItemsInput): Promise<TransactionDto> {
  await fetchOpenTx(txId);

  // Validasi semua item dulu sebelum menulis apa pun.
  const prepared = [];
  for (const item of input.items) {
    prepared.push(await prepareItem(item));
  }

  await prisma.$transaction([
    prisma.transactionItem.deleteMany({ where: { transactionId: txId } }),
    ...prepared.map((p) => prisma.transactionItem.create({ data: { transactionId: txId, ...p } })),
  ]);
  await recomputeTotals(txId);
  return getTransaction(txId);
}

/** Proses pembayaran: tandai lunas & kurangi stok tiap item. */
export async function payTransaction(id: number, input: PayInput): Promise<TransactionDto> {
  const tx = await fetchOpenTx(id);
  if (tx.items.length === 0) {
    throw new AppError('Transaksi tidak memiliki item, tidak bisa dibayar', 400);
  }

  const date = toDateOnly(todayString());
  const subtotal = tx.items.reduce((s, it) => s + Number(it.subtotal), 0);
  const total = Math.max(0, subtotal - input.discountAmount);

  await prisma.$transaction(async (db) => {
    // Kurangi stok tiap item — tidak pernah turun di bawah nol (dukungan force order).
    for (const item of tx.items) {
      const stock = await db.dailyMenuStock.findUnique({
        where: { date_menuId: { date, menuId: item.menuId } },
      });
      if (stock) {
        await db.dailyMenuStock.update({
          where: { id: stock.id },
          data: { currentStock: Math.max(0, stock.currentStock - item.qty) },
        });
      }
    }
    await db.transaction.update({
      where: { id },
      data: {
        status: 'paid',
        paymentMethod: input.paymentMethod,
        discountAmount: input.discountAmount,
        subtotal,
        total,
        paidAt: new Date(),
      },
    });
  });

  return getTransaction(id);
}

/** Batalkan transaksi. Wajib otorisasi PIN owner. */
export async function voidTransaction(id: number, ownerPin: string): Promise<TransactionDto> {
  const owner = await verifyPin(ownerPin);
  if (owner.role !== 'owner') {
    throw new AppError('Pembatalan pesanan harus diotorisasi dengan PIN owner', 403);
  }

  await fetchOpenTx(id); // hanya transaksi open yang bisa dibatalkan
  await prisma.transaction.update({
    where: { id },
    data: { status: 'void', voidedAt: new Date() },
  });
  return getTransaction(id);
}

/** Riwayat transaksi (lunas/batal) dengan filter tanggal & status. */
export async function getHistory(filter: {
  date?: string;
  status?: 'paid' | 'void';
}): Promise<TransactionDto[]> {
  const where: Prisma.TransactionWhereInput = {
    status: filter.status ?? { in: ['paid', 'void'] },
  };
  if (filter.date) {
    const start = toDateOnly(filter.date);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    where.createdAt = { gte: start, lt: end };
  }

  const rows = await prisma.transaction.findMany({
    where,
    include: txInclude,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toDto);
}

/** Ringkasan penjualan hari ini: jumlah & total transaksi lunas per metode bayar. */
export async function getDailySummary(dateStr?: string): Promise<{
  date: string;
  totalPaid: number;
  totalRevenue: number;
  byMethod: Record<string, { count: number; total: number }>;
}> {
  const str = dateStr ?? todayString();
  const start = toDateOnly(str);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const paid = await prisma.transaction.findMany({
    where: { status: 'paid', paidAt: { gte: start, lt: end } },
  });

  const byMethod: Record<string, { count: number; total: number }> = {};
  let totalRevenue = 0;
  for (const tx of paid) {
    const method = tx.paymentMethod ?? 'unknown';
    const amount = Number(tx.total);
    byMethod[method] ??= { count: 0, total: 0 };
    byMethod[method].count += 1;
    byMethod[method].total += amount;
    totalRevenue += amount;
  }

  return { date: str, totalPaid: paid.length, totalRevenue, byMethod };
}
