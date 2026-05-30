/**
 * ⚠️ DEAD / OBSOLETE pasca REV 2.11 — JANGAN DI-RUN. Script ini menyentuh
 * `raw_material_movements`/`purchase*` yang tabelnya sudah di-DROP di REV 2.11
 * (belanja/raw-materials dihapus). Dipertahankan hanya sebagai catatan historis
 * cara backfill ledger REV 2.8; akan crash kalau dijalankan.
 *
 * REV 2.8 backfill — isi kolom ledger baru di portion_movements & raw_material_movements
 * dari data lama yang hanya menyimpan tautan di teks `note`.
 *
 *  1. FK sumber  — parse `note` (transactionId / Edit Tx / void transactionId / Purchase id).
 *                  HANYA di-set kalau baris sumber benar-benar ada (jaga FK constraint);
 *                  TIDAK pernah me-null-kan FK yang sudah terisi (aman untuk baris baru
 *                  yang ditulis kode REV 2.8 — note-nya sudah manusiawi tanpa pola lama).
 *  2. qty_before / qty_after — rekonstruksi via JALAN-MUNDUR per menu/material dari stok
 *                  sekarang: after(terakhir)=current; before=after−delta; after(sebelum)=before.
 *                  Selalu konsisten (after = before + delta). Kalau Σdelta ≠ current_qty
 *                  → log warning (kemungkinan stok awal di-set tanpa movement); nilai tetap
 *                  ditulis (rantai internal konsisten, hanya qtyBefore baris paling awal ≠ 0).
 *
 * Idempotent untuk resolusi FK (parse note deterministik). Untuk qty snapshot:
 * re-run SETELAH ada perubahan stok akan menghasilkan nilai berbeda (tapi tetap
 * konsisten internal), karena walk mundur dari current_qty saat itu. Didesain
 * dijalankan SEKALI saat deploy, sebelum kode REV 2.8 menulis movement baru.
 * Menarget DATABASE_URL yang aktif. Untuk PROD: backup dulu, lalu jalankan dengan env prod.
 *
 *   npx tsx --env-file=.env scripts/backfill-movement-ledger.ts
 */

import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Parse tautan transaksi dari note porsi lama. Urutan match dari yang paling spesifik. */
function parsePortionSource(note: string | null): {
  transactionId: number | null;
  transactionItemId: number | null;
} {
  const n = note ?? '';
  let m: RegExpMatchArray | null;
  if ((m = n.match(/Edit Tx (\d+) item (\d+)/))) {
    return { transactionId: Number(m[1]), transactionItemId: Number(m[2]) };
  }
  if ((m = n.match(/Edit Tx (\d+)/))) {
    return { transactionId: Number(m[1]), transactionItemId: null };
  }
  if ((m = n.match(/transactionId=(\d+)/))) {
    // mencakup "transactionId=N via ..." (order) & "void transactionId=N reverse ..." (void)
    return { transactionId: Number(m[1]), transactionItemId: null };
  }
  return { transactionId: null, transactionItemId: null };
}

function parsePurchaseSource(note: string | null): number | null {
  const m = (note ?? '').match(/Purchase id=(\d+)/);
  return m ? Number(m[1]) : null;
}

async function backfillPortion(): Promise<void> {
  const [txRows, itemRows, stocks, movements] = await Promise.all([
    prisma.transaction.findMany({ select: { id: true } }),
    prisma.transactionItem.findMany({ select: { id: true } }),
    prisma.portionStock.findMany({ select: { menuId: true, currentQty: true } }),
    prisma.portionMovement.findMany({
      orderBy: [{ menuId: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    }),
  ]);

  const txIds = new Set(txRows.map((t) => t.id));
  const itemIds = new Set(itemRows.map((t) => t.id));
  const currentByMenu = new Map(stocks.map((s) => [s.menuId, s.currentQty]));

  // Kelompokkan movement per menu (sudah urut createdAt asc dari query).
  const byMenu = new Map<number, typeof movements>();
  for (const m of movements) {
    const arr = byMenu.get(m.menuId) ?? [];
    arr.push(m);
    byMenu.set(m.menuId, arr);
  }

  const updates: { id: number; data: Prisma.PortionMovementUpdateInput }[] = [];
  let fkSet = 0;
  let fkSkippedMissing = 0;
  let mismatchMenus = 0;

  for (const [menuId, arr] of byMenu) {
    // qty walk mundur dari stok sekarang
    const current = currentByMenu.get(menuId);
    const qty = new Map<number, { before: number; after: number }>();
    if (current != null) {
      let after = current;
      for (let i = arr.length - 1; i >= 0; i--) {
        const before = after - arr[i].delta;
        qty.set(arr[i].id, { before, after });
        after = before;
      }
      if (after !== 0) {
        mismatchMenus++;
        console.warn(
          `  ⚠ menu ${menuId}: Σdelta ≠ current (stok awal pra-movement = ${after}). Nilai tetap ditulis (konsisten).`,
        );
      }
    } else {
      console.warn(`  ⚠ menu ${menuId}: tidak ada PortionStock → qtyBefore/After dilewati.`);
    }

    for (const m of arr) {
      const data: Prisma.PortionMovementUpdateInput = {};
      // FK (hanya set kalau ketemu pola lama DAN baris sumber ada; jangan null-kan yang sudah ada)
      const { transactionId, transactionItemId } = parsePortionSource(m.note);
      if (transactionId != null) {
        if (txIds.has(transactionId)) {
          data.transaction = { connect: { id: transactionId } };
          fkSet++;
        } else {
          fkSkippedMissing++;
        }
      }
      if (transactionItemId != null && itemIds.has(transactionItemId)) {
        data.transactionItem = { connect: { id: transactionItemId } };
      }
      // qty
      const q = qty.get(m.id);
      if (q) {
        data.qtyBefore = q.before;
        data.qtyAfter = q.after;
      }
      if (Object.keys(data).length > 0) updates.push({ id: m.id, data });
    }
  }

  for (const u of updates) {
    await prisma.portionMovement.update({ where: { id: u.id }, data: u.data });
  }

  console.log(
    `portion_movements: ${movements.length} baris · FK transaksi diisi ${fkSet} · ` +
      `dilewati (transaksi hilang) ${fkSkippedMissing} · menu mismatch Σdelta ${mismatchMenus}`,
  );
}

async function backfillRaw(): Promise<void> {
  const [purchaseRows, itemRows, materials, movements] = await Promise.all([
    prisma.purchase.findMany({ select: { id: true } }),
    prisma.purchaseItem.findMany({ select: { id: true } }),
    prisma.rawMaterial.findMany({ select: { id: true, stockQty: true } }),
    prisma.rawMaterialMovement.findMany({
      orderBy: [{ rawMaterialId: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    }),
  ]);

  const purchaseIds = new Set(purchaseRows.map((p) => p.id));
  // purchaseItemId tak terparse dari note lama → biarkan null (catatan di spec).
  void itemRows;
  const currentByRm = new Map(materials.map((m) => [m.id, m.stockQty]));

  const byRm = new Map<number, typeof movements>();
  for (const m of movements) {
    const arr = byRm.get(m.rawMaterialId) ?? [];
    arr.push(m);
    byRm.set(m.rawMaterialId, arr);
  }

  const updates: { id: number; data: Prisma.RawMaterialMovementUpdateInput }[] = [];
  let fkSet = 0;
  let fkSkippedMissing = 0;
  let mismatch = 0;

  for (const [rmId, arr] of byRm) {
    const current = currentByRm.get(rmId);
    const qty = new Map<number, { before: Prisma.Decimal; after: Prisma.Decimal }>();
    if (current != null) {
      let after = new Prisma.Decimal(current);
      for (let i = arr.length - 1; i >= 0; i--) {
        const before = after.sub(arr[i].delta);
        qty.set(arr[i].id, { before, after });
        after = before;
      }
      if (!after.isZero()) {
        mismatch++;
        console.warn(
          `  ⚠ rawMaterial ${rmId}: Σdelta ≠ stock (stok awal pra-movement = ${after.toString()}). Nilai tetap ditulis.`,
        );
      }
    } else {
      console.warn(`  ⚠ rawMaterial ${rmId}: tidak ditemukan → qtyBefore/After dilewati.`);
    }

    for (const m of arr) {
      const data: Prisma.RawMaterialMovementUpdateInput = {};
      const pid = parsePurchaseSource(m.note);
      if (pid != null) {
        if (purchaseIds.has(pid)) {
          data.purchase = { connect: { id: pid } };
          fkSet++;
        } else {
          fkSkippedMissing++;
        }
      }
      const q = qty.get(m.id);
      if (q) {
        data.qtyBefore = q.before;
        data.qtyAfter = q.after;
      }
      if (Object.keys(data).length > 0) updates.push({ id: m.id, data });
    }
  }

  for (const u of updates) {
    await prisma.rawMaterialMovement.update({ where: { id: u.id }, data: u.data });
  }

  console.log(
    `raw_material_movements: ${movements.length} baris · FK purchase diisi ${fkSet} · ` +
      `dilewati (purchase hilang) ${fkSkippedMissing} · material mismatch Σdelta ${mismatch}`,
  );
}

async function main() {
  console.log('REV 2.8 backfill movement ledger — mulai…');
  await backfillPortion();
  await backfillRaw();
  console.log('Selesai.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
