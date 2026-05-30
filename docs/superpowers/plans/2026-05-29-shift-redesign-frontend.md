# Shift Redesign (REV 2.7) - FRONTEND Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sesuaikan frontend dengan backend REV 2.7: OpenShiftDialog window-aware + serah-terima, POSPage gate single-active + freshness lintas-device, modal tutup-final dengan daftar tx-open per-meja, SettlementPage re-key ke business date, reminder pergantian shift, tab owner "Jam Shift".

**Architecture:** Mengikuti backend plan ([2026-05-29-shift-redesign-backend.md](2026-05-29-shift-redesign-backend.md)) - DIJALANKAN SETELAH backend hijau. Logika window klien bersifat **advisory** (server tetap otoritas via 409); klien hanya untuk enable/disable tombol + auto-select. Tidak ada unit-test frontend (project tidak punya infra) → verifikasi = `npm run build` (`tsc -b && vite build`) + `npm run lint` + e2e manual browser per checkpoint.

**Tech Stack:** React 18 + TS + Vite + Tailwind + React Query + Zustand + design-system primitives (`Dialog`, `Button`, `Input`, `Tabs`, `Skeleton`, `Badge`, `Checkbox`), `useToast`, `useConfirm`, `cn`.

**Prasyarat:** Backend plan SELESAI & hijau. Endpoint baru/berubah yang diandalkan: `GET /settings` (window fields), `POST /shifts/open` (window-validated), `POST /shifts/:id/close` (body `{mode}`), `POST /shifts/:id/close` 409 `data.openOrders`, `GET /settlements/preview?date=`, `POST /settlements` `{date,counts}`.

**Scope:** HANYA frontend.

---

## Strategi verifikasi & KEAMANAN DATA

> 🔒 e2e manual dilakukan di **frontend dev (`npm run dev`)** yang menunjuk backend dev → DB **LOCAL** berisi data asli. Saat e2e, **gunakan shift/transaksi dummy** dan jangan void/settle data riil. Idealnya pakai backend yang menunjuk `DATABASE_URL` test, tapi minimal: jangan settle hari yang berisi data asli (settle = immutable).

Tiap fase ditutup dengan: `cd frontend && npm run build` (0 error) + `npm run lint` (0 error) + e2e manual sesuai checklist fase.

---

## File Structure Map

**Buat baru:**
- `frontend/src/lib/shiftWindow.ts` - util klien advisory: `parseHHMM`, `restoNowMinutes`, `canOpenClient`, `isAfterChangeover`.
- `frontend/src/components/payment-methods/ShiftWindowTab.tsx` - tab owner set jam shift (mirror TaxSettingsTab).
- `frontend/src/components/shifts/CloseShiftBlockedModal.tsx` - modal daftar tx-open per-meja + redirect.
- `frontend/src/components/ShiftChangeReminder.tsx` - banner non-blocking pergantian shift.

**Modifikasi:**
- `frontend/src/services/settingsService.ts` - `AppSettings` + `UpdateSettingsInput` tambah window.
- `frontend/src/services/shiftService.ts` - `closeShift(id, mode?)`.
- `frontend/src/services/settlementService.ts` - `preview(date)`, `create({date,counts})`.
- `frontend/src/types/index.ts` - pastikan `Shift.date` ada; `SettlementPreview` tambah `openingCashTotal`; `CreateSettlementPayload` `{date,counts}`.
- `frontend/src/components/OpenShiftDialog.tsx` - window-aware + serah-terima.
- `frontend/src/pages/POSPage.tsx` - gate single-active + active-shift `refetchInterval` + invalidate on 409.
- `frontend/src/pages/SettlementPage.tsx` - re-key ke business date + host CloseShiftBlockedModal.
- `frontend/src/pages/PaymentMethodsPage.tsx` - tambah tab "Jam Shift".
- Layout/host untuk `ShiftChangeReminder` (mis. `frontend/src/components/Layout.tsx`).

---

## Phase F0 - Services + Types

### Task F0.1: `settingsService` + types window

**Files:** Modify `frontend/src/services/settingsService.ts`

- [ ] **Step 1:** Tambah field window ke interface:

```ts
export interface AppSettings {
  taxEnabled: boolean
  taxRate: number
  timezone: string
  shiftPagiStart: string   // "HH:MM"
  shiftChangeover: string
  shiftMalamEnd: string
  updatedAt: string
  updatedById: number | null
}
export interface UpdateSettingsInput {
  taxEnabled?: boolean
  taxRate?: number
  timezone?: string
  shiftPagiStart?: string
  shiftChangeover?: string
  shiftMalamEnd?: string
}
```

- [ ] **Step 2:** Build check - `cd frontend && npx tsc -b` → 0 error.
- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/settingsService.ts
git commit -m "feat(fe): settingsService expose shift window fields"
```

### Task F0.2: `shiftService.closeShift(id, mode)` + `settlementService` by-date

**Files:** Modify `frontend/src/services/shiftService.ts`, `frontend/src/services/settlementService.ts`, `frontend/src/types/index.ts`

- [ ] **Step 1:** `shiftService.closeShift` terima mode:

```ts
closeShift: async (shiftId: number, mode: 'final' | 'handover' = 'final'): Promise<Shift> => {
  const res = await api.post<ApiResponse<{ shift: Shift }>>(`/shifts/${shiftId}/close`, { mode })
  return res.data.data.shift
},
```

- [ ] **Step 2:** `settlementService` re-key ke `date` (baca file dulu untuk shape persis):

```ts
export interface CreateSettlementPayload { date: string; counts: Record<string, number> }
// preview(date: string): GET /settlements/preview?date=YYYY-MM-DD
preview: async (date: string): Promise<SettlementPreview> => {
  const res = await api.get<ApiResponse<{ preview: SettlementPreview }>>('/settlements/preview', { params: { date } })
  return res.data.data.preview
},
create: async (payload: CreateSettlementPayload): Promise<Settlement> => {
  const res = await api.post<ApiResponse<{ settlement: Settlement }>>('/settlements', payload)
  return res.data.data.settlement
},
```

- [ ] **Step 3:** `types/index.ts`: pastikan `Shift` punya `date: string`. Tambah `openingCashTotal: number` ke `SettlementPreview`. `SettlementPreview` tetap punya `shiftType`/`cashierName`/`date` (dari preview backend). Kalau `Shift.date` belum ada, tambahkan.

- [ ] **Step 4:** Build check - `npx tsc -b` → 0 error (akan ada error di SettlementPage yang masih pakai `preview(shiftId)`; itu dibereskan di F4 - kalau mau commit bersih, lakukan F0.2 + F4 dalam satu fase. Untuk sekarang biarkan error sampai F4, JANGAN commit setengah jalan; gabungkan commit F0.2 dengan F4 bila perlu).

- [ ] **Step 5: Commit (kalau tsc bersih)** - kalau belum, tunda commit ke F4.

```bash
git add frontend/src/services/shiftService.ts frontend/src/services/settlementService.ts frontend/src/types/index.ts
git commit -m "feat(fe): shiftService close mode + settlementService keyed by business date"
```

---

## Phase F1 - Util window klien

### Task F1.1: `lib/shiftWindow.ts` (advisory)

**Files:** Create `frontend/src/lib/shiftWindow.ts`

- [ ] **Step 1:** Implementasi (mirror logika backend `shift-rules`, advisory):

```ts
import type { AppSettings } from '@/services/settingsService'
import type { ShiftType } from '@/types'

export function parseHHMM(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return h * 60 + m
}

/** Menit-of-day di timezone resto via Intl (advisory: pakai jam device). */
export function restoNowMinutes(timezone: string, now: Date = new Date()): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(now).map((p) => [p.type, p.value]),
  )
  let h = Number(parts.hour); if (h === 24) h = 0
  return h * 60 + Number(parts.minute)
}

export function isAfterChangeover(s: AppSettings, now: Date = new Date()): boolean {
  return restoNowMinutes(s.timezone, now) >= parseHHMM(s.shiftChangeover)
}

interface ClientOpenInput {
  type: ShiftType
  settings: AppSettings
  hasOpenShift: boolean
  pagiOpenedToday: boolean
  now?: Date
}
/** Advisory: tentukan apakah tombol tipe boleh enable. Server tetap otoritas. */
export function canOpenClient(i: ClientOpenInput): boolean {
  if (i.hasOpenShift) return false
  const now = restoNowMinutes(i.settings.timezone, i.now)
  const changeover = parseHHMM(i.settings.shiftChangeover)
  const malamEnd = parseHHMM(i.settings.shiftMalamEnd)
  const crossMidnight = malamEnd <= changeover
  if (i.type === 'pagi') return now < changeover
  const inMalam = crossMidnight ? (now >= changeover || now < malamEnd) : now < malamEnd
  return inMalam && (i.pagiOpenedToday || now >= changeover)
}
```

- [ ] **Step 2:** Build check - `npx tsc -b` → 0 error.
- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/shiftWindow.ts
git commit -m "feat(fe): advisory client shift-window helper (mirror backend rule)"
```

---

## Phase F2 - Owner "Jam Shift" tab

### Task F2.1: `ShiftWindowTab.tsx`

**Files:** Create `frontend/src/components/payment-methods/ShiftWindowTab.tsx`

- [ ] **Step 1:** Implementasi (mirror TaxSettingsTab: query `['settings']`, draft state, save mutation, invalidate):

```tsx
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock, Info } from 'lucide-react'
import { settingsService } from '@/services/settingsService'
import { Button, Input, Skeleton } from '@/design-system/primitives'
import { useToast } from '@/design-system/hooks/useToast'

const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3))

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
      setTz(q.data.timezone); setPagiStart(q.data.shiftPagiStart)
      setChangeover(q.data.shiftChangeover); setMalamEnd(q.data.shiftMalamEnd)
    }
  }, [q.data])

  const save = useMutation({
    mutationFn: () => settingsService.update({ timezone: tz, shiftPagiStart: pagiStart, shiftChangeover: changeover, shiftMalamEnd: malamEnd }),
    onSuccess: () => { toast.success('Jam shift disimpan'); qc.invalidateQueries({ queryKey: ['settings'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const contiguousOk = toMin(pagiStart) < toMin(changeover)
  const crossMidnight = toMin(malamEnd) <= toMin(changeover)

  if (q.isLoading) return <div className="p-4"><Skeleton className="h-64" /></div>

  return (
    <div className="p-3 sm:p-4 space-y-3 max-w-xl">
      <div className="bg-white rounded-xl border border-neutral-200/60 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center"><Clock size={20} className="text-neutral-600" /></div>
          <div><p className="font-medium text-neutral-900">Jam Shift</p><p className="text-caption text-neutral-500">Owner atur batas jam buka shift.</p></div>
        </div>
        <Input label="Timezone" value={tz} onChange={(e) => setTz(e.target.value)} helper="mis. Asia/Jakarta" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Shift 1 (Pagi) mulai" type="time" value={pagiStart} onChange={(e) => setPagiStart(e.target.value)} />
          <Input label="Pergantian (akhir pagi = awal malam)" type="time" value={changeover} onChange={(e) => setChangeover(e.target.value)} />
        </div>
        <Input label="Shift 2 (Malam) tutup" type="time" value={malamEnd} onChange={(e) => setMalamEnd(e.target.value)} helper={crossMidnight ? 'Lewat tengah malam (cross-midnight)' : undefined} />
        {!contiguousOk && <p className="text-caption text-danger-600">Jam mulai pagi harus sebelum jam pergantian.</p>}
        <div className="flex items-start gap-2 rounded-lg bg-info-50 border border-info-100 p-2.5">
          <Info size={16} className="text-info-600 shrink-0 mt-0.5" />
          <p className="text-caption text-info-700">Perubahan hanya mempengaruhi aturan BUKA shift ke depan. Shift yang sedang open tidak terpengaruh.</p>
        </div>
        <div className="flex justify-end">
          <Button variant="primary" onClick={() => save.mutate()} disabled={!contiguousOk || save.isPending} loading={save.isPending}>Simpan</Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2:** Wire ke PaymentMethodsPage: tambah `'shift'` ke `type Tab`, item Tabs `{ value:'shift', label:'Jam Shift', icon:<Clock className="w-4 h-4"/> }` (import `Clock`), dan `{tab === 'shift' && <ShiftWindowTab />}`.

- [ ] **Step 3:** Build + lint - `npm run build && npm run lint` → 0 error.
- [ ] **Step 4: e2e manual** - login owner → Pembayaran → tab Jam Shift → ubah jam → Simpan → reload → nilai persist.
- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/payment-methods/ShiftWindowTab.tsx frontend/src/pages/PaymentMethodsPage.tsx
git commit -m "feat(fe): owner Jam Shift settings tab"
```

---

## Phase F3 - OpenShiftDialog window-aware + serah-terima

### Task F3.1: Rewrite OpenShiftDialog

**Files:** Modify `frontend/src/components/OpenShiftDialog.tsx`

- [ ] **Step 1:** Tambah query settings + today's shifts; hitung openable; fail-closed saat settings loading/gagal:

```tsx
// tambah import: useQuery, settingsService, shiftService, canOpenClient
const settingsQ = useQuery({ queryKey: ['settings'], queryFn: settingsService.get, refetchOnMount: 'always' })
// today's shifts untuk pagiOpenedToday (open atau closed)
const today = new Date().toISOString().slice(0, 10)
const todayShiftsQ = useQuery({ queryKey: ['shifts', 'byDate', today], queryFn: () => shiftService.listShifts({ date: today }) })

const settings = settingsQ.data
const pagiOpenedToday = (todayShiftsQ.data ?? []).some((s) => s.type === 'pagi')
const hasOpenShift = activeShifts.length > 0

function openable(type: ShiftType): boolean {
  if (!settings) return false // fail-closed
  return canOpenClient({ type, settings, hasOpenShift, pagiOpenedToday })
}
const pagiOk = openable('pagi')
const malamOk = openable('malam')
const anyOpenable = pagiOk || malamOk
```

- [ ] **Step 2:** Ganti auto-select: default ke tipe pertama yang openable; kalau tidak ada → empty state. Ubah disable tombol pakai `openable(t)` (bukan cuma blockedTypeReason). Footer Buka disabled kalau `!anyOpenable || !openable(type)`.

```tsx
const [type, setType] = useState<ShiftType>('pagi')
useEffect(() => {
  if (!settings) return
  if (openable('pagi')) setType('pagi')
  else if (openable('malam')) setType('malam')
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [settings, hasOpenShift, pagiOpenedToday])
```
Empty-state (di body form, kalau `settings && !anyOpenable`): tampilkan "Di luar jam operasional - tidak ada shift yang bisa dibuka sekarang." + tombol Buka disabled. Loading (`settingsQ.isLoading`): Skeleton + tombol disabled.

- [ ] **Step 3:** Serah-terima (combined action) - kalau `hasOpenShift` (shift orang lain open) DAN window mengizinkan tipe pengganti: tampilkan tombol sekunder "Serah-terima: tutup {pemilik} lalu buka {tipe}". Handler:

```tsx
const handover = useMutation({
  mutationFn: async (payload: OpenShiftPayload) => {
    const open = activeShifts[0]
    if (open) await shiftService.closeShift(open.id, 'handover')
    return shiftService.openShift(payload)
  },
  onSuccess: () => { toast.success('Serah-terima berhasil'); qc.invalidateQueries({ queryKey: ['shifts', 'active'] }); onSuccess() },
  onError: (e: Error) => toast.error(e.message),
})
```
Catatan: untuk serah-terima, `openable()` dievaluasi DENGAN `hasOpenShift=false` (karena shift lama akan ditutup dulu). Buat varian `openableForHandover(type) = canOpenClient({..., hasOpenShift:false})`.

- [ ] **Step 4:** Build + lint → 0 error.
- [ ] **Step 5: e2e manual** - (a) jam pagi: hanya Pagi enable, buka → sukses; (b) set jam device/owner ke malam: Pagi disable; (c) saat shift pagi orang lain open: muncul "Serah-terima" → tutup pagi + buka malam dalam 1 aksi.
- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/OpenShiftDialog.tsx
git commit -m "feat(fe): OpenShiftDialog window-aware + fail-closed + handover combined action"
```

---

## Phase F4 - POSPage gate + freshness; SettlementPage re-key + close modal

### Task F4.1: POSPage active-shift freshness + gate

**Files:** Modify `frontend/src/pages/POSPage.tsx`

- [ ] **Step 1:** Tambah `refetchInterval` + invalidate-on-409 ke query `['shifts','active']`:

```tsx
const { data: activeShifts = [], isLoading: shiftLoading } = useQuery({
  queryKey: ['shifts', 'active'],
  queryFn: () => shiftService.getActiveShifts(),
  refetchInterval: 25_000,          // device lain lihat handover/0-shift dalam ~25s
  refetchOnMount: 'always',
})
```
Pada `createMutation.onError` & `addPayment` error handlers (di PaymentModal juga, tapi minimal di POSPage create): kalau pesan mengandung "buka shift" / "shift kasir aktif" → `qc.invalidateQueries({ queryKey: ['shifts','active'] })` supaya gate re-render.

- [ ] **Step 2:** Gate `ShiftGate` sudah single-active-friendly (0/1/2+). Tidak perlu ubah besar; pastikan branch 2+ tetap defensive. (Tidak ada perubahan logika selain freshness.)

- [ ] **Step 3:** Build + lint → 0 error.
- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/POSPage.tsx
git commit -m "feat(fe): POSPage active-shift freshness (poll + invalidate on shift error)"
```

### Task F4.2: `CloseShiftBlockedModal.tsx`

**Files:** Create `frontend/src/components/shifts/CloseShiftBlockedModal.tsx`

- [ ] **Step 1:** Implementasi modal daftar tx-open per-meja + redirect:

```tsx
import { useNavigate } from 'react-router-dom'
import { ArrowRight, AlertTriangle } from 'lucide-react'
import { Dialog, Button } from '@/design-system/primitives'

export interface OpenOrdersGroup {
  groupKey: string; label: string; tableNumber: number | null; txIds: number[]
}
export default function CloseShiftBlockedModal({ groups, onClose }: { groups: OpenOrdersGroup[]; onClose: () => void }) {
  const navigate = useNavigate()
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Ada pesanan belum dibayar" description="Selesaikan dulu sebelum tutup kasir." size="sm">
      <ul className="space-y-3">
        {groups.map((g) => (
          <li key={g.groupKey} className="rounded-lg border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-neutral-900">{g.label}</span>
              <Button variant="ghost" size="sm"
                onClick={() => navigate(g.tableNumber != null ? `/pos/${g.tableNumber}` : '/pos')}
              ><span className="flex items-center gap-1">Buka <ArrowRight className="w-4 h-4" /></span></Button>
            </div>
            <p className="text-caption text-neutral-500 mt-1">{g.txIds.map((id) => `Tx #${id}`).join(' · ')}</p>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}
```

- [ ] **Step 2:** Build + lint → 0 error. **Commit**

```bash
git add frontend/src/components/shifts/CloseShiftBlockedModal.tsx
git commit -m "feat(fe): close-shift blocked modal (open orders grouped per table + redirect)"
```

### Task F4.3: SettlementPage re-key ke business date + host close modal

**Files:** Modify `frontend/src/pages/SettlementPage.tsx`

- [ ] **Step 1:** Close mutation `mode='final'` + tangkap 409 `openOrders`:

```tsx
import type { AxiosError } from 'axios'
import CloseShiftBlockedModal, { type OpenOrdersGroup } from '@/components/shifts/CloseShiftBlockedModal'
// ...
const [blockedGroups, setBlockedGroups] = useState<OpenOrdersGroup[] | null>(null)

const closeShiftMutation = useMutation({
  mutationFn: (id: number) => shiftService.closeShift(id, 'final'),
  onSuccess: () => { toast.success('Shift ditutup'); qc.invalidateQueries({ queryKey: ['shifts'] }) },
  onError: (err: AxiosError<{ data?: { openOrders?: OpenOrdersGroup[] } }>) => {
    const groups = err.response?.data?.data?.openOrders
    if (err.response?.status === 409 && groups?.length) setBlockedGroups(groups)
    else toast.error((err as Error).message)
  },
})
// render <CloseShiftBlockedModal> kalau blockedGroups != null.
```

- [ ] **Step 2:** Re-key SettlementFlow ke business date (`targetShift.date`), bukan shiftId:

```tsx
{!shiftsLoading && targetShift && targetShift.closedAt && (
  <SettlementFlow businessDate={targetShift.date} />
)}
// SettlementFlow({ businessDate }: { businessDate: string }):
const { data: preview } = useQuery({
  queryKey: ['settlements', 'preview', businessDate],
  queryFn: () => settlementService.preview(businessDate),
  refetchOnMount: 'always',
})
// BlindCountForm.handleSubmit → submit.mutate({ date: preview.date, counts })
```
Catatan: karena dedupe backend by `date`, dua kasir yang anchor shift berbeda tapi `date` sama → preview & existing-check konsisten. `preview.shiftId` tidak lagi dipakai sebagai kunci.

- [ ] **Step 3:** Tampilkan baseline modal awal: di header BlindCountForm tambah baris "Modal awal hari ini: {formatCurrency(preview.openingCashTotal)}".

- [ ] **Step 4:** Build + lint → 0 error (sekaligus menyelesaikan error tertunda dari F0.2).
- [ ] **Step 5: e2e manual** - kasir tutup shift dgn tx open → modal daftar per-meja muncul + tombol redirect ke /pos/<meja> jalan; beresin tx → tutup → settlement preview muncul keyed by date; submit → sukses; buka SettlementPage lagi → tampil detail (bukan form kosong).
- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/SettlementPage.tsx frontend/src/services/settlementService.ts frontend/src/services/shiftService.ts frontend/src/types/index.ts
git commit -m "feat(fe): SettlementPage keyed by business date + close-final blocked modal + opening-cash baseline"
```

---

## Phase F5 - ShiftChangeReminder banner

### Task F5.1: `ShiftChangeReminder.tsx`

**Files:** Create `frontend/src/components/ShiftChangeReminder.tsx`; mount di `Layout.tsx`

- [ ] **Step 1:** Implementasi (derive dari settings + activeShifts; dismissal per shiftId):

```tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Clock } from 'lucide-react'
import { settingsService } from '@/services/settingsService'
import { shiftService } from '@/services/shiftService'
import { isAfterChangeover } from '@/lib/shiftWindow'

export default function ShiftChangeReminder() {
  const settingsQ = useQuery({ queryKey: ['settings'], queryFn: settingsService.get })
  const shiftsQ = useQuery({ queryKey: ['shifts', 'active'], queryFn: () => shiftService.getActiveShifts(), refetchInterval: 25_000 })
  const [dismissedFor, setDismissedFor] = useState<number | null>(null)

  const settings = settingsQ.data
  const pagiShift = (shiftsQ.data ?? []).find((s) => s.type === 'pagi')
  const show = !!settings && !!pagiShift && isAfterChangeover(settings) && dismissedFor !== pagiShift.id
  if (!show || !pagiShift) return null

  return (
    <div className="fixed right-3 z-40 max-w-xs rounded-lg bg-warning-50 border border-warning-200 shadow-lg p-3"
      style={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}>
      <div className="flex items-start gap-2">
        <Clock className="w-4 h-4 text-warning-700 mt-0.5 shrink-0" />
        <p className="text-caption text-warning-800">Sudah masuk jam shift malam. Kalau ada pergantian kasir, tutup shift untuk diserahkan; kalau lanjut sendiri, abaikan.</p>
        <button onClick={() => setDismissedFor(pagiShift.id)} aria-label="Tutup" className="shrink-0 text-warning-600"><X className="w-4 h-4" /></button>
      </div>
    </div>
  )
}
```
> Dismissal disimpan per `shiftId` di state (cukup; reload akan re-arm - acceptable. Kalau mau persist lintas reload, simpan ke localStorage key `reminder-dismissed-<shiftId>`).

- [ ] **Step 2:** Mount `<ShiftChangeReminder />` di `Layout.tsx` (sekali, di luar konten halaman).
- [ ] **Step 3:** Build + lint → 0 error.
- [ ] **Step 4: e2e manual** - set changeover ke jam < sekarang, shift pagi open → banner muncul kanan atas; dismiss → hilang; reload → muncul lagi (acceptable) / kalau localStorage dipakai, tetap hilang sampai shift ganti.
- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ShiftChangeReminder.tsx frontend/src/components/Layout.tsx
git commit -m "feat(fe): non-blocking shift-change reminder banner"
```

---

## Phase F6 - Verifikasi penuh + e2e end-to-end

### Task F6.1: Build + lint + e2e skenario lengkap

- [ ] **Step 1:** `cd frontend && npm run build` → SUCCESS (0 error). `npm run lint` → 0 error.
- [ ] **Step 2: e2e end-to-end (dummy data, jangan settle hari berisi data asli):**
  - [ ] Owner set Jam Shift.
  - [ ] Kasir buka pagi (jam dalam window) → POS jalan; buka kedua dari device lain → 409 single-active.
  - [ ] Buat order; lewat changeover → reminder muncul.
  - [ ] Serah-terima dari OpenShiftDialog (tutup pagi + buka malam) → order siang dibayar di malam → cek atribusi (HistoryPage/owner dashboard) jatuh ke malam.
  - [ ] Coba tutup-final dengan tx open → modal per-meja + redirect.
  - [ ] Beresin tx → tutup → SettlementPage preview by date → submit → detail tampil; coba buka dari akun kasir lain hari sama → lihat settlement sama (bukan form kosong).
  - [ ] Void tx di hari yang sudah di-settle → ditolak.
- [ ] **Step 3:** Catat hasil e2e; kalau ada bug, perbaiki + commit.

---

## Self-Review (penulis plan)

**Spec §9 coverage:** OpenShiftDialog→F3; Modal tutup-final→F4.2/F4.3; POSPage gate+freshness→F4.1; tab Jam Shift→F2; ShiftChangeReminder→F5; SettlementPage re-key→F4.3; settingsService/shiftService→F0. Hardening §9: freshness→F4.1; loading/fail-closed→F3; auto-select empty→F3; client advisory→F1; modal host+parse data→F4.2/F4.3; dismissal key→F5.

**Catatan eksekutor:** Baca `settlementService.ts` & `types/index.ts` aktual sebelum F0.2 (shape `preview`/`Settlement`/`SettlementPreview` exact). Konfirmasi `Shift.date` ada di type; tambah kalau belum. Konfirmasi `shiftService.listShifts` menerima `{date}` (backend `listShiftsQuerySchema` sudah punya `date`). Backend HARUS sudah men-deploy field `data.openOrders` di 409 close (backend Task 1.3 Step 4) sebelum F4.3 e2e.

**Konvensi float (konfirmasi user):** baseline = Σ openingCash hari itu. Kalau user pilih "ganti float", ubah backend Task 3.3 + label F4.3.

---

## Execution Handoff

Frontend dijalankan SETELAH backend hijau. Dua opsi eksekusi (untuk kedua plan):
1. **Subagent-Driven (rekomendasi)** - dispatch subagent fresh per task, review antar task.
2. **Inline Execution** - eksekusi di sesi ini, batch + checkpoint.
