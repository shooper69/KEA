/**
 * Adaptive speech detection for noisy rooms.
 * Tracks a rolling noise floor and uses SNR so soft speech still registers
 * when ambient sound is loud.
 */

/** Absolute floor — ignore soft room hiss / HVAC as “speech”. */
export const SPEECH_RMS_FLOOR = 0.02
/** Cap so a loud room does not silence the user entirely. */
export const SPEECH_RMS_CAP = 0.055

export interface KeaSpeechVad {
  threshold: number
  noiseFloor: number
  /** Call each animation frame with current RMS. */
  observe: (rms: number, opts?: { calibrating?: boolean }) => void
  /** True when this frame looks like speech. */
  isSpeech: (rms: number) => boolean
  reset: () => void
}

export function createSpeechVad(initialFloor = SPEECH_RMS_FLOOR): KeaSpeechVad {
  let noiseFloor = initialFloor
  let threshold = Math.max(SPEECH_RMS_FLOOR, initialFloor * 1.85 + 0.008)
  let calibSum = 0
  let calibN = 0

  function adaptThreshold() {
    threshold = Math.max(
      SPEECH_RMS_FLOOR,
      Math.min(SPEECH_RMS_CAP, noiseFloor * 1.85 + 0.008),
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
      if (opts?.calibrating) {
        calibSum += rms
        calibN += 1
        if (calibN >= 8) {
          // Bias the floor slightly above measured ambient so chatter stays out.
          noiseFloor = (calibSum / calibN) * 1.12
          adaptThreshold()
        }
        return
      }
      // Quiet frames gently pull the noise floor toward current ambient.
      if (rms < threshold * 0.88) {
        noiseFloor = noiseFloor * 0.9 + rms * 0.1
        adaptThreshold()
      }
    },
    isSpeech(rms) {
      const snrOk = rms > noiseFloor * 1.75 + 0.006
      return rms > threshold || (snrOk && rms > SPEECH_RMS_FLOOR * 1.25)
    },
    reset() {
      noiseFloor = initialFloor
      threshold = Math.max(SPEECH_RMS_FLOOR, initialFloor * 1.85 + 0.008)
      calibSum = 0
      calibN = 0
    },
  }
}

/** High-pass before RMS so rumble / HVAC counts less as “speech energy”. */
export function connectSpeechAnalyser(
  context: AudioContext,
  stream: MediaStream,
): { source: MediaStreamAudioSourceNode; analyser: AnalyserNode; highpass: BiquadFilterNode } {
  const source = context.createMediaStreamSource(stream)
  const highpass = context.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = 140
  highpass.Q.value = 0.85
  const analyser = context.createAnalyser()
  analyser.fftSize = 2048
  analyser.smoothingTimeConstant = 0.4
  source.connect(highpass)
  highpass.connect(analyser)
  return { source, analyser, highpass }
}
