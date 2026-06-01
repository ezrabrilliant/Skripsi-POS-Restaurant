# Fitur C — Picker minuman paket: bercabang (reuse varian) + upcharge per-varian

Status: **BELUM dibuat** (ditunda owner 2026-06-02). Bikin di sesi terpisah via pipeline superpowers.

## Konteks / kenapa
Slot "Pilih Minuman" di paket sekarang = **daftar datar 5 tombol** (Teh Tawar, Teh Manis, Teh Tawar
Jumbo +4rb, Teh Manis Jumbo +5rb, Air Mineral) — hasil Fase 4 "light" (1 opsi per-varian, di-pin
`targetVariantId`). Owner mau tampilan **rapih bercabang** seperti Teh standalone (picker grup
Rasa/Ukuran/Suhu) TAPI tetap **Jumbo +5rb, tawar/manis biasa gratis**.
Trade-off inti: picker bercabang = 1 opsi "Teh" = 1 `upcharge` → nggak bisa beda per-varian.
Solusi: simpan upcharge **per (opsi-paket × varian)**.

## Yang SUDAH ada (REV menu-sku-link, commit `83227cd`, LIVE prod monosuko.my.id)
- `resolvePaketUpcharge(graph,item)` — backend/src/modules/menus/variant-resolver.ts (sum upcharge opsi
  terpilih; match by (targetMenuId,targetVariantId), fallback targetMenuId).
- `buildMenuGraph` (transactions.service.ts) — choice options bawa `upcharge`.
- `resolveItems` — `unitPrice` paket += resolvePaketUpcharge (server-side recompute).
- PaketBuilder.tsx — tombol "Muat varian dari menu" → bikin 1 opsi PER varian (targetVariantId pin + upcharge).
- VariantPickerModal.tsx PaketPicker — opsi `targetVariantId=null` → `NestedVariantLoader` buka picker grup
  (BERCABANG SUDAH JALAN); opsi di-pin → flat. Sub-pick varian saat ini **TIDAK** ubah harga paket.
- Skema: `PaketChoiceOption { targetMenuId, targetVariantId, upcharge }`.

## Desain Fitur C
Model: **1 opsi paket "Teh"** (`targetMenuId`=menu varian, `targetVariantId`=NULL → POS bercabang) +
upcharge **per-varian** disimpan terpisah.

### Backend
- Skema: tabel baru `PaketChoiceVariantUpcharge { id, paketChoiceOptionId FK→PaketChoiceOption(Cascade),
  menuVariantId FK→MenuVariant(Restrict), upcharge Decimal(10,2) }` + `@@unique([paketChoiceOptionId, menuVariantId])`.
  Migrasi ADITIF (`prisma db push`, no data-loss).
- `buildMenuGraph`: tiap choice option bawa `variantUpcharges?: Record<variantId, number>`.
- `resolvePaketUpcharge`: kalau opsi `targetVariantId==null` + `chosen.variantId` ada →
  `variantUpcharges[chosen.variantId] ?? option.upcharge ?? 0`. (Pertahankan jalur lama buat opsi flat/simple.)
- menus.service (detail + upsert replace-children): include + persist `variantUpcharges`.
- menus.schema: `PaketChoiceOptionUpsertPayload` + `variantUpcharges`.

### Frontend
- types/index.ts: `PaketChoiceOptionDetail.variantUpcharges?: {menuVariantId:number; upcharge:number}[]`.
- PaketBuilder.tsx: kalau opsi target = menu varian → tampilkan **grid varian-nya + input upcharge per varian**
  (ganti perilaku "Muat varian" yg bikin opsi terpisah). Simpan ke variantUpcharges.
- VariantPickerModal.tsx (PaketPicker + NestedVariantLoader): saat varian dipilih di picker bercabang,
  ambil `option.variantUpcharges[variantId]` → tambah ke `unitPrice` paket. (Sekarang sub-pick = 0.)

### Data migration
Konversi balik slot "Pilih Minuman" paket **#52/#53/#55/#56** dari 5 opsi datar → 1 opsi "Teh"
(`targetMenuId=60`, `targetVariantId=null`) + `variantUpcharges {135:0, 137:0, 136:4000, 138:5000}` +
1 opsi "Air Mineral" (`#39`). Varian Teh: 135=Tawar/Biasa, 137=Manis/Biasa, 136=Tawar/Jumbo, 138=Manis/Jumbo.
Script `backend/scripts/migrate-paket-drink-nested.ts` (backup dulu). Apply LOKAL + PROD.

## File yang disentuh
schema.prisma · variant-resolver.ts · menus.{schema,service}.ts · transactions.service.ts ·
PaketBuilder.tsx · VariantPickerModal.tsx · types/index.ts · backend/scripts/migrate-paket-drink-nested.ts

## Verifikasi
- vitest: resolvePaketUpcharge per-varian (opsi nested + chosen variant → upcharge benar; flat tetap jalan).
- e2e: order Paket A → "Pilih Minuman" = [Teh][Air Mineral] → tap Teh → picker grup → pilih Manis+Jumbo →
  harga paket **+5.000**; Tawar Jumbo +4.000; biasa +0.
- backend tsc + vitest hijau; frontend tsc/vite/eslint 0.

## Pipeline + deploy
brainstorming (konfirmasi: tetap rasa-gratis + Jumbo manual? atau auto dari harga varian?) → writing-plans →
worktree → TDD → verification → review → finishing. Deploy prod: `prisma db push` aditif + code (tarball) +
data migration. Lihat [[project_deployment_server]] (akses SSH, backup ke /home/ubuntu/backups/, deploy workflow)
+ [[project_menu_sku_link_upcharge]] (state fitur menu sekarang).
