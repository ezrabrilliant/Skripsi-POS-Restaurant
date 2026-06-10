# Settlement Seal — Cegah Transaksi Bocor Setelah Setor (Reopen-After-Settle)

**Tanggal:** 2026-06-10
**Status:** Design (brainstorming) — disetujui untuk lanjut ke plan
**Topik:** Bug: buka shift lagi di hari yang sama setelah settlement → transaksi baru tidak terhitung di rekonsiliasi.

---

## 1. Masalah

Settlement REV 2.7 di-key **1 per hari-bisnis** (`Settlement @@unique([date])`), bukan per buka-tutup shift. Alur bug:

1. Kasir buka shift (mis. malam), input + bayar transaksi, tutup shift.
2. Kasir setor (**settlement submitted** untuk tanggal hari ini) → angka sistem **dibekukan** ke child table `settlement_method_counts`.
3. Kasir **buka shift LAGI di tanggal yang sama** (`openShift` hanya cek `activeMarker` + jam window — tidak cek "hari ini sudah disetor").
4. Input + bayar transaksi baru.
5. Tutup shift → masuk halaman setor: `createSettlement` nolak (409, settlement tanggal ini sudah ada). Transaksi baru **tidak pernah masuk rekonsiliasi uang**.

### Gejala yang teramati (data #111, 2026-06-10)

Settlement #111 dibuat saat hanya ada Tx #452 (Tunai 54.000). Setelah reopen, Tx #453 (EDC BCA 60.000) masuk. Hasilnya kartu settlement **kontradiktif**:

- **`methodCounts` (tabel Sistem/Fisik/Selisih) = beku** → hanya Tunai 54.000. Tidak ada baris EDC.
- **`bankBreakdown` = dihitung LIVE** tiap buka detail (`computeBankBreakdown(s.date)`) → ikut nampilin **EDC BCA 60.000**.

Jadi ada "EDC BCA 60.000" di breakdown, tapi tak ada baris EDC di rekonsiliasi, dan 60.000 itu tak pernah dihitung-uang.

### Akar masalah

Dua lapis kebocoran:

- **Proses:** hari yang sudah disetor masih menerima transaksi baru (lewat reopen shift).
- **Data:** `bankBreakdown` live padahal `methodCounts` beku → inkonsisten dalam satu kartu.

### Bukan soal pagi vs malam

Yang menentukan adalah **sebelum vs sesudah settlement**, bukan tipe shift:

- Reopen pagi/malam **sebelum** ada settlement → aman (semua tetap teragregasi ke settlement whole-business-day nanti).
- Reopen kapan pun **sesudah** settlement → bocor. Ini kasus bug-nya.

---

## 2. Wawasan kunci: void-after-settle sudah diblok

`transactions.service.ts:1026-1028` sudah menolak void bila `settlement.findFirst({ where: { date: existing.shift.date } })` ada:

> `'Business day transaksi ini sudah di-settle - tidak bisa diubah (refund di luar lingkup sistem)'`

**Implikasi:** kalau `openShift` juga disegel terhadap hari yang sudah disetor, maka setelah setor **tidak ada shift baru → tidak ada transaksi baru**, dan **tidak ada void**. Berarti himpunan transaksi tanggal itu benar-benar beku → `bankBreakdown` live otomatis sama dengan `methodCounts` beku. **Tidak perlu ubah skema / persist bankBreakdown.** Segel di `openShift` menutup kedua lapis kebocoran sekaligus.

---

## 3. Keputusan desain (sudah disepakati)

| # | Keputusan |
|---|-----------|
| Perilaku reopen sesudah setor | **Kunci total** — `openShift` tolak buka shift kalau hari-bisnis-nya sudah punya settlement. |
| Escape hatch | **Masuk scope sekarang** — owner boleh hapus settlement (un-seal hari itu). |
| Hardening "settle wajib semua shift tutup" | **Skip** — fokus ke bug utama; flow normal tutup-dulu-baru-setor. |

---

## 4. Rancangan

### 4.1 Guard utama — segel buka-shift (backend)

**File:** `backend/src/modules/shifts/shifts.service.ts` → `openShift`.

Tambah lookup ke `Promise.all` yang sudah ada (sejajar `openCount` & `pagiToday`):

```ts
const settledToday = await prisma.settlement.findFirst({
  where: { date: businessDate },
  select: { id: true },
});
```

Setelah `businessDate` dihitung dan sebelum membuat shift, kalau `settledToday` ada → lempar `AppError(409)`:

> `Hari ini (YYYY-MM-DD) sudah disetor. Buka shift untuk hari berikutnya, atau minta owner menghapus setoran kalau ada kekeliruan.`

Tanpa shift, POS gate existing otomatis memblokir transaksi baru. Ini inti perbaikan.

**Catatan:** cek ini berbasis DB (butuh `prisma`), jadi tetap di service `openShift`, **bukan** di fungsi murni `canOpenShift` (yang tanpa DB). Urutan cek: single-active & jam window dulu (existing), lalu seal. (Urutan tidak kritikal; seal boleh paling akhir agar pesan window/single-active tetap muncul saat relevan.)

### 4.2 Escape hatch — owner hapus setoran (backend)

**Endpoint baru:** `DELETE /api/settlements/:id` — **owner only**.

- `settlements.routes.ts`: `router.delete('/:id', ownerOnly, handleDelete)`.
- `settlements.controller.ts`: `handleDelete` → `parseId` → `settlementsService.deleteSettlement(id)`.
- `settlements.service.ts`: `deleteSettlement(id)`:
  - `findUnique({ where: { id } })`; kalau tidak ada → `notFound('Settlement')`.
  - `prisma.settlement.delete({ where: { id } })` — `settlement_method_counts` ikut terhapus via `onDelete: Cascade`.
  - Return `{ id }` atau void (controller balas pesan sukses).

Efek: tanggal itu **ter-buka lagi** → `openShift` boleh (seal hilang) **dan** void boleh (guard void hilang). Inilah yang bikin "kunci total" aman, bukan jebakan permanen.

**Pertimbangan:** boleh dihapus dalam status apa pun (`submitted`/`reviewed`)? Default desain: **boleh**, karena tujuannya koreksi kekeliruan; owner adalah otoritas tertinggi. (Bisa di-flag saat review spec kalau mau dibatasi hanya `submitted`.)

### 4.3 Frontend (tipis)

**a. `CashierDashboard`** — kalau hari ini sudah disetor, jangan tampilkan CTA "Buka Kasir" seolah hari masih jalan.
- Deteksi via `settlementService.list({ date: <today> })` atau preview existing → kalau ada settlement hari ini & tidak ada active shift, tampilkan kartu info *"Hari ini sudah disetor"* alih-alih tombol "Buka Kasir".
- Surface pesan error 409 dari `openShift` (kalau race) dengan rapi (toast/inline), bukan error mentah.

**b. `SettlementPage` detail** — tombol **"Hapus setoran"** (owner-only).
- Tampil hanya untuk `role === 'owner'`.
- Klik → konfirmasi (Dialog) → `settlementService.delete(id)` → invalidate query settlement + arahkan balik ke list / beranda.
- Audit existing 2-3 referensi modal konfirmasi sebelum bikin (mandate konsistensi frontend).

### 4.4 Tidak ada migrasi DB

Tidak ada perubahan skema. `settlement_method_counts.onDelete: Cascade` sudah cukup untuk delete bersih.

---

## 5. Lingkup & non-lingkup

**In scope:** guard `openShift` (4.1), endpoint DELETE settlement + service/controller/route (4.2), polish frontend CashierDashboard + tombol hapus owner (4.3).

**Out of scope:**
- Hardening "settle wajib semua shift hari itu tutup" (di-skip).
- Persist `bankBreakdown` / ubah skema (tidak perlu — lihat §2).
- Remediasi data #111: cukup data tes hari ini; biar fresh saat re-test atau owner hapus via endpoint baru.

---

## 6. Verifikasi (rencana)

- **Backend unit/smoke:**
  - `openShift` tolak 409 saat businessDate sudah ada settlement; tetap lolos saat belum.
  - `deleteSettlement` hapus settlement + cascade method counts; setelah hapus, `openShift` & void boleh lagi.
  - Permission: DELETE owner-only (kasir → 403).
- **Re-enact bug end-to-end:** buka→tx→tutup→setor→**coba buka lagi (harus 409)**; lalu owner hapus setor→buka lagi boleh→tx→tutup→setor ulang (angka lengkap, breakdown == counts).
- `tsc --noEmit` backend & frontend 0 error; `vite build` sukses; ESLint 0 error.
- Manual e2e browser (Playwright) skenario di atas.

---

## 7. Risiko

- **Race tipis:** dua request `openShift` paralel di sela settle. Dampak minim; settlement = aksi sadar manusia, dan guard ada di service. Tidak perlu lock khusus.
- **Owner hapus setoran reviewed:** menghapus jejak audit yang sudah di-review. Mitigasi: konfirmasi eksplisit di UI; owner = otoritas. (Re-evaluasi saat review spec bila perlu batasi.)
