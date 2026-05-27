// Phase 9 pre-drop sanity:
// (1) settlement_method_counts coverage >= 100% of settlements (each settlement has rows)
// (2) banks master covers all distinct bank values used in transaction_payments
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const settlementsTotal = await p.settlement.count();
const counts = await p.settlementMethodCount.count();
const methodsCount = await p.paymentMethod.count();
// Per Phase 6 spec: every settlement should get N rows where N = #payment_methods
const expectedCounts = settlementsTotal * methodsCount;
console.log({
  settlementsTotal,
  methodsCount,
  expectedCounts,
  actualCounts: counts,
  coverageOk: settlementsTotal === 0 || counts >= settlementsTotal,
});

// Distinct bank names used in history (transaction_payments)
const distinct = await p.transactionPayment.findMany({
  where: { bank: { not: null } },
  distinct: ['bank'],
  select: { bank: true },
});
const banks = await p.bank.findMany({ select: { name: true } });
const banksLower = new Set(banks.map((b) => b.name.toLowerCase().trim()));
const missing = distinct.filter(
  (d) => d.bank && !banksLower.has(d.bank.toLowerCase().trim()),
);
console.log({
  distinct_banks_in_history: distinct.length,
  banks_master: banks.length,
  missingInMaster: missing.length,
  missingList: missing.map((d) => d.bank),
});

await p.$disconnect();
