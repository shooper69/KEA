import { speakText, stopSpeech } from '../lib/speech'
import {
  getSpeakVoice,
  VOICE_SAMPLE,
  type ManagedVoice,
} from '../architecture/voiceCatalog'
import { keaAuthHeaders } from './keaAuthHeaders'

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
  /** In-flight prefetch — awaited before play so canned lines can start fetch earlier. */
  prefetchPromise?: Promise<string | null> | null
  /** Extra gpt-4o-mini-tts instructions merged with the default Kea style. */
  ttsInstructions?: string
}

const TTS_CACHE = 'kea-tts-v2'
const TTS_STYLE_REV = 'soft-charm-v5'
const ttsBlobs = new Map<string, Blob>()
const ttsInflight = new Map<string, Promise<Blob | null>>()

function ttsCacheKey(voice: ManagedVoice, text: string, instructions = '') {
  return `${TTS_STYLE_REV}:${voice.id}:${voice.openaiVoice ?? ''}:${instructions}:${text.trim()}`
}

function ttsCacheRequest(key: string) {
  return new Request(`https://kea.local/tts/${encodeURIComponent(key)}`)
}

async function readCachedTts(key: string): Promise<Blob | null> {
  const memory = ttsBlobs.get(key)
  if (memory) return memory
  if (!('caches' in window)) return null
  try {
    const cache = await caches.open(TTS_CACHE)
    const hit = await cache.match(ttsCacheRequest(key))
    if (!hit) return null
    const blob = await hit.blob()
    if (blob.size < 32) return null
    ttsBlobs.set(key, blob)
    return blob
  } catch {
    return null
  }
}

async function storeCachedTts(key: string, blob: Blob) {
  ttsBlobs.set(key, blob)
  if (!('caches' in window)) return
  try {
    const cache = await caches.open(TTS_CACHE)
    await cache.put(
      ttsCacheRequest(key),
      new Response(blob, { headers: { 'Content-Type': blob.type || 'audio/mpeg' } }),
    )
  } catch {
    // Private mode or a full disk. The memory copy is enough for this visit.
  }
}

async function loadManagedVoiceAudio(
  voice: ManagedVoice,
  text: string,
  ttsInstructions?: string,
): Promise<Blob | null> {
  const spoken = text.trim()
  if (voice.provider !== 'openai' || !voice.openaiVoice || !spoken) return null
  const hint = ttsInstructions?.trim() ?? ''
  const key = ttsCacheKey(voice, spoken, hint)
  const cached = await readCachedTts(key)
  if (cached) return cached
  const pending = ttsInflight.get(key)
  if (pending) return pending
  const request = (async () => {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: await keaAuthHeaders(),
        body: JSON.stringify({
          voice: voice.openaiVoice,
          text: spoken,
          ...(hint ? { instructions: hint } : {}),
        }),
      })
      if (!response.ok) return null
      const blob = await response.blob()
      if (blob.size < 32) return null
      void storeCachedTts(key, blob)
      return blob
    } catch {
      return null
    } finally {
      ttsInflight.delete(key)
    }
  })()
  ttsInflight.set(key, request)
  return request
}

/** Fetch OpenAI TTS ahead of time. The same line is reused from cache. */
export async function prefetchManagedVoiceAudio(
  voice: ManagedVoice,
  text: string,
  ttsInstructions?: string,
): Promise<string | null> {
  const blob = await loadManagedVoiceAudio(voice, text, ttsInstructions)
  if (!blob) return null
  return URL.createObjectURL(blob)
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
    // Brief tail so the last syllable is not cut by mic restart / UI unlock.
    window.setTimeout(() => {
      if (gen === speakGeneration) options.onend?.()
    }, 320)
  }
  audio.onerror = () => {
    clearAudioProgress()
    if (revoke) URL.revokeObjectURL(url)
    if (currentAudio === audio) currentAudio = null
    if (gen === speakGeneration) options.onerror?.()
  }
  audio.onpause = () => {
    // stopKeaSpeech() pauses without ending — still unblock awaiters.
    if (gen !== speakGeneration) {
      clearAudioProgress()
      if (revoke) URL.revokeObjectURL(url)
      if (currentAudio === audio) currentAudio = null
      options.onend?.()
    }
  }
  return audio.play().catch(() => {
    clearAudioProgress()
    if (revoke) URL.revokeObjectURL(url)
    if (currentAudio === audio) currentAudio = null
    if (gen === speakGeneration) options.onerror?.()
  })
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
  const bail = () => {
    if (gen === speakGeneration) options.onerror?.()
  }
  if (voice.provider === 'openai' && voice.openaiVoice) {
    try {
      if (options.prefetchedUrl) {
        await playBlobUrl(options.prefetchedUrl, text, gen, options, true)
        return
      }
      const blob = await Promise.race([
        loadManagedVoiceAudio(voice, text, options.ttsInstructions),
        new Promise<Blob | null>((resolve) => {
          window.setTimeout(() => resolve(null), 16_000)
        }),
      ])
      if (gen !== speakGeneration) {
        // stopKeaSpeech cancelled this line — treat as finished so callers unblock.
        options.onend?.()
        return
      }
      if (!blob) {
        bail()
        return
      }
      const url = URL.createObjectURL(blob)
      if (gen !== speakGeneration) {
        URL.revokeObjectURL(url)
        options.onend?.()
        return
      }
      await playBlobUrl(url, text, gen, options, true)
    } catch {
      bail()
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
  let prefetchedUrl = options.prefetchedUrl ?? null
  if (!prefetchedUrl && options.prefetchPromise) {
    try {
      prefetchedUrl = await options.prefetchPromise
    } catch {
      prefetchedUrl = null
    }
  }
  await speakManagedVoice(voice, text, { ...options, prefetchedUrl })
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
