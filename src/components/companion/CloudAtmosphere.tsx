import type { VoicePresenceState } from '../../types'

interface CloudAtmosphereProps {
  presence: VoicePresenceState
}

export function CloudAtmosphere({ presence }: CloudAtmosphereProps) {
  return (
    <div
      className={`cloud-atmosphere cloud-atmosphere--${presence}`}
      aria-hidden="true"
    >
      <span className="cloud-atmosphere__sun" />
      <span className="cloud-atmosphere__wisp cloud-atmosphere__wisp--1" />
      <span className="cloud-atmosphere__wisp cloud-atmosphere__wisp--2" />
      <span className="cloud-atmosphere__wisp cloud-atmosphere__wisp--3" />
      <span className="cloud-atmosphere__wisp cloud-atmosphere__wisp--4" />
      <span className="cloud-atmosphere__wisp cloud-atmosphere__wisp--5" />
      <span className="cloud-atmosphere__wisp cloud-atmosphere__wisp--6" />
      <span className="cloud-atmosphere__fog" />
      <span className="cloud-atmosphere__vignette" />
    </div>
  )
}
