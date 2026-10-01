import { useCallback, useEffect, useRef, useState } from 'react'
import {
  loadOnboardingSteps,
  markSpokenOnboardingComplete,
  spokenOnboardingLine,
  type OnboardingStep,
} from '../data/keaOnboarding'
import { getLanguage } from '../config/languages'
import { speakKeaLine, stopKeaSpeech } from '../services/keaSpeak'
import type { LanguageCode } from '../types'

interface UseSpokenOnboardingOptions {
  active: boolean
  nativeLanguage: LanguageCode
  userKey?: string
  onComplete: () => void
  onStepText?: (text: string) => void
}

/**
 * Spoken product tour: Kea explains each step; the user presses Next to continue.
 * No voice “yes” — button only.
 */
export function useSpokenOnboarding({
  active,
  nativeLanguage,
  userKey = '',
  onComplete,
  onStepText,
}: UseSpokenOnboardingOptions) {
  const [stepIndex, setStepIndex] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'speaking' | 'listening' | 'done'>(
    'idle',
  )
  const [canAdvance, setCanAdvance] = useState(false)
  const [steps, setSteps] = useState<OnboardingStep[]>([])
  const cancelledRef = useRef(false)
  const finishedRef = useRef(false)
  const advanceNowRef = useRef(false)
  const advanceWaitRef = useRef<(() => void) | null>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const onStepTextRef = useRef(onStepText)
  onStepTextRef.current = onStepText

  const finish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    markSpokenOnboardingComplete(userKey)
    setCanAdvance(false)
    setPhase('done')
    onCompleteRef.current()
  }, [userKey])

  const advance = useCallback(() => {
    advanceNowRef.current = true
    try {
      stopKeaSpeech()
    } catch {
      // ignore
    }
    advanceWaitRef.current?.()
  }, [])

  useEffect(() => {
    if (!active) {
      cancelledRef.current = true
      finishedRef.current = false
      try {
        stopKeaSpeech()
      } catch {
        // ignore
      }
      setPhase('idle')
      setCanAdvance(false)
      setStepIndex(0)
      setSteps([])
      advanceWaitRef.current = null
      return
    }

    cancelledRef.current = false
    finishedRef.current = false
    advanceNowRef.current = false
    setCanAdvance(false)
    let list: OnboardingStep[] = []
    try {
      list = loadOnboardingSteps().filter((item) => item.spoken.trim())
    } catch {
      list = []
    }
    setSteps(list)
    setStepIndex(0)

    if (list.length === 0) {
      finish()
      return
    }

    const speakLine = (text: string, lang: string) =>
      new Promise<void>((resolve) => {
        let settled = false
        let poll = 0
        let safety = 0
        const done = () => {
          if (settled) return
          settled = true
          if (poll) window.clearInterval(poll)
          if (safety) window.clearTimeout(safety)
          resolve()
        }
        poll = window.setInterval(() => {
          if (cancelledRef.current || advanceNowRef.current) done()
        }, 80)
        safety = window.setTimeout(
          done,
          Math.min(28_000, 2_800 + text.length * 90),
        )
        try {
          void speakKeaLine(text, {
            lang,
            onend: done,
            onerror: done,
          })
        } catch {
          done()
        }
      })

    const waitForNext = () =>
      new Promise<void>((resolve) => {
        if (cancelledRef.current || advanceNowRef.current) {
          resolve()
          return
        }
        setCanAdvance(true)
        setPhase('listening')
        advanceWaitRef.current = () => {
          advanceWaitRef.current = null
          setCanAdvance(false)
          resolve()
        }
      })

    const run = async () => {
      try {
        const locale = getLanguage(nativeLanguage).speechLocale
        for (let i = 0; i < list.length; i++) {
          if (cancelledRef.current) return
          setStepIndex(i)
          setCanAdvance(false)
          advanceNowRef.current = false
          const line = spokenOnboardingLine(list[i].spoken)
          onStepTextRef.current?.(line)
          setPhase('speaking')
          await speakLine(line, locale)
          if (cancelledRef.current) return
          if (advanceNowRef.current) continue
          await waitForNext()
          if (cancelledRef.current) return
        }
        if (!cancelledRef.current) finish()
      } catch {
        if (!cancelledRef.current) finish()
      }
    }

    void run()

    return () => {
      cancelledRef.current = true
      advanceWaitRef.current = null
      try {
        stopKeaSpeech()
      } catch {
        // ignore
      }
    }
  }, [active, nativeLanguage, finish])

  return {
    stepIndex,
    stepCount: steps.length,
    phase,
    canAdvance,
    current: steps[stepIndex] ?? null,
    advance,
  }
}
