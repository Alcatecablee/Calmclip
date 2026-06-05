import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sitemapPath = resolve(__dirname, '../public/sitemap.xml')
const swPath      = resolve(__dirname, '../public/sw.js')

const today = new Date().toISOString().slice(0, 10)

const updatedXml = readFileSync(sitemapPath, 'utf8').replace(
  /<lastmod>[^<]*<\/lastmod>/g,
  `<lastmod>${today}</lastmod>`
)
writeFileSync(sitemapPath, updatedXml, 'utf8')
console.log(`[sitemap] lastmod updated to ${today}`)

const updatedSw = readFileSync(swPath, 'utf8').replace(
  /const SITEMAP_LASTMOD = '[^']*'/,
  `const SITEMAP_LASTMOD = '${today}'`
)
writeFileSync(swPath, updatedSw, 'utf8')
console.log(`[sitemap] sw.js SITEMAP_LASTMOD updated to ${today}`)
