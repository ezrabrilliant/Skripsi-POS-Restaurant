// Logika bisnis modul meja. Meja bukan entitas basis data — statusnya
// diturunkan dari ada/tidaknya transaksi terbuka pada nomor meja tersebut.

import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { AppError } from '../../utils/errors';
import * as txService from '../transactions/transactions.service';
import type { TransactionDto } from '../transactions/transactions.service';

export interface TableDto {
  tableNumber: number;
  status: 'kosong' | 'terisi';
  transaction: {
    id: number;
    itemCount: number;
    total: number;
    createdAt: string;
  } | null;
}

/** Daftar seluruh meja (1..TABLE_COUNT) beserta statusnya. */
export async function listTables(): Promise<TableDto[]> {
  const openTx = await prisma.transaction.findMany({
    where: { status: 'open' },
    include: { _count: { select: { items: true } } },
  });
  const byTable = new Map(openTx.map((t) => [t.tableNumber, t]));

  const tables: TableDto[] = [];
  for (let n = 1; n <= env.TABLE_COUNT; n += 1) {
    const tx = byTable.get(n);
    tables.push({
      tableNumber: n,
      status: tx ? 'terisi' : 'kosong',
      transaction: tx
        ? {
            id: tx.id,
            itemCount: tx._count.items,
            total: Number(tx.total),
            createdAt: tx.createdAt.toISOString(),
          }
        : null,
    });
  }
  return tables;
}

/** Transaksi terbuka pada sebuah meja (atau null bila meja kosong). */
export async function getOpenTransaction(tableNumber: number): Promise<TransactionDto | null> {
  const tx = await prisma.transaction.findFirst({
    where: { tableNumber, status: 'open' },
    select: { id: true },
  });
  if (!tx) return null;
  return txService.getTransaction(tx.id);
}

/** Pindahkan transaksi terbuka dari satu meja ke meja lain yang kosong. */
export async function transferTransaction(
  fromTable: number,
  toTable: number,
): Promise<TransactionDto> {
  if (fromTable === toTable) {
    throw new AppError('Meja asal dan tujuan tidak boleh sama', 400);
  }
  if (toTable < 1 || toTable > env.TABLE_COUNT) {
    throw new AppError(`Nomor meja tujuan harus antara 1 dan ${env.TABLE_COUNT}`, 400);
  }

  const source = await prisma.transaction.findFirst({
    where: { tableNumber: fromTable, status: 'open' },
  });
  if (!source) throw new AppError(`Meja ${fromTable} tidak punya pesanan terbuka`, 404);

  const targetOccupied = await prisma.transaction.findFirst({
    where: { tableNumber: toTable, status: 'open' },
  });
  if (targetOccupied) throw new AppError(`Meja ${toTable} sedang terisi`, 409);

  await prisma.transaction.update({
    where: { id: source.id },
    data: { tableNumber: toTable },
  });
  return txService.getTransaction(source.id);
}
