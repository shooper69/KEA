import { speakText, stopSpeech } from '../lib/speech'
import {
  getSpeakVoice,
  VOICE_SAMPLE,
  type ManagedVoice,
} from '../architecture/voiceCatalog'

let currentAudio: HTMLAudioElement | null = null
let progressRaf = 0
/** Bumped on stop / new speak so late TTS blobs never play over a newer line. */
let speakGeneration = 0

function clearAudioProgress() {
  if (progressRaf) {
    cancelAnimationFrame(progressRaf)
    progressRaf = 0
  }
}

export function stopKeaSpeech() {
  speakGeneration += 1
  stopSpeech()
  clearAudioProgress()
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.src = ''
    currentAudio = null
  }
}

type SpeakOptions = {
  lang?: string
  onend?: () => void
  onerror?: () => void
  /** Character offset into `text` as speech progresses (for reveal-as-spoken). */
  onCharIndex?: (charIndex: number) => void
}

function trackAudioProgress(
  audio: HTMLAudioElement,
  text: string,
  onCharIndex?: (charIndex: number) => void,
) {
  if (!onCharIndex) return
  const tick = () => {
    if (!currentAudio || currentAudio !== audio) return
    const duration = audio.duration
    if (Number.isFinite(duration) && duration > 0) {
      const ratio = Math.min(1, Math.max(0, audio.currentTime / duration))
      onCharIndex(Math.floor(ratio * text.length))
    }
    if (!audio.paused && !audio.ended) {
      progressRaf = requestAnimationFrame(tick)
    }
  }
  clearAudioProgress()
  progressRaf = requestAnimationFrame(tick)
}

export async function speakManagedVoice(
  voice: ManagedVoice,
  text = VOICE_SAMPLE,
  options: SpeakOptions = {},
) {
  stopKeaSpeech()
  const gen = speakGeneration
  if (voice.provider === 'openai' && voice.openaiVoice) {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice: voice.openaiVoice, text }),
      })
      if (gen !== speakGeneration) return
      if (!response.ok) {
        const data = (await response.json()) as { error?: string }
        throw new Error(data.error ?? 'Could not play that OpenAI voice.')
      }
      const blob = await response.blob()
      if (gen !== speakGeneration) return
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      if (gen !== speakGeneration) {
        URL.revokeObjectURL(url)
        return
      }
      currentAudio = audio
      options.onCharIndex?.(0)
      audio.onplay = () => trackAudioProgress(audio, text, options.onCharIndex)
      audio.onended = () => {
        clearAudioProgress()
        options.onCharIndex?.(text.length)
        URL.revokeObjectURL(url)
        if (currentAudio === audio) currentAudio = null
        if (gen === speakGeneration) options.onend?.()
      }
      audio.onerror = () => {
        clearAudioProgress()
        URL.revokeObjectURL(url)
        if (currentAudio === audio) currentAudio = null
        if (gen === speakGeneration) options.onerror?.()
      }
      await audio.play()
      if (gen !== speakGeneration) {
        audio.pause()
        audio.src = ''
        if (currentAudio === audio) currentAudio = null
        URL.revokeObjectURL(url)
      }
    } catch {
      if (gen === speakGeneration) options.onerror?.()
    }
    return
  }

  if (gen !== speakGeneration) return
  speakText(text, {
    lang: options.lang || voice.lang || 'en-GB',
    rate: 1,
    voiceURI: voice.voiceURI,
    onend: options.onend,
    onerror: options.onerror,
    onCharIndex: options.onCharIndex,
  })
}

export async function speakKeaLine(
  text: string,
  options: SpeakOptions = {},
) {
  const voice = getSpeakVoice()
  if (!voice) {
    speakText(text, {
      lang: options.lang || 'en-GB',
      rate: 1,
      onend: options.onend,
      onerror: options.onerror,
      onCharIndex: options.onCharIndex,
    })
    return
  }
  await speakManagedVoice(voice, text, options)
}
