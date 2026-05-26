---

## Tugas

Buat **implementation plan** untuk refactor "shift decoupling" yang desainnya sudah di-approve di sesi sebelumnya.

Eksekusi plan-nya nanti, dengan disiplin: per-phase commit dan review user sebelum lanjut. Jangan langsung coding bulk.

## Wajib Dibaca Berurutan Sebelum Kerja Apapun

1. **`CLAUDE.md`** - state proyek terkini, perintah dev, konvensi.
2. **`docs/operasional-resto.md`** - ground truth bisnis resto REV 2.3 (sumber kebenaran tertinggi).
3. **`docs/superpowers/specs/2026-05-25-shift-decoupling-design.md`** - design yang sudah di-approve. Ini adalah **sumber tugas** kamu. Jangan ubah desain, cuma implement.
4. **`~/.claude/projects/c--Users-ezrak-Documents-Skripsi-Skripsi-POS-Restaurant/memory/project_session_handoff.md`** - handoff state akhir sesi sebelumnya (kalau ada).
5. **`~/.claude/projects/.../memory/project_resto_operational_truths.md`** - ringkasan operasional REV 2.3.
6. **`docs/superpowers/specs/2026-05-24-permission-matrix-design.md`** - permission matrix REV 2.3 (tidak berubah, jangan diutak-atik).

Setelah baca, **konfirmasi ke user** dalam 3-5 kalimat: "Saya sudah baca X, ringkasan masalahnya Y, yang harus saya kerjakan Z. Lanjut ke writing-plans?"

## Workflow

1. Invoke skill **`superpowers:writing-plans`** untuk struktur plan.
2. Plan harus pecah jadi **phase berurutan**, tiap phase punya:
   - File yang diubah (path absolut)
   - Diff garis besar (apa yang dirubah)
   - Verification command (`tsc --noEmit`, `npm run lint`, `npm run build`, manual smoke)
   - Acceptance criteria (apa yang harus benar setelah phase selesai)
3. Phase yang masuk akal:
   - **Phase 0:** Backup DB current state (kalau perlu) + verifikasi baseline (tsc/build hijau).
   - **Phase 1:** Schema migration - rename `Transaction.cashierId` → `createdById` di Prisma, run `db push --force-reset` + re-seed. Verifikasi schema di DB + Prisma client regenerate.
   - **Phase 2:** Backend `shifts.service` - ubah `getActiveShift` jadi `getActiveShifts` (return array system-wide). Update controller + routes + Zod schema. Backend tsc hijau.
   - **Phase 3:** Backend `transactions.service` - auto-resolve shift, validasi single active shift, throw 409 kalau multi-active. Update view shape (createdById/createdByName/shiftCashierName). Backend tsc + smoke endpoint via curl/postman.
   - **Phase 4:** Frontend `shiftService` + `transactionService` + types - match new contract.
   - **Phase 5:** Frontend `<OpenShiftDialog>` extract dari CashierDashboard → standalone component, dipakai oleh CashierDashboard + POSPage.
   - **Phase 6:** Frontend POSPage gate refactor - 3 case render (0/1/2+ active shifts × per role).
   - **Phase 7:** Frontend CashierDashboard + OwnerDashboard refactor (shift panel).
   - **Phase 8:** Frontend HistoryPage refactor (cashierName → createdByName + shiftCashierName).
   - **Phase 9:** End-to-end manual smoke test via `npm run dev`:
     - Cashier login → buka shift → input order → tutup shift
     - Owner login (kasir aktif) → input order via POS → cek createdBy di history
     - Owner login (no kasir aktif) → POS show info card, tidak ada CTA
     - Waiter fallback flow
     - Overlap: open 2 shifts → coba input → ditolak
4. Setiap phase: kamu **stop**, tunjukkan hasil, user verify, lalu user instruct lanjut.

## Aturan Disiplin (Lesson Learned dari Sesi Sebelumnya)

- ❌ **JANGAN terburu-buru.** Sesi sebelumnya saya bundle 10 pass refactor sekaligus dan banyak yang flop. Per-phase commit-pause-review.
- ❌ **JANGAN asumsi behavior.** Selalu cek code asli sebelum claim "ini sudah begini". Sesi sebelumnya saya salah claim auth logout bug.
- ❌ **JANGAN refactor di luar scope.** Cuma shift decoupling. Jangan utak-atik primitive design system, jangan rewrite page yang tidak terkait shift.
- ❌ **JANGAN bikin file baru kalau yang lama bisa di-edit.** Update in place dulu, baru pertimbangkan extract.
- ❌ **JANGAN ubah permission matrix REV 2.3.** Tetap utuh. Implementasi gate yang berubah, bukan permission.
- ✅ **TANYA kalau ragu.** Pakai `AskUserQuestion` untuk klarifikasi, jangan asumsi.
- ✅ **VERIFIKASI sebelum claim done.** Jalankan tsc + lint + build sebelum bilang "phase X selesai".
- ✅ **PAKAI primitive yang sudah ada.** Sesi sebelumnya saya bikin `frontend/src/design-system/primitives/` (Button, Dialog, Sheet, Tabs, dll). Pakai itu, jangan bikin custom.

## Out of Scope (Eksplisit)

- Permission matrix REV 2.3 - utuh, jangan diubah
- Settlement model overhaul (1 settlement per shift tetap)
- HPP / cost tracking - out of scope skripsi
- UI redesign global - cuma POSPage gate + Owner/Cashier dashboard shift panel
- Backend authentication / role middleware - sudah final
- StarUML diagram update - defer ke setelah implementasi
- `docs/operasional-resto.md` update - defer (bisa nanti setelah field rename diaplikasikan dan disepakati)

## Open Questions (di Spec) - JANGAN dipecahkan, biarkan deferred

1. Settlement untuk shift pagi (selain malam) - open, jangan di-touch.
2. Layout shift indicator (sidebar/header) - nice-to-have, skip dulu.
3. Owner force-close shift via UI - defer.
4. Production migration data - DB dev fresh, abaikan.

## Success Criteria untuk Plan (Sebelum Mulai Eksekusi)

Plan dianggap selesai dan siap eksekusi kalau:
- ✅ Tiap phase punya entry/exit criteria jelas
- ✅ Tiap file yang diubah disebutkan path absolutnya
- ✅ Verifikasi command tertulis di tiap phase
- ✅ Urutan phase logis (schema → backend → frontend, tidak melompat)
- ✅ Manual smoke test scenario eksplisit di Phase 9
- ✅ Tidak ada step yang ambigu / butuh "ya nanti aja"
- ✅ User sudah baca dan approve via ExitPlanMode

Setelah plan approved → eksekusi dimulai Phase 0, satu-per-satu.

## Tone & Komunikasi

- Pakai bahasa Indonesia santai-profesional (sama dengan sesi sebelumnya).
- Penjelasan singkat, tidak bertele-tele.
- Tidak self-flagging berlebihan kalau ada kesalahan - fix, sebut singkat, lanjut.
- Tidak emoji kecuali user pakai duluan.

## Pertama Kali Mulai

1. Baca 6 file di atas.
2. Ringkas pemahaman ke user dalam 5 kalimat.
3. Tunggu konfirmasi user untuk lanjut writing-plans.
4. Invoke `superpowers:writing-plans` skill.
5. Susun plan berdasarkan struktur Phase 0-9 di atas.
6. Tulis plan ke file (sesuai konvensi writing-plans).
7. Self-review (no TBD, scope correct, urutan logis).
8. User review plan.
9. Setelah approved, mulai Phase 0.

---

**Salin teks di atas mulai dari "## Tugas" sampai akhir ke awal sesi baru.**
