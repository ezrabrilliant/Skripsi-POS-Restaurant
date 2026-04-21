---
name: sequence-diagram
description: Build UML Sequence Diagrams in StarUML for Indonesian ADSI (Analisis Design Sistem Informasi) skripsi. Use this skill whenever the user asks to create, rebuild, review, or fix a sequence diagram — or says "diagram interaksi", "urutan pesan", "MVC flow per use case", or describes object-to-object messages over time. Covers ADSI Modul Pembelajaran Bab 10 (Interaction Diagram) conventions — Boundary/Service(Control)/Entity class roles, synchronous vs asynchronous message arrows, numbered messages, return parameters, conditional messages in brackets, and fragments (loop/alt/ref) — plus programmatic construction via staruml-mcp (`create_diagram UMLSequenceDiagram`, `create_element_with_view UMLLifeline`, `create_edge_with_view UMLMessage`). Do not create a sequence diagram without consulting this skill first.
---

# Sequence Diagram — ADSI convention + StarUML MCP

Authoritative source: **Modul Pembelajaran ADSI Bab 10 — Interaction Diagram** (`docs/extracted/adsi.txt` lines 2904–3035). Interaction diagrams in ADSI split into **sequence** + **communication** diagrams — this skill covers sequence.

## 1. What sequence diagram is (per ADSI)

> *"Interaction diagram adalah diagram yang menggambarkan urutan interaksi yang terjadi antar obyek dalam satu atau dua buah use case scenario maupun dalam sebuah fragment dari suatu use scenario."* — ADSI §10

Consequences:

- A sequence diagram is built **per use case scenario** (not per use case). Typically happy-path = one diagram, alternate-path = another. ADSI Gambar 10.5 (booking success) vs Gambar 10.7 (pembatalan booking) are two scenarios of the same use case.
- Input: use case + use case scenario + (optional) activity diagram + domain model (class diagram).
- Output: design model showing how boundary, service, and entity classes collaborate.

## 2. The three stereotyped classes (ADSI §10 — "Analisis Ketahanan")

Every object (lifeline) on a sequence diagram should be one of:

### Boundary class — `<<boundary>>`
> *"Boundary class digunakan untuk menggambarkan interaksi antara sistem dan aktor."* — ADSI §10

- Represents UI forms, external-system interfaces, sensors.
- **Each boundary must associate with at least one actor.**
- Example names: `ReservationUI`, `LoginScreen`, `PaymentForm`, `POSCashierView`.

### Service / Control class — `<<control>>`
> *"Service (atau control) class merepresentasikan koordinasi, urutan, transaksi, dan kontrol."* — ADSI §10

- Orchestrates flow between boundary and entity. Encapsulates per-use-case logic. Isolates UI from data.
- Example names: `ReservationService`, `TransactionController`, `AuthService`.

### Entity class — `<<entity>>`
> *"Entity class digunakan untuk memodelkan data yang harus disimpan (persistent)."* — ADSI §10

- Represents persistent domain data.
- Example names: `Room`, `Reservation`, `Menu`, `Transaction`, `DailyMenuStock`.

**Typical call chain:** `Actor → <<boundary>> → <<control>> → <<entity>>` (and returns back). Actor never calls entity directly; boundary shouldn't call entity directly either.

## 3. Messages (ADSI §10)

> *"Message mempunyai nama mempunyai arah panah (panah solid untuk message synchronous dan panah terbuka untuk message asynchronous). Untuk mempermudah melihat urutan relasinya, message dilengkapi juga dengan penomoran."* — ADSI §10

- **Synchronous message** — filled (solid) arrowhead. Caller waits for return. Most common.
- **Asynchronous message** — open (stick) arrowhead. Fire-and-forget.
- **Return message** — dashed line with open arrowhead. Optional but helpful.
- **Self-message** — loop arrow to same lifeline.
- Messages are numbered (1, 2, 2.1, 2.2, 3) to show order.
- **Conditional message** — wrap the message name in square brackets: `[stok cukup] decrementStock()`.
- Messages can carry **parameters** and **return values**: `findRoom(type, checkIn, checkOut) : List<Room>`.

## 4. Fragments (ADSI §10)

Fragments wrap a region of messages to express control flow:

- `loop` — repeat while condition holds. Label: `loop [while cartHasItems]`.
- `alt` — alternative branches. Label: `alt [stok cukup] / [else]`.
- `opt` — optional block (single branch). Label: `opt [wantsReceipt]`.
- `ref` — reference to another sequence diagram (lets you split a big one). Label: `ref MencariMejaKosong`.
- `par` — parallel (rare at skripsi level).

Use `ref` to split oversized diagrams (ADSI §10 explicitly allows this: *"Dapat memecah diagram yang besar menjadi beberapa diagram kecil."*).

## 5. Checklist — verify before saving

1. The diagram corresponds to **one use case scenario**. Name it: `Sequence Diagram - <Use Case> (<Scenario>)`, e.g. `Sequence Diagram - Login (Success)`.
2. The actor appears as the leftmost lifeline. They only call boundary classes.
3. Every lifeline has a stereotype: `<<boundary>>`, `<<control>>`, or `<<entity>>` (except the actor lifeline).
4. At least one boundary associated to the actor (per ADSI rule).
5. Boundary does not call entity directly — route through a control.
6. Messages are numbered in execution order.
7. Conditional messages wrapped in `[...]` guards, or put inside `alt` / `opt` fragments.
8. Loops use `loop` fragments, not ad-hoc back-arrows.
9. Synchronous vs asynchronous arrowheads used deliberately (most messages are synchronous).
10. Return messages shown for non-void calls (dashed arrow back to caller), OR return value annotated on the outgoing message (`: ReturnType`).
11. Message names are verb phrases (`findAvailableRoom`, `verifyPIN`, `decrementStock`).
12. Every message has exactly one sender and one receiver.

## 6. How to build in StarUML via staruml-mcp

Only use registered `mcp__staruml__*` tools.

### Step 1 — diagram

```
mcp__staruml__create_diagram type=UMLSequenceDiagram parentId=<parent> \
    name="Sequence Diagram - <Use Case> (<Scenario>)"
    → returns diagramId (StarUML creates the owning UMLCollaboration/Interaction as parent of lifelines)
```

### Step 2 — actor lifeline

```
mcp__staruml__create_element_with_view type=UMLActor parentId=<collabId> diagramId=<diagramId> \
    name="Kasir" x=60 y=40 x2=120 y2=120
```
Then convert to lifeline, or directly:

```
mcp__staruml__create_element_with_view type=UMLLifeline parentId=<collabId> diagramId=<diagramId> \
    name=":Kasir" x=60 y=40 x2=120 y2=80
```

### Step 3 — object lifelines (boundary / control / entity)

```
mcp__staruml__create_element_with_view type=UMLLifeline parentId=<collabId> diagramId=<diagramId> \
    name="loginUI : LoginScreen" stereotype="boundary" x=200 y=40 x2=320 y2=80

mcp__staruml__create_element_with_view type=UMLLifeline parentId=<collabId> diagramId=<diagramId> \
    name="authService : AuthService" stereotype="control" x=360 y=40 x2=500 y2=80

mcp__staruml__create_element_with_view type=UMLLifeline parentId=<collabId> diagramId=<diagramId> \
    name="user : User" stereotype="entity" x=540 y=40 x2=640 y2=80
```

If `stereotype=` parameter isn't supported by your version of the MCP extension, set it after creation via `mcp__staruml__update_element id=<lifelineId> properties={stereotype: "boundary"}`.

### Step 4 — messages

```
# synchronous call: Kasir → LoginScreen
mcp__staruml__create_edge_with_view type=UMLMessage parentId=<collabId> diagramId=<diagramId> \
    tailViewId=<kasirLifelineViewId> headViewId=<loginUIViewId> \
    name="1: submitPIN(pin)"

# synchronous call with return: LoginScreen → AuthService
mcp__staruml__create_edge_with_view type=UMLMessage parentId=<collabId> diagramId=<diagramId> \
    tailViewId=<loginUIViewId> headViewId=<authServiceViewId> \
    name="1.1: login(pin) : Token"
```

For asynchronous messages, set `messageSort=asynchCall` via `update_element`. For return messages, use `messageSort=reply` and dashed line (StarUML renders dashed automatically on reply).

### Step 5 — fragments (loop / alt / opt / ref)

Use StarUML's `UMLCombinedFragment` with `interactionOperator`:

```
mcp__staruml__create_element_with_view type=UMLCombinedFragment parentId=<collabId> diagramId=<diagramId> \
    name="alt [PIN valid]" x=180 y=120 x2=660 y2=260
```

Then set `interactionOperator` = `loop` / `alt` / `opt` / `ref` / `par` on the fragment. Operands go inside.

### Step 6 — save

```
mcp__staruml__save_project
```

### Layout cheat sheet

| Element | X span | Notes |
|---|---|---|
| Actor lifeline | x=60, width 60 | Leftmost |
| Boundary lifeline | x=200 | Left of control |
| Control lifeline | x=380 | Middle |
| Entity lifeline(s) | x=560+, 160 apart | Rightmost, one per persistent entity |
| Vertical axis | y from 40 (head) to 600+ (tail) | Time flows downward |
| Message spacing | 30 px vertical between messages | |

## 7. Worked example — POS "Login (Happy Path)"

Lifelines (left to right):

- Actor: `Kasir`
- `:LoginScreen` `<<boundary>>`
- `:AuthService` `<<control>>`
- `user : User` `<<entity>>`

Numbered messages:

1. Kasir → LoginScreen : `submitPIN(pin)` [sync]
2. LoginScreen → AuthService : `login(pin)` [sync]
3. AuthService → User : `findByPin(pin) : User` [sync]
4. User →→ AuthService : return `user` [dashed reply]
5. AuthService → AuthService : `signJWT(user) : token` [self-message]
6. AuthService →→ LoginScreen : return `{user, token}` [dashed reply]
7. LoginScreen → Kasir : display dashboard [sync]

Alt-fragment `alt [user found] / [else]`: if `findByPin` returns null, return error 401; wrap steps 3-7 in the alt.

## 8. Worked example — POS "Pay Transaction"

Lifelines:

- Actor: `Kasir`
- `:PaymentForm` `<<boundary>>`
- `:TransactionController` `<<control>>`
- `transaction : Transaction` `<<entity>>`
- `stock : DailyMenuStock` `<<entity>>`

Messages:

1. Kasir → PaymentForm : `submitPayment(method, amount)`
2. PaymentForm → TransactionController : `pay(transactionId, method, amount)`
3. TransactionController → Transaction : `findById(id) : Transaction`
4. `loop [each item in transaction]`:
   - 4.1 TransactionController → DailyMenuStock : `decrement(menuId, qty)`
5. TransactionController → Transaction : `updateStatus(paid)`
6. TransactionController →→ PaymentForm : return receipt data
7. `opt [customer wants receipt]` → PaymentForm → Kasir : print receipt

## 8b. StarUML sizing pitfalls (MCP-specific — critical)

When building via `staruml-mcp` tools, watch two traps that StarUML's defaults do not save you from:

### Lifeline linePart height
StarUML's `lifelineFn` auto-extends the box (`y2 = y1 + 200` minimum) but does **not** constrain `linePart.height` (the dashed vertical tail below the box). If messages are created without explicit `y`, or if the diagram mutates in certain orders, linePart grows to thousands of px (observed 14,802 / 14,056 / 9,753 px) and is not shrunk back by StarUML. The diagram becomes absurdly tall.

**Fix at build time:**
1. Create every UMLMessage with explicit `y` (40 px spacing — e.g. 130, 170, 210, …).
2. After all messages exist, `update_element` each lifeline's `linePart._id` with `field: "height", value: <lastMessageY - 40>`. The linePart id is in the lifeline view's `linePart._id` attribute (read via `get_element_by_id`).

### Wrong parent → wrong view type
UMLLifeline and UMLMessage **must** be parented to `UMLInteraction`, not `UMLCollaboration` (even though Collaboration is the Interaction's parent). If you use Collaboration, `lifelineFn`'s assert fails and the extension silently falls back to `defaultModelAndViewFn`, which creates a generic `UMLLifelineView` instead of `UMLSeqLifelineView`. Later `UMLMessage` creation will then fail with "Invalid connection (UMLMessage)" because messages require `UMLSeqLifelineView` endpoints.

**Check:** after creating lifelines, the returned `method` should be `"createModelAndView"`. If it says `"defaultModelAndViewFn"`, you have the wrong parent — delete and recreate with the Interaction as `parentId`.

## 9. Common mistakes to grep for

- Actor calls entity directly → insert boundary + control between them.
- Boundary calls entity directly → insert control.
- No numbering on messages → add 1, 2, 2.1, 3...
- Using solid arrowhead for async / open arrowhead for sync → swap.
- Return flows missing → at minimum annotate return type on the outgoing message.
- One giant diagram for a 40-message scenario → split with `ref` fragments.
- Stereotypes missing on lifelines → add `<<boundary>>` / `<<control>>` / `<<entity>>`.
- Messages labeled as UI clicks (`clickSubmit`) → rename to domain verbs (`submitPayment`).
- Sequence for primary + alternate scenario merged into one diagram with no alt fragment → either separate into two diagrams, or wrap the alternate branch in an `alt` fragment.

## 10. When the user says "jelek"

Walk §5 checklist, fix highest-impact issue first:

- Missing stereotypes on lifelines.
- Actor skipping boundary/control (architectural violation).
- No fragments for loop/alt → add them.
- Diagram not typed as `UMLSequenceDiagram` natively → recreate with correct type.

Fix one issue, save, iterate.
