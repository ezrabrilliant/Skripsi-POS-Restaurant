# Shift Redesign (REV 2.7) — BACKEND Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun ulang alur shift backend jadi model "business day berbasis shift" dengan window owner-configurable, single-active guard, atribusi revenue saat bayar, dan settlement whole-business-day — sesuai spec [2026-05-29-shift-redesign-design.md](../specs/2026-05-29-shift-redesign-design.md).

**Architecture:** Logika waktu/aturan diekstrak ke fungsi MURNI (tanpa DB) di `modules/shifts/shift-time.ts` + `shift-rules.ts` → di-TDD via Vitest tanpa risiko data. Service (shifts/transactions/settlements/dashboard) memakai fungsi murni itu + Prisma. Single-active ditegakkan kolom `Shift.activeMarker` + `@@unique([activeMarker])`. Migrasi LOKAL & PROD bersifat aditif (non-destruktif) — `db push` tanpa `--force-reset`.

**Tech Stack:** Express 4 + TypeScript + Prisma 6 + MySQL; Vitest (unit, pure fn); `tsx` smoke scripts (integrasi) terhadap DB TEST terpisah; Zod v3.

**Scope:** HANYA backend. Frontend (OpenShiftDialog, POSPage gate, modal tutup, reminder, SettlementPage, services) = plan terpisah `2026-05-29-shift-redesign-frontend.md` (ditulis setelah backend hijau).

---

## Strategi Test & KEAMANAN DATA (baca dulu)

> 🔒 **Local DB berisi data ASLI.** JANGAN PERNAH jalankan `prisma migrate reset`, `db push --force-reset`, atau `db:fresh` pada DB local/prod. Semua perubahan schema di plan ini aditif → `npx prisma db push` biasa.

Dua jalur test:
1. **Unit (pure fn, NOL DB):** `shift-time.ts` & `shift-rules.ts` diuji Vitest (`*.test.ts`). Aman, cepat, deterministik. `restoNow`/`businessDateFor` menerima `now?: Date` injectable supaya tidak bergantung jam nyata.
2. **Integrasi (service + DB):** smoke script `tsx` terhadap **DB TEST TERPISAH** (schema `pos_restaurant_test`), TIDAK pernah ke DB asli. Script di-guard: refuse jalan kalau `DATABASE_URL` tidak mengandung `_test`.

Vitest default meng-include `**/*.test.ts` & meng-exclude `node_modules` — tidak perlu config baru.

---

## File Structure Map

**Buat baru:**
- `backend/src/modules/shifts/shift-time.ts` — helper waktu TZ-aware murni (`parseHHMM`, `restoNow`, `businessDateFor`).
- `backend/src/modules/shifts/shift-time.test.ts` — Vitest unit.
- `backend/src/modules/shifts/shift-rules.ts` — predikat murni `canOpenShift` + tipe `ShiftWindowSettings`.
- `backend/src/modules/shifts/shift-rules.test.ts` — Vitest unit.
- `backend/scripts/smoke-shift.ts` — smoke integrasi shift open/close/reopen/handover (DB test).
- `backend/scripts/smoke-settlement.ts` — smoke settlement whole-day (DB test).
- `backend/.env.test` — `DATABASE_URL` ke schema `pos_restaurant_test` (TIDAK di-commit).

**Modifikasi:**
- `backend/prisma/schema.prisma` — `AppSetting` +4 field; `Shift` +`activeMarker`+unique; `Settlement` +`@@unique([date])`.
- `backend/src/modules/settings/settings.schema.ts` + `settings.service.ts` — field window + Zod.
- `backend/src/modules/shifts/shifts.service.ts` — `openShift` (rules+marker+P2002), `closeShift(mode)`, `getActiveShifts`, `getOpenOrdersForClose`.
- `backend/src/modules/shifts/shifts.schema.ts` + `shifts.controller.ts` + `shifts.routes.ts` — `mode` param + auth handover.
- `backend/src/modules/transactions/transactions.service.ts` — `resolveActiveShift` simplify; `addPayment` atomic re-stamp; `mergeBills` simplify; `voidTransaction` settled-guard.
- `backend/src/modules/settlements/settlements.service.ts` — by-businessDate re-key (5 call sites), permission, float baseline.
- `backend/src/modules/settlements/settlements.schema.ts` + controller — terima `date` (bukan shiftId).
- `backend/src/modules/dashboard/dashboard.service.ts` — atribusi `shift.date` + TZ-aware date.

---

## Phase 0 — Test DB + Schema + Pure Helpers (fondasi)

### Task 0.1: Siapkan DB test terpisah

**Files:** Create `backend/.env.test`

- [ ] **Step 1: Buat `.env.test`** (salin `DATABASE_URL` dari `.env`, ganti nama schema jadi `pos_restaurant_test`)

```
DATABASE_URL="mysql://USER:PASS@localhost:3306/pos_restaurant_test"
JWT_SECRET="test-secret"
TABLE_COUNT=9
```

- [ ] **Step 2: Push schema saat ini ke DB test + seed**

Run: `cd backend && npx prisma db push --schema prisma/schema.prisma` dengan env test:
`tsx -e "process.env.DATABASE_URL=require('dotenv').config({path:'.env.test'}).parsed.DATABASE_URL"` — atau lebih simpel: `npx dotenv -e .env.test -- npx prisma db push` (kalau dotenv-cli ada) ATAU set sementara di shell:
`$env:DATABASE_URL="mysql://...pos_restaurant_test"; npx prisma db push; npm run db:seed`
Expected: schema + seed (6 user, menu, dll) masuk DB test. DB asli TIDAK tersentuh.

- [ ] **Step 3: Tambah `.env.test` ke `.gitignore`**

Verify `.gitignore` mengandung `.env.test`.

- [ ] **Step 4: Commit** (hanya `.gitignore` kalau berubah)

```bash
git add backend/.gitignore && git commit -m "chore: ignore .env.test for isolated test DB"
```

---

### Task 0.2: `shift-time.ts` — helper waktu TZ-aware (TDD)

**Files:**
- Create: `backend/src/modules/shifts/shift-time.ts`
- Test: `backend/src/modules/shifts/shift-time.test.ts`

- [ ] **Step 1: Tulis test gagal**

```ts
// shift-time.test.ts
import { describe, it, expect } from 'vitest';
import { parseHHMM, restoNow, businessDateFor } from './shift-time';

describe('parseHHMM', () => {
  it('konversi HH:MM ke menit', () => {
    expect(parseHHMM('00:00')).toBe(0);
    expect(parseHHMM('07:00')).toBe(420);
    expect(parseHHMM('18:30')).toBe(1110);
    expect(parseHHMM('23:59')).toBe(1439);
  });
});

describe('restoNow', () => {
  it('hitung menit-of-day di Asia/Jakarta dari instant UTC', () => {
    // 2026-05-29T11:00:00Z = 18:00 WIB (UTC+7)
    const r = restoNow('Asia/Jakarta', new Date('2026-05-29T11:00:00Z'));
    expect(r.minutesOfDay).toBe(18 * 60);
    expect(r.dateOnly.toISOString().substring(0, 10)).toBe('2026-05-29');
  });
  it('after-midnight WIB beda tanggal kalender dari UTC', () => {
    // 2026-05-29T17:30:00Z = 2026-05-30 00:30 WIB
    const r = restoNow('Asia/Jakarta', new Date('2026-05-29T17:30:00Z'));
    expect(r.minutesOfDay).toBe(30);
    expect(r.dateOnly.toISOString().substring(0, 10)).toBe('2026-05-30');
  });
});

describe('businessDateFor', () => {
  const s = { timezone: 'Asia/Jakarta', pagiStart: 420, changeover: 1080, malamEnd: 1380 }; // 07:00/18:00/23:00 (no cross-midnight)
  it('business day = tanggal resto-local untuk config non-cross-midnight', () => {
    const d = businessDateFor(s, new Date('2026-05-29T15:00:00Z')); // 22:00 WIB
    expect(d.toISOString().substring(0, 10)).toBe('2026-05-29');
  });
  it('cross-midnight: jam 00:30 WIB masih business day kemarin', () => {
    const cross = { ...s, malamEnd: 90 }; // 01:30 (<= changeover => cross-midnight)
    const d = businessDateFor(cross, new Date('2026-05-29T17:30:00Z')); // 00:30 WIB tgl 30
    expect(d.toISOString().substring(0, 10)).toBe('2026-05-29');
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd backend && npx vitest run src/modules/shifts/shift-time.test.ts`
Expected: FAIL (module belum ada).

- [ ] **Step 3: Implementasi**

```ts
// shift-time.ts
export interface RestoClock {
  dateOnly: Date;       // UTC-midnight Date untuk tanggal kalender resto-local
  minutesOfDay: number; // 0..1439 menit sejak tengah malam resto-local
}
export interface ShiftWindowSettings {
  timezone: string;
  pagiStart: number;   // menit
  changeover: number;  // menit
  malamEnd: number;    // menit; <= changeover berarti cross-midnight
}

export function parseHHMM(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

export function restoNow(timezone: string, now: Date = new Date()): RestoClock {
  // Pakai Intl untuk dapat komponen tanggal/jam di timezone resto.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const year = Number(parts.year), month = Number(parts.month), day = Number(parts.day);
  let hour = Number(parts.hour);
  if (hour === 24) hour = 0; // beberapa runtime emit '24' untuk midnight
  const minute = Number(parts.minute);
  return {
    dateOnly: new Date(Date.UTC(year, month - 1, day)),
    minutesOfDay: hour * 60 + minute,
  };
}

function isCrossMidnight(s: ShiftWindowSettings): boolean {
  return s.malamEnd <= s.changeover;
}

export function businessDateFor(s: ShiftWindowSettings, now: Date = new Date()): Date {
  const { dateOnly, minutesOfDay } = restoNow(s.timezone, now);
  // Cross-midnight: jam dini hari (< malamEnd) masih milik business day KEMARIN.
  if (isCrossMidnight(s) && minutesOfDay < s.malamEnd) {
    const prev = new Date(dateOnly);
    prev.setUTCDate(prev.getUTCDate() - 1);
    return prev;
  }
  return dateOnly;
}

export { isCrossMidnight };
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `cd backend && npx vitest run src/modules/shifts/shift-time.test.ts`
Expected: PASS (3 describe blocks hijau).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/shifts/shift-time.ts backend/src/modules/shifts/shift-time.test.ts
git commit -m "feat(shifts): TZ-aware time helpers (parseHHMM, restoNow, businessDateFor)"
```

---

### Task 0.3: `shift-rules.ts` — predikat `canOpenShift` (TDD)

**Files:**
- Create: `backend/src/modules/shifts/shift-rules.ts`
- Test: `backend/src/modules/shifts/shift-rules.test.ts`

- [ ] **Step 1: Tulis test gagal**

```ts
// shift-rules.test.ts
import { describe, it, expect } from 'vitest';
import { canOpenShift } from './shift-rules';

const S = { timezone: 'Asia/Jakarta', pagiStart: 420, changeover: 1080, malamEnd: 1380 }; // 07:00/18:00/23:00

const base = { settings: S, hasOpenShift: false, pagiOpenedToday: false };

describe('canOpenShift', () => {
  it('pagi sebelum changeover → ok', () => {
    expect(canOpenShift({ ...base, type: 'pagi', nowMinutes: 480 }).ok).toBe(true); // 08:00
  });
  it('pagi jam 20:00 (lewat changeover) → tolak out_of_window', () => {
    const r = canOpenShift({ ...base, type: 'pagi', nowMinutes: 1200 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('out_of_window');
  });
  it('prep dini: pagi sebelum pagiStart tetap boleh', () => {
    expect(canOpenShift({ ...base, type: 'pagi', nowMinutes: 360 }).ok).toBe(true); // 06:00
  });
  it('malam setelah changeover → ok', () => {
    expect(canOpenShift({ ...base, type: 'malam', nowMinutes: 1140 }).ok).toBe(true); // 19:00
  });
  it('serah-terima dini: malam sebelum changeover boleh JIKA pagi sudah dibuka', () => {
    expect(canOpenShift({ ...base, type: 'malam', nowMinutes: 1020, pagiOpenedToday: true }).ok).toBe(true); // 17:00
  });
  it('malam pagi-pagi tanpa pagi dibuka → tolak', () => {
    const r = canOpenShift({ ...base, type: 'malam', nowMinutes: 600 }); // 10:00, pagi belum dibuka
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('out_of_window');
  });
  it('single-active dilanggar → tolak single_active (apa pun window)', () => {
    const r = canOpenShift({ ...base, type: 'pagi', nowMinutes: 480, hasOpenShift: true });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('single_active');
  });
  it('reopen pagi dalam window (no open shift) → ok walau pagi sudah pernah dibuka', () => {
    expect(canOpenShift({ ...base, type: 'pagi', nowMinutes: 660, pagiOpenedToday: true }).ok).toBe(true); // 11:00
  });
  it('cross-midnight: malam jam 23:30 (config end 01:30) → ok', () => {
    const cross = { ...S, malamEnd: 90 };
    expect(canOpenShift({ ...base, settings: cross, type: 'malam', nowMinutes: 1410 }).ok).toBe(true); // 23:30
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `cd backend && npx vitest run src/modules/shifts/shift-rules.test.ts`
Expected: FAIL (module belum ada).

- [ ] **Step 3: Implementasi**

```ts
// shift-rules.ts
import type { ShiftWindowSettings } from './shift-time';
import { isCrossMidnight } from './shift-time';

export type ShiftKind = 'pagi' | 'malam';

export interface OpenCheckInput {
  type: ShiftKind;
  nowMinutes: number;
  settings: ShiftWindowSettings;
  hasOpenShift: boolean;     // single-active runtime
  pagiOpenedToday: boolean;  // pagi sudah pernah dibuka business day ini
}
export interface OpenCheckResult {
  ok: boolean;
  reason?: 'single_active' | 'out_of_window';
}

function malamWithinWindow(now: number, s: ShiftWindowSettings): boolean {
  if (!isCrossMidnight(s)) return now < s.malamEnd;          // same-day: belum lewat malamEnd
  return now >= s.changeover || now < s.malamEnd;            // wrapped: [changeover,1440) ∪ [0,malamEnd)
}

export function canOpenShift(input: OpenCheckInput): OpenCheckResult {
  // Single-active menang lebih dulu (paling actionable).
  if (input.hasOpenShift) return { ok: false, reason: 'single_active' };

  const { type, nowMinutes: now, settings: s, pagiOpenedToday } = input;
  if (type === 'pagi') {
    return now < s.changeover ? { ok: true } : { ok: false, reason: 'out_of_window' };
  }
  // malam
  const inWindow = malamWithinWindow(now, s);
  const allowed = inWindow && (pagiOpenedToday || now >= s.changeover);
  return allowed ? { ok: true } : { ok: false, reason: 'out_of_window' };
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `cd backend && npx vitest run src/modules/shifts/shift-rules.test.ts`
Expected: PASS (9 kasus hijau).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/shifts/shift-rules.ts backend/src/modules/shifts/shift-rules.test.ts
git commit -m "feat(shifts): pure canOpenShift predicate (window + single-active + reopen)"
```

---

### Task 0.4: Schema — AppSetting window, Shift activeMarker, Settlement unique date

**Files:** Modify `backend/prisma/schema.prisma`

- [ ] **Step 1: Edit `model AppSetting`** — tambah 4 field dengan `@default` (aman untuk row id=1 yang sudah ada):

```prisma
model AppSetting {
  id          Int      @id @default(1)
  taxEnabled  Boolean  @default(false) @map("tax_enabled")
  taxRate     Decimal  @default(10.00) @map("tax_rate") @db.Decimal(5, 2)
  timezone        String @default("Asia/Jakarta") @map("timezone") @db.VarChar(64)
  shiftPagiStart  String @default("07:00") @map("shift_pagi_start") @db.VarChar(5)
  shiftChangeover String @default("18:00") @map("shift_changeover") @db.VarChar(5)
  shiftMalamEnd   String @default("23:00") @map("shift_malam_end") @db.VarChar(5)
  updatedAt   DateTime @updatedAt @map("updated_at")
  updatedById Int?     @map("updated_by_id")
  updatedBy   User?    @relation(fields: [updatedById], references: [id], onDelete: SetNull)

  @@map("app_settings")
}
```

- [ ] **Step 2: Edit `model Shift`** — tambah `activeMarker` + unique; pertahankan index:

```prisma
model Shift {
  id          Int       @id @default(autoincrement())
  date        DateTime  @db.Date
  type        ShiftType
  cashierId   Int       @map("cashier_id")
  openingCash Decimal   @map("opening_cash") @db.Decimal(12, 2)
  closedAt    DateTime? @map("closed_at")
  activeMarker Int?     @map("active_marker") // = 1 saat open, NULL saat closed
  createdAt   DateTime  @default(now()) @map("created_at")

  cashier      User          @relation(fields: [cashierId], references: [id])
  transactions Transaction[]
  settlement   Settlement?

  @@unique([activeMarker])            // hanya 1 shift boleh punya activeMarker=1 (single-active)
  @@index([date, type, closedAt])
  @@map("shifts")
}
```

- [ ] **Step 3: Edit `model Settlement`** — pastikan `date` unik (satu settlement per business day). Buka model, ubah `shiftId` dari unik jadi FK biasa bila perlu, dan tambah `@@unique([date])`:

```prisma
// Di model Settlement:
//  - JIKA ada `shiftId Int @unique`  → ubah jadi `shiftId Int` (drop @unique inline)
//  - JIKA ada `@@unique([shiftId])`  → hapus baris itu
//  - TAMBAH: @@unique([date])
// Catatan: shiftId tetap FK ke shift penutup (audit). Relasi Shift.settlement (1:1) tetap valid karena satu shift menutup paling banyak satu settlement.
```

> ⚠️ Sebelum apply: jalankan deteksi duplikat di DB test & local (Task 0.5 Step 2) — `SELECT date, COUNT(*) FROM settlements GROUP BY date HAVING COUNT(*)>1`. Resolve manual kalau ada, baru push.

- [ ] **Step 4: Generate client**

Run: `cd backend && npx prisma generate`
Expected: sukses, tipe Prisma ter-update (ada `activeMarker`, field window).

- [ ] **Step 5: Commit** (schema saja; push DB di Task 0.5)

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(schema): AppSetting shift windows + Shift.activeMarker single-open guard + Settlement unique(date)"
```

---

### Task 0.5: Push schema aditif ke DB TEST lalu LOCAL (non-destruktif)

**Files:** none (operasi DB)

- [ ] **Step 1: Push ke DB TEST + verifikasi**

Run (PowerShell, env test): `$env:DATABASE_URL="mysql://...pos_restaurant_test"; cd backend; npx prisma db push`
Expected: "Your database is now in sync" tanpa prompt data-loss (perubahan aditif). Kalau ada error duplikat `activeMarker` → tidak mungkin (semua NULL). Kalau error `Settlement.date` duplikat → lanjut Step 2.

- [ ] **Step 2: Deteksi duplikat di LOCAL sebelum push (WAJIB, lindungi data asli)**

Run: `cd backend && npx prisma studio` ATAU query manual:
```sql
SELECT date, COUNT(*) c FROM settlements GROUP BY date HAVING c > 1;
SELECT COUNT(*) FROM shifts WHERE closed_at IS NULL;   -- shift open tersisa
```
Expected: settlement duplikat = 0 (kalau >0, audit & merge manual dulu). Shift open: kalau >1, tutup yang basi manual sebelum Step 4.

- [ ] **Step 3: Backfill `activeMarker` untuk shift open di LOCAL** (sebelum unique di-enforce penuh)

Script sementara — `backend/scripts/backfill-active-marker.ts`:
```ts
import 'dotenv/config';
import { prisma } from '../src/config/prisma';
(async () => {
  const open = await prisma.shift.findMany({ where: { closedAt: null } });
  if (open.length > 1) throw new Error(`Ada ${open.length} shift open — resolve manual dulu`);
  if (open.length === 1) {
    await prisma.shift.update({ where: { id: open[0].id }, data: { activeMarker: 1 } });
    console.log(`activeMarker=1 di shift #${open[0].id}`);
  } else console.log('Tidak ada shift open.');
  await prisma.$disconnect();
})();
```

- [ ] **Step 4: Push ke LOCAL (data asli)**

Run: `cd backend && npx prisma db push` (env `.env` default).
Expected: sync sukses, NOL baris hilang, tidak ada `--accept-data-loss`. Lalu `tsx scripts/backfill-active-marker.ts`.

- [ ] **Step 5: Commit** (script backfill)

```bash
git add backend/scripts/backfill-active-marker.ts
git commit -m "chore(shifts): backfill activeMarker for existing open shift (non-destructive)"
```

---

## Phase 1 — openShift: window + single-active + reopen + P2002

### Task 1.1: `settings.service.ts` expose window sebagai `ShiftWindowSettings`

**Files:** Modify `backend/src/modules/settings/settings.service.ts`, `settings.schema.ts`

- [ ] **Step 1: Tambah field ke `SettingView` + `toView`**

```ts
// settings.service.ts — SettingView tambah:
export interface SettingView {
  taxEnabled: boolean;
  taxRate: number;
  timezone: string;
  shiftPagiStart: string;
  shiftChangeover: string;
  shiftMalamEnd: string;
  updatedAt: string;
  updatedById: number | null;
}
// toView tambahkan 4 field dari row (s.timezone, s.shiftPagiStart, dst).
// getSettings defensive-create tambahkan default 4 field (sesuai @default schema).
```

- [ ] **Step 2: Helper `getShiftWindow()` (parse ke menit)**

```ts
import { parseHHMM, type ShiftWindowSettings } from '../shifts/shift-time';
export async function getShiftWindow(): Promise<ShiftWindowSettings> {
  const s = await getSettings();
  return {
    timezone: s.timezone,
    pagiStart: parseHHMM(s.shiftPagiStart),
    changeover: parseHHMM(s.shiftChangeover),
    malamEnd: parseHHMM(s.shiftMalamEnd),
  };
}
```

- [ ] **Step 3: Zod update `updateSettingsSchema`** (validasi HH:MM + kontiguitas)

```ts
// settings.schema.ts
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format jam harus HH:MM');
export const updateSettingsSchema = z.object({
  taxEnabled: z.boolean().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  timezone: z.string().min(1).optional(),
  shiftPagiStart: hhmm.optional(),
  shiftChangeover: hhmm.optional(),
  shiftMalamEnd: hhmm.optional(),
}).refine((d) => Object.values(d).some((v) => v !== undefined), {
  message: 'Minimal satu field harus diisi untuk update',
}).refine(
  (d) => {
    if (d.shiftPagiStart && d.shiftChangeover) {
      const toMin = (s: string) => Number(s.slice(0,2))*60 + Number(s.slice(3));
      return toMin(d.shiftPagiStart) < toMin(d.shiftChangeover);
    }
    return true;
  },
  { message: 'Jam mulai pagi harus sebelum jam pergantian' },
);
```

- [ ] **Step 4: Tsc check**

Run: `cd backend && npx tsc --noEmit`
Expected: 0 error.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/settings/
git commit -m "feat(settings): expose shift window + getShiftWindow() + HH:MM validation"
```

---

### Task 1.2: Rewrite `openShift` pakai rules + activeMarker + catch P2002

**Files:** Modify `backend/src/modules/shifts/shifts.service.ts`

- [ ] **Step 1: Rewrite fungsi `openShift`**

```ts
import { Prisma, ShiftType } from '@prisma/client';
import { canOpenShift } from './shift-rules';
import { restoNow, businessDateFor } from './shift-time';
import { getShiftWindow } from '../settings/settings.service';

export async function openShift(cashierId: number, input: OpenShiftInput): Promise<ShiftView> {
  const window = await getShiftWindow();
  const now = new Date();
  const { minutesOfDay } = restoNow(window.timezone, now);
  const businessDate = businessDateFor(window, now);

  const [openCount, pagiToday] = await Promise.all([
    prisma.shift.count({ where: { activeMarker: 1 } }),
    prisma.shift.count({ where: { date: businessDate, type: ShiftType.pagi } }),
  ]);

  const check = canOpenShift({
    type: input.type as 'pagi' | 'malam',
    nowMinutes: minutesOfDay,
    settings: window,
    hasOpenShift: openCount > 0,
    pagiOpenedToday: pagiToday > 0,
  });
  if (!check.ok) {
    if (check.reason === 'single_active') {
      const open = await prisma.shift.findFirst({ where: { activeMarker: 1 }, include: { cashier: { select: { name: true } } } });
      throw new AppError(`Masih ada shift ${open?.type ?? ''} milik ${open?.cashier.name ?? 'kasir lain'} yang open — tutup dulu`, 409);
    }
    throw new AppError('Di luar jam operasional untuk membuka shift ini', 400);
  }

  try {
    const created = await prisma.shift.create({
      data: {
        date: businessDate,
        cashierId,
        type: input.type,
        openingCash: new Prisma.Decimal(input.openingCash),
        activeMarker: 1,
      },
      include: { cashier: true },
    });
    return toShiftView(created);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const open = await prisma.shift.findFirst({ where: { activeMarker: 1 }, include: { cashier: { select: { name: true } } } });
      throw new AppError(`Masih ada shift ${open?.type ?? ''} milik ${open?.cashier.name ?? 'kasir lain'} yang open — tutup dulu`, 409);
    }
    throw e;
  }
}
```

- [ ] **Step 2: Update `toShiftView`** untuk tetap mengembalikan field yang sama (tidak perlu expose activeMarker ke API). Pastikan `ShiftView` tidak berubah shape-nya.

- [ ] **Step 3: Tsc check**

Run: `cd backend && npx tsc --noEmit`
Expected: 0 error.

- [ ] **Step 4: Smoke (DB test) — buat `scripts/smoke-shift.ts`** (lihat Task 8.1 untuk isi lengkap) lalu jalankan skenario open:
  - set window via AppSetting; buka pagi jam dalam window → 201; buka kedua (single-active) → 409; tutup; reopen pagi dalam window → 201; buka pagi jam malam → 400.

Run: `$env:DATABASE_URL="...pos_restaurant_test"; tsx scripts/smoke-shift.ts open`
Expected: semua assert PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/shifts/shifts.service.ts
git commit -m "feat(shifts): openShift window-validated + single-active marker + P2002→409"
```

---

### Task 1.3: `closeShift(mode)` set activeMarker NULL + handover auth

**Files:** Modify `shifts.service.ts`, `shifts.schema.ts`, `shifts.controller.ts`, `shifts.routes.ts`

- [ ] **Step 1: Rewrite `closeShift`** (terima `mode` + open-tx guard untuk final)

```ts
import { TransactionStatus } from '@prisma/client';

export type CloseMode = 'final' | 'handover';

export async function closeShift(
  shiftId: number, byUserId: number, byRole: UserRole, mode: CloseMode = 'final',
): Promise<ShiftView> {
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift) throw notFound('Shift');
  if (shift.closedAt) throw new AppError('Shift sudah ditutup sebelumnya', 400);

  // Authz: owner boleh tutup siapa pun; kasir tutup miliknya sendiri.
  // Handover: izinkan kasir lain menutup (serah-terima), tapi tetap harus authenticated cashier/owner (route guard).
  if (mode === 'final' && byRole !== UserRole.owner && shift.cashierId !== byUserId) {
    throw forbidden('Hanya kasir pemilik shift yang boleh menutup');
  }

  if (mode === 'final') {
    const openCount = await prisma.transaction.count({
      where: { status: TransactionStatus.open, mergedIntoId: null },
    });
    if (openCount > 0) {
      const err = new AppError('Ada pesanan belum dibayar — selesaikan dulu sebelum tutup', 409);
      (err as any).openOrders = await getOpenOrdersForClose();
      throw err;
    }
  }

  const updated = await prisma.shift.update({
    where: { id: shiftId },
    data: { closedAt: new Date(), activeMarker: null },
    include: { cashier: true },
  });
  return toShiftView(updated);
}
```

- [ ] **Step 2: Tambah `getOpenOrdersForClose()`** (grup per meja + takeaway)

```ts
export interface OpenOrdersGroup {
  groupKey: string;          // "meja-3" | "takeaway"
  label: string;             // "Meja 3" | "Takeaway"
  tableNumber: number | null;
  txIds: number[];
}
export async function getOpenOrdersForClose(): Promise<OpenOrdersGroup[]> {
  const rows = await prisma.transaction.findMany({
    where: { status: TransactionStatus.open, mergedIntoId: null },
    select: { id: true, tableNumber: true, orderType: true },
    orderBy: [{ tableNumber: 'asc' }, { id: 'asc' }],
  });
  const map = new Map<string, OpenOrdersGroup>();
  for (const r of rows) {
    const key = r.tableNumber != null ? `meja-${r.tableNumber}` : 'takeaway';
    const label = r.tableNumber != null ? `Meja ${r.tableNumber}` : 'Takeaway';
    if (!map.has(key)) map.set(key, { groupKey: key, label, tableNumber: r.tableNumber, txIds: [] });
    map.get(key)!.txIds.push(r.id);
  }
  return [...map.values()];
}
```

- [ ] **Step 3: Schema + controller terima `mode`**

```ts
// shifts.schema.ts
export const closeShiftSchema = z.object({
  mode: z.enum(['final', 'handover']).default('final'),
});
// shifts.controller.ts handleClose:
const { mode } = closeShiftSchema.parse(req.body ?? {});
const shift = await shiftsService.closeShift(id, req.user.id, req.user.role, mode);
```

- [ ] **Step 4: `errorHandler` ekspos `openOrders`** — di `utils/errors` atau middleware error, kalau `err.openOrders` ada, sertakan di body `data.openOrders`. (Cek `errorHandler` saat ini; tambahkan passthrough field.)

- [ ] **Step 5: Tsc + smoke**

Run: `npx tsc --noEmit` lalu `tsx scripts/smoke-shift.ts close` (DB test): final dengan tx open → 409 + openOrders ter-grup; handover dengan tx open → sukses (carry); final tanpa tx open → sukses + activeMarker NULL.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/shifts/
git commit -m "feat(shifts): closeShift two-mode (final blocks open tx + 409 grouped list, handover carries)"
```

---

### Task 1.4: `getActiveShifts` tetap, tambah pakai activeMarker

**Files:** Modify `shifts.service.ts`

- [ ] **Step 1:** Ganti query `getActiveShifts` agar berbasis `activeMarker: 1` (ekuivalen `closedAt: null` tapi konsisten dgn guard):

```ts
export async function getActiveShifts(): Promise<ShiftView[]> {
  const shifts = await prisma.shift.findMany({
    where: { activeMarker: 1 },
    orderBy: { createdAt: 'desc' },
    include: { cashier: true },
  });
  return shifts.map(toShiftView);
}
```

- [ ] **Step 2: Tsc check** — Run `npx tsc --noEmit` → 0 error.
- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/shifts/shifts.service.ts
git commit -m "refactor(shifts): getActiveShifts via activeMarker"
```

---

## Phase 2 — resolveActiveShift + re-stamp atomic + merge + void

### Task 2.1: Simplifikasi `resolveActiveShift`

**Files:** Modify `transactions.service.ts:406-434`

- [ ] **Step 1: Ganti body `resolveActiveShift`**

```ts
export async function resolveActiveShift(context: string = 'order baru'): Promise<Shift> {
  const active = await prisma.shift.findMany({ where: { activeMarker: 1 } });
  if (active.length === 0) {
    throw new AppError(`Belum ada shift kasir aktif. Buka shift dulu sebelum ${context} bisa diproses.`, 409);
  }
  if (active.length === 1) return active[0]!;
  // Defensive: activeMarker unique seharusnya mencegah ini.
  throw new AppError(`Anomali: ${active.length} shift open bersamaan. Hubungi owner.`, 409);
}
```

- [ ] **Step 2: Hapus import `ShiftType` bila tak terpakai lagi** (getHours tiebreaker hilang). Tsc check.

Run: `npx tsc --noEmit` → 0 error.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/transactions/transactions.service.ts
git commit -m "refactor(tx): resolveActiveShift single-active (drop getHours tiebreaker)"
```

---

### Task 2.2: `addPayment` atomic re-stamp + idempotent finalize

**Files:** Modify `transactions.service.ts:521-724`

- [ ] **Step 1:** Pindahkan finalize ke dalam `$transaction` dgn lock + idempotent. Ganti blok finalize (`if (newSum.greaterThanOrEqualTo(effectiveTotal))`) jadi:

```ts
await prisma.$transaction(async (tx) => {
  // Lock baris parent (cegah double-finalize + race dgn close)
  await tx.$queryRaw`SELECT id FROM transactions WHERE id = ${transactionId} FOR UPDATE`;

  if (isFirstSlice) {
    await tx.transaction.update({
      where: { id: transactionId },
      data: { discountAmount: effectiveDiscount, taxAmount: effectiveTax, total: effectiveTotal },
    });
  }
  await tx.transactionPayment.create({
    data: { transactionId, method: input.method, bank: input.bank ?? null, amount, recordedById: userId },
  });

  const newSum = sumExistingPayments.add(amount);
  if (newSum.greaterThanOrEqualTo(effectiveTotal)) {
    // Re-stamp ke shift open SAAT INI (atribusi by payment). Lock shift.
    const shift = await resolveActiveShift('pembayaran'); // throw 409 kalau 0 shift
    // Idempotent finalize: hanya jalan kalau masih open.
    const flipped = await tx.transaction.updateMany({
      where: { id: transactionId, status: TransactionStatus.open },
      data: { status: TransactionStatus.paid, paidAt: new Date(), shiftId: shift.id },
    });
    if (flipped.count === 1) {
      await tx.transaction.updateMany({
        where: { mergedIntoId: transactionId, status: TransactionStatus.open },
        data: { status: TransactionStatus.paid, discountAmount: new Prisma.Decimal(0), taxAmount: new Prisma.Decimal(0), total: new Prisma.Decimal(0), paidAt: new Date() },
      });
    }
  }
});
```

> Catatan: `resolveActiveShift` dipanggil di dalam tx → kalau 0 shift open saat bayar, throw 409 dan tx rollback (slice tidak tersimpan). Sesuai spec §7.3.

- [ ] **Step 2:** Hapus blok `$transaction` lama yang men-double (pastikan hanya satu blok finalize). Tsc check.

Run: `npx tsc --noEmit` → 0 error.

- [ ] **Step 3: Smoke (DB test)** — `tsx scripts/smoke-shift.ts restamp`: order dibuat saat shift A open; tutup A (handover) buka B; bayar → Tx.shiftId == B. Plus double-pay guard: dua addPayment cepat → total payments == total (tidak overpay).
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/transactions/transactions.service.ts
git commit -m "feat(tx): atomic re-stamp shiftId at payment + idempotent finalize + shift lock"
```

---

### Task 2.3: Simplifikasi `mergeBills` (drop cross-shift migration)

**Files:** Modify `transactions.service.ts:1081-1134`

- [ ] **Step 1:** Hapus blok `hasCrossShift` / `migrateTargetTo` / `resolveActiveShift` di `mergeBills`; sisakan hanya set `mergedIntoId`:

```ts
await prisma.transaction.updateMany({
  where: { id: { in: input.sourceIds } },
  data: { mergedIntoId: target.id },
});
return getTransactionById(target.id);
```
Tambahkan komentar invariant: atribusi = `parent.shiftId` saja (di-set saat bayar); source di-exclude via `mergedIntoId`.

- [ ] **Step 2: Tsc check** → 0 error.
- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/transactions/transactions.service.ts
git commit -m "refactor(tx): mergeBills no longer migrates shiftId (re-stamp handles attribution)"
```

---

### Task 2.4: `voidTransaction` guard — block kalau business day sudah settled

**Files:** Modify `transactions.service.ts:765-818`

- [ ] **Step 1:** Tambah guard di awal `voidTransaction` (setelah ambil `existing` + relasi shift):

```ts
const existing = await prisma.transaction.findUnique({
  where: { id: transactionId },
  include: { items: { include: { menu: true } }, shift: { select: { date: true } } },
});
if (!existing) throw notFound('Transaction');
if (existing.status === TransactionStatus.void) throw new AppError('Transaksi sudah void sebelumnya', 400);

// REV 2.7 (D13): hari yang sudah di-settle = immutable. Tidak ada refund.
const settled = await prisma.settlement.findFirst({ where: { date: existing.shift.date } });
if (settled) {
  throw new AppError('Business day transaksi ini sudah di-settle — tidak bisa diubah (refund di luar lingkup sistem)', 409);
}
```

- [ ] **Step 2: Tsc check** → 0 error.
- [ ] **Step 3: Smoke (DB test)** — void tx hari belum settle → sukses; settle hari itu; void tx lain hari itu → 409.
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/transactions/transactions.service.ts
git commit -m "feat(tx): block void on already-settled business day (refund out of scope)"
```

---

## Phase 3 — Settlement whole-business-day

### Task 3.1: `computeSystemTotals` + `computeBankBreakdown` by businessDate

**Files:** Modify `settlements.service.ts:105-151`

- [ ] **Step 1:** Ubah dua fungsi dari `shiftId` ke `businessDate: Date` (filter via relasi `transaction.shift.date`):

```ts
async function computeSystemTotals(businessDate: Date): Promise<SystemTotalRow[]> {
  const grouped = await prisma.transactionPayment.groupBy({
    by: ['method'],
    where: { transaction: { shift: { date: businessDate }, status: TransactionStatus.paid, mergedIntoId: null } },
    _sum: { amount: true },
  });
  return grouped.map((g) => ({ methodCode: g.method, total: g._sum.amount?.toNumber() ?? 0 }));
}

async function computeBankBreakdown(businessDate: Date): Promise<BankBreakdownEntry[]> {
  const rows = await prisma.transactionPayment.groupBy({
    by: ['method', 'bank'],
    where: { transaction: { shift: { date: businessDate }, status: TransactionStatus.paid, mergedIntoId: null }, bank: { not: null } },
    _sum: { amount: true },
  });
  return rows.filter((r) => r.bank).map((r) => ({ method: r.method, bank: r.bank!, total: r._sum.amount?.toNumber() ?? 0 }))
    .sort((a, b) => a.method.localeCompare(b.method) || a.bank.localeCompare(b.bank));
}
```

- [ ] **Step 2:** Update SEMUA 5 call-site agar lewatkan `settlement.date` / `shift.date` (businessDate), bukan `shiftId`:
  - `previewSettlement` → `computeSystemTotals(shift.date)`, `computeBankBreakdown(shift.date)`.
  - `createSettlement` → `computeSystemTotals(shift.date)`, `computeBankBreakdown(shift.date)`.
  - `getSettlementById` → `computeBankBreakdown(s.date)`.
  - `listSettlements` → `computeBankBreakdown(s.date)`.
  - `reviewSettlement` → `computeBankBreakdown(updated.date)`.

- [ ] **Step 3: Tsc check** → 0 error.
- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/settlements/settlements.service.ts
git commit -m "feat(settlement): system totals + bank breakdown scoped to whole business day"
```

---

### Task 3.2: Re-key create/preview ke business date + unique(date) guard + permission

**Files:** Modify `settlements.service.ts`, `settlements.schema.ts`, controller

- [ ] **Step 1:** `createSettlement` — ganti dedupe + permission:

```ts
// Dedupe by business day (bukan shiftId):
const existing = await prisma.settlement.findFirst({ where: { date: shift.date } });
if (existing) throw new AppError(`Settlement untuk business day ${shift.date.toISOString().slice(0,10)} sudah ada (id=${existing.id})`, 409);

// Permission: penutup shift TERAKHIR business day itu, atau owner.
if (userRole === UserRole.cashier) {
  const shiftsThatDay = await prisma.shift.findMany({
    where: { date: shift.date }, orderBy: [{ closedAt: 'desc' }, { createdAt: 'desc' }],
  });
  const closer = shiftsThatDay.find((s) => s.closedAt) ?? shiftsThatDay[0];
  if (!closer || closer.cashierId !== userId) {
    throw forbidden('Hanya kasir penutup shift terakhir hari itu (atau owner) yang boleh settle');
  }
}
// HAPUS cek lama: shift.type === malam.
```

- [ ] **Step 2:** `previewSettlement(businessDate: Date)` — terima tanggal, bukan shiftId. Resolve shift penutup untuk metadata (cashierName/closedAt) via `findFirst({where:{date}, orderBy:[{closedAt:'desc'}]})`. `existingSettlementId` via `findFirst({where:{date}})`.

- [ ] **Step 3:** Schema + controller: `previewSettlement` & `createSettlement` terima `date` (YYYY-MM-DD) bukan `shiftId`. (Frontend plan menyesuaikan; sementara controller derive `date` dari `shiftId` lama BILA masih dikirim — atau langsung pakai `date`.) Definisikan input baru:

```ts
// settlements.schema.ts
export const createSettlementSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  counts: z.record(z.string(), z.number().nonnegative()),
});
```

- [ ] **Step 4:** Tsc + smoke (DB test) `scripts/smoke-settlement.ts`: hari 2-shift (pagi+malam), pay mixed, settle whole-day sekali → sukses; settle kedua untuk date sama → 409; lone-pagi closer settle → sukses (bukan 403).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/settlements/
git commit -m "feat(settlement): per-business-day keying + unique(date) guard + closer/owner permission"
```

---

### Task 3.3: Float baseline di preview (Σ openingCash hari itu)

**Files:** Modify `settlements.service.ts` (`SettlementPreview` + `previewSettlement`)

- [ ] **Step 1:** Tambah `expectedCashBaseline` ke `SettlementPreview`:

```ts
// tipe: tambahkan
openingCashTotal: number; // Σ openingCash semua shift business day itu

// previewSettlement: hitung
const shiftsThatDay = await prisma.shift.findMany({ where: { date: businessDate } });
const openingCashTotal = shiftsThatDay.reduce((s, sh) => s + sh.openingCash.toNumber(), 0);
// sertakan di return.
```
> Konvensi: Σ semua openingCash = total float hari itu (handover = nambah float). Konfirmasi user saat review frontend.

- [ ] **Step 2: Tsc** → 0 error. **Step 3: Commit**

```bash
git add backend/src/modules/settlements/settlements.service.ts
git commit -m "feat(settlement): expose opening-cash baseline (sum of day's floats) in preview"
```

---

## Phase 4 — Dashboard atribusi by shift.date

### Task 4.1: Ganti filter `paidAt` → `shift.date` + TZ-aware date

**Files:** Modify `dashboard.service.ts`

- [ ] **Step 1:** Owner report `txWhere` (line ~300) — atribusi via relasi shift:

```ts
const txWhere: Prisma.TransactionWhereInput = {
  status: TransactionStatus.paid,
  shift: { date: { gte: period.fromDate, lt: period.toDateExclusive } },
};
```

- [ ] **Step 2:** Cashier dashboard (line ~373) — revenue today via shift.date; openTx today via shift.date:

```ts
revenueByMethod({ status: TransactionStatus.paid, shift: { date: { gte: today, lt: tomorrow } } }),
prisma.transaction.count({ where: { status: TransactionStatus.open, mergedIntoId: null, shift: { date: { gte: today, lt: tomorrow } } } }),
```

- [ ] **Step 3:** Ganti `todayDateOnly()`/`resolvePeriod` agar pakai `businessDateFor`/`restoNow` (TZ-aware) dari `shift-time.ts` + `getShiftWindow()` — minimal `todayDateOnly()` jadi `businessDateFor(window, now)`. (Konsistensi business-day.)

- [ ] **Step 4: Tsc + smoke** — order dibuat & dibayar lewat tengah malam → masuk business day yang benar di owner report (sama dengan settlement).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/dashboard/dashboard.service.ts
git commit -m "feat(dashboard): attribute revenue by shift.date (business day), TZ-aware"
```

---

## Phase 5 — Integrasi & verifikasi penuh (DB test)

### Task 5.1: Smoke script lengkap `smoke-shift.ts` + `smoke-settlement.ts`

**Files:** Create `backend/scripts/smoke-shift.ts`, `backend/scripts/smoke-settlement.ts`

- [ ] **Step 1: Guard DB test di tiap script** (lindungi data asli)

```ts
import 'dotenv/config';
if (!/_test/.test(process.env.DATABASE_URL ?? '')) {
  throw new Error('REFUSE: smoke harus pakai DB *_test, bukan DB asli. Set DATABASE_URL ke pos_restaurant_test.');
}
import { prisma } from '../src/config/prisma';
// ... helper assert(cond, msg)
```

- [ ] **Step 2: Skenario `smoke-shift.ts`** (tulis assert untuk tiap baris):
  1. set window (AppSetting) pagi 07:00 / changeover 18:00 / malam 23:00, tz Asia/Jakarta.
  2. buka pagi (now di-mock via param? gunakan AppSetting jam lebar supaya `restoNow` real lolos) → 201.
  3. buka kedua → 409 single_active.
  4. tutup final (no tx) → activeMarker NULL.
  5. reopen pagi → 201.
  6. handover: buat tx open → closeShift handover → buka malam → bayar tx → tx.shiftId == malam.
  7. final close dgn tx open → 409 + openOrders ter-grup (cek bucket meja + takeaway).

- [ ] **Step 3: Skenario `smoke-settlement.ts`**: hari 2-shift, pay mixed (cash/edc-bank/qris), settle whole-day → totals = gabungan; bank breakdown sum == method total; settle kedua date sama → 409; lone-pagi closer settle → 201.

- [ ] **Step 4: Jalankan keduanya**

Run: `$env:DATABASE_URL="...pos_restaurant_test"; cd backend; tsx scripts/smoke-shift.ts; tsx scripts/smoke-settlement.ts`
Expected: semua assert "PASS"; exit 0.

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/smoke-shift.ts backend/scripts/smoke-settlement.ts
git commit -m "test(shifts): integration smoke scripts (DB test) for open/close/reopen/handover/restamp/settlement"
```

---

### Task 5.2: Verifikasi akhir backend

- [ ] **Step 1:** Run unit: `cd backend && npm run test` → semua `*.test.ts` PASS.
- [ ] **Step 2:** Run `npx tsc --noEmit` → 0 error.
- [ ] **Step 3:** Run `npm run lint` → 0 error.
- [ ] **Step 4:** Push schema aditif ke LOCAL (Task 0.5 sudah; pastikan re-run kalau schema berubah lagi) — `npx prisma db push` (env `.env`), NOL data-loss.
- [ ] **Step 5: Commit** apa pun yang tersisa.

---

## Phase D — PROD migration runbook (DILAKUKAN TERPISAH, setelah frontend + e2e local OK)

> Checklist ini BUKAN TDD — dijalankan manual saat deploy. Lihat spec §12.

- [ ] `mysqldump` backup prod (`shifts`, `settlements`, `app_settings`, `transactions`) via SSH tunnel.
- [ ] Deteksi prod: `SELECT date,type,COUNT(*) FROM shifts GROUP BY date,type HAVING COUNT(*)>1` (info), `SELECT date,COUNT(*) FROM settlements GROUP BY date HAVING COUNT(*)>1`, `SELECT COUNT(*) FROM shifts WHERE closed_at IS NULL`.
- [ ] Resolve duplikat settlement.date & multiple-open-shift manual bila ada.
- [ ] `git pull` + `npx prisma db push` (aditif, TANPA `--force-reset`) di prod.
- [ ] `tsx scripts/backfill-active-marker.ts` di prod (set activeMarker=1 untuk shift open tunggal).
- [ ] Set window awal via tab owner (atau langsung AppSetting) sesuai jam resto riil.
- [ ] Smoke ringan di prod (buka/tutup shift dummy di luar jam ramai) lalu hapus.

---

## Self-Review (diisi penulis plan)

**Spec coverage:** §4.1 AppSetting→Task 0.4/1.1; §4.2 activeMarker→0.4/1.2; §5 helper→0.2; §6 open rule→0.3/1.2; §7.1→2.1; §7.3 re-stamp atomic→2.2; §7.4 merge→2.3; §7.5 void→2.4; §8.1 close 2-mode + open list→1.3; §8.2 settlement whole-day/keying/permission/bank/float→3.1/3.2/3.3; §10 dashboard→4.1; §12 migrasi→0.5/Phase D. Frontend (§9) = plan terpisah.

**Catatan untuk eksekutor:** Konfirmasi baris exact `model Settlement` (apakah `@unique` inline atau `@@unique`) sebelum Task 0.4 Step 3. `errorHandler` passthrough `openOrders` (Task 1.3 Step 4) — cek bentuk `utils/response.ts` / error middleware aktual.

---

## Execution Handoff

Backend hijau (unit + smoke + tsc + lint) = fondasi siap. Frontend plan ditulis setelah ini.
