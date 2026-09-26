import { Link } from 'react-router-dom'
import { CloudAtmosphere } from '../components/companion/CloudAtmosphere'
import { SiteFooter } from '../components/companion/SiteFooter'

const METHOD = [
  {
    id: 'method',
    title: 'The method',
    lead: 'Kea is not a language learning platform. Kea is a language acquisition platform.',
    items: [
      {
        title: 'Not a course',
        body: 'No grammar books. No verb tables. No tests. Humans do not acquire their first language through lessons — and Kea does not pretend they do.',
      },
      {
        title: 'Learn like a child',
        body: 'Listening, repetition, experience, emotion, and meaningful conversation. Understanding comes first. Speech emerges naturally.',
      },
      {
        title: 'Unstructured talk',
        body: 'You do not follow a lesson plan. You live inside everyday moments — greetings, meals, curiosity, stories, play — with a friend who stays.',
      },
      {
        title: 'Meaning first',
        body: 'Language is never isolated words. Meaning comes first. Language follows — the way it did when you learned to speak the first time.',
      },
      {
        title: 'No levels. Only growth',
        body: 'Progress is what you can understand, the conversations you can follow, and how naturally communication feels — not Level 1, 2, or 3.',
      },
    ],
  },
  {
    id: 'stones',
    title: 'Stepping stones',
    lead: 'You begin in a small circle of trusted voices. As understanding grows, your world expands — while the familiar faces remain.',
    items: [
      {
        title: '1 · Family',
        body: 'A handful of recurring companions. Daily routines, play, meals, and gentle talk. Safety first. Comprehension before performance.',
      },
      {
        title: '2 · Village',
        body: 'The family stays. New people enter — shop owner, neighbour, café, local friend. Language grows because life just got bigger.',
      },
      {
        title: '3 · Community',
        body: 'Work, hobbies, teammates, wider society. Faster talk, humour, emotion, different styles — still through participation, not instruction.',
      },
      {
        title: '4 · World & many friends',
        body: 'Accents, ages, cultures, richer social life. On Kea’s highest plan, your circle can open to multiple companions — same relationships, a wider world. Coming as we grow with you.',
      },
    ],
  },
  {
    id: 'taps',
    title: 'Talk, track, earn TAPs',
    lead: 'Talk time is how you grow — and how you earn. TAPs are Kea’s Talk2Earn tokens. They stay in Kea. No outside bridges.',
    items: [
      {
        title: 'Your talk is tracked',
        body: 'Minutes you speak are measured so you can see real usage — not a fake level bar, but time spent living in the language.',
      },
      {
        title: 'Growth you can feel',
        body: 'What you understand. Which conversations you can follow. Which relationships you keep. That is the score that matters.',
      },
      {
        title: 'Earn TAPs',
        body: 'Speak with Kea and earn TAPs. The simple rule: 50 TAPs for every 10 minutes of your speech. Rates can be refined in Admin as we launch earning.',
      },
      {
        title: 'Redeem for discounts',
        body: 'TAPs can be redeemed for product discounts on Kea subscriptions — a thank-you for showing up and talking. See your balance in Settings → Usage when earning goes live.',
      },
    ],
  },
] as const

export function MethodPage() {
  return (
    <main className="companion-screen method-screen">
      <CloudAtmosphere presence="idle" tempo="sunrise" />
      <div className="method-screen__content">
        <header className="method-screen__top">
          <Link to="/" className="method-screen__brand" aria-label="Kea home">
            <img src="/kea-05.png" alt="" className="method-screen__logo" />
            <span>Kea</span>
          </Link>
          <Link to="/" className="settings-close" aria-label="Close The Method">
            ×
          </Link>
        </header>

        <div className="method-screen__hero">
          <p className="method-screen__eyebrow">The Method</p>
          <h1>Acquire a language. Don’t study it.</h1>
          <p className="method-screen__lede">
            A friend always around. Listening, repetition, experience, growth —
            not lessons. Your world expands as you do.
          </p>
          <Link to="/" className="kea-button method-screen__cta">
            Create free account
          </Link>
        </div>

        {METHOD.map((set) => (
          <section key={set.id} className="method-set" id={set.id}>
            <h2>{set.title}</h2>
            <p className="method-set__lead">{set.lead}</p>
            <div className="method-grid">
              {set.items.map((item) => (
                <article key={item.title} className="method-tile">
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </section>
        ))}

        <section className="method-set method-set--close">
          <h2>Ready to talk?</h2>
          <p className="method-set__lead">
            Start free. Install Kea on your phone when you like. Earn TAPs as you
            speak — coming soon in Settings → Usage.
          </p>
          <div className="method-screen__actions">
            <Link to="/" className="kea-button">
              Back to Kea
            </Link>
          </div>
        </section>

        <SiteFooter tone="plain" />
      </div>
    </main>
  )
}
