import { getLanguage } from './languages'
import { listVoices, speakText } from '../lib/speech'
import { readChosenTts } from '../lib/chosenTts'
import type { LanguageCode, VoicePersonality, VoicePersonalityId } from '../types'

export const DEFAULT_VOICE_CHARACTER: VoicePersonalityId = 'luna'

export const VOICE_PERSONALITIES: VoicePersonality[] = [
  {
    id: 'luna',
    name: 'Serious mood',
    style: 'firm and to the point',
    gender: 'female',
    rate: 0.98,
    samples: {
      en: 'Let’s get to the point. Tell me what happened.',
      es: 'Vamos al grano. Cuéntame qué pasó.',
      fr: 'Allons droit au but. Dis-moi ce qui s’est passé.',
      de: 'Kommen wir zur Sache. Erzähl, was passiert ist.',
      ru: 'Давай к делу. Расскажи, что случилось.',
    },
  },
  {
    id: 'mira',
    name: 'Playful mood',
    style: 'bright, lightly teasing',
    gender: 'female',
    rate: 1.02,
    samples: {
      en: 'Go on then. I want the whole story.',
      es: 'Anda, cuéntame todo.',
      fr: 'Allez, raconte-moi tout.',
      de: 'Na los. Ich will die ganze Geschichte.',
      ru: 'Ну давай. Хочу всю историю.',
    },
  },
  {
    id: 'sage',
    name: 'Gentle mood',
    style: 'calm, gently guiding',
    gender: 'female',
    rate: 0.9,
    samples: {
      en: 'Take your time. I’m listening.',
      es: 'Sin prisa. Te escucho.',
      fr: 'Prends ton temps. Je t’écoute.',
      de: 'Lass dir Zeit. Ich höre zu.',
      ru: 'Не торопись. Я слушаю.',
    },
  },
  {
    id: 'rowan',
    name: 'Steady mood',
    style: 'low, even, unshaken',
    gender: 'female',
    rate: 0.92,
    samples: {
      en: 'I’m here. Say it in your own way.',
      es: 'Estoy aquí. Dilo a tu manera.',
      fr: 'Je suis là. Dis-le à ta façon.',
      de: 'Ich bin da. Sag es auf deine Weise.',
      ru: 'Я здесь. Скажи это по-своему.',
    },
  },
  {
    id: 'theo',
    name: 'Quiet mood',
    style: 'soft, never in a rush',
    gender: 'female',
    rate: 0.88,
    samples: {
      en: 'We can sit with this. No rush.',
      es: 'Podemos quedarnos aquí. Sin prisa.',
      fr: 'On peut rester là. Pas de précipitation.',
      de: 'Wir können dabei bleiben. Keine Eile.',
      ru: 'Можно побыть с этим. Без спешки.',
    },
  },
]

const FEMALE =
  /zira|hazel|susan|helena|sabina|lucia|paloma|monica|paulina|elsa|jenny|aria|samantha|victoria|karen|moira|tessa|fiona|catherine|linda|heera|haruka|kyoko|female|woman|girl/i
const MALE =
  /george|david|mark|james|daniel|pablo|jorge|diego|thomas|ravi|richard|sean|fred|male|\bman\b|guy/i

export function getVoicePersonality(id: VoicePersonalityId) {
  return (
    VOICE_PERSONALITIES.find((item) => item.id === id) ?? VOICE_PERSONALITIES[0]
  )
}

export function pickVoiceForCharacter(
  voices: SpeechSynthesisVoice[],
  personality: VoicePersonality,
  lang: string,
) {
  if (voices.length === 0) return undefined
  const prefix = lang.slice(0, 2).toLowerCase()
  const genderTest = personality.gender === 'female' ? FEMALE : MALE
  const otherTest = personality.gender === 'female' ? MALE : FEMALE
  const scored = voices
    .map((voice) => {
      let score = 0
      if (voice.lang.toLowerCase().startsWith(prefix)) score += 6
      if (genderTest.test(voice.name)) score += 8
      if (otherTest.test(voice.name)) score -= 6
      if (voice.localService) score += 1
      return { voice, score }
    })
    .sort((a, b) => b.score - a.score)
  return scored[0]?.voice
}

export function playMoodSample(
  mood: VoicePersonality,
  languageCode: LanguageCode,
) {
  const language = getLanguage(languageCode)
  const text =
    mood.samples[languageCode] ?? mood.samples.en ?? mood.style
  const voices = listVoices()
  const chosen = readChosenTts()
  speakText(text, {
    lang: language.speechLocale,
    rate: mood.rate,
    pitch: chosen?.pitch,
    voiceURI:
      chosen?.voiceURI ||
      pickVoiceForCharacter(voices, mood, language.speechLocale)?.voiceURI,
  })
}
