import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PUBLIC_SITEMAP_PATHS } from '../src/seo/keaDiscovery.ts'
import { applySeoToHtml } from '../src/seo/keaPublicHtml.ts'
import { htmlFileForPath } from '../src/seo/keaSeo.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const indexPath = join(dist, 'index.html')
const indexHtml = readFileSync(indexPath, 'utf8')

writeFileSync(indexPath, applySeoToHtml(indexHtml, '/'))

for (const path of PUBLIC_SITEMAP_PATHS) {
  if (path === '/') continue
  const file = htmlFileForPath(path)
  writeFileSync(join(dist, file), applySeoToHtml(indexHtml, path))
  console.log(`Wrote dist/${file}`)
}
