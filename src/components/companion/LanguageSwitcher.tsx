import { useEffect, useRef, useState } from 'react'
import { getLanguage, SUPPORTED_LANGUAGES } from '../../config/languages'
import { useSession } from '../../context/SessionContext'
import type { LanguageCode } from '../../types'

function codeLabel(code: LanguageCode | null) {
  if (!code) return '—'
  return code.toUpperCase()
}

/**
 * Compact nav control to change spoken (native) and learning (target) languages.
 */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { nativeLanguage, languageCode, setProfile } = useSession()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      const node = rootRef.current
      if (!node) return
      if (event.target instanceof Node && node.contains(event.target)) return
      setOpen(false)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function pickOther(excluding: LanguageCode): LanguageCode {
    return (
      SUPPORTED_LANGUAGES.find((item) => item.code !== excluding)?.code ?? 'en'
    )
  }

  function setNative(code: LanguageCode) {
    if (languageCode === code) {
      setProfile({
        nativeLanguage: code,
        targetLanguage: pickOther(code),
      })
      return
    }
    setProfile({ nativeLanguage: code })
  }

  function setLearning(code: LanguageCode) {
    if (nativeLanguage === code) {
      setProfile({
        nativeLanguage: pickOther(code),
        targetLanguage: code,
      })
      return
    }
    setProfile({ targetLanguage: code })
  }

  const nativeName = nativeLanguage
    ? getLanguage(nativeLanguage).name
    : 'Your language'
  const learningName = languageCode
    ? getLanguage(languageCode).name
    : 'Learning'

  return (
    <div
      className={`language-switcher ${className}`.trim()}
      ref={rootRef}
    >
      <button
        type="button"
        className="memory-button language-switcher__trigger"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Languages: ${nativeName} to ${learningName}`}
        title={`${nativeName} → ${learningName}`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="language-switcher__pair">
          {codeLabel(nativeLanguage)}
          <span aria-hidden="true">→</span>
          {codeLabel(languageCode)}
        </span>
        <span
          className={`language-switcher__arrow${open ? ' is-open' : ''}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>
      {open ? (
        <div
          className="language-switcher__panel"
          role="dialog"
          aria-label="Change languages"
        >
          <label className="language-switcher__field">
            <span>I speak</span>
            <select
              value={nativeLanguage ?? ''}
              onChange={(event) => {
                const next = event.target.value as LanguageCode
                if (next) setNative(next)
              }}
            >
              <option value="" disabled>
                Choose language
              </option>
              {SUPPORTED_LANGUAGES.map((language) => (
                <option key={`native-${language.code}`} value={language.code}>
                  {language.name} · {language.nativeName}
                </option>
              ))}
            </select>
          </label>
          <label className="language-switcher__field">
            <span>I am learning</span>
            <select
              value={languageCode ?? ''}
              onChange={(event) => {
                const next = event.target.value as LanguageCode
                if (next) setLearning(next)
              }}
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
          <p className="language-switcher__note">
            Kea replies in the language you are learning.
          </p>
        </div>
      ) : null}
    </div>
  )
}
