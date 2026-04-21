---
name: activity-diagram
description: Build UML Activity Diagrams in StarUML for Indonesian ADSI (Analisis Design Sistem Informasi) skripsi. Use this skill whenever the user asks to create, rebuild, review, or fix an activity diagram — even when they say "diagram alur", "workflow", "flow aktivitas", or describe a step-by-step business process across actors. Covers ADSI Modul Pembelajaran Bab 7 conventions (start/end points, activities as rounded rectangles, decisions as diamonds, fork/join as solid bars, swimlanes, single-input/single-output rule per action) and programmatic construction via staruml-mcp tools (`create_diagram UMLActivityDiagram`, `create_element_with_view UMLAction/UMLInitialNode/UMLActivityFinalNode/UMLDecisionNode/UMLMergeNode/UMLForkNode/UMLJoinNode/UMLSwimlane`, `create_edge_with_view UMLControlFlow`). Do not create an activity diagram without consulting this skill first.
---

# Activity Diagram — ADSI convention + StarUML MCP

Authoritative source: **Modul Pembelajaran ADSI Bab 7 — Activity Diagram** (extracted text `docs/extracted/adsi.txt` lines 1960–2147). Quote this when a reviewer challenges a convention.

## 1. What activity diagram is (per ADSI)

> *"Activity diagram merupakan penggambaran workflow (aliran kerja) atau aktivitas dari sebuah sistem proses bisnis atau menu yang ada pada perangkat lunak."* — Sukamto & Shalahuddin, 2016, quoted in ADSI §7

Consequences:

- Captures **dynamic behavior** — how activities flow, how decisions branch, how parallel work happens.
- **Built from one or more use cases.** First finish the use case diagram; then pick critical use cases and draw an activity diagram for each (ADSI TIPS §7).
- **Describes system activities, not actor gestures.** "Memasukkan PIN" is OK (user-system interaction); "Nasabah bingung di depan ATM" is not.
- Activity diagram ≠ statechart. Activity focuses on activities within one process; statechart focuses on object state transitions.

### Goals (ADSI §7)
- Menggambarkan aliran aktivitas dari sistem.
- Menggambarkan urutan aktivitas dari satu aktivitas ke lainnya.
- Menggambarkan paralelisme, percabangan dan aliran konkuren dari sistem.

## 2. Symbols (ADSI Tabel 7.1, verbatim)

| Simbol | Nama | Keterangan |
|---|---|---|
| Solid filled circle | **Start Point (initial node)** | Marks where the workflow begins. **Only ONE start point per diagram.** |
| Bull's-eye circle (ring around filled circle) | **End Point (activity final)** | Terminal of the workflow. Can have >1 end point per diagram. |
| Rounded rectangle / lozenge (horizontal top+bottom, convex sides) | **Activity (Action)** | A task/step in the workflow. |
| Solid line with arrow | **State Transition / Control Flow** | Shows what activity comes next. |
| Diamond | **Decision (Kondisi)** | Branch point with guard expressions `[cond]` labeling outgoing edges. |
| Diamond (same shape, reverse role) | **Merge** | Rejoins mutually exclusive branches opened by a Decision. |
| Solid bar (thick rectangle) | **Fork** | Splits flow into concurrent parallel branches. |
| Solid bar (same shape) | **Join** | Rejoins parallel branches opened by a Fork. |
| Vertical/horizontal lanes | **Swimlane (Partition)** | Groups activities by the object/role responsible. |

Critical ADSI rule (quoted):
> *"Setiap aksi hanya mendapat satu alur masuk dan satu alur keluar menuju ke forks, joins, decisions, dan merges."*

Every action has exactly **one incoming** and **one outgoing** flow. Branching/merging/paralleling is done through the dedicated nodes, not by attaching multiple edges to an action directly.

## 3. Build petunjuk (ADSI §7, verbatim 7 steps)

1. Mulailah dengan node awal untuk titik awal.
2. Tambahkan partisi (swimlane) jika relevan untuk analisis yang dibuat.
3. Tambahkan aksi untuk setiap langkah utama dari use case.
4. Tambahkan alur dari setiap aksi ke aksi lain, keputusan atau node akhir.
5. Tambahkan decisions jika alur dipecah menjadi beberapa pilihan. **Jangan lupa menggabungkan kembali dengan merge.**
6. Tambahkan forks dan joins jika aktivitas akan dilakukan secara paralel.
7. Akhiri proses dengan notasi untuk akhir aktivitas.

## 4. ADSI worked examples (reference)

- **Gambar 7.1** — sequential activity diagram (no branches, no parallelism).
- **Gambar 7.2** — ATM withdrawal: 3 swimlanes (`Nasabah`, `ATM`, `Sistem Bank`). Decision on PIN check (benar/salah), loop back on wrong PIN, block card after 3 wrong tries. After "cek saldo cukup" → Fork: `Keluarkan uang` (ATM) ∥ `Debet saldo` (Sistem Bank) → Join → `Tampilkan saldo`.
- **Gambar 7.4** — Library: pendaftaran anggota, peminjaman, pengembalian buku.
- **Gambar 7.5** — Library: manipulasi data buku (CRUD).

Use these as templates for layout, swimlane naming, and decision/fork usage.

## 5. Checklist — verify before saving

1. Exactly **one** start point (initial node).
2. At least one end point (activity final).
3. Every action has exactly **one** incoming and **one** outgoing flow.
4. Every `Decision` eventually rejoins via a `Merge` node (or terminates each branch at its own end).
5. Every `Fork` eventually rejoins via a `Join` (you cannot "leak" a parallel branch).
6. Decision outgoing edges are labeled with guard expressions in brackets, e.g. `[PIN benar]`, `[stok cukup]`, `[else]`.
7. Swimlanes named with the responsible object/role (e.g. `Kasir`, `Sistem`, `Kitchen`) — activities live inside the correct lane.
8. Activity names use **verb phrase** (kata kerja), consistent language. E.g. `Memilih Meja`, `Menambah Item`, `Validasi Stok`, `Mencetak Struk`.
9. The diagram is traceable to a use case (or a small group of them). Name the diagram accordingly: `Activity Diagram - <Use Case Name>`.
10. No action has >1 incoming or >1 outgoing edge — if it does, insert a Merge/Decision/Fork/Join.

## 6. How to build in StarUML via staruml-mcp

Always use the registered `mcp__staruml__*` tools. Never bypass with raw HTTP/curl.

### Step 1 — diagram container

```
mcp__staruml__create_diagram type=UMLActivityDiagram parentId=<parent> name="Activity Diagram - <Use Case Name>"
    → returns diagramId (and the implicit Activity model that owns the nodes)
```

StarUML typically creates a `UMLActivity` model as the parent of the diagram's nodes. Use that activity model as the `parentId` for child nodes.

### Step 2 — swimlanes (optional but recommended)

```
mcp__staruml__create_element_with_view type=UMLSwimlane parentId=<activityId> diagramId=<diagramId> \
    name="Kasir" x=40 y=40 x2=260 y2=700
```

Repeat horizontally (`Sistem`, `Kitchen`, etc.). Place all subsequent nodes *inside* the correct swimlane's bounding box.

### Step 3 — nodes

Type map (StarUML element names):

| ADSI name | StarUML type |
|---|---|
| Start point | `UMLInitialNode` |
| End point | `UMLActivityFinalNode` |
| Activity / Action | `UMLAction` |
| Decision | `UMLDecisionNode` |
| Merge | `UMLMergeNode` |
| Fork | `UMLForkNode` |
| Join | `UMLJoinNode` |

```
mcp__staruml__create_element_with_view type=UMLInitialNode parentId=<activityId> diagramId=<diagramId> \
    x=100 y=60 x2=120 y2=80
mcp__staruml__create_element_with_view type=UMLAction parentId=<activityId> diagramId=<diagramId> \
    name="Memasukkan PIN" x=60 y=120 x2=220 y2=170
mcp__staruml__create_element_with_view type=UMLDecisionNode parentId=<activityId> diagramId=<diagramId> \
    x=120 y=200 x2=160 y2=240
mcp__staruml__create_element_with_view type=UMLForkNode parentId=<activityId> diagramId=<diagramId> \
    x=40 y=400 x2=260 y2=410
mcp__staruml__create_element_with_view type=UMLActivityFinalNode parentId=<activityId> diagramId=<diagramId> \
    x=120 y=680 x2=150 y2=710
```

### Step 4 — edges (control flow)

```
mcp__staruml__create_edge_with_view type=UMLControlFlow parentId=<activityId> diagramId=<diagramId> \
    tailViewId=<fromNodeViewId> headViewId=<toNodeViewId>
```

For decision branches, after edge creation set the edge's `name` (or `guard`) to the condition, e.g. `[PIN benar]`, `[PIN salah]`, `[else]` via `mcp__staruml__update_element`.

### Step 5 — save

```
mcp__staruml__save_project
```

### Coordinate cheat sheet

| Element | Size | Notes |
|---|---|---|
| InitialNode / ActivityFinalNode | ~20×20 | Keep small; center in lane |
| Action | ~160×50 | Lozenge rendered by StarUML |
| Decision / Merge | ~40×40 | Diamond |
| Fork / Join | lane-wide × ~10 | Thin solid bar spanning the lanes that fork/join |
| Swimlane | ~220 wide × full height | Layout left-to-right horizontally |
| Vertical spacing | ~70–100 px between nodes | |

## 7. Worked example — POS "Mencatat Pesanan & Bayar"

Based on the POS use case `Mencatat Pesanan` + `Memproses Pembayaran`:

Swimlanes: `Kasir` | `Sistem` | `Kitchen (opsional)`.

Flow:

1. **[Kasir]** Start → `Memilih Meja` → `Menambah Item ke Keranjang`
2. **[Sistem]** `Validasi Stok` → Decision `[stok cukup?]`
   - `[tidak]` → `Tampilkan Force Order Modal` → Decision `[owner konfirmasi?]` → `[ya]` → continue; `[tidak]` → Merge back to Menambah Item
   - `[ya]` → continue
3. **[Sistem]** Merge branches → `Simpan Transaksi Open`
4. **[Kasir]** `Memilih Metode Pembayaran` → `Memproses Pembayaran`
5. **[Sistem]** Fork:
   - **[Sistem]** `Mengurangi Stok Harian`
   - **[Sistem]** `Mengubah Status Transaksi = paid`
6. **[Sistem]** Join → Decision `[customer minta struk?]`
   - `[ya]` → `Mencetak Struk` → Merge
   - `[tidak]` → Merge
7. → ActivityFinal

Every action has exactly one in/out. Decisions paired with Merges. Fork paired with Join. Guards bracketed.

## 8. Common mistakes to grep for

- No swimlanes for a multi-actor process → add partitions to show responsibility.
- Action with 2+ incoming edges → insert a Merge node before the action.
- Decision without a paired Merge → merge divergent branches before moving on (unless each branch terminates at its own ActivityFinal).
- Fork without Join → parallel branches never rejoin; diagram is invalid.
- Using Decision as a Fork (or vice versa) — Decision = exclusive choice, Fork = concurrent parallel.
- Missing guards on Decision outgoing edges.
- Only one start point is allowed; multiple starts = wrong.
- Action names that are UI clicks (`Tekan Tombol OK`) or nouns (`Pembayaran`) — use verb phrases.
- Drawing statechart transitions (object states) here instead of activities — that belongs in a state machine diagram.

## 9. When the user says "jelek"

Walk §5 checklist, then fix the highest-impact issue first:

- Missing swimlanes → add partitions.
- Decisions not paired with Merges → add Merge nodes.
- Fork/Join imbalance → rebalance.
- Activity names too granular (UI clicks) or too vague (single word nouns) → rename to verb phrases.
- Built as `UMLActivityDiagram` but nodes typed as generic shapes → recreate with correct `UMLAction`/`UMLDecisionNode`/etc.

Fix one issue, save, show user, iterate.
