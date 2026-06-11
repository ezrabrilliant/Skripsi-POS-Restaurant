# Settlement Cash Reconciliation — Modal Awal masuk ke Variance Kas

**Tanggal:** 2026-06-11
**Status:** Design — disetujui untuk lanjut ke plan
**Topik:** Memperbaiki rekonsiliasi kas di settlement agar `openingCash` (modal awal) benar-benar dipakai dalam perhitungan variance, bukan sekadar ditampilkan.

---

## 1. Latar Belakang & Masalah

Field `Shift.openingCash` ("Modal Awal") diinput tiap kali kasir buka kasir, tapi **tidak pernah ikut perhitungan apa pun**:

- Di settlement, `openingCashTotal` (= Σ `shift.openingCash` hari itu) **dihitung** ([settlements.service.ts:269](../../../backend/src/modules/settlements/settlements.service.ts#L269)) tapi **hanya di-render sebagai teks info** ([SettlementPage.tsx:254](../../../frontend/src/pages/SettlementPage.tsx#L254)).
- Variance kas dihitung `counted − system` ([settlements.service.ts:197](../../../backend/src/modules/settlements/settlements.service.ts#L197), [SettlementPage.tsx:295](../../../frontend/src/pages/SettlementPage.tsx#L295)) — modal awal **tidak masuk rumus**.

Akibatnya rekonsiliasi kas tidak benar: uang fisik di laci akhir hari = modal awal + penjualan cash, tapi sistem membandingkan fisik hanya dengan penjualan cash.

## 2. Ground Truth Operasional (hasil brainstorming)

Dikonfirmasi langsung dari pemilik proses (resto kecil "Ayam Bakar Banjar Monosuko"):

1. **Penghitungan kas fisik dilakukan SEKALI, malam hari, oleh kasir penutup toko.** Menghitung saat pergantian shift dianggap tidak realistis (friksi besar, manfaat kecil) → **dibuang (YAGNI)**.
2. **Uang cash carry-over** — tidak pernah disisihkan/diambil (kecuali sesekali untuk belanja/kebutuhan, di luar scope). Laci jalan terus.
3. **Hanya shift pertama hari itu yang menaruh modal.** Shift malam melanjutkan laci yang sama; tidak menambah uang modal baru.
4. Aturan akuntansi yang diinginkan:

   ```
   ekspektasi kas akhir = modal awal hari ini + total penjualan cash
   variance kas         = fisik laci (dihitung) − ekspektasi kas
   ```

   Contoh: modal pagi 120.000 + penjualan cash 50.000 → ekspektasi 170.000. Kasir hitung laci, ketik total apa adanya. 170.000 = cocok; kurang = ketahuan.

## 3. Scope

**IN:**
- Variance kas di settlement memasukkan modal awal (metode `cash` saja).
- Buka-kasir carry-over: shift kedua dst. di satu hari tidak input modal (cegah double-count).
- UI form setoran menampilkan ekspektasi laci = penjualan cash + modal awal untuk baris cash.

**OUT (sengaja dibuang):**
- Rekonsiliasi/penghitungan kas saat handover pergantian shift.
- Tracking setor/penarikan uang cash dari laci.
- Catatan alasan selisih (variance note).

## 4. Desain

### 4.1 Aturan inti — variance kas (metode `cash` saja)

Diskriminator metode tunai: `code === 'cash'` (konvensi project — sama dengan fitur kembalian).

| Metode | Ekspektasi (pembanding) | Variance |
|---|---|---|
| `cash` | `system(penjualan cash) + openingCashTotal` | `counted − (system + openingCashTotal)` |
| non-tunai (edc/qris/gojek/grab/transfer) | `system` | `counted − system` (tidak berubah) |

`openingCashTotal` = Σ `shift.openingCash` untuk business date itu. Shift yang sudah closed bersifat immutable, jadi angka ini **di-recompute deterministik dari tabel `shifts`** — **tanpa kolom baru / tanpa migrasi DB**.

### 4.2 Backend

`backend/src/modules/settlements/settlements.service.ts`:

- **`SettlementView`** ([interface](../../../backend/src/modules/settlements/settlements.service.ts#L60)): tambah field `openingCashTotal: number`.
- **`toSettlementView`** ([service](../../../backend/src/modules/settlements/settlements.service.ts#L181)): fetch `Σ shift.openingCash WHERE date = settlement.date`, lalu hitung variance baris cash = `counted − (system + openingCashTotal)`; baris lain tetap `counted − system`. `totalVariance` = Σ variance per metode (sudah otomatis benar karena per-metode sudah benar).
- **`SettlementMethodCountView`**: pertimbangkan menambah `expected` (= pembanding aktual untuk metode itu) supaya frontend tidak perlu re-derive. Untuk cash `expected = system + openingCashTotal`, non-cash `expected = system`. (Opsional tapi membuat frontend lebih bersih.)
- **`previewSettlement`** ([service](../../../backend/src/modules/settlements/settlements.service.ts#L233)): `openingCashTotal` sudah ada di return — tidak berubah. Pastikan shape preview cukup untuk frontend menghitung ekspektasi cash live.

Persist (`createSettlement`) tidak berubah: tetap simpan `counted` + `system` murni per metode di `SettlementMethodCount`. Modal awal **tidak** difold ke kolom `system` (jaga semantik "system = penjualan POS"); ia dihitung ulang saat baca.

### 4.3 Buka-kasir carry-over

`frontend/src/components/OpenShiftDialog.tsx`:

- Kondisi carry-over: **sudah ada ≥1 shift untuk hari ini** (`todayShiftsQ.data.length > 0`). Mencakup alur serah-terima (`hasOpenShift`) maupun malam-buka-setelah-pagi-tutup.
- Saat carry-over:
  - **Sembunyikan field "Modal Awal".** Ganti dengan info read-only: *"Lanjut dari laci sebelumnya — modal hari ini Rp {Σ openingCash hari ini}"*.
  - Submit `openingCash: 0`.
- Saat shift pertama hari itu (tidak ada shift hari ini): tampilkan field Modal Awal seperti sekarang.

`backend/src/modules/shifts/shifts.service.ts` — `openShift`:

- Tegakkan invariant di server (jangan percaya client): kalau **sudah ada shift untuk `businessDate`**, paksa `openingCash = 0` apa pun yang dikirim (carry-over). Hanya shift pertama hari itu yang boleh `openingCash > 0`.
- Schema `openShift` tetap menerima `openingCash`; service yang menormalkan jadi 0 untuk shift non-pertama.

Hasilnya: `Σ openingCash` per hari = modal shift pertama saja → `openingCashTotal` benar tanpa dobel.

### 4.4 Frontend form setoran

`frontend/src/pages/SettlementPage.tsx`:

- Baris **cash** diberi perlakuan khusus:
  - Tampilkan ekspektasi laci eksplisit: `Penjualan cash {system} + Modal awal {openingCashTotal} = Ekspektasi {system + openingCashTotal}`.
  - Input **Fisik** = total laci apa adanya.
  - Variance live = `fisik − (system + openingCashTotal)`.
- Baris non-cash: tidak berubah (`fisik − system`).
- `totalVariance` live = Σ variance per metode (konsisten dengan backend).
- Header "Modal awal hari ini" yang sekarang teks pasif menjadi komponen yang benar-benar dipakai (boleh tetap di header sebagai ringkasan + ditarik ke baris cash).
- Tampilan **detail** (settlement tersimpan): pakai `openingCashTotal` dari `SettlementView` (4.2) untuk menampilkan variance kas yang konsisten dengan saat submit.

## 5. Dampak & Edge Cases

- **Settlement historis (sebelum perubahan):** variance kas akan dihitung ulang dengan `openingCashTotal` dari shift hari itu. Karena shift lama menyimpan `openingCash` nyata (termasuk malam yang dulu mungkin diisi), variance historis bisa bergeser. Ini **read-time recompute** — tidak mengubah data tersimpan. Untuk penyajian thesis, settlement lama tetap bisa dilihat; angka variance kas-nya kini mencerminkan rumus benar. (Tidak ada backfill data; cukup catat di dokumentasi bahwa rumus diperbarui.)
- **Hari hanya ada shift malam (tanpa pagi):** malam = shift pertama → isi modal normal. Benar.
- **Reopen-after-settle (REV 2.15):** shift yang dibuka lagi di hari yang sudah ada shift → carry-over (`openingCash = 0`). Konsisten (laci sudah berisi uang). Settlement sudah ter-seal; perubahan ini tidak mengubah aturan seal.
- **`code === 'cash'` tidak ada di hari itu** (semua non-tunai): `openingCashTotal` tidak terpakai di variance; modal awal tetap tampil sebagai info. Tidak ada baris cash untuk dibandingkan — aman.

## 6. Testing

- **Backend smoke** (`backend/scripts/smoke-settlement.ts`): tambah skenario —
  - modal pagi 120.000 + cash sales 50.000 + fisik 170.000 → variance kas = 0.
  - fisik 160.000 → variance kas = −10.000 (kurang).
  - non-cash (qris) tetap `counted − system`.
  - shift kedua hari itu open dengan `openingCash` dikirim 500.000 → server simpan 0 → `openingCashTotal` tetap = modal pagi.
- **Frontend:** `tsc` 0 error + `vite build` sukses + lint 0. Verifikasi live variance cash di preview = backend.
- **Manual e2e browser:** alur buka pagi (isi modal) → transaksi cash → buka malam (carry-over, no modal field) → tutup & settlement (ekspektasi laci = modal + cash sales, variance benar).

## 7. Keputusan yang Diambil

1. **Carry-over disimpan sebagai `openingCash = 0` + field disembunyikan** (bukan "biarkan isi lalu diabaikan"). Alasan: lebih jujur, tidak ada "field hantu" yang membingungkan saat sidang. (Disetujui user.)
2. **Recompute `openingCashTotal` dari tabel shifts, tanpa kolom snapshot di `settlements`.** Alasan: minimal, tanpa migrasi prod; shift closed = immutable. (Snapshot kolom = alternatif untuk audit-purist, ditolak demi kesederhanaan.)
3. **`system` murni penjualan POS; modal awal tidak difold ke kolom `system`.** Alasan: jaga semantik kolom + reuse di dashboard.
