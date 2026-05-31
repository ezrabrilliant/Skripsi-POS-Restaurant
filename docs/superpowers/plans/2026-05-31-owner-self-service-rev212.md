# Owner Self-Service & Go-Live Readiness (REV 2.12) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tutup gap konfigurasi yang membuat owner "terdampar" setelah live — agar semua setelan krusial bisa diubah owner lewat UI tanpa edit kode/database.

**Architecture:** 4 workstream berurutan (A→B→C→D), satu file plan yang **ditumbuhkan per fase**: Phase 1 (WS-A) detail penuh & siap eksekusi; Phase 2-4 (WS-B/C/D) sebagai roadmap, di-expand jadi task bite-sized di checkpoint masing-masing fase. Spec: [docs/superpowers/specs/2026-05-31-owner-self-service-go-live-readiness-design.md](../specs/2026-05-31-owner-self-service-go-live-readiness-design.md).

**Tech Stack:** Frontend React 18 + TS + Vite + Zustand + React Query + Tailwind + design-system primitives. Backend Express 4 + Prisma + MySQL + Zod. Verifikasi: `tsc`/`vite build`/ESLint + manual e2e browser; backend TDD (Zod + service test).

---

## Konvensi Verifikasi & Commit

- **Frontend build:** `cd frontend; npm run build` (jalankan `tsc -b && vite build`). Expected: EXIT 0, tidak ada error TS.
- **Frontend lint:** `cd frontend; npm run lint`. Expected: 0 error (warning lama boleh, jangan tambah baru).
- **Backend type:** `cd backend; npx tsc --noEmit`. Expected: EXIT 0.
- **Backend test:** `cd backend; npm run test`. Expected: semua PASS.
- **Manual e2e:** `npm run dev` (root) → buka browser, login **Owner** (PIN 123456).
- **Commit:** kecil & sering, satu task = 1-2 commit. Format: `feat(scope): ...` / `fix(scope): ...`. Akhiri pesan commit dengan baris co-author Claude.
- **Branch:** lihat §Branch Decision di bawah sebelum mulai Phase 1.

---

## Branch Decision (putuskan sebelum eksekusi Phase 1)

Branch saat ini `feat/katalog-menu-ux` masih ada kerjaan katalog menu berjalan (plan 21-task, fase 1-3), dan **WS-A Task A1 menyentuh `MenuFormModal.tsx`** yang kemungkinan juga area katalog. Opsi:
1. **Selesaikan/merge katalog dulu**, lalu REV 2.12 dari `main` terbaru (paling bersih, hindari konflik).
2. **Stack REV 2.12 di atas `feat/katalog-menu-ux`** (kontinuitas, tapi 2 fitur tercampur di 1 branch/PR).
3. **Branch baru `feat/owner-self-service-rev212` dari `main`** (REV 2.12 bersih; katalog jalan paralel; risiko konflik kecil di MenuFormModal di-resolve saat merge).

→ Default rekomendasi: **opsi 3** bila katalog belum siap merge; **opsi 1** bila katalog hampir selesai. Konfirmasi ke user.

---

## File Structure — Phase 1 (WS-A, frontend-only)

| File | Tanggung jawab | Aksi |
|---|---|---|
| `frontend/src/components/MenuFormModal.tsx` | Form tambah/edit menu owner | Modify — tambah toggle "Lacak stok porsi?" |
| `frontend/src/components/payment-methods/PaymentMethodsTab.tsx` | List + aksi metode bayar | Modify — tambah tombol reorder ↑/↓ |
| `frontend/src/pages/UsersPage.tsx` | Manajemen staff owner | Modify — toggle Aktif (reaktivasi) + badge Nonaktif + fix PIN 6 digit |

**TIDAK disentuh** (sudah berfungsi): owner edit nama/PIN sendiri (Edit button di kartu sendiri sudah jalan, `setUser` di-handle). Hanya **verifikasi** di e2e.

---

## Phase 1 — WS-A: Quick-Win Self-Service

### Task A1: Toggle stok menu (`portion ↔ nonStock`) di MenuFormModal

**Files:**
- Modify: `frontend/src/components/MenuFormModal.tsx` (sisipkan sebelum blok "Stok Minimum" di line ~465)

**Konteks:** State sudah punya `stockType` ([:69](../../frontend/src/components/MenuFormModal.tsx)) dan `buildPayload` sudah mengirim `state.stockType` untuk menu simple ([:254](../../frontend/src/components/MenuFormModal.tsx)). Backend `upsertMenu` sudah menulis `stockType` + sinkron `PortionStock`. Yang hilang murni kontrol UI. `Checkbox` sudah diimpor dari `@/design-system/primitives`.

- [ ] **Step 1: Sisipkan toggle**

Di `MenuFormModal.tsx`, tepat **sebelum** blok `{state.mode === 'simple' && state.stockType === 'portion' && ( <Input label="Stok Minimum" ... )}` (line ~465-476), tambahkan:

```tsx
{/* REV 2.12: toggle lacak stok untuk menu simple (portion ↔ nonStock).
    linked tidak diekspos di sini (itu ranah SKU varian). Backend upsert
    sudah sinkron PortionStock saat beralih ke portion. */}
{state.mode === 'simple' && (
  <div className="pt-1">
    <Checkbox
      label="Lacak stok porsi (hitung sisa & ingatkan saat menipis)"
      checked={state.stockType === 'portion'}
      onCheckedChange={(c) => update('stockType', c ? 'portion' : 'nonStock')}
    />
    <p className="text-caption text-neutral-500 mt-1">
      {state.stockType === 'portion'
        ? 'Stok dihitung per porsi & otomatis berkurang tiap terjual. Mulai dari 0 — restock dulu setelah disimpan.'
        : 'Tidak dilacak — menu selalu bisa dijual (mis. minuman racik / item tanpa stok).'}
    </p>
  </div>
)}
```

- [ ] **Step 2: Build + lint**

Run: `cd frontend; npm run build`
Expected: EXIT 0.
Run: `cd frontend; npm run lint`
Expected: 0 error baru.

- [ ] **Step 3: Manual e2e**

`npm run dev` → login Owner → Katalog Menu → Edit **Air Mineral** → centang "Lacak stok porsi" → field "Stok Minimum" muncul → Simpan. Buka tab Stok Porsi → Air Mineral muncul qty 0. Edit lagi → hilangkan centang → Simpan → kembali nonStock.
Expected: toggle dua arah bekerja, tidak ada error console.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/MenuFormModal.tsx
git commit -m "feat(menu): toggle lacak stok porsi (portion<->nonStock) di form menu"
```

---

### Task A2: Reorder metode bayar (↑/↓) di PaymentMethodsTab

**Files:**
- Modify: `frontend/src/components/payment-methods/PaymentMethodsTab.tsx`

**Konteks:** `paymentMethodService.reorder(ordered)` sudah ada ([:106](../../frontend/src/services/paymentMethodService.ts)). `methods` prop ditampilkan urut `displayOrder` (list dari parent). PaymentModal kasir menyortir by `displayOrder` ASC — jadi reorder = kontrol urutan tombol bayar. Tambah aksi ↑/↓ di kolom `actions`.

- [ ] **Step 1: Tambah mutation reorder**

Di dalam komponen (setelah `toggleMutation`, ~line 56), tambah:

```tsx
const reorderMutation = useMutation({
  mutationFn: (ordered: { id: number; displayOrder: number }[]) =>
    paymentMethodService.reorder(ordered),
  onSuccess: () => qc.invalidateQueries({ queryKey: ['paymentMethods'] }),
  onError: (err: Error) => toast.error(err.message),
})

// Pindah metode pada index `from` ke arah `dir` (-1 naik / +1 turun),
// lalu kirim urutan baru (displayOrder = index final).
const move = (from: number, dir: -1 | 1) => {
  const to = from + dir
  if (to < 0 || to >= methods.length) return
  const next = methods.slice()
  ;[next[from], next[to]] = [next[to], next[from]]
  reorderMutation.mutate(next.map((m, i) => ({ id: m.id, displayOrder: i })))
}
```

> Catatan: cocokkan tipe argumen dengan `ReorderPaymentMethodEntry` di `paymentMethodService.ts` (bila beda dari `{ id, displayOrder }`, sesuaikan map-nya).

- [ ] **Step 2: Tambah tombol ↑/↓ di kolom actions (desktop) + mobileCard**

Ganti cell kolom `actions` (line ~140-148) jadi (gunakan `index` dari `DataTable` cell — bila signature `cell` tidak memberi index, cari index via `methods.findIndex((x) => x.id === m.id)`):

```tsx
cell: (m) => {
  const i = methods.findIndex((x) => x.id === m.id)
  return (
    <div className="inline-flex items-center gap-0.5">
      <IconButton label={`Naikkan ${m.label}`} icon={<ChevronUp />} variant="ghost" size="sm"
        disabled={i <= 0 || reorderMutation.isPending} onClick={() => move(i, -1)} />
      <IconButton label={`Turunkan ${m.label}`} icon={<ChevronDown />} variant="ghost" size="sm"
        disabled={i >= methods.length - 1 || reorderMutation.isPending} onClick={() => move(i, 1)} />
      <IconButton label={`Edit ${m.label}`} icon={<Edit2 />} variant="ghost" size="sm"
        onClick={() => setEditing(m)} />
    </div>
  )
},
```

Tambah import: `import { Plus, Edit2, ChevronUp, ChevronDown } from 'lucide-react'`. Tambahkan pasangan tombol serupa di blok `mobileCard` (di sebelah tombol Edit, line ~227-233).

- [ ] **Step 3: Build + lint**

Run: `cd frontend; npm run build` → EXIT 0. `cd frontend; npm run lint` → 0 error baru.

- [ ] **Step 4: Manual e2e**

Login Owner → Pembayaran → tab Metode → klik ↑/↓ pada beberapa metode → urutan berubah & persist (refresh). Buka POS → urutan tombol bayar ikut berubah.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/payment-methods/PaymentMethodsTab.tsx
git commit -m "feat(payment-methods): tombol reorder naik/turun displayOrder"
```

---

### Task A3: UsersPage — reaktivasi staff + badge Nonaktif + fix PIN 6 digit

**Files:**
- Modify: `frontend/src/pages/UsersPage.tsx`

**Konteks:** Backend `updateUserSchema` terima `isActive`; `userService.updateUser` mengirimnya. Form edit sekarang cuma name/PIN/role — tak ada kontrol `isActive`, sehingga staff yang di-"hapus" (soft-delete `isActive=false`) tidak bisa diaktifkan & tidak terlihat statusnya. PIN: validasi+label salah ("4-6") padahal backend wajib `^\d{6}$`.

- [ ] **Step 1: Tambah `isActive` ke form state**

Ubah `type UserFormData` (line 26-30) + `initialFormData` (line 38):

```tsx
type UserFormData = {
  name: string
  pin: string
  role: UserRole
  isActive: boolean
}

const initialFormData: UserFormData = { name: '', pin: '', role: 'cashier', isActive: true }
```

Update `openEditModal` (line 91-95) untuk seed `isActive`:

```tsx
const openEditModal = (user: UserType) => {
  setEditingUser(user)
  setFormData({ name: user.name, pin: '', role: user.role, isActive: user.isActive })
  setIsModalOpen(true)
}
```

- [ ] **Step 2: Fix validasi PIN ke tepat 6 + kirim isActive saat update**

Ganti `handleSubmit` (line 103-119):

```tsx
const handleSubmit = (e: FormEvent) => {
  e.preventDefault()
  // Backend wajib PIN tepat 6 digit (^\d{6}$). Saat create wajib; saat edit
  // boleh kosong (tidak diubah), tapi kalau diisi wajib 6 digit.
  if (!editingUser && formData.pin.length !== 6) {
    toast.error('PIN harus 6 digit angka')
    return
  }
  if (editingUser && formData.pin && formData.pin.length !== 6) {
    toast.error('PIN harus 6 digit angka')
    return
  }
  if (editingUser) {
    const updateData: Partial<UserFormData> = {
      name: formData.name,
      role: formData.role,
      isActive: formData.isActive,
    }
    if (formData.pin) updateData.pin = formData.pin
    updateMutation.mutate({ id: editingUser.id, data: updateData })
  } else {
    createMutation.mutate(formData)
  }
}
```

- [ ] **Step 3: Fix label PIN + tambah toggle Aktif di form (edit only)**

Ubah label `Input` PIN (line 222) dari `PIN (4-6 digit)...` jadi:

```tsx
label={`PIN (6 digit)${editingUser ? ' - kosongkan jika tidak diubah' : ''}`}
```

Tambahkan **setelah** `Combobox` Role (sebelum `</form>`, line ~241), kontrol Aktif hanya saat edit & bukan diri sendiri:

```tsx
{editingUser && !isSelfEdit && (
  <Checkbox
    label="Akun aktif (bisa login & dipakai)"
    checked={formData.isActive}
    onCheckedChange={(c) => setFormData({ ...formData, isActive: c })}
  />
)}
```

Tambah `Checkbox` ke import primitives (line 12-22).

- [ ] **Step 4: Badge "Nonaktif" + style muted di UserCard**

Ubah `UserCard` (line 295-348): tambahkan badge saat `!user.isActive`. Setelah badge "Anda" (line 325-329):

```tsx
{!user.isActive && (
  <Badge tone="neutral" size="sm">Nonaktif</Badge>
)}
```

Dan beri opacity pada container kartu saat nonaktif — ubah `className` div root (line 307):

```tsx
className={cn(
  'bg-white rounded-xl p-3 sm:p-4 flex items-center justify-between gap-3 border border-neutral-200/60',
  !user.isActive && 'opacity-60',
)}
```

(`cn` sudah diimpor; `Badge` sudah diimpor.)

- [ ] **Step 5: Build + lint**

Run: `cd frontend; npm run build` → EXIT 0. `cd frontend; npm run lint` → 0 error baru.

- [ ] **Step 6: Manual e2e**

Login Owner → Manajemen User → Hapus seorang staff (jadi nonaktif) → muncul badge "Nonaktif" + muted → Edit staff itu → centang "Akun aktif" → Simpan → badge hilang. Coba buat user baru PIN 5 digit → ditolak "PIN harus 6 digit". **Verifikasi juga**: Edit kartu **diri sendiri** (Owner) → ganti nama → Simpan → nama update (sudah berfungsi sejak sebelumnya, pastikan tak regресi).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/UsersPage.tsx
git commit -m "feat(users): reaktivasi staff (toggle aktif) + badge nonaktif + fix PIN 6 digit"
```

---

### Phase 1 Checkpoint

- [ ] Semua Task A1-A3 commit. `cd frontend; npm run build` EXIT 0, `npm run lint` 0 error baru.
- [ ] Review dengan user: tunjukkan 3 fitur di browser. Setelah approve → expand Phase 2 (WS-B) jadi task detail di file ini.

---

## Phase 2 — WS-B: Settings & Money-Math (ROADMAP — detail di-expand saat checkpoint)

> Di-expand jadi task bite-sized + TDD backend setelah Phase 1 di-approve. Ringkasan target:

**Backend (TDD: Zod + service test dulu):**
- `schema.prisma`: `AppSetting` +`taxChargedToCustomer Boolean @default(false)`, `restaurantName/Address/openingHours/restaurantPhone/restaurantLogoUrl` (String/nullable), `restockMultiple Int @default(5)`, `lowStockThreshold Int @default(5)`. `Transaction` +`taxBorneAmount Decimal @default(0) @db.Decimal(12,2)`. Migrasi aditif (`prisma migrate dev`), verifikasi count before/after.
- `settings.schema.ts` + `settings.service.ts` + `SettingView`: expose field baru.
- `transactions.service.ts` (addPayment first-slice, ~line 838-844): logika 2-sumbu — `pb1 = taxEnabled ? base×rate/100 : 0`; `charged → taxAmount=pb1, total=base+pb1`; `borne → taxBorneAmount=pb1, total=base`. `TransactionView` +`taxBorneAmount`. **Test:** 3 kombinasi (off/charged/borne) → assert taxAmount/taxBorneAmount/total.
- `dashboard.service.ts`: `laba = pendapatan − cogs − Σ taxBorneAmount` (filter periode identik). **Test:** dashboard kurangi borne.
- Generalisasi upload (`menus.upload.ts`) untuk logo (endpoint/folder branding) → return url.

**Frontend:**
- `RestaurantIdentityTab.tsx` baru (tab di halaman Pembayaran/Settings): input nama/alamat/jam/telp + upload logo (ekstrak `MenuImageUpload` → `ImageUpload` reusable, atau varian `LogoUpload`).
- `TaxSettingsTab.tsx`: toggle "Bebankan PB1 ke pelanggan?" (`taxChargedToCustomer`) + teks matriks.
- `LoginPage`/`Layout`: baca identitas dari settings (fallback string lama).
- `OwnerDashboard`: baris "PB1 ditanggung resto" + laba kurangi borne.
- Setting `restockMultiple`/`lowStockThreshold`: input (tab Operasional sederhana) + parametrik di `PortionStockTab`/`portion.schema`/`utils.getStockStatus`.

**Verifikasi:** migrasi zero-loss, backend test PASS, e2e isi identitas+upload logo→tampil header, PB1 3-mode benar di struk/dashboard.

---

## Phase 3 — WS-C: Struk PDF + UX Pasca-Bayar (ROADMAP — depend Phase 2)

> Di-expand setelah Phase 2. **Task pertama WS-C = desain layout struk**: riset format struk POS standar via firecrawl → mockup ASCII → approve user, baru implementasi.

- `PaymentModal.tsx`: state "Sukses" (tidak auto-close) + tombol "Cetak/Simpan Struk" & "Selesai".
- Library **jsPDF** (client-side) + util `generateReceipt(tx, settings)` → nota kecil B/W, header dari identitas (Phase 2), body item/subtotal/diskon/PB1/total/metode + footer. `doc.save('struk-<kode>-<tgl>.pdf')`.
- `HistoryPage`: aksi "Cetak Struk" cetak ulang.
- **Verifikasi:** e2e bayar → modal stay → simpan PDF berisi data benar; cetak ulang dari History.

---

## Phase 4 — WS-D: Master-Table Dinamis (ROADMAP — paling berat, terakhir)

> Di-expand setelah Phase 3. Migrasi aditif dulu; drop enum lama = langkah destruktif terpisah, PROD hard-gated.

- **Kategori tagihan:** model `BillCategory {id,label,isActive,displayOrder}` + `Bill.categoryId` FK; seed 5 default + backfill by-label; modul CRUD owner; `BillsPage` pilih dari master + modal "Kelola Kategori".
- **Meja:** model `RestaurantTable {number@unique,capacity,name?,isActive}`; validasi transaksi dari DB (ganti `env.TABLE_COUNT`); seed 9 (2×6+7×4); modul `tables` CRUD owner; `TablesPage`/`CartPanel` fetch API.
- **Docs:** update ERD + DATA-DICTIONARY (2 entitas baru).
- **Verifikasi:** migrasi zero-loss; tambah kategori "internet"→pakai di Bill; tambah meja 10→transaksi; nonaktif meja→hilang dari picker, tx lama valid.

---

## Self-Review (Phase 1)

**Spec coverage (WS-A):** stockType toggle ✅ A1; payment reorder ✅ A2; staff reactivation ✅ A3; inactive badge ✅ A3; PIN fix ✅ A3; own-account edit → **sudah berfungsi**, jadi verifikasi-only (A3 Step 6). Semua item WS-A spec ter-cover.

**Placeholder scan:** Phase 1 task berisi kode lengkap + command + expected. Phase 2-4 sengaja roadmap (akan di-expand di checkpoint, bukan placeholder dalam task).

**Type consistency:** `update(key, value)` helper dipakai konsisten (A1). `UserFormData` +`isActive` dipakai konsisten di state/openEditModal/handleSubmit/Checkbox (A3). `move(from, dir)` + `reorderMutation` konsisten (A2). `Checkbox` ditambah ke import di MenuFormModal (sudah ada) & UsersPage (perlu ditambah, dicatat di A3 Step 3).
