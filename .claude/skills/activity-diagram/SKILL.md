---
name: activity-diagram
description: Build UML Activity Diagrams in StarUML for Indonesian ADSI (Analisis Design Sistem Informasi) skripsi. Use this skill whenever the user asks to create, rebuild, review, or fix an activity diagram - even when they say "diagram alur", "workflow", "flow aktivitas", or describe a step-by-step business process across actors. Covers ADSI Modul Pembelajaran Bab 7 + real skripsi conventions observed across 3 POS case studies (restoran cross-channel, supermarket ABC-VED, toko inventory control). Uses staruml-mcp tools (`create_diagram UMLActivityDiagram`, `create_element_with_view UMLAction/UMLInitialNode/UMLActivityFinalNode/UMLDecisionNode/UMLMergeNode/UMLForkNode/UMLJoinNode/UMLActivityPartition`, `create_edge_with_view UMLControlFlow`). Do not create an activity diagram without consulting this skill first.
---

# Activity Diagram - ADSI + skripsi-praktis convention + StarUML MCP

Sumber otoritatif:
- **ADSI Bab 7** - Modul Pembelajaran ADSI (`docs/extracted/adsi.txt` §7)
- **3 contoh skripsi POS** observed at `docs/pdf-pages/`: resto (cross-channel Gobiz), super (supermarket ABC-VED), toko (market basket). Semua dari UK Petra.

**Prinsip dasar** (ADSI §7 verbatim):
> *"Activity diagram merupakan penggambaran workflow (aliran kerja) atau aktivitas dari sebuah sistem proses bisnis."*

Aktivitas = **apa yang sistem dan aktor lakukan** dalam bahasa bisnis, bukan implementation detail.

---

## 1. Struktur dasar (ADSI Tabel 7.1)

| Simbol | Nama | Catatan |
|---|---|---|
| ● (filled solid circle) | Start / Initial Node | Hanya 1 per diagram (per ADSI §7 rule) |
| ◉ (bullseye - circle dengan dot di dalam) | End / ActivityFinalNode | Boleh lebih dari 1 (lihat §4 pattern CRUD) |
| ⬭ (rounded rectangle / lozenge) | Action | Verb phrase, bahasa bisnis |
| ◇ (diamond) | Decision atau Merge | Lihat §3 cara labeling |
| ▬ (solid bar) | Fork (split parallel) atau Join (sync parallel) | Jarang dipakai di skripsi POS, biasanya alur sequential |
| 2-3 kolom vertikal | Swimlane / ActivityPartition | Label: aktor atau sistem |

---

## 2. Action naming - BAHASA MANUSIA, BUKAN code (CRITICAL — paling penting!)

**Audiens activity diagram = manusia non-teknis** (kasir, waiter, owner, dosen, penguji). Bukan developer. Action name harus enak dibaca seperti instruksi di buku manual pelatihan pegawai.

**Aturan keras:**
1. Title Case Indonesian, verb phrase 2-5 kata
2. **DILARANG**: nama tabel/kolom (`portion_stocks`, `current_qty`), nama field/enum (`payment_method`, `reason=order`), nama property (`status=open`), istilah teknis (`localStorage`, `cache`, `array`, `JSON`, `endpoint`), formula (`qty × price`, `roundup((min-current)/5)*5`), implementasi detail (`grid 9 meja`, `lookup nama + cek PIN`)
3. **Hindari parenthesis penjelasan teknis** seperti `(existing kalau terisi, baru kalau kosong)` — kalau perlu detail itu, pecah jadi action terpisah atau pakai decision
4. Kalau 1 action ngerjain 2 hal beda, pecah jadi 2 action (mis. "Mengurangi Stok Porsi" + "Mencatat Log Perubahan Stok")

**Smell test sebelum tulis nama action:**
- Baca nama keras-keras. Apa kasir Amel (lulusan SMA, bukan programmer) bisa paham? Kalau ngerasa harus jelasin "ini maksudnya program X", **nama jelek — rename**.
- Cek: ada nama teknis di nama action? (`localStorage`, `portion_stocks`, `decrement`, `JSON`, `cache`, `SubOptionsModal`, `dashboard component`) → bukan bahasa manusia.

**Contoh konkret rename (PENTING dipakai sebagai template):**

| ❌ Technical (jangan) | ✅ Bahasa manusia (pakai ini) |
|---|---|
| `Cek user terakhir di localStorage` | `Mengecek Sesi Login Sebelumnya` |
| `Tampilkan list nama user aktif` | `Menampilkan Daftar Pegawai` |
| `Tampilkan layar input PIN` | `Menampilkan Form PIN` |
| `Validasi (lookup nama + cek PIN)` | `Memvalidasi PIN` |
| `Simpan user ke localStorage + redirect ke dashboard sesuai role` | `Membuka Dashboard Sesuai Peran` |
| `Tampilkan pesan PIN salah` | `Menampilkan Pesan PIN Salah` |
| `Pilih nomor meja dari grid 9 meja` | `Memilih Nomor Meja` |
| `Buka transaksi meja (existing kalau terisi, baru kalau kosong)` | `Membuka Transaksi Meja` |
| `Buat transaksi takeaway tanpa meja` | `Membuat Transaksi Takeaway` |
| `Tampilkan grid menu sesuai kategori` | `Menampilkan Daftar Menu` |
| `Pilih item menu dari grid` | `Memilih Item Menu` |
| `Tampilkan SubOptionsModal + Kasir pilih variant (Paha/Dada, Bakar/Goreng)` | `Memilih Pilihan Paket` |
| `Tambah item ke cart` | `Menambahkan Item ke Pesanan` |
| `Submit pesanan` | `Mengirim Pesanan` |
| `Decrement portion_stocks (boleh minus) + log portion_movements reason=order` | **PECAH 2**: `Mengurangi Stok Porsi` + `Mencatat Log Perubahan Stok` |
| `Simpan transaksi status=open` | `Menyimpan Pesanan` |
| `Query daily_menu_stocks WHERE date=today` | `Mengecek Stok Hari Ini` |
| `Insert Item (is_force_order=false) + decrement current_stock` | `Mencatat Pesanan` + `Mengurangi Stok` |
| `UPDATE transaction SET status=paid, paid_at=NOW()` | `Menandai Pesanan Lunas` |
| `POST /api/transactions/{id}/pay` | `Mengirim Data Pembayaran` |
| `Hitung variance_X = actual_X - system_X` | `Menghitung Selisih per Metode` |

**Decision label sama:** "Item paket dengan sub-options?" → "Item Paket?". "PIN valid?" → "PIN Benar?". Pendek, jelas, tanpa technical jargon.

**Pengecualian:** istilah technical yang sudah masuk vocabulary user resto (mis. "PIN", "Dine-in", "Takeaway", "PB1", "EDC", "QRIS") boleh dipakai apa adanya karena familiar.

---

## 3. Decision labeling - 3 style yang VALID (semua dipakai di skripsi)

Simbol diamond tidak otomatis menampilkan "pertanyaan" - harus dikasih label jelas agar orang yang lihat screenshot paham. 3 style dari skripsi:

### Style A: Text DI DALAM diamond (kalau pendek)
Dipakai super + toko. Contoh: `Login Benar`, `Apakah Data duplikat`, `Product arrived`, `Stok habis?`

StarUML: set `name` property pada UMLDecisionNode. Di StarUML V7 label muncul **di samping** diamond (bukan di dalam, tapi terlihat).

### Style B: Text DI ATAS atau SAMPING diamond
Dipakai resto. Contoh: `stok habis?` (ditulis di atas), `Terdapat data menu sama?`

StarUML: pakai UMLNote attached, atau taruh UMLAction pendek sebelum Decision yang *describe what's being evaluated* (e.g. "Cek stok"), lalu Decision polos + guards jelas.

### Style C: Guards descriptive di arrow (no text di diamond)
Dipakai toko. Decision polos, outgoing arrows pakai guard descriptive: `User data match` / `User data not match`, `Item match` / `Item not match`.

StarUML: guard di `name` property edge.

**Semua 3 style OK** - pilih satu dan konsisten dalam 1 diagram.

### Guard syntax
Dari skripsi: **plain text, tanpa bracket `[]`**:
- `Ya` / `Tidak`
- `Benar` / `Salah`
- `View` / `Add` / `Edit` / `Delete` (multi-branch)
- `Lebih dari 3 kali`
- `Confirm to Save` / `Not confirm save`

**ADSI versi strict** tulis `[...]` seperti UML spec. **Skripsi praktis** tulis plain. Saran: **ikuti skripsi** (tanpa bracket) - lebih enak dibaca, dosen terima.

---

## 4. Multi-branch decision + multiple end nodes - VALID

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

2. **Multiple ActivityFinalNode per diagram** sangat umum - CRUD pattern biasanya punya 2-3 end node:
   - End 1: setelah View (tampilkan → selesai)
   - End 2: setelah Add/Edit save
   - End 3: loop-exit atau error path

   **Bukan melanggar ADSI** - ADSI §7 bilang "bisa lebih dari satu end state pada sebuah activity diagram" (verbatim Tabel 7.1).

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

## 7. Merge vs Join - jangan tertukar

- **Merge (diamond)** = gabung alur **exclusive** (cuma 1 path aktif, yg lain tidak dijalani). Dipasang setelah Decision.
- **Join (solid bar)** = sinkronisasi alur **parallel** (semua path harus selesai). Dipasang setelah Fork.

**Ambiguitas visual:** Decision dan Merge sama-sama diamond. Bedakan dari jumlah edge: Decision 1-in N-out, Merge N-in 1-out.

**Hindari redundant merge:** kalau 3 path eksklusif konvergen ke node yang sama (misal sebelum Decision "Tambah lagi?"), pakai **1 Merge saja** - bukan rantai Merge→Merge. Lihat §4b.

---

## 7b. Konsolidasi merge - jangan tumpuk

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

## 8. Build di StarUML via staruml-mcp — STRICT SEQUENCE

**CRITICAL: harus urutan ini karena partition assignment, parent constraint, dan bug update_element.**

### Step 1 — create diagram & find UMLActivity wrapper
```
mcp__staruml__create_diagram type=UMLActivityDiagram parentId=<UMLModel> name="Activity Diagram - <nama>"
```
StarUML auto-create UMLActivity wrapper yang owns diagram. **WAJIB** find via:
```
mcp__staruml__find_elements type=UMLActivity name="Activity1"
```
Simpan ID-nya — pakai sebagai `parentId` untuk SEMUA nodes & edges berikutnya.

Rename Activity ke `<Nama> Activity` di akhir (langkah save).

### Step 2 — create swimlanes (UMLActivityPartition) DULU, SEBELUM nodes apapun
```
mcp__staruml__create_element_with_view type=UMLActivityPartition parentId=<UMLActivity> diagramId=<diagram> name="User" x=20 y=20 x2=380 y2=1300
mcp__staruml__create_element_with_view type=UMLActivityPartition parentId=<UMLActivity> diagramId=<diagram> name="Sistem" x=400 y=20 x2=780 y2=1300
```

**WHY this order matters:** Saat nodes di-create, StarUML auto-assign `containerView` ke partition berdasarkan posisi x/y. Kalau partitions belum ada saat node create, node akan jadi `containerView: null` (orphan, render di kolom yang salah). Susah di-fix later — `update_element` pada view coords punya bug serius (lihat §8c).

Sebaiknya jangan batch partition + nodes dalam 1 message. Send partition creates SAJA, tunggu response, lalu send nodes batch.

Spacing 20px antar swimlane (mis. col 1 x=20-380, col 2 x=400-780).

### Step 3 — create nodes
Semua `parentId` = UMLActivity ID (BUKAN UMLModel — kalau pakai UMLModel, InitialNode/DecisionNode akan fail dengan "cannot be placed here").

```
type=UMLInitialNode          # start, 30x30 px
type=UMLActivityFinalNode    # end, 30x30 px (bullseye/mata sapi). NB: PAKAI ini, bukan UMLFinalNode.
type=UMLAction name="..."    # action, ~280x50 px, Title Case Indonesian, NO [Aktor] prefix
type=UMLDecisionNode name="Stok cukup?"   # diamond with label, MINIMAL 100x60 (kalau lebih kecil label tidak render — bug StarUML)
type=UMLMergeNode            # diamond polos, ~60x60
```

**Positioning nodes inside swimlanes:** set `x` di tengah swimlane column-nya. Mis. swimlane "User" x=20-380, taruh action di x=60-340 (centered + margin 40px tiap sisi).

**Action name = pure verb phrase, NO prefix `[Aktor]`.** Swimlane sudah menunjukkan aktor. Prefix di action name = redundancy + bad style.

**Decision label visibility:** untuk decision label terlihat di body diamond, kasih ukuran minimal **100x60** (StarUML hide label kalau shape lebih kecil dari label). Atau pakai Style C (decision polos, guards di edge saja — `name`-nya dikosongkan, label semantik via "Cek X" action sebelumnya).

### Step 4 — create edges (UMLControlFlow)
```
mcp__staruml__create_edge_with_view type=UMLControlFlow parentId=<UMLActivity> diagramId=<diagram> tailViewId=<from> headViewId=<to> name="Ya"
```

Guard plain text tanpa `[]` (ikuti skripsi) di `name`. Untuk edge tanpa guard, omit `name`.

### Step 5 — rename activity + switch + fit + save
```
mcp__staruml__update_element id=<UMLActivity> field=name value="<Nama> Activity"
mcp__staruml__switch_diagram id=<diagram>
mcp__staruml__execute_command id="view:fit-to-window"
mcp__staruml__save_project filename="<absolute path .mdj>"
```

`save_project` REQUIRES `filename` parameter (extension bug — empty filename crashes dengan "path must be string").

## 8b. Decision label visibility — fix patterns

UMLDecisionNode `name` property hanya muncul visually kalau:
1. **Shape cukup besar**: minimal 100×60 px (default 40×40 terlalu kecil, label hidden)
2. **wordWrap=true** kadang membantu untuk label multi-line
3. **Style C fallback**: decision polos (no name), tulis pertanyaan via action "Cek X" sebelum decision; guards `Ya`/`Tidak` di edge sudah jelas semantic-nya

Pilih style C kalau ragu — paling robust di StarUML rendering.

## 8c. ⚠️ Bug: update_element pada view coords concat string

**JANGAN PERNAH update_element pada view properties `left`/`top`/`width`/`height` dengan value STRING** — StarUML extension melakukan string concatenation, bukan numeric assignment:

```
# BAD — width akan jadi corrupted (e.g., "440440440438520" lalu meledak jadi 4.4e+86)
update_element id=<view> field=left value="440"   # ❌ STRING
update_element id=<view> field=width value="280"  # ❌ STRING
```

Bahkan kalau kita pass NUMERIC integer dari client-side, JSON serialization atau extension internal mungkin convert ke string. Saya verify: bahkan dengan numeric value, hasilnya tetap corrupt setelah multiple update.

**Workaround:** kalau salah position, **DELETE element + edges yang connect ke-nya + RECREATE** dengan `create_element_with_view` di posisi yang benar. JANGAN coba patch via update_element.

Atau lebih aman: positioning yang benar SEJAK CREATE, jangan reposition setelah.

## 8d. ContainerView assignment heuristic

Saat `create_element_with_view` di diagram yang sudah ada partitions, StarUML auto-assign view `containerView` ke partition berdasarkan posisi center node (x_center, y_center).

`containerView` adalah **visual containment** (canvas-level): action tampil di area swimlane. **BUKAN model-level membership**. Untuk action benar-benar terdaftar di partition's `nodes` array (yang bikin action muncul di explorer tree di bawah partition), perlu update `partition.nodes` array juga.

## 8e. ⚠️ CRITICAL: Move action ke partition (proper)

Untuk pindah action ke swimlane PROPERLY (visual + model + explorer tree), butuh **2 update via direct HTTP POST** (BUKAN mcp__staruml__update_element — tool itu stringify value, lihat §8c bug):

```bash
# Step 1: Update view's containerView ke partition view ID (cosmetic — visual placement in canvas)
curl -X POST http://127.0.0.1:58322/update_element \
  -H "Content-Type: application/json" \
  -d '{"id":"<action_view_id>","field":"containerView","value":"<partition_view_id>"}'

# Step 2: Update partition's nodes array dengan array of action MODEL IDs (model-level membership)
curl -X POST http://127.0.0.1:58322/update_element \
  -H "Content-Type: application/json" \
  -d '{"id":"<partition_model_id>","field":"nodes","value":["<action_model_id_1>","<action_model_id_2>",...]}'

# Step 3 (optional but recommended): Update action's _parent ke partition object reference
# WAJIB pass sebagai OBJECT {_id, name}, BUKAN string ID.
curl -X POST http://127.0.0.1:58322/update_element \
  -H "Content-Type: application/json" \
  -d '{"id":"<action_model_id>","field":"_parent","value":{"_id":"<partition_model_id>","name":"<partition_name>"}}'
```

**Why HTTP direct, bukan mcp__staruml__update_element?**
MCP tool's `update_element` JSON-encodes `value` field menjadi string saat send. Server stores string literal. Akibatnya:
- `value: ["id1", "id2"]` → stored as `"[\"id1\",\"id2\"]"` (string)
- `value: {"_id":"x","name":"y"}` → stored as `"{\"_id\":\"x\",\"name\":\"y\"}"` (string)

Server BUTUH actual array/object untuk membership work. Gunakan curl/direct HTTP untuk type preservation.

## 8f. UMLInitialNode tidak bisa nest di partition

Empirical finding: UMLInitialNode (start) tidak dapat di-nest sebagai child partition (UMLActivityPartition.nodes). StarUML treat Init sebagai diagram-level node yang muncul terpisah dari partition.

**Konsekuensi**: di explorer tree, InitialNode selalu sibling dengan partition di bawah UMLActivity. Bukan child of partition.

Visually: Init bullet hitam tetap di posisi yang kita set (visually di area swimlane), tapi di tree tidak di-nest.

**Best practice**: posisi Init di top center activity diagram (biasanya di posisi swimlane pertama untuk semantic clarity), abaikan model tree position.

UMLAction, UMLDecisionNode, UMLMergeNode, UMLActivityFinalNode SEMUA bisa di-nest di partition.

## 8g. Workflow pattern lengkap (proven)

Untuk activity diagram dengan 2 swimlane "User | Sistem":

```
1. Create UMLActivityDiagram (auto-create UMLActivity Activity1)
2. Find_elements UMLActivity name="Activity1" → simpan ID
3. Create 2 UMLActivityPartition (User, Sistem) — paralel OK
   - parent = UMLActivity ID
   - Simpan partition model IDs + view IDs
4. Create N UMLAction + decisions + Init + Final
   - parent = UMLActivity ID
   - x positioned dalam kolom partition yang sesuai (margin 20-40px dari edge)
   - Simpan model + view IDs per node
5. Untuk setiap partition, set `nodes` array via direct HTTP POST:
   - User.nodes = [action_model_ids in User column]
   - Sistem.nodes = [action_model_ids in Sistem column + decisions + Final]
   - (Init dikecualikan — tidak bisa nest, lihat §8f)
6. Optional: update setiap action's _parent ke partition object reference via HTTP
7. Create UMLControlFlow edges (parent = UMLActivity ID, paralel OK)
8. Rename UMLActivity "Activity1" → "<Nama> Activity"
9. switch_diagram + view:fit-to-window
10. save_project dengan filename argument
```

---

## 9. Checklist verifikasi

Sebelum selesai, cek:

1. ✅ **1 Initial node** (start)
2. ✅ **Min 1 Activity Final node** (end) - >1 OK untuk CRUD / branching exit
3. ✅ Semua **action name = verb phrase bahasa bisnis**, bukan SQL/field/formula
4. ✅ Style action consistent (semua Title Case Indonesian ATAU semua lowercase, jangan campur)
5. ✅ Semua **Decision punya label jelas** (Style A/B/C) - orang yg screenshot bisa paham
6. ✅ Semua **guards terisi** di setiap outgoing edge decision (`Ya`/`Tidak`/dll, plain text tanpa bracket)
7. ✅ Action punya **1 incoming & 1 outgoing** (exception: looping via merge)
8. ✅ **Merge tidak berantai** - multiple exclusive path langsung ke 1 merge sebelum next
9. ✅ Swimlane label jelas (`User`, `Sistem`, `Admin`, dst)
10. ✅ Diagram title di StarUML Navigator: `Activity Diagram - <proses>`

---

## 10. Worked example - Order Flow (POS Ayam Bakar)

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

3 Decisions (`Stok cukup?`, `Force order?`, `Tambah item lagi?`) - semua diberi nama pertanyaan yang jelas.

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
