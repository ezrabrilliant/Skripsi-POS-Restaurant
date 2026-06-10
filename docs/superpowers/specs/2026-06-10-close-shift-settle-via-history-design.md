# Design — Tutup shift terhambat order kemarin: beresin lewat Riwayat

**Date:** 2026-06-10
**Status:** Approved (brainstorming → spec)
**Branch (rencana):** `fix/close-shift-settle-via-history`, dicabang dari `fix/pos-ui-and-receipt-merge` (mewarisi fix POS UI + struk merge), nanti di-merge bareng ke `main`.
**Tema:** menuntaskan catch-22 "shift basi + order belum dibayar" yang sudah ditemukan & ditunda di [2026-06-01-owner-overdue-shift-flow-design.md](2026-06-01-owner-overdue-shift-flow-design.md) (bagian Follow-up), **plus** menutup owner dead-end di Settlement.

## Masalah

**B. Loop kasir (utama — yang dilaporkan):** Kalau sebuah shift dibiarkan terbuka melewati business day-nya (overdue) **dan** masih ada order open (belum dibayar), kasir **tidak bisa menutup shift dan tidak punya jalan keluar dari UI** — terjebak loop:

```
/pos → OverdueShiftGate (blok seluruh POS) → "Tutup & Setor" → /settlement
   → Tutup Shift → 409 "ada pesanan belum dibayar" (CloseShiftBlockedModal)
   → "Buka" per meja → /pos/{meja} → OverdueShiftGate lagi → ...loop
```

Satu-satunya jalan keluar saat ini adalah **void** order itu (membatalkan penjualan) — tidak bisa **menagih** order kemarin yang sah. PaymentModal cuma di-render di dalam POSPage, dan `OverdueShiftGate` memblok seluruh POS, jadi layar bayar untuk order itu tak terjangkau.

**A. Owner dead-end (terkait):** Kalau **owner** yang login saat ada shift basi, `SettlementPage` membaca `listShifts({ cashierId: ownerId })` → kosong (owner tak pernah buka shift) → "Belum ada shift". Owner pun tak bisa menutup shift kasir manapun. (Sebagian sudah dirancang di spec 2026-06-01, belum di-merge — branch `fix/owner-overdue-shift-flow`.)

## Akar masalah

| Gejala | Penyebab | Lokasi |
|---|---|---|
| Loop kasir | `OverdueShiftGate` memblok **seluruh** POS; `CloseShiftBlockedModal` "Buka" mengarah balik ke `/pos/{meja}` yang kena gate lagi | [POSPage.tsx:398](../../../frontend/src/pages/POSPage.tsx#L398), [CloseShiftBlockedModal.tsx:16](../../../frontend/src/components/shifts/CloseShiftBlockedModal.tsx#L16) |
| Owner dead-end | `targetShift` di-resolve dari `user.id`, bukan shift open sistem-wide | [SettlementPage.tsx:32-38](../../../frontend/src/pages/SettlementPage.tsx#L32-L38) |

## Fakta kunci: backend SUDAH mendukung jalan yang benar

**Ini perbaikan frontend murni — tidak ada perubahan backend, tidak ada data dihapus, tidak ada status "paid" dipalsukan.** Backend sengaja memisahkan dua kasus:

| Aksi atas shift basi | Perilaku backend | Lokasi |
|---|---|---|
| Order **baru** | ❌ ditolak (409) | [createTransaction:676](../../../backend/src/modules/transactions/transactions.service.ts#L676) |
| **Tambah item** ke order kemarin | ❌ ditolak (409) | [addItems:739](../../../backend/src/modules/transactions/transactions.service.ts#L739) |
| **Bayar** order kemarin | ✅ boleh, atribusi ke shift yang masih open | [addPayment:946](../../../backend/src/modules/transactions/transactions.service.ts#L946) |
| **Void** order kemarin | ✅ boleh | exemption sama (komentar [674](../../../backend/src/modules/transactions/transactions.service.ts#L674)) |

`resolveActiveShift('pembayaran')` tidak mengecek staleness → order sisa kemarin tetap bisa dilunasi & atribusi ke shift kemarin. Konsekuensi: kasir **wajib bayar/void semua order open dulu, baru tutup shift** (urutan ini ter-enforce alami: tutup-final diblok selama masih ada order open; setelah shift ditutup `activeMarker=null`, pembayaran tak punya shift untuk diatribusi).

## Keputusan desain

Alih-alih melubangi tembok POS (mode settle-only di POS), **alihkan kasir ke halaman Riwayat** — layar yang sudah menampilkan daftar transaksi dan sudah punya aksi **Batalkan (void)**. Kita tambah **satu** kemampuan baru di sana: **Bayar** (memakai `PaymentModal` yang sudah ada, apa adanya). **Kode `/POS` tidak disentuh sama sekali**, jadi logika new-order-nya yang rumit tak mungkin regresi.

### Alur baru (loop putus, /POS utuh)

```
Shift basi → mau Tutup (Settlement)
   └─ 409 "ada pesanan belum dibayar"
       └─ CloseShiftBlockedModal: [Buka Riwayat →]      (dulu: /pos/{meja} = loop)
           └─ /history?status=open&date=<tanggal shift>
               ├─ tiap order open:  [Bayar] → PaymentModal     (BARU — reuse)
               │                    [⋮ → Batalkan] → void        (sudah ada)
               └─ semua beres → balik Settlement → Tutup ✓ → Setor
```

## Komponen & perubahan

### Part B — loop kasir (inti)

1. **HistoryPage** ([frontend/src/pages/HistoryPage.tsx](../../../frontend/src/pages/HistoryPage.tsx))
   - Tombol **"Bayar"** terlihat di baris saat `tx.status === 'open' && tx.mergedIntoId === null`. (Merge-source disembunyikan: bayar via parent — konsisten dgn [addPayment:791](../../../backend/src/modules/transactions/transactions.service.ts#L791).) "Batalkan" tetap di menu `⋮`.
   - Klik Bayar → render `<PaymentModal transactionId={tx.id} tableNumber={tx.tableNumber} candidateSourceIds={[]} onClose={…} onSuccess={…} />`. `candidateSourceIds=[]` → single-Tx, tanpa picker/merge.
   - `onSuccess` → `qc.invalidateQueries({ queryKey: ['transactions'] })` (prefix match key komposit `['transactions',date,status,type]`) supaya baris flip ke `paid`. Tutup modal.
   - **URL param preset:** saat mount, baca `?status=open` & `?date=YYYY-MM-DD` → set `filterStatus`/`filterDate`. Supaya redirect mendarat ter-filter pada hari & status yang tepat.
   - `PaymentModal` sudah self-contained (own query + mutation + layar sukses + struk PDF); drop-in tanpa modifikasi.

2. **CloseShiftBlockedModal** ([frontend/src/components/shifts/CloseShiftBlockedModal.tsx](../../../frontend/src/components/shifts/CloseShiftBlockedModal.tsx))
   - Ganti tombol per-meja `Buka → /pos/{table}` menjadi **satu** tombol primer **"Buka Riwayat"** → `navigate('/history?status=open&date=' + shiftDate)`. Daftar meja tetap ditampilkan sebagai konteks (informasi), tapi aksinya mengarah ke Riwayat. **Inilah satu baris yang memutus loop.**
   - Terima `shiftDate?: string` prop dari pemanggil (SettlementPage `targetShift.date`).

3. **OverdueShiftGate** ([frontend/src/components/OverdueShiftGate.tsx](../../../frontend/src/components/OverdueShiftGate.tsx))
   - Pertahankan CTA primer "Tutup & Setor Shift" → `/settlement`.
   - Tambah tautan/secondary **"Selesaikan pesanan di Riwayat"** → `/history?status=open&date=' + shift.date`. Jalan pintas supaya kasir bisa langsung beresin order tanpa lewat Settlement dulu.

### Part A — owner dead-end (reuse `131d53a` dari branch `fix/owner-overdue-shift-flow`)

4. **`frontend/src/services/shiftFocus.ts`** (BARU) — pure `pickShiftToSettle(active, recent)`: prioritas shift open sistem-wide (untuk ditutup) > shift terakhir (settle hari closed) > null. + Vitest `shiftFocus.test.ts` (5 kasus).
5. **`frontend/src/lib/utils.ts`** — `formatShiftDate(date)` → "Sabtu, 30 - 05 - 2026" (Intl id-ID, parse date-only dari komponen lokal supaya nama hari tak bergeser TZ).
6. **SettlementPage** — `targetShift = pickShiftToSettle(activeShifts, recentShifts)`:
   - Primary query `['shifts','active']` → `getActiveShifts()` (key dipakai bareng POS gate & Dashboard → tak bisa kontradiksi).
   - Fallback `recent`: owner → `listShifts({})`, kasir → `listShifts({ cashierId })`.
   - Copy date-aware untuk state overdue (judul "Shift {formatShiftDate} · kasir {nama} belum ditutup"); confirm dialog sertakan nama kasir.
   - 409-nya tetap memunculkan `CloseShiftBlockedModal` (yang kini mengarah ke Riwayat).
7. **RingkasanTab `ShiftPanel`** ([frontend/src/pages/owner-dashboard/RingkasanTab.tsx](../../../frontend/src/pages/owner-dashboard/RingkasanTab.tsx)) — label sadar-overdue + tombol "Tutup & Setor Shift" → `/settlement`; hapus catatan "Owner force-close belum tersedia di UI".

### Backend
**Nol perubahan.** Hanya verifikasi: `addPayment` & `void` memang membolehkan settle order shift basi (sudah dibaca & dikonfirmasi).

## Re-apply, bukan cherry-pick

Branch `fix/owner-overdue-shift-flow` (131d53a) dicabang dari base lama (`7626084`) yang sudah tertinggal dari `main`. Logika Part A di-**re-apply** di atas kode terkini (bukan cherry-pick mentah), karena `SettlementPage` & `RingkasanTab` sudah berubah sejak itu. `shiftFocus.ts` + test + `formatShiftDate` bisa diambil hampir verbatim.

## Out of scope
- **Perubahan gate POS** (mode settle-only di POS) — sengaja dihindari sesuai keputusan: /POS tidak disentuh.
- Perubahan backend apa pun.
- Cabang "2+ shift overlap" — `@@unique([activeMarker])` membuatnya praktis tak terjangkau.
- Owner memilih hari closed sembarang via date picker.
- Refund/koreksi pasca-settle.

## Verifikasi
1. `cd frontend && npm run build` (tsc -b + vite) → 0 error; `npm run lint` → 0 error.
2. Vitest `pickShiftToSettle()` (5 cabang: open ada / hanya recent / kosong / prioritas open / open non-overdue).
3. **Playwright e2e** (DB lokal seed shift basi + 2 order open):
   - **Kasir**: /pos → gate → Settlement → Tutup → 409 → "Buka Riwayat" → Riwayat ter-filter open → **Bayar** order #1 (PaymentModal, lunas) → **Batalkan** order #2 → balik Settlement → Tutup ✓ → Setor.
   - **Owner**: Settlement tak lagi "Belum ada shift" → lihat shift kasir yang open → Tutup; Dashboard panel tampil label overdue + tombol "Tutup & Setor" jalan.
   - **Regression kasir** (happy path): tutup shift sendiri tanpa order open tetap jalan; bayar normal di /pos tak berubah.

## Files
- `frontend/src/pages/HistoryPage.tsx` — tombol Bayar + PaymentModal state + URL param preset.
- `frontend/src/components/shifts/CloseShiftBlockedModal.tsx` — redirect ke Riwayat (+ prop `shiftDate`).
- `frontend/src/components/OverdueShiftGate.tsx` — secondary "Selesaikan di Riwayat".
- `frontend/src/pages/SettlementPage.tsx` — target shift sistem-wide (pickShiftToSettle) + copy date-aware + pass `shiftDate` ke modal.
- `frontend/src/pages/owner-dashboard/RingkasanTab.tsx` — ShiftPanel sadar-overdue + aksi.
- `frontend/src/services/shiftFocus.ts` (+ `shiftFocus.test.ts`) — BARU.
- `frontend/src/lib/utils.ts` — `formatShiftDate`.

## Catatan route & permission
Route Riwayat = `/history`, di-gate `RoleRoute allow={['owner','cashier']}` ([App.tsx:78](../../../frontend/src/App.tsx#L78)). Selaras: tutup shift memang kasir/owner-only, jadi redirect ke `/history` tak menabrak permission (waiter tak pernah masuk alur ini). Tombol Bayar di Riwayat memakai `PaymentModal` yang sama dengan kasir/owner di POS.
