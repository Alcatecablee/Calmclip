---
name: Captions trim alignment
description: How trimStart/trimEnd must flow through the captions pipeline so word timestamps match video playback.
---

## Rule

Whisper timestamps are always 0-based relative to the start of the audio blob it receives.
When the user has trimmed the video, the audio blob covers [trimStart, trimEnd] of the original file.
Every timestamp from Whisper therefore needs `+ trimStart` before being stored as a `Word`.

## Pipeline (live as of this session)

1. `audioExtractor.ts:extractAudioFromVideo(file, trimStart, trimEnd)` — FFmpeg extracts only the trimmed segment using `-ss trimStart -t (trimEnd-trimStart) -i input`.
2. `whisperTranscribe.ts:transcribeToTimedWords(..., trimStart)` — after the worker returns chunks, applies `startTime = trimStart + chunk.timestamp[0]`, clamps to `[trimStart, trimStart + audioDuration]`.
3. `distributeWords(transcript, audioDuration, trimStart)` — fallback when no chunks; distributes words starting at trimStart.
4. `TranscribeButton.tsx` — computes `audioDuration = trimEnd - trimStart`, passes both `trimStart` and `audioDuration` to the above two functions.
5. `App.tsx` — passes `trimStart`, `trimEnd`, `hasAudio` to `TranscribeButton`.

## Dead code (do not delete without explicit permission)

- `src/lib/captionStyles.ts` — FFmpeg drawtext-based style system, superseded by the canvas renderer in `captionEngine.ts`. Not imported anywhere.
- `src/components/WhisperPanel.tsx` — older transcription UI backed by `whisper.ts:extractAudioForWhisper`. Not used in `App.tsx`; replaced by `TranscribeButton`.

## Why

`CaptionOverlay` and `canvasExporter` both compare `Word.startTime` against `videoRef.currentTime`, which is an absolute timestamp. If captions are transcribed from a trimmed segment without offsetting, captions for content at second 30 of the original video will appear at second 0 of the playhead instead.
