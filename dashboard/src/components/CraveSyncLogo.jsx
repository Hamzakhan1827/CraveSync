import React from 'react';

const ACCENT = '#10b981';
const INK = '#0b1220';

export function CraveSyncMark({ size = 32, tileColor = INK, accent = ACCENT, className, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      role="img"
      aria-label="CraveSync"
      className={className}
      {...rest}
    >
      <circle cx="48" cy="48" r="44" fill={accent} />
      {/* Fork */}
      <g fill="white">
        <rect x="22" y="14" width="2.8" height="14" rx="1.2" />
        <rect x="28.6" y="14" width="2.8" height="14" rx="1.2" />
        <rect x="35.2" y="14" width="2.8" height="14" rx="1.2" />
        <path d="M20 28h20v3c0 5-3 8-7 9v27a3 3 0 0 1-6 0V40c-4-1-7-4-7-9v-3z" />
      </g>
      {/* Knife */}
      <g fill="white">
        <path d="M58 14c0 0 9 7 9 17H58V14z" />
        <rect x="55.5" y="31" width="6" height="37" rx="3" />
      </g>
    </svg>
  );
}

export function CraveSyncLogo({ size = 28, accent = ACCENT, textColor = '#ffffff', tileColor = INK, gap = 10, className, ...rest }) {
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap, lineHeight: 1 }}
      {...rest}
    >
      <CraveSyncMark size={size * 1.4} tileColor={tileColor} accent={accent} />
      <span
        style={{
          fontFamily: 'Inter, "Helvetica Neue", system-ui, -apple-system, sans-serif',
          fontWeight: 700,
          fontSize: size,
          letterSpacing: '-0.02em',
          color: textColor,
        }}
      >
        Crave<span style={{ color: accent }}>Sync</span>
      </span>
    </span>
  );
}

export function CraveSyncWordmark({ height = 32, accent = ACCENT, textColor = '#ffffff', className, ...rest }) {
  return (
    <svg
      viewBox="0 0 320 64"
      height={height}
      fill="none"
      role="img"
      aria-label="CraveSync"
      className={className}
      {...rest}
    >
      {/* Emblem badge mark scaled to 64×64 */}
      <g transform="scale(0.667)">
        <circle cx="48" cy="48" r="44" fill={accent} />
        <g fill="white">
          <rect x="22" y="14" width="2.8" height="14" rx="1.2" />
          <rect x="28.6" y="14" width="2.8" height="14" rx="1.2" />
          <rect x="35.2" y="14" width="2.8" height="14" rx="1.2" />
          <path d="M20 28h20v3c0 5-3 8-7 9v27a3 3 0 0 1-6 0V40c-4-1-7-4-7-9v-3z" />
        </g>
        <g fill="white">
          <path d="M58 14c0 0 9 7 9 17H58V14z" />
          <rect x="55.5" y="31" width="6" height="37" rx="3" />
        </g>
      </g>
      {/* Wordmark text */}
      <text x="76" y="46" fontFamily='Inter, "Helvetica Neue", system-ui, sans-serif' fontWeight="700" fontSize="44" letterSpacing="-1.2" fill={textColor}>Crave</text>
      <text x="216" y="46" fontFamily='Inter, "Helvetica Neue", system-ui, sans-serif' fontWeight="700" fontSize="44" letterSpacing="-1.2" fill={accent}>Sync</text>
    </svg>
  );
}

export default CraveSyncLogo;
