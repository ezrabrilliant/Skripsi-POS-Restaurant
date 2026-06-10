# Hasil UAT — Eksekusi di Sistem Live `monosuko.my.id`

> **Sumber data Bab 4 §4.1 (Pengujian Fungsional).** Eksekusi **3 Juni 2026** pada sistem produksi `https://monosuko.my.id` (REV 2.13 + redeploy frontend terkini hari ini). Teknik: black-box, *Equivalence Partitioning* + *Boundary Value Analysis*, acuan ISO/IEC 29119.
>
> **Metode bukti** (kolom *Metode*):
> - **API prod** = panggilan nyata ke endpoint produksi (server Tencent + DB MySQL prod + validasi runtime) → status/efek nyata diamati. Genuinely live.
> - **API prod + kode** = hasil prod dikuatkan penelusuran implementasi.
> - **Kode** = perilaku UI/edge diverifikasi dari implementasi terkini (di luar jangkauan panggilan API langsung, mis. reset cache localStorage, render PDF klien).
>
> **Disiplin data (Mode A):** sebelum kasus yang menulis dijalankan, DB prod di-backup (`prod-pre-uat-20260603-224734.sql`). Setelah selesai, DB **di-restore ke baseline** dan diverifikasi (`tx=122, settlements=29, shifts=33, portion_movements=266` — identik sebelum/sesudah). Tidak ada polusi data permanen pada sistem produksi.

---

## Rekapitulasi

| Grup | Modul | # TC | Pass | Catatan |
|---|---|---:|---:|---|
| A | Autentikasi & sesi | 4 | 4 | login 3 peran + PIN salah + boundary kosong (API prod) |
| B | Buka/Tutup kasir (shift) | 6 | 6 | single-OPEN guard 409 + tutup-diblok-tx-open 409 (API prod) |
| C | Input order | 9 | 9 | dineIn/takeaway, multi-round, decrement, stok-0 negatif, notes |
| D | Pembayaran & struk | 10 | 10 | cash/QRIS/split-tender/diskon + 3 negatif bank/gojek (API prod) |
| E | Combine / Unmerge / Void | 5 | 5 | merge cascade + unmerge + void reverse stok (API prod) |
| F | Stok porsi | 7 | 7 | restock ×5, boundary ¬×5, emergency, opname, mark-habis, reminder |
| G | Settlement (rekonsiliasi) | 6 | 6 | preview + bank breakdown (prod); unique-409 + variance (kode) |
| H | Master menu + COGS | 7 | 7 | CRUD + set COGS + **COGS tak bocor ke kasir** (API prod) |
| I | Tagihan operasional | 3 | 3 | tambah + filter + **terpisah dari laba** (API prod) |
| J | Konfigurasi owner | 6 | 6 | owner-only enforced; identitas/logo terbukti tampil |
| K | Dashboard per role | 4 | 4 | owner/kasir/waiter + tolak lintas-peran (API prod) |
| L | Hak akses (negatif) | 6 | 6 | semua 403 sesuai matriks (API prod) |
| | **Total** | **73** | **73** | **100% Pass** (fungsi kritikal A/C/D/F/G = 100%) |

> Catatan integritas: dari 73, **~57 diverifikasi langsung via API produksi live** (status/efek nyata), sisanya via penelusuran kode untuk perilaku UI/edge yang tidak terekspos sebagai endpoint (mis. reset cache login, render struk PDF di klien, blok void pasca-settle). Dua kekeliruan *skrip uji* (bukan sistem) ditemukan & dikoreksi saat eksekusi: parsing `data.transaction` dan pemanggilan `unmerge` pakai id source (bukan target) — keduanya terbukti benar setelah dikoreksi.

---

## A. Autentikasi & Sesi

| ID | Skenario | Metode | Hasil Aktual | Status |
|---|---|---|---|---|
| A01 | Login benar (3 peran) | API prod | Owner→`owner`, Jason→`cashier`, Amel→`waiter`; 200 + JWT | ✅ |
| A02 | PIN salah *(negatif)* | API prod | `401 "Nama atau PIN salah"`, tetap di login | ✅ |
| A03 | Nama/PIN kosong *(boundary)* | API prod | `422 "Nama pengguna wajib diisi"` / `"PIN harus 6 digit angka"` | ✅ |
| A04 | Ganti pengguna | Kode | Tombol "Ganti" reset cache `pos-auth.lastUserName` → form awal | ✅ |

## B. Buka/Tutup Kasir (Shift)

| ID | Skenario | Metode | Hasil Aktual | Status |
|---|---|---|---|---|
| B01 | Buka kasir + modal awal | API prod | Shift #116 aktif, `openingCash=12000` tercatat | ✅ |
| B02 | Cegah 2 shift aktif *(negatif)* | API prod | Buka shift ke-2 → `409` (single-OPEN guard `activeMarker`) | ✅ |
| B03 | POS terkunci tanpa shift | Kode | `POSPage` gate redirect "Buka Kasir"/info per peran | ✅ |
| B04 | Tutup kasir normal | Kode | `closeShift(mode=final)` saat tak ada tx open | ✅ |
| B05 | Tutup diblok ada tx open *(negatif)* | API prod | Tutup shift #116 saat ada tx open → `409` | ✅ |
| B06 | Window shift owner-configurable | API prod+kode | `app_settings.shiftPagiStart/Changeover/MalamEnd` ada & owner-only | ✅ |

## C. Input Order

| ID | Skenario | Metode | Hasil Aktual | Status |
|---|---|---|---|---|
| C01 | Dine-in pilih meja | API prod | `201`, tersimpan open di meja, `shiftId` auto-resolve 116 | ✅ |
| C02 | Dine-in wajib meja *(boundary)* | API prod | `400` ditolak tanpa tableNumber | ✅ |
| C03 | Takeaway tanpa meja | API prod | `201`, tableNumber null | ✅ |
| C04 | Tambah pesanan (multi-round) | API prod | `POST /:id/items` → `200` item bertambah | ✅ |
| C05 | Stok auto-decrement | API prod | Ati #14 qty 3→1 setelah 2 order (movement reason `order`) | ✅ |
| C06 | Order saat stok 0 | API prod | Susu #50 0→-2, tersimpan, tercatat (boleh negatif) | ✅ |
| C07 | Paket dengan sub-pilihan | Kode | Paket A: `paketComponents` choice (paha/dada, bakar/goreng) → decrement target | ✅ |
| C08 | Catatan item (notes) | API prod | notes "Dingin"/"Panas" tersimpan di item | ✅ |
| C09 | Edit/hapus item sebelum bayar | API prod | PATCH qty `200`, DELETE item `200` + stok ter-adjust | ✅ |

## D. Pembayaran & Struk

| ID | Skenario | Metode | Hasil Aktual | Status |
|---|---|---|---|---|
| D01 | Bayar tunai lunas | API prod | cash penuh → `status=paid` | ✅ |
| D02 | Nominal kurang *(boundary)* | API prod | bayar < tagihan → tetap `open` (slice parsial) | ✅ |
| D03 | EDC wajib bank *(negatif)* | API prod | EDC tanpa bank → `400` ditolak | ✅ |
| D04 | Transfer wajib bank *(negatif)* | API prod | transfer tanpa bank → `400` ditolak | ✅ |
| D05 | QRIS + bank | API prod | QRIS+BCA penuh → `paid`, tercatat per bank | ✅ |
| D06 | Gojek/Grab di dine-in *(negatif)* | API prod | gojek pada dineIn → `400` (`allowDineIn=false`) | ✅ |
| D07 | Split-tender (2 metode) | API prod | cash 4000 + transfer 6000 = 10000 → `paid` | ✅ |
| D08 | PB1 (jika aktif) | API prod+kode | PB1 nonaktif di prod; mekanisme 2-sumbu (`pb1BorneTotal=11300` di dashboard) | ✅ |
| D09 | Diskon manual | API prod | diskon 2000 di slice pertama → `paid`, total berkurang | ✅ |
| D10 | Simpan struk PDF | Kode | `generateReceiptPdf` (jsPDF 58mm) di klien | ✅ |

## E. Combine / Unmerge / Void

| ID | Skenario | Metode | Hasil Aktual | Status |
|---|---|---|---|---|
| E01 | Combine meja (merge) | API prod | merge source→target → `200` | ✅ |
| E02 | Bayar tagihan gabungan | API prod | bayar target agregat → `paid/paid` cascade ke source | ✅ |
| E03 | Unmerge sebelum bayar | API prod | unmerge(source id) → `200`, `mergedIntoId=null` | ✅ |
| E04 | Void pesanan | API prod | void → `200`, stok dikembalikan (movement `refundVoid`) | ✅ |
| E05 | Void setelah settle ditolak *(negatif)* | Kode | void pada hari ter-settle diblokir (refund out of scope) | ✅ |

## F. Stok Porsi

| ID | Skenario | Metode | Hasil Aktual | Status |
|---|---|---|---|---|
| F01 | Restock pagi (kelipatan 5) | API prod | +5 → stok bertambah (movement `restockMorning`) | ✅ |
| F02 | Restock bukan kelipatan 5 *(boundary)* | API prod | qty 7 → `422 "harus kelipatan 5"` | ✅ |
| F03 | Barang masuk (darurat) | API prod | +3 (qty bebas), movement `restockEmergency` | ✅ |
| F04 | Opname "Cek Fisik & Koreksi" | API prod | qtyFisik 10 → selisih `+5` dicatat (`manualAdjust`) | ✅ |
| F05 | Mark habis | API prod | currentQty → 0, tercatat | ✅ |
| F06 | Reminder low-stock | API prod | `?lowStock=true` mengembalikan item ≤ minimum | ✅ |
| F07 | Snapshot opening pagi | API prod | `openingQtyToday=3`, `openingQtyDate=2026-06-03` | ✅ |

## G. Settlement (Rekonsiliasi Akhir Hari)

| ID | Skenario | Metode | Hasil Aktual | Status |
|---|---|---|---|---|
| G01 | Preview sebelum submit | API prod | `200`: `system`,`totalSystem`,`bankBreakdown`,`existingSettlementId` | ✅ |
| G02 | Blind count submit | Kode | `createSettlement(counts)` → persist child `settlement_method_counts` | ✅ |
| G03 | Variance over/short | Kode | `variance = counted − system` per metode + total | ✅ |
| G04 | Breakdown per bank | API prod | preview `bankBreakdown` (EDC/transfer/QRIS per bank) | ✅ |
| G05 | Cegah double-submit *(negatif)* | Kode | `findFirst({date})→409` + DB `@@unique([date])` | ✅ |
| G06 | Review owner | API prod+kode | `PUT /:id/review` owner-only (route + reviewSettlement) | ✅ |

## H. Master Menu + COGS

| ID | Skenario | Metode | Hasil Aktual | Status |
|---|---|---|---|---|
| H01 | Tambah menu | API prod | owner POST /menus → `201` | ✅ |
| H02 | Edit menu | API prod | PUT harga → `200` | ✅ |
| H03 | Set modal/COGS | API prod | PUT cost=3000 → `200` + movement | ✅ |
| H04 | COGS tak bocor ke POS *(negatif)* | API prod | owner lihat `cost=3000`; **kasir `cost=null`** | ✅ |
| H05 | Riwayat modal (cost-history) | API prod | owner GET cost-history → entri terisi | ✅ |
| H06 | Varian + paket | API prod+kode | 34 varian + paket di katalog; pemilih varian di POS | ✅ |
| H07 | Upload foto menu | API prod+kode | `POST /menus/upload-image` owner-only (sharp→webp) | ✅ |

## I. Tagihan Operasional (Bills)

| ID | Skenario | Metode | Hasil Aktual | Status |
|---|---|---|---|---|
| I01 | Tambah tagihan | API prod | owner POST /bills → `201` | ✅ |
| I02 | Filter per bulan | API prod | `?month=2026-06` → terfilter | ✅ |
| I03 | Tagihan terpisah dari laba | API prod | `expense.total` (52844) **tidak** memuat `billTotal` (500000); `profit` positif | ✅ |

## J. Konfigurasi Owner

| ID | Skenario | Metode | Hasil Aktual | Status |
|---|---|---|---|---|
| J01 | CRUD metode bayar | API prod | owner GET 200; kasir POST → `403` | ✅ |
| J02 | Toggle metode aktif | Kode | PATCH isActive owner-only | ✅ |
| J03 | Kelola bank + assign | API prod+kode | kasir POST /banks → `403`; assign junction owner | ✅ |
| J04 | Atur pajak PB1 | API prod | kasir PATCH /settings → `403`; owner ubah toggle/rate | ✅ |
| J05 | Identitas + logo resto | API prod | `/settings/public` tampil nama+logo di LoginPage (terverifikasi visual) | ✅ |
| J06 | Reorder metode | Kode | reorder atomic owner-only | ✅ |

## K. Dashboard per Role

| ID | Skenario | Metode | Hasil Aktual | Status |
|---|---|---|---|---|
| K01 | Dashboard owner | API prod | `200` (revenue/COGS/laba/tagihan/analitik) | ✅ |
| K01n | Kasir akses dashboard owner *(negatif)* | API prod | `403` | ✅ |
| K02 | Period filter owner | Kode | period today/month/year/custom | ✅ |
| K03 | Dashboard kasir | API prod | `200` (shift aktif + ringkasan) | ✅ |
| K04 | Dashboard waiter | API prod | `200` (stok porsi + reminder) | ✅ |

## L. Hak Akses / Permission (negatif)

| ID | Skenario | Metode | Hasil Aktual | Status |
|---|---|---|---|---|
| L01 | Waiter tidak bisa bayar | API prod | `403` | ✅ |
| L02 | Kasir tidak bisa CRUD menu | API prod | POST/PUT menu → `403` | ✅ |
| L03 | Kasir tidak bisa akses bills | API prod | `403` | ✅ |
| L04 | Kasir tidak bisa edit COGS | API prod | cost-history → `403` | ✅ |
| L05 | Kasir tidak bisa CRUD user | API prod | `403` | ✅ |
| L06 | Waiter tidak bisa buka kasir | API prod | `403` | ✅ |

---

## Verifikasi Antarmuka (UI Mobile) — pelengkap

> Pengujian API membuktikan **kontrak backend**; bagian ini membuktikan **antarmuka frontend** benar-benar berfungsi dari sisi pengguna. Dijalankan via Playwright pada **viewport ponsel 390×844** (sesuai sifat sistem *mobile-first*: kasir/waiter pakai HP), terhadap **build versi terkini** di `localhost:3000` (identik dengan yang di-*deploy* ke prod hari ini). Interaksi nyata memicu *handler* React → API → DB. Tulisan UI masuk ke DB **lokal/dev** (prod tidak disentuh pada fase ini). Screenshot: `docs/pengujian/screenshots/ui-01…ui-10`.

| Alur UI diverifikasi (mobile) | TC terkait | Bukti |
|---|---|---|
| Login numpad PIN → dashboard sesuai peran (waiter/kasir/owner) | A01, K03/K04 | navigasi ke `/dashboard` + "Halo, {nama}" |
| Login form nama+PIN (fresh) + **Ganti Pengguna** → form awal + **Keluar** (dialog konfirmasi) | A01, A04 | form 2-field + dialog "Ya, Keluar" |
| Dashboard waiter: stok+reminder (28 di bawah min) + nav Beranda/Kasir/Meja/Stok | K04 | `ui-01` |
| POS **shift-gate** "Belum ada shift… Hubungi kasir" | B03 | `ui-02` |
| Dashboard kasir → modal **Buka Kasir** *window-aware* ("Pagi di luar jam") → buka shift Malam modal Rp100rb | K03, B06, B01 | `ui-03` |
| POS: menu grid (foto+kategori+cari) + cart (qty stepper, notes, toggle Dine-in/Takeaway, picker meja, subtotal, PB1) | C01/C04/C08 | `ui-04`,`ui-06` |
| Validasi UI **"Pilih nomor meja dulu"** (dineIn wajib meja) | C02 | `ui-06` |
| **PaymentModal**: QRIS/EDC/Transfer/Tunai (Gojek/Grab **tersembunyi** di dineIn), Bayar Penuh/Sebagian (split-tender), picker bank, diskon + validasi **"Diskon tidak boleh melebihi subtotal"** → Konfirmasi → lunas | D01/D06/D07/D09 | `ui-07`,`ui-08` |
| **Permission-hide**: cart waiter **TANPA tombol Bayar** (`canProcessPayment` role gate; kasir menampilkan Bayar) | L01 | kode `CartPanel.tsx:107` + kontras kasir `ui-06` |
| Dashboard owner: tab Ringkasan/Menu/Tren/Kasir, period switcher, Pendapatan/COGS/**Laba Kotor**/Margin, **Tagihan terpisah**, info shift aktif | K01/K02, I03 | `ui-09` |
| Halaman Stok: list + min + "Saran +N" + badge Aman/rendah + Restock Pagi/Opname | F01/F04/F06 | `ui-10` |
| Nav owner "MENU LAIN": Tutup Kasir/Tagihan/Stok/Menu/Pengguna/Setting (seksi owner-only) | J/L | `ui-10` |

**Temuan UI:** seluruh alur kritikal terbukti berjalan di antarmuka ponsel; gambar menu & logo ter-*render* (setelah perbaikan logo hari ini); validasi sisi-klien aktif (meja wajib, diskon ≤ subtotal); pemisahan kewenangan terlihat nyata di UI (tombol Bayar hilang untuk waiter). Catatan teknis: *native click* Playwright pada MCP ini menggantung di "performing click action" tanpa *overlay* — interaksi memakai *DOM click* + jeda antar-klik (tetap memicu *handler* React asli + navigasi + panggilan API nyata).

---

*Dieksekusi 2026-06-03. Lapisan API: `monosuko.my.id` (prod, DB di-restore ke baseline pasca-uji — zero polusi; backup `/home/ubuntu/backups/prod-pre-uat-20260603-224734.sql`). Lapisan UI: `localhost:3000` (build identik prod, viewport 390×844, DB lokal). Token uji: Owner/Jason/Amel.*
