import { useState } from 'react'
import {
  createHomeComment,
  loadHomeComments,
  resetHomeComments,
  saveHomeComments,
  type KeaHomeComment,
} from '../data/keaHomeComments'

export function AdminHomePage() {
  const [comments, setComments] = useState(() => loadHomeComments())
  const [saved, setSaved] = useState('')

  function patch(id: string, next: Partial<KeaHomeComment>) {
    setComments((current) =>
      current.map((item) => (item.id === id ? { ...item, ...next } : item)),
    )
    setSaved('')
  }

  function move(index: number, dir: -1 | 1) {
    setComments((current) => {
      const target = index + dir
      if (target < 0 || target >= current.length) return current
      const copy = [...current]
      const [row] = copy.splice(index, 1)
      copy.splice(target, 0, row!)
      return copy
    })
    setSaved('')
  }

  function remove(id: string) {
    setComments((current) => current.filter((item) => item.id !== id))
    setSaved('')
  }

  function commit() {
    saveHomeComments(comments)
    setSaved('Saved.')
  }

  return (
    <>
      <section className="settings-card">
        <h2>Home page</h2>
        <p className="settings-note">
          Content shown on the marketing home page. User comments appear above
          the app store badges and legal footer.
        </p>
      </section>

      <section className="settings-card">
        <h2>User comments</h2>
        <p className="settings-note">
          Short quotes from learners. Turn each one on or off, edit the wording,
          and reorder as needed.
        </p>

        {comments.map((item, index) => (
          <div key={item.id} className="home-admin-comment">
            <div className="home-admin-comment__toolbar">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={(event) =>
                    patch(item.id, { enabled: event.target.checked })
                  }
                />
                Show on home page
              </label>
              <div className="home-admin-comment__moves">
                <button
                  type="button"
                  className="kea-button kea-button--ghost"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  Up
                </button>
                <button
                  type="button"
                  className="kea-button kea-button--ghost"
                  disabled={index === comments.length - 1}
                  onClick={() => move(index, 1)}
                >
                  Down
                </button>
                <button
                  type="button"
                  className="kea-button kea-button--ghost"
                  onClick={() => remove(item.id)}
                >
                  Remove
                </button>
              </div>
            </div>
            <label className="welcome-field">
              <span>Comment</span>
              <textarea
                rows={3}
                value={item.quote}
                onChange={(event) => patch(item.id, { quote: event.target.value })}
              />
            </label>
            <label className="welcome-field">
              <span>Attribution</span>
              <input
                type="text"
                value={item.attribution}
                placeholder="e.g. SH with Spanish"
                onChange={(event) =>
                  patch(item.id, { attribution: event.target.value })
                }
              />
            </label>
          </div>
        ))}

        <div className="home-admin-comment__actions">
          <button
            type="button"
            className="kea-button kea-button--ghost"
            onClick={() => {
              setComments((current) => [...current, createHomeComment()])
              setSaved('')
            }}
          >
            Add comment
          </button>
          <button type="button" className="kea-button" onClick={commit}>
            Save comments
          </button>
          <button
            type="button"
            className="kea-button kea-button--ghost"
            onClick={() => {
              const next = resetHomeComments()
              setComments(next)
              setSaved('Restored defaults.')
            }}
          >
            Restore defaults
          </button>
          {saved ? <p className="settings-note">{saved}</p> : null}
        </div>
      </section>

      <section className="settings-card">
        <h2>Preview</h2>
        <ul className="home-comments home-comments--admin-preview">
          {comments
            .filter((item) => item.enabled && item.quote.trim())
            .map((item) => (
              <li key={item.id}>
                <blockquote>“{item.quote}”</blockquote>
                {item.attribution ? <cite>{item.attribution}</cite> : null}
              </li>
            ))}
        </ul>
      </section>
    </>
  )
}
