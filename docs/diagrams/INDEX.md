# Diagram Gallery — Sistem POS Ayam Bakar Banjar Monosuko

Render PNG dari semua diagram di `Skripsi.mdj`. Rendered via staruml-mcp tool `get_diagram_image_by_id`.

**Note watermark:** "UNREGISTERED" di background muncul karena StarUML versi free. Tidak mempengaruhi konten diagram itu sendiri — untuk naskah final, lisensi StarUML atau gunakan tools sekreen capture.

---

## Use Case (1)

### ![Use Case Diagram](use-case-diagram-sistem-pos-restoran.png)
- **File:** `use-case-diagram-sistem-pos-restoran.png`
- **Isi:** 3 actor (Owner, Kasir, Kitchen) + 15 use cases + 14 dependencies
- **Dependencies:** 13 `<<include>>` dari main UC ke Login + 1 `<<extend>>` (Mencetak Struk → Memproses Pembayaran)

## ERD (1)

### ![ERD](erd-sistem-pos-restoran.png)
- **File:** `erd-sistem-pos-restoran.png`
- **Isi:** 8 entitas (users, menus, daily_menu_stocks, shifts, transactions, transaction_items, settlements, expenses) + 77 kolom + 9 relasi
- **Supplement:** `docs/DATA-DICTIONARY.md` — tabel definisi lengkap untuk Bab 3

## Activity Diagrams (7)

| # | File | Alur |
|---|---|---|
| A.1 | `activity-diagram-login.png` | Login (User + Sistem) — PIN 6-digit + loop-back saat salah + dashboard sesuai role |
| A.3 | `activity-diagram-order-flow.png` | Order Flow (Kasir + Sistem) — decision stok cukup + force order |
| A.4 | `activity-diagram-pay-flow.png` | Pay Flow (Kasir + Sistem) — validasi nominal, update status, optional cetak struk |
| A.2 | `activity-diagram-stock-opname-pagi-kitchen.png` | Stock Opname Pagi (Kitchen + Sistem) — input stok dari rumah pemilik |
| A.8 | `activity-diagram-stock-opname-sore-kasir.png` | Stock Opname Sore (Kasir + Sistem) — hitung variance akhir shift |
| A.9 | `activity-diagram-tutup-kasir-blind-count.png` | Tutup Kasir Blind Count (Kasir + Sistem) — rekonsiliasi 5-way payment |
| A.10 | `activity-diagram-mencatat-pengeluaran.png` | Mencatat Pengeluaran (Owner + Sistem) — input expense + kategori |

## Sequence Diagrams (5)

| # | File | Skenario |
|---|---|---|
| SQ.1 | `sequence-diagram-login-happy-path.png` | Login — Kasir → LoginScreen → AuthService → User entity |
| SQ.2 | `sequence-diagram-pay-transaction.png` | Pay Transaction — 6 lifelines, decrement stok + update status |
| SQ.3 | `sequence-diagram-input-stok-masuk-pagi.png` | Input Stok Masuk — Kitchen flow, loop per-menu upsert |
| SQ.4 | `sequence-diagram-mencatat-pengeluaran.png` | Mencatat Pengeluaran — Owner flow, validate + insert expense |
| SQ.5 | `sequence-diagram-tutup-kasir-blind-count.png` | Tutup Kasir Blind Count — kompute system totals + variance |

---

## Diagram yang BELUM dibangun

- ⏳ **Blok Diagram Sistem** (Deployment): diagram dibuat tapi masih kosong (tidak ada node/edge). Build ulang dengan block-diagram skill saat diperlukan.
- ⏳ **Flowchart Force Order**: belum dibuat.

---

## Refresh images

Setelah edit diagram di StarUML, re-render PNG dengan:

```bash
python3 -c "
import json, urllib.request, base64, os
out = r'C:\\Users\\ezrak\\Documents\\Skripsi\\Skripsi-POS-Restaurant\\docs\\diagrams'
diags = json.loads(urllib.request.urlopen(urllib.request.Request(
    'http://localhost:58321/get_all_diagrams_info',
    data=b'{}', headers={'Content-Type':'application/json'})).read())['data']
for d in diags:
    r = json.loads(urllib.request.urlopen(urllib.request.Request(
        'http://localhost:58321/get_diagram_image_by_id',
        data=json.dumps({'diagramId':d['id']}).encode(),
        headers={'Content-Type':'application/json'})).read())
    if r.get('success'):
        slug = d['name'].lower().replace(' ','-').replace('(','').replace(')','').replace(',','')
        open(os.path.join(out,f'{slug}.png'),'wb').write(base64.b64decode(r['data']))
        print(f'  {slug}.png')
"
```

Atau lebih ringkas — save script di-atas sebagai `scripts/render-diagrams.py` lalu `python scripts/render-diagrams.py`.
