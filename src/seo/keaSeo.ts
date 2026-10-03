import {
  DISCOVERY_PATH,
  discoveryDefinedTermJsonLd,
  discoveryFaqJsonLd,
} from './keaDiscovery.ts'

export const KEA_ORIGIN = 'https://kea.chat'

export const KEA_NAME = 'Kea'

export const KEA_TAGLINE = 'language learning chatty companion'

export const OG_IMAGE_PATH = '/og-image.png'

export const OG_IMAGE = `${KEA_ORIGIN}${OG_IMAGE_PATH}`

export const OG_IMAGE_WIDTH = 1200

export const OG_IMAGE_HEIGHT = 630

export const KEA_DESCRIPTION =
  'Kea is a language learning chatty companion. Talk hands-free in English, Spanish, French, German or Russian. Remembered topics and a Learn List — not a course or tutor.'

export interface KeaPageSeo {
  title: string
  description: string
  path: string
  index: boolean
}

const pages: Array<[string, KeaPageSeo]> = [
  [
    '/',
    {
      title: 'Kea — language learning chatty companion',
      description: KEA_DESCRIPTION,
      path: '/',
      index: true,
    },
  ],
  [
    '/method',
    {
      title: 'The Method | How Kea acquires language',
      description:
        'How Kea, a language learning chatty companion, works: unstructured talk, meaning first, a Learn List for hard words, and progress from conversation — not lessons or streaks.',
      path: '/method',
      index: true,
    },
  ],
  [
    '/what-is-kea',
    {
      title: 'What is Kea? A language learning chatty companion',
      description:
        'Kea is a language learning chatty companion. She talks with you like a friend — not a course or tutor — and remembers topics and words you struggle with.',
      path: '/what-is-kea',
      index: true,
    },
  ],
  [
    '/home',
    {
      title: 'Talk · Kea',
      description: 'Talk with Kea, a hands-free conversational companion.',
      path: '/conversation',
      index: false,
    },
  ],
  [
    '/conversation',
    {
      title: 'Talk · Kea',
      description:
        'Talk with Kea in your chosen language. Hands-free conversation with a companion, not a lesson plan.',
      path: '/conversation',
      index: false,
    },
  ],
  [
    '/learn',
    {
      title: 'Learn List · Kea',
      description:
        'Words and phrases Kea noticed you struggling with. They leave when you start using them well.',
      path: '/learn',
      index: false,
    },
  ],
  [
    '/topics',
    {
      title: 'Topics · Kea',
      description:
        'Things you have spoken about with Kea. Pick a topic up and continue the conversation.',
      path: '/topics',
      index: false,
    },
  ],
  [
    '/performance',
    {
      title: 'Performance · Kea',
      description:
        'See how many hours you talk with Kea each day and your seven-day trend.',
      path: '/performance',
      index: false,
    },
  ],
  [
    '/usage',
    {
      title: 'Usage · Kea',
      description: 'See how much talk time you have used this month.',
      path: '/usage',
      index: false,
    },
  ],
  [
    '/settings',
    {
      title: 'Settings · Kea',
      description: 'Your Kea profile, voice, and languages.',
      path: '/settings',
      index: false,
    },
  ],
  [
    '/subscription',
    {
      title: 'Subscription · Kea',
      description: 'Choose a Kea plan and manage your subscription.',
      path: '/subscription',
      index: false,
    },
  ],
  [
    '/support',
    {
      title: 'Kea Support — help with your account',
      description:
        'Get help with Kea at team@kea.chat. Account, subscription, product questions, and how to delete your data at kea.chat/delete-account.',
      path: '/support',
      index: true,
    },
  ],
  [
    '/contact',
    {
      title: 'Contact Kea — team@kea.chat',
      description:
        'Email Kea at team@kea.chat for product, account, or partnership questions. Public pages: What is Kea, The Method, Support, and legal policies.',
      path: '/contact',
      index: true,
    },
  ],
  [
    '/delete-account',
    {
      title: 'Delete your Kea account and stored data',
      description:
        'Permanently delete your Kea account, Learn List, topics, and data stored for kea.chat. Use this page or Settings → Security in the app.',
      path: '/delete-account',
      index: true,
    },
  ],
  [
    '/privacy-policy',
    {
      title: 'Privacy Policy | How Kea uses your data',
      description:
        'How Kea collects, uses, and protects account, conversation, and billing information at kea.chat, and how to delete your data.',
      path: '/privacy-policy',
      index: true,
    },
  ],
  [
    '/terms-of-service',
    {
      title: 'Terms of Service | Using Kea at kea.chat',
      description:
        'Terms that govern your use of Kea at kea.chat, including accounts, subscriptions, acceptable use, and contact at team@kea.chat.',
      path: '/terms-of-service',
      index: true,
    },
  ],
  [
    '/cookie-policy',
    {
      title: 'Cookie Policy | Kea cookies and your choice',
      description:
        'How Kea uses necessary cookies and optional analytics on kea.chat, and how to accept, reject, or reset that choice.',
      path: '/cookie-policy',
      index: true,
    },
  ],
  [
    '/admin',
    {
      title: 'Admin · Kea',
      description: 'Kea administration.',
      path: '/admin',
      index: false,
    },
  ],
]

export function normalizePathname(pathname: string) {
  const path = pathname.split(/[?#]/)[0] || '/'
  if (path === '/') return '/'
  return path.replace(/\/+$/, '') || '/'
}

export function htmlFileForPath(path: string) {
  const normalised = normalizePathname(path)
  if (normalised === '/') return 'index.html'
  return `${normalised.slice(1)}.html`
}

export function seoForPath(pathname: string): KeaPageSeo {
  const normalised = normalizePathname(pathname)
  const exact = pages.find(([path]) => path === normalised)
  if (exact) return exact[1]
  if (normalised.startsWith('/admin')) {
    return {
      title: 'Admin · Kea',
      description: 'Kea administration.',
      path: '/admin',
      index: false,
    }
  }
  return {
    title: 'Kea',
    description: KEA_DESCRIPTION,
    path: normalised,
    index: false,
  }
}

export function canonicalUrl(path: string) {
  const normalised = normalizePathname(path)
  if (normalised === '/') return `${KEA_ORIGIN}/`
  return `${KEA_ORIGIN}${normalised}`
}

export const KEA_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${KEA_ORIGIN}/#organization`,
      name: KEA_NAME,
      url: KEA_ORIGIN,
      slogan: KEA_TAGLINE,
      logo: {
        '@type': 'ImageObject',
        url: `${KEA_ORIGIN}/favicon-512.png`,
        width: 512,
        height: 512,
      },
      image: OG_IMAGE,
      description: KEA_DESCRIPTION,
      email: 'team@kea.chat',
      contactPoint: {
        '@type': 'ContactPoint',
        email: 'team@kea.chat',
        contactType: 'customer support',
        url: `${KEA_ORIGIN}/support`,
        availableLanguage: ['English'],
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${KEA_ORIGIN}/#website`,
      url: KEA_ORIGIN,
      name: KEA_NAME,
      description: KEA_DESCRIPTION,
      slogan: KEA_TAGLINE,
      inLanguage: 'en',
      publisher: { '@id': `${KEA_ORIGIN}/#organization` },
    },
    {
      '@type': 'WebApplication',
      '@id': `${KEA_ORIGIN}/#app`,
      name: KEA_NAME,
      url: KEA_ORIGIN,
      description: KEA_DESCRIPTION,
      slogan: KEA_TAGLINE,
      applicationCategory: 'LifestyleApplication',
      operatingSystem: 'Web, Android',
      image: OG_IMAGE,
      inLanguage: ['en', 'es', 'fr', 'de', 'ru'],
      isAccessibleForFree: true,
      publisher: { '@id': `${KEA_ORIGIN}/#organization` },
    },
  ],
}

function pageType(pathname: string) {
  if (pathname === '/contact' || pathname === '/support') return 'ContactPage'
  if (pathname === DISCOVERY_PATH) return 'AboutPage'
  return 'WebPage'
}

function breadcrumbJsonLd(pathname: string, seo: KeaPageSeo) {
  const url = canonicalUrl(seo.path)
  if (pathname === '/') {
    return {
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: KEA_NAME,
          item: `${KEA_ORIGIN}/`,
        },
      ],
    }
  }
  return {
    '@type': 'BreadcrumbList',
    '@id': `${url}#breadcrumb`,
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: KEA_NAME,
        item: `${KEA_ORIGIN}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: seo.title,
        item: url,
      },
    ],
  }
}

export function jsonLdForPath(pathname: string) {
  const seo = seoForPath(pathname)
  const url = canonicalUrl(seo.path)
  const graph: unknown[] = [
    ...KEA_JSON_LD['@graph'],
    {
      '@type': pageType(seo.path),
      '@id': `${url}#webpage`,
      url,
      name: seo.title,
      description: seo.description,
      isPartOf: { '@id': `${KEA_ORIGIN}/#website` },
      about: { '@id': `${KEA_ORIGIN}/#app` },
      inLanguage: 'en',
      primaryImageOfPage: {
        '@type': 'ImageObject',
        url: OG_IMAGE,
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
      },
    },
    breadcrumbJsonLd(seo.path, seo),
  ]
  if (seo.path === DISCOVERY_PATH) {
    graph.push(discoveryDefinedTermJsonLd(KEA_ORIGIN), discoveryFaqJsonLd(KEA_ORIGIN))
  }
  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  }
}
