# Kembalian Cash + Struk Baru + Konfirmasi Rincian — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah input "uang diterima" + kembalian untuk pembayaran cash, langkah REVIEW rincian sebelum submit (single & split), dan struk yang ditampilkan otomatis di layar dengan desain klasik-rapi yang dipoles — semua frontend-only.

**Architecture:** `PaymentModal` mendapat state machine 2-langkah (`input` → `review`) sebelum mutate; fase sukses menampilkan `<ReceiptPreview>` (struk di layar) yang me-render `Row[]` dari `buildReceiptRows()` — sumber kebenaran yang sama dipakai PDF, jadi layar dan PDF tak pernah berbeda. "Uang diterima" bersifat ephemeral (tidak dikirim ke backend; nominal pembayaran tetap = total/slice); kembalian = turunan frontend.

**Tech Stack:** React 18 + TypeScript + Vite, Vitest, jsPDF, React Query, design-system primitives (`Dialog`, `Button`, `Input`, `Combobox`, `Badge`).

**Spec:** [docs/superpowers/specs/2026-06-10-cash-change-receipt-payment-confirmation-design.md](../specs/2026-06-10-cash-change-receipt-payment-confirmation-design.md)

---

## File Structure

| File | Tanggung jawab |
|---|---|
| `frontend/src/lib/receipt.ts` | Pure `buildReceiptRows()` + `generateReceiptPdf()`. Tambah `cashReceived?` di opts (kembalian) + poles tipografi PDF. |
| `frontend/src/lib/receipt.test.ts` | Unit test pure `buildReceiptRows` (termasuk kembalian baru). |
| `frontend/src/components/ReceiptPreview.tsx` **(baru)** | Render `Row[]` → kartu struk HTML untuk fase sukses. |
| `frontend/src/components/PaymentModal.tsx` | State machine input→review, input uang diterima + tender cepat, layar REVIEW, layar SUKSES render `ReceiptPreview`. |

**Backend: tidak disentuh.**

Catatan worktree: kerjakan di worktree/branch baru (mis. `feat/cash-change-receipt-confirm`) — dibuat saat eksekusi via skill using-git-worktrees. Commit spec lama (langkah brainstorming) ikut di branch ini.

---

## Task 1: receipt.ts — dukungan `cashReceived` (kembalian) [TDD]

**Files:**
- Modify: `frontend/src/lib/receipt.ts` (`ReceiptOptions`, blok pembayaran di `buildReceiptRows`)
- Test: `frontend/src/lib/receipt.test.ts`

- [ ] **Step 1: Tambah test gagal** — tempel di dalam `describe('buildReceiptRows', ...)` di [receipt.test.ts](../../../frontend/src/lib/receipt.test.ts), sebelum `})` penutup describe:

```typescript
  it('cashReceived: baris Tunai = uang diterima & Kembali = diterima - total', () => {
    const t = tx({
      subtotal: 41800, total: 41800,
      items: [item({ menuName: 'Ayam Bakar', qty: 1, subtotal: 41800 })],
      payments: [{ id: 1, method: 'cash', bank: null, amount: 41800, recordedAt: '', recordedById: 1, recordedByName: 'Jason' }],
    })
    const rows = buildReceiptRows(t, { identity: null, cashReceived: 50000, paymentLabel: () => 'Tunai' })
    expect(lr(rows, 'Tunai')?.r).toBe('50.000')
    expect(lr(rows, 'Kembali')?.r).toBe('8.200')
  })

  it('cashReceived dengan slice non-cash sebelumnya: Kembali atas sisa tunai', () => {
    const t = tx({
      subtotal: 41800, total: 41800,
      items: [item({ menuName: 'Paket', qty: 1, subtotal: 41800 })],
      payments: [
        { id: 1, method: 'qris', bank: null, amount: 21800, recordedAt: '', recordedById: 1, recordedByName: 'Jason' },
        { id: 2, method: 'cash', bank: null, amount: 20000, recordedAt: '', recordedById: 1, recordedByName: 'Jason' },
      ],
    })
    const rows = buildReceiptRows(t, { identity: null, cashReceived: 50000, paymentLabel: (m) => (m === 'cash' ? 'Tunai' : 'QRIS') })
    // sisa tunai = total - nonCash = 41800 - 21800 = 20000; kembali = 50000 - 20000 = 30000
    expect(lr(rows, 'Tunai')?.r).toBe('50.000')
    expect(lr(rows, 'QRIS')?.r).toBe('21.800')
    expect(lr(rows, 'Kembali')?.r).toBe('30.000')
  })
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Run: `npm --prefix frontend test -- receipt`
Expected: FAIL — assertion `Tunai` undefined / `Kembali` salah (opts.cashReceived belum dibaca).

- [ ] **Step 3: Implementasi** — di [receipt.ts](../../../frontend/src/lib/receipt.ts):

(a) Tambah field di `ReceiptOptions` (setelah `paymentLabel?`):

```typescript
  /** REV 2.15: uang tunai diterima (ephemeral, frontend-only). Jika ada → baris
   *  Tunai memakai nilai ini & Kembali = cashReceived − sisa tunai (total − Σ non-cash).
   *  Tidak disertakan saat cetak ulang dari Riwayat → kembalian tak tampil (perilaku lama). */
  cashReceived?: number
```

(b) Ganti blok `--- Pembayaran + kembalian ---` (saat ini receipt.ts:115-122) dengan:

```typescript
  // --- Pembayaran + kembalian ---
  if (opts.cashReceived != null) {
    // REV 2.15: mode at-payment. Tampilkan slice non-cash apa adanya, lalu satu baris
    // Tunai = uang diterima, dan Kembali = diterima − sisa tunai (total − Σ non-cash).
    const nonCash = tx.payments.filter((p) => p.method !== 'cash')
    let sumNonCash = 0
    for (const p of nonCash) {
      sumNonCash += p.amount
      rows.push({ t: 'lr', l: labelOf(p.method) + (p.bank ? ` (${p.bank})` : ''), r: money(p.amount) })
    }
    rows.push({ t: 'lr', l: labelOf('cash'), r: money(opts.cashReceived) })
    const change = opts.cashReceived - (tx.total - sumNonCash)
    if (change > 0) rows.push({ t: 'lr', l: 'Kembali', r: money(change) })
  } else {
    // Perilaku lama (cetak ulang dari Riwayat): kembalian dari payments (praktis 0).
    const paid = tx.payments.reduce((s, p) => s + p.amount, 0)
    for (const p of tx.payments) {
      rows.push({ t: 'lr', l: labelOf(p.method) + (p.bank ? ` (${p.bank})` : ''), r: money(p.amount) })
    }
    const change = paid - tx.total
    if (change > 0) rows.push({ t: 'lr', l: 'Kembali', r: money(change) })
  }
  rows.push({ t: 'sep', c: '=' })
```

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Run: `npm --prefix frontend test -- receipt`
Expected: PASS (semua test buildReceiptRows, termasuk 2 yang baru).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/receipt.ts frontend/src/lib/receipt.test.ts
git commit -m "feat(receipt): dukung cashReceived untuk hitung kembalian di struk"
```

---

## Task 2: `<ReceiptPreview>` — render struk di layar

**Files:**
- Create: `frontend/src/components/ReceiptPreview.tsx`

- [ ] **Step 1: Buat komponen** — render `Row[]` dari `buildReceiptRows` sebagai kartu struk monospace. Tulis file:

```tsx
// REV 2.15: tampilan struk di layar (fase sukses PaymentModal). Sumber data SAMA
// dengan PDF (buildReceiptRows) supaya layar ≡ PDF. Gaya "klasik rapi ramping":
// monospace, garis pemisah, header tengah, TOTAL & KEMBALIAN ditebalkan/dibesarkan.
import { buildReceiptRows, type ReceiptOptions } from '@/lib/receipt'
import type { Transaction } from '@/types'
import { cn } from '@/lib/utils'

const CHARS = 30 // selaras dengan receipt.ts (lebar baris pemisah)

export default function ReceiptPreview({
  tx,
  options,
  className,
}: {
  tx: Transaction
  options: ReceiptOptions
  className?: string
}) {
  const rows = buildReceiptRows(tx, options)
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[300px] rounded-lg border border-neutral-200 bg-white',
        'px-4 py-3 font-mono text-[12px] leading-[1.5] text-neutral-900 shadow-sm',
        className,
      )}
      role="document"
      aria-label={`Struk transaksi #${tx.id}`}
    >
      {rows.map((row, i) => {
        if (row.t === 'sep') {
          return (
            <div key={i} className="my-1 select-none text-neutral-400 overflow-hidden whitespace-nowrap">
              {row.c.repeat(CHARS)}
            </div>
          )
        }
        if (row.t === 'center') {
          return (
            <div
              key={i}
              className={cn('text-center', row.bold && 'font-bold text-[14px]')}
            >
              {row.s}
            </div>
          )
        }
        if (row.t === 'left') {
          return (
            <div key={i} className="whitespace-pre-wrap break-words">
              {row.s}
            </div>
          )
        }
        // row.t === 'lr'
        const emphasize = row.bold || row.l === 'TOTAL' || row.l === 'Kembali'
        return (
          <div
            key={i}
            className={cn(
              'flex items-baseline justify-between gap-3 tabular-nums',
              emphasize && 'font-bold',
              (row.l === 'TOTAL' || row.l === 'Kembali') && 'text-[14px]',
            )}
          >
            <span className="min-w-0 break-words">{row.l}</span>
            <span className="whitespace-nowrap">{row.r}</span>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verifikasi tipe** — `ReceiptOptions` perlu di-export dari receipt.ts (sudah `export interface ReceiptOptions`). Pastikan import resolve.

Run: `npm --prefix frontend exec tsc -- --noEmit -p frontend/tsconfig.app.json`
(atau dari `frontend/`: `npx tsc --noEmit -p tsconfig.app.json`)
Expected: 0 error.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ReceiptPreview.tsx
git commit -m "feat(receipt): komponen ReceiptPreview render struk di layar"
```

---

## Task 3: PaymentModal — langkah REVIEW (single + split) gantikan confirm()

Menambahkan state `step` dan layar REVIEW read-only. Submit nyata pindah ke tombol "Konfirmasi & Bayar" di REVIEW. Belum menyentuh cash (Task 4).

**Files:**
- Modify: `frontend/src/components/PaymentModal.tsx`

- [ ] **Step 1: Tambah state `step`** — setelah baris `const [combineOpen, setCombineOpen] = useState(false)` (sekitar PaymentModal.tsx:184):

```typescript
  // REV 2.15: 2-langkah sebelum submit — 'input' lalu 'review' (rincian read-only).
  const [step, setStep] = useState<'input' | 'review'>('input')
```

- [ ] **Step 2: Reset `step` saat mode berubah / sudah paid** — tambah effect tepat setelah effect sync-mode (setelah PaymentModal.tsx:191):

```typescript
  // Kembali ke input kalau mode berganti (mis. single↔split) supaya tak nyangkut di review.
  useEffect(() => {
    setStep('input')
  }, [mode])
```

- [ ] **Step 3: Pecah handler single jadi validate→review + doSubmit** — ganti seluruh `handleSingleSubmit` (PaymentModal.tsx:337-383) dengan:

```typescript
  // REV 2.15: tombol "Lanjut" di INPUT — validasi lalu pindah ke REVIEW (tidak mutate).
  const handleSingleNext = (e: FormEvent) => {
    e.preventDefault()
    if (singleSubmitDisabled) return
    setStep('review')
  }

  // Submit nyata dari layar REVIEW.
  const doSubmitSingle = () => {
    if (!transaction || isPaid || !selectedMethod) return
    const finalBank = needsBank ? bank.trim() : undefined
    addPayMutation.mutate({
      method: selectedMethod.code,
      bank: finalBank,
      amount: total,
      discountAmount,
      mergeSourceIds: selectedCandidateTxs.map((t) => t.id),
    })
  }
```

- [ ] **Step 4: Pecah handler slice jadi validate→review + doSubmit** — ganti seluruh `handleAddSlice` (PaymentModal.tsx:385-437) dengan:

```typescript
  const handleSliceNext = (e: FormEvent) => {
    e.preventDefault()
    if (sliceSubmitDisabled) return
    setStep('review')
  }

  const doSubmitSlice = () => {
    if (!transaction || isPaid || !selectedMethod) return
    const finalBank = needsBank ? bank.trim() : undefined
    addPayMutation.mutate({
      method: selectedMethod.code,
      bank: finalBank,
      amount,
      discountAmount: isFirstSlice ? discountAmount : undefined,
      mergeSourceIds: isFirstSlice ? selectedCandidateTxs.map((t) => t.id) : undefined,
    })
  }
```

- [ ] **Step 5: Hapus import `useConfirm` yang tak dipakai lagi di submit** — `confirm` masih dipakai? Cek: hanya di handler yang dihapus. Hapus baris `const confirm = useConfirm()` (PaymentModal.tsx:95) dan import `useConfirm` (PaymentModal.tsx:58) JIKA tidak ada pemakaian lain. (Hapus slice via Trash memakai `removePayMutation` langsung, bukan confirm — aman dihapus.)

- [ ] **Step 6: Ganti `<form>` `onSubmit` ke handler "Next"** — single form (PaymentModal.tsx:768) `onSubmit={handleSingleSubmit}` → `onSubmit={handleSingleNext}`; slice form (PaymentModal.tsx:825) `onSubmit={handleAddSlice}` → `onSubmit={handleSliceNext}`.

- [ ] **Step 7: Render layar REVIEW** — bungkus area form (`{!isPaid && (...)}`, PaymentModal.tsx:765-923) supaya hanya tampil saat `step==='input'`, lalu tambah cabang `step==='review'`. Ganti pembuka `{!isPaid && (` menjadi `{!isPaid && step === 'input' && (` dan setelah blok itu tutup, tambahkan:

```tsx
          {!isPaid && step === 'review' && (
            <PaymentReview
              mode={mode}
              items={[...transaction.items, ...mergedFromOpen.flatMap((s) => s.items), ...selectedCandidateTxs.flatMap((s) => s.items)]}
              subtotal={aggregateSubtotal}
              discount={effectiveDiscount}
              base={base}
              tax={tax}
              total={total}
              taxRatePercent={appSettings?.taxEnabled && appSettings.taxChargedToCustomer ? appSettings.taxRate : 0}
              methodLabel={`${selectedMethod?.label ?? ''}${needsBank && bank ? ` · ${bank}` : ''}`}
              sliceAmount={mode === 'split' ? amount : total}
              sisaAfter={mode === 'split' ? Math.max(0, sisa - amount) : 0}
            />
          )}
```

- [ ] **Step 8: Ubah footer** — footer modal (PaymentModal.tsx:630-664) harus kontekstual per `step`. Ganti blok `footer={ mode === 'single' ? (...) : isPaid ? (...) : (...) }` dengan:

```tsx
        footer={
          step === 'review' ? (
            <div className="flex gap-2 w-full">
              <Button variant="secondary" size="lg" onClick={() => setStep('input')} disabled={submitting}>
                ← Ubah
              </Button>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                loading={submitting}
                disabled={submitting}
                onClick={() => (mode === 'single' ? doSubmitSingle() : doSubmitSlice())}
              >
                {submitting ? 'Memproses…' : `Konfirmasi & Bayar · ${formatCurrency(mode === 'single' ? total : amount)}`}
              </Button>
            </div>
          ) : mode === 'single' ? (
            <Button
              variant="primary" size="lg" fullWidth
              form="payment-single-form" type="submit"
              disabled={singleSubmitDisabled}
            >
              {`Lanjut · ${formatCurrency(total)}`}
            </Button>
          ) : (
            <Button
              variant="primary" size="lg" fullWidth
              form="payment-slice-form" type="submit"
              disabled={sliceSubmitDisabled}
            >
              <Plus className="w-5 h-5" />
              Lanjut · {formatCurrency(amount)}
            </Button>
          )
        }
```

- [ ] **Step 9: Tambah komponen `PaymentReview`** — di bagian sub-components (sebelum `function PaymentBreakdown`), tambah. (Reuse `Row` lokal & `formatCurrency`.)

```tsx
function PaymentReview({
  mode,
  items,
  subtotal,
  discount,
  base,
  tax,
  total,
  taxRatePercent,
  methodLabel,
  sliceAmount,
  sisaAfter,
}: {
  mode: Mode
  items: { menuName: string; qty: number; subtotal: number; variantLabel?: string | null }[]
  subtotal: number
  discount: number
  base: number
  tax: number
  total: number
  taxRatePercent: number
  methodLabel: string
  sliceAmount: number
  sisaAfter: number
}) {
  const taxActive = taxRatePercent > 0
  return (
    <div className="space-y-3">
      <p className="text-label text-neutral-700">Periksa rincian sebelum konfirmasi</p>
      <div className="rounded-xl border border-neutral-200 divide-y divide-neutral-100">
        <ul className="p-3 space-y-1.5 max-h-44 overflow-y-auto">
          {items.map((it, i) => (
            <li key={i} className="flex items-baseline justify-between gap-2 text-body-sm tabular-nums">
              <span className="min-w-0 truncate">
                {it.qty}× {it.menuName}
                {it.variantLabel ? <span className="text-neutral-500"> · {it.variantLabel}</span> : null}
              </span>
              <span className="whitespace-nowrap text-neutral-700">{formatCurrency(it.subtotal)}</span>
            </li>
          ))}
        </ul>
        <div className="p-3 space-y-1.5 tabular-nums">
          <Row label="Subtotal" value={formatCurrency(subtotal)} muted />
          {discount > 0 && <Row label="Diskon" value={`− ${formatCurrency(discount)}`} muted />}
          {taxActive && (
            <>
              <Row label="Setelah diskon" value={formatCurrency(base)} muted />
              <Row label={`PB1 ${taxRatePercent}%`} value={formatCurrency(tax)} muted />
            </>
          )}
          <div className="pt-2 mt-1 border-t border-neutral-200">
            <Row label="Total Tagihan" value={formatCurrency(total)} bold />
          </div>
        </div>
        <div className="p-3 space-y-1.5 tabular-nums">
          <Row label="Metode" value={methodLabel} muted />
          {mode === 'split' && (
            <>
              <Row label="Dibayar sekarang" value={formatCurrency(sliceAmount)} bold />
              <Row label={sisaAfter > 0 ? 'Sisa setelah ini' : 'Status'} value={sisaAfter > 0 ? formatCurrency(sisaAfter) : 'Lunas'} muted />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 10: tsc + lint**

Run (dari `frontend/`): `npx tsc --noEmit -p tsconfig.app.json && npm run lint`
Expected: 0 error. (Jika `Mode`/`Row`/`formatCurrency` belum ter-scope, perbaiki import — semuanya sudah ada di file ini.)

- [ ] **Step 11: Commit**

```bash
git add frontend/src/components/PaymentModal.tsx
git commit -m "feat(payment): langkah REVIEW rincian sebelum submit (single+split)"
```

---

## Task 4: PaymentModal — input "Uang Diterima" + tender cepat + kembalian

**Files:**
- Modify: `frontend/src/components/PaymentModal.tsx`

- [ ] **Step 1: State cash** — setelah `const [step, ...]` (dari Task 3):

```typescript
  // REV 2.15: uang tunai diterima (ephemeral). Hanya relevan saat method.code === 'cash'.
  const [cashReceived, setCashReceived] = useState(0)
```

- [ ] **Step 2: Derivasi cash** — setelah `const needsBank = ...` (PaymentModal.tsx:268):

```typescript
  // REV 2.15: kembalian hanya untuk uang fisik. Diskriminator: code === 'cash' (seed stabil).
  const isCashMethod = selectedMethod?.code === 'cash'
  // Nominal yang sedang ditagih di langkah ini (single=total, split=slice).
  const amountToCharge = mode === 'single' ? total : amount
  const changeDue = isCashMethod ? Math.max(0, cashReceived - amountToCharge) : 0
  const cashShort = isCashMethod && cashReceived < amountToCharge
```

- [ ] **Step 3: Reset cashReceived saat metode/charge berubah** — tambah effect setelah effect reset step (Task 3 Step 2):

```typescript
  // Reset uang diterima kalau pindah dari/ke cash atau nominal tagihan berubah.
  useEffect(() => {
    setCashReceived(0)
  }, [methodCode, amountToCharge])
```

- [ ] **Step 4: Sertakan `cashShort` di kondisi disable** — tambahkan `|| cashShort` ke `singleSubmitDisabled` (PaymentModal.tsx:478) dan `sliceSubmitDisabled` (PaymentModal.tsx:486):

```typescript
  const singleSubmitDisabled =
    submitting || firstSliceDataStale || !selectedMethod ||
    (needsBank && !bank.trim()) || discountAmount > aggregateSubtotal ||
    aggregateSubtotal <= 0 || cashShort

  const sliceSubmitDisabled =
    submitting || firstSliceDataStale || !selectedMethod ||
    amount <= 0 || amount > sisa || (needsBank && !bank.trim()) ||
    (isFirstSlice && discountAmount > aggregateSubtotal) || cashShort
```

- [ ] **Step 5: Komponen `CashTenderInput`** — tambah di sub-components (sebelum `PaymentReview`):

```tsx
function CashTenderInput({
  amountToCharge,
  value,
  onChange,
  shortError,
  changeDue,
}: {
  amountToCharge: number
  value: number
  onChange: (n: number) => void
  shortError: boolean
  changeDue: number
}) {
  // Saran cepat: uang pas + pembulatan ke atas (5k/10k/20k/50k/100k) yang > tagihan.
  const presets = Array.from(
    new Set(
      [amountToCharge, ...[5000, 10000, 20000, 50000, 100000].map((step) => Math.ceil(amountToCharge / step) * step)]
        .filter((v) => v >= amountToCharge),
    ),
  )
    .sort((a, b) => a - b)
    .slice(0, 4)
  return (
    <div className="space-y-2">
      <Input
        label="Uang Diterima"
        type="number"
        inputMode="numeric"
        value={value || ''}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        min={0}
        step={100}
        placeholder="0"
        error={shortError ? `Kurang dari tagihan (${formatCurrency(amountToCharge)})` : undefined}
      />
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={cn(
              'min-h-[36px] px-3 rounded-lg border text-body-sm font-medium tabular-nums transition-colors',
              value === p
                ? 'border-primary-500 bg-primary-50 text-primary-800'
                : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50',
            )}
          >
            {p === amountToCharge ? 'Uang pas' : formatCurrency(p)}
          </button>
        ))}
      </div>
      {changeDue > 0 && (
        <div className="flex items-baseline justify-between rounded-lg bg-success-50 border border-success-200 px-3 py-2">
          <span className="text-body-sm text-success-800">Kembalian</span>
          <span className="text-title font-bold text-success-700 tabular-nums">{formatCurrency(changeDue)}</span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Render `CashTenderInput` di kedua form** — di form single, tepat setelah blok `{needsBank && (...)}` dan sebelum `<Input label="Diskon...">` (PaymentModal.tsx ~794):

```tsx
                  {isCashMethod && (
                    <CashTenderInput
                      amountToCharge={total}
                      value={cashReceived}
                      onChange={setCashReceived}
                      shortError={cashShort}
                      changeDue={changeDue}
                    />
                  )}
```

Di form split, tepat setelah blok nominal (`</div>` penutup nominal, sebelum `<Input label="Diskon..." disabled>`, PaymentModal.tsx ~886):

```tsx
                  {isCashMethod && (
                    <CashTenderInput
                      amountToCharge={amount}
                      value={cashReceived}
                      onChange={setCashReceived}
                      shortError={cashShort}
                      changeDue={changeDue}
                    />
                  )}
```

- [ ] **Step 7: Tampilkan uang diterima + kembalian di REVIEW** — tambah prop ke `PaymentReview` call (Task 3 Step 7), tambahkan:

```tsx
              cashReceived={isCashMethod ? cashReceived : null}
              changeDue={changeDue}
```

dan di definisi `PaymentReview`, tambah ke props type + render di blok metode:

```tsx
  cashReceived,
  changeDue,
```
```tsx
}: {
  ...
  cashReceived: number | null
  changeDue: number
}) {
```
Di dalam blok `<div className="p-3 space-y-1.5 tabular-nums">` (blok metode), setelah baris Metode:
```tsx
          {cashReceived != null && (
            <>
              <Row label="Uang Diterima" value={formatCurrency(cashReceived)} muted />
              <Row label="Kembalian" value={formatCurrency(changeDue)} bold />
            </>
          )}
```

- [ ] **Step 8: tsc + lint**

Run (dari `frontend/`): `npx tsc --noEmit -p tsconfig.app.json && npm run lint`
Expected: 0 error.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/PaymentModal.tsx
git commit -m "feat(payment): input uang diterima + tender cepat + kembalian cash"
```

---

## Task 5: PaymentModal — fase SUKSES tampilkan ReceiptPreview + simpan PDF berkembalian

**Files:**
- Modify: `frontend/src/components/PaymentModal.tsx`

- [ ] **Step 1: Simpan info bayar penutup** — state setelah `cashReceived` (Task 4 Step 1):

```typescript
  // REV 2.15: uang diterima & kembalian dari pembayaran penutup, untuk fase SUKSES + struk.
  const [paidCashReceived, setPaidCashReceived] = useState<number | null>(null)
```

- [ ] **Step 2: Set `paidCashReceived` saat submit cash** — di `doSubmitSingle` dan `doSubmitSlice` (Task 3), tepat sebelum `addPayMutation.mutate({`:

```typescript
    setPaidCashReceived(isCashMethod ? cashReceived : null)
```

- [ ] **Step 3: Import `ReceiptPreview`** — tambah di blok import komponen (dekat `import CombineTableModal`):

```typescript
import ReceiptPreview from './ReceiptPreview'
```

- [ ] **Step 4: Bangun `receiptOptions` reusable** — ganti isi `handlePrintReceipt` (PaymentModal.tsx:453-468) supaya memakai opsi bersama termasuk `cashReceived`:

```typescript
  // REV 2.15: opsi struk bersama (layar + PDF). cashReceived ephemeral dari pembayaran penutup.
  const receiptOptions = useMemo(
    () => ({
      identity: appSettings
        ? {
            restaurantName: appSettings.restaurantName,
            restaurantAddress: appSettings.restaurantAddress,
            openingHours: appSettings.openingHours,
            restaurantPhone: appSettings.restaurantPhone,
            restaurantLogoUrl: appSettings.restaurantLogoUrl,
          }
        : null,
      taxRate: appSettings?.taxRate ?? 10,
      paymentLabel: (code: string) => allMethods.find((m) => m.code === code)?.label ?? code,
      cashReceived: paidCashReceived ?? undefined,
    }),
    [appSettings, allMethods, paidCashReceived],
  )

  const handlePrintReceipt = () => {
    if (!transaction) return
    generateReceiptPdf(transaction, receiptOptions)
  }
```

(`useMemo` sudah diimpor di file. `PublicIdentity` shape sesuai.)

- [ ] **Step 5: Ganti isi fase SUKSES** — pada blok `if (isPaid) { ... }` (PaymentModal.tsx:527-587), ganti `<div className="py-4 text-center space-y-3">...</div>` (children) dengan struk + ringkasan:

```tsx
        <div className="py-2 space-y-3">
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-12 h-12 rounded-full bg-success-100 flex items-center justify-center">
              <Check className="w-7 h-7 text-success-600" />
            </div>
            <p className="text-body-sm text-neutral-600">
              Total dibayar{' '}
              <span className="font-bold text-neutral-900 tabular-nums">{formatCurrency(transaction.total)}</span>
              {paidCashReceived != null && paidCashReceived - transaction.total > 0 && (
                <>
                  {' · '}Kembalian{' '}
                  <span className="font-bold text-success-700 tabular-nums">
                    {formatCurrency(paidCashReceived - transaction.total)}
                  </span>
                </>
              )}
            </p>
          </div>
          <ReceiptPreview tx={transaction} options={receiptOptions} />
        </div>
```

(Hapus blok `const change = sumPayments - transaction.total` lama di awal `if (isPaid)` dan baris `{change > 0 && ...}` — diganti oleh `paidCashReceived`.)

- [ ] **Step 6: tsc + lint + build**

Run (dari `frontend/`): `npx tsc --noEmit -p tsconfig.app.json && npm run lint && npm run build`
Expected: 0 error, build sukses.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/PaymentModal.tsx
git commit -m "feat(payment): fase sukses tampilkan struk di layar + simpan PDF berkembalian"
```

---

## Task 6: receipt.ts — poles tipografi PDF (header / TOTAL / KEMBALIAN)

**Files:**
- Modify: `frontend/src/lib/receipt.ts` (`generateReceiptPdf` render loop)

- [ ] **Step 1: Variasikan ukuran font** — di `generateReceiptPdf`, di dalam loop `for (const row of rows)`, ganti cabang `center` & `lr` agar baris penting lebih besar. Ganti blok render (receipt.ts:147-162) dengan:

```typescript
  for (const row of rows) {
    if (row.t === 'sep') {
      doc.setFont('courier', 'normal')
      doc.setFontSize(FONT_PT)
      doc.text(row.c.repeat(CHARS), left, y)
    } else if (row.t === 'center') {
      // Nama resto (center+bold pertama) lebih besar.
      const big = row.bold
      doc.setFont('courier', row.bold ? 'bold' : 'normal')
      doc.setFontSize(big ? FONT_PT + 2 : FONT_PT)
      doc.text(row.s, center, y, { align: 'center' })
      doc.setFontSize(FONT_PT)
    } else if (row.t === 'left') {
      doc.setFont('courier', 'normal')
      doc.setFontSize(FONT_PT)
      doc.text(row.s, left, y)
    } else {
      // lr: TOTAL & Kembali ditonjolkan (lebih besar + bold).
      const emphasize = row.bold || row.l === 'TOTAL' || row.l === 'Kembali'
      doc.setFont('courier', emphasize ? 'bold' : 'normal')
      doc.setFontSize(emphasize ? FONT_PT + 1 : FONT_PT)
      doc.text(row.l, left, y)
      doc.text(row.r, right, y, { align: 'right' })
      doc.setFontSize(FONT_PT)
    }
    y += LINE_H
  }
```

- [ ] **Step 2: Verifikasi test pure tetap lulus** (logika rows tak berubah, hanya rendering)

Run: `npm --prefix frontend test -- receipt`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/receipt.ts
git commit -m "style(receipt): poles tipografi PDF (header & TOTAL/KEMBALIAN menonjol)"
```

---

## Task 7: Verifikasi penuh (verification-before-completion)

**Files:** — (tidak ada perubahan kode; menjalankan bukti)

- [ ] **Step 1: Unit test frontend**

Run (dari `frontend/`): `npm run test`
Expected: semua lulus (termasuk receipt.test.ts baru).

- [ ] **Step 2: Type check + lint + build**

Run (dari `frontend/`): `npx tsc --noEmit -p tsconfig.app.json && npm run lint && npm run build`
Expected: 0 error, build sukses.

- [ ] **Step 3: Manual e2e browser** (`npm run dev`, login kasir, buka kasir bila perlu)

Checklist (semua harus lolos):
1. **Bayar penuh cash, uang lebih:** meja → Bayar → metode Tunai → "Uang Diterima" 50.000 (atau tombol cepat) untuk tagihan < 50.000 → tombol "Lanjut" → REVIEW menampilkan item + Total + Uang Diterima + **Kembalian benar** → "Konfirmasi & Bayar" → fase SUKSES menampilkan **struk di layar** dengan baris Tunai 50.000 & Kembali benar → "Simpan Struk" mengunduh PDF berisi kembalian → "Selesai" menutup.
2. **Uang kurang:** isi Uang Diterima < total → tombol "Lanjut" disabled + pesan kurang.
3. **Non-cash:** pilih QRIS/EDC → tidak ada input Uang Diterima, tidak ada kembalian; REVIEW & struk normal.
4. **Split:** mode Bayar Sebagian → slice 1 non-cash sebagian → slice penutup cash dengan uang lebih → REVIEW slice menampilkan "Dibayar sekarang" + Kembalian → SUKSES struk menampilkan kembalian atas sisa tunai.
5. **Cetak ulang Riwayat:** buka transaksi lama → Simpan Struk → PDF tampil tanpa baris kembalian, tidak error.
6. **Ubah:** di REVIEW klik "← Ubah" → kembali ke INPUT, nilai dipertahankan, bisa edit.

- [ ] **Step 4: Catat hasil verifikasi** (paste output test/build + ringkas hasil e2e) sebelum klaim selesai.

---

## Self-Review (penulis plan)

- **Spec coverage:** Kembalian cash (Task 1,4) ✓; deteksi cash via code==='cash' (Task 4) ✓; struk on-screen otomatis (Task 2,5) ✓; pertahankan Simpan Struk (Task 5) ✓; REVIEW rincian single+split gantikan confirm() (Task 3) ✓; struk klasik dipoles (Task 6) ✓; ephemeral tanpa backend (semua task frontend) ✓; cetak ulang tanpa kembalian (Task 1 cabang else) ✓.
- **Placeholder scan:** tak ada TBD/TODO; semua step berisi kode konkret.
- **Type consistency:** `cashReceived` (opts receipt + state modal), `amountToCharge`/`changeDue`/`cashShort`/`isCashMethod` konsisten lintas Task 4–5; `step` literal `'input'|'review'`; `PaymentReview`/`CashTenderInput`/`ReceiptPreview` props selaras dengan pemanggilan; `Row`/`Mode`/`formatCurrency` sudah ada di PaymentModal.tsx.
