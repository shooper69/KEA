export const KEA_ORIGIN = 'https://kea.chat'

export const KEA_NAME = 'Kea'

export const KEA_TAGLINE = 'Chat with Kea & learn a language'

export const KEA_DESCRIPTION =
  'Kea is a hands-free conversational companion that helps you learn languages naturally through real conversation, remembered topics, and a personalised Learn List. Not a course, not a tutor — a friend you talk with.'

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
      title: 'Kea — a conversational companion for language',
      description: KEA_DESCRIPTION,
      path: '/',
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
      index: true,
    },
  ],
  [
    '/learn',
    {
      title: 'Learn List · Kea',
      description:
        'Words and phrases Kea noticed you struggling with. They leave when you start using them well.',
      path: '/learn',
      index: true,
    },
  ],
  [
    '/topics',
    {
      title: 'Topics · Kea',
      description:
        'Things you have spoken about with Kea. Pick a topic up and continue the conversation.',
      path: '/topics',
      index: true,
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
      title: 'Customer Support · Kea',
      description:
        'Get help with Kea. Contact the team at team@kea.chat for account, subscription, or product questions.',
      path: '/support',
      index: true,
    },
  ],
  [
    '/privacy-policy',
    {
      title: 'Privacy Policy · Kea',
      description:
        'How Kea collects, uses, and protects your information at kea.chat.',
      path: '/privacy-policy',
      index: true,
    },
  ],
  [
    '/terms-of-service',
    {
      title: 'Terms of Service · Kea',
      description: 'Terms that govern your use of Kea at kea.chat.',
      path: '/terms-of-service',
      index: true,
    },
  ],
  [
    '/cookie-policy',
    {
      title: 'Cookie Policy · Kea',
      description:
        'How Kea uses necessary and analytics cookies, and how to manage your choice.',
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

export function seoForPath(pathname: string): KeaPageSeo {
  const exact = pages.find(([path]) => path === pathname)
  if (exact) return exact[1]
  if (pathname.startsWith('/admin')) {
    return {
      title: 'Admin · Kea',
      description: 'Kea administration.',
      path: '/admin',
      index: false,
    }
  }
  return pages[0][1]
}

export function canonicalUrl(path: string) {
  if (path === '/') return `${KEA_ORIGIN}/`
  return `${KEA_ORIGIN}${path}`
}

export const KEA_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${KEA_ORIGIN}/#organization`,
      name: KEA_NAME,
      url: KEA_ORIGIN,
      logo: `${KEA_ORIGIN}/favicon-512.png`,
      description: KEA_DESCRIPTION,
    },
    {
      '@type': 'WebSite',
      '@id': `${KEA_ORIGIN}/#website`,
      url: KEA_ORIGIN,
      name: KEA_NAME,
      description: KEA_DESCRIPTION,
      inLanguage: 'en',
      publisher: { '@id': `${KEA_ORIGIN}/#organization` },
    },
    {
      '@type': 'WebApplication',
      '@id': `${KEA_ORIGIN}/#app`,
      name: KEA_NAME,
      url: KEA_ORIGIN,
      description: KEA_DESCRIPTION,
      applicationCategory: 'LifestyleApplication',
      operatingSystem: 'Web',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      inLanguage: ['en', 'es', 'fr', 'de', 'ru'],
    },
  ],
}
