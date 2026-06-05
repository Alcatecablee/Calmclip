# CalmClip

Browser-based video editor. All processing runs locally via WebAssembly. No uploads, no account, no server.

## Tech stack

- React 19 + TypeScript (strict mode)
- Vite 8 with Tailwind CSS v4
- FFmpeg WASM (single-threaded core, @ffmpeg/ffmpeg v0.12)
- Whisper WASM (@xenova/transformers, Whisper tiny.en)
- ONNX Runtime Web (onnxruntime-web) for face detection
- Gumroad license API for Pro activation

## Local development

```bash
cd calmclip-app
npm install
npm run dev
```

The dev server runs on port 5000. Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy headers are required for SharedArrayBuffer (used by WASM workers). They are set in `vite.config.ts`.

## Build

```bash
npm run build   # tsc + vite build
npm run preview # serve the dist folder locally
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `VITE_GUMROAD_PRODUCT_ID` | Pro only | Gumroad product permalink ID used to verify license keys via the Gumroad API |
| `VITE_GUMROAD_URL` | Pro only | Full Gumroad checkout URL shown on the upgrade button (e.g. `https://yourname.gumroad.com/l/abc123`) |

Set in a `.env.local` file during development. In production, set as deployment secrets.

The Pro gate is active (`PRO_GATES_DISABLED = false` in `src/lib/pro.ts`). License checks are enforced. Set to `true` only during local debugging.

## Project structure

```
src/
  components/       React UI components (one concern per file)
  lib/              Pure logic, no JSX (ffmpeg, whisper, loudness, etc.)
  workers/          Web Worker entry points
  App.tsx           Root component and global state
  index.css         Design tokens, dual-range slider CSS, global resets
  main.tsx          React root mount
public/
  caption-font.ttf  Font file served to FFmpeg WASM for drawtext filter
  icon-*.png        App icons
  manifest.json     PWA manifest
```

## Feature inventory

### Editing

| Feature | Status | Component | Lib |
|---|---|---|---|
| Trim and cut (dual-handle slider) | Done | TrimSlider | ffmpeg.ts |
| Manual cuts at playhead (Ctrl+Z undo) | Done | App.tsx | ffmpeg.ts |
| Ratio resize (16:9, 9:16, 1:1, 4:5) | Done | RatioPicker | ffmpeg.ts |
| Crop mode (fit / fill) | Done | RatioPicker | ffmpeg.ts |
| Output quality (720p / 1080p) | Done | App.tsx | ffmpeg.ts |
| Batch export (all ratios at once) | Done | BatchExportPanel | batchExport.ts |
| Export presets (save and reload) | Done | ExportPresets | ExportPresets.tsx |
| Watermark overlay (image, position, opacity, scale) | Done | WatermarkPanel | ffmpeg.ts |

### Audio

| Feature | Status | Component | Lib |
|---|---|---|---|
| Loudness normalization (EBU R128 / YouTube / off) | Done | LoudnessPanel | loudness.ts |
| Audio denoise (afftdn -25 dB noise floor) | Done | App.tsx | ffmpeg.ts |
| Silence detection and removal | Done | SilenceCutterPanel | silenceCutter.ts |

### AI (all local, no upload)

| Feature | Status | Component | Lib |
|---|---|---|---|
| Whisper transcription (tiny.en, WASM) | Done | WhisperPanel | whisper.ts |
| Editable transcript with word highlighting | Done | TranscriptPanel | whisper.ts |
| Filler word removal | Done | FillerWordPanel | whisper.ts |
| Word-by-word timed captions | Done | CaptionStylePanel | captionStyles.ts |
| Face blur (draw regions, WASM detection) | Done | FaceBlurPanel | ffmpeg.ts |
| Hook scorer (analyzes first 30 s) | Done | HookScorer | (inline) |
| Pace analyzer (WPM per 15-s window) | Done | PaceAnalyzer | (inline) |
| Chapter generator (from transcript) | Done | ChapterGenerator | (inline) |
| B-roll gap detector | Done | BRollGapDetector | (inline) |

### Captions

| Feature | Status | Component | Lib |
|---|---|---|---|
| Static caption text (burned in) | Done | App.tsx | captionStyles.ts |
| Caption style editor (font, size, color, box, border) | Done | CaptionStylePanel | captionStyles.ts |
| Word-by-word timed captions (burns each chunk at timestamp) | Done | WhisperPanel | captionStyles.ts |

### Privacy and output

| Feature | Status | Component | Lib |
|---|---|---|---|
| Metadata stripping | Done | App.tsx | ffmpeg.ts |
| Export to MP4 (libx264, AAC) | Done | App.tsx | ffmpeg.ts |
| Thumbnail extractor (canvas snapshot) | Done | ThumbnailExtractor | (inline) |
| Screen recording | Done | ScreenRecordButton | screenRecord.ts |
| Metadata report (codec, resolution, duration, GPS) | Done | MetadataReport | metadata.ts |
| Pre/post export report | Done | ExportReport | (inline) |

### Sessions and UX

| Feature | Status | Component | Lib |
|---|---|---|---|
| Auto-save session to IndexedDB (7-day TTL) | Done | App.tsx | projectSession.ts |
| Restore session on same file drop | Done | App.tsx | projectSession.ts |
| Session browser (list, load, delete) | Done | App.tsx | projectSession.ts |
| File size warning (caution / danger / extreme tiers) | Done | FileSizeReadout | fileSizeWarning.ts |
| Pro gate and Gumroad license activation | Done (gates off) | ProGate, ProUnlockModal | pro.ts |
| Diagnostics modal | Done | App.tsx | (inline) |
| Error boundary | Done | ErrorBoundary | (inline) |

## Rules

See `rules.md` for the full coding and design conventions. The short version:

1. No guesswork. Read before touching.
2. No em dashes or en dashes anywhere.
3. No full rewrites without permission.
4. No placeholders or TODO comments in production files.
5. No glassmorphism, gradient text, or glow effects.
6. No silent fallbacks.
7. All processing stays in the browser.
