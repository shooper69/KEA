/**
 * Adaptive speech detection for noisy rooms.
 * Tracks a rolling noise floor and uses SNR so soft speech still registers
 * when ambient sound is loud. Short spikes (keyboard taps) are rejected.
 */

/** Absolute floor — ignore soft room hiss / HVAC as “speech”. */
export const SPEECH_RMS_FLOOR = 0.028
/** Cap so a loud room does not silence the user entirely. */
export const SPEECH_RMS_CAP = 0.058
/**
 * Continuous voiced energy required before an utterance is considered started.
 * Key clicks / taps are shorter than this and never latch listening.
 */
export const SPEECH_ONSET_MS = 380

export interface KeaSpeechVad {
  threshold: number
  noiseFloor: number
  /** Call each animation frame with current RMS. */
  observe: (rms: number, opts?: { calibrating?: boolean }) => void
  /** True when this frame looks like sustained speech (not a tap spike). */
  isSpeech: (rms: number, peak?: number) => boolean
  reset: () => void
}

export function createSpeechVad(initialFloor = SPEECH_RMS_FLOOR): KeaSpeechVad {
  let noiseFloor = initialFloor
  let threshold = Math.max(SPEECH_RMS_FLOOR, initialFloor * 1.9 + 0.01)
  let calibSum = 0
  let calibN = 0
  /** Smoothed level — rejects one-frame keyboard spikes. */
  let levelEma = initialFloor

  function adaptThreshold() {
    threshold = Math.max(
      SPEECH_RMS_FLOOR,
      Math.min(SPEECH_RMS_CAP, noiseFloor * 1.95 + 0.01),
    )
  }

  return {
    get threshold() {
      return threshold
    },
    get noiseFloor() {
      return noiseFloor
    },
    observe(rms, opts) {
      levelEma = levelEma * 0.72 + rms * 0.28
      if (opts?.calibrating) {
        calibSum += rms
        calibN += 1
        if (calibN >= 10) {
          // Bias the floor slightly above measured ambient so chatter stays out.
          noiseFloor = (calibSum / calibN) * 1.18
          adaptThreshold()
        }
        return
      }
      // Quiet frames gently pull the noise floor toward current ambient.
      if (rms < threshold * 0.85 && levelEma < threshold * 0.9) {
        noiseFloor = noiseFloor * 0.9 + rms * 0.1
        adaptThreshold()
      }
    },
    isSpeech(rms, peak = rms) {
      // Keyboard taps are a sharp peak with little sustained energy.
      if (peak > 0.16 && peak > rms * 4.8) return false
      // Instant spike alone is not enough — smoothed level must agree.
      const snrOk = rms > noiseFloor * 2.15 + 0.01
      const instant =
        rms > threshold || (snrOk && rms > SPEECH_RMS_FLOOR * 1.45)
      const sustained = levelEma > threshold * 0.92 && levelEma > noiseFloor * 1.7
      return instant && sustained
    },
    reset() {
      noiseFloor = initialFloor
      threshold = Math.max(SPEECH_RMS_FLOOR, initialFloor * 1.9 + 0.01)
      calibSum = 0
      calibN = 0
      levelEma = initialFloor
    },
  }
}

/**
 * Band-limit before RMS so rumble / HVAC and sharp keyboard clicks count
 * less as “speech energy” (voice lives roughly 140–3400 Hz here).
 */
export function connectSpeechAnalyser(
  context: AudioContext,
  stream: MediaStream,
): {
  source: MediaStreamAudioSourceNode
  analyser: AnalyserNode
  /** Energy above the voice band — keyboard clicks, not speech. */
  clickAnalyser: AnalyserNode
  highpass: BiquadFilterNode
  lowpass: BiquadFilterNode
} {
  const source = context.createMediaStreamSource(stream)
  const highpass = context.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = 180
  highpass.Q.value = 0.85
  const lowpass = context.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.value = 3000
  lowpass.Q.value = 0.7
  const clickHigh = context.createBiquadFilter()
  clickHigh.type = 'highpass'
  clickHigh.frequency.value = 4200
  clickHigh.Q.value = 0.7
  const analyser = context.createAnalyser()
  analyser.fftSize = 2048
  analyser.smoothingTimeConstant = 0.55
  const clickAnalyser = context.createAnalyser()
  clickAnalyser.fftSize = 1024
  clickAnalyser.smoothingTimeConstant = 0.2
  source.connect(highpass)
  highpass.connect(lowpass)
  lowpass.connect(analyser)
  source.connect(clickHigh)
  clickHigh.connect(clickAnalyser)
  return { source, analyser, clickAnalyser, highpass, lowpass }
}

/** True when this frame is a click/tap rather than voice. */
export function frameIsClick(voiceRms: number, clickRms: number) {
  return clickRms > 0.018 && clickRms > voiceRms * 1.05
}
