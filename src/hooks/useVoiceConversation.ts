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
import { askKea } from '../services/keaChat'
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

interface UseVoiceConversationOptions {
  targetLanguage: LanguageCode
  nativeLanguage: NativeLanguageCode
  level: LearnerLevel
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

  useEffect(() => {
    handsFreeRef.current = handsFree
  }, [handsFree])

  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    historyRef.current = messages
  }, [messages])

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
      recognitionRef.current?.stop()
      setInterim('')
      setStatus('thinking')
      const userMessage: TranscriptMessage = {
        id: crypto.randomUUID(),
        speaker: 'user',
        text: userText,
      }
      setMessages((current) => [...current, userMessage])
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
        speakReply(reply)
      } catch (caught) {
        busyRef.current = false
        setStatus('idle')
        setHandsFree(false)
        setError(caught instanceof Error ? caught.message : 'KEA could not reply')
      }
    },
    [level, nativeLanguage, speakReply, targetLanguage],
  )

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
      let finalText = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const piece = event.results[index][0].transcript
        if (event.results[index].isFinal) finalText += piece
        else nextInterim += piece
      }
      if (nextInterim) setInterim(nextInterim)
      const trimmed = finalText.trim()
      if (trimmed) {
        void sendToKea(trimmed)
      }
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
  }, [sendToKea, startListening])

  const start = useCallback(async () => {
    setError(null)
    try {
      const permission = await navigator.mediaDevices.getUserMedia({ audio: true })
      permission.getTracks().forEach((track) => track.stop())
    } catch {
      setError('Microphone permission is needed for KEA to listen.')
      return
    }
    attachRecognition()
    setHandsFree(true)
    startListening()
  }, [attachRecognition, startListening])

  const stop = useCallback(() => {
    setHandsFree(false)
    busyRef.current = false
    recognitionRef.current?.abort()
    stopSpeech()
    setInterim('')
    setStatus('idle')
  }, [])

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
