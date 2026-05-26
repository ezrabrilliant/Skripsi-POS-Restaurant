// Cleanup zombie Transaction shell - status=open + items.length=0.
//
// Penyebab historis (sebelum REV 2.5 auto-void fix di deleteTransactionItem):
//   - User hapus semua item dari Tx open tapi tidak void → Tx tetap status=open
//     dengan 0 items, total=0. View-mode POSPage menampilkan shell kosong yang
//     tidak ada use case.
//   - Edge case unmerge setelah parent paid yang stranding source.
//
// REV 2.5 fixes:
//   - deleteTransactionItem auto-void kalau remaining items === 0 (prevent future)
//   - listTransactionsByTable filter items.some={} (hide zombie dari POSPage view)
//   - Script ini: one-shot cleanup zombie EXISTING di DB (audit trail dipertahankan
//     via status=void + voidedAt, BUKAN delete row).
//
// Safe untuk dijalankan berulang - kalau no zombie, no-op.
//
// Jalankan: cd backend && npx tsx scripts/cleanup-empty-tx.ts

import { PrismaClient, Prisma, TransactionStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupEmptyTx() {
  const zombies = await prisma.transaction.findMany({
    where: {
      status: TransactionStatus.open,
      items: { none: {} },
    },
    select: {
      id: true,
      tableNumber: true,
      orderType: true,
      createdAt: true,
      createdBy: { select: { name: true } },
    },
    orderBy: { id: 'asc' },
  });

  if (zombies.length === 0) {
    console.log('✓ Tidak ada zombie Tx ditemukan. DB sudah bersih.');
    return;
  }

  console.log(`Ditemukan ${zombies.length} zombie Tx (status=open, items=0):`);
  for (const z of zombies) {
    const target =
      z.orderType === 'dineIn'
        ? `Meja ${z.tableNumber ?? '?'}`
        : 'Takeaway';
    console.log(
      `  Tx #${z.id} · ${target} · ${z.createdAt.toISOString()} · by ${z.createdBy.name}`,
    );
  }

  const now = new Date();
  const result = await prisma.transaction.updateMany({
    where: { id: { in: zombies.map((z) => z.id) } },
    data: {
      status: TransactionStatus.void,
      voidedAt: now,
      subtotal: new Prisma.Decimal(0),
      discountAmount: new Prisma.Decimal(0),
      taxAmount: new Prisma.Decimal(0),
      total: new Prisma.Decimal(0),
    },
  });

  console.log(`\n✓ Voided ${result.count} zombie Tx. Status sekarang: void.`);
  console.log('  Audit trail tetap tersedia di HistoryPage filter status=void.');
}

cleanupEmptyTx()
  .catch((e) => {
    console.error('✗ Cleanup gagal:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
