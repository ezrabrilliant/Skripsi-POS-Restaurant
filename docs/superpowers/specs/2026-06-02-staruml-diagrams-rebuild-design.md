# Design Spec — Rebuild StarUML Diagrams (ERD · Use Case · Activity) ke Realita Program

> **Tanggal:** 2026-06-02
> **Topik:** Sinkronisasi diagram skripsi (`Skripsi.mdj`) + dokumen knowledge ke kondisi program POS yang sebenarnya (live di monosuko.my.id).
> **Pemicu:** Diagram StarUML masih ~REV 2.3 (memuat entitas/flow yang sudah dihapus: raw-materials, purchases, split-bill), sementara program sudah jauh berkembang (REV 2.7 shift redesign, REV 2.10 menu variants, REV 2.6 payment-method master, REV 2.11 COGS, REV 2.12 owner self-service, REV 2.13 dashboard).
> **Sumber kebenaran:** `backend/prisma/schema.prisma` + backend modules + frontend pages (BUKAN docs/knowledge yang sebagian basi).
> **Keputusan fidelity (disetujui Ezra):** **Faithful penuh** — semua 23 entitas + semua use case nyata termasuk konfigurasi owner + split-tender + COGS, lalu selaraskan naskah.

## Keputusan Scoping (disetujui)

1. **ERD:** seluruh 23 entitas + 11 enum.
2. **Use Case config owner:** dipecah halus jadi 5 UC (Kelola Metode Pembayaran, Kelola Bank, Atur PB1, Atur Identitas Resto, Atur Jam Shift).
3. **Activity diagram:** 11 diagram (set "Lengkap tesis").
4. **Cakupan:** StarUML **+** sinkron docs (ERD.md, USE-CASE.md, ACTIVITY.md, BAB-3-DRAFT.md, DATA-DICTIONARY.md, FULL.md).

## Tooling & Konvensi

- **ERD** dibangun via `mcp__staruml__generate_diagram` dengan Mermaid `erDiagram` (skill `erd-diagram`; aturan `feedback_erd_use_mermaid` — JANGAN `create_element ERDColumn` manual, kolom tidak ter-render).
- **Use Case** via skill `use-case-diagram` (`create_diagram UMLUseCaseDiagram`, `create_element_with_view UMLActor/UMLUseCase/UMLSubsystem`, `create_edge_with_view UMLAssociation/UMLInclude/UMLExtend`).
- **Activity** via skill `activity-diagram` (swimlane `UMLActivityPartition` SEBELUM node, action bahasa bisnis non-teknis, `UMLActivityFinalNode` bullseye, decision berlabel pertanyaan + guard `Ya`/`Tidak`).
- **Save:** panggil `save_project` setelah tiap diagram (aturan `feedback_save_after_each_change`); pastikan tersimpan ke `Skripsi.mdj` (MCP sempat lapor `filename:null` — verifikasi/`save_project_as` ke path repo root saat mulai).
- **Bahasa:** elemen diagram Bahasa Indonesia bisnis; kode/kolom Inggris hanya di ERD.

---

## BAGIAN A — ERD (23 entitas, 11 enum, ~39 relasi)

### Entitas per kelompok

| Kelompok | Entitas |
|---|---|
| Core operasional (7) | `users`, `shifts`, `transactions`, `transaction_items`, `transaction_payments`, `settlements`, `settlement_method_counts` |
| Katalog & varian (8) | `menus`, `menu_option_groups`, `menu_options`, `menu_variants`, `menu_variant_options`, `paket_components`, `paket_choice_options`, `transaction_item_selections` |
| Stok porsi (2) | `portion_stocks`, `portion_movements` |
| Konfigurasi pembayaran (3) | `payment_methods`, `banks`, `payment_method_banks` |
| Admin/config/audit (3) | `bills`, `app_settings`, `menu_cost_movements` |

### Enum (11)
`UserRole(owner,cashier,waiter)` · `TransactionStatus(open,paid,void)` · `OrderType(dineIn,takeaway)` · `SettlementStatus(submitted,reviewed)` · `ShiftType(pagi,malam)` · `StockType(portion,linked,nonStock)` · `MenuKind(simple,variant,paket)` · `PaketComponentKind(fixed,choice)` · `PortionMovementReason(order,restockMorning,restockEmergency,manualAdjust,refundVoid)` · `MenuCostChangeReason(initialSet,manualEdit)` · `BillCategory(kebersihan,listrik,air,parkir,sewa)`

### Relasi kunci (≈39 FK; lengkap di Mermaid saat build)
- **users →** transactions(createdById), shifts, settlements(cashier), settlements(reviewer, 0..1), bills, portion_movements, menu_cost_movements, transaction_payments(recordedBy), app_settings(updatedBy, 0..1)
- **menus →** portion_stocks(1:0..1, PK=FK), transaction_items, portion_movements, menu_cost_movements, menu_option_groups, menu_variants(MenuOwnsVariant), menu_variants(stockTarget, 0..1), paket_components(owner), paket_components(targetMenu, 0..1), paket_choice_options(targetMenu, 0..1), menu_variants(costSource, 0..1 — FK logis SET NULL)
- **menu_variants →** menu_variant_options, transaction_items(0..1), paket_components(targetVariant, 0..1), paket_choice_options(targetVariant, 0..1)
- **menu_option_groups →** menu_options; **menu_options →** menu_variant_options; **paket_components →** paket_choice_options
- **shifts →** transactions, settlements(1:0..1)
- **transactions →** transaction_items(cascade), transaction_payments(cascade), transactions(self-ref `mergedIntoId` MergeBill), portion_movements(0..1 SetNull)
- **transaction_items →** portion_movements(0..1 SetNull), transaction_item_selections(cascade)
- **settlements →** settlement_method_counts(cascade)
- **payment_methods →** payment_method_banks(cascade), settlement_method_counts(via `code`, NoAction)
- **banks →** payment_method_banks(cascade)

### Kolom penting yang WAJIB tampil (delta vs ERD lama)
- `menus.cost` (modal/COGS, owner-only), `menus.kind`, `menus.pos_visible`
- `transaction_items.unit_cost`, `.variant_id`
- `transactions.tax_borne_amount` (PB1 ditanggung resto), `.merged_into_id`; **TIDAK ada** `payment_method`/`payment_bank` (pindah ke `transaction_payments`)
- `shifts.active_marker` (single-OPEN guard, `@@unique`), **tanpa** `@@unique(date,cashier,type)`
- `settlements` keyed `@@unique(date)` (whole business day) + child `settlement_method_counts`; **TANPA** 12 kolom `system_*`/`actual_*`
- `app_settings`: tax (enabled/rate/chargedToCustomer), identitas resto (name/address/hours/phone/logo), shift window (timezone/pagiStart/changeover/malamEnd), stock (restockMultiple/lowStockThreshold)

### Hapus dari ERD lama
`vendors`, `purchases`, `purchase_items`, `raw_materials`, `raw_material_movements`, `units` + enum `RawMaterialMovementReason`/`RawMaterialCategory`. Tidak ada `partyId`.

---

## BAGIAN B — Use Case Diagram (3 aktor, 26 bubble)

**Aktor:** Owner · Kasir · Waiter (Sistem implisit). Boundary: "Sistem POS Restoran Ayam Bakar Banjar Monosuko".

**Realita permission (dari kode):** input order = 3 role ; bayar/void/merge/unmerge = owner+kasir; buka shift = kasir; tutup shift/settlement = owner+kasir; stok (semua operasi) = semua role; menu/COGS/users/bills/payment-methods/banks/settings = owner.

### Daftar UC
**Shared (1):** 1. Login

**Operasional order & meja:**
2. Mengelola Pesanan *(owner+kasir+waiter)* — dineIn(pilih meja)/takeaway, multi-round, edit/hapus item
   - «extend» **Memilih Varian/Paket** — saat item varian/paket
3. Memproses Pembayaran (Split Tender) *(owner+kasir)* — metode dinamis, bank picker, PB1, split tender
   - «extend» **Mencetak Struk** — jika pelanggan minta (PDF 58mm)
4. Menggabungkan Pesanan/Meja *(owner+kasir)* — merge pointer + unmerge
5. Membatalkan Pesanan *(owner+kasir)* — void, blok jika hari sudah settle
6. Memantau Status Meja *(owner+kasir+waiter)*

**Shift & setoran:**
7. Buka Kasir *(kasir)* — window-aware, single-OPEN guard
8. Tutup Kasir *(owner+kasir)* — mode final/handover
9. Setoran Akhir Hari *(owner+kasir)* — whole business day, blind count
10. Mereview Settlement *(owner)*

**Stok porsi (semua role):**
11. Restock Stok Porsi · 12. Mencatat Barang Masuk · 13. Opname Stok Porsi · 14. Menandai Item Habis

**Admin & laporan (owner):**
15. Mengelola Menu · 16. Kelola Modal/COGS Menu · 17. Mengelola Pengguna · 18. Mencatat Tagihan Bulanan · 19. Melihat Dashboard & Laporan *(per role: owner/kasir/waiter)*

**Konfigurasi owner (5, halus):**
20. Kelola Metode Pembayaran · 21. Kelola Bank · 22. Atur Pajak PB1 · 23. Atur Identitas Resto · 24. Atur Jam Shift

> Total: **24 UC dasar + 2 «extend» (Memilih Varian/Paket, Mencetak Struk) = 26 bubble.**

### Relasi
- «include» → `Login` dari semua UC operasional (semua kecuali Login).
- «extend»: Memilih Varian/Paket → Mengelola Pesanan; Mencetak Struk → Memproses Pembayaran.
- (Opsional, tidak dipakai) generalization Kasir/Waiter — pakai asosiasi langsung agar jelas.

---

## BAGIAN C — Activity Diagram (11)

Swimlane + bahasa bisnis (skill `activity-diagram`). Decision berlabel pertanyaan, guard `Ya`/`Tidak`.

| # | Diagram | Swimlane | Inti / decision utama |
|---|---|---|---|
| A.1 | Login | Pengguna · Sistem | Form nama+PIN (cached: PIN-only numpad). Decision **Nama & PIN benar?** loop bila salah. |
| A.2 | Mengelola Pesanan (Input Order) | Waiter · Kasir · Sistem | **Tipe order?** (dineIn pilih meja / takeaway). **Item varian/paket?** → pilih varian + slot paket. **Tambah item lagi?** Submit → kurangi stok porsi (boleh minus) + catat log + snapshot modal. Multi-round. |
| A.3 | Memproses Pembayaran (Split Tender) | Kasir · Sistem | Rincian + diskon (slice pertama). Pilih metode (dinamis). **Metode butuh bank?** → pilih bank. **Bayar penuh / split?** loop slice sampai lunas. PB1 2-sumbu (**ditanggung resto / dibebankan?**). Finalize: status=paid + re-stamp shift + cascade merge. **Pelanggan minta struk?** → PDF. |
| A.4 | Buka Kasir (Buka Shift) | Kasir · Sistem | **Sudah ada shift aktif?** (single-OPEN→tolak). **Tipe pagi/malam?** **Dalam jam window?** Catat modal awal. |
| A.5 | Tutup Kasir (Tutup Shift) | Kasir · Owner · Sistem | **Mode final / handover?** Final: **ada transaksi belum dibayar?** → tampilkan daftar per meja, batal tutup. Tutup: lepas single-OPEN guard. |
| A.6 | Setoran Akhir Hari (Settlement) | Kasir · Owner · Sistem | Whole business day. Preview total sistem + breakdown bank. Input fisik per metode (blind count). Variance otomatis. Submit. **Owner review?** → reviewed. |
| A.7 | Restock Stok Porsi Pagi | Waiter/Kasir · Sistem | Saran kelipatan 5. Loop per item. Submit → tambah stok + log restock pagi. |
| A.8 | Mencatat Barang Masuk | Waiter/Kasir · Sistem | Restock darurat (owner kirim dari rumah). Input qty datang + catatan. Submit → tambah stok + log darurat. |
| A.9 | Opname Stok Porsi | Waiter/Kasir · Sistem | Hitung fisik. **Selisih ≠ 0?** → koreksi + log penyesuaian (kalau sama, tidak log). |
| A.10 | Mencatat Tagihan Bulanan | Owner · Sistem | Form bulan+kategori+jumlah. **Valid?** Simpan. |
| A.11 | Kelola Menu + Modal/COGS | Owner · Sistem | Buat/ubah menu (+ varian/paket builder). Set modal. **Modal berubah?** → catat riwayat (set-awal/ubah). stockType=portion → sinkron stok. |

**Hapus diagram lama:** Opname Raw Materials, Mencatat Pembelian (fitur dihapus). Old "Split + Merge Bill" diganti: split-bill hilang; merge tercakup di A.3 (gabung saat bayar). Old "Tutup Kasir" yang mencampur close+settlement dipecah jadi A.5 + A.6.

---

## BAGIAN D — Sinkronisasi Dokumen

Selaraskan ke realita (8 koreksi besar): split-**tender** (bukan split-bill/`partyId`) · payment-method **master** (bukan enum, tanpa kolom di Transaction) · hapus raw-materials/purchases/vendors · **PB1 2-sumbu owner-configurable** (default OFF) · settlement **whole business day** (`@@unique(date)`, dinamis, closer-of-last-shift) · **shift REV 2.7** (window + activeMarker + re-stamp) · merge pointer-only · **COGS** per-menu owner-only.

| File | Aksi |
|---|---|
| `docs/knowledge/ERD.md` | 10→23 entitas, 11 enum, ~39 relasi; hapus seksi raw/purchase; tambah varian/paket/payment-config/app_settings; betulkan kolom Transaction/Settlement basi. |
| `docs/knowledge/USE-CASE.md` | 19→26 UC; aktor & permission nyata; hapus split-bill; tambah 5 UC config + merge/unmerge/void/COGS; perbaiki narasi Bab 3. |
| `docs/knowledge/ACTIVITY.md` | 9→11 diagram; mapping baru; hapus raw/pembelian/split-bill; tambah Buka Shift & Settlement terpisah; revisi narasi. |
| `docs/knowledge/BAB-3-DRAFT.md` | renumber Gambar/Tabel; narasi ERD/UC/Activity selaras; flag review thesis-level Ezra. |
| `docs/DATA-DICTIONARY.md` | 23 entitas + kolom delta (cost/unit_cost/tax_borne/active_marker/app_settings/payment_methods/settlement_method_counts). |
| `docs/knowledge/FULL.md` | overview kompilasi 23 entitas / 26 UC / 11 activity. |

---

## BAGIAN E — Urutan Build (incremental, checkpoint per fase)

1. **Fase 0 — Persiapan StarUML:** verifikasi project `Skripsi.mdj` ter-load; inventaris diagram lama; hapus/`close` diagram usang (raw materials, pembelian, split-bill) atau biarkan ditimpa. Checkpoint.
2. **Fase 1 — ERD** (Mermaid erDiagram, 23 entitas). Save. **Checkpoint review Ezra** (screenshot).
3. **Fase 2 — Use Case** (26 bubble, include/extend). Save. **Checkpoint review**.
4. **Fase 3 — Activity A.1–A.6** (inti). Save tiap diagram. **Checkpoint review**.
5. **Fase 4 — Activity A.7–A.11** (sisa). Save tiap diagram. **Checkpoint review**.
6. **Fase 5 — Sinkron dokumen** (Bagian D). **Checkpoint review**.
7. **Fase 6 — Verifikasi akhir:** `get_diagram_image_by_id` tiap diagram untuk konfirmasi render; konsistensi diagram↔docs.

**Catatan risiko:** StarUML butuh Ctrl+R / interaksi user bila extension perlu reload (aturan `feedback_batch_extension_changes`); activity diagram paling rawan (orphan node) → ikuti pattern skill ketat (partition dulu). Build besar → eksekusi per-diagram dengan verifikasi, bukan borongan.
