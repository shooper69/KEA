import { useEffect, useRef, useState } from 'react'
import { KEA_FLY_SRC } from '../../data/keaAbout'
import {
  alignCaptionParagraphs,
  highlightNativeIntrusions,
  splitTalkParagraphs,
} from '../../architecture/companionMemory'
import { looksLikeSystemText } from '../../architecture/whisperText'
import { SpeakButton } from './SpeakButton'
import type { LanguageCode, TranscriptMessage } from '../../types'

interface RisingWordsProps {
  messages: TranscriptMessage[]
  live?: boolean
  userName?: string
  targetLanguage: LanguageCode
}

function SpokenWithHighlights({
  text,
  highlights,
}: {
  text: string
  highlights?: string[]
}) {
  const parts = highlightNativeIntrusions(text, highlights ?? [])
  return (
    <p className="rising-words__spoken">
      {parts.map((part, index) =>
        part.highlight ? (
          <span key={`${index}-${part.text}`} className="rising-words__loan">
            {part.text}
          </span>
        ) : (
          <span key={`${index}-${part.text.slice(0, 12)}`}>{part.text}</span>
        ),
      )}
    </p>
  )
}

function TalkMessageCopy({
  message,
  targetLanguage,
}: {
  message: TranscriptMessage
  targetLanguage: LanguageCode
}) {
  const spokenParts = splitTalkParagraphs(message.text)
  const englishParts = message.english
    ? alignCaptionParagraphs(message.text, message.english)
    : []
  const highlights = message.highlights ?? []
  return (
    <div className="rising-words__copy">
      {spokenParts.map((part, index) => (
        <div className="rising-words__pair" key={`${message.id}-${index}`}>
          <div className="rising-words__spoken-row">
            <SpokenWithHighlights text={part} highlights={highlights} />
            <SpeakButton
              text={part}
              languageCode={targetLanguage}
              label="Listen to this paragraph"
            />
          </div>
          {englishParts[index] ? (
            <p className="rising-words__english">{englishParts[index]}</p>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export function RisingWords({
  messages,
  userName = '',
  targetLanguage,
}: RisingWordsProps) {
  const initial = (userName || 'Y').slice(0, 1).toUpperCase()
  const rootRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const [filling, setFilling] = useState(false)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const measure = () => {
      const overflows = root.scrollHeight > root.clientHeight + 4
      setFilling(overflows)
      if (overflows) {
        root.scrollTop = root.scrollHeight
      }
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    return () => observer.disconnect()
  }, [messages])

  return (
    <div
      ref={rootRef}
      className={`rising-words rising-words--parked${
        filling ? ' rising-words--filling' : ''
      }`}
      aria-label="Conversation"
    >
      {messages
        .filter((message) => !looksLikeSystemText(message.text))
        .map((message) => (
        <div
          key={message.id}
          className={`rising-words__line rising-words__line--${message.speaker}${
            message.interim || message.pending ? ' rising-words__line--interim' : ''
          }${message.active ? ' rising-words__line--active' : ''}`}
        >
          {message.speaker === 'kea' ? (
            <span className="rising-words__who rising-words__who--kea" aria-hidden="true">
              <img src={KEA_FLY_SRC} alt="" />
            </span>
          ) : (
            <span className="rising-words__who rising-words__who--user" aria-hidden="true">
              <span>{initial}</span>
            </span>
          )}
          <TalkMessageCopy message={message} targetLanguage={targetLanguage} />
        </div>
      ))}
      <div ref={endRef} className="rising-words__end" />
    </div>
  )
}
