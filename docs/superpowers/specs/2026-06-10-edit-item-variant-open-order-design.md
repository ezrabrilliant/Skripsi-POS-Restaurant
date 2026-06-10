# Design — Ubah Varian/Paket Item pada Pesanan Terbuka

**Tanggal:** 2026-06-10
**Status:** Disetujui (brainstorming) — siap masuk writing-plans
**Konteks REV:** 2.14 (di atas REV 2.10 menu-variants + REV 2.11 COGS)

## Masalah

Saat kasir/waiter sudah men-submit sebuah Pesanan di satu meja (mis. meja 3,
Pesanan #1), edit mode pada `ActiveOrdersView` (tombol "Ubah") hanya menyediakan:
**ubah qty** (`− 1 +`), **hapus item** (🗑️), dan **tambah/ubah catatan**.

Tidak ada cara mengubah **varian** atau **pilihan slot paket** sebuah item yang
sudah masuk. Contoh nyata: pelanggan pesan "Ayam Bakar Dada" lalu ganti jadi
"Ayam Bakar Paha", atau pada "Paket A" semula "Pilih Ayam: Paha Goreng" mau
diganti. Saat ini satu-satunya jalan adalah **hapus item lalu input ulang** —
bertele-tele dan menambah risiko salah.

## Tujuan

Tambahkan kemampuan **mengubah varian / pilihan paket item yang sudah ada**
secara in-place, tanpa menghapus + input ulang. Item mempertahankan identitasnya
(id, qty, catatan); hanya varian/paketChoices/preferences-nya yang berubah, dengan
penyesuaian stok, harga, dan COGS yang benar.

**Out of scope:** mengganti item ke menu yang berbeda (mis. Ayam Bakar → Es Teh);
edit di dalam cart sebelum submit (item belum dipersist — itu konteks lain); split
bill; mengubah qty/notes (sudah ada).

## Wawasan kunci

Mengubah varian **bukan** seperti mengubah qty. Qty memakai matematika delta
(`±n × deduction per-unit`). Pergantian varian mengubah **SKU stok itu sendiri**
(porsi dada vs porsi paha = baris `PortionStock` berbeda), plus `unitPrice` dan
`unitCost`. Maka model yang benar adalah **reverse penuh + re-apply penuh**: balikkan
seluruh deduction item lama, lalu resolve pilihan baru dari nol — persis seperti
`void` + `create` tetapi diruang-lingkupkan ke satu item dan mempertahankan
identitasnya.

## Arsitektur

### 1. Backend — operasi in-place baru

Service baru `changeTransactionItemVariant(transactionId, itemId, userId, input)` di
[backend/src/modules/transactions/transactions.service.ts](../../../backend/src/modules/transactions/transactions.service.ts),
memakai ulang helper yang sudah ada + sudah teruji (`buildMenuGraph`,
`deductionsForStoredItem`, `resolveItems`, `recomputeSubtotal`).

`input` = `{ variantId?: number | null; paketChoices?: {...}; preferences?: [...] }`
(bentuk sama dengan `orderItemSchema`, tanpa `menuId`/`qty`).

Langkah:
1. Muat item (`include: { menu: { select: { name } }, selections: true }`). Guard:
   - Transaksi ada + `status === open` (else 400, pesan sama gaya `updateItem`).
   - Item milik transaksi tersebut (else 404).
2. Dalam satu `prisma.$transaction`, bangun `graph = buildMenuGraph(tx)` sekali:
   1. **Reverse** deduction lama: `deductionsForStoredItem(graph, item)` × `item.qty`
      → `portionStock.increment` + `PortionMovement` `reason=refundVoid`,
      note `"ganti varian: lepas \"{menu.name}\""`.
   2. **Re-resolve** baru: `resolveItems(tx, graph, [{ menuId: item.menuId, qty: item.qty,
      variantId: input.variantId ?? null, paketChoices: input.paketChoices,
      preferences: input.preferences }])` → `unitPrice`, `unitCost`, `variantId`,
      `deductions`, `selections` baru.
      **`menuId` SELALU diambil dari item DB, tidak pernah dari client** — hanya
      varian/paket dari menu yang sama yang boleh berubah. `resolveItems` juga
      memvalidasi `validatePaketChoices` + keaktifan varian (reuse, tak perlu kode baru).
   3. **Apply** deduction baru × `item.qty` → `portionStock.decrement` +
      `PortionMovement` `reason=order`, note `"ganti varian: pasang \"{menu.name}\""`.
   4. **Update baris item**: `variantId`, `unitPrice`, `unitCost`,
      `subtotal = unitPrice × item.qty`. `qty` + `notes` tidak disentuh.
   5. **Ganti selections**: `transactionItemSelection.deleteMany({ transactionItemId })`
      lalu `createMany` selections baru.
   6. `recomputeSubtotal(tx, transactionId)`.
3. **Guard no-op**: bila `variantId` hasil resolve identik dengan item saat ini DAN
   signature selections (slot+chosen+target) identik → `return getTransactionById(...)`
   lebih awal tanpa churn ledger.
4. Return `getTransactionById(transactionId)`.

**Konsistensi guard dengan `updateItem` (sengaja):** open-only; semua role
authenticated; **tanpa** cek stale-shift maupun settlement (order open belum masuk
revenue ter-settle, dan edit item adalah modifikasi order terbuka — selaras dengan
edit qty yang sudah diizinkan pada shift stale).

### 2. Backend — schema + route

- `changeItemVariantSchema` (Zod) di `transactions.schema.ts`: `variantId` (nullable
  optional), `paketChoices` (sama dengan `orderItemSchema`), `preferences` (sama).
  Tipe `ChangeItemVariantInput`.
- Route baru di `transactions.routes.ts`:
  `PATCH /transactions/:id/items/:itemId/variant` → `handleChangeItemVariant`.
  Permission: semua authenticated (sejajar `PATCH/DELETE /:id/items/:itemId`).
- Controller `handleChangeItemVariant` di `transactions.controller.ts` (parse id +
  itemId + body, panggil service, `sendSuccess`).

### 3. Frontend — `VariantPickerModal` dapat pre-fill

[frontend/src/components/VariantPickerModal.tsx](../../../frontend/src/components/VariantPickerModal.tsx)
tambah dua prop opsional:
- `initialItem?: TransactionItem` — item tersimpan yang sedang diedit.
- `confirmLabel?: string` — default "Tambah ke Pesanan"; mode edit pakai "Simpan Perubahan".

Diteruskan ke `PickerBody` → `VariantPicker` / `PaketPicker`. Tiap sub-picker
men-seed `useState` awal dari `initialItem` (via inisialisasi `useState`, dihitung
sekali):

- **Menu varian (`VariantPicker`):**
  - Bangun map `optionId → groupId` dari `menu.optionGroups`.
  - Temukan varian by `initialItem.variantId`; untuk tiap `variant.optionIds`, set
    `selection[groupId] = optionId` (mengisi grup `affectsVariant`).
  - Grup free-preference (`affectsVariant=false`): dari `initialItem.selections`
    yang `isPreference=true`, cocokkan `groupOrSlotLabel === group.name` +
    `chosenLabel === option.label` → set `selection[group.id] = option.id`.
  - Bila varian lama kini `isActive=false`, `matchedVariant` tak akan cocok →
    tombol confirm disabled sampai user memilih kombinasi valid (graceful).
- **Menu paket (`PaketPicker`):**
  - Untuk tiap slot choice, dari `initialItem.selections` `isPreference=false`,
    cocokkan `groupOrSlotLabel === component.label`; pilih opsi via
    `chosenLabel === option.label` (fallback `targetMenuId`/`targetVariantId`) →
    set `selection[component.id] = option.id`.
  - Seed `subPicks[component.id]` dari `targetVariantId` bila ada. Caption
    "Varian: X" pada slot bersarang bersifat **best-effort** (label varian tidak
    dipersist di selection); pemilihan `variantId`-nya tetap benar. (Lihat
    "Keterbatasan diketahui".)

Catatan: jalur "tambah item baru" (POSPage `handleMenuClick`/`handlePickerConfirm`)
memanggil modal **tanpa** `initialItem` → perilaku lama tak berubah.

### 4. Frontend — afordans edit di `ActiveOrdersView`

[frontend/src/components/ActiveOrdersView.tsx](../../../frontend/src/components/ActiveOrdersView.tsx):
- Prop baru `onEditVariant?: (txId: number, itemId: number) => void`, diteruskan
  `ActiveOrdersView → PesananGroup → PesananItem`.
- `canEdit` ikut memperhitungkan `onEditVariant`.
- Pada item, tampilkan tombol **"Ubah varian"** (mis. di baris bersama qty/hapus
  atau tepat di bawah chip selections) HANYA saat `editing` aktif DAN item punya
  sesuatu untuk diubah:
  `item.variantId != null || (item.selections?.some((s) => !s.isPreference) ?? false)`.
  Menu simpel (tanpa varian/paket, mis. "Sayur Asem") tidak menampilkan tombol.
- Pakai primitive existing (`Button`/`IconButton` ghost, ikon `Pencil`/`Replace`
  dari lucide) selaras gaya tombol "Tambah catatan".

### 5. Frontend — wiring `POSPage`

[frontend/src/pages/POSPage.tsx](../../../frontend/src/pages/POSPage.tsx):
- State baru `variantEdit: { txId: number; itemId: number; menu: Menu; item: TransactionItem } | null`.
- Handler `handleEditVariant(txId, itemId)`:
  - Cari `order = activeOrders.find(o => o.id === txId)`, `item = order.items.find(i => i.id === itemId)`.
  - Cari `menu = menus.find(m => m.id === item.menuId)`. Bila tak ketemu (mis. menu
    nonaktif tak ada di list POS) → toast error ramah, batal.
  - `setVariantEdit({ txId, itemId, menu, item })`.
- `changeVariantMutation`:
  `transactionService.changeItemVariant(txId, itemId, { variantId, paketChoices, preferences })`.
  - `onSuccess`: toast "Varian diperbarui", invalidate `['transactions','byTable', cart.tableNumber]`,
    `['transactions','openTakeaway']`, `['menus','pos']`, `['transactions','open-today']`
    (set sama dengan `updateItemMutation`). Tutup `variantEdit`.
  - `onError`: toast pesan error.
- Render `VariantPickerModal` kedua saat `variantEdit !== null`, dengan
  `menu={variantEdit.menu}`, `initialItem={variantEdit.item}`,
  `confirmLabel="Simpan Perubahan"`, `onConfirm={(r) => changeVariantMutation.mutate(...)}`,
  `onClose={() => setVariantEdit(null)}`.
- Teruskan `onEditVariant={handleEditVariant}` ke kedua instans `CartPanel`
  (desktop + mobile Sheet) → diteruskan ke `ActiveOrdersView`.
  - `CartPanel` perlu prop `onEditVariant?` baru yang diteruskan ke `ActiveOrdersView`.

### 6. Frontend — service

[frontend/src/services/transactionService.ts](../../../frontend/src/services/transactionService.ts):
```ts
changeItemVariant: async (
  transactionId: number,
  itemId: number,
  payload: {
    variantId?: number | null
    paketChoices?: Record<string, { targetMenuId: number; variantId?: number | null; chosenLabel: string }>
    preferences?: { groupLabel: string; chosenLabel: string }[]
  },
): Promise<Transaction> => {
  const res = await api.patch<ApiResponse<{ transaction: Transaction }>>(
    `/transactions/${transactionId}/items/${itemId}/variant`, payload,
  )
  return res.data.data.transaction
}
```

## Alur data (ringkas)

```
Tap "Ubah" (edit mode) ─▶ tampil tombol "Ubah varian" pada item ber-varian/paket
       │
       ▼ tap "Ubah varian"
POSPage.handleEditVariant ─▶ set variantEdit{txId,itemId,menu,item}
       │
       ▼ render VariantPickerModal(initialItem=item, confirmLabel="Simpan Perubahan")
   user ubah pilihan ─▶ onConfirm(VariantPickResult)
       │
       ▼ changeVariantMutation.mutate
PATCH /transactions/:id/items/:itemId/variant
       │
       ▼ changeTransactionItemVariant: reverse stok lama → re-resolve → apply stok baru
         → update item (price/cost/subtotal/variantId) → ganti selections → recompute
       │
       ▼ invalidate queries ─▶ ActiveOrdersView refresh (chip + harga baru)
```

## Penanganan error

- Transaksi non-open / item bukan milik Tx → 400/404 (gaya pesan sama `updateItem`).
- `paketChoices` tak valid / varian bukan milik menu → 400 (reuse `resolveItems` +
  `validatePaketChoices`).
- Menu tak ditemukan di list POS saat membuka picker → toast ramah, batal (frontend).
- Semua mutasi stok atomik di `$transaction` (gagal di langkah mana pun = rollback
  penuh, tak ada stok setengah jalan).

## Keterbatasan diketahui

- **Caption varian bersarang (best-effort):** untuk kasus jarang di mana sebuah slot
  paket menunjuk ke menu varian (sub-pick bersarang), pre-fill memulihkan `variantId`
  dengan benar, namun teks kecil "Varian: X" bisa menampilkan label seadanya hingga
  slot dibuka ulang. Swap-nya selalu benar. (Disetujui sebagai trade-off.)

## Rencana pengujian

- **Backend (TDD + smoke):**
  - Swap varian: stok SKU lama +n, SKU baru −n; `unitPrice`/`unitCost`/`subtotal`
    item + `subtotal` Tx terupdate; selections terganti.
  - Swap pilihan slot paket: target stok pindah sesuai opsi baru.
  - Guard no-op (pilih varian sama) → tak ada movement baru.
  - Tolak pada Tx `paid`/`void` (400) + item asing (404).
  - `menuId` dari client diabaikan (pakai item DB).
  - `tsc --noEmit` backend 0 error; smoke transactions tetap hijau.
- **Frontend:**
  - `tsc -b` + `vite build` + `npm run lint` bersih.
  - Manual e2e (Playwright) di meja nyata: (a) menu varian dada→paha; (b) slot paket
    Paha→Dada; verifikasi chip + harga + subtotal berubah, modal pre-filled.

## Catatan implementasi (pipeline superpowers)

worktree → TDD (schema + service test dulu) → executing/subagent per fase dengan
checkpoint → verification-before-completion (bukti tsc/build/smoke + e2e) →
requesting-code-review → finishing-branch.
