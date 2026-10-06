import { useEffect, useMemo, useState } from 'react'
import {
  countEnabled,
  loadVoiceCatalog,
  MAX_USER_VOICES,
  mergeBrowserVoices,
  saveVoiceCatalog,
  VOICE_SAMPLE,
  type ManagedVoice,
  type VoiceCatalog,
} from '../architecture/voiceCatalog'
import { useSession } from '../context/SessionContext'
import {
  DEFAULT_ABOUT_KEA,
  KEA_BIRD_SRC,
  getAboutKea,
  resetAboutKea,
  saveAboutKea,
} from '../data/keaAbout'
import {
  DEFAULT_ANSWER_SILENCE_SECONDS,
  clampAnswerSilenceSeconds,
  getAnswerSilenceSeconds,
  MAX_ANSWER_SILENCE_SECONDS,
  MIN_ANSWER_SILENCE_SECONDS,
  resetAnswerSilenceSeconds,
  saveAnswerSilenceSeconds,
} from '../data/keaAnswerSilence'
import {
  bannedTopicsToText,
  getBannedTopics,
  parseBannedTopicsText,
  resetBannedTopics,
  saveBannedTopics,
} from '../data/keaBannedTopics'
import {
  DEFAULT_LEARN_MASTERY_USES,
  clampLearnMasteryUses,
  getLearnMasteryUses,
  MAX_LEARN_MASTERY_USES,
  MIN_LEARN_MASTERY_USES,
  saveLearnMasteryUses,
} from '../data/keaLearnMastery'
import {
  DEFAULT_KEA_MASTER_DEFINITION,
  getMasterDefinition,
  resetMasterDefinition,
  saveMasterDefinition,
} from '../data/keaMasterDefinition'
import {
  DEFAULT_AVERAGE_REPLY_WORDS,
  clampAverageReplyWords,
  getAverageReplyWords,
  MAX_AVERAGE_REPLY_WORDS,
  MIN_AVERAGE_REPLY_WORDS,
  saveAverageReplyWords,
} from '../data/keaSpeech'
import {
  DEFAULT_WELCOME_TITLE,
  getWelcomeTitle,
  resetWelcomeTitle,
  saveWelcomeTitle,
} from '../data/keaWelcomeTitle'
import { listVoices, speakText, stopSpeech } from '../lib/speech'
import {
  readChosenTts,
  saveChosenTts,
  subscribeVoices,
  TTS_SAMPLE,
  type ChosenTtsVoice,
} from '../lib/chosenTts'
import { speakManagedVoice, stopKeaSpeech } from '../services/keaSpeak'

type ManageSection =
  | 'timing'
  | 'character'
  | 'style'
  | 'banned'
  | 'voices'
  | 'tester'

const SECTIONS: Array<{ id: ManageSection; label: string }> = [
  { id: 'timing', label: 'Timing' },
  { id: 'character', label: 'Character' },
  { id: 'style', label: 'Style' },
  { id: 'banned', label: 'Banned topics' },
  { id: 'voices', label: 'Voices' },
  { id: 'tester', label: 'Voice tester' },
]

export function AdminManageKeaPage() {
  const [section, setSection] = useState<ManageSection>('timing')

  return (
    <div className="manage-kea">
      <section className="settings-card">
        <h2>Manage Kea</h2>
        <p className="settings-note">
          Character, style, banned topics, answer timing, and voices — all in
          one place.
        </p>
        <nav className="manage-kea__sections" aria-label="Manage Kea sections">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`manage-kea__section-btn${section === item.id ? ' is-active' : ''}`}
              onClick={() => setSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </section>

      {section === 'timing' ? <TimingSection /> : null}
      {section === 'character' ? <CharacterSection /> : null}
      {section === 'style' ? <StyleSection /> : null}
      {section === 'banned' ? <BannedSection /> : null}
      {section === 'voices' ? <VoicesSection /> : null}
      {section === 'tester' ? <TesterSection /> : null}
    </div>
  )
}

function TimingSection() {
  const { setProfile } = useSession()
  const [answerSilence, setAnswerSilence] = useState(getAnswerSilenceSeconds)
  const [saved, setSaved] = useState(false)

  return (
    <section className="settings-card">
      <h2>Answer timing</h2>
      <p className="settings-note">
        After the learner stops talking, Kea waits this long of quiet, then
        starts her reply. Default is {DEFAULT_ANSWER_SILENCE_SECONDS} seconds
        so she does not interrupt. Lower it if you want her to answer sooner.
      </p>
      <label className="welcome-field kea-length">
        <span>Kea starts to answer after</span>
        <div className="kea-length__row">
          <input
            type="range"
            min={MIN_ANSWER_SILENCE_SECONDS}
            max={MAX_ANSWER_SILENCE_SECONDS}
            step={0.5}
            value={answerSilence}
            aria-valuetext={`${answerSilence} seconds`}
            onChange={(event) => {
              const next = clampAnswerSilenceSeconds(Number(event.target.value))
              setAnswerSilence(next)
              setSaved(false)
            }}
          />
          <input
            type="number"
            min={MIN_ANSWER_SILENCE_SECONDS}
            max={MAX_ANSWER_SILENCE_SECONDS}
            step={0.5}
            value={answerSilence}
            aria-label="Seconds of silence before Kea answers"
            onChange={(event) => {
              const next = clampAnswerSilenceSeconds(Number(event.target.value))
              setAnswerSilence(next)
              setSaved(false)
            }}
          />
          <span className="kea-length__unit">seconds</span>
        </div>
      </label>
      <div className="welcome-screen__actions">
        <button
          type="button"
          className="kea-button"
          onClick={() => {
            saveAnswerSilenceSeconds(answerSilence)
            setProfile({ answerAfterSilenceSeconds: answerSilence })
            setSaved(true)
          }}
        >
          {saved ? 'Saved' : 'Save timing'}
        </button>
        <button
          type="button"
          className="kea-button kea-button--ghost"
          onClick={() => {
            resetAnswerSilenceSeconds()
            setAnswerSilence(DEFAULT_ANSWER_SILENCE_SECONDS)
            setProfile({
              answerAfterSilenceSeconds: DEFAULT_ANSWER_SILENCE_SECONDS,
            })
            setSaved(true)
          }}
        >
          Restore {DEFAULT_ANSWER_SILENCE_SECONDS}s
        </button>
      </div>
    </section>
  )
}

function CharacterSection() {
  const [about, setAbout] = useState(getAboutKea)
  const [welcomeTitle, setWelcomeTitle] = useState(getWelcomeTitle)
  const [saved, setSaved] = useState(false)
  const [welcomeSaved, setWelcomeSaved] = useState(false)

  return (
    <section className="settings-card">
      <h2>Character</h2>
      <img className="about-kea-admin__portrait" src={KEA_BIRD_SRC} alt="Kea" />
      <p className="settings-note">
        Written in the first person. She reads this on every turn when someone
        asks who she is.
      </p>
      <label className="welcome-field">
        <span>Marketing page title</span>
        <p className="settings-note">
          Headline on the welcome page. Default is “{DEFAULT_WELCOME_TITLE}”.
        </p>
        <input
          type="text"
          value={welcomeTitle}
          maxLength={120}
          onChange={(event) => {
            setWelcomeTitle(event.target.value)
            setWelcomeSaved(false)
          }}
        />
      </label>
      <div className="welcome-screen__actions">
        <button
          type="button"
          className="kea-button"
          onClick={() => {
            saveWelcomeTitle(welcomeTitle)
            setWelcomeTitle(getWelcomeTitle())
            setWelcomeSaved(true)
          }}
        >
          {welcomeSaved ? 'Title saved' : 'Save title'}
        </button>
        <button
          type="button"
          className="kea-button kea-button--ghost"
          onClick={() => {
            resetWelcomeTitle()
            setWelcomeTitle(DEFAULT_WELCOME_TITLE)
            setWelcomeSaved(true)
          }}
        >
          Restore title
        </button>
      </div>
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
            setSaved(true)
          }}
        >
          {saved ? 'Saved' : 'Save character'}
        </button>
        <button
          type="button"
          className="kea-button kea-button--ghost"
          onClick={() => {
            resetAboutKea()
            setAbout(DEFAULT_ABOUT_KEA)
            setSaved(true)
          }}
        >
          Restore original
        </button>
      </div>
    </section>
  )
}

function StyleSection() {
  const [definition, setDefinition] = useState(getMasterDefinition)
  const [averageWords, setAverageWords] = useState(getAverageReplyWords)
  const [masteryUses, setMasteryUses] = useState(getLearnMasteryUses)
  const [defSaved, setDefSaved] = useState(false)

  return (
    <>
      <section className="settings-card">
        <h2>Reply style</h2>
        <label className="welcome-field kea-length">
          <span>Average length of answers</span>
          <p className="settings-note">
            How long Kea usually talks. Default is {DEFAULT_AVERAGE_REPLY_WORDS}{' '}
            words.
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
            Default is {DEFAULT_LEARN_MASTERY_USES}.
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
      </section>
      <section className="settings-card">
        <h2>Master definition</h2>
        <p className="settings-note">
          Source of truth for how Kea talks. Saved edits are used in live
          conversation.
        </p>
        <textarea
          className="master-definition"
          value={definition}
          onChange={(event) => {
            setDefinition(event.target.value)
            setDefSaved(false)
          }}
          spellCheck={false}
        />
        <div className="welcome-screen__actions">
          <button
            type="button"
            className="kea-button"
            onClick={() => {
              saveMasterDefinition(definition)
              setDefSaved(true)
            }}
          >
            {defSaved ? 'Saved' : 'Save definition'}
          </button>
          <button
            type="button"
            className="kea-button kea-button--ghost"
            onClick={() => {
              resetMasterDefinition()
              setDefinition(DEFAULT_KEA_MASTER_DEFINITION)
              setDefSaved(true)
            }}
          >
            Restore original
          </button>
        </div>
      </section>
    </>
  )
}

function BannedSection() {
  const [text, setText] = useState(() => bannedTopicsToText(getBannedTopics()))
  const [saved, setSaved] = useState(false)

  return (
    <section className="settings-card">
      <h2>Banned topics</h2>
      <p className="settings-note">
        One topic or phrase per line. Kea will not discuss these — if asked, she
        declines briefly and changes the subject. Defaults include{' '}
        <strong>rape</strong> and <strong>bomb building</strong>; add, edit, or
        remove lines, then Save.
      </p>
      <textarea
        className="master-definition manage-kea__banned"
        aria-label="Banned topics"
        placeholder={'rape\nbomb building\n…'}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          setSaved(false)
        }}
      />
      <div className="welcome-screen__actions">
        <button
          type="button"
          className="kea-button"
          onClick={() => {
            saveBannedTopics(parseBannedTopicsText(text))
            setText(bannedTopicsToText(getBannedTopics()))
            setSaved(true)
          }}
        >
          {saved ? 'Saved' : 'Save banned topics'}
        </button>
        <button
          type="button"
          className="kea-button kea-button--ghost"
          onClick={() => {
            resetBannedTopics()
            setText(bannedTopicsToText(getBannedTopics()))
            setSaved(true)
          }}
        >
          Restore defaults
        </button>
      </div>
    </section>
  )
}

function VoicesSection() {
  const [catalog, setCatalog] = useState<VoiceCatalog>(() => loadVoiceCatalog())
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [showAllBrowser, setShowAllBrowser] = useState(false)

  useEffect(() => {
    return subscribeVoices((installed) => {
      setCatalog((current) => {
        const next = mergeBrowserVoices(current, installed)
        if (next === current) return current
        saveVoiceCatalog(next)
        return next
      })
    })
  }, [])

  const openaiVoices = useMemo(
    () => filterGroup(catalog.voices, 'openai', query),
    [catalog.voices, query],
  )
  const browserVoices = useMemo(() => {
    const all = filterGroup(catalog.voices, 'browser', query)
    if (showAllBrowser || query.trim()) return all
    const enabled = all.filter((item) => item.enabled)
    return enabled.length ? enabled : all.slice(0, 12)
  }, [catalog.voices, query, showAllBrowser])
  const browserTotal = useMemo(
    () => catalog.voices.filter((item) => item.provider === 'browser').length,
    [catalog.voices],
  )
  const enabledCount = countEnabled(catalog)
  const marketingVoice =
    catalog.voices.find((item) => item.id === catalog.marketingIntroId) || null

  function commit(next: VoiceCatalog) {
    saveVoiceCatalog(next)
    setCatalog(next)
  }

  function patchVoice(id: string, patch: Partial<ManagedVoice>) {
    if (
      patch.enabled === true &&
      !catalog.voices.find((item) => item.id === id)?.enabled
    ) {
      if (enabledCount >= MAX_USER_VOICES) {
        setNotice(
          `Users can only see ${MAX_USER_VOICES} voices. Turn one off first.`,
        )
        return
      }
    }
    setNotice('')
    commit({
      ...catalog,
      voices: catalog.voices.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    })
  }

  async function play(voice: ManagedVoice) {
    setPlayingId(voice.id)
    setNotice('')
    await speakManagedVoice(voice, VOICE_SAMPLE, {
      lang: voice.lang,
      onend: () => setPlayingId(null),
      onerror: () => {
        setPlayingId(null)
        setNotice(
          voice.provider === 'openai'
            ? 'Could not play that OpenAI voice. Check OPENAI_API_KEY on the server.'
            : 'Could not play that browser voice.',
        )
      },
    })
  }

  return (
    <section className="settings-card">
      <h2>Voices</h2>
      <p className="settings-note">
        Curate up to {MAX_USER_VOICES} voices for users. They only see the names
        and descriptions you write here.
      </p>
      <p className="settings-note">
        {enabledCount} of {MAX_USER_VOICES} enabled for users.
      </p>
      {notice ? <p className="error-text">{notice}</p> : null}

      <div className="voice-manage__marketing">
        <h3 className="voice-manage__heading">Marketing page intro</h3>
        <label className="welcome-field">
          <span>Intro voice</span>
          <select
            value={catalog.marketingIntroId}
            onChange={(event) => {
              commit({ ...catalog, marketingIntroId: event.target.value })
              setNotice('')
            }}
          >
            {catalog.voices
              .filter(
                (voice) =>
                  voice.provider === 'openai' ||
                  voice.enabled ||
                  voice.id === catalog.marketingIntroId,
              )
              .map((voice) => {
                const label =
                  voice.userName.trim() || voice.actualName || voice.id
                const desc = voice.userDescription.trim()
                return (
                  <option key={voice.id} value={voice.id}>
                    {label}
                    {desc ? ` — ${desc}` : ''}
                    {voice.provider === 'openai'
                      ? ` (${voice.actualName})`
                      : ''}
                  </option>
                )
              })}
          </select>
        </label>
        {marketingVoice ? (
          <div className="voice-manage__actions">
            <button
              type="button"
              className="kea-button kea-button--ghost"
              onClick={() => void play(marketingVoice)}
            >
              {playingId === marketingVoice.id
                ? 'Playing…'
                : 'Preview intro voice'}
            </button>
          </div>
        ) : null}
      </div>

      <label className="welcome-field">
        <span>Find a voice</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nova, Soft Charm, Microsoft Aria…"
        />
      </label>
      <h3 className="voice-manage__heading">OpenAI voices</h3>
      <ul className="voice-manage__list">
        {openaiVoices.map((voice) => (
          <VoiceRow
            key={voice.id}
            voice={voice}
            isDefault={catalog.defaultId === voice.id}
            isMarketingIntro={catalog.marketingIntroId === voice.id}
            playing={playingId === voice.id}
            onPatch={(patch) => patchVoice(voice.id, patch)}
            onDefault={() => commit({ ...catalog, defaultId: voice.id })}
            onMarketingIntro={() =>
              commit({ ...catalog, marketingIntroId: voice.id })
            }
            onPlay={() => void play(voice)}
            onStop={stopKeaSpeech}
          />
        ))}
      </ul>
      <h3 className="voice-manage__heading">Browser voices</h3>
      <p className="settings-note">
        {browserTotal} installed
        {!showAllBrowser && !query.trim()
          ? ' — showing enabled (or first few). Search or show all to browse.'
          : '.'}
      </p>
      {!showAllBrowser && !query.trim() ? (
        <button
          type="button"
          className="kea-button kea-button--ghost"
          onClick={() => setShowAllBrowser(true)}
        >
          Show all browser voices
        </button>
      ) : null}
      <ul className="voice-manage__list">
        {browserVoices.map((voice) => (
          <VoiceRow
            key={voice.id}
            voice={voice}
            isDefault={catalog.defaultId === voice.id}
            isMarketingIntro={catalog.marketingIntroId === voice.id}
            playing={playingId === voice.id}
            onPatch={(patch) => patchVoice(voice.id, patch)}
            onDefault={() => commit({ ...catalog, defaultId: voice.id })}
            onMarketingIntro={() =>
              commit({ ...catalog, marketingIntroId: voice.id })
            }
            onPlay={() => void play(voice)}
            onStop={stopKeaSpeech}
          />
        ))}
      </ul>
      {!browserVoices.length ? (
        <p className="settings-note">No installed browser voices found yet.</p>
      ) : null}
    </section>
  )
}

function TesterSection() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => listVoices())
  const [rate, setRate] = useState(1)
  const [pitch, setPitch] = useState(1)
  const [chosen, setChosen] = useState<ChosenTtsVoice | null>(readChosenTts)
  const [playing, setPlaying] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => subscribeVoices(setVoices), [])

  useEffect(() => {
    const saved = readChosenTts()
    if (!saved) return
    setChosen(saved)
    setRate(saved.rate)
    setPitch(saved.pitch)
  }, [])

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const list = [...voices].sort(
      (a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name),
    )
    if (!needle) return list.slice(0, 40)
    return list
      .filter(
        (voice) =>
          voice.name.toLowerCase().includes(needle) ||
          voice.lang.toLowerCase().includes(needle),
      )
      .slice(0, 60)
  }, [query, voices])

  function play(voice: SpeechSynthesisVoice) {
    setPlaying(voice.voiceURI)
    speakText(TTS_SAMPLE, {
      lang: voice.lang,
      rate,
      pitch,
      voiceURI: voice.voiceURI,
      onend: () => setPlaying(null),
      onerror: () => setPlaying(null),
    })
  }

  function select(voice: SpeechSynthesisVoice) {
    const next: ChosenTtsVoice = {
      voiceURI: voice.voiceURI,
      name: voice.name,
      lang: voice.lang,
      rate,
      pitch,
    }
    saveChosenTts(next)
    setChosen(next)
  }

  return (
    <section className="settings-card">
      <h2>Voice tester</h2>
      <p className="settings-note">
        Diagnostics for every voice this browser reports. Curated user voices
        live under Voices.
      </p>
      {chosen ? (
        <p className="settings-note">
          Saved: {chosen.name} · {chosen.lang} · speed {chosen.rate.toFixed(2)} ·
          pitch {chosen.pitch.toFixed(2)}
        </p>
      ) : (
        <p className="settings-note">No browser voice saved yet.</p>
      )}
      <label className="welcome-field">
        <span>Speed {rate.toFixed(2)}</span>
        <input
          type="range"
          min="0.5"
          max="1.6"
          step="0.05"
          value={rate}
          onChange={(event) => setRate(Number(event.target.value))}
        />
      </label>
      <label className="welcome-field">
        <span>Pitch {pitch.toFixed(2)}</span>
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.05"
          value={pitch}
          onChange={(event) => setPitch(Number(event.target.value))}
        />
      </label>
      <label className="memory-library__search">
        <span className="visually-hidden">Search voices</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name or language"
        />
      </label>
      <p className="settings-note">
        Showing {rows.length}
        {!query.trim() ? ' (search to find more)' : ''} of {voices.length}
      </p>
      <ul className="voice-tester__list">
        {rows.map((voice) => {
          const selected = chosen?.voiceURI === voice.voiceURI
          return (
            <li
              key={voice.voiceURI}
              className={`voice-tester__row${selected ? ' is-chosen' : ''}`}
            >
              <div>
                <p className="voice-tester__name">{voice.name}</p>
                <p className="voice-tester__lang">{voice.lang}</p>
              </div>
              <div className="voice-tester__actions">
                <button
                  type="button"
                  className="memory-button"
                  onClick={() => play(voice)}
                >
                  {playing === voice.voiceURI ? 'Playing' : 'Play'}
                </button>
                <button
                  type="button"
                  className="memory-button"
                  onClick={() => select(voice)}
                >
                  {selected ? 'Saved' : 'Use this'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      <button type="button" className="auth-text-link" onClick={() => stopSpeech()}>
        Stop
      </button>
    </section>
  )
}

function filterGroup(
  voices: ManagedVoice[],
  provider: ManagedVoice['provider'],
  query: string,
) {
  const needle = query.trim().toLowerCase()
  return voices.filter((item) => {
    if (item.provider !== provider) return false
    if (!needle) return true
    return `${item.actualName} ${item.userName} ${item.userDescription} ${item.lang}`
      .toLowerCase()
      .includes(needle)
  })
}

function VoiceRow({
  voice,
  isDefault,
  isMarketingIntro,
  playing,
  onPatch,
  onDefault,
  onMarketingIntro,
  onPlay,
  onStop,
}: {
  voice: ManagedVoice
  isDefault: boolean
  isMarketingIntro: boolean
  playing: boolean
  onPatch: (patch: Partial<ManagedVoice>) => void
  onDefault: () => void
  onMarketingIntro: () => void
  onPlay: () => void
  onStop: () => void
}) {
  return (
    <li
      className={`voice-manage__row${voice.enabled ? ' is-enabled' : ''}${isDefault ? ' is-default' : ''}${isMarketingIntro ? ' is-marketing' : ''}`}
    >
      <p className="voice-manage__actual">{voice.actualName}</p>
      <p className="voice-manage__meta">
        {voice.provider === 'openai' ? 'OpenAI' : 'Browser'}
        {voice.lang ? ` · ${voice.lang}` : ''}
      </p>
      <label className="welcome-field">
        <span>User visible name</span>
        <input
          value={voice.userName}
          onChange={(event) => onPatch({ userName: event.target.value })}
          placeholder="Soft Charm"
        />
      </label>
      <label className="welcome-field">
        <span>User visible description</span>
        <input
          value={voice.userDescription}
          onChange={(event) => onPatch({ userDescription: event.target.value })}
          placeholder="Warm, thoughtful and supportive."
        />
      </label>
      <div className="voice-manage__flags">
        <label>
          <input
            type="checkbox"
            checked={voice.enabled}
            onChange={(event) => onPatch({ enabled: event.target.checked })}
          />
          Enable for users
        </label>
        <label>
          <input
            type="radio"
            name="kea-default-voice"
            checked={isDefault}
            onChange={onDefault}
          />
          Default voice
        </label>
        <label>
          <input
            type="radio"
            name="kea-marketing-intro-voice"
            checked={isMarketingIntro}
            onChange={onMarketingIntro}
          />
          Marketing intro
        </label>
      </div>
      <div className="voice-manage__actions">
        <button
          type="button"
          className="memory-button"
          onClick={playing ? onStop : onPlay}
        >
          {playing ? 'Stop' : 'Play sample'}
        </button>
      </div>
    </li>
  )
}
