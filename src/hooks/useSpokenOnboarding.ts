import { useCallback, useEffect, useRef, useState } from 'react'
import { openKeaMicrophone } from '../architecture/keaMicrophone'
import { heardOnboardingYes } from '../architecture/keaOnboardingYes'
import { looksLikeWhisperHallucination } from '../architecture/whisperText'
import {
  loadOnboardingSteps,
  markSpokenOnboardingComplete,
  withOkPrompt,
  type OnboardingStep,
} from '../data/keaOnboarding'
import { getLanguage } from '../config/languages'
import { speakKeaLine, stopKeaSpeech } from '../services/keaSpeak'
import { transcribeWithWhisper } from '../services/keaTranscribe'
import type { LanguageCode } from '../types'

interface UseSpokenOnboardingOptions {
  active: boolean
  nativeLanguage: LanguageCode
  userKey?: string
  onComplete: () => void
  onStepText?: (text: string) => void
}

function pickRecorderMime() {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

/**
 * Spoken product tour: Kea explains each step, asks OK?, waits for yes, then continues.
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

    let stream: MediaStream | null = null
    let audioContext: AudioContext | null = null
    let analyser: AnalyserNode | null = null
    let raf = 0
    let recorder: MediaRecorder | null = null
    let chunks: Blob[] = []
    let mime = ''

    const teardownMic = () => {
      advanceWaitRef.current = null
      if (raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.stop()
        } catch {
          // ignore
        }
      }
      recorder = null
      analyser = null
      stream?.getTracks().forEach((track) => track.stop())
      stream = null
      chunks = []
      if (audioContext) {
        void audioContext.close().catch(() => {})
        audioContext = null
      }
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
        // Next / stop bumps speak generation so onend may never fire — poll + timeout.
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

    const listenForYes = async (): Promise<boolean> => {
      if (cancelledRef.current) return false
      if (advanceNowRef.current) return true
      setPhase('listening')
      try {
        const opened = await openKeaMicrophone()
        if (cancelledRef.current || advanceNowRef.current) {
          opened.stream.getTracks().forEach((track) => track.stop())
          return Boolean(advanceNowRef.current)
        }
        stream = opened.stream
        mime = pickRecorderMime()
        try {
          recorder = mime
            ? new MediaRecorder(stream, { mimeType: mime })
            : new MediaRecorder(stream)
        } catch {
          opened.stream.getTracks().forEach((track) => track.stop())
          return Boolean(advanceNowRef.current)
        }
        chunks = []
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data)
        }

        audioContext = new AudioContext()
        if (audioContext.state === 'suspended') await audioContext.resume()
        const source = audioContext.createMediaStreamSource(stream)
        analyser = audioContext.createAnalyser()
        analyser.fftSize = 1024
        source.connect(analyser)
        const samples = new Uint8Array(analyser.fftSize)
        let speechMs = 0
        let silenceMs = 0
        let started = false
        const speechFloor = 0.035
        const minSpeech = 280
        const silenceEnd = 700
        const maxMs = 6000

        try {
          recorder.start()
        } catch {
          teardownMic()
          return Boolean(advanceNowRef.current)
        }
        const startedAt = performance.now()
        let settled = false

        const blob = await new Promise<Blob>((resolve) => {
          const finishClip = () => {
            if (settled) return
            settled = true
            if (raf) {
              cancelAnimationFrame(raf)
              raf = 0
            }
            try {
              recorder?.requestData()
            } catch {
              // ignore
            }
            try {
              if (recorder && recorder.state !== 'inactive') recorder.stop()
              else {
                resolve(
                  new Blob(chunks, {
                    type: recorder?.mimeType || mime || 'audio/webm',
                  }),
                )
              }
            } catch {
              resolve(new Blob(chunks, { type: mime || 'audio/webm' }))
            }
          }
          const tick = (now: number) => {
            if (
              cancelledRef.current ||
              advanceNowRef.current ||
              settled ||
              !analyser ||
              !recorder
            ) {
              finishClip()
              return
            }
            raf = requestAnimationFrame(tick)
            try {
              analyser.getByteTimeDomainData(samples)
            } catch {
              finishClip()
              return
            }
            let sum = 0
            for (const value of samples) {
              const n = (value - 128) / 128
              sum += n * n
            }
            const rms = Math.sqrt(sum / samples.length)
            if (rms > speechFloor) {
              speechMs += 16
              silenceMs = 0
              if (speechMs >= minSpeech) started = true
            } else if (started) {
              silenceMs += 16
              if (silenceMs >= silenceEnd) finishClip()
            }
            if (now - startedAt >= maxMs) finishClip()
          }
          recorder!.onstop = () => {
            settled = true
            resolve(
              new Blob(chunks, {
                type: recorder?.mimeType || mime || 'audio/webm',
              }),
            )
          }
          advanceWaitRef.current = () => {
            advanceNowRef.current = true
            finishClip()
          }
          raf = requestAnimationFrame(tick)
        })

        advanceWaitRef.current = null
        teardownMic()
        if (cancelledRef.current) return false
        if (advanceNowRef.current) return true
        if (blob.size < 1200) return false
        const result = await transcribeWithWhisper(blob, {
          prompt: 'The speaker may simply say yes, okay, or sure.',
          language: 'en',
        })
        if (cancelledRef.current) return false
        if (!result.text.trim() || looksLikeWhisperHallucination(result.text)) {
          return false
        }
        return heardOnboardingYes(result.text)
      } catch {
        teardownMic()
        return Boolean(advanceNowRef.current)
      }
    }

    const run = async () => {
      try {
        const locale = getLanguage(nativeLanguage).speechLocale
        for (let i = 0; i < list.length; i++) {
          if (cancelledRef.current) return
          setStepIndex(i)
          setCanAdvance(false)
          advanceNowRef.current = false
          const line = withOkPrompt(list[i].spoken)
          onStepTextRef.current?.(line)
          setPhase('speaking')
          await speakLine(line, locale)
          if (cancelledRef.current) return
          if (advanceNowRef.current) {
            setCanAdvance(false)
            continue
          }
          setCanAdvance(true)

          let confirmed = false
          for (let attempt = 0; attempt < 4 && !confirmed; attempt++) {
            if (cancelledRef.current) return
            confirmed = await listenForYes()
            if (confirmed) break
            if (cancelledRef.current) return
            setPhase('speaking')
            await speakLine('Just say yes when you are ready. OK?', locale)
            if (cancelledRef.current) return
            setCanAdvance(true)
          }
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
      teardownMic()
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
