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

export async function transcribeWithWhisper(blob: Blob): Promise<WhisperTranscript> {
  const audio = await blobToBase64(blob)
  const response = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audio,
      mimeType: blob.type || 'audio/webm',
    }),
  })
  const data = (await response.json()) as WhisperTranscript & { error?: string }
  if (!response.ok) {
    throw new Error(data.error ?? 'Could not transcribe speech')
  }
  return {
    text: data.text?.trim() ?? '',
    confidence: typeof data.confidence === 'number' ? data.confidence : 0,
    model: data.model || 'whisper-1',
  }
}
