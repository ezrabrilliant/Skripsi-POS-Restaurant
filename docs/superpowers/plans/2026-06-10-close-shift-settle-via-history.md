# Tutup Shift Terhambat Order Kemarin — Beresin lewat Riwayat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Putuskan loop "shift basi + order belum dibayar" dengan mengalihkan kasir/owner ke halaman Riwayat untuk **membayar** (atau membatalkan) order kemarin, lalu menutup shift — tanpa menyentuh kode `/POS`.

**Architecture:** Perbaikan **frontend murni** (nol perubahan backend). Backend sudah memisahkan: order baru / tambah item ke shift basi = ditolak 409, tapi **bayar / void** order kemarin = boleh (atribusi ke shift open). Kita reuse `PaymentModal` yang sudah self-contained di halaman Riwayat (sudah punya aksi void), arahkan `CloseShiftBlockedModal` & `OverdueShiftGate` ke Riwayat (bukan balik ke `/pos/{meja}` yang kena gate = loop), dan benahi resolusi `targetShift` di Settlement supaya owner tidak dead-end. Part A (shiftFocus + formatShiftDate + Settlement + Dashboard) di-**re-apply** dari commit `131d53a` (branch `fix/owner-overdue-shift-flow`, belum di-merge) di atas kode terkini.

**Tech Stack:** React 18 + TypeScript + Vite, React Query v5, react-router-dom v7, Tailwind, design-system primitives lokal, Vitest (sudah terpasang).

**Spec:** [docs/superpowers/specs/2026-06-10-close-shift-settle-via-history-design.md](../specs/2026-06-10-close-shift-settle-via-history-design.md) (Approved).

---

## Catatan setup (sebelum Task 1)

- **Branch/worktree:** kerjakan di branch `fix/close-shift-settle-via-history` yang dicabang dari `fix/pos-ui-and-receipt-merge` (mewarisi fix POS UI + struk merge). Jika pakai worktree (disarankan), buat via `superpowers:using-git-worktrees` di awal eksekusi.
- **Backend = nol perubahan.** Jangan sentuh `backend/`. Jangan sentuh `frontend/src/pages/POSPage.tsx` (keputusan desain: /POS utuh).
- Semua command dijalankan dari root repo kecuali disebut lain. Frontend ada di `frontend/`.

## File Structure (yang dibuat / disentuh)

| File | Aksi | Tanggung jawab |
|---|---|---|
| `frontend/src/services/shiftFocus.ts` | **Create** | Pure selector `pickShiftToSettle(active, recent)` — 1 sumber kebenaran shift yang perlu ditutup. |
| `frontend/src/services/shiftFocus.test.ts` | **Create** | Vitest 5 kasus untuk `pickShiftToSettle`. |
| `frontend/src/lib/utils.ts` | **Modify** | Tambah `formatShiftDate(date)` (Intl id-ID, TZ-safe). |
| `frontend/src/components/OverdueShiftGate.tsx` | **Modify** | Pakai `formatShiftDate` + tambah secondary link "Selesaikan pesanan di Riwayat". |
| `frontend/src/components/shifts/CloseShiftBlockedModal.tsx` | **Modify** | Ganti tombol per-meja `→ /pos/{meja}` (loop) jadi satu tombol "Buka Riwayat" + prop `shiftDate`. |
| `frontend/src/pages/SettlementPage.tsx` | **Modify** | `targetShift = pickShiftToSettle(active, recent)` (sistem-wide, owner tak lagi dead-end) + copy date-aware + pass `shiftDate` ke modal. |
| `frontend/src/pages/owner-dashboard/RingkasanTab.tsx` | **Modify** | `ShiftPanel` sadar-overdue + tombol "Tutup & Setor Shift". |
| `frontend/src/pages/HistoryPage.tsx` | **Modify** | Tombol **Bayar** per baris open (+ `PaymentModal`) + preset filter dari URL `?status=&date=`. |

Urutan task mengikuti dependensi: `formatShiftDate` & `pickShiftToSettle` dibuat dulu, baru konsumennya; `CloseShiftBlockedModal` dapat prop `shiftDate` sebelum SettlementPage mengirimnya.

---

### Task 1: `shiftFocus.ts` — pure selector + test (Part A foundation)

**Files:**
- Create: `frontend/src/services/shiftFocus.ts`
- Test: `frontend/src/services/shiftFocus.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/services/shiftFocus.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { pickShiftToSettle } from './shiftFocus'
import type { Shift } from '@/types'

// Factory shift minimal yang valid (strict mode) — override field yang relevan saja.
function makeShift(over: Partial<Shift> = {}): Shift {
  return {
    id: 1,
    date: '2026-05-28',
    cashierId: 2,
    openingCash: 25000,
    closedAt: null,
    createdAt: '2026-05-28T01:00:00.000Z',
    ...over,
  }
}

describe('pickShiftToSettle', () => {
  it('mengembalikan shift open system-wide (untuk ditutup) jika ada', () => {
    const active = [makeShift({ id: 10, isOverdue: true })]
    const recent = [makeShift({ id: 99, closedAt: '2026-05-27T15:00:00.000Z' })]
    expect(pickShiftToSettle(active, recent)?.id).toBe(10)
  })

  it('mengembalikan shift open walau tidak overdue (happy path tutup shift)', () => {
    const active = [makeShift({ id: 11, isOverdue: false })]
    expect(pickShiftToSettle(active, [])?.id).toBe(11)
  })

  it('jatuh ke shift terakhir (recent) saat tidak ada shift open — kasus settle hari yang sudah closed', () => {
    const recent = [makeShift({ id: 20, closedAt: '2026-05-27T15:00:00.000Z' })]
    expect(pickShiftToSettle([], recent)?.id).toBe(20)
  })

  it('memprioritaskan shift open di atas recent meski recent ada', () => {
    const active = [makeShift({ id: 30 })]
    const recent = [makeShift({ id: 31, closedAt: '2026-05-27T15:00:00.000Z' })]
    expect(pickShiftToSettle(active, recent)?.id).toBe(30)
  })

  it('mengembalikan null saat tidak ada shift sama sekali', () => {
    expect(pickShiftToSettle([], [])).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/services/shiftFocus.test.ts`
Expected: FAIL — `Failed to resolve import "./shiftFocus"` (file belum ada).

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/services/shiftFocus.ts`:

```ts
import type { Shift } from '@/types'

// Pure selector "shift yang perlu ditutup/disetor" — satu sumber kebenaran yang
// dipakai SettlementPage agar tidak drift dari gate POS & panel Dashboard.
//
// Prioritas:
//   1. Ada shift OPEN system-wide (closedAt=null, mungkin overdue) → itu yang
//      harus ditutup dulu. Berlaku untuk owner (tak punya shift sendiri) maupun
//      kasir. `active` berasal dari getActiveShifts() (key ['shifts','active']).
//   2. Tidak ada shift open → pakai shift terakhir (recent) untuk kasus settle
//      hari yang sudah closed tapi belum disetor.
//   3. Tidak ada keduanya → null (benar-benar tak ada yang perlu diproses).
export function pickShiftToSettle(active: Shift[], recent: Shift[]): Shift | null {
  if (active.length > 0) return active[0]
  return recent.length > 0 ? recent[0] : null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/services/shiftFocus.test.ts`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/shiftFocus.ts frontend/src/services/shiftFocus.test.ts
git commit -m "feat(shift): pickShiftToSettle selector + vitest (Part A foundation)"
```

---

### Task 2: `formatShiftDate` di utils.ts

**Files:**
- Modify: `frontend/src/lib/utils.ts` (sisipkan setelah `formatDate`, sebelum `formatDateTime`)

- [ ] **Step 1: Tambah fungsi**

Di `frontend/src/lib/utils.ts`, sisipkan blok ini tepat setelah penutup `}` fungsi `formatDate(...)` dan sebelum `export function formatDateTime`:

```ts
// Format tanggal shift: "hari, tanggal - bulan - tahun" → mis. "Sabtu, 30 - 05 - 2026".
// shift.date dari API = "YYYY-MM-DD" (atau ISO). Untuk date-only, konstruksi Date dari
// komponen lokal supaya nama hari tidak meleset karena pergeseran timezone.
export function formatShiftDate(date: string | Date): string {
  let d: Date
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    const [y, m, day] = date.slice(0, 10).split('-').map(Number)
    d = new Date(y, m - 1, day)
  } else {
    d = new Date(date)
  }
  const weekday = new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(d)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${weekday}, ${dd} - ${mm} - ${d.getFullYear()}`
}
```

- [ ] **Step 2: Verify tsc**

Run: `cd frontend && npx tsc -b`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/utils.ts
git commit -m "feat(utils): formatShiftDate (Intl id-ID, TZ-safe date-only)"
```

---

### Task 3: `OverdueShiftGate` — formatShiftDate + secondary link ke Riwayat

**Files:**
- Modify: `frontend/src/components/OverdueShiftGate.tsx` (rewrite penuh — file 34 baris)

Catatan: `OverdueShiftGate` dipanggil di [POSPage.tsx:399](../../../frontend/src/pages/POSPage.tsx#L399) dengan `shift` + `onGoToSettlement`. Secondary link memakai `useNavigate` langsung di komponen ini → **tidak perlu** menyentuh POSPage.

- [ ] **Step 1: Rewrite file**

Ganti seluruh isi `frontend/src/components/OverdueShiftGate.tsx` dengan:

```tsx
// REV 2.12: layar blokir saat shift aktif sudah lewat business day-nya (isOverdue).
// Memaksa kasir menuntaskan + menutup + menyetor shift kemarin sebelum mulai hari ini.
import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import type { Shift } from '@/types'
import { Button } from '@/design-system/primitives'
import { formatShiftDate } from '@/lib/utils'

export default function OverdueShiftGate({
  shift,
  onGoToSettlement,
}: {
  shift: Shift
  onGoToSettlement: () => void
}) {
  const navigate = useNavigate()
  return (
    <div className="h-full flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-sm border border-warning-200">
        <div className="w-14 h-14 bg-warning-100 text-warning-700 rounded-full mx-auto mb-3 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-title font-semibold text-neutral-900 mb-1 text-center">
          Shift kemarin belum ditutup
        </h2>
        <p className="text-body-sm text-neutral-600 mb-3 text-center">
          Shift {shift.type ? `${shift.type} ` : ''}{formatShiftDate(shift.date)} (kasir{' '}
          {shift.cashierName}) masih terbuka. Tuntaskan semua pesanan yang belum dibayar, lalu
          tutup &amp; setor shift itu dulu sebelum mulai hari ini.
        </p>
        <Button variant="primary" size="md" fullWidth onClick={onGoToSettlement}>
          Tutup &amp; Setor Shift Kemarin
        </Button>
        <Button
          variant="ghost"
          size="md"
          fullWidth
          className="mt-2"
          onClick={() => navigate(`/history?status=open&date=${shift.date}`)}
        >
          Selesaikan pesanan di Riwayat
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify tsc**

Run: `cd frontend && npx tsc -b`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/OverdueShiftGate.tsx
git commit -m "feat(pos): OverdueShiftGate tambah jalan pintas Selesaikan di Riwayat + tanggal terbaca"
```

---

### Task 4: `CloseShiftBlockedModal` — redirect ke Riwayat (putus loop) + prop `shiftDate`

**Files:**
- Modify: `frontend/src/components/shifts/CloseShiftBlockedModal.tsx` (rewrite penuh — file 26 baris)

Inti perubahan: hapus tombol per-meja `navigate('/pos/{tableNumber}')` (inilah yang balik kena gate = loop). Ganti dengan **satu** tombol primer "Buka Riwayat" → `/history?status=open&date=<shiftDate>`. Daftar meja tetap tampil sebagai konteks (read-only).

- [ ] **Step 1: Rewrite file**

Ganti seluruh isi `frontend/src/components/shifts/CloseShiftBlockedModal.tsx` dengan:

```tsx
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Dialog, Button } from '@/design-system/primitives'

export interface OpenOrdersGroup { groupKey: string; label: string; tableNumber: number | null; txIds: number[] }

export default function CloseShiftBlockedModal({
  groups,
  shiftDate,
  onClose,
}: {
  groups: OpenOrdersGroup[]
  /** Tanggal shift yang sedang ditutup → preset filter Riwayat ke hari itu. */
  shiftDate?: string
  onClose: () => void
}) {
  const navigate = useNavigate()
  const historyUrl = `/history?status=open${shiftDate ? `&date=${shiftDate}` : ''}`
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Ada pesanan belum dibayar"
      description="Bayar atau batalkan pesanan ini lewat Riwayat dulu, baru tutup kasir."
      size="sm"
    >
      <ul className="space-y-2 mb-4">
        {groups.map((g) => (
          <li key={g.groupKey} className="rounded-lg border border-neutral-200 p-3">
            <span className="font-medium text-neutral-900">{g.label}</span>
            <p className="text-caption text-neutral-500 mt-1">
              {g.txIds.map((id) => `Tx #${id}`).join(' · ')}
            </p>
          </li>
        ))}
      </ul>
      <Button variant="primary" size="md" fullWidth onClick={() => navigate(historyUrl)}>
        <span className="flex items-center gap-1">
          Buka Riwayat <ArrowRight className="w-4 h-4" />
        </span>
      </Button>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verify tsc**

Run: `cd frontend && npx tsc -b`
Expected: 0 errors (SettlementPage belum mengirim `shiftDate` — itu prop opsional, jadi tetap kompilasi).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/shifts/CloseShiftBlockedModal.tsx
git commit -m "fix(shift): CloseShiftBlockedModal arahkan ke Riwayat (putus loop /pos), prop shiftDate"
```

---

### Task 5: `SettlementPage` — target shift sistem-wide + copy date-aware + pass `shiftDate`

**Files:**
- Modify: `frontend/src/pages/SettlementPage.tsx` (5 sisipan; base saat ini cocok verbatim dengan commit `131d53a`)

- [ ] **Step 1: Update import (baris 13-17)**

Cari:
```tsx
import { shiftService } from '@/services/shiftService'
import { settlementService, type CreateSettlementPayload } from '@/services/settlementService'
import { useAuthStore } from '@/stores/authStore'
import type { SettlementPreview, Settlement } from '@/types'
import { formatCurrency, cn } from '@/lib/utils'
```
Ganti jadi:
```tsx
import { shiftService } from '@/services/shiftService'
import { pickShiftToSettle } from '@/services/shiftFocus'
import { settlementService, type CreateSettlementPayload } from '@/services/settlementService'
import { useAuthStore } from '@/stores/authStore'
import type { SettlementPreview, Settlement } from '@/types'
import { formatCurrency, cn, formatShiftDate } from '@/lib/utils'
```

- [ ] **Step 2: Ganti resolusi shift (baris 32-38)**

Cari:
```tsx
  const { data: shifts = [], isLoading: shiftsLoading } = useQuery({
    queryKey: ['shifts', 'my-recent', user?.id],
    queryFn: () => shiftService.listShifts({ cashierId: user?.id }),
    enabled: !!user,
  })

  const targetShift = shifts.length > 0 ? shifts[0] : null
```
Ganti jadi:
```tsx
  const isOwner = user?.role === 'owner'

  // Sumber utama = shift open system-wide (key dipakai bersama POS gate &
  // panel Dashboard → tak bisa kontradiksi). Owner pun melihat shift kasir yang
  // masih terbuka di sini, bukan "Belum ada shift".
  const { data: activeShifts = [], isLoading: activeLoading } = useQuery({
    queryKey: ['shifts', 'active'],
    queryFn: () => shiftService.getActiveShifts(),
    refetchOnMount: 'always',
  })

  // Fallback (tak ada shift open) untuk menyetor hari yang sudah closed: owner
  // lihat shift terakhir se-sistem, kasir lihat shift miliknya sendiri.
  const { data: recentShifts = [], isLoading: recentLoading } = useQuery({
    queryKey: ['shifts', 'recent', isOwner ? 'system' : user?.id],
    queryFn: () => shiftService.listShifts(isOwner ? {} : { cashierId: user?.id }),
    enabled: !!user,
  })

  const shiftsLoading = activeLoading || recentLoading
  const targetShift = pickShiftToSettle(activeShifts, recentShifts)
```

- [ ] **Step 3: Confirm dialog sertakan nama kasir (baris ~58)**

Cari:
```tsx
      title: `Tutup shift ${targetShift.type}?`,
```
Ganti jadi:
```tsx
      title: `Tutup shift ${targetShift.type ?? ''}${
        targetShift.cashierName ? ` milik ${targetShift.cashierName}` : ''
      }?`,
```

- [ ] **Step 4: Copy date-aware untuk 2 EmptyStateCard (baris ~76-95)**

Cari blok:
```tsx
        {!shiftsLoading && !targetShift && (
          <EmptyStateCard
            icon={Wallet}
            title="Belum ada shift"
            message="Buka kasir dulu di Dashboard sebelum settlement."
            actionLabel="Ke Dashboard"
            onAction={() => navigate('/dashboard')}
          />
        )}

        {!shiftsLoading && targetShift && !targetShift.closedAt && (
          <EmptyStateCard
            icon={AlertCircle}
            tone="warning"
            title={`Shift ${targetShift.type} masih aktif`}
            message="Tutup shift dulu sebelum settlement."
            actionLabel="Tutup Shift"
            onAction={handleCloseShift}
            actionLoading={closeShiftMutation.isPending}
          />
        )}
```
Ganti jadi:
```tsx
        {!shiftsLoading && !targetShift && (
          <EmptyStateCard
            icon={Wallet}
            tone="neutral"
            title="Tidak ada shift untuk disetor"
            message="Belum ada shift yang dibuka. Buka kasir dulu di Dashboard."
            actionLabel="Ke Dashboard"
            onAction={() => navigate('/dashboard')}
          />
        )}

        {!shiftsLoading && targetShift && !targetShift.closedAt && (
          <EmptyStateCard
            icon={AlertCircle}
            tone="warning"
            title={
              targetShift.isOverdue
                ? `Shift ${formatShiftDate(targetShift.date)} · kasir ${targetShift.cashierName ?? '-'} belum ditutup`
                : `Shift ${targetShift.type ?? ''} masih aktif`
            }
            message={
              targetShift.isOverdue
                ? 'Tuntaskan semua pesanan yang belum dibayar, lalu tutup & setor shift ini sebelum mulai hari baru.'
                : 'Tutup shift dulu sebelum settlement.'
            }
            actionLabel="Tutup Shift"
            onAction={handleCloseShift}
            actionLoading={closeShiftMutation.isPending}
          />
        )}
```

- [ ] **Step 5: Pass `shiftDate` ke CloseShiftBlockedModal (baris ~101-105)**

Cari:
```tsx
        {blockedGroups && (
          <CloseShiftBlockedModal
            groups={blockedGroups}
            onClose={() => setBlockedGroups(null)}
          />
        )}
```
Ganti jadi:
```tsx
        {blockedGroups && (
          <CloseShiftBlockedModal
            groups={blockedGroups}
            shiftDate={targetShift?.date}
            onClose={() => setBlockedGroups(null)}
          />
        )}
```

- [ ] **Step 6: Verify tsc**

Run: `cd frontend && npx tsc -b`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/SettlementPage.tsx
git commit -m "fix(settlement): target shift sistem-wide (owner tak dead-end) + copy overdue + shiftDate ke modal"
```

---

### Task 6: `RingkasanTab` ShiftPanel — sadar-overdue + tombol Tutup & Setor

**Files:**
- Modify: `frontend/src/pages/owner-dashboard/RingkasanTab.tsx` (3 sisipan; base ShiftPanel saat ini cocok verbatim dengan `131d53a`)

- [ ] **Step 1: Update import (baris 6 & 34-35)**

Cari (baris 6):
```tsx
import { Link } from 'react-router-dom'
```
Ganti jadi:
```tsx
import { Link, useNavigate } from 'react-router-dom'
```

Cari (baris 34-35):
```tsx
import { formatCurrency } from '@/lib/utils'
import { Stat, Badge, Skeleton, EmptyState } from '@/design-system/primitives'
```
Ganti jadi:
```tsx
import { formatCurrency, formatShiftDate } from '@/lib/utils'
import { Stat, Badge, Skeleton, EmptyState, Button } from '@/design-system/primitives'
```

- [ ] **Step 2: Perluas tipe prop + tambah useNavigate di ShiftPanel (baris ~262-266)**

Cari:
```tsx
function ShiftPanel({
  shifts,
}: {
  shifts: Array<{ id: number; type?: 'pagi' | 'malam'; cashierName?: string; createdAt: string; openingCash: number }>
}) {
  if (shifts.length === 0) {
```
Ganti jadi:
```tsx
function ShiftPanel({
  shifts,
}: {
  shifts: Array<{
    id: number
    date: string
    type?: 'pagi' | 'malam'
    cashierName?: string
    createdAt: string
    openingCash: number
    isOverdue?: boolean
  }>
}) {
  const navigate = useNavigate()

  if (shifts.length === 0) {
```

- [ ] **Step 3: Logika overdue + heading + footer aksi (baris ~277-313)**

Cari:
```tsx
  const isOverlap = shifts.length > 1
  return (
    <div
      className={
        isOverlap
          ? 'bg-warning-50 border border-warning-300 rounded-xl p-3 sm:p-4'
          : 'bg-success-50 border border-success-200 rounded-xl p-3 sm:p-4'
      }
    >
      <div className="flex items-center gap-2 mb-1">
        {isOverlap ? (
          <AlertCircle className="w-4 h-4 text-warning-700" />
        ) : (
          <Wallet className="w-4 h-4 text-success-700" />
        )}
        <h3 className="text-body-sm font-semibold text-neutral-900">
          {isOverlap ? `Ada ${shifts.length} shift aktif (overlap)` : 'Shift aktif hari ini'}
        </h3>
      </div>
      <ul className="text-body-sm space-y-1 text-neutral-700">
        {shifts.map((s) => (
          <li key={s.id} className="flex flex-wrap gap-x-2">
            <span className="font-medium text-neutral-900">{s.cashierName ?? '-'}</span>
            <span className="text-neutral-500">·</span>
            <span>{s.type === 'pagi' ? 'Pagi' : s.type === 'malam' ? 'Malam' : '-'}</span>
            <span className="text-neutral-500">·</span>
            <span>modal awal {formatCurrency(s.openingCash)}</span>
          </li>
        ))}
      </ul>
      {isOverlap && (
        <p className="mt-2 text-caption text-warning-700">
          Input order baru akan ditolak sampai salah satu shift ditutup. Owner force-close belum
          tersedia di UI - minta kasir tutup shift via menu Settlement.
        </p>
      )}
    </div>
  )
}
```
Ganti jadi:
```tsx
  const isOverlap = shifts.length > 1
  const overdueShift = shifts.find((s) => s.isOverdue) ?? null
  const needsClose = !!overdueShift || isOverlap

  return (
    <div
      className={
        needsClose
          ? 'bg-warning-50 border border-warning-300 rounded-xl p-3 sm:p-4'
          : 'bg-success-50 border border-success-200 rounded-xl p-3 sm:p-4'
      }
    >
      <div className="flex items-center gap-2 mb-1">
        {needsClose ? (
          <AlertCircle className="w-4 h-4 text-warning-700" />
        ) : (
          <Wallet className="w-4 h-4 text-success-700" />
        )}
        <h3 className="text-body-sm font-semibold text-neutral-900">
          {overdueShift
            ? `Shift ${formatShiftDate(overdueShift.date)} (kasir ${overdueShift.cashierName ?? '-'}) belum ditutup`
            : isOverlap
              ? `Ada ${shifts.length} shift aktif (overlap)`
              : 'Shift aktif hari ini'}
        </h3>
      </div>
      <ul className="text-body-sm space-y-1 text-neutral-700">
        {shifts.map((s) => (
          <li key={s.id} className="flex flex-wrap gap-x-2">
            <span className="font-medium text-neutral-900">{s.cashierName ?? '-'}</span>
            <span className="text-neutral-500">·</span>
            <span>{s.type === 'pagi' ? 'Pagi' : s.type === 'malam' ? 'Malam' : '-'}</span>
            <span className="text-neutral-500">·</span>
            <span>modal awal {formatCurrency(s.openingCash)}</span>
          </li>
        ))}
      </ul>
      {needsClose && (
        <div className="mt-3 space-y-2">
          <p className="text-caption text-warning-700">
            {overdueShift
              ? 'Shift hari sebelumnya belum disetor. Tutup & setor dulu sebelum mulai hari baru.'
              : 'Input order baru ditolak sampai salah satu shift ditutup.'}
          </p>
          <Button variant="primary" size="sm" onClick={() => navigate('/settlement')}>
            Tutup &amp; Setor Shift
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify tsc**

Run: `cd frontend && npx tsc -b`
Expected: 0 errors. (`activeShifts` yang dikirim ke `<ShiftPanel shifts={activeShifts} />` adalah `Shift[]` yang sudah punya `date` + `isOverdue`, jadi tipe baru cocok.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/owner-dashboard/RingkasanTab.tsx
git commit -m "feat(dashboard): ShiftPanel sadar shift overdue + tombol Tutup & Setor"
```

---

### Task 7: `HistoryPage` — tombol Bayar + PaymentModal + preset filter dari URL (Part B inti)

**Files:**
- Modify: `frontend/src/pages/HistoryPage.tsx`

Empat sisipan: (a) import, (b) preset filter dari URL + state `payTx`, (c) render `PaymentModal`, (d) prop `onPay` + tombol Bayar di `TransactionRow`.

- [ ] **Step 1: Tambah import (baris 17-45)**

Cari (baris 17-18):
```tsx
import { Fragment, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
```
Ganti jadi:
```tsx
import { Fragment, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
```

Cari blok ikon lucide (baris 19-27):
```tsx
import {
  ChevronRight,
  ChevronDown,
  Ban,
  MoreVertical,
  Filter,
  Receipt,
  Link2,
} from 'lucide-react'
```
Ganti jadi (tambah `Wallet`):
```tsx
import {
  ChevronRight,
  ChevronDown,
  Ban,
  MoreVertical,
  Filter,
  Receipt,
  Link2,
  Wallet,
} from 'lucide-react'
```

Cari baris import transactionService (baris 28):
```tsx
import { transactionService } from '@/services/transactionService'
```
Ganti jadi (tambah PaymentModal):
```tsx
import { transactionService } from '@/services/transactionService'
import PaymentModal from '@/components/PaymentModal'
```

- [ ] **Step 2: Preset filter dari URL + state payTx (baris 74-80)**

Cari:
```tsx
  const today = new Date().toISOString().substring(0, 10)
  const [filterDate, setFilterDate] = useState(today)
  const [filterStatus, setFilterStatus] = useState<TransactionStatus | 'all'>('all')
  const [filterOrderType, setFilterOrderType] = useState<OrderType | 'all'>('all')
```
Ganti jadi:
```tsx
  // Preset dari URL (?status=open&date=YYYY-MM-DD) — dipakai saat di-redirect dari
  // CloseShiftBlockedModal / OverdueShiftGate supaya mendarat ter-filter pada hari &
  // status yang tepat. Lazy initial state = baca sekali saat mount; user bebas ubah sesudahnya.
  const [searchParams] = useSearchParams()
  const today = new Date().toISOString().substring(0, 10)
  const [filterDate, setFilterDate] = useState(() => searchParams.get('date') || today)
  const [filterStatus, setFilterStatus] = useState<TransactionStatus | 'all'>(() => {
    const s = searchParams.get('status')
    return s === 'open' || s === 'paid' || s === 'void' ? s : 'all'
  })
  const [filterOrderType, setFilterOrderType] = useState<OrderType | 'all'>('all')
  // Tx yang sedang dibayar lewat Riwayat (reuse PaymentModal apa adanya). null = tertutup.
  const [payTx, setPayTx] = useState<Transaction | null>(null)
```

- [ ] **Step 3: Render PaymentModal (sebelum `</Page>`, setelah `<Sheet>` ~baris 300)**

Cari penutup Sheet diikuti `</Page>`:
```tsx
        </Sheet>
    </Page>
  )
}
```
Ganti jadi:
```tsx
        </Sheet>

        {payTx && (
          <PaymentModal
            transactionId={payTx.id}
            tableNumber={payTx.tableNumber ?? null}
            candidateSourceIds={[]}
            onClose={() => setPayTx(null)}
            onSuccess={() => {
              setPayTx(null)
              // Key komposit ['transactions',date,status,type] kena prefix-invalidate dari
              // ['transactions'] → baris flip dari 'open' ke 'paid'.
              qc.invalidateQueries({ queryKey: ['transactions'] })
            }}
          />
        )}
    </Page>
  )
}
```

- [ ] **Step 4: Wire `onPay` ke TransactionRow (baris ~254-265)**

Cari:
```tsx
              <TransactionRow
                key={tx.id}
                tx={tx}
                mergedSources={mergedFromMap.get(tx.id) ?? []}
                expanded={expandedIds.has(tx.id)}
                onToggle={() => toggleExpanded(tx.id)}
                onVoid={() => handleVoid(tx)}
                onScrollToTx={handleScrollToTx}
                labelForMethod={labelForMethod}
              />
```
Ganti jadi (tambah `onPay`):
```tsx
              <TransactionRow
                key={tx.id}
                tx={tx}
                mergedSources={mergedFromMap.get(tx.id) ?? []}
                expanded={expandedIds.has(tx.id)}
                onToggle={() => toggleExpanded(tx.id)}
                onVoid={() => handleVoid(tx)}
                onPay={() => setPayTx(tx)}
                onScrollToTx={handleScrollToTx}
                labelForMethod={labelForMethod}
              />
```

- [ ] **Step 5: Tambah prop `onPay` + tombol Bayar di TransactionRow (baris ~305-346 & ~416-432)**

Cari signature TransactionRow:
```tsx
function TransactionRow({
  tx,
  mergedSources,
  expanded,
  onToggle,
  onVoid,
  onScrollToTx,
  labelForMethod,
}: {
  tx: Transaction
  /** Objek Tx source yang di-merge ke Tx ini (merge target). Kosong = bukan target. */
  mergedSources: Transaction[]
  expanded: boolean
  onToggle: () => void
  onVoid: () => void
  onScrollToTx: (id: number) => void
  /** REV 2.6: lookup label dari master payment_methods (fallback uppercase code). */
  labelForMethod: (code: string) => string
}) {
  const canVoid = tx.status !== 'void'
```
Ganti jadi:
```tsx
function TransactionRow({
  tx,
  mergedSources,
  expanded,
  onToggle,
  onVoid,
  onPay,
  onScrollToTx,
  labelForMethod,
}: {
  tx: Transaction
  /** Objek Tx source yang di-merge ke Tx ini (merge target). Kosong = bukan target. */
  mergedSources: Transaction[]
  expanded: boolean
  onToggle: () => void
  onVoid: () => void
  /** Buka PaymentModal untuk Tx open ini (dibayar lewat Riwayat). */
  onPay: () => void
  onScrollToTx: (id: number) => void
  /** REV 2.6: lookup label dari master payment_methods (fallback uppercase code). */
  labelForMethod: (code: string) => string
}) {
  const canVoid = tx.status !== 'void'
  // Bayar hanya untuk Tx open yang BUKAN merge-source (source dibayar via parent —
  // konsisten dgn cascade addPayment). Merge target & single tetap bisa dibayar.
  const canPay = tx.status === 'open' && tx.mergedIntoId === null
```

Lalu cari blok aksi kanan baris (DropdownMenu):
```tsx
        {menuItems.length > 0 && (
          <div className="flex items-center pr-3 sm:pr-4">
            <DropdownMenu
              trigger={
                <button
                  type="button"
                  aria-label="Aksi"
                  className="h-9 w-9 inline-flex items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              }
              items={menuItems}
              align="end"
            />
          </div>
        )}
```
Ganti jadi (sisipkan tombol Bayar sebelum menu ⋮):
```tsx
        {canPay && (
          <div className="flex items-center pr-1 sm:pr-2">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Wallet className="w-4 h-4" />}
              onClick={onPay}
            >
              Bayar
            </Button>
          </div>
        )}
        {menuItems.length > 0 && (
          <div className="flex items-center pr-3 sm:pr-4">
            <DropdownMenu
              trigger={
                <button
                  type="button"
                  aria-label="Aksi"
                  className="h-9 w-9 inline-flex items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              }
              items={menuItems}
              align="end"
            />
          </div>
        )}
```

- [ ] **Step 6: Verify tsc + lint**

Run: `cd frontend && npx tsc -b && npx eslint src/pages/HistoryPage.tsx`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/HistoryPage.tsx
git commit -m "feat(history): tombol Bayar per order open + PaymentModal + preset filter dari URL"
```

---

### Task 8: Verifikasi penuh — build, lint, vitest, Playwright e2e

**Files:** none (verification only). Gunakan `superpowers:verification-before-completion`: jalankan tiap command, tempel output, jangan klaim lulus tanpa bukti.

- [ ] **Step 1: Vitest (pure logic)**

Run: `cd frontend && npm run test`
Expected: semua PASS, termasuk `src/services/shiftFocus.test.ts` (5) + test existing (`utils.test.ts`, `receipt.test.ts`) tidak rusak.

- [ ] **Step 2: Type-check + production build**

Run: `cd frontend && npm run build`
Expected: `tsc -b` 0 error + `vite build` SUCCESS.

- [ ] **Step 3: Lint**

Run: `cd frontend && npm run lint`
Expected: 0 error.

- [ ] **Step 4: Siapkan state "shift basi + 2 order open" untuk e2e**

Prasyarat: MySQL lokal hidup + `cd backend && npm run db:seed` sudah pernah jalan. Buat 1 shift open yang overdue + 2 transaksi open di shift itu. Tulis script sekali-pakai `backend/scripts/seed-stale-shift.ts`:

```ts
// Sekali pakai: bikin 1 shift open ber-tanggal kemarin (overdue) + 2 order open.
// Jalankan: cd backend && npx tsx scripts/seed-stale-shift.ts
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const cashier = await prisma.user.findFirstOrThrow({ where: { role: 'cashier' } })
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const dateOnly = new Date(Date.UTC(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()))

  const shift = await prisma.shift.create({
    data: {
      date: dateOnly,
      type: 'malam',
      cashierId: cashier.id,
      openingCash: 50000,
      activeMarker: 1, // single-OPEN guard; pastikan tak ada shift open lain
      createdAt: dateOnly,
    },
  })

  const menu = await prisma.menu.findFirstOrThrow({ where: { isActive: true } })
  for (const table of [3, 5]) {
    await prisma.transaction.create({
      data: {
        orderType: 'dineIn',
        tableNumber: table,
        status: 'open',
        createdById: cashier.id,
        shiftId: shift.id,
        subtotal: menu.price,
        total: 0,
        createdAt: dateOnly,
        items: { create: [{ menuId: menu.id, menuName: menu.name, qty: 1, unitPrice: menu.price, subtotal: menu.price, unitCost: menu.cost ?? 0 }] },
      },
    })
  }
  console.log(`Seeded stale shift #${shift.id} (date=${dateOnly.toISOString().slice(0,10)}) + 2 open orders di meja 3 & 5`)
}
main().finally(() => prisma.$disconnect())
```

Run: `cd backend && npx tsx scripts/seed-stale-shift.ts`
Catatan: jika ada shift open lain, tutup dulu (atau hapus row-nya) supaya `activeMarker` tidak bentrok. Sesuaikan nama field bila `tsx scripts/seed-stale-shift.ts` melapor field tak dikenal (cek `backend/prisma/schema.prisma` model `Transaction`/`TransactionItem`/`Shift`). Script ini **tidak** di-commit (artefak test).

- [ ] **Step 5: Playwright e2e — Kasir (alur utama)**

Jalankan app: `npm run dev` (root). Login sebagai kasir pemilik shift basi. Verifikasi via Playwright MCP:
1. Buka `/pos` → muncul `OverdueShiftGate` ("Shift kemarin belum ditutup").
2. Klik "Tutup & Setor Shift Kemarin" → mendarat `/settlement`, tampil EmptyStateCard overdue (judul memuat `formatShiftDate` + nama kasir).
3. Klik "Tutup Shift" → 409 → `CloseShiftBlockedModal` muncul dengan tombol **"Buka Riwayat"** (BUKAN tombol per-meja "Buka").
4. Klik "Buka Riwayat" → `/history?status=open&date=<tanggal>`; daftar ter-filter status open pada tanggal shift; 2 order tampil dengan tombol **Bayar**.
5. Order #1 → klik **Bayar** → `PaymentModal` buka → bayar tunai sampai `status='paid'` → modal tutup → baris flip ke `paid`.
6. Order #2 → menu ⋮ → **Batalkan** → konfirmasi → baris jadi `void`.
7. Kembali `/settlement` → "Tutup Shift" → sukses (tak ada 409) → lanjut blind count / setor.

Expected: tidak ada loop balik ke `/pos`; shift bisa ditutup setelah semua order open beres.

- [ ] **Step 6: Playwright e2e — Owner (dead-end hilang)**

Login sebagai owner saat shift kasir basi masih open:
1. `/settlement` → **bukan** "Belum ada shift"; tampil shift kasir yang open (judul overdue + tombol "Tutup Shift").
2. `/dashboard` (Ringkasan) → `ShiftPanel` warning "Shift {tanggal} (kasir …) belum ditutup" + tombol "Tutup & Setor Shift" → klik → `/settlement`.

- [ ] **Step 7: Regression — happy path kasir**

Dengan shift normal (tidak overdue) tanpa order open: tutup shift sendiri dari `/settlement` tetap jalan; bayar normal di `/pos` tidak berubah (kode POS tak disentuh).

- [ ] **Step 8: Bukti + commit catatan e2e (opsional)**

Simpan screenshot Playwright (mis. ke `docs/pengujian/screenshots/`) bila Ezra mau bukti visual. Tidak ada commit kode di step ini.

---

## Self-Review (vs spec)

**Spec coverage:**
- Part B.1 HistoryPage (Bayar + PaymentModal + URL preset) → Task 7 ✓
- Part B.2 CloseShiftBlockedModal (redirect Riwayat + prop shiftDate) → Task 4 ✓
- Part B.3 OverdueShiftGate (secondary "Selesaikan di Riwayat") → Task 3 ✓
- Part A.4 shiftFocus + test → Task 1 ✓
- Part A.5 formatShiftDate → Task 2 ✓
- Part A.6 SettlementPage (pickShiftToSettle + copy + shiftDate) → Task 5 ✓
- Part A.7 RingkasanTab ShiftPanel → Task 6 ✓
- Backend nol perubahan ✓ (tidak ada task backend)
- Verifikasi build/lint/vitest/Playwright (5 cabang vitest + e2e kasir/owner/regression) → Task 8 ✓

**Type consistency:**
- `pickShiftToSettle(active: Shift[], recent: Shift[]): Shift | null` — dipakai sama di Task 1 (def) & Task 5 (call). ✓
- `formatShiftDate(date: string | Date): string` — Task 2 (def), dipakai Task 3/5/6. ✓
- `CloseShiftBlockedModal` prop baru `shiftDate?: string` — Task 4 (def) & Task 5 (pass `targetShift?.date`). ✓
- `TransactionRow` prop baru `onPay: () => void` — Task 7 def & call konsisten. ✓
- `PaymentModal` props (`transactionId:number`, `tableNumber:number|null`, `candidateSourceIds?:number[]`, `onClose`, `onSuccess`) — sesuai `PaymentModalProps`; `payTx.tableNumber ?? null` mengamankan tipe. ✓

**Out of scope (tidak dikerjakan):** perubahan gate POS / mode settle-only di POS, perubahan backend apa pun, cabang 2+ shift overlap, owner pilih hari closed sembarang via date picker, refund pasca-settle.
