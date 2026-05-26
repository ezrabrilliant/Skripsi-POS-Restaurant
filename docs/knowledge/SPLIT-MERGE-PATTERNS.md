# SPLIT & MERGE BILL — Pattern Industri & Use Case

**Status**: Knowledge reference (REV 2.5, 2026-05-26)
**Konteks**: POS Ayam Bakar Banjar Monosuko — keputusan adopsi & justifikasi.
**Spec implementasi**: lihat `docs/superpowers/specs/2026-05-26-split-tender-combine-design.md`.

File ini berisi ringkasan pattern industri (Toast, Square, Loyverse, Lightspeed) untuk split-bill & merge-bill di POS web modern, lengkap dengan contoh use case yang relevan untuk konteks resto skala kecil di Indonesia.

---

## Bagian 1 — Split Bill Pattern

### 1.1 — 3 metode split standar industri

| Metode | Definisi | Frekuensi pakai | Adopsi REV 2.5 |
|---|---|---|---|
| **Even Split** (rata N orang) | Total ÷ N → identical share | ~70-75% di pasar Western | ❌ Drop |
| **By Item** (drag/tap item → party) | Tiap party bayar item-nya sendiri | ~15-20% | ❌ Drop |
| **By Amount / Split Tender** | 1 customer, multi-method ATAU N party custom nominal | ~5% | ✅ Adopt (Split Tender saja) |

### 1.2 — Justifikasi scope reduction di REV 2.5

Konteks operasional Indonesia berbeda dari pasar Western:

- **Split bill multi-party rare**: budaya Indonesia umumnya 1 orang treat (atasan/orang tua bayar semua), atau split pakai aplikasi pihak ketiga (Splitwise, transfer pribadi via DANA/GoPay) di luar resto. Customer **jarang** minta kasir split bill ke N orang.
- **Split tender common**: customer cash kurang → tambah QRIS, atau pakai voucher + cash. **Real value** untuk POS Indonesia.

**Keputusan**: REV 2.5 cuma adopsi Split Tender. Even Split & By Item di-drop dari schema (`TransactionItem.partyId` ikut dihapus).

### 1.3 — Tax/PB1 handling (kalau suatu hari Even/By Item di-revive)

PB1 di Indonesia = 10%, disetor ke Pemda per bulan. **Sum PB1 semua struk hasil split WAJIB sama dengan PB1 transaksi asli** supaya laporan match.

**Pattern aman: Proportional split**
- PB1 per party dihitung dari subtotal party-nya: `PB1_party = 10% × subtotal_party`
- Sum semua PB1 party = PB1 transaksi total

**Rounding trap**: untuk N party rata, `PB1_total / N` kadang non-integer (mis. 20000/3 = 6666.67). **Pattern**: party terakhir absorb selisih rounding supaya sum tetap match.

**Diskon × PB1 (urutan WAJIB)**: `subtotal → diskon → DPP → PB1 10%`. Bukan terbalik (akan over-charge).

---

## Bagian 2 — Merge Bill Pattern

### 2.1 — 4 skenario merge di POS web

| Skenario | Frekuensi | Contoh | Adopsi REV 2.5 |
|---|---|---|---|
| **Add Round** (intra-table) | Sangat sering | Meja sudah pesan, tambah pesanan ronde 2 | ✅ Sudah ada (REV 2.4 "Tambah Pesanan") |
| **Combine Tables** (inter-table) | Sedang | Rombongan 8 orang di meja 5 + 6 mau bayar bareng | ✅ Adopt baru |
| **Move Items** (pindah item antar meja) | Jarang | Salah input meja — ayam paket harusnya untuk meja 4 | ❌ Skip (workaround: void + re-input) |
| **Consolidate** (1 customer 2 Tx terpisah) | Jarang | Takeaway lalu balik & pesan lagi | ❌ Skip (rare) |

### 2.2 — Pattern fundamental: source → destination

Semua merge punya struktur sama: **source Tx di-tag `mergedIntoId`, destination Tx absorb total + PB1**.

```
[Tx #101 - Meja 5]       [Tx #102 - Meja 6]
 - Ayam paket Rp 60k      - Es teh Rp 5k
 - Nasi Rp 8k
        ↓
  MERGE #101 → #102
        ↓
[Tx #101 - status: open]      [Tx #102 - Meja 6]
 mergedIntoId = 102            - Es teh Rp 5k
 (zero balance virtual,        - Ayam paket Rp 60k  ← absorbed via JOIN
  tetap exist untuk audit)     - Nasi Rp 8k         ← absorbed via JOIN
                               Subtotal: Rp 73k
                               PB1:      Rp 7.3k
                               Total:    Rp 80.3k
```

**Source Tx tidak dihapus** — di-tag `mergedIntoId` saja. Audit trail terjaga.

**Destination Tx absorb subtotal + recompute PB1** dari combined subtotal.

### 2.3 — Critical rule: revenue exclude source Tx

Query revenue harian / settlement / dashboard **WAJIB** filter `mergedIntoId IS NULL`. Kalau tidak, items dihitung 2× (source + destination) → laporan PB1 over-stated.

### 2.4 — Anti-patterns yang di-forbid

| Anti-pattern | Alasan forbid |
|---|---|
| Merge Tx yang sudah `paid` | Pakai jalur void + new Tx, bukan merge |
| Merge antar tanggal berbeda | Revenue per hari jadi inconsistent |
| Merge antar shift berbeda | Tracking shift cashier jadi rusak |
| Cascade merge (A→B→C chain) | Audit trail jadi pohon. Pattern aman: sequential 2-way only |
| Share 1 item antar 2 party | Rounding ribet — pakai Split Tender pada party gabungan |

### 2.5 — PB1 saat merge

PB1 di-**recompute** dari combined subtotal, **bukan** sum source PB1.

```
Tx #101 subtotal = Rp 68k, PB1 = Rp 6.8k
Tx #102 subtotal = Rp 5k,  PB1 = Rp 0.5k

Setelah merge → Tx #102:
  subtotal_combined = Rp 73k
  PB1               = Rp 7.3k  (10% × 73k)
  total             = Rp 80.3k
```

Untuk 10% flat tanpa diskon: sum source PB1 = PB1 destination by coincidence. Tapi engine harus selalu **recompute** untuk kasus dengan diskon promo.

---

## Bagian 3 — Use Case Konkret (REV 2.5)

### UC1 — Split Tender: cash customer kurang

**Skenario**: Meja 3, total Rp 165.500 (3 menu + PB1 10%). Customer kasih Rp 100.000 cash, sisa minta QRIS karena cash habis.

**Flow kasir:**
1. POSPage meja 3 → klik Bayar → PaymentModal opens (subtotal 150.500, PB1 15.000, total 165.500)
2. Toggle "Bayar Sebagian" ON
3. Tambah pembayaran: 100.000 cash → sisa 65.500
4. Tambah pembayaran: 65.500 QRIS → sisa 0 → Tx status=paid
5. Tampil "Selesai Bayar" + toast success

**Backend records:**
```
Tx #100: subtotal 150500, tax 15000, total 165500, status=paid
TransactionPayment #1: txId=100, method=cash, amount=100000
TransactionPayment #2: txId=100, method=qris, amount=65500
```

**Settlement impact:** cash bucket +100000, QRIS bucket +65500.

---

### UC2 — Combine Tables (dari TablesPage): rombongan minta gabung sebelum bayar

**Skenario**: Rombongan keluarga di Meja 5 (Rp 75k) dan Meja 6 (Rp 50k). Setelah selesai makan, minta bayar bareng.

**Flow kasir:**
1. TablesPage → tap "⋮" Meja 5 → "Gabung ke meja lain"
2. CombineTableModal: list meja occupied lain (Meja 3 Rp 100k, Meja 6 Rp 50k)
3. Pilih Meja 6 → preview "Total combined Rp 125k. Meja 5 jadi kosong."
4. Confirm → backend `mergeBills(sourceIds=[all open Tx meja 5], targetId=oldest open Tx meja 6)`
5. Toast "Meja 5 digabungkan ke Meja 6"
6. Grid refresh: Meja 5 = kosong, Meja 6 = Rp 125k
7. Kasir lanjut tap Meja 6 → Bayar normal (single tender atau split tender)

**Backend records:**
```
Tx #105 (meja 5): mergedIntoId=106, items unchanged
Tx #106 (meja 6): unchanged, JOIN dengan #105 untuk display
```

---

### UC3 — Combine Tables (dari PaymentModal): pindah meja last-second

**Skenario**: Customer di Meja 3 sudah pesan, mau gabung dengan teman yang di Meja 5 saat mau bayar.

**Flow kasir:**
1. POSPage meja 3 → klik Bayar → PaymentModal opens (subtotal Rp 100k)
2. Klik "⌕ Gabung Meja Lain"
3. CombineTableModal overlay: pilih Meja 5 (Rp 75k) sebagai source
4. Confirm → backend merge meja 5 → meja 3
5. PaymentModal refresh: subtotal Rp 175k, PB1 17.5k, total 192.5k
6. Lanjut bayar (single tender atau split tender)

**Asymmetri vs UC2:** di sini kasir sudah berada di destination meja, pilih source dari modal. Logika backend identik (`mergeBills`).

---

### UC4 — Combine + Split Tender (kombinasi)

**Skenario**: 2 keluarga makan di Meja 5 + Meja 6 (combined total Rp 200k subtotal). Mau bayar bareng tapi salah satu kasih cash Rp 80k, sisanya transfer.

**Flow kasir:**
1. Combine Meja 5 → Meja 6 (via TablesPage atau PaymentModal) → Meja 6 total Rp 220k (incl PB1)
2. PaymentModal toggle "Bayar Sebagian"
3. Tambah pembayaran: 80.000 cash → sisa 140.000
4. Tambah pembayaran: 140.000 transfer (bank: BCA) → sisa 0 → status=paid

**Backend records:**
```
Tx #200 (meja 6): subtotal 200000, tax 20000, total 220000, status=paid
Tx #201 (meja 5): mergedIntoId=200, total=0, status=paid (cascade)
TransactionPayment #1: txId=200, method=cash, amount=80000
TransactionPayment #2: txId=200, method=transfer, bank=BCA, amount=140000
```

**Settlement impact:** cash bucket +80000, transfer bucket +140000 (bank BCA breakdown).

---

## Bagian 4 — Cross-cutting Rules

Aturan yang **wajib** dipatuhi untuk semua implementasi split/merge:

1. **Single source of truth via TransactionPayment table** — sum slices = Tx.total saat status=paid.
2. **Lock setelah paid** — tidak boleh add/remove payment slice, tidak boleh merge/un-merge.
3. **Revenue query filter `mergedIntoId IS NULL`** — di setiap aggregation (settlement, dashboard, history).
4. **PB1 recompute dari aggregate subtotal** parent + mergedFrom — bukan sum source PB1.
5. **Validasi same-shift untuk merge** — source & destination harus shift sama.
6. **Audit trail visible** — HistoryPage tampilkan badge "🔗 Gabungan dari #X" / "🔗 Tergabung ke #Y".
7. **Permission unchanged** (matrix REV 2.3): payment, split tender, combine = owner+kasir; waiter di-hide.
8. **Discount apply ke FIRST payment slice saja** — setelah slice pertama, discount input locked.
9. **Sequential payment** — slice 1 → submit → slice 2, bukan parallel batch.
10. **Combine sequential 2-way** — 3-way combine = 2 kali combine berurutan (5→6, lalu 7→6).

---

## Referensi

- **Spec implementasi**: `docs/superpowers/specs/2026-05-26-split-tender-combine-design.md`
- **Plan implementasi**: `~/.claude/plans/saya-mau-brainstorm-tentang-glowing-orbit.md`
- **Permission matrix**: `docs/superpowers/specs/2026-05-24-permission-matrix-design.md`
- **Schema**: `backend/prisma/schema.prisma`
- **Operasional ground truth**: `docs/operasional-resto.md`

POS yang dijadikan referensi pattern industri:
- [Toast POS](https://pos.toasttab.com/) — drag-drop split bill
- [Square POS](https://squareup.com/us/en/point-of-sale) — tap-to-assign mobile split
- [Loyverse POS](https://loyverse.com/) — even split + merge open receipts
- [Lightspeed Restaurant](https://www.lightspeedhq.com/pos/restaurant/) — combine tables + transfer items
