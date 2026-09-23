import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getChatTopics, openChatTopic } from '../architecture/companionMemory'
import { CloudAtmosphere } from '../components/companion/CloudAtmosphere'
import { CompanionNav } from '../components/companion/CompanionNav'

export function ChatTopicsPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [topics] = useState(() => getChatTopics())

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return topics
    return topics.filter(
      (item) =>
        item.title.toLowerCase().includes(needle) ||
        (item.nativeTitle || item.summary).toLowerCase().includes(needle),
    )
  }, [query, topics])

  function continueTopic(id: string) {
    openChatTopic(id)
    navigate('/conversation')
  }

  return (
    <main className="companion-screen memory-library">
      <CloudAtmosphere presence="idle" />
      <header className="memory-library__header">
        <CompanionNav />
      </header>
      <div className="memory-library__content">
        <h1>Current Chat Topics</h1>
        <p className="memory-library__lede">
          Things you have spoken about. Tap one to pick up that chat.
        </p>
        <label className="memory-library__search">
          <span className="visually-hidden">Search topics</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search topics"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        {rows.length === 0 ? (
          <p className="memory-library__empty">
            No topics yet. Start talking and Kea will remember what you were
            discussing.
          </p>
        ) : (
          <ul className="chat-topics__list">
            {rows.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="chat-topics__item"
                  onClick={() => continueTopic(item.id)}
                >
                  <span className="chat-topics__learnt">{item.title}</span>
                  {item.nativeTitle || item.summary ? (
                    <span className="chat-topics__native">
                      {item.nativeTitle || item.summary}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
