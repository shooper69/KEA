import { useState } from 'react'
import { getLanguage, SUPPORTED_LANGUAGES } from '../../config/languages'
import type { LanguageCode } from '../../types'
import { LanguageFlag } from './LanguageFlag'

/**
 * Kea-styled language chooser (flags + cream sheet) — not a native OS select.
 */
export function KeaLanguageSheet({
  title,
  value,
  onChange,
  onClose,
}: {
  title: string
  value: LanguageCode | ''
  onChange: (code: LanguageCode) => void
  onClose: () => void
}) {
  return (
    <div
      className="kea-confirm kea-language-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kea-language-sheet-title"
      onClick={onClose}
    >
      <div
        className="kea-confirm__card kea-language-sheet__card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="kea-language-sheet__head">
          <p id="kea-language-sheet-title" className="kea-confirm__title">
            {title}
          </p>
          <button
            type="button"
            className="kea-language-sheet__x"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div
          className="kea-language-sheet__list"
          role="listbox"
          aria-label={title}
        >
          {SUPPORTED_LANGUAGES.map((language) => {
            const chosen = language.code === value
            return (
              <button
                key={language.code}
                type="button"
                role="option"
                aria-selected={chosen}
                className={`kea-language-sheet__choice${chosen ? ' is-chosen' : ''}`}
                onClick={() => {
                  onChange(language.code)
                  onClose()
                }}
              >
                <LanguageFlag code={language.code} />
                <span className="kea-language-sheet__names">
                  <strong>{language.name}</strong>
                  <em>{language.nativeName}</em>
                </span>
                <span className="kea-language-sheet__tick" aria-hidden="true" />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** Field that opens {@link KeaLanguageSheet} — for settings and onboarding. */
export function KeaLanguageField({
  label,
  value,
  placeholder = 'Choose language',
  onChange,
  tone = 'light',
}: {
  label: string
  value: LanguageCode | ''
  placeholder?: string
  onChange: (code: LanguageCode) => void
  tone?: 'light' | 'onboarding'
}) {
  const [open, setOpen] = useState(false)
  const language = value ? getLanguage(value) : null

  return (
    <div
      className={`kea-language-field kea-language-field--${tone}`}
    >
      <span className="kea-language-field__label">{label}</span>
      <button
        type="button"
        className="kea-language-field__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {language ? (
          <>
            <LanguageFlag code={language.code} />
            <span className="kea-language-field__text">
              <strong>{language.name}</strong>
              <em>{language.nativeName}</em>
            </span>
          </>
        ) : (
          <span className="kea-language-field__placeholder">{placeholder}</span>
        )}
        <span className="kea-language-field__chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <KeaLanguageSheet
          title={label}
          value={value}
          onChange={onChange}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  )
}
