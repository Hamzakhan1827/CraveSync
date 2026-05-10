# BiteSync logo assets

Drop-in package for the dashboard and the mobile app. **Primary mark: Sculpted B** (Concept 07) — geometric B with a fork on the upper-left edge and a spoon-curl tucked into the upper bowl. Transparent backgrounds throughout.

```
export/
├── BiteSyncLogo.jsx        ← React component (use this in the dashboard)
├── README.md
└── svg/
    ├── favicon.svg              ← primary mark, favicon-ready
    ├── mark-07-sculpt-b.svg     ← same as favicon, full-size source
    ├── wordmark.svg             ← horizontal "BiteSync" with sculpted B
    └── mark-01…06.svg           ← earlier concepts, kept for reference
```

## Web dashboard (Next.js / React / Vite)

### Option A — React component (recommended)
Copy `BiteSyncLogo.jsx` to `src/components/BiteSyncLogo.jsx`:

```jsx
import { BiteSyncLogo, BiteSyncMark } from '@/components/BiteSyncLogo';

// Top bar
<BiteSyncLogo size={20} />

// On a light surface
<BiteSyncLogo size={20} textColor="#0b1220" />

// Just the icon
<BiteSyncMark size={28} />

// Theme override
<BiteSyncMark size={28} tileColor="#0b1220" accent="#10b981" />
```

Props: `size`, `accent`, `textColor`, `tileColor`, `gap`, `className`. SSR-safe, no deps.

### Option B — Static SVG
```jsx
<img src="/mark-07-sculpt-b.svg" alt="BiteSync" className="h-8 w-8" />
```

### Favicon
```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
```

## Mobile app (React Native)

```bash
npm i react-native-svg react-native-svg-transformer
```

```js
import Logo from './assets/mark-07-sculpt-b.svg';
<Logo width={32} height={32} />
```

Or paste `BiteSyncLogo.jsx` and swap `<svg>` for `<Svg>` from `react-native-svg`.

## Prompt for Claude Code

> Add the BiteSync logo. Copy `export/BiteSyncLogo.jsx` to `src/components/BiteSyncLogo.jsx` and replace the existing logo in the dashboard top bar with `<BiteSyncLogo size={20} />`. Copy `export/svg/favicon.svg` to `public/favicon.svg` and update the `<link rel="icon">` in the root layout. For the mobile app, install `react-native-svg` + `react-native-svg-transformer`, copy `export/svg/mark-07-sculpt-b.svg` to `assets/logo.svg`, and use it as the splash + launcher icon.

## Tokens

| Token       | Value     |
| ----------- | --------- |
| Accent      | `#10b981` |
| Accent deep | `#059669` |
| Ink (tile)  | `#0b1220` |
| Card ink    | `#111a2e` |
| Mute        | `#cfd6e4` |
