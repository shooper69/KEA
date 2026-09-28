export type RussianScript = 'cyrillic' | 'phonetic'

const KEY = 'kea-russian-script'

const CYRILLIC: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
}

export function readRussianScript(): RussianScript {
  try {
    return localStorage.getItem(KEY) === 'phonetic' ? 'phonetic' : 'cyrillic'
  } catch {
    return 'cyrillic'
  }
}

export function saveRussianScript(script: RussianScript) {
  try {
    localStorage.setItem(KEY, script)
  } catch {
    // ignore
  }
}

export function pairIncludesRussian(
  native: string | null | undefined,
  target: string | null | undefined,
) {
  return native === 'ru' || target === 'ru'
}

/** Latin spelling for Russian letters. Other characters stay as they are. */
export function transliterateRussian(text: string) {
  let out = ''
  for (const ch of text) {
    const mapped = CYRILLIC[ch.toLowerCase()]
    if (mapped === undefined) {
      out += ch
      continue
    }
    if (!mapped) continue
    if (ch !== ch.toLowerCase()) {
      out += mapped.charAt(0).toUpperCase() + mapped.slice(1)
    } else {
      out += mapped
    }
  }
  return out
}

export function presentRussian(text: string) {
  if (readRussianScript() !== 'phonetic') return text
  return transliterateRussian(text)
}
