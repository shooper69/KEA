import { useCallback, useEffect, useRef, useState } from 'react'
import {
  applyLearnTurn,
  extractNativeIntrusions,
  getLearnList,
  rememberLearnGloss,
  splitKeaReply,
  touchChatTopic,
} from '../architecture/companionMemory'
import {
  TALK_CLEARED_EVENT,
  TALK_SCREEN_CLEARED_EVENT,
  clearTalkTranscript,
  appendTalkArchive,
  loadTalkScreen,
  saveTalkScreen,
  takeFreshChatScreen,
} from '../architecture/keaTalkMemory'
import { patchVoiceDiagnostics } from '../architecture/voiceDiagnostics'
import {
  DEFAULT_VOICE_CHARACTER,
  getVoicePersonality,
  migrateCharmMoodDefault,
} from '../config/voices'
import { openKeaMicrophone } from '../architecture/keaMicrophone'
import { withoutRejoinWelcomes } from '../architecture/keaStartSpeech'
import {
  connectSpeechAnalyser,
  createSpeechVad,
  SPEECH_RMS_FLOOR,
} from '../architecture/keaSpeechVad'
import {
  getLanguage,
  HOME_GREETING_ID,
} from '../config/languages'
import {
  listVoices,
  pauseSpeech,
  resumeSpeech,
} from '../lib/speech'
import { askKea, glossLearnWord, keaNameCue, translateSpanishToEnglish } from '../services/keaChat'
import { transcribeWithWhisper } from '../services/keaTranscribe'
import { speakKeaLine, stopKeaSpeech, isKeaReplayActive, KEA_REPLAY_START, KEA_REPLAY_END, prefetchManagedVoiceAudio } from '../services/keaSpeak'
import { getSpeakVoice } from '../architecture/voiceCatalog'
import { isUsableSpeechTranscript } from '../architecture/whisperText'
import { learnerProfilePrompt } from '../data/keaLearnerProfile'
import {
  DEFAULT_LISTEN_IDLE_SECONDS,
  MIN_LISTEN_IDLE_SECONDS,
} from '../data/keaListenIdle'
import { heardKeaStop, oneShotSpeechRecognition, speechRecognitionPings } from '../architecture/keaWakeWord'
import {
  isKeaUiHeld,
  KEA_UI_HOLD,
  KEA_UI_RELEASE,
} from '../architecture/keaUiHold'
import type {
  LanguageCode,
  LearnerLevel,
  NativeLanguageCode,
  TranscriptMessage,
  VoicePersonalityId,
  VoicePresenceState,
} from '../types'

const CHARACTER_KEY = 'kea-voice-character'
const RESTART_LISTEN_MS = 80
const MIN_SPEECH_MS = 420
const MAX_RECORD_MS = 22000
const AMBIENT_CALIBRATE_MS = 450
const DEFAULT_ANSWER_SILENCE_MS = 3000
/** If TTS never fires onend (common on mobile), unlock the turn anyway. */
const SPEAK_SAFETY_MS = 28_000

function readCharacter(): VoicePersonalityId {
  migrateCharmMoodDefault()
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
  listenIdleSeconds = DEFAULT_LISTEN_IDLE_SECONDS,
  answerAfterSilenceSeconds = 3,
}: UseVoiceConversationOptions) {
  const [status, setStatus] = useState<VoicePresenceState>('idle')
  const [messages, setMessages] = useState<TranscriptMessage[]>(() =>
    withoutRejoinWelcomes(loadTalkScreen()),
  )
  const [error, setError] = useState<string | null>(null)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [characterId, setCharacterId] = useState<VoicePersonalityId>(readCharacter)
  const [rate, setRate] = useState(() => getVoicePersonality(readCharacter()).rate)
  const [handsFree, setHandsFree] = useState(false)
  const [micLabel, setMicLabel] = useState('')

  const handsFreeRef = useRef(false)
  const speechVadRef = useRef(createSpeechVad(SPEECH_RMS_FLOOR))
  const busyRef = useRef(false)
  const historyRef = useRef<TranscriptMessage[]>([])
  const statusRef = useRef<VoicePresenceState>('idle')
  const sendToKeaRef = useRef<(text: string) => Promise<void>>(async () => {})
  const listenIdleTimerRef = useRef<number | null>(null)
  /** Hands-free live window ends at this time — refreshed on chat activity. */
  const pageLiveUntilRef = useRef(0)
  const lastActivityAtRef = useRef(0)
  const lastIdleArmAtRef = useRef(0)
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
  const startTalkRef = useRef<() => void>(() => {})
  const hardStopFromPhraseRef = useRef<() => void>(() => {})
  const watchStopWhileSpeakingRef = useRef<() => () => void>(() => () => {})
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
    saveTalkScreen(messages)
    appendTalkArchive(messages)
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

  const backgroundLiveRef = useRef(false)

  const releaseMicOnly = useCallback(() => {
    stoppingRecordRef.current = true
    clearRestartTimer()
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop()
      } catch {
        // ignore
      }
    }
    recorderRef.current = null
    chunksRef.current = []
    stopAnalyser(true)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    patchVoiceDiagnostics({ recognitionRunning: false })
  }, [clearRestartTimer, stopAnalyser])

  const suspendForBackground = useCallback(() => {
    saveTalkScreen(historyRef.current)
    appendTalkArchive(historyRef.current)
    if (isKeaReplayActive()) return
    stopKeaSpeech()
    backgroundLiveRef.current = handsFreeRef.current
    releaseMicOnly()
    if (handsFreeRef.current) setStatus('listening')
  }, [releaseMicOnly])

  const resumeAfterBackground = useCallback(() => {
    if (isKeaReplayActive()) return
    const wasLive = backgroundLiveRef.current || handsFreeRef.current
    backgroundLiveRef.current = false
    if (!wasLive) return
    if (pageLiveUntilRef.current && Date.now() >= pageLiveUntilRef.current) {
      handsFreeRef.current = false
      setHandsFree(false)
      setStatus('idle')
      return
    }
    handsFreeRef.current = false
    setHandsFree(false)
    fatalListenRef.current = false
    stoppingRecordRef.current = false
    busyRef.current = false
    window.setTimeout(() => {
      if (!fatalListenRef.current) startTalkRef.current()
    }, 80)
  }, [])

  const restoreTranscript = useCallback(() => {
    const stored = loadTalkScreen()
    setMessages((current) => {
      if (stored.length === 0) return current
      if (current.length > stored.length) {
        saveTalkScreen(current)
        appendTalkArchive(current)
        return current
      }
      historyRef.current = stored
      return stored
    })
  }, [])

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState !== 'visible') {
        suspendForBackground()
        return
      }
      restoreTranscript()
      resumeAfterBackground()
    }
    window.addEventListener('pagehide', suspendForBackground)
    document.addEventListener('freeze', suspendForBackground)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', suspendForBackground)
      document.removeEventListener('freeze', suspendForBackground)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [restoreTranscript, resumeAfterBackground, suspendForBackground])

  const softPauseMic = useCallback(() => {
    clearListenIdleTimer()
    clearRestartTimer()
    stoppingRecordRef.current = true
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop()
      } catch {
        // ignore
      }
    }
    recorderRef.current = null
    chunksRef.current = []
    stopAnalyser(false)
    setStatus('idle')
    patchVoiceDiagnostics({ recognitionRunning: false })
  }, [clearListenIdleTimer, clearRestartTimer, stopAnalyser])

  // Soft-pause the mic while a paragraph is replayed so TTS does not kill tracks.
  useEffect(() => {
    let wasListening = false
    function onReplayStart() {
      wasListening =
        handsFreeRef.current &&
        (statusRef.current === 'listening' || Boolean(streamRef.current))
      if (!wasListening) return
      softPauseMic()
    }
    function onReplayEnd() {
      if (!wasListening || !handsFreeRef.current || fatalListenRef.current) return
      wasListening = false
      if (isKeaUiHeld()) return
      window.setTimeout(() => {
        if (
          handsFreeRef.current &&
          !busyRef.current &&
          !fatalListenRef.current &&
          !isKeaUiHeld()
        ) {
          startListeningRef.current()
        }
      }, 180)
    }
    window.addEventListener(KEA_REPLAY_START, onReplayStart)
    window.addEventListener(KEA_REPLAY_END, onReplayEnd)
    return () => {
      window.removeEventListener(KEA_REPLAY_START, onReplayStart)
      window.removeEventListener(KEA_REPLAY_END, onReplayEnd)
    }
  }, [softPauseMic])

  // Soft-pause while chat chrome is open; resume when the user is back on talk.
  useEffect(() => {
    function onUiHold() {
      if (
        handsFreeRef.current &&
        statusRef.current === 'listening'
      ) {
        softPauseMic()
      }
    }
    function onUiRelease() {
      if (!handsFreeRef.current || fatalListenRef.current || busyRef.current) return
      if (isKeaReplayActive()) return
      if (pageLiveUntilRef.current && Date.now() >= pageLiveUntilRef.current) {
        handsFreeRef.current = false
        setHandsFree(false)
        setStatus('idle')
        return
      }
      if (statusRef.current === 'listening') return
      window.setTimeout(() => {
        if (
          !handsFreeRef.current ||
          busyRef.current ||
          fatalListenRef.current ||
          isKeaUiHeld() ||
          isKeaReplayActive()
        ) {
          return
        }
        if (streamRef.current) {
          startListeningRef.current()
          return
        }
        // Mic stream was dropped while the menu was open — reopen it.
        startTalkRef.current()
      }, 120)
    }
    if (isKeaUiHeld()) onUiHold()
    window.addEventListener(KEA_UI_HOLD, onUiHold)
    window.addEventListener(KEA_UI_RELEASE, onUiRelease)
    return () => {
      window.removeEventListener(KEA_UI_HOLD, onUiHold)
      window.removeEventListener(KEA_UI_RELEASE, onUiRelease)
    }
  }, [softPauseMic])
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
    pageLiveUntilRef.current = 0
    stoppingRecordRef.current = true
    busyRef.current = false
    fatalListenRef.current = false
    teardownAudio()
    setStatus('idle')
    patchVoiceDiagnostics({ recognitionRunning: false })
  }, [clearListenIdleTimer, clearRestartTimer, teardownAudio])

  /**
   * Keep Kea live for listenIdleSeconds from the latest chat activity.
   * Opening chat / start() arms it; each real turn refreshes it so an active
   * conversation does not die mid-session.
   */
  const armListenIdle = useCallback((force = false) => {
    const now = Date.now()
    // Speech VAD arms this every frame — throttle refreshes.
    if (!force && now - lastIdleArmAtRef.current < 1000) {
      pageLiveUntilRef.current = Math.max(
        pageLiveUntilRef.current,
        now +
          Math.max(MIN_LISTEN_IDLE_SECONDS, listenIdleSeconds || DEFAULT_LISTEN_IDLE_SECONDS) *
            1000,
      )
      return
    }
    lastIdleArmAtRef.current = now
    clearListenIdleTimer()
    const idleMs =
      Math.max(MIN_LISTEN_IDLE_SECONDS, listenIdleSeconds || DEFAULT_LISTEN_IDLE_SECONDS) *
      1000
    pageLiveUntilRef.current = now + idleMs
    lastActivityAtRef.current = now
    window.dispatchEvent(new Event('kea-user-activity'))

    const finishIfDue = () => {
      listenIdleTimerRef.current = null
      if (busyRef.current || isKeaUiHeld() || isKeaReplayActive()) {
        listenIdleTimerRef.current = window.setTimeout(finishIfDue, 500)
        return
      }
      if (statusRef.current !== 'listening' && !handsFreeRef.current) return
      // Still mid-utterance — wait for silence, then stop.
      if (
        statusRef.current === 'listening' &&
        speechMsRef.current > MIN_SPEECH_MS &&
        silenceMsRef.current < answerSilenceMsRef.current
      ) {
        listenIdleTimerRef.current = window.setTimeout(finishIfDue, 400)
        return
      }
      if (Date.now() < pageLiveUntilRef.current) {
        const left = pageLiveUntilRef.current - Date.now()
        listenIdleTimerRef.current = window.setTimeout(finishIfDue, Math.max(250, left))
        return
      }
      pauseListening()
    }
    listenIdleTimerRef.current = window.setTimeout(finishIfDue, idleMs)
  }, [clearListenIdleTimer, listenIdleSeconds, pauseListening])

  /** Fresh live window when the chat page / talk session activates. */
  const activateLiveWindow = useCallback(() => {
    armListenIdle(true)
  }, [armListenIdle])

  const captionSpanish = useCallback(
    (id: string, text: string) => {
      if (targetLanguage !== 'es' || !text.trim()) return
      // One translate call for the whole turn — faster and captions stay aligned.
      void translateSpanishToEnglish(text)
        .then((english) => {
          if (!english.trim()) return
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
      if (heardKeaStop(result.text)) {
        hardStopFromPhraseRef.current()
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
    if (busyRef.current || fatalListenRef.current || isKeaUiHeld()) return
    const stream = streamRef.current
    if (!stream) return
    try {
      // Rapid quiz turns can restart listen while a prior recorder is still live.
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        stoppingRecordRef.current = true
        try {
          recorderRef.current.stop()
        } catch {
          // ignore
        }
        recorderRef.current = null
      }
      stopAnalyser(false)
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
      const linked = connectSpeechAnalyser(context, stream)
      sourceRef.current = linked.source
      analyserRef.current = linked.analyser
      const analyser = linked.analyser
      const samples = new Uint8Array(analyser.fftSize)
      let last = performance.now()
      const ambientUntil = performance.now() + AMBIENT_CALIBRATE_MS
      const vad = createSpeechVad(SPEECH_RMS_FLOOR)
      speechVadRef.current = vad
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
        const calibrating = now < ambientUntil && speechMsRef.current === 0
        vad.observe(rms, { calibrating })
        if (vad.isSpeech(rms)) {
          speechMsRef.current += delta
          silenceMsRef.current = 0
          armListenIdle()
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
      lastActivityAtRef.current = Date.now()
      armListenIdle(true)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught)
      logSpeech('error', message)
      patchVoiceDiagnostics({ recognitionRunning: false, lastRecognitionError: message })
      setError('Microphone recording could not start.')
      busyRef.current = false
      // Keep the quiz / hands-free loop alive after a transient recorder failure.
      if (handsFreeRef.current && !fatalListenRef.current) {
        window.setTimeout(() => startListeningRef.current(), 400)
      }
    }
  }, [armListenIdle, processRecording, stopAnalyser])

  useEffect(() => {
    startListeningRef.current = startListening
  }, [startListening])

  const speakReply = useCallback(
    (
      text: string,
      afterSpeech?: () => void,
      speechOpts?: {
        prefetchedUrl?: string | null
        prefetchPromise?: Promise<string | null> | null
      },
    ) => {
      const spoken = text.trim()
      if (!spoken) {
        busyRef.current = false
        sendingRef.current = false
        if (handsFreeRef.current) {
          window.setTimeout(() => startListeningRef.current(), RESTART_LISTEN_MS)
        } else {
          setStatus('idle')
        }
        return
      }
      busyRef.current = true
      setStatus('speaking')
      setMessages((current) =>
        current.map((item, index) => ({
          ...item,
          active: index === current.length - 1 && item.speaker === 'kea',
        })),
      )
      patchVoiceDiagnostics({ lastSpeechOutput: spoken, recognitionRunning: false })
      logSpeech('speaking')
      const cancelStopWatch = handsFreeRef.current
        ? watchStopWhileSpeakingRef.current()
        : () => {}
      let settled = false
      let safety = 0
      const finish = () => {
        if (settled) return
        settled = true
        window.clearTimeout(safety)
        cancelStopWatch()
        busyRef.current = false
        sendingRef.current = false
        setMessages((current) =>
          current.map((item) => ({ ...item, active: false })),
        )
        if (afterSpeech) {
          afterSpeech()
          return
        }
        // Speaker-icon replay interrupted this line — stay live, don't grab the mic yet.
        if (isKeaReplayActive() || isKeaUiHeld()) {
          setStatus('idle')
          return
        }
        if (handsFreeRef.current) {
          logSpeech('listening again')
          window.setTimeout(() => startListeningRef.current(), RESTART_LISTEN_MS)
        } else {
          setStatus('idle')
        }
      }
      safety = window.setTimeout(
        () => {
          logSpeech('speak safety unlock')
          // Cut any leftover TTS so the mic does not hear Kea as the next answer.
          try {
            stopKeaSpeech()
          } catch {
            // ignore
          }
          finish()
        },
        Math.min(SPEAK_SAFETY_MS, Math.max(5_500, 3_200 + spoken.length * 90)),
      )
      void speakKeaLine(spoken, {
        lang: getLanguage(targetLanguage).speechLocale,
        onend: finish,
        onerror: finish,
        prefetchedUrl: speechOpts?.prefetchedUrl,
        prefetchPromise: speechOpts?.prefetchPromise,
      })
    },
    [targetLanguage],
  )

  const sendToKea = useCallback(
    async (userText: string, options?: { written?: boolean }) => {
      if (sendingRef.current) return
      const written = Boolean(options?.written)
      sendingRef.current = true
      busyRef.current = true
      armListenIdle(true)
      setStatus('thinking')
      const userHighlights = extractNativeIntrusions(userText)
      const userMessage: TranscriptMessage = {
        id: crypto.randomUUID(),
        speaker: 'user',
        text: userText,
        highlights: userHighlights.length ? userHighlights : undefined,
      }
      historyRef.current = [...historyRef.current, userMessage]
      setMessages((current) => [...current, userMessage])
      captionSpanish(userMessage.id, userText)
      try {
        logAi('request', userText)
        const raw = await askKea({
          nativeLanguage: getLanguage(nativeLanguage).name,
          targetLanguage: getLanguage(targetLanguage).name,
          level,
          history: historyRef.current,
          userText,
          learnerProfile: learnerProfilePrompt(),
          learnerName: keaNameCue(firstName, historyRef.current),
        })
        const { reply, signals } = splitKeaReply(raw)
        logAi('response', reply)
        const spoken = reply.trim()
        if (!spoken) {
          busyRef.current = false
          sendingRef.current = false
          if (handsFreeRef.current) startListeningRef.current()
          else setStatus('idle')
          return
        }
        const fromModel = (signals?.add ?? [])
          .map((item) => item.term)
          .filter((term) => term && userText.toLowerCase().includes(term.toLowerCase()))
        const mergedHighlights = [...new Set([...userHighlights, ...fromModel])]
        if (mergedHighlights.length) {
          setMessages((current) =>
            current.map((item) =>
              item.id === userMessage.id
                ? { ...item, highlights: mergedHighlights }
                : item,
            ),
          )
        }
        const keaMessage: TranscriptMessage = {
          id: crypto.randomUUID(),
          speaker: 'kea',
          text: spoken,
          active: true,
          highlights: extractNativeIntrusions(spoken),
        }
        // Show + speak first so the turn feels instant; memory work trails behind.
        historyRef.current = [...historyRef.current, keaMessage]
        setMessages((current) => [...current, keaMessage])
        captionSpanish(keaMessage.id, spoken)
        const managed = getSpeakVoice()
        const prefetchPromise =
          managed && managed.provider === 'openai'
            ? prefetchManagedVoiceAudio(managed, spoken)
            : null
        if (written) {
          handsFreeRef.current = false
          setHandsFree(false)
        }
        speakReply(spoken, undefined, { prefetchPromise })
        patchVoiceDiagnostics({ lastAiResponse: spoken, lastTranscript: userText })

        window.setTimeout(() => {
          try {
            applyLearnTurn({
              languageCode: targetLanguage,
              userText,
              keaReply: spoken,
              signals,
            })
            touchChatTopic(userText, spoken)
            const targetName = getLanguage(targetLanguage).name
            const needsGloss = getLearnList()
              .filter(
                (item) =>
                  item.languageCode === targetLanguage && !item.translation.trim(),
              )
              .slice(0, 2)
            for (const item of needsGloss) {
              void glossLearnWord(item.term, targetName)
                .then((translation) => rememberLearnGloss(item.id, translation))
                .catch(() => {
                  // The word stays on the list until a gloss arrives.
                })
            }
          } catch {
            // Learn-list work must never freeze the spoken turn.
          }
        }, 0)
      } catch (caught) {
        busyRef.current = false
        sendingRef.current = false
        // Stay hands-free after a failed reply so Kea keeps listening.
        setError(caught instanceof Error ? caught.message : 'Kea could not reply')
        if (handsFreeRef.current) {
          window.setTimeout(() => startListeningRef.current(), RESTART_LISTEN_MS)
        } else {
          setStatus('idle')
        }
      }
    },
    [
      armListenIdle,
      captionSpanish,
      level,
      firstName,
      nativeLanguage,
      speakReply,
      targetLanguage,
    ],
  )

  useEffect(() => {
    sendToKeaRef.current = sendToKea
  }, [sendToKea])

  const startingRef = useRef(false)
  const [starting, setStarting] = useState(false)
  const listenWhenMicReadyRef = useRef(false)
  const stopWatchGen = useRef(0)

  const hardStopFromPhrase = useCallback(() => {
    logSpeech('stop phrase')
    stopWatchGen.current += 1
    busyRef.current = false
    sendingRef.current = false
    fatalListenRef.current = true
    handsFreeRef.current = false
    setHandsFree(false)
    startingRef.current = false
    setStarting(false)
    clearListenIdleTimer()
    clearRestartTimer()
    stoppingRecordRef.current = true
    teardownAudio()
    stopKeaSpeech()
    setStatus('idle')
    setMicLabel('')
    patchVoiceDiagnostics({ recognitionRunning: false })
  }, [clearListenIdleTimer, clearRestartTimer, teardownAudio])

  /** While Kea is talking, listen for “Stop Kea” — desktop only (phones ping). */
  const watchStopWhileSpeaking = useCallback(() => {
    if (speechRecognitionPings()) {
      return () => {}
    }
    const gen = ++stopWatchGen.current
    const tick = async () => {
      while (
        stopWatchGen.current === gen &&
        handsFreeRef.current &&
        !fatalListenRef.current
      ) {
        try {
          const said = await oneShotSpeechRecognition(2200, heardKeaStop)
          if (stopWatchGen.current !== gen) return
          if (said && heardKeaStop(said)) {
            hardStopFromPhrase()
            return
          }
        } catch {
          // Engine busy / denied — brief pause then retry while still speaking.
        }
        if (stopWatchGen.current !== gen) return
        if (statusRef.current !== 'speaking') return
        await new Promise((resolve) => window.setTimeout(resolve, 280))
      }
    }
    void tick()
    return () => {
      if (stopWatchGen.current === gen) stopWatchGen.current += 1
    }
  }, [hardStopFromPhrase])

  useEffect(() => {
    hardStopFromPhraseRef.current = hardStopFromPhrase
    watchStopWhileSpeakingRef.current = watchStopWhileSpeaking
  }, [hardStopFromPhrase, watchStopWhileSpeaking])

  const start = useCallback(async (
    greeting?: string,
    englishCaption?: string,
    kind?: 'welcome' | 'welcome-back',
    speechOpts?: {
      prefetchedUrl?: string | null
      prefetchPromise?: Promise<string | null> | null
      /** When false, speak the greeting only — do not open the mic. */
      listenAfter?: boolean
      /** Show the line without speaking (typing mode). */
      silent?: boolean
    },
  ) => {
    if (startingRef.current || handsFreeRef.current) return
    startingRef.current = true
    setStarting(true)
    listenWhenMicReadyRef.current = false
    setError(null)
    fatalListenRef.current = false
    const listenAfter = speechOpts?.listenAfter !== false
    const hasGreeting = Boolean(greeting?.trim())

    if (!listenAfter) {
      if (hasGreeting) {
        const text = greeting!.trim()
        const english = englishCaption?.trim() || undefined
        const isWelcome = kind === 'welcome'
        const freshScreen = takeFreshChatScreen()
        const keaMessage: TranscriptMessage = {
          id: isWelcome ? HOME_GREETING_ID : crypto.randomUUID(),
          speaker: 'kea',
          text,
          english:
            kind === 'welcome-back'
              ? targetLanguage === 'en'
                ? undefined
                : english
              : english,
          active: true,
        }
        setMessages((current) => {
          const base =
            freshScreen || isWelcome
              ? []
              : kind === 'welcome-back'
                ? withoutRejoinWelcomes(current)
                : current
          const next =
            freshScreen || isWelcome
              ? [keaMessage]
              : [...base, keaMessage]
          historyRef.current = next
          return next
        })
        if (speechOpts?.silent) {
          setStatus('idle')
        } else {
          speakReply(text, () => setStatus('idle'), speechOpts)
        }
      }
      startingRef.current = false
      setStarting(false)
      return
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      startingRef.current = false
      setStarting(false)
      setError('This browser cannot record the microphone for Whisper.')
      patchVoiceDiagnostics({ recognitionAvailable: false })
      return
    }
    // Drop the wake-word recognizer before opening Whisper's mic.
    handsFreeRef.current = true
    setHandsFree(true)
    activateLiveWindow()

    if (hasGreeting) {
      const text = greeting!.trim()
      const english = englishCaption?.trim() || undefined
      const isWelcome = kind === 'welcome'
      const freshScreen = takeFreshChatScreen()
      const keaMessage: TranscriptMessage = {
        id: isWelcome ? HOME_GREETING_ID : crypto.randomUUID(),
        speaker: 'kea',
        text,
        english:
          kind === 'welcome-back'
            ? targetLanguage === 'en'
              ? undefined
              : english
            : english,
        active: true,
      }
      setMessages((current) => {
        const base =
          freshScreen || isWelcome
            ? []
            : kind === 'welcome-back'
              ? withoutRejoinWelcomes(current)
              : current
        const next =
          freshScreen || isWelcome
            ? [keaMessage]
            : [...base, keaMessage]
        historyRef.current = next
        return next
      })
      // Canned welcome / welcome-back: speak immediately (prefetch when ready).
      speakReply(
        text,
        () => {
          if (!handsFreeRef.current) {
            setStatus('idle')
            return
          }
          if (isKeaUiHeld() || isKeaReplayActive()) {
            setStatus('idle')
            return
          }
          if (streamRef.current) {
            logSpeech('listening again')
            window.setTimeout(() => startListeningRef.current(), RESTART_LISTEN_MS)
            return
          }
          listenWhenMicReadyRef.current = true
        },
        speechOpts,
      )
    }

    try {
      // Brief settle so wake-word can release its tracks.
      await new Promise((resolve) => window.setTimeout(resolve, 40))
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
      if (!hasGreeting || listenWhenMicReadyRef.current) {
        listenWhenMicReadyRef.current = false
        if (!isKeaUiHeld()) startListening()
      }
    } catch {
      listenWhenMicReadyRef.current = false
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
      setStarting(false)
    }
  }, [activateLiveWindow, speakReply, startListening, targetLanguage])

  useEffect(() => {
    startTalkRef.current = () => {
      void start()
    }
  }, [start])

  const stop = useCallback(() => {
    stopWatchGen.current += 1
    startingRef.current = false
    setStarting(false)
    fatalListenRef.current = true
    handsFreeRef.current = false
    setHandsFree(false)
    setMicLabel('')
    busyRef.current = false
    sendingRef.current = false
    stoppingRecordRef.current = true
    pageLiveUntilRef.current = 0
    clearListenIdleTimer()
    clearRestartTimer()
    stopKeaSpeech()
    teardownAudio()
    setStatus('idle')
    patchVoiceDiagnostics({ recognitionRunning: false })
  }, [clearListenIdleTimer, clearRestartTimer, teardownAudio])

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
    function onScreenCleared() {
      historyRef.current = []
      setMessages([])
    }
    window.addEventListener(TALK_CLEARED_EVENT, onTalkCleared)
    window.addEventListener(TALK_SCREEN_CLEARED_EVENT, onScreenCleared)
    return () => {
      window.removeEventListener(TALK_CLEARED_EVENT, onTalkCleared)
      window.removeEventListener(TALK_SCREEN_CLEARED_EVENT, onScreenCleared)
    }
  }, [stop])

  const toggle = useCallback(() => {
    // Always allow stop, even mid-start, so the Kea button never feels dead.
    if (startingRef.current || handsFreeRef.current || status !== 'idle') {
      stop()
      return
    }
    void start()
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
    starting,
    micLabel,
    toggle,
    start,
    stop,
    /** Reset the 10-minute live window from chat-page entry (not from speech). */
    activateLiveWindow,
    sendText: (text: string) => sendToKea(text, { written: true }),
    clearMessages,
    pauseSpeech,
    resumeSpeech,
    stopSpeech: stopKeaSpeech,
  }
}
