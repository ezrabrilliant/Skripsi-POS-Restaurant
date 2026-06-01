# Plan - Dashboard Reports Enrichment (REV 2.13)

Spec: [2026-05-31-dashboard-reports-enrichment-design.md](../specs/2026-05-31-dashboard-reports-enrichment-design.md)
Branch: `feat/dashboard-reports-enrichment` · Eksekusi inline, **checkpoint per fase** (preferensi Ezra).

## Fase

### P0 - Spec + plan docs ✅ (commit awal)

### P1 - Backend pure helpers (TDD)
- `backend/src/modules/dashboard/dashboard.helpers.test.ts` (RED) → `dashboard.helpers.ts` (GREEN).
- Fungsi: `bucketGranularityFor`, `bucketRevenueRows`, `hourOfDayDistribution`, `settlementVariance`,
  `groupMenuPerformance`. Edge: span 1 hari → hour; unitCost null → 0; txCount 0 → atv 0.
- ✅ Checkpoint: `npx vitest run dashboard.helpers` hijau.

### P2 - Backend endpoints owner (menu-performance, trend, staff)
- `dashboard.service.ts`: view interfaces + 3 fungsi service pakai helper P1 + `txWhere`.
- `dashboard.controller.ts`: 3 handler. `dashboard.routes.ts`: 3 route owner-only.
- ✅ Checkpoint: `npx tsc --noEmit` 0 error.

### P3 - Backend extend cashier
- `getCashierDashboard().today` + `CashierDashboardView`: topMenus(5,no cost)/itemCount/atv/orderTypeSplit.
- ✅ Checkpoint: tsc 0.

### P4 - Backend smoke
- `backend/scripts/smoke-dashboard.ts` (guard `*_test`): seed tx multi-menu/metode lintas hari +
  settlement; assert topMenus terurut, byCategory, trend granularity, peakHours, cashier ATV,
  variance, mergedIntoId excluded, custom+Kemarin range.
- ✅ Checkpoint: smoke PASS.

### P5 - Frontend service
- `dashboardService.ts`: types + `getOwnerMenuPerformance/Trend/Staff(query)` + extend `CashierDashboard.today`.
- ✅ Checkpoint: tsc.

### P6 - Frontend owner shell + PeriodControl + RingkasanTab
- `components/PeriodControl.tsx`; `OwnerDashboard.tsx` → shell+tab; `RingkasanTab` (ekstrak existing + Margin% KPI).
- ✅ Checkpoint: build + visual review.

### P7 - Frontend owner tabs (Menu/Tren/Kasir)
- `MenuPerformanceTab`, `TrendTab`, `StaffTab`.
- ✅ Checkpoint: build.

### P8 - Frontend cashier cards
- `TodayTopMenusCard` + `TodayOrderStatsCard` di `CashierDashboard`.
- ✅ Checkpoint: build.

### P9 - Verifikasi penuh
- FE `tsc -b` + `build` + `lint`. E2e Playwright owner (tabs+periode) + kasir (cards, no laba). Screenshot.

### P10 - Review + finishing
- `requesting-code-review` → fix → `finishing-a-development-branch` (merge/PR). No DB migration.
