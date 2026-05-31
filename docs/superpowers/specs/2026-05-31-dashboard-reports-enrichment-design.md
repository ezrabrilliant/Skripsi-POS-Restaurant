# Design Spec — Perkaya Laporan Dashboard Owner & Kasir (REV 2.13)

**Tanggal:** 2026-05-31
**Status:** Approved (brainstorming → spec)
**Branch:** `feat/dashboard-reports-enrichment` (dari `main`)
**Pemicu:** Owner menilai laporan dashboard owner "masih kurang detail & lengkap";
minta kartu tambahan di dashboard owner (utama) & kasir (minimum).

---

## 1. Problem & konteks

Dashboard owner sekarang ([OwnerDashboard.tsx](../../../frontend/src/pages/OwnerDashboard.tsx))
hanya menampilkan: 3 KPI (Pendapatan/COGS/Laba), 1 bar chart "Pendapatan per Metode",
1 tabel "Breakdown per Bank", reminder stok, quick links — dengan period switcher
today/month/year.

Data model sudah kaya tapi belum dimanfaatkan untuk pelaporan:
- `TransactionItem.subtotal` + `unitCost` (REV 2.11) per `menuId` → menu performance & laba per menu.
- `Menu.category` → penjualan per kategori.
- `Shift.cashierId` → atribusi omzet per kasir.
- `Settlement` + `SettlementMethodCount{counted, system}` → riwayat selisih kas.
- `Transaction.createdAt` + `total` → tren waktu & jam ramai.

Backend `getOwnerReport` sudah punya `resolvePeriod()` yang mendukung `today/month/year/custom`
(custom + fromDate/toDate sudah ada di Zod schema), tetapi UI belum punya date-picker custom.

## 2. Goals / Non-goals

**Goals**
- Owner: analitik **Performa Menu**, **Tren Waktu**, **Performa Shift/Kasir** disusun **tab**.
- Owner: kontrol periode **custom date-range** + quick **Kemarin / Minggu ini** (today/month/year tetap).
- Kasir (minimum): 2 kartu ringan — **Menu terlaris hari ini** + **Statistik order hari ini**.
- Tanpa skema/migrasi DB baru. Semua dari kolom existing.

**Non-goals (out of scope)**
- Section "Pola Order" khusus owner (dine-in/takeaway/void) — tidak dipilih owner.
- Perbandingan vs periode lalu (% naik/turun) — eksplisit tidak dipilih.
- TZ jam-ramai presisi tinggi (cukup offset window resto).
- Backend period type `week`/`yesterday` (pakai `custom` dari FE).
- Remediasi data stuck-merge shift 57/meja 7 (alur terpisah, sudah ada).

## 3. Keputusan terkunci (brainstorming)

| # | Keputusan |
|---|---|
| D1 | Owner fokus: Tren Waktu + Performa Menu + Performa Shift/Kasir. "Pola Order" di-skip. |
| D2 | Tidak ada perbandingan vs periode lalu. |
| D3 | Visual "campur secukupnya": chart (Recharts) tren/peak, tabel (DataTable) ranking, angka (Stat) KPI. |
| D4 | Periode: + custom date-range + quick Kemarin/Minggu ini. |
| D5 | Layout owner = **tab** (Ringkasan/Menu/Tren/Kasir), tiap tab **lazy-load endpoint sendiri**. |
| D6 | Kasir: 2 kartu, tanpa tab. Tanpa data modal/laba (owner-only). |
| D7 | Atribusi omzet per kasir = **kasir pemilik shift** (`shift.cashierId`), bukan `createdById`. |

**Invariant filter** (konsisten pola existing `revenueByMethod`/`cogsTotalFor`): semua metrik
revenue/menu/staff difilter `status=paid` + `shift.date ∈ [from,to)` + **exclude `mergedIntoId`**
→ robust terhadap data stuck-merge.

## 4. API design (backend, owner-only)

Reuse `ownerReportQuerySchema` + `resolvePeriod()` + `txWhere`. 3 endpoint baru
(`requireRole(UserRole.owner)`):

### `GET /dashboard/owner/menu-performance`
```ts
{ topMenus: { menuId, name, category, qtySold, revenue, cogs, profit, marginPct }[],  // sort desc revenue, limit ~15
  byCategory: { category, qtySold, revenue, cogs, profit }[] }
```
Sumber: `transactionItem.findMany({ where: { transaction: {...txWhere, mergedIntoId:null} },
select: { menuId, qty, subtotal, unitCost, menu:{ select:{ name, category } } } })`, di-group via
helper murni `groupMenuPerformance()`. revenue=Σ subtotal; cogs=Σ unitCost×qty (null→0).

### `GET /dashboard/owner/trend`
```ts
{ granularity: 'hour' | 'day' | 'month',
  revenueTrend: { bucket: string, revenue, txCount }[],
  peakHours: { hour: 0..23, revenue, txCount }[] }   // FE sembunyikan saat granularity==='hour'
```
Sumber: paid tx `findMany({ select:{ total, createdAt, shift:{ select:{ date } } } })`.
revenueTrend bucket by `shift.date` (day/month) atau jam `createdAt` (hour, offset window resto).
peakHours = distribusi hour-of-day `createdAt`.

### `GET /dashboard/owner/staff`
```ts
{ cashierPerformance: { cashierId, cashierName, shiftCount, txCount, revenue, atv }[],
  settlementHistory: { date, cashierName, totalCounted, totalSystem, variance, status }[] }
```
cashierPerformance: group paid tx by `shift.cashierId`. settlementHistory:
`settlement.findMany({ where:{ date:{ gte, lt } }, include:{ cashier, methodCounts }, orderBy:{ date:'desc' } })`,
variance via helper `settlementVariance()` = Σ(counted − system).

### Cashier — extend `getCashierDashboard().today`
Tambah (reuse range `[today,tomorrow)`): `topMenus:{menuId,name,qty,revenue}[]` (limit 5, **tanpa unitCost**),
`itemCount` (Σ qty), `atv` (revenue/txCount, guard 0), `orderTypeSplit:{dineIn:{count,revenue},takeaway:{count,revenue}}`.

### Pure helpers (TDD — `dashboard.helpers.ts`)
`bucketGranularityFor`, `bucketRevenueRows`, `hourOfDayDistribution`, `settlementVariance`,
`groupMenuPerformance` — di-unit-test tanpa DB (`dashboard.helpers.test.ts`).

## 5. Frontend architecture

> Frontend Consistency Mandate: reuse `Tabs`/`Stat`/`DataTable`/`Badge`/`EmptyState`/`Skeleton`/
> `Input`; chart pakai Recharts (sudah dipakai). Mobile-first. Tanpa primitive baru.

- **OwnerDashboard** → shell: header + `PeriodControl` (emit `OwnerReportQuery`) + section `Tabs`
  (Ringkasan/Menu/Tren/Kasir) + render tab aktif (lazy React Query, key `['owner',section,query]`).
- **PeriodControl** (baru): Hari ini / Kemarin / Minggu ini / Bulan / Tahun / Custom (2 `Input type=date`).
  Quick range → `period='custom'` dengan tanggal kalender (aproksimasi; label periode dari backend).
- **Tabs**: `RingkasanTab` (konten existing + KPI **Margin% baru** = profit/revenue), `MenuPerformanceTab`,
  `TrendTab` (LineChart tren + BarChart jam ramai), `StaffTab` (2 DataTable).
- **CashierDashboard**: 2 kartu baru saat `myActiveShift` — `TodayTopMenusCard` + `TodayOrderStatsCard`.

## 6. Permission

3 endpoint owner-only (`requireRole(UserRole.owner)`) — laba/modal tidak bocor ke kasir/waiter.
Cashier endpoint tetap owner+kasir; field cashier baru tidak mengandung cost/laba.

## 7. Verification

Backend: vitest (helpers) + tsc + `scripts/smoke-dashboard.ts` (DB `pos_restaurant_test`).
Frontend: `tsc -b` + `build` + `lint`. E2e Playwright (owner tabs+periode, kasir cards), screenshot.

## 8. Pipeline

Full superpowers: spec (ini) → plan → TDD helpers → executing per fase + checkpoint →
verification-before-completion → code review → finishing-a-development-branch. Tanpa migrasi DB
(PROD aman, cuma redeploy BE+FE saat rilis).
