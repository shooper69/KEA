import { useEffect, useRef, useState } from 'react'
import { getLanguage, SUPPORTED_LANGUAGES } from '../../config/languages'
import { KEA_FLY_SRC } from '../../data/keaAbout'
import {
  AGE_OPTIONS,
  LEVEL_OPTIONS,
  REASON_OPTIONS,
  TIME_OPTIONS,
  type LearnReasonId,
  type LearnerAgeId,
  type LearnerLevelId,
  type WeeklyTimeId,
} from '../../data/keaLearnerProfile'
import { useSession } from '../../context/SessionContext'
import { speakKeaLine, stopKeaSpeech } from '../../services/keaSpeak'
import type { LanguageCode } from '../../types'

interface LearnerQuestionnaireProps {
  targetLanguage: LanguageCode
  onDone?: () => void
}

type Step = 'intro' | 0 | 1 | 2 | 3 | 4 | 5

export function LearnerQuestionnaire({
  targetLanguage,
  onDone,
}: LearnerQuestionnaireProps) {
  const { firstName, nativeLanguage, languageCode, setProfile, saveLearnerProfile } =
    useSession()
  const [step, setStep] = useState<Step>('intro')
  const [line, setLine] = useState('')
  const [spoken, setSpoken] = useState<LanguageCode | ''>(nativeLanguage ?? '')
  const [learning, setLearning] = useState<LanguageCode | ''>(languageCode ?? '')
  const [level, setLevelId] = useState<LearnerLevelId | null>(null)
  const [reason, setReason] = useState<LearnReasonId | null>(null)
  const [weeklyTime, setWeeklyTime] = useState<WeeklyTimeId | null>(null)
  const [age, setAge] = useState<LearnerAgeId | null>(null)
  const [interests, setInterests] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const runId = useRef(0)
  const learningCode = learning || targetLanguage
  const languageName = getLanguage(learningCode).name
  const name = firstName.trim().split(/\s+/)[0] || 'there'
  const locale = getLanguage(nativeLanguage ?? 'en').speechLocale

  const spokenForStep = (next: Step) => {
    if (next === 'intro') {
      return `Hi ${name}, let's get to know each other.`
    }
    if (next === 0) {
      return 'What language do you speak, and which language do you want to learn?'
    }
    if (next === 1) {
      return `What is your level in ${languageName}? Be honest. I will meet you there.`
    }
    if (next === 2) {
      return `Why do you want to learn ${languageName}? One reason is enough.`
    }
    if (next === 3) {
      return 'How much time will you spend learning on a usual day?'
    }
    if (next === 4) {
      return 'How old are you?'
    }
    return 'What are your key interests that you would like to talk about? Just tell me.'
  }

  useEffect(() => {
    const id = ++runId.current
    const text = spokenForStep(step)
    setLine(text)
    stopKeaSpeech()
    void speakKeaLine(text, {
      lang: locale,
      onend: () => {
        if (runId.current !== id) return
      },
      onerror: () => {
        if (runId.current !== id) return
      },
    })
    return () => {
      runId.current += 1
      stopKeaSpeech()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, locale, name, languageName])

  const languagesReady = Boolean(spoken && learning && spoken !== learning)
  const ready =
    step === 'intro' ||
    (step === 0 && languagesReady) ||
    (step === 1 && level) ||
    (step === 2 && reason) ||
    (step === 3 && weeklyTime) ||
    (step === 4 && age) ||
    (step === 5 && interests.trim().length > 0)

  function finish() {
    if (!level || !reason || !weeklyTime || !age || !interests.trim() || saving) {
      return
    }
    setSaving(true)
    setError('')
    void saveLearnerProfile({
      level,
      reason,
      weeklyTime,
      age,
      interests: interests.trim(),
    })
      .then(() => onDone?.())
      .catch((caught) => {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Kea could not save your answers.',
        )
        setSaving(false)
      })
  }

  function goNext() {
    if (!ready || saving) return
    stopKeaSpeech()
    if (step === 'intro') {
      setStep(0)
      return
    }
    if (step === 0 && spoken && learning) {
      setProfile({ nativeLanguage: spoken, targetLanguage: learning })
    }
    if (step === 5) {
      finish()
      return
    }
    setStep((current) => ((current as number) + 1) as Step)
  }

  const stepLabel =
    step === 'intro' ? 'Hello' : `${(step as number) + 1} of 6`

  return (
    <div className="onboarding-caption learner-quiz-spoken" role="dialog" aria-modal="true">
      <span className="rising-words__who rising-words__who--kea" aria-hidden="true">
        <img src={KEA_FLY_SRC} alt="" />
      </span>
      <p className="onboarding-caption__line">{line}</p>
      <p className="learner-quiz-spoken__step">{stepLabel}</p>

      {step === 0 ? (
        <div className="learner-quiz-spoken__langs">
          <label>
            <span>I speak</span>
            <select
              value={spoken}
              onChange={(event) => setSpoken(event.target.value as LanguageCode)}
            >
              <option value="" disabled>
                Choose language
              </option>
              {SUPPORTED_LANGUAGES.map((language) => (
                <option key={`spoken-${language.code}`} value={language.code}>
                  {language.name} · {language.nativeName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>I want to learn</span>
            <select
              value={learning}
              onChange={(event) => setLearning(event.target.value as LanguageCode)}
            >
              <option value="" disabled>
                Choose language
              </option>
              {SUPPORTED_LANGUAGES.map((language) => (
                <option key={`learn-${language.code}`} value={language.code}>
                  {language.name} · {language.nativeName}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="learner-quiz-spoken__options" role="radiogroup" aria-label="Your level">
          {LEVEL_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={level === option.id}
              className={`learner-quiz-spoken__option${level === option.id ? ' is-selected' : ''}`}
              onClick={() => setLevelId(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="learner-quiz-spoken__options" role="radiogroup" aria-label="Why you are learning">
          {REASON_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={reason === option.id}
              className={`learner-quiz-spoken__option${reason === option.id ? ' is-selected' : ''}`}
              onClick={() => setReason(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="learner-quiz-spoken__options" role="radiogroup" aria-label="Time you will spend">
          {TIME_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={weeklyTime === option.id}
              className={`learner-quiz-spoken__option${weeklyTime === option.id ? ' is-selected' : ''}`}
              onClick={() => setWeeklyTime(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      {step === 4 ? (
        <div className="learner-quiz-spoken__options" role="radiogroup" aria-label="Your age">
          {AGE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={age === option.id}
              className={`learner-quiz-spoken__option${age === option.id ? ' is-selected' : ''}`}
              onClick={() => setAge(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      {step === 5 ? (
        <label className="learner-quiz-spoken__tell">
          <span className="visually-hidden">Your interests</span>
          <textarea
            value={interests}
            rows={3}
            placeholder="Just tell me"
            onChange={(event) => setInterests(event.target.value)}
          />
        </label>
      ) : null}

      <div className="onboarding-caption__actions learner-quiz-spoken__actions">
        <button
          type="button"
          className="kea-button onboarding-caption__next"
          disabled={!ready || saving}
          onClick={goNext}
        >
          {saving ? 'Saving…' : step === 5 ? "Let's talk" : 'Next'}
        </button>
      </div>
      {error ? <p className="learner-quiz-spoken__error">{error}</p> : null}
    </div>
  )
}
