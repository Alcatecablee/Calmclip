---
name: Pro gating pattern
description: How Pro feature gating works in CalmClip — Canva-style action interception.
---

## Rule
All Pro features are gated at the **action** (button click), not at the UI level. Components are always visible and interactive up to the moment the user tries to use them.

## Pattern
Every gated component accepts `onProGate?: () => void`. When the prop is set, action buttons intercept their onClick: `if (onProGate) { onProGate(); return }`. A small inline `PRO` badge appears on gated buttons.

In App.tsx, every gated component receives: `onProGate={!proActive ? openProModal : undefined}`. When `proActive` is true, `onProGate` is undefined and all gating disappears with no extra code.

**Why:** User explicitly requested Canva-style — see everything, click everything, get the paywall only at the action. No hiding, no blurring, no disabled states.

## Gated features (as of implementation)
- TranscribeButton: "Auto-Transcribe with Whisper" button
- ExportPanel: "Export Video" button
- BatchExportPanel: "Export all 4 ratios" button
- FaceBlurPanel: "Add blur region" button
- WatermarkPanel: "Upload logo" button
- ExportPresets: "Save current" button + "Apply" preset button
- FillerWordPanel: "Remove all filler words" button
- HookScorer: shows teaser + "Unlock hook score" CTA instead of content
- PaceAnalyzer: shows teaser bar + "Unlock pace analyzer" CTA instead of content
- BRollGapDetector: "Export cue sheet (.csv)" button
- ChapterGenerator: "Copy for YouTube description" button

## How to apply
When adding a new Pro feature, add `onProGate?: () => void` to its Props, destructure it, intercept the action onClick, add PRO badge. Wire in App.tsx with `onProGate={!proActive ? openProModal : undefined}`.
