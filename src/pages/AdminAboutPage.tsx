import { useState } from 'react'
import {
  DEFAULT_ABOUT_KEA,
  KEA_BIRD_SRC,
  getAboutKea,
  resetAboutKea,
  saveAboutKea,
} from '../data/keaAbout'
import {
  DEFAULT_LEARN_MASTERY_USES,
  clampLearnMasteryUses,
  getLearnMasteryUses,
  MAX_LEARN_MASTERY_USES,
  MIN_LEARN_MASTERY_USES,
  saveLearnMasteryUses,
} from '../data/keaLearnMastery'
import {
  DEFAULT_AVERAGE_REPLY_WORDS,
  clampAverageReplyWords,
  getAverageReplyWords,
  MAX_AVERAGE_REPLY_WORDS,
  MIN_AVERAGE_REPLY_WORDS,
  saveAverageReplyWords,
} from '../data/keaSpeech'
import {
  DEFAULT_ANSWER_SILENCE_SECONDS,
  clampAnswerSilenceSeconds,
  getAnswerSilenceSeconds,
  MAX_ANSWER_SILENCE_SECONDS,
  MIN_ANSWER_SILENCE_SECONDS,
  resetAnswerSilenceSeconds,
  saveAnswerSilenceSeconds,
} from '../data/keaAnswerSilence'

export function AdminAboutPage() {
  const [about, setAbout] = useState(getAboutKea)
  const [saved, setSaved] = useState(false)
  const [averageWords, setAverageWords] = useState(getAverageReplyWords)
  const [masteryUses, setMasteryUses] = useState(getLearnMasteryUses)
  const [answerSilence, setAnswerSilence] = useState(getAnswerSilenceSeconds)

  return (
    <section className="settings-card">
      <h2>About Kea</h2>
      <img className="about-kea-admin__portrait" src={KEA_BIRD_SRC} alt="Kea" />
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
      <label className="welcome-field kea-length">
        <span>Learn List — uses before a word leaves</span>
        <p className="settings-note">
          When Kea hears a struggling word used well this many times, it leaves
          the Learn List and the number by the photo goes up by one. Default is{' '}
          {DEFAULT_LEARN_MASTERY_USES}.
        </p>
        <div className="kea-length__row">
          <input
            type="range"
            min={MIN_LEARN_MASTERY_USES}
            max={MAX_LEARN_MASTERY_USES}
            value={masteryUses}
            aria-valuetext={`${masteryUses} times`}
            onChange={(event) => {
              const next = clampLearnMasteryUses(Number(event.target.value))
              setMasteryUses(next)
              saveLearnMasteryUses(next)
            }}
          />
          <input
            type="number"
            min={MIN_LEARN_MASTERY_USES}
            max={MAX_LEARN_MASTERY_USES}
            value={masteryUses}
            aria-label="Correct uses before a word leaves the Learn List"
            onChange={(event) => {
              const next = clampLearnMasteryUses(Number(event.target.value))
              setMasteryUses(next)
              saveLearnMasteryUses(next)
            }}
          />
          <span className="kea-length__unit">times</span>
        </div>
      </label>
      <label className="welcome-field kea-length">
        <span>Wait before Kea answers</span>
        <p className="settings-note">
          After the user stops talking, Kea waits this long, then replies.
          Default is {DEFAULT_ANSWER_SILENCE_SECONDS} seconds.
        </p>
        <div className="kea-length__row">
          <input
            type="range"
            min={MIN_ANSWER_SILENCE_SECONDS}
            max={MAX_ANSWER_SILENCE_SECONDS}
            value={answerSilence}
            aria-valuetext={`${answerSilence} seconds`}
            onChange={(event) => {
              const next = clampAnswerSilenceSeconds(Number(event.target.value))
              setAnswerSilence(next)
              saveAnswerSilenceSeconds(next)
            }}
          />
          <input
            type="number"
            min={MIN_ANSWER_SILENCE_SECONDS}
            max={MAX_ANSWER_SILENCE_SECONDS}
            value={answerSilence}
            aria-label="Seconds of silence before Kea answers"
            onChange={(event) => {
              const next = clampAnswerSilenceSeconds(Number(event.target.value))
              setAnswerSilence(next)
              saveAnswerSilenceSeconds(next)
            }}
          />
          <span className="kea-length__unit">seconds</span>
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
            saveLearnMasteryUses(masteryUses)
            saveAnswerSilenceSeconds(answerSilence)
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
            setMasteryUses(DEFAULT_LEARN_MASTERY_USES)
            saveLearnMasteryUses(DEFAULT_LEARN_MASTERY_USES)
            resetAnswerSilenceSeconds()
            setAnswerSilence(DEFAULT_ANSWER_SILENCE_SECONDS)
            setSaved(true)
          }}
        >
          Restore original
        </button>
      </div>
    </section>
  )
}
