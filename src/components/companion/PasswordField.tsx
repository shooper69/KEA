import { useId, useState } from 'react'

interface PasswordFieldProps {
  label: string
  hideLabel?: boolean
  autoComplete?: string
  placeholder?: string
  name?: string
  enterKeyHint?: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send'
  value: string
  onChange: (value: string) => void
  required?: boolean
  minLength?: number
}

export function PasswordField({
  label,
  hideLabel = false,
  autoComplete = 'current-password',
  placeholder,
  name,
  enterKeyHint,
  value,
  onChange,
  required = false,
  minLength,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  const inputId = useId()

  return (
    <label className="welcome-field password-field" htmlFor={inputId}>
      <span className={hideLabel ? 'visually-hidden' : undefined}>{label}</span>
      <span className="password-field__control">
        <input
          id={inputId}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint={enterKeyHint}
          placeholder={placeholder}
          value={value}
          required={required}
          minLength={minLength}
          onChange={(event) => onChange(event.target.value)}
          onFocus={(event) => {
            event.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })
          }}
        />
        <button
          type="button"
          className="password-field__toggle"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible((open) => !open)}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </span>
    </label>
  )
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"
      />
      <circle
        cx="12"
        cy="12"
        r="2.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 3l18 18M10.6 10.6A2.6 2.6 0 0 0 12 14.6m3.4-1.1c.4-.7.6-1.5.6-2.5 0-2.3-1.9-4.2-4.2-4.2-1 0-1.8.2-2.5.6M6.1 6.2C4 7.8 2.5 12 2.5 12s3.5 7 9.5 7c2.2 0 4.1-.7 5.7-1.7M17.8 6.4C16.3 5.5 14.4 5 12 5c-1.2 0-2.3.2-3.3.5"
      />
    </svg>
  )
}
