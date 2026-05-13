import pkg from '/Users/daniel/.claude/skills/lighthouse-runner/node_modules/playwright/index.js';
const { chromium } = pkg;
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '../public');

const BANANA_PATHS = `
  <path d="M4 13c3.5-2 8-2 10 2a5.5 5.5 0 0 1 8 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <path d="M5.15 17.89c5.52-1.52 8.65-6.89 7-12C11.55 4 11.5 2 13 2c3.22 0 5 5.5 5 8 0 6.5-4.2 12-10.49 12C5.11 22 2 22 2 20c0-1.5 1.14-1.55 3.15-2.11Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
`;

function iconHTML(size, dark) {
  const r = Math.round(size * 0.22); // corner radius (~22% — iOS squircle approx)
  const pad = Math.round(size * 0.18);
  const svgSize = size - pad * 2;

  if (dark) {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:${size}px; height:${size}px; overflow:hidden; background:transparent; }
</style>
</head>
<body>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bgGrad" cx="40%" cy="30%" r="70%">
      <stop offset="0%"  stop-color="#2a2a35"/>
      <stop offset="100%" stop-color="#0d0d12"/>
    </radialGradient>
    <linearGradient id="glassOverlay" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="rgba(255,255,255,0.12)"/>
      <stop offset="55%"  stop-color="rgba(255,255,255,0.03)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0.00)"/>
    </linearGradient>
    <linearGradient id="rimGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="rgba(255,255,255,0.30)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0.06)"/>
    </linearGradient>
    <clipPath id="roundClip">
      <rect width="${size}" height="${size}" rx="${r}" ry="${r}"/>
    </clipPath>
  </defs>

  <!-- background -->
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#bgGrad)"/>

  <!-- glass overlay -->
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#glassOverlay)" clip-path="url(#roundClip)"/>

  <!-- banana icon -->
  <g transform="translate(${pad},${pad})">
    <svg width="${svgSize}" height="${svgSize}" viewBox="0 0 24 24" style="overflow:visible">
      <g color="#FFD700" style="filter:drop-shadow(0 2px 8px rgba(255,210,0,0.35))">
        ${BANANA_PATHS}
      </g>
    </svg>
  </g>

  <!-- top specular rim -->
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}"
    fill="none"
    stroke="url(#rimGrad)"
    stroke-width="1.5"
    clip-path="url(#roundClip)"/>

  <!-- inner top highlight line -->
  <rect x="1" y="1" width="${size - 2}" height="${Math.round(size * 0.42)}" rx="${r}" ry="${r}"
    fill="none"
    stroke="rgba(255,255,255,0.08)"
    stroke-width="1"
    clip-path="url(#roundClip)"/>
</svg>
</body>
</html>`;
  }

  // Light mode
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:${size}px; height:${size}px; overflow:hidden; background:transparent; }
</style>
</head>
<body>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"   stop-color="#fffdf5"/>
      <stop offset="60%"  stop-color="#fff8e1"/>
      <stop offset="100%" stop-color="#fff3c4"/>
    </linearGradient>
    <linearGradient id="glassTop" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="rgba(255,255,255,0.88)"/>
      <stop offset="50%"  stop-color="rgba(255,255,255,0.30)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0.00)"/>
    </linearGradient>
    <linearGradient id="rimGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="rgba(255,255,255,1.00)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0.30)"/>
    </linearGradient>
    <clipPath id="roundClip">
      <rect width="${size}" height="${size}" rx="${r}" ry="${r}"/>
    </clipPath>
  </defs>

  <!-- background -->
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#bgGrad)"/>

  <!-- glass highlight layer (top half) -->
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}"
    fill="url(#glassTop)" clip-path="url(#roundClip)"/>

  <!-- banana icon -->
  <g transform="translate(${pad},${pad})">
    <svg width="${svgSize}" height="${svgSize}" viewBox="0 0 24 24" style="overflow:visible">
      <g color="#b8690a" style="filter:drop-shadow(0 2px 6px rgba(180,100,0,0.18))">
        ${BANANA_PATHS}
      </g>
    </svg>
  </g>

  <!-- top rim highlight -->
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}"
    fill="none"
    stroke="url(#rimGrad)"
    stroke-width="2"
    clip-path="url(#roundClip)"/>

  <!-- subtle outer shadow hint -->
  <rect x="0.75" y="0.75" width="${size - 1.5}" height="${size - 1.5}" rx="${r}" ry="${r}"
    fill="none"
    stroke="rgba(180,140,0,0.12)"
    stroke-width="1.5"/>
</svg>
</body>
</html>`;
}

async function generate() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const variants = [
    { size: 192, dark: false, out: 'icon-192x192.png' },
    { size: 512, dark: false, out: 'icon-512x512.png' },
    { size: 192, dark: true,  out: 'icon-192x192-dark.png' },
    { size: 512, dark: true,  out: 'icon-512x512-dark.png' },
  ];

  for (const { size, dark, out } of variants) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(iconHTML(size, dark), { waitUntil: 'networkidle' });
    const buf = await page.screenshot({ type: 'png', omitBackground: true });
    writeFileSync(resolve(publicDir, out), buf);
    console.log(`✓ ${out}`);
  }

  await browser.close();
  console.log('Done.');
}

generate().catch(e => { console.error(e); process.exit(1); });
