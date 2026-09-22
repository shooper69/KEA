import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CloudAtmosphere } from '../components/companion/CloudAtmosphere'
import { KeaMark } from '../components/companion/KeaMark'
import { UserMenu } from '../components/companion/UserMenu'
import { VOCABULARY_MASTERY_THRESHOLD } from '../architecture/vocabularyMemory'
import { getLanguage } from '../config/languages'
import { useSession } from '../context/SessionContext'
import { PLACEHOLDER_VOCABULARY } from '../data/placeholders'

export function MemoryLibraryPage() {
  const { languageCode } = useSession()
  const [query, setQuery] = useState('')

  const words = useMemo(() => {
    const scoped = languageCode
      ? PLACEHOLDER_VOCABULARY.filter((item) => item.languageCode === languageCode)
      : PLACEHOLDER_VOCABULARY
    const needle = query.trim().toLowerCase()
    if (!needle) return scoped
    return scoped.filter(
      (item) =>
        item.english.toLowerCase().includes(needle) ||
        item.translation.toLowerCase().includes(needle),
    )
  }, [languageCode, query])

  return (
    <main className="companion-screen memory-library">
      <CloudAtmosphere presence="idle" />
      <header className="memory-library__header">
        <Link to="/conversation" aria-label="Kea home">
          <KeaMark className="kea-mark--header" />
        </Link>
        <div className="memory-library__nav">
          {languageCode ? (
            <Link className="memory-button" to="/conversation">
              Talk
            </Link>
          ) : null}
          <UserMenu />
        </div>
      </header>
      <div className="memory-library__content">
        <h1>Memory Library</h1>
        <p className="memory-library__lede">
          Words Kea is holding for you. They leave after {VOCABULARY_MASTERY_THRESHOLD}{' '}
          natural uses.
        </p>
        <label className="memory-library__search">
          <span className="visually-hidden">Search vocabulary</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search English or translation"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        {words.length === 0 ? (
          <p className="memory-library__empty">No words match that search.</p>
        ) : (
          <ul className="memory-library__list">
            {words.map((item) => (
              <li key={item.id} className="memory-library__card">
                <p className="memory-library__english">{item.english}</p>
                <p className="memory-library__translation">{item.translation}</p>
                <p className="memory-library__count">
                  Practised {item.successfulUses} / {VOCABULARY_MASTERY_THRESHOLD}
                  {languageCode ? null : ` · ${getLanguage(item.languageCode).name}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
