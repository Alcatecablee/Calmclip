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

function buildFooter(routes) {
  const links = routes
    .map(r => `<a href="/${r.path}" style="font-size:13px;color:#03a9f4;text-decoration:none;white-space:nowrap;">${r.title.split('|')[0].trim()}</a>`)
    .join('\n      ')
  return `<footer style="background:#ffffff;border-top:1px solid #e4e4e8;padding:32px 24px;font-family:Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:820px;margin:0 auto;">
    <p style="font-size:12px;color:rgba(15,15,17,0.44);margin:0 0 16px 0;font-weight:500;letter-spacing:0.56px;text-transform:uppercase;">More free browser tools</p>
    <div style="display:flex;flex-wrap:wrap;gap:12px;">
      ${links}
    </div>
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

    html = html.replace('</body>', `${footer}\n</body>`)

    writeFileSync(resolve(routeDir, 'index.html'), html, 'utf8')
    console.log(`[seo-routes] Generated /${route.path}`)
  }
}
