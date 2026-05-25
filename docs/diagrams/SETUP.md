# Claude Desktop + StarUML MCP — Setup Guide (REV 2.3)

> **STATUS (2026-05-24):** Reference dokumen — bukan setup aktif. State terkini:
> - **ERD (14 entitas REV 2.2) + 11 Activity Diagram REV 2.2** sudah di-build di `Skripsi.mdj` dan tetap valid untuk REV 2.3 (no visual change).
> - **Use Case Diagram** pending rebuild REV 2.3 untuk update annotation aktor (kasir primary vs waiter fallback).
> - Pada praktiknya diagram dibangun via Claude Code dengan **`staruml-mcp` HTTP transport** (port 58321/58322/58323), bukan Claude Desktop stdio. Dokumen ini disimpan sebagai catatan setup awal historis.
> - Lihat `.claude/skills/{use-case,activity,erd}-diagram/SKILL.md` untuk pattern proven saat build/rebuild diagram.

Dokumen ini menjelaskan cara setup Claude Desktop untuk build diagram UML skripsi via StarUML MCP. Tetap relevan kalau di masa depan perlu rebuild visual atau migrasi alat.

## Kenapa Awalnya Pakai Claude Desktop?

Claude Code (ekstensi VS Code) pernah punya [bug #45844](https://github.com/anthropics/claude-code/issues/45844): stdio-transport MCP servers terhubung (`✓ Connected`) tapi tools-nya tidak terdaftar sebagai deferred tools — tidak bisa dipanggil oleh model. StarUML MCP Server pakai stdio transport, sehingga terkena bug ini.

Claude Desktop (aplikasi chat) **mendukung stdio MCP dengan benar**. Dulu workflow-nya: Claude Code (VS Code) untuk planning + tracking + coding; Claude Desktop hanya untuk fase bikin diagram.

**Update**: workflow saat ini sudah memakai HTTP transport langsung dari Claude Code dengan port 58321/58322/58323, sehingga Claude Desktop tidak lagi diperlukan kecuali kalau setup HTTP transport bermasalah.

## Prerequisite

- ✅ Claude Desktop terinstal & login (akun apa saja: Free/Pro)
- ✅ Node.js v22+ (kami cek: v24.12.0)
- ✅ StarUML v7.0.0+
- ✅ StarUML API Server aktif di port 58321 (`%APPDATA%/StarUML/settings.json` → `"apiServer": true`)

## Step 1 - Set MCP Config di Claude Desktop

### Lokasi file (Windows)

```
C:\Users\ezrak\AppData\Roaming\Claude\claude_desktop_config.json
```

Buka via terminal:
```powershell
notepad $env:APPDATA\Claude\claude_desktop_config.json
```

Atau di File Explorer, paste di address bar:
```
%APPDATA%\Claude
```

### Isi file

Kalau file belum ada, buat baru dengan isi:

```json
{
  "mcpServers": {
    "staruml-mcp-server": {
      "command": "npx",
      "args": ["-y", "staruml-mcp-server"]
    }
  }
}
```

Kalau file sudah ada dan sudah punya MCP server lain, **tambahkan** entry `staruml-mcp-server` di dalam `mcpServers`:

```json
{
  "mcpServers": {
    "mcp-server-lain-yang-sudah-ada": { ... },
    "staruml-mcp-server": {
      "command": "npx",
      "args": ["-y", "staruml-mcp-server"]
    }
  }
}
```

Save file.

## Step 2 - Restart Claude Desktop

Tutup Claude Desktop total (klik kanan icon taskbar → Quit, jangan cuma X). Buka lagi.

## Step 3 - Verify Connection

1. Buka StarUML - pastikan app running, buat project kosong baru (`File → New`)
2. Di Claude Desktop, klik icon **🔌 plug / settings → MCP servers** (lokasi UI-nya bisa beda versi, cari di bawah kiri area input). Harus ada "staruml-mcp-server" dengan status connected.
3. Test dengan prompt di Claude Desktop:
   ```
   What StarUML tools do you have access to?
   ```
   Kalau Claude jawab sebut `generate_diagram`, `get_current_diagram_info`, dst → **setup sukses**.

## Step 4 - Jalankan Prompt Diagram

Prompt untuk tiap diagram diberikan 1-per-1 dari Claude Code (sesi VS Code ini). Workflow:

1. Saya (Claude Code) kasih prompt diagram S.N
2. Anda copy-paste ke Claude Desktop
3. Claude Desktop panggil StarUML MCP → diagram muncul di StarUML
4. Anda review di StarUML, revisi text prompt kalau perlu
5. Save `.mdj` (`File → Save As` — saat ini file diagram skripsi tersimpan di `Skripsi.mdj` di root proyek)
6. Lapor balik ke Claude Code: "S.N done" → saya update memory + kasih prompt S.N+1

## Workflow Aktual Saat Ini (HTTP Transport via Claude Code)

Saat ini diagram dibangun langsung dari Claude Code tanpa perlu Claude Desktop:

1. Pastikan StarUML running dengan API server aktif (port 58321)
2. Set environment variable `STARUML_API_PORT=58321` (atau 58322/58323 untuk dual-port setup)
3. MCP staruml-mcp tools tersedia sebagai deferred tools di Claude Code
4. Saat butuh build/edit diagram, panggil tools via ToolSearch dengan query `select:mcp__staruml__*`
5. Lihat `.claude/skills/{use-case,activity,erd}-diagram/SKILL.md` untuk pattern proven:
   - ERD pakai `generate_diagram` + Mermaid `erDiagram` syntax (bukan `create_element ERDColumn`)
   - Activity Diagram pre-build swimlane (UMLActivityPartition) sebelum nodes
   - Activity Action name = bahasa bisnis Indonesia, no SQL/code

## Troubleshooting

**"staruml-mcp-server" tidak muncul di Claude Desktop**
- Cek JSON valid (pakai [jsonlint.com](https://jsonlint.com))
- Quit total Claude Desktop lalu buka ulang (jangan cuma close window)
- Pastikan Node.js v22+ (`node --version`)

**Claude bilang "cannot connect to StarUML"**
- StarUML harus running
- Pastikan `apiServer: true` di `%APPDATA%/StarUML/settings.json`
- Test manual: `curl http://localhost:58321/` harus balas "Hello from StarUML API Server!"

**Diagram generated tapi kosong / error**
- Prompt terlalu abstrak — tambahkan detail element satu per satu
- Minta Claude "show me the current diagram structure" untuk debug
- Lihat skill MD file untuk pattern: `.claude/skills/{nama}-diagram/SKILL.md`

**ERD compartment kosong setelah `create_element ERDColumn`**
- Bug umum: kolom masuk ke `ownedElements` field, bukan ke `columns` field
- Solusi: pakai `generate_diagram` dengan Mermaid `erDiagram` syntax. Lihat memory `feedback_erd_use_mermaid.md` di `~/.claude/projects/.../memory/`

**Activity diagram lifeline atau control flow tidak nyambung**
- Pre-build UMLActivityPartition (swimlane) DULU sebelum create node
- Update partition.nodes via HTTP direct call (MCP tool stringify bug) — lihat skill §8e
