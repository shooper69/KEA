interface KeaOption {
  value: string
  label: string
}

interface KeaOptionSheetProps {
  title: string
  options: KeaOption[]
  value: string
  onChange: (value: string) => void
  onClose: () => void
}

export function KeaOptionSheet({
  title,
  options,
  value,
  onChange,
  onClose,
}: KeaOptionSheetProps) {
  return (
    <div
      className="kea-confirm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kea-option-sheet-title"
      onClick={onClose}
    >
      <div
        className="kea-confirm__card kea-option-sheet"
        onClick={(event) => event.stopPropagation()}
      >
        <p id="kea-option-sheet-title" className="kea-confirm__title">
          {title}
        </p>
        <div className="kea-option-sheet__list" role="listbox" aria-label={title}>
          {options.map((option) => {
            const selected = option.value === value
            return (
              <button
                key={option.value || 'auto'}
                type="button"
                role="option"
                aria-selected={selected}
                className={`kea-option-sheet__choice${selected ? ' is-chosen' : ''}`}
                onClick={() => {
                  onChange(option.value)
                  onClose()
                }}
              >
                <span className="kea-option-sheet__radio" aria-hidden="true" />
                <span className="kea-option-sheet__label">{option.label}</span>
              </button>
            )
          })}
        </div>
        <div className="kea-confirm__actions">
          <button
            type="button"
            className="kea-button kea-button--ghost"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
