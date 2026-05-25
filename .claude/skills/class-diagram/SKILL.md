---
name: class-diagram
description: Build UML Class Diagrams in StarUML for Indonesian ADSI (Analisis Design Sistem Informasi) skripsi. Use this skill whenever the user asks to create, rebuild, review, or fix a class diagram - or says "domain model", "diagram kelas", "struktur class", or lists nouns/attributes/methods needing class modeling. Covers ADSI Modul Pembelajaran Bab 8 conventions (key abstraction via CRC noun analysis, class as segi empat 3-compartment: nama/atribut/operasi, visibility +/#/-, stereotypes boundary/entity/control, relations association/aggregation/generalization/dependency/inheritance with multiplicity notations, abstract classes with italic names, package grouping) and programmatic construction via staruml-mcp (`create_diagram UMLClassDiagram`, `create_element_with_view UMLClass/UMLInterface/UMLPackage`, `create_edge_with_view UMLAssociation/UMLAggregation/UMLComposition/UMLGeneralization/UMLDependency`). Do not create a class diagram without consulting this skill first.
---

# Class Diagram - ADSI convention + StarUML MCP

Authoritative source: **Modul Pembelajaran ADSI Bab 8 - Class Diagram** (`docs/extracted/adsi.txt` lines 2148–2900). Class diagrams are the most commonly used UML diagram in object-oriented modeling (ADSI §8).

## 1. Purpose (per ADSI)

> *"Class diagram menggambarkan struktur dan deskripsi class, package dan objek beserta hubungan satu sama lain seperti containment, pewarisan, asosiasi, dan lain-lain."* - ADSI §8

- Static view of the system. Shows relationships that exist, not what happens when they interact.
- Two roles: during **analysis** it shows responsibilities; during **design** it shows the architectural structure.

## 2. Finding classes - Key Abstraction via CRC (ADSI §8.1)

Before drawing: identify candidate classes.

1. List **all kata benda** from use case forms, use case scenarios, glossary, supplementary specs.
2. For each noun, evaluate via CRC (Class-Responsibility-Collaborator). A noun becomes a class only if it has **responsibilities AND collaborators**.
3. Eliminate nouns that are actually attributes (e.g. `dept_name` → attribute of Department) or redundant with another class (e.g. `dept_manager` → same as Employee).
4. The survivors are your **key abstractions** (ADSI Tabel 8.1 example).

## 3. Class structure (ADSI §8.2 Notasi dan Struktur)

Drawn as a rectangle divided into three compartments (top to bottom):

1. **Nama class** (and optional stereotype) - kata benda tunggal, CamelCase first letter capital. E.g. `Customer`, `FraudAgent`, `DailyMenuStock`.
2. **Atribut** - properties. camelCase (first word lowercase), e.g. `birthDate`, `totalAmount`.
3. **Method / Operasi** - what the class can do. camelCase verbs, e.g. `calculateTotal()`, `validatePIN()`.

### Visibility (ADSI §8.1.5)

- `+` **Public** - callable from anywhere.
- `#` **Protected** - only the class + its subclasses.
- `-` **Private** - only inside the class.

### Rendering shortcuts (ADSI §8.1.6)
- You don't have to show every attribute/method. Show the ones that matter.
- Use `...` at end of the list to indicate "more not shown".
- Empty compartments are fine.

### Abstract class (ADSI §8.2.5)
- Parent-only class with no instances.
- Name written in *italic*.
- Marked `{abstract}` in some notations.

## 4. Stereotypes (ADSI §8.1.7 - Class Stereotype)

Three main stereotypes for analysis-level class diagrams:

| Stereotype | Purpose | Identification |
|---|---|---|
| `<<boundary>>` | Interaction between actor and system (forms, reports, hardware interfaces) | At least one per actor-use-case relation (from use case diagram) |
| `<<entity>>` | Persistent data (will be stored) | From nouns in flow of events, or from database tables |
| `<<control>>` | Coordinates other classes, runs business rules, handles alternate flows | One per use case, often called "manager class" |

For design-level / implementation class diagrams, stereotypes can be omitted or replaced (e.g. `<<service>>`, `<<repository>>`, `<<DTO>>`).

## 5. Relationships (ADSI §8.2)

### Association (asosiasi)
- Plain line. Structural relationship: one object is linked to another.
- **Not** a data flow.
- Can have role names on each end and multiplicity.

### Aggregation (agregasi)
- "has-a", loose containment. Parent knows parts, but parts can exist independently.
- **Open diamond** on the whole (parent) side.
- Example (ADSI Gambar 8.10): `Company ◇- Department`.

### Composition (strong aggregation - UML standard, not explicitly in ADSI but widely used)
- "contains-a", parts die with the whole.
- **Filled diamond** on the whole side.

### Generalization / Inheritance (pewarisan)
- "is-a" / "kind-of" hierarchy. Subclass inherits attributes + operations from superclass.
- **Hollow triangle** pointing to the superclass (parent).
- Not named, no multiplicity.
- Example (ADSI Gambar 8.12): `Person △- Student`, `Person △- Professor`.

### Dependency
- Dashed arrow. "A uses B temporarily" (e.g. as method parameter).
- Change in B forces change in A, but not vice versa.

### Multiplicity (ADSI §8.2.2)

Shown at each end of association/aggregation lines (ADSI Tabel 8.2):

| Notation | Meaning |
|---|---|
| `1` | exactly one |
| `0..1` | zero or one (optional) |
| `*` or `0..*` | zero or more |
| `1..*` | one or more |
| `m..n` | between m and n |

## 6. Package diagram (ADSI §8.3)

- Group related classes into **packages** (folder-tab rectangle).
- Helps manage complexity in large models.

## 7. Checklist - verify before saving

1. Every class name is a **singular kata benda**, PascalCase.
2. Attributes camelCase; types shown as `name : Type` when helpful.
3. Operations as `+operationName(param: Type) : ReturnType` with visibility.
4. For analysis diagrams: stereotypes `<<boundary>>`, `<<control>>`, `<<entity>>` where applicable.
5. **At least one boundary per actor ↔ use case** pair (cross-check with your use case diagram).
6. Every association has multiplicity on both ends.
7. Aggregation uses open diamond on whole side; composition uses filled diamond; generalization uses hollow triangle pointing to parent.
8. Abstract classes have italic names (or `{abstract}`).
9. Inheritance arrows unnamed, no multiplicity.
10. No class stands alone unless it's a utility/enum - every class should participate in ≥1 relationship.
11. Ellipsis `...` used when hiding attributes/methods intentionally.
12. Packages used to group >10 classes.

## 8. How to build in StarUML via staruml-mcp

Always use `mcp__staruml__*` tools.

### Step 1 - diagram

```
mcp__staruml__create_diagram type=UMLClassDiagram parentId=<parent> \
    name="Class Diagram - <Subsystem/Module>"
```

### Step 2 - classes

```
mcp__staruml__create_element_with_view type=UMLClass parentId=<parent> diagramId=<diagramId> \
    name="Transaction" x=120 y=80 x2=300 y2=240
```

Add attributes/methods via update or child creation:

```
mcp__staruml__create_element type=UMLAttribute parentId=<classId> \
    name="totalAmount" attribute={type: "Decimal", visibility: "public"}

mcp__staruml__create_element type=UMLOperation parentId=<classId> \
    name="pay" operation={visibility: "public", parameters: [{name: "method", type: "PaymentMethod"}], returnType: "Receipt"}
```

For stereotype: `mcp__staruml__update_element id=<classId> properties={stereotype: "entity"}` (or set name with angle brackets if the extension supports).

Abstract class: `update_element properties={isAbstract: true}` - StarUML renders name in italic.

### Step 3 - relationships

```
# Association with multiplicity
mcp__staruml__create_edge_with_view type=UMLAssociation parentId=<parent> diagramId=<diagramId> \
    tailViewId=<classAView> headViewId=<classBView> \
    tail={multiplicity: "1", role: "owner"} head={multiplicity: "0..*", role: "transactions"}

# Aggregation (open diamond on whole = tail)
mcp__staruml__create_edge_with_view type=UMLAggregation parentId=<parent> diagramId=<diagramId> \
    tailViewId=<wholeClassView> headViewId=<partClassView>

# Composition (filled diamond on whole = tail)
mcp__staruml__create_edge_with_view type=UMLComposition parentId=<parent> diagramId=<diagramId> \
    tailViewId=<wholeClassView> headViewId=<partClassView>

# Generalization (arrow from child to parent)
mcp__staruml__create_edge_with_view type=UMLGeneralization parentId=<parent> diagramId=<diagramId> \
    tailViewId=<childClassView> headViewId=<parentClassView>

# Dependency (dashed arrow A → B means A uses B)
mcp__staruml__create_edge_with_view type=UMLDependency parentId=<parent> diagramId=<diagramId> \
    tailViewId=<classAView> headViewId=<classBView>
```

### Step 4 - save

```
mcp__staruml__save_project
```

### Layout

- Classes ~180 × 160 px. Vertical compartments auto-sized by StarUML.
- 40+ px between classes. Group related classes spatially.
- Inheritance stacks arranged top-down (parent on top).
- Aggregation/composition: whole on left or top.

## 9. Worked example - POS domain

Key abstractions (after CRC analysis on use cases):

- `User` `<<entity>>` - id, name, pin, role, ...
- `Menu` `<<entity>>` - id, name, category, price, ...
- `DailyMenuStock` `<<entity>>` - date, menuId, openingStock, currentStock, ...
- `Transaction` `<<entity>>` - id, tableNumber, status, paymentMethod, total, ...
- `TransactionItem` `<<entity>>` - transactionId, menuId, qty, subtotal, isForceOrder, ...
- `Settlement` `<<entity>>` - date, systemCash, systemQris, actualCash, ..., status
- `AuthService` `<<control>>`, `TransactionService` `<<control>>`, `SettlementService` `<<control>>`
- `LoginScreen`, `POSView`, `SettlementForm` `<<boundary>>`

Relationships:

- `Menu 1 - * DailyMenuStock` (association).
- `Transaction 1 ◇- * TransactionItem` (aggregation; items belong to a transaction).
- `TransactionItem *-1 Menu` (association).
- `User 1 - * Transaction` (cashier who created it).
- `User 1 - * Settlement`.
- `Transaction △- AbstractTransaction`? (not needed - no subclasses, skip).

## 10. Common mistakes to grep for

- Using plural class names (`Customers` instead of `Customer`).
- Class name in camelCase instead of PascalCase.
- Missing multiplicity on associations.
- Aggregation diamond on wrong end (should be on the whole, not the part).
- Generalization arrow pointing wrong direction (should point to parent).
- Using generalization where aggregation is meant (inheritance vs composition confusion).
- Every actor and use case scenario needs at least one boundary - if missing, add it.
- Mixing analysis stereotypes on the same diagram as implementation details (separate them into two diagrams or one with clear packages).
- Classes with zero attributes AND zero operations - usually a naming mistake, not a real class.
- Attributes that should have been classes (e.g. `address` with many sub-fields → extract to `Address` class).

## 11. When the user says "jelek"

Walk §7. Highest-impact fixes:

- Missing multiplicities → add on every association.
- Wrong relationship type (association vs aggregation vs composition vs generalization) → replace.
- Missing stereotypes on analysis-level diagrams → add.
- Too many classes on one page (>15–20) → split into package diagrams.
- Attributes and methods missing visibility `+/#/-` → add.

Fix one issue, save, iterate.
