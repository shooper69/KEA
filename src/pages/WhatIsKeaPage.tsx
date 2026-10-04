import { Link } from 'react-router-dom'
import { CloudAtmosphere } from '../components/companion/CloudAtmosphere'
import { SiteFooter } from '../components/companion/SiteFooter'
import {
  DISCOVERY_CONTACT,
  DISCOVERY_DEFINITION,
  DISCOVERY_FAQS,
  DISCOVERY_HOW,
  DISCOVERY_LANGUAGES,
  DISCOVERY_NOT,
  DISCOVERY_TITLE,
} from '../seo/keaDiscovery'

export function WhatIsKeaPage() {
  return (
    <main className="companion-screen legal-screen">
      <CloudAtmosphere presence="idle" />
      <div className="legal-screen__content">
        <div className="settings-title-row">
          <h1>{DISCOVERY_TITLE}</h1>
          <Link to="/method" className="settings-close" aria-label="Back to The Method">
            ×
          </Link>
        </div>
        <article className="settings-card legal-doc legal-doc--discovery">
          {DISCOVERY_DEFINITION.map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
          <h2>Kea is not</h2>
          <ul>
            {DISCOVERY_NOT.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {DISCOVERY_HOW.map((item) => (
            <section key={item.title}>
              <h2>{item.title}</h2>
              <p>{item.body}</p>
            </section>
          ))}
          <h2>Languages</h2>
          <p>{DISCOVERY_LANGUAGES}</p>
          {DISCOVERY_FAQS.map((item) => (
            <section key={item.question}>
              <h2>{item.question}</h2>
              <p>{item.answer}</p>
            </section>
          ))}
          <p>
            Contact{' '}
            <a href={`mailto:${DISCOVERY_CONTACT}`}>{DISCOVERY_CONTACT}</a>.
          </p>
        </article>
      </div>
      <SiteFooter tone="plain" />
    </main>
  )
}
