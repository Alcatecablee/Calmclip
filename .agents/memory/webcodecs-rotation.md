---
name: WebCodecs rotation fix
description: How rotation metadata is handled in the WebCodecs export path (exportVideoWebCodecs)
---

## The rule
In `exportVideoWebCodecs`, always read CODED dims from `vTrack.video?.width/height` (not `track_width/track_height`). Use browser-reported `opts.sourceDims` as the display dims when they equal the swapped coded dims — this indicates rotation metadata. Additionally detect CW vs CCW direction from `vTrack.matrix[1]`.

**Why:** Phone cameras store video landscape with a rotation tag. The browser `<video>` auto-rotates, but mp4box may return raw coded landscape dims (1920×1080) while `opts.sourceDims` is post-rotation portrait (1080×1920). Without the fix, `computeDrawParams(1920,1080,720,1280,'fit')` produces letterboxed output.

**How to apply:**
1. `codedW/codedH` = `vTrack.video?.width/height` — passed to `VideoDecoder.configure()`
2. `srcW/srcH` = `opts.sourceDims` when `abs(sdW - codedH) < 8 && abs(sdH - codedW) < 8`, otherwise `track_width/height`
3. `isRotated90` = `codedW !== codedH && abs(codedW - srcH) < 8 && abs(codedH - srcW) < 8`
4. `isRotatedCCW` = `vTrack.matrix?.[1] < 0` (mp4box tkhd matrix element [1] is the sine of rotation in 16.16 fixed-point; negative = CCW/rotate=270, positive/absent = CW/rotate=90)
5. When drawing frames with `isRotated90`:
   - rawSx = dp.sy  (same for both)
   - rawSy = isRotatedCCW ? dp.sx : codedH - dp.sx - dp.sw
   - rawSw = dp.sh, rawSh = dp.sw
   - setTransform(0, sign*dh/rawSw, dw/rawSh, 0, dx-rawSy*(dw/rawSh), dy + (CCW ? -rawSx*(dh/rawSw) : dh+rawSx*(dh/rawSw)))
   - where sign = CCW ? +1 : -1
   - then drawImage(frame, 0, 0, codedW, codedH)

**Both CW and CCW verified correct** for full-frame fill, fit with padding, and partial crop cases.
