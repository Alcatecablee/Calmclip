# CalmClip

Browser-based video editor. All processing runs locally via WebAssembly — no uploads, no account, no server.

## How to run

```
npm install && npm run dev
```

The dev server runs on port 5000. The workflow "Start application" handles this automatically.

## Tech stack

- React 19 + TypeScript (strict mode)
- Vite 8 + Tailwind CSS v4
- FFmpeg WASM (single-threaded, @ffmpeg/ffmpeg v0.12)
- Whisper WASM (@xenova/transformers, Whisper tiny.en)
- ONNX Runtime Web for face detection
- Gumroad license API for Pro activation

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `VITE_GUMROAD_PRODUCT_ID` | Pro only | Gumroad product permalink ID for license verification |
| `VITE_GUMROAD_URL` | Pro only | Full Gumroad checkout URL shown on the Upgrade button |

Without these, the Pro gate UI still shows but license checks won't link to a real product.

## Project structure

```
src/
  components/     React UI components
  lib/            Pure logic, no JSX (ffmpeg, whisper, loudness, pro gating, etc.)
  workers/        Web Worker entry points
  App.tsx         Root component and global state
  index.css       Design tokens, global resets
extension/        Browser extension source
scripts/          Build and SEO scripts
```

## User preferences
