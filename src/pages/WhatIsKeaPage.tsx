import { BackToTop } from '../components/companion/BackToTop'
import { CloudAtmosphere } from '../components/companion/CloudAtmosphere'
import { MarketingSiteFooter } from '../components/companion/MarketingSiteFooter'
import { MarketingSiteHeader } from '../components/companion/MarketingSiteHeader'
import {
  DISCOVERY_DEFINITION,
  DISCOVERY_HOW,
  DISCOVERY_LANGUAGES,
  DISCOVERY_NOT,
  DISCOVERY_NOT_CLOSING,
  DISCOVERY_TITLE,
} from '../seo/keaDiscovery'

const DISCOVERY_CARDS = [
  {
    title: 'A chatty companion',
    body: DISCOVERY_DEFINITION,
    image: '/method/method-community.webp',
    alt: 'Friends gathered around a table in warm conversation',
  },
  {
    title: 'Kea is not',
    body: [
      DISCOVERY_NOT.map((item) => item.replace(/^a /, 'A ').replace(/^an /, 'An ')).join(
        '. ',
      ) + '.',
      DISCOVERY_NOT_CLOSING,
    ],
    image: '/method/method-no-levels.webp',
    alt: 'An open path under a wide sky — no levels, no classroom walls',
  },
  {
    title: DISCOVERY_HOW[0].title,
    body: [DISCOVERY_HOW[0].body],
    image: '/method/method-talk-tracked.webp',
    alt: 'Talking with Kea while conversation is gently tracked',
  },
  {
    title: DISCOVERY_HOW[1].title,
    body: [DISCOVERY_HOW[1].body],
    image: '/method/method-growth.webp',
    alt: 'Progress that grows from real conversation',
  },
  {
    title: DISCOVERY_HOW[2].title,
    body: [DISCOVERY_HOW[2].body],
    image: '/method/method-family.webp',
    alt: 'Familiar topics you can return to later',
  },
  {
    title: 'Languages',
    body: [DISCOVERY_LANGUAGES],
    image: '/method/method-world-friends.webp',
    alt: 'People from around the world sharing a moment together',
  },
] as const

export function WhatIsKeaPage() {
  return (
    <main className="companion-screen method-screen discovery-screen">
      <CloudAtmosphere presence="idle" tempo="sunrise" />
      <MarketingSiteHeader />
      <div className="method-screen__content">
        <div className="method-screen__hero">
          <p className="method-screen__difference">
            <span className="method-screen__difference-shade">{DISCOVERY_TITLE}</span>
          </p>
          <h1>
            <span className="method-screen__hero-line">
              A language learning chatty companion —
            </span>
            <span className="method-screen__hero-line">
              not a course, tutor, or lesson app.
            </span>
          </h1>
        </div>

        <section className="method-set" aria-label={DISCOVERY_TITLE}>
          <div className="method-rows">
            {DISCOVERY_CARDS.map((item) => (
              <article key={item.title} className="method-row">
                <div className="method-row__media">
                  <img
                    src={item.image}
                    alt={item.alt}
                    loading="lazy"
                    decoding="async"
                    width={960}
                    height={720}
                  />
                </div>
                <div className="method-row__copy">
                  <h3>{item.title}</h3>
                  {item.body.map((paragraph) => (
                    <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
      <MarketingSiteFooter />
      <BackToTop />
    </main>
  )
}
