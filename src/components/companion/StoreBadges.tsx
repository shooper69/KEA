import { useState } from 'react'

/** App Store + Google Play badges (SVG, transparent outside the pill). */

const BADGE_FILL = '#2c2c2e'

function AppStoreBadge() {
  return (
    <svg
      className="store-badge__svg"
      viewBox="0 0 120 40"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden="true"
    >
      <rect x="0" y="0" width="120" height="40" rx="8" fill={BADGE_FILL} />
      <g fill="#f2f2f2" transform="translate(9.2 7.4) scale(0.82)">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .76-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 16.9 2.94 12.27 4.7 9.39c.87-1.44 2.43-2.33 4.12-2.39 1.28-.05 2.5.81 3.29.81.79 0 2.26-1.11 3.81-.97.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </g>
      <g fill="#f2f2f2">
        <text
          x="36.5"
          y="15.2"
          fontFamily="Helvetica, Arial, sans-serif"
          fontSize="7.2"
          letterSpacing="0.02em"
        >
          Download on the
        </text>
        <text
          x="36.5"
          y="28.5"
          fontFamily="Helvetica, Arial, sans-serif"
          fontSize="14"
          fontWeight="600"
          letterSpacing="-0.02em"
        >
          App Store
        </text>
      </g>
    </svg>
  )
}

function GooglePlayBadge() {
  return (
    <svg
      className="store-badge__svg"
      viewBox="0 0 135 40"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden="true"
    >
      <rect x="0" y="0" width="135" height="40" rx="8" fill={BADGE_FILL} />
      <g transform="translate(10.5 8.2)">
        <path
          d="M1.1 1.2C.7 1.6.5 2.3.5 3.2v17.1c0 .9.2 1.6.6 2l9.7-9.7L1.1 1.2Z"
          fill="#5BB8FF"
        />
        <path
          d="M17.4 13.1 14.1 11.2 1.1 22.3c.4.4 1 .5 1.6.3l14.7-8.3v-.1-.1Z"
          fill="#FF6B72"
        />
        <path
          d="M17.4 10.4 2.7 2.1C2.1 1.8 1.5 1.9 1.1 2.3l13 11.1 3.3-1.9.1-.1-.1-1Z"
          fill="#FFE066"
        />
        <path
          d="M14.1 12.3 1.1 1.2l13 11.1 3.3-1.9-3.3-1.9-.1-.2Z"
          fill="#4DBF84"
        />
      </g>
      <g fill="#f2f2f2">
        <text
          x="34"
          y="15.2"
          fontFamily="Roboto, Helvetica, Arial, sans-serif"
          fontSize="7.2"
          letterSpacing="0.04em"
        >
          GET IT ON
        </text>
        <text
          x="34"
          y="28.8"
          fontFamily="Roboto, Helvetica, Arial, sans-serif"
          fontSize="13.2"
          fontWeight="500"
          letterSpacing="-0.01em"
        >
          Google Play
        </text>
      </g>
    </svg>
  )
}

function ComingSoonBadge({ wide }: { wide?: boolean }) {
  return (
    <svg
      className="store-badge__svg"
      viewBox={wide ? '0 0 135 40' : '0 0 120 40'}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden="true"
    >
      <rect
        x="0"
        y="0"
        width={wide ? 135 : 120}
        height="40"
        rx="8"
        fill={BADGE_FILL}
      />
      <text
        x={wide ? 67.5 : 60}
        y="25"
        textAnchor="middle"
        fill="#f2f2f2"
        fontFamily="Helvetica, Arial, sans-serif"
        fontSize="13"
        fontWeight="600"
      >
        Coming Soon
      </text>
    </svg>
  )
}

export function StoreBadges() {
  const [appStoreSoon, setAppStoreSoon] = useState(false)
  const [playSoon, setPlaySoon] = useState(false)

  return (
    <div className="store-badges" aria-label="Get Kea on mobile">
      <button
        type="button"
        className="store-badge"
        aria-label={
          appStoreSoon ? 'App Store — Coming Soon' : 'Download on the App Store'
        }
        onClick={() => setAppStoreSoon(true)}
      >
        {appStoreSoon ? <ComingSoonBadge /> : <AppStoreBadge />}
      </button>
      <button
        type="button"
        className="store-badge"
        aria-label={
          playSoon ? 'Google Play — Coming Soon' : 'Get it on Google Play'
        }
        onClick={() => setPlaySoon(true)}
      >
        {playSoon ? <ComingSoonBadge wide /> : <GooglePlayBadge />}
      </button>
    </div>
  )
}
