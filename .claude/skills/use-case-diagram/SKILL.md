---
name: use-case-diagram
description: Build UML Use Case Diagrams in StarUML for Indonesian ADSI (Analisis Design Sistem Informasi) skripsi. Use this skill whenever the user asks to create, rebuild, review, or fix a use case diagram — even when they use words like "use case", "UC diagram", "diagram aktor", or describe actors/use cases informally. Covers ADSI Modul Pembelajaran conventions (Microsystems/Sun reference diagrams, actor karakteristik, include/extend semantics, actor & use case inheritance, specialization with {abstract}, relation ke use case scenario + use case form) and programmatic construction via staruml-mcp tools (`create_diagram UMLUseCaseDiagram`, `create_element_with_view UMLActor/UMLUseCase`, `create_edge_with_view UMLAssociation/UMLInclude/UMLExtend/UMLGeneralization`). Do not create a use case diagram without consulting this skill first.
---

# Use Case Diagram — ADSI convention + StarUML MCP

Authoritative source for conventions: **Modul Pembelajaran ADSI Bab 5 — Use Case Diagram** (extracted text at `docs/extracted/adsi.txt` lines 1488–1710). When in doubt, quote this source. Numbered figure references below ("Gambar 5.5", etc.) refer to the ADSI modul, not to this skill.

## 1. What use case diagram is (per ADSI)

> *"Use case diagram adalah diagram yang menunjukkan kebutuhan pengguna terhadap sistem yang akan dibangun... dapat diketahui fitur apa yang disediakan dalam sistem tertentu. Use case membentuk dasar dari FRs [Functional Requirements]."* — Modul ADSI §5

Key consequence:

- Captures **FRs (what the system does for users)**. Does NOT show architecture, programming language, performance, security — those are NFRs and belong in Supplementary Specifications, not on the diagram.
- If a process is done manually and never touches the system, **do not make it a use case**.
- Do not draw internal activities that don't involve an actor.

## 2. Five elements (ADSI §5)

1. **Actor** — role that does something (a use case) in the system.
2. **Use case** — anything the actor can do.
3. **Association** — connector between actor and use case.
4. **System name** — name of the system being built.
5. **System boundary** — a rectangle showing system scope. **Opsional** per ADSI ("bersifat opsional") — but most dosen pembimbing still expect it on a skripsi diagram, so include it unless the user explicitly says otherwise.

### Actor karakteristik (verbatim from ADSI Tabel 5.1 + text)

- A role or job of someone interacting with the system, **sitting outside the system**.
- Named with **kata benda** (noun).
- Types of actor — all four are legitimate:
    - **Human / role** (most common) — stick-figure icon. E.g. `Kasir`, `Owner`, `Booking Agent`.
    - **External system / device** — stick-figure or boxed-stereotype icon. E.g. `Mesin EDC`, `Finger Print Scanner`, `Web Service Payment Gateway`.
    - **Other system** — e.g. `Sistem Akuntansi`.
    - **Waktu / scheduler** — a time-triggered actor, for jobs that run automatically at a scheduled time. E.g. `Scheduler 03:00 AM` triggers use case `Generate Daily Report` (this is the hotel-system example in Gambar 5.7).
- **Primary** = initiates and controls the use case.
- **Secondary** = only partly participates in the use case (e.g. receives notification, validates externally).

### Use case karakteristik

> *"menggunakan kata kerja dan kata benda, misal mengelola data konsumen, mengelola reservasi"*

- Name = **verb + noun (kata kerja + kata benda)**. Examples from ADSI: `Mengelola Data Konsumen`, `Mengelola Reservasi`, `Create Reservation`, `Check In Customer`, `Identify Book`, `Check Out Book`, `Return Book`, `Issue a Fine`.
- Drawn as an **oval / ellipse**.
- Bad names (would fail dosen review):
    - Just a noun: `Customer`, `Dashboard`, `Database`.
    - UI action: `Click Login Button`, `Tekan Tombol Bayar`.
    - Technical primitive: `Validate Input`, `Fetch Data`, `Store Record`.
    - Manual-only process that doesn't touch the system — omit entirely.
- Use cases starting with `Mengelola` / `Manage` / `Mengatur` / `Proses` can be **detailed further** into `Create`, `Update`, `Delete` (ADSI Gambar 5.8). On a skripsi-level diagram, keep the high-level `Mengelola X` unless detail is specifically requested.

### Atomicity — one UC = one business goal (CRITICAL — most common mistake)

Each use case must be **one atomic business goal**, not a list of sub-views, report types, or CRUD sub-operations. A good rule: if the user can describe the goal with a single sentence ("Owner ingin memantau kinerja restoran"), it's one use case — even if the screen behind it has multiple tabs, filters, or report variants.

**Symptom of over-splitting:** an actor has 6+ use cases whose names are minor variations of "Melihat X", "Mencatat Y", "Mengedit Y" — this is a dashboard/CRUD, not six goals.

**Fix by consolidating:**

| ❌ Bad (over-split, 6 UCs) | ✅ Good (1 UC, same goal) |
|---|---|
| `Melihat Dashboard`<br>`Melihat Laporan Pendapatan`<br>`Melihat Laporan Pengeluaran`<br>`Melihat Laporan Laba Kotor`<br>`Melihat Laporan Rekonsiliasi`<br>`Melihat Grafik Penjualan` | `Melihat Dashboard dan Laporan` (single UC; the tabs and filters live in use-case scenario / use-case form, not on the diagram) |
| `Mencatat Pengeluaran`<br>`Mengedit Pengeluaran`<br>`Menghapus Pengeluaran` | `Mengelola Pengeluaran` (CRUD umbrella per ADSI Gambar 5.8) |
| `Mengedit Menu`<br>`Menambah Menu`<br>`Menghapus Menu` | `Mengelola Menu` |

Where the detail *does* go:
- **Use case scenario** (ADSI §6) — narrate the branches / tabs / filters in the Beginning / Middle / End scenario text.
- **Use case form** (ADSI Tabel 6.2) — enumerate sub-flows in the "Main flow" and "Alternate flow" rows.
- **Activity diagram** (ADSI §7) — show the step-by-step of selecting a report type, applying a filter, etc.

Keep the diagram lean. A skripsi use case diagram typically has **7–15 UCs total**; if you're above 20, over-splitting is usually the cause.

**Exception:** split *is* justified when the sub-operations have genuinely different actors, triggers, or pre/postconditions. E.g. `Memecah Tagihan` vs `Menggabungkan Tagihan` vs `Membatalkan Pesanan` are all distinct goals with distinct flows — keep them separate.

### System boundary

- Rectangle around the use cases, labeled with system name.
- Actors stay **outside**, use cases stay **inside**.
- Optional per ADSI but strongly expected in skripsi practice. Label example: `Sistem POS Restoran Ayam Bakar Banjar Monosuko`.

### Association karakteristik (verbatim)

- *"actor harus berelasi dengan satu atau lebih use case."*
- *"use case harus berelasi dengan satu atau lebih actor."*
- *"tidak ada use case atau actor yang berdiri sendiri (tidak berelasi)."*
- *"tidak ada asosiasi antar actor."* → never draw a line between two actors (coordinate via a shared use case instead, or use inheritance).
- Association is drawn as a plain straight line. ADSI allows an arrowhead OR no arrowhead — both are acceptable. In StarUML, default is no arrowhead; leave it that way unless the user wants directed associations.

## 3. Dependencies between use cases (ADSI §5 — Use Case Dependencies)

There are only two:

### `<<include>>` — mandatory
> *"Use case a includes use case b, artinya setiap use case a dieksekusi maka use case b harus berjalan dulu, baru kemudian use case a."* — ADSI §5

- Dashed line with open arrowhead, labeled `<<include>>`.
- **Arrow points to the use case that runs first** (the included one).
- In StarUML: `create_edge_with_view type=UMLInclude`, `tailViewId = base use case`, `headViewId = included use case`.
- Example (ADSI Gambar 5.11, library): base `Borrow Book` `<<include>>` → `Identify Book`. Identify runs first.
- Use when the extra behavior is **always** executed as part of the base.

### `<<extend>>` — optional (conditional)
> *"Use case a extends use case b, artinya use case a dapat memanggil (opsional) use case b jika memenuhi kondisi tertentu (extension point)."* — ADSI §5

- Dashed line with open arrowhead, labeled `<<extend>>`.
- **Arrow points to the use case that runs first** (the base — i.e. the extended one).
- In StarUML: `create_edge_with_view type=UMLExtend`, `tailViewId = extending use case`, `headViewId = base use case`.
- Example (ADSI Gambar 5.12, library): extending `Issue a Fine` `<<extend>>` → `Return a Book`. `Return a Book` runs first; `Issue a Fine` only fires if the book is late.
- Use when the extra behavior is **optional / conditional**.

> ⚠️ Arrow-direction mnemonic (do not get this wrong): for BOTH include and extend, the arrowhead points at the use case that runs **first**. For include that's the included one; for extend that's the base. Memorize: *"arrow menunjuk ke yang jalan duluan."*

## 4. Inheritance / Generalization (ADSI §5 — Pola Inheritance)

Hollow-triangle arrow, from child to parent.

- **Actor inheritance** (Gambar 5.9): child actor inherits all associations + methods + attributes of parent. Example: `Gold Customer` inherits from `Standard Customer` and adds extra privileges. In StarUML: `UMLGeneralization`, tail = child, head = parent.
- **Use case specialization** (Gambar 5.10): use case can be split into specialized subclasses. E.g. `Check In Customer {abstract}` → `Check In Standard Customer`, `Check In VIP Customer`. Parent that has no instances of its own is marked `{abstract}` (set `isAbstract=true` on the UMLUseCase).
- Use sparingly. Most skripsi diagrams do not need generalization.

## 5. Relation to Use Case Scenarios & Forms (why it matters for skripsi)

The diagram is only part of the deliverable. Each non-trivial use case should have:

- **Use case scenario** (ADSI §6) — narrative in *Beginning / Middle / End* form. Primary scenario = happy path. Secondary scenario = failure/alternate paths. Not every use case needs a scenario — pick ones with complex interaction or risk of failure.
- **Use case form** (ADSI §6, Tabel 6.2) — tabular template (Nama, Deskripsi, Actor, Preconditions, Flow, Postconditions, etc.).
- **Extend dependencies** on the diagram correspond to the **alternate flow** inside the scenario. If you draw an `<<extend>>`, expect the dosen to ask to see that condition in the scenario document.

If the user asks to build *scenarios* or *use case forms*, that's a separate artifact — not drawn on this diagram.

## 6. The checklist — verify before saving

Before declaring a use case diagram done, walk through every item. Each is traceable to ADSI §5.

1. System boundary rectangle present with system name label (unless user opted out).
2. All actors sit **outside** the boundary. None inside.
3. Each actor name is a **noun** (role, device, other system, or scheduler).
4. Each use case name is **verb + noun** in consistent language (Indonesian OR English, pick one for the whole diagram).
5. No use case is a UI click, a data entity, a technical primitive, or a manual-only process.
6. **Every actor connects to ≥1 use case. Every use case connects to ≥1 actor.** (ADSI: "tidak ada use case atau actor yang berdiri sendiri.")
7. **No line between two actors.** (If two actors must cooperate, they do it via a shared use case — or one inherits from the other.)
8. `<<include>>` arrow points to the *included* use case (the one that runs first).
9. `<<extend>>` arrow points to the *base* use case (the one that runs first; the extending use case is conditional).
10. Generalization arrows are hollow-triangle and point child → parent. Abstract parents marked `{abstract}`.
11. Diagram has ~7–15 use cases for a skripsi module. More than 20 → split per module.
12. Related use cases grouped visually; minimize line crossings.
13. Diagram title / Navigator label is meaningful (not `UseCaseDiagram1`).

If any check fails, fix it before moving on.

## 7. How to build it in StarUML via staruml-mcp

**Rule:** use the registered `mcp__staruml__*` tools only. Do not bypass with raw HTTP/curl to ports 58321/58322.

### Step 1 — container model + diagram

```
mcp__staruml__create_element type=UMLModel parentId=<project_id> name="Use Case Model"
    → returns modelId
mcp__staruml__create_diagram type=UMLUseCaseDiagram parentId=<modelId> name="Use Case Diagram - <System Name>"
    → returns diagramId
```

The system-boundary rectangle can be added as a `UMLSubsystem` (or left as a visual box) inside the diagram — StarUML renders the subject automatically when a boundary is present. If the advisor is picky about the label, use `UMLPackage` or `UMLSubsystem` named with the system name and place use cases inside it.

### Step 2 — actors

Primary actors column-left (x≈80), secondary column-right (x≈800). Vertical spacing ≥ 180 px between actors.

```
mcp__staruml__create_element_with_view \
    type=UMLActor parentId=<modelId> diagramId=<diagramId> \
    name="<Nama Aktor>" x=80 y=80 x2=140 y2=160
```

Save every returned `view._id` — edges need them.

### Step 3 — use cases

Use cases in 1–2 columns middle. Each ellipse ~180×50 px. Vertical spacing ≥ 90 px.

```
mcp__staruml__create_element_with_view \
    type=UMLUseCase parentId=<modelId> diagramId=<diagramId> \
    name="<Kata kerja + kata benda>" x=320 y=60 x2=500 y2=110
```

For abstract use case: after creation, `mcp__staruml__update_element id=<ucId> properties={isAbstract: true}`.

### Step 4 — associations (actor ↔ use case)

```
mcp__staruml__create_edge_with_view \
    type=UMLAssociation parentId=<modelId> diagramId=<diagramId> \
    tailViewId=<actorViewId> headViewId=<useCaseViewId>
```

### Step 5 — `<<include>>` and `<<extend>>`

```
# include: tail = base, head = included (included runs first)
mcp__staruml__create_edge_with_view \
    type=UMLInclude parentId=<modelId> diagramId=<diagramId> \
    tailViewId=<baseUseCaseViewId> headViewId=<includedUseCaseViewId>

# extend: tail = extending, head = base (base runs first)
mcp__staruml__create_edge_with_view \
    type=UMLExtend parentId=<modelId> diagramId=<diagramId> \
    tailViewId=<extendingUseCaseViewId> headViewId=<baseUseCaseViewId>
```

### Step 6 — generalization (if needed)

```
# actor or use case inheritance: tail = child, head = parent
mcp__staruml__create_edge_with_view \
    type=UMLGeneralization parentId=<modelId> diagramId=<diagramId> \
    tailViewId=<childViewId> headViewId=<parentViewId>
```

### Step 7 — save

```
mcp__staruml__save_project
```

### Coordinate cheat sheet

| Element | Width × Height | Typical X |
|---|---|---|
| Actor (stick) | 60 × 80 | Primary col x=80–140, Secondary col x=800–860 |
| Use case (ellipse) | 180 × 50 | Col 1 x=320–500, Col 2 x=580–760 |
| Vertical spacing between same-column items | — | 90–180 px |

## 8. Worked example — POS Ayam Bakar Banjar Monosuko

System name: `Sistem POS Restoran Ayam Bakar Banjar Monosuko`.

Actors (all human roles, primary):

- `Kasir` — primary
- `Kitchen` — primary
- `Owner` — primary

Use cases (verb+noun, consistent Indonesian):

- `Login`
- `Mencatat Pesanan` (Kasir)
- `Memproses Pembayaran` (Kasir)
- `Membatalkan Transaksi` (Kasir, void — requires Owner PIN)
- `Mencetak Struk`
- `Menginput Opname Stok` (Kitchen, pagi)
- `Mengelola Menu` (Owner)
- `Melihat Laporan Penjualan` (Owner)
- `Mereview Settlement` (Owner)

Relationships:

- `Kasir` ↔ `Login`, `Mencatat Pesanan`, `Memproses Pembayaran`, `Membatalkan Transaksi`.
- `Kitchen` ↔ `Login`, `Menginput Opname Stok`.
- `Owner` ↔ `Login`, `Mengelola Menu`, `Melihat Laporan Penjualan`, `Mereview Settlement`, `Membatalkan Transaksi` (secondary — Owner's PIN elevates void).
- `Memproses Pembayaran` `<<extend>>` `Mencetak Struk`? **No** — printing is the optional one, so reverse: `Mencetak Struk` `<<extend>>` `Memproses Pembayaran` (extending→base, base runs first, printing is conditional on customer wanting a receipt).
- `Mencatat Pesanan` `<<include>>` `Memproses Pembayaran`? **No** — payment is sometimes deferred (table open with pending items). Use separate associations; no include.
- `Membatalkan Transaksi` `<<include>>` `Verifikasi PIN Owner`? **Yes, if** you model `Verifikasi PIN Owner` as a use case — void always requires PIN elevation, so include is appropriate (base always runs the included step).

## 9. Common mistakes to grep for

After building, scan the diagram for these smells:

- **Actor with 5+ use cases that are minor variations of "Melihat X" or "Mencatat Y"** → over-split; consolidate into one `Melihat Dashboard dan Laporan` or `Mengelola X`. See §2 "Atomicity".
- Use case named `Login Button`, `Dashboard`, `Customer`, `Database` → fix the name to verb+noun.
- Actor sitting inside the system boundary → move it out.
- Missing system boundary or unlabeled boundary → add `Sistem <Nama>`.
- An actor with zero associations → either delete the actor or add the missing use case.
- `<<extend>>` arrow pointing away from the base → flip it; arrow must point to the use case that runs first.
- `<<include>>` arrow pointing away from the included → flip it.
- Line drawn directly between two actors → replace with shared use case or generalization.
- Use case for a purely manual process that never touches the system → delete it.
- Mixed Indonesian and English use case names → pick one and rename.

Fix one issue at a time, save, ask the user to review. Do not batch six fixes silently.

## 10. When the user says "jelek" or similar

Walk the §6 checklist literally. Common root causes:

- Diagram built as Mermaid flowchart instead of native `UMLUseCaseDiagram` — regenerate with `create_diagram type=UMLUseCaseDiagram` and populate with typed `UMLActor` / `UMLUseCase` / `UMLAssociation`.
- Wrong granularity (UI clicks as use cases, or one mega "Kasir Do Everything").
- Missing boundary / label.
- Inconsistent language (half Indonesian, half English).
- Arrow directions flipped on include/extend.
- Actors inside boundary, or actor-to-actor line.

Fix the most impactful issue first, save, show the user, iterate.
