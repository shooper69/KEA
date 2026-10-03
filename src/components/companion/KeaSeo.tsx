import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  KEA_NAME,
  OG_IMAGE,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  canonicalUrl,
  jsonLdForPath,
  seoForPath,
} from '../../seo/keaSeo.ts'

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  const selector = `meta[${attr}="${key}"]`
  let node = document.head.querySelector(selector)
  if (!node) {
    node = document.createElement('meta')
    node.setAttribute(attr, key)
    document.head.appendChild(node)
  }
  node.setAttribute('content', content)
}

function upsertLink(rel: string, href: string) {
  let node = document.head.querySelector(`link[rel="${rel}"]`)
  if (!node) {
    node = document.createElement('link')
    node.setAttribute('rel', rel)
    document.head.appendChild(node)
  }
  node.setAttribute('href', href)
}

export function KeaSeo() {
  const { pathname } = useLocation()

  useEffect(() => {
    const seo = seoForPath(pathname)
    const url = canonicalUrl(seo.path)
    document.title = seo.title
    upsertMeta('name', 'description', seo.description)
    upsertMeta(
      'name',
      'robots',
      seo.index
        ? 'index, follow, max-image-preview:large'
        : 'noindex, nofollow',
    )
    upsertMeta('name', 'author', KEA_NAME)
    upsertLink('canonical', url)
    upsertMeta('property', 'og:type', 'website')
    upsertMeta('property', 'og:site_name', KEA_NAME)
    upsertMeta('property', 'og:locale', 'en_GB')
    upsertMeta('property', 'og:title', seo.title)
    upsertMeta('property', 'og:description', seo.description)
    upsertMeta('property', 'og:url', url)
    upsertMeta('property', 'og:image', OG_IMAGE)
    upsertMeta('property', 'og:image:secure_url', OG_IMAGE)
    upsertMeta('property', 'og:image:type', 'image/png')
    upsertMeta('property', 'og:image:width', String(OG_IMAGE_WIDTH))
    upsertMeta('property', 'og:image:height', String(OG_IMAGE_HEIGHT))
    upsertMeta('property', 'og:image:alt', 'Kea')
    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', seo.title)
    upsertMeta('name', 'twitter:description', seo.description)
    upsertMeta('name', 'twitter:image', OG_IMAGE)
    upsertMeta('name', 'twitter:image:alt', 'Kea')
    const alternate = document.head.querySelector(
      'link[rel="alternate"][type="text/plain"]',
    )
    if (seo.index) {
      let node = alternate
      if (!node) {
        node = document.createElement('link')
        node.setAttribute('rel', 'alternate')
        node.setAttribute('type', 'text/plain')
        node.setAttribute('title', 'LLM brief')
        document.head.appendChild(node)
      }
      node.setAttribute('href', 'https://kea.chat/llms.txt')
    } else if (alternate) {
      alternate.remove()
    }
    let jsonLd = document.getElementById('kea-json-ld')
    if (!jsonLd) {
      jsonLd = document.createElement('script')
      jsonLd.id = 'kea-json-ld'
      jsonLd.setAttribute('type', 'application/ld+json')
      document.head.appendChild(jsonLd)
    }
    jsonLd.textContent = JSON.stringify(jsonLdForPath(pathname))
  }, [pathname])

  return null
}
