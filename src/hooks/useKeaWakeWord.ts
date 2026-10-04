import { useCallback, useEffect, useRef, useState } from 'react'
import { openKeaMicrophone } from '../architecture/keaMicrophone'
import {
  connectSpeechAnalyser,
  createSpeechVad,
  SPEECH_RMS_FLOOR,
} from '../architecture/keaSpeechVad'
import {
  getSpeechRecognition,
  heardKeaWake,
  speechRecognitionAvailable,
  speechRecognitionPings,
  type KeaSpeechRecognition,
} from '../architecture/keaWakeWord'
import { patchVoiceDiagnostics } from '../architecture/voiceDiagnostics'
import { looksLikeWhisperHallucination } from '../architecture/whisperText'
import { isKeaReplayActive } from '../services/keaSpeak'
import { isKeaUiHeld, KEA_UI_HOLD, KEA_UI_RELEASE } from '../architecture/keaUiHold'
import { transcribeWithWhisper } from '../services/keaTranscribe'

interface UseKeaWakeWordOptions {
  enabled: boolean
  onWake: () => void
}

const SPEECH_HOLD_MS = 140
const SHOT_COOLDOWN_MS = 650
const WAKE_SILENCE_MS = 280
/** Longer than a key-tap; still short enough for “Hey Kea”. */
const MIN_SPEECH_BURST_MS = 180
const MAX_UTTERANCE_MS = 2200
const RING_SECONDS = 2.0
const AMBIENT_CALIBRATE_MS = 520
/** Wake gate stays a touch softer than talk VAD so “Hey Kea” still arms. */
const WAKE_VAD_FLOOR = Math.max(0.016, SPEECH_RMS_FLOOR * 0.75)
/** Mild hint for the two-word wake; avoid priming with lone "Kea". */
const WAKE_PROMPT =
  'The speaker may say the wake phrase "Hey Kea" or "Hi Kea". Prefer that exact short phrase when it is what was said. If there is only noise or silence, return an empty transcript.'

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  write(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  write(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

function logWake(event: string, detail?: unknown, extra?: unknown) {
  if (detail === undefined) console.info(`[Kea wake] ${event}`)
  else if (extra === undefined) console.info(`[Kea wake] ${event}`, detail)
  else console.info(`[Kea wake] ${event}`, detail, extra)
}

/**
 * Energy gate → one-shot SpeechRecognition (phones) or continuous SR (desktop).
 * Whisper is the fallback when the browser speech engine is unavailable.
 */
export function useKeaWakeWord({ enabled, onWake }: UseKeaWakeWordOptions) {
  const [armed, setArmed] = useState(false)
  const [wakeMic, setWakeMic] = useState('')
  const onWakeRef = useRef(onWake)
  onWakeRef.current = onWake
  const enabledRef = useRef(enabled)
  const abortRef = useRef<() => void>(() => {})
  const [uiHeld, setUiHeld] = useState(() => isKeaUiHeld())

  useEffect(() => {
    const onHold = () => setUiHeld(true)
    const onRelease = () => setUiHeld(false)
    window.addEventListener(KEA_UI_HOLD, onHold)
    window.addEventListener(KEA_UI_RELEASE, onRelease)
    return () => {
      window.removeEventListener(KEA_UI_HOLD, onHold)
      window.removeEventListener(KEA_UI_RELEASE, onRelease)
    }
  }, [])

  const wakeEnabled = enabled && !uiHeld
  enabledRef.current = wakeEnabled

  const release = useCallback(() => {
    abortRef.current()
  }, [])

  useEffect(() => {
    const Ctor = getSpeechRecognition()
    // Phones: do NOT run continuous or one-shot SpeechRecognition (beeps).
    // Use energy gate + Whisper only.
    const mobile = speechRecognitionPings()
    const preferContinuousSpeech = Boolean(Ctor) && !mobile
    const canWhisper =
      typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getUserMedia)

    if (!wakeEnabled) {
      setArmed(false)
      setWakeMic('')
      abortRef.current = () => {}
      return
    }
    if (!preferContinuousSpeech && !canWhisper) {
      setArmed(false)
      setWakeMic('')
      abortRef.current = () => {}
      return
    }

    let recognition: KeaSpeechRecognition | null = null
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
    let utteranceStartedAt = 0
    let recordingUtterance = false
    let ring: Float32Array | null = null
    let ringPos = 0
    let floatScratch: Float32Array<ArrayBuffer> | null = null

    const stopRecognition = () => {
      try {
        recognition?.abort()
      } catch {
        // ignore
      }
      recognition = null
    }

    const teardownMic = () => {
      if (raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
      recordingUtterance = false
      analyser = null
      floatScratch = null
      ring = null
      ringPos = 0
      watchStream?.getTracks().forEach((track) => track.stop())
      watchStream = null
      stream?.getTracks().forEach((track) => track.stop())
      stream = null
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
      window.setTimeout(() => onWakeRef.current(), 80)
    }

    const finishFromRing = async (reason: string) => {
      if (dead || waking || cancelled || !enabledRef.current || listeningShot) return
      if (!ring || !audioContext) return
      if (Date.now() - lastShotAt < SHOT_COOLDOWN_MS) {
        recordingUtterance = false
        utteranceStartedAt = 0
        speechHold = 0
        silenceHold = 0
        speechBurstMs = 0
        return
      }
      listeningShot = true
      lastShotAt = Date.now()
      recordingUtterance = false
      utteranceStartedAt = 0
      speechHold = 0
      silenceHold = 0
      speechBurstMs = 0

      // Phones: Whisper only. Browser SpeechRecognition pings on every start.
      const ordered = new Float32Array(ring.length)
      let index = 0
      for (let p = ringPos; p < ring.length; p++) ordered[index++] = ring[p]
      for (let p = 0; p < ringPos; p++) ordered[index++] = ring[p]
      const blob = encodeWav(ordered, audioContext.sampleRate)
      logWake(`whisper check (${reason})`, blob.size)
      try {
        const result = await transcribeWithWhisper(blob, {
          prompt: WAKE_PROMPT,
          language: 'en',
        })
        logWake('transcript', result.text || '(empty)', result.confidence)
        if (dead || waking || cancelled || !enabledRef.current) return
        if (!result.text.trim() || looksLikeWhisperHallucination(result.text)) return
        if (heardKeaWake(result.text)) {
          logWake('wake matched', result.text)
          fireWake()
        }
      } catch (caught) {
        logWake('error', caught instanceof Error ? caught.message : 'Wake listen failed')
      } finally {
        listeningShot = false
      }
    }

    const armEnergy = async () => {
      if (dead || waking || cancelled || !enabledRef.current) return
      if (stream) return
      try {
        // Brief settle after talk/stop released the previous mic tracks.
        await new Promise((resolve) => window.setTimeout(resolve, 120))
        if (cancelled || dead || waking || !enabledRef.current) return
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
        const linked = connectSpeechAnalyser(audioContext, watchStream)
        analyser = linked.analyser
        ring = new Float32Array(Math.floor(audioContext.sampleRate * RING_SECONDS))
        ringPos = 0
        // Analyser ring — avoids deprecated ScriptProcessor crashes on modern WebViews.
        floatScratch = new Float32Array(
          new ArrayBuffer(analyser.fftSize * Float32Array.BYTES_PER_ELEMENT),
        )
        const vad = createSpeechVad(WAKE_VAD_FLOOR)

        const samples: Uint8Array<ArrayBuffer> = new Uint8Array(
          new ArrayBuffer(analyser.fftSize),
        )
        let last = performance.now()
        const calibrateUntil = performance.now() + AMBIENT_CALIBRATE_MS
        logWake('armed', {
          mobile,
          path: mobile ? 'whisper' : 'speech+whisper',
          mic: opened.info.label,
        })
        const tick = (now: number) => {
          raf = requestAnimationFrame(tick)
          if (dead || waking || cancelled || !enabledRef.current) return
          if (listeningShot) return
          if (isKeaReplayActive()) return
          if (!analyser || !ring || !floatScratch || !audioContext) return
          if (audioContext.state === 'suspended') {
            void audioContext.resume()
          }
          try {
            analyser.getFloatTimeDomainData(floatScratch)
            const delta = now - last
            const need = Math.max(
              1,
              Math.min(
                floatScratch.length,
                Math.floor((audioContext.sampleRate * delta) / 1000),
              ),
            )
            const start = floatScratch.length - need
            for (let i = start; i < floatScratch.length; i++) {
              ring[ringPos] = floatScratch[i]
              ringPos = (ringPos + 1) % ring.length
            }
          } catch {
            // Analyser can throw if the context closed mid-frame.
            return
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
          const calibrating = now < calibrateUntil
          vad.observe(rms, { calibrating })
          if (calibrating) return
          if (vad.isSpeech(rms)) {
            speechHold += delta
            speechBurstMs += delta
            silenceHold = 0
            if (speechHold >= SPEECH_HOLD_MS && speechBurstMs >= MIN_SPEECH_BURST_MS) {
              recordingUtterance = true
              if (!utteranceStartedAt) utteranceStartedAt = now
            }
            if (
              recordingUtterance &&
              utteranceStartedAt &&
              now - utteranceStartedAt >= MAX_UTTERANCE_MS
            ) {
              void finishFromRing('max')
            }
          } else {
            speechHold = Math.max(0, speechHold - delta * 0.7)
            if (recordingUtterance && speechBurstMs >= MIN_SPEECH_BURST_MS) {
              silenceHold += delta
              if (silenceHold >= WAKE_SILENCE_MS) {
                void finishFromRing('silence')
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
          recognitionLanguage: `wake-whisper · ${opened.info.label}`,
        })
      } catch (caught) {
        logWake('arm failed', caught)
        if (!cancelled) setArmed(false)
      }
    }

    const startContinuous = () => {
      if (!Ctor || dead || waking || cancelled || !enabledRef.current || recognition) return
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
            for (const said of alts) {
              if (heardKeaWake(said)) {
                logWake('speech wake matched', said)
                fireWake()
                return
              }
            }
            heard = `${heard} ${alts.join(' ')}`.replace(/\s+/g, ' ').trim().slice(-180)
            if (heardKeaWake(heard)) {
              logWake('speech wake matched', heard)
              fireWake()
            }
          }
        }
        next.onerror = (event) => {
          const err = event.error || ''
          logWake('speech error', err)
          if (
            err === 'not-allowed' ||
            err === 'service-not-allowed' ||
            err === 'network' ||
            err === 'audio-capture'
          ) {
            stopRecognition()
            if (canWhisper && !stream) void armEnergy()
          }
        }
        next.onend = () => {
          recognition = null
          if (dead || waking || cancelled || !enabledRef.current || stream) return
          window.setTimeout(() => {
            if (!dead && !waking && !cancelled && enabledRef.current && !recognition && !stream) {
              startContinuous()
            }
          }, 400)
        }
        next.start()
        setArmed(true)
        logWake('listening for Hey Kea')
      } catch (caught) {
        logWake('speech start failed', caught)
        recognition = null
        if (canWhisper) void armEnergy()
      }
    }

    // Desktop: continuous SpeechRecognition (Whisper energy on SR failure).
    // Phones: Whisper energy only — browser SR pings on every start.
    if (preferContinuousSpeech) startContinuous()
    else void armEnergy()

    function onVisibility() {
      if (document.visibilityState !== 'visible') {
        stopRecognition()
        teardownMic()
        listeningShot = false
        speechHold = 0
        silenceHold = 0
        speechBurstMs = 0
        return
      }
      if (dead || waking || cancelled || !enabledRef.current) return
      if (preferContinuousSpeech) startContinuous()
      else void armEnergy()
    }

    function onPointerUnlock() {
      if (audioContext?.state === 'suspended') void audioContext.resume()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pointerdown', onPointerUnlock, { passive: true })

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pointerdown', onPointerUnlock)
      abortEngine()
      setArmed(false)
      setWakeMic('')
      abortRef.current = () => {}
    }
  }, [wakeEnabled])

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
