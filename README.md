# *bonk*proof! — Cycling Nutrition Planner

Precision carbohydrate and fluid targets for endurance cyclists, calculated from FTP and ride power output.

## Features

- **Power-based carb formula** — piecewise model by Intensity Factor (Jeukendrup / ACSM). Two riders at the same watts get different recommendations based on their FTP.
- **Zone detection** — Recovery → Endurance → Tempo → Threshold → VO₂max+, driven by % FTP
- **Weight-scaled fluids** — larger athletes sweat more; fluid targets scale accordingly
- **Sweat type modifier** — light (−20%), moderate, heavy (+30%) fluid adjustment
- **Heat adjustment** — +0.3 L/h per 5°C above 20°C; temperature slider with live color feedback (track shifts dark → red above 20°C)
- **Dark / light / system theme** — cycles through all three modes; follows OS preference in system mode; persists to `localStorage`
- **Internationalisation** — English / German with browser language auto-detect; toggle in header with Y-axis flip animation; persists to `localStorage`; Wikipedia animal links resolve to correct language edition
- **Imperial / metric** — toggle converts all displayed values in place
- **Energy expenditure** — kcal/h via `power × 3.6` (cycling mechanical efficiency standard)
- **Speed + animal badge** — average pace with Wikipedia-linked animal comparison
- **Fueling schedule** — 20-min intake slots with gel/bar/chew picker; units per slot calculated automatically
- **Bottle planner** — bottle count, ml per bottle, carb content; drink product (water/carb mix/isotonic) offsets solid food needs
- **Pack checklist** — auto-generated gear list from ride data; tap to check off items
- **Collapsible input cards** — Rider Profile and Ride accordion with smooth `quintOut` transitions; ride auto-collapses when all fields filled
- **Natural duration entry** — accepts `1:30`, `1.30`, `1,30`, or `1.5` (all parse to 1h 30min)
- **Privacy** — profile data stored in `localStorage` (weight, FTP, unit preference). No server, no tracking.
- **Awesomic design system** — neutral dark-on-mist palette, 36px card radius, obsidian pill header
- **Wordmark animation** — *bonk* italic + proof! red; on load: proof crashes into bonk, bonk wobbles, banana icon flips 360° on impact; `tick()`-based class retrigger for reliable animation replay
- **Bottom sheets** — smooth `quintOut` enter / `cubicIn` dismiss with drag-to-close; shared drag state guarded against cross-sheet race; z-index hierarchy: header(995) < backdrop(996) < sheet(998) < toast(1000)
- **WCAG 2.1 AA** — all text and UI components meet contrast requirements
- **Mobile scroll-to-input** — tapping any input field scrolls it into view above the keyboard
- **PWA** — installable on phone, full offline support via Workbox service worker

## Science

| Zone | % FTP | Carbs |
|---|---|---|
| Recovery | < 55% | 0–20 g/h |
| Endurance | 55–75% | 20–40 g/h |
| Tempo | 75–90% | 40–60 g/h |
| Threshold | 90–105% | 60–90 g/h |
| VO₂max+ | > 105% | 90–120 g/h (glucose+fructose 2:1 required) |

## Tech Stack

- **Framework**: Svelte 5 + Vite (plain, no SvelteKit)
- **Styling**: Tailwind CSS v4 with Awesomic design tokens
- **Font**: DM Sans (Google Fonts)
- **Icons**: Lucide Svelte
- **Animations**: `svelte/motion` tweened stores, CSS keyframes
- **PWA**: `vite-plugin-pwa` + Workbox (generateSW mode)
- **Icon generation**: Playwright (headless Chromium renders SVG → PNG)

## Dev Setup

```bash
pnpm install
pnpm dev
```

## Production Build

```bash
pnpm build    # outputs to dist/
pnpm preview  # serve dist/ locally
```

## Regenerate App Icons

```bash
node scripts/gen-icons.mjs
```

Generates `public/icon-192x192.png` and `public/icon-512x512.png` from the banana favicon SVG.

## Install as PWA

### Before you start — serve the production build

`pnpm dev` does **not** activate the service worker. Build first:

```bash
pnpm build
pnpm preview --host
# → Network: http://192.168.x.x:4173
```

Your phone and computer must be on the **same WiFi network**. Open the network URL on your phone.

Find your IP:
- **Mac**: `ipconfig getifaddr en0`
- **Windows**: `ipconfig` → IPv4 Address under your WiFi adapter

---

### iPhone / iPad (Safari only)

> **Must use Safari.** Chrome and Firefox on iOS cannot install PWAs.

1. Open the URL in **Safari**
2. Tap the **Share** icon (bottom toolbar)
3. Scroll down → tap **Add to Home Screen**
4. Tap **Add**

### Android (Chrome)

1. Open the URL in **Chrome**
2. Tap **⋮** → **Add to Home screen** → **Add**

> Chrome may show an install banner automatically — tap **Install**.

### Desktop (Chrome / Edge)

1. Open the app URL
2. Click the **⊕ install icon** in the address bar
3. Click **Install**

---

Once installed, the app works fully **offline** — all assets are precached on first load.

## Project Structure

```
├── public/
│   ├── favicon.svg               # Banana icon (SVG source)
│   ├── icon-192x192.png          # PWA icon
│   ├── icon-512x512.png          # PWA icon (maskable)
│   └── robots.txt
├── scripts/
│   └── gen-icons.mjs             # Playwright icon generator
├── src/
│   ├── App.svelte                # Single-component app
│   ├── app.css                   # Awesomic design tokens + animations
│   ├── i18n.ts                   # EN/DE translations + lang store
│   ├── main.js                   # Entry point
│   └── vite-env.d.ts             # Vite global type declarations
├── vite.config.js                # Vite + PWA plugin config
└── index.html
```

## License

MIT
