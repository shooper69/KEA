import {
  DISCOVERY_CONTACT,
  DISCOVERY_DEFINITION,
  DISCOVERY_FAQS,
  DISCOVERY_HOW,
  DISCOVERY_LANGUAGES,
  DISCOVERY_NOT,
  DISCOVERY_PATH,
} from './keaDiscovery.ts'
import {
  KEA_DESCRIPTION,
  KEA_ORIGIN,
  OG_IMAGE,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  canonicalUrl,
  jsonLdForPath,
  seoForPath,
} from './keaSeo.ts'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function setMeta(
  html: string,
  attr: 'name' | 'property',
  key: string,
  content: string,
) {
  const escaped = escapeHtml(content)
  const pattern = new RegExp(
    `<meta ${attr}="${key}" content="[^"]*"\\s*/>`,
  )
  const tag = `<meta ${attr}="${key}" content="${escaped}" />`
  if (pattern.test(html)) return html.replace(pattern, tag)
  return html.replace('</head>', `    ${tag}\n  </head>`)
}

const METHOD_COPY = [
  {
    title: 'Not a course',
    body: 'Kea is not a language learning course. Kea is a language acquisition companion. No grammar books, verb tables, or tests.',
  },
  {
    title: 'Learn naturally',
    body: 'Listening, repetition, observation, emotion, and conversation. Understanding comes first. Speech follows.',
  },
  {
    title: 'Unstructured talk',
    body: 'You chat with a companion about everyday life. There is no lesson path and no gamified send-back to the start.',
  },
  {
    title: 'The Tech',
    body: 'Kea talks at your level, notices words you struggle with, and uses them until they belong to you.',
  },
  {
    title: 'Progress',
    body: 'Progress is the growing ease of conversation — not badges, streaks, or ads.',
  },
  {
    title: 'Rewards',
    body: 'Talk time is tracked quietly in the background. Keep talking; the rewards come from the conversation.',
  },
]

function publicNav() {
  return `      <nav aria-label="Site">
        <a href="${KEA_ORIGIN}/">Home</a>
        <a href="${KEA_ORIGIN}/method">The Method</a>
        <a href="${KEA_ORIGIN}/support">Support</a>
        <a href="${KEA_ORIGIN}/contact">Contact</a>
        <a href="${KEA_ORIGIN}/privacy-policy">Privacy</a>
      </nav>`
}

export function noscriptHtmlForPath(pathname: string) {
  const seo = seoForPath(pathname)
  const path = seo.path
  if (path === '/') {
    return `      <h1>Kea — language learning chatty companion</h1>
      <p>${escapeHtml(KEA_DESCRIPTION)}</p>
      <p>${escapeHtml(DISCOVERY_LANGUAGES)}</p>
${publicNav()}`
  }
  if (path === DISCOVERY_PATH) {
    const definition = DISCOVERY_DEFINITION.map(
      (paragraph) => `      <p>${escapeHtml(paragraph)}</p>`,
    ).join('\n')
    const notItems = DISCOVERY_NOT.map(
      (item) => `        <li>${escapeHtml(item)}</li>`,
    ).join('\n')
    const how = DISCOVERY_HOW.map(
      (item) =>
        `      <h2>${escapeHtml(item.title)}</h2>\n      <p>${escapeHtml(item.body)}</p>`,
    ).join('\n')
    const faqs = DISCOVERY_FAQS.map(
      (item) =>
        `      <h2>${escapeHtml(item.question)}</h2>\n      <p>${escapeHtml(item.answer)}</p>`,
    ).join('\n')
    return `      <h1>What is Kea</h1>
${definition}
      <h2>Kea is not</h2>
      <ul>
${notItems}
      </ul>
${how}
      <h2>Languages</h2>
      <p>${escapeHtml(DISCOVERY_LANGUAGES)}</p>
${faqs}
      <p>Contact <a href="mailto:${DISCOVERY_CONTACT}">${DISCOVERY_CONTACT}</a>.</p>
${publicNav()}`
  }
  if (path === '/method') {
    const cards = METHOD_COPY.map(
      (item) =>
        `      <h2>${escapeHtml(item.title)}</h2>\n      <p>${escapeHtml(item.body)}</p>`,
    ).join('\n')
    return `      <h1>The Method</h1>
      <p>${escapeHtml(seo.description)}</p>
${cards}
${publicNav()}`
  }
  if (path === '/support') {
    return `      <h1>Customer Support</h1>
      <p>Email Kea at <a href="mailto:${DISCOVERY_CONTACT}">${DISCOVERY_CONTACT}</a> for account, subscription, or product questions. We usually reply within a couple of working days.</p>
      <p>To delete your account and data, use <a href="${KEA_ORIGIN}/delete-account">Delete my Kea data</a>.</p>
${publicNav()}`
  }
  if (path === '/contact') {
    return `      <h1>Contact</h1>
      <p>Email Kea at <a href="mailto:${DISCOVERY_CONTACT}">${DISCOVERY_CONTACT}</a>.</p>
${publicNav()}`
  }
  if (path === '/delete-account') {
    return `      <h1>Delete my Kea data</h1>
      <p>Use this page to permanently delete your Kea account, Learn List, topics, and stored data. You can also email <a href="mailto:${DISCOVERY_CONTACT}">${DISCOVERY_CONTACT}</a>.</p>
${publicNav()}`
  }
  if (path === '/privacy-policy') {
    return `      <h1>Privacy Policy</h1>
      <p>Kea collects account, conversation, and billing information to provide the companion at kea.chat. We do not sell your personal information. Contact <a href="mailto:${DISCOVERY_CONTACT}">${DISCOVERY_CONTACT}</a>.</p>
${publicNav()}`
  }
  if (path === '/terms-of-service') {
    return `      <h1>Terms of Service</h1>
      <p>These terms govern your use of Kea at kea.chat. Questions: <a href="mailto:${DISCOVERY_CONTACT}">${DISCOVERY_CONTACT}</a>.</p>
${publicNav()}`
  }
  if (path === '/cookie-policy') {
    return `      <h1>Cookie Policy</h1>
      <p>Kea uses necessary cookies to run the site. Analytics cookies run only if you accept. Contact <a href="mailto:${DISCOVERY_CONTACT}">${DISCOVERY_CONTACT}</a>.</p>
${publicNav()}`
  }
  return `      <h1>${escapeHtml(seo.title)}</h1>
      <p>${escapeHtml(seo.description)}</p>
${publicNav()}`
}

export function applySeoToHtml(html: string, pathname: string) {
  const seo = seoForPath(pathname)
  const url = canonicalUrl(seo.path)
  const robots = seo.index
    ? 'index, follow, max-image-preview:large'
    : 'noindex, nofollow'
  let next = html
  next = next.replace(
    /<title>[^<]*<\/title>/,
    `<title>${escapeHtml(seo.title)}</title>`,
  )
  next = setMeta(next, 'name', 'description', seo.description)
  next = setMeta(next, 'name', 'robots', robots)
  next = next.replace(
    /<link rel="canonical" href="[^"]*"\s*\/>/,
    `<link rel="canonical" href="${url}" />`,
  )
  next = setMeta(next, 'property', 'og:url', url)
  next = setMeta(next, 'property', 'og:title', seo.title)
  next = setMeta(next, 'property', 'og:description', seo.description)
  next = setMeta(next, 'property', 'og:image', OG_IMAGE)
  next = setMeta(next, 'property', 'og:image:width', String(OG_IMAGE_WIDTH))
  next = setMeta(next, 'property', 'og:image:height', String(OG_IMAGE_HEIGHT))
  next = setMeta(next, 'property', 'og:image:alt', 'Kea')
  next = setMeta(next, 'name', 'twitter:title', seo.title)
  next = setMeta(next, 'name', 'twitter:description', seo.description)
  next = setMeta(next, 'name', 'twitter:image', OG_IMAGE)
  next = setMeta(next, 'name', 'twitter:image:alt', 'Kea')
  const json = JSON.stringify(jsonLdForPath(pathname), null, 2)
  next = next.replace(
    /<script id="kea-json-ld" type="application\/ld\+json">[\s\S]*?<\/script>/,
    `<script id="kea-json-ld" type="application/ld+json">\n${json}\n    </script>`,
  )
  next = next.replace(
    /(<body[\s\S]*?)<noscript>[\s\S]*?<\/noscript>/,
    `$1<noscript>\n${noscriptHtmlForPath(pathname)}\n    </noscript>`,
  )
  return next
}
