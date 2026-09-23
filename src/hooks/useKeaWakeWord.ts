import { useEffect, useRef, useState } from 'react'
import { getSpeechRecognition, heardKeaWake } from '../architecture/keaWakeWord'

interface UseKeaWakeWordOptions {
  enabled: boolean
  onWake: () => void
}

export function useKeaWakeWord({ enabled, onWake }: UseKeaWakeWordOptions) {
  const [armed, setArmed] = useState(false)
  const onWakeRef = useRef(onWake)
  onWakeRef.current = onWake
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  useEffect(() => {
    const Ctor = getSpeechRecognition()
    if (!Ctor || !enabled) {
      setArmed(false)
      return
    }

    let recognition: InstanceType<typeof Ctor> | null = null
    let dead = false
    let waking = false

    const startEngine = () => {
      if (dead || !enabledRef.current || waking) return
      try {
        const next = new Ctor()
        recognition = next
        next.lang = 'en-US'
        next.continuous = true
        next.interimResults = true
        next.maxAlternatives = 3
        next.onresult = (event) => {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const piece = event.results[i]
            const said = piece?.[0]?.transcript ?? ''
            if (!heardKeaWake(said)) continue
            waking = true
            try {
              next.abort()
            } catch {
              // ignore
            }
            window.setTimeout(() => onWakeRef.current(), 140)
            return
          }
        }
        next.onerror = (event) => {
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            dead = true
            setArmed(false)
          }
        }
        next.onend = () => {
          if (dead || waking || !enabledRef.current) return
          window.setTimeout(startEngine, 160)
        }
        next.start()
        setArmed(true)
      } catch {
        setArmed(false)
      }
    }

    startEngine()

    return () => {
      dead = true
      setArmed(false)
      try {
        recognition?.abort()
      } catch {
        // ignore
      }
    }
  }, [enabled])

  return { armed }
}
