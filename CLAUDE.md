# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ WAJIB BACA DULU di awal sesi baru

1. **`docs/operasional-resto.md`** - ground truth alur bisnis resto (versi REV 2.3, sumber kebenaran tertinggi).
2. **`docs/superpowers/specs/2026-05-24-permission-matrix-design.md`** - design spec hasil brainstorming order intake & permission (REV 2.3).
3. **`~/.claude/projects/c--Users-ezrak-Documents-Skripsi-Skripsi-POS-Restaurant/memory/project_session_handoff.md`** - state proyek, TODO pending, DO/DON'T sesi.
4. **`~/.claude/projects/.../memory/project_resto_operational_truths.md`** - ringkasan ground truth structural.

Tanpa membaca 4 file di atas, kemungkinan tinggi sesi baru akan mengulangi kesalahan asumsi yang sudah dikoreksi.

## Project

Web-based POS (Point of Sale) untuk restoran "Ayam Bakar Banjar Monosuko". Skripsi Ezra Brilliant (C14220315). Backend **Express 4 + TypeScript + Prisma + MySQL**; frontend **React 18 + TypeScript + Vite + Tailwind + PWA**.

**3 role**: `owner`, `cashier`, `waiter` (role lama `kitchen` di REV 1 sudah dihapus - masak out of scope karena dilakukan di rumah owner). Login (REV 2.3.1): first time device → form 2 field nama+PIN. Subsequent logins → PIN-only numpad (nama auto-fill dari cache localStorage `pos-auth.lastUserName`). Tombol "Ganti Pengguna" reset cache & balik ke fresh form. PIN boleh duplikat antar pegawai. Tidak ada layar pilih nama dari daftar semua pegawai - cache cuma 1 nama per device.

**Workflow order intake (REV 2.3):** waiter primary di kertas - ambil order verbal di meja → tulis kertas → kasih ke dapur resto → kertas ke kasir → **kasir** yang input ke POS. Waiter bisa input order di POS sebagai **fallback only** bila kasir tidak available (bukan co-equal dengan kasir). Timing kasir input fleksibel (antara terima kertas dan customer bayar).

## Status REV 2.3 (per akhir sesi 2026-05-24)

Sistem REV 1 sudah dibangun penuh. Setelah audit ground truth + brainstorming order flow & permission, dokumentasi dibumpkan ke REV 2.3. Status implementasi:

| Area | Status |
|---|---|
| `docs/operasional-resto.md` | ✅ REV 2.3 (sumber kebenaran, + Permission Matrix section) |
| `docs/superpowers/specs/2026-05-24-permission-matrix-design.md` | ✅ NEW (spec design hasil brainstorming) |
| `docs/knowledge/{ERD,USE-CASE,ACTIVITY}.md` | ✅ REV 2.3 (alignment dengan permission matrix) |
| Memory ground truth + handoff | ✅ REV 2.3 |
| `backend/prisma/schema.prisma` | ✅ REV 2.2 applied ke MySQL (14 entitas, 19 relasi, 11 enum). Apply via `prisma db push --force-reset`; folder migrations REV 2 lama sudah dihapus (clean slate baseline). |
| `backend/prisma/menu-catalog.ts`, `seed.ts` | ✅ REV 2.2 seeded (6 user riil + 60 menu + 25 portion stock + 13 raw material + 3 vendor). |
| Backend Phase 2 (auth + users) | ✅ Rewritten dari scratch per REV 2.3 (form login nama+PIN murni, owner-only users CRUD, /me endpoint, `/users-public` + `verifyPin` + `/auth/logout` dihapus). Smoke test 8 skenario PASS. |
| Backend Phase 3 (menus + sub-options) | ✅ Rewritten dari scratch (CRUD owner-only via permission matrix, GET public untuk POS, sinkron PortionStock saat create/update minStock, Zod superRefine reject linked tanpa stockTarget + portion tanpa minStock, soft delete + reactivate endpoint). Smoke test 12 skenario PASS. |
| Backend Phase 4a (shifts + transactions) | ✅ Rewritten dari scratch. Shifts: open/close/getActive/list/byId, cashier-only buka, idempotency 409, timezone-safe date construction (UTC midnight dari local). Transactions: create dengan auto-decrement PortionStock + resolusi 3 stockType (portion/linked/paket via stockMap join "\|"), addItems multi-round, payment dengan PB1 10% + paymentBank wajib EDC/transfer, void dengan reverse stock + PortionMovement reason=refundVoid. Permission per matrix REV 2.3 (POST = semua role kasir+waiter fallback, payment/void = owner+kasir). Smoke test 20 skenario PASS. |
| Backend Phase 4b (split/merge bill) | ⏳ Deferred - TransactionItem.partyId dan Transaction.mergedIntoId schema sudah ada, logic belum diimplement. |
| Backend Phase 5 (stocks portion ops) | ✅ Rewritten dari scratch jadi sub-resource `modules/stocks/portion.*`. Auto-snapshot openingQtyToday via raw SQL bulk UPDATE (lazy trigger di list/detail). Operasi: list (filter category/lowStock), detail dengan recentMovements, restock-morning (batch dengan validasi kelipatan 5), emergency-in (single, kelipatan bebas), opname (batch, audit log hanya kalau selisih != 0), mark-habis (idempotent shortcut). Permission TERBUKA semua role per REV 2.3 matrix. Smoke test 15 skenario PASS termasuk idempotency + audit trail lineage. |
| Backend Phase 6 (stocks raw materials) | ✅ Rewritten dari scratch jadi sub-resource `modules/stocks/raw-materials.*`. CRUD master owner-only (create dengan dedup case-insensitive via MySQL utf8mb4_unicode_ci collation, update, hard-delete dengan FK protection 409 ramah), view/opname/mark-habis semua role per REV 2.3 matrix. Reminder flags: isLowStock + isNearExpiry + daysUntilExpiry + suggestedAction computed. Decimal arithmetic support untuk qty (mis. opname Beras 1.5 skala). Audit log via `raw_material_movements` reason=opname/manualAdjust. Smoke test 20 skenario PASS. |
| Backend Phase 7 (vendors + purchases) | ✅ Rewritten dari scratch. **Vendors** (4 file): CRUD owner+kasir, list dengan purchaseCount via Prisma `_count`, dedup name 409, FK protection delete 409 ramah. **Purchases** (4 file): header + normalized PurchaseItem, create dengan validasi vendor + raw_material pre-fetch (Map lookup), Decimal arithmetic totalAmount = sum(qty × unitPrice). Auto-effect saat submit per item: lastBuyDate + unitPrice update SELALU (tracked + non-tracked); stockQty increment HANYA untuk tracked; insert `raw_material_movements` reason=`purchase` SELALU (audit lengkap, note non-tracked di-marker "tidak tracked, hanya log pengeluaran"). Filter `?date=YYYY-MM-DD` dan `?month=YYYY-MM` di list. No update/delete purchase (kalau salah, catat purchase baru sebagai koreksi). Register routes di app.ts. Smoke test 20 skenario PASS termasuk auto-effect mix tracked/non-tracked + Decimal totalAmount + FK protection. |
| Backend Phase 8 (bills + settlements) | ✅ Rewritten dari scratch. **Bills** (4 file): CRUD owner-only, 5 BillCategory enum, filter month/year/category, Decimal amount, hard delete (no FK refs). **Settlements** (4 file rewrite dari REV 2): 6 buckets schema sudah ada (cash/edc/qris/gojek/grab/transfer), service compute system totals via `groupBy paymentMethod` dari transactions status=paid + bank breakdown via `groupBy paymentMethod, paymentBank` untuk EDC/transfer. Operations: `preview` (preview system+bank sebelum submit), `create` (kasir-malam-own constraint inline di service: kasir wajib own shift + shift type=malam; owner bypass), `list` filter date/month/cashier/status, `getById` dengan variance computed runtime, `review` owner-only. UNIQUE shiftId 409 mencegah double-submit. Smoke test 23 skenario PASS termasuk full settlement flow (open malam, 7 transaksi mixed payment, close, preview, submit kasir-own, review owner) + 3 constraint variants (Bryant tidak own Jason → 403, Jason own pagi → 403, owner pagi → 201 bypass). |
| Backend Phase 9 (dashboard) | ✅ Rewritten dari scratch. 3 endpoint: `GET /owner` (owner-only, full report dengan period filter today/month/year/custom, revenue groupBy method + bank breakdown EDC/transfer + purchaseTotal + billTotal + profit = revenue - expense + reminder counts via raw SQL), `GET /cashier` (owner+kasir, activeShift + today revenue + openTransactionCount + reminders), `GET /waiter` (semua role, portionStocks total/lowCount/top5 samples + rawMaterials lowCount/nearExpiryCount/top5 samples + activeShiftsToday). Permission per matrix REV 2.3. Smoke test 14 skenario PASS. |
| **Backend FULL** | ✅ **Semua 9 phase done - `tsc --noEmit` zero errors, semua endpoint smoke-tested.** Phase 4b (split/merge bill) deferred - schema sudah ada, logic optional. |
| Frontend Phase 2 (LoginPage + authService + 'kitchen'→'waiter' cleanup) | ✅ LoginPage form 2 field nama+PIN, authService.login({name,pin}), 'kitchen' dihapus dari types/App/Layout/UsersPage. tsc PASS. |
| Frontend Phase 10 (3 dashboard per role + routing + nav) | ✅ Rewritten. 3 dashboard pages: `OwnerDashboard` (period switcher today/month/year, revenue+expense+profit metric cards, byMethod + bankBreakdown tables, reminders + quick links), `CashierDashboard` (conditional "Buka Kasir" CTA dengan modal pilih pagi/malam + modal awal kalau belum ada activeShift, atau 3 action card Input Order/Open Tx Count Badge/Tutup Kasir + today summary 6 buckets kalau active), `WaiterDashboard` (primary 2 big card Stok Porsi + Raw Materials Reminder dengan top 5 samples + quick action Opname/Mark Habis + active shifts today + link kecil "Input Order fallback"). Services rewrite: `dashboardService.ts` dengan types match Phase 9 backend response, `shiftService.ts` rewrite (`openShift({type, openingCash})`, `getActiveShift` ganti `getCurrentShift`, `closeShift`, `listShifts`). Types `ShiftType` enum + optional `type` field di `Shift`. App.tsx: single `/dashboard` route + `Dashboard` component branch by role, `RoleLanding` redirect ke /dashboard. Layout.tsx: nav per role tambah Beranda link sebagai item pertama, waiter cuma Beranda+Stok. `vite build` SUCCESS (1559 modules). |
| Frontend Phase 11 (cross-cutting rewrite) | ✅ Rewritten total. **Services (8 file)**: menuService, transactionService, portionService BARU, rawMaterialsService BARU, vendorService BARU, purchaseService BARU, billService BARU, settlementService - semua match Phase 1-9 backend. types/index.ts comprehensive update (PaymentMethod 6 buckets, OrderType 2, MethodTotals 6, OrderType labels, ShiftType, Vendor, Purchase, Bill, RawMaterialView, PortionStockView, dll). **POS stack (6 file)**: cartStore (subOptionsSelected support), SubOptionsModal BARU (pilihan paket), MenuGrid (Menu with portionStock), CartPanel (2 tab orderType + table picker 1-9 + subOptions chips), PaymentModal (6 method buttons + bank picker autocomplete EDC/transfer + PB1 10% preview), POSPage (shift gate redirect /dashboard kalau belum buka, integrate semua modal). **Stock + 2 page BARU (3 file)**: StockPage (2 tab Portion + Raw Materials), PortionStockTab (restock-morning kelipatan 5 batch modal + emergency-in single + opname batch + mark-habis), RawMaterialsTab (filter category + opname Decimal + mark-habis + owner-only CRUD modal). **3 page BARU**: PurchasesPage (filter month + create dengan vendor picker + multiple items dengan raw_material picker), BillsPage (owner-only month filter + create dengan 5 BillCategory). **4 page rewrite**: MenuPage (owner CRUD dengan stockType + subOptions JSON editor), HistoryPage (filter date/status/orderType + void action + expandable rows dengan items + breakdown PB1), SettlementPage (preview + blind count form + detail view dengan variance + owner review), TablesPage (9 meja grid status dari transactions open today). **Cleanup**: drop ReportsPage (covered by OwnerDashboard), drop ForceOrderModal/TableSelectModal/expenseService/stockService. Update App.tsx (add /purchases /bills, drop /reports), Layout.tsx (nav per role dengan Belanja+Tagihan owner, Belanja kasir). `tsc --noEmit` full frontend → **0 ERRORS**. `vite build` SUCCESS 1564 modules. |
| **Frontend FULL** | ✅ **Semua Phase 2 + 10 + 11 selesai. Frontend production-ready aligned dengan backend REV 2.3.** |
| **Phase 4b Split + Merge Bill** | ✅ Backend (splitTransaction endpoint + mergeBills endpoint + payment cascade ke mergedFrom sources, revenue queries exclude mergedIntoId untuk hindari double-count). Frontend SplitBillModal + MergeBillModal + integrate HistoryPage row actions. 10 backend smoke test + vite build SUCCESS. |
| **Shift Decoupling (sesi 2026-05-25)** | ✅ DONE 8 commit. Refactor pisahkan "user yang submit order" (`Transaction.createdBy`) dari "kasir pemilik shift" (`Transaction.shift.cashier`). Schema rename `cashier_id` → `created_by_id` + relasi `cashier`→`createdBy`. Backend `getActiveShifts` system-wide (return array). `createTransaction` auto-resolve shift (0/2+ active → 409 dengan pesan jelas). TransactionView tambah `shiftCashierName` denormalize. Frontend POSPage gate refactor 3-case (0/1/2+ × role): kasir 0-shift lihat CTA "Buka Kasir" (via `<OpenShiftDialog>` extract reusable), owner/waiter 0-shift lihat card info "Hubungi kasir", semua role 2+-shift lihat warning + link ke Settlement. CashierDashboard tampilkan info shift kasir lain (overlap). OwnerDashboard tambah panel "Shift hari ini" (3 state). HistoryPage display "oleh {createdByName} · shift {shiftCashierName}" conditional. **Permission matrix REV 2.3 UTUH** - gate yang berubah, bukan permission. Backend smoke 19/19 PASS, frontend tsc 0 errors, vite build SUCCESS, ESLint clean. Plan: `~/.claude/plans/tugas-buat-serialized-rose.md`. Spec: [docs/superpowers/specs/2026-05-25-shift-decoupling-design.md](docs/superpowers/specs/2026-05-25-shift-decoupling-design.md). |
| **REV 2.4 Multi-Pesanan + Notes (sesi 2026-05-26)** | ✅ DONE. **Workflow shift**: waiter + kasir co-equal input order via HP (paper workflow obsolete). **Schema**: `TransactionItem.notes String? @db.VarChar(255)` (db push, dev re-seed). **Menu rename**: drop "Es" prefix dari teh + jeruk yang ambigu suhu (+ Kopi Hangat→Kopi, Es Susu Kedelai→Susu Kedelai); suhu pakai notes via quick toggle `[Dingin]/[Panas]` di CartItemRow. **Backend**: `GET /transactions/table/:tableNumber?status=open` baru (exclude mergedIntoId, orderBy createdAt asc), `orderItemSchema` tambah notes, service persist notes + listTransactionsByTable. **Frontend**: types/service tambah notes + listByTable. **ActiveOrdersView** komponen baru (Pesanan #N grouped per Tx dengan timestamp, items, subOptions chips, 📝 notes). **POSPage** state inputMode + payTableContext, useEffect reset inputMode+items saat tableNumber/orderType change (pakai `clearItems` baru di cartStore untuk preserve table selection), handlers `handleAddPesanan/CancelInput/PayTable` (orchestrate merge+pay). **CartPanel** 3-mode branching: view (Tambah Pesanan + Bayar) / addPesanan (Batal + Submit) / inputNew (Simpan + Bayar atau Submit only). **Permission**: Bayar hidden untuk waiter (conditional render via `useAuthStore`). **UI fixes**: grid meja `grid-cols-5 gap-2` + `h-12 md:h-14` (2-baris 5+4 desktop), cart aside `w-full` (fix 57px empty space). **PaymentModal** auto multi-Tx aware via subtotal prop (POSPage pass aggregate). **Verifikasi browser**: meja 3 → submit Pesanan #1 (Teh Tawar Biasa, notes=Dingin via toggle), Tambah Pesanan → Pesanan #2 (Air Mineral), Bayar → merge tx2 ke tx1 → pay aggregate Rp 22.000 (PB1 10% = 2000) → cascade status=paid + total=0 ke tx2. Waiter Amel: cuma lihat "Tambah Pesanan", **NO Bayar** ✓. tsc PASS backend+frontend, vite build SUCCESS 2757 modules. Plan: `~/.claude/plans/saya-punya-aplikasi-pos-ticklish-orbit.md`. |
| **REV 2.6 Payment Methods + Banks Owner-Configurable (sesi 2026-05-27)** | ✅ DONE 37 commit. Drop enum `PaymentMethod` jadi master table extensible (`payment_methods` dengan code/label/colorHex/iconName/requiresBank/allowDineIn/allowTakeaway/displayOrder/isActive). Master `Bank` + junction many-to-many (`payment_method_banks`). Settlement schema full dynamic via `settlement_method_counts` child table (drop 12 legacy columns `systemXxx`/`countedXxx`). **Backend (Phase 1-8)**: Prisma models + migration 3-step script (seed-payment-methods + migrate-banks-from-history + migrate-settlement-counts), Express modules `banks` + `payment-methods` (owner-only CRUD + toggle + bank assign/unassign + reorder atomic), refactor `transactions` (drop hardcoded `needsBank`, runtime validate via payment_methods + bank junction), refactor `settlements` (drop 12 fixed fields jadi `counts: Record<string, number>`, dinamis service compute via groupBy), refactor `dashboard` (byMethod dinamis groupBy + lookup metadata). Smoke 23/23 PASS. **Frontend (Phase 9-14)**: `paymentMethodService` + `bankService` + types REV 2.6 (drop PAYMENT_METHODS const + MethodTotals), services adapt shape array dinamis, Owner page `/payment-methods` 2-tab CRUD (PaymentMethodsTab + BanksTab + FormModal dengan color picker + icon picker + bank multi-select + Bank soft delete via isActive). Refactor PaymentModal dinamis dari API (filter allowDineIn/allowTakeaway + bank Combobox closed list), SettlementPage dinamis (preview + blind count form + detail view + variance per method), OwnerDashboard dinamis bar chart + colors dari config, CashierDashboard adapt MethodTotalEntry[], HistoryPage drop PAYMENT_LABEL dinamis lookup. Schema cleanup commit (drop enum PaymentMethodLegacy + 12 Settlement legacy columns). **Verifikasi**: backend smoke 23/23 PASS payment-methods + tsc 0 errors backend+frontend + vite build SUCCESS 1594KB (gzip 388KB) + ESLint 0 errors. Manual e2e browser deferred ke user (backend dev + frontend dev siap di `npm run dev`). Spec: [docs/superpowers/specs/2026-05-27-payment-methods-banks-redesign-design.md](docs/superpowers/specs/2026-05-27-payment-methods-banks-redesign-design.md). Plan: [docs/superpowers/plans/2026-05-27-payment-methods-banks-redesign.md](docs/superpowers/plans/2026-05-27-payment-methods-banks-redesign.md). |
| **REV 2.7 Shift Redesign — Business Day + Window owner-configurable + Atribusi by Payment (sesi 2026-05-29)** | ✅ CODE-COMPLETE (14 commit, branch `feat/backend-express`, **BELUM push**). Hasil brainstorming + sweep adversarial multi-agen (32 edge-case terkonfirmasi). **Konsep**: business day berbasis shift; window shift owner-configurable (`AppSetting`: `timezone`+`shiftPagiStart`+`shiftChangeover`+`shiftMalamEnd`); **single-OPEN guard** via `Shift.activeMarker` + `@@unique([activeMarker])` (membatalkan rencana `@@unique([date,type])` yg salah-mekanisme); aturan buka "belum lewat jam-akhir window" + reopen dalam window; atribusi revenue **re-stamp `shiftId` saat bayar** (atomic `FOR UPDATE` + idempotent finalize); settlement **whole-business-day** keyed `@@unique([date])` + permission "penutup shift terakhir / owner" (cek malam-only DIHAPUS) + float baseline Σ openingCash; `closeShift(mode)` 2-mode (final blok tx open + 409 daftar per-meja / handover carry); **void-after-settle block** (refund out-of-scope); dashboard atribusi `shift.date`; OpenShiftDialog window-aware + serah-terima; POS active-shift freshness (refetchInterval); reminder banner; tab owner **"Jam Shift"**. **Verifikasi**: backend `tsc` 0 + Vitest unit 20/20 + integration smoke 25/25 (shift 8 + tx 7 + settlement 10, DB test terpisah `pos_restaurant_test`); frontend `vite build` ✓ + ESLint 0 error. Migrasi LOCAL aditif (zero data-loss terbukti via count before/after); **PROD `monosuko.my.id` BELUM migrasi** (runbook di plan §Phase D: backup→dedup→push aditif→backfill). Pending: **manual e2e browser** + prod migrate. Spec: [docs/superpowers/specs/2026-05-29-shift-redesign-design.md](docs/superpowers/specs/2026-05-29-shift-redesign-design.md). Plans: [backend](docs/superpowers/plans/2026-05-29-shift-redesign-backend.md) + [frontend](docs/superpowers/plans/2026-05-29-shift-redesign-frontend.md). |
| StarUML UC | ✅ 3 aktor (Kasir/Waiter/Owner) + 20 use case + UMLConstraint REV 2.3 note (kasir primary, waiter fallback) sudah lengkap di `Skripsi.mdj`. |
| Naskah Bab 3 | ✅ [docs/knowledge/BAB-3-DRAFT.md](docs/knowledge/BAB-3-DRAFT.md) REV 2.3 paste-ready (13 Gambar + 15 Tabel + 18 Kebutuhan Fungsional + Activity Diagram 3.2.3.11 Split+Merge). Status banner ditambah menjelaskan implementasi FULL DONE. |
| **PROJECT REV 2.3 + shift-decoupling COMPLETE** | ✅ Backend + Frontend + Phase 4b + Shift Decoupling + UC Diagram + Bab 3 semua final. Tinggal manual e2e testing via `npm run dev` browser. |
| `docs/knowledge/FULL.md` | ✅ REV 2.3 (overview kompilasi 3 design) |
| `docs/knowledge/BAB-3-DRAFT.md` | ✅ REV 2.3 (naskah Bab 3 paste-ready, 18 kebutuhan fungsional + permission matrix) |
| `docs/DATA-DICTIONARY.md` | ✅ REV 2.3 (rewrite total dari REV 1, 14 entitas + 19 relasi paste-ready) |
| `Skripsi.mdj` (StarUML) | ⏳ ERD + 11 Activity Diagrams sudah build REV 2.2. UC pending rebuild. REV 2.3 visual update opsional. |

Plan refactor lengkap di `~/.claude/plans/ubah-backend-dari-laravel-crystalline-wilkes.md` (perlu update ke REV 2.3 saat mulai implementation).

## Commands

Root (runs both backend and frontend concurrently):
- `npm run dev` - start backend (`tsx watch` on :8000) + frontend (`vite` on :3000)
- `npm run dev:backend` / `npm run dev:frontend` - individually
- `npm run db:migrate` / `npm run db:seed` / `npm run db:fresh` (reset + seed)

Backend (`cd backend`):
- `npm run dev` - server with watch mode
- `npm run build` - `tsc` compile to `dist/`
- `npm run prisma:migrate` - apply schema changes; `npm run prisma:studio` - DB GUI
- `npm run db:seed` - seed users + menus + bootstrap stock
- `npm run test` - Vitest

Frontend (`cd frontend`):
- `npm run dev` - Vite dev server
- `npm run build` - `tsc -b && vite build`
- `npm run lint` - ESLint

`VITE_API_URL` points at the API base (default `http://localhost:8000/api`).

## Architecture (target REV 2.3 - belum semua implemented)

### Backend (Express 4, TypeScript, API-only)

Entry: [backend/src/server.ts](backend/src/server.ts) → [backend/src/app.ts](backend/src/app.ts). Auth = JWT bearer token issued by `POST /api/auth/login` (lookup user by nama + PIN match). Public endpoints: login, health, menu reads. Authenticated endpoints pakai `authenticate` middleware; role gates via `requireRole` granular per-aksi (target REV 2.3 - lihat permission matrix di [docs/superpowers/specs/2026-05-24-permission-matrix-design.md](docs/superpowers/specs/2026-05-24-permission-matrix-design.md) §2.2). Tidak ada endpoint `users-public` - login pakai form input nama + PIN, bukan pilih dari daftar.

**Modular per-resource** structure di [backend/src/modules/](backend/src/modules/): `auth`, `users`, `menus`, `stocks` (portion + raw_materials), `shifts`, `tables`, `transactions`, `settlements`, `purchases`, `bills`, `dashboard`. Tiap module ada `*.schema.ts` (Zod), `*.service.ts`, `*.controller.ts`, `*.routes.ts`.

Schema di [backend/prisma/schema.prisma](backend/prisma/schema.prisma) - **REV 2.2 = 14 entitas, sudah applied ke MySQL per 2026-05-24**: `User`, `Menu`, `PortionStock`, `PortionMovement` (rename dari `StockMovement`), `RawMaterial`, `RawMaterialMovement` (BARU REV 2.2 - audit log raw materials), `Vendor`, `Shift`, `Transaction`, `TransactionItem`, `Settlement`, `Purchase`, `PurchaseItem`, `Bill`. Primary keys auto-increment integer kecuali `PortionStock.menuId` (PK = FK 1:1 ke Menu). **REV 2.3 tidak menambah entitas baru** - permission ditangani di app layer (middleware), bukan di DB.

Business flows penting:
- **Login (REV 2.3.1)**: cached-name UX. First login di device → form 2 field nama+PIN. Subsequent logins → PIN-only numpad (nama dari cache localStorage `pos-auth.lastUserName`). Tombol "Ganti Pengguna" reset cache. Tetap **tidak ada layar pilih nama dari daftar pegawai** - cache cuma menyimpan 1 nama terakhir per device.
- **Order intake (REV 2.3)**: dine-in via waiter mediated paper (waiter tulis kertas → kasir input ke POS). Takeaway langsung di kasir. Waiter punya akses POS untuk input order sebagai **fallback only** bila kasir tidak available - bukan default workflow.
- **Permission per role**: lihat matrix lengkap di [docs/superpowers/specs/2026-05-24-permission-matrix-design.md](docs/superpowers/specs/2026-05-24-permission-matrix-design.md). Ringkas: payment + buka/tutup kasir + settlement + pembelian = kasir-only. Bills + CRUD master = owner-only. Stok opname + view = semua role.
- **Shift**: kasir wajib "buka kasir" dengan modal awal sebelum bisa transaksi. 2 shift fixed: pagi + malam.
- **Tipe order**: 2 saja - `dineIn` (wajib pilih meja) + `takeaway` (no meja). Sumber takeaway dibedakan dari payment method, bukan sub-tipe.
- **Payment**: 6 enum - cash, edc, qris, gojek (settlement), grab (settlement), transfer. EDC & transfer punya field `bank_name` nullable untuk laporan per bank.
- **Stok porsi**: live count `PortionStock` per menu yang stockType=portion. Auto-decrement saat order submit (boleh minus). Restock pagi via fitur Restock Stok Porsi (kelipatan 5). Restock darurat tengah hari via fitur "Barang Masuk". Audit log di `StockMovement`. Tidak ada opname malam (cek malam pakai feeling, tidak dicatat).
- **Raw materials**: bahan baku terpisah dengan `is_tracked` boolean - true berarti stok di-update saat purchase + reminder di dashboard; false cuma jadi log pengeluaran. Field `category` (bumbu_dasar/bahan_segar/bahan_pokok/bahan_kering/lainnya), `unit` varchar bebas, `min_stock`, `unit_price`, `freshness_days?` (untuk perishable).
- **HPP out of scope** - tidak ada relasi otomatis raw_material → portion_stock (no Bill of Materials, no resep). Konversi terjadi manual di rumah owner.
- **Settlement**: 1x per hari (kasir shift malam saja), simpel rekap 6 totals. Bukan blind count. Modal awal di-track di Shift.
- **Pembelian**: log belanja kasir di pasar via `Purchase` + `PurchaseItem` normalized. Vendor opsional. Bumbu dasar = banyak purchase_items kategori `bumbu_dasar`, di laporan owner di-grouping jadi 1 baris.
- **Bills**: tagihan bulanan (kebersihan/listrik/air/parkir/sewa), owner only.
- **PB1 10%** auto-compute saat payment. Diskon manual didukung.
- **Split bill** per item (TransactionItem.party_id) + **merge bill** antar transaksi meja.
- **Cetak struk**: PDF save ke device kasir untuk kuitansi pembayaran. Tidak ada cetak struk pesanan untuk dapur (dapur di rumah owner).

### Frontend (React + TS + Vite + PWA)

Routing di [frontend/src/App.tsx](frontend/src/App.tsx): `ProtectedRoute` gate by auth; `OwnerRoute` requires `role === 'owner'`. **Target REV 2.3**: tambah `CashierRoute` guard + 3 dashboard berbeda layout (`OwnerDashboard`, `CashierDashboard`, `WaiterDashboard`) - di waiter dashboard, "Input Order" jadi secondary CTA (bukan primary card) supaya tidak terbiasa pakai sebagai default workflow.

State: **Zustand** (`authStore`, `cartStore`) + **React Query** server state. API layer di [frontend/src/services/](frontend/src/services/) - satu file per resource, shared Axios instance yang inject JWT bearer.

PWA: vite-plugin-pwa, installable, cache app shell + foto menu (WebP). Mobile-first karena kasir/waiter pakai HP (resto tidak punya komputer & wifi sendiri).

### Database

Schema authoritative di [backend/prisma/schema.prisma](backend/prisma/schema.prisma). Apply via `npm run prisma:migrate` (dev) atau `db:push --accept-data-loss` (dev cepat). Seed di [backend/prisma/seed.ts](backend/prisma/seed.ts) memakai katalog dari `backend/prisma/menu-catalog.ts`.

## Pegawai Riil (untuk Seed Data)

| Role | Nama | PIN default | Catatan |
|---|---|---|---|
| Owner | "Owner" (anonim) | 123456 | Pemilik, tidak pakai nama personal di sistem |
| Kasir | Jason | 111111 | Anak owner |
| Kasir | Bryant | 111111 | Anak owner |
| Kasir | Chen Hong | 111111 | Anak owner |
| Waiter | Amel | 222222 | Juga buat & antar minuman |
| Waiter | Yanti | 222222 | Juga masak tapi masak tidak ditrack di sistem |
| (tidak ada akun) | Lisa | - | Masak only di rumah owner |

PIN boleh duplikat antar pegawai karena identifikasi via nama saat login.

## Conventions

- API response shape: `{ success, message, data }` - preserve via `sendSuccess`/`sendError` di `utils/response.ts`.
- Errors: throw `AppError(message, statusCode)`; central `errorHandler` formats. Zod validation errors → 422.
- PINs 6 digit plaintext (trade-off didokumentasikan di SKRIPSI.md); never log/return - `toPublicUser` strips field.
- Kode in English (variables, columns, enums). User-facing messages Indonesian.
- Backend port 8000, frontend port 3000; changing them updates `VITE_API_URL` + `CORS_ORIGIN`.
- **Per-phase build, incremental** - explain each phase dan tunggu review user sebelum lanjut. Ezra preferensi diskusi panjang dulu, plan/code belakangan.

## Superpowers Full Pipeline (MANDATE untuk setiap perubahan)

Setiap perubahan non-trivial (fitur baru, refactor besar, schema migration, redesign UX) **WAJIB** lewat pipeline superpowers berurutan. Subagent juga ikut pipeline ini (instruct subagent untuk pakai skill yang relevan).

| Step | Skill | Output |
|---|---|---|
| 1. Map intent + decisions | `superpowers:brainstorming` | Design spec di `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` |
| 2. Decompose ke tasks | `superpowers:writing-plans` | Plan di `~/.claude/plans/<auto-name>.md` dengan phase + checkpoint |
| 3. Isolate workspace | `superpowers:using-git-worktrees` | Worktree branch baru (jangan langsung di branch utama) |
| 4. Implementasi backend | `superpowers:test-driven-development` | Test dulu (Zod schema + service), baru impl |
| 5. Eksekusi plan | `superpowers:executing-plans` ATAU `superpowers:subagent-driven-development` | Per-phase checkpoint review |
| 6. Pre-claim verification | `superpowers:verification-before-completion` | Run tests + tsc + vite build + manual e2e, bukti sebelum claim |
| 7. Code review | `superpowers:requesting-code-review` | Review pass sebelum commit-push |
| 8. Branch finishing | `superpowers:finishing-a-development-branch` | Merge/PR strategy |

**Jangan skip step.** Kalau ragu apakah perubahan butuh full pipeline atau cuma quick edit, default ke full pipeline — overhead diskusi lebih murah daripada rework.

## Frontend Consistency Mandate

Sebelum tulis komponen UI baru (page, modal, form, dialog), **WAJIB**:

1. **Audit 2-3 referensi sejenis** di project. Untuk page CRUD owner: lihat [MenuPage.tsx](frontend/src/pages/MenuPage.tsx), [BillsPage.tsx](frontend/src/pages/BillsPage.tsx), [PaymentMethodsPage.tsx](frontend/src/pages/PaymentMethodsPage.tsx). Untuk modal: lihat [PaymentModal.tsx](frontend/src/components/PaymentModal.tsx), modal di [RawMaterialsTab](frontend/src/pages/StockPage.tsx).
2. **Pakai primitive existing**:
   - Dialog: `frontend/src/components/ui/dialog.tsx`
   - Combobox/Select: `frontend/src/components/ui/combobox.tsx`
   - Button, Badge, Card, Input dari `frontend/src/components/ui/`
3. **Match tone+typography**: `text-body-sm text-neutral-700`, Badge variant existing, Button primary/secondary, padding card konsisten dengan halaman existing.
4. **Mobile-first**: 1-column di HP, 2-column di desktop. Tap target minimum `h-12 md:h-14`.
5. **State management**: React Query untuk server state (key `['resource-name']`, invalidate on mutation), Zustand cuma untuk client state (auth, cart).
6. **Service layer**: 1 file per resource di `frontend/src/services/<name>Service.ts`, pakai shared Axios instance dari `frontend/src/lib/api.ts`.

**Jangan one-off styling.** Kalau butuh primitive baru, diskusi dulu — jangan langsung bikin. Frontend penting karena ini POS yang dipakai harian — konsistensi visual = trust user.

## Memory Rules (wajib ikuti)

- **Tanya dulu** sebelum desain operasional baru - jangan asumsi dari template generik. (Lihat memory `feedback_ask_resto_specifics`.)
- **Catat tiap selesai** ke MD knowledge + memory yang relevan. Jangan biarkan keputusan cuma di chat history. (Lihat memory `feedback_log_everything_for_session_continuity`.)
- **Stick to chosen path** - kalau user pilih jalur tertentu, jangan re-suggest alternative yang sudah ditolak. (Lihat memory `feedback_stick_to_chosen_path`.)
- **Build incremental** - satu file per step, jelaskan + tunggu review. (Lihat memory `feedback_incremental_build`.)
