# Design Spec — Kembalian Cash + Struk Baru + Konfirmasi Rincian Pembayaran

**Tanggal:** 2026-06-10
**Topik:** Payment UX — cash change (kembalian), receipt redesign, pre-submit review step
**Scope:** Frontend-only (0 perubahan backend, 0 migrasi schema)
**Status:** Approved (brainstorming) — siap ke writing-plans

---

## 1. Latar belakang & masalah

Tiga kekurangan pada alur pembayaran POS saat ini:

1. **Kembalian cash tidak berfungsi.** Struk ([receipt.ts:120](../../../frontend/src/lib/receipt.ts)) menghitung `change = totalDibayar − total`, tetapi backend ([transactions.service.ts:939](../../../backend/src/modules/transactions/transactions.service.ts)) **menolak** pembayaran melebihi sisa tagihan (`amount > remaining` → `AppError`). Di mode bayar penuh, frontend mengirim `amount: total` (persis), sehingga `change` selalu 0. Kasir tidak punya cara mencatat uang yang diberikan pelanggan dan melihat kembaliannya.

2. **Struk "jadul" & kurang jelas.** PDF saat ini monospace courier datar tanpa hierarki visual; TOTAL dan KEMBALIAN tidak menonjol.

3. **Tak ada konfirmasi rincian sebelum submit.** Alur sekarang: isi form → `confirm()` kecil (hanya metode + diskon + teks "akan lunas") → langsung tercatat permanen. Tidak ada ringkasan rincian (item, subtotal, PB1, total, uang diterima, kembalian) untuk dicek kasir → rawan salah input, baik pada bayar penuh maupun split.

## 2. Keputusan yang sudah diambil (brainstorming)

| Keputusan | Pilihan | Konsekuensi |
|---|---|---|
| Penyimpanan "uang diterima" | **Frontend-only (ephemeral)** | Tanpa migrasi/sentuh backend. Kembalian dihitung & ditampilkan saat bayar lalu tercetak di struk. Cetak ulang dari Riwayat **tidak** menampilkan kembalian (diterima). |
| Pemakaian struk | **Digital saja** (simpan PDF / tunjukkan ke layar; tanpa printer thermal) | Bebas memilih format lebih bagus, tidak terikat 58mm secara kaku. |
| Gaya struk | **Klasik rapi (ramping)** | Bentuk struk tradisional ramping, header tengah, garis pemisah jelas, TOTAL & KEMBALIAN menonjol. |
| Cara konfirmasi | **Langkah REVIEW di dalam modal** | Lebih kaya & lega daripada `confirm()` kecil. |
| Sinkronisasi struk layar↔PDF | **Pakai ulang `buildReceiptRows()`** | Satu sumber kebenaran; layar dan PDF tak pernah berbeda. |

## 3. Prinsip data

- **Nominal pembayaran ke backend tetap = total (atau slice).** "Uang diterima" tidak pernah dikirim sebagai `amount` (backend menolak overpayment, dan agar pendapatan/setoran tidak dobel-hitung).
- **Kembalian = turunan murni di frontend:** `kembalian = uangDiterima − nominalTagihan`.
- **Kembalian hanya untuk uang fisik.** Diskriminator: `paymentMethod.code === 'cash'`. Metode lain (EDC/QRIS/gojek/grab/transfer) selalu bayar pas, tanpa input uang diterima & tanpa kembalian.

## 4. Alur modal pembayaran (3 fase)

`PaymentModal` mendapat state internal `step: 'input' | 'review'` (fase sukses tetap via `isPaid`). Berlaku untuk **bayar penuh (single) dan split (per slice)**.

```
[INPUT]
  - Pilih metode pembayaran.
  - Jika method.code === 'cash': field "Uang Diterima" + tombol tender cepat
    (Uang pas, lalu pembulatan pintar di atas total mis. 50.000 / 100.000).
  - Diskon (opsional, hanya first slice — perilaku existing dipertahankan).
  - Nominal (split mode saja).
  - Tombol: "Lanjut · Rp X"  (disabled jika input invalid / uang diterima < tagihan)
        ↓
[REVIEW]  (read-only, rincian penuh)
  - Daftar item (agregat termasuk pesanan/meja yang digabung).
  - Subtotal, Diskon, PB1 (jika aktif), TOTAL.
  - Metode (+ bank jika ada).
  - Jika cash: Uang Diterima + KEMBALIAN (menonjol).
  - Untuk split: nominal slice ini + Sisa setelah slice ini / "menutup tagihan → lunas".
  - Tombol: "← Ubah"  |  "Konfirmasi & Bayar"
        ↓ (submit addPayment, nominal = total/slice)
[SUKSES]  (isPaid === true)
  - <ReceiptPreview> tampil OTOMATIS (struk di layar).
  - Tombol: "Simpan Struk" (unduh PDF) + "Selesai" (panggil onSuccess).
```

`confirm()` lama dihapus dari alur submit (digantikan fase REVIEW). `confirm()` tetap dipakai untuk hapus slice (perilaku existing).

### Catatan kembalian pada split
Kembalian dihitung terhadap **nominal yang sedang dicatat** pada slice tersebut:
- Single: nominal = total → kembalian = uangDiterima − total.
- Split slice: nominal = slice amount (≤ sisa) → kembalian = uangDiterima − slice amount.

Modal menyimpan `pendingChange` saat submit slice cash; saat status menjadi `paid`, fase SUKSES & struk menampilkan kembalian penutup tersebut. Untuk penutupan non-cash, kembalian = 0.

## 5. Struk baru (gaya klasik ramping)

### Di layar — `<ReceiptPreview>` (komponen baru)
- Konsumsi `Row[]` hasil `buildReceiptRows(tx, opts)` (pakai ulang fungsi murni yang sudah ada).
- Render sebagai kartu struk HTML: monospace, garis pemisah (`-`/`=`), baris `center`/`left`/`lr`, dengan TOTAL & KEMBALIAN ditebalkan/dibesarkan.
- Muncul otomatis di fase SUKSES.

### PDF — `generateReceiptPdf()` dipoles
- Nama resto bold lebih besar; spasi antarbagian lebih lega.
- Baris TOTAL & KEMBALIAN font lebih besar/bold.
- Tetap ramping (~58mm) sesuai gaya klasik.

### Kembalian di struk saat-bayar
- `ReceiptOptions` ditambah `cashReceived?: number` (opsional, ephemeral).
- `buildReceiptRows`: jika `opts.cashReceived` ada → baris pembayaran cash memakai `cashReceived` sebagai jumlah Tunai, dan `Kembali = cashReceived − tx.total`. Jika tidak ada (mis. cetak ulang dari Riwayat, atau non-cash) → perilaku existing (kembalian dari `payments`, praktis 0).
- Tombol **"Simpan Struk" dipertahankan**.

## 6. File yang disentuh (frontend saja)

| File | Perubahan |
|---|---|
| `frontend/src/components/PaymentModal.tsx` | State `step` (`input`/`review`) + `cashReceived` + `pendingChange`; tombol tender cepat; layar REVIEW (rincian read-only); layar SUKSES render `<ReceiptPreview>` + Simpan Struk + Selesai; hapus pemakaian `confirm()` di submit (tetap untuk hapus slice). |
| `frontend/src/components/ReceiptPreview.tsx` **(baru)** | Render `Row[]` → kartu struk HTML; konsisten dengan PDF. |
| `frontend/src/lib/receipt.ts` | `cashReceived?` di `ReceiptOptions`; logika kembalian dari `cashReceived`; poles tipografi PDF (header/TOTAL/KEMBALIAN). |
| `frontend/src/lib/receipt.test.ts` | Test: `cashReceived > total` → baris Tunai = cashReceived & Kembali benar; tanpa `cashReceived` → perilaku lama. |

**Backend: tidak ada perubahan.**

## 7. Pilihan teknis & alternatif yang ditolak

- **Konfirmasi = langkah REVIEW dalam modal** (dipilih). Alternatif: (a) `confirm()` dengan ReactNode rincian — sempit, masalah scroll saat item banyak; (b) komponen `ReviewModal` terpisah — lebih banyak file & plumbing state. Ditolak.
- **Sinkron struk = pakai ulang `buildReceiptRows()`** (dipilih). Alternatif: (a) dua layout terpisah HTML & jsPDF — risiko drift; (b) `html2canvas → PDF` — dependensi berat, lambat. Ditolak.

## 8. Asumsi & di luar cakupan

- Tidak ada perubahan backend/schema; kembalian ephemeral.
- "Cash" dikenali via `paymentMethod.code === 'cash'`. Jika kode metode cash pernah diubah owner, perlu penyesuaian.
- Cetak ulang struk lama dari Riwayat tetap tanpa kembalian (uang diterima tidak tersimpan).
- Tidak menyentuh logika merge/split-tender backend, atribusi shift, PB1 2-sumbu (hanya menampilkan hasilnya).

## 9. Verifikasi (rencana, sesuai pipeline)

- `npm run -w frontend test` (Vitest) — receipt.test.ts lulus termasuk kasus kembalian baru.
- `tsc --noEmit` frontend 0 error.
- `vite build` sukses.
- `npm run lint` frontend 0 error.
- Manual e2e browser: (a) bayar penuh cash uang diterima > total → REVIEW tampil kembalian → SUKSES struk tampil → Simpan Struk mengunduh PDF berisi kembalian; (b) bayar non-cash → tanpa input uang diterima, kembalian tak muncul; (c) split: slice cash penutup dengan uang lebih → kembalian benar; (d) cetak ulang dari Riwayat → struk tanpa kembalian, tidak error.
