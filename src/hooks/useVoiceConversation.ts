import { useCallback, useEffect, useRef, useState } from 'react'
import { getLanguage } from '../config/languages'
import {
  getSpeechRecognition,
  listVoices,
  pauseSpeech,
  resumeSpeech,
  speakText,
  stopSpeech,
} from '../lib/speech'
import { askKea, translateSpanishToEnglish } from '../services/keaChat'
import type {
  LanguageCode,
  LearnerLevel,
  NativeLanguageCode,
  TranscriptMessage,
  VoicePresenceState,
} from '../types'

const NATIVE_NAMES: Record<NativeLanguageCode, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
}

/** Quiet time after the last speech energy / transcript before the turn is sent. */
const END_OF_TURN_SILENCE_MS = 1600
/** Pauses shorter than this never commit a turn (must stay below END_OF_TURN_SILENCE_MS). */
const SHORT_PAUSE_MS = 700
/** RMS above this counts as the user currently speaking (0–1 scale). */
const SPEECH_RMS_THRESHOLD = 0.035
/** Ignore clicks and breath pops shorter than this. */
const MIN_SPEECH_MS = 220

interface UseVoiceConversationOptions {
  targetLanguage: LanguageCode
  nativeLanguage: NativeLanguageCode
  level: LearnerLevel
}

function micRms(analyser: AnalyserNode, buffer: Uint8Array<ArrayBuffer>) {
  analyser.getByteTimeDomainData(buffer)
  let sum = 0
  for (let index = 0; index < buffer.length; index += 1) {
    const sample = (buffer[index] - 128) / 128
    sum += sample * sample
  }
  return Math.sqrt(sum / buffer.length)
}

export function useVoiceConversation({
  targetLanguage,
  nativeLanguage,
  level,
}: UseVoiceConversationOptions) {
  const [status, setStatus] = useState<VoicePresenceState>('idle')
  const [messages, setMessages] = useState<TranscriptMessage[]>([])
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceURI, setVoiceURI] = useState('')
  const [rate, setRate] = useState(0.95)
  const [handsFree, setHandsFree] = useState(false)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const handsFreeRef = useRef(false)
  const busyRef = useRef(false)
  const historyRef = useRef<TranscriptMessage[]>([])
  const statusRef = useRef<VoicePresenceState>('idle')
  const sendToKeaRef = useRef<(text: string) => Promise<void>>(async () => {})
  const finalTranscriptRef = useRef('')
  const interimTranscriptRef = useRef('')
  const commitTimerRef = useRef<number | null>(null)
  const lastActivityAtRef = useRef(0)
  const speechStartedAtRef = useRef(0)
  const vadSpeakingRef = useRef(false)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const pcmRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    handsFreeRef.current = handsFree
  }, [handsFree])

  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    historyRef.current = messages
  }, [messages])

  const clearCommitTimer = useCallback(() => {
    if (commitTimerRef.current !== null) {
      window.clearTimeout(commitTimerRef.current)
      commitTimerRef.current = null
    }
  }, [])

  const resetTurnBuffers = useCallback(() => {
    finalTranscriptRef.current = ''
    interimTranscriptRef.current = ''
    speechStartedAtRef.current = 0
    vadSpeakingRef.current = false
    setInterim('')
  }, [])

  const teardownAudio = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    pcmRef.current = null
    analyserRef.current = null
    if (audioContextRef.current) {
      void audioContextRef.current.close()
      audioContextRef.current = null
    }
  }, [])

  useEffect(() => {
    const refresh = () => setVoices(listVoices())
    refresh()
    window.speechSynthesis?.addEventListener('voiceschanged', refresh)
    return () => {
      window.speechSynthesis?.removeEventListener('voiceschanged', refresh)
      stopSpeech()
      recognitionRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    return () => {
      if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current)
      streamRef.current?.getTracks().forEach((track) => track.stop())
      if (audioContextRef.current) void audioContextRef.current.close()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const startListening = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition || busyRef.current) return
    try {
      recognition.lang = getLanguage(targetLanguage).speechLocale
      recognition.start()
      setStatus('listening')
      setError(null)
    } catch {
      // Chrome throws if start() is called while already started
    }
  }, [targetLanguage])

  const captionSpanish = useCallback(
    (id: string, text: string) => {
      if (targetLanguage !== 'es' || !text.trim()) return
      void translateSpanishToEnglish(text)
        .then((english) => {
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

  const speakReply = useCallback(
    (text: string) => {
      busyRef.current = true
      recognitionRef.current?.stop()
      setStatus('speaking')
      setMessages((current) =>
        current.map((item, index) => ({
          ...item,
          active: index === current.length - 1 && item.speaker === 'kea',
        })),
      )
      speakText(text, {
        lang: getLanguage(targetLanguage).speechLocale,
        rate,
        voiceURI: voiceURI || undefined,
        onend: () => {
          busyRef.current = false
          setMessages((current) =>
            current.map((item) => ({ ...item, active: false })),
          )
          if (handsFreeRef.current) {
            startListening()
          } else {
            setStatus('idle')
          }
        },
        onerror: () => {
          busyRef.current = false
          if (handsFreeRef.current) startListening()
          else setStatus('idle')
        },
      })
    },
    [rate, startListening, targetLanguage, voiceURI],
  )

  const sendToKea = useCallback(
    async (userText: string) => {
      busyRef.current = true
      clearCommitTimer()
      recognitionRef.current?.stop()
      resetTurnBuffers()
      setStatus('thinking')
      const userMessage: TranscriptMessage = {
        id: crypto.randomUUID(),
        speaker: 'user',
        text: userText,
      }
      setMessages((current) => [...current, userMessage])
      captionSpanish(userMessage.id, userText)
      try {
        const reply = await askKea({
          nativeLanguage: NATIVE_NAMES[nativeLanguage],
          targetLanguage: getLanguage(targetLanguage).name,
          level,
          history: historyRef.current,
          userText,
        })
        const keaMessage: TranscriptMessage = {
          id: crypto.randomUUID(),
          speaker: 'kea',
          text: reply,
          active: true,
        }
        setMessages((current) => [...current, keaMessage])
        captionSpanish(keaMessage.id, reply)
        speakReply(reply)
      } catch (caught) {
        busyRef.current = false
        setStatus('idle')
        setHandsFree(false)
        setError(caught instanceof Error ? caught.message : 'KEA could not reply')
      }
    },
    [
      captionSpanish,
      clearCommitTimer,
      level,
      nativeLanguage,
      resetTurnBuffers,
      speakReply,
      targetLanguage,
    ],
  )

  useEffect(() => {
    sendToKeaRef.current = sendToKea
  }, [sendToKea])

  const commitTurn = useCallback(() => {
    if (busyRef.current || statusRef.current !== 'listening') return
    if (vadSpeakingRef.current) return

    const text = [finalTranscriptRef.current, interimTranscriptRef.current]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!text) return

    const spokenFor = speechStartedAtRef.current
      ? performance.now() - speechStartedAtRef.current
      : MIN_SPEECH_MS
    if (spokenFor < MIN_SPEECH_MS) return

    const quietFor = performance.now() - lastActivityAtRef.current
    if (quietFor < SHORT_PAUSE_MS || quietFor < END_OF_TURN_SILENCE_MS) return

    void sendToKeaRef.current(text)
  }, [])

  const scheduleCommit = useCallback(() => {
    clearCommitTimer()
    commitTimerRef.current = window.setTimeout(() => {
      commitTimerRef.current = null
      if (vadSpeakingRef.current) {
        scheduleCommit()
        return
      }
      commitTurn()
    }, END_OF_TURN_SILENCE_MS)
  }, [clearCommitTimer, commitTurn])

  const noteSpeechActivity = useCallback(() => {
    if (busyRef.current || statusRef.current !== 'listening') return
    lastActivityAtRef.current = performance.now()
    if (!speechStartedAtRef.current) speechStartedAtRef.current = performance.now()
    scheduleCommit()
  }, [scheduleCommit])

  const watchMicLevel = useCallback(() => {
    const analyser = analyserRef.current
    const buffer = pcmRef.current
    if (!analyser || !buffer) return

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop)
      if (busyRef.current || statusRef.current !== 'listening') {
        vadSpeakingRef.current = false
        return
      }
      const speaking = micRms(analyser, buffer) >= SPEECH_RMS_THRESHOLD
      if (speaking) {
        vadSpeakingRef.current = true
        lastActivityAtRef.current = performance.now()
        if (!speechStartedAtRef.current) {
          speechStartedAtRef.current = performance.now()
        }
        clearCommitTimer()
        return
      }
      if (vadSpeakingRef.current) {
        vadSpeakingRef.current = false
        lastActivityAtRef.current = performance.now()
        scheduleCommit()
      }
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [clearCommitTimer, scheduleCommit])

  const attachRecognition = useCallback(() => {
    const recognition = getSpeechRecognition()
    if (!recognition) {
      setError('Speech recognition needs Chrome or Edge on this device.')
      return null
    }
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (event) => {
      if (busyRef.current) return
      let nextInterim = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const piece = event.results[index][0].transcript.trim()
        if (!piece) continue
        if (event.results[index].isFinal) {
          finalTranscriptRef.current = `${finalTranscriptRef.current} ${piece}`.trim()
        } else {
          nextInterim += `${piece} `
        }
      }
      interimTranscriptRef.current = nextInterim.trim()
      const display = [finalTranscriptRef.current, interimTranscriptRef.current]
        .filter(Boolean)
        .join(' ')
      setInterim(display)
      noteSpeechActivity()
    }
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError('Microphone permission is needed for KEA to listen.')
        setHandsFree(false)
        setStatus('idle')
        return
      }
      if (event.error === 'no-speech' || event.error === 'aborted') return
      setError('Listening was interrupted. Tap the microphone to try again.')
    }
    recognition.onend = () => {
      if (handsFreeRef.current && !busyRef.current && statusRef.current !== 'idle') {
        startListening()
      }
    }
    recognitionRef.current = recognition
    return recognition
  }, [noteSpeechActivity, startListening])

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      streamRef.current = stream
      const audioContext = new AudioContext()
      await audioContext.resume()
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 1024
      analyser.smoothingTimeConstant = 0.35
      audioContext.createMediaStreamSource(stream).connect(analyser)
      audioContextRef.current = audioContext
      analyserRef.current = analyser
      pcmRef.current = new Uint8Array(analyser.fftSize)
    } catch {
      setError('Microphone permission is needed for KEA to listen.')
      return
    }
    attachRecognition()
    setHandsFree(true)
    startListening()
    watchMicLevel()
  }, [attachRecognition, startListening, watchMicLevel])

  const stop = useCallback(() => {
    setHandsFree(false)
    busyRef.current = false
    clearCommitTimer()
    recognitionRef.current?.abort()
    stopSpeech()
    resetTurnBuffers()
    teardownAudio()
    setStatus('idle')
  }, [clearCommitTimer, resetTurnBuffers, teardownAudio])

  const toggle = useCallback(() => {
    if (handsFree || status !== 'idle') stop()
    else void start()
  }, [handsFree, start, status, stop])

  const liveMessages = interim
    ? [
        ...messages,
        {
          id: 'interim',
          speaker: 'user' as const,
          text: interim,
          interim: true,
        },
      ]
    : messages

  return {
    status,
    messages: liveMessages,
    error,
    voices,
    voiceURI,
    setVoiceURI,
    rate,
    setRate,
    handsFree,
    toggle,
    stop,
    pauseSpeech,
    resumeSpeech,
    stopSpeech,
  }
}
