import type { VoicePersonalityId, VoicePresenceState } from '../types'

/**
 * Voice companion architecture (placeholder)
 *
 * KEA is voice-first. The user should be able to wear headphones,
 * keep the phone in a pocket, and talk naturally — no typing.
 *
 * The voice should feel as if it comes from the swirling clouds.
 * CloudAtmosphere reads VoicePresenceState:
 *   idle      — slow fog
 *   listening — a gentle inward breath
 *   speaking  — clouds flow with the voice
 *
 * Future integration: OpenAI GPT voice (speech-to-speech).
 * Do not call any voice APIs from this module.
 */

export interface VoiceCompanionConfig {
  provider: 'openai-gpt-voice'
  personalityId: VoicePersonalityId
  handsFree: true
}

export interface VoiceCompanionBridge {
  presence: VoicePresenceState
  startListening(): Promise<void>
  stopListening(): Promise<void>
  speak(text: string): Promise<void>
}

export const DEFAULT_VOICE_CONFIG: VoiceCompanionConfig = {
  provider: 'openai-gpt-voice',
  personalityId: 'wise-female',
  handsFree: true,
}
