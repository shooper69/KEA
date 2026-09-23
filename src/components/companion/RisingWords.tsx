import { useEffect, useRef } from 'react'
import { KEA_FLY_SRC } from '../../data/keaAbout'
import {
  alignCaptionParagraphs,
  splitTalkParagraphs,
} from '../../architecture/companionMemory'
import { looksLikeSystemText } from '../../architecture/whisperText'
import type { TranscriptMessage } from '../../types'

interface RisingWordsProps {
  messages: TranscriptMessage[]
  live?: boolean
  userName?: string
}

function TalkMessageCopy({ message }: { message: TranscriptMessage }) {
  const spokenParts = splitTalkParagraphs(message.text)
  const englishParts = message.english
    ? alignCaptionParagraphs(message.text, message.english)
    : []
  return (
    <div className="rising-words__copy">
      {spokenParts.map((part, index) => (
        <div className="rising-words__pair" key={`${message.id}-${index}`}>
          <p className="rising-words__spoken">{part}</p>
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
}: RisingWordsProps) {
  const initial = (userName || 'Y').slice(0, 1).toUpperCase()
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  return (
    <div className="rising-words rising-words--parked" aria-label="Conversation">
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
          <TalkMessageCopy message={message} />
        </div>
      ))}
      <div ref={endRef} className="rising-words__end" />
    </div>
  )
}
