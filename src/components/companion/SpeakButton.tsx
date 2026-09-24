import type { ButtonHTMLAttributes } from 'react'
import { getLanguage } from '../../config/languages'
import { speakKeaLine } from '../../services/keaSpeak'
import type { LanguageCode } from '../../types'

interface SpeakButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  text: string
  languageCode: LanguageCode
  label?: string
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M4 9.25v5.5c0 .41.34.75.75.75H7.4l3.85 2.95c.55.42 1.35.03 1.35-.66V6.96c0-.69-.8-1.08-1.35-.66L7.4 8.5H4.75A.75.75 0 0 0 4 9.25Z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        d="M16.1 9.1a3.2 3.2 0 0 1 0 5.8M18.55 7a5.9 5.9 0 0 1 0 10"
      />
    </svg>
  )
}

export function SpeakButton({
  text,
  languageCode,
  label = 'Hear this',
  className = '',
  ...props
}: SpeakButtonProps) {
  return (
    <button
      type="button"
      className={`speak-button ${className}`.trim()}
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void speakKeaLine(text, {
          lang: getLanguage(languageCode).speechLocale,
        })
      }}
      {...props}
    >
      <SpeakerIcon />
    </button>
  )
}
