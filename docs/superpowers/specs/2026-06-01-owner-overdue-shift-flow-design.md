# Design — Owner stranded on overdue (unclosed) shift

**Date:** 2026-06-01
**Status:** Approved (brainstorming → spec)
**Branch:** `fix/owner-overdue-shift-flow`
**Theme:** completes the unfinished half of REV 2.12 owner self-service (the `OverdueShiftGate` is tagged REV 2.12).

## Problem

When a cashier shift is left open into a new business day and the **owner** logs in, three screens give contradictory messages about the *same* shift, and the owner has **no UI path** to resolve it:

| Screen | Source of "the shift" | Message | Verdict |
|---|---|---|---|
| Kasir / POS | `getActiveShifts()` system-wide **+ `isOverdue`** | "Shift kemarin belum ditutup" → `/settlement` | ✅ correct |
| Settlement | `listShifts({ cashierId: user.id })[0]` | "Belum ada shift" → `/dashboard` | ❌ wrong |
| Owner Dashboard `ShiftPanel` | `getActiveShifts()` but label hardcoded | "Shift aktif **hari ini**", no action | ❌ wrong |

The owner is trapped in a loop: POS → Settlement → Dashboard → POS, never able to close the shift.

## Root cause

**No single source of truth for "the shift that needs attention."** Each surface re-derives it independently and drifts:
- Settlement keys off `user.id`. The owner never *opens* shifts, so `listShifts({ cashierId: ownerId })` is empty → "Belum ada shift". Jason's open shift is invisible to that query.
- Owner Dashboard reads the right data (`getActiveShifts()`) but hardcodes the label "Shift aktif hari ini" (no date / `isOverdue` awareness) and renders no action — the code even admits *"Owner force-close belum tersedia di UI"*.

## Key fact: backend already supports the intended behavior

This is a **frontend-only** fix. The backend already permits the owner to act:
- `closeShift` — owner bypasses the ownership guard (`byRole !== owner` check), so owner can close any shift; route allows `owner` + `cashier`. (`backend/src/modules/shifts/shifts.service.ts`)
- `createSettlement` — owner bypasses the "must be closing cashier" check, so owner can settle any business day. (`backend/src/modules/settlements/settlements.service.ts`)
- The 409 open-orders flow (`CloseShiftBlockedModal`) already works for owner.

## Design

### Principle — one "shift in focus", consumed everywhere
Treat the system-wide active shift (shared React Query key `['shifts','active']` → `shiftService.getActiveShifts()`) as the canonical "shift in focus." It already carries `isOverdue` + `date` + `cashierName`. Use `isOverdue` as the source of truth for the overdue state (do **not** recompute "today vs yesterday" on the frontend — avoids timezone bugs). Display `date` + `cashierName` for human context.

A small pure helper keeps Settlement's resolution from drifting:

```ts
// shiftFocus.ts — which shift does the Settlement page act on?
// Priority: an OPEN shift system-wide (close it first) > most-recent shift (closed-day settle).
// Works for owner (owns no shift) and cashier alike.
export function pickShiftToSettle(active: Shift[], recent: Shift[]): Shift | null {
  if (active.length > 0) return active[0]
  return recent.length > 0 ? recent[0] : null
}
```

### Change 1 — SettlementPage targets the system shift, not `user.id`
- Primary query: `['shifts','active']` → `getActiveShifts()` (same data POS & Dashboard use).
- Fallback recent query (for settling an already-closed day): cashier → `listShifts({ cashierId })`, owner → `listShifts({})`.
- `targetShift = pickShiftToSettle(activeShifts, recentShifts)`.
- The existing 4-mode render is preserved; owner now reaches mode 2/3 instead of dead-ending:
  - open & **overdue** → "Shift {date} · kasir {name} belum ditutup", action "Tutup Shift".
  - open & not overdue → "Shift {type} masih aktif".
  - closed → `SettlementFlow` (owner allowed to submit; "Auto-isi dari sistem" available if not physically counting).
  - none → reworded "Tidak ada shift yang perlu ditutup atau disetor".
- Close confirm dialog includes the cashier name.

### Change 2 — Owner Dashboard `ShiftPanel`: date-accurate label + action
- Extend `shifts` prop with `date` + `isOverdue` (already on the `getActiveShifts()` payload).
- Conditional header: any `isOverdue` → warning style "⚠️ Shift {date} (kasir {name}) belum ditutup"; else keep "Shift aktif hari ini".
- When overdue, render "Tutup & Setor Shift" → `navigate('/settlement')` (same destination as the POS gate).
- Remove the apologetic "Owner force-close belum tersedia di UI" note.

### Change 3 — Wording alignment
One vocabulary across POS gate, Dashboard, and Settlement for the overdue state: **date + cashier name**, never "hari ini" for a non-today shift. The POS gate already does this; align the other two.

### Change 4 — Human-readable shift date
New `formatShiftDate()` in `frontend/src/lib/utils.ts` renders the shift date as **"hari, tanggal - bulan - tahun"** (e.g. `Sabtu, 30 - 05 - 2026`) via `Intl.DateTimeFormat('id-ID', …)`. Date-only strings (`YYYY-MM-DD`) are parsed from components into a local `Date` so the weekday never shifts due to timezone. Applied at all three overdue surfaces (Settlement title, Dashboard panel header, POS gate body).

## Out of scope
- Broad multi-flow inspection (deferred to a later session, per decision).
- Owner picking an arbitrary past closed day via a date picker.
- The 2+ active-shift "overlap" branch — `@@unique([activeMarker])` makes it effectively unreachable.

## Follow-up (separate design — NOT in this branch)
**Catch-22: overdue shift with unpaid orders can't be cleared.** Discovered during this work. When the overdue shift has open (unpaid) transactions:
- Closing it (final) is correctly blocked with 409 + the open-orders list (`CloseShiftBlockedModal`).
- But **paying** those orders is impossible: `<PaymentModal>` is rendered only in `POSPage`, and the `OverdueShiftGate` blocks the entire POS. The modal's "Buka" deep-link to `/pos/{table}` just re-hits the gate.
- The only escape is **void** (HistoryPage) — which cancels the sale; you cannot collect payment for yesterday's legitimately-open bills. → infinite loop POS↔Settlement.

**Direction (when picked up):** the overdue gate should be **settle-only**, not a total block — allow opening an existing table to *pay/void* its orders (PaymentModal + ActiveOrdersView), while blocking *new* order intake. Touches core POS gating (`POSPage` gate + `CartPanel` modes + new-order entry) → needs its own brainstorm → spec → plan.

## Files
- `frontend/src/services/shiftFocus.ts` — NEW dependency-free module: pure `pickShiftToSettle()` (+ Vitest `shiftFocus.test.ts`).
- `frontend/src/pages/SettlementPage.tsx` — target resolution + reworded date-aware states.
- `frontend/src/pages/owner-dashboard/RingkasanTab.tsx` — `ShiftPanel` label + button + prop type.
- `frontend/src/components/OverdueShiftGate.tsx` — minor wording alignment.
- No backend changes.

## Verification
1. `cd frontend && npm run build` (tsc -b + vite build) → 0 errors; `npm run lint` → 0 errors.
2. Vitest for `pickShiftToSettle()` (all branches: open present, only recent, empty).
3. Playwright e2e as **owner** with the overdue shift (local DB has Jason · Pagi · 2026-05-28 open):
   POS gate → Settlement now shows the shift (not "Belum ada shift") → Tutup Shift → settle (auto-isi); Dashboard panel shows overdue label + working "Tutup & Setor" button.
4. Regression as **cashier** (Jason): own-shift close + settle unchanged.
