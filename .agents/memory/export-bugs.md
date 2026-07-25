---
name: Export bug patterns
description: Bugs found and fixed in the CalmClip export pipeline (canvasExporter, webcodecs, ffmpeg, ExportPanel).
---

## Download anchor must be in the DOM before click()

Firefox silently drops downloads triggered by `a.click()` if the anchor is not appended to the document first. Always follow the pattern from `srtExport.ts`:
```js
document.body.appendChild(a)
a.click()
document.body.removeChild(a)
```
**Why:** Firefox's security model requires the link to be part of the live document tree.
**How to apply:** Every `a.click()` download path in the codebase must use this pattern.

## omitFastStart must be true in exportWithCuts

`exportVideo` (non-cuts path) passes `omitFastStart=true` to `codecArgs`. `exportWithCuts` must also pass `true`. The `+faststart` moov-relocation second pass triggers MT pthread teardown in the WASM core and kills the worker before `readFile` can complete, hanging the export at 99%.
**Why:** MT pthreads runtime tears down after exec() exits; moov relocation conflicts with that teardown.
**How to apply:** Any `codecArgs(format, hasAudio, filter, omitFastStart)` call that may run against the MT WASM core must use `omitFastStart=true`.

## WebCodecs audio pre-roll causes content before trim point to appear in export

AAC frames are independently decodable (no inter-frame prediction), so no pre-roll before `trimStart` is needed. The old code included samples from `trimStart - 0.5` and mapped them to `timestamp=0`, placing up to 0.5s of audio from before the trim point at the start of the exported file. Fixed by filtering `tsSec < trimStart` strictly.
**Why:** `Math.max(0, tsSec - trimStart)` for pre-roll frames compresses them all to timestamp 0, which the muxer writes into the output.
**How to apply:** For WebCodecs audio, filter `tsSec < trimStart` (not `trimStart - 0.5`).

## New Audio() needs explicit load() for Safari

Setting `audioEl.src = blobUrl` on a newly created `Audio` element does not always begin buffering in Safari. Call `audioEl.load()` immediately after setting `src` before passing the element to `createMediaElementSource`.

## stripMetadataFromWebm (FFmpeg) is unreliable for canvas MediaRecorder output

Do NOT route canvas exports through `stripMetadataFromWebm` (the FFmpeg remux path).
Two separate failure modes, both confirmed in production console logs:

1. **MT core Aborted()** -- the multi-threaded WASM core fires `Aborted()` after every
   `exec()` call as its pthreads runtime tears down. The instance is then dead and the
   next export must reload from scratch.

2. **ST core 58-frame truncation** -- the single-threaded fallback core only copies ~2 s
   of video when audio and video timestamps diverge. This happens because the Web Audio
   API MediaStream timestamps are based on `AudioContext.currentTime`, which may be
   nonzero if the context was alive while FFmpeg WASM was loading (~150 s in observed
   logs). The muxer interleaver treats audio-ahead-of-video as a sync error and stops
   writing video frames, producing a file where only audio plays.

**Fix:** `canvasExporter.ts` now uses `stripWebmMetadata()` -- a pure-JS EBML editor
that zeros MuxingApp (0x4D80), WritingApp (0x5741), Title (0x7BA9), and DateUTC (0x4461)
directly in the container bytes, without any FFmpeg remux. Fast, reliable, no WASM.

**Why:** A MediaRecorder WebM from Chrome contains no camera metadata (GPS, device
serial, EXIF). The only identifying fields are the three above. Zeroing them in-place
satisfies the privacy invariant without touching frame data or container structure.

**How to apply:** `stripMetadataFromWebm` in `ffmpeg.ts` is kept for any future use
outside canvas exports, but must not be called on streaming/live WebM from MediaRecorder.

## AudioContext early-exit paths must fully clean up

When exiting before the recorder starts (mimeType check, MediaRecorder construction error), the full cleanup sequence is:
1. `source.disconnect()`
2. `ctx.close()`
3. `audioEl.pause(); audioEl.src = ''; audioEl.load()`
Skipping any step leaves resources loaded in the background.
