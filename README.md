# PocketView

PocketView is a lightweight proxy that injects a floating mobile preview panel into your web app, so developers can view desktop + mobile behavior side-by-side from a single URL.

## Features

- Single-page developer preview (no second browser window required)
- Draggable floating mobile preview panel
- Desktop/mobile sync for route changes, scroll, and click actions
- Device presets from CLI and in-panel selector (`iPhone` + `Android`)
- Works by proxying an existing local app URL

## Requirements

- Node.js 18+
- A target web app running locally (example: `http://localhost:3000`)

## Install

```bash
npm install
```

## Run

```bash
npm run dev -- <target-url> [port] --device "<preset>"
```

Example:

```bash
npm run dev -- http://localhost:3000 5076 --device "Pixel 8 Pro"
```

PocketView will print and open a URL like:

`http://localhost:5076/?pv=1&mw=448&mh=998&device=Pixel+8+Pro`

If the preferred port is already busy, PocketView automatically selects the next available port.

If no target URL is passed, PocketView defaults to `http://localhost:3000` (or `POCKETVIEW_TARGET` if set).

## CLI usage

```text
mlp [target-url] [port] [--device <preset>] [--port <port>]
```

- `target-url`: optional (default: `http://localhost:3000`)
- `port`: optional (default preference: `5050`, auto-falls forward if busy)
- `--port`: optional named form of port argument
- `--device`: optional preset (`iPhone SE`, `iPhone 14`, `iPhone 14 Pro Max`, `Pixel 7`, `Pixel 8 Pro`, `Galaxy S23`, `Galaxy Z Fold 5`)

## Live workflow with ASAD/web

From this repository:

1. Start target app (`ASAD/web`) on `http://localhost:3000`
2. Start PocketView proxy:

```bash
npm run dev -- http://localhost:3000 5076 --device "Pixel 7"
```

3. Open:

`http://localhost:5076/?pv=1&mw=412&mh=915&device=Pixel+7`

## Test

Run end-to-end smoke test against `ASAD/web`:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/test-asad-web.ps1
```

Expected output:

`E2E_PROXY_TEST_OK`

## Notes

- PocketView panel is enabled by default on proxied pages unless explicitly disabled with `pv=0`.
- If a stale process is holding a port (for example `5076`), stop existing `node` processes and restart.
- If the panel does not appear after code changes, do a hard refresh (`Ctrl+F5`).
