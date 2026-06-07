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
