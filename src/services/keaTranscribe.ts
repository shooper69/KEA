import { cleanSpokenText } from '../architecture/whisperText'

export interface WhisperTranscript {
  text: string
  confidence: number
  model: string
}

function blobToBase64(blob: Blob): Promise<string> {
  return blob.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer)
    const chunk = 0x2000
    let binary = ''
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
    }
    return btoa(binary)
  })
}

export async function transcribeWithWhisper(
  blob: Blob,
  options?: { prompt?: string; language?: string },
): Promise<WhisperTranscript> {
  const audio = await blobToBase64(blob)
  const rawType = (blob.type || 'audio/webm').toLowerCase()
  // OpenAI rejects codec suffixes like audio/webm;codecs=opus
  const mimeType = rawType.includes('mp4') || rawType.includes('m4a')
    ? 'audio/mp4'
    : rawType.includes('ogg') || rawType.includes('oga')
      ? 'audio/ogg'
      : rawType.includes('mpeg') || rawType.includes('mp3')
        ? 'audio/mpeg'
        : rawType.includes('wav')
          ? 'audio/wav'
          : 'audio/webm'
  const response = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audio,
      mimeType,
      prompt: options?.prompt,
      language: options?.language,
    }),
  })
  const data = (await response.json()) as WhisperTranscript & { error?: string }
  if (!response.ok) {
    throw new Error(data.error ?? 'Could not transcribe speech')
  }
  return {
    text: cleanSpokenText(data.text ?? ''),
    confidence: typeof data.confidence === 'number' ? data.confidence : 0,
    model: data.model || 'whisper-1',
  }
}
