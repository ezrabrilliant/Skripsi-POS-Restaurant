# Claude Desktop + StarUML MCP — Setup Guide

Dokumen ini menjelaskan cara setup Claude Desktop untuk build diagram UML skripsi via StarUML MCP.

## Kenapa Claude Desktop (bukan Claude Code)?

Claude Code (ekstensi VS Code) saat ini punya [bug #45844](https://github.com/anthropics/claude-code/issues/45844): stdio-transport MCP servers terhubung (`✓ Connected`) tapi tools-nya tidak terdaftar sebagai deferred tools — tidak bisa dipanggil oleh model. StarUML MCP Server pakai stdio transport, sehingga terkena bug ini.

Claude Desktop (aplikasi chat) **mendukung stdio MCP dengan benar**. Workflow-nya: Claude Code (VS Code) untuk planning + tracking + coding; Claude Desktop hanya untuk fase bikin diagram.

## Prerequisite

- ✅ Claude Desktop terinstal & login (akun apa saja: Free/Pro)
- ✅ Node.js v22+ (kami cek: v24.12.0)
- ✅ StarUML v7.0.0+
- ✅ StarUML API Server aktif di port 58321 (`%APPDATA%/StarUML/settings.json` → `"apiServer": true`)

## Step 1 — Set MCP Config di Claude Desktop

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

## Step 2 — Restart Claude Desktop

Tutup Claude Desktop total (klik kanan icon taskbar → Quit, jangan cuma X). Buka lagi.

## Step 3 — Verify Connection

1. Buka StarUML — pastikan app running, buat project kosong baru (`File → New`)
2. Di Claude Desktop, klik icon **🔌 plug / settings → MCP servers** (lokasi UI-nya bisa beda versi, cari di bawah kiri area input). Harus ada "staruml-mcp-server" dengan status connected.
3. Test dengan prompt di Claude Desktop:
   ```
   What StarUML tools do you have access to?
   ```
   Kalau Claude jawab sebut `generate_diagram`, `get_current_diagram_info`, dst → **setup sukses**.

## Step 4 — Jalankan Prompt Diagram

Prompt untuk tiap diagram diberikan 1-per-1 dari Claude Code (sesi VS Code ini). Workflow:

1. Saya (Claude Code) kasih prompt diagram S.N
2. Anda copy-paste ke Claude Desktop
3. Claude Desktop panggil StarUML MCP → diagram muncul di StarUML
4. Anda review di StarUML, revisi text prompt kalau perlu
5. Save `.mdj` (`File → Save As` — semua diagram dalam 1 file, misal `ayam-bakar-monosuko.mdj`)
6. Lapor balik ke Claude Code: "S.N done" → saya update ROADMAP.md + kasih prompt S.N+1

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
