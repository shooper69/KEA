export type PlanId = 'starter' | 'companion' | 'unlimited'

/**
 * Plan SKU. Commercial unit is monthly talk time.
 * `dailyMinutes` is the soft pacing guide used to derive the monthly
 * entitlement (dailyMinutes × days in month). 0 = unlimited.
 */
export interface KeaPlan {
  id: PlanId
  name: string
  tagline: string
  monthlyPrice: number
  dailyMinutes: number
  bullets: string[]
  stripePriceId: string
  featured: boolean
}

export interface KeaPlanCatalog {
  trialDays: number
  trialDailyMinutes: number
  trialBlurb: string
  currency: 'usd'
  plans: KeaPlan[]
}

export const DEFAULT_PLAN_CATALOG: KeaPlanCatalog = {
  trialDays: 7,
  trialDailyMinutes: 10,
  trialBlurb:
    'Seven days free, with about 70 minutes of conversation across the trial (about 10 minutes a day). After that, choose a monthly plan to keep talking with Kea.',
  currency: 'usd',
  plans: [
    {
      id: 'starter',
      name: 'Starter',
      tagline: 'A light monthly practice habit.',
      monthlyPrice: 9.99,
      dailyMinutes: 15,
      featured: false,
      stripePriceId: 'price_1UJqsa6G7iCRQAR8Scrj3QK0',
      bullets: [
        '7.5 hours of talk a month',
        'About 15 minutes a day as a soft pace',
        'Whisper listening and Kea’s voice',
        'Learn List and chat topics',
      ],
    },
    {
      id: 'companion',
      name: 'Companion',
      tagline: 'The everyday monthly plan.',
      monthlyPrice: 19.99,
      dailyMinutes: 45,
      featured: true,
      stripePriceId: 'price_1UJqsb6G7iCRQAR8eywbl44K',
      bullets: [
        '22.5 hours of talk a month',
        'About 45 minutes a day as a soft pace',
        'All voices the admin has enabled',
        'Best value for regular practice',
      ],
    },
    {
      id: 'unlimited',
      name: 'Unlimited',
      tagline: 'Talk as long as you like.',
      monthlyPrice: 34.99,
      dailyMinutes: 0,
      featured: false,
      stripePriceId: 'price_1UJqsd6G7iCRQAR87yJmgO4R',
      bullets: [
        'No monthly time cap',
        'Longer sessions without watching the clock',
        'For people who live in the language',
      ],
    },
  ],
}
