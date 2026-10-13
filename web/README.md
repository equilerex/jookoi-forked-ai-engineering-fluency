# AI Engineering Fluency — Local Web Dashboard

A lightweight, standalone local web application that surfaces the full AI Engineering Fluency dashboards in any modern browser without requiring VS Code or Electron.

## Features

- **Browser-native experience:** Full text selection, native browser Ctrl+F search, zoom controls, and multi-tab workflows.
- **Deep session drill-down:** Full integration with the rich `logviewer` panel. Click any session in **Usage Analysis** or **Diagnostics** to browse individual conversation turns, model routing, reasoning effort, token breakdowns, and tool calls.
- **Tool call inspection:** View detailed arguments and outputs in an interactive modal with syntax highlighting.
- **Side-by-side session comparison:** Middle-click or `Ctrl+Click` to open multiple session transcripts simultaneously in separate browser tabs.
- **Zero upstream conflicts:** Completely isolated in `/web`, reusing shared parser and metric modules without modifying any existing files.

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

You can configure the listening port and host address via command-line arguments:

```bash
node dist/server.js --port 8080 --host 0.0.0.0
```

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

## Verification

Run the automated integration test suite:

```bash
pnpm test
```
