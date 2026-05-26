# Shift Decoupling Design - Memisahkan "Pemilik Shift" dari "User yang Input Order"

> **Status:** Design approved by Ezra 2026-05-25. Implementation plan akan disusun di sesi berikutnya (pakai writing-plans skill).
>
> **Context:** Hasil brainstorming pendek setelah ditemukan flop di POSPage saat owner login: redirect ke /dashboard tapi tidak ada CTA buka shift karena per permission matrix REV 2.3 owner bukan kasir. Dialog ditulis di handoff session 2026-05-25.

## Masalah Awal

Sistem REV 2.3 (yang sudah diimplement Phase 4a) punya **inconsistency tersembunyi**:

- **Permission matrix REV 2.3** bilang: input order POS = semua role (owner ✓, kasir ✓, waiter ✓).
- **Schema saat ini** punya `Transaction.shiftId` NOT NULL FK. Setiap transaksi WAJIB attach ke shift.
- **Backend `getActiveShift(userId)`** return shift di mana `cashierId = user.id`. Owner tidak punya shift (owner bukan kasir, owner tidak boleh buka shift per matrix).
- **POSPage gate** cek "user yang login punya active shift?" → owner dapat `null` → redirect ke `/dashboard`.
- **Dashboard owner** tidak punya CTA buka shift (konsisten matrix).
- **Result:** owner stuck di loop, tidak bisa input order meski permission mengizinkan.

Akar masalah: `Transaction.cashierId` field saat ini sebenarnya berisi **user yang submit** (`cashierId: userId` di line 334 service), bukan **kasir pemilik shift**. Namanya `cashierId` itu misleading. Konsep "siapa yang input" dan "shift siapa" tercampur di satu field.

## Keputusan Desain

### Prinsip 1 - Dua field semantik berbeda di Transaction

| Field | Isi | Untuk apa |
|---|---|---|
| `Transaction.shiftId` | ID shift fiskal yang aktif saat order dibuat | Settlement & rekap uang masuk. Konteks "kasir mana yang pegang cash hari itu". |
| `Transaction.createdById` (rename dari `cashierId`) | ID user yang submit order | Audit trail. Untuk dispute "siapa yang input transaksi ini". Bisa kasir sendiri, owner, atau waiter. |

Real shift cashier accessible via `Transaction → shift → cashier.id`. Tidak duplikat field.

### Prinsip 2 - Active shift adalah konsep system-wide, bukan per-user

- Backend query: `SELECT shifts WHERE closedAt IS NULL`.
- Idealnya 1 row aktif. Kadang 2 (saat transisi pagi-malam overlap). Tidak pernah dibatasi by-user.
- Owner/waiter input order → attach ke shift aktif yang ada (siapapun pemiliknya).

### Prinsip 3 - Permission matrix REV 2.3 TIDAK BERUBAH

- "Buka kasir" tetap kasir-only. Owner ✗, waiter ✗.
- Modal awal cash adalah konsep kasir-only (siapa yang pegang cash drawer). Owner/waiter tidak relevan.
- Owner datang tanpa kasir aktif = tidak bisa input order. Telpon kasir untuk buka shift (kasir bisa buka dari HP).
- Worst-case ekstrim (owner mutlak butuh input + tidak bisa hubungi kasir): pakai akun kasir sebagai hack manual. Tidak dibangun fitur formal - YAGNI.

### Prinsip 4 - Maksimal 1 shift aktif saat input order

- Buka shift baru saat shift lain belum tutup: boleh (realita pergantian shift sering overlap sebentar).
- Tapi input order saat ada 2+ shift aktif: **DITOLAK** dengan pesan "Ada N shift aktif, tutup salah satu dulu. Rekap fiskal jadi ambigu kalau dibiarkan."
- Memaksa kasir tutup shift lama sebelum lanjut input.

## Alur Harian (Narratif Lengkap)

Cerita berikut adalah ground truth flow yang harus didukung sistem. Setiap step disepakati Ezra 2026-05-25.

### Pagi sebelum jam 10
Resto belum buka. Belum ada siapa-siapa yang login. **Belum ada shift aktif** di sistem.

### Jam 09:45 - Jason (kasir shift pagi) datang
1. Jason login pakai akun dia (nama "Jason" + PIN).
2. Beranda Jason (Cashier Dashboard) menampilkan card besar: **"Belum buka kasir"** dengan tombol **"Buka Kasir Sekarang"**.
3. Jason pencet tombol. Muncul form: pilih shift (Pagi/Malam) + input modal awal cash (mis. Rp 500.000).
4. Jason submit. Sistem create shift: `Jason, pagi, 25-Mei-2026, modal awal 500.000, closedAt=null`.
5. Beranda Jason refresh: **"Shift Pagi aktif sejak 09:45"** + 3 action card (Input Order / Transaksi Open / Tutup Kasir) + ringkasan hari ini (zero, baru mulai).

### Jam 10:00 - Customer pertama datang
6. Waiter (Amel) bawa kertas pesanan dari Meja 3 ke Jason.
7. Jason buka POS, pilih Meja 3, input pesanan.
8. Sistem auto-attach transaksi ke shift Jason (cuma 1 shift aktif, otomatis pakai dia). Transaksi tercatat dengan `createdBy = Jason`, `shiftId = shift Jason`.
9. Customer bayar cash. Jason proses payment.

### Jam 11:30 - Owner mampir ke resto
10. Owner login (akun "Owner" + PIN).
11. Beranda Owner (Owner Dashboard): revenue hari ini, breakdown payment, dll. **Tidak ada CTA buka shift** untuk dia.
12. Di panel kecil dashboard, Owner lihat info: **"Shift aktif: Jason (pagi) sejak 09:45 · 5 transaksi · Rp 850.000"**. Owner tahu konteks kasir yang sedang aktif.
13. Owner pencet menu "Kasir" (POS). Karena ada shift aktif (Jason), Owner langsung bisa input order. Misal temannya datang, Owner sendiri yang catat - transaksi tetap **attach ke shift Jason**, tapi `createdBy = Owner`. Dispute future: terlihat Owner yang input, uang masuk rekap Jason.

### Jam 15:00 - Owner pulang, Jason masih lanjut
14. Tidak ada perubahan. Jason tetap kasir aktif.

### Jam 17:30 - Pergantian shift normal (no overlap)
15. Jason hitung uang fisik di laci, **tutup shift** lewat menu Tutup Kasir.
16. Sistem mark shift Jason `closedAt = sekarang`. Sementara tidak ada shift aktif.
17. Bryant (kasir shift malam) datang. Login. Beranda: "Belum buka kasir" → pencet tombol → buka shift malam dengan modal awalnya (mis. 300.000).
18. Sistem create shift Bryant. Sekarang shift aktif = Bryant.

### Jam 22:00 - Akhir hari, Bryant tutup + settlement
19. Bryant tutup shift dia.
20. Bryant masuk halaman Settlement. Sistem tampilkan rekap: 6 metode pembayaran dari semua transaksi shift Bryant (jam 17:30-22:00).
21. Bryant hitung uang fisik per metode, input ke form. Sistem hitung variance.
22. Bryant submit settlement → besoknya Owner review.

**Catatan settlement:** settlement Bryant hanya merekap transaksi shift Bryant. Transaksi shift Jason (pagi) ada di settlement terpisah kalau Jason juga jalankan settlement. Saat ini ground truth REV 2.3 bilang "settlement hanya kasir shift malam, sekali per hari" - ini berarti shift pagi Jason tidak punya settlement formal, transaksi pagi cuma terhitung di total revenue Owner Dashboard tapi tidak ada blind count fisik. **Open question:** apakah shift pagi juga perlu settlement? Atau cukup shift malam saja? (Lihat seksi Open Questions di bawah.)

## Edge Cases yang Harus Didukung

### Edge case 1 - Pergantian shift overlap
- Jam 17:30 Bryant datang tapi Jason belum sempat tutup karena masih proses customer.
- Bryant login → buka shift malam → sukses. Sekarang **2 shift aktif: Jason (pagi) + Bryant (malam)**.
- Jason coba input order baru → **DITOLAK**: "Ada 2 shift aktif. Tutup salah satu dulu."
- Bryant juga coba input → ditolak dengan pesan sama.
- Jason buru-buru tutup shift dia. Sekarang cuma Bryant aktif. Bryant lanjut input.

### Edge case 2 - Owner datang sebelum kasir buka shift
- Owner datang jam 09:30 (kasir belum datang).
- Login. Beranda normal. Panel "Shift hari ini" kosong: **"Belum ada shift kasir aktif hari ini."**
- Owner pencet menu Kasir (POS). POS tampilkan card info (icon info biru, bukan warning):
  > **"Belum ada shift kasir aktif."**
  > "Kasir harus buka shift dulu sebelum order bisa dimasukkan. Hubungi salah satu kasir."
- Owner tidak bisa input. **Tidak ada tombol "Buka Shift" untuk Owner.** Worst case: telpon kasir.

### Edge case 3 - Waiter mau bantu input (kasir sibuk telepon)
- Sudah ada shift aktif (Jason).
- Waiter (Amel) login.
- Beranda Waiter: 2 card besar (Stok Porsi + Raw Materials), link kecil "Input Order fallback" di bawah.
- Amel pencet link → POS. Karena ada shift aktif, Amel bisa input order - transaksi attach ke shift Jason, `createdBy = Amel`.

### Edge case 4 - Waiter datang tanpa kasir aktif
- Sama dengan Edge case 2. Waiter dapat card info, tidak bisa input. Tidak ada tombol buka shift.

## Tiga Prinsip yang Dipegang Sistem (Ringkas)

1. **Satu hari = beberapa shift, tapi tidak overlap saat input.** Shift boleh overlap saat transisi, tapi input order ditahan kalau ada 2+ aktif.
2. **Shift = milik kasir (siapa pegang cash drawer).** Owner/waiter tidak punya shift sendiri. Numpang ke shift kasir aktif.
3. **Setiap transaksi tercatat dua hal terpisah:** masuk ke shift mana (rekap uang) + diinput oleh siapa (audit dispute).

## Schema Changes (Ringkas)

Cuma 1 field di-rename di Prisma schema. Detail teknis di-defer ke implementation plan.

```diff
 model Transaction {
   id             Int               @id @default(autoincrement())
   shiftId        Int               @map("shift_id")
   orderType      OrderType         @map("order_type")
   tableNumber    Int?              @map("table_number")
-  cashierId      Int               @map("cashier_id")
+  createdById    Int               @map("created_by_id")
   status         TransactionStatus @default(open)
   ...
 }

 model User {
-  transactions Transaction[]   // relation "cashier"
+  transactionsCreated Transaction[]   // relation "createdBy"
 }
```

Tidak ada tabel baru. Tidak ada field baru. Cuma rename.

## API Contract Changes (Ringkas)

### `GET /api/shifts/active`
- **Sebelum:** `{ shift: Shift | null }` (per-user, return shift milik user yang login)
- **Sesudah:** `{ shifts: Shift[] }` (system-wide, return semua shift dengan `closedAt = null`)
  - Length 0: belum ada kasir buka shift
  - Length 1: happy path
  - Length 2+: ada overlap, butuh tutup salah satu

### `POST /api/transactions` (create)
- **Sebelum:** payload include `shiftId` (frontend kirim)
- **Sesudah:** payload TIDAK include `shiftId`. Backend auto-resolve dari "shift aktif satu-satunya". Kalau 0 atau 2+ active shifts, throw 400/409.

### `TransactionView` response shape
```diff
 {
   id, shiftId, orderType, tableNumber, status, ...
-  cashierId, cashierName,
+  createdById, createdByName,
+  shiftCashierName,  // denormalize dari shift.cashier.name untuk UI
 }
```

## Migration Strategy

DB development (REV 2.x), tidak ada production data:
```bash
cd backend
npm run prisma:push -- --force-reset
npm run db:seed
```

Bersih, tidak perlu SQL ALTER manual. Semua data transaksi hilang dan di-seed ulang.

## Permission Matrix REV 2.3 - TIDAK BERUBAH

Dokumen [docs/operasional-resto.md](../../operasional-resto.md) permission matrix tetap utuh. "Buka kasir" tetap kasir-only.

Yang berubah cuma **implementasi gate POSPage** - sebelumnya pakai logika per-user (yang accidentally restrict owner/waiter), sekarang pakai logika system-wide.

## UI / UX Changes (Ringkas, Tanpa Kode)

### POSPage gate - 3 case render

| Active shifts count | Cashier sees | Owner sees | Waiter sees |
|---:|---|---|---|
| 0 | Card "Belum buka kasir" + tombol **"Buka Kasir Sekarang"** (modal inline, tidak redirect) | Card info "Belum ada shift kasir aktif. Hubungi kasir." Tidak ada CTA. | Sama dengan owner. |
| 1 | Masuk ke menu grid POS (happy path) | Sama. | Sama. |
| 2+ | Card warning "Ada N shift aktif, tutup salah satu dulu" + link ke halaman tutup shift | Sama. | Sama. |

### CashierDashboard
- Tetap punya CTA buka shift kalau kasir belum punya shift aktif (cek `shifts.some(s => s.cashierId === me.id)`).
- Kalau ada shift aktif di sistem tapi bukan punya kasir login, tampilkan info: "Shift aktif: [nama kasir lain]" - kasir aware ada overlap.

### OwnerDashboard
- Tambah panel kecil "Shift hari ini":
  - 0 shift: "Belum ada shift kasir aktif hari ini."
  - 1 shift: "Aktif: Jason (pagi) sejak 09:45 · 5 transaksi · Rp 850k"
  - 2+ shift: "⚠ Ada 2 shift aktif" + list, dengan link "Tutup paksa" untuk owner (owner bisa force-close).

### Layout (sidebar/header)
- Indicator kecil shift aktif (opsional, nice-to-have): 🟢 + nama kasir aktif. Bisa di sidebar footer atau di header.

### HistoryPage
- Tampilan baris transaksi: ganti "oleh {cashierName}" jadi "oleh {createdByName} · shift {shiftCashierName}".
- Sehingga jelas terlihat kalau yang input ≠ pemilik shift.

## Komponen yang Perlu Dibuat / Direfactor (List, Bukan Kode)

| Komponen | Status | Catatan |
|---|---|---|
| `<OpenShiftDialog>` | EXTRACT | Sekarang inline di CashierDashboard. Extract jadi komponen reusable supaya POSPage juga bisa pakai. |
| `<NoActiveShiftGate>` | NEW | Card untuk owner/waiter saat 0 shift aktif. |
| `<MultipleActiveShiftsWarning>` | NEW | Card untuk semua role saat 2+ shift aktif. |
| `POSPage` gate logic | REFACTOR | Ubah dari "user own shift" jadi "system-wide active shifts". 3 case explicit render. |
| `OwnerDashboard` shift panel | NEW | Tambah panel "Shift hari ini" di OwnerDashboard. |
| `shiftService.getActiveShifts` | REFACTOR | Return array, bukan single. Frontend handle 0/1/2+. |
| `transactionService.create` | REFACTOR | Hapus `shiftId` dari payload - backend auto-resolve. |
| Type `Transaction` di frontend | REFACTOR | Rename field `cashierId/cashierName` → `createdById/createdByName` + tambah `shiftCashierName`. |
| Layout shift indicator (opsional) | NEW | Nice-to-have, bisa skip dulu. |

## Open Questions (Untuk Diskusi Lain Hari)

Beberapa hal yang sengaja TIDAK saya putuskan di spec ini - perlu diskusi terpisah:

1. **Apakah shift pagi juga perlu settlement?** Ground truth REV 2.3 saat ini bilang "settlement hanya kasir shift malam, sekali per hari". Artinya transaksi pagi tidak punya blind count fisik. Apakah ini cukup atau perlu settlement per-shift?

2. **Apakah perlu indicator shift aktif di Layout (sidebar/header)?** Nice-to-have tapi nambah real-estate. Skip dulu di iterasi pertama?

3. **Bagaimana kalau owner mau force-close shift orang lain?** Sudah ada di backend (`closeShift` dengan role check), tapi UI-nya belum ada. Mau ditambahkan di OwnerDashboard?

4. **Migration data riil:** kalau di production sudah ada transaksi (post-launch), apakah `cashierId` lama otomatis di-map ke `createdById` baru? Untuk dev: force-reset cukup. Production migration plan: di-defer.

## Yang TIDAK Termasuk Scope Spec Ini

- Backend authentication/authorization (sudah final REV 2.3)
- Settlement form refactor (sudah dilakukan di Pass 8 frontend rebuild)
- HPP / cost tracking (out of scope REV 2.3)
- Multi-tenancy / multi-restoran (out of scope skripsi)

## Status & Next Step

✅ **Design approved** - Ezra 2026-05-25 via brainstorming session.

**Sesi berikutnya:**
1. Convert design ini jadi implementation plan via `superpowers:writing-plans` skill.
2. Plan akan pecah jadi step-by-step task: schema migration, backend service refactor, frontend service+component refactor, verification (tsc/build/manual smoke test).
3. Eksekusi pelan-pelan, satu phase di-review user sebelum lanjut.

## Referensi

- Ground truth bisnis: [docs/operasional-resto.md](../../operasional-resto.md) (REV 2.3)
- Permission matrix awal: [docs/superpowers/specs/2026-05-24-permission-matrix-design.md](2026-05-24-permission-matrix-design.md)
- Schema saat ini: [backend/prisma/schema.prisma](../../../backend/prisma/schema.prisma) (model Shift line 298, model Transaction line 326)
- Service shift saat ini: [backend/src/modules/shifts/shifts.service.ts](../../../backend/src/modules/shifts/shifts.service.ts)
- POSPage saat ini: [frontend/src/pages/POSPage.tsx](../../../frontend/src/pages/POSPage.tsx)
