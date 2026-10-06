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
    onCharIndex?: (charIndex: number) => void
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
  utterance.onboundary = (event) => {
    if (typeof event.charIndex === 'number') {
      options.onCharIndex?.(event.charIndex)
    }
  }
  utterance.onstart = () => options.onCharIndex?.(0)
  // Chrome pauses speechSynthesis mid-sentence and never resumes on its own.
  const keepAlive = window.setInterval(() => {
    const synth = window.speechSynthesis
    if (!synth || !synth.speaking) {
      window.clearInterval(keepAlive)
      return
    }
    if (synth.paused) synth.resume()
    else {
      synth.pause()
      synth.resume()
    }
  }, 8000)
  utterance.onend = () => {
    window.clearInterval(keepAlive)
    options.onCharIndex?.(text.length)
    options.onend?.()
  }
  utterance.onerror = (event) => {
    window.clearInterval(keepAlive)
    if (event.error === 'interrupted' || event.error === 'canceled') {
      options.onend?.()
      return
    }
    options.onerror?.()
  }
  window.speechSynthesis.speak(utterance)
}
