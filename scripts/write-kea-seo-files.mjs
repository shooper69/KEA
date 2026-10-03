import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'
import {
  keaLlmsTxt,
  keaSitemapXml,
  keaWhatIsKeaHtml,
  robotsTxt,
} from '../src/seo/keaDiscovery.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pub = join(root, 'assets', 'images')
const origin = 'https://kea.chat'
const OG_IMAGE_WIDTH = 1200
const OG_IMAGE_HEIGHT = 630

function crc32(buffer) {
  let crc = 0xffffffff
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i]
    for (let bit = 0; bit < 8; bit += 1) {
      const take = crc & 1
      crc >>>= 1
      if (take) crc ^= 0xedb88320
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function writeOgImage(filePath) {
  const width = OG_IMAGE_WIDTH
  const height = OG_IMAGE_HEIGHT
  const row = Buffer.alloc(1 + width * 3)
  row[0] = 0
  for (let x = 0; x < width; x += 1) {
    const i = 1 + x * 3
    row[i] = 0x4e
    row[i + 1] = 0xc4
    row[i + 2] = 0xd4
  }
  const raw = Buffer.alloc(row.length * height)
  for (let y = 0; y < height; y += 1) row.copy(raw, y * row.length)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
  writeFileSync(filePath, png)
}

writeOgImage(join(pub, 'og-image.png'))
writeFileSync(join(pub, 'sitemap.xml'), keaSitemapXml(origin))
writeFileSync(join(pub, 'robots.txt'), robotsTxt(origin))
writeFileSync(join(pub, 'llms.txt'), keaLlmsTxt(origin))
writeFileSync(join(root, 'llms.txt'), keaLlmsTxt(origin))
writeFileSync(join(pub, 'what-is-kea.html'), keaWhatIsKeaHtml(origin))
console.log('Wrote sitemap.xml, robots.txt, llms.txt, what-is-kea.html, og-image.png')
