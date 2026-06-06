---
name: Production transcription path
description: The actual transcription component used in the app and what dead code exists.
---

The production path is:
App.tsx -> TranscribeButton.tsx -> whisperTranscribe.ts -> whisper.worker.ts

WhisperPanel.tsx is never imported by any other file. It is dead code.
All progressive capability wiring (model selection, language, warming, capability hints, recordToolUsage) must go into TranscribeButton.tsx and whisperTranscribe.ts.

**Why:** A previous implementation left WhisperPanel as the intended home for all progressive features, but the app UI was refactored to use TranscribeButton instead. The disconnect was not obvious because both files import from the same lib files (whisper.ts, modelWarmer.ts).

**How to apply:** Before adding any feature to WhisperPanel.tsx, verify it is actually mounted. As of the fix applied here, TranscribeButton.tsx now contains: model selector UI, language selector UI, getBestCachedModel() on mount, saveModelPref/loadModelPref persistence, saveLangPref/loadLangPref persistence, recordToolUsage('transcribe'), writeCapabilityHint(), startWarmingQueue(), warming pill indicator.
