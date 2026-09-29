import { useEffect, useMemo, useState } from 'react'
import {
  getLearnList,
  getLearnListStats,
  rememberLearnGloss,
  removeLearnItems,
  subscribeLearnMemory,
} from '../architecture/companionMemory'
import { getLearnMasteryUses } from '../data/keaLearnMastery'
import { CloudAtmosphere } from '../components/companion/CloudAtmosphere'
import { CompanionNav } from '../components/companion/CompanionNav'
import { useSession } from '../context/SessionContext'
import { getLanguage } from '../config/languages'
import { glossLearnWord } from '../services/keaChat'

export function LearnListPage() {
  const { languageCode } = useSession()
  const [query, setQuery] = useState('')
  const [items, setItems] = useState(() => getLearnList())
  const [stats, setStats] = useState(() => getLearnListStats(languageCode))
  const [picked, setPicked] = useState<Set<string>>(() => new Set())
  const need = getLearnMasteryUses()

  useEffect(() => {
    const refresh = () => {
      const nextItems = getLearnList()
      setItems(nextItems)
      setStats(getLearnListStats(languageCode))
      const live = new Set(nextItems.map((item) => item.id))
      setPicked((current) => {
        const next = new Set([...current].filter((id) => live.has(id)))
        return next.size === current.size ? current : next
      })
    }
    refresh()
    const stop = subscribeLearnMemory(refresh)
    window.addEventListener('kea-learn-memory', refresh)
    return () => {
      stop()
      window.removeEventListener('kea-learn-memory', refresh)
    }
  }, [languageCode])

  useEffect(() => {
    if (!languageCode) return
    const targetName = getLanguage(languageCode).name
    let cancelled = false
    for (const item of items) {
      if (item.languageCode !== languageCode || item.translation.trim()) continue
      void glossLearnWord(item.term, targetName)
        .then((translation) => {
          if (!cancelled) rememberLearnGloss(item.id, translation)
        })
        .catch(() => {
          // Leave the lozenge empty until the next try.
        })
    }
    return () => {
      cancelled = true
    }
  }, [items, languageCode])

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

  function togglePicked(id: string) {
    setPicked((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function deletePicked() {
    if (picked.size === 0) return
    removeLearnItems([...picked])
    setPicked(new Set())
  }

  return (
    <main className="companion-screen memory-library">
      <CloudAtmosphere presence="idle" />
      <header className="memory-library__header">
        <CompanionNav />
      </header>
      <div className="memory-library__content">
        <div className="learn-list__title-row">
          <h1>Learn List</h1>
          <button
            type="button"
            className="learn-list__bin"
            aria-label={
              picked.size
                ? `Delete ${picked.size} ticked word${picked.size === 1 ? '' : 's'}`
                : 'Delete ticked words'
            }
            disabled={picked.size === 0}
            onClick={deletePicked}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                fill="currentColor"
                d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z"
              />
            </svg>
          </button>
        </div>
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
              <li
                key={item.id}
                className={`memory-library__card${picked.has(item.id) ? ' is-picked' : ''}`}
              >
                <div className="memory-library__row">
                  <label className="learn-list__tick">
                    <input
                      type="checkbox"
                      checked={picked.has(item.id)}
                      onChange={() => togglePicked(item.id)}
                      aria-label={`Tick ${item.term} for deletion`}
                    />
                    <span aria-hidden="true" />
                  </label>
                  <p className="memory-library__pair">
                    <span className="memory-library__native">{item.term}</span>
                    <span className="memory-library__target">
                      {item.translation || '…'}
                    </span>
                  </p>
                  <p
                    className="memory-library__count"
                    title="Uses left before this word leaves the list"
                  >
                    <strong>{Math.max(0, need - item.practiceCount)}</strong>
                    <span>left</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
