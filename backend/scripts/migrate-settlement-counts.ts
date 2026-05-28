// REV 2.6 Phase 2 (HISTORICAL — one-shot, no longer runnable):
// Backfill `settlement_method_counts` dari Settlement 12 kolom lama
// (system{Cash,Edc,Qris,Gojek,Grab,Transfer} + actual{...}).
//
// Phase 9 (commit ini) drop 12 kolom legacy dari Settlement + drop
// enum PaymentMethodLegacy → script ini sudah tidak bisa dijalankan
// terhadap schema baru karena Prisma client tidak punya field tersebut.
//
// File dipertahankan sebagai dokumentasi audit-trail. Untuk re-run
// (mis. di environment yang belum migrate), checkout commit sebelum
// Phase 9 cleanup, jalankan script, lalu apply Phase 9.

throw new Error(
  'scripts/migrate-settlement-counts.ts adalah historical one-shot — kolom legacy ' +
    'sudah di-drop di REV 2.6 Phase 9. Lihat git history untuk konten asli.',
);
