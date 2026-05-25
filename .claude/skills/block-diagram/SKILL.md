---
name: block-diagram
description: Build Block / Deployment / System Overview diagrams in StarUML for Indonesian skripsi - the big-picture "Blok Diagram Sistem" that Bab 1 or Bab 3 typically requires. Use this skill whenever the user asks for "blok diagram", "deployment diagram", "arsitektur sistem", "topology", "gambaran umum sistem", or shows device↔server↔database layouts. Covers UML Deployment Diagram (nodes, devices, execution environments, artifacts, communication paths) as the technically correct UML choice for a "blok diagram sistem". Uses staruml-mcp (`create_diagram UMLDeploymentDiagram`, `create_element_with_view UMLNode/UMLDevice/UMLExecutionEnvironment/UMLArtifact/UMLComponent`, `create_edge_with_view UMLCommunicationPath/UMLDeployment/UMLDependency`). Do not create a block/deployment diagram without consulting this skill first.
---

# Block / Deployment Diagram - skripsi convention + StarUML MCP

"Blok diagram sistem" in Indonesian skripsi is typically a high-level view showing **where code runs and how it talks** - phones, browsers, servers, databases, external services. The UML diagram that matches this exactly is a **Deployment Diagram**.

## 1. Purpose

- Show physical/runtime topology: nodes (hardware or execution environments), artifacts (deployed software), and communication paths (protocols).
- Answers: *"What runs where, and how do they talk to each other?"*
- Typically sits in Bab 1 (gambaran umum) or early Bab 3 (perancangan arsitektur).

## 2. Core elements

### Node
- Represents a computational resource. Two flavors:
    - `UMLDevice` - physical hardware (phone, laptop, server box, router).
    - `UMLExecutionEnvironment` - software container that hosts artifacts (Node.js runtime, Docker container, JVM, browser).
- Execution environments often nested inside devices.
- Drawn as a 3D box (cube/rectangular prism).

### Artifact
- A deployable software file or package. E.g. `pos-frontend.js` bundle, `server.ts`, `schema.prisma`.
- Drawn as a rectangle with `<<artifact>>` stereotype or document icon.

### Component (optional)
- A modular piece of software (e.g. `AuthService`, `TransactionController`). Use sparingly; mostly for design-level detail.

### Communication Path
- Line between two nodes showing they can communicate.
- Label with protocol: `<<HTTP/JSON>>`, `<<HTTPS>>`, `<<TCP/IP>>`, `<<WebSocket>>`, `<<WiFi>>`, `<<USB>>`, `<<SQL>>`.

### Deployment (relationship)
- Dashed arrow from artifact to node meaning "artifact deployed on node".
- Or put the artifact visually inside the node.

## 3. Checklist

1. Every node labeled with a meaningful name AND role (e.g. `Laptop Owner : Device`, `HP Kasir : Device`, `Server Restoran : Device`).
2. Device nodes contain execution environments where applicable (e.g. HP → Browser, Server → Node.js runtime).
3. Each artifact lives inside (or points to via deployment dependency) exactly one node.
4. Every communication path labeled with a protocol stereotype.
5. External services (e.g. printer, payment gateway, QRIS provider) drawn as separate nodes on the edge of the diagram.
6. Directions of data flow clear - use arrows if one-way, plain line if bidirectional.
7. Scope matches the audience: Bab 1 = simple 4-6 nodes; Bab 3 detail diagram can show 10+.
8. No implementation details that belong in class/sequence diagrams (no method names on nodes).
9. Consistent language (Indonesian or English).

## 4. How to build in StarUML via staruml-mcp

Always use `mcp__staruml__*`.

### Step 1 - diagram

```
mcp__staruml__create_diagram type=UMLDeploymentDiagram parentId=<parent> \
    name="Blok Diagram Sistem - <System>"
```

### Step 2 - device nodes

```
mcp__staruml__create_element_with_view type=UMLDevice parentId=<parent> diagramId=<diagramId> \
    name="HP Kasir" stereotype="device" x=80 y=80 x2=280 y2=260
```

### Step 3 - execution environments (nested inside devices)

```
mcp__staruml__create_element_with_view type=UMLExecutionEnvironment parentId=<parent> diagramId=<diagramId> \
    name="Chrome (PWA)" x=100 y=130 x2=260 y2=200
```

### Step 4 - artifacts

```
mcp__staruml__create_element_with_view type=UMLArtifact parentId=<parent> diagramId=<diagramId> \
    name="pos-frontend (React + Vite PWA)" x=110 y=150 x2=250 y2=190

mcp__staruml__create_element_with_view type=UMLArtifact parentId=<parent> diagramId=<diagramId> \
    name="server.ts (Express + Prisma)" x=410 y=150 x2=590 y2=190
```

### Step 5 - communication paths

```
mcp__staruml__create_edge_with_view type=UMLCommunicationPath parentId=<parent> diagramId=<diagramId> \
    tailViewId=<deviceAView> headViewId=<deviceBView> \
    name="<<HTTPS/REST JSON>>"
```

### Step 6 - deployment dependencies (artifact → node)

```
mcp__staruml__create_edge_with_view type=UMLDeployment parentId=<parent> diagramId=<diagramId> \
    tailViewId=<artifactView> headViewId=<nodeView>
```

### Step 7 - save

```
mcp__staruml__save_project
```

### Layout

- Devices ~200 × 180 px.
- Lay out left-to-right following user flow: client devices → server → database → external.
- Keep protocol labels readable (don't let them overlap communication lines).

## 5. Worked example - POS Ayam Bakar Banjar Monosuko

Nodes (left to right):

1. **HP Kasir (Device)** - `Chrome/PWA` execution env hosting `pos-frontend` artifact.
2. **HP Kitchen (Device)** - `Chrome/PWA` hosting `pos-frontend` artifact (same bundle, different role logged-in).
3. **Laptop Owner (Device)** - `Chrome` hosting `pos-frontend`.
4. **Router WiFi Restoran (Device)** - connects clients to server.
5. **Server Restoran (Device)** - `Node.js 20 (Docker)` execution env hosting `server.ts (Express + Prisma)` artifact.
6. **MySQL 8 (Device or ExecutionEnvironment)** - hosting `pos_db` schema artifact.
7. **Printer Struk (Device, optional)** - connects via USB/Bluetooth to HP Kasir.

Communication paths:

- HP Kasir ↔ Router : `<<WiFi>>`
- HP Kitchen ↔ Router : `<<WiFi>>`
- Laptop Owner ↔ Router : `<<WiFi>>`
- Router ↔ Server : `<<Ethernet/LAN>>`
- pos-frontend → server.ts : `<<HTTPS / REST JSON + JWT>>`
- server.ts ↔ MySQL : `<<TCP/IP SQL>>`
- HP Kasir ↔ Printer : `<<USB>>` or `<<Bluetooth>>`

Artifacts deployed:

- `pos-frontend (React + Vite PWA)` deployed on browsers of HP Kasir, HP Kitchen, Laptop Owner.
- `server.ts (Express + Prisma)` deployed on Server Restoran.
- `pos_db (MySQL schema)` deployed on MySQL node.

## 6. Common mistakes to grep for

- Drawing a flowchart instead of a deployment diagram (rectangles with arrows but no node/artifact semantics).
- Missing protocol labels on communication paths.
- Confusing "device" with "software" - put the Node.js runtime inside the server device, not as a peer.
- Showing class-level detail (method names, attribute lists) - that belongs in class diagram.
- External services (payment gateway, QRIS) missing when the system depends on them.
- One giant node labeled "Sistem" with everything inside - split into actual devices and artifacts.
- Inconsistent language (node names half Indonesian, half English).

## 7. When the user says "jelek"

Walk §3. Highest-impact fixes:

- Missing protocol stereotypes → add on every communication path.
- Software labeled as a device → move it to an ExecutionEnvironment inside a device.
- No artifacts → add at least the deployed apps (frontend, backend, DB).
- Diagram not typed `UMLDeploymentDiagram` → recreate with correct type.

Fix one issue, save, iterate.
