import { speakText, stopSpeech } from '../lib/speech'
import {
  getSpeakVoice,
  VOICE_SAMPLE,
  type ManagedVoice,
} from '../architecture/voiceCatalog'

let currentAudio: HTMLAudioElement | null = null

export function stopKeaSpeech() {
  stopSpeech()
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.src = ''
    currentAudio = null
  }
}

export async function speakManagedVoice(
  voice: ManagedVoice,
  text = VOICE_SAMPLE,
  options: { lang?: string; onend?: () => void; onerror?: () => void } = {},
) {
  stopKeaSpeech()
  if (voice.provider === 'openai' && voice.openaiVoice) {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice: voice.openaiVoice, text }),
      })
      if (!response.ok) {
        const data = (await response.json()) as { error?: string }
        throw new Error(data.error ?? 'Could not play that OpenAI voice.')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      currentAudio = audio
      audio.onended = () => {
        URL.revokeObjectURL(url)
        if (currentAudio === audio) currentAudio = null
        options.onend?.()
      }
      audio.onerror = () => {
        URL.revokeObjectURL(url)
        if (currentAudio === audio) currentAudio = null
        options.onerror?.()
      }
      await audio.play()
    } catch {
      options.onerror?.()
    }
    return
  }

  speakText(text, {
    lang: options.lang || voice.lang || 'en-GB',
    rate: 1,
    voiceURI: voice.voiceURI,
    onend: options.onend,
    onerror: options.onerror,
  })
}

export async function speakKeaLine(
  text: string,
  options: { lang?: string; onend?: () => void; onerror?: () => void } = {},
) {
  const voice = getSpeakVoice()
  if (!voice) {
    speakText(text, {
      lang: options.lang || 'en-GB',
      rate: 1,
      onend: options.onend,
      onerror: options.onerror,
    })
    return
  }
  await speakManagedVoice(voice, text, options)
}
