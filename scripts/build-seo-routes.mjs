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
    h2: 'Cut and split videos instantly without uploading a single byte to a server.'
  },
  {
    path: 'add-captions-to-video',
    title: 'Add Captions to Video Free | Local AI Transcription | CalmClip',
    desc: 'Generate highly accurate subtitles and add captions to video automatically using local AI. Whisper runs natively in your browser. Zero uploads.',
    h1: 'Add Captions to Video Automatically',
    h2: 'Use local AI to transcribe and caption your videos directly in your browser.'
  },
  {
    path: 'remove-silence-from-video',
    title: 'Remove Silence & Dead Air from Video | CalmClip',
    desc: 'Automatically remove silence, pauses, and dead air from podcasts, lectures, and interviews. Browser-based, incredibly fast, and free.',
    h1: 'Remove Silence from Video Instantly',
    h2: 'Automatically cut dead air and pauses to make your videos more engaging.'
  },
  {
    path: 'face-blur-video',
    title: 'Blur Faces in Video Online | Privacy Safe | CalmClip',
    desc: 'Automatically detect and blur faces in videos online. Because CalmClip runs 100% locally in your browser, your unedited video never touches a server.',
    h1: 'Privacy-Safe Face Blur Editor',
    h2: 'Censor and blur faces in video without ever uploading the original file.'
  },
  {
    path: 'resize-video-online',
    title: 'Resize Video for Instagram, TikTok, YouTube | CalmClip',
    desc: 'Crop, fit, and resize videos to 9:16, 1:1, or 4:5 aspect ratios instantly in your browser. Free online video resizer with no watermark.',
    h1: 'Resize Video Online for Any Platform',
    h2: 'Easily crop and scale your videos for TikTok, Instagram Reels, and YouTube Shorts.'
  }
]

// Only run if dist/index.html exists (i.e. post-build)
const indexPath = resolve(distDir, 'index.html')
if (existsSync(indexPath)) {
  const baseHtml = readFileSync(indexPath, 'utf8')

  // Generate internal linking block
  const internalLinks = seoRoutes.map(r => `<li><a href="/${r.path}">${r.title.split('|')[0].trim()}</a></li>`).join('')
  const navBlock = `<nav style="display:none;" aria-hidden="true"><ul>${internalLinks}</ul></nav>`

  for (const route of seoRoutes) {
    const routeDir = resolve(distDir, route.path)
    if (!existsSync(routeDir)) {
      mkdirSync(routeDir, { recursive: true })
    }

    // Replace SEO metadata
    let html = baseHtml
      .replace(/<title>.*?<\/title>/, `<title>${route.title}</title>`)
      .replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${route.desc}"`)
      .replace(/<meta property="og:title" content="[^"]*"/, `<meta property="og:title" content="${route.title}"`)
      .replace(/<meta property="og:description" content="[^"]*"/, `<meta property="og:description" content="${route.desc}"`)
      .replace(/<meta property="og:url" content="[^"]*"/, `<meta property="og:url" content="https://calmclip.video/${route.path}"`)
      .replace(/<meta name="twitter:title" content="[^"]*"/, `<meta name="twitter:title" content="${route.title}"`)
      .replace(/<meta name="twitter:description" content="[^"]*"/, `<meta name="twitter:description" content="${route.desc}"`)

    // Replace noscript H1 and P for Googlebot
    html = html
      .replace(/<h1>.*?<\/h1>/, `<h1>${route.h1}</h1>`)
      .replace(/<p>Trim, caption.*?<\/p>/, `<p>${route.h2} ${route.desc}</p>`)

    // Inject internal navigation just before closing body
    html = html.replace('</body>', `${navBlock}</body>`)

    writeFileSync(resolve(routeDir, 'index.html'), html, 'utf8')
    console.log(`[seo-routes] Generated /${route.path}`)
  }
}
