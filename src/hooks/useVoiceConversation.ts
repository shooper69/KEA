import { useCallback, useEffect, useRef, useState } from 'react'
import {
  applyLearnTurn,
  splitKeaReply,
  splitTalkParagraphs,
  touchChatTopic,
} from '../architecture/companionMemory'
import {
  TALK_CLEARED_EVENT,
  loadTalkTranscript,
  saveTalkTranscript,
  withHomeGreeting,
} from '../architecture/keaTalkMemory'
import { patchVoiceDiagnostics } from '../architecture/voiceDiagnostics'
import {
  DEFAULT_VOICE_CHARACTER,
  getVoicePersonality,
} from '../config/voices'
import { getLanguage } from '../config/languages'
import {
  listVoices,
  pauseSpeech,
  resumeSpeech,
} from '../lib/speech'
import { askKea, translateSpanishToEnglish } from '../services/keaChat'
import { transcribeWithWhisper } from '../services/keaTranscribe'
import { speakKeaLine, stopKeaSpeech } from '../services/keaSpeak'
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
const MIN_SPEECH_MS = 280
const MAX_RECORD_MS = 22000
const SPEECH_RMS = 0.04
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

  const handsFreeRef = useRef(false)
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

  useEffect(() => {
    function persist() {
      saveTalkTranscript(historyRef.current)
    }
    window.addEventListener('pagehide', persist)
    document.addEventListener('visibilitychange', persist)
    function onVisible() {
      if (document.visibilityState !== 'visible') return
      persist()
      const stream = streamRef.current
      const dead =
        !stream || stream.getTracks().every((track) => track.readyState === 'ended')
      if (handsFreeRef.current && dead) {
        fatalListenRef.current = true
        handsFreeRef.current = false
        setHandsFree(false)
        busyRef.current = false
        teardownAudio()
        setStatus('idle')
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('pagehide', persist)
      document.removeEventListener('visibilitychange', persist)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

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
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop()
    }
    stopAnalyser(true)
    setStatus('idle')
    patchVoiceDiagnostics({ recognitionRunning: false })
  }, [clearListenIdleTimer, clearRestartTimer, stopAnalyser])

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
      if (!result.text.trim()) {
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
        if (rms > SPEECH_RMS) {
          speechMsRef.current += delta
          silenceMsRef.current = 0
          lastActivityAtRef.current = now
          armListenIdle()
        } else if (speechMsRef.current > MIN_SPEECH_MS) {
          silenceMsRef.current += delta
          if (silenceMsRef.current >= answerSilenceMsRef.current) {
            finishForAnswer()
            return
          }
        }
        if (now - recordStartedAtRef.current >= MAX_RECORD_MS) {
          finishForAnswer()
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

  const start = useCallback(async (greeting?: string) => {
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      patchVoiceDiagnostics({ recognitionAvailable: true })
      if (greeting?.trim()) {
        const text = greeting.trim()
        const keaMessage: TranscriptMessage = {
          id: crypto.randomUUID(),
          speaker: 'kea',
          text,
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
      setError('Microphone permission is needed for Kea to listen. Tap the kea, then allow the microphone.')
      patchVoiceDiagnostics({
        recognitionAvailable: false,
        lastRecognitionError: 'not-allowed',
      })
    } finally {
      startingRef.current = false
    }
  }, [speakReply, startListening])

  const stop = useCallback(() => {
    fatalListenRef.current = true
    handsFreeRef.current = false
    setHandsFree(false)
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
    const next = seedHomeGreeting([])
    historyRef.current = next
    setMessages(next)
    saveTalkTranscript(next)
  }, [seedHomeGreeting, stop])

  useEffect(() => {
    function onTalkCleared() {
      stop()
      const next = seedHomeGreeting([])
      historyRef.current = next
      setMessages(next)
    }
    window.addEventListener(TALK_CLEARED_EVENT, onTalkCleared)
    return () => window.removeEventListener(TALK_CLEARED_EVENT, onTalkCleared)
  }, [seedHomeGreeting, stop])

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
    toggle,
    start,
    stop,
    clearMessages,
    pauseSpeech,
    resumeSpeech,
    stopSpeech: stopKeaSpeech,
  }
}
