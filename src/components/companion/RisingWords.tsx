import type { TranscriptMessage } from '../../types'

interface RisingWordsProps {
  messages: TranscriptMessage[]
  live?: boolean
}

export function RisingWords({ messages, live = false }: RisingWordsProps) {
  return (
    <div className={`rising-words ${live ? 'rising-words--live' : ''}`} aria-label="Conversation">
      {messages.map((message, index) => (
        <p
          key={message.id}
          className={`rising-words__line${message.interim ? ' rising-words__line--interim' : ''}${
            message.active ? ' rising-words__line--active' : ''
          }`}
          style={
            live
              ? {
                  animationDelay: '0s',
                  zIndex: index + 1,
                }
              : {
                  animationDelay: `${(index * 16) / Math.max(messages.length, 1)}s`,
                }
          }
        >
          {message.text}
        </p>
      ))}
    </div>
  )
}
