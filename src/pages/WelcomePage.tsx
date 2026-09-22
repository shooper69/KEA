import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/companion/Button'
import { CloudAtmosphere } from '../components/companion/CloudAtmosphere'
import { KeaMark } from '../components/companion/KeaMark'
import { SUPPORTED_LANGUAGES } from '../config/languages'
import { useSession } from '../context/SessionContext'
import type { LanguageCode } from '../types'

export function WelcomePage() {
  const navigate = useNavigate()
  const { languageCode, setLanguageCode } = useSession()
  const [selected, setSelected] = useState<LanguageCode | null>(languageCode)

  function continueToConversation() {
    if (!selected) return
    setLanguageCode(selected)
    navigate('/conversation')
  }

  return (
    <main className="companion-screen welcome-screen">
      <CloudAtmosphere presence="idle" />
      <div className="welcome-screen__content">
        <KeaMark className="kea-mark--welcome" />
        <h1>Choose your language</h1>
        <p className="welcome-screen__lede">
          Then talk about your day. KEA is a friend who answers in that
          language, and helps only when a word is missing.
        </p>
        <div className="language-grid">
          {SUPPORTED_LANGUAGES.map((language) => {
            const isSelected = selected === language.code
            return (
              <button
                key={language.code}
                type="button"
                className={`language-card ${isSelected ? 'language-card--selected' : ''}`}
                aria-pressed={isSelected}
                onClick={() => setSelected(language.code)}
              >
                <span className="language-card__name">{language.name}</span>
                <span className="language-card__native">{language.nativeName}</span>
              </button>
            )
          })}
        </div>
        <Button type="button" disabled={!selected} onClick={continueToConversation}>
          Continue
        </Button>
      </div>
    </main>
  )
}
