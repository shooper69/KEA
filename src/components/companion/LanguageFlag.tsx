import type { LanguageCode } from '../../types'

function stripes(
  colors: string[],
  direction: 'h' | 'v',
) {
  const count = colors.length
  return colors.map((fill, index) =>
    direction === 'h' ? (
      <rect
        key={fill + index}
        y={(40 / count) * index}
        width="60"
        height={40 / count + 0.2}
        fill={fill}
      />
    ) : (
      <rect
        key={fill + index}
        x={(60 / count) * index}
        width={60 / count + 0.2}
        height="40"
        fill={fill}
      />
    ),
  )
}

function star(cx: number, cy: number, outer: number, inner: number) {
  const points: string[] = []
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outer : inner
    const angle = -Math.PI / 2 + (i * Math.PI) / 5
    points.push(
      `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`,
    )
  }
  return points.join(' ')
}

function NordicCross({
  field,
  cross,
  inner,
}: {
  field: string
  cross: string
  inner?: string
}) {
  return (
    <>
      <rect width="60" height="40" fill={field} />
      <rect x="16" width="12" height="40" fill={cross} />
      <rect y="14" width="60" height="12" fill={cross} />
      {inner ? (
        <>
          <rect x="19" width="6" height="40" fill={inner} />
          <rect y="17" width="60" height="6" fill={inner} />
        </>
      ) : null}
    </>
  )
}

function flagArt(code: LanguageCode | null) {
  switch (code) {
    case 'en':
      return (
        <>
          <rect width="60" height="40" fill="#012169" />
          <path d="M0 0 L60 40 M60 0 L0 40" stroke="#fff" strokeWidth="8" />
          <path d="M0 0 L60 40 M60 0 L0 40" stroke="#C8102E" strokeWidth="4" />
          <path d="M30 0 V40 M0 20 H60" stroke="#fff" strokeWidth="14" />
          <path d="M30 0 V40 M0 20 H60" stroke="#C8102E" strokeWidth="8" />
        </>
      )
    case 'es':
      return (
        <>
          <rect width="60" height="40" fill="#AA151B" />
          <rect y="10" width="60" height="20" fill="#F1BF00" />
        </>
      )
    case 'pt':
      return (
        <>
          <rect width="60" height="40" fill="#FF0000" />
          <rect width="24" height="40" fill="#006600" />
          <circle cx="24" cy="20" r="7" fill="#FFCC00" />
          <circle cx="24" cy="20" r="3.2" fill="#003399" />
        </>
      )
    case 'fr':
      return stripes(['#0055A4', '#FFFFFF', '#EF4135'], 'v')
    case 'de':
      return stripes(['#000000', '#DD0000', '#FFCE00'], 'h')
    case 'nl':
      return stripes(['#AE1C28', '#FFFFFF', '#21468B'], 'h')
    case 'it':
      return stripes(['#009246', '#FFFFFF', '#CE2B37'], 'v')
    case 'pl':
      return stripes(['#FFFFFF', '#DC143C'], 'h')
    case 'bg':
      return stripes(['#FFFFFF', '#00966E', '#D62612'], 'h')
    case 'ru':
      return stripes(['#FFFFFF', '#0039A6', '#D52B1E'], 'h')
    case 'uk':
      return stripes(['#005BBB', '#FFD500'], 'h')
    case 'cs':
      return (
        <>
          <rect width="60" height="20" fill="#FFFFFF" />
          <rect y="20" width="60" height="20" fill="#D7141A" />
          <polygon points="0,0 26,20 0,40" fill="#11457E" />
        </>
      )
    case 'sk':
      return (
        <>
          {stripes(['#FFFFFF', '#0B4EA2', '#EE1C25'], 'h')}
          <path d="M16 16 h8 v10 h-8 z" fill="#FFFFFF" />
          <path d="M17 18 h6 v2 h-6 z M17 21 h6 v2 h-6 z" fill="#EE1C25" />
          <path d="M17 23.2 h6 v1.6 h-6 z" fill="#0B4EA2" />
        </>
      )
    case 'ro':
      return stripes(['#002B7F', '#FCD116', '#CE1126'], 'v')
    case 'hu':
      return stripes(['#CE2939', '#FFFFFF', '#477050'], 'h')
    case 'hr':
      return (
        <>
          {stripes(['#FF0000', '#FFFFFF', '#171796'], 'h')}
          <rect x="26" y="14" width="8" height="10" fill="#FFFFFF" />
          <path d="M26 14 h2 v2 h-2 z M30 14 h2 v2 h-2 z M28 16 h2 v2 h-2 z M26 18 h2 v2 h-2 z M30 18 h2 v2 h-2 z M28 20 h2 v2 h-2 z" fill="#FF0000" />
        </>
      )
    case 'sr':
      return stripes(['#C6363C', '#0C4076', '#FFFFFF'], 'h')
    case 'sv':
      return <NordicCross field="#006AA7" cross="#FECC00" />
    case 'da':
      return <NordicCross field="#C60C30" cross="#FFFFFF" />
    case 'no':
      return <NordicCross field="#BA0C2F" cross="#FFFFFF" inner="#00205B" />
    case 'fi':
      return <NordicCross field="#FFFFFF" cross="#003580" />
    case 'el':
      return (
        <>
          {Array.from({ length: 9 }, (_, index) => (
            <rect
              key={index}
              y={(40 / 9) * index}
              width="60"
              height={40 / 9 + 0.15}
              fill={index % 2 === 0 ? '#0D5EAF' : '#FFFFFF'}
            />
          ))}
          <rect width="22" height={(40 / 9) * 5} fill="#0D5EAF" />
          <rect x="9" width="4" height={(40 / 9) * 5} fill="#FFFFFF" />
          <rect y={(40 / 9) * 2} width="22" height="4" fill="#FFFFFF" />
        </>
      )
    case 'tr':
      return (
        <>
          <rect width="60" height="40" fill="#E30A17" />
          <circle cx="24" cy="20" r="8" fill="#FFFFFF" />
          <circle cx="27" cy="20" r="6.4" fill="#E30A17" />
          <polygon points={star(33, 20, 4.2, 1.7)} fill="#FFFFFF" />
        </>
      )
    case 'ca':
      return stripes(
        ['#FCDD09', '#DA121A', '#FCDD09', '#DA121A', '#FCDD09', '#DA121A', '#FCDD09', '#DA121A', '#FCDD09'],
        'h',
      )
    case 'ar':
      return (
        <>
          <rect width="60" height="40" fill="#006C35" />
          <path d="M16 15 Q30 9 44 15" fill="none" stroke="#FFFFFF" strokeWidth="1.6" />
          <path d="M14 26 H42" stroke="#FFFFFF" strokeWidth="1.6" />
          <path d="M40 24.2 L46 26 L40 27.8 Z" fill="#FFFFFF" />
        </>
      )
    case 'he':
      return (
        <>
          <rect width="60" height="40" fill="#FFFFFF" />
          <rect y="6" width="60" height="4" fill="#0038B8" />
          <rect y="30" width="60" height="4" fill="#0038B8" />
          <polygon points="30,13 36,23 24,23" fill="none" stroke="#0038B8" strokeWidth="1.3" />
          <polygon points="30,25 36,15 24,15" fill="none" stroke="#0038B8" strokeWidth="1.3" />
        </>
      )
    case 'hi':
      return (
        <>
          {stripes(['#FF9933', '#FFFFFF', '#138808'], 'h')}
          <circle cx="30" cy="20" r="4.2" fill="none" stroke="#000080" strokeWidth="1.2" />
        </>
      )
    case 'zh':
      return (
        <>
          <rect width="60" height="40" fill="#DE2910" />
          <polygon points={star(14, 12, 5, 2)} fill="#FFDE00" />
          <polygon points={star(24, 6, 1.8, 0.7)} fill="#FFDE00" />
          <polygon points={star(28, 11, 1.8, 0.7)} fill="#FFDE00" />
          <polygon points={star(28, 17, 1.8, 0.7)} fill="#FFDE00" />
          <polygon points={star(24, 21, 1.8, 0.7)} fill="#FFDE00" />
        </>
      )
    case 'ja':
      return (
        <>
          <rect width="60" height="40" fill="#FFFFFF" />
          <circle cx="30" cy="20" r="8" fill="#BC002D" />
        </>
      )
    case 'ko':
      return (
        <>
          <rect width="60" height="40" fill="#FFFFFF" />
          <circle cx="30" cy="20" r="8" fill="#CD2E3A" />
          <path d="M30 12 A8 8 0 0 1 30 28 A4 4 0 0 1 30 20 A4 4 0 0 0 30 12" fill="#0047A0" />
        </>
      )
    case 'th':
      return (
        <>
          <rect width="60" height="40" fill="#A51931" />
          <rect y="6.5" width="60" height="27" fill="#F4F5F8" />
          <rect y="13" width="60" height="14" fill="#2D2A4A" />
        </>
      )
    case 'vi':
      return (
        <>
          <rect width="60" height="40" fill="#DA251D" />
          <polygon points={star(30, 20, 8, 3.2)} fill="#FFCD00" />
        </>
      )
    case 'id':
      return stripes(['#FF0000', '#FFFFFF'], 'h')
    default:
      return <rect width="60" height="40" fill="#D7E3EA" />
  }
}

export function LanguageFlag({ code }: { code: LanguageCode | null }) {
  return (
    <svg className="language-flag" viewBox="0 0 60 40" aria-hidden="true" focusable="false">
      {flagArt(code)}
    </svg>
  )
}
