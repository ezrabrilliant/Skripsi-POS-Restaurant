# Shift Redesign (REV 2.7) — Business Day, Window Owner-Configurable, Atribusi by Payment

> **Status:** APPROVED + edge-case hardened (brainstorming + sweep adversarial sesi 2026-05-29). Siap dipecah ke implementation plan.
> **Pendekatan terpilih:** P1 — Jam-dinding otoritatif + single active shift (single-OPEN guard, bukan once-per-day).
> **Revisi pasca-sweep:** `@@unique([date,type])` → penjaga `activeMarker` (§4.2); settlement keyed by date (§8.2); refund out-of-scope (§7.5); migrasi prod-aware (§12); hardening checklist (§15).
> **Dokumen terkait:** [docs/operasional-resto.md](../../operasional-resto.md), [docs/superpowers/specs/2026-05-25-shift-decoupling-design.md](2026-05-25-shift-decoupling-design.md), [docs/superpowers/specs/2026-05-27-payment-methods-banks-redesign-design.md](2026-05-27-payment-methods-banks-redesign-design.md)

---

## 1. Konteks & Masalah

Audit alur shift menemukan 6 kelas bug pada implementasi REV 2.5/2.6:

1. **Tidak ada unique constraint DB di `Shift`.** Schema cuma `@@index([date, type, closedAt])`. Komentar di `shifts.schema.ts` keliru mengklaim ada UNIQUE. `findFirst`-lalu-`create` di `openShift` punya race condition: 2 kasir buka tipe sama bersamaan → 2 shift aktif → setiap order setelahnya kena 409 "Anomaly".
2. **Transisi pagi→malam: backend mengizinkan, frontend memblokir.** `resolveActiveShift` sanggup menangani 2 shift beda tipe (pilih by jam), tapi gate `POSPage` butuh persis 1 shift → di window transisi POS terkunci untuk semua orang.
3. **Resolusi shift pakai `getHours()` jam server, bukan timezone resto.** Server deploy (Tencent Lighthouse) bisa UTC → jam 18:00 WIB = 11:00 UTC → ke-resolve `pagi`, salah. Inkonsisten dengan `todayDateOnly()` yang sudah TZ-aware.
4. **Order dibuat di pagi, dibayar di malam → revenue nyangkut di shift pagi.** `shiftId` di-lock saat create. Laci kas yang menerima uang adalah kasir malam, tapi settlement malam tak menghitung order itu. `mergeBills` punya migrasi cross-shift, tapi transaksi tunggal tidak.
5. **Tutup shift tidak cek transaksi open.** Bisa close shift sambil ada order belum dibayar; `addPayment` tak cek status shift → pembayaran masuk ke shift yang sudah closed/settled → uang tak terlihat di rekap.
6. **Mismatch ground truth vs implementasi cakupan settlement.** Ground truth: "rekap total penjualan sekali sehari" (seluruh hari). Implementasi: settlement per-shift, hanya malam yang jalan → revenue shift pagi tak pernah direkonsiliasi.

---

## 2. Keputusan Bisnis (Locked)

Hasil brainstorming dengan owner-domain (Ezra):

| # | Keputusan |
|---|---|
| D1 | **Business Day berbasis shift.** Tanggal transaksi mengikuti `shift.date` (hari buka shift), bukan tanggal jam dinding. Meja yang start jam 23:00 dan nambah sampai 01:00 tetap satu business day selama shift malam belum ditutup. |
| D2 | **Window shift kontigu, malam boleh lewat tengah malam.** Owner set jam tiap shift; akhir pagi = awal malam (changeover); malam boleh tutup setelah 00:00. |
| D3 | **Tutup malam diblokir kalau ada tx open.** Tampilkan daftar tx open dikelompokkan per meja + tombol redirect ke `/pos/<meja>`. Takeaway open jadi grup "Takeaway" terpisah. |
| D4 | **Atribusi revenue = saat dibayar.** Tx siang dibayar malam → masuk shift malam. |
| D5 | **Window cuma gerbang saat BUKA shift, bukan saat melanjutkan/menutup.** |
| D6 | **Pendekatan P1**: single active shift; buka divalidasi window; atribusi re-stamp saat bayar; tanggal = business day. |
| D7 | **Settlement = whole business day**, sekali rekap, oleh penutup shift terakhir hari itu / owner (longgar dari aturan lama "malam-only"). |
| D8 | **Shift malam OPSIONAL.** Kasir pagi boleh jaga seharian tanpa buka malam — shift tetap berlabel "pagi", tutup kapan saja. |
| D9 | **Reminder non-blocking** saat lewat changeover & shift open masih `pagi`. Frontend-only (tanpa endpoint baru). |
| D10 | **Aturan buka shift = "belum lewat jam-AKHIR window"** (bukan "harus di dalam window"), supaya prep dini & serah-terima dini didukung tanpa membuka tipe stale. |
| D11 | **Tanpa auto-convert type.** Kasir tunggal lewat changeover tidak otomatis jadi malam. |
| D12 | **Single-OPEN, bukan once-per-day. Reopen mengikuti window.** Ganti rencana `@@unique([date,type])` dengan penjaga "cuma 1 shift OPEN sekaligus". Shift boleh dibuka-tutup-buka lagi dalam window tipe-nya (mis. pagi di-close lalu buka lagi jam 11:00 selama `< changeover`). Yang tetap dilarang: buka tipe yang window-nya sudah lewat (buka pagi saat sudah malam). **Sumber: koreksi user — "jangan strict 1x".** |
| D13 | **Refund/komplain OUT OF SCOPE.** Sistem tidak mencatat apa pun soal komplain/refund. Konsekuensi: void transaksi yang business day-nya **sudah di-settle** → diblokir (hari beku/immutable). Tidak ada mesin refund. **Sumber: keputusan user sesi 2026-05-29.** |
| D14 | **Gojek/Grab = metode biasa.** Tetap dihitung di settlement harian seperti cash/EDC/QRIS (variance dicek via laporan platform saat settle). Tidak ada pemisahan "deferred settlement". **Sumber: keputusan user sesi 2026-05-29.** |

---

## 3. Arsitektur (P1)

Dua sumber kebenaran dengan peran yang tidak tumpang tindih:

- **Window owner (`AppSetting`)** = kebijakan "shift apa yang BOLEH dibuka sekarang".
- **Row shift `open` di DB** = state runtime "shift apa yang SEDANG berjalan".

Single active shift: maksimal 1 shift `closedAt = null` pada satu waktu. Menghilangkan seluruh kelas bug "2 shift aktif → POS terkunci" (bug #2) secara desain, bukan tambalan.

---

## 4. Data Model

### 4.1 `AppSetting` (tambah 4 field, singleton id=1)

| Field | Tipe | Default | Arti |
|---|---|---|---|
| `timezone` | String | `"Asia/Jakarta"` | Zona resto. Sumber jam & tanggal business day. **Menggantikan ketergantungan TZ server.** |
| `shiftPagiStart` | String `HH:MM` | `"07:00"` | Awal window pagi (informasional + floor opsional; lihat §6). |
| `shiftChangeover` | String `HH:MM` | `"18:00"` | Akhir pagi = awal malam. |
| `shiftMalamEnd` | String `HH:MM` | `"23:00"` | Akhir malam. Boleh `<= changeover` ⇒ lewat tengah malam. |

Validasi update (Zod): format `HH:MM`, dan `shiftPagiStart < shiftChangeover` (pagi tidak lewat tengah malam). `shiftMalamEnd` boleh lebih kecil dari `changeover` (artinya cross-midnight).

Owner melihatnya sebagai: **Shift 1 (Pagi): `pagiStart`–`changeover`**, **Shift 2 (Malam): `changeover`–`malamEnd`**. Kontiguitas otomatis (akhir shift 1 = awal shift 2 = `changeover`).

### 4.2 `Shift` — enforce single-OPEN (REVISED, lihat D12)

> ⚠️ Rencana awal `@@unique([date, type])` **DIBATALKAN.** Sweep edge-case menunjukkan itu salah mekanisme: (a) **tidak** mencegah pagi+malam dibuka bersamaan → lubang single-active tetap ada; (b) mengunci **permanen** — shift yang tak sengaja di-`final`-close tak bisa dibuka lagi seharian (dead-end, recovery-nya out-of-scope). Selain itu, di prod yang sudah live (REV 2.5 tanpa unique) constraint ini akan **gagal di-apply** karena kemungkinan sudah ada baris `(date,type)` duplikat (lihat §12).

- Tambah kolom **`activeMarker Int?`** + **`@@unique([activeMarker])`**:
  - `activeMarker = 1` saat shift dibuka (`closedAt = null`); **`NULL`** saat ditutup.
  - MySQL mengizinkan banyak `NULL` dalam unique index → semua shift `closed` tidak bentrok, tapi **hanya 1 baris boleh punya `activeMarker = 1`** → tepat satu shift OPEN di seluruh sistem.
  - Ini menutup race **bug #1** DAN menegakkan **single-active** di level DB, **tanpa** mengunci reopen.
- **Reopen diizinkan** (D12): buka-ulang tipe sama selama masih dalam window-nya (§6) & tidak ada shift open. Boleh ada >1 baris `Shift` per `(date, type)` dalam satu business day; semua tetap satu business day via `shift.date`. (Reopen = buat baris baru; baris lama yang closed jadi audit. Alternatif un-close baris lama diserahkan ke plan.)
- `shift.date` = tanggal business day (resto-local saat shift dibuka). Tidak ada field tanggal baru.
- Keep `@@index([date, type, closedAt])` untuk query.

### 4.3 `Transaction` (tanpa field baru)

Atribusi cukup lewat `shiftId` yang di-stamp ulang saat lunas. Tanggal/business-day diturunkan dari relasi `shift.date`.

---

## 5. Helper Waktu (TZ-aware)

Helper baru (mis. `modules/shifts/shift-time.ts` atau `utils/restoTime.ts`):

- `restoNow(timezone): { dateOnly: Date, minutesOfDay: number }` — hitung tanggal kalender & menit-sejak-tengah-malam di zona resto via `Intl.DateTimeFormat` (bukan `new Date().getHours()`).
- `parseHHMM(s): number` — "HH:MM" → menit sejak tengah malam.
- `todayBusinessDate(timezone): Date` — tanggal business day (UTC-midnight dari komponen tanggal resto-local), menggantikan `todayDateOnly()` sebagai sumber `shift.date`.

Semua perbandingan jam dilakukan dalam menit-sejak-tengah-malam resto-local.

---

## 6. Aturan Buka Shift (`openShift`)

Sebuah tipe `T` **boleh dibuka sekarang** jika KEDUA syarat terpenuhi (TIDAK ada syarat "1x per hari" — reopen dalam window diizinkan, D12):

1. **Belum lewat jam-akhir `T`** (resto-local):
   - **Pagi**: `now < changeover`.
   - **Malam**: `now < malamEnd` **DAN** (`pagi sudah pernah dibuka business-day ini` **ATAU** `now >= changeover`).
     - Cross-midnight: jika `malamEnd <= changeover`, "sebelum malamEnd" dievaluasi sebagai window malam yang membentang `[changeover, 24:00) ∪ [00:00, malamEnd]` pada business day berjalan. Untuk pembukaan (selalu di sore/malam sebelum tengah malam), kondisi ini praktis selalu lolos.
2. **Single-active**: tidak ada shift lain yang `open` (dijamin penjaga `activeMarker` §4.2; di app layer tetap dicek + tangkap pelanggaran unique sebagai 409 kontekstual).

Konsekuensi yang ditangani aturan ini:
- **Bug asli mati**: buka pagi jam 20:00 ditolak (`20:00 < changeover 18:00` false).
- **Prep dini**: kasir pagi datang sebelum `pagiStart` boleh buka pagi (kita TIDAK menegakkan floor `pagiStart` agar prep tidak terblokir; `pagiStart` informasional).
- **Serah-terima dini**: Bryant buka malam sebelum changeover boleh, karena pagi sudah dibuka hari ini.
- **Reopen dalam window** (D12): pagi dibuka 08:00, di-`final`-close 10:30 karena salah, dibuka lagi 10:35 (`< changeover`) → **diizinkan** (tidak ada open shift lain + masih window pagi). Salah-tutup tidak lagi jadi dead-end.
- **Dicegah**: buka malam pagi-pagi sambil skip pagi (pagi belum dibuka & belum `>= changeover`).

Kalau tidak ada tipe yang openable / single-active dilanggar → tolak dengan pesan kontekstual ("Di luar jam operasional" / "Masih ada shift {X} milik {nama} yang open — tutup dulu"). Loser dari race unique-`activeMarker` di-translate dari Prisma `P2002` menjadi 409 yang sama (re-query untuk nama pemilik).

`openShift` set `shift.date = todayBusinessDate(timezone)`, `activeMarker = 1`, `cashierId`, `type`, `openingCash` — dalam satu `$transaction` (atau andalkan unique + catch P2002).

---

## 7. Resolusi & Atribusi

### 7.1 `resolveActiveShift()` — disederhanakan

Single-active ⇒ cuma 0 atau 1 shift open:
- 0 → 409 "Belum ada shift kasir aktif. Buka shift dulu."
- 1 → return.
- **2+ (defensive)** → JANGAN diam-diam pilih satu. Lempar 409 "Anomali: >1 shift open, hubungi owner". Penjaga `activeMarker` (§4.2) seharusnya mencegah ini, tapi cabang fail-closed tetap dipertahankan sampai constraint terbukti aktif di prod.

Tiebreaker `getHours()` **DIHAPUS** (sumber bug #3). Cabang "pilih by jam" tidak ada lagi.

### 7.2 Create order

`createTransaction` attach `shiftId` = shift open saat itu (provisional, untuk decrement stok + tampil di view). Decrement stok porsi tetap seperti sekarang.

### 7.3 Re-stamp saat lunas (jantung bug #4)

Di `addPayment`, saat slice membuat `status` menjadi `paid` (`newSum >= total`):
- Resolve shift open saat ini (`resolveActiveShift('pembayaran')`).
- Set `transaction.shiftId = currentShift.id` (re-stamp).
- Cascade `status=paid` ke `mergedFrom` sources (sudah ada; mereka tetap exclude dari revenue via `mergedIntoId != null`).
- Kalau tak ada shift open saat bayar → 409 "Buka shift dulu sebelum memproses pembayaran." (mencegah pembayaran masuk void state; bug #5).

**Atomicity (WAJIB — hasil sweep):** seluruh read sisa-tagihan + insert slice + finalize + re-stamp + cascade harus dalam **satu `$transaction` dengan lock baris parent** (`SELECT … FOR UPDATE` via `$queryRaw`, atau guard `updateMany({where:{id, status:'open'}})`). Saat ini `addPayment` membaca `existing.payments` & menghitung `remaining` DI LUAR `$transaction` → dua slice nyaris bersamaan (double-tap / 2 device) bisa sama-sama lolos `amount<=remaining`, sama-sama flip `paid`, **double re-stamp + double cascade** → overpayment. Finalize harus **idempotent**: `updateMany({where:{id, status:'open'}, data:{status:'paid'}})`, dan re-stamp/cascade hanya jalan kalau `count===1`. Re-stamp juga harus mutually-exclusive dgn `closeShift` pada shift yang sama (lock baris shift) supaya pembayaran tidak nyelip ke shift yang sedang ditutup (bug #5 reincarnated).

### 7.4 Simplifikasi `mergeBills`

Migrasi `shiftId` cross-shift di `mergeBills` menjadi **redundan** (re-stamp saat bayar sudah menangani atribusi). Hapus blok `hasCrossShift` / `migrateTargetTo`; `mergeBills` cukup set `mergedIntoId`. **Invariant eksplisit:** atribusi revenue = `parent.shiftId` saja; source selalu di-exclude via `mergedIntoId != null`, jadi `shiftId` source tidak relevan. POSPage memilih Tx tertua sebagai target — pastikan re-stamp memindahkan baris parent yang benar (tes: target = carryover dari shift sebelumnya).

### 7.5 Void — refund/komplain OUT OF SCOPE (D13)

- **Void hanya untuk transaksi yang business day-nya BELUM di-settle.** Kalau `shift.date` transaksi sudah punya `Settlement` (submitted/reviewed) → `voidTransaction` 409 "Hari sudah di-settle, tidak bisa diubah". Hari yang sudah direkap = **immutable**.
- Void transaksi `open`/`paid` dalam business day yang belum di-settle tetap boleh (koreksi salah-input intra-hari) → reverse stok + recompute seperti sekarang.
- **Tidak ada pencatatan refund/komplain** apa pun (D13). Tidak ada negative slice, tidak ada RefundMovement. Ini menutup celah "void paid tx setelah settlement men-desync snapshot" tanpa menambah mesin refund.

---

## 8. Tutup Shift & Settlement

### 8.1 `closeShift` — dua mode, tidak digerbang jam

`closeShift` menerima parameter **`mode: 'final' | 'handover'`** (default `'final'`). Ini membuat keputusan "blokir atau carry" eksplisit dari aksi yang dipilih kasir, bukan ditebak sistem.

Definisi "tx open yang relevan": `status = open` AND `mergedIntoId = null` (exclude source yang sudah di-merge). Dengan single-active, tx open mana pun adalah milik business day berjalan.

- **`mode = 'final'` (Tutup Kasir / akhir hari)** — dipakai saat mengakhiri business day, tidak ada shift pengganti.
  - Kalau ada tx open → backend **409 + daftar tx open per-meja**, shift TIDAK ditutup. Kasir wajib bereskan (bayar/void) dulu lewat modal.
  - Kalau bersih → shift ditutup, lanjut ke settlement.
- **`mode = 'handover'` (Serah-terima ke kasir berikutnya)** — dipakai HANYA dari alur serah-terima yang segera membuka shift pengganti.
  - Tx open **boleh carry** (tidak diblokir); reattach ke shift baru saat dibayar (§7.3).
  - Celah 0-shift hanya seketika di antara tutup-lama dan buka-baru.

**Pemicu `handover`:** karena single-active mewajibkan shift lama ditutup sebelum shift baru dibuka, alur "Buka Kasir" yang mendeteksi ada shift open milik orang lain menawarkan aksi gabungan **"Serah-terima: tutup shift {pemilik} lalu buka {tipe}"**. Aksi gabungan inilah satu-satunya jalur yang memanggil `closeShift` dengan `mode='handover'`. Tombol "Tutup Kasir" standalone selalu `mode='final'`. Dengan demikian "close dengan tx open" hanya bisa dicapai lewat niat serah-terima yang eksplisit — tidak ada state tersembunyi, tidak ada tebak-tebakan.

Modal frontend saat `mode='final'` diblokir (sesuai spec user):

```
Ada pesanan yang belum dibayar — selesaikan dulu sebelum tutup.

Meja 1   [→ buka /pos meja 1]
  Tx #122
  Tx #124

Meja 2   [→ buka /pos meja 2]
  Tx #126

Takeaway [→ buka /pos takeaway]
  Tx #130
```

### 8.2 Settlement — whole business day

- Sumber totals: ubah `computeSystemTotals` **DAN `computeBankBreakdown`** dari filter `shiftId` tunggal menjadi filter **semua shift dengan `shift.date = businessDate`** (status paid, `mergedIntoId = null`). ⚠️ `computeBankBreakdown(shiftId)` dipanggil di **5 tempat** (`getSettlementById`, `listSettlements`, `createSettlement`, `reviewSettlement`, `previewSettlement`) — SEMUA harus diubah ke `businessDate`, jika tidak total per-metode (whole-day) ≠ breakdown per-bank (per-shift). Tambah smoke test: `sum(bankBreakdown metode X) == total system metode X` untuk hari multi-shift.
- **Re-key seluruh flow ke business date** (bukan `shiftId`): `previewSettlement(businessDate)`, `createSettlement({date, ...})`, existing-check `findFirst({where:{date}})`. Frontend `SettlementPage` resolve "business date hari ini" (dari shift penutup / endpoint status), **bukan** `shifts[0]` per-cashier — kalau tidak, 2 kasir bisa meng-anchor 2 shift berbeda untuk hari sama → form kosong + double-submit.
- **Satu settlement per business day**: tambah **`@@unique([date])` di `Settlement`** (drop peran dedupe dari `@@unique(shiftId)`; boleh disimpan sebagai FK audit non-unique ke shift penutup). Guard app `findFirst({where:{date}})` dalam `$transaction` + DB unique untuk menutup race 2 kasir settle bersamaan. Migrasi: verifikasi tak ada `date` dengan >1 settlement sebelum menambah unique.
- `settlement.shiftId` = shift penutup (referensi audit saja).
- **Permission dilonggarkan** (D7): dari "kasir hanya shift malam miliknya" menjadi **"kasir penutup shift TERAKHIR business day itu, atau owner"**. Resolusi deterministik: ambil shift business day itu, "penutup" = shift dengan `closedAt` paling akhir (tie-break `createdAt` terakhir). Izinkan jika `role===owner` ATAU `userId===penutup.cashierId`. **Hapus** cek lama `type===malam` (kalau tidak, kasus lone-pagi gagal: pagi penutup di-403 padahal dia berhak). Sertakan kasus lone-pagi di smoke test.
- **Baseline modal awal (cash variance)** — *recommended default, konfirmasi saat review*: settlement saat ini meng-abaikan `openingCash` untuk variance (kasir mengurangi float secara mental). Untuk whole-day yang mungkin punya >1 `openingCash` (handover), tampilkan di preview **"Modal awal hari ini" = Σ openingCash semua shift business day itu** sebagai baseline float, dan `expectedDrawerCash = baseline + cash sales − cash payouts`. Simpan baseline yang dipakai di row `Settlement` agar audit reproducible. (Kalau owner menganggap handover = ganti float bukan tambah, ubah Σ → ambil shift pertama. Konfirmasi di review.)

---

## 9. Frontend

| Komponen | Perubahan |
|---|---|
| [OpenShiftDialog.tsx](../../../frontend/src/components/OpenShiftDialog.tsx) | Window-aware: query settings, hitung tipe yang openable (aturan §6) di resto-local, auto-pilih tipe valid, disable yang tidak + tooltip alasan ("Sudah dibuka", "Di luar jam"). Hilangkan pilihan bebas pagi/malam. Kalau ada shift open milik orang lain → tawarkan aksi gabungan **"Serah-terima: tutup {pemilik} lalu buka {tipe}"** (memanggil `closeShift` `mode='handover'` lalu `openShift`; §8.1). |
| Modal "Tutup Kasir" (`mode='final'`, baru) | Jika 409 daftar tx open → tampilkan modal per-meja + redirect `/pos/<meja>` (§8.1). Reuse `transactionService.list({status:'open'})` / `listByTable`, grouping di klien. Tidak ada escape-hatch carry di sini; serah-terima dilakukan via OpenShiftDialog. |
| [POSPage.tsx](../../../frontend/src/pages/POSPage.tsx) `ShiftGate` | Sederhanakan ke single-active: 0 → CTA (kasir) / info (lain); 1 → POS. Branch "2+ shift" jadi defensive-only (praktis tak terjadi). |
| Owner Settings | Tab baru **"Jam Shift"** di samping [TaxSettingsTab.tsx](../../../frontend/src/components/payment-methods/TaxSettingsTab.tsx). Form: timezone (default Asia/Jakarta), pagiStart, changeover, malamEnd. Validasi kontiguitas + format. |
| **ShiftChangeReminder** (baru) | Banner non-blocking (kanan atas, persisten + dapat di-dismiss). Tampil jika `restoNow >= changeover` DAN `activeShift.type === 'pagi'`. Pesan: "Sudah masuk jam shift malam. Kalau ada pergantian kasir, tutup shift untuk diserahkan; kalau lanjut sendiri, abaikan." Murni turunan `settings + activeShift + jam` — tanpa endpoint baru. |
| [SettlementPage.tsx](../../../frontend/src/pages/SettlementPage.tsx) | Tweak ke whole-business-day (label & sumber preview by date). |
| `settingsService` / `shiftService` | Tambah field window + adaptasi shape. |

**Hardening frontend (hasil sweep):**
- **Freshness `['shifts','active']` lintas-device:** staleTime global 5 menit + `refetchOnWindowFocus:false` → device LAIN tidak melihat handover/0-shift gap, lanjut nulis ke shift yang sudah closed. Fix: `refetchInterval` ~20–30s pada query yang men-gate write (POSPage min.), DAN pada error 409 "buka shift dulu" → `invalidateQueries(['shifts','active'])` di `onError` supaya gate re-render benar.
- **OpenShiftDialog loading/fail-closed:** komponen sekarang pilih tipe sinkron di `useState`; settings async. Sampai settings (timezone/window) ter-load → disable kedua tombol + skeleton; **fail-closed** (tidak default ke "pagi") kalau settings gagal. Ganti useState-initializer → `useEffect` yang re-compute openable saat settings tiba. Extend `settingsService` type dulu.
- **Auto-select saat 0 tipe openable** (mis. lewat semua window / sudah lewat malamEnd): jangan default enable "pagi"; tampilkan empty state "Di luar jam operasional" + tombol Buka disabled.
- **Client window = advisory:** device clock bisa skew (tanpa NTP/wifi) & settings cache bisa basi → jangan hard-disable satu-satunya jalur valid berdasarkan klien saja; biarkan server 409 jadi otoritas, `refetchOnMount:'always'` pada settings di dialog.
- **Host modal Tutup-diblokir:** mount di SettlementPage/CashierDashboard; `onError` mutation close WAJIB baca `err.response.data` (daftar tx open ter-grup), bukan cuma `err.message` (interceptor `api.ts` membuang `data`). Tentukan shape 409 eksplisit.
- **ShiftChangeReminder dismissal key = per `shiftId`** (`reminder-dismissed-<shiftId>` di localStorage) → shift baru selalu re-arm, handover otomatis tak relevan; derive dari active-shift yang fresh (couple ke poin freshness di atas).

---

## 10. Edge Cases

- **Celah 0-shift saat handover** (pagi tutup → malam belum buka): order/pembayaran baru diblokir beberapa detik. Aman. Kalau pengganti batal datang, kasir yang sama bisa buka malam sendiri (window mengizinkan, single-active terpenuhi). Catatan: device lain harus refresh active-shift (lihat hardening §9) supaya gate tidak basi.
- **Malam lewat tengah malam**: `shift.date` tetap hari buka. Tx jam 00:30 resolve ke shift malam yang masih open → mewarisi `shift.date` kemarin. Single-active mencegah buka pagi besok sampai malam ditutup. ⚠️ `todayBusinessDate()` harus **window-aware** untuk kasus rare "malam dibuka SETELAH tengah malam" (config cross-midnight): kurangi satu hari kalau membuka malam di `[00:00, malamEnd]`. Pakai SATU `businessDate` UTC-midnight kanonik yang sama untuk `shift.date`, `settlement.date`, dan query.
- **Bayar saat 0-shift**: diblokir "buka shift dulu" (bug #5).
- **Reopen shift yang salah-tutup** (REVISED, D12): **diizinkan** selama masih dalam window tipe-nya & tidak ada shift open (§6). Bukan lagi dead-end; owner override tidak diperlukan untuk kasus ini.
- **Dashboard atribusi by `shift.date`** (PROMOTED ke in-scope, bukan "verify-only"): query revenue owner/cashier dashboard memakai `paidAt`/`createdAt` jam dinding (`getOwnerReport`, `getCashierDashboard`). Setelah re-stamp, kunci atribusi = `shift.date`. Ganti filter `paidAt: gte/lt` → join `transaction.shift.date` supaya settlement & dashboard tidak beda tiap pembayaran lewat tengah malam.
- **Owner ubah window saat shift jalan**: `updateSettings` upsert tanpa syarat → menurunkan changeover bisa men-strand meja yang lagi makan. Mitigasi: window edit hanya mengubah aturan BUKA ke depan (tidak mempengaruhi shift yang sudah open / order yang sudah dibuat); pertimbangkan warning kalau ada shift open.
- **Config window degenerate** (`malamEnd == changeover`, atau `= 00:00`): tambah guard Zod (tolak malam window kosong/penuh ambigu; normalisasi inferensi cross-midnight).
- **Stale open tx dari business day SEBELUMNYA**: kalau ada tx open tertinggal dari hari lalu lalu dibuka shift baru hari ini, re-stamp bisa memindahkan ke hari baru (item ter-decrement hari-1, revenue hari-2). Aturan: tutup `final` business day memaksa beresin semua tx open (§8.1), jadi carryover lintas-hari seharusnya tidak terjadi; defensif, surface tx open "yatim" terpisah.
- **Takeaway di modal tutup-final**: `listTransactionsByTable` hard-filter `dineIn`+meja non-null. Endpoint daftar tx-open untuk modal harus sertakan bucket "Takeaway" (server-side grouping di payload 409).

---

## 11. Di Luar Scope (Sengaja)

- **Refund / komplain pelanggan** (D13): tidak ada pencatatan/alur refund apa pun. Void dibatasi ke business day yang belum di-settle (§7.5).
- **Owner reopen/override settlement yang SUDAH di-review** (membatalkan rekap final) — fitur terpisah. (Reopen *shift* salah-tutup TETAP in-scope via window, §6/§10.)
- Redesign besar dashboard. **Tapi** perbaikan atribusi `paidAt → shift.date` (§10) **IN-SCOPE** (koreksi correctness, bukan sekadar verifikasi).
- Perubahan alur split-tender / merge selain penyederhanaan §7.4 + invariant atribusi parent-only.
- Pemisahan "deferred settlement" Gojek/Grab (D14 — tetap metode biasa).
- Migrasi data historis transaksi: `shiftId` lama tidak di-re-stamp retroaktif. **Local dev MAUPUN PROD live TIDAK boleh di-reset/re-seed** — keduanya sudah berisi data asli (user mengonfirmasi local-nya sudah diisi data riil). Hanya `prisma db push` **aditif** (tanpa `--force-reset` / `migrate reset`); seluruh perubahan schema redesign ini non-destruktif (kolom baru + unique di kolom nullable/ter-cek) → tidak ada baris yang dihapus, tidak ada prompt `--accept-data-loss` (lihat §12).

---

## 12. Migrasi (PROD monosuko.my.id LIVE — hati-hati)

> ⚠️ Prod jalan sejak REV 2.5/2.6 **tanpa unique apa pun di `shifts`** dan AppSetting belum punya field window. `prisma db push` yang menambah constraint ke tabel berisi data **bisa GAGAL** (duplicate) atau **men-strand** singleton. **Prod MAUPUN local dev tidak boleh di-reset/re-seed** — keduanya berisi data asli. Semua perubahan schema redesign ini aditif → cukup `db push` biasa (TANPA `--force-reset`). Urutan WAJIB (berlaku untuk local dulu, lalu prod):

1. **Backup** dulu: `mysqldump` tabel `shifts`, `settlements`, `app_settings`, `transactions` via SSH tunnel.
2. **AppSetting backfill aman**: deklarasikan 4 field baru dengan `@default` di schema (`timezone="Asia/Jakarta"`, `shiftPagiStart="07:00"`, `shiftChangeover="18:00"`, `shiftMalamEnd="23:00"`) supaya `db push` mengisi otomatis ke row id=1 yang sudah ada. Seed `update:{}` saat ini no-op → JANGAN andalkan seed; pakai `@default` + `getSettings` defensif. Tambah kolom `Shift.activeMarker Int?` (nullable, default null) — aman, tidak ada data lama yang bentrok.
3. **Pra-migrasi `Settlement.@@unique([date])`**: jalankan deteksi `SELECT date, COUNT(*) c FROM settlements GROUP BY date HAVING c>1`. Kalau ada, audit & merge manual SEBELUM apply unique.
4. **`Shift.@@unique([activeMarker])`**: aman ditambah karena `activeMarker` nullable & semua baris lama `NULL` (MySQL izinkan banyak NULL). Set `activeMarker=1` untuk baris yang `closedAt IS NULL` saat migrasi — TAPI dulu deteksi `SELECT (closedAt IS NULL) AS open, COUNT(*) FROM shifts WHERE closedAt IS NULL` → kalau >1 shift open tersisa di prod, **resolve manual** (tutup yang basi) sebelum set marker, agar unique tidak langsung dilanggar.
5. **Existing OPEN transactions** saat cutover: idealnya deploy di jam tutup. Kalau tidak, jalankan `cleanup-empty-tx` + pastikan tx open ter-attach shift open valid; sesuaikan filter modal tutup-final.
6. Script dedup idempotent (pola seperti `migrate-banks-from-history.ts`): deteksi → resolve → re-assert nol duplikat, dijalankan via SSH tunnel, diverifikasi sebelum apply constraint.
7. Server TZ jadi tidak relevan (semua via `timezone` setting) — tetap catat untuk verifikasi.

---

## 13. Modul Tersentuh (ringkas)

**Backend:** `prisma/schema.prisma`, `modules/settings/*`, `modules/shifts/*` (+ helper waktu baru), `modules/transactions/*`, `modules/settlements/*`, `modules/dashboard/*` (verifikasi).
**Frontend:** `components/OpenShiftDialog.tsx`, `pages/POSPage.tsx`, `components/payment-methods/` (tab Jam Shift baru), `components/ShiftChangeReminder.tsx` (baru), modal tutup-diblokir (baru), `pages/SettlementPage.tsx`, `services/settingsService.ts`, `services/shiftService.ts`.

---

## 14. Bug → Fix Mapping

| Bug | Fix |
|---|---|
| #1 race / no unique | Penjaga single-OPEN `@@unique([activeMarker])` + catch P2002 (§4.2, REVISED) |
| #2 transisi terkunci | Single-active P1 (§3) + gate disederhanakan (§9) |
| #3 TZ server | `timezone` setting + helper resto-local (§5) |
| #4 revenue nyangkut | Re-stamp shiftId saat bayar, atomic (§7.3) |
| #5 tutup tanpa cek tx open | Blokir tutup-final + 409 daftar (§8.1) + bayar butuh shift open + lock close↔pay (§7.3) |
| #6 cakupan settlement | Settlement whole-business-day, keyed by date (§8.2) |

---

## 15. Edge-Case Hardening (hasil sweep adversarial 2026-05-29)

Sweep multi-agen (8 lensa + verifikasi adversarial, 32 temuan terkonfirmasi) memvalidasi desain & menambah daftar hardening berikut. Checklist ini WAJIB tercermin di implementation plan (banyak sudah dilipat ke §4–§12 di atas; di sini sebagai indeks).

**🔴 Kritis (mengoreksi desain / blocker prod):**
- [ ] Single-OPEN guard `activeMarker` (ganti `@@unique([date,type])`) — §4.2. *(menutup race bug #1 + lubang single-active + dead-end reopen sekaligus)*
- [ ] Dedup pra-migrasi `shifts` + backup prod — §12.
- [ ] AppSetting 4 field via `@default` (bukan seed no-op) + `getSettings` backfill — §4.1/§12.
- [ ] Settlement `@@unique([date])` + guard `findFirst({date})` transaksional — §8.2.
- [ ] Handover-close authorization (boleh tutup shift orang lain saat `mode='handover'`) — §8.1.

**🟠 High (correctness):**
- [ ] `addPayment` atomic: read+insert+finalize+restamp dalam 1 `$transaction` + lock parent; finalize idempotent — §7.3.
- [ ] Lock close ↔ pay pada baris shift sama (cegah bayar nyelip ke shift yang ditutup) — §7.3.
- [ ] `computeBankBreakdown` → whole-day (`businessDate`) di 5 call-site + smoke test bank==metode — §8.2.
- [ ] Re-key preview/createSettlement/SettlementPage ke business date (bukan `shiftId`/`shifts[0]`) — §8.2.
- [ ] Permission settle = penutup shift terakhir (by `closedAt`) / owner; hapus cek `type===malam` — §8.2.
- [ ] Baseline modal awal di preview (Σ openingCash hari itu) — §8.2 *(konfirmasi konvensi handover float saat review)*.
- [ ] Dashboard atribusi `paidAt → shift.date` — §10 (PROMOTED in-scope).
- [ ] Void dibatasi (block kalau hari sudah settle; no refund) — §7.5.
- [ ] `['shifts','active']` freshness lintas-device (refetchInterval / invalidate on 409) — §9.
- [ ] OpenShiftDialog: settings query + loading + fail-closed + useEffect recompute — §9.
- [ ] Host + parsing 409 daftar tx-open untuk modal tutup-final — §9.
- [ ] `todayBusinessDate()` window-aware untuk malam after-midnight — §10.
- [ ] Invariant `mergeBills`: atribusi parent-only (eksplisit + tes target=carryover) — §7.4.

**🟡 Polish:**
- [ ] Auto-select OpenShiftDialog saat 0 tipe openable → empty state — §9.
- [ ] ShiftChangeReminder dismissal key per-`shiftId` — §9.
- [ ] Client window advisory-only (clock skew) — §9.
- [ ] Owner edit window saat shift open → warning / hanya pengaruh ke depan — §10.
- [ ] Zod guard config window degenerate — §10.
- [ ] Takeaway bucket di payload modal tutup-final — §10.
- [ ] Stale open tx lintas-hari → surface terpisah (defensif) — §10.

**Ditolak (keputusan user, JANGAN diimplement):**
- Mesin refund / pencatatan komplain (D13).
- Pemisahan "deferred settlement" Gojek/Grab (D14).
- Owner force-reopen sebagai satu-satunya recovery reopen (digantikan reopen-by-window, D12).
