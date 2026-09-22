import type { TranscriptMessage } from '../../types'

interface RisingWordsProps {
  messages: TranscriptMessage[]
  live?: boolean
  userPhoto?: string
  userName?: string
}

export function RisingWords({
  messages,
  live = false,
  userPhoto = '',
  userName = '',
}: RisingWordsProps) {
  const initial = (userName || 'Y').slice(0, 1).toUpperCase()

  return (
    <div className={`rising-words ${live ? 'rising-words--live' : ''}`} aria-label="Conversation">
      {messages.map((message, index) => (
        <div
          key={message.id}
          className={`rising-words__line rising-words__line--${message.speaker}${
            message.interim || message.pending ? ' rising-words__line--interim' : ''
          }${message.active ? ' rising-words__line--active' : ''}`}
          style={
            live
              ? { animationDelay: '0s', zIndex: index + 1 }
              : {
                  animationDelay: `${(index * 16) / Math.max(messages.length, 1)}s`,
                }
          }
        >
          {message.speaker === 'kea' ? (
            <span className="rising-words__who rising-words__who--kea" aria-hidden="true">
              K
            </span>
          ) : (
            <span className="rising-words__who rising-words__who--user" aria-hidden="true">
              {userPhoto ? <img src={userPhoto} alt="" /> : <span>{initial}</span>}
            </span>
          )}
          <div className="rising-words__copy">
            <p className="rising-words__spoken">{message.text}</p>
            {message.english ? (
              <p className="rising-words__english">{message.english}</p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
