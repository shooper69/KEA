export function profileInitials(firstName: string, lastName: string) {
  const first = firstName.trim()
  const last = lastName.trim()
  const firstParts = first.split(/\s+/).filter(Boolean)
  const given = firstParts[0]?.charAt(0) ?? ''
  const family =
    last.charAt(0) ||
    (firstParts.length > 1 ? firstParts[firstParts.length - 1].charAt(0) : '')
  return `${given}${family}`.toUpperCase()
}

export function ProfileFace({
  photoDataUrl,
  firstName,
  lastName,
}: {
  photoDataUrl: string
  firstName: string
  lastName: string
}) {
  if (photoDataUrl) return <img src={photoDataUrl} alt="" />
  return <span>{profileInitials(firstName, lastName)}</span>
}
