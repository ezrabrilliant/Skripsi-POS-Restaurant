# Design Spec - Menu Variants + Stock Linkage Redesign (REV 2.10)

> Status: **DRAFT - design approved 2026-05-30**, pending implementation plan.
> Pemicu: saat mengerjakan Workstream B (UX elevation, jump-button Menu↔Stok), ketahuan
> bahwa linkage menu→stok memakai **nama string di kolom JSON** (`subOptions.stockTarget`),
> sehingga rapuh (rename memutus link diam-diam) dan tidak owner-configurable. Owner juga
> minta menghapus duplikasi menu di POS (banyak baris "Es Teh") dan menggantinya dengan satu
> menu + pemilih varian, serta paket yang ter-trace rapih.
>
> Sumber kebenaran katalog: [`docs/menu-ayam-bakar-banjar-monosuko.md`](../../menu-ayam-bakar-banjar-monosuko.md)
> + [`backend/prisma/menu-catalog.ts`](../../../backend/prisma/menu-catalog.ts).

## 1. Tujuan & Motivasi

Empat motivasi (dikonfirmasi owner, semuanya berlaku):

1. **Integritas data (FK).** DB harus menjamin link: rename/hapus menu target tidak boleh
   memutus decrement stok menu `linked`/paket secara diam-diam. Foreign key, bukan nama string.
2. **Navigasi B2 bersih.** Tombol lompat Menu↔Stok menunjuk baris stok lewat id - tanpa
   pencocokan nama / tebakan / fallback pencarian.
3. **Defensibilitas skripsi.** Skema relasional ternormalisasi (relasi nyata untuk komposisi
   paket + varian) lebih mudah dipertahankan daripada blob JSON.
4. **Editing paket & varian gampang + OWNER-CONFIGURABLE.** Ini **mekanisme, bukan instance**:
   sistem digerakkan data - owner mendefinisikan grup opsi + opsi + varian lewat UI; POS
   me-render pemilih secara generik. **Menambah menu varian baru = entri data, nol perubahan
   kode.** (Sama semangatnya dengan REV 2.6 yang membuang enum payment hardcoded jadi tabel
   yang dikelola owner.)

Masalah konkret yang ditemukan saat brainstorm:

- **Grid harga Es Teh tidak aditif.** Tawar/Biasa 8k, Manis/Biasa 10k, Tawar/Jumbo 12k,
  Manis/Jumbo **15k**. Model "base + delta" memprediksi 14k → meleset 1k. Maka harga harus
  **per-kombinasi (di varian)**, bukan delta opsi.
- **Stok per-kombinasi wajib.** Catatan operasional (`menu-ayam-...md` baris 94–97): item slash
  dipecah jadi SKU terpisah justru supaya stok tiap varian tercatat sendiri. Model baru harus
  mempertahankan pelacakan stok per-kombinasi.
- **Slot minuman paket heterogen.** Air Mineral = terminal (tak ada opsi lanjutan); Teh =
  bercabang (rasa/ukuran/suhu). Harus ditangani satu mekanisme, bukan special-case.

## 2. Keputusan Terkunci (D1–D13)

| # | Keputusan | Alasan |
|---|---|---|
| **D1** | **Approach A - "Variants as a layer".** Lapisan katalog/presentasi baru di atas lapisan inventori yang ADA. `PortionStock`/movements/opname/dashboard tetap di-key `menuId` (TIDAK diubah). Varian menunjuk menu porsi via FK untuk stok. | Pisahkan concern katalog vs inventori (pola best-practice nyata). Reuse ledger REV 2.8 → risiko migrasi rendah di sistem live. Approach B (stok per-varian) lebih murni tapi menulis ulang seluruh subsistem stok terhadap data live → ditolak. |
| **D2** | **Harga di Variant (per-kombinasi, eksak).** Tidak pakai delta harga per-opsi. | Mereproduksi grid non-aditif 8/10/12/15 persis; tanpa math delta yang rapuh. |
| **D3** | **Option group PER-MENU**, bukan library global bersama. | YAGNI untuk ~10 menu varian; duplikasi "Bakar/Goreng" tidak sepadan dengan kompleksitas subset-management library global. Defensible di skripsi sebagai scoping sesuai ukuran katalog. |
| **D4** | **Dua jenis option group:** `affectsVariant=true` (variant-defining: Rasa, Ukuran, Bagian, Cara Masak → membentuk baris varian ber-harga/stok) vs `affectsVariant=false` (free preference: Suhu dingin/panas → tak ubah harga/stok, dicatat sebagai selection + note dapur). | Menjaga jumlah varian kecil (Es Teh = 4, bukan 8). Menggeneralisasi toggle Panas/Dingin hardcoded REV 2.4 jadi data owner-configurable (buang 1 lagi hardcoded list). |
| **D5** | **`linked` stockType melebur ke varian** (`variant.stockTargetMenuId`). `linked` jadi legacy. | Sebuah menu `linked` pada dasarnya = sebuah varian yang menunjuk stok menu lain. Penyederhanaan konsep. |
| **D6** | **Menu porsi granular DIPERTAHANKAN tapi `posVisible=false`** (disembunyikan dari grid POS). `Menu` dapat kolom `posVisible Boolean`. | POS tampil 1 kartu "Ayam Potong" dgn pemilih, sementara 4 SKU bagian/masak tetap memegang count masing-masing di belakang. History tetap valid (FK lama utuh). |
| **D7** | **Paket dinormalisasi:** `PaketComponent` (`fixed`\|`choice`) + `PaketChoiceOption`, FK ke menu/varian. Opsi pilihan paket boleh menunjuk **variant-menu** → **bercabang** ke pemilihnya saat order (reuse komponen pemilih yang sama). Harga paket **tetap**; pilihan komponen termasuk (tak menambah). Field `upcharge` per-opsi **disiapkan di skema (default 0) tapi TIDAK dipakai di v1** (dormant; berbeda dari delta-harga-varian yang ditolak di D2/D12). | Menjawab slot minuman heterogen: Air Mineral terminal, Es Teh bercabang. Satu engine, tanpa special-case. |
| **D8** | **`Menu.kind` enum eksplisit** (`simple`\|`variant`\|`paket`), di-set form saat simpan (berdasarkan builder yang dipakai). | Render/query POS efisien tanpa inferensi runtime. UX owner tetap progressive (kind disimpulkan dari aksi), DB simpan hasilnya. |
| **D9** | **Pencatatan order:** `TransactionItem.variantId` FK (varian yang terjual; `unitPrice` = harga varian) + `TransactionItemSelection` (pilihan slot paket + free preference). Komponen fixed TIDAK di-store ulang (konstan, derivable dari definisi paket). | "Paket ter-trace rapih" tanpa over-store. Movements REV 2.8 sudah link transaksi + item-level → tiap decrement terlacak. |
| **D10** | **Engine resolusi stok via FK** (`resolveStockTargets(menu, variant?)`), rekursif untuk paket. Tanpa lookup nama, tanpa throw-on-miss. | FK menjamin target ada. Decrement lainnya tak berubah (boleh minus per ground truth). |
| **D11** | **Migrasi additive + backfill script; JANGAN hapus/repoint menu lama.** Local dulu → prod off-peak, backup tiap langkah. | Transaksi historis (termasuk import buku 1–26 Mei) tetap menunjuk menu lama → history eksak. Disiplin sama dgn migrasi REV 2.6/2.8. |
| **D12** | **Out of scope:** stok per-varian (Approach B), library opsi global, delta harga per-opsi, option group multi-select (single-select saja), HPP/BOM raw material (tetap out). | YAGNI; fokus & batasi risiko. |
| **D13** | **Dampak Workstream B:** B di-park. B2 (name-resolver `menuStockLink.ts`) **digantikan** FK - setelah redesign, lompatan pakai `variant.stockTargetMenuId` / id langsung. B1 sudah commit (independen). B3/B4/B5 independen → lanjut setelah redesign. | Menghindari membangun di atas fondasi nama yang akan dibuang. |

## 3. Arsitektur Data (Section 1 + 2)

> ERD final (StarUML) ditunda - owner: "erd nanti di final kita pikirin lagi". Skema di bawah
> ilustratif (nama final boleh berubah saat implementasi).

```
══ LAPISAN KATALOG / PRESENTASI (baru) ══════════════════════════════════
Menu (extended)
  + kind        enum(simple|variant|paket)
  + posVisible  Boolean  @default(true)   // SKU stok granular → false

OptionGroup
  id, menuId FK→Menu, name, affectsVariant Boolean, displayOrder
  └─ Option
       id, optionGroupId FK, label, displayOrder

MenuVariant
  id, menuId FK→Menu, label,                     // label auto: "Manis / Jumbo"
  price Decimal, stockTargetMenuId Int? FK→Menu,  // null = nonStock (mis. minuman)
  isActive Boolean, displayOrder
  └─ MenuVariantOption (join varian ↔ opsi yang membentuknya)
       menuVariantId FK, optionId FK
       // hanya untuk opsi affectsVariant=true; free-preference TIDAK membentuk varian

══ PAKET (komposit, ganti JSON) ════════════════════════════════════════
PaketComponent
  id, paketMenuId FK→Menu, kind enum(fixed|choice), label, qty Int, displayOrder
  // fixed:  targetMenuId FK / targetVariantId FK  (item selalu termasuk, mis. Nasi ×4)
  // choice: punya PaketChoiceOption[]
  └─ PaketChoiceOption
       id, paketComponentId FK, targetMenuId? FK, targetVariantId? FK, label,
       upcharge Decimal @default(0)
       // target = variant-menu → bercabang ke pemilih menu itu saat order

══ PENCATATAN ORDER (extended) ═════════════════════════════════════════
TransactionItem
  + variantId Int? FK→MenuVariant
  └─ TransactionItemSelection
       id, transactionItemId FK, groupOrSlotLabel, chosenLabel,
       targetMenuId? FK, targetVariantId? FK, isPreference Boolean
       // mencatat pilihan slot paket + free-preference (suhu)

══ LAPISAN INVENTORI (TIDAK BERUBAH) ═══════════════════════════════════
PortionStock, PortionMovement, opname, dashboard - tetap di-key menuId.
Varian & komponen paket hanya FK masuk ke sini.
```

**Hubungan varian-vs-paket (klarifikasi inti):** keduanya tampak mirip ("pilih satu dari grup")
tapi beda di **berapa stok dikurangi**: varian = **1 item** di piring, kurangi **≤1** stok;
paket = **beberapa item**, kurangi **banyak** stok. Karena itu jadi dua `kind` menu yang
**berbagi building block "option group"** (yang membingungkan owner) tapi semantik stok berbeda.

## 4. Alur Owner - "Tambah Menu" (Section 3, progressive disclosure)

Tidak ada pilihan "Simple/Variant/Paket" di muka (jargon). Mulai sebagai menu biasa; **tumbuh
hanya bila perlu** lewat tombol berlabel jelas; `kind` **disimpulkan** dari yang dibangun.

```
State 1 - semua menu mulai sama:
  Nama · Kategori · Harga dasar · Foto
  ── Menu ini punya pilihan? (opsional) ──
   [+ Tambah pilihan varian]   ukuran · rasa · bakar/goreng
   [+ Jadikan paket]           ayam + nasi + minuman
  → simpan di sini = simple.

State 2 (tap "Tambah varian") - builder varian inline:
   Grup pilihan: nama ("Rasa") · jenis (• ubah harga/stok | ○ bebas) · opsi [Tawar][Manis][+]
   [+ tambah grup]   (mis. Ukuran; lalu Suhu = bebas)
   Varian (dibuat otomatis = cartesian grup affectsVariant):
     Tawar·Biasa  Rp[ 8.000] stok[ - ▾] ☑
     Manis·Jumbo  Rp[15.000] stok[ Dada Ayam Bakar ▾] ☑
   (owner isi harga + target stok opsional per baris; untick kombinasi yg tak dijual)

State 2′ (tap "Jadikan paket") - builder komponen (reuse PaketBuilder existing):
   Item tetap:  • Nasi Putih x1  • Sayur Asem x1   [+ tambah]
   Slot pilihan: [Ayam] → [Paha…][Dada…]   [Minuman] → [Es Teh][Air Mineral]   [+ slot]
```

Menu varian/paket adalah **mutually exclusive** (satu menu = varian ATAU paket, bukan dua;
YAGNI). Menambah "Es Jeruk" dengan alur sama = murni entri data di wizard ini.

## 5. Alur POS - Pemilih Generik (Section 2 cont.)

- `MenuGrid` hanya tampil menu `posVisible=true`. SKU stok granular tersembunyi.
- Tap menu `kind=variant` → buka **VariantPickerModal generik** (render dari `OptionGroup`/`Option`
  menu itu). Pilih 1 opsi per grup → cari `MenuVariant` yang cocok (via `MenuVariantOption`) →
  harga & target stok. Grup `affectsVariant=false` (Suhu) tampil sebagai pemilih bebas → dicatat
  sebagai selection + note dapur (menggantikan toggle Panas/Dingin hardcoded REV 2.4).
- Tap menu `kind=paket` → tampil item tetap + slot pilihan; memilih opsi yang menunjuk
  variant-menu **membuka pemilih menu itu inline** (rekursif, komponen yang sama). Air Mineral
  (simple) = terminal.
- Komponen yang berevolusi: `SubOptionsModal` → `VariantPickerModal` (generik); `cartStore`
  membawa `variantId` + selections; `MenuGrid`/`CartPanel` menampilkan label varian.

## 6. Engine Order-Time (Section 4)

```
resolveStockTargets(menu, chosenVariant?) → [portionMenuId, …]
  • simple portion   → [menu.id]
  • variant          → chosenVariant.stockTargetMenuId ? [id] : []
  • paket            → ∪ semua komponen:
        fixed:  resolve(target)         × component.qty
        choice: resolve(chosenOption.target, chosenSubVariant?)   // rekursif
        target nonStock/drink → kontribusi []
Decrement tiap portionMenuId sebesar (qty order × qtyKomponen). Boleh minus (ground truth).
FK menjamin target ada → tak ada lookup nama / throw-on-miss seperti sekarang.
```

Harga: varian → `unitPrice = variant.price`; paket → `unitPrice = harga dasar paket` (tetap);
free preference tidak mengubah harga. Pencatatan: `TransactionItem.variantId` +
`TransactionItemSelection[]` (lihat D9).

## 7. Rencana Migrasi (Section 5) - live prod + history aman

**Aturan emas: JANGAN hapus / repoint menu lama.** Transaksi historis (termasuk import buku
1–26 Mei) tetap menunjuk menu lama → history eksak.

1. **Skema additive** (`prisma db push`): tabel baru + `Menu.kind` + `Menu.posVisible` +
   `TransactionItem.variantId` + `TransactionItemSelection`. TANPA drop → zero data-loss.
2. **Backfill script** (idempotent, pola seperti `migrate-*` REV 2.6/2.8):
   - Buat display menu (Es Teh, Ayam Potong, 1 Ekor Ayam, Gurame, Udang, Garang Asem, …) +
     option groups/options/variants dengan **harga eksak** dari katalog.
   - Arahkan `stockTargetMenuId` varian ayam/seafood ke **menu porsi yang sudah ada** → count
     live lanjut mulus (sekaligus menyerap relasi `linked` saat ini, mis. Kecap→Merah).
   - Konversi paket JSON → `paket_components` / `paket_choice_options` (resolve nama→id sekali, di sini).
   - Set `posVisible=false` pada menu stok granular + display-menu duplikat yang tergantikan.
3. **Transaksi lama tak disentuh.** `linked` stockType + JSON `subOptions` → legacy; di-drop
   setelah verifikasi.
4. **Verifikasi:** count baris sebelum/sesudah identik (aditif), reconcile, smoke; **LOCAL dulu**
   → **PROD off-peak**; **backup (mysqldump) sebelum tiap mutasi**.
5. **Seed/`menu-catalog.ts`** di-update ke struktur baru agar DB fresh konsisten.

Hasil: POS tampil kartu varian bersih · ledger stok tak berubah · history utuh · JSON hilang ·
owner tambah menu varian tanpa kode.

## 8. Permukaan Implementasi (untuk plan)

**Backend:** `schema.prisma` (model baru + extend) · modul `menus` (CRUD option group / variant /
paket; Zod schema; service; controller; routes) · `transactions.service` (`resolveStockTargets`
rewrite + pencatatan `variantId`/selections) · `menu-catalog.ts` + `seed.ts` · script migrasi
additive + `backfill-menu-variants.ts` · verifikasi/smoke. Dashboard sebagian besar tak berubah
(stok tetap menuId-based).

**Frontend:** `types` (Menu.kind/posVisible, OptionGroup, MenuVariant, Paket*, selections) ·
`menuService` (CRUD varian/paket) · `MenuFormModal` → progressive builder (`VariantBuilder` baru +
reuse `PaketBuilder`) · POS `MenuGrid` + `VariantPickerModal` (generalisasi `SubOptionsModal`) ·
`cartStore` (bawa variantId + selections) · `transactionService` (payload order) · `HistoryPage`
(tampil varian + selections) · `MenuPage` (tampil varian + revisi B2 `menuStockLink` → pakai FK).

## 9. Pengujian & Verifikasi

- **Backend:** Vitest unit untuk `resolveStockTargets` (simple/variant/paket/cascade/nonStock) +
  Zod schema. Smoke integrasi di DB test (`pos_restaurant_test`): buat menu varian, order varian
  → cek decrement target yang benar; order paket dgn pilihan bercabang → cek multi-decrement +
  selections tercatat; harga eksak (grid teh 8/10/12/15); reconcile.
- **Migrasi:** count before/after identik; verifikasi 2 hal - history lama utuh (transaksi buku
  1–26 Mei tetap valid) + stok live ayam lanjut di SKU yang sama.
- **Frontend:** `tsc` + `vite build` + `eslint` 0 error. Manual e2e: owner tambah menu varian
  (progressive) → muncul di POS sbg 1 kartu + pemilih → order → atribusi stok benar; paket dgn
  slot minuman (Teh bercabang, Air Mineral terminal).

## 10. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Migrasi merusak data live / history | Additive only, JANGAN hapus menu lama, backup tiap langkah, LOCAL→PROD off-peak, verifikasi count + reconcile. |
| Stok live ayam "hilang" saat collapse | Varian menunjuk menu porsi EXISTING (count tetap di SKU lama yg disembunyikan), bukan memindah stok. |
| Backfill nama→id ambigu (paket JSON) | Resolusi sekali saat migrasi dengan log; nama saat ini stabil (rename "Es" sudah selesai REV 2.4); review hasil sebelum prod. |
| Scope membengkak | Out-of-scope D12 (no variant-level stock, no global option lib, single-select, no per-opsi delta). Eksekusi per-phase + checkpoint. |
| Pemilih paket rekursif rumit | Reuse satu `VariantPickerModal`; paket choice cuma referensi menu → render sama; harga paket tetap (sub-opsi gratis default). |

## 11. Dampak ke Workstream B (UX Elevation)

- **B1** (deep-link foundation) sudah commit `73b9585` - independen, tetap.
- **B2** (jump-button Menu↔Stok) - kode hijau belum commit; **`menuStockLink.ts` name-resolver
  digantikan FK** setelah redesign (lompatan pakai `variant.stockTargetMenuId`/id). Revisit B2
  setelah redesign agar bersih.
- **B3/B4/B5** (notifikasi login, FilterToolbar, polish) - independen; lanjut setelah redesign.

## 12. Out of Scope (tegas)

Stok per-varian (Approach B) · library option group global · **delta harga per-opsi untuk
membentuk harga varian** (harga tetap eksak di baris varian - D2) · upcharge paket aktif (field
dormant default 0) · option group multi-select (single-select saja) · HPP/BOM raw material ·
ERD StarUML final (ditunda ke akhir).
