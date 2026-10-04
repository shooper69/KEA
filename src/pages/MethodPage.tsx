import { Link, NavLink } from 'react-router-dom'
import { CloudAtmosphere } from '../components/companion/CloudAtmosphere'
import { SiteFooter } from '../components/companion/SiteFooter'
import { StoreBadges } from '../components/companion/StoreBadges'

const METHOD_CARDS = [
  {
    title: 'Not a course',
    body: [
      'Kea is not a language learning course. Kea is a language acquisition app. No grammar books. No verb tables. No tests.',
      'Humans do not acquire their first language through lessons, they learn naturally through experience.',
    ],
    image: '/method/method-not-a-course.webp',
    alt: 'A young man and a kea sharing a table outdoors, with coffee and a sandwich on unused papers and a book',
  },
  {
    title: 'Learn naturally',
    body: [
      'Listening, repetition, observation, emotion, and personalised conversation. Understanding comes first. Speech emerges naturally.',
      'Language is never isolated words. It’s a process. The desire to learn, pleasure in the experience, meaning recognised. Language follows, the way it did when you learned to speak the first time.',
    ],
    image: '/method/method-learn-like-child.webp',
    alt: 'A child listening closely to a friend outdoors',
  },
  {
    title: 'Unstructured talk',
    body: [
      'With Kea, you don’t follow a lesson path, you just chat with a companion, about everyday moments — greetings, meals, curiosity, stories, work and play.',
      'There’s no gamification, so when you fail to answer correctly, you don’t get sent back to the beginning, to yet again discuss ‘coffee or greetings’ for the umpteenth time.',
    ],
    image: '/method/method-unstructured-talk.webp',
    alt: 'Friends chatting casually over coffee',
  },
  {
    title: 'The Tech',
    body: [
      'Kea is AI powered. She engages at your level, tracks your mistakes and uses the words you need to learn repeatedly, until you’ve proven that you’ve remembered them and know how to use them.',
      'Each subscription tier offers more sophistication, and at the highest level you can communicate with different characters that chat with real personality, and that learn about your life and remember your conversations. Just like in any relationship.',
    ],
    image: '/method/method-meaning-first.webp',
    alt: 'Two people sharing meaning while looking out over a town',
  },
  {
    title: 'Progress',
    body: [
      'You’ll feel your progress as your ability to chat grows. Your confidence will increase and your desire to advance will flourish. You’ll experience the pleasure in learning.',
      'Sure, use books for grammar and structure, but you’ll find that without conversation, you’ll fall into the trap of ‘use it or lose it’.',
    ],
    image: '/method/method-talk-results.webp',
    alt: 'Speaking with Kea while voice becomes real progress',
  },
  {
    title: 'Rewards',
    body: [
      'Your progress is tracked in background so you can monitor your performance. You do not need levels and streaks, as you’ll find in most apps. For you know best what and when you want to learn.',
      'No stars, emojis and pings, And you’ll not be pushed to view adverts or provide feedback. Just to keep talking. The rewards will come soon enough.',
    ],
    image: '/method/method-earn-taps.webp',
    alt: 'Glowing tokens rising from a friendly conversation',
  },
] as const

export function MethodPage() {
  return (
    <main className="companion-screen method-screen">
      <CloudAtmosphere presence="idle" tempo="sunrise" />
      <div className="method-screen__content">
        <header className="method-screen__top">
          <Link to="/" className="method-screen__brand" aria-label="Kea home">
            <img
              className="method-screen__logo"
              src="/kea-05.png"
              alt="Kea"
              width={180}
              height={90}
            />
          </Link>
          <nav className="method-screen__nav" aria-label="Site">
            <NavLink to="/" end className="method-screen__home">
              Home
            </NavLink>
            <NavLink to="/method" className="method-screen__page-title">
              The Method
            </NavLink>
            <Link
              to="/?login=1"
              className="method-screen__page-title method-screen__login"
            >
              Login
            </Link>
          </nav>
        </header>

        <div className="method-screen__hero">
          <p className="method-screen__difference">
            <span className="method-screen__difference-shade">Kea is different</span>
            <span className="method-screen__difference-rest">
              {' '}
              from other language apps
            </span>
          </p>
          <h1>
            <span className="method-screen__hero-line">
              You acquire a language through experience,
            </span>
            <span className="method-screen__hero-line">
              not by studying to remember by rote.
            </span>
          </h1>
        </div>

        <section className="method-set" aria-label="The Method">
          <div className="method-rows">
            {METHOD_CARDS.map((item) => (
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
                    <p key={paragraph.slice(0, 32)}>{paragraph}</p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="method-screen__cta">
          <p className="method-screen__invite">
            <span className="method-screen__invite-line">
              So let’s see if we’re
            </span>
            <span className="method-screen__invite-line">
              going to become friends
            </span>
          </p>
          <div className="method-screen__cta-actions">
            <Link to="/?register=1" className="kea-button method-screen__cta-button">
              Create free account
            </Link>
            <Link to="/what-is-kea" className="method-screen__learn-more">
              Learn more
            </Link>
          </div>
        </div>

        <footer className="welcome-screen__store-footer method-screen__store-footer">
          <div className="welcome-screen__store-footer-bar">
            <StoreBadges />
            <SiteFooter tone="marketing" />
          </div>
        </footer>
      </div>
    </main>
  )
}
