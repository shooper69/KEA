import { keaSitemapXml } from '../../src/seo/keaDiscovery'

const ORIGIN = 'https://kea.chat'

export async function handler(event: { httpMethod?: string }) {
  const method = (event.httpMethod || 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') {
    return { statusCode: 405, body: 'Method not allowed' }
  }
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
    body: method === 'HEAD' ? '' : keaSitemapXml(ORIGIN),
  }
}
