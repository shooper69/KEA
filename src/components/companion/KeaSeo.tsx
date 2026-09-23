import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  KEA_NAME,
  KEA_ORIGIN,
  canonicalUrl,
  seoForPath,
} from '../../seo/keaSeo'

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
    const image = `${KEA_ORIGIN}/kea-mark.png`
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
    upsertMeta('property', 'og:image', image)
    upsertMeta('property', 'og:image:alt', 'Kea')
    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', seo.title)
    upsertMeta('name', 'twitter:description', seo.description)
    upsertMeta('name', 'twitter:image', image)
  }, [pathname])

  return null
}
