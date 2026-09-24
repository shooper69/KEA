/** Admin-editable leave-page conversion funnel (device-stored). */

const STORAGE_KEY = 'kea-leave-funnel-v1'

export type LeaveFunnelAdvance = 'any' | 'yes' | 'start'

export interface LeaveFunnelStep {
  id: string
  /** What Kea says and shows on screen. */
  spoken: string
  /**
   * any — opening: proceed on interest, decline path available
   * yes — question: Yes advances (No also continues the funnel)
   * start — final CTA toward create account
   */
  advance: LeaveFunnelAdvance
  /** Spoken when they decline the opening step. */
  declineSpoken?: string
}

export interface LeaveFunnelConfig {
  steps: LeaveFunnelStep[]
}

export const DEFAULT_LEAVE_FUNNEL: LeaveFunnelConfig = {
  steps: [
    {
      id: 'hook',
      spoken:
        "Hey, where are you going? Go on, check out if I'm right for you. Just tell me you're up for a quick chat here and now.",
      advance: 'any',
      declineSpoken: "OK see you, but I think you'll be back.",
    },
    {
      id: 'studying',
      spoken: 'Are you studying a language now?',
      advance: 'yes',
    },
    {
      id: 'vital',
      spoken:
        'Do you think that talking to someone is vital in learning a language?',
      advance: 'yes',
    },
    {
      id: 'friend',
      spoken:
        'Do you have a foreign friend to talk to who has time to chat and teach you?',
      advance: 'yes',
    },
    {
      id: 'paying',
      spoken: 'Are you paying to have conversational lessons?',
      advance: 'yes',
    },
    {
      id: 'tutor',
      spoken: 'Have you used a language tutor app before?',
      advance: 'yes',
    },
    {
      id: 'annoying',
      spoken:
        'Did you find being forced to learn about things that were not relevant and repetitively being forced down a learning route, simply annoying?',
      advance: 'yes',
    },
    {
      id: 'unstructured',
      spoken:
        'Do you, like me, not like structured language learning? And like the idea of chatting about anything and everything, but still get support when you make mistakes.',
      advance: 'yes',
    },
    {
      id: 'foreign-friend',
      spoken:
        'So do you think that chatting to a foreign friend would be a good way to learn?',
      advance: 'yes',
    },
    {
      id: 'start',
      spoken:
        "OK so what's stopping you chatting to me for 7 days for free? Shall we get started?",
      advance: 'yes',
    },
    {
      id: 'bonus',
      spoken:
        "OK, thanks for chatting. Here's a special bonus for you. If you subscribe right now, I'll give you not 50 but 60 percent off. Use this code: Superlearner. Let's get to know each other.",
      advance: 'start',
    },
  ],
}

function isAdvance(value: unknown): value is LeaveFunnelAdvance {
  return value === 'any' || value === 'yes' || value === 'start'
}

function isStep(value: unknown): value is LeaveFunnelStep {
  if (!value || typeof value !== 'object') return false
  const item = value as LeaveFunnelStep
  return (
    typeof item.id === 'string' &&
    typeof item.spoken === 'string' &&
    isAdvance(item.advance) &&
    (item.declineSpoken === undefined || typeof item.declineSpoken === 'string')
  )
}

export function loadLeaveFunnel(): LeaveFunnelConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return structuredClone(DEFAULT_LEAVE_FUNNEL)
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') {
      return structuredClone(DEFAULT_LEAVE_FUNNEL)
    }
    const steps = (parsed as LeaveFunnelConfig).steps
    if (!Array.isArray(steps) || steps.length === 0) {
      return structuredClone(DEFAULT_LEAVE_FUNNEL)
    }
    const cleaned = steps.filter(isStep).map((step) => ({
      id: step.id.trim() || crypto.randomUUID(),
      spoken: step.spoken.trim(),
      advance: step.advance,
      declineSpoken: step.declineSpoken?.trim() || undefined,
    }))
    if (cleaned.length === 0 || cleaned.some((step) => !step.spoken)) {
      return structuredClone(DEFAULT_LEAVE_FUNNEL)
    }
    // Ensure the Exit bonus finale exists even if an older saved funnel is present.
    if (!cleaned.some((step) => step.id === 'bonus')) {
      const bonus = DEFAULT_LEAVE_FUNNEL.steps.find((step) => step.id === 'bonus')
      if (bonus) {
        const withoutStartAdvance = cleaned.map((step) =>
          step.id === 'start' && step.advance === 'start'
            ? { ...step, advance: 'yes' as const }
            : step,
        )
        return { steps: [...withoutStartAdvance, { ...bonus }] }
      }
    }
    return { steps: cleaned }
  } catch {
    return structuredClone(DEFAULT_LEAVE_FUNNEL)
  }
}

export function saveLeaveFunnel(config: LeaveFunnelConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  window.dispatchEvent(new Event('kea-leave-funnel-changed'))
}

export function resetLeaveFunnel() {
  localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new Event('kea-leave-funnel-changed'))
}
