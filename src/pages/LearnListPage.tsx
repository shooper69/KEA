import { useEffect, useMemo, useState } from 'react'
import {
  getLearnList,
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
  const need = getLearnMasteryUses()

  useEffect(() => {
    const refresh = () => setItems(getLearnList())
    const stop = subscribeLearnMemory(refresh)
    window.addEventListener('kea-learn-memory', refresh)
    return () => {
      stop()
      window.removeEventListener('kea-learn-memory', refresh)
    }
  }, [])

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
        <p className="memory-library__lede">
          The following is a list of words and phrases that you have struggled
          with. They leave once Kea has heard you use them well {need} times.
        </p>
        <label className="memory-library__search">
          <span className="visually-hidden">Search Learn List</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search terms"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        {words.length === 0 ? (
          <p className="memory-library__empty">
            Nothing here yet. Ask Kea how to say something, or ask a grammar
            question, and it will land on this list.
          </p>
        ) : (
          <ul className="memory-library__list">
            {words.map((item) => (
              <li key={item.id} className="memory-library__card">
                <p className="memory-library__pair">
                  {item.term} .... {item.translation}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
