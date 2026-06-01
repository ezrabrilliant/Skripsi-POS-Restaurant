# ShiftWindowTab UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "Jam Shift" settings tab consistent with its sibling tabs and visually clean - centered card, vertically stacked time inputs (no misalignment), timezone dropdown, plain-language labels.

**Architecture:** Frontend-only, presentational. Rewrite `ShiftWindowTab.tsx` (same state, same `settingsService.update`, same validation - only markup/labels/controls change) and apply one centering change to the sibling `TaxSettingsTab.tsx` so both form-tabs match. No backend/schema/behavior change.

**Tech Stack:** React 18 + TypeScript + Tailwind, React Query, `@/design-system/primitives` (`Input`, `Select`, `Button`, `Skeleton`).

**Spec:** [docs/superpowers/specs/2026-05-31-shift-window-tab-polish-design.md](../specs/2026-05-31-shift-window-tab-polish-design.md)

**Verification note:** These presentational tab components have no unit tests in the repo (project convention verifies via `tsc` + `vite build` + `eslint` + manual browser e2e). So "test" steps here are those verification commands, not Vitest specs.

---

### Task 1: Center the Pajak tab (sibling consistency, do first)

Centering `TaxSettingsTab` first means that when we center `ShiftWindowTab` in Task 2, switching between the two tabs already lines up - easy visual diff.

**Files:**
- Modify: `frontend/src/components/payment-methods/TaxSettingsTab.tsx`

- [ ] **Step 1: Center the main return wrapper**

In `frontend/src/components/payment-methods/TaxSettingsTab.tsx`, find the main wrapper (currently line ~74):

```tsx
    <div className="p-3 sm:p-4 space-y-3 max-w-xl">
```

Replace with:

```tsx
    <div className="p-3 sm:p-4 space-y-3 max-w-2xl mx-auto">
```

- [ ] **Step 2: Center the loading skeleton wrapper too (avoid a left-jump while loading)**

In the same file, find the loading branch (currently line ~66-70):

```tsx
  if (settingsQuery.isLoading) {
    return (
      <div className="p-3 sm:p-4">
        <Skeleton className="h-48" />
      </div>
    )
  }
```

Replace the wrapper div line `<div className="p-3 sm:p-4">` with:

```tsx
      <div className="p-3 sm:p-4 max-w-2xl mx-auto">
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/payment-methods/TaxSettingsTab.tsx
git commit -m "style(settings): center Pajak tab card (max-w-2xl mx-auto) for tab consistency"
```

---

### Task 2: Rewrite ShiftWindowTab (center + stack inputs + timezone dropdown + labels)

**Files:**
- Modify (full rewrite of the component body): `frontend/src/components/payment-methods/ShiftWindowTab.tsx`

- [ ] **Step 1: Replace the entire file contents**

Overwrite `frontend/src/components/payment-methods/ShiftWindowTab.tsx` with exactly:

```tsx
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock, Info } from 'lucide-react'
import { settingsService } from '@/services/settingsService'
import { Button, Input, Select, Skeleton } from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'

const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3))

// Zona waktu Indonesia (resto satu lokasi). Owner praktis tak pernah ubah,
// tapi dropdown rapi lebih baik daripada free-text yang rawan typo.
const TIMEZONE_OPTIONS = [
  { value: 'Asia/Jakarta', label: 'WIB · Asia/Jakarta' },
  { value: 'Asia/Makassar', label: 'WITA · Asia/Makassar' },
  { value: 'Asia/Jayapura', label: 'WIT · Asia/Jayapura' },
]

export default function ShiftWindowTab() {
  const qc = useQueryClient()
  const toast = useToast()
  const q = useQuery({ queryKey: ['settings'], queryFn: settingsService.get })

  const [tz, setTz] = useState('Asia/Jakarta')
  const [pagiStart, setPagiStart] = useState('07:00')
  const [changeover, setChangeover] = useState('18:00')
  const [malamEnd, setMalamEnd] = useState('23:00')

  useEffect(() => {
    if (q.data) {
      setTz(q.data.timezone)
      setPagiStart(q.data.shiftPagiStart)
      setChangeover(q.data.shiftChangeover)
      setMalamEnd(q.data.shiftMalamEnd)
    }
  }, [q.data])

  const save = useMutation({
    mutationFn: () =>
      settingsService.update({
        timezone: tz,
        shiftPagiStart: pagiStart,
        shiftChangeover: changeover,
        shiftMalamEnd: malamEnd,
      }),
    onSuccess: () => {
      toast.success('Jam shift disimpan')
      qc.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const contiguousOk = toMin(pagiStart) < toMin(changeover)
  const crossMidnight = toMin(malamEnd) <= toMin(changeover)

  // Kalau nilai tersimpan di luar 3 opsi standar, inject jadi opsi ke-4 supaya
  // tidak hilang diam-diam saat owner buka lalu simpan.
  const tzOptions = TIMEZONE_OPTIONS.some((o) => o.value === tz)
    ? TIMEZONE_OPTIONS
    : [...TIMEZONE_OPTIONS, { value: tz, label: tz }]

  if (q.isLoading) {
    return (
      <div className="p-3 sm:p-4 max-w-2xl mx-auto">
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-4 space-y-3 max-w-2xl mx-auto">
      <div className="bg-white rounded-xl border border-neutral-200/60 p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
            <Clock size={20} className="text-neutral-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-neutral-900">Jam Shift</p>
            <p className="text-caption text-neutral-500">Owner atur batas jam buka shift.</p>
          </div>
        </div>

        <Select
          label="Zona waktu"
          options={tzOptions}
          value={tz}
          onChange={(e) => setTz(e.target.value)}
        />

        <Input
          label="Jam Buka Shift Pagi"
          type="time"
          value={pagiStart}
          onChange={(e) => setPagiStart(e.target.value)}
        />
        <Input
          label="Jam Pergantian Shift"
          type="time"
          value={changeover}
          onChange={(e) => setChangeover(e.target.value)}
          helper="Akhir shift pagi sekaligus awal shift malam."
        />
        <Input
          label="Jam Tutup Shift Malam"
          type="time"
          value={malamEnd}
          onChange={(e) => setMalamEnd(e.target.value)}
          helper={crossMidnight ? 'Lewat tengah malam (cross-midnight).' : undefined}
        />

        {!contiguousOk && (
          <p className="text-caption text-danger-600">
            Jam mulai pagi harus sebelum jam pergantian.
          </p>
        )}

        <div className="flex items-start gap-2 rounded-lg bg-info-50 border border-info-100 p-2.5">
          <Info size={16} className="text-info-600 shrink-0 mt-0.5" />
          <p className="text-caption text-info-700">
            Perubahan hanya mempengaruhi aturan BUKA shift ke depan. Shift yang sedang open
            tidak terpengaruh.
          </p>
        </div>

        <div className="flex justify-end">
          <Button
            variant="primary"
            onClick={() => save.mutate()}
            disabled={!contiguousOk || save.isPending}
            loading={save.isPending}
          >
            Simpan
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0, no errors. (Confirms `Select`/`SelectOption` shape matches the inline options array.)

- [ ] **Step 3: Lint the two touched files**

Run: `cd frontend && npx eslint src/components/payment-methods/ShiftWindowTab.tsx src/components/payment-methods/TaxSettingsTab.tsx`
Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/payment-methods/ShiftWindowTab.tsx
git commit -m "style(settings): polish Jam Shift tab - center card, stack time inputs, timezone dropdown, plain labels"
```

---

### Task 3: Build verification + manual e2e

**Files:** none (verification only)

- [ ] **Step 1: Production build**

Run: `cd frontend && npm run build`
Expected: `tsc -b` passes + `vite build` SUCCESS (no new errors).

- [ ] **Step 2: Manual browser e2e (dev server)**

Start dev (`npm run dev` from repo root) if not already running. Login as Owner (PIN 123456) → sidebar **Pembayaran** → tab **Jam Shift**. Verify each:

- [ ] Card is **centered** in the content area (not hugging the left).
- [ ] Switch to tab **Pajak** and back - both cards sit at the same centered position (no horizontal jump).
- [ ] The three time inputs are **vertically stacked and left-aligned** (no "mencong"/misalignment).
- [ ] **Zona waktu** is a dropdown showing `WIB · Asia/Jakarta`, `WITA · Asia/Makassar`, `WIT · Asia/Jayapura`; the saved value (Asia/Jakarta) is preselected.
- [ ] Set **Jam Pergantian Shift** earlier than **Jam Buka Shift Pagi** (e.g. pergantian 06:00, pagi 07:00) → red error "Jam mulai pagi harus sebelum jam pergantian." appears and **Simpan** is disabled. Revert.
- [ ] Set **Jam Tutup Shift Malam** ≤ pergantian (e.g. malam 17:00 with pergantian 18:00) → helper "Lewat tengah malam (cross-midnight)." appears under that field. Revert to 23:00.
- [ ] Click **Simpan** → toast "Jam shift disimpan". Reload the tab → values persist (Asia/Jakarta, 07:00, 18:00, 23:00).
- [ ] (Mobile check) Narrow the viewport to ~375px → labels stay readable, inputs full-width, nothing overflows.

- [ ] **Step 3: Report results**

If all checks pass, the branch is ready for code review (superpowers:requesting-code-review) before merge. If any check fails, capture the symptom and debug with superpowers:systematic-debugging before claiming done.

---

## Self-Review

**Spec coverage:**
- Center layout + Pajak consistency → Task 1 + Task 2 Step 1 (`max-w-2xl mx-auto` in both). ✅
- Kill "mencong" / stack 3 inputs vertically → Task 2 Step 1 (no `grid grid-cols-2`; three full-width `Input`s). ✅
- Timezone → `Select` dropdown WIB/WITA/WIT + fallback inject → Task 2 Step 1 (`TIMEZONE_OPTIONS` + `tzOptions`). ✅
- Plain-language labels → Task 2 Step 1 ("Jam Buka Shift Pagi" / "Jam Pergantian Shift" / "Jam Tutup Shift Malam"). ✅
- Header match TaxSettingsTab → Task 2 Step 1 (`flex items-start gap-3`, icon `shrink-0`, title `min-w-0 flex-1`). ✅
- Validation preserved (contiguous error + Simpan disable; cross-midnight as helper) → Task 2 Step 1 + e2e checks. ✅
- DoD (tsc + build + lint + manual e2e) → Tasks 2-3. ✅

**Placeholder scan:** No TBD/TODO; full file content given verbatim. ✅

**Type consistency:** `settingsService.update({ timezone, shiftPagiStart, shiftChangeover, shiftMalamEnd })` matches existing usage; `q.data` fields (`timezone`, `shiftPagiStart`, `shiftChangeover`, `shiftMalamEnd`) match existing reads; `Select` `options` prop is `SelectOption[]` (`{value,label}`) - inline array matches; `crossMidnight`/`contiguousOk`/`toMin` names consistent throughout. ✅
