import { VOCABULARY_MASTERY_THRESHOLD } from '../../architecture/vocabularyMemory'
import { useSession } from '../../context/SessionContext'
import { SpeakButton } from './SpeakButton'

interface WordMemoryProps {
  open: boolean
  onClose: () => void
}

export function WordMemoryPanel({ open, onClose }: WordMemoryProps) {
  const { languageCode, activeVocabulary } = useSession()

  if (!open || !languageCode) {
    return null
  }

  return (
    <aside className="word-memory" aria-label="Word memory">
      <div className="word-memory__header">
        <div>
          <h2>Word memory</h2>
          <p>
            Words that still need a little help. They leave after you use them
            naturally {VOCABULARY_MASTERY_THRESHOLD} times.
          </p>
        </div>
        <button type="button" className="word-memory__close" onClick={onClose}>
          Close
        </button>
      </div>
      {activeVocabulary.length === 0 ? (
        <p className="word-memory__empty">Nothing waiting. Keep chatting.</p>
      ) : (
        <ul className="word-memory__list">
          {activeVocabulary.map((item) => (
            <li key={item.id} className="word-memory__item">
              <div>
                <p className="word-memory__pair">
                  {item.english} = {item.translation}
                </p>
                <p className="word-memory__uses">
                  Heard in your speech {item.successfulUses} /{' '}
                  {VOCABULARY_MASTERY_THRESHOLD}
                </p>
              </div>
              <SpeakButton
                text={item.translation}
                languageCode={languageCode}
                label={`Hear ${item.translation}`}
              />
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
