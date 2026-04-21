---
name: flowchart
description: Build classical Flowcharts in StarUML for Indonesian skripsi — algorithmic decision-tree diagrams that Bab 3 often requires alongside UML activity diagrams. Use this skill whenever the user asks for "flowchart", "diagram alir", "bagan alir", or wants to show a decision algorithm (force-order logic, validation pipeline, payment routing) step-by-step. Distinct from activity diagram (ADSI Bab 7 — UML, swimlanes, fork/join) — flowchart is classical ANSI/ISO 5807 notation with terminator ovals, process rectangles, decision diamonds with Yes/No branches, data parallelograms, no swimlanes. Uses StarUML flowchart shapes via staruml-mcp (`create_diagram UMLActivityDiagram` as the carrier, `create_element_with_view` with flowchart primitive types). Do not create a flowchart without consulting this skill first.
---

# Flowchart — skripsi convention + StarUML MCP

Flowchart and activity diagram are **different artifacts**. Dosen sometimes ask for both:

| Aspect | Flowchart | Activity Diagram (UML) |
|---|---|---|
| Standard | ANSI/ISO 5807 | UML 2.x |
| Focus | Algorithm / decision logic | Business workflow |
| Actor separation | No (no swimlanes) | Yes (swimlanes/partitions) |
| Parallelism | Not well-supported | Fork/Join |
| Decision branches | Yes/No (binary) | Multiple guards [cond] |
| Used for | Showing algorithm step-by-step | Showing multi-actor business process |

See `activity-diagram` skill for the UML variant. This skill is for the classical one.

## 1. Symbols (ANSI/ISO 5807)

| Symbol | Nama | Use |
|---|---|---|
| Rounded rectangle / oval ("terminator") | **Terminator / Start-Stop** | Mark `Start` or `End`. Exactly one start, one or more stops. |
| Rectangle | **Process / Proses** | An action or step. Imperative verb phrase. |
| Diamond | **Decision / Keputusan** | Binary branch. Question inside; two outgoing edges labeled `Yes`/`No` (or `Ya`/`Tidak`). |
| Parallelogram | **Input / Output / Data** | User input, display output, read/write data. |
| Rectangle with double vertical sides | **Predefined Process / Subroutine** | Call to a named subroutine defined elsewhere. |
| Cylinder | **Database / Stored Data** | Persistent data source. |
| Small circle | **On-page Connector** | Jump point labeled with a letter/number. |
| Home-plate pentagon | **Off-page Connector** | Jump to another page. |
| Arrow | **Flow line** | Directional. Top→bottom, left→right by default. |

## 2. Structural rules

1. **One `Start` terminator only.** Flow begins there.
2. **At least one `End` terminator.** Every flow path must terminate.
3. **No dangling lines.** Every arrow has a source and a target.
4. **Decisions have exactly two outgoing arrows**, labeled `Yes`/`No` (or `Ya`/`Tidak`). Both labels must be present.
5. Loops allowed but must terminate (no infinite loops on a skripsi diagram).
6. Process boxes have one incoming and one outgoing arrow (split/merge via decisions or connectors).
7. Flow direction: top-to-bottom, left-to-right. Reverse arrows only for back-edges in loops.
8. Avoid line crossings; use on-page connectors to jump instead.

## 3. Checklist

1. Exactly one Start. At least one End.
2. Every decision has Yes/No labels on both branches.
3. Process boxes named with **verb phrase**, not UI clicks or nouns.
4. Data I/O uses parallelograms, not rectangles.
5. Database access uses cylinder, not rectangle.
6. No unlabeled arrows on decisions.
7. Flow reads top-down unless loop back.
8. Connectors used when a branch needs to rejoin distant flow (avoids spaghetti lines).
9. Consistent language.
10. Title matches what the flowchart computes, e.g. `Flowchart - Force Order Logic`.

## 4. How to build in StarUML via staruml-mcp

StarUML doesn't have a dedicated Flowchart diagram type, but its extension library provides flowchart shapes. The practical approach: use `UMLActivityDiagram` as the **carrier** diagram type and populate it with flowchart-shape types from the Flowchart extension if available, OR fall back to plain rectangles/diamonds/ovals styled to match flowchart notation.

### Step 1 — diagram

```
mcp__staruml__create_diagram type=UMLActivityDiagram parentId=<parent> \
    name="Flowchart - <Algorithm>"
```

(If the StarUML Flowchart extension is installed, prefer `type=FCFlowchartDiagram` when available.)

### Step 2 — nodes

Use these types (flowchart extension preferred, fall back to UML activity types):

| Role | Preferred type | Fallback |
|---|---|---|
| Terminator | `FCTerminator` | `UMLInitialNode` / `UMLActivityFinalNode` |
| Process | `FCProcess` | `UMLAction` |
| Decision | `FCDecision` | `UMLDecisionNode` (with guard labels Yes/No) |
| Data (I/O) | `FCData` | `UMLAction` with stereotype `<<data>>` |
| Predefined process | `FCPredefinedProcess` | `UMLCallBehaviorAction` |
| Database | `FCDatabase` | `UMLAction` with stereotype `<<database>>` |
| Connector | `FCOnPageConnector` | Custom circle shape |

```
mcp__staruml__create_element_with_view type=UMLInitialNode parentId=<parent> diagramId=<diagramId> \
    x=200 y=40 x2=220 y2=60   # Start

mcp__staruml__create_element_with_view type=UMLAction parentId=<parent> diagramId=<diagramId> \
    name="Input: menuId, qty yang diminta" x=120 y=100 x2=320 y2=150

mcp__staruml__create_element_with_view type=UMLDecisionNode parentId=<parent> diagramId=<diagramId> \
    x=200 y=200 x2=240 y2=240

mcp__staruml__create_element_with_view type=UMLActivityFinalNode parentId=<parent> diagramId=<diagramId> \
    x=200 y=700 x2=220 y2=720   # End
```

### Step 3 — edges

```
mcp__staruml__create_edge_with_view type=UMLControlFlow parentId=<parent> diagramId=<diagramId> \
    tailViewId=<fromView> headViewId=<toView>
```

For decision branches, set edge `name = "Yes"` or `"No"` via `update_element`.

### Step 4 — save

```
mcp__staruml__save_project
```

### Layout

- ~100 px vertical spacing between shapes.
- Decisions at the center of the column; `Yes` branch typically goes straight down, `No` branch goes right then rejoins.
- Keep flow top-to-bottom.

## 5. Worked example — POS Force Order Logic (S.8)

Pseudocode the flowchart implements:

```
1. User picks menu + qty
2. Fetch current_stock for today
3. If qty <= current_stock:
     decrement stock; add item (normal)
4. Else:
     show ForceOrderModal
     ask Owner PIN
     If PIN valid:
       add item with is_force_order=true, DO NOT decrement below 0
     Else:
       cancel the add
```

Flowchart nodes:

1. **Start** (terminator)
2. **Process**: "Kasir pilih menu X dengan qty Q"
3. **Data (I/O)** parallelogram: "Query daily_menu_stocks WHERE menu_id=X AND date=today"
4. **Decision**: "qty <= current_stock?"
   - **Yes** → **Process**: "decrement current_stock by qty" → **Process**: "insert TransactionItem (is_force_order=false)" → go to `A`
   - **No** → **Process**: "Tampilkan ForceOrderModal" → **Data (I/O)**: "Input PIN Owner" → **Decision**: "PIN valid?"
     - **Yes** → **Process**: "insert TransactionItem (is_force_order=true); stock tidak berubah di bawah 0" → `A`
     - **No** → **Process**: "Batalkan penambahan item" → `A`
5. **Connector A** (on-page) → **End** terminator

## 6. Common mistakes to grep for

- Drawing a flowchart when the advisor wants an activity diagram (has swimlanes, fork/join) — use `activity-diagram` skill instead.
- Decision branches missing Yes/No labels.
- Using a rectangle for database access — use cylinder.
- Using a rectangle for input/output — use parallelogram.
- Multiple start terminators.
- Arrows without direction arrowhead.
- Process boxes named as nouns (`Stok`) — rename to verb phrase (`Cek stok harian`).
- Loops without a decision to exit — you'll get an infinite loop on paper.
- Crossing lines everywhere — use on-page connectors to jump.

## 7. When the user says "jelek"

Walk §3. Highest-impact fixes:

- Shapes wrong (rectangle for database, parallelogram for process) → swap.
- Missing Yes/No on decisions → add.
- Two start terminators → pick one.
- Diagram has swimlanes (that's activity diagram territory) → either remove swimlanes or switch to activity-diagram skill.

Fix one issue, save, iterate.
