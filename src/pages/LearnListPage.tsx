import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getLearnList } from '../architecture/companionMemory'
import { CloudAtmosphere } from '../components/companion/CloudAtmosphere'
import { KeaMark } from '../components/companion/KeaMark'
import { CompanionNav } from '../components/companion/CompanionNav'
import { useSession } from '../context/SessionContext'

export function LearnListPage() {
  const { languageCode } = useSession()
  const [query, setQuery] = useState('')
  const [items] = useState(() => getLearnList())

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
        <Link to="/conversation" aria-label="Kea home">
          <KeaMark className="kea-mark--header" />
        </Link>
        <CompanionNav />
      </header>
      <div className="memory-library__content">
        <h1>Learn List</h1>
        <p className="memory-library__lede">
          The following is a list of words and phrases that you have struggled
          with. They get removed one by one once Kea sees that you have become
          proficient in their use.
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
                <p className="memory-library__english">
                  {item.term} = {item.translation}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
