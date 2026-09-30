import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
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

/** e.g. 28/9/26 — day/month/yy as on the Learn List cards. */
function formatAddedDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const yy = String(date.getFullYear()).slice(-2)
  return `${date.getDate()}/${date.getMonth() + 1}/${yy}`
}

function itemAddedAt(item: { createdAt?: string; lastReviewedAt?: string }) {
  return item.createdAt || item.lastReviewedAt || ''
}

function RedBinIcon() {
  return (
    <svg viewBox="0 0 24 28" aria-hidden="true" focusable="false">
      <path
        fill="#e23b3b"
        d="M6.2 3.2h11.6c.7 0 1.2.5 1.2 1.1v1.4H5V4.3c0-.6.5-1.1 1.2-1.1z"
      />
      <path
        fill="#e23b3b"
        d="M4.2 6.8h15.6c.4 0 .7.4.6.8L18.2 25c-.1.7-.7 1.2-1.4 1.2H7.2c-.7 0-1.3-.5-1.4-1.2L2.6 7.6c-.1-.4.2-.8.6-.8z"
      />
      <path
        fill="none"
        stroke="#fff"
        strokeWidth="1.35"
        strokeLinecap="round"
        d="M9.2 11.2v10.2M12 11.2v10.2M14.8 11.2v10.2"
      />
    </svg>
  )
}

export function LearnListPage() {
  const { languageCode } = useSession()
  const [query, setQuery] = useState('')
  const [items, setItems] = useState(() => getLearnList())
  const [stats, setStats] = useState(() => getLearnListStats(languageCode))
  const [picked, setPicked] = useState<Set<string>>(() => new Set())
  const [glossBusy, setGlossBusy] = useState<Set<string>>(() => new Set())
  const glossInflight = useRef(new Set<string>())
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
    const missing = items.filter(
      (item) =>
        item.languageCode === languageCode && !item.translation.trim(),
    )
    for (const item of missing) {
      if (glossInflight.current.has(item.id)) continue
      glossInflight.current.add(item.id)
      setGlossBusy((current) => {
        if (current.has(item.id)) return current
        const next = new Set(current)
        next.add(item.id)
        return next
      })
      void glossLearnWord(item.term, targetName)
        .then((translation) => {
          if (cancelled) return
          rememberLearnGloss(item.id, translation)
        })
        .catch(() => {
          // Leave empty; user can tap to retry.
        })
        .finally(() => {
          glossInflight.current.delete(item.id)
          if (cancelled) return
          setGlossBusy((current) => {
            if (!current.has(item.id)) return current
            const next = new Set(current)
            next.delete(item.id)
            return next
          })
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
          <Link
            to="/conversation"
            className="learn-list__exit"
            aria-label="Close Learn List"
          >
            ×
          </Link>
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
        <div className="learn-list__tools">
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
            <RedBinIcon />
          </button>
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
        </div>
        {words.length === 0 ? (
          <p className="memory-library__empty">
            Nothing here yet. When you drop an English word into a Spanish
            sentence, it lands here automatically.
          </p>
        ) : (
          <ul className="memory-library__list">
            {words.map((item) => {
              const added = formatAddedDate(itemAddedAt(item))
              const gloss =
                item.translation.trim() ||
                (glossBusy.has(item.id) ? '…' : '')
              return (
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
                    <div className="memory-library__main">
                      <p className="memory-library__pair">
                        <span className="memory-library__native">
                          {item.term}
                        </span>
                        {gloss ? (
                          <span className="memory-library__target">{gloss}</span>
                        ) : (
                          <button
                            type="button"
                            className="memory-library__target memory-library__target--retry"
                            onClick={() => {
                              if (!languageCode) return
                              setGlossBusy((current) => new Set(current).add(item.id))
                              void glossLearnWord(
                                item.term,
                                getLanguage(languageCode).name,
                              )
                                .then((translation) =>
                                  rememberLearnGloss(item.id, translation),
                                )
                                .catch(() => {})
                                .finally(() => {
                                  setGlossBusy((current) => {
                                    const next = new Set(current)
                                    next.delete(item.id)
                                    return next
                                  })
                                })
                            }}
                          >
                            Tap for translation
                          </button>
                        )}
                      </p>
                    </div>
                    <div className="memory-library__meta">
                      {added ? (
                        <p className="memory-library__added" title="Date added">
                          {added}
                        </p>
                      ) : null}
                      <p
                        className="memory-library__count"
                        title="Uses left before this word leaves the list"
                      >
                        <strong>{Math.max(0, need - item.practiceCount)}</strong>
                        <span>left</span>
                      </p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </main>
  )
}
