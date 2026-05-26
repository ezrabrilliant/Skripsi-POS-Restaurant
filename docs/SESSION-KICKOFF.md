# Session Kickoff Prompt - Untuk Sesi Claude Code Baru (REV 2.5)

> **Cara pakai:** Copy salah satu prompt di bawah, paste sebagai pesan pertama di sesi Claude Code baru. Adjust seperlunya untuk task yang ingin dilanjutkan.
>
> **State saat ini (2026-05-26 sore):**
> - Backend REV 2.4 + REV 2.5 (Phase 1-7) **DONE**: schema 15 entitas, TransactionPayment table, addPayment/removePayment endpoint, settlement+dashboard query via TxPayment, smoke test 20 skenario PASS.
> - Frontend REV 2.4 **DONE**, REV 2.5 (Phase 8-16) **PENDING**: types/service, CombineTableModal baru, PaymentModal split tender mode + combine button, TablesPage dropdown, HistoryPage badge audit, POSPage orchestrate, hapus SplitBillModal+MergeBillModal, doc updates.
> - Plan implementasi REV 2.5: `~/.claude/plans/saya-mau-brainstorm-tentang-glowing-orbit.md`
> - Spec design: `docs/superpowers/specs/2026-05-26-split-tender-combine-design.md`
> - Pattern reference: `docs/knowledge/SPLIT-MERGE-PATTERNS.md`

---

## 🟢 Prompt PALING SINGKAT (untuk continuity)

```
Sesi sebelumnya backend REV 2.5 Split Tender + Combine Tables done (Phase 1-7).
Frontend (Phase 8-16) masih pending.

Sebelum apapun:

1. Baca CLAUDE.md (header "WAJIB BACA DULU")
2. Baca docs/operasional-resto.md (ground truth REV 2.3 + permission matrix)
3. Baca memory project_session_handoff.md (state REV 2.5 + DO/DON'T + TODO Phase 8-16)
4. Baca docs/superpowers/specs/2026-05-26-split-tender-combine-design.md (spec REV 2.5)
5. Baca docs/knowledge/SPLIT-MERGE-PATTERNS.md (pattern + 4 UC operasional)

Setelah baca, konfirmasi state dengan saya, lalu tanya saya mau lanjut dari mana.
JANGAN langsung edit code/schema tanpa diskusi.
```

---

## 🟡 Prompt LENGKAP (rekomendasi untuk handoff yang aman)

```
Halo, ini lanjutan sesi skripsi POS Restoran "Ayam Bakar Banjar Monosuko"
(Ezra Brilliant, C14220315). Sesi sebelumnya backend REV 2.5 Split Tender +
Combine Tables Phase 1-7 done. Frontend Phase 8-16 masih pending.

**WAJIB BACA DULU sebelum action apapun:**
1. `CLAUDE.md` (header "WAJIB BACA DULU" di root proyek)
2. `docs/operasional-resto.md` (ground truth REV 2.3 - sumber tertinggi,
   ada seksi "Permission Matrix")
3. `docs/superpowers/specs/2026-05-26-split-tender-combine-design.md`
   (spec REV 2.5 - design final yang user approve)
4. `docs/knowledge/SPLIT-MERGE-PATTERNS.md`
   (ringkasan pattern industri + 4 UC konkret untuk reference UI)
5. `~/.claude/projects/c--Users-ezrak-Documents-Skripsi-Skripsi-POS-Restaurant/memory/project_session_handoff.md`
   (state REV 2.5 lengkap, DO/DON'T sesi, TODO Phase 8-16)
6. `~/.claude/plans/saya-mau-brainstorm-tentang-glowing-orbit.md`
   (plan implementasi step-by-step Phase 1-16)

**Memory rules yang HARUS dipatuhi:**
- `feedback_ask_resto_specifics.md` - WAJIB tanya saya sebelum desain operasional baru
- `feedback_log_everything_for_session_continuity.md` - catat tiap selesai
  ke MD knowledge + memory yang relevan
- `feedback_incremental_build.md` - satu file/group per step, jelaskan + tunggu review

**State REV 2.5 (penting untuk dipahami):**
- 3 role: Owner, Kasir, Waiter (REV 2.4: waiter+kasir co-equal input order via HP,
  paper workflow obsolete)
- Login = form 2 field input nama + PIN murni
- Schema **15 entitas** (REV 2.5: tambah TransactionPayment, drop
  Tx.paymentMethod + paymentBank + TransactionItem.partyId)
- Backend REV 2.5: drop splitTransaction, refactor payTransaction → addPayment +
  removePayment, settlement+dashboard query via TxPayment table
- Split bill multi-party (Even / By Item) DI-DROP - drop dari REV 2.5 karena
  rare di Indo (customer pakai Splitwise / transfer pribadi)
- Adopt: Split Tender (1 customer multi-method) + Combine Tables (TablesPage +
  PaymentModal entry)

**JANGAN:**
- Langsung edit code tanpa baca spec REV 2.5 + pattern docs
- Revive partyId / splitTransaction (sudah di-drop)
- Ubah backend lagi tanpa diskusi (backend done & smoke test PASS)
- Asumsi Teh price = 5K (sebenarnya 8K per seed) - pakai actual fetch
- Pakai `npm run db:fresh` (BROKEN, folder migrations dihapus) - pakai
  `npx prisma db push --force-reset` (butuh PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION
  env) + `npm run db:seed` manual
- Bikin plan / call ExitPlanMode sebelum diskusi tuntas

Setelah baca semua, summarize:
1. State proyek sekarang (Phase 1-7 done backend, Phase 8-16 pending frontend)
2. Apa yang completed di sesi terakhir
3. Apa file yang akan saya sentuh untuk Phase 8 dulu

Lalu tunggu saya jawab.
```

---

## 🔴 Prompt SPESIFIK - lanjut REV 2.5 frontend (Phase 8-16)

```
Lanjutan sesi skripsi POS resto. Baca file handoff dulu:
- CLAUDE.md, docs/operasional-resto.md, memory project_session_handoff.md
- docs/superpowers/specs/2026-05-26-split-tender-combine-design.md
- docs/knowledge/SPLIT-MERGE-PATTERNS.md
- ~/.claude/plans/saya-mau-brainstorm-tentang-glowing-orbit.md

Setelah baca, fokus task: **REV 2.5 frontend implementation Phase 8-16**.

Backend sudah lengkap & smoke test PASS:
- Schema: TransactionPayment table, drop Tx.paymentMethod/paymentBank + partyId
- Endpoint: POST /transactions/:id/payments + DELETE /payments/:paymentId
- mergeBills tetap (dipakai untuk Combine Tables)
- Settlement + dashboard query via TxPayment groupBy

Yang perlu di frontend (urut dependency):

**Phase 8**: `types/index.ts` (add TransactionPayment, drop pm/pb di Transaction,
add payments[], drop partyId di TransactionItem) + `services/transactionService.ts`
(drop split, replace pay → addPayment + removePayment).

**Phase 9**: NEW `components/CombineTableModal.tsx` - props sourceTableId?/targetTableId?,
fetch open Tx per meja (filter same shift), preview combined total, confirm →
transactionService.merge.

**Phase 10**: REFACTOR `components/PaymentModal.tsx` - state mode='single'|'split',
toggle "Bayar Sebagian", list payment slices + hapus, form tambah slice (numpad
amount + method + bank), sisa indicator, "Selesai Bayar" saat sisa=0. Tambah
button "⌕ Gabung Meja Lain" overlay CombineTableModal.

**Phase 11**: `pages/TablesPage.tsx` - tambah "⋮" dropdown menu per meja occupied
(owner+kasir gate via useAuthStore). Opsi "Gabung ke meja lain" → trigger
CombineTableModal dengan sourceTableId.

**Phase 12**: `pages/HistoryPage.tsx` - hapus import SplitBillModal + MergeBillModal
+ row actions Split/Merge. Tambah badge "🔗 Gabungan dari #X" (Tx.mergedFrom.length>0)
/ "🔗 Tergabung ke → #Y" (Tx.mergedIntoId). Badge clickable scroll-to-Tx.

**Phase 13**: `pages/POSPage.tsx` - refactor handlePaymentConfirm orchestrate
addPayment (single = 1 call, split = N call). Pass availableTables list ke
PaymentModal.

**Phase 14**: DELETE `components/SplitBillModal.tsx` + `components/MergeBillModal.tsx`.

**Phase 15**: `npx tsc -b && npm run build` di frontend. Fix any leftover refs
to dropped pm/pb/partyId.

**Phase 16**: Doc updates - `docs/operasional-resto.md` REV 2.5 (payment + meja),
`docs/knowledge/ERD.md` (15 entitas), `docs/DATA-DICTIONARY.md`, `CLAUDE.md`
(tambah row REV 2.5 di status table).

Mulai Phase 8 dulu, jelaskan diff, tunggu review, baru lanjut Phase 9.
JANGAN batch semua sekaligus.
```

---

## 🔴 Prompt SPESIFIK - lanjut **rebuild StarUML diagrams** untuk REV 2.5

```
Lanjutan sesi skripsi POS resto. Baca file handoff dulu.

Setelah baca, fokus task: **update Skripsi.mdj StarUML untuk REV 2.5**.

ERD sudah REV 2.2 (14 entitas). REV 2.5 perlu update ERD:
- Tambah entity TransactionPayment (id, transactionId FK, method enum, bank?,
  amount Decimal, recordedAt, recordedById FK)
- Drop Tx.paymentMethod + Tx.paymentBank (pindah ke TransactionPayment)
- Drop TransactionItem.partyId
- Relations: Tx 1-N TransactionPayment, User 1-N TransactionPayment

Use Case Diagram REV 2.3 sudah lengkap. REV 2.5 tidak menambah UC baru (split
tender = sub-aksi dari "Memproses Pembayaran" existing UC).

Activity Diagram: pertimbangkan tambah activity diagram baru "Split Tender
Payment" + "Combine Tables" kalau perlu visualisasi Bab 3 (opsional).

Build via staruml-mcp (HTTP transport di port 58321). Pastikan StarUML running
dengan apiServer=true. Pattern lihat skill .claude/skills/erd-diagram/SKILL.md.

Selesai → save Skripsi.mdj + export PNG ke docs/diagrams/.
```

---

## 🔴 Prompt SPESIFIK - update **Bab 3 skripsi** untuk REV 2.5

```
Lanjutan sesi skripsi POS resto. Baca file handoff dulu.

Setelah baca, fokus task: **update docs/knowledge/BAB-3-DRAFT.md ke REV 2.5**.

Naskah Bab 3 saat ini REV 2.3 paste-ready (13 Gambar + 15 Tabel + 18 KF).
REV 2.5 perlu update:

- Section ERD: 14 → 15 entitas (tambah TransactionPayment definition + relations)
- Section Payment Flow: tambah penjelasan Split Tender (1 Tx multi-method)
  + tabel contoh skenario (UC1 dari SPLIT-MERGE-PATTERNS.md)
- Section Meja: tambah penjelasan Combine Tables (inter-table merge) +
  contoh UC2/UC3
- Kebutuhan Fungsional: cek apakah perlu tambah KF baru untuk Split Tender +
  Combine Tables, atau cukup expand KF existing
- Activity Diagram: tambah listing kalau buat diagram Split Tender + Combine
  (opsional)
- Data Dictionary tabel: tambah entry TransactionPayment

Reference: docs/superpowers/specs/2026-05-26-split-tender-combine-design.md +
docs/knowledge/SPLIT-MERGE-PATTERNS.md.

Tunjukkan diff section per section, jangan rewrite total.
```

---

## 📌 Catatan Penting

### Lokasi file kunci (REV 2.5)

| File | Lokasi |
|---|---|
| Ground truth bisnis (REV 2.3, bump REV 2.5 pending) | `docs/operasional-resto.md` |
| Spec REV 2.5 Split Tender + Combine | `docs/superpowers/specs/2026-05-26-split-tender-combine-design.md` |
| Pattern reference Split & Merge | `docs/knowledge/SPLIT-MERGE-PATTERNS.md` |
| Spec REV 2.3 permission matrix | `docs/superpowers/specs/2026-05-24-permission-matrix-design.md` |
| Plan implementasi REV 2.5 | `~/.claude/plans/saya-mau-brainstorm-tentang-glowing-orbit.md` |
| Handoff memory | `~/.claude/projects/c--Users-ezrak-Documents-Skripsi-Skripsi-POS-Restaurant/memory/project_session_handoff.md` |
| Ringkasan ground truth | `~/.claude/projects/.../memory/project_resto_operational_truths.md` |
| Index memory | `~/.claude/projects/.../memory/MEMORY.md` |
| Onboarding repo | `CLAUDE.md` |
| Naskah skripsi Bab 3 (REV 2.3, REV 2.5 bump pending) | `docs/knowledge/BAB-3-DRAFT.md` |
| Diagrams knowledge | `docs/knowledge/{ERD,USE-CASE,ACTIVITY,FULL}.md` |
| Data dictionary (REV 2.3, REV 2.5 bump pending) | `docs/DATA-DICTIONARY.md` |
| Proposal awal (referensi) | `docs/Proposal Skripsi.md` |
| Menu lengkap | `docs/menu-ayam-bakar-banjar-monosuko.md` |

### Backend smoke test scripts (REV 2.5)

| Script | Fungsi |
|---|---|
| `backend/scripts/smoke-split-tender-combine.sh` | REV 2.5: 20 skenario Split Tender + Combine + reject overpay/discount-lock |
| `backend/scripts/smoke-shift-decoupling.sh` | REV 2.3 shift decoupling |
| `backend/scripts/smoke-phase-{4a,5,6,7,8,9}.sh` | Phase-specific smoke tests |
| ~~`backend/scripts/smoke-phase-4b.sh`~~ | DELETED REV 2.5 (split bill multi-party obsolete) |

### Tips kalau context Claude habis di tengah sesi

Sebelum context habis, minta Claude:
> "Context kamu mau habis. Update memory `project_session_handoff.md` dengan
> apa yang sudah dikerjakan + apa yang belum, supaya sesi baru bisa lanjut.
> Plus catat keputusan baru ke `project_resto_operational_truths.md` kalau ada."

### Kalau Claude mulai asumsi lagi

Tegur dengan referensi ke memory rule:
> "Kamu lagi asumsi. Baca memory `feedback_ask_resto_specifics.md` lagi.
> Tanya saya dulu via AskUserQuestion sebelum lanjut."

### Kalau Claude lupa state REV 2.5

Tegur dengan:
> "REV 2.5 update: Split bill multi-party (partyId, splitTransaction) DI-DROP.
> Adopt Split Tender (1 customer multi-method via TransactionPayment table)
> + Combine Tables (TablesPage + PaymentModal entry, reuse mergeBills endpoint).
> Schema 15 entitas. Lihat docs/superpowers/specs/2026-05-26-split-tender-combine-design.md
> + docs/knowledge/SPLIT-MERGE-PATTERNS.md."

### Kalau Claude lupa workflow REV 2.4

Tegur dengan:
> "REV 2.4 update: waiter + kasir CO-EQUAL input order via HP (paper workflow
> obsolete). Tapi Bayar tetap owner+kasir only. Multi-Pesanan per meja via
> ActiveOrdersView component."

---

## Cara pakai paling simpel

Sesi baru → buka Claude Code di project ini → paste prompt 🟡 LENGKAP → Claude bakal baca semua handoff file dulu sebelum apa-apa, lalu summarize state ke Anda, lalu tanya mau lanjut dari mana.

Kalau di tengah sesi context Claude mau habis lagi, kasih instruksi:

> "Context kamu mau habis. Update memory project_session_handoff.md dengan apa yang sudah dikerjakan + apa yang belum, supaya sesi baru bisa lanjut. Plus catat keputusan baru ke project_resto_operational_truths.md kalau ada."

---

## History versi (untuk audit trail dokumentasi)

| Rev | Tanggal | Highlight |
|---|---|---|
| REV 2.1 | 2026-05-xx | Initial - 5 OrderType, BulkStock kategori rigid, Login 2-step list picker |
| REV 2.2 | 2026-05-xx | Schema 14 entitas, RawMaterial flexible, PortionMovement + RawMaterialMovement audit log |
| REV 2.3 | 2026-05-24 | Permission matrix granular per-aksi, waiter fallback only, Login form input murni |
| REV 2.3 shift-decoupling | 2026-05-25 | Pisahkan submit user dari shift cashier, multi-cashier sharing |
| REV 2.4 | 2026-05-26 (pagi) | Multi-Pesanan per meja, field notes, waiter+kasir co-equal HP, drop Es prefix temperature toggle |
| REV 2.5 | 2026-05-26 (sore) | Split Tender (TransactionPayment table), Combine Tables, drop split bill multi-party (partyId, splitTransaction, SplitBillModal). Backend done (Phase 1-7), frontend pending (Phase 8-16). |
