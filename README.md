# BananaSprocket — Cycling Nutrition Planner

Precision carbohydrate and fluid targets for endurance cyclists, calculated from FTP and ride power output.

## Features

- **Power-based carb formula** — piecewise model by Intensity Factor (Jeukendrup / ACSM). Two riders at the same watts get different recommendations based on their FTP.
- **Zone detection** — Recovery → Endurance → Tempo → Threshold → VO₂max+, driven by % FTP
- **Weight-scaled fluids** — larger athletes sweat more; fluid targets scale accordingly
- **Sweat rate modifier** — light (−20%), moderate, heavy (+30%) fluid adjustment
- **Heat adjustment** — +0.3 L/h per 5°C above 20°C
- **Imperial / metric** — toggle converts all displayed values in place
- **Energy expenditure** — kcal/h via `power × 3.6` (cycling mechanical efficiency standard)
- **Speed + animal badge** — average pace with Wikipedia-linked animal comparison
- **Mobile sticky bar** — liquid glass overlay showing carbs/fluids/kcal per hour, always visible while scrolling
- **Zone-reactive banana** — pendulum idle animation, color shifts yellow → red with intensity
- **PWA** — installable on phone, full offline support via Workbox service worker
- **Lighthouse 100/100** — Performance, Accessibility, Best Practices, SEO

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
- **Styling**: Tailwind CSS v4 with Nike design tokens
- **Icons**: Lucide Svelte
- **Animations**: `svelte/motion` tweened stores, CSS keyframes
- **PWA**: `vite-plugin-pwa` + Workbox (generateSW mode)

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

## Install as PWA

### Android (Chrome)
1. Open the app in Chrome
2. Tap the **⋮** menu → **Add to Home screen**
3. Tap **Add** — app appears on your home screen and runs standalone

### iOS (Safari)
1. Open the app in Safari
2. Tap the **Share** button (box with arrow)
3. Scroll down → tap **Add to Home Screen**
4. Tap **Add** — app launches without browser UI

### Desktop (Chrome / Edge)
1. Open the app
2. Click the **install icon** (⊕) in the address bar
3. Click **Install**

Once installed, the app works fully offline — all assets are precached by the service worker on first load.

## Project Structure

```
├── public/
│   ├── favicon.svg
│   ├── icon-192x192.png   # PWA icon
│   ├── icon-512x512.png   # PWA icon (maskable)
│   └── robots.txt
├── src/
│   ├── App.svelte          # Single-component app
│   ├── app.css             # Nike design tokens + animations + liquid glass
│   └── main.js             # Entry point
├── vite.config.js          # Vite + PWA plugin config
└── index.html
```

## License

MIT
