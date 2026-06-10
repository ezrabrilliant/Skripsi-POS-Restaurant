// Service modul settlements. REV 2.6:
//   - Settlement = rekap akhir hari per shift (1:1 dengan Shift via UNIQUE shiftId).
//   - Counts dinamis per payment_methods.code via child table
//     settlement_method_counts (paymentMethodCode, counted, system).
//   - 12 kolom legacy actualXxx/systemXxx tetap di Settlement row (set 0 placeholder),
//     akan di-drop full di Phase 9 cleanup.
//   - Per matrix REV 2.3:
//       * Submit settlement -> owner + kasir (kasir hanya shift MALAM sendiri,
//         dicek inline di service karena route layer tidak tahu shift type)
//       * Review settlement -> owner only
//   - Variance dihitung runtime di view (counted - system).
//   - System totals + bank breakdown dihitung dari TransactionPayment
//     (multi-slice per Tx). Filter mergedIntoId IS NULL via relation untuk
//     hindari double-count.

import {
  Prisma,
  SettlementStatus,
  ShiftType,
  TransactionStatus,
  UserRole,
} from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError, forbidden, notFound } from '../../utils/errors';
import type {
  CreateSettlementInput,
  ListSettlementsQuery,
} from './settlements.schema';

// ============================================================
// View shape (REV 2.6: dinamis array)
// ============================================================

export interface SettlementMethodCountView {
  paymentMethodCode: string;
  methodLabel: string;
  colorHex: string;
  counted: number;
  system: number;
  variance: number; // counted - system
}

export interface SettlementSystemEntry {
  paymentMethodCode: string;
  methodLabel: string;
  colorHex: string;
  total: number;
}

export interface BankBreakdownEntry {
  method: string; // method code (mis. 'edc', 'transfer', atau code lain yang requiresBank)
  bank: string;
  total: number;
}

export interface SettlementView {
  id: number;
  shiftId: number;
  date: string; // YYYY-MM-DD
  cashierId: number;
  cashierName: string;
  reviewerId: number | null;
  reviewerName: string | null;
  methodCounts: SettlementMethodCountView[];
  totalCounted: number;
  totalSystem: number;
  totalVariance: number;
  note: string | null;
  status: SettlementStatus;
  submittedAt: string;
  reviewedAt: string | null;
  bankBreakdown: BankBreakdownEntry[];
}

export interface SettlementPreview {
  shiftId: number; // ID shift penutup (closer) hari itu, audit ref
  shiftType: ShiftType; // tipe shift penutup
  date: string;
  cashierId: number; // cashier penutup
  cashierName: string; // nama cashier penutup
  closedAt: string | null; // closedAt shift penutup
  openingCashTotal: number; // float baseline = sum(openingCash) semua shift hari itu
  system: SettlementSystemEntry[];
  totalSystem: number;
  bankBreakdown: BankBreakdownEntry[];
  existingSettlementId: number | null;
}

type SettlementWithRelations = Prisma.SettlementGetPayload<{
  include: {
    cashier: { select: { name: true } };
    reviewer: { select: { name: true } };
    methodCounts: true;
  };
}>;

// ============================================================
// System totals + bank breakdown (computed from transactions)
// ============================================================

interface SystemTotalRow {
  methodCode: string;
  total: number;
}

async function computeSystemTotals(businessDate: Date): Promise<SystemTotalRow[]> {
  // Aggregate dari TransactionPayment.amount (multi-slice per Tx),
  // filter via relation Tx.shift.date (whole business day) + Tx.status=paid +
  // Tx.mergedIntoId IS NULL (exclude source yang di-merge supaya tidak double-count).
  const grouped = await prisma.transactionPayment.groupBy({
    by: ['method'],
    where: {
      transaction: {
        shift: { date: businessDate },
        status: TransactionStatus.paid,
        mergedIntoId: null,
      },
    },
    _sum: { amount: true },
  });

  return grouped.map((g) => ({
    methodCode: g.method,
    total: g._sum.amount?.toNumber() ?? 0,
  }));
}

async function computeBankBreakdown(businessDate: Date): Promise<BankBreakdownEntry[]> {
  // Bank breakdown via TransactionPayment.bank groupBy. Hanya rows dengan bank != null
  // (method requiresBank=true seperti edc/transfer + future methods).
  // Filter via relation Tx.shift.date (whole business day).
  const rows = await prisma.transactionPayment.groupBy({
    by: ['method', 'bank'],
    where: {
      transaction: {
        shift: { date: businessDate },
        status: TransactionStatus.paid,
        mergedIntoId: null,
      },
      bank: { not: null },
    },
    _sum: { amount: true },
  });

  return rows
    .filter((r) => r.bank)
    .map((r) => ({
      method: r.method,
      bank: r.bank!,
      total: r._sum.amount?.toNumber() ?? 0,
    }))
    .sort((a, b) => a.method.localeCompare(b.method) || a.bank.localeCompare(b.bank));
}

// ============================================================
// Helpers: enrich method codes -> label + colorHex via master lookup
// ============================================================

interface MethodMeta {
  label: string;
  colorHex: string;
}

async function lookupMethodsMeta(codes: string[]): Promise<Map<string, MethodMeta>> {
  if (codes.length === 0) return new Map();
  const methods = await prisma.paymentMethod.findMany({
    where: { code: { in: codes } },
    select: { code: true, label: true, colorHex: true },
  });
  return new Map(methods.map((m) => [m.code, { label: m.label, colorHex: m.colorHex }]));
}

function fallbackMeta(code: string): MethodMeta {
  return { label: code, colorHex: '#888888' };
}

// ============================================================
// View builders
// ============================================================

async function toSettlementView(
  s: SettlementWithRelations,
  bankBreakdown: BankBreakdownEntry[],
): Promise<SettlementView> {
  const codes = s.methodCounts.map((mc) => mc.paymentMethodCode);
  const metaMap = await lookupMethodsMeta(codes);

  const methodCounts: SettlementMethodCountView[] = s.methodCounts
    .map((mc) => {
      const meta = metaMap.get(mc.paymentMethodCode) ?? fallbackMeta(mc.paymentMethodCode);
      return {
        paymentMethodCode: mc.paymentMethodCode,
        methodLabel: meta.label,
        colorHex: meta.colorHex,
        counted: mc.counted,
        system: mc.system,
        variance: mc.counted - mc.system,
      };
    })
    .sort((a, b) => a.paymentMethodCode.localeCompare(b.paymentMethodCode));

  const totalCounted = methodCounts.reduce((s, mc) => s + mc.counted, 0);
  const totalSystem = methodCounts.reduce((s, mc) => s + mc.system, 0);
  const totalVariance = totalCounted - totalSystem;

  return {
    id: s.id,
    shiftId: s.shiftId,
    date: s.date.toISOString().substring(0, 10),
    cashierId: s.cashierId,
    cashierName: s.cashier.name,
    reviewerId: s.reviewerId,
    reviewerName: s.reviewer?.name ?? null,
    methodCounts,
    totalCounted,
    totalSystem,
    totalVariance,
    // REV 2.6: note belum disimpan di tabel settlements (no column). Reserved untuk
    // future migration; sementara expose null. Schema input sudah accept note,
    // di-discard saat persist sampai migrasi tambah kolom.
    note: null,
    status: s.status,
    submittedAt: s.submittedAt.toISOString(),
    reviewedAt: s.reviewedAt ? s.reviewedAt.toISOString() : null,
    bankBreakdown,
  };
}

// ============================================================
// Operations
// ============================================================

export async function previewSettlement(businessDate: Date): Promise<SettlementPreview> {
  // REV (shift-redesign Phase 3): settlement = rekap WHOLE business day.
  // Resolve semua shift hari itu; "closer" = shift dengan closedAt terbaru
  // (fallback createdAt terbaru) untuk display metadata.
  const shiftsThatDay = await prisma.shift.findMany({
    where: { date: businessDate },
    include: { cashier: { select: { name: true } } },
    orderBy: [{ closedAt: 'desc' }, { createdAt: 'desc' }],
  });
  if (shiftsThatDay.length === 0) throw notFound('Shift untuk tanggal ini');

  const closer = shiftsThatDay[0]!;

  const [systemRows, bankBreakdown, existing] = await Promise.all([
    computeSystemTotals(businessDate),
    computeBankBreakdown(businessDate),
    prisma.settlement.findFirst({ where: { date: businessDate }, select: { id: true } }),
  ]);

  const metaMap = await lookupMethodsMeta(systemRows.map((r) => r.methodCode));

  const system: SettlementSystemEntry[] = systemRows
    .map((r) => {
      const meta = metaMap.get(r.methodCode) ?? fallbackMeta(r.methodCode);
      return {
        paymentMethodCode: r.methodCode,
        methodLabel: meta.label,
        colorHex: meta.colorHex,
        total: r.total,
      };
    })
    .sort((a, b) => a.paymentMethodCode.localeCompare(b.paymentMethodCode));

  const totalSystem = system.reduce((s, e) => s + e.total, 0);

  // Float baseline = sum openingCash semua shift hari itu (3.3).
  const openingCashTotal = shiftsThatDay.reduce(
    (sum, s) => sum + s.openingCash.toNumber(),
    0,
  );

  return {
    shiftId: closer.id,
    shiftType: closer.type,
    date: businessDate.toISOString().substring(0, 10),
    cashierId: closer.cashierId,
    cashierName: closer.cashier.name,
    closedAt: closer.closedAt ? closer.closedAt.toISOString() : null,
    openingCashTotal,
    system,
    totalSystem,
    bankBreakdown,
    existingSettlementId: existing?.id ?? null,
  };
}

export async function createSettlement(
  userId: number,
  userRole: UserRole,
  input: CreateSettlementInput,
): Promise<SettlementView> {
  // REV (shift-redesign Phase 3): settlement keyed by business date (whole day),
  // bukan satu shift. Parse business date UTC-midnight match shift.date storage.
  const businessDate = new Date(input.date + 'T00:00:00.000Z');

  // Resolve semua shift hari itu, ordered closer-first (closedAt desc, createdAt desc).
  const shiftsThatDay = await prisma.shift.findMany({
    where: { date: businessDate },
    orderBy: [{ closedAt: 'desc' }, { createdAt: 'desc' }],
  });
  if (shiftsThatDay.length === 0) throw notFound('Shift untuk tanggal ini');

  // Closer = shift dengan closedAt terbaru; fallback ke shift pertama (createdAt terbaru)
  // bila belum ada yang ditutup.
  const closer = shiftsThatDay.find((s) => s.closedAt) ?? shiftsThatDay[0]!;

  // Permission inline (shift-redesign Phase 3 - old shift.type === malam check GONE):
  //   - Owner boleh settle hari apapun.
  //   - Kasir hanya boleh settle kalau dia kasir penutup shift terakhir hari itu.
  if (userRole === UserRole.cashier) {
    if (!closer || closer.cashierId !== userId) {
      throw forbidden(
        'Hanya kasir penutup shift terakhir hari itu (atau owner) yang boleh settle',
      );
    }
  }

  // Closer harus sudah ditutup; kalau semua shift hari itu masih open, tolak.
  if (!closer.closedAt) {
    throw new AppError('Shift hari ini belum ditutup, settlement tidak bisa dibuat', 400);
  }

  // Dedupe per business date (UNIQUE @@unique([date]) juga proteksi di DB level,
  // tapi kita berikan pesan ramah di app layer).
  const existing = await prisma.settlement.findFirst({ where: { date: businessDate } });
  if (existing) {
    throw new AppError(
      `Settlement untuk tanggal ${input.date} sudah ada (id=${existing.id})`,
      409,
    );
  }

  // Validate counts: semua method codes harus exist di master payment_methods
  // (audit-safe: kasir tidak boleh kirim code random).
  const countCodes = Object.keys(input.counts);
  if (countCodes.length > 0) {
    const masterMethods = await prisma.paymentMethod.findMany({
      where: { code: { in: countCodes } },
      select: { code: true },
    });
    const masterCodeSet = new Set(masterMethods.map((m) => m.code));
    const unknown = countCodes.filter((c) => !masterCodeSet.has(c));
    if (unknown.length > 0) {
      throw new AppError(
        `Payment method code tidak dikenal: ${unknown.join(', ')}`,
        422,
      );
    }
  }

  // Compute system per method dari transactions (whole business day)
  const systemRows = await computeSystemTotals(businessDate);
  const systemMap = new Map(systemRows.map((r) => [r.methodCode, r.total]));

  // Build child rows: union dari counts keys + system keys.
  // Setiap method yang punya counted OR system masuk ke child table.
  const allCodes = new Set<string>([...countCodes, ...systemMap.keys()]);
  const childRows = Array.from(allCodes).map((code) => ({
    paymentMethodCode: code,
    counted: input.counts[code] ?? 0,
    system: Math.round(systemMap.get(code) ?? 0), // Int column; system totals dari Decimal -> round int
  }));

  // Validate: code di system rows yang tidak ada di master harus ditolak.
  // (mis. transaksi lama dengan method code yang udah dihapus dari master).
  // Currently kita assume migration script Phase 2 sudah cleanup; defensive check:
  const systemCodes = systemRows.map((r) => r.methodCode);
  if (systemCodes.length > 0) {
    const masterMethods = await prisma.paymentMethod.findMany({
      where: { code: { in: systemCodes } },
      select: { code: true },
    });
    const masterCodeSet = new Set(masterMethods.map((m) => m.code));
    const unknownSystem = systemCodes.filter((c) => !masterCodeSet.has(c));
    if (unknownSystem.length > 0) {
      throw new AppError(
        `Transaksi shift mengandung method code yang tidak ada di master payment_methods: ${unknownSystem.join(', ')}. ` +
          `Hubungi owner untuk reactivate atau koreksi data.`,
        500,
      );
    }
  }

  const created = await prisma.settlement.create({
    data: {
      shiftId: closer.id, // audit ref ke shift penutup
      date: businessDate,
      cashierId: closer.cashierId, // owner-of-record = kasir penutup hari itu
      status: SettlementStatus.submitted,
      methodCounts: {
        create: childRows,
      },
    },
    include: {
      cashier: { select: { name: true } },
      reviewer: { select: { name: true } },
      methodCounts: true,
    },
  });

  const bankBreakdown = await computeBankBreakdown(businessDate);
  return toSettlementView(created, bankBreakdown);
}

export async function getSettlementById(id: number): Promise<SettlementView> {
  const s = await prisma.settlement.findUnique({
    where: { id },
    include: {
      cashier: { select: { name: true } },
      reviewer: { select: { name: true } },
      methodCounts: true,
    },
  });
  if (!s) throw notFound('Settlement');
  const bankBreakdown = await computeBankBreakdown(s.date);
  return toSettlementView(s, bankBreakdown);
}

export async function listSettlements(query: ListSettlementsQuery): Promise<SettlementView[]> {
  const where: Prisma.SettlementWhereInput = {};
  if (query.date) where.date = new Date(query.date);
  else if (query.month) {
    const [y, m] = query.month.split('-').map(Number);
    where.date = {
      gte: new Date(Date.UTC(y!, m! - 1, 1)),
      lt: new Date(Date.UTC(y!, m!, 1)),
    };
  }
  if (query.cashierId) where.cashierId = query.cashierId;
  if (query.status) where.status = query.status;

  const settlements = await prisma.settlement.findMany({
    where,
    include: {
      cashier: { select: { name: true } },
      reviewer: { select: { name: true } },
      methodCounts: true,
    },
    orderBy: [{ date: 'desc' }, { submittedAt: 'desc' }],
  });

  // Bank breakdown per-settlement (paralel), keyed by business date
  const withBreakdowns = await Promise.all(
    settlements.map(async (s) => {
      const bb = await computeBankBreakdown(s.date);
      return toSettlementView(s, bb);
    }),
  );
  return withBreakdowns;
}

export async function deleteSettlement(id: number): Promise<{ id: number }> {
  // Escape hatch owner-only (permission di route layer). Menghapus settlement
  // membuka-segel hari itu: openShift boleh lagi + void boleh lagi. Child rows
  // settlement_method_counts ikut terhapus via onDelete: Cascade.
  const existing = await prisma.settlement.findUnique({ where: { id } });
  if (!existing) throw notFound('Settlement');
  await prisma.settlement.delete({ where: { id } });
  return { id };
}

export async function reviewSettlement(id: number, reviewerId: number): Promise<SettlementView> {
  const existing = await prisma.settlement.findUnique({ where: { id } });
  if (!existing) throw notFound('Settlement');
  if (existing.status === SettlementStatus.reviewed) {
    throw new AppError('Settlement sudah pernah di-review', 400);
  }

  const updated = await prisma.settlement.update({
    where: { id },
    data: {
      reviewerId,
      reviewedAt: new Date(),
      status: SettlementStatus.reviewed,
    },
    include: {
      cashier: { select: { name: true } },
      reviewer: { select: { name: true } },
      methodCounts: true,
    },
  });
  const bankBreakdown = await computeBankBreakdown(updated.date);
  return toSettlementView(updated, bankBreakdown);
}
