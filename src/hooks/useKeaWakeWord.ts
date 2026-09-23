import { useCallback, useEffect, useRef, useState } from 'react'
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
  const abortRef = useRef<() => void>(() => {})

  const release = useCallback(() => {
    abortRef.current()
  }, [])

  useEffect(() => {
    const Ctor = getSpeechRecognition()
    if (!Ctor || !enabled) {
      setArmed(false)
      abortRef.current = () => {}
      return
    }

    let recognition: InstanceType<typeof Ctor> | null = null
    let dead = false
    let waking = false
    let heard = ''

    const abortEngine = () => {
      dead = true
      waking = true
      try {
        recognition?.abort()
      } catch {
        // ignore
      }
    }
    abortRef.current = abortEngine

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
            const alts: string[] = []
            const count = Math.max(1, piece.length ?? 1)
            for (let a = 0; a < count; a++) {
              const said = piece?.[a]?.transcript ?? ''
              if (said) alts.push(said)
            }
            const said = alts.join(' ')
            heard = `${heard} ${said}`.replace(/\s+/g, ' ').trim().slice(-120)
            if (heardKeaWake(said) || heardKeaWake(heard)) {
              abortEngine()
              window.setTimeout(() => onWakeRef.current(), 220)
              return
            }
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
      abortEngine()
      setArmed(false)
      abortRef.current = () => {}
    }
  }, [enabled])

  return { armed, release }
}
