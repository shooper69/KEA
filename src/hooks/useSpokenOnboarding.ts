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
  const [steps, setSteps] = useState<OnboardingStep[]>([])
  const cancelledRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const onStepTextRef = useRef(onStepText)
  onStepTextRef.current = onStepText

  const finish = useCallback(() => {
    markSpokenOnboardingComplete(userKey)
    setPhase('done')
    onCompleteRef.current()
  }, [userKey])

  useEffect(() => {
    if (!active) {
      cancelledRef.current = true
      stopKeaSpeech()
      setPhase('idle')
      setStepIndex(0)
      setSteps([])
      return
    }

    cancelledRef.current = false
    const list = loadOnboardingSteps().filter((item) => item.spoken.trim())
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
        void audioContext.close()
        audioContext = null
      }
    }

    const listenForYes = async (): Promise<boolean> => {
      if (cancelledRef.current) return false
      setPhase('listening')
      try {
        const opened = await openKeaMicrophone()
        if (cancelledRef.current) {
          opened.stream.getTracks().forEach((track) => track.stop())
          return false
        }
        stream = opened.stream
        mime = pickRecorderMime()
        try {
          recorder = mime
            ? new MediaRecorder(stream, { mimeType: mime })
            : new MediaRecorder(stream)
        } catch {
          return false
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

        recorder.start()
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
            if (cancelledRef.current || settled || !analyser || !recorder) {
              finishClip()
              return
            }
            raf = requestAnimationFrame(tick)
            analyser.getByteTimeDomainData(samples)
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
          raf = requestAnimationFrame(tick)
        })

        teardownMic()
        if (cancelledRef.current || blob.size < 1200) return false
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
        return false
      }
    }

    const run = async () => {
      const locale = getLanguage(nativeLanguage).speechLocale
      for (let i = 0; i < list.length; i++) {
        if (cancelledRef.current) return
        setStepIndex(i)
        const line = withOkPrompt(list[i].spoken)
        onStepTextRef.current?.(line)
        setPhase('speaking')
        await new Promise<void>((resolve) => {
          void speakKeaLine(line, {
            lang: locale,
            onend: () => resolve(),
            onerror: () => resolve(),
          })
        })
        if (cancelledRef.current) return

        let confirmed = false
        for (let attempt = 0; attempt < 4 && !confirmed; attempt++) {
          if (cancelledRef.current) return
          confirmed = await listenForYes()
          if (confirmed) break
          if (cancelledRef.current) return
          // Soft re-prompt
          setPhase('speaking')
          await new Promise<void>((resolve) => {
            void speakKeaLine('Just say yes when you are ready. OK?', {
              lang: locale,
              onend: () => resolve(),
              onerror: () => resolve(),
            })
          })
        }
        if (!confirmed && !cancelledRef.current) {
          // Don't block forever — advance after failed attempts.
          continue
        }
      }
      if (!cancelledRef.current) finish()
    }

    void run()

    return () => {
      cancelledRef.current = true
      stopKeaSpeech()
      teardownMic()
    }
  }, [active, nativeLanguage, finish])

  return {
    stepIndex,
    stepCount: steps.length,
    phase,
    current: steps[stepIndex] ?? null,
  }
}
