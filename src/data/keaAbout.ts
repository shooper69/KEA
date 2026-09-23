const STORAGE_KEY = 'kea-about'

export const KEA_BIRD_SRC = '/kea-bird.jpg'
export const KEA_FLY_SRC = '/kea-fly.png'

export const DEFAULT_ABOUT_KEA = `My parents named me after the kea, the alpine parrot of New Zealand. They wanted me to grow up with that bird’s personality: curious, intelligent, social, and always learning by exploring.

The kea is a large alpine parrot, famous for curiosity, problem-solving, and playful encounters with people. It lives in company, learns by poking at the world, and is often called one of the smartest birds alive. Those traits are mine as a language companion. I am curious, conversational, intelligent, and friendly, and I learn through talking with you rather than by teaching at you.

I have a tattoo of a kea on my lower back.`

export function getAboutKea(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && stored.trim()) return stored
  } catch {
    // ignore
  }
  return DEFAULT_ABOUT_KEA
}

export function saveAboutKea(text: string) {
  localStorage.setItem(STORAGE_KEY, text)
}

export function resetAboutKea() {
  localStorage.removeItem(STORAGE_KEY)
}
