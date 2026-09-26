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
/** Paragraph speaker-icon replay — must not tear down the live chat session. */
let replayDepth = 0

export const KEA_REPLAY_START = 'kea-replay-start'
export const KEA_REPLAY_END = 'kea-replay-end'

function clearAudioProgress() {
  if (progressRaf) {
    cancelAnimationFrame(progressRaf)
    progressRaf = 0
  }
}

export function isKeaReplayActive() {
  return replayDepth > 0
}

function beginReplay() {
  replayDepth += 1
  if (replayDepth === 1) {
    window.dispatchEvent(new Event(KEA_REPLAY_START))
  }
}

function endReplay() {
  if (replayDepth <= 0) return
  replayDepth -= 1
  if (replayDepth === 0) {
    window.dispatchEvent(new Event(KEA_REPLAY_END))
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
  /** Optional pre-fetched OpenAI TTS object URL (from prefetchManagedVoiceAudio). */
  prefetchedUrl?: string | null
}

/** Fetch OpenAI TTS ahead of time so marketing paragraphs can chain tightly. */
export async function prefetchManagedVoiceAudio(
  voice: ManagedVoice,
  text: string,
): Promise<string | null> {
  if (voice.provider !== 'openai' || !voice.openaiVoice || !text.trim()) {
    return null
  }
  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voice: voice.openaiVoice, text }),
    })
    if (!response.ok) return null
    const blob = await response.blob()
    return URL.createObjectURL(blob)
  } catch {
    return null
  }
}

function playBlobUrl(
  url: string,
  text: string,
  gen: number,
  options: SpeakOptions,
  revoke: boolean,
) {
  const audio = new Audio(url)
  currentAudio = audio
  options.onCharIndex?.(0)
  audio.onplay = () => trackAudioProgress(audio, text, options.onCharIndex)
  audio.onended = () => {
    clearAudioProgress()
    options.onCharIndex?.(text.length)
    if (revoke) URL.revokeObjectURL(url)
    if (currentAudio === audio) currentAudio = null
    if (gen === speakGeneration) options.onend?.()
  }
  audio.onerror = () => {
    clearAudioProgress()
    if (revoke) URL.revokeObjectURL(url)
    if (currentAudio === audio) currentAudio = null
    if (gen === speakGeneration) options.onerror?.()
  }
  return audio.play()
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
      if (options.prefetchedUrl) {
        await playBlobUrl(options.prefetchedUrl, text, gen, options, true)
        if (gen !== speakGeneration) {
          // stopKeaSpeech already cleared currentAudio
        }
        return
      }
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
      if (gen !== speakGeneration) {
        URL.revokeObjectURL(url)
        return
      }
      await playBlobUrl(url, text, gen, options, true)
      if (gen !== speakGeneration) {
        // interrupted
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

/**
 * Replay a paragraph from the speaker icon. Keeps the chat session alive —
 * phones often fire visibility/freeze while TTS starts; those must not stop Kea.
 */
export async function speakKeaReplay(
  text: string,
  options: SpeakOptions = {},
) {
  const trimmed = text.trim()
  if (!trimmed) return
  // A new tap cancels the previous replay without waiting for its onend
  // (stopKeaSpeech bumps the generation so the old callbacks are skipped).
  if (replayDepth > 0) {
    replayDepth = 0
    window.dispatchEvent(new Event(KEA_REPLAY_END))
  }
  beginReplay()
  let settled = false
  let safety = 0
  const finish = (ok: boolean) => {
    if (settled) return
    settled = true
    window.clearTimeout(safety)
    endReplay()
    if (ok) options.onend?.()
    else options.onerror?.()
  }
  safety = window.setTimeout(
    () => finish(true),
    Math.min(22_000, 2_400 + trimmed.length * 90),
  )
  try {
    await speakKeaLine(trimmed, {
      lang: options.lang,
      onCharIndex: options.onCharIndex,
      onend: () => finish(true),
      onerror: () => finish(false),
    })
  } catch {
    finish(false)
  }
}
