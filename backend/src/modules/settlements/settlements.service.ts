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
  shiftId: number;
  shiftType: ShiftType;
  date: string;
  cashierId: number;
  cashierName: string;
  closedAt: string | null;
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

async function computeSystemTotals(shiftId: number): Promise<SystemTotalRow[]> {
  // Aggregate dari TransactionPayment.amount (multi-slice per Tx),
  // filter via relation Tx.shiftId + Tx.status=paid + Tx.mergedIntoId IS NULL
  // (exclude source yang di-merge supaya tidak double-count).
  const grouped = await prisma.transactionPayment.groupBy({
    by: ['method'],
    where: {
      transaction: {
        shiftId,
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

async function computeBankBreakdown(shiftId: number): Promise<BankBreakdownEntry[]> {
  // Bank breakdown via TransactionPayment.bank groupBy. Hanya rows dengan bank != null
  // (method requiresBank=true seperti edc/transfer + future methods).
  const rows = await prisma.transactionPayment.groupBy({
    by: ['method', 'bank'],
    where: {
      transaction: {
        shiftId,
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

export async function previewSettlement(shiftId: number): Promise<SettlementPreview> {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { cashier: { select: { name: true } } },
  });
  if (!shift) throw notFound('Shift');

  const [systemRows, bankBreakdown, existing] = await Promise.all([
    computeSystemTotals(shiftId),
    computeBankBreakdown(shiftId),
    prisma.settlement.findUnique({ where: { shiftId }, select: { id: true } }),
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

  return {
    shiftId: shift.id,
    shiftType: shift.type,
    date: shift.date.toISOString().substring(0, 10),
    cashierId: shift.cashierId,
    cashierName: shift.cashier.name,
    closedAt: shift.closedAt ? shift.closedAt.toISOString() : null,
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
  // Validasi shift
  const shift = await prisma.shift.findUnique({ where: { id: input.shiftId } });
  if (!shift) throw notFound('Shift');
  if (!shift.closedAt) {
    throw new AppError('Shift belum ditutup, settlement tidak bisa dibuat', 400);
  }

  // Permission inline (matrix REV 2.3):
  //   - Owner boleh settle shift siapapun.
  //   - Kasir hanya boleh settle shift MALAM miliknya sendiri.
  if (userRole === UserRole.cashier) {
    if (shift.cashierId !== userId) {
      throw forbidden('Kasir hanya bisa settle shift miliknya sendiri');
    }
    if (shift.type !== ShiftType.malam) {
      throw forbidden('Kasir hanya bisa settle shift malam (per matrix REV 2.3)');
    }
  }

  // Cek tidak ada settlement sebelumnya untuk shift ini (UNIQUE constraint juga
  // proteksi di DB level, tapi kita berikan pesan ramah di app layer).
  const existing = await prisma.settlement.findUnique({ where: { shiftId: input.shiftId } });
  if (existing) {
    throw new AppError(`Settlement untuk shift id=${input.shiftId} sudah ada (id=${existing.id})`, 409);
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

  // Compute system per method dari transactions
  const systemRows = await computeSystemTotals(input.shiftId);
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
      shiftId: input.shiftId,
      date: shift.date,
      cashierId: shift.cashierId,
      // 12 kolom legacy: set 0 placeholder (akan di-drop Phase 9 cleanup).
      // Source of truth real ada di settlement_method_counts child table.
      systemCash: new Prisma.Decimal(0),
      systemEdc: new Prisma.Decimal(0),
      systemQris: new Prisma.Decimal(0),
      systemGojek: new Prisma.Decimal(0),
      systemGrab: new Prisma.Decimal(0),
      systemTransfer: new Prisma.Decimal(0),
      actualCash: new Prisma.Decimal(0),
      actualEdc: new Prisma.Decimal(0),
      actualQris: new Prisma.Decimal(0),
      actualGojek: new Prisma.Decimal(0),
      actualGrab: new Prisma.Decimal(0),
      actualTransfer: new Prisma.Decimal(0),
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

  const bankBreakdown = await computeBankBreakdown(input.shiftId);
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
  const bankBreakdown = await computeBankBreakdown(s.shiftId);
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

  // Bank breakdown per-settlement (paralel)
  const withBreakdowns = await Promise.all(
    settlements.map(async (s) => {
      const bb = await computeBankBreakdown(s.shiftId);
      return toSettlementView(s, bb);
    }),
  );
  return withBreakdowns;
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
  const bankBreakdown = await computeBankBreakdown(updated.shiftId);
  return toSettlementView(updated, bankBreakdown);
}
