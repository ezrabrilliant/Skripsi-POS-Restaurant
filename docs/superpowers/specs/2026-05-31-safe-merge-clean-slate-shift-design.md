# Design Spec — Merge Aman (Atomik) + Clean-Slate Shift Lintas-Hari (REV 2.12)

- **Tanggal:** 2026-05-31
- **Branch:** `feat/owner-self-service-rev212`
- **Status:** DESIGN APPROVED (menunggu review tertulis user → lanjut writing-plans)
- **Pemicu:** Bug kritis dilaporkan user — meja 7 menampilkan order Rp 40.000, tapi saat "Bayar" muncul Rp 90.000.

---

## 1. Ringkasan masalah (dengan bukti)

Saat membayar meja 7, modal pembayaran menampilkan **Rp 90.000** padahal kartu pesanan di cart menampilkan **Rp 40.000**.

State DB asli saat investigasi (semua `status=open`, `payments=0`, `total=0`, lintas hari, satu shift `id=57`):

```
Parent #221  table=7  mergedIntoId=null  subtotal=40.000  shift=57  created=2026-05-29
   └─ #223   table=7  mergedIntoId=221   subtotal=10.000  shift=57  created=2026-05-29
   └─ #442   table=7  mergedIntoId=221   subtotal=40.000  shift=57  created=2026-05-31  (HARI INI)
agregat bila #221 dibayar = 90.000
```

Dua transaksi (#223 dari 29 Mei, #442 dari 31 Mei) **ter-merge ke #221 tapi tidak pernah dibayar** ("stuck merge"). Cart menyembunyikan source yang ter-merge (`listByTable` filter `mergedIntoId: null` di [transactions.service.ts:1244](../../../backend/src/modules/transactions/transactions.service.ts)), sedangkan PaymentModal menjumlahkan parent + semua `mergedIntoId===221` ([PaymentModal.tsx:197-210](../../../frontend/src/components/PaymentModal.tsx)). Dua lapisan melihat data sama dengan aturan berbeda → angka tidak konsisten.

### Akar masalah (4 generator, hasil audit kode)

| Kode | Generator | Mekanisme |
|---|---|---|
| **G1** | [PaymentModal `handleSingleSubmit`/`handleAddSlice`](../../../frontend/src/components/PaymentModal.tsx) | `mergeMutation.mutateAsync()` **lalu** `addPayMutation.mutate()` = 2 panggilan API non-atomik. Merge sukses → bayar gagal/dibatalkan/tutup tab = merge permanen. **Penyebab langsung bug ini.** |
| **G2** | [CombineTableModal `merge.mutate()`](../../../frontend/src/components/CombineTableModal.tsx) | "Gabung meja, bayar nanti" — merge berdiri sendiri; menggantung kalau ditinggal. |
| **G3** | [POSPage gate hanya cek `activeShifts.length===1`](../../../frontend/src/pages/POSPage.tsx) + [`resolveActiveShift`](../../../backend/src/modules/transactions/transactions.service.ts) | Tidak ada deteksi shift lintas-hari. Shift kemarin yang lupa ditutup tetap dianggap aktif; order hari ini menempel ke shift kemarin. **Itu sebabnya #442 (31 Mei) ada di shift 57 (dibuka 29 Mei).** |
| **G4** | [`voidTransaction`](../../../backend/src/modules/transactions/transactions.service.ts) tidak cascade ke anak; [`closeShift` cek `mergedIntoId: null`](../../../backend/src/modules/shifts/shifts.service.ts) | Void parent meninggalkan anak open yang masih menunjuk parent void → anak tak terlihat & tak menghalangi tutup shift. |

**Invariant yang bocor:** "1 business day = 1 sesi shift yang wajib tuntas (kosong + ke-settle) sebelum hari baru". Tidak ada lapisan (DB constraint, settlement, tutup shift) yang menegakkan ini untuk kasus lintas-hari.

---

## 2. Tujuan & Non-Tujuan

### Tujuan
1. **Stuck-merge mustahil terjadi** dari jalur bayar (G1) — secara struktural via atomicity DB.
2. **Clean-slate tiap pagi**: order baru tidak bisa menempel ke shift hari kemarin; kasir wajib menuntaskan + menutup + menyetor shift kemarin sebelum mulai hari baru (G3).
3. **Void parent melepas anak** jadi order terpisah lagi, tidak menyisakan anak tersembunyi (G4).
4. **Bereskan data nyata** (shift 57 / meja 7) lewat flow baru, bukan SQL manual — sekaligus uji nyata.

### Non-Tujuan (YAGNI)
- Refund/void setelah settlement (memang out-of-scope sistem; sudah diblok [voidTransaction:984-987](../../../backend/src/modules/transactions/transactions.service.ts)).
- Window cross-midnight (resto 10–22, tidak crossing).
- Notifikasi push / email pengingat.
- Mengubah model split-tender / Combine Tables inter-meja (tetap apa adanya; hanya jalur merge intra-meja saat bayar yang dijadikan atomik).

---

## 3. Keputusan desain (hasil brainstorming dengan user)

| # | Pertanyaan | Keputusan |
|---|---|---|
| D1 | Cegah stuck merge | **Merge+bayar jadi atomik di backend** (bukan endpoint baru, bukan kompensasi frontend) |
| D2 | Kapan blok shift-lintas-hari aktif | **Saat sesi hari baru dimulai** (`now ≥ jam buka pagi` di hari business baru) — overtime tengah malam TIDAK diganggu |
| D3 | Alur tutup shift basi | **Wajib tutup-final + setor + meja kosong** ("harus kosong setiap pagi"); lebih ketat dari sekarang yang hanya mengingatkan saat menutup |
| D4 | Otoritas tutup shift basi | **Kasir mana pun** yang masuk boleh menutup shift basi (longgarkan batasan "hanya pemilik/owner" khusus untuk kasus overdue) |
| D5 | Void parent yang punya anak merge | **Lepas gabungan** — anak kembali jadi order terpisah (bukan ikut void) |
| D6 | Bereskan data #221/#223/#442 | **Lewat flow baru** (bayar/void + tutup shift 57), bukan utak-atik DB manual |

---

## 4. Desain rinci

### 4.1 Fix A — Merge + bayar atomik (G1)

**Schema** ([transactions.schema.ts](../../../backend/src/modules/transactions/transactions.schema.ts)):
`addPaymentSchema` tambah field opsional:
```ts
mergeSourceIds: z.array(z.number().int().positive()).optional(),
```

**Service** [`addPayment`](../../../backend/src/modules/transactions/transactions.service.ts):
- Pindahkan logika merge ke **dalam `prisma.$transaction` yang sama** dengan finalize payment (blok `FOR UPDATE` yang sudah ada di sekitar baris 869), DI AWAL blok sebelum hitung agregat:
  1. Kalau `mergeSourceIds` tidak kosong: muat sources, validasi (semua `status=open`, `mergedIntoId=null`, bukan target itu sendiri). Gunakan validasi setara `mergeBills` (reject kalau ada yang sudah merged / bukan open).
  2. `updateMany { id in sourceIds } → mergedIntoId = transactionId`.
  3. Lanjut: re-baca `mergedFrom` (kini termasuk yang baru di-merge) → hitung `aggregateSubtotal` → insert payment → finalize/cascade seperti sekarang.
- **Kunci:** karena semua di satu `$transaction`, kalau validasi bank / nominal / finalize melempar error → **merge ikut rollback**. Tidak ada lagi merge yang tertinggal.
- **Idempotensi & race:** tetap di bawah `SELECT ... FOR UPDATE` parent. Source yang sudah ter-merge oleh attempt lain akan gagal validasi (bukan open / sudah merged) → aman.

**Frontend** [`PaymentModal`](../../../frontend/src/components/PaymentModal.tsx):
- Hapus pemanggilan `mergeMutation.mutateAsync()` terpisah di `handleSingleSubmit` + `handleAddSlice`.
- Kirim `mergeSourceIds: selectedCandidateTxs.map(t => t.id)` di payload `addPayment` (hanya pada first slice; slice ke-2+ tidak mengirim karena agregat sudah terkunci).
- `mergeMutation` lokal boleh dihapus (atau disisakan hanya untuk error display jika perlu — default: hapus).

**Catatan G2 (Combine Tables):** CombineTableModal yang sengaja "gabung dulu, bayar nanti" **tetap** memakai `transactionService.merge` berdiri sendiri. Risiko menggantungnya ditutup oleh Fix B (tidak bisa lewat hari tanpa menuntaskan semua order open). Tidak diubah di pass ini.

### 4.2 Fix B — Clean-slate gate lintas-hari (G3)

**Helper murni** (baru, di [shift-time.ts](../../../backend/src/modules/shifts/shift-time.ts) atau [shift-rules.ts](../../../backend/src/modules/shifts/shift-rules.ts), unit-tested):
```ts
isShiftStale(shiftDate: Date, window: ShiftWindowSettings, now = new Date()): boolean
  // stale = businessDateFor(window, now) > shiftDate  &&  restoNow().minutesOfDay >= window.pagiStart
```
- `businessDateFor` & `restoNow` sudah ada. `shiftDate` & hasil `businessDateFor` keduanya UTC-midnight `Date` → bandingkan via `getTime()`.
- Overtime 01:00 (sebelum pagiStart) → **tidak** stale (boleh lanjut melayani). Besok 10:00 (≥ pagiStart) → **stale** (diblok).

**View shift** ([shifts.service.ts](../../../backend/src/modules/shifts/shifts.service.ts) `ShiftView` + `getActiveShifts`): tambah `businessDate: string` + `isOverdue: boolean` (dihitung via helper). Dipakai frontend untuk gate.

**Backend enforcement (defense-in-depth):**
- `createTransaction` (+`addItems`): setelah `resolveActiveShift`, kalau shift hasil resolve `isShiftStale` → throw `AppError(409, "Shift {tanggal} belum ditutup — tuntaskan & tutup shift kemarin dulu sebelum input order baru.")`.
- **PENTING — jangan blok jalur pembersihan:** `addPayment` & `voidTransaction` **TIDAK** boleh kena cek stale. Justru perlu jalan supaya order sisa kemarin bisa dibayar/dibatalkan. Payment yang melunasi akan tetap re-stamp ke shift 57 (yesterday) lewat `resolveActiveShift('pembayaran')` — atribusi benar (revenue kemarin → hari kemarin). Karena itu cek stale ditempatkan **spesifik di `createTransaction`/`addItems`, BUKAN di `resolveActiveShift`** (yang dipakai bersama).

**Frontend (UI blok):**
- Komponen baru `OverdueShiftGate` (mirip pola `ShiftGate` di POSPage). Tampil saat ada active shift `isOverdue`.
- Lokasi mount: POSPage (gantikan/awali sebelum gate normal) + CashierDashboard.
- Isi: judul "Shift kemarin belum ditutup", detail (tanggal + nama kasir + nominal/meja yang masih open), CTA utama **"Tutup & Setor Shift Kemarin"** → navigate `/settlement`. Input order ter-blok selama overdue.

**Otoritas tutup (D4)** [`closeShift`](../../../backend/src/modules/shifts/shifts.service.ts):
- Saat `mode='final'` DAN shift `isShiftStale` → lewati batasan "hanya pemilik shift/owner" (kasir mana pun boleh). Tetap pertahankan cek "tidak ada order open" (justru ini inti D3).
- Untuk shift non-stale, otoritas lama tetap berlaku.

### 4.3 Fix C — Void parent melepas anak (G4, D5)

[`voidTransaction`](../../../backend/src/modules/transactions/transactions.service.ts): di dalam `$transaction`, sebelum/sesudah set status=void parent:
```ts
await tx.transaction.updateMany({
  where: { mergedIntoId: transactionId, status: 'open' },
  data: { mergedIntoId: null },
});
```
- Efek: anak (#223/#442) kembali jadi order standalone open → muncul lagi di `listByTable` meja-nya → bisa dibayar/dibatalkan sendiri.
- **Kelengkapan close-check:** karena anak yang dilepas kembali `mergedIntoId=null`, mereka otomatis terhitung di cek "order open" saat tutup shift. (Opsional defensif: pertimbangkan apakah `closeShift` perlu juga menghitung anak `mergedIntoId != null` — dengan Fix C, tidak wajib, karena void selalu melepas anak. Putuskan saat plan.)

### 4.4 Remediasi data (D6)

Setelah A/B/C selesai + lulus test:
1. Shift 57 akan terdeteksi `isOverdue` saat app dibuka di business day sekarang.
2. Lewat `OverdueShiftGate` → `/settlement` → tampil order open (meja 7).
3. Tuntaskan #221/#223/#442: bayar (jika order sah) atau void (jika data uji). Catatan: jika #221 di-void, Fix C melepas #223/#442 jadi terpisah → tuntaskan masing-masing.
4. Setelah meja kosong → tutup-final shift 57 + isi settlement.
5. Buka shift baru untuk hari ini → clean slate.

Ini sekaligus **bukti e2e** Fix B & C bekerja. Tidak ada `UPDATE` SQL manual.

---

## 5. Edge cases & pertimbangan

- **Overtime tengah malam:** `now < pagiStart` → tidak stale → kasir tetap melayani & menutup tagihan tadi malam tanpa gangguan. Cek stale baru menggigit ≥ pagiStart hari business baru.
- **Deadlock pembersihan (dihindari):** kalau cek stale dipasang di `resolveActiveShift`, membayar order sisa kemarin akan ikut terblok → kasir tak bisa mengosongkan meja → tak bisa menutup shift. Karena itu cek stale HANYA di `createTransaction`/`addItems`.
- **Atribusi revenue order sisa:** order kemarin yang dibayar pagi ini tetap masuk shift 57 (business day kemarin) via re-stamp pembayaran — benar secara fiskal.
- **Kasir berbeda:** D4 memperbolehkan kasir pagi menutup shift 57 walau bukan yang membukanya.
- **Double-merge saat retry:** dengan Fix A atomik, retry bayar tidak menemukan source "sudah merged" karena merge gagal ikut rollback bersama payment yang gagal.
- **Combine Tables (G2):** tetap bisa "gabung lalu belum bayar" dalam hari yang sama; dijaga agar tidak lolos lewat hari oleh Fix B (tutup shift wajib kosong).

---

## 6. Rencana testing (TDD, sesuai mandate proyek)

**Unit (Vitest):**
- `isShiftStale`: (a) overnight 01:00 same-ish window → false; (b) besok 10:00 (≥ pagiStart) → true; (c) hari sama siang → false.
- Validasi merge dalam addPayment (source bukan open / sudah merged / = target → reject).

**Integration (DB test terpisah `pos_restaurant_test`):**
1. **Atomik rollback:** create A + B(merge candidate); panggil `addPayment(A, mergeSourceIds:[B], bank salah/nominal>sisa)` → expect error DAN `B.mergedIntoId` tetap `null` (rollback).
2. **Atomik sukses:** `addPayment(A, mergeSourceIds:[B], valid)` → A & B `paid`, B `mergedIntoId=A`.
3. **Clean-slate create block:** shift stale → `createTransaction` → 409.
4. **Clean-slate payment allowed:** shift stale → `addPayment` order open → tetap sukses (atribusi ke shift stale).
5. **Void melepas anak:** void parent → semua anak open `mergedIntoId=null` + muncul di `listByTable`.
6. **Otoritas tutup stale:** kasir lain `closeShift(final)` pada shift stale (meja sudah kosong) → boleh.

**Frontend:** `tsc --noEmit` + `vite build` + ESLint 0 error. Manual e2e via remediasi data §4.4.

---

## 7. Rollout

- **Schema:** kemungkinan TIDAK ada perubahan kolom DB (mergeSourceIds = field request; isOverdue/businessDate = computed di view). Konfirmasi saat plan. Jika tanpa migrasi → aman untuk prod.
- **LOCAL:** implement → test → remediasi shift 57 / meja 7.
- **PROD (`monosuko.my.id`):** redeploy backend+frontend setelah verifikasi. Cek apakah ada shift overdue di prod (kemungkinan ada, mengingat pola pemakaian) → bereskan lewat flow baru. Tidak ada migrasi destruktif.

---

## 8. Berkas yang akan disentuh (perkiraan, finalisasi di plan)

**Backend:**
- `modules/transactions/transactions.schema.ts` — `mergeSourceIds`
- `modules/transactions/transactions.service.ts` — `addPayment` (merge atomik), `createTransaction`/`addItems` (cek stale), `voidTransaction` (lepas anak)
- `modules/shifts/shift-time.ts` atau `shift-rules.ts` — `isShiftStale` (+ test)
- `modules/shifts/shifts.service.ts` — `ShiftView`/`getActiveShifts` (isOverdue/businessDate), `closeShift` (otoritas stale)
- Test baru: `shift-rules.test.ts`/`shift-time.test.ts` + integration smoke transaksi

**Frontend:**
- `components/PaymentModal.tsx` — kirim `mergeSourceIds`, hapus merge terpisah
- `components/OverdueShiftGate.tsx` (baru)
- `pages/POSPage.tsx` + `pages/CashierDashboard.tsx` — mount gate
- `services/shiftService.ts` + `types` — field `isOverdue`/`businessDate`

---

## 9. Out of scope (ditegaskan)
Refund pasca-settle, window cross-midnight, notifikasi push, perubahan Combine Tables inter-meja, perubahan split-tender.
