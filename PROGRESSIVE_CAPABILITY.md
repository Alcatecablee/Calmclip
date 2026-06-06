# CalmClip: Progressive Capability Strategy

The core idea: CalmClip gets faster, smarter, and more capable the longer a user stays in a session and the more sessions they accumulate. No cloud required. Nothing leaves the device. The app silently builds its own power using idle time the user is already spending.

This document covers what needs to be built, in what order, and exactly how.

---

## What Already Exists (Do Not Rebuild)

Read these files before touching anything:

- `src/workers/whisper.worker.ts` — model caching via `env.useBrowserCache = true`. Models already persist in the browser Cache API after first download. WebGPU is already attempted before WASM fallback.
- `src/lib/whisper.ts` — `WHISPER_MODELS` array already defines `Xenova/whisper-tiny`, `Xenova/whisper-base`, `Xenova/whisper-small`, `Xenova/whisper-medium`. All are multilingual (no `.en` suffix).
- `src/lib/projectSession.ts` — IndexedDB session storage already exists. This is where usage tracking will live.
- `src/hooks/usePWA.ts` — PWA infrastructure is already wired.
- `src/lib/ffmpeg.ts` — FFmpeg loads from `cdn.jsdelivr.net`. The singleton guard (`_loadingPromise`) means a second call to `loadFfmpeg()` while loading is in progress just awaits the same promise. Pre-warming is safe to call at any time.

**Critical finding in `src/workers/whisper.worker.ts` line 129:**
```ts
language: 'english',
```
The language is hardcoded. The models themselves are multilingual, but the pipeline is locked to English. Language detection and dynamic language routing both require removing this hardcoded value.

---

## Phase 1: Language Unlock

**Goal:** Remove the English lock. Support all languages the multilingual Whisper models handle.

### 1a. Remove the hardcoded language

File: `src/workers/whisper.worker.ts`

Change the worker message contract to accept an optional `language` field:

```ts
// Before
const { type, audio, durationSec, model } = event.data

// After
const { type, audio, durationSec, model, language } = event.data
```

Change the pipeline call:

```ts
// Before
language: 'english',

// After
...(language ? { language } : {}),
```

When `language` is omitted, Whisper auto-detects. This is the correct default for non-English content.

### 1b. Thread language through the call stack

File: `src/lib/whisper.ts`

The `run` function in `createWhisperWorker` currently sends:
```ts
worker.postMessage({ type: 'transcribe', audio, model, durationSec: audio.length / 16000 })
```

Add `language` as an optional parameter:
```ts
run: (audio: Float32Array, model: WhisperModelId, language?: string) =>
  worker.postMessage({ type: 'transcribe', audio, model, language, durationSec: audio.length / 16000 })
```

Update `WhisperStatus` in `src/lib/whisper.ts` to include detected language in the `done` phase:
```ts
| { phase: 'done'; result: TranscriptResult; detectedLanguage?: string }
```

The Whisper pipeline result object contains a `language` field when auto-detection runs. Capture it and pass it back.

### 1c. Expose language in the UI

File: `src/components/WhisperPanel.tsx`

Read the existing component before touching it. Add a language dropdown using only languages Whisper reliably supports (the full 99-language list is not worth surfacing, use the top 20 by global speaker count). Default: auto-detect. English users who select English get the fastest path. All others get auto-detect or manual override.

Store the user's language preference in `localStorage` under `calmclip_lang_pref`. Restore it on next session.

---

## Phase 2: Language Detection Pass

**Goal:** When `language` is set to auto-detect, capture the language Whisper identifies and use it to route future model downloads.

### How Whisper language detection works

Whisper runs its encoder on the first 30 seconds of audio and produces a language probability vector before it begins transcribing. The `@xenova/transformers` pipeline exposes the detected language in the result object. No separate model or extra inference pass is required. Detection is a byproduct of the transcription you were already running.

### What to do with the detected language

When the `done` status fires with a `detectedLanguage` field:

1. If detected language is English and the current model is already `whisper-base` or better: do nothing.
2. If detected language is English and current model is `whisper-tiny`: flag `whisper-base` as the next background download target.
3. If detected language is not English: flag `whisper-small` as the next background download target (better multilingual accuracy than base).

Write the detected language and the recommended next model to IndexedDB under `calmclip_capability_hints`. This is the seed for Phase 3.

---

## Phase 3: Progressive Model Warming

**Goal:** Use the time a user spends editing to silently download better models. By session 2 or 3, the best available model is already cached and transcription quality improves automatically.

### The warming queue

New file: `src/lib/modelWarmer.ts`

This module manages a priority queue of model downloads to run in the background. It does not use Web Workers or Service Workers for the download itself. It calls `pipeline()` from `@xenova/transformers` with a throwaway instance solely to trigger the browser cache population. The instance is discarded after download; it is never used for inference.

```ts
// Pseudocode only. Read the actual @xenova/transformers API before writing this.
async function warmModel(modelId: WhisperModelId): Promise<void> {
  // Check if already cached before fetching
  // Load pipeline with progress_callback to report download status
  // Discard the pipeline instance after load
}
```

**Connection gating:** Check `navigator.connection.effectiveType` before starting any download. Only proceed on `4g` or unknown. On `3g`, `2g`, or `slow-2g`, skip silently.

**Storage quota gating:** Before starting any model download, call `navigator.storage.estimate()`. If remaining quota is less than `modelSizeBytes * 2`, skip the warming attempt silently. Use the actual model size as the basis, not a flat floor. For reference: whisper-tiny is ~39 MB, whisper-base is ~74 MB, whisper-small is ~244 MB, whisper-medium is ~769 MB. A device with 900 MB free should not skip a 74 MB download, but should skip a 769 MB one. A flat 1 GB threshold would wrongly block small models on constrained devices. The actual feature call will surface its own error if the user explicitly requests transcription and the model is absent.

**Memory budget:** Do not warm `Xenova/whisper-small` (244 MB) or larger while the user is actively exporting or running FFmpeg. Both operations allocate significant WASM heap. Check `_exportRunning` in `src/lib/ffmpeg.ts` (already exported as `isExportRunning()` or read the flag directly) before initiating a large model download. Defer until the export completes.

**Cleanup after warming:** The throwaway pipeline instance must be explicitly released after the model shards are cached. Set the local reference to `null` after the `pipeline()` call resolves and call any available `dispose()` method if the `@xenova/transformers` API exposes one. Verify the API before writing this. Do not assume `dispose()` exists without checking.

**Trigger point:** Call `startWarmingQueue()` after the first transcription completes and the user returns to the editor. The user is now actively editing, which means they will be in the app for minutes. This is the right window.

### Warming priority order

For an English-only user on first session:
1. `Xenova/whisper-base` (74 MB) - quality upgrade, same language, low cost
2. `Xenova/whisper-small` (244 MB) - only if the user stays past 20 minutes
3. `Xenova/whisper-medium` (769 MB) - only on subsequent sessions via Phase 4

For a non-English user:
1. `Xenova/whisper-small` (244 MB) - multilingual small is significantly better than tiny on accents
2. `Xenova/whisper-base` (74 MB) - already smaller, warm this first

### Model selection on next transcription

New function in `src/lib/whisper.ts`: `getBestCachedModel(): Promise<WhisperModelId>`

Check the browser Cache API for each model in descending quality order. Return the best one that is fully and verifiably cached.

**Shard verification is required.** `@xenova/transformers` downloads models as multiple ONNX shards. A partial or interrupted download will leave some shard keys in the cache but fail on inference. A simple presence check is not sufficient. Before writing this function, inspect the `@xenova/transformers` source to identify exactly which cache keys are written per model and how to confirm all required shards are present. Only return a model ID when all its shards are confirmed. If shard verification is not possible via the public API, use a sentinel value written to IndexedDB by `modelWarmer.ts` at the moment the pipeline load resolves successfully.

**Sentinel staleness:** The sentinel can go stale if the user clears their browser cache between sessions. The Cache API entries are gone but IndexedDB still reports the model as fully cached. To handle this: when `getBestCachedModel()` reads a sentinel claiming a model is cached, attempt to open one known shard URL for that model in the Cache API. If the shard is missing, clear the sentinel for that model in IndexedDB and fall back to the next model down the quality list. This check is a single `cache.match()` call and adds negligible overhead.

### Status indicator

When a background download is in progress, show a subtle fixed pill at the bottom of the sidebar:

```
Upgrading accuracy... 47%
```

No modal. No blocking UI. Dismiss on click if the user finds it distracting. The pill uses the existing design tokens: `--bg-surface-2` background, `--text-muted` text, `--primary` progress fill, 8px border radius, no glow, no blur.

---

## Phase 4: Between-Session Warming via PWA Background Fetch (Stretch Goal Only)

**Browser support note:** The Background Fetch API is Chromium-only. Firefox does not support it. Safari support is absent. Unless CalmClip's user base is confirmed to be almost entirely Chrome desktop, the effort-to-reach ratio is poor. Do not build this phase until there is data on which browsers users actually run. It is documented here for completeness, not as a committed deliverable.

**Goal:** Download heavy models while the app is not open, so they are ready before the user's next session.

### What the Background Fetch API provides

`navigator.serviceWorker.ready` then `registration.backgroundFetch.fetch()` allows the browser to continue downloading files even after the tab is closed. Downloads appear in the browser's download indicator. The service worker handles the completion event and stores the result.

### What to implement (only if Chromium reach is confirmed)

File: `public/sw.js` (the existing service worker)

Add a `backgroundfetchsuccess` event listener. When a model download completes in the background, write the model shards to the Cache API under the same keys that `@xenova/transformers` uses (`env.useBrowserCache = true` means the library reads from `Cache API` using its own key scheme). Verify this key scheme from the `@xenova/transformers` source before writing the handler.

File: `src/lib/modelWarmer.ts`

Add `scheduleBackgroundFetch(modelId)`. Call this at the end of a session when the user closes or navigates away, if a high-priority model is not yet cached. Target `whisper-medium` for users who have already cached `whisper-small` across prior sessions.

**Important:** Background Fetch requires user permission in some browsers. Request it only after the user has completed at least one transcription, not on first page load.

---

## Phase 5: FFmpeg and ONNX Pre-Warming

**Goal:** Eliminate the initialization delay for FFmpeg and the face detection model by pre-loading them during idle time.

### FFmpeg pre-warm

File: `src/lib/ffmpeg.ts`

`loadFfmpeg()` is already safe to call multiple times (singleton guard). Call it speculatively immediately after a file is dropped into the editor, before the user takes any action. By the time they hit Export or run a trim, FFmpeg is already initialized. No code change needed in `ffmpeg.ts` itself. The call site is in `App.tsx` or wherever the file drop is handled.

Read `App.tsx` before adding this call. Identify exactly where the file drop resolves and add `loadFfmpeg().catch(() => {})` directly after the file is accepted. The `.catch(() => {})` is intentional: a pre-warm failure is silent because the actual feature call will show its own error if FFmpeg truly cannot load.

### ONNX face detection pre-warm

Read `src/components/FaceBlurPanel.tsx` and the relevant lib file before touching anything here. Identify where the ONNX model is loaded and whether it has the same singleton guard pattern as FFmpeg. If it does, the same approach applies: call the load function speculatively after file drop, discard the error silently.

If it does not have a singleton guard, add one before adding any pre-warm call.

---

## Phase 6: Usage-Based Prioritization

**Goal:** Track which tools each user actually reaches for and use that signal to decide what to pre-warm first.

### What to track

Extend the existing IndexedDB storage in `src/lib/projectSession.ts`. Add a separate store `calmclip_tool_usage` with this shape:

```ts
interface ToolUsageRecord {
  toolId: 'transcribe' | 'faceBlur' | 'silenceCut' | 'loudness' | 'captions' | 'batchExport'
  useCount: number
  lastUsed: number // Unix ms
}
```

Increment the relevant counter each time the user triggers that tool. Read `projectSession.ts` fully before adding any new IndexedDB logic. Do not create a new connection. Extend the existing `openDB` call with an additional object store.

### How to use the signal

At the start of a warming session (after first transcription completes), read `calmclip_tool_usage` and compute a recency-weighted score for each tool:

```
score = useCount * Math.exp(-daysSinceLastUse / 30)
```

The 30-day half-life means a tool used heavily six months ago decays to near zero weight, while a tool used yesterday retains full weight. Sort by score, not raw useCount. If the user has never used face blur, or last used it more than 60 days ago with a low score, do not pre-warm the ONNX model. If they use it regularly, pre-warm it immediately after Whisper base is cached.

This keeps the warming queue lean and current, reflecting actual workflow rather than historical artifacts.

---

## Positioning

This system produces a product story that is true and not replicable by server-based tools:

"Gets smarter every session. Nothing leaves your machine."

Session 1: fast, capable, English-focused.
Session 2: base-quality transcription already cached, instant on first use.
Session 3 and beyond: best available model selected automatically, ONNX and FFmpeg warm before the user needs them.

vidclean runs the same model for every user, every time. Otter.ai charges for more accuracy. CalmClip's accuracy improves for free, locally, as a side effect of the user doing their normal work.

---

## Build Order

1. Phase 1 (Language unlock) - required before anything else. The hardcoded `language: 'english'` must go.
2. Phase 2 (Language detection pass) - builds directly on Phase 1.
3. Phase 3 (Progressive model warming) - the core loop. Delivers the most user value.
4. Phase 5 (FFmpeg and ONNX pre-warm) - low effort, high impact on perceived speed.
5. Phase 6 (Usage-based prioritization) - adds intelligence to Phase 3.
6. Phase 4 (Background Fetch) - stretch goal only. Do not start until browser analytics confirm the user base is predominantly Chromium desktop.

---

## Rules Reminder for Implementation

- Read every file before touching it.
- No em dashes or en dashes anywhere in code, comments, strings, or JSX.
- No placeholders or stub implementations in production files.
- No silent fallbacks for user-facing errors. Pre-warm failures are internal and silent. Feature failures are explicit.
- No full rewrites. Identify the minimal change for each phase.
- One phase at a time. Do not mix phases in a single edit session.
