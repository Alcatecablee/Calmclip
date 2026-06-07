CALMCLIP FEATURE SCREENSHOTS
=============================

Drop files here named exactly after the page slug. The page picks them up automatically.

NAMING CONVENTION
-----------------
{slug}.gif     -- preferred for animated demos
{slug}.webp    -- preferred for static screenshots (smallest file size)
{slug}.png     -- fallback for static screenshots

Priority order: .gif > .webp > .png (first found is used)

SLUGS (21 pages)
----------------
trim-video-online
add-captions-to-video
remove-silence-from-video
face-blur-video
resize-video-online
normalize-video-audio
remove-video-metadata
record-screen-online
add-watermark-to-video
batch-export-video
ai-video-transcription
remove-filler-words
extract-video-thumbnail
denoise-audio-online
generate-video-chapters
video-editor-no-upload
crop-video-for-tiktok
crop-video-for-instagram
crop-video-for-youtube-shorts
video-editor-for-lawyers
video-editor-for-journalists

DIMENSIONS
----------
Width:  1200px (display width in the page is 820px max, so 1200px = crisp on retina)
Height: 675px recommended (16:9), max 960px (taller crops are cut off at 480px)
Crop:   Focus on the specific feature panel, not the full browser window

FILE SIZE TARGETS
-----------------
GIF:  under 3 MB  (use 20fps, 10-15 colors, crop tightly)
WebP: under 500 KB
PNG:  under 1 MB

RECORDING TIPS
--------------
- Show the action, not the navigation to it (skip file picker, skip clicking the tab)
- Keep cursor visible so people can follow what is happening
- Aim for 3-5 seconds of looping action
- End the clip in roughly the same visual state it started (clean loop)
- Hide browser bookmarks bar and any personal tabs before recording

RECOMMENDED TOOLS
-----------------
Windows: ScreenToGif (free) -- records directly to GIF, set output to 1200px wide, 20fps
Mac:     Kap (free) -- export as GIF or WebP; or QuickTime + gifski CLI for best quality
Any:     gifski CLI (https://gif.ski) for highest-quality GIF from any video file

WHAT TO SHOW PER PAGE
----------------------
trim-video-online            Dragging the timeline handles to crop the clip
add-captions-to-video        Captions appearing word by word on the video
remove-silence-from-video    Waveform gaps highlighted and collapsed
face-blur-video              Face detected, blur box snapping on
resize-video-online          Aspect ratio switching with the canvas resizing
normalize-video-audio        Loudness meter before and after
remove-video-metadata        Metadata fields being cleared/shown as stripped
record-screen-online         Screen capture area being selected and recording starting
add-watermark-to-video       Watermark being dragged to position on the canvas
batch-export-video           Multiple clips in the queue being processed
ai-video-transcription       Transcript text appearing as audio plays
remove-filler-words          "Um" / "uh" words highlighted, then removed
extract-video-thumbnail      Scrubbing to a frame and saving it
denoise-audio-online         Waveform before/after with noise reduced
generate-video-chapters       Chapter markers appearing on the timeline
video-editor-no-upload       The full editor UI showing a loaded file (no upload step)
crop-video-for-tiktok        Canvas snapping to 9:16 with the crop handles
crop-video-for-instagram     Canvas snapping to 1:1 or 4:5 with the crop handles
crop-video-for-youtube-shorts Canvas snapping to 9:16 (Shorts framing)
video-editor-for-lawyers     Face blur + metadata strip applied together
video-editor-for-journalists  Captions + silence removal applied together
