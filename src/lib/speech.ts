export function listVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return []
  return window.speechSynthesis.getVoices()
}

export function stopSpeech() {
  window.speechSynthesis?.cancel()
}

export function pauseSpeech() {
  window.speechSynthesis?.pause()
}

export function resumeSpeech() {
  window.speechSynthesis?.resume()
}

export function speakText(
  text: string,
  options: {
    lang: string
    rate: number
    pitch?: number
    voiceURI?: string
    onend?: () => void
    onerror?: () => void
  },
) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    options.onerror?.()
    return
  }

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = options.lang
  utterance.rate = options.rate
  utterance.pitch = options.pitch ?? 1
  const voice = options.voiceURI
    ? window.speechSynthesis.getVoices().find((item) => item.voiceURI === options.voiceURI)
    : window.speechSynthesis
        .getVoices()
        .find((item) => item.lang.startsWith(options.lang.slice(0, 2)))
  if (voice) utterance.voice = voice
  utterance.onend = () => options.onend?.()
  utterance.onerror = (event) => {
    if (event.error === 'interrupted' || event.error === 'canceled') {
      options.onend?.()
      return
    }
    options.onerror?.()
  }
  window.speechSynthesis.speak(utterance)
}
