import { useCallback, useEffect, useRef, useState } from 'react'
import { openKeaMicrophone } from '../architecture/keaMicrophone'
import {
  getSpeechRecognition,
  heardKeaWake,
  speechRecognitionAvailable,
} from '../architecture/keaWakeWord'
import { patchVoiceDiagnostics } from '../architecture/voiceDiagnostics'
import { looksLikeWhisperHallucination } from '../architecture/whisperText'
import { transcribeWithWhisper } from '../services/keaTranscribe'

interface UseKeaWakeWordOptions {
  enabled: boolean
  onWake: () => void
}

const SPEECH_RMS_FLOOR = 0.04
const SPEECH_HOLD_MS = 420
const SHOT_COOLDOWN_MS = 3500
const WAKE_SILENCE_MS = 520
const MIN_SPEECH_BURST_MS = 720
const MAX_UTTERANCE_MS = 3000
/** Mild hint for the two-word wake; avoid priming with lone "Kea". */
const WAKE_PROMPT =
  'The speaker may say the wake phrase "Hey Kea" or "Hi Kea". Prefer that exact short phrase when it is what was said. If there is only noise or silence, return an empty transcript.'
const MIN_WAKE_BLOB = 2200
/** Soft floor only for non-wake noise; matching "Hey Kea" bypasses this. */
const MIN_WAKE_CONFIDENCE = 0.28
const MIN_WAKE_MATCH_CONFIDENCE = 0.12

function pickRecorderMime(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

function logWake(event: string, detail?: unknown, extra?: unknown) {
  if (detail === undefined) console.info(`[Kea wake] ${event}`)
  else if (extra === undefined) console.info(`[Kea wake] ${event}`, detail)
  else console.info(`[Kea wake] ${event}`, detail, extra)
}

/**
 * Energy gate → short SpeechRecognition shot when the browser supports it
 * (phones + Chrome/Edge desktop). Otherwise MediaRecorder clip → Whisper.
 * Whisper alone was inventing "Thank you" / "Done" for short "Hey Kea" clips.
 */
export function useKeaWakeWord({ enabled, onWake }: UseKeaWakeWordOptions) {
  const [armed, setArmed] = useState(false)
  const [wakeMic, setWakeMic] = useState('')
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
    const preferSpeech = Boolean(Ctor)
    const canWhisper =
      typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getUserMedia)

    if (!enabled) {
      setArmed(false)
      setWakeMic('')
      abortRef.current = () => {}
      return
    }
    if (!preferSpeech && !canWhisper) {
      setArmed(false)
      setWakeMic('')
      abortRef.current = () => {}
      return
    }

    let recognition: InstanceType<NonNullable<typeof Ctor>> | null = null
    let dead = false
    let waking = false
    let heard = ''
    let stream: MediaStream | null = null
    let watchStream: MediaStream | null = null
    let audioContext: AudioContext | null = null
    let analyser: AnalyserNode | null = null
    let raf = 0
    let speechHold = 0
    let silenceHold = 0
    let speechBurstMs = 0
    let listeningShot = false
    let lastShotAt = 0
    let cancelled = false
    let recorder: MediaRecorder | null = null
    let chunks: Blob[] = []
    let mime = ''
    let speechRms = SPEECH_RMS_FLOOR
    let utteranceStartedAt = 0
    let recordingUtterance = false

    const stopRecognition = () => {
      try {
        recognition?.abort()
      } catch {
        // ignore
      }
      recognition = null
    }

    const stopRecorder = () => {
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.stop()
        } catch {
          // ignore
        }
      }
      recorder = null
      recordingUtterance = false
    }

    const teardownMic = () => {
      if (raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
      stopRecorder()
      analyser = null
      watchStream?.getTracks().forEach((track) => track.stop())
      watchStream = null
      stream?.getTracks().forEach((track) => track.stop())
      stream = null
      chunks = []
      if (audioContext) {
        void audioContext.close()
        audioContext = null
      }
    }

    const abortEngine = () => {
      dead = true
      waking = true
      stopRecognition()
      teardownMic()
    }
    abortRef.current = abortEngine

    const fireWake = () => {
      if (waking || dead) return
      waking = true
      logWake('matched — starting talk')
      stopRecognition()
      teardownMic()
      window.setTimeout(() => onWakeRef.current(), 120)
    }

    const beginUtterance = () => {
      if (!stream || recordingUtterance || listeningShot || dead || waking) return
      if (typeof MediaRecorder === 'undefined') return
      chunks = []
      mime = pickRecorderMime()
      try {
        recorder = mime
          ? new MediaRecorder(stream, { mimeType: mime })
          : new MediaRecorder(stream)
      } catch (caught) {
        logWake('recorder failed', caught)
        recorder = null
        return
      }
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      }
      try {
        // No timeslice: one complete container on stop (valid for Whisper).
        recorder.start()
        recordingUtterance = true
        utteranceStartedAt = performance.now()
        logWake('utterance record start')
      } catch (caught) {
        logWake('recorder start failed', caught)
        recorder = null
        recordingUtterance = false
      }
    }

    const finishUtterance = async (reason: string) => {
      if (dead || waking || cancelled || !enabledRef.current || listeningShot) return
      if (!recordingUtterance || !recorder) return
      if (Date.now() - lastShotAt < SHOT_COOLDOWN_MS) {
        stopRecorder()
        chunks = []
        speechHold = 0
        silenceHold = 0
        speechBurstMs = 0
        return
      }

      listeningShot = true
      lastShotAt = Date.now()
      speechHold = 0
      silenceHold = 0
      speechBurstMs = 0
      logWake(`check (${reason})`)

      const active = recorder
      const blob = await new Promise<Blob>((resolve) => {
        if (!active || active.state === 'inactive') {
          resolve(new Blob(chunks, { type: mime || 'audio/webm' }))
          return
        }
        active.onstop = () => {
          recorder = null
          recordingUtterance = false
          resolve(
            new Blob(chunks, {
              type: active.mimeType || mime || 'audio/webm',
            }),
          )
        }
        try {
          active.requestData()
        } catch {
          // ignore
        }
        try {
          active.stop()
        } catch {
          recorder = null
          recordingUtterance = false
          resolve(new Blob(chunks, { type: mime || 'audio/webm' }))
        }
      })
      chunks = []

      try {
        if (blob.size < MIN_WAKE_BLOB) {
          logWake('clip too small', blob.size)
          return
        }
        const result = await transcribeWithWhisper(blob, {
          prompt: WAKE_PROMPT,
          language: 'en',
        })
        logWake('transcript', result.text || '(empty)', result.confidence)
        patchVoiceDiagnostics({
          lastTranscript: result.text,
          recognitionLanguage: 'wake-whisper',
          lastRecognitionError: '',
        })
        if (dead || waking || cancelled || !enabledRef.current) return
        if (!result.text.trim()) {
          logWake('empty transcript — ignore')
          return
        }
        if (looksLikeWhisperHallucination(result.text)) {
          logWake('noise hallucination — ignore', result.text)
          return
        }
        const conf =
          result.confidence > 0 && result.confidence <= 1
            ? result.confidence
            : 1
        // Short wake phrases often score low — match text first.
        if (heardKeaWake(result.text)) {
          if (conf < MIN_WAKE_MATCH_CONFIDENCE) {
            logWake('wake match but confidence too low', conf)
            return
          }
          logWake('wake matched', result.text, conf)
          fireWake()
          return
        }
        if (conf < MIN_WAKE_CONFIDENCE) {
          logWake('low confidence — ignore', conf)
          return
        }
        logWake('no wake match', result.text || '(empty)')
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : 'Wake listen failed'
        logWake('error', message)
        patchVoiceDiagnostics({ lastRecognitionError: message })
      } finally {
        listeningShot = false
      }
    }

    const startSpeechShot = () => {
      if (!Ctor) return
      if (dead || waking || cancelled || !enabledRef.current || listeningShot) return
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastShotAt < SHOT_COOLDOWN_MS) return
      listeningShot = true
      lastShotAt = Date.now()
      heard = ''
      logWake('speech shot')
      teardownMic()
      try {
        const next = new Ctor()
        recognition = next
        next.lang = 'en-US'
        next.continuous = false
        next.interimResults = true
        next.maxAlternatives = 5
        next.onresult = (event) => {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const piece = event.results[i]
            const alts: string[] = []
            const count = Math.max(1, piece.length ?? 1)
            for (let a = 0; a < count; a++) {
              const said = piece?.[a]?.transcript ?? ''
              if (said) alts.push(said)
            }
            for (const said of alts) {
              if (looksLikeWhisperHallucination(said)) continue
              if (heardKeaWake(said)) {
                logWake('speech wake matched', said)
                fireWake()
                return
              }
            }
            const joined = alts.join(' ')
            heard = `${heard} ${joined}`.replace(/\s+/g, ' ').trim().slice(-160)
            logWake('speech heard', heard)
            if (looksLikeWhisperHallucination(heard)) return
            if (heardKeaWake(heard)) {
              logWake('speech wake matched', heard)
              fireWake()
            }
          }
        }
        next.onerror = (event) => {
          const err = event.error || ''
          logWake('speech error', err)
          if (err === 'not-allowed' || err === 'service-not-allowed') {
            dead = true
            setArmed(false)
          }
        }
        next.onend = () => {
          recognition = null
          listeningShot = false
          speechHold = 0
          if (!dead && !waking && !cancelled && enabledRef.current) {
            void armEnergy()
          }
        }
        next.start()
        setArmed(true)
      } catch {
        listeningShot = false
        void armEnergy()
      }
    }

    const armEnergy = async () => {
      if (dead || waking || cancelled || !enabledRef.current) return
      if (stream) return
      try {
        const opened = await openKeaMicrophone()
        if (cancelled || dead || waking || !enabledRef.current) {
          opened.stream.getTracks().forEach((track) => track.stop())
          return
        }
        stream = opened.stream
        setWakeMic(opened.info.label)
        watchStream = new MediaStream(
          stream.getAudioTracks().map((track) => track.clone()),
        )
        audioContext = new AudioContext()
        if (audioContext.state === 'suspended') await audioContext.resume()
        const source = audioContext.createMediaStreamSource(watchStream)
        analyser = audioContext.createAnalyser()
        analyser.fftSize = 1024
        source.connect(analyser)

        const samples = new Uint8Array(analyser.fftSize)
        let last = performance.now()
        const calibrateUntil = performance.now() + 500
        let ambientSum = 0
        let ambientN = 0
        logWake('armed', {
          preferSpeech,
          mic: opened.info.label,
        })
        const tick = (now: number) => {
          raf = requestAnimationFrame(tick)
          if (dead || waking || cancelled || !enabledRef.current) return
          if (listeningShot) return
          if (!analyser) return
          if (audioContext?.state === 'suspended') {
            void audioContext.resume()
          }
          analyser.getByteTimeDomainData(samples)
          let sum = 0
          for (const value of samples) {
            const n = (value - 128) / 128
            sum += n * n
          }
          const rms = Math.sqrt(sum / samples.length)
          const delta = now - last
          last = now
          if (now < calibrateUntil) {
            ambientSum += rms
            ambientN += 1
            if (ambientN > 3) {
              const ambient = ambientSum / ambientN
              speechRms = Math.max(
                SPEECH_RMS_FLOOR,
                Math.min(0.09, ambient * 4.2 + 0.018),
              )
            }
            return
          }
          if (rms > speechRms) {
            speechHold += delta
            speechBurstMs += delta
            silenceHold = 0
            if (speechHold >= SPEECH_HOLD_MS) {
              if (preferSpeech) startSpeechShot()
              else beginUtterance()
            }
            if (
              !preferSpeech &&
              recordingUtterance &&
              now - utteranceStartedAt >= MAX_UTTERANCE_MS
            ) {
              void finishUtterance('max')
            }
          } else {
            speechHold = Math.max(0, speechHold - delta * 0.7)
            if (
              !preferSpeech &&
              recordingUtterance &&
              speechBurstMs >= MIN_SPEECH_BURST_MS
            ) {
              silenceHold += delta
              if (silenceHold >= WAKE_SILENCE_MS) {
                void finishUtterance('silence')
              }
            } else if (!recordingUtterance) {
              speechBurstMs = Math.max(0, speechBurstMs - delta * 1.2)
              if (speechBurstMs < 80) {
                silenceHold = 0
              }
            }
          }
        }
        raf = requestAnimationFrame(tick)
        setArmed(true)
        patchVoiceDiagnostics({
          recognitionAvailable: true,
          recognitionRunning: true,
          recognitionLanguage: preferSpeech
            ? 'wake-speech'
            : `wake-whisper · ${opened.info.label}`,
        })
      } catch (caught) {
        logWake('arm failed', caught)
        if (!cancelled) setArmed(false)
      }
    }

    void armEnergy()

    function onVisibility() {
      if (document.visibilityState !== 'visible') {
        stopRecognition()
        stopRecorder()
        listeningShot = false
        speechHold = 0
        silenceHold = 0
        speechBurstMs = 0
        chunks = []
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      abortEngine()
      setArmed(false)
      setWakeMic('')
      abortRef.current = () => {}
    }
  }, [enabled])

  return {
    armed,
    wakeMic,
    release,
    listens:
      speechRecognitionAvailable() ||
      (typeof navigator !== 'undefined' &&
        Boolean(navigator.mediaDevices?.getUserMedia)),
  }
}
