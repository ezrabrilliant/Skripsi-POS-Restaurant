# Design Spec — POS UI Fixes + Merged-Receipt Bug

- **Tanggal:** 2026-06-06
- **Tipe:** Bug-fix bundle (3 UI/UX + 1 data bug) — bukan fitur baru.
- **Cakupan:** frontend (TablesPage, POSPage, CartPanel, Tabs primitive, receipt.ts, types) + backend (transactions service/view, additive).
- **Permission matrix REV 2.3:** TIDAK berubah. Tidak ada perubahan gate/role.

## Konteks

Empat keluhan dari penggunaan harian POS (sumber: screenshot `docs/pengujian/screenshots/04-owner-meja.png` + laporan user):

1. Kartu meja di halaman Meja tidak konsisten tingginya — meja terisi lebih tinggi dari meja kosong.
2. Picker meja di POS (input order dine-in) tidak menandai meja yang sudah terisi vs kosong.
3. **Bug data:** struk PDF untuk transaksi yang digabung (multi-Pesanan / Combine Tables) tidak mencatat item gabungan dengan benar.
4. Tab kategori di POS tidak bisa di-geser kiri-kanan di HP — kategori yang terpotong tak bisa dipencet.

Keputusan UX yang sudah dikonfirmasi user:
- Indikator meja terisi di picker POS = **tint amber + titik kecil** (selaras halaman Meja).
- Struk gabungan = **satu daftar item rata (flat)**, satu Subtotal yang benar.

---

## Fix ① — Tinggi kartu meja seragam

**File:** `frontend/src/pages/TablesPage.tsx`

**Root cause:** Tiap sel grid adalah `div.relative`, tapi kartu yang terlihat adalah `<button>` di dalamnya yang ber-`w-full` **tanpa `h-full`**. CSS grid me-stretch sel (align-items: stretch default), bukan tombolnya. Kartu terisi (badge + harga + timestamp = 3 baris) jadi tinggi; kartu kosong (1 baris) tetap pendek.

**Perubahan:**
- Tambah `h-full` ke `<button>` kartu → mengisi sel grid yang ter-stretch (seragam dalam 1 baris).
- Tambah floor `min-h-[8.5rem]` (≈ tinggi konten terisi) → seragam juga antar-baris (baris all-kosong tidak kolaps lebih pendek dari baris yang ada terisinya).
- Empty state tetap 1 baris teks "Kosong · Tap untuk input order"; kartu hanya mem-reserve footprint yang sama.

**Catatan:** Skeleton loading `h-32` (128px) tetap; floor 8.5rem (136px) sedikit lebih tinggi agar konten terisi tidak pernah terpotong. Tidak perlu ubah grid columns.

---

## Fix ② — Indikator meja terisi di picker POS

**File:** `frontend/src/pages/POSPage.tsx`, `frontend/src/components/CartPanel.tsx`

**Root cause:** Picker meja di CartPanel (`orderType === 'dineIn'`) merender tombol angka polos hanya dengan styling selected/unselected. POSPage tidak pernah fetch okupansi sistem-wide, jadi CartPanel tak tahu meja mana yang terisi.

**Perubahan:**
- **POSPage:** tambah query open dine-in hari ini, **reuse cache key `['transactions','open-today']`** (sama dengan TablesPage → cache di-share, gratis). Derive `occupiedTables: Set<number>` dari transaksi `status=open`, `orderType=dineIn`, `tableNumber !== null`, `mergedIntoId === null`. Pass sebagai prop ke kedua instance CartPanel (desktop + mobile sheet).
- **CartPanel:** terima prop opsional `occupiedTables?: Set<number>`. Tombol meja yang terisi (dan **tidak** sedang terpilih) dapat:
  - latar amber lembut: `bg-warning-50 text-warning-800 hover:bg-warning-100` + `ring-1 ring-warning-200`,
  - titik kecil di pojok kanan-atas: `<span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-warning-500" aria-hidden />` (tombol jadi `relative`).
  - Selected tetap menang (biru solid `bg-primary-600 text-white`), tanpa titik.
- `aria-label` tombol meja terisi disertai " (terisi)" untuk a11y.
- Tetap bisa ditap (tap = pilih meja → view/tambah pesanan; perilaku existing tidak berubah).

**Out of scope:** menampilkan nominal/jumlah item di tombol picker (opsi ditolak user — tombol kecil).

---

## Fix ③ — Struk gabungan tampil lengkap + Subtotal benar (backend + frontend)

**File:** `backend/src/modules/transactions/transactions.service.ts`, `frontend/src/types/index.ts`, `frontend/src/lib/receipt.ts`

**Root cause:** Model merge bersifat *pointer*, bukan *copy*. Anak (source) menyimpan item-nya sendiri + dapat `mergedIntoId = parent`. Saat `addPayment` parent: agregat (subtotal+discount+tax+total) dipakai untuk `total`/`tax`/`discount` parent, tapi `parent.subtotal` dan `parent.items` **tetap milik parent saja**; anak di-cascade `status=paid, total=0` tapi **tetap menyimpan `subtotal` + `items`-nya**. Struk (`generateReceiptPdf`) hanya mengiterasi `tx.items` dan mencetak `tx.subtotal` → **item gabungan hilang + Subtotal < TOTAL** (angka tak rekonsiliasi). Saat struk dicetak, anak sudah `paid` (bukan `open`), jadi tidak tersedia di query open mana pun → perlu disuplai backend.

**Self-relation Prisma:** `mergedFrom Transaction[] @relation("MergeBill")` = anak-anak yang ter-merge ke transaksi ini.

**Perubahan backend (additive, aman):**
- Tambah field opsional ke `TransactionView`:
  ```ts
  mergedSources?: {
    id: number
    tableNumber: number | null
    subtotal: number
    items: TransactionItemView[]
  }[]
  ```
- **Hanya di `getTransactionById`** (bukan `transactionInclude` shared): include `mergedFrom` dengan items (pakai item-include yang sama). `listTransactions` + `listTransactionsByTable` TIDAK menyertakan ini (tetap ringan).
- Mapper item di-reuse (ekstrak helper `toTransactionItemView` dari `toTransactionView` agar parent + children memakai mapping identik: variantLabel, selections, notes, subOptions).
- `mergedSources` hanya berisi anak (tidak rekursif; merge satu level per model).

**Perubahan frontend type:** tambah `mergedSources?` (shape mirror) ke `interface Transaction`.

**Perubahan receipt.ts:**
- `allItems = [...tx.items, ...(tx.mergedSources ?? []).flatMap(s => s.items)]` → loop item render pakai `allItems`.
- `aggregateSubtotal = tx.subtotal + Σ mergedSources.subtotal` → baris "Subtotal" pakai ini (kini == tx.total sebelum diskon/PB1, rekonsiliasi).
- Discount/PB1/TOTAL/payments tetap dari `tx` (sudah agregat — benar).
- Saat `mergedSources.length > 0`: tambah baris meta halus `Gabungan N pesanan` (membantu user paham kenapa item banyak). Meja tetap tampil `tx.tableNumber` (parent).
- **Tidak ada perubahan signature** `generateReceiptPdf(tx, opts)` — membaca `tx.mergedSources` dari objek tx. PaymentModal tak berubah: sudah `refetchOnMount: 'always'` + invalidate `['transaction', id]` pasca-bayar, jadi `mergedSources` (anak yang kini paid) tersedia saat tombol "Simpan Struk" ditekan.

**Audit struk lain (user minta cari bug lain):** dicek dan AMAN — page height sudah menghitung baris ter-wrap, right-align label pendek tak overlap, perhitungan `change = paid - tx.total` benar untuk split tender & overpay, void tidak bisa cetak struk (tombol hanya di layar isPaid). Satu-satunya bug = gabungan di atas.

---

## Fix ④ — Tab kategori bisa di-scroll di HP

**File:** `frontend/src/design-system/primitives/Tabs.tsx`

**Root cause:** List tab scrollable = `inline-flex` + `overflow-x-auto`. Elemen `inline-flex` melebar mengikuti konten, jadi tidak pernah overflow *dirinya sendiri* — ia overflow *parent* dan terpotong, tanpa scroll container terbentuk. Sentuh-geser tak berfungsi.

**Perubahan:** tambah `max-w-full` ke string kelas branch `scrollable`:
```ts
scrollable && 'flex-nowrap overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-fade-right max-w-full'
```
- Saat tab muat: `inline-flex` tetap hug konten (max-width tidak mengikat) → **tanpa regresi** ke PageHeader / PeriodControl.
- Saat tab overflow (MenuGrid kategori di HP, atau 5 tab di layar sempit): lebar di-cap ke parent → `overflow-x-auto` aktif → swipeable.

---

## Rencana Verifikasi

- **Backend:** `tsc --noEmit` 0 error. Vitest integration: buat 2 Tx, merge anak ke parent, bayar parent, lalu `getTransactionById(parent)` → assert `mergedSources` berisi item anak + `parent.subtotal + Σ child.subtotal` rekonsiliasi dengan `(total - tax + discount)`. Smoke test existing tetap hijau.
- **Frontend:** `tsc -b` 0 error, `vite build` sukses, ESLint 0 error.
- **Manual / Playwright (mobile viewport):** ① kartu meja kosong & terisi tinggi sama; ② picker POS menandai meja terisi amber+titik; ④ tab kategori bisa di-geser. ③ cetak struk transaksi gabungan → semua item muncul + Subtotal == TOTAL (sebelum/sesudah PB1).
- **Isolasi:** kerja di worktree branch baru (`fix/pos-ui-and-receipt-merge`).

## Risiko & Mitigasi

- *Receipt timing:* jika `mergedSources` belum ter-refetch saat user cepat klik "Simpan Struk" → fallback `?? []` membuat struk tetap valid (hanya item parent). Mitigasi sekunder: mutation `addPayment` boleh `setQueryData` hasil respons (sudah berisi `mergedSources`) bila ingin instan; opsional.
- *List performance:* `mergedFrom` include HANYA di `getTransactionById`, bukan list — tidak menambah beban endpoint daftar.
- *Tabs regresi:* `max-w-full` non-binding saat konten muat → perilaku PageHeader/PeriodControl tidak berubah.

## Non-Goals

- Tidak menambah cetak struk di HistoryPage.
- Tidak menampilkan struk per-meja/grouped (user pilih flat).
- Tidak mengubah permission, model merge, atau revenue queries.
- Tidak menampilkan nominal di tombol picker meja.
