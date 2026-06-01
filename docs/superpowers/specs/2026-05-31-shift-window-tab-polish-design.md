# Design Spec - ShiftWindowTab UI Polish (REV 2.12)

**Tanggal:** 2026-05-31
**Branch:** `feat/owner-self-service-rev212`
**Scope:** Frontend-only, presentational. Tidak ada perubahan backend/schema/perilaku.
**Status:** Approved (brainstorming) - siap masuk writing-plans.

## Konteks

Tab "Jam Shift" di halaman **Pembayaran** (owner-only) adalah tab ke-4 dari 4 tab
form/konfigurasi: Metode, Bank, Pajak, **Jam Shift**. Tab ini paling baru
([ShiftWindowTab.tsx](../../../frontend/src/components/payment-methods/ShiftWindowTab.tsx))
dan tampil tidak konsisten + jelek dibanding saudaranya, terutama tab **Pajak**
([TaxSettingsTab.tsx](../../../frontend/src/components/payment-methods/TaxSettingsTab.tsx))
yang jadi acuan "gold standard" untuk form settings.

Feedback owner (Ezra):
1. Form **mencong** - dua input jam tidak rata atas.
2. **Teks label tidak jelas** - minta label deskriptif.
3. **Timezone berupa input teks** - minta dropdown.
4. **Layout tidak di tengah** - minta konsisten dengan layout page lain (yang centered).

## Diagnosis akar masalah

| Gejala | Akar masalah |
|---|---|
| Form mencong | `grid grid-cols-2` dengan dua `Input` ber-label panjang berbeda. Label "Pergantian (akhir pagi = awal malam)" wrap 2 baris, sedang "Shift 1 (Pagi) mulai" 1 baris. Karena `Input` menumpuk label-di-atas-field, field kotak yang label-nya lebih panjang ter-dorong **turun** → tidak rata atas. |
| Tidak di tengah | Semua page nyata di app membungkus konten dalam container **centered** `max-w-{N}xl mx-auto` (OwnerDashboard `max-w-6xl`, BillsPage/SettlementPage `max-w-3xl`, dst). Tab Jam Shift (dan Pajak) pakai `max-w-xl` **tanpa `mx-auto`** → menempel kiri, ruang kosong di kanan. |
| Timezone input teks | Field bebas-ketik rawan typo + terlihat tidak rapi. Resto satu lokasi di Indonesia → cukup 3 zona waktu Indonesia. |
| Teks tidak jelas | Label teknikal ("Shift 1 (Pagi) mulai", "Shift 2 (Malam) tutup") kurang plain-language. |

## Keputusan desain

Pendekatan terpilih: **Polish + input lebih rapi** (bukan minimal, bukan redesign timeline).
Frontend-only, satu file utama + satu file saudara untuk konsistensi.

### 1. Center layout (+ konsistensi tab Pajak)
- `ShiftWindowTab`: bungkus konten jadi `max-w-2xl mx-auto` (≈672px, centered).
- `TaxSettingsTab`: ubah `max-w-xl` (kiri) → `max-w-2xl mx-auto` (centered) **juga**, supaya
  saat owner pindah antar dua tab form tidak ada loncatan layout. Ini satu-satunya
  perubahan di file Pajak - murni wrapper centering, tidak menyentuh logika/field.
- Container luar tetap `p-3 sm:p-4 space-y-3` (sama seperti sekarang), `max-w-xl` diganti
  `max-w-2xl mx-auto`.

### 2. Hilangkan "mencong" - stack 3 input jam vertikal (full-width)
Buang `grid grid-cols-2` sepenuhnya. Tiga input jam disusun satu kolom, masing-masing
baris sendiri, full-width. Tidak ada lagi ketergantungan tinggi-label antar kolom →
bug rata-atas hilang total. Label baru (plain language, sesuai permintaan owner):

| Field state | Label | Helper |
|---|---|---|
| `shiftPagiStart` (07:00) | **Jam Buka Shift Pagi** | - |
| `shiftChangeover` (18:00) | **Jam Pergantian Shift** | "Akhir shift pagi sekaligus awal shift malam" |
| `shiftMalamEnd` (23:00) | **Jam Tutup Shift Malam** | Cross-midnight note saat `malamEnd ≤ changeover`: "Lewat tengah malam" |

Input tetap native `type="time"` (UX terbaik di HP - POS mobile-first). Tetap memakai
primitive `Input` (label + helper bawaan).

### 3. Timezone → dropdown (`Select` primitive)
- Label diganti **"Zona waktu"**.
- Ganti `Input` free-text → `Select` (native-wrapper, sudah di design-system; cocok untuk
  ≤3 opsi sesuai dokumentasi primitive-nya, dan tinggi/border match `Input`).
- Opsi:
  - `Asia/Jakarta` → label "WIB · Asia/Jakarta" (default, zona resto)
  - `Asia/Makassar` → label "WITA · Asia/Makassar"
  - `Asia/Jayapura` → label "WIT · Asia/Jayapura"
- **Robustness:** kalau nilai tersimpan dari server bukan salah satu dari 3 di atas,
  inject nilai itu sebagai opsi ke-4 (`{value: tz, label: tz}`) supaya tidak hilang
  diam-diam saat owner buka & simpan.

### 4. Header → samakan dengan tab Pajak
- Ganti `flex items-center gap-2` → `flex items-start gap-3`.
- Icon box dapat `shrink-0`; blok judul `min-w-0 flex-1`.
- Teks judul/caption tetap: "Jam Shift" / "Owner atur batas jam buka shift."

### 5. Validasi - dipertahankan, hanya direlokasi
- `contiguousOk = toMin(pagiStart) < toMin(changeover)` → error "Jam mulai pagi harus
  sebelum jam pergantian." tetap tampil + tetap men-disable tombol Simpan.
- `crossMidnight = toMin(malamEnd) <= toMin(changeover)` → indikator pindah jadi **helper**
  di field "Jam Tutup Shift Malam" ("Lewat tengah malam"), bukan helper terpisah.
- Info note bawah (`bg-info-50`) + tombol Simpan (`flex justify-end`, primary, loading state)
  tetap.

## Yang TIDAK berubah (out of scope)
- Backend `settings` service/schema, `settingsService.update` (sudah dukung partial update).
- Tidak ada field baru, tidak ada migrasi DB.
- Tidak menyentuh tab Metode/Bank (sudah konsisten - DataTable full-width).
- Tidak membuat primitive baru (tidak ada custom time picker / timeline).

## File terdampak
- `frontend/src/components/payment-methods/ShiftWindowTab.tsx` - rewrite presentational.
- `frontend/src/components/payment-methods/TaxSettingsTab.tsx` - wrapper centering (`max-w-2xl mx-auto`).
- `frontend/src/components/payment-methods/RestaurantIdentityTab.tsx` - wrapper centering (`max-w-2xl mx-auto`).
  Ditambahkan atas permintaan owner ("identitas juga") supaya KEEMPAT tab form (Pajak,
  Jam Shift, Identitas) seragam centered. Header/label/field tab ini sudah konsisten -
  hanya centering yang kurang.

## Verifikasi (definition of done)
1. `cd frontend && npx tsc --noEmit` → 0 error.
2. `cd frontend && npm run build` (vite) → SUCCESS.
3. `cd frontend && npm run lint` → 0 error pada file terdampak.
4. Manual e2e browser (owner login → Pembayaran → tab Jam Shift):
   - Card di tengah, sejajar saat pindah ke tab Pajak (dua-duanya centered).
   - Tiga input jam rata (tidak mencong).
   - Dropdown Zona waktu tampil 3 opsi WIB/WITA/WIT; nilai tersimpan ter-preselect.
   - Ubah pergantian < pagi → error muncul + Simpan disabled.
   - `malamEnd ≤ changeover` → helper "Lewat tengah malam" muncul.
   - Simpan → toast "Jam shift disimpan", nilai persist setelah refetch.

## Referensi konsistensi (Frontend Consistency Mandate)
- Form acuan: [TaxSettingsTab.tsx](../../../frontend/src/components/payment-methods/TaxSettingsTab.tsx)
- Centered container: [BillsPage.tsx](../../../frontend/src/pages/BillsPage.tsx) `max-w-3xl mx-auto`, [SettlementPage.tsx](../../../frontend/src/pages/SettlementPage.tsx)
- Primitive: `Input`, `Select`, `Button`, `Skeleton` dari `@/design-system/primitives`
