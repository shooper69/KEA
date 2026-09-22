import { useEffect, useState } from 'react'
import { useSession } from '../../context/SessionContext'
import type { VoicePresenceState } from '../../types'
import { KeaAurora } from './KeaAurora'

type WeatherKind = 'sun' | 'rain' | 'rainbow' | 'clear'

interface CloudAtmosphereProps {
  presence: VoicePresenceState
  tempo?: 'calm' | 'sunrise'
}

const WEATHER_CYCLE: WeatherKind[] = ['sun', 'clear', 'rain', 'rainbow', 'sun', 'rain']

export function CloudAtmosphere({
  presence,
  tempo = 'calm',
}: CloudAtmosphereProps) {
  const { skyTheme } = useSession()
  const [weather, setWeather] = useState<WeatherKind>('clear')

  useEffect(() => {
    if (skyTheme !== 'weather') return
    const roll = () => {
      setWeather(WEATHER_CYCLE[Math.floor(Math.random() * WEATHER_CYCLE.length)])
    }
    roll()
    const id = window.setInterval(roll, 22000 + Math.random() * 10000)
    return () => window.clearInterval(id)
  }, [skyTheme])

  return (
    <div
      className={`cloud-atmosphere cloud-atmosphere--${presence} cloud-atmosphere--${tempo} cloud-atmosphere--${skyTheme} ${
        skyTheme === 'weather' ? `cloud-atmosphere--wx-${weather}` : ''
      }`}
      aria-hidden="true"
    >
      <KeaAurora />
      <span className="cloud-atmosphere__wash" />
      <span className="cloud-atmosphere__sun" />
      <span className="cloud-atmosphere__rainbow" />
      <span className="cloud-atmosphere__wisp cloud-atmosphere__wisp--1" />
      <span className="cloud-atmosphere__wisp cloud-atmosphere__wisp--2" />
      <span className="cloud-atmosphere__wisp cloud-atmosphere__wisp--3" />
      <span className="cloud-atmosphere__wisp cloud-atmosphere__wisp--4" />
      <span className="cloud-atmosphere__wisp cloud-atmosphere__wisp--5" />
      <span className="cloud-atmosphere__wisp cloud-atmosphere__wisp--6" />
      <span className="cloud-atmosphere__fog" />
      <span className="cloud-atmosphere__rain" />
      <span className="cloud-atmosphere__vignette" />
    </div>
  )
}
