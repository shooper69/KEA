import { useEffect, useState } from 'react'
import { getEnabledHomeComments } from '../../data/keaHomeComments'

const ROTATE_MS = 6500
const FADE_MS = 320

/** Learner quotes on the marketing home page — one at a time, above store badges. */
export function HomeCommentsStrip() {
  const comments = getEnabledHomeComments()
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    setIndex(0)
    setVisible(true)
  }, [comments.length])

  useEffect(() => {
    if (comments.length <= 1) return

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    let fadeTimer = 0
    const id = window.setInterval(() => {
      if (reduceMotion) {
        setIndex((current) => (current + 1) % comments.length)
        return
      }
      setVisible(false)
      window.clearTimeout(fadeTimer)
      fadeTimer = window.setTimeout(() => {
        setIndex((current) => (current + 1) % comments.length)
        setVisible(true)
      }, FADE_MS)
    }, ROTATE_MS)

    return () => {
      window.clearInterval(id)
      window.clearTimeout(fadeTimer)
    }
  }, [comments.length])

  if (comments.length === 0) return null

  const item = comments[index % comments.length]
  if (!item) return null

  return (
    <section className="home-comments" aria-label="What learners say" aria-live="polite">
      <figure
        className={`home-comments__item${visible ? ' is-visible' : ''}`}
      >
        <blockquote className="home-comments__quote">“{item.quote}”</blockquote>
        {item.attribution ? (
          <figcaption className="home-comments__by">{item.attribution}</figcaption>
        ) : null}
      </figure>
    </section>
  )
}
