import { useEffect, useRef, useState } from 'react'

interface TextComposerProps {
  busy: boolean
  /** Open the keyboard only when the person has just chosen typing. */
  autoFocus?: boolean
  onSend: (text: string) => void
}

export function TextComposer({ busy, autoFocus = false, onSend }: TextComposerProps) {
  const [draft, setDraft] = useState('')
  const fieldRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!autoFocus) return
    fieldRef.current?.focus()
  }, [autoFocus])

  function submit() {
    const text = draft.trim()
    if (!text || busy) return
    setDraft('')
    fieldRef.current?.blur()
    onSend(text)
  }

  return (
    <form
      className="text-composer"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <label className="visually-hidden" htmlFor="kea-text-entry">
        Message to Kea
      </label>
      <textarea
        id="kea-text-entry"
        ref={fieldRef}
        className="text-composer__field"
        rows={1}
        value={draft}
        placeholder={busy ? 'Kea is writing…' : 'Type to Kea'}
        disabled={busy}
        enterKeyHint="send"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            submit()
          }
        }}
      />
      <button
        type="submit"
        className="text-composer__send"
        disabled={busy || !draft.trim()}
      >
        Send
      </button>
    </form>
  )
}
