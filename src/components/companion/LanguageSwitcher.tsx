import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { getLanguage, SUPPORTED_LANGUAGES } from '../../config/languages'
import { useSession } from '../../context/SessionContext'
import { useStickyMenu } from '../../hooks/useStickyMenu'
import type { LanguageCode } from '../../types'
import {
  holdTalkForLanguageChange,
  requestClearTalkAndSoftReset,
} from '../../architecture/keaTalkMemory'
import { useHoldKeaListening } from '../../architecture/keaUiHold'
import {
  pairIncludesRussian,
  saveRussianScript,
  type RussianScript,
} from '../../architecture/russianScript'
import { LanguageFlag } from './LanguageFlag'
import { RussianScriptPopup } from './RussianScriptPopup'

/**
 * Compact nav control to change spoken (native) and learning (target) languages.
 * A new pair clears the chat and starts again.
 */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { nativeLanguage, languageCode, setProfile, flushCloudProfile } = useSession()
  const { rootRef, open, setOpen } = useStickyMenu()
  const [place, setPlace] = useState({ top: 0, right: 8, width: 280 })
  const [scriptOpen, setScriptOpen] = useState(false)
  const [draftNative, setDraftNative] = useState<LanguageCode>(nativeLanguage ?? 'en')
  const [draftLearning, setDraftLearning] = useState<LanguageCode>(languageCode ?? 'es')
  const [pending, setPending] = useState<{
    native: LanguageCode
    target: LanguageCode
  } | null>(null)

  useHoldKeaListening(open || scriptOpen)

  function pickOther(excluding: LanguageCode): LanguageCode {
    return (
      SUPPORTED_LANGUAGES.find((item) => item.code !== excluding)?.code ?? 'en'
    )
  }

  function setNative(code: LanguageCode) {
    if (draftLearning === code) {
      setDraftLearning(pickOther(code))
    }
    setDraftNative(code)
  }

  function setLearning(code: LanguageCode) {
    if (draftNative === code) {
      setDraftNative(pickOther(code))
    }
    setDraftLearning(code)
  }

  async function restartWith(native: LanguageCode, target: LanguageCode) {
    holdTalkForLanguageChange()
    setProfile({ nativeLanguage: native, targetLanguage: target })
    try {
      await flushCloudProfile()
    } catch {
      // The choice is already on this device. The reload still starts clean.
    }
    requestClearTalkAndSoftReset()
  }

  function closePicker() {
    const spoken = nativeLanguage ?? 'en'
    const learning = languageCode ?? 'es'
    const changed = draftNative !== spoken || draftLearning !== learning
    setOpen(false)
    if (!changed) return
    if (pairIncludesRussian(draftNative, draftLearning)) {
      setPending({ native: draftNative, target: draftLearning })
      setScriptOpen(true)
      return
    }
    void restartWith(draftNative, draftLearning)
  }

  function chooseScript(script: RussianScript) {
    saveRussianScript(script)
    setScriptOpen(false)
    const next = pending
    setPending(null)
    if (!next) return
    void restartWith(next.native, next.target)
  }

  const spokenCode = nativeLanguage ?? 'en'
  const learningCode = languageCode ?? 'es'
  const nativeName = getLanguage(spokenCode).name
  const learningName = getLanguage(learningCode).name

  useLayoutEffect(() => {
    if (!open) return
    function placePanel() {
      const trigger = rootRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const margin = 8
      const width = Math.min(280, window.innerWidth - margin * 2)
      const alignRight = Math.max(margin, window.innerWidth - rect.right)
      const maxRight = Math.max(margin, window.innerWidth - width - margin)
      setPlace({
        top: rect.bottom + 6,
        right: Math.min(alignRight, maxRight),
        width,
      })
    }
    placePanel()
    window.addEventListener('resize', placePanel)
    window.addEventListener('scroll', placePanel, true)
    return () => {
      window.removeEventListener('resize', placePanel)
      window.removeEventListener('scroll', placePanel, true)
    }
  }, [open, rootRef])

  return (
    <div
      className={`language-switcher ${className}`.trim()}
      ref={rootRef}
    >
      <button
        type="button"
        className="language-switcher__trigger companion-nav__icon"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Learning ${learningName}. Spoken language is ${nativeName}.`}
        title={`Learning ${learningName}`}
        onClick={() => {
          if (open) {
            closePicker()
            return
          }
          setDraftNative(spokenCode)
          setDraftLearning(learningCode)
          setOpen(true)
        }}
      >
        <LanguageFlag code={learningCode} />
      </button>
      {open
        ? createPortal(
            <>
              <button
                type="button"
                className="language-switcher__backdrop"
                aria-label="Close languages"
                onClick={closePicker}
              />
              <div
                className="language-switcher__panel"
                role="dialog"
                aria-label="Change languages"
                style={{ top: place.top, right: place.right, width: place.width }}
              >
                <div className="language-switcher__head">
                  <p className="language-switcher__note">
                    Close to start a fresh chat in these languages.
                  </p>
                  <button
                    type="button"
                    className="language-switcher__close"
                    onClick={closePicker}
                  >
                    Close
                  </button>
                </div>
                <LanguageChoices
                  label="I speak"
                  selected={draftNative}
                  onPick={setNative}
                />
                <LanguageChoices
                  label="I am learning"
                  selected={draftLearning}
                  onPick={setLearning}
                />
              </div>
            </>,
            document.body,
          )
        : null}
      {scriptOpen ? <RussianScriptPopup onChoose={chooseScript} /> : null}
    </div>
  )
}

function LanguageChoices({
  label,
  selected,
  onPick,
}: {
  label: string
  selected: LanguageCode
  onPick: (code: LanguageCode) => void
}) {
  return (
    <div className="language-switcher__field">
      <span>{label}</span>
      <div className="language-switcher__list" role="listbox" aria-label={label}>
        {SUPPORTED_LANGUAGES.map((language) => {
          const chosen = language.code === selected
          return (
            <button
              key={`${label}-${language.code}`}
              type="button"
              role="option"
              aria-selected={chosen}
              className={`language-switcher__option${chosen ? ' is-chosen' : ''}`}
              onClick={() => onPick(language.code)}
            >
              <LanguageFlag code={language.code} />
              <span>
                {language.name} · {language.nativeName}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
