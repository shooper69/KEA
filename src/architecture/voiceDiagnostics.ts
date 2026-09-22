export interface VoiceDiagnostics {
  recognitionAvailable: boolean
  recognitionRunning: boolean
  recognitionLanguage: string
  lastTranscript: string
  lastConfidence: number
  lastRecognitionError: string
  lastAiResponse: string
  lastSpeechOutput: string
  updatedAt: string
}

const STORAGE_KEY = 'kea-voice-diagnostics'

const EMPTY: VoiceDiagnostics = {
  recognitionAvailable: false,
  recognitionRunning: false,
  recognitionLanguage: '',
  lastTranscript: '',
  lastConfidence: 0,
  lastRecognitionError: '',
  lastAiResponse: '',
  lastSpeechOutput: '',
  updatedAt: '',
}

let current: VoiceDiagnostics = readStored()
const listeners = new Set<(value: VoiceDiagnostics) => void>()

function readStored(): VoiceDiagnostics {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...EMPTY }
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<VoiceDiagnostics>) }
  } catch {
    return { ...EMPTY }
  }
}

function persist(next: VoiceDiagnostics) {
  current = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
  listeners.forEach((listen) => listen(next))
}

export function getVoiceDiagnostics(): VoiceDiagnostics {
  return current
}

export function patchVoiceDiagnostics(patch: Partial<VoiceDiagnostics>) {
  persist({
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  })
}

export function subscribeVoiceDiagnostics(
  listen: (value: VoiceDiagnostics) => void,
) {
  listeners.add(listen)
  listen(current)
  return () => {
    listeners.delete(listen)
  }
}
