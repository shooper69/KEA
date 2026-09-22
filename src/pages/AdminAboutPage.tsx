import { useState } from 'react'
import {
  DEFAULT_ABOUT_KEA,
  getAboutKea,
  resetAboutKea,
  saveAboutKea,
} from '../data/keaAbout'
import {
  DEFAULT_AVERAGE_REPLY_WORDS,
  clampAverageReplyWords,
  getAverageReplyWords,
  MAX_AVERAGE_REPLY_WORDS,
  MIN_AVERAGE_REPLY_WORDS,
  saveAverageReplyWords,
} from '../data/keaSpeech'

export function AdminAboutPage() {
  const [about, setAbout] = useState(getAboutKea)
  const [saved, setSaved] = useState(false)
  const [averageWords, setAverageWords] = useState(getAverageReplyWords)

  return (
    <section className="settings-card">
      <h2>About Kea</h2>
      <p className="settings-note">
        This is Kea, written in the first person. She reads it on every turn.
        When someone asks who she is, she answers as this person. Keep adding
        to it; she will use whatever you save here.
      </p>
      <label className="welcome-field kea-length">
        <span>Average length of answers</span>
        <p className="settings-note">
          How long Kea usually talks: replies and conversational snippets.
          Default is {DEFAULT_AVERAGE_REPLY_WORDS} words. She can go a little
          shorter or longer when it fits.
        </p>
        <div className="kea-length__row">
          <input
            type="range"
            min={MIN_AVERAGE_REPLY_WORDS}
            max={MAX_AVERAGE_REPLY_WORDS}
            value={averageWords}
            aria-valuetext={`${averageWords} words`}
            onChange={(event) => {
              const next = clampAverageReplyWords(Number(event.target.value))
              setAverageWords(next)
              saveAverageReplyWords(next)
            }}
          />
          <input
            type="number"
            min={MIN_AVERAGE_REPLY_WORDS}
            max={MAX_AVERAGE_REPLY_WORDS}
            value={averageWords}
            aria-label="Average words per reply"
            onChange={(event) => {
              const next = clampAverageReplyWords(Number(event.target.value))
              setAverageWords(next)
              saveAverageReplyWords(next)
            }}
          />
          <span className="kea-length__unit">words</span>
        </div>
      </label>
      <textarea
        className="master-definition about-kea"
        aria-label="About Kea"
        value={about}
        onChange={(event) => {
          setAbout(event.target.value)
          setSaved(false)
        }}
      />
      <div className="welcome-screen__actions">
        <button
          type="button"
          className="kea-button"
          onClick={() => {
            saveAboutKea(about)
            saveAverageReplyWords(averageWords)
            setSaved(true)
          }}
        >
          {saved ? 'Saved' : 'Save About Kea'}
        </button>
        <button
          type="button"
          className="kea-button kea-button--ghost"
          onClick={() => {
            resetAboutKea()
            setAbout(DEFAULT_ABOUT_KEA)
            setAverageWords(DEFAULT_AVERAGE_REPLY_WORDS)
            saveAverageReplyWords(DEFAULT_AVERAGE_REPLY_WORDS)
            setSaved(true)
          }}
        >
          Restore original
        </button>
      </div>
    </section>
  )
}
