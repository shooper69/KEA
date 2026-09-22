import type { TranscriptMessage } from '../../types'

interface RisingWordsProps {
  messages: TranscriptMessage[]
  live?: boolean
}

export function RisingWords({ messages, live = false }: RisingWordsProps) {
  return (
    <div className={`rising-words ${live ? 'rising-words--live' : ''}`} aria-label="Conversation">
      {messages.map((message, index) => {
        const previous = messages[index - 1]
        const showRule = Boolean(previous && previous.speaker !== message.speaker)

        return (
          <div
            key={message.id}
            className={`rising-words__line rising-words__line--${message.speaker}${
              message.interim ? ' rising-words__line--interim' : ''
            }${message.active ? ' rising-words__line--active' : ''}`}
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
            {showRule ? <div className="rising-words__rule" aria-hidden="true" /> : null}
            <p className="rising-words__spoken">{message.text}</p>
            {message.english ? (
              <p className="rising-words__english">{message.english}</p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
