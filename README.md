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
- **Fueling schedule** — 20-min intake slots with gel/bar/chew picker; units per slot calculated automatically
- **Bottle planner** — bottle count, ml per bottle, carb content; drink product (water/carb mix/isotonic) offsets solid food needs
- **Collapsible input cards** — Rider Profile and Ride accordion; ride auto-collapses when all fields filled
- **Natural duration entry** — accepts `1:30`, `1.30`, `1,30`, or `1.5` (all parse to 1h 30min)
- **Desktop notice** — banner nudges desktop visitors to use on mobile; dismissible, remembered per session
- **Privacy** — profile data stored in `localStorage` (weight, FTP, unit preference). No server, no tracking.
- **Mobile sticky bar** — liquid glass overlay showing carbs/fluids/kcal per hour, always visible while scrolling
- **Mobile scroll-to-input** — tapping any input field scrolls it into view above the keyboard
- **Zone-reactive banana** — pendulum idle animation, color shifts yellow → red with intensity
- **Universal PWA icon** — power arc design (dark background, amber gauge arc, banana), works on any wallpaper
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

Generates `public/icon-192x192.png` and `public/icon-512x512.png` — power arc design, universal (works on light and dark wallpapers).

## Install as PWA

### Before you start — serve the production build

`pnpm dev` does **not** activate the service worker. You must build first:

```bash
pnpm build
pnpm preview --host
# → Network: http://192.168.x.x:4173
```

Your phone and computer must be on the **same WiFi network**. Open the `http://192.168.x.x:4173` URL on your phone.

Find your IP if it's not shown:
- **Mac**: `ipconfig getifaddr en0`
- **Windows**: `ipconfig` → look for IPv4 Address under your WiFi adapter

---

### iPhone / iPad (Safari only)

> **Must use Safari.** Chrome and Firefox on iOS cannot install PWAs.

1. Open `http://192.168.x.x:4173` in **Safari**
2. Tap the **Share** icon — box with an arrow pointing up (bottom toolbar)
3. Scroll down the share sheet → tap **Add to Home Screen**
4. Edit the name if you want → tap **Add**
5. App icon appears on your home screen
6. Launch from there — opens full-screen, no browser chrome

### Android (Chrome)

1. Open the URL in **Chrome**
2. Tap the **⋮** menu (top-right corner)
3. Tap **Add to Home screen** → **Add**
4. App icon appears on your home screen

> Chrome may also show an install banner at the bottom automatically — tap **Install**.

### Desktop (Chrome / Edge)

1. Open the app URL
2. Click the **⊕ install icon** in the address bar (right side)
3. Click **Install**

---

Once installed, the app works fully **offline** — all assets are precached on first load by the service worker.

## Project Structure

```
├── public/
│   ├── favicon.svg
│   ├── icon-192x192.png      # PWA icon (power arc, universal)
│   ├── icon-512x512.png      # PWA icon (power arc, maskable)
│   └── robots.txt
├── scripts/
│   └── gen-icons.mjs         # Playwright icon generator
├── src/
│   ├── App.svelte            # Single-component app
│   ├── app.css               # Design tokens + animations + liquid glass
│   └── main.js               # Entry point
├── vite.config.js            # Vite + PWA plugin config
└── index.html
```

## License

MIT
