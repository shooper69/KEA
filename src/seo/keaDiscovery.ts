export const DISCOVERY_PATH = '/what-is-kea'

export const DISCOVERY_TITLE = 'What is Kea'

export const DISCOVERY_DESCRIPTION =
  'Kea is a hands-free conversational companion for language. She talks with you like a friend — not a course, tutor, or lesson app — and remembers topics and words you struggle with.'

export const DISCOVERY_DEFINITION = [
  'Kea is a conversational companion. People pick up a language by talking with her, the way they picked up their first language: through experience, meaning, and repetition in real conversation.',
  'You speak one language and talk with Kea in another. She answers in that language, keeps the thread of what you have been talking about, and notices words and phrases you struggle with.',
  'Those words live on a personal Learn List until you start using them well. Topics you have spoken about can be opened again later. There is no lesson plan, no streak, and no classroom.',
]

export const DISCOVERY_NOT = [
  'a language course or learning platform',
  'a tutor, teacher, or classroom app',
  'a chatbot that drills grammar tables',
  'a game with levels, stars, or ads',
]

export const DISCOVERY_HOW = [
  {
    title: 'Talk',
    body: 'You talk with Kea hands-free. She replies as a companion, in the language you are acquiring.',
  },
  {
    title: 'Learn List',
    body: 'When you struggle with a word or phrase, Kea keeps it on a Learn List. Items leave when you use them well.',
  },
  {
    title: 'Topics',
    body: 'Things you have spoken about are remembered so you can continue a conversation later.',
  },
]

export const DISCOVERY_LANGUAGES =
  'English, Spanish, French, German, and Russian. You speak one and talk with Kea in another.'

export const DISCOVERY_CONTACT = 'team@kea.chat'

export const PUBLIC_SITEMAP_PATHS = [
  '/',
  DISCOVERY_PATH,
  '/method',
  '/support',
  '/delete-account',
  '/privacy-policy',
  '/terms-of-service',
  '/cookie-policy',
] as const

export const ROBOTS_DISALLOW = [
  '/admin',
  '/admin/',
  '/settings',
  '/conversation',
  '/learn',
  '/topics',
  '/usage',
  '/subscription',
  '/performance',
  '/home',
  '/about',
]

export function keaSitemapXml(origin: string) {
  const lastmod = '2026-10-03'
  const urls = PUBLIC_SITEMAP_PATHS.map((path) => {
    const loc = path === '/' ? `${origin}/` : `${origin}${path}`
    const priority =
      path === '/' ? '1.0' : path === DISCOVERY_PATH ? '0.9' : path === '/method' ? '0.8' : '0.6'
    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`
  }).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
}

export function robotsTxt(origin: string) {
  const disallows = ROBOTS_DISALLOW.map((path) => `Disallow: ${path}`).join('\n')
  return `User-agent: *
Allow: /

Sitemap: ${origin}/sitemap.xml

${disallows}

User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Anthropic-AI
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: PerplexityBot
Allow: /
`
}

export const DISCOVERY_FAQS: Array<{ question: string; answer: string }> = [
  {
    question: 'What is Kea?',
    answer:
      'Kea is a hands-free conversational companion for language. She talks with you like a friend so you acquire language through conversation, not through a course.',
  },
  {
    question: 'Is Kea a language learning app or tutor?',
    answer:
      'No. Kea is not a course, tutor, chatbot drill, or classroom. She is a companion you talk with. Understanding comes first; speech follows naturally.',
  },
  {
    question: 'Which languages does Kea speak?',
    answer: DISCOVERY_LANGUAGES,
  },
  {
    question: 'What is the Learn List?',
    answer:
      'The Learn List holds words and phrases Kea noticed you struggling with. They leave the list when you start using them well in conversation.',
  },
  {
    question: 'Where should people start?',
    answer:
      'Open https://kea.chat to create a free account and talk. Read The Method at https://kea.chat/method for how acquisition works. This page is the short definition for people and search engines.',
  },
]

export function discoveryFaqJsonLd(origin: string) {
  return {
    '@type': 'FAQPage',
    '@id': `${origin}${DISCOVERY_PATH}#faq`,
    url: `${origin}${DISCOVERY_PATH}`,
    mainEntity: DISCOVERY_FAQS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}

export function discoveryDefinedTermJsonLd(origin: string) {
  return {
    '@type': 'DefinedTerm',
    '@id': `${origin}${DISCOVERY_PATH}#term`,
    name: 'Kea',
    description: DISCOVERY_DESCRIPTION,
    url: `${origin}${DISCOVERY_PATH}`,
    inDefinedTermSet: `${origin}${DISCOVERY_PATH}`,
  }
}

export function keaLlmsTxt(origin: string) {
  const lines = [
    '# Kea',
    '',
    `> ${DISCOVERY_DESCRIPTION}`,
    '',
    DISCOVERY_DEFINITION.join('\n\n'),
    '',
    'Kea is not:',
    ...DISCOVERY_NOT.map((item) => `- ${item}`),
    '',
    '## How it works',
    '',
    ...DISCOVERY_HOW.map((item) => `- ${item.title}: ${item.body}`),
    '',
    '## Languages',
    '',
    DISCOVERY_LANGUAGES,
    '',
    '## Public pages (use these URLs)',
    '',
    `- Home: ${origin}/`,
    `- What is Kea: ${origin}${DISCOVERY_PATH}`,
    `- The Method: ${origin}/method`,
    `- Support: ${origin}/support`,
    `- Privacy: ${origin}/privacy-policy`,
    `- Terms: ${origin}/terms-of-service`,
    `- Cookies: ${origin}/cookie-policy`,
    '',
    'Talk, Learn List, and signed-in screens require an account. Do not cite those URLs as public documentation.',
    '',
    `Contact: ${DISCOVERY_CONTACT}`,
    '',
  ]
  return `${lines.join('\n').trim()}\n`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function keaWhatIsKeaHtml(origin: string) {
  const canonical = `${origin}${DISCOVERY_PATH}`
  const faqLd = {
    '@context': 'https://schema.org',
    '@graph': [
      discoveryDefinedTermJsonLd(origin),
      discoveryFaqJsonLd(origin),
    ],
  }
  const definition = DISCOVERY_DEFINITION.map(
    (paragraph) => `    <p>${escapeHtml(paragraph)}</p>`,
  ).join('\n')
  const notItems = DISCOVERY_NOT.map(
    (item) => `      <li>${escapeHtml(item)}</li>`,
  ).join('\n')
  const how = DISCOVERY_HOW.map(
    (item) =>
      `    <h2>${escapeHtml(item.title)}</h2>\n    <p>${escapeHtml(item.body)}</p>`,
  ).join('\n')
  const faqs = DISCOVERY_FAQS.map(
    (item) =>
      `    <h2>${escapeHtml(item.question)}</h2>\n    <p>${escapeHtml(item.answer)}</p>`,
  ).join('\n')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(DISCOVERY_TITLE)} · Kea</title>
    <meta name="description" content="${escapeHtml(DISCOVERY_DESCRIPTION)}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Kea" />
    <meta property="og:locale" content="en_GB" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:title" content="${escapeHtml(DISCOVERY_TITLE)} · Kea" />
    <meta property="og:description" content="${escapeHtml(DISCOVERY_DESCRIPTION)}" />
    <meta property="og:image" content="${origin}/kea-mark.png" />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <script type="application/ld+json">
${JSON.stringify(faqLd, null, 2)}
    </script>
    <style>
      body { margin: 0; font-family: Calibri, Carlito, "Segoe UI", sans-serif; color: #4a342e; background: #4ec4d4; line-height: 1.5; }
      main { max-width: 40rem; margin: 0 auto; padding: 1.5rem 1.1rem 3rem; background: rgba(255,248,240,0.72); }
      h1 { font-weight: 500; font-size: 2rem; }
      h2 { font-size: 1.1rem; margin: 1.4rem 0 0.4rem; }
      a { color: #6e422c; }
      nav { display: flex; flex-wrap: wrap; gap: 0.75rem 1rem; margin: 1.5rem 0 0; }
    </style>
  </head>
  <body>
    <main>
      <p><a href="${origin}/">Kea</a></p>
      <h1>${escapeHtml(DISCOVERY_TITLE)}</h1>
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
      <nav aria-label="Site">
        <a href="${origin}/">Home</a>
        <a href="${origin}/method">The Method</a>
        <a href="${origin}/support">Support</a>
        <a href="${origin}/privacy-policy">Privacy</a>
      </nav>
    </main>
  </body>
</html>
`
}
