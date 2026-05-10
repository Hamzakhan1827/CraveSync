// BiteSyncLogo.jsx — drop-in React component for the BiteSync mark + wordmark.
// No deps. Tailwind-friendly. SSR-safe. Backgrounds are transparent.
//
// Mark: "Sculpted B" — rounded tile, geometric B, fork on the upper-left edge,
// a spoon-curl tucked into the upper bowl. The B is the hero.
//
// Usage:
//   import { BiteSyncLogo, BiteSyncMark, BiteSyncWordmark } from './BiteSyncLogo';
//   <BiteSyncLogo />                            // mark + "BiteSync" text
//   <BiteSyncMark size={32} />                  // icon only (favicon, app icon)
//   <BiteSyncWordmark className="h-6 w-auto" /> // pure-SVG horizontal wordmark
//
// Theme:
//   <BiteSyncLogo accent="#10b981" textColor="#ffffff" tileColor="#0b1220" />
//   On a light surface:  textColor="#0b1220"  (tile stays dark)

import React from 'react';

const ACCENT = '#10b981';
const INK = '#0b1220';

/**
 * Sculpted-B icon mark.
 *
 * @param {object} props
 * @param {number|string} [props.size=32]      pixel size (square)
 * @param {string} [props.tileColor='#0b1220'] rounded tile fill
 * @param {string} [props.accent='#10b981']    B + fork + spoon color
 * @param {string} [props.className]
 */
export function BiteSyncMark({
  size = 32,
  tileColor = INK,
  accent = ACCENT,
  className,
  ...rest
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      role="img"
      aria-label="BiteSync"
      className={className}
      {...rest}
    >
      <rect x="4" y="4" width="88" height="88" rx="22" fill={tileColor} />
      {/* B silhouette + counters via even-odd */}
      <path
        fillRule="evenodd"
        d="M42 14h18c9 0 16 6 16 14 0 6-3 11-8 13 6 2 10 7 10 14 0 9-7 17-17 17H42V14Zm8 9v18h11c5 0 9-3 9-9s-4-9-9-9H50Zm0 27v22h13c6 0 10-4 10-11s-4-11-10-11H50Z"
        fill={accent}
      />
      {/* spoon curl in upper counter */}
      <path
        d="M55 27c5-1 10 2 10 6 0 3-2 6-5 7"
        stroke={accent}
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
      {/* fork on left, slightly overlapping B */}
      <g fill={accent}>
        <rect x="22" y="11" width="2.6" height="13" rx="1.2" />
        <rect x="28" y="11" width="2.6" height="13" rx="1.2" />
        <rect x="34" y="11" width="2.6" height="13" rx="1.2" />
        <path d="M20 24h20v3c0 5-3 9-7 10v33a3 3 0 1 1-6 0V37c-4-1-7-5-7-10v-3Z" />
      </g>
    </svg>
  );
}

/**
 * Horizontal lockup: mark + "BiteSync" text. Use in headers, footers, decks.
 */
export function BiteSyncLogo({
  size = 28,
  accent = ACCENT,
  textColor = '#ffffff',
  tileColor = INK,
  gap = 10,
  className,
  ...rest
}) {
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap,
        lineHeight: 1,
      }}
      {...rest}
    >
      <BiteSyncMark size={size * 1.4} tileColor={tileColor} accent={accent} />
      <span
        style={{
          fontFamily:
            'Inter, "Helvetica Neue", system-ui, -apple-system, sans-serif',
          fontWeight: 700,
          fontSize: size,
          letterSpacing: '-0.02em',
          color: textColor,
        }}
      >
        Bite<span style={{ color: accent }}>Sync</span>
      </span>
    </span>
  );
}

/**
 * Pure-SVG wordmark — sculpted B leads, then "iteSync" set in Inter.
 * No tile behind the B, so it sits inline cleanly with text.
 */
export function BiteSyncWordmark({
  height = 32,
  accent = ACCENT,
  textColor = '#ffffff',
  className,
  ...rest
}) {
  return (
    <svg
      viewBox="0 0 296 64"
      height={height}
      fill="none"
      role="img"
      aria-label="BiteSync"
      className={className}
      {...rest}
    >
      {/* fork */}
      <g fill={accent}>
        <rect x="0" y="0" width="2.4" height="11" rx="1" />
        <rect x="6" y="0" width="2.4" height="11" rx="1" />
        <rect x="12" y="0" width="2.4" height="11" rx="1" />
        <path d="M-2 11h18v2c0 4-3 7-6 8v28a3 3 0 1 1-6 0V21c-3-1-6-4-6-8v-2Z" />
      </g>
      {/* B */}
      <path
        fillRule="evenodd"
        d="M22 4h14c7 0 12 4 12 11 0 5-2 8-6 10 5 1 8 5 8 11 0 7-5 13-13 13H22V4Zm6 7v14h9c4 0 7-2 7-7s-3-7-7-7h-9Zm0 21v17h10c5 0 8-3 8-8.5s-3-8.5-8-8.5H28Z"
        fill={textColor}
      />
      {/* spoon curl */}
      <path
        d="M30 14c4-1 8 2 8 5 0 2-2 5-4 5"
        stroke={textColor}
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <text
        x="58"
        y="46"
        fontFamily='Inter, "Helvetica Neue", system-ui, sans-serif'
        fontWeight="700"
        fontSize="44"
        letterSpacing="-1.2"
        fill={textColor}
      >
        ite
      </text>
      <text
        x="123"
        y="46"
        fontFamily='Inter, "Helvetica Neue", system-ui, sans-serif'
        fontWeight="700"
        fontSize="44"
        letterSpacing="-1.2"
        fill={accent}
      >
        Sync
      </text>
    </svg>
  );
}

export default BiteSyncLogo;
