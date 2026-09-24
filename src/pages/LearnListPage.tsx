import { useEffect, useMemo, useState } from 'react'
import {
  getLearnList,
  getLearnListStats,
  subscribeLearnMemory,
} from '../architecture/companionMemory'
import { getLearnMasteryUses } from '../data/keaLearnMastery'
import { CloudAtmosphere } from '../components/companion/CloudAtmosphere'
import { CompanionNav } from '../components/companion/CompanionNav'
import { useSession } from '../context/SessionContext'

export function LearnListPage() {
  const { languageCode } = useSession()
  const [query, setQuery] = useState('')
  const [items, setItems] = useState(() => getLearnList())
  const [stats, setStats] = useState(() => getLearnListStats(languageCode))
  const need = getLearnMasteryUses()

  useEffect(() => {
    const refresh = () => {
      setItems(getLearnList())
      setStats(getLearnListStats(languageCode))
    }
    refresh()
    const stop = subscribeLearnMemory(refresh)
    window.addEventListener('kea-learn-memory', refresh)
    return () => {
      stop()
      window.removeEventListener('kea-learn-memory', refresh)
    }
  }, [languageCode])

  const words = useMemo(() => {
    const scoped = languageCode
      ? items.filter((item) => item.languageCode === languageCode)
      : items
    const needle = query.trim().toLowerCase()
    if (!needle) return scoped
    return scoped.filter(
      (item) =>
        item.term.toLowerCase().includes(needle) ||
        item.translation.toLowerCase().includes(needle),
    )
  }, [items, languageCode, query])

  return (
    <main className="companion-screen memory-library">
      <CloudAtmosphere presence="idle" />
      <header className="memory-library__header">
        <CompanionNav />
      </header>
      <div className="memory-library__content">
        <h1>Learn List</h1>
        <p className="learn-list-stats" aria-live="polite">
          <span>
            <strong>{stats.ever}</strong> have been on this list
          </span>
          <span className="learn-list-stats__sep" aria-hidden="true">
            ·
          </span>
          <span>
            <strong>{stats.removed}</strong> removed
          </span>
          <span className="learn-list-stats__sep" aria-hidden="true">
            ·
          </span>
          <span>
            <strong>{stats.onList}</strong> here now
          </span>
        </p>
        <p className="memory-library__lede">
          Words you reached for in your own language while speaking. Your
          language is first, then the word to learn. Say “test me on the Learn
          List” and Kea will quiz you with each word in a sentence. Words leave
          after you use them naturally {need} times.
        </p>
        <label className="memory-library__search">
          <span className="visually-hidden">Search Learn List</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search words"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        {words.length === 0 ? (
          <p className="memory-library__empty">
            Nothing here yet. When you drop an English word into a Spanish
            sentence, it lands here automatically.
          </p>
        ) : (
          <ul className="memory-library__list">
            {words.map((item) => (
              <li key={item.id} className="memory-library__card">
                <p className="memory-library__pair">
                  <span className="memory-library__native">{item.term}</span>
                  {item.translation ? (
                    <>
                      <span className="memory-library__sep" aria-hidden="true">
                        {' '}
                        ·{' '}
                      </span>
                      <span className="memory-library__target">
                        {item.translation}
                      </span>
                    </>
                  ) : null}
                </p>
                <p className="memory-library__count">
                  Used well {item.practiceCount}/{need}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
