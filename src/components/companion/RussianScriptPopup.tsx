import { createPortal } from 'react-dom'
import type { RussianScript } from '../../architecture/russianScript'

interface RussianScriptPopupProps {
  onChoose: (script: RussianScript) => void
}

/** Asked once Russian is part of the language pair. */
export function RussianScriptPopup({ onChoose }: RussianScriptPopupProps) {
  return createPortal(
    <div
      className="audio-route"
      role="dialog"
      aria-modal="true"
      aria-labelledby="russian-script-title"
    >
      <div className="audio-route__card">
        <h2 id="russian-script-title" className="audio-route__title">
          How should Russian be written?
        </h2>
        <p className="audio-route__body">
          Cyrillic is the usual script. Phonetics uses Latin letters, so привет
          is written privet.
        </p>
        <div className="audio-route__actions">
          <button
            type="button"
            className="kea-button"
            onClick={() => onChoose('cyrillic')}
          >
            Cyrillic
          </button>
          <button
            type="button"
            className="kea-button"
            onClick={() => onChoose('phonetic')}
          >
            Phonetics
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
