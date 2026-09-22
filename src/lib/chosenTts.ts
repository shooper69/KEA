const STORAGE_KEY = 'kea-chosen-tts-voice'

export const TTS_SAMPLE =
  'Hello Simon, welcome to Kea. Today we are learning together.'

export interface ChosenTtsVoice {
  voiceURI: string
  name: string
  lang: string
  rate: number
  pitch: number
}

export function readChosenTts(): ChosenTtsVoice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ChosenTtsVoice>
    if (!parsed.voiceURI || !parsed.name || !parsed.lang) return null
    const rate = Number(parsed.rate)
    const pitch = Number(parsed.pitch)
    return {
      voiceURI: parsed.voiceURI,
      name: parsed.name,
      lang: parsed.lang,
      rate: Number.isFinite(rate) ? Math.min(2, Math.max(0.5, rate)) : 1,
      pitch: Number.isFinite(pitch) ? Math.min(2, Math.max(0.5, pitch)) : 1,
    }
  } catch {
    return null
  }
}

export function saveChosenTts(voice: ChosenTtsVoice) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(voice))
}

export function subscribeVoices(
  onVoices: (voices: SpeechSynthesisVoice[]) => void,
) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    onVoices([])
    return () => {}
  }
  const refresh = () => onVoices(window.speechSynthesis.getVoices())
  refresh()
  window.speechSynthesis.addEventListener('voiceschanged', refresh)
  return () => window.speechSynthesis.removeEventListener('voiceschanged', refresh)
}
