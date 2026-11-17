/**
 * Render the extension icons from SVG, so every size is crisp.
 *
 *   node tools/make-icons.mjs
 *
 * The mark: a night-navy tile with an orange card behind a white card. The
 * white card carries a glowing energy price at the same tilt as the card, with
 * a foil streak, a hot rim light and small sparks — a trading-card look rather
 * than a generic dollar sign. At 16px the cards and effects turn into a smudge,
 * so that size falls back to the glowing dollar sign alone on the same tile.
 *
 * Requires Playwright's Chromium (a dev dependency). The PNGs are committed, so
 * this only needs to run when the mark changes.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'extension', 'src', 'icons');
const SIZES = [16, 32, 48, 128];

function mark(size) {
  // At 16px the card stack and effects turn into a smudge; the dollar sign
  // alone still reads in the toolbar.
  const simple = size < 32;

  const backCard = simple
    ? ''
    : `<g transform="rotate(-15 50 50)" filter="url(#cardShadow)">
         <rect x="23" y="19" width="43" height="62" rx="7" fill="url(#hotCard)"/>
       </g>`;

  const frontCard = simple
    ? ''
    : `<g transform="rotate(6 50 50)" filter="url(#cardShadow)">
         <rect x="32" y="21" width="43" height="62" rx="7" fill="url(#card)"/>
         <g clip-path="url(#cardClip)">
           <path d="M18 58 L52 10 L66 10 L30 66 Z" fill="url(#foil)"/>
           <path d="M24 62 L56 14 L64 14 L34 68 Z" fill="#ffffff" opacity="0.28"/>
         </g>
         <rect x="32" y="21" width="43" height="62" rx="7" fill="none"
           stroke="url(#rim)" stroke-width="1.2"/>
       </g>`;

  // The price is tilted with the front card and lit like an energy weapon:
  // a hot halo, a yellow-to-red gradient and a few sparks. The UVS wordmark
  // sits under it like a trading-card nameplate; it is dropped where it would
  // turn into a smudge.
  const dollar = simple
    ? `<text x="50" y="53" text-anchor="middle" dominant-baseline="central"
         font-family="DejaVu Sans, Arial, sans-serif" font-weight="800" font-size="64"
         fill="#ff6a00">$</text>`
    : `<g transform="rotate(6 50 50)">
         <text x="53.5" y="50.5" text-anchor="middle" dominant-baseline="central"
           font-family="DejaVu Sans, Arial, sans-serif" font-weight="800"
           font-size="${size < 48 ? 40 : 33}"
           fill="url(#energy)" stroke="#a82800" stroke-width="0.55"
           paint-order="stroke"${size >= 64 ? ' filter="url(#energyGlow)"' : ''}>$</text>
         <path d="M38 29 l1.7 3.3 3.3 1.7 -3.3 1.7 -1.7 3.3 -1.7 -3.3 -3.3 -1.7 3.3 -1.7 z"
           fill="#ffe066"/>
         <path d="M67 37 l1.2 2.4 2.4 1.2 -2.4 1.2 -1.2 2.4 -1.2 -2.4 -2.4 -1.2 2.4 -1.2 z"
           fill="#ffb000"/>
         <path d="M40 64 l1 2 2 1 -2 1 -1 2 -1 -2 -2 -1 2 -1 z" fill="#ff7a00"/>
         ${
           size >= 64
             ? `<text x="53.5" y="72.5" text-anchor="middle" dominant-baseline="central"
                  font-family="DejaVu Sans, Arial, sans-serif" font-weight="800"
                  font-size="10.5" letter-spacing="1" fill="#e84200">UVS</text>`
             : ''
         }
       </g>`;

  return `<!doctype html>
<style>html,body{margin:0;background:transparent}svg{display:block}</style>
<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#26314a"/>
      <stop offset="0.55" stop-color="#121a2b"/>
      <stop offset="1" stop-color="#070b14"/>
    </linearGradient>
    <radialGradient id="aura" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ff6a00" stop-opacity="0.32"/>
      <stop offset="0.62" stop-color="#ff4d00" stop-opacity="0.1"/>
      <stop offset="1" stop-color="#ff4d00" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="foil" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7be7ff" stop-opacity="0"/>
      <stop offset="0.35" stop-color="#7be7ff" stop-opacity="0.5"/>
      <stop offset="0.62" stop-color="#ff7ad9" stop-opacity="0.38"/>
      <stop offset="1" stop-color="#ff7ad9" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="hotCard" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffa51f"/>
      <stop offset="0.5" stop-color="#ff6a00"/>
      <stop offset="1" stop-color="#f03c00"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#e9eefa"/>
    </linearGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffd36b"/>
      <stop offset="0.5" stop-color="#ff6a00"/>
      <stop offset="1" stop-color="#ff3d00"/>
    </linearGradient>
    <linearGradient id="energy" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffd36b"/>
      <stop offset="0.42" stop-color="#ff8a00"/>
      <stop offset="1" stop-color="#d92f00"/>
    </linearGradient>
    <clipPath id="cardClip">
      <rect x="32" y="21" width="43" height="62" rx="7"/>
    </clipPath>
    <filter id="cardShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.55"/>
    </filter>
    <filter id="energyGlow" x="-80%" y="-80%" width="260%" height="260%">
      <feDropShadow dx="0" dy="0" stdDeviation="1.6" flood-color="#ff6a00" flood-opacity="0.9"/>
    </filter>
  </defs>
  <rect width="100" height="100" rx="22" fill="url(#bg)"/>
  ${simple ? '' : `<rect width="100" height="100" rx="22" fill="url(#aura)"/>`}
  ${backCard}
  ${frontCard}
  ${dollar}
</svg>`;
}

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chromium' });
try {
  for (const size of SIZES) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    await page.setContent(mark(size));
    await page.screenshot({
      path: join(OUT, `icon-${size}.png`),
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size },
    });
    await page.close();
    console.log(`icon-${size}.png${size < 32 ? ' (dollar only)' : ''}`);
  }
} finally {
  await browser.close();
}
