# AI Engineering Fluency — Local Web Dashboard

A standalone local web application that surfaces the full AI Engineering Fluency dashboards in any modern browser without requiring VS Code or Electron.

## Core Capabilities & Features

### 1. Browser-Native Multi-View Experience
- **Zero Full-Page Flashes:** SPA application shell (`htmlTemplates.ts`) maintains a persistent navigation bar with active tab states and loading progress indicators. Navigation swaps iframe viewports smoothly without rebuilding the DOM shell.
- **Route & Query-Param Synchronization:** URL parameters stay synchronized with current tabs (e.g. `/?view=usage`, `/?tab=chart`, `/session?file=...`). Direct navigation and browser refreshes reload the exact active view.
- **Side-by-side session comparison:** Middle-click or `Ctrl+Click` to open multiple session transcripts in separate browser tabs.

### 2. Rich Session Log Viewer Enhancements
- **Markdown & MDX Rendering:** Session chat turns render formatted Markdown (headings, blockquotes, lists, code blocks with language tags, inline formatting).
- **Interactive View Toggles:** Switch between rendered HTML (`👁️ Rendered`) and raw Markdown (`📝 Raw MD`) on any turn message with a single click.
- **One-Click Code & Raw Copying:** Dedicated copy buttons on every code block and turn message with copy feedback (`✓ Copied!`).
- **Multiline Markdown Tables:** Proper table parsing into HTML `<table>` elements wrapped in horizontal scrolling containers for wide datasets.
- **Hover Stabilization:** Disabled distracting upward bounce (`translateY`) on turn cards for a smooth scrolling experience.

### 3. Glanceable Tool Execution Cards & Telemetry
- **Structured Property Blocks:** Replaced raw JSON argument blocks with vertical glanceable property cards categorized by tool type (commands, directories, search patterns, file edits, and agent invocations).
- **Tool Telemetry Header Ribbon:** Real-time metrics bar on every tool card displaying:
  - Executing model name (e.g. `🎯 Claude Sonnet 5.5`) or sub-agent model (`🤖 model`).
  - Input payload size and estimated token footprint (`📥 Args: 166 B (~42 tok)`).
  - Output payload size, estimated tokens, and line counts (`📤 Result: 1.4 KB (~350 tok · 24 lines)`).
  - Output execution status badge (`✓ Output` or `⚠️ Warning/Error`).
  - Sub-agent delegation metrics (`📊 ↑in · ↓out tokens`, `💰 $cost`).
- **Collapsible Raw JSON:** Original arguments and results remain accessible under collapsible details summaries (`🔍 View Raw JSON`, `📋 Result Output`).

### 4. Multi-Ecosystem Session Discovery & Antigravity Support
- **Multi-Brain Discovery:** Automatically scans `.gemini/antigravity/brain`, `.gemini/antigravity-cli/brain`, and `.gemini/antigravity-ide/brain` for session transcripts, ensuring sessions created in Antigravity CLI and IDE are fully attributed alongside VS Code, Cursor, and Claude Code.
- **Workspace Directory Attribution:** Resolves and displays real local directory paths extracted from transcript `Active Workspaces:` entries and tool call working directories (`Cwd`).
- **RTL Path Truncation:** Session path subtitles use `direction: rtl; text-align: left;` to truncate the root path on the left (e.g. `.../repos/Babylon-5/project`), ensuring the leaf project folder is always visible.
- **Webview Iframe Event Bridges:** Message bridge intercepts `openFormattedJsonlFile` from embedded data tables to smoothly navigate the parent SPA shell to `/session?file=...`.

### 5. High-Performance Caching & Telemetry APIs
- **Shared In-Flight Promises:** Deduplicates simultaneous requests across pages sharing the same underlying session data.
- **Background Dataset Refreshing:** Periodic cache refresh without blocking active web requests.
- **Telemetry Endpoints:** REST APIs for `/api/analyze-model-usage`, `/api/analyze-ttft`, `/api/recent-sessions`, `/api/sessions-list`, `/api/tool-call`, and `/api/refresh`.

## Getting Started

### Prerequisites
- Node.js >= 22.14.0
- pnpm >= 11

### Installation & Build
From the `web/` directory:
```bash
pnpm install
pnpm run build
```
*(If the shared VS Code webview bundles have not been built yet, the build script will automatically compile them from `../vscode-extension` first.)*

### Running the Server
```bash
pnpm start
```
By default, the server runs on `http://localhost:3333`.

### Custom Port or Host
Configure the listening port and host address via command-line arguments:
```bash
node dist/server.js --port 8080 --host 0.0.0.0
```

---

## Available Dashboards & Routes
- `/details` — General token usage, model distribution, and editor breakdown.
- `/usage` — Usage analysis, curation matrix, prompt analysis, and recent sessions.
- `/chart` — Token usage trends by day, week, and month.
- `/maturity` — Fluency score calculation and actionable recommendations.
- `/fluency-level-viewer` — Scoring guide and maturity stage descriptions.
- `/environmental` — Carbon footprint and water usage impact.
- `/diagnostics` — Session file directory health and system diagnostic report.
- `/session?file=<path>` — Interactive conversation transcript and turn-by-turn inspector.
- `/session/raw?file=<path>` — Raw JSON/JSONL transcript viewer.

---

## Automated Verification & Tests
Run type checking and the automated integration test suite:
```bash
pnpm run check-types
pnpm test
```
