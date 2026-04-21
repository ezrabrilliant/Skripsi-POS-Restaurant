---
name: erd-diagram
description: Build Entity-Relationship Diagrams (ERD) in StarUML for Indonesian ADSI (Analisis Design Sistem Informasi) skripsi. Use this skill whenever the user asks to create, rebuild, review, or fix an ERD — or says "diagram relasi", "skema database", "model data", or lists tables/columns/foreign keys. Covers skripsi-typical conventions (Chen entity-rectangle / relationship-diamond OR crow's-foot style; primary key underlined or marked PK; foreign key marked FK; cardinality 1-1, 1-N, M-N; weak entities; ADSI Bab 8 key-abstraction / domain-model noun analysis as the input). Uses StarUML's native ER modeling types via staruml-mcp (`create_diagram ERDDiagram`, `create_element_with_view ERDEntity/ERDColumn`, `create_edge_with_view ERDRelationship`). Do not create an ERD without consulting this skill first.
---

# ERD — skripsi convention + StarUML MCP

ADSI modul uses **class diagram / domain model** for data modeling (see `class-diagram` skill). Most skripsi advisors still ask for a separate **ERD** as a database-design artifact — this skill covers that.

## 1. Purpose

- ERD models **persistent data** — tables and relationships — at logical level.
- Input: key-abstraction nouns from ADSI §8.1 CRC analysis, same entities already identified for the class diagram.
- Output: entities (tables), attributes (columns), relationships (FKs), cardinalities. Used in skripsi Bab 3 (Perancangan) as the database design.

## 2. Notation choice

Two common styles — pick one and stick with it:

### a. Chen notation (textbook)
- Entity = rectangle
- Relationship = diamond (between entities)
- Attribute = oval connected to entity
- Primary key attribute = underlined
- Cardinality written on lines: `1`, `N`, `M`

### b. Crow's-foot / IE notation (common in skripsi tools, StarUML default)
- Entity = rectangle divided like a class (name on top, columns below)
- Relationship = line between entities with crow's-foot markers on cardinality end
- PK/FK marked as column attributes (`PK`, `FK`)
- Cardinality:
    - `||—` = exactly one
    - `o|—` = zero or one
    - `—<` = many
    - `—o<` = zero or many
    - `—|<` = one or many

**Default for StarUML:** crow's-foot via `ERDDiagram`. Use Chen if the advisor specifically asks.

## 3. Entity karakteristik

- Name = **singular kata benda**, UPPER_CASE or PascalCase (choose one — usually UPPER_CASE matches SQL table style, PascalCase matches Prisma model style).
- Must have **one or more attributes**.
- Must have a **primary key (PK)** — a single column or composite.
- Attributes listed with data type: `id : UUID`, `name : VARCHAR(100)`, `created_at : TIMESTAMP`.

### Weak entity
- An entity whose PK depends on another entity's PK.
- Drawn with double-rectangle in Chen, or marked as "identifying relationship" in crow's foot.
- Example: `TRANSACTION_ITEM` (its identity depends on `TRANSACTION`).

## 4. Relationships

### Types by cardinality
- **1:1** — one-to-one. Rare; often a sign you should merge into one entity.
- **1:N** — one-to-many. Most common. Parent has `id`, child has `parent_id` FK.
- **M:N** — many-to-many. Implement with a **junction (associative) entity** that has FKs to both sides.

### Optional vs mandatory
- Mandatory (min 1): entity MUST participate.
- Optional (min 0): entity MAY participate.
- Reflected in crow's-foot by the inner marker (|=mandatory one, o=optional zero).

## 5. Checklist — verify before saving

1. Every entity has **exactly one PK** (single or composite).
2. Every non-PK attribute that references another entity is marked **FK** with data type matching the referenced PK.
3. Every relationship has cardinality on **both ends** (1, N, 0..1, 1..*, etc.).
4. M:N relationships resolved into a junction entity (no raw many-to-many lines in the final ERD).
5. Entity and column names consistent: pick snake_case OR camelCase OR PascalCase — don't mix.
6. Data types present and realistic (`VARCHAR(n)`, `INT`, `DECIMAL(p,s)`, `TIMESTAMP`, `BOOLEAN`, `UUID`, `ENUM(...)`).
7. Every entity used in the system appears. Cross-check with the class diagram's `<<entity>>` classes.
8. Weak entities identified where applicable.
9. ENUM values documented either on the column or in a side note (e.g. `payment_method ENUM('cash','qris','transfer','debit','credit','ojol')`).
10. No orphan entity — each connects to ≥1 other entity unless it's intentionally standalone (lookup tables OK).
11. Naming in one language (Indonesian or English, consistent with the code and class diagram).

## 6. How to build in StarUML via staruml-mcp

StarUML has native ERD support. Always use `mcp__staruml__*`.

### Step 1 — data model + diagram

```
mcp__staruml__create_element type=ERDDataModel parentId=<projectId> name="Data Model"
    → returns dataModelId

mcp__staruml__create_diagram type=ERDDiagram parentId=<dataModelId> \
    name="ERD - <System>"
    → returns diagramId
```

### Step 2 — entities

```
mcp__staruml__create_element_with_view type=ERDEntity parentId=<dataModelId> diagramId=<diagramId> \
    name="USER" x=80 y=80 x2=260 y2=260
```

### Step 3 — columns

```
mcp__staruml__create_element type=ERDColumn parentId=<entityId> \
    name="id" column={type: "UUID", primaryKey: true, nullable: false}

mcp__staruml__create_element type=ERDColumn parentId=<entityId> \
    name="name" column={type: "VARCHAR(100)", nullable: false}

mcp__staruml__create_element type=ERDColumn parentId=<entityId> \
    name="pin" column={type: "VARCHAR(6)", nullable: false, unique: true}

mcp__staruml__create_element type=ERDColumn parentId=<entityId> \
    name="role" column={type: "ENUM('owner','cashier','kitchen')", nullable: false}
```

For FK: set `column={type: "UUID", foreignKey: true, referenceTo: "<otherTable.id>"}` (exact shape depends on staruml-mcp extension support — fall back to just typing `_fk` suffix and adding a column-level note if not supported).

### Step 4 — relationships

```
mcp__staruml__create_edge_with_view type=ERDRelationship parentId=<dataModelId> diagramId=<diagramId> \
    tailViewId=<parentEntityView> headViewId=<childEntityView> \
    name="has" \
    tail={cardinality: "1"} head={cardinality: "0..*"}
```

For M:N: create a junction entity between them, then two 1:N relationships.

### Step 5 — save

```
mcp__staruml__save_project
```

### Layout

- Entities ~180 × 200 px.
- Group related entities (e.g. transaction cluster vs user cluster) spatially.
- Parent entities on top/left, child entities below/right (consistent data flow).
- Avoid edge crossings — move entities to minimize.

## 7. Worked example — POS schema

Entities (snake_case to match Prisma/PostgreSQL target):

- `users (id PK, name, pin, role, created_at, updated_at)`
- `menus (id PK, name, category, price, is_active, created_at, updated_at)`
- `daily_menu_stocks (id PK, date, menu_id FK→menus, opening_stock, current_stock, updated_at)` — UNIQUE(date, menu_id)
- `transactions (id PK, table_number, cashier_id FK→users, status, payment_method, subtotal, discount_amount, total, created_at, paid_at)`
- `transaction_items (id PK, transaction_id FK→transactions, menu_id FK→menus, qty, unit_price, subtotal, is_force_order)`
- `settlements (id PK, date UNIQUE, cashier_id FK→users, reviewer_id FK→users nullable, system_cash, system_qris, system_transfer, system_debit_credit, system_ojol, actual_cash, actual_qris, actual_transfer, actual_debit_credit, actual_ojol, variance_*, status, submitted_at, reviewed_at)`
- *(Phase 13, deferred)* `expenses (id PK, date, description, amount, category ENUM, paid_by FK→users, notes)`

Relationships:

- `users 1 — 0..* transactions` (cashier).
- `users 1 — 0..* settlements` (cashier).
- `users 1 — 0..* settlements` (reviewer, optional).
- `menus 1 — 0..* daily_menu_stocks`.
- `menus 1 — 0..* transaction_items`.
- `transactions 1 —|< transaction_items` (composition; items belong strictly to a transaction — weak entity relationship).

ENUMs to document:
- `users.role`: owner | cashier | kitchen
- `transactions.status`: open | paid | void
- `transactions.payment_method`: cash | qris | transfer | debit | credit | ojol
- `settlements.status`: pending | submitted | reviewed
- `expenses.category`: ingredients | utilities | salary | transport | other

## 8. Common mistakes to grep for

- Entity without PK → add one.
- PK not underlined (Chen) or not marked PK (crow's-foot) → mark.
- Raw M:N relationship on the diagram → replace with junction entity.
- FK column missing the FK marker or referenced table → annotate.
- Cardinality missing on one or both ends → add.
- Mixed naming styles (users + MenuItem + transaction_items all in same ERD) → unify.
- Data types missing or using vague types (`String` without length, `Number` without precision) → specify.
- Orphan entity with no relationships → check if really needed.
- Forgetting `created_at` / `updated_at` timestamps on entities that need audit.

## 9. When the user says "jelek"

Walk §5. Highest-impact fixes:

- Missing PK/FK markers → annotate first.
- Cardinalities missing → add.
- M:N not resolved → add junction entity.
- Inconsistent naming → rename.
- Diagram not typed as `ERDDiagram` natively (e.g. drew a class diagram by mistake) → recreate with `ERDDataModel` + `ERDDiagram`.

Fix one issue, save, iterate.
