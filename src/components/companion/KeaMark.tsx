interface KeaMarkProps {
  className?: string
}

export function KeaMark({ className = '' }: KeaMarkProps) {
  return (
    <img
      className={`kea-mark ${className}`}
      src="/kea-mark.png?v=2"
      alt="Kea"
    />
  )
}
