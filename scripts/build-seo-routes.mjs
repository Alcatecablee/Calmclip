import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = resolve(__dirname, '../dist')

export const seoRoutes = [
  {
    path: 'trim-video-online',
    title: 'Trim Video Online Free | No Upload | CalmClip',
    desc: 'The fastest way to trim, cut, and split video files online. CalmClip runs entirely in your browser. No uploads, no waiting, no watermark. Free forever.',
    h1: 'Trim Video Online (100% Free & Private)',
    h2: 'Cut and split videos instantly without uploading a single byte to a server.',
    howTo: {
      name: 'How to trim a video online for free without uploading it',
      description: 'CalmClip lets you trim and cut video clips entirely in your browser. Nothing uploads. Here is how.',
      totalTime: 'PT1M',
      step: [
        { position: 1, name: 'Open CalmClip', text: 'Go to CalmClip in any modern browser. No account, no download, no install.' },
        { position: 2, name: 'Drop or select your video', text: 'Drag your video onto the page or click to browse. Supports MP4, MOV, WebM, and MKV. Any file size works because nothing uploads.' },
        { position: 3, name: 'Set your trim points', text: 'Drag the trim handles on the timeline to mark the start and end of the section you want to keep.' },
        { position: 4, name: 'Export the trimmed clip', text: 'Click Export. FFmpeg trims the video locally in your browser and saves the result to your device. No watermark, no wait.' },
      ],
    },
    faq: [
      { q: 'Does CalmClip actually not upload my video?', a: 'Correct. The trim operation runs using FFmpeg compiled to WebAssembly, which executes in your browser. Your video bytes stay on your hard drive. You can verify by disconnecting from the internet after loading the page.' },
      { q: 'What video formats can I trim?', a: 'MP4, MOV, WebM, and MKV. All processed locally.' },
      { q: 'Is there a file size limit for trimming?', a: 'There is no upload-based limit. The practical limit depends on your browser and available RAM. Most machines handle files up to 4 GB without trouble.' },
      { q: 'Will trimming affect video quality?', a: 'No. CalmClip uses stream copy mode for trimming when possible, which means the video stream is not re-encoded. You get frame-accurate cuts with no quality loss.' },
      { q: 'Can I trim multiple sections from one video?', a: 'Yes. Use the manual cut mode to split at the playhead and delete individual sections. The silence cutter also auto-removes segments.' },
      { q: 'Does the free version include trimming?', a: 'Yes. Trimming is a core free feature. No Pro licence required.' },
    ],
  },
  {
    path: 'add-captions-to-video',
    title: 'Add Captions to Video Free | Local AI Transcription | CalmClip',
    desc: 'Generate highly accurate subtitles and add captions to video automatically using local AI. Whisper runs natively in your browser. Zero uploads.',
    h1: 'Add Captions to Video Automatically',
    h2: 'Use local AI to transcribe and caption your videos directly in your browser.',
    howTo: {
      name: 'How to add captions to a video for free without uploading it',
      description: 'CalmClip uses local AI to transcribe your video and burn captions directly in your browser. Nothing uploads.',
      totalTime: 'PT3M',
      step: [
        { position: 1, name: 'Open CalmClip and load your video', text: 'Go to CalmClip in any modern browser and drop your video onto the page. No account required.' },
        { position: 2, name: 'Open the Captions section', text: 'Click the Captions section in the editor. The Whisper AI model downloads once and runs entirely on your device.' },
        { position: 3, name: 'Transcribe and edit', text: 'Click Transcribe. The AI generates captions from your audio locally. Edit any word directly in the caption editor.' },
        { position: 4, name: 'Export with burned-in captions', text: 'Click Export. FFmpeg burns the captions into the video locally and saves the file to your device. No upload, no watermark.' },
      ],
    },
    faq: [
      { q: 'Does Whisper upload my audio to a server?', a: 'No. Whisper runs locally in your browser via WebAssembly. Your audio is processed on your device.' },
      { q: 'How accurate is the transcription?', a: 'Whisper produces professional-grade accuracy for most clear speech in English and many other languages. Accuracy is lower for heavy accents, background noise, or very fast speech.' },
      { q: 'Can I edit the captions?', a: 'Yes. Every word is editable in the caption editor. You can also adjust timing and split or merge caption groups.' },
      { q: 'What caption styles are available?', a: 'CalmClip includes several presets: bold pop (large centered text), subtitle style (lower third), and others.' },
      { q: 'Does captioning require Pro?', a: 'Yes. AI transcription and caption burning are Pro features.' },
      { q: 'Will captions slow down the export?', a: 'The export is processed locally using FFmpeg. Speed depends on your CPU and the length of the video, not a server queue.' },
    ],
  },
  {
    path: 'remove-silence-from-video',
    title: 'Remove Silence & Dead Air from Video | CalmClip',
    desc: 'Automatically remove silence, pauses, and dead air from podcasts, lectures, and interviews. Browser-based, incredibly fast, and free.',
    h1: 'Remove Silence from Video Instantly',
    h2: 'Automatically cut dead air and pauses to make your videos more engaging.',
    howTo: {
      name: 'How to remove silence from a video automatically for free',
      description: 'CalmClip detects and removes silent gaps and dead air from your video entirely in your browser. Nothing uploads.',
      totalTime: 'PT2M',
      step: [
        { position: 1, name: 'Open CalmClip and load your video', text: 'Go to CalmClip in any modern browser and drop your video file onto the page. No account required.' },
        { position: 2, name: 'Open the Silence Remover section', text: 'Click the Silence Remover section. Adjust the silence threshold and minimum gap duration to match your recording.' },
        { position: 3, name: 'Scan and preview cuts', text: 'Click Scan. CalmClip finds all silent segments and shows you exactly which sections will be removed. Review before committing.' },
        { position: 4, name: 'Export the cleaned video', text: 'Click Export. FFmpeg cuts all silent gaps locally in your browser and saves the tightened video to your device.' },
      ],
    },
    faq: [
      { q: 'How does CalmClip detect silence?', a: 'It analyzes the audio waveform in your browser and finds segments below a decibel threshold you control.' },
      { q: 'Will it cut too aggressively?', a: 'The minimum gap setting controls this. Set it high enough that natural breath pauses are not cut.' },
      { q: 'Does it affect video quality?', a: 'No. CalmClip uses stream copy mode for cuts that align to keyframes, and only re-encodes when necessary.' },
      { q: 'Can I preview the cuts before exporting?', a: 'Yes. The detected silence segments are shown on the timeline before you export. You can adjust the threshold and re-scan as many times as you need.' },
      { q: 'Does silence removal require Pro?', a: 'No. Basic silence removal is available on the free plan.' },
      { q: 'Can I combine silence removal with other edits?', a: 'Yes. Trim, resize, normalize audio, and remove silence all apply in a single export pass.' },
    ],
  },
  {
    path: 'face-blur-video',
    title: 'Blur Faces in Video Online | Privacy Safe | CalmClip',
    desc: 'Automatically detect and blur faces in videos online. Because CalmClip runs 100% locally in your browser, your unedited video never touches a server.',
    h1: 'Privacy-Safe Face Blur Editor',
    h2: 'Censor and blur faces in video without ever uploading the original file.',
    howTo: {
      name: 'How to blur faces in a video online without uploading it',
      description: 'CalmClip detects and blurs faces in video using a local WASM model. Your unedited footage never touches a server.',
      totalTime: 'PT2M',
      step: [
        { position: 1, name: 'Open CalmClip and load your video', text: 'Go to CalmClip in any modern browser and drop your video onto the page. No account or upload required.' },
        { position: 2, name: 'Open the Face Blur section', text: 'Click the Face Blur section. The face detection model runs locally in your browser using ONNX Runtime.' },
        { position: 3, name: 'Detect and blur', text: 'Click Detect Faces. CalmClip finds faces in your video and blurs them automatically. Adjust the blur strength as needed.' },
        { position: 4, name: 'Export the blurred video', text: 'Click Export. FFmpeg applies the blur locally and saves the result to your device. The original file is never altered.' },
      ],
    },
    faq: [
      { q: 'Does the face detection run on my device?', a: 'Yes. The ONNX Runtime model runs locally in your browser. No video frames are sent to a server.' },
      { q: 'What if it misses a face?', a: 'You can draw manual blur regions over any area of the frame, including faces the detector missed.' },
      { q: 'Does blurring require Pro?', a: 'Yes. Face blur is a Pro feature.' },
      { q: 'What formats does face blurring export to?', a: 'The same formats as other CalmClip exports: WebM and MOV (Pro).' },
      { q: 'Will it blur faces at an angle or in profile?', a: 'Detection accuracy varies by angle, lighting, and resolution. The manual region tool covers cases where automatic detection falls short.' },
      { q: 'Does it blur audio?', a: 'No. Face blurring applies only to the video track. Voice anonymization is not currently in CalmClip.' },
    ],
  },
  {
    path: 'resize-video-online',
    title: 'Resize Video for Instagram, TikTok, YouTube | CalmClip',
    desc: 'Crop, fit, and resize videos to 9:16, 1:1, or 4:5 aspect ratios instantly in your browser. Free online video resizer with no watermark.',
    h1: 'Resize Video Online for Any Platform',
    h2: 'Easily crop and scale your videos for TikTok, Instagram Reels, and YouTube Shorts.',
    howTo: {
      name: 'How to resize a video for Instagram, TikTok, or YouTube for free',
      description: 'CalmClip resizes and crops video to any aspect ratio entirely in your browser. No upload, no watermark, no account.',
      totalTime: 'PT1M',
      step: [
        { position: 1, name: 'Open CalmClip and load your video', text: 'Go to CalmClip in any modern browser and drop your video onto the page. No account or install needed.' },
        { position: 2, name: 'Choose your aspect ratio', text: 'Select your target ratio: 9:16 for TikTok and Instagram Reels, 1:1 for Instagram feed, 4:5 for portrait, or 16:9 for YouTube.' },
        { position: 3, name: 'Adjust the crop position', text: 'Drag the crop frame to keep the most important part of the frame in view.' },
        { position: 4, name: 'Export the resized video', text: 'Click Export. FFmpeg resizes and crops the video locally in your browser and saves it to your device. No watermark.' },
      ],
    },
    faq: [
      { q: 'What aspect ratios does CalmClip support?', a: '16:9 (landscape), 9:16 (vertical), 1:1 (square), and 4:5 (portrait). These cover TikTok, Instagram, Reels, Shorts, and YouTube.' },
      { q: 'Will it crop out part of my video?', a: 'Yes, in Fill mode. If you choose Fit mode instead, CalmClip adds bars to fill the frame without cropping any content.' },
      { q: 'Can I control where the crop lands?', a: 'Yes. Drag the crop frame to any position, or use Smart Center to let CalmClip pick automatically.' },
      { q: 'Is resizing free?', a: 'Yes. Resizing to any ratio is a free feature.' },
      { q: 'Can I export all ratios at once?', a: 'Yes, with Pro. Batch export sends 16:9, 9:16, 1:1, and 4:5 in a single pass.' },
      { q: 'Does resizing reduce quality?', a: 'CalmClip re-encodes only when necessary. The output quality matches your export preset.' },
    ],
  },
  {
    path: 'normalize-video-audio',
    title: 'Normalize Video Audio Free | Loudness Tool | CalmClip',
    desc: 'Automatically normalize audio loudness in your video to -14 LUFS, -16 LUFS, or a custom target. Browser-based, free, no upload required.',
    h1: 'Normalize Video Audio for Free',
    h2: 'Set your audio to the right loudness level for any platform, entirely in your browser.',
    howTo: {
      name: 'How to normalize video audio to broadcast loudness for free',
      description: 'CalmClip normalizes video audio to any LUFS target entirely in your browser using FFmpeg. No upload required.',
      totalTime: 'PT1M',
      step: [
        { position: 1, name: 'Open CalmClip and load your video', text: 'Go to CalmClip in any modern browser and drop your video file onto the page.' },
        { position: 2, name: 'Open the Loudness section', text: 'Click the Loudness tab. Choose a standard target like -14 LUFS for streaming or -16 LUFS for podcasts, or enter a custom value.' },
        { position: 3, name: 'Enable normalization', text: 'Toggle loudness normalization on. Optionally enable audio denoising in the same step.' },
        { position: 4, name: 'Export with normalized audio', text: 'Click Export. FFmpeg applies loudness normalization alongside all your other edits in one pass and saves the file to your device.' },
      ],
    },
    faq: [
      { q: 'What is loudness normalization?', a: 'It adjusts the average loudness of your audio to a target level measured in LUFS. It makes your audio sound consistent across different listeners and platforms.' },
      { q: 'What is LUFS?', a: 'LUFS stands for Loudness Units relative to Full Scale. It is the standard measurement for perceived audio loudness used by streaming platforms.' },
      { q: 'Will normalization distort my audio?', a: 'Loudness normalization adjusts gain across the track. It does not clip or distort unless the original recording was already at the limit.' },
      { q: 'Is normalization free?', a: 'Yes. Loudness normalization is a free feature in CalmClip.' },
      { q: 'Can I use normalization with silence removal?', a: 'Yes. Combine any editing tools in the same session. They all apply in one export.' },
      { q: 'Does it change the video quality?', a: 'No. Normalization only affects the audio track.' },
    ],
  },
  {
    path: 'remove-video-metadata',
    title: 'Remove Video Metadata | Strip GPS and Device Info | CalmClip',
    desc: 'Strip GPS coordinates, device model, and recording timestamps from video files before sharing. Free, browser-based, no upload required.',
    h1: 'Strip Metadata from Video Before Sharing',
    h2: 'Remove GPS coordinates, device info, and timestamps from your video files locally.',
    howTo: {
      name: 'How to remove metadata from a video file for free',
      description: 'CalmClip strips all non-essential metadata from your video including GPS, device info, and timestamps, entirely in your browser.',
      totalTime: 'PT1M',
      step: [
        { position: 1, name: 'Open CalmClip and load your video', text: 'Go to CalmClip in any modern browser and drop your video file onto the page.' },
        { position: 2, name: 'Open the Privacy section', text: 'Click the Privacy tab. CalmClip scans your file locally and displays all metadata found.' },
        { position: 3, name: 'Review what is there', text: 'See exactly which fields your file carries: GPS coordinates, device model, recording date, and more.' },
        { position: 4, name: 'Export with metadata removed', text: 'Toggle metadata stripping on and export. FFmpeg removes all non-essential fields during the export pass. Your original file is unchanged.' },
      ],
    },
    faq: [
      { q: 'What metadata gets removed?', a: 'CalmClip removes GPS coordinates, device make and model, recording date and time, camera settings, and other non-essential tags embedded in the video container.' },
      { q: 'Does the video look different after stripping?', a: 'No. Metadata is stored separately from the video and audio streams. Removing it has no effect on playback.' },
      { q: 'Is stripping on by default?', a: 'Yes. Unless you turn it off in the Privacy section, CalmClip strips metadata from every export.' },
      { q: 'Does stripping work on all formats?', a: 'Metadata stripping applies to any format FFmpeg processes, which covers MP4, MOV, WebM, and MKV.' },
      { q: 'Is the original file affected?', a: 'No. CalmClip writes the stripped output to a new file. Your original is unchanged.' },
      { q: 'Is this free?', a: 'Yes. Metadata stripping is a free feature.' },
    ],
  },
  {
    path: 'record-screen-online',
    title: 'Record Your Screen Free | No Install | CalmClip',
    desc: 'Record any browser tab or full screen directly in CalmClip. No install, no extension, no cloud storage. Your recording goes straight into the editor.',
    h1: 'Record Your Screen for Free',
    h2: 'Capture any browser tab or your full screen and edit it immediately, no install needed.',
    howTo: {
      name: 'How to record your screen for free without installing anything',
      description: 'CalmClip uses the browser built-in Screen Capture API to record your screen and drop the recording directly into the editor.',
      totalTime: 'PT1M',
      step: [
        { position: 1, name: 'Click the Screen Record button', text: 'Find the Screen Record button on the CalmClip homepage. No extension or plugin required.' },
        { position: 2, name: 'Choose what to capture', text: 'A browser dialog lets you pick a specific tab, a window, or your full screen.' },
        { position: 3, name: 'Record', text: 'CalmClip captures your screen and audio. A stop button stays on the page.' },
        { position: 4, name: 'Stop and edit immediately', text: 'When you stop, the recording loads directly into the editor. Trim, add captions, normalize audio, and export without leaving the page.' },
      ],
    },
    faq: [
      { q: 'Do I need to install anything to record my screen?', a: 'No. CalmClip uses the browser built-in Screen Capture API. No extension, plugin, or app required.' },
      { q: 'Will it record audio?', a: 'Yes. You can choose to include audio from the browser tab or from your microphone.' },
      { q: 'Where is the recording stored?', a: 'Temporarily in browser memory. It is not uploaded to a server. Export to save it to your device.' },
      { q: 'What happens to the recording when I close the tab?', a: 'It is lost. Export your edited recording to your device before closing.' },
      { q: 'Is screen recording free?', a: 'Yes. Screen recording is a free feature.' },
      { q: 'What browsers support it?', a: 'Chrome, Edge, and Firefox on desktop. Safari has limited support depending on version.' },
    ],
  },
  {
    path: 'add-watermark-to-video',
    title: 'Add a Watermark to Video Free | No Upload | CalmClip',
    desc: 'Overlay your logo or brand image onto video before export. CalmClip burns watermarks in locally using FFmpeg. No upload, no cloud render farm.',
    h1: 'Add a Watermark to Your Video',
    h2: 'Overlay your logo onto video locally. No upload. No cloud render farm.',
    howTo: {
      name: 'How to add a watermark to a video for free without uploading it',
      description: 'CalmClip composites your logo or image over your video using local FFmpeg processing. Nothing uploads.',
      totalTime: 'PT2M',
      step: [
        { position: 1, name: 'Open CalmClip and load your video', text: 'Go to CalmClip in any modern browser and drop your video file onto the page.' },
        { position: 2, name: 'Open the Watermark section', text: 'Click the Watermark tab and upload your logo or image. PNG with transparency works best.' },
        { position: 3, name: 'Position and size your watermark', text: 'Drag the watermark to any position in the frame. Adjust the size and opacity to your preference.' },
        { position: 4, name: 'Export with the watermark burned in', text: 'Click Export. FFmpeg composites the watermark over your video locally and saves the result to your device.' },
      ],
    },
    faq: [
      { q: 'What image formats work for watermarks?', a: 'PNG is strongly recommended because it supports transparency. JPEG works but will show a white or colored background.' },
      { q: 'Does watermarking require Pro?', a: 'Yes. Watermark overlay is a Pro feature.' },
      { q: 'Can I control the watermark opacity?', a: 'Yes. Adjust the opacity in the watermark panel before exporting.' },
      { q: 'Is the original video file changed?', a: 'No. CalmClip exports a new file with the watermark. Your original is untouched.' },
      { q: 'Can I place the watermark anywhere in the frame?', a: 'Yes. Drag it to any position in the preview.' },
      { q: 'Does the watermark appear in all export formats?', a: 'Yes. It is burned into the video track regardless of the export format.' },
    ],
  },
  {
    path: 'batch-export-video',
    title: 'Batch Export Video to All Ratios | TikTok, Instagram, YouTube | CalmClip',
    desc: 'Export your video to 16:9, 9:16, 1:1, and 4:5 in one click. CalmClip batch exports all formats locally in your browser. Pro feature, no upload.',
    h1: 'Batch Export Video to Every Ratio',
    h2: 'Get all four social formats from one source file in a single export session.',
    howTo: {
      name: 'How to batch export a video to multiple aspect ratios for social media',
      description: 'CalmClip batch exports your video to 16:9, 9:16, 1:1, and 4:5 from a single source file, entirely in your browser.',
      totalTime: 'PT3M',
      step: [
        { position: 1, name: 'Open CalmClip and set up your edits', text: 'Drop your source video onto the page and configure your trim, captions, and other edits.' },
        { position: 2, name: 'Open the Batch Export section', text: 'Click the Batch Export tab. All four output ratios are listed: 16:9, 9:16, 1:1, and 4:5.' },
        { position: 3, name: 'Select the ratios you need', text: 'Check the ratios you want to export. CalmClip applies smart cropping automatically for each one.' },
        { position: 4, name: 'Start the batch', text: 'Click Start Batch. CalmClip exports each format one after the other in your browser. Each file downloads when ready.' },
      ],
    },
    faq: [
      { q: 'What ratios does batch export produce?', a: '16:9 (YouTube, landscape), 9:16 (TikTok, Reels, Shorts), 1:1 (Instagram feed), and 4:5 (portrait feed).' },
      { q: 'Does batch export require Pro?', a: 'Yes. Batch export is a Pro feature.' },
      { q: 'Do all ratios get the same edits?', a: 'Yes. Trim points, silence removal, captions, and audio normalization all apply to every format in the batch.' },
      { q: 'How long does a batch export take?', a: 'It depends on your CPU and the length of the video. Each format is exported sequentially in your browser.' },
      { q: 'Will the crop be different for each ratio?', a: 'Yes. Each ratio has its own crop, which CalmClip sets automatically or lets you adjust manually.' },
      { q: 'Can I export to only some of the ratios?', a: 'Yes. Choose which ratios you want before starting the batch.' },
    ],
  },
  {
    path: 'ai-video-transcription',
    title: 'AI Video Transcription | Local Whisper, No Upload | CalmClip',
    desc: 'Transcribe video audio using the Whisper model running locally in your browser. No cloud API, no upload. Accurate speech-to-text, fully private.',
    h1: 'Transcribe Video with Local AI',
    h2: 'Whisper runs in your browser. Accurate transcription without your audio ever leaving your device.',
    howTo: {
      name: 'How to transcribe video audio with local AI for free',
      description: 'CalmClip runs the Whisper speech recognition model locally in your browser via WebAssembly. No audio goes to a cloud service.',
      totalTime: 'PT3M',
      step: [
        { position: 1, name: 'Open CalmClip and load your video', text: 'Go to CalmClip in any modern browser and drop your video file onto the page.' },
        { position: 2, name: 'Open the Captions section', text: 'Click the Captions tab. The Whisper model downloads once to your browser cache and runs locally from then on.' },
        { position: 3, name: 'Run transcription', text: 'Click Transcribe. Whisper processes your audio locally and returns a word-level transcript with timestamps.' },
        { position: 4, name: 'Use the transcript', text: 'Edit captions, export with burned-in subtitles, or use the transcript for filler word removal. All local, all private.' },
      ],
    },
    faq: [
      { q: 'Does the transcription send audio to a server?', a: 'No. Whisper runs via WebAssembly in your browser. The audio is processed on your device.' },
      { q: 'What languages does Whisper support?', a: 'Whisper supports dozens of languages. It detects the language automatically and transcribes in it.' },
      { q: 'How accurate is it?', a: 'Whisper produces professional-grade accuracy for clear speech in most languages. Accuracy is reduced by heavy accents, background noise, or very fast speech.' },
      { q: 'Does transcription require Pro?', a: 'Yes. AI transcription is a Pro feature.' },
      { q: 'Can I edit the transcript?', a: 'Yes. Every word is editable in the caption editor. You can fix names, technical terms, and anything the model missed.' },
      { q: 'Does the Whisper model need to be downloaded each time?', a: 'No. It is cached in your browser after the first download.' },
    ],
  },
  {
    path: 'remove-filler-words',
    title: 'Remove Filler Words from Video | Auto-detect Um and Uh | CalmClip',
    desc: 'Automatically find and remove filler words like um, uh, like, and you know from video. Transcription-powered, browser-based, Pro feature.',
    h1: 'Remove Filler Words from Video Automatically',
    h2: 'Transcription-powered filler word detection. Review every cut before it happens.',
    howTo: {
      name: 'How to automatically remove filler words from a video',
      description: 'CalmClip transcribes your audio locally with Whisper, detects filler words, and lets you review each one before cutting.',
      totalTime: 'PT4M',
      step: [
        { position: 1, name: 'Open CalmClip and transcribe', text: 'Drop your video onto the page, open the Captions tab, and run transcription. Whisper generates a word-level transcript locally.' },
        { position: 2, name: 'Open the Filler Words panel', text: 'Click the Filler Words tab. CalmClip scans the transcript and marks every detected filler word.' },
        { position: 3, name: 'Review and approve cuts', text: 'See a list of every filler with its timestamp. Deselect any you want to keep before cutting.' },
        { position: 4, name: 'Export with fillers removed', text: 'Click Export. FFmpeg cuts every selected filler from the video and audio tracks and saves the cleaned version.' },
      ],
    },
    faq: [
      { q: 'How does CalmClip find filler words?', a: 'It transcribes your audio using the local Whisper model, then scans the transcript for common filler words like um, uh, like, you know, and others.' },
      { q: 'Can I customize which words are removed?', a: 'Yes. You can deselect specific instances before cutting so only the ones you approve are removed.' },
      { q: 'Does filler removal require Pro?', a: 'Yes. Filler word detection requires transcription, which is a Pro feature.' },
      { q: 'Will it cut mid-sentence?', a: 'It cuts only the detected filler word. The words around it are left intact. CalmClip handles the cut precisely at the word boundaries from the transcript.' },
      { q: 'Can I combine it with silence removal?', a: 'Yes. Both apply in the same export. The result removes both pauses and filler words.' },
      { q: 'Is my audio sent anywhere?', a: 'No. All transcription and processing runs locally in your browser.' },
    ],
  },
  {
    path: 'extract-video-thumbnail',
    title: 'Extract Thumbnail from Video | Frame Capture | CalmClip',
    desc: 'Grab any frame from your video as a full-resolution JPG. Scrub to the exact moment you want and download it in one click. Free, no upload.',
    h1: 'Extract a Thumbnail from Your Video',
    h2: 'Scrub to any frame and save it as a full-resolution JPG. Free, no upload, instant.',
    howTo: {
      name: 'How to extract a thumbnail from a video for free',
      description: 'CalmClip lets you grab any frame from your video as a full-resolution JPG directly in your browser. Nothing uploads.',
      totalTime: 'PT1M',
      step: [
        { position: 1, name: 'Open CalmClip and load your video', text: 'Go to CalmClip in any modern browser and drop your video file onto the page.' },
        { position: 2, name: 'Open the Thumbnail section', text: 'Click the Thumbnail tab in the editor sidebar.' },
        { position: 3, name: 'Scrub to the frame you want', text: 'Use the playback controls or scrub the timeline to find the exact frame you want to extract.' },
        { position: 4, name: 'Download the JPG', text: 'Click Extract. CalmClip captures the frame at full resolution and downloads it as a JPG to your device.' },
      ],
    },
    faq: [
      { q: 'What format is the thumbnail?', a: 'JPG. Extracted at the full resolution of the video frame.' },
      { q: 'Is thumbnail extraction free?', a: 'Yes. Thumbnail extraction is a free feature.' },
      { q: 'Can I choose any frame?', a: 'Yes. Scrub the video to any point and extract that frame.' },
      { q: 'Does it upload my video to extract a frame?', a: 'No. The frame extraction runs locally in your browser.' },
      { q: 'Can I extract multiple thumbnails?', a: 'You can extract one frame at a time. Scrub to a new position and extract again for a second thumbnail.' },
      { q: 'What resolution will the thumbnail be?', a: 'The same as the video resolution. A 1080p video produces a 1920x1080 JPG thumbnail.' },
    ],
  },
  {
    path: 'denoise-audio-online',
    title: 'Remove Background Noise from Video | Audio Denoiser | CalmClip',
    desc: 'Strip background hum, fan noise, and room echo from your video audio in one export pass. Browser-based, free, no upload required. Combine with loudness normalization.',
    h1: 'Remove Background Noise from Video',
    h2: 'Strip fan noise, HVAC hum, and room echo from your audio locally in your browser.',
    howTo: {
      name: 'How to remove background noise from a video for free',
      description: 'CalmClip uses FFmpeg compiled to WebAssembly to denoise your video audio entirely in your browser. Nothing uploads.',
      totalTime: 'PT1M',
      step: [
        { position: 1, name: 'Open CalmClip and load your video', text: 'Go to CalmClip in any modern browser and drop your video file onto the page. Nothing uploads.' },
        { position: 2, name: 'Open the Audio section', text: 'Click the Audio tab in the editor sidebar. You will see the loudness normalization controls and the denoising toggle.' },
        { position: 3, name: 'Enable audio denoising', text: 'Toggle denoising on. CalmClip applies FFmpeg noise reduction during export. No audio is sent to any cloud service.' },
        { position: 4, name: 'Export the cleaned video', text: 'Click Export. FFmpeg removes the background noise locally and saves the result to your device.' },
      ],
    },
    faq: [
      { q: 'Does CalmClip upload my audio to denoise it?', a: 'No. Denoising runs via FFmpeg compiled to WebAssembly in your browser. Your audio stays on your device at all times.' },
      { q: 'What types of noise does it remove?', a: 'CalmClip uses FFmpeg noise reduction, which works best on steady-state noise: HVAC hum, fan noise, electrical hiss, and room tone. It is less effective on intermittent noise like coughs or car horns.' },
      { q: 'Does denoising require Pro?', a: 'No. Audio denoising is a free feature. Enable it in the Audio section alongside loudness normalization.' },
      { q: 'Will denoising affect the voice quality?', a: 'Aggressive noise reduction can introduce artifacts in the speech. CalmClip uses a moderate setting that removes clear noise without degrading voice quality in most recordings.' },
      { q: 'Can I combine denoising with loudness normalization?', a: 'Yes. Enable both in the Audio section. They apply in the same FFmpeg export pass, so your audio is both cleaned and leveled in one step.' },
      { q: 'What formats does it work with?', a: 'Any video format CalmClip accepts: MP4, MOV, WebM, and MKV. The denoising applies to the audio track regardless of the container format.' },
    ],
  },
  {
    path: 'generate-video-chapters',
    title: 'Generate YouTube Chapters Automatically | AI Chapter Generator | CalmClip',
    desc: 'Auto-generate YouTube chapter timestamps and titles from your video transcript. Local Whisper AI finds the topic breaks. No upload. Pro feature.',
    h1: 'Generate Video Chapters Automatically',
    h2: 'AI reads your transcript, finds topic breaks, and formats YouTube chapter timestamps.',
    howTo: {
      name: 'How to auto-generate YouTube chapters from a video transcript',
      description: 'CalmClip transcribes your video with local Whisper, then generates chapter timestamps and titles ready to paste into YouTube.',
      totalTime: 'PT4M',
      step: [
        { position: 1, name: 'Open CalmClip and transcribe your video', text: 'Drop your video file onto the page, open the Captions tab, and run transcription. Whisper generates a word-level transcript locally.' },
        { position: 2, name: 'Open the Chapter Generator', text: 'Scroll to the Chapter Generator section below the transcript editor. It activates once transcription is complete.' },
        { position: 3, name: 'Review and rename chapters', text: 'CalmClip identifies topic shifts and generates chapter titles and timestamps. Review each chapter and rename any that need adjustment.' },
        { position: 4, name: 'Copy and paste into YouTube', text: 'Copy the formatted chapter list and paste it into your YouTube video description. Chapters appear automatically for viewers.' },
      ],
    },
    faq: [
      { q: 'How does CalmClip know where to put chapter breaks?', a: 'CalmClip analyzes the word-level transcript generated by Whisper and identifies topic transitions based on the content of what was said.' },
      { q: 'Does chapter generation require Pro?', a: 'Yes. Chapter generation requires AI transcription, which is a Pro feature.' },
      { q: 'What format does the chapter list use?', a: 'The output uses the YouTube chapter format: a timestamp followed by the chapter title on each line, starting with 0:00 for the first chapter.' },
      { q: 'Can I rename the generated chapters?', a: 'Yes. Every generated chapter title is editable before you copy the list.' },
      { q: 'How many chapters will it generate?', a: 'The number depends on your video content. A 10-minute tutorial might get 4 to 6 chapters. A 60-minute interview might get 8 to 12.' },
      { q: 'Does it work for non-English videos?', a: 'Yes. Whisper detects the language automatically. Chapter generation works on any language the transcription supports.' },
    ],
  },
  {
    path: 'video-editor-no-upload',
    title: 'Online Video Editor with No Upload | 100% Local Processing | CalmClip',
    desc: 'Edit video online without uploading to any server. CalmClip runs FFmpeg and Whisper entirely in your browser. Trim, caption, resize, and export locally. Free.',
    h1: 'Online Video Editor with No Upload',
    h2: 'FFmpeg and Whisper AI run inside your browser. Your file never leaves your machine.',
    howTo: {
      name: 'How to edit video online without uploading it to a server',
      description: 'CalmClip uses FFmpeg and Whisper compiled to WebAssembly so all video editing runs locally in your browser. No upload, no server, no waiting.',
      totalTime: 'PT2M',
      step: [
        { position: 1, name: 'Open CalmClip in your browser', text: 'Go to CalmClip. No account, no install, no Chrome extension. The editor loads in a few seconds.' },
        { position: 2, name: 'Drop your video file', text: 'Drag your MP4, MOV, WebM, or MKV onto the page, or click to browse. The file opens immediately because nothing uploads.' },
        { position: 3, name: 'Choose your edits', text: 'Trim, add captions, remove silence, blur faces, resize to any ratio, normalize loudness, strip metadata, or batch export to all social formats.' },
        { position: 4, name: 'Export directly to your device', text: 'Click Export. FFmpeg processes your video in the browser and saves the file to your device. No cloud render queue.' },
      ],
    },
    faq: [
      { q: 'How does CalmClip edit video without a server?', a: 'CalmClip compiles FFmpeg to WebAssembly (WASM), which lets it run as a native-speed binary inside your browser. The browser itself becomes the video processing engine.' },
      { q: 'Is the no-upload claim actually true?', a: 'Yes. You can verify it yourself: disconnect from the internet after the page loads and try editing and exporting. Everything still works because no network requests are needed for editing.' },
      { q: 'What is the maximum file size?', a: 'CalmClip supports files up to 4 GB. The limit is your browser and device RAM, not an upload cap.' },
      { q: 'Does it work on slow internet connections?', a: 'Once CalmClip loads in your browser, you can work offline. The only network activity is the initial page load and, if you use AI transcription, the one-time Whisper model download.' },
      { q: 'What editing tools are available?', a: 'Trim and cut, AI captions and transcription, silence removal, filler word removal, face blur, watermark overlay, aspect ratio resize, batch export, loudness normalization, audio denoising, metadata stripping, thumbnail extraction, and screen recording.' },
      { q: 'Is it really free?', a: 'Yes. All core editing tools are free with no account required. A Pro licence unlocks AI transcription, captions, filler word removal, face blur, watermark overlay, and batch export.' },
    ],
  },
  {
    path: 'crop-video-for-tiktok',
    title: 'Crop Video to 9:16 for TikTok | Free, No Upload | CalmClip',
    desc: 'Convert landscape or square video to 9:16 vertical format for TikTok. Free browser tool, no upload, no watermark. Drag the crop to frame your subject.',
    h1: 'Crop Video to 9:16 for TikTok',
    h2: 'Convert any landscape or square video to vertical TikTok format instantly in your browser.',
    howTo: {
      name: 'How to crop a video to 9:16 for TikTok for free',
      description: 'CalmClip resizes and crops video to the TikTok 9:16 format entirely in your browser. No upload, no watermark, no account.',
      totalTime: 'PT1M',
      step: [
        { position: 1, name: 'Open CalmClip and load your video', text: 'Go to CalmClip in any modern browser and drop your video onto the page. Nothing uploads.' },
        { position: 2, name: 'Select the 9:16 ratio', text: 'In the resize panel, choose 9:16. This is the standard TikTok format: 1080x1920 pixels at full HD.' },
        { position: 3, name: 'Adjust the crop frame', text: 'Drag the crop box to center your subject in the vertical frame. Use Smart Center to let CalmClip pick automatically.' },
        { position: 4, name: 'Export and upload to TikTok', text: 'Click Export. CalmClip saves a 9:16 MP4 to your device. Upload directly to TikTok without any extra conversion.' },
      ],
    },
    faq: [
      { q: 'What is the correct aspect ratio for TikTok?', a: '9:16 vertical, which is 1080x1920 pixels at full HD. CalmClip crops to this ratio automatically.' },
      { q: 'Will it crop out important parts of my video?', a: 'By default, CalmClip centers the crop. Drag the crop box to reposition it over the most important part of the frame.' },
      { q: 'Is cropping for TikTok free?', a: 'Yes. Single-ratio export including 9:16 is a free feature with no watermark.' },
      { q: 'Does the cropped video meet TikTok upload requirements?', a: 'CalmClip exports MP4 files. TikTok accepts MP4. Make sure to trim your clip to TikTok length requirements before exporting.' },
      { q: 'Can I also add captions for TikTok?', a: 'Yes. Add captions in the Captions section before exporting. The burned-in captions are included in the cropped export.' },
      { q: 'Can I export all formats at once?', a: 'Yes, with Pro. Batch export produces 9:16, 1:1, 4:5, and 16:9 from one source file in a single pass.' },
    ],
  },
  {
    path: 'crop-video-for-instagram',
    title: 'Crop Video for Instagram Reels, Feed, and Stories | CalmClip',
    desc: 'Resize video to 9:16 for Reels, 1:1 for the Instagram feed, or 4:5 for portrait posts. Free browser tool, no upload, no watermark.',
    h1: 'Crop Video for Every Instagram Format',
    h2: 'Resize to 9:16 for Reels, 1:1 for the feed, and 4:5 for portrait in one session.',
    howTo: {
      name: 'How to resize a video for Instagram Reels, feed, and Stories for free',
      description: 'CalmClip resizes video to any Instagram format entirely in your browser. No upload, no watermark, no account.',
      totalTime: 'PT1M',
      step: [
        { position: 1, name: 'Open CalmClip and load your video', text: 'Go to CalmClip in any modern browser and drop your video file onto the page. Nothing uploads.' },
        { position: 2, name: 'Choose your Instagram format', text: 'Pick 9:16 for Reels and Stories, 1:1 for the standard feed square, or 4:5 for the portrait format that fills more of the feed.' },
        { position: 3, name: 'Position the crop', text: 'Drag the crop frame to center your subject. Switch between ratios to preview each format before committing.' },
        { position: 4, name: 'Export and post to Instagram', text: 'Click Export. CalmClip saves the resized MP4 to your device. Post directly to Instagram.' },
      ],
    },
    faq: [
      { q: 'What aspect ratios does Instagram support for video?', a: '9:16 for Reels and Stories, 1:1 for the standard feed square format, and 4:5 for portrait feed posts which take up more screen space.' },
      { q: 'Which ratio should I use for Instagram Reels?', a: '9:16 is the standard for Reels. It fills the full screen on mobile, which is what Instagram is optimized for.' },
      { q: 'Is resizing for Instagram free?', a: 'Yes. Resizing to any single ratio is a free feature with no watermark.' },
      { q: 'Can I get all three Instagram formats at once?', a: 'Yes, with Pro. Batch export produces multiple ratios from one source file in a single pass.' },
      { q: 'Does it add captions to the resized video?', a: 'Yes. Add captions in the Captions section and they are included in the resized export.' },
      { q: 'Can I control where the crop falls?', a: 'Yes. Drag the crop frame to any position, or use Smart Center to let CalmClip pick automatically.' },
    ],
  },
  {
    path: 'crop-video-for-youtube-shorts',
    title: 'Crop Video for YouTube Shorts | 9:16 Format | CalmClip',
    desc: 'Convert your landscape YouTube video to 9:16 for YouTube Shorts. Free browser tool, no upload, no watermark. Trim to under 3 minutes in the same session.',
    h1: 'Crop Video for YouTube Shorts',
    h2: 'Convert landscape footage to 9:16 and trim to Shorts length in one session.',
    howTo: {
      name: 'How to crop a video for YouTube Shorts for free',
      description: 'CalmClip trims and crops video to the YouTube Shorts 9:16 format entirely in your browser. No upload, no watermark.',
      totalTime: 'PT2M',
      step: [
        { position: 1, name: 'Open CalmClip and load your video', text: 'Go to CalmClip in any modern browser and drop your video onto the page. Nothing uploads.' },
        { position: 2, name: 'Trim to the right length', text: 'Use the trim handles to cut your clip to under 3 minutes. YouTube Shorts must be under 3 minutes; under 60 seconds performs best.' },
        { position: 3, name: 'Select the 9:16 ratio', text: 'Choose 9:16 in the resize panel. Drag the crop box to keep your subject in frame.' },
        { position: 4, name: 'Export and upload to Shorts', text: 'Click Export. CalmClip saves a 9:16 MP4 to your device ready for upload to YouTube Shorts.' },
      ],
    },
    faq: [
      { q: 'What is the maximum length for YouTube Shorts?', a: 'YouTube Shorts must be under 3 minutes. Videos under 60 seconds are shown first in the Shorts feed. Use the CalmClip trim tool to cut your clip to the right length.' },
      { q: 'What aspect ratio do YouTube Shorts need?', a: '9:16 vertical. This is the same ratio as TikTok and Instagram Reels.' },
      { q: 'Is cropping for Shorts free?', a: 'Yes. The 9:16 crop and single-format export are free features.' },
      { q: 'Can I add captions to my Short?', a: 'Yes. Add captions in the Captions section before exporting. They are burned into the final 9:16 video.' },
      { q: 'What video format should I upload to YouTube Shorts?', a: 'YouTube Shorts accepts MP4, MOV, and AVI. CalmClip exports MP4 by default, which is the recommended format.' },
      { q: 'Can I trim and crop in the same export?', a: 'Yes. Set your trim points and select 9:16 before exporting. Both apply in a single FFmpeg pass.' },
    ],
  },
  {
    path: 'video-editor-for-lawyers',
    title: 'Privacy-Safe Video Editor for Lawyers and Legal Teams | CalmClip',
    desc: 'Edit deposition recordings, court footage, and privileged video locally in your browser. CalmClip never uploads your footage to a server. Face blur, transcription, trim.',
    h1: 'Video Editor for Lawyers and Legal Teams',
    h2: 'Deposition recordings and court footage processed locally. No server ever sees a frame.',
    howTo: {
      name: 'How to edit legal video footage privately without uploading it',
      description: 'CalmClip processes deposition recordings, court footage, and privileged video entirely in your browser. No server contact, no cloud storage.',
      totalTime: 'PT2M',
      step: [
        { position: 1, name: 'Open your video locally', text: 'Drop your deposition, interview, or court footage onto CalmClip. The file never uploads. Processing begins immediately on your device.' },
        { position: 2, name: 'Trim to relevant sections', text: 'Use the trim tool to cut to the testimony or footage segments you need for case preparation.' },
        { position: 3, name: 'Blur faces and strip metadata', text: 'Use the face blur tool to redact identities. Open the Privacy section to strip GPS coordinates and device information before export.' },
        { position: 4, name: 'Export a clean redacted copy', text: 'Click Export. CalmClip saves a new file with your edits applied. Your original footage is never altered.' },
      ],
    },
    faq: [
      { q: 'Is CalmClip suitable for privileged legal footage?', a: 'CalmClip processes all video locally in the browser using WebAssembly. No footage, audio, or metadata is transmitted to any external server. The suitability for specific privilege or confidentiality requirements is a determination your firm must make.' },
      { q: 'Does CalmClip store any video data?', a: 'No. CalmClip processes your video in browser memory and writes the output directly to your device. Nothing is stored on any CalmClip server because no server is involved.' },
      { q: 'Can I redact faces and identities?', a: 'Yes. The face blur tool uses a local ONNX model to detect and blur faces. You can also draw manual blur regions over any area of the frame.' },
      { q: 'Does the transcription use a cloud API?', a: 'No. CalmClip uses the Whisper model compiled to WebAssembly, running entirely in the browser. No audio leaves your device during transcription.' },
      { q: 'Can I use CalmClip on a firm-managed device?', a: 'CalmClip is a web app that runs in any modern browser. It requires no installation, no admin rights, and no software deployment. It works on any managed device that allows standard web browsing.' },
      { q: 'What happens to my video when I close the tab?', a: 'Your video is processed in browser memory. Closing the tab clears it. Nothing persists on any server. Export your edited video before closing.' },
    ],
  },
  {
    path: 'video-editor-for-journalists',
    title: 'Private Video Editor for Journalists | No Upload | CalmClip',
    desc: 'Edit source footage, field recordings, and interview video without uploading to a cloud service. Face blur, metadata stripping, local transcription. Free.',
    h1: 'Video Editor for Journalists and Investigators',
    h2: 'Source footage and field recordings edited locally. No cloud service ever sees your video.',
    howTo: {
      name: 'How to edit source footage and field recordings privately without uploading',
      description: 'CalmClip processes journalist footage, source interview video, and field recordings entirely in your browser. No upload, no cloud record.',
      totalTime: 'PT2M',
      step: [
        { position: 1, name: 'Open your footage locally', text: 'Drop your field recording, interview video, or documentary footage onto CalmClip. The file never uploads. Editing starts immediately.' },
        { position: 2, name: 'Blur faces and strip GPS', text: 'Use the face blur tool to protect source identities. Open the Privacy section to strip GPS coordinates and device data from the file metadata.' },
        { position: 3, name: 'Transcribe and trim', text: 'Transcribe interview audio using local Whisper AI, then trim to the quotes and moments you need. All local, all private.' },
        { position: 4, name: 'Export the clean version', text: 'Click Export. CalmClip saves a new file with blurred faces, stripped metadata, and your edits. Your original footage is never altered.' },
      ],
    },
    faq: [
      { q: 'Does CalmClip upload my footage to any server?', a: 'No. CalmClip uses FFmpeg and Whisper compiled to WebAssembly running in your browser. No frame, no audio byte, and no metadata is transmitted to any external server.' },
      { q: 'How does CalmClip blur source faces?', a: 'The face detection model runs locally using ONNX Runtime Web. Unblurred frames never leave your device. You can also draw manual blur regions over any area.' },
      { q: 'Can I strip GPS coordinates from field recordings?', a: 'Yes. Open the Privacy section. CalmClip scans your video for embedded GPS coordinates, device info, and timestamps, and removes them during export.' },
      { q: 'Does the transcription create any record of my source material?', a: 'No. Transcription uses the Whisper model running locally in WebAssembly. No audio leaves your device. No record is created on any external server.' },
      { q: 'Can CalmClip work without internet access?', a: 'Yes, after the first page load. The WASM engine and, once downloaded, the Whisper model are cached in your browser. Editing and exporting work fully offline.' },
      { q: 'Is the face blur accurate enough for source protection?', a: 'Automatic detection is accurate for most front-facing frames. For critical source protection, use the manual blur region tool to draw a blur box over the face directly, ensuring complete coverage.' },
    ],
  },
]

function buildHowToSchema(howTo) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: howTo.name,
    description: howTo.description,
    totalTime: howTo.totalTime,
    tool: [{ '@type': 'HowToTool', name: 'CalmClip (free, browser-based)' }],
    step: howTo.step.map(s => ({
      '@type': 'HowToStep',
      position: s.position,
      name: s.name,
      text: s.text,
    })),
  }, null, 2)
}

function buildFaqSchema(faq) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  }, null, 2)
}

function buildFooter(routes) {
  const links = routes
    .map(r => `<a href="/${r.path}" style="font-size:13px;color:hsl(340,82%,58%);text-decoration:none;white-space:nowrap;">${r.title.split('|')[0].trim()}</a>`)
    .join('\n      ')
  return `<footer style="background:hsl(240,6%,7%);border-top:1px solid rgba(255,255,255,0.08);padding:32px 24px;font-family:'Inter',system-ui,sans-serif;">
  <div style="max-width:820px;margin:0 auto;">
    <p style="font-size:11px;color:rgba(255,255,255,0.55);margin:0 0 16px 0;font-weight:500;letter-spacing:0.56px;text-transform:uppercase;">Free browser tools</p>
    <div style="display:flex;flex-wrap:wrap;gap:12px;">
      ${links}
    </div>
    <p style="margin:24px 0 0 0;font-size:12px;"><a href="/privacy.html" style="color:rgba(255,255,255,0.35);text-decoration:none;">Privacy policy</a></p>
  </div>
</footer>`
}

const indexPath = resolve(distDir, 'index.html')
if (existsSync(indexPath)) {
  const baseHtml = readFileSync(indexPath, 'utf8')
  const footer = buildFooter(seoRoutes)

  for (const route of seoRoutes) {
    const routeDir = resolve(distDir, route.path)
    if (!existsSync(routeDir)) {
      mkdirSync(routeDir, { recursive: true })
    }

    const howToScriptBlock = `<!-- HOWTO_SCHEMA_START -->\n    <script type="application/ld+json">\n    ${buildHowToSchema(route.howTo)}\n    </script>\n    <!-- HOWTO_SCHEMA_END -->`

    let html = baseHtml
      .replace(/<title>.*?<\/title>/, `<title>${route.title}</title>`)
      .replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${route.desc}"`)
      .replace(/<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="https://calmclip.video/${route.path}"`)
      .replace(/<meta property="og:title" content="[^"]*"/, `<meta property="og:title" content="${route.title}"`)
      .replace(/<meta property="og:description" content="[^"]*"/, `<meta property="og:description" content="${route.desc}"`)
      .replace(/<meta property="og:url" content="[^"]*"/, `<meta property="og:url" content="https://calmclip.video/${route.path}"`)
      .replace(/<meta name="twitter:title" content="[^"]*"/, `<meta name="twitter:title" content="${route.title}"`)
      .replace(/<meta name="twitter:description" content="[^"]*"/, `<meta name="twitter:description" content="${route.desc}"`)
      .replace(/<!-- HOWTO_SCHEMA_START -->[\s\S]*?<!-- HOWTO_SCHEMA_END -->/, howToScriptBlock)

    html = html
      .replace(/<h1>.*?<\/h1>/, `<h1>${route.h1}</h1>`)
      .replace(/<p>Trim, caption.*?<\/p>/, `<p>${route.h2} ${route.desc}</p>`)

    if (route.faq && route.faq.length > 0) {
      const faqSchemaTag = `  <script type="application/ld+json">\n  ${buildFaqSchema(route.faq)}\n  </script>`
      html = html.replace('</head>', `${faqSchemaTag}\n</head>`)
    }

    html = html.replace('</body>', `${footer}\n</body>`)

    writeFileSync(resolve(routeDir, 'index.html'), html, 'utf8')
    console.log(`[seo-routes] Generated /${route.path}`)
  }
}
