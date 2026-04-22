---
name: activity-diagram
description: Build UML Activity Diagrams in StarUML for Indonesian ADSI (Analisis Design Sistem Informasi) skripsi. Use this skill whenever the user asks to create, rebuild, review, or fix an activity diagram — even when they say "diagram alur", "workflow", "flow aktivitas", or describe a step-by-step business process across actors. Covers ADSI Modul Pembelajaran Bab 7 + real skripsi conventions observed across 3 POS case studies (restoran cross-channel, supermarket ABC-VED, toko inventory control). Uses staruml-mcp tools (`create_diagram UMLActivityDiagram`, `create_element_with_view UMLAction/UMLInitialNode/UMLActivityFinalNode/UMLDecisionNode/UMLMergeNode/UMLForkNode/UMLJoinNode/UMLActivityPartition`, `create_edge_with_view UMLControlFlow`). Do not create an activity diagram without consulting this skill first.
---

# Activity Diagram — ADSI + skripsi-praktis convention + StarUML MCP

Sumber otoritatif:
- **ADSI Bab 7** — Modul Pembelajaran ADSI (`docs/extracted/adsi.txt` §7)
- **3 contoh skripsi POS** observed at `docs/pdf-pages/`: resto (cross-channel Gobiz), super (supermarket ABC-VED), toko (market basket). Semua dari UK Petra.

**Prinsip dasar** (ADSI §7 verbatim):
> *"Activity diagram merupakan penggambaran workflow (aliran kerja) atau aktivitas dari sebuah sistem proses bisnis."*

Aktivitas = **apa yang sistem dan aktor lakukan** dalam bahasa bisnis, bukan implementation detail.

---

## 1. Struktur dasar (ADSI Tabel 7.1)

| Simbol | Nama | Catatan |
|---|---|---|
| ● (filled solid circle) | Start / Initial Node | Hanya 1 per diagram (per ADSI §7 rule) |
| ◉ (bullseye — circle dengan dot di dalam) | End / ActivityFinalNode | Boleh lebih dari 1 (lihat §4 pattern CRUD) |
| ⬭ (rounded rectangle / lozenge) | Action | Verb phrase, bahasa bisnis |
| ◇ (diamond) | Decision atau Merge | Lihat §3 cara labeling |
| ▬ (solid bar) | Fork (split parallel) atau Join (sync parallel) | Jarang dipakai di skripsi POS, biasanya alur sequential |
| 2-3 kolom vertikal | Swimlane / ActivityPartition | Label: aktor atau sistem |

---

## 2. Action naming — business language, BUKAN code (CRITICAL)

**Style yang dipakai di skripsi:** Title Case Indonesian, verb phrase, kalimat pendek, self-explanatory untuk orang awam.

**Contoh konkret dari 3 contoh skripsi:**
- resto: *"Menampilkan daftar transaksi"*, *"Memilih jenis transaksi offline"*, *"Menginputkan data menu baru"*
- super: *"Membuka Halaman Supplier"*, *"Menampilkan Data Supplier"*, *"Menginput Data Supplier"*, *"Menyimpan Data Supplier"*
- toko: *"Input username and password"*, *"Validate user data"*, *"Direct to dashboard page"* (boleh English kalau konsisten)

**Rules:**
- Pilih 1 gaya dan stick: (a) lowercase Indonesian, ATAU (b) Title Case Indonesian, ATAU (c) Title Case English
- Verb phrase (kata kerja + obyek pendek)
- Fokus ke **WHAT**, bukan HOW

**❌ Jangan pakai dalam UMLAction:**

| Technical (don't) | Business (do) |
|---|---|
| `Query daily_menu_stocks (date, menu_id)` | `Cek ketersediaan stok hari ini` |
| `Insert Item (is_force_order=false) + decrement current_stock` | `Catat pesanan & kurangi stok` |
| `UPDATE transaction SET status=paid, paid_at=NOW()` | `Tandai pesanan sebagai lunas` |
| `POST /api/transactions/{id}/pay` | `Kirim data pembayaran` |
| `Hitung variance_X = actual_X - system_X` | `Hitung selisih per metode pembayaran` |
| `Insert expenses (paid_by=session.user.id, ...)` | `Simpan data pengeluaran` |

**Smell check:** baca nama action keras-keras. Kalau terdengar seperti SQL/komentar kode → rename. Kalau terdengar seperti langkah di buku manual pelatihan kasir → OK.

---

## 3. Decision labeling — 3 style yang VALID (semua dipakai di skripsi)

Simbol diamond tidak otomatis menampilkan "pertanyaan" — harus dikasih label jelas agar orang yang lihat screenshot paham. 3 style dari skripsi:

### Style A: Text DI DALAM diamond (kalau pendek)
Dipakai super + toko. Contoh: `Login Benar`, `Apakah Data duplikat`, `Product arrived`, `Stok habis?`

StarUML: set `name` property pada UMLDecisionNode. Di StarUML V7 label muncul **di samping** diamond (bukan di dalam, tapi terlihat).

### Style B: Text DI ATAS atau SAMPING diamond
Dipakai resto. Contoh: `stok habis?` (ditulis di atas), `Terdapat data menu sama?`

StarUML: pakai UMLNote attached, atau taruh UMLAction pendek sebelum Decision yang *describe what's being evaluated* (e.g. "Cek stok"), lalu Decision polos + guards jelas.

### Style C: Guards descriptive di arrow (no text di diamond)
Dipakai toko. Decision polos, outgoing arrows pakai guard descriptive: `User data match` / `User data not match`, `Item match` / `Item not match`.

StarUML: guard di `name` property edge.

**Semua 3 style OK** — pilih satu dan konsisten dalam 1 diagram.

### Guard syntax
Dari skripsi: **plain text, tanpa bracket `[]`**:
- `Ya` / `Tidak`
- `Benar` / `Salah`
- `View` / `Add` / `Edit` / `Delete` (multi-branch)
- `Lebih dari 3 kali`
- `Confirm to Save` / `Not confirm save`

**ADSI versi strict** tulis `[...]` seperti UML spec. **Skripsi praktis** tulis plain. Saran: **ikuti skripsi** (tanpa bracket) — lebih enak dibaca, dosen terima.

---

## 4. Multi-branch decision + multiple end nodes — VALID

**Temuan penting dari skripsi:**

1. **Decision 3-4 way** sangat umum untuk CRUD:
   ```
   Action → Decision
                ├ View → (tampilkan data) → End
                ├ Add  → (input data → save) → End
                ├ Edit → (input perubahan → save) → End
                └ Delete → (konfirmasi → delete) → End
   ```
   Contoh di super: Master Supplier/User/EDC/Bank/Departement/Satuan semua pakai pola ini dengan decision "View/Add Edit" + sub-decision "Apakah Data duplikat Ya/Tidak".

2. **Multiple ActivityFinalNode per diagram** sangat umum — CRUD pattern biasanya punya 2-3 end node:
   - End 1: setelah View (tampilkan → selesai)
   - End 2: setelah Add/Edit save
   - End 3: loop-exit atau error path

   **Bukan melanggar ADSI** — ADSI §7 bilang "bisa lebih dari satu end state pada sebuah activity diagram" (verbatim Tabel 7.1).

3. **Start node tetap 1** (ADSI strict: "Hanya ada satu start state dalam sebuah workflow").

---

## 5. Swimlane / ActivityPartition

2-3 kolom paling umum. Kolom = kategori aktor atau komponen sistem.

**Contoh kombinasi dari skripsi:**
| Resto | `User | Sistem | Gobiz` (3) atau `Pembeli | Karyawan` (2) |
| Super | `User | Sistem` (2) atau `Manager | Sistem | Admin | Distributor` (4 untuk flow kompleks) |
| Toko | `User | System | Database` (3) atau `Owner | System | Supplier` (3) |

**Tips:**
- Setiap action ditaruh di swimlane aktor yang "melakukan" action itu
- Arrow melintasi swimlane saat transfer of control (User klik → Sistem proses)
- Warna/styling boleh custom, tapi standar = no fill + border hitam

---

## 6. Single input, single output rule (ADSI §7 verbatim)

> *"Setiap aksi hanya mendapat satu alur masuk dan satu alur keluar menuju ke forks, joins, decisions, dan merges."*

Artinya:
- UMLAction: **1 incoming edge, 1 outgoing edge** (strict)
- UMLDecisionNode: 1 incoming, **N outgoing** (N≥2)
- UMLMergeNode: **N incoming**, 1 outgoing
- UMLForkNode: 1 incoming, **N outgoing parallel**
- UMLJoinNode: **N incoming parallel**, 1 outgoing

Kalau ada Action yang dapat 2+ incoming → sisipkan MergeNode dulu. Kalau keluar 2+ branching → sisipkan DecisionNode.

**Exception dari skripsi:** kadang Action langsung dapat 2 incoming (looping back). Strict UML harus Merge dulu, tapi skripsi contoh kadang skip. Saran: tetap pakai Merge (cleaner + ADSI-compliant).

---

## 7. Merge vs Join — jangan tertukar

- **Merge (diamond)** = gabung alur **exclusive** (cuma 1 path aktif, yg lain tidak dijalani). Dipasang setelah Decision.
- **Join (solid bar)** = sinkronisasi alur **parallel** (semua path harus selesai). Dipasang setelah Fork.

**Ambiguitas visual:** Decision dan Merge sama-sama diamond. Bedakan dari jumlah edge: Decision 1-in N-out, Merge N-in 1-out.

**Hindari redundant merge:** kalau 3 path eksklusif konvergen ke node yang sama (misal sebelum Decision "Tambah lagi?"), pakai **1 Merge saja** — bukan rantai Merge→Merge. Lihat §4b.

---

## 7b. Konsolidasi merge — jangan tumpuk

Kalau ada beberapa exclusive path yang akhirnya ke node yang sama, **1 Merge cukup**. Contoh bad:
```
[ya] → Act1 ─┐
            MergeA → MergeB → next
[tidak]→ Act2 ─┘     ↑
[etc] → Act3 ─────────┘
```
Bad karena MergeA tidak menambah semantic value. Fix:
```
[ya] → Act1 ─┐
            MergeB → next
[tidak]→ Act2 ┤
[etc] → Act3 ─┘
```

---

## 8. Build di StarUML via staruml-mcp

### Step 1 — container
```
mcp__staruml__create_diagram type=UMLActivityDiagram parentId=<parent> name="Activity Diagram - <nama>"
```
StarUML auto-create UMLActivity yg owns diagram. Find via `find_elements type=UMLActivity`, rename jadi `<nama> Activity`.

### Step 2 — swimlanes
```
mcp__staruml__create_element_with_view type=UMLActivityPartition parentId=<activityId> diagramId=<diagramId> name="User" x=40 y=40 x2=480 y2=1000
```
Spacing antar swimlane 20px.

### Step 3 — nodes
Semua parent = UMLActivity id (bukan UMLModel).

```
type=UMLInitialNode          # start, 20x20
type=UMLActivityFinalNode    # end, 20x20 (boleh >1)
type=UMLAction name="..."    # action, ~160x50, TITLE CASE INDONESIAN
type=UMLDecisionNode name="Stok cukup?"   # diamond with question, 40x40
type=UMLMergeNode            # diamond polos, 40x40
```

### Step 4 — edges
```
type=UMLControlFlow tailViewId=<from> headViewId=<to> name="Ya"
```

Guard plain text tanpa `[]` (ikuti skripsi) di `name`.

### Step 5 — save
```
mcp__staruml__save_project filename="..."
```

---

## 9. Checklist verifikasi

Sebelum selesai, cek:

1. ✅ **1 Initial node** (start)
2. ✅ **Min 1 Activity Final node** (end) — >1 OK untuk CRUD / branching exit
3. ✅ Semua **action name = verb phrase bahasa bisnis**, bukan SQL/field/formula
4. ✅ Style action consistent (semua Title Case Indonesian ATAU semua lowercase, jangan campur)
5. ✅ Semua **Decision punya label jelas** (Style A/B/C) — orang yg screenshot bisa paham
6. ✅ Semua **guards terisi** di setiap outgoing edge decision (`Ya`/`Tidak`/dll, plain text tanpa bracket)
7. ✅ Action punya **1 incoming & 1 outgoing** (exception: looping via merge)
8. ✅ **Merge tidak berantai** — multiple exclusive path langsung ke 1 merge sebelum next
9. ✅ Swimlane label jelas (`User`, `Sistem`, `Admin`, dst)
10. ✅ Diagram title di StarUML Navigator: `Activity Diagram - <proses>`

---

## 10. Worked example — Order Flow (POS Ayam Bakar)

Swimlanes: `Kasir | Sistem`

```
Start
  → Pilih Meja Kosong (Kasir)
  → Buka Pesanan Meja (Kasir)
  → Pilih Menu dan Qty (Kasir) ←────────────────┐ (loop)
  → Cek ketersediaan stok hari ini (Sistem)     │
  → [Stok cukup?] (Decision, Sistem)            │
     Ya     → Catat pesanan & kurangi stok ────┐│
     Tidak  → [Force order?] (Decision, Kasir) ││
              Ya    → Konfirmasi Force Order   ││
                    → Catat pesanan dengan     ││
                      tanda force-order ──────┐││
              Tidak → Batalkan Item ──────────┤││
                                              ▼▼▼
                                            Merge
                                              ↓
                                    [Tambah item lagi?]
                                     Ya → (loop) ──────┘
                                     Tidak → Simpan pesanan
                                              ↓
                                             End (bullseye)
```

3 Decisions (`Stok cukup?`, `Force order?`, `Tambah item lagi?`) — semua diberi nama pertanyaan yang jelas.

---

## 11. Common mistakes

- ❌ Decision diamond polos tanpa label (reader harus klik properties buat tau) → tambah `name` pada decision node
- ❌ Action name berisi SQL/field names → rename bahasa bisnis
- ❌ Chain Merge→Merge tanpa nilai tambah → consolidate jadi 1 Merge
- ❌ Pakai Join (solid bar) untuk alur exclusive → gunakan Merge (diamond)
- ❌ Multiple InitialNode dalam 1 diagram → harus 1 saja
- ❌ Action dapat 2+ incoming edges → sisipkan Merge node dulu
- ❌ Guard pakai bracket `[ya]` sementara skripsi style plain `Ya` → ikuti skripsi
- ❌ Mixed language: half Indonesian half English action names → pilih 1 dan konsisten
- ❌ Swimlane hanya 1 kolom → minimal 2 (User/Sistem)
