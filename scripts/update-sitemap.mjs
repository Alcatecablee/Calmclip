import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { seoRoutes } from './build-seo-routes.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sitemapPath = resolve(__dirname, '../public/sitemap.xml')
const swPath      = resolve(__dirname, '../public/sw.js')

const today = new Date().toISOString().slice(0, 10)

const urls = [
  `<url><loc>https://calmclip.video/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
  `<url><loc>https://calmclip.video/privacy.html</loc><lastmod>${today}</lastmod><changefreq>yearly</changefreq><priority>0.4</priority></url>`
]

for (const route of seoRoutes) {
  urls.push(`<url><loc>https://calmclip.video/${route.path}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>`)
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls.join('\n  ')}
</urlset>`

writeFileSync(sitemapPath, xml, 'utf8')
console.log(`[sitemap] generated with ${urls.length} URLs, lastmod ${today}`)

const updatedSw = readFileSync(swPath, 'utf8').replace(
  /const SITEMAP_LASTMOD = '[^']*'/,
  `const SITEMAP_LASTMOD = '${today}'`
)
writeFileSync(swPath, updatedSw, 'utf8')
console.log(`[sitemap] sw.js SITEMAP_LASTMOD updated to ${today}`)
