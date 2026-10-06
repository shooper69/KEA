import { useState } from 'react'
import {
  readMarketingBackground,
  saveMarketingBackground,
  type MarketingBackground,
} from '../data/keaMarketingBackground'

export function AdminDesignPage() {
  const [background, setBackground] = useState<MarketingBackground>(() =>
    readMarketingBackground(),
  )
  const [saved, setSaved] = useState('')

  function choose(next: MarketingBackground) {
    setBackground(next)
    saveMarketingBackground(next)
    setSaved('Saved.')
  }

  return (
    <section className="settings-card">
      <h2>Marketing background</h2>
      <p className="settings-note">
        Home, The Method, What is Kea, and the login and register screens.
        Talk, Settings, and the rest of the app stay as they are.
      </p>
      <div role="radiogroup" aria-label="Marketing background">
        <label className="settings-choice">
          <input
            type="radio"
            name="marketing-background"
            checked={background === 'graded'}
            onChange={() => choose('graded')}
          />
          <span>
            <strong>Colour Graded</strong>
            The colour wash used on The Method — soft clouds and graded sky on
            every marketing page.
          </span>
        </label>
        <label className="settings-choice">
          <input
            type="radio"
            name="marketing-background"
            checked={background === 'black'}
            onChange={() => choose('black')}
          />
          <span>
            <strong>Black</strong>
            A solid black background on the marketing home, The Method, What is
            Kea, and login and register.
          </span>
        </label>
      </div>
      {saved ? <p className="settings-note">{saved}</p> : null}
    </section>
  )
}
