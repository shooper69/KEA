import { useCallback, useEffect, useRef, useState } from 'react'
import {
  applyLearnTurn,
  splitKeaReply,
  splitTalkParagraphs,
  touchChatTopic,
} from '../architecture/companionMemory'
import {
  TALK_CLEARED_EVENT,
  clearTalkTranscript,
  loadTalkTranscript,
  saveTalkTranscript,
  withHomeGreeting,
} from '../architecture/keaTalkMemory'
import { patchVoiceDiagnostics } from '../architecture/voiceDiagnostics'
import {
  DEFAULT_VOICE_CHARACTER,
  getVoicePersonality,
} from '../config/voices'
import { openKeaMicrophone } from '../architecture/keaMicrophone'
import { getLanguage } from '../config/languages'
import {
  listVoices,
  pauseSpeech,
  resumeSpeech,
} from '../lib/speech'
import { askKea, translateSpanishToEnglish } from '../services/keaChat'
import { transcribeWithWhisper } from '../services/keaTranscribe'
import { speakKeaLine, stopKeaSpeech } from '../services/keaSpeak'
import { isUsableSpeechTranscript } from '../architecture/whisperText'
import type {
  LanguageCode,
  LearnerLevel,
  NativeLanguageCode,
  TranscriptMessage,
  VoicePersonalityId,
  VoicePresenceState,
} from '../types'

const NATIVE_NAMES: Record<NativeLanguageCode, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  ru: 'Russian',
}

const CHARACTER_KEY = 'kea-voice-character'
const RESTART_LISTEN_MS = 80
const MIN_SPEECH_MS = 480
const MAX_RECORD_MS = 22000
/** Floor for speech; live threshold is raised from ambient noise. */
const SPEECH_RMS_FLOOR = 0.02
const DEFAULT_ANSWER_SILENCE_MS = 3000

function readCharacter(): VoicePersonalityId {
  try {
    const stored = localStorage.getItem(CHARACTER_KEY)
    if (
      stored === 'luna' ||
      stored === 'mira' ||
      stored === 'sage' ||
      stored === 'rowan' ||
      stored === 'theo'
    ) {
      return stored
    }
  } catch {
    // ignore
  }
  return DEFAULT_VOICE_CHARACTER
}

function logSpeech(event: string, detail?: unknown) {
  if (detail === undefined) console.info(`[Kea speech] ${event}`)
  else console.info(`[Kea speech] ${event}`, detail)
}

function logAi(event: string, detail?: unknown) {
  if (detail === undefined) console.info(`[Kea AI] ${event}`)
  else console.info(`[Kea AI] ${event}`, detail)
}

function pickRecorderMime(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

interface UseVoiceConversationOptions {
  targetLanguage: LanguageCode
  nativeLanguage: NativeLanguageCode
  level: LearnerLevel
  firstName?: string
  listenIdleSeconds?: number
  answerAfterSilenceSeconds?: number
}

export function useVoiceConversation({
  targetLanguage,
  nativeLanguage,
  level,
  firstName = '',
  listenIdleSeconds = 10,
  answerAfterSilenceSeconds = 3,
}: UseVoiceConversationOptions) {
  const [status, setStatus] = useState<VoicePresenceState>('idle')
  const [messages, setMessages] = useState<TranscriptMessage[]>(() =>
    withHomeGreeting(loadTalkTranscript(), targetLanguage, firstName),
  )
  const [error, setError] = useState<string | null>(null)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [characterId, setCharacterId] = useState<VoicePersonalityId>(readCharacter)
  const [rate, setRate] = useState(() => getVoicePersonality(readCharacter()).rate)
  const [handsFree, setHandsFree] = useState(false)
  const [micLabel, setMicLabel] = useState('')

  const handsFreeRef = useRef(false)
  const speechRmsRef = useRef(SPEECH_RMS_FLOOR)
  const busyRef = useRef(false)
  const historyRef = useRef<TranscriptMessage[]>([])
  const statusRef = useRef<VoicePresenceState>('idle')
  const sendToKeaRef = useRef<(text: string) => Promise<void>>(async () => {})
  const listenIdleTimerRef = useRef<number | null>(null)
  const lastActivityAtRef = useRef(0)
  const fatalListenRef = useRef(false)
  const sendingRef = useRef(false)
  const restartTimerRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const rafRef = useRef(0)
  const recordStartedAtRef = useRef(0)
  const speechMsRef = useRef(0)
  const silenceMsRef = useRef(0)
  const stoppingRecordRef = useRef(false)
  const startListeningRef = useRef<() => void>(() => {})
  const answerSilenceMsRef = useRef(DEFAULT_ANSWER_SILENCE_MS)
  answerSilenceMsRef.current = Math.round(
    Math.min(15, Math.max(1, answerAfterSilenceSeconds)) * 1000,
  )

  useEffect(() => {
    handsFreeRef.current = handsFree
  }, [handsFree])

  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    historyRef.current = messages
    saveTalkTranscript(messages)
  }, [messages])

  const clearListenIdleTimer = useCallback(() => {
    if (listenIdleTimerRef.current !== null) {
      window.clearTimeout(listenIdleTimerRef.current)
      listenIdleTimerRef.current = null
    }
  }, [])

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }
  }, [])

  const stopAnalyser = useCallback((closeContext = false) => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    analyserRef.current?.disconnect()
    analyserRef.current = null
    sourceRef.current?.disconnect()
    sourceRef.current = null
    if (closeContext && audioContextRef.current) {
      void audioContextRef.current.close()
      audioContextRef.current = null
    }
  }, [])

  const teardownAudio = useCallback(() => {
    stopAnalyser(true)
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop()
      } catch {
        // ignore
      }
    }
    recorderRef.current = null
    chunksRef.current = []
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [stopAnalyser])

  const pauseForBackground = useCallback(() => {
    saveTalkTranscript(historyRef.current)
    stopKeaSpeech()
    clearListenIdleTimer()
    clearRestartTimer()
    stoppingRecordRef.current = true
    busyRef.current = false
    sendingRef.current = false
    fatalListenRef.current = false
    handsFreeRef.current = false
    setHandsFree(false)
    teardownAudio()
    setStatus('idle')
    patchVoiceDiagnostics({ recognitionRunning: false })
  }, [clearListenIdleTimer, clearRestartTimer, teardownAudio])

  const restoreTranscript = useCallback(() => {
    const stored = withHomeGreeting(
      loadTalkTranscript(),
      targetLanguage,
      firstName,
    )
    setMessages((current) => {
      if (stored.length === 0) return current
      if (current.length > stored.length) {
        saveTalkTranscript(current)
        return current
      }
      historyRef.current = stored
      return stored
    })
  }, [firstName, targetLanguage])

  useEffect(() => {
    function onLeave() {
      pauseForBackground()
    }
    function onVisibility() {
      if (document.visibilityState !== 'visible') {
        onLeave()
        return
      }
      restoreTranscript()
      setStatus('idle')
      patchVoiceDiagnostics({ recognitionRunning: false })
    }
    window.addEventListener('pagehide', onLeave)
    document.addEventListener('freeze', onLeave)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', onLeave)
      document.removeEventListener('freeze', onLeave)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [pauseForBackground, restoreTranscript])
  useEffect(() => {
    const refresh = () => setVoices(listVoices())
    refresh()
    window.speechSynthesis?.addEventListener('voiceschanged', refresh)
    return () => {
      window.speechSynthesis?.removeEventListener('voiceschanged', refresh)
      stopKeaSpeech()
    }
  }, [])

  useEffect(() => {
    return () => {
      if (listenIdleTimerRef.current !== null) window.clearTimeout(listenIdleTimerRef.current)
      if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((track) => track.stop())
      if (audioContextRef.current) void audioContextRef.current.close()
    }
  }, [])

  const pauseListening = useCallback(() => {
    if (busyRef.current) return
    clearListenIdleTimer()
    clearRestartTimer()
    handsFreeRef.current = false
    setHandsFree(false)
    stoppingRecordRef.current = true
    busyRef.current = false
    fatalListenRef.current = false
    teardownAudio()
    setStatus('idle')
    patchVoiceDiagnostics({ recognitionRunning: false })
  }, [clearListenIdleTimer, clearRestartTimer, teardownAudio])

  const armListenIdle = useCallback(() => {
    clearListenIdleTimer()
    listenIdleTimerRef.current = window.setTimeout(() => {
      listenIdleTimerRef.current = null
      if (busyRef.current || statusRef.current !== 'listening') return
      if (speechMsRef.current > MIN_SPEECH_MS) return
      pauseListening()
    }, Math.max(3, listenIdleSeconds) * 1000)
  }, [clearListenIdleTimer, listenIdleSeconds, pauseListening])

  const captionSpanish = useCallback(
    (id: string, text: string) => {
      if (targetLanguage !== 'es' || !text.trim()) return
      const parts = splitTalkParagraphs(text)
      void Promise.all(parts.map((part) => translateSpanishToEnglish(part)))
        .then((englishParts) => {
          const english = englishParts.join('\n')
          setMessages((current) =>
            current.map((item) => (item.id === id ? { ...item, english } : item)),
          )
        })
        .catch(() => {
          // Spoken conversation continues even if the caption fails.
        })
    },
    [targetLanguage],
  )

  const processRecording = useCallback(async (blob: Blob) => {
    if (fatalListenRef.current || !handsFreeRef.current) return
    if (sendingRef.current) return
    if (blob.size < 800) {
      busyRef.current = false
      if (handsFreeRef.current && !busyRef.current) startListeningRef.current()
      return
    }
    busyRef.current = true
    clearListenIdleTimer()
    setStatus('thinking')
    patchVoiceDiagnostics({ recognitionRunning: false })
    try {
      logSpeech('whisper')
      const result = await transcribeWithWhisper(blob)
      logSpeech('transcript', result)
      if (!isUsableSpeechTranscript(result.text, result.confidence)) {
        logSpeech('ignored noise/hallucination', result)
        busyRef.current = false
        if (handsFreeRef.current) startListeningRef.current()
        else setStatus('idle')
        return
      }
      patchVoiceDiagnostics({
        lastTranscript: result.text,
        lastConfidence: result.confidence,
        recognitionLanguage: 'whisper-1 mixed en/es',
        lastRecognitionError: '',
      })
      await sendToKeaRef.current(result.text)
    } catch (caught) {
      busyRef.current = false
      const message = caught instanceof Error ? caught.message : 'Could not transcribe speech'
      logSpeech('error', message)
      patchVoiceDiagnostics({ lastRecognitionError: message, recognitionRunning: false })
      setError(message)
      if (handsFreeRef.current) startListeningRef.current()
      else setStatus('idle')
    }
  }, [clearListenIdleTimer])

  const startListening = useCallback(() => {
    if (busyRef.current || fatalListenRef.current) return
    const stream = streamRef.current
    if (!stream) return
    try {
      chunksRef.current = []
      speechMsRef.current = 0
      silenceMsRef.current = 0
      stoppingRecordRef.current = false
      recordStartedAtRef.current = performance.now()
      const mime = pickRecorderMime()
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream)
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        stopAnalyser()
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mime || 'audio/webm',
        })
        chunksRef.current = []
        if (stoppingRecordRef.current) return
        void processRecording(blob)
      }
      recorder.start(80)

      let context = audioContextRef.current
      if (!context || context.state === 'closed') {
        context = new AudioContext()
        audioContextRef.current = context
      }
      if (context.state === 'suspended') void context.resume()
      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)
      sourceRef.current = source
      analyserRef.current = analyser
      const samples = new Uint8Array(analyser.fftSize)
      let last = performance.now()
      let ambientSum = 0
      let ambientSamples = 0
      const ambientUntil = performance.now() + 280
      speechRmsRef.current = SPEECH_RMS_FLOOR
      const finishForAnswer = () => {
        if (recorder.state !== 'recording') return
        stopAnalyser()
        busyRef.current = true
        setStatus('thinking')
        try {
          recorder.requestData()
        } catch {
          // Some engines flush on stop only.
        }
        recorder.stop()
      }
      const tick = (now: number) => {
        rafRef.current = requestAnimationFrame(tick)
        analyser.getByteTimeDomainData(samples)
        let sum = 0
        for (const value of samples) {
          const n = (value - 128) / 128
          sum += n * n
        }
        const rms = Math.sqrt(sum / samples.length)
        const delta = now - last
        last = now
        if (now < ambientUntil && speechMsRef.current === 0) {
          ambientSum += rms
          ambientSamples += 1
          if (ambientSamples > 4) {
            const ambient = ambientSum / ambientSamples
            speechRmsRef.current = Math.max(
              SPEECH_RMS_FLOOR,
              Math.min(0.05, ambient * 2.4 + 0.006),
            )
          }
        }
        if (rms > speechRmsRef.current) {
          speechMsRef.current += delta
          silenceMsRef.current = 0
          lastActivityAtRef.current = now
          armListenIdle()
          window.dispatchEvent(new Event('kea-user-activity'))
        } else if (speechMsRef.current > MIN_SPEECH_MS) {
          silenceMsRef.current += delta
          if (silenceMsRef.current >= answerSilenceMsRef.current) {
            finishForAnswer()
            return
          }
        }
        if (now - recordStartedAtRef.current >= MAX_RECORD_MS) {
          if (speechMsRef.current > MIN_SPEECH_MS) finishForAnswer()
        }
      }
      rafRef.current = requestAnimationFrame(tick)

      logSpeech('start', 'whisper-1')
      patchVoiceDiagnostics({
        recognitionAvailable: true,
        recognitionRunning: true,
        recognitionLanguage: 'whisper-1 mixed en/es',
        lastRecognitionError: '',
      })
      setStatus('listening')
      setError(null)
      lastActivityAtRef.current = performance.now()
      armListenIdle()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught)
      logSpeech('error', message)
      patchVoiceDiagnostics({ recognitionRunning: false, lastRecognitionError: message })
      setError('Microphone recording could not start.')
    }
  }, [armListenIdle, processRecording, stopAnalyser])

  useEffect(() => {
    startListeningRef.current = startListening
  }, [startListening])

  const speakReply = useCallback(
    (text: string) => {
      busyRef.current = true
      setStatus('speaking')
      setMessages((current) =>
        current.map((item, index) => ({
          ...item,
          active: index === current.length - 1 && item.speaker === 'kea',
        })),
      )
      patchVoiceDiagnostics({ lastSpeechOutput: text, recognitionRunning: false })
      logSpeech('speaking')
      void speakKeaLine(text, {
        lang: getLanguage(targetLanguage).speechLocale,
        onend: () => {
          busyRef.current = false
          sendingRef.current = false
          setMessages((current) =>
            current.map((item) => ({ ...item, active: false })),
          )
          if (handsFreeRef.current) {
            logSpeech('listening again')
            window.setTimeout(() => startListeningRef.current(), RESTART_LISTEN_MS)
          } else {
            setStatus('idle')
          }
        },
        onerror: () => {
          busyRef.current = false
          sendingRef.current = false
          if (handsFreeRef.current) {
            window.setTimeout(() => startListeningRef.current(), RESTART_LISTEN_MS)
          } else setStatus('idle')
        },
      })
    },
    [targetLanguage],
  )

  const sendToKea = useCallback(
    async (userText: string) => {
      if (sendingRef.current) return
      sendingRef.current = true
      busyRef.current = true
      clearListenIdleTimer()
      setStatus('thinking')
      const userMessage: TranscriptMessage = {
        id: crypto.randomUUID(),
        speaker: 'user',
        text: userText,
      }
      historyRef.current = [...historyRef.current, userMessage]
      setMessages((current) => [...current, userMessage])
      captionSpanish(userMessage.id, userText)
      try {
        logAi('request', userText)
        const raw = await askKea({
          nativeLanguage: NATIVE_NAMES[nativeLanguage],
          targetLanguage: getLanguage(targetLanguage).name,
          level,
          history: historyRef.current,
          userText,
        })
        const { reply, signals } = splitKeaReply(raw)
        logAi('response', reply)
        const keaMessage: TranscriptMessage = {
          id: crypto.randomUUID(),
          speaker: 'kea',
          text: reply,
          active: true,
        }
        setMessages((current) => [...current, keaMessage])
        captionSpanish(keaMessage.id, reply)
        applyLearnTurn({
          languageCode: targetLanguage,
          userText,
          keaReply: reply,
          signals,
        })
        touchChatTopic(userText, reply)
        patchVoiceDiagnostics({ lastAiResponse: reply, lastTranscript: userText })
        speakReply(reply)
      } catch (caught) {
        busyRef.current = false
        sendingRef.current = false
        handsFreeRef.current = false
        setStatus('idle')
        setHandsFree(false)
        setError(caught instanceof Error ? caught.message : 'Kea could not reply')
      }
    },
    [
      captionSpanish,
      clearListenIdleTimer,
      level,
      nativeLanguage,
      speakReply,
      targetLanguage,
    ],
  )

  useEffect(() => {
    sendToKeaRef.current = sendToKea
  }, [sendToKea])

  const startingRef = useRef(false)

  const start = useCallback(async (greeting?: string, englishCaption?: string) => {
    if (startingRef.current || handsFreeRef.current) return
    startingRef.current = true
    setError(null)
    fatalListenRef.current = false
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      startingRef.current = false
      setError('This browser cannot record the microphone for Whisper.')
      patchVoiceDiagnostics({ recognitionAvailable: false })
      return
    }
    // Drop the wake-word recognizer before opening Whisper's mic.
    handsFreeRef.current = true
    setHandsFree(true)
    await new Promise((resolve) => window.setTimeout(resolve, 220))
    try {
      const { stream, info } = await openKeaMicrophone()
      streamRef.current = stream
      setMicLabel(info.label)
      patchVoiceDiagnostics({
        recognitionAvailable: true,
        recognitionLanguage: `whisper-1 · ${info.label}`,
      })
      if (info.virtual) {
        setError(
          `Chrome is using “${info.label}”, which is usually silent. Click the lock icon by the URL → Microphone → choose your Samson Meteor (or built-in mic), then tap Kea again.`,
        )
      }
      if (greeting?.trim()) {
        const text = greeting.trim()
        const english = englishCaption?.trim() || undefined
        const keaMessage: TranscriptMessage = {
          id: crypto.randomUUID(),
          speaker: 'kea',
          text,
          english: targetLanguage === 'en' ? undefined : english,
          active: true,
        }
        historyRef.current = [...historyRef.current, keaMessage]
        setMessages((current) => [...current, keaMessage])
        speakReply(text)
        return
      }
      startListening()
    } catch {
      fatalListenRef.current = true
      handsFreeRef.current = false
      setHandsFree(false)
      setMicLabel('')
      setError('Microphone permission is needed for Kea to listen. Tap the kea, then allow the microphone.')
      patchVoiceDiagnostics({
        recognitionAvailable: false,
        lastRecognitionError: 'not-allowed',
      })
    } finally {
      startingRef.current = false
    }
  }, [speakReply, startListening, targetLanguage])

  const stop = useCallback(() => {
    fatalListenRef.current = true
    handsFreeRef.current = false
    setHandsFree(false)
    setMicLabel('')
    busyRef.current = false
    sendingRef.current = false
    stoppingRecordRef.current = true
    clearListenIdleTimer()
    clearRestartTimer()
    stopKeaSpeech()
    teardownAudio()
    setStatus('idle')
    patchVoiceDiagnostics({ recognitionRunning: false })
  }, [clearListenIdleTimer, clearRestartTimer, teardownAudio])

  const seedHomeGreeting = useCallback(
    (current: TranscriptMessage[]) =>
      withHomeGreeting(current, targetLanguage, firstName),
    [firstName, targetLanguage],
  )

  useEffect(() => {
    setMessages((current) => seedHomeGreeting(current))
  }, [seedHomeGreeting])

  const clearMessages = useCallback(() => {
    stop()
    historyRef.current = []
    setMessages([])
    clearTalkTranscript()
  }, [stop])

  useEffect(() => {
    function onTalkCleared() {
      stop()
      historyRef.current = []
      setMessages([])
    }
    window.addEventListener(TALK_CLEARED_EVENT, onTalkCleared)
    return () => window.removeEventListener(TALK_CLEARED_EVENT, onTalkCleared)
  }, [stop])

  const toggle = useCallback(() => {
    if (startingRef.current) return
    if (handsFreeRef.current || status !== 'idle') stop()
    else void start()
  }, [start, status, stop])

  return {
    status,
    messages,
    error,
    voices,
    characterId,
    setCharacter: (id: VoicePersonalityId) => {
      setCharacterId(id)
      setRate(getVoicePersonality(id).rate)
      try {
        localStorage.setItem(CHARACTER_KEY, id)
      } catch {
        // ignore
      }
    },
    rate,
    setRate,
    handsFree,
    micLabel,
    toggle,
    start,
    stop,
    clearMessages,
    pauseSpeech,
    resumeSpeech,
    stopSpeech: stopKeaSpeech,
  }
}
