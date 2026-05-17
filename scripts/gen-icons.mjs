import pkg from '/Users/daniel/.claude/skills/lighthouse-runner/node_modules/playwright/index.js';
const { chromium } = pkg;
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '../public');

function deg2rad(d) { return d * Math.PI / 180; }
function pt(cx, cy, r, deg) {
  return [cx + r * Math.cos(deg2rad(deg)), cy + r * Math.sin(deg2rad(deg))];
}

// Clockwise SVG arc path from startDeg to endDeg (degrees, SVG coords: 0°=right, 90°=down)
function arc(cx, cy, r, startDeg, endDeg) {
  const [sx, sy] = pt(cx, cy, r, startDeg);
  const [ex, ey] = pt(cx, cy, r, endDeg);
  let sweep = endDeg - startDeg;
  if (sweep <= 0) sweep += 360;
  const large = sweep > 180 ? 1 : 0;
  return `M ${sx.toFixed(2)},${sy.toFixed(2)} A ${r.toFixed(2)},${r.toFixed(2)} 0 ${large},1 ${ex.toFixed(2)},${ey.toFixed(2)}`;
}

function iconHTML(size) {
  const cr  = Math.round(size * 0.22);   // corner radius (iOS squircle)
  const cx  = size * 0.5;
  const cy  = size * 0.515;              // arc center, slightly below pixel-center
  const R   = size * 0.295;             // arc radius
  const tw  = size * 0.054;             // track stroke
  const aw  = size * 0.054;             // active arc stroke

  // Full track: 135° → 45° clockwise (270° arc, 90° gap at bottom)
  const trackD  = arc(cx, cy, R, 135, 405);   // 405 = 45+360, forces correct large-arc

  // Active arc: 135° → 337.5° clockwise (202.5° = 75% of track)
  const activeD = arc(cx, cy, R, 135, 337.5);

  // Gradient bounds (horizontal, spans full arc width)
  const gx1 = cx - R, gx2 = cx + R, gy = cy;

  // Skull — cranium + jaw, centered slightly above arc center
  const sk_ccy  = cy - size * 0.062;          // cranium center y
  const sk_cr   = size * 0.164;               // cranium radius
  const sk_jaw_y = sk_ccy + size * 0.098;     // jaw top y
  const sk_jaw_h = size * 0.078;              // jaw height
  const sk_jaw_w = size * 0.266;              // jaw width
  const sk_jaw_x = cx - sk_jaw_w / 2;         // jaw left x
  const sk_jaw_rx = size * 0.027;             // jaw corner radius
  const sk_ey   = sk_ccy - size * 0.016;      // eye center y
  const sk_lex  = cx - size * 0.066;          // left eye center x
  const sk_rex  = cx + size * 0.066;          // right eye center x
  const sk_er   = size * 0.043;               // eye socket radius
  const sk_ncy  = sk_ccy + size * 0.059;      // nose center y
  const sk_nrx  = size * 0.020;               // nose rx
  const sk_nry  = size * 0.023;               // nose ry
  const sk_gy   = sk_jaw_y + size * 0.008;    // teeth gap top y
  const sk_gw   = size * 0.023;               // teeth gap width
  const sk_gh   = size * 0.059;               // teeth gap height
  const sk_grx  = size * 0.006;               // teeth gap corner radius
  const sk_goff = size * 0.0606;              // teeth gap x offset from center

  // Glow stdDeviation
  const gsd = (size * 0.015).toFixed(1);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>* { margin:0; padding:0; } html,body { width:${size}px; height:${size}px; overflow:hidden; background:transparent; }</style>
</head>
<body>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="38%" cy="32%" r="72%">
      <stop offset="0%"   stop-color="#252530"/>
      <stop offset="100%" stop-color="#0f0f14"/>
    </radialGradient>
    <linearGradient id="arcG" x1="${gx1.toFixed(1)}" y1="${gy.toFixed(1)}" x2="${gx2.toFixed(1)}" y2="${gy.toFixed(1)}" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="#c02010"/>
      <stop offset="55%"  stop-color="#f73b20"/>
      <stop offset="100%" stop-color="#fb6040"/>
    </linearGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="0" y2="${size}" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="rgba(255,255,255,0.22)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0.04)"/>
    </linearGradient>
    <clipPath id="clip"><rect width="${size}" height="${size}" rx="${cr}" ry="${cr}"/></clipPath>
    <filter id="glow" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="${gsd}" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="skull-shadow">
      <feDropShadow dx="0" dy="0" stdDeviation="${(size*0.016).toFixed(1)}" flood-color="rgba(0,0,0,0.4)"/>
    </filter>
  </defs>

  <!-- background -->
  <rect width="${size}" height="${size}" rx="${cr}" ry="${cr}" fill="url(#bg)"/>

  <!-- dim track -->
  <path d="${trackD}"
    stroke="rgba(247,59,32,0.18)" stroke-width="${tw.toFixed(1)}"
    stroke-linecap="round" fill="none"/>

  <!-- active arc + glow -->
  <g filter="url(#glow)">
    <path d="${activeD}"
      stroke="url(#arcG)" stroke-width="${aw.toFixed(1)}"
      stroke-linecap="round" fill="none"/>
  </g>

  <!-- skull cranium -->
  <circle cx="${cx.toFixed(1)}" cy="${sk_ccy.toFixed(1)}" r="${sk_cr.toFixed(1)}" fill="#ffffff" filter="url(#skull-shadow)"/>
  <!-- skull jaw (overlaps cranium bottom → merges into one shape) -->
  <rect x="${sk_jaw_x.toFixed(1)}" y="${sk_jaw_y.toFixed(1)}" width="${sk_jaw_w.toFixed(1)}" height="${sk_jaw_h.toFixed(1)}" rx="${sk_jaw_rx.toFixed(1)}" fill="#ffffff"/>
  <!-- eye sockets -->
  <circle cx="${sk_lex.toFixed(1)}" cy="${sk_ey.toFixed(1)}" r="${sk_er.toFixed(1)}" fill="#111111"/>
  <circle cx="${sk_rex.toFixed(1)}" cy="${sk_ey.toFixed(1)}" r="${sk_er.toFixed(1)}" fill="#111111"/>
  <!-- nose cavity -->
  <ellipse cx="${cx.toFixed(1)}" cy="${sk_ncy.toFixed(1)}" rx="${sk_nrx.toFixed(1)}" ry="${sk_nry.toFixed(1)}" fill="#111111"/>
  <!-- teeth gaps (3) -->
  <rect x="${(cx - sk_goff - sk_gw/2).toFixed(1)}" y="${sk_gy.toFixed(1)}" width="${sk_gw.toFixed(1)}" height="${sk_gh.toFixed(1)}" rx="${sk_grx.toFixed(1)}" fill="#111111"/>
  <rect x="${(cx - sk_gw/2).toFixed(1)}" y="${sk_gy.toFixed(1)}" width="${sk_gw.toFixed(1)}" height="${sk_gh.toFixed(1)}" rx="${sk_grx.toFixed(1)}" fill="#111111"/>
  <rect x="${(cx + sk_goff - sk_gw/2).toFixed(1)}" y="${sk_gy.toFixed(1)}" width="${sk_gw.toFixed(1)}" height="${sk_gh.toFixed(1)}" rx="${sk_grx.toFixed(1)}" fill="#111111"/>

  <!-- glass rim -->
  <rect width="${size}" height="${size}" rx="${cr}" ry="${cr}"
    fill="none" stroke="url(#rim)" stroke-width="1.5" clip-path="url(#clip)"/>
</svg>
</body>
</html>`;
}

async function generate() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const variants = [
    { size: 192, out: 'icon-192x192.png' },
    { size: 512, out: 'icon-512x512.png' },
  ];

  for (const { size, out } of variants) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(iconHTML(size), { waitUntil: 'networkidle' });
    const buf = await page.screenshot({ type: 'png', omitBackground: true });
    writeFileSync(resolve(publicDir, out), buf);
    console.log(`✓ ${out}`);
  }

  await browser.close();
  console.log('Done.');
}

generate().catch(e => { console.error(e); process.exit(1); });
