---
name: Export privacy and lifecycle
description: Durable rules for browser video export privacy, failure reporting, and resource cleanup.
---

The export path is local-only and must not hand a downloadable blob to the user until metadata sanitization has completed. If sanitization cannot complete, the export must fail visibly rather than falling back to the unsanitized recording.

**Why:** The product’s privacy promise depends on metadata removal, while browser media APIs and FFmpeg WASM can fail asynchronously or contend for shared resources. Silent audio downgrades and late cleanup failures create misleading or unsafe exports.

**How to apply:** Keep metadata stripping immediately before the blob reaches the UI or batch downloader. Treat browser capability, audio graph, recorder, and sanitization failures as user-visible errors. On every path, stop stream tracks, disconnect and close audio, clear media sources, revoke object URLs, release FFmpeg coordination, and expose per-ratio batch errors instead of marking failed jobs done.