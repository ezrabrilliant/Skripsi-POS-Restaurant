# Settlement Seal (Reopen-After-Settle) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cegah transaksi bocor dari rekonsiliasi dengan menyegel hari yang sudah disetor (tolak buka shift), plus escape hatch owner untuk hapus setoran yang keliru.

**Architecture:** Settlement sudah 1-per-hari-bisnis (`@@unique([date])`) dan void-after-settle sudah diblok. Tambahkan satu guard di `openShift` (tolak bila businessDate sudah ada settlement) supaya setelah setor tidak ada shift baru → tidak ada transaksi baru → `bankBreakdown` live otomatis konsisten dengan `methodCounts` beku. Escape hatch = `DELETE /settlements/:id` owner-only (cascade ke `settlement_method_counts`). Frontend: info "sudah disetor" di CashierDashboard + tombol "Hapus setoran" owner di SettlementPage.

**Tech Stack:** Express 4 + TypeScript + Prisma (MySQL); React 18 + TS + Vite + React Query + Zustand; Vitest + integration smoke (tsx, DB `*_test`).

**Spec:** [docs/superpowers/specs/2026-06-10-settlement-seal-reopen-design.md](../specs/2026-06-10-settlement-seal-reopen-design.md)

---

## File Structure

| File | Responsibility | Aksi |
|---|---|---|
| `backend/src/modules/shifts/shifts.service.ts` | `openShift` seal guard | Modify (`openShift`) |
| `backend/src/modules/settlements/settlements.service.ts` | `deleteSettlement(id)` | Modify (tambah fungsi) |
| `backend/src/modules/settlements/settlements.controller.ts` | `handleDelete` | Modify (tambah handler) |
| `backend/src/modules/settlements/settlements.routes.ts` | `DELETE /:id` owner-only | Modify (tambah route) |
| `backend/scripts/smoke-settlement.ts` | Integration smoke seal + delete | Modify (blok [8] + [9]) |
| `frontend/src/services/settlementService.ts` | `delete(id)` | Modify (tambah method) |
| `frontend/src/pages/SettlementPage.tsx` | Tombol "Hapus setoran" owner + delete mutation | Modify |
| `frontend/src/pages/CashierDashboard.tsx` | Info "sudah disetor" ganti CTA | Modify |

**Prasyarat runtime backend tests:** DB `pos_restaurant_test` ada + ter-seed (users role cashier ≥2, ≥1 menu `stockType=portion` aktif, payment method `cash` & `edc`), dan `backend/.env.test` `DATABASE_URL` menunjuk ke DB itu (smoke menolak jalan kalau nama DB tidak mengandung `_test`). Ini sudah dipakai smoke existing — tidak perlu setup baru bila smoke lain sudah hijau.

---

## Task 1: Backend — seal guard di `openShift`

**Files:**
- Modify: `backend/src/modules/shifts/shifts.service.ts` (fungsi `openShift`, sekitar baris 66-123)
- Test: `backend/scripts/smoke-settlement.ts` (tambah blok [8] sebelum baris summary)

- [ ] **Step 1: Tulis smoke assertion yang gagal (blok [8])**

Di `backend/scripts/smoke-settlement.ts`, sisipkan blok ini **tepat sebelum** baris `console.log(\`\n[smoke-settlement] HASIL...` (saat ini baris 87). Pada titik ini settlement untuk `businessDate` sudah dibuat di blok [4] dan semua shift sudah ditutup, jadi tidak ada `activeMarker` aktif:

```ts
  console.log('\n[8] Seal: buka shift lagi di hari yang sudah disetor → 409:');
  await expectErr(
    () => openShift(jason.id, { type: ShiftType.pagi, openingCash: 0 }),
    409,
    'openShift di businessDate yang sudah disetor',
  );
```

`openShift` & `closeShift` sudah di-import di file ini (baris 6). Tipe `pagi` dipakai agar lolos cek window di waktu uji apa pun (window smoke: changeover 23:58), sehingga 409 yang muncul pasti berasal dari seal, bukan `out_of_window`.

- [ ] **Step 2: Jalankan smoke, verifikasi blok [8] GAGAL**

Run (dari `backend/`):
```bash
npx tsx --env-file=.env.test scripts/smoke-settlement.ts
```
Expected: blok [8] tampil `✗ FAIL: openShift di businessDate yang sudah disetor (harusnya 409)` — karena guard belum ada, `openShift` malah sukses membuat shift (tidak melempar). Exit code 1.

- [ ] **Step 3: Implementasi seal guard di `openShift`**

Di `backend/src/modules/shifts/shifts.service.ts`, ubah blok `Promise.all` di `openShift` (saat ini baris 72-75) untuk menambah lookup settlement, lalu tolak bila ada. Ganti:

```ts
  const [openCount, pagiToday] = await Promise.all([
    prisma.shift.count({ where: { activeMarker: 1 } }),
    prisma.shift.count({ where: { date: businessDate, type: ShiftType.pagi } }),
  ]);
```

menjadi:

```ts
  const [openCount, pagiToday, settledToday] = await Promise.all([
    prisma.shift.count({ where: { activeMarker: 1 } }),
    prisma.shift.count({ where: { date: businessDate, type: ShiftType.pagi } }),
    prisma.settlement.findFirst({ where: { date: businessDate }, select: { id: true } }),
  ]);

  // REV 2.15 seal: hari yang sudah disetor terkunci. Tanpa ini, reopen shift di
  // tanggal yang sama bikin transaksi baru bocor dari rekonsiliasi (settlement
  // @@unique([date]) sudah beku, createSettlement kedua 409). Tolak buka shift.
  if (settledToday) {
    const dateStr = businessDate.toISOString().substring(0, 10);
    throw new AppError(
      `Hari ini (${dateStr}) sudah disetor. Buka shift untuk hari berikutnya, ` +
        `atau minta owner menghapus setoran kalau ada kekeliruan.`,
      409,
    );
  }
```

`AppError` sudah di-import di file ini (baris 16).

- [ ] **Step 4: Jalankan smoke, verifikasi blok [8] PASS**

Run (dari `backend/`):
```bash
npx tsx --env-file=.env.test scripts/smoke-settlement.ts
```
Expected: blok [8] `✓ openShift di businessDate yang sudah disetor → 409 (...)`, dan blok [1]-[7] tetap hijau. Exit 0.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/shifts/shifts.service.ts backend/scripts/smoke-settlement.ts
git commit -m "feat(shifts): seal business day - tolak buka shift kalau hari sudah disetor"
```

---

## Task 2: Backend — `deleteSettlement` (escape hatch owner-only)

**Files:**
- Modify: `backend/src/modules/settlements/settlements.service.ts` (tambah `deleteSettlement` setelah `reviewSettlement`)
- Modify: `backend/src/modules/settlements/settlements.controller.ts` (tambah `handleDelete`)
- Modify: `backend/src/modules/settlements/settlements.routes.ts` (tambah `DELETE /:id`)
- Test: `backend/scripts/smoke-settlement.ts` (tambah blok [9] + import)

- [ ] **Step 1: Tulis smoke assertion yang gagal (blok [9])**

Tambah `deleteSettlement` ke import settlements.service di `smoke-settlement.ts`. Ganti baris (saat ini baris 9):

```ts
import { previewSettlement, createSettlement } from '../src/modules/settlements/settlements.service';
```
menjadi:
```ts
import { previewSettlement, createSettlement, deleteSettlement } from '../src/modules/settlements/settlements.service';
```

Lalu sisipkan blok [9] tepat **setelah** blok [8] (sebelum baris summary):

```ts
  console.log('\n[9] Escape hatch: owner hapus setoran → openShift boleh lagi:');
  await deleteSettlement(st.id);
  const reopened = await openShift(jason.id, { type: ShiftType.pagi, openingCash: 0 });
  ok(reopened.date === businessDate, `setelah hapus setoran, openShift sukses (date ${reopened.date})`);
  const gone = await prisma.settlement.findUnique({ where: { id: st.id } });
  ok(gone === null, 'settlement + method counts terhapus (cascade)');
  await closeShift(reopened.id, jason.id, UserRole.cashier, 'handover'); // cleanup activeMarker
```

(`st` adalah settlement dari blok [4], `ok`/`expectErr` helper sudah ada, `prisma` sudah di-import.)

- [ ] **Step 2: Jalankan smoke, verifikasi blok [9] GAGAL kompilasi/runtime**

Run (dari `backend/`):
```bash
npx tsx --env-file=.env.test scripts/smoke-settlement.ts
```
Expected: error — `deleteSettlement` belum ada di settlements.service (import gagal / `is not a function`). Exit 1.

- [ ] **Step 3: Implementasi `deleteSettlement` di service**

Di `backend/src/modules/settlements/settlements.service.ts`, tambah fungsi ini di akhir file (setelah `reviewSettlement`):

```ts
export async function deleteSettlement(id: number): Promise<{ id: number }> {
  // Escape hatch owner-only (permission di route layer). Menghapus settlement
  // membuka-segel hari itu: openShift boleh lagi + void boleh lagi. Child rows
  // settlement_method_counts ikut terhapus via onDelete: Cascade.
  const existing = await prisma.settlement.findUnique({ where: { id } });
  if (!existing) throw notFound('Settlement');
  await prisma.settlement.delete({ where: { id } });
  return { id };
}
```

`notFound` sudah di-import (baris 24).

- [ ] **Step 4: Tambah `handleDelete` di controller**

Di `backend/src/modules/settlements/settlements.controller.ts`, tambah handler ini setelah `handleReview`:

```ts
export const handleDelete = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const result = await settlementsService.deleteSettlement(id);
  sendSuccess(res, result, 'Setoran dihapus');
});
```

(`asyncHandler`, `sendSuccess`, `parseId`, `settlementsService` sudah di-import.)

- [ ] **Step 5: Tambah route DELETE owner-only**

Di `backend/src/modules/settlements/settlements.routes.ts`, tambah `handleDelete` ke import controller (baris 10-16) dan daftarkan route. Ganti blok import handler:

```ts
import {
  handlePreview,
  handleCreate,
  handleList,
  handleDetail,
  handleReview,
} from './settlements.controller';
```
menjadi:
```ts
import {
  handlePreview,
  handleCreate,
  handleList,
  handleDetail,
  handleReview,
  handleDelete,
} from './settlements.controller';
```

Lalu tambah route setelah baris `router.put('/:id/review', ownerOnly, handleReview);`:

```ts
router.delete('/:id', ownerOnly, handleDelete);
```

- [ ] **Step 6: Jalankan smoke, verifikasi blok [9] PASS**

Run (dari `backend/`):
```bash
npx tsx --env-file=.env.test scripts/smoke-settlement.ts
```
Expected: blok [8] dan [9] hijau (`✓ setelah hapus setoran, openShift sukses`, `✓ settlement + method counts terhapus (cascade)`), seluruh skrip exit 0.

- [ ] **Step 7: Verifikasi tsc backend 0 error**

Run (dari `backend/`):
```bash
npx tsc --noEmit
```
Expected: tidak ada output error.

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/settlements backend/scripts/smoke-settlement.ts
git commit -m "feat(settlements): DELETE /:id owner-only - un-seal hari (escape hatch)"
```

---

## Task 3: Frontend — `settlementService.delete`

**Files:**
- Modify: `frontend/src/services/settlementService.ts`

- [ ] **Step 1: Tambah method `delete`**

Di `frontend/src/services/settlementService.ts`, tambah method setelah `review` (dalam object `settlementService`, sebelum penutup `}`):

```ts
  delete: async (id: number): Promise<{ id: number }> => {
    const res = await api.delete<ApiResponse<{ id: number }>>(`/settlements/${id}`)
    return res.data.data
  },
```

- [ ] **Step 2: Verifikasi tsc frontend 0 error**

Run (dari `frontend/`):
```bash
npx tsc -b --noEmit
```
Expected: tidak ada error.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/settlementService.ts
git commit -m "feat(fe-settlement): settlementService.delete(id)"
```

---

## Task 4: Frontend — tombol "Hapus setoran" owner di SettlementPage

**Files:**
- Modify: `frontend/src/pages/SettlementPage.tsx` (`SettlementFlow` + `SettlementDetailView`)

- [ ] **Step 1: Tambah delete mutation + confirm di `SettlementFlow`**

Di `frontend/src/pages/SettlementPage.tsx`, `SettlementFlow` (mulai baris 139). Pastikan `useConfirm` di-import di atas file (tambah jika belum):

```ts
import { useConfirm } from '@/design-system/hooks/useConfirm'
```

Di dalam `SettlementFlow`, setelah `reviewMutation` (baris 160-167), tambah:

```ts
  const confirm = useConfirm()
  const navigate = useNavigate()

  const deleteMutation = useMutation({
    mutationFn: (id: number) => settlementService.delete(id),
    onSuccess: () => {
      toast.success('Setoran dihapus - hari ini terbuka lagi')
      qc.invalidateQueries({ queryKey: ['settlement'] })
      qc.invalidateQueries({ queryKey: ['settlements'] })
      navigate('/laporan?tab=kasir')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleDelete = async (id: number) => {
    const okToDelete = await confirm({
      title: 'Hapus setoran?',
      description:
        'Hari ini akan terbuka kembali (shift bisa dibuka & transaksi bisa di-void lagi). ' +
        'Pakai ini hanya kalau setoran keliru.',
      confirmText: 'Ya, Hapus Setoran',
      tone: 'danger',
    })
    if (!okToDelete) return
    deleteMutation.mutate(id)
  }
```

`useMutation`, `useQueryClient` (`qc`), `useToast` (`toast`) sudah dipakai di komponen ini. Pastikan `useNavigate` di-import dari `react-router-dom` (tambah ke import yang ada jika belum):

```ts
import { useNavigate } from 'react-router-dom'
```

- [ ] **Step 2: Teruskan props delete ke `SettlementDetailView`**

Ganti blok render `existingSettlement` (baris 173-182) menjadi:

```tsx
  if (existingSettlement) {
    return (
      <SettlementDetailView
        settlement={existingSettlement}
        canReview={user?.role === 'owner' && existingSettlement.status === 'submitted'}
        onReview={() => reviewMutation.mutate(existingSettlement.id)}
        isReviewing={reviewMutation.isPending}
        canDelete={user?.role === 'owner'}
        onDelete={() => handleDelete(existingSettlement.id)}
        isDeleting={deleteMutation.isPending}
      />
    )
  }
```

- [ ] **Step 3: Tambah props + tombol di `SettlementDetailView`**

Di signature `SettlementDetailView` (baris 395-405), tambah tiga prop. Ganti:

```tsx
function SettlementDetailView({
  settlement,
  canReview,
  onReview,
  isReviewing,
}: {
  settlement: Settlement
  canReview: boolean
  onReview: () => void
  isReviewing: boolean
}) {
```
menjadi:
```tsx
function SettlementDetailView({
  settlement,
  canReview,
  onReview,
  isReviewing,
  canDelete,
  onDelete,
  isDeleting,
}: {
  settlement: Settlement
  canReview: boolean
  onReview: () => void
  isReviewing: boolean
  canDelete: boolean
  onDelete: () => void
  isDeleting: boolean
}) {
```

Lalu di akhir komponen, tepat **setelah** blok `{canReview && (...)}` (baris 532-543) dan sebelum penutup `</div>`, tambah:

```tsx
      {canDelete && (
        <Button
          variant="ghost"
          size="sm"
          fullWidth
          onClick={onDelete}
          loading={isDeleting}
          className="!text-danger-700 hover:!bg-danger-50"
        >
          Hapus setoran (buka kembali hari ini)
        </Button>
      )}
```

`Button` sudah di-import (baris 19).

- [ ] **Step 4: Verifikasi tsc + lint frontend**

Run (dari `frontend/`):
```bash
npx tsc -b --noEmit && npm run lint
```
Expected: 0 error, 0 lint warning baru.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/SettlementPage.tsx
git commit -m "feat(fe-settlement): tombol Hapus setoran owner-only di detail settlement"
```

---

## Task 5: Frontend — info "sudah disetor" di CashierDashboard

**Files:**
- Modify: `frontend/src/pages/CashierDashboard.tsx`

- [ ] **Step 1: Query "hari ini sudah disetor" + cabang render**

Di `frontend/src/pages/CashierDashboard.tsx`, setelah query `activeShifts` (baris 53-56), tambah deteksi settled-today. `useQuery` & `settlementService` perlu di-import (cek bagian import; `useQuery` sudah ada baris 14). Tambah import bila belum:

```ts
import { settlementService } from '@/services/settlementService'
```

Tambah query + flag (setelah baris 58, sebelum `overdueShift`):

```ts
  // REV 2.15 seal: kalau hari ini sudah disetor & tak ada shift sendiri, jangan
  // tampilkan CTA "Buka Kasir" (backend akan 409). Catatan: pakai tanggal kalender
  // lokal; pada jendela lewat-tengah-malam sebelum changeover businessDate bisa
  // beda - tapi backend tetap otoritas penyegelan.
  const now = new Date()
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const { data: settledList = [] } = useQuery({
    queryKey: ['settlements', 'byDate', todayLocal],
    queryFn: () => settlementService.list({ date: todayLocal }),
  })
  const todaySettled = settledList.length > 0
```

- [ ] **Step 2: Ganti cabang "kasir pertama, belum ada shift"**

Ganti blok (baris 87-90):

```tsx
        {/* Kasir pertama hari ini, belum ada shift sama sekali */}
        {dashboard && !myActiveShift && otherActiveShifts.length === 0 && (
          <NoActiveShiftCTA onOpen={() => setShowOpenModal(true)} />
        )}
```
menjadi:
```tsx
        {/* Kasir pertama hari ini, belum ada shift sama sekali */}
        {dashboard && !myActiveShift && otherActiveShifts.length === 0 && (
          todaySettled ? <SettledTodayCard /> : <NoActiveShiftCTA onOpen={() => setShowOpenModal(true)} />
        )}
```

- [ ] **Step 3: Tambah komponen `SettledTodayCard`**

Tambah komponen ini setelah `NoActiveShiftCTA` (definisinya mulai baris 132). Pakai ikon `CheckCircle` (sudah dipakai di project; tambah ke import `lucide-react` di file ini bila belum ada):

```tsx
function SettledTodayCard() {
  return (
    <div className="bg-white rounded-2xl p-6 sm:p-8 border border-neutral-200/60 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 bg-success-50 rounded-xl flex items-center justify-center flex-shrink-0">
          <CheckCircle className="w-7 h-7 text-success-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-title sm:text-headline font-semibold mb-1 text-neutral-900">
            Hari ini sudah disetor
          </h2>
          <p className="text-neutral-600 text-body-sm sm:text-body">
            Setoran hari ini sudah final dan terkunci. Buka shift lagi untuk hari berikutnya.
            Kalau setoran keliru, minta owner menghapusnya lewat halaman Laporan.
          </p>
        </div>
      </div>
    </div>
  )
}
```

Pastikan `CheckCircle` ada di import `lucide-react` di file ini (mis. `import { ..., CheckCircle } from 'lucide-react'`).

- [ ] **Step 4: Verifikasi tsc + lint + build frontend**

Run (dari `frontend/`):
```bash
npx tsc -b --noEmit && npm run lint && npm run build
```
Expected: 0 error, `vite build` SUCCESS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/CashierDashboard.tsx
git commit -m "feat(fe-cashier): kartu 'hari ini sudah disetor' ganti CTA buka kasir"
```

---

## Task 6: Verifikasi akhir (verification-before-completion)

**Files:** none (verifikasi).

- [ ] **Step 1: Backend full smoke + tsc**

Run (dari `backend/`):
```bash
npx tsc --noEmit && npx tsx --env-file=.env.test scripts/smoke-settlement.ts && npx tsx --env-file=.env.test scripts/smoke-shift.ts
```
Expected: tsc 0 error; smoke-settlement [1]-[9] semua pass exit 0; smoke-shift tetap hijau (regresi seal tidak memecah skenario buka/tutup biasa karena tidak ada settlement di DB test smoke-shift, atau di-reset di awal skripnya).

- [ ] **Step 2: Backend unit (Vitest)**

Run (dari `backend/`):
```bash
npm test
```
Expected: semua test pass (shift-rules, shift-time, pb1, dll tidak terdampak — guard ada di service, bukan di `canOpenShift`).

- [ ] **Step 3: Frontend tsc + lint + build**

Run (dari `frontend/`):
```bash
npx tsc -b --noEmit && npm run lint && npm run build
```
Expected: 0 error, build SUCCESS.

- [ ] **Step 4: Manual e2e browser (Playwright/manual) — re-enact bug**

Skenario (login kasir Jason → owner):
1. Buka shift → input + bayar 1 transaksi → tutup shift → Setor (submit settlement).
2. Kembali ke beranda kasir → harus muncul kartu **"Hari ini sudah disetor"** (bukan tombol "Buka Kasir").
3. Paksa buka shift via OpenShiftDialog (kalau masih bisa diakses) → harus gagal dengan pesan **409 "Hari ini ... sudah disetor"** (bukan error mentah).
4. Login owner → buka detail setoran di `/laporan?tab=kasir` atau `/settlement` → klik **"Hapus setoran"** → konfirmasi.
5. Login kasir lagi → beranda kembali menampilkan CTA "Buka Kasir" → buka shift → input + bayar transaksi baru → tutup → Setor: angka **lengkap** (transaksi baru ikut terhitung), `bankBreakdown` konsisten dengan tabel method counts.

- [ ] **Step 5: Update dokumentasi state**

Catat ke `CLAUDE.md` (tabel status) + memory `project_session_handoff` + memory baru `project_settlement_seal_rev215` (sesuai Memory Rules). Commit:

```bash
git add CLAUDE.md docs
git commit -m "docs: catat REV 2.15 settlement seal (reopen-after-settle)"
```

---

## Self-Review (penulis plan)

**Spec coverage:**
- §4.1 seal guard → Task 1 ✓
- §4.2 DELETE settlement (service+controller+route) → Task 2 ✓
- §4.3a CashierDashboard info → Task 5 ✓
- §4.3b SettlementPage tombol hapus owner → Task 4 ✓
- §4.4 no migrasi → tidak ada task schema ✓
- §6 verifikasi (smoke, tsc, lint, build, e2e) → Task 6 ✓

**Type consistency:** `deleteSettlement(id): Promise<{ id }>` dipakai konsisten di service/controller/smoke/frontend service. Prop `canDelete/onDelete/isDeleting` konsisten antara `SettlementFlow` (Task 4 Step 2) dan `SettlementDetailView` (Step 3). `settlementService.delete` (Task 3) dipakai di Task 4 Step 1.

**Placeholder scan:** tidak ada TBD/TODO; tiap step ada kode/komando + expected output.

**Catatan implementasi:** `import` baru (`useConfirm`, `useNavigate`, `settlementService`, `CheckCircle`) di-flag eksplisit "tambah jika belum" karena executor mungkin menemukannya sudah ada.
