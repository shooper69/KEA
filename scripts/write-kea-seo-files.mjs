import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  keaLlmsTxt,
  keaSitemapXml,
  keaWhatIsKeaHtml,
  robotsTxt,
} from '../src/seo/keaDiscovery.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pub = join(root, 'assets', 'images')
const origin = 'https://kea.chat'

writeFileSync(join(pub, 'sitemap.xml'), keaSitemapXml(origin))
writeFileSync(join(pub, 'robots.txt'), robotsTxt(origin))
writeFileSync(join(pub, 'llms.txt'), keaLlmsTxt(origin))
writeFileSync(join(pub, 'what-is-kea.html'), keaWhatIsKeaHtml(origin))
console.log('Wrote sitemap.xml, robots.txt, llms.txt, what-is-kea.html')
