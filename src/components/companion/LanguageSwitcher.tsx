import { getLanguage, SUPPORTED_LANGUAGES } from '../../config/languages'
import { useSession } from '../../context/SessionContext'
import { useStickyMenu } from '../../hooks/useStickyMenu'
import type { LanguageCode } from '../../types'
import { LanguageFlag } from './LanguageFlag'

/**
 * Compact nav control to change spoken (native) and learning (target) languages.
 */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { nativeLanguage, languageCode, setProfile } = useSession()
  const { rootRef, open, setOpen, onPointerLeave } = useStickyMenu()

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

  const spokenCode = nativeLanguage ?? 'en'
  const learningCode = languageCode ?? 'es'
  const nativeName = getLanguage(spokenCode).name
  const learningName = getLanguage(learningCode).name

  return (
    <div
      className={`language-switcher ${className}`.trim()}
      ref={rootRef}
      onPointerLeave={onPointerLeave}
    >
      <button
        type="button"
        className="language-switcher__trigger companion-nav__icon"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Learning ${learningName}. Spoken language is ${nativeName}.`}
        title={`Learning ${learningName}`}
        onClick={() => setOpen((value) => !value)}
      >
        <LanguageFlag code={learningCode} />
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
              value={spokenCode}
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
              value={learningCode}
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
