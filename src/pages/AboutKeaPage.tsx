import { useMemo } from 'react'
import { CloudAtmosphere } from '../components/companion/CloudAtmosphere'
import { CompanionNav } from '../components/companion/CompanionNav'
import { getAboutKea, KEA_BIRD_SRC } from '../data/keaAbout'

export function AboutKeaPage() {
  const story = useMemo(() => getAboutKea(), [])
  const paragraphs = story
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)

  return (
    <main className="companion-screen memory-library">
      <CloudAtmosphere presence="idle" />
      <header className="memory-library__header">
        <CompanionNav />
      </header>
      <div className="memory-library__content about-kea-page">
        <h1>About Kea</h1>
        <img
          className="about-kea-page__portrait"
          src={KEA_BIRD_SRC}
          alt="A kea, the alpine parrot of New Zealand"
        />
        {paragraphs.map((part) => (
          <p key={part.slice(0, 48)} className="about-kea-page__story">
            {part}
          </p>
        ))}
      </div>
    </main>
  )
}
