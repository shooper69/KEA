import type { ButtonHTMLAttributes } from 'react'
import { speakInLanguage } from '../../lib/speak'
import type { LanguageCode } from '../../types'

interface SpeakButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  text: string
  languageCode: LanguageCode
  label?: string
}

export function SpeakButton({
  text,
  languageCode,
  label = 'Hear this in the language you are learning',
  className = '',
  ...props
}: SpeakButtonProps) {
  return (
    <button
      type="button"
      className={`speak-button ${className}`}
      aria-label={label}
      onClick={() => speakInLanguage(text, languageCode)}
      {...props}
    >
      <span aria-hidden="true">♪</span>
    </button>
  )
}
